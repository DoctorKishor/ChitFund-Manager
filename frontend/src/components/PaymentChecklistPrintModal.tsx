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
  Settings2
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
  const [selectedMonth, setSelectedMonth] = useState<number>(currentGroupMonth);
  const [prefillPayments, setPrefillPayments] = useState<boolean>(false);
  const [invocationTitle, setInvocationTitle] = useState<string>('OM NAMA SIVAYA');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Raw fetched data
  const [members, setMembers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  const totalMembers = group.duration || group.memberCount || 20;
  const baseInstallment = Math.round(group.totalValue / (totalMembers || 1));

  // Compute month label and default auction date for the selected cycle
  const computedMonthDetails = useMemo(() => {
    let baseDate = new Date();
    if (group.startDate) {
      const parsed = new Date(group.startDate);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }

    // Target date for selected month cycle
    const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (selectedMonth || 0), group.auctionDayOfMonth || 10);
    
    const monthName = targetDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const yearStr = targetDate.getFullYear().toString();
    
    // Previous month name if applicable
    const prevDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (selectedMonth || 0) - 1, 1);
    const prevMonthName = prevDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();

    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yyyy = targetDate.getFullYear();

    const formattedDate = `${dd}.${mm}.${yyyy}`;
    const headerCycleLabel = selectedMonth === 0 
      ? `${monthName} (LAUNCH MONTH)` 
      : `${prevMonthName}, ${monthName}`;

    return {
      monthName,
      headerCycleLabel,
      formattedDate,
    };
  }, [group, selectedMonth]);

  const [customHeaderCycle, setCustomHeaderCycle] = useState<string>('');
  const [customDateStr, setCustomDateStr] = useState<string>('');

  // Keep custom inputs synchronized when month changes unless user overrides
  useEffect(() => {
    setCustomHeaderCycle(computedMonthDetails.headerCycleLabel);
    setCustomDateStr(computedMonthDetails.formattedDate);
  }, [computedMonthDetails]);

  // Fetch enrolled members and month transactions
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);

        // 1. Fetch group members
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

        // 2. Fetch transactions for this group
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
    const monthRegex = new RegExp(`\\bMonth\\s+${selectedMonth}\\b`, 'i');

    for (let t = 1; t <= totalMembers; t++) {
      const memRow = members.find(m => m.ticket_number === t);
      const prof = Array.isArray(memRow?.profiles) ? memRow?.profiles[0] : memRow?.profiles;
      const rawName = prof?.full_name || (memRow?.profile_id ? `MEMBER #${t}` : `TICKET #${t}`);
      const upperName = rawName.toUpperCase();
      const due = memRow?.custom_installment ? Number(memRow.custom_installment) : baseInstallment;

      // Find matching payment if prefill is active
      let paidDate = '';
      let paidAmount: number | undefined = undefined;
      let balanceAmount: number | undefined = undefined;
      let isPaid = false;

      if (prefillPayments && memRow) {
        const memberTxs = transactions.filter(tx => 
          (tx.group_member_id === memRow.id || (memRow.profile_id && tx.profile_id === memRow.profile_id)) &&
          (tx.notes ? monthRegex.test(tx.notes) : true)
        );

        if (memberTxs.length > 0) {
          const totalPaid = memberTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
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
          balanceAmount = Math.max(0, due - totalPaid);
          isPaid = totalPaid >= due;
        } else {
          balanceAmount = due;
        }
      }

      rows.push({
        ticket: t,
        profileId: memRow?.profile_id,
        name: upperName,
        phone: prof?.phone_number || '',
        dueAmount: due,
        paidDate,
        paidAmount,
        balanceAmount,
        isPaid,
      });
    }

    return rows;
  }, [members, transactions, selectedMonth, totalMembers, baseInstallment, prefillPayments]);

  // Format currency helpers
  const formatINR = (val: number) => {
    return `RS ${val.toLocaleString('en-IN')}/-`;
  };

  // Handle native browser print
  const handlePrint = () => {
    triggerHapticFeedback('light');
    window.print();
  };

  // Handle high-res PDF Download using jsPDF + html-to-image
  const handleDownloadPdf = async () => {
    if (!printableRef.current) return;
    try {
      setIsGeneratingPdf(true);
      triggerHapticFeedback('light');

      const dataUrl = await toPng(printableRef.current, {
        quality: 1,
        pixelRatio: 3, // High DPI for crystal clear print
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const printWidth = pageWidth - (margin * 2);
      const printHeight = pageHeight - (margin * 2);

      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => { img.onload = resolve; });

      const imgHeight = (img.height * printWidth) / img.width;

      pdf.addImage(img, 'PNG', margin, margin, printWidth, Math.min(printHeight, imgHeight));
      
      const cleanGroupName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`Payment_Checklist_${cleanGroupName}_Month_${selectedMonth}.pdf`);
      triggerHapticFeedback('success');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate PDF. You can also use the regular Print button.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Dynamic row height calculation to ensure 100% single page fit regardless of ticket count (5, 10, 20, 24, 25)
  const dynamicRowPadding = useMemo(() => {
    if (totalMembers <= 10) return 'py-3';
    if (totalMembers <= 15) return 'py-2.5';
    if (totalMembers <= 20) return 'py-2';
    if (totalMembers <= 25) return 'py-1.5';
    return 'py-1';
  }, [totalMembers]);

  return (
    <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      
      {/* ── MODAL CONTAINER ── */}
      <div className="bg-gray-100 rounded-3xl w-full max-w-4xl max-h-[96dvh] flex flex-col shadow-2xl overflow-hidden my-auto border border-gray-300 print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none">
        
        {/* 1. Modal Control Header (Hidden in Print) */}
        <div className="p-4 sm:p-5 bg-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-xl">
                <FileText size={16} />
              </span>
              <h3 className="text-base font-bold text-gray-900">
                Payment Checklist Printout
              </h3>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-150">
                A4 Single-Page Format
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Traditional physical monthly ledger checklist for <strong>{group.name}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Checklist</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPdf}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPdf ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Save PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Interactive Options & Configuration Bar (Hidden in Print) */}
        <div className="bg-white/80 border-b border-gray-200 px-4 sm:px-6 py-3.5 print:hidden shrink-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            
            {/* Month Cycle Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Target Month Cycle
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none"
              >
                <option value={0}>Month 0 (Launch Month)</option>
                {Array.from({ length: totalMembers }).map((_, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    Month {idx + 1} {idx === 0 ? '(1st Auction)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Header Cycle Label Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Header Month Line
              </label>
              <input
                type="text"
                value={customHeaderCycle}
                onChange={(e) => setCustomHeaderCycle(e.target.value)}
                placeholder="e.g. SEPTEMBER, OCTOBER"
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none"
              />
            </div>

            {/* Date String Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Scheduled Date (DD.MM.YYYY)
              </label>
              <input
                type="text"
                value={customDateStr}
                onChange={(e) => setCustomDateStr(e.target.value)}
                placeholder="e.g. 13.09.2026"
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none"
              />
            </div>

            {/* Invocation Title Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Top Auspicious Title
              </label>
              <input
                type="text"
                value={invocationTitle}
                onChange={(e) => setInvocationTitle(e.target.value)}
                placeholder="OM NAMA SIVAYA"
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none"
              />
            </div>

          </div>

          {/* Prefill Payments Toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800">Pre-fill Recorded Payments:</span>
              <span className="text-[11px] text-gray-500">
                {prefillPayments 
                  ? 'Fills dates & paid amounts recorded in database' 
                  : 'Empty columns for blank handwritten paper tracking'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-100 p-0.5 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setPrefillPayments(false)}
                className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all ${
                  !prefillPayments
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Empty Sheet
              </button>
              <button
                type="button"
                onClick={() => setPrefillPayments(true)}
                className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all ${
                  prefillPayments
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Pre-fill Data
              </button>
            </div>
          </div>
        </div>

        {/* 3. Printable Document Preview Canvas (Isomorphic to A4 Sheet) */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 flex justify-center bg-gray-200/70 print:p-0 print:bg-white print:overflow-visible">
          
          {/* Exact A4 Sheet Simulation */}
          <div 
            ref={printableRef}
            id="printable-payment-checklist"
            className="w-full max-w-[760px] bg-white text-black p-6 sm:p-10 shadow-lg border border-gray-300 print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full font-sans leading-tight"
            style={{
              minHeight: '297mm',
              boxSizing: 'border-box',
            }}
          >
            {/* ── TOP INVOCATION LINE ── */}
            {invocationTitle.trim() && (
              <div className="text-left font-black tracking-wider text-xs sm:text-sm uppercase mb-4 text-black font-serif">
                {invocationTitle}
              </div>
            )}

            {/* ── HEADER SUMMARY SECTION ── */}
            <div className="flex justify-between items-start mb-6 text-black border-b-2 border-black pb-3">
              {/* Left Column */}
              <div className="space-y-1.5">
                <div className="text-sm sm:text-base font-black tracking-tight">
                  CHIT AMOUNT - <span className="text-base sm:text-lg">{formatINR(group.totalValue)}</span>
                </div>
                <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-black">
                  MONTHS - {group.duration} MONTHS
                </div>
                <div className="text-xs sm:text-sm font-black tracking-wide">
                  MONTHLY DUE - <span className="text-sm sm:text-base">{baseInstallment}</span>
                </div>
              </div>

              {/* Right Column */}
              <div className="text-right space-y-1.5">
                <div className="text-xs sm:text-sm font-black uppercase tracking-wider underline underline-offset-4 decoration-black">
                  {customHeaderCycle || computedMonthDetails.headerCycleLabel}
                </div>
                <div className="text-xs sm:text-sm font-bold tracking-wider underline underline-offset-4 decoration-black">
                  {customDateStr || computedMonthDetails.formattedDate}
                </div>
              </div>
            </div>

            {/* ── MAIN CHECKLIST TABLE ── */}
            <div className="w-full">
              <table className="w-full border-collapse border border-black text-black">
                <thead>
                  <tr className="border-b-2 border-black bg-white text-[11px] sm:text-xs font-black">
                    <th className="border border-black px-2 py-2 text-center w-[10%]">
                      SL.NO.
                    </th>
                    <th className="border border-black px-3 py-2 text-left w-[42%]">
                      NAME
                    </th>
                    <th className="border border-black px-2 py-2 text-center w-[14%]">
                      AMOUNT
                    </th>
                    <th className="border border-black px-2 py-2 text-center w-[12%]">
                      DATE
                    </th>
                    <th className="border border-black px-2 py-2 text-center w-[11%]">
                      PAID
                    </th>
                    <th className="border border-black px-2 py-2 text-center w-[11%]">
                      BALANCE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {checklistRows.map((row) => (
                    <tr 
                      key={row.ticket} 
                      className={`border-b border-black text-[11px] sm:text-xs font-semibold ${dynamicRowPadding}`}
                    >
                      <td className="border border-black px-2 text-center font-bold text-black align-middle">
                        {row.ticket}
                      </td>
                      <td className="border border-black px-3 text-left font-black text-black truncate align-middle">
                        {row.name}
                      </td>
                      <td className="border border-black px-2 text-center font-bold text-black align-middle">
                        {row.dueAmount}
                      </td>
                      <td className="border border-black px-2 text-center font-mono text-[10px] sm:text-[11px] align-middle">
                        {row.paidDate || ''}
                      </td>
                      <td className="border border-black px-2 text-center font-bold text-black align-middle">
                        {row.paidAmount !== undefined ? row.paidAmount : ''}
                      </td>
                      <td className="border border-black px-2 text-center font-bold text-black align-middle">
                        {row.balanceAmount !== undefined ? (row.balanceAmount === 0 ? '-' : row.balanceAmount) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── FOOTER SIGN-OFF ── */}
            <div className="mt-8 pt-4 flex justify-between items-center text-[10px] sm:text-[11px] text-gray-700 border-t border-gray-400">
              <div className="font-semibold">
                Group: <strong>{group.name}</strong> · Cycle Month: <strong>Month {selectedMonth}</strong>
              </div>
              <div className="font-bold">
                Organizer Signature: _________________________
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Global CSS for Clean Native Printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-payment-checklist, #printable-payment-checklist * {
            visibility: visible;
          }
          #printable-payment-checklist {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
        }
      `}</style>
    </div>
  );
}
