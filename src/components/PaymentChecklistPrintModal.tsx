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
  Minus
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export interface PaymentChecklistGroup {
  id: string;
  name: string;
  totalValue: number;
  duration: number;
  memberCount?: number;
  currentMonth?: number;
  startDate?: string;
  auctionDayOfMonth?: number;
  auctionTime?: string;
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
  const currentGroupMonth = (group.currentMonth !== undefined && group.currentMonth !== null) ? group.currentMonth : 1;
  const totalMembers = group.duration || group.memberCount || 20;
  const baseMonthlyInstallment = Math.round(group.totalValue / (totalMembers || 1));

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

  // Raw fetched database records
  const [members, setMembers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Active selected months list
  const activeMonthsList = useMemo(() => {
    if (collectionMode === 'single') {
      return [selectedSingleMonth];
    }
    return selectedMultiMonths.length > 0 ? [...selectedMultiMonths].sort((a, b) => a - b) : [selectedSingleMonth];
  }, [collectionMode, selectedSingleMonth, selectedMultiMonths]);

  // Compute month label and default date for the selected cycles
  const computedMonthDetails = useMemo(() => {
    let baseDate = new Date();
    if (group.startDate) {
      const parsed = new Date(group.startDate);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }

    if (collectionMode === 'single') {
      // Target date for this specific month
      const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (selectedSingleMonth || 0), group.auctionDayOfMonth || 10);
      const monthName = targetDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const yyyy = targetDate.getFullYear();

      const formattedDate = `${dd}.${mm}.${yyyy}`;
      const headerCycleLabel = selectedSingleMonth === 0 
        ? `${monthName} (LAUNCH MONTH)` 
        : monthName;

      return {
        headerCycleLabel,
        formattedDate,
      };
    } else {
      // Multi-Month Mode: Generate comma separated names (e.g. "OCTOBER, NOVEMBER")
      const monthNames = activeMonthsList.map(mNum => {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + mNum, 1);
        return d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      });

      // Latest scheduled date among the selected months
      const lastMonthNum = activeMonthsList[activeMonthsList.length - 1] ?? 1;
      const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + lastMonthNum, group.auctionDayOfMonth || 10);
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const yyyy = targetDate.getFullYear();

      const formattedDate = `${dd}.${mm}.${yyyy}`;
      const headerCycleLabel = monthNames.join(', ');

      return {
        headerCycleLabel,
        formattedDate,
      };
    }
  }, [group, collectionMode, selectedSingleMonth, activeMonthsList]);

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

        const { data: memData } = await supabase
          .from('group_members')
          .select(`
            id,
            ticket_number,
            profile_id,
            custom_installment,
            profiles:profile_id (
              id,
              full_name,
              phone_number
            )
          `)
          .eq('group_id', group.id)
          .order('ticket_number', { ascending: true });

        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('group_id', group.id)
          .eq('type', 'collection');

        setMembers(memData || []);
        setTransactions(txData || []);
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
    const monthCount = activeMonthsList.length;

    for (let t = 1; t <= totalMembers; t++) {
      const memRow = members.find(m => m.ticket_number === t);
      const prof = Array.isArray(memRow?.profiles) ? memRow?.profiles[0] : memRow?.profiles;
      const rawName = prof?.full_name || (memRow?.profile_id ? `MEMBER #${t}` : `TICKET #${t}`);
      const upperName = rawName.toUpperCase();
      
      const singleDue = memRow?.custom_installment ? Number(memRow.custom_installment) : baseMonthlyInstallment;
      const totalDue = singleDue * monthCount;

      let paidDate = '';
      let paidAmount: number | undefined = undefined;
      let balanceAmount: number | undefined = undefined;
      let isPaid = false;

      if (prefillPayments && memRow) {
        // Match transactions belonging to any of the active months
        const memberTxs = transactions.filter(tx => {
          const isThisMember = tx.group_member_id === memRow.id || (memRow.profile_id && tx.profile_id === memRow.profile_id);
          if (!isThisMember) return false;

          if (!tx.notes) return true;
          return activeMonthsList.some(mNum => new RegExp(`\\bMonth\\s+${mNum}\\b`, 'i').test(tx.notes));
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
          // If no payment made for this cycle, leave DATE, PAID, and BALANCE empty for manual paper handwriting
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
  }, [members, transactions, activeMonthsList, totalMembers, baseMonthlyInstallment, prefillPayments]);

  const effectiveDuePerMember = useMemo(() => {
    return baseMonthlyInstallment * activeMonthsList.length;
  }, [baseMonthlyInstallment, activeMonthsList]);

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

  // ── FOOLPROOF NATIVE IFRAME PRINT (Zero blank pages) ────────────────────────
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
            }
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #000000;
              background: #ffffff;
            }
            .sheet-container {
              width: 100%;
              max-width: 100%;
              min-height: 275mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              margin: 0 auto;
              box-sizing: border-box;
            }
            .content-section {
              flex: 1;
            }
            .invocation {
              text-align: center;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-bottom: 8px;
              font-family: Georgia, serif;
            }
            .header-block {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #000000;
              padding-bottom: 8px;
              margin-bottom: 14px;
            }
            .header-left {
              display: flex;
              flex-direction: column;
              gap: 3px;
            }
            .header-right {
              text-align: right;
              display: flex;
              flex-direction: column;
              gap: 3px;
            }
            .group-name {
              font-size: 13px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.2px;
            }
            .chit-amount {
              font-size: 15px;
              font-weight: 900;
              letter-spacing: -0.2px;
            }
            .months-dur {
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .monthly-due {
              font-size: 13px;
              font-weight: 900;
            }
            .cycle-label {
              font-size: 13px;
              font-weight: 900;
              text-transform: uppercase;
              text-decoration: underline;
              text-underline-offset: 3px;
            }
            .date-label {
              font-size: 12px;
              font-weight: 700;
              text-decoration: underline;
              text-underline-offset: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              border: 1.5px solid #000000;
            }
            th {
              border: 1px solid #000000;
              padding: 6px 4px;
              font-size: 11px;
              font-weight: 900;
              background: #ffffff;
              text-align: center;
            }
            th.th-name {
              text-align: left;
              padding-left: 8px;
            }
            td {
              border: 1px solid #000000;
              font-size: ${totalMembers <= 5 ? '13px' : totalMembers <= 10 ? '12px' : totalMembers <= 15 ? '11px' : '10.5px'};
              font-weight: 600;
              padding: ${totalMembers <= 5 ? '18px 6px' : totalMembers <= 10 ? '12px 5px' : totalMembers <= 15 ? '8px 4px' : totalMembers <= 20 ? '5px 4px' : '3.5px 3px'};
              vertical-align: middle;
            }
            td.td-sl {
              text-align: center;
              font-weight: 700;
            }
            td.td-name {
              text-align: left;
              padding-left: 8px;
              font-weight: 900;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            td.td-num {
              text-align: center;
              font-weight: 700;
            }
            td.td-date {
              text-align: center;
              font-family: monospace;
              font-size: 10px;
            }
            .footer-block {
              margin-top: 24px;
              padding-top: 10px;
              border-top: 1px solid #666666;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 10px;
              color: #444444;
            }
          </style>
        </head>
        <body>
          <div class="sheet-container">
            <div class="content-section">
              ${invocationTitle.trim() ? `<div class="invocation">${invocationTitle}</div>` : ''}
              
              <div class="header-block">
                <div class="header-left">
                  <div class="group-name">GROUP - ${group.name.toUpperCase()}</div>
                  <div class="chit-amount">CHIT AMOUNT - ${formatINR(group.totalValue)}</div>
                  <div class="months-dur">MONTHS - ${group.duration} MONTHS</div>
                  <div class="monthly-due">MONTHLY DUE - ${effectiveDuePerMember}${activeMonthsList.length > 1 ? ` (${activeMonthsList.length} MONTHS)` : ''}</div>
                </div>
                <div class="header-right">
                  <div class="cycle-label">${customHeaderCycle || computedMonthDetails.headerCycleLabel}</div>
                  <div class="date-label">${customDateStr || computedMonthDetails.formattedDate}</div>
                </div>
              </div>

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

  // Dynamic row height padding for the screen preview
  const dynamicRowPadding = useMemo(() => {
    if (totalMembers <= 5) return 'py-4 sm:py-5 text-xs sm:text-sm';
    if (totalMembers <= 10) return 'py-3 sm:py-3.5 text-xs sm:text-sm';
    if (totalMembers <= 15) return 'py-2 sm:py-2.5 text-[11px] sm:text-xs';
    if (totalMembers <= 20) return 'py-1.5 sm:py-2 text-[10px] sm:text-xs';
    if (totalMembers <= 25) return 'py-1 sm:py-1.5 text-[10px] sm:text-xs';
    return 'py-0.5 sm:py-1 text-[9px] sm:text-[10px]';
  }, [totalMembers]);

  return (
    <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      
      {/* ── MODAL CONTAINER (Full-screen on mobile, rounded card on desktop) ── */}
      <div className="bg-[#1D1D41] sm:rounded-3xl w-full max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[96dvh] flex flex-col shadow-2xl overflow-hidden my-auto border-0 sm:border border-[#27264E] text-white">
        
        {/* 1. Modal Control Header */}
        <div className="p-3.5 sm:p-5 bg-[#1D1D41] border-b border-[#27264E] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 bg-[#6359E9]/10 text-[#6359E9] border border-[#6359E9]/20 rounded-xl">
                <FileText size={16} />
              </span>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                    Payment Checklist
                  </h3>
                  <span className="text-[10px] font-bold bg-[#6359E9]/15 text-[#64CFF6] px-1.5 py-0.5 rounded-full border border-[#6359E9]/30">
                    A4 Single-Page
                  </span>
                  {activeMonthsList.length > 1 && (
                    <span className="text-[10px] font-extrabold bg-[#9C2CF3]/15 text-[#9C2CF3] px-1.5 py-0.5 rounded-full border border-[#9C2CF3]/30">
                      {activeMonthsList.length}M Combined
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#AEABD8] line-clamp-1">
                  Physical monthly ledger for <strong className="text-white">{group.name}</strong>
                </p>
              </div>
            </div>

            {/* Mobile close button on top right */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden text-[#AEABD8] hover:text-white p-1.5 rounded-xl hover:bg-[#27264E] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none justify-center bg-[#27264E] hover:bg-[#27264E]/80 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer border border-[#27264E]"
            >
              <Printer size={14} />
              <span>Print Checklist</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="flex-1 sm:flex-none justify-center bg-[#6359E9] hover:bg-[#6F64FF] text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-[#6359E9]/30 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPdf ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="hidden sm:inline-flex text-[#AEABD8] hover:text-white p-2 rounded-xl hover:bg-[#27264E] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Interactive Options & Configuration Bar */}
        <div className="bg-[#141332] border-b border-[#27264E] px-3.5 sm:px-6 py-3 shrink-0 space-y-2.5 max-h-[38vh] sm:max-h-none overflow-y-auto">
          
          {/* Mode Selector Row (Single vs Multi Month) */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-[#1D1D41] border border-[#27264E] p-2 rounded-2xl">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-[11px] font-bold text-[#AEABD8]">Duration:</span>
              <div className="flex items-center gap-1 bg-[#141332] border border-[#27264E] rounded-xl p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setCollectionMode('single');
                  }}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                    collectionMode === 'single'
                      ? 'bg-[#6359E9] text-white shadow-2xs'
                      : 'text-[#AEABD8] hover:text-white'
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
                      ? 'bg-gradient-to-r from-[#9C2CF3] to-[#3A6FF9] text-white shadow-2xs'
                      : 'text-[#AEABD8] hover:text-white'
                  }`}
                >
                  Collect 2+ Months
                </button>
              </div>
            </div>

            {/* Quick Multi-Month Shortcuts */}
            {collectionMode === 'multi' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-[#AEABD8]/70 uppercase">Quick:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMultiMonths([1, 2]);
                    triggerHapticFeedback('light');
                  }}
                  className="text-[10px] font-bold bg-[#141332] hover:bg-[#27264E] border border-[#27264E] text-white px-2 py-0.5 rounded-md transition-colors"
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
                  className="text-[10px] font-bold bg-[#6359E9]/20 hover:bg-[#6359E9]/30 border border-[#6359E9]/40 text-[#64CFF6] px-2 py-0.5 rounded-md transition-colors"
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
                <label className="text-[9px] sm:text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider block">
                  Target Month Cycle
                </label>
                <select
                  value={selectedSingleMonth}
                  onChange={(e) => setSelectedSingleMonth(Number(e.target.value))}
                  className="w-full bg-[#1D1D41] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
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
                <label className="text-[9px] sm:text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider block">
                  Header Month Line
                </label>
                <input
                  type="text"
                  value={customHeaderCycle}
                  onChange={(e) => setCustomHeaderCycle(e.target.value)}
                  placeholder="e.g. OCTOBER"
                  className="w-full bg-[#1D1D41] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white placeholder-[#AEABD8]/40 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider block">
                  Scheduled Date
                </label>
                <input
                  type="text"
                  value={customDateStr}
                  onChange={(e) => setCustomDateStr(e.target.value)}
                  placeholder="e.g. 13.09.2026"
                  className="w-full bg-[#1D1D41] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white placeholder-[#AEABD8]/40 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider block">
                  Auspicious Title
                </label>
                <input
                  type="text"
                  value={invocationTitle}
                  onChange={(e) => setInvocationTitle(e.target.value)}
                  placeholder="OM NAMA SIVAYA"
                  className="w-full bg-[#1D1D41] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white placeholder-[#AEABD8]/40 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            /* Multi-Month Multi-Select Checkboxes Grid */
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider block">
                  Select Months to Combine ({activeMonthsList.length} Selected):
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-20 sm:max-h-24 overflow-y-auto p-1.5 bg-[#1D1D41] rounded-xl border border-[#27264E]">
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
                            ? 'bg-[#6359E9] text-white border-[#6359E9] shadow-2xs'
                            : 'bg-[#141332] text-[#AEABD8] border-[#27264E] hover:text-white'
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
                  <label className="text-[9px] sm:text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider block">
                    Header Month Line
                  </label>
                  <input
                    type="text"
                    value={customHeaderCycle}
                    onChange={(e) => setCustomHeaderCycle(e.target.value)}
                    placeholder="e.g. OCTOBER, NOVEMBER"
                    className="w-full bg-[#1D1D41] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white placeholder-[#AEABD8]/40 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider block">
                    Scheduled Date
                  </label>
                  <input
                    type="text"
                    value={customDateStr}
                    onChange={(e) => setCustomDateStr(e.target.value)}
                    placeholder="e.g. 10.11.2026"
                    className="w-full bg-[#1D1D41] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white placeholder-[#AEABD8]/40 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider block">
                    Auspicious Title
                  </label>
                  <input
                    type="text"
                    value={invocationTitle}
                    onChange={(e) => setInvocationTitle(e.target.value)}
                    placeholder="OM NAMA SIVAYA"
                    className="w-full bg-[#1D1D41] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-2.5 py-1.5 text-xs font-bold text-white placeholder-[#AEABD8]/40 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Prefill Payments Toggle */}
          <div className="flex items-center justify-between pt-1.5 border-t border-[#27264E]">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#AEABD8]">Pre-fill:</span>
              <span className="text-[10px] text-[#AEABD8]/70">
                {prefillPayments 
                  ? `With recorded payments` 
                  : 'Blank handwritten sheet'}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#1D1D41] p-0.5 rounded-xl border border-[#27264E]">
              <button
                type="button"
                onClick={() => setPrefillPayments(false)}
                className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  !prefillPayments
                    ? 'bg-[#141332] text-white shadow-2xs border border-[#27264E]'
                    : 'text-[#AEABD8] hover:text-white'
                }`}
              >
                Empty
              </button>
              <button
                type="button"
                onClick={() => setPrefillPayments(true)}
                className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                  prefillPayments
                    ? 'bg-[#6359E9] text-white shadow-2xs'
                    : 'text-[#AEABD8] hover:text-white'
                }`}
              >
                Pre-fill
              </button>
            </div>
          </div>
        </div>

        {/* 3. Printable Document Preview Canvas (Isomorphic to A4 Sheet) */}
        <div className="p-2 sm:p-6 overflow-y-auto overflow-x-auto flex-1 flex justify-center bg-[#141332]">
          
          {/* Exact A4 Sheet Simulation with full page height distribution */}
          <div 
            ref={printableRef}
            id="printable-payment-checklist"
            className="w-full max-w-[760px] min-w-[320px] bg-white text-black p-4 sm:p-8 shadow-lg border border-gray-300 font-sans leading-tight my-auto flex flex-col justify-between"
            style={{
              minHeight: '275mm',
              boxSizing: 'border-box',
            }}
          >
            <div>
              {/* ── TOP INVOCATION LINE (CENTERED & SMALL) ── */}
              {invocationTitle.trim() && (
                <div className="text-center font-bold tracking-widest text-[10px] sm:text-xs uppercase mb-3 text-black font-serif">
                  {invocationTitle}
                </div>
              )}

              {/* ── HEADER SUMMARY SECTION ── */}
              <div className="flex justify-between items-start mb-4 sm:mb-6 text-black border-b-2 border-black pb-2.5 sm:pb-3">
                {/* Left Column */}
                <div className="space-y-1">
                  <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-black">
                    GROUP - <span className="font-black">{group.name.toUpperCase()}</span>
                  </div>
                  <div className="text-xs sm:text-base font-black tracking-tight">
                    CHIT AMOUNT - <span className="text-sm sm:text-lg">{formatINR(group.totalValue)}</span>
                  </div>
                  <div className="text-[11px] sm:text-sm font-bold uppercase tracking-wider text-black">
                    MONTHS - {group.duration} MONTHS
                  </div>
                  <div className="text-[11px] sm:text-sm font-black tracking-wide">
                    MONTHLY DUE - <span className="text-xs sm:text-base">{effectiveDuePerMember}</span>
                    {activeMonthsList.length > 1 && (
                      <span className="text-[10px] sm:text-xs font-bold ml-1 text-gray-700">({activeMonthsList.length} MONTHS)</span>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="text-right space-y-1">
                  <div className="text-[11px] sm:text-sm font-black uppercase tracking-wider underline underline-offset-4 decoration-black">
                    {customHeaderCycle || computedMonthDetails.headerCycleLabel}
                  </div>
                  <div className="text-[10px] sm:text-sm font-bold tracking-wider underline underline-offset-4 decoration-black">
                    {customDateStr || computedMonthDetails.formattedDate}
                  </div>
                </div>
              </div>

              {/* ── MAIN CHECKLIST TABLE ── */}
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse border border-black text-black text-[10px] sm:text-xs">
                  <thead>
                    <tr className="border-b-2 border-black bg-white font-black">
                      <th className="border border-black px-1.5 sm:px-2 py-1.5 sm:py-2 text-center w-[6%]">
                        SL.NO.
                      </th>
                      <th className="border border-black px-2 sm:px-3 py-1.5 sm:py-2 text-left w-[30%]">
                        NAME
                      </th>
                      <th className="border border-black px-1.5 sm:px-2 py-1.5 sm:py-2 text-center w-[16%]">
                        AMOUNT
                      </th>
                      <th className="border border-black px-1.5 sm:px-2 py-1.5 sm:py-2 text-center w-[16%]">
                        DATE
                      </th>
                      <th className="border border-black px-1.5 sm:px-2 py-1.5 sm:py-2 text-center w-[16%]">
                        PAID
                      </th>
                      <th className="border border-black px-1.5 sm:px-2 py-1.5 sm:py-2 text-center w-[16%]">
                        BALANCE
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {checklistRows.map((row) => (
                      <tr 
                        key={row.ticket} 
                        className={`border-b border-black font-semibold ${dynamicRowPadding}`}
                      >
                        <td className="border border-black px-1.5 text-center font-bold text-black align-middle">
                          {row.ticket}
                        </td>
                        <td className="border border-black px-2 sm:px-3 text-left font-black text-black truncate align-middle max-w-[140px] sm:max-w-none">
                          {row.name}
                        </td>
                        <td className="border border-black px-1.5 text-center font-bold text-black align-middle">
                          {row.dueAmount}
                        </td>
                        <td className="border border-black px-1 text-center font-mono text-[9px] sm:text-[11px] align-middle">
                          {row.paidDate || ''}
                        </td>
                        <td className="border border-black px-1.5 text-center font-bold text-black align-middle">
                          {row.paidAmount !== undefined ? row.paidAmount : ''}
                        </td>
                        <td className="border border-black px-1.5 text-center font-bold text-black align-middle">
                          {row.balanceAmount !== undefined ? (row.balanceAmount === 0 ? '-' : row.balanceAmount) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── FOOTER SIGN-OFF PINNED AT BOTTOM OF A4 ── */}
            <div className="mt-8 pt-4 flex justify-between items-center text-[10px] sm:text-xs text-gray-700 border-t border-gray-400">
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
  );
}


