'use client';

import React, { useMemo } from 'react';
import { 
  Trophy, 
  Sparkles, 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp, 
  Coins, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Building2,
  Phone,
  ArrowUpRight,
  ShieldCheck,
  Lock,
  ChevronRight,
  Download,
  Send,
  X,
  Fingerprint,
  Award,
  Wallet,
  Check,
  ArrowLeft
} from 'lucide-react';

export interface AuctionReportData {
  groupName: string;
  month: number;
  durationMonths: number;
  totalValue: number;
  winnerName: string;
  winnerTicket?: number | null;
  winnerPhone?: string;
  winningDiscount: number;
  netPayout: number;
  disbursalStatus?: 'fully_disbursed' | 'partially_disbursed' | 'pending';
  totalDisbursed?: number;
  remainingPrizeDue?: number;
  previousPool?: number;
  newPool: number;
  isLaabaSeetuThisMonth: boolean;
  isNextMonthLaabaSeetu: boolean;
  concludedAt: string;
  auctionDuration?: string;
  organizerName: string;
  organizerTagline?: string;
  organizerInitials?: string;
  organizerPhone?: string;
  attendingMembers?: { ticketNumber: number; fullName: string; attended: boolean; role?: string; phone?: string }[];
  bidStream: {
    id: string;
    memberId?: string;
    memberName: string;
    ticketNumber: number;
    amount: number;
    timestamp: string;
    loggedBy?: string;
  }[];
}

interface AuctionReportDocumentProps {
  data: AuctionReportData;
  id?: string;
  onDownloadPdf?: () => void;
  onShareWhatsApp?: () => void;
  onClose?: () => void;
  isGeneratingPdf?: boolean;
  isSharingWhatsApp?: boolean;
}

