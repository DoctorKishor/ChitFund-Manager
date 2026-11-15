'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { triggerHapticFeedback } from '@/utils/haptics';
import { 
  Printer, 
  Download, 
  X, 
  Check, 
  Calendar, 
  Layers, 
  Sliders, 
  Sparkles, 
  RefreshCw,
  FileText,
  Eye,
  Settings2,
  Plus,
  Minus,
  Type
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getFirstSundayOnOrAfterDay } from '@/utils/auctionSchedule';

export interface PaymentChecklistGroup {
  id: string;
  name: string;
  totalValue: number;
  total_value?: number;
  duration: number;
  duration_months?: number;
  memberCount?: number;
  member_count?: number;
  currentMonth?: number;
  current_month?: number;
  startDate?: string;
  start_date?: string;
  auctionDayOfMonth?: number;
  auction_day_of_month?: number;
  auctionTime?: string;
  auction_time?: string;
  nextAuctionDate?: string | null;
  next_auction_date?: string | null;
  nextAuctionTime?: string | null;
  next_auction_time?: string | null;
  kaiIruppuPool?: number;
  kai_iruppu_pool?: number;
}

interface PaymentChecklistPrintModalProps {
  group: PaymentChecklistGroup;
  onClose: () => void;
}

interface MemberRow {
  ticket: number;
  profileId?: string;
  name: string;
  phone?: string;
  dueAmount: number;
  paidDate?: string;
  paidAmount?: number;
  balanceAmount?: number;
  isPaid?: boolean;
}

