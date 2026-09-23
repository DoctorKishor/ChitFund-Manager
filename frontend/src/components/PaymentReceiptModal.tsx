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

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  member,
  group,
  month,
  totalDue,
  organizerCompanyName = 'ANBAZHAKAN CHIT FUNDS',
  organizerInitials = 'AC',
  formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`
}) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;

  const paidAmount = Number(transaction.amount || 0);
  const calculatedDue = totalDue || Number(group?.monthly_installment || 0);
  const remainingBalance = Math.max(0, calculatedDue - paidAmount);
  const isCleared = remainingBalance === 0;

  const receiptNo = `RCP-${String(transaction.id || 'TX001').slice(0, 8).toUpperCase()}`;
  
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
  const walletDisplay = (transaction.wallet_type || 'cash_in_hand').replace(/_/g, ' ').toUpperCase();
  const groupName = group?.name || 'Chit Group';
  const amountInWords = numberToWordsINR(paidAmount);

  const cleanMemberName = memberName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Receipt_${receiptNo}_${cleanMemberName}_Month${month}.png`;

  // Base portal URL
  const appPortalUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || 'https://chitfund.app';

  // Helper to generate pixel-perfect PNG dataUrl from the unconstrained offscreen export element
  const getReceiptPngDataUrl = async (): Promise<string> => {
    const targetNode = exportRef.current || previewRef.current;
    if (!targetNode) throw new Error('Receipt render target not found');

    const width = 480;
    const height = targetNode.scrollHeight || targetNode.offsetHeight || 620;

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
        height: 'auto',
        maxHeight: 'none',
        overflow: 'visible',
        transform: 'none',
        margin: '0',
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
          text: `Official Payment Receipt for ${memberName} (Ticket #${ticketNum}) · ${groupName} Month ${month} (${formatCurrency(paidAmount)})`,
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
        const msg = `*CHIT FUNDS PAYMENT RECEIPT* 🧾\n\n*Receipt No:* ${receiptNo}\n*Subscriber:* ${memberName} (Ticket #${ticketNum})\n*Group:* ${groupName} (Month ${month})\n*Amount Paid:* ${formatCurrency(paidAmount)}\n*Mode:* ${walletDisplay}\n*Date:* ${dateFormatted}, ${timeFormatted}\n*Status:* ${isCleared ? '✅ FULLY CLEARED' : '⏳ PARTIAL'}\n\n_Receipt image downloaded. Thank you!_ 🙏`;
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

  // Shared Receipt Visual Template Component
  const renderReceiptCard = () => (
    <div className="w-[480px] bg-white text-slate-900 shadow-2xl overflow-hidden font-sans border border-slate-200" style={{ borderRadius: '0px' }}>
      
      {/* ── TOP LUXURY HEADER ── */}
      <div className="bg-[#0f172a] text-white p-5 border-b-2 border-emerald-500">
        <div className="flex items-center justify-between gap-3">
          
          {/* Logo & Brand Name perfectly aligned */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 font-black flex items-center justify-center text-base shadow-md shrink-0 border border-emerald-300">
              {organizerInitials || 'DK'}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-wider uppercase text-white leading-tight truncate">
                {organizerCompanyName}
              </h2>
              <p className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase mt-0.5">
                TRUSTED CHIT FUNDS MANAGEMENT
              </p>
            </div>
          </div>

          {/* Paid Tag Badge */}
          <div className="shrink-0 text-right">
            <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
              <CheckCircle2 size={11} className="text-emerald-400" /> PAID
            </span>
            <p className="text-[10px] font-mono text-slate-300 mt-1 font-bold">
              {receiptNo}
            </p>
          </div>

        </div>

        {/* Sub-header Banner */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-700/70 flex items-center justify-between text-[10px] text-slate-300">
          <span className="font-extrabold text-white tracking-wider">OFFICIAL PAYMENT RECEIPT</span>
          <span className="font-mono text-slate-400 font-semibold">{dateFormatted} · {timeFormatted}</span>
        </div>
      </div>

      {/* ── BODY CONTENT ── */}
      <div className="p-5 space-y-4 bg-white">
        
        {/* Subscriber & Group Grid */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Subscriber Name
            </span>
            <span className="font-extrabold text-slate-900 text-sm block truncate mt-0.5">
              {memberName}
            </span>
            {memberPhone && (
              <span className="text-[10px] text-slate-500 font-mono block font-semibold mt-0.5">
                +91 {memberPhone}
              </span>
            )}
          </div>

          <div className="text-right">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Ticket & Group
            </span>
            <span className="font-extrabold text-indigo-700 text-sm block mt-0.5">
              Ticket #{ticketNum}
            </span>
            <span className="text-[10px] text-slate-600 font-bold block truncate mt-0.5">
              {groupName} · M{month}
            </span>
          </div>
        </div>

        {/* Hero Amount Paid Box */}
        <div className="p-4 bg-gradient-to-br from-emerald-50 via-emerald-100/50 to-teal-50 border border-emerald-300 rounded-xl text-center relative overflow-hidden shadow-2xs">
          <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-0.5">
            Amount Received
          </div>
          <div className="text-3xl font-black text-emerald-700 tracking-tight my-0.5">
            {formatCurrency(paidAmount)}
          </div>
          <div className="text-[10.5px] font-bold text-emerald-900 italic">
            {amountInWords}
          </div>
        </div>

        {/* Payment Breakdown Rows */}
        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs shadow-2xs">
          <div className="flex justify-between items-center px-3.5 py-2.5 bg-slate-50/70">
            <span className="text-slate-500 font-semibold">Payment Mode</span>
            <span className="font-bold text-slate-900 font-mono bg-slate-200/80 px-2.5 py-0.5 rounded text-[10.5px]">
              {walletDisplay}
            </span>
          </div>

          <div className="flex justify-between items-center px-3.5 py-2.5">
            <span className="text-slate-500 font-semibold">Installment Due</span>
            <span className="font-bold text-slate-800">
              {formatCurrency(calculatedDue)}
            </span>
          </div>

          <div className="flex justify-between items-center px-3.5 py-2.5">
            <span className="text-slate-500 font-semibold">Amount Credited</span>
            <span className="font-extrabold text-emerald-600">
              {formatCurrency(paidAmount)}
            </span>
          </div>

          <div className="flex justify-between items-center px-3.5 py-2.5 bg-slate-50/70">
            <span className="text-slate-700 font-bold">Month {month} Balance</span>
            <span className={`font-black ${isCleared ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isCleared ? '₹0 (CLEARED ✅)' : `${formatCurrency(remainingBalance)} PENDING`}
            </span>
          </div>

          {transaction.notes && (
            <div className="flex justify-between items-center px-3.5 py-2 bg-amber-50/40 text-[10.5px]">
              <span className="text-slate-400 font-semibold">Note</span>
              <span className="text-slate-700 italic truncate max-w-[260px] font-medium">
                {transaction.notes}
              </span>
            </div>
          )}
        </div>

        {/* Sign-off & Verification Seal */}
        <div className="pt-3 border-t border-dashed border-slate-300 flex items-center justify-between text-[9.5px] text-slate-500">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-emerald-700 font-extrabold">
              <ShieldCheck size={13} className="text-emerald-600" />
              <span>AUTHENTICATED RECORD</span>
            </div>
            <p className="text-[9px] text-slate-400 font-medium">
              Passbook: <strong className="text-slate-600">{appPortalUrl.replace(/^https?:\/\//, '')}</strong>
            </p>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="w-20 h-4 border-b border-slate-400 border-dashed" />
            <span className="text-[8.5px] font-bold text-slate-600 uppercase mt-0.5">
              Authorized Signatory
            </span>
          </div>
        </div>

      </div>

      {/* Bottom Security Bar */}
      <div className="bg-slate-100 px-4 py-2 border-t border-slate-200 text-center text-[8.5px] text-slate-500 font-mono font-medium">
        Computer-generated digital receipt · Registered on Supabase Ledger
      </div>

    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-auto flex flex-col max-h-[96dvh]">
        
        {/* Top Actions Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <FileCheck size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                Payment Receipt PNG
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {receiptNo} · Month {month}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Receipt Preview Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-950 flex flex-col items-center justify-start min-h-0">
          
          {/* Status / Toast alert if any */}
          {shareStatus && (
            <div className="mb-3 px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>{shareStatus}</span>
            </div>
          )}

          {copiedToast && (
            <div className="mb-3 px-3 py-1.5 bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2">
              <Check size={14} className="text-indigo-400" />
              <span>Receipt image copied to clipboard! (Ctrl+V to paste)</span>
            </div>
          )}

          {/* Receipt UI Preview Container */}
          <div className="w-full flex justify-center overflow-x-auto py-1">
            <div ref={previewRef} className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl shrink-0">
              {renderReceiptCard()}
            </div>
          </div>

        </div>

        {/* Modal Action Controls Bar */}
        <div className="p-3 sm:p-4 bg-slate-800/90 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
          
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyImage}
              disabled={isGenerating}
              title="Copy receipt image to clipboard"
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Copy size={14} />
              <span className="hidden sm:inline">Copy Image</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isGenerating}
              title="Print receipt"
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download size={14} />
              <span>Download PNG</span>
            </button>

            <button
              type="button"
              onClick={handleSharePng}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
            >
              <Share2 size={14} />
              <span>Share Receipt PNG</span>
            </button>
          </div>

        </div>

      </div>

      {/* ── UNCONSTRAINED OFFSCREEN EXPORT RENDER ELEMENT (Prevents all scroll & viewport clipping) ── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: '480px',
          zIndex: -9999,
          pointerEvents: 'none',
        }}
      >
        <div ref={exportRef} style={{ width: '480px', backgroundColor: '#ffffff' }}>
          {renderReceiptCard()}
        </div>
      </div>

    </div>
  );
};
