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
  ArrowUpRight
} from 'lucide-react';

export interface AuctionReportData {
  groupName: string;
  month: number;
  durationMonths: number;
  totalValue: number;
  winnerName: string;
  winnerTicket?: number | null;
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
  attendingMembers?: { ticketNumber: number; fullName: string; attended: boolean }[];
  bidStream: {
    id: string;
    memberId?: string;
    memberName: string;
    ticketNumber: number;
    amount: number;
    timestamp: string;
  }[];
}

interface AuctionReportDocumentProps {
  data: AuctionReportData;
  id?: string;
}

export default function AuctionReportDocument({ data, id = 'printable-auction-report' }: AuctionReportDocumentProps) {
  const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

  const monthlyInstallment = data.durationMonths > 0 ? data.totalValue / data.durationMonths : 0;
  const concludedDate = new Date(data.concludedAt);
  const formattedDate = !isNaN(concludedDate.getTime())
    ? concludedDate.toLocaleDateString('en-IN', {
        weekday: 'short',
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

  // Format bid timestamp (handles "01:56:07 AM", ISO strings, or 24h strings)
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
    // If the first bid has a higher amount than the last, it was stored newest-first (descending) -> reverse to show true chronological timeline
    if (bidsCopy.length > 1 && bidsCopy[0].amount > bidsCopy[bidsCopy.length - 1].amount) {
      return bidsCopy.reverse();
    }
    return bidsCopy;
  }, [data.bidStream]);

  return (
    <div id={id} className="bg-white text-gray-900 p-3.5 sm:p-8 space-y-4 sm:space-y-6 max-w-4xl mx-auto font-sans" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
      
      {/* ── SECTION 1: OFFICIAL REPORT HEADER BANNER (Light themed certificate header) ─── */}
      <div 
        className="pdf-section rounded-2xl p-4 sm:p-6 shadow-xs space-y-3 sm:space-y-4"
        style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 pb-3 sm:pb-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span 
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shrink-0 shadow-2xs"
                style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#b45309' }}
              >
                {data.organizerInitials || 'CF'}
              </span>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-black tracking-tight truncate" style={{ color: '#0f172a' }}>
                  {data.organizerName}
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold truncate" style={{ color: '#64748b' }}>
                  {data.organizerTagline || 'Official Live Auction Audit Certificate & Settlement Statement'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-1">
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold font-mono"
              style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' }}
            >
              <CheckCircle2 size={11} /> Concluded &amp; Sealed
            </span>
            <p className="text-[10px] sm:text-[11px] font-mono" style={{ color: '#64748b' }}>
              {formattedDate} {formattedTime ? `• ${formattedTime}` : ''}
            </p>
            {data.auctionDuration && (
              <p className="text-[10px] sm:text-[11px] font-mono font-bold flex items-center gap-1" style={{ color: '#4f46e5' }}>
                <Clock size={11} /> Duration: {data.auctionDuration}
              </p>
            )}
          </div>
        </div>

        {/* Group Context Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-0.5 text-xs">
          <div className="rounded-xl p-2.5 sm:p-3 shadow-2xs" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold block" style={{ color: '#64748b' }}>Chit Group</span>
            <span className="font-extrabold text-xs sm:text-sm mt-0.5 block truncate" style={{ color: '#0f172a' }}>{data.groupName}</span>
          </div>
          <div className="rounded-xl p-2.5 sm:p-3 shadow-2xs" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold block" style={{ color: '#64748b' }}>Auction Cycle</span>
            <span className="font-extrabold text-xs sm:text-sm mt-0.5 block" style={{ color: '#0f172a' }}>
              Month {data.month} of {data.durationMonths}
            </span>
          </div>
          <div className="rounded-xl p-2.5 sm:p-3 shadow-2xs" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold block" style={{ color: '#64748b' }}>Total Chit Pot</span>
            <span className="font-extrabold font-mono text-xs sm:text-sm mt-0.5 block" style={{ color: '#b45309' }}>
              {formatCurrency(data.totalValue)}
            </span>
          </div>
          <div className="rounded-xl p-2.5 sm:p-3 shadow-2xs" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold block" style={{ color: '#64748b' }}>Base Installment</span>
            <span className="font-extrabold font-mono text-xs sm:text-sm mt-0.5 block" style={{ color: '#0f172a' }}>
              {formatCurrency(monthlyInstallment)} / member
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: NEXT MONTH LAABA SEETU / BONUS NOTIFICATION BANNER ─ */}
      {data.isNextMonthLaabaSeetu ? (
        <div 
          className="pdf-section rounded-2xl p-3.5 sm:p-5 shadow-xs"
          style={{ backgroundColor: '#fefce8', border: '2px solid #f59e0b', color: '#78350f' }}
        >
          <div className="flex items-start gap-2.5 sm:gap-3.5">
            <div 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
              style={{ backgroundColor: '#f59e0b', color: '#ffffff' }}
            >
              <Sparkles size={18} />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span 
                  className="px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-md"
                  style={{ backgroundColor: '#d97706', color: '#ffffff' }}
                >
                  Bonus Profit Triggered
                </span>
                <h2 className="text-xs sm:text-base font-black" style={{ color: '#451a03' }}>
                  🎉 NEXT MONTH (MONTH {nextMonthNum}) IS LAABA SEETU (லாப சீட்டு)!
                </h2>
              </div>
              <p className="text-[11px] sm:text-xs leading-relaxed font-medium" style={{ color: '#78350f' }}>
                The accumulated discount pool has reached <strong>{formatCurrency(data.newPool)}</strong> (exceeding the ₹{data.totalValue.toLocaleString('en-IN')} chit value). In Month {nextMonthNum}, <strong>all subscribers pay ₹0 monthly installment</strong>. The monthly prize pot will be completely funded by the accumulated discount pool!
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div 
          className="pdf-section rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
          style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
        >
          <div className="flex items-center gap-2">
            <Coins size={15} className="text-indigo-600 shrink-0" />
            <div>
              <span className="font-extrabold text-gray-900 block text-[11px] sm:text-xs" style={{ color: '#0f172a' }}>
                Accumulated Kai Iruppu Discount Pool: {formatCurrency(data.newPool)}
              </span>
              <span className="text-[10px] sm:text-[11px]" style={{ color: '#64748b' }}>
                {Math.round((data.newPool / data.totalValue) * 100)}% toward next Laaba Seetu free month (₹{Math.max(0, data.totalValue - data.newPool).toLocaleString('en-IN')} remaining)
              </span>
            </div>
          </div>
          <span 
            className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold font-mono self-start sm:self-auto"
            style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#334155' }}
          >
            Month {nextMonthNum} Due: {formatCurrency(monthlyInstallment)}
          </span>
        </div>
      )}

      {/* ── SECTION 3: WINNER & FINANCIAL SETTLEMENT BREAKDOWN ───────────── */}
      <div 
        className="pdf-section rounded-2xl p-3.5 sm:p-5 shadow-2xs space-y-3 sm:space-y-4"
        style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
      >
        <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <Trophy size={16} className="text-amber-500" />
          <h3 className="text-xs sm:text-sm font-black" style={{ color: '#0f172a' }}>
            Official Winner Declaration &amp; Settlement Figures
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
          {/* Winner Identity */}
          <div className="p-3 sm:p-4 rounded-xl space-y-1" style={{ backgroundColor: '#eef2ff', border: '1px solid #e0e7ff' }}>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block" style={{ color: '#4338ca' }}>
              Concluded Winner
            </span>
            <div className="text-xs sm:text-sm font-black truncate" style={{ color: '#1e1b4b' }}>
              {data.winnerName}
            </div>
            {data.winnerTicket && (
              <span 
                className="inline-block px-2 py-0.5 rounded-md font-mono text-[9px] sm:text-[10px] font-bold"
                style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}
              >
                Ticket #{data.winnerTicket}
              </span>
            )}
          </div>

          {/* Discount Surrendered */}
          <div className="p-3 sm:p-4 rounded-xl space-y-1" style={{ backgroundColor: '#fff1f2', border: '1px solid #ffe4e6' }}>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block" style={{ color: '#be123c' }}>
              Winning Discount Bid
            </span>
            <div className="text-sm sm:text-base font-black font-mono" style={{ color: '#e11d48' }}>
              -{formatCurrency(data.winningDiscount)}
            </div>
            <span className="text-[9px] sm:text-[10px] block" style={{ color: '#64748b' }}>
              Forfeited to Kai Iruppu Pool
            </span>
          </div>

          {/* Net Prize Pot Take-Home Payout */}
          <div className="p-3 sm:p-4 rounded-xl space-y-1" style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block" style={{ color: '#047857' }}>
              Net Take-Home Payout
            </span>
            <div className="text-base sm:text-lg font-black font-mono" style={{ color: '#065f46' }}>
              {formatCurrency(data.netPayout)}
            </div>
            <span className="text-[9px] sm:text-[10px] font-semibold block" style={{ color: '#047857' }}>
              {data.disbursalStatus === 'fully_disbursed' ? '✓ Fully Disbursed' : 'Prize Pot Disbursement Due'}
            </span>
          </div>
        </div>

        {/* Financial Flow Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-1 text-[10px] sm:text-[11px]" style={{ borderTop: '1px solid #f1f5f9' }}>
          <div className="p-2 sm:p-2.5 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <span className="font-medium block" style={{ color: '#94a3b8' }}>Total Chit Pot</span>
            <span className="font-extrabold font-mono" style={{ color: '#0f172a' }}>{formatCurrency(data.totalValue)}</span>
          </div>
          <div className="p-2 sm:p-2.5 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <span className="font-medium block" style={{ color: '#94a3b8' }}>Winning Discount</span>
            <span className="font-extrabold font-mono" style={{ color: '#e11d48' }}>-{formatCurrency(data.winningDiscount)}</span>
          </div>
          <div className="p-2 sm:p-2.5 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <span className="font-medium block" style={{ color: '#94a3b8' }}>Kai Iruppu Credited</span>
            <span className="font-extrabold font-mono" style={{ color: '#b45309' }}>+{formatCurrency(data.winningDiscount)}</span>
          </div>
          <div className="p-2 sm:p-2.5 rounded-lg" style={{ backgroundColor: '#f8fafc' }}>
            <span className="font-medium block" style={{ color: '#94a3b8' }}>Closing Pool</span>
            <span className="font-extrabold font-mono" style={{ color: '#4338ca' }}>{formatCurrency(data.newPool)}</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: ATTENDANCE & ROLL CALL SNAPSHOT (If available) ───── */}
      {data.attendingMembers && data.attendingMembers.length > 0 && (
        <div 
          className="pdf-section rounded-2xl p-3.5 sm:p-5 shadow-2xs space-y-2.5 sm:space-y-3"
          style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <div className="flex items-center gap-2">
              <Users size={15} className="text-indigo-600" />
              <h3 className="text-xs sm:text-sm font-black" style={{ color: '#0f172a' }}>
                Session Attendance &amp; Roll Call Registry
              </h3>
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold font-mono" style={{ color: '#64748b' }}>
              {data.attendingMembers.filter(m => m.attended).length} / {data.attendingMembers.length} Attending
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-xs">
            {data.attendingMembers.map((m) => (
              <div 
                key={m.ticketNumber} 
                className="p-1.5 sm:p-2 rounded-lg flex items-center justify-between text-[10px] sm:text-[11px]"
                style={{
                  backgroundColor: m.attended ? '#eef2ff' : '#f8fafc',
                  border: `1px solid ${m.attended ? '#c7d2fe' : '#e2e8f0'}`,
                  color: m.attended ? '#1e1b4b' : '#94a3b8',
                  fontWeight: m.attended ? '600' : 'normal',
                }}
              >
                <span className="truncate">#{m.ticketNumber} {m.fullName}</span>
                <span 
                  className="text-[8px] sm:text-[9px] font-bold px-1 py-0.2 rounded shrink-0 ml-1"
                  style={{
                    backgroundColor: m.attended ? '#4f46e5' : '#e2e8f0',
                    color: m.attended ? '#ffffff' : '#64748b',
                  }}
                >
                  {m.attended ? 'Present' : 'Saving'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 5: COMPLETE CHRONOLOGICAL LIVE BIDDING TIMELINE ────────────── */}
      <div 
        className="pdf-section rounded-2xl p-3.5 sm:p-5 shadow-2xs space-y-3"
        style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}
      >
        <div className="flex items-center justify-between pb-2.5" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-600" />
            <div>
              <h3 className="text-xs sm:text-sm font-black" style={{ color: '#0f172a' }}>
                Live Bidding Shouts Timeline &amp; Timestamp Audit Trail
              </h3>
              <p className="text-[10px] mt-0.5" style={{ color: '#94a3b8' }}>
                Sequential live progression from opening bid to winning discount shout
              </p>
            </div>
          </div>
          <span 
            className="text-[10px] sm:text-[11px] font-bold font-mono px-2.5 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}
          >
            {chronologicalBids.length} {chronologicalBids.length === 1 ? 'Shout' : 'Shouts'}
          </span>
        </div>

        {chronologicalBids.length === 0 ? (
          <div className="py-6 text-center text-xs italic" style={{ color: '#94a3b8' }}>
            No live bidding shouts were recorded during this auction cycle.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr 
                  className="text-[9px] sm:text-[10px] uppercase font-bold"
                  style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}
                >
                  <th className="py-2.5 px-2 text-center w-7">#</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Time</th>
                  <th className="py-2.5 px-2.5">Subscriber</th>
                  <th className="py-2.5 px-2 text-center">Ticket</th>
                  <th className="py-2.5 px-2.5 text-right">Discount Bid</th>
                  <th className="py-2.5 px-2.5 text-right">Jump</th>
                  <th className="py-2.5 px-2.5 text-right">Resulting Net Pot</th>
                </tr>
              </thead>
              <tbody className="text-[10px] sm:text-[11px]" style={{ borderCollapse: 'collapse' }}>
                {chronologicalBids.map((bid, idx) => {
                  const prevBid = idx > 0 ? chronologicalBids[idx - 1] : null;
                  const jump = prevBid ? bid.amount - prevBid.amount : 0;
                  const resultingPot = Math.max(0, data.totalValue - bid.amount);
                  const isWinningBid = idx === chronologicalBids.length - 1;
                  const timeDisplay = formatBidTime(bid.timestamp);

                  return (
                    <tr 
                      key={bid.id || idx}
                      style={{
                        backgroundColor: isWinningBid ? '#ecfdf5' : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: isWinningBid ? '4px solid #059669' : 'none',
                      }}
                    >
                      <td className="py-2.5 px-2 font-mono text-center">
                        <span 
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold"
                          style={{
                            backgroundColor: isWinningBid ? '#059669' : '#f1f5f9',
                            color: isWinningBid ? '#ffffff' : '#475569',
                          }}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 font-mono whitespace-nowrap" style={{ color: '#64748b' }}>
                        {timeDisplay}
                      </td>
                      <td className="py-2.5 px-2.5 font-semibold" style={{ color: '#0f172a' }}>
                        <div className="flex items-center gap-1.5">
                          {isWinningBid && <Trophy size={13} className="text-amber-500 shrink-0" />}
                          <span className="truncate max-w-[140px] sm:max-w-none">{bid.memberName}</span>
                          {isWinningBid && (
                            <span 
                              className="text-[8px] uppercase tracking-wider px-1.5 py-0.2 rounded font-black shrink-0"
                              style={{ backgroundColor: '#059669', color: '#ffffff' }}
                            >
                              Winner
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono font-bold text-center" style={{ color: '#4338ca' }}>
                        #{bid.ticketNumber}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-extrabold" style={{ color: '#e11d48' }}>
                        {formatCurrency(bid.amount)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono">
                        {jump > 0 ? (
                          <span className="inline-flex items-center gap-0.5 font-bold" style={{ color: '#4338ca' }}>
                            <ArrowUpRight size={10} />
                            +{formatCurrency(jump)}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Opening</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono font-black" style={{ color: '#065f46' }}>
                        {formatCurrency(resultingPot)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION 6: AUTHENTICATION FOOTER & SIGN-OFF ─────────────────── */}
      <div 
        className="pdf-section pt-3 sm:pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 text-[9px] sm:text-[10px]"
        style={{ borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}
      >
        <div>
          <p className="font-bold" style={{ color: '#334155' }}>{data.organizerName} — Administration Office</p>
          <p>Generated on {new Date().toLocaleDateString('en-GB')}, {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-bold" style={{ color: '#334155' }}>Certified Official Ledger Record</p>
          <p>Recorded to Supabase PostgreSQL Immutable Audit Ledger</p>
        </div>
      </div>

    </div>
  );
}
