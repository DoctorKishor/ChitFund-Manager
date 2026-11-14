'use client';

import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Share2,
  Copy,
  Printer,
  CheckCircle2,
  ShieldCheck,
  FileCheck,
  Check,
  Building2,
  Phone,
  Calendar,
  Wallet,
  Clock,
  Sparkles
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { triggerHapticFeedback } from '../utils/haptics';
import { useOrganization } from '@/context/OrganizationContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { extractReceiptNumber } from '@/utils/receiptNumber';

export interface PaymentAllocationItem {
  month: number;
  amount: number;
  type?: 'current' | 'arrear' | 'advance';
  statusAfter?: 'cleared' | 'partial' | 'overpaid';
  due?: number;
}

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  member: any;
  group: any;
  month: number;
  totalDue?: number;
  organizerCompanyName?: string;
  organizerInitials?: string;
  formatCurrency?: (val: number) => string;
  pastPendingDues?: number;
  pastPendingMonths?: number[];
  allocations?: PaymentAllocationItem[];
  totalCollectedAmount?: number;
}

// Convert numbers to Indian Rupees in words
function numberToWordsINR(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertLessThanOneThousand(num: number): string {
    let current = '';
    if (num >= 100) {
      current += singleDigits[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      current += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    } else if (num >= 10) {
      current += teens[num - 10] + ' ';
      num = 0;
    }
    if (num > 0) {
      current += singleDigits[num] + ' ';
    }
    return current.trim();
  }

  const crore = Math.floor(amount / 10000000);
  amount %= 10000000;
  const lakh = Math.floor(amount / 100000);
  amount %= 100000;
  const thousand = Math.floor(amount / 1000);
  amount %= 1000;
  const remainder = Math.floor(amount);

  let result = '';
  if (crore > 0) result += convertLessThanOneThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanOneThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanOneThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertLessThanOneThousand(remainder);

  return result.trim() + ' Rupees Only';
}

// Helper to parse batch metadata from transaction note if not passed directly via props
function parseBatchMetadata(notes?: string | null): { batchId?: string; totalAmount?: number; allocations?: PaymentAllocationItem[] } | null {
  if (!notes) return null;
  // 1. Full multi-month allocation batch tag: [Batch:RCP-...|Total:10000|Alloc:...]
  const fullMatch = notes.match(/\[Batch:([A-Za-z0-9_-]+)\|Total:([0-9.]+)\|Alloc:([^\]]+)\]/);
  if (fullMatch) {
    try {
      const batchId = fullMatch[1];
      const totalAmount = parseFloat(fullMatch[2]);
      const allocStr = fullMatch[3];
      const allocations: PaymentAllocationItem[] = allocStr.split(';').map(item => {
        const [m, a, t] = item.split(':');
        return {
          month: parseInt(m, 10),
          amount: parseFloat(a),
          type: (t as any) || 'current'
        };
      });
      return { batchId, totalAmount, allocations };
    } catch {
      // Fall through
    }
  }

  // 2. Simple batch tag: [Batch:RCP-...] or [RCP-...]
  const simpleMatch = notes.match(/\[(?:Batch:)?((?:RCP|BATCH)-[A-Za-z0-9_-]+)\]/i);
  if (simpleMatch && simpleMatch[1]) {
    return { batchId: simpleMatch[1].toUpperCase() };
  }

  return null;
}