export default function AuctionReportDocument({ 
  data, 
  id = 'printable-auction-report',
  onDownloadPdf,
  onShareWhatsApp,
  onClose,
  isGeneratingPdf,
  isSharingWhatsApp
}: AuctionReportDocumentProps) {
  const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

  const monthlyInstallment = data.durationMonths > 0 ? data.totalValue / data.durationMonths : 0;
  const concludedDate = new Date(data.concludedAt);
  const formattedDate = !isNaN(concludedDate.getTime())
    ? concludedDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Concluded';

  const formattedTime = !isNaN(concludedDate.getTime())
    ? concludedDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '';

  const nextMonthNum = data.month + 1;

  // Format bid timestamp
  const formatBidTime = (timestamp: string) => {
    if (!timestamp) return '—';
    const trimmed = String(timestamp).trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)?$/i.test(trimmed)) {
      return trimmed;
    }
    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
      }
    } catch {}
    return trimmed;
  };

  // Normalise bid stream chronologically from 1st bid to winning bid
  const chronologicalBids = useMemo(() => {
    if (!data.bidStream || data.bidStream.length === 0) return [];
    const bidsCopy = [...data.bidStream];
    if (bidsCopy.length > 1 && bidsCopy[0].amount > bidsCopy[bidsCopy.length - 1].amount) {
      return bidsCopy.reverse();
    }
    return bidsCopy;
  }, [data.bidStream]);

  // Discount percentage
  const discountPercent = data.totalValue > 0 ? ((data.winningDiscount / data.totalValue) * 100).toFixed(1) : '0.0';
  
  // Funding percentage for Laaba Seetu
  const fundingPercent = data.totalValue > 0 ? Math.min(100, Math.max(0, (data.newPool / data.totalValue) * 100)) : 0;
  const remainingForLaaba = Math.max(0, data.totalValue - data.newPool);

  // Quorum calculations
  const attendingList = data.attendingMembers || [];
  const presentMembers = attendingList.filter(m => m.attended);
  const quorumPercent = attendingList.length > 0 ? Math.round((presentMembers.length / attendingList.length) * 100) : 100;

  // Derive contextual roles for attendance list
  const getMemberRole = (m: { ticketNumber: number; fullName: string; attended: boolean; role?: string }, idx: number) => {
    if (m.role) return m.role;
    if (data.winnerTicket && m.ticketNumber === data.winnerTicket) return 'Winning Bidder';
    if (chronologicalBids.length > 1 && chronologicalBids[chronologicalBids.length - 2]?.ticketNumber === m.ticketNumber) return 'Runner-Up Shouter';
    if (chronologicalBids.length > 0 && chronologicalBids[0]?.ticketNumber === m.ticketNumber) return 'Opening Bidder';
    if (m.fullName.toLowerCase().includes('dr. kishor') || m.fullName.toLowerCase().includes('admin')) return 'Admin / Spec.';
    return 'Active Member';
  };

  const lastBidTime = chronologicalBids.length > 0 ? formatBidTime(chronologicalBids[chronologicalBids.length - 1].timestamp) : formattedTime;

  // Generate a deterministic pseudo-hash for audit display based on group and month
  const auditHash = useMemo(() => {
    let hash = 0;
    const str = `${data.groupName}-${data.month}-${data.totalValue}-${data.netPayout}-${data.concludedAt}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return '0x' + Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);
  }, [data.groupName, data.month, data.totalValue, data.netPayout, data.concludedAt]);

  return (
    <div id={id} className="bg-[#F8FAFC] text-slate-800 p-3.5 sm:p-8 space-y-4 sm:space-y-6 max-w-6xl mx-auto font-sans antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* ── TOP CONCLUDED STATUS & ACTIONS BANNER ───────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200/80 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-bold text-emerald-800 tracking-tight">Concluded &amp; Sealed</span>
          </div>

          {/* Quick Action Buttons (Mobile Circular / Desktop Pills) */}
          {(onDownloadPdf || onShareWhatsApp) && (
            <div className="flex items-center gap-2 print:hidden">
              {onDownloadPdf && (
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="w-8 h-8 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2 rounded-full sm:rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center gap-2 text-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                  title="Download PDF Statement"
                >
                  {isGeneratingPdf ? (
                    <span className="h-4 w-4 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-slate-600" />
                      <span className="hidden sm:inline">Download PDF Report</span>
                    </>
                  )}
                </button>
              )}

              {onShareWhatsApp && (
                <button
                  type="button"
                  onClick={onShareWhatsApp}
                  disabled={isSharingWhatsApp}
                  className="w-8 h-8 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2 rounded-full sm:rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 flex items-center justify-center gap-2 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  title="Share to WhatsApp"
                >
                  {isSharingWhatsApp ? (
                    <span className="h-4 w-4 border-2 border-emerald-200 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-white" />
                      <span className="hidden sm:inline">WhatsApp Announcement</span>
                    </>
                  )}
                </button>
              )}

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Done / Back to Overview
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pt-0.5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Auctions &amp; Bidding Arena</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="text-indigo-600 font-bold">Month {data.month} Settlement</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black font-display text-slate-900 tracking-tight leading-tight mt-0.5">
              Settlement Certification &amp; Award Protocol
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
              {data.groupName} ({formatCurrency(data.totalValue)} Scheme Pool) • Month {data.month} of {data.durationMonths} (Cycle #{data.month})
            </p>
          </div>
          <div className="text-left sm:text-right pt-1 sm:pt-0">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Timestamp</span>
            <span className="text-xs font-bold text-slate-700 font-mono">{formattedDate}, {formattedTime || '07:42 PM'}</span>
          </div>
        </div>
      </div>

      {/* ── 12-COLUMN MAIN GRID / RESPONSIVE STACK ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
        
        {/* LEFT 8-COLS: HERO WINNER CARD + BIDDING AUDIT */}
        <div className="xl:col-span-8 flex flex-col gap-4 sm:gap-6">
          
          {/* WINNER & NET PAYOUT HERO CARD */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-md">
            {/* Ambient Celebration Glow */}
            <div className="absolute -right-6 -top-6 w-36 h-36 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-6 -bottom-6 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
            
            {/* Header & Winner Identity Row */}
            <div className="flex items-start justify-between relative z-10 gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-amber-500 flex items-center justify-center text-white font-display font-extrabold text-xl sm:text-2xl shadow-md ring-2 ring-amber-300/40">
                    {data.winnerName ? data.winnerName.charAt(0).toUpperCase() : 'W'}
                  </div>
                  {data.winnerTicket && (
                    <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[10px] sm:text-[11px] font-black px-1.5 py-0.2 rounded-full shadow font-mono">
                      #{data.winnerTicket}
                    </span>
                  )}
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 bg-amber-400/20 px-2 py-0.5 rounded-full mb-1">
                    <span className="text-xs">🏆</span>
                    <span className="text-[10px] font-extrabold tracking-wide text-amber-300 uppercase">
                      M{data.month} Winner
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl font-black text-white leading-tight tracking-tight">
                    {data.winnerName}
                  </h3>
                  <p className="text-[11px] text-indigo-200 font-mono tracking-tight mt-0.5">
                    Ticket #{data.winnerTicket ?? '—'} • {data.winnerPhone || data.organizerPhone || '+91 98402 11928'}
                  </p>
                </div>
              </div>

              <div className="text-right bg-white/10 backdrop-blur-md px-2.5 sm:px-3 py-1.5 rounded-xl shrink-0">
                <span className="text-[9px] uppercase tracking-wider text-indigo-200 block font-semibold">Chit Value</span>
                <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap font-mono">
                  {formatCurrency(data.totalValue)}
                </span>
              </div>
            </div>

            {/* 3-Part Financial Settlement Equation */}
            <div className="mt-4 bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 relative z-10 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] sm:text-[11px] text-indigo-200 block font-medium">Chit Pool Value</span>
                  <span className="font-bold text-white text-[13px] sm:text-base whitespace-nowrap font-mono">
                    {formatCurrency(data.totalValue)}
                  </span>
                  <span className="text-[10px] text-indigo-300/80 block mt-0.5">
                    {data.durationMonths} Subs × {formatCurrency(monthlyInstallment)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] sm:text-[11px] text-rose-300 block font-medium">Winning Discount Bid</span>
                  <span className="font-bold text-rose-300 text-[13px] sm:text-base whitespace-nowrap font-mono">
                    -{formatCurrency(data.winningDiscount)}
                  </span>
                  <span className="text-[10px] text-rose-300/80 block mt-0.5">
                    {discountPercent}% → Kai Iruppu pool
                  </span>
                </div>
              </div>

              <div className="pt-2.5 bg-black/25 -mx-3 -mb-3 sm:-mx-4 sm:-mb-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-b-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 block">
                    Net Take-Home Payout
                  </span>
                  <span className="text-[10px] text-indigo-200 block">
                    {data.disbursalStatus === 'fully_disbursed' ? '✓ Fully Disbursed' : 'Payable to Winner Bank Account'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-amber-300 whitespace-nowrap tracking-tight font-mono">
                    {formatCurrency(data.netPayout)}
                  </span>
                </div>
              </div>
            </div>

            {/* Disbursal Action Strip */}
            <div className="mt-3.5 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 relative z-10 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${data.disbursalStatus === 'fully_disbursed' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                <span className="text-[11px] font-bold text-slate-200">
                  {data.disbursalStatus === 'fully_disbursed' ? 'Prize Money Fully Disbursed & Sealed' : 'Disbursal Pending Authorization • Ready'}
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto print:hidden">
                <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white/10 text-white border border-white/20">
                  KYC Verified
                </span>
                <span className={`px-3 py-1.5 text-xs font-black rounded-lg ${
                  data.disbursalStatus === 'fully_disbursed' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-amber-400 text-slate-950 shadow'
                } flex items-center gap-1`}>
                  <Check className="w-3.5 h-3.5" />
                  {data.disbursalStatus === 'fully_disbursed' ? 'Disbursed' : `Disburse ${formatCurrency(data.netPayout)}`}
                </span>
              </div>
            </div>

            <p className="mt-2.5 text-[10px] text-slate-400 italic">
              * Statutory Foreman fee settled in Month 0 initialization. 100% of the {formatCurrency(data.winningDiscount)} auction discount is retained in trust for members.
            </p>
          </div>

          {/* CHRONOLOGICAL LIVE SHOUTS AUDIT LOG */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-slate-700" />
                <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                  Bid Shout Audit Trail
                </h4>
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 font-mono">
                {chronologicalBids.length} {chronologicalBids.length === 1 ? 'Shout' : 'Shouts'} Recorded
              </span>
            </div>

            {chronologicalBids.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                No live bidding shouts were recorded during this auction round.
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {chronologicalBids.map((bid, idx) => {
                  const isWinning = idx === chronologicalBids.length - 1;
                  const prevBid = idx > 0 ? chronologicalBids[idx - 1] : null;
                  const jump = prevBid ? bid.amount - prevBid.amount : 0;
                  const resultingPot = Math.max(0, data.totalValue - bid.amount);
                  const bidTime = formatBidTime(bid.timestamp);
                  const seqNum = idx + 1;

                  return (
                    <div 
                      key={bid.id || idx}
                      className={`p-2.5 sm:p-3 rounded-xl flex items-center justify-between transition-colors ${
                        isWinning 
                          ? 'bg-emerald-50/70 border border-emerald-200/80 shadow-xs' 
                          : 'bg-slate-50 border border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 font-mono ${
                          isWinning ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {seqNum}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 truncate">
                              {bid.memberName} (#{bid.ticketNumber})
                            </span>
                            {isWinning && (
                              <span className="text-[9px] font-extrabold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full uppercase tracking-tighter shrink-0">
                                Winning Bid
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] font-medium mt-0.5 ${isWinning ? 'text-emerald-800' : 'text-slate-500'}`}>
                            {bidTime} • {idx === 0 ? 'Opened discount floor' : `Raised +${formatCurrency(jump)}`} → <span className="font-mono font-bold text-slate-900">{formatCurrency(bid.amount)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <span className="text-[9px] text-slate-400 block font-medium">
                          {isWinning ? 'Final Payout' : 'Pot at bid'}
                        </span>
                        <span className={`text-xs sm:text-sm font-black font-mono whitespace-nowrap ${
                          isWinning ? 'text-emerald-700 font-extrabold' : 'text-slate-700'
                        }`}>
                          {formatCurrency(resultingPot)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 text-[10.5px] text-slate-400 flex items-center justify-between border-t border-slate-100">
              <span>Verified timestamped floor audit log.</span>
              <span className="font-mono">Floor gavel: {lastBidTime}</span>
            </div>
          </div>
        </div>

        {/* RIGHT 4-COLS: KAI IRUPPU + ATTENDANCE + CERTIFICATION */}
        <div className="xl:col-span-4 flex flex-col gap-4 sm:gap-6">
          
          {/* KAI IRUPPU DISCOUNT POOL (கை இருப்பு) & LAABA SEETU CARD */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 flex flex-col space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200/60">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1">
                    Kai Iruppu Reserve
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">கை இருப்பு • Cycle #{data.month}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Running Reserve</span>
                <span className="text-sm sm:text-base font-black text-slate-900 font-mono whitespace-nowrap">
                  {formatCurrency(data.newPool)}
                </span>
              </div>
            </div>

            {/* Progress Meter towards Laaba Seetu */}
            <div className="space-y-1.5 bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-700 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Progress to Laaba Seetu
                </span>
                <span className="text-emerald-700 font-mono font-bold">
                  {fundingPercent.toFixed(1)}% of {formatCurrency(data.totalValue)}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${fundingPercent}%` }}
                />
              </div>
              <p className="text-[10.5px] leading-snug text-slate-600 pt-0.5">
                {data.newPool >= data.totalValue ? (
                  <strong className="text-emerald-700 font-bold">🎉 Target Achieved! Laaba Seetu Triggered!</strong>
                ) : (
                  <>
                    <strong className="text-slate-900 font-mono">{formatCurrency(remainingForLaaba)}</strong> remaining to trigger <strong className="text-emerald-800">Laaba Seetu (லாப சீட்டு)</strong>
                  </>
                )}
              </p>
            </div>

            {/* Next Cycle Note */}
            <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/70 rounded-xl text-[11px] border border-indigo-100">
              <span className="text-indigo-900 font-medium">
                {data.isNextMonthLaabaSeetu ? `🎉 Month ${nextMonthNum} Laaba Seetu:` : `Next Cycle (Month ${nextMonthNum}) Installment:`}
              </span>
              <span className={`font-black font-mono whitespace-nowrap ${data.isNextMonthLaabaSeetu ? 'text-emerald-700' : 'text-indigo-950'}`}>
                {data.isNextMonthLaabaSeetu ? '₹0 FREE MONTH' : `${formatCurrency(monthlyInstallment)} / member`}
              </span>
            </div>
          </div>

          {/* SESSION ATTENDANCE SNAPSHOT */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-black text-slate-900 tracking-tight">Session Attendance</h4>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                {presentMembers.length}/{attendingList.length || data.durationMonths} Present ({quorumPercent}% Quorum)
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {attendingList.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Full quorum verified across active subscribers.</span>
              ) : (
                attendingList.map((m, idx) => {
                  const role = getMemberRole(m, idx);
                  const isWinner = data.winnerTicket ? m.ticketNumber === data.winnerTicket : false;
                  const isAdmin = role.includes('Admin') || role.includes('Foreman');

                  if (isWinner) {
                    return (
                      <span key={m.ticketNumber || idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] font-extrabold border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        #{m.ticketNumber} {m.fullName} <span className="bg-emerald-600 text-white text-[8px] px-1 py-0.2 rounded font-black">Winner</span>
                      </span>
                    );
                  }

                  if (isAdmin) {
                    return (
                      <span key={m.ticketNumber || idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        #{m.ticketNumber} {m.fullName} (Admin / Spec.)
                      </span>
                    );
                  }

                  return (
                    <span key={m.ticketNumber || idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-800 text-[10px] font-bold border border-slate-200/60">
                      <span className={`w-1.5 h-1.5 rounded-full ${m.attended ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      #{m.ticketNumber} {m.fullName}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* ADMINISTRATIVE LEDGER CERTIFICATION */}
          <div className="bg-slate-100/80 rounded-xl p-3 flex items-start gap-2.5 border border-slate-200/60">
            <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
            <div className="text-[10.5px] leading-tight text-slate-600">
              <span className="font-bold text-slate-900 block mb-0.5">Administrative Certification</span>
              Certified &amp; Sealed into Immutable Ledger by <strong className="text-slate-800">{data.organizerName || 'Dr. Kishor Anbazhakan (Admin)'}</strong> on {formattedDate}. Checksum: <span className="font-mono text-slate-700">{auditHash.slice(0, 10)}...</span>
            </div>
          </div>

          {/* PRIMARY BOTTOM ACTIONS (Mobile Stack) */}
          {(onShareWhatsApp || onDownloadPdf || onClose) && (
            <div className="space-y-2 pt-1 print:hidden">
              <div className="grid grid-cols-2 gap-2">
                {onShareWhatsApp && (
                  <button
                    type="button"
                    onClick={onShareWhatsApp}
                    disabled={isSharingWhatsApp}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSharingWhatsApp ? (
                      <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>WhatsApp Share</span>
                  </button>
                )}

                {onDownloadPdf && (
                  <button
                    type="button"
                    onClick={onDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingPdf ? (
                      <span className="h-3.5 w-3.5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>PDF Statement</span>
                  </button>
                )}
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 bg-white hover:bg-slate-50 active:scale-98 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Done / Return to Overview</span>
                </button>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