export default function PaymentChecklistPrintModal({ group, onClose }: PaymentChecklistPrintModalProps) {
  const printableRef = useRef<HTMLDivElement>(null);

  // Configuration States
  const currentGroupMonth = (group.currentMonth !== undefined && group.currentMonth !== null) 
    ? Number(group.currentMonth) 
    : (group.current_month !== undefined && group.current_month !== null) 
      ? Number(group.current_month) 
      : 1;
  const totalMembers = group.duration || group.duration_months || group.memberCount || group.member_count || 20;
  const totalVal = Number(group.totalValue || group.total_value || 0);
  const baseMonthlyInstallment = Math.round(totalVal / (totalMembers || 1));

  // Multi-Month vs Single Month Mode
  const [collectionMode, setCollectionMode] = useState<'single' | 'multi'>('single');
  const [selectedSingleMonth, setSelectedSingleMonth] = useState<number>(currentGroupMonth);
  const [selectedMultiMonths, setSelectedMultiMonths] = useState<number[]>([
    currentGroupMonth,
    Math.min(totalMembers, currentGroupMonth + 1)
  ]);

  const [prefillPayments, setPrefillPayments] = useState<boolean>(false);
  const [invocationTitle, setInvocationTitle] = useState<string>('OM NAMA SIVAYA');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Typable Font Size Control (Office / MS Word Style)
  const [tableFontSize, setTableFontSize] = useState<number>(() => {
    const count = group.duration || group.duration_months || 20;
    if (count <= 10) return 16;
    if (count <= 20) return 14;
    return 12;
  });

  const effectiveFontSize = tableFontSize && tableFontSize >= 6 ? Math.min(32, tableFontSize) : 14;

  const handleFontSizeChange = (valStr: string) => {
    if (valStr === '') {
      setTableFontSize(0);
      return;
    }
    const val = parseInt(valStr, 10);
    if (!isNaN(val)) {
      setTableFontSize(Math.min(32, Math.max(0, val)));
    }
  };

  const handleFontSizeBlur = () => {
    if (!tableFontSize || tableFontSize < 8) {
      setTableFontSize(8);
    } else if (tableFontSize > 28) {
      setTableFontSize(28);
    }
  };

  // Raw fetched database records
  const [members, setMembers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);

  // Active selected months list
  const activeMonthsList = useMemo(() => {
    if (collectionMode === 'single') {
      return [selectedSingleMonth];
    }
    return selectedMultiMonths.length > 0 ? [...selectedMultiMonths].sort((a, b) => a - b) : [selectedSingleMonth];
  }, [collectionMode, selectedSingleMonth, selectedMultiMonths]);

  // Compute exact scheduled date according to configured Chit Fund rules
  const computeCycleDetails = (mNum: number) => {
    const rawStart = group.startDate || group.start_date;
    let sYear = new Date().getFullYear();
    let sMonth = new Date().getMonth();
    let sDay = 10;
    if (rawStart) {
      if (rawStart.includes('-')) {
        const parts = rawStart.split('-');
        sYear = parseInt(parts[0], 10);
        sMonth = parseInt(parts[1], 10) - 1;
        sDay = parseInt(parts[2], 10) || 10;
      } else {
        const parsed = new Date(rawStart);
        if (!isNaN(parsed.getTime())) {
          sYear = parsed.getFullYear();
          sMonth = parsed.getMonth();
          sDay = parsed.getDate();
        }
      }
    }

    const cutoffDay = Number(group.auction_day_of_month ?? group.auctionDayOfMonth ?? 10);

    // Month 0: Launch / Orientation month -> start date
    if (mNum === 0) {
      const targetDate = new Date(sYear, sMonth, sDay);
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const yyyy = targetDate.getFullYear();
      const monthName = targetDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      return {
        formattedDate: `${dd}.${mm}.${yyyy}`,
        monthName,
        headerCycleLabel: `${monthName} (LAUNCH MONTH)`,
      };
    }

    // If an explicit override next_auction_date exists and this is the current active month
    const explicitDateStr = group.next_auction_date || group.nextAuctionDate;
    if (mNum === currentGroupMonth && explicitDateStr) {
      const parts = explicitDateStr.split('-');
      if (parts.length === 3) {
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, '0');
        const dd = parts[2].padStart(2, '0');
        const dObj = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
        const monthName = dObj.toLocaleString('en-US', { month: 'long' }).toUpperCase();
        return {
          formattedDate: `${dd}.${mm}.${yyyy}`,
          monthName,
          headerCycleLabel: monthName,
        };
      }
    }

    // Canonical Chit Fund rule: 1st Sunday on or after cutoff day of (sMonth + mNum)
    const targetYear = sYear + Math.floor((sMonth + mNum) / 12);
    const targetMonth = ((sMonth + mNum) % 12 + 12) % 12;
    const targetDate = getFirstSundayOnOrAfterDay(targetYear, targetMonth, cutoffDay);

    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yyyy = targetDate.getFullYear();
    const monthName = targetDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();

    return {
      formattedDate: `${dd}.${mm}.${yyyy}`,
      monthName,
      headerCycleLabel: monthName,
    };
  };

  // Compute month label and default date for the selected cycles
  const computedMonthDetails = useMemo(() => {
    if (collectionMode === 'single') {
      const details = computeCycleDetails(selectedSingleMonth);
      return {
        headerCycleLabel: details.headerCycleLabel,
        formattedDate: details.formattedDate,
      };
    } else {
      // Multi-Month Mode: Generate comma separated names (e.g. "OCTOBER, NOVEMBER")
      const monthNames = activeMonthsList.map(mNum => computeCycleDetails(mNum).monthName);

      // Latest scheduled date among the selected months
      const lastMonthNum = activeMonthsList[activeMonthsList.length - 1] ?? 1;
      const lastDetails = computeCycleDetails(lastMonthNum);

      return {
        headerCycleLabel: monthNames.join(', '),
        formattedDate: lastDetails.formattedDate,
      };
    }
  }, [group, collectionMode, selectedSingleMonth, activeMonthsList, currentGroupMonth]);

  const [customHeaderCycle, setCustomHeaderCycle] = useState<string>('');
  const [customDateStr, setCustomDateStr] = useState<string>('');

  // Keep custom inputs synchronized when month or mode changes
  useEffect(() => {
    setCustomHeaderCycle(computedMonthDetails.headerCycleLabel);
    setCustomDateStr(computedMonthDetails.formattedDate);
  }, [computedMonthDetails]);

  // Fetch enrolled members and transactions
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);

        const [{ data: memData }, { data: txData }, { data: auctionData }] = await Promise.all([
          supabase
            .from('group_members')
            .select(`
              id,
              ticket_number,
              profile_id,
              alias_name,
              custom_installment,
              profiles:profile_id (
                id,
                full_name,
                phone_number
              )
            `)
            .eq('group_id', group.id)
            .order('ticket_number', { ascending: true }),
          supabase
            .from('transactions')
            .select('*')
            .eq('group_id', group.id)
            .eq('type', 'collection')
            .eq('status', 'completed'),
          supabase
            .from('auction_logs')
            .select('month, is_laaba_seetu')
            .eq('group_id', group.id),
        ]);

        setMembers(memData || []);
        setTransactions(txData || []);
        setAuctions(auctionData || []);
      } catch (err) {
        console.error('Error fetching checklist data:', err);
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [group.id]);

  // Build rows for all tickets 1..totalMembers
  const checklistRows: MemberRow[] = useMemo(() => {
    const rows: MemberRow[] = [];

    for (let t = 1; t <= totalMembers; t++) {
      const memRow = members.find(m => m.ticket_number === t);
      const prof = Array.isArray(memRow?.profiles) ? memRow?.profiles[0] : memRow?.profiles;
      const rawName = memRow?.alias_name || prof?.full_name || (memRow?.profile_id ? `MEMBER #${t}` : `TICKET #${t}`);
      const upperName = rawName.toUpperCase();
      
      const memberBaseDue = memRow?.custom_installment ? Number(memRow.custom_installment) : baseMonthlyInstallment;

      // Sum expected due across all selected months (accounting for Laaba Seetu = ₹0)
      let totalDue = 0;
      activeMonthsList.forEach(mNum => {
        const monthAuction = (auctions || []).find((a: any) => Number(a.month) === mNum);
        const poolVal = Number(group.kaiIruppuPool || group.kai_iruppu_pool || 0);
        const isLaaba = !!monthAuction?.is_laaba_seetu || (mNum === currentGroupMonth && mNum > 0 && poolVal >= Number(group.totalValue || group.total_value || 200000));
        if (!isLaaba) {
          totalDue += memberBaseDue;
        }
      });

      let paidDate = '';
      let paidAmount: number | undefined = undefined;
      let balanceAmount: number | undefined = undefined;
      let isPaid = false;

      if (prefillPayments && memRow) {
        // Match transactions belonging to any of the active months
        const memberTxs = transactions.filter(tx => {
          const isThisMember = tx.group_member_id === memRow.id || (memRow.profile_id && tx.profile_id === memRow.profile_id);
          if (!isThisMember) return false;

          if (tx.cycle_month !== null && tx.cycle_month !== undefined) {
            return activeMonthsList.includes(Number(tx.cycle_month));
          }
          if (!tx.notes) return false;
          return activeMonthsList.some(mNum => new RegExp(`\\bMonth\\s*[:#-]?\\s*${mNum}\\b|\\bM${mNum}\\b`, 'i').test(tx.notes));
        });

        const totalPaid = memberTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        if (totalPaid > 0) {
          const latestTx = memberTxs[0];
          if (latestTx?.created_at) {
            const d = new Date(latestTx.created_at);
            if (!isNaN(d.getTime())) {
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yyyy = d.getFullYear();
              paidDate = `${dd}.${mm}.${yyyy}`;
            }
          }
          paidAmount = totalPaid;
          balanceAmount = Math.max(0, totalDue - totalPaid);
          isPaid = totalPaid >= totalDue;
        } else {
          paidDate = '';
          paidAmount = undefined;
          balanceAmount = undefined;
          isPaid = false;
        }
      }

      rows.push({
        ticket: t,
        profileId: memRow?.profile_id,
        name: upperName,
        phone: prof?.phone_number || '',
        dueAmount: totalDue,
        paidDate,
        paidAmount,
        balanceAmount,
        isPaid,
      });
    }

    return rows;
  }, [members, transactions, activeMonthsList, totalMembers, baseMonthlyInstallment, prefillPayments, auctions, group, currentGroupMonth]);

  const effectiveDuePerMember = useMemo(() => {
    let sum = 0;
    activeMonthsList.forEach(mNum => {
      const monthAuction = (auctions || []).find((a: any) => Number(a.month) === mNum);
      const poolVal = Number(group.kaiIruppuPool || group.kai_iruppu_pool || 0);
      const isLaaba = !!monthAuction?.is_laaba_seetu || (mNum === currentGroupMonth && mNum > 0 && poolVal >= Number(group.totalValue || group.total_value || 200000));
      if (!isLaaba) {
        sum += baseMonthlyInstallment;
      }
    });
    return sum;
  }, [baseMonthlyInstallment, activeMonthsList, auctions, group, currentGroupMonth]);

  // Format currency helper
  const formatINR = (val: number) => {
    return `RS ${val.toLocaleString('en-IN')}/-`;
  };

  // Toggle multi-month selection
  const handleToggleMultiMonth = (mNum: number) => {
    triggerHapticFeedback('light');
    setSelectedMultiMonths(prev => {
      if (prev.includes(mNum)) {
        if (prev.length <= 1) return prev; // Keep at least one month
        return prev.filter(m => m !== mNum);
      } else {
        return [...prev, mNum].sort((a, b) => a - b);
      }
    });
  };

  // Dynamic row height calculation to fill the 275mm single-page A4 sheet with zero dead space
  const dynamicRowHeightPx = useMemo(() => {
    const rowCount = Math.max(1, checklistRows.length);
    // Target table body height of ~750px to eliminate any bottom empty gap
    const calculatedHeight = Math.floor(750 / rowCount);
    return Math.max(26, Math.min(120, calculatedHeight));
  }, [checklistRows.length]);

  // ── FOOLPROOF NATIVE IFRAME PRINT (Zero blank pages, fills entire page) ───────
  const handlePrint = () => {
    triggerHapticFeedback('light');
    const printContent = printableRef.current;
    if (!printContent) return;

    // Create an isolated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Checklist - ${group.name}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              height: 100%;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #000000;
              background: #ffffff;
            }
            .sheet-container {
              width: 100%;
              max-width: 100%;
              height: 275mm;
              min-height: 275mm;
              max-height: 275mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              margin: 0 auto;
              box-sizing: border-box;
            }
            .content-section {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .invocation {
              text-align: center;
              font-size: ${Math.max(9, effectiveFontSize - 2)}px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-bottom: 6px;
              font-family: Georgia, serif;
            }
            .header-block {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #000000;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .header-left {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            .header-right {
              text-align: right;
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            .group-name {
              font-size: ${effectiveFontSize}px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.2px;
            }
            .chit-amount {
              font-size: ${effectiveFontSize + 2}px;
              font-weight: 900;
              letter-spacing: -0.2px;
            }
            .months-dur {
              font-size: ${Math.max(10, effectiveFontSize - 1)}px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .monthly-due {
              font-size: ${effectiveFontSize}px;
              font-weight: 900;
            }
            .cycle-label {
              font-size: ${effectiveFontSize + 1}px;
              font-weight: 900;
              text-transform: uppercase;
              text-decoration: underline;
              text-underline-offset: 3px;
            }
            .date-label {
              font-size: ${effectiveFontSize}px;
              font-weight: 700;
              text-decoration: underline;
              text-underline-offset: 3px;
            }
            .table-container {
              flex: 1;
              display: flex;
              flex-direction: column;
            }
            table {
              width: 100%;
              flex: 1;
              border-collapse: collapse;
              border: 1.5px solid #000000;
              height: 100%;
            }
            th {
              border: 1px solid #000000;
              padding: 4px;
              font-size: ${Math.max(10, Math.min(13, effectiveFontSize))}px;
              font-weight: 900;
              background: #ffffff;
              text-align: center;
              height: 28px;
            }
            th.th-name {
              text-align: left;
              padding-left: 8px;
            }
            tbody {
              height: 100%;
            }
            tbody tr {
              height: ${dynamicRowHeightPx}px;
            }
            td {
              border: 1px solid #000000;
              height: ${dynamicRowHeightPx}px;
              font-size: ${effectiveFontSize}px;
              font-weight: 600;
              padding: 0 4px;
              vertical-align: middle;
            }
            td.td-sl {
              text-align: center;
              font-weight: 700;
              font-size: ${effectiveFontSize}px;
            }
            td.td-name {
              text-align: left;
              padding-left: 8px;
              font-weight: 900;
              font-size: ${effectiveFontSize}px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            td.td-num {
              text-align: center;
              font-weight: 700;
              font-size: ${effectiveFontSize}px;
            }
            td.td-date {
              text-align: center;
              font-family: monospace;
              font-size: ${Math.max(9, effectiveFontSize - 2)}px;
            }
            .footer-block {
              margin-top: 10px;
              padding-top: 8px;
              border-top: 1px solid #666666;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: ${Math.max(9, effectiveFontSize - 2)}px;
              color: #444444;
            }
          </style>
        </head>
        <body>
          <div class="sheet-container">
            <div class="content-section">
              <div>
                ${invocationTitle.trim() ? `<div class="invocation">${invocationTitle}</div>` : ''}
                
                <div class="header-block">
                  <div class="header-left">
                    <div class="group-name">${group.name.toUpperCase()}</div>
                    <div class="chit-amount">CHIT AMOUNT - ${formatINR(group.totalValue || group.total_value || 0)}</div>
                    <div class="months-dur">MONTHS - ${group.duration || group.duration_months} MONTHS</div>
                    <div class="monthly-due">MONTHLY DUE - ${effectiveDuePerMember}${activeMonthsList.length > 1 ? ` (${activeMonthsList.length} MONTHS)` : ''}</div>
                  </div>
                  <div class="header-right">
                    <div class="cycle-label">${customHeaderCycle || computedMonthDetails.headerCycleLabel}</div>
                    <div class="date-label">${customDateStr || computedMonthDetails.formattedDate}</div>
                  </div>
                </div>
              </div>

              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 6%;">SL.NO.</th>
                      <th class="th-name" style="width: 30%;">NAME</th>
                      <th style="width: 16%;">AMOUNT</th>
                      <th style="width: 16%;">DATE</th>
                      <th style="width: 16%;">PAID</th>
                      <th style="width: 16%;">BALANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${checklistRows.map(row => `
                      <tr>
                        <td class="td-sl">${row.ticket}</td>
                        <td class="td-name">${row.name}</td>
                        <td class="td-num">${row.dueAmount}</td>
                        <td class="td-date">${row.paidDate || ''}</td>
                        <td class="td-num">${row.paidAmount !== undefined ? row.paidAmount : ''}</td>
                        <td class="td-num">${row.balanceAmount !== undefined ? (row.balanceAmount === 0 ? '-' : row.balanceAmount) : ''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <div class="footer-block">
                <div>Cycle: <strong>${activeMonthsList.length === 1 ? `Month ${activeMonthsList[0]}` : `Months ${activeMonthsList.join(', ')}`}</strong></div>
                <div>Organizer Signature: _________________________</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  };

  // Handle high-res PDF Download using jsPDF + html-to-image
  const handleDownloadPdf = async () => {
    if (!printableRef.current) return;
    try {
      setIsGeneratingPdf(true);
      triggerHapticFeedback('light');

      const dataUrl = await toPng(printableRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const printWidth = pageWidth - (margin * 2);
      const printHeight = pageHeight - (margin * 2);

      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => { img.onload = resolve; });

      const imgHeight = (img.height * printWidth) / img.width;

      pdf.addImage(img, 'PNG', margin, margin, printWidth, Math.min(printHeight, imgHeight));
      
      const cleanGroupName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const monthSuffix = activeMonthsList.length === 1 ? `Month_${activeMonthsList[0]}` : `Months_${activeMonthsList.join('_')}`;
      pdf.save(`Payment_Checklist_${cleanGroupName}_${monthSuffix}.pdf`);
      triggerHapticFeedback('success');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate PDF. You can also use the Print Checklist button.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      
      {/* ── MODAL CONTAINER (Light Theme, Responsive Full-screen on mobile, rounded card on desktop) ── */}
      <div className="bg-white sm:rounded-3xl w-full max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[96dvh] flex flex-col shadow-2xl overflow-hidden my-auto border-0 sm:border border-slate-200 text-slate-900">
        
        {/* 1. Modal Control Header */}
        <div className="p-3.5 sm:p-5 bg-white border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl shadow-2xs">
                <FileText size={17} />
              </span>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Payment Checklist
                  </h3>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                    A4 Single-Page
                  </span>
                  {activeMonthsList.length > 1 && (
                    <span className="text-[10px] font-extrabold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                      {activeMonthsList.length}M Combined
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1">
                  Physical monthly ledger for <strong className="text-slate-800">{group.name}</strong>
                </p>
              </div>
            </div>

            {/* Mobile close button on top right */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none justify-center bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer border border-slate-200"
            >
              <Printer size={14} className="text-slate-600" />
              <span>Print Checklist</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="flex-1 sm:flex-none justify-center bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs shadow-indigo-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPdf ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="hidden sm:inline-flex text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Interactive Options & Configuration Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-3.5 sm:px-6 py-3 shrink-0 space-y-2.5 max-h-[38vh] sm:max-h-none overflow-y-auto">
          
          {/* Mode Selector Row (Single vs Multi Month) */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-white border border-slate-200 p-2 sm:p-2.5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-[11px] font-bold text-slate-600">Duration:</span>
              <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setCollectionMode('single');
                  }}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                    collectionMode === 'single'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Single Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setCollectionMode('multi');
                  }}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                    collectionMode === 'multi'
                      ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Collect 2+ Months
                </button>
              </div>
            </div>

            {/* Quick Multi-Month Shortcuts */}
            {collectionMode === 'multi' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Quick:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMultiMonths([1, 2]);
                    triggerHapticFeedback('light');
                  }}
                  className="text-[10px] font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md transition-colors shadow-2xs"
                >
                  M1 + M2
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const start = currentGroupMonth || 1;
                    setSelectedMultiMonths([start, Math.min(totalMembers, start + 1)]);
                    triggerHapticFeedback('light');
                  }}
                  className="text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-md transition-colors shadow-2xs"
                >
                  Current + Next (2M)
                </button>
              </div>
            )}
          </div>

          {/* Month Selector Controls */}
          {collectionMode === 'single' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Target Month Cycle
                </label>
                <select
                  value={selectedSingleMonth}
                  onChange={(e) => setSelectedSingleMonth(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none transition-colors"
                >
                  <option value={0}>Month 0 (Launch Month)</option>
                  {Array.from({ length: totalMembers }).map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      Month {idx + 1} {idx === 0 ? '(1st Auction)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Header Month Line
                </label>
                <input
                  type="text"
                  value={customHeaderCycle}
                  onChange={(e) => setCustomHeaderCycle(e.target.value)}
                  placeholder="e.g. OCTOBER"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Scheduled Date
                </label>
                <input
                  type="text"
                  value={customDateStr}
                  onChange={(e) => setCustomDateStr(e.target.value)}
                  placeholder="e.g. 15.11.2026"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Auspicious Title
                </label>
                <input
                  type="text"
                  value={invocationTitle}
                  onChange={(e) => setInvocationTitle(e.target.value)}
                  placeholder="OM NAMA SIVAYA"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>
            </div>
          ) : (
            /* Multi-Month Multi-Select Checkboxes Grid */
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Select Months to Combine ({activeMonthsList.length} Selected):
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-20 sm:max-h-24 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
                  {Array.from({ length: totalMembers }).map((_, idx) => {
                    const mNum = idx + 1;
                    const isSelected = selectedMultiMonths.includes(mNum);
                    return (
                      <button
                        key={mNum}
                        type="button"
                        onClick={() => handleToggleMultiMonth(mNum)}
                        className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 sm:py-1 rounded-lg border transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected && <Check size={10} />}
                        <span>M{mNum}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Header Month Line
                  </label>
                  <input
                    type="text"
                    value={customHeaderCycle}
                    onChange={(e) => setCustomHeaderCycle(e.target.value)}
                    placeholder="e.g. OCTOBER, NOVEMBER"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Scheduled Date
                  </label>
                  <input
                    type="text"
                    value={customDateStr}
                    onChange={(e) => setCustomDateStr(e.target.value)}
                    placeholder="e.g. 15.11.2026"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Auspicious Title
                  </label>
                  <input
                    type="text"
                    value={invocationTitle}
                    onChange={(e) => setInvocationTitle(e.target.value)}
                    placeholder="OM NAMA SIVAYA"
                    className="w-full bg-white border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bottom Toolbar: Pre-fill & Typable Font Size Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-200">
            {/* Prefill Payments Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-700">Pre-fill:</span>
                <span className="text-[10px] text-slate-500 hidden sm:inline">
                  {prefillPayments 
                    ? `With recorded payments` 
                    : 'Blank handwritten sheet'}
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setPrefillPayments(false);
                    triggerHapticFeedback('light');
                  }}
                  className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                    !prefillPayments
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Empty
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrefillPayments(true);
                    triggerHapticFeedback('light');
                  }}
                  className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                    prefillPayments
                      ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pre-fill
                </button>
              </div>
            </div>

            {/* Typable MS Word Style Font Size Control */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Type size={14} className="text-slate-500" />
                <span className="text-[11px] font-bold text-slate-700">Font Size:</span>
              </div>
              <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-1 focus-within:ring-indigo-600 transition-all">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setTableFontSize(prev => Math.max(8, (prev || 14) - 1));
                  }}
                  className="p-1 sm:p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors active:scale-95 cursor-pointer"
                  title="Decrease font size"
                >
                  <Minus size={13} />
                </button>
                <div className="flex items-center px-0.5">
                  <input
                    type="number"
                    min={8}
                    max={28}
                    value={tableFontSize === 0 ? '' : tableFontSize}
                    onChange={(e) => handleFontSizeChange(e.target.value)}
                    onBlur={handleFontSizeBlur}
                    className="w-8 sm:w-10 text-center font-bold text-xs text-slate-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    title="Type font size (8 - 28 pt)"
                  />
                  <span className="text-[10px] font-semibold text-slate-400 pr-1 select-none">pt</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setTableFontSize(prev => Math.min(28, (prev || 14) + 1));
                  }}
                  className="p-1 sm:p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors active:scale-95 cursor-pointer"
                  title="Increase font size"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Printable Document Preview Canvas (Isomorphic to A4 Sheet) */}
        <div className="p-2 sm:p-6 overflow-y-auto overflow-x-auto flex-1 flex justify-center bg-slate-100/90">
          
          {/* Exact A4 Sheet Simulation with full page height dynamic distribution */}
          <div 
            ref={printableRef}
            id="printable-payment-checklist"
            className="w-full max-w-[760px] min-w-[320px] bg-white text-black p-4 sm:p-7 shadow-xl border border-slate-300 font-sans leading-tight my-auto flex flex-col justify-between"
            style={{
              minHeight: '275mm',
              height: '275mm',
              boxSizing: 'border-box',
            }}
          >
            <div className="flex-1 flex flex-col justify-between">
              <div>
                {/* ── TOP INVOCATION LINE (CENTERED & SMALL) ── */}
                {invocationTitle.trim() && (
                  <div 
                    className="text-center font-bold tracking-widest uppercase mb-2.5 text-black font-serif"
                    style={{ fontSize: `${Math.max(9, effectiveFontSize - 2)}px` }}
                  >
                    {invocationTitle}
                  </div>
                )}

                {/* ── HEADER SUMMARY SECTION ── */}
                <div className="flex justify-between items-start mb-3 sm:mb-4 text-black border-b-2 border-black pb-2 sm:pb-3">
                  {/* Left Column */}
                  <div className="space-y-0.5 sm:space-y-1">
                    <div 
                      className="font-black uppercase tracking-wider text-black"
                      style={{ fontSize: `${effectiveFontSize}px` }}
                    >
                      <span className="font-black">{group.name.toUpperCase()}</span>
                    </div>
                    <div 
                      className="font-black tracking-tight"
                      style={{ fontSize: `${effectiveFontSize + 2}px` }}
                    >
                      CHIT AMOUNT - <span>{formatINR(group.totalValue || group.total_value || 0)}</span>
                    </div>
                    <div 
                      className="font-bold uppercase tracking-wider text-black"
                      style={{ fontSize: `${Math.max(10, effectiveFontSize - 1)}px` }}
                    >
                      MONTHS - {group.duration || group.duration_months} MONTHS
                    </div>
                    <div 
                      className="font-black tracking-wide"
                      style={{ fontSize: `${effectiveFontSize}px` }}
                    >
                      MONTHLY DUE - <span>{effectiveDuePerMember}</span>
                      {activeMonthsList.length > 1 && (
                        <span 
                          className="font-bold ml-1 text-gray-700"
                          style={{ fontSize: `${Math.max(9, effectiveFontSize - 2)}px` }}
                        >
                          ({activeMonthsList.length} MONTHS)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="text-right space-y-0.5 sm:space-y-1">
                    <div 
                      className="font-black uppercase tracking-wider underline underline-offset-4 decoration-black"
                      style={{ fontSize: `${effectiveFontSize + 1}px` }}
                    >
                      {customHeaderCycle || computedMonthDetails.headerCycleLabel}
                    </div>
                    <div 
                      className="font-bold tracking-wider underline underline-offset-4 decoration-black"
                      style={{ fontSize: `${effectiveFontSize}px` }}
                    >
                      {customDateStr || computedMonthDetails.formattedDate}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── MAIN CHECKLIST TABLE (Expands dynamically to fill page height) ── */}
              <div className="w-full flex-1 flex flex-col overflow-x-auto my-1">
                <table 
                  className="w-full flex-1 border-collapse border border-black text-black"
                  style={{ fontSize: `${effectiveFontSize}px` }}
                >
                  <thead>
                    <tr className="border-b-2 border-black bg-white font-black h-8">
                      <th 
                        className="border border-black px-1.5 sm:px-2 py-1 text-center w-[6%]"
                        style={{ fontSize: `${Math.max(10, Math.min(13, effectiveFontSize))}px` }}
                      >
                        SL.NO.
                      </th>
                      <th 
                        className="border border-black px-2 sm:px-3 py-1 text-left w-[30%]"
                        style={{ fontSize: `${Math.max(10, Math.min(13, effectiveFontSize))}px` }}
                      >
                        NAME
                      </th>
                      <th 
                        className="border border-black px-1.5 sm:px-2 py-1 text-center w-[16%]"
                        style={{ fontSize: `${Math.max(10, Math.min(13, effectiveFontSize))}px` }}
                      >
                        AMOUNT
                      </th>
                      <th 
                        className="border border-black px-1.5 sm:px-2 py-1 text-center w-[16%]"
                        style={{ fontSize: `${Math.max(10, Math.min(13, effectiveFontSize))}px` }}
                      >
                        DATE
                      </th>
                      <th 
                        className="border border-black px-1.5 sm:px-2 py-1 text-center w-[16%]"
                        style={{ fontSize: `${Math.max(10, Math.min(13, effectiveFontSize))}px` }}
                      >
                        PAID
                      </th>
                      <th 
                        className="border border-black px-1.5 sm:px-2 py-1 text-center w-[16%]"
                        style={{ fontSize: `${Math.max(10, Math.min(13, effectiveFontSize))}px` }}
                      >
                        BALANCE
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklistRows.map((row) => (
                      <tr 
                        key={row.ticket} 
                        style={{ height: `${dynamicRowHeightPx}px` }}
                        className="border-b border-black font-semibold"
                      >
                        <td 
                          className="border border-black px-1.5 text-center font-bold text-black align-middle"
                          style={{ fontSize: `${effectiveFontSize}px` }}
                        >
                          {row.ticket}
                        </td>
                        <td 
                          className="border border-black px-2 sm:px-3 text-left font-black text-black truncate align-middle max-w-[140px] sm:max-w-none"
                          style={{ fontSize: `${effectiveFontSize}px` }}
                        >
                          {row.name}
                        </td>
                        <td 
                          className="border border-black px-1.5 text-center font-bold text-black align-middle"
                          style={{ fontSize: `${effectiveFontSize}px` }}
                        >
                          {row.dueAmount}
                        </td>
                        <td 
                          className="border border-black px-1 text-center font-mono align-middle"
                          style={{ fontSize: `${Math.max(9, effectiveFontSize - 2)}px` }}
                        >
                          {row.paidDate || ''}
                        </td>
                        <td 
                          className="border border-black px-1.5 text-center font-bold text-black align-middle"
                          style={{ fontSize: `${effectiveFontSize}px` }}
                        >
                          {row.paidAmount !== undefined ? row.paidAmount : ''}
                        </td>
                        <td 
                          className="border border-black px-1.5 text-center font-bold text-black align-middle"
                          style={{ fontSize: `${effectiveFontSize}px` }}
                        >
                          {row.balanceAmount !== undefined ? (row.balanceAmount === 0 ? '-' : row.balanceAmount) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── FOOTER SIGN-OFF PINNED AT BOTTOM OF A4 ── */}
              <div 
                className="mt-3 pt-2.5 flex justify-between items-center text-gray-700 border-t border-gray-400"
                style={{ fontSize: `${Math.max(9, effectiveFontSize - 2)}px` }}
              >
                <div className="font-semibold">
                  Cycle: <strong>{activeMonthsList.length === 1 ? `Month ${activeMonthsList[0]}` : `Months ${activeMonthsList.join(', ')}`}</strong>
                </div>
                <div className="font-bold">
                  Organizer Signature: _________________________
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