// Helper to get formatted Calendar Month label for a chit group month
function getReceiptMonthLabel(startDateStr: string | null | undefined, monthNumber: number, txDateStr?: string | null): string {
  try {
    if (startDateStr) {
      let bYear: number;
      let bMonth: number;
      if (startDateStr.includes('-')) {
        const parts = startDateStr.split('-');
        bYear = parseInt(parts[0], 10);
        bMonth = parseInt(parts[1], 10) - 1;
      } else {
        const base = new Date(startDateStr);
        bYear = base.getFullYear();
        bMonth = base.getMonth();
      }
      if (!isNaN(bYear) && !isNaN(bMonth)) {
        const targetDate = new Date(bYear, bMonth + monthNumber, 1);
        const monthName = targetDate.toLocaleString('en-IN', { month: 'long' });
        const year = targetDate.getFullYear();
        return monthNumber === 0 ? `${monthName} ${year} · Month 0 (Launch)` : `${monthName} ${year} · Month ${monthNumber}`;
      }
    }
  } catch (e) {
    // Fallback
  }

  const fallbackDate = txDateStr ? new Date(txDateStr) : new Date();
  const validDate = !isNaN(fallbackDate.getTime()) ? fallbackDate : new Date();
  // If Month 1 is validDate, Month 0 was -1 month, Month 2 is +1 month
  const targetFallback = new Date(validDate.getFullYear(), validDate.getMonth() + (monthNumber <= 0 ? -1 : monthNumber - 1), 1);
  const monthName = targetFallback.toLocaleString('en-IN', { month: 'long' });
  const year = targetFallback.getFullYear();
  return monthNumber === 0 ? `${monthName} ${year} · Month 0 (Launch)` : `${monthName} ${year} · Month ${monthNumber}`;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  member,
  group,
  month,
  totalDue,
  organizerCompanyName,
  organizerInitials,
  formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`,
  pastPendingDues = 0,
  pastPendingMonths = [],
  allocations: propAllocations,
  totalCollectedAmount: propTotalCollectedAmount,
}) => {
  const {
    organizationName: globalOrgName,
    organizationTagline: globalOrgTagline,
    organizationInitials: globalOrgInitials
  } = useOrganization();
  const { notifConfig, upiConfig } = useSystemSettings();
  const activeReceiptFooter = notifConfig?.receiptFooterMessage || 'நன்றி! உங்கள் சேமிப்பு உங்கள் எதிர்காலம்.';

  const previewRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;

  const parsedBatch = parseBatchMetadata(transaction.notes);
  const activeAllocations = (propAllocations && propAllocations.length > 0)
    ? propAllocations
    : (parsedBatch?.allocations && parsedBatch.allocations.length > 0)
      ? parsedBatch.allocations
      : null;

  const isMultiMonth = Boolean(activeAllocations && activeAllocations.length > 1);

  const activeOrgName = organizerCompanyName || globalOrgName;
  const activeOrgTagline = globalOrgTagline || 'TRUSTED CHIT FUNDS MANAGEMENT';
  const activeOrgInitials = organizerInitials || globalOrgInitials;

  const rawPaidAmount = Number(transaction.amount || 0);
  const effectiveTotalPaid = propTotalCollectedAmount || parsedBatch?.totalAmount || (activeAllocations ? activeAllocations.reduce((sum, a) => sum + Number(a.amount || 0), 0) : rawPaidAmount);

  const calculatedDue = totalDue || Number(group?.monthly_installment || 0);
  const remainingBalance = Math.max(0, calculatedDue - rawPaidAmount);
  const isCleared = remainingBalance === 0;
  const totalGroupOutstanding = isMultiMonth ? pastPendingDues : (remainingBalance + pastPendingDues);

  const receiptNo = parsedBatch?.batchId || extractReceiptNumber(transaction);
  const monthLabel = isMultiMonth
    ? `Multi-Month Settlement (${activeAllocations!.map(a => `M${a.month}`).join(' + ')})`
    : getReceiptMonthLabel(group?.start_date, month, transaction.created_at);

  const txDate = transaction.created_at ? new Date(transaction.created_at) : new Date();
  const dateFormatted = txDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeFormatted = txDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const memberName = member?.name || 'Subscriber';
  const ticketNum = member?.ticket ?? '?';
  const memberPhone = member?.phone || '';
  const isCash = !transaction.wallet_type ||
    transaction.wallet_type === 'cash_in_hand' ||
    transaction.wallet_type === 'cash' ||
    String(transaction.wallet_type).toLowerCase().includes('cash');

  const walletDisplay = isCash
    ? 'Cash in Hand'
    : (upiConfig?.enabled && upiConfig?.vpa && transaction.wallet_type === 'kishor_bank')
      ? `Online UPI (${upiConfig.vpa})`
      : 'Online Transfer';
  const groupName = group?.name || 'Chit Group';
  const amountInWords = numberToWordsINR(effectiveTotalPaid);

  const cleanNotes = (transaction.notes || '')
    .replace(/\[Batch:[^\]]+\]/g, '')
    .replace(/—\s*Note:\s*$/i, '')
    .trim();

  const cleanMemberName = memberName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Receipt_${receiptNo}_${cleanMemberName}_${isMultiMonth ? 'Combined' : `Month${month}`}.png`;

  // Base portal URL
  const appPortalUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://chitfund.app';

  // Helper to generate unclipped, full-page pixel-perfect PNG dataUrl
  const getReceiptPngDataUrl = async (): Promise<string> => {
    const targetNode = exportRef.current || previewRef.current;
    if (!targetNode) throw new Error('Receipt render target not found');

    const width = 480;
    const scrollH = targetNode.scrollHeight;
    const offsetH = targetNode.offsetHeight;
    const height = Math.max(scrollH, offsetH, 560);

    return await toPng(targetNode, {
      quality: 1,
      pixelRatio: 3,
      width: width,
      height: height,
      canvasWidth: width * 3,
      canvasHeight: height * 3,
      backgroundColor: '#ffffff',
      cacheBust: true,
      style: {
        width: `${width}px`,
        maxWidth: `${width}px`,
        height: `${height}px`,
        maxHeight: 'none',
        overflow: 'visible',
        transform: 'none',
        margin: '0',
        padding: '0',
      }
    });
  };

  // 1. Download high-res PNG image
  const handleDownloadPng = async () => {
    try {
      setIsGenerating(true);
      triggerHapticFeedback('light');

      const dataUrl = await getReceiptPngDataUrl();

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();

      triggerHapticFeedback('success');
      setShareStatus('Receipt PNG Downloaded!');
      setTimeout(() => setShareStatus(null), 3000);
    } catch (err) {
      console.error('Failed to generate PNG:', err);
      alert('Could not generate receipt image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Copy Image directly to Clipboard (for pasting into WhatsApp Web / Desktop)
  const handleCopyImage = async () => {
    try {
      setIsGenerating(true);
      triggerHapticFeedback('light');

      const dataUrl = await getReceiptPngDataUrl();
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (blob && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        setCopiedToast(true);
        triggerHapticFeedback('success');
        setTimeout(() => setCopiedToast(false), 3500);
      } else {
        handleDownloadPng();
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      handleDownloadPng();
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Native Share (Direct Image file sharing on Mobile / WhatsApp)
  const handleSharePng = async () => {
    try {
      setIsGenerating(true);
      triggerHapticFeedback('light');

      const dataUrl = await getReceiptPngDataUrl();
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (!blob) throw new Error('Failed to create image blob');

      const file = new File([blob], filename, { type: 'image/png' });

      // Check if Web Share API with files is supported
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Receipt ${receiptNo} - ${memberName}`,
          text: `Official Payment Receipt for ${memberName} (Ticket #${ticketNum}) · ${groupName} ${monthLabel} (${formatCurrency(effectiveTotalPaid)})`,
          files: [file]
        });
        triggerHapticFeedback('success');
      } else {
        // Fallback: Download PNG & open WhatsApp with text
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();

        // Also prepare WhatsApp URL
        const digits = memberPhone.replace(/\D/g, '');
        const cleanPhone = digits.length === 10 ? `91${digits}` : digits;

        const settlementSection = isMultiMonth && activeAllocations
          ? `*Settlement Breakdown:*\n` + activeAllocations.map(a => {
            const mName = getReceiptMonthLabel(group?.start_date, a.month, transaction.created_at);
            const tag = a.type === 'arrear' ? 'Past Arrear' : a.type === 'advance' ? 'Advance Pre-paid' : 'Current Month';
            return `  • ${mName} (${tag}): ${formatCurrency(a.amount)}`;
          }).join('\n') + '\n'
          : `*Month ${month === 0 ? '0' : month} Pending Due:* ${isCleared ? 'No Pending (Cleared)' : `${formatCurrency(remainingBalance)} Pending`}\n`;

        const msg = `*CHIT FUNDS PAYMENT RECEIPT*\n` +
          `----------------------------------\n` +
          `*Receipt No:* ${receiptNo}\n` +
          `*Subscriber:* ${memberName} (Ticket #${ticketNum})\n` +
          `*Group:* ${groupName}\n` +
          `*Payment Applied For:* ${monthLabel}\n` +
          `*Amount Received:* ${formatCurrency(effectiveTotalPaid)}\n` +
          `*Payment Mode:* ${walletDisplay}\n` +
          `*Date:* ${dateFormatted}, ${timeFormatted}\n` +
          `----------------------------------\n` +
          settlementSection +
          `*Past Pending Dues (${groupName}):* ${pastPendingDues > 0 ? `${formatCurrency(pastPendingDues)} (Pending in M${pastPendingMonths.join(', M')})` : 'No Past Pending (Cleared)'}\n` +
          `*Total Group Outstanding:* ${totalGroupOutstanding === 0 ? 'No Pending (Fully Cleared)' : `${formatCurrency(totalGroupOutstanding)} Total Pending`}\n\n` +
          `_Official digital receipt attached. Registered on Supabase Ledger._`;

        const waUrl = cleanPhone
          ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`;

        window.open(waUrl, '_blank');
        setShareStatus('Receipt image downloaded & WhatsApp opened!');
        setTimeout(() => setShareStatus(null), 4000);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Share failed:', err);
        handleDownloadPng();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. Print Receipt
  const handlePrint = () => {
    const targetNode = exportRef.current || previewRef.current;
    if (!targetNode) return;
    const printContent = targetNode.innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${receiptNo}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: auto; margin: 10mm; }
              body { font-family: system-ui, -apple-system, sans-serif; background: #fff; padding: 0; margin: 0; display: flex; justify-content: center; }
            </style>
          </head>
          <body>
            <div style="width: 480px; margin: auto;">
              ${printContent}
            </div>
            <script>
              setTimeout(() => { window.print(); }, 400);
            </script>
          </body>
        </html>
      `);
      doc.close();
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 2000);
    }
  };

  // Shared Receipt Visual Template Component (Full-page, Crisp Light Luxury Theme)
  const renderReceiptCard = (isExport: boolean = false) => (
    <div className={`${isExport ? 'w-[480px] min-w-[480px]' : 'w-full max-w-[480px]'} bg-white text-slate-900 shadow-xl overflow-hidden font-sans border border-slate-200/90 rounded-2xl relative`}>

      {/* ── TOP LIGHT LUXURY HEADER ── */}
      <div className="bg-gradient-to-b from-slate-50 via-slate-50/90 to-white text-slate-900 px-3.5 sm:px-4 py-3 sm:py-3.5 border-b-2 border-emerald-500">
        <div className="flex items-center justify-between gap-2.5">

          {/* Logo & Brand Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold flex items-center justify-center text-xs sm:text-sm shadow-sm shrink-0 border border-emerald-500/30">
              {activeOrgInitials}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-900 leading-tight line-clamp-2">
                {activeOrgName}
              </h2>
              <p className="text-[9.5px] text-emerald-700 font-semibold tracking-widest uppercase mt-0.5 truncate">
                {activeOrgTagline}
              </p>
            </div>
          </div>

          {/* Paid Tag Badge */}
          <div className="shrink-0 text-right">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle2 size={11} className="text-emerald-600" /> PAID
            </span>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5 font-semibold">
              {receiptNo}
            </p>
          </div>

        </div>

        {/* Sub-header Banner */}
        <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600">
          <span className="font-bold text-slate-800 tracking-wider flex items-center gap-1.5 truncate">
            <Sparkles size={11} className="text-emerald-600 shrink-0" /> OFFICIAL PAYMENT RECEIPT
          </span>
          <span className="font-mono text-slate-500 font-medium shrink-0 ml-1">{dateFormatted} · {timeFormatted}</span>
        </div>
      </div>

      {/* ── BODY CONTENT ── */}
      <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3 bg-white">

        {/* Subscriber & Group Grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="min-w-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Subscriber Name
            </span>
            <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate mt-0.5">
              {memberName}
            </span>
            {memberPhone && (
              <span className="text-[10px] text-slate-500 font-mono block font-medium mt-0.5 truncate">
                +91 {memberPhone}
              </span>
            )}
          </div>

          <div className="text-right min-w-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Ticket & Group
            </span>
            <span className="font-bold text-indigo-700 text-xs sm:text-sm block mt-0.5 truncate">
              Ticket #{ticketNum}
            </span>
            <span className="text-[10px] text-slate-600 font-medium block truncate mt-0.5">
              {groupName} · {isMultiMonth ? 'Combined' : `M${month === 0 ? '0' : month}`}
            </span>
          </div>
        </div>

        {/* Hero Amount Paid Box */}
        <div className="p-2.5 sm:p-3 bg-gradient-to-br from-emerald-50 via-emerald-100/50 to-teal-50 border border-emerald-300 rounded-xl text-center relative overflow-hidden shadow-2xs">
          <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-0.5">
            Amount Received
          </div>
          <div className="text-xl sm:text-3xl font-black text-emerald-700 tracking-tight my-0.5 font-mono">
            {formatCurrency(effectiveTotalPaid)}
          </div>
          <div className="text-[10.5px] font-medium text-emerald-900 italic truncate px-1">
            {amountInWords}
          </div>
        </div>

        {/* Detailed Payment & Group Dues Breakdown Matrix (100% Uniform Fonts & Sizes) */}
        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-2xs">

          {/* Row 1: Payment Applied For Month */}
          <div className="flex justify-between items-center gap-2 px-3.5 py-2 bg-slate-50/70">
            <span className="text-[11px] font-medium text-slate-600 shrink-0">Payment Applied For</span>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md truncate text-right shrink-0">
              {monthLabel}
            </span>
          </div>

          {/* Row 2: Payment Mode */}
          <div className="flex justify-between items-center gap-2 px-3.5 py-2">
            <span className="text-[11px] font-medium text-slate-600 shrink-0">Payment Mode</span>
            <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md text-right shrink-0">
              {walletDisplay}
            </span>
          </div>

          {/* Row 3: Itemized Settlement Breakdown for Multi-Month or Single Month Due */}
          {isMultiMonth && activeAllocations && activeAllocations.length > 0 ? (
            <div className="divide-y divide-slate-100">
              <div className="px-3.5 py-1.5 bg-slate-100/80 text-[10px] font-bold text-slate-600 uppercase tracking-wider flex justify-between items-center">
                <span>Month Settled</span>
                <span>Amount Applied</span>
              </div>
              {activeAllocations.map((alloc, idx) => {
                const mLabel = getReceiptMonthLabel(group?.start_date, alloc.month, transaction.created_at);
                const isArr = alloc.type === 'arrear';
                const isAdv = alloc.type === 'advance';
                const typeTag = isArr ? 'Past Arrear' : isAdv ? 'Advance Pre-paid' : 'Current Month';
                return (
                  <div key={idx} className="flex justify-between items-center gap-2 px-3.5 py-2 bg-slate-50/40">
                    <div className="min-w-0">
                      <span className="text-[11px] font-medium text-slate-800 block truncate">{mLabel}</span>
                      <span className={`text-[9.5px] font-medium block ${isArr ? 'text-amber-700' : isAdv ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {typeTag}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-emerald-700 font-mono text-[11px] block">
                        +{formatCurrency(alloc.amount)}
                      </span>
                      <span className={`text-[9.5px] px-2 py-0.5 rounded-md font-semibold border ${isArr ? 'bg-amber-50 text-amber-800 border-amber-200' : isAdv ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                        {isArr ? 'Arrear Settled' : isAdv ? 'Advance Pre-paid' : 'Applied'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex justify-between items-center gap-2 px-3.5 py-2 bg-slate-50/40">
              <span className="text-[11px] font-medium text-slate-600 shrink-0">
                Month {month === 0 ? '0' : month} Pending Due
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border text-right shrink-0 ${isCleared
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}>
                {isCleared ? 'Cleared' : `${formatCurrency(remainingBalance)} Pending`}
              </span>
            </div>
          )}

          {/* Row 4: Past Pending Dues for this Particular Chit Group */}
          <div className="flex justify-between items-center gap-2 px-3.5 py-2">
            <div className="pr-1 min-w-0">
              <span className="text-[11px] font-medium text-slate-600 block">Past Pending Dues</span>
              {pastPendingDues > 0 && pastPendingMonths.length > 0 ? (
                <span className="text-[9.5px] text-amber-700 font-mono font-medium block">
                  Pending in: {pastPendingMonths.map(m => `Month ${m}`).join(', ')}
                </span>
              ) : null}
            </div>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border shrink-0 text-right ${pastPendingDues === 0
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}>
              {pastPendingDues === 0 ? 'No Past Pending' : `${formatCurrency(pastPendingDues)} Pending`}
            </span>
          </div>

          {/* Row 5: Total Group Outstanding Balance */}
          <div className="flex justify-between items-center gap-2 px-3.5 py-2 bg-slate-100/80 border-t border-slate-200">
            <span className="text-[11px] font-bold text-slate-900 shrink-0">Total Outstanding</span>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border text-right shrink-0 ${totalGroupOutstanding === 0
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-rose-600 bg-rose-50 border-rose-200'
              }`}>
              {totalGroupOutstanding === 0 ? '₹0 (All Cleared)' : `${formatCurrency(totalGroupOutstanding)} Total Pending`}
            </span>
          </div>

          {/* Optional Note (Full Text, Never Truncated) */}
          {cleanNotes && (
            <div className="flex justify-between items-start gap-3 px-3.5 py-2 bg-amber-50/30">
              <span className="text-[11px] font-medium text-slate-500 shrink-0 mt-0.5">Note</span>
              <span className="text-[11px] text-slate-700 italic font-medium text-right break-words leading-relaxed flex-1">
                {cleanNotes}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── REALISTIC PERFORATED TICKET TEAR LINE WITH NOTCHES ── */}
      <div className="relative py-2.5 bg-white flex items-center justify-between select-none">
        {/* Left Circular Ticket Notch (Cuts inward into left card edge) */}
        <div
          className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 border border-slate-300 shadow-inner z-10"
          aria-hidden="true"
        />

        {/* Dotted Tear Line (Punch holes) */}
        <div className="w-full border-t-2 border-dotted border-slate-300 mx-4" />

        {/* Right Circular Ticket Notch (Cuts inward into right card edge) */}
        <div
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 border border-slate-300 shadow-inner z-10"
          aria-hidden="true"
        />
      </div>

      {/* ── TICKET STUB / DIGITAL SECURITY COUNTERFOIL (NO SIGNATORY OR CONFIRMED BADGE) ── */}
      <div className="px-3.5 sm:px-4 py-2.5 bg-slate-50/70 border-t border-slate-100">
        <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500">
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[10.5px]">
              <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
              <span className="tracking-wide">AUTHENTICATED DIGITAL RECORD</span>
            </div>
            <p className="text-[9.5px] text-slate-500 font-mono font-medium">
              Passbook: <strong className="text-slate-700">{appPortalUrl.replace(/^https?:\/\//, '')}</strong>
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono text-slate-400 font-semibold block">
              Ref #{receiptNo}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Receipt Custom Footer from Notification Preferences */}
      {activeReceiptFooter && (
        <div className="bg-emerald-50/60 px-4 py-2 border-t border-slate-200/80 text-center text-[10px] font-semibold text-emerald-900 leading-snug">
          {activeReceiptFooter}
        </div>
      )}

      {/* Bottom Security Bar */}
      <div className="bg-slate-100 px-4 py-1.5 border-t border-slate-200 text-center text-[9px] text-slate-500 font-mono font-medium">
        Computer-generated digital receipt · Registered on Supabase Ledger
      </div>

    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border-t sm:border border-slate-200/90 text-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-0 sm:my-auto flex flex-col max-h-[94dvh] sm:max-h-[90vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-150">

        {/* Top Actions Header (Light Theme Header matching App) */}
        <div className="px-5 py-3.5 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 tracking-tight font-display truncate">
                Payment Receipt
              </h3>
              <p className="text-[11px] text-slate-500 font-mono font-medium truncate">
                {receiptNo} · {monthLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Receipt Preview Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100/70 flex flex-col items-center justify-start min-h-0">

          {/* Status / Toast alert if any */}
          {shareStatus && (
            <div className="w-full max-w-[480px] mb-3 px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 shadow-xs">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{shareStatus}</span>
            </div>
          )}

          {copiedToast && (
            <div className="w-full max-w-[480px] mb-3 px-3.5 py-2 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 shadow-xs">
              <Check size={16} className="text-teal-600 shrink-0" />
              <span>Receipt image copied to clipboard! (Paste into WhatsApp)</span>
            </div>
          )}

          {/* Receipt UI Preview Container */}
          <div className="w-full flex justify-center py-1">
            <div ref={previewRef} className="w-full max-w-[480px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-xl shrink-0 bg-white">
              {renderReceiptCard(false)}
            </div>
          </div>

        </div>

        {/* Modal Action Controls Bar (Mobile Optimized Thumb-Friendly Bottom Bar) */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 space-y-2.5 shrink-0">

          {/* Primary Action Button: Prominent WhatsApp / Share Button */}
          <button
            type="button"
            onClick={handleSharePng}
            disabled={isGenerating}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Share2 size={18} />
            <span>{isGenerating ? 'Generating Image...' : 'Share Receipt via WhatsApp'}</span>
          </button>

          {/* Secondary Actions Grid: Download PNG, Copy Image, Print */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isGenerating}
              className="py-2.5 px-2 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download size={15} className="text-slate-500 shrink-0" />
              <span className="truncate">Download PNG</span>
            </button>

            <button
              type="button"
              onClick={handleCopyImage}
              disabled={isGenerating}
              className="py-2.5 px-2 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Copy size={15} className="text-slate-500 shrink-0" />
              <span className="truncate">Copy Image</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isGenerating}
              className="py-2.5 px-2 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer size={15} className="text-slate-500 shrink-0" />
              <span className="truncate">Print</span>
            </button>
          </div>

        </div>

      </div>

      {/* ── UNCONSTRAINED OFFSCREEN EXPORT RENDER ELEMENT (Guarantees Full Page 480px PNG with Zero Crop) ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '-9999px',
          width: '480px',
          height: 'auto',
          overflow: 'visible',
          zIndex: -9999,
          pointerEvents: 'none',
        }}
      >
        <div ref={exportRef} style={{ width: '480px', height: 'auto', overflow: 'visible', backgroundColor: '#f1f5f9' }}>
          {renderReceiptCard(true)}
        </div>
      </div>

    </div>
  );
};

