'use client';

import React from 'react';
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
  Phone
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
  organizerName: string;
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
  const formattedDate = concludedDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = concludedDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const nextMonthNum = data.month + 1;

  return (
    <div id={id} className="bg-white text-gray-900 p-6 sm:p-8 space-y-6 max-w-4xl mx-auto font-sans">
      
      {/* ── SECTION 1: OFFICIAL REPORT HEADER BANNER ────────────────────── */}
      <div className="pdf-section border border-gray-200 rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-black text-sm">
                CF
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  {data.organizerName}
                </h1>
                <p className="text-[10px] text-gray-300 font-medium">
                  Official Live Auction Audit Certificate &amp; Settlement Statement
                </p>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-0.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold font-mono">
              <CheckCircle2 size={12} /> Auction Concluded &amp; Sealed
            </span>
            <p className="text-[11px] text-gray-300 font-mono">
              {formattedDate} • {formattedTime}
            </p>
          </div>
        </div>

        {/* Group Context Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Chit Group</span>
            <span className="font-extrabold text-white text-sm mt-0.5 block truncate">{data.groupName}</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Auction Cycle</span>
            <span className="font-extrabold text-white text-sm mt-0.5 block">
              Month {data.month} of {data.durationMonths}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Chit Pot</span>
            <span className="font-extrabold text-amber-300 font-mono text-sm mt-0.5 block">
              {formatCurrency(data.totalValue)}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Base Installment</span>
            <span className="font-extrabold text-white font-mono text-sm mt-0.5 block">
              {formatCurrency(monthlyInstallment)} / member
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: NEXT MONTH LAABA SEETU / BONUS NOTIFICATION BANNER ─ */}
      {data.isNextMonthLaabaSeetu ? (
        <div className="pdf-section border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100/70 rounded-2xl p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles size={20} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider rounded-md">
                  Bonus Profit Triggered
                </span>
                <h2 className="text-sm sm:text-base font-black text-amber-950">
                  🎉 NEXT MONTH (MONTH {nextMonthNum}) IS LAABA SEETU (லாப சீட்டு)!
                </h2>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                The accumulated discount pool has reached <strong>{formatCurrency(data.newPool)}</strong> (exceeding the ₹{data.totalValue.toLocaleString('en-IN')} chit value). In Month {nextMonthNum}, <strong>all subscribers pay ₹0 monthly installment</strong>. The monthly prize pot will be completely funded by the accumulated discount pool!
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="pdf-section border border-gray-200 bg-slate-50/70 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Coins size={16} className="text-indigo-600 shrink-0" />
            <div>
              <span className="font-extrabold text-gray-900 block">
                Accumulated Kai Iruppu Discount Pool: {formatCurrency(data.newPool)}
              </span>
              <span className="text-[11px] text-gray-500">
                {Math.round((data.newPool / data.totalValue) * 100)}% toward next Laaba Seetu free month (₹{Math.max(0, data.totalValue - data.newPool).toLocaleString('en-IN')} remaining)
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-[11px] font-bold font-mono text-gray-700">
            Month {nextMonthNum} Due: {formatCurrency(monthlyInstallment)}
          </span>
        </div>
      )}

      {/* ── SECTION 3: WINNER & FINANCIAL SETTLEMENT BREAKDOWN ───────────── */}
      <div className="pdf-section border border-gray-200 rounded-2xl p-5 bg-white shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="text-sm font-black text-gray-900">
            Official Winner Declaration &amp; Settlement Figures
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Winner Identity */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
              Concluded Winner
            </span>
            <div className="text-sm font-black text-gray-900 truncate">
              {data.winnerName}
            </div>
            {data.winnerTicket && (
              <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-[10px] font-bold">
                Ticket #{data.winnerTicket}
              </span>
            )}
          </div>

          {/* Discount Surrendered */}
          <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
              Winning Discount Bid
            </span>
            <div className="text-base font-black font-mono text-rose-600">
              -{formatCurrency(data.winningDiscount)}
            </div>
            <span className="text-[10px] text-gray-500 block">
              Forfeited to Kai Iruppu Pool
            </span>
          </div>

          {/* Net Prize Pot Take-Home Payout */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
              Net Take-Home Payout
            </span>
            <div className="text-lg font-black font-mono text-emerald-700">
              {formatCurrency(data.netPayout)}
            </div>
            <span className="text-[10px] text-emerald-800 font-semibold block">
              {data.disbursalStatus === 'fully_disbursed' ? '✓ Fully Disbursed' : 'Prize Pot Disbursement Due'}
            </span>
          </div>
        </div>

        {/* Financial Flow Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-[11px] border-t border-gray-100">
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <span className="text-gray-400 font-medium block">Total Chit Pot</span>
            <span className="font-extrabold text-gray-900 font-mono">{formatCurrency(data.totalValue)}</span>
          </div>
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <span className="text-gray-400 font-medium block">Winning Discount</span>
            <span className="font-extrabold text-rose-600 font-mono">-{formatCurrency(data.winningDiscount)}</span>
          </div>
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <span className="text-gray-400 font-medium block">Kai Iruppu Credited</span>
            <span className="font-extrabold text-amber-700 font-mono">+{formatCurrency(data.winningDiscount)}</span>
          </div>
          <div className="p-2.5 bg-gray-50 rounded-lg">
            <span className="text-gray-400 font-medium block">Closing Pool</span>
            <span className="font-extrabold text-indigo-700 font-mono">{formatCurrency(data.newPool)}</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: ATTENDANCE & ROLL CALL SNAPSHOT (If available) ───── */}
      {data.attendingMembers && data.attendingMembers.length > 0 && (
        <div className="pdf-section border border-gray-200 rounded-2xl p-5 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              <h3 className="text-xs sm:text-sm font-black text-gray-900">
                Session Attendance &amp; Roll Call Registry
              </h3>
            </div>
            <span className="text-[11px] font-bold text-gray-500 font-mono">
              {data.attendingMembers.filter(m => m.attended).length} / {data.attendingMembers.length} Attending
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {data.attendingMembers.map((m) => (
              <div 
                key={m.ticketNumber} 
                className={`p-2 rounded-lg border flex items-center justify-between text-[11px] ${
                  m.attended ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-semibold' : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                <span className="truncate">#{m.ticketNumber} {m.fullName}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${m.attended ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {m.attended ? 'Present' : 'Saving'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 5: COMPLETE LIVE BIDDING TIMELINE STREAM ────────────── */}
      <div className="pdf-section border border-gray-200 rounded-2xl p-5 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-600" />
            <h3 className="text-xs sm:text-sm font-black text-gray-900">
              Live Bidding Shouts Timeline &amp; Timestamp Audit Trail
            </h3>
          </div>
          <span className="text-[11px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {data.bidStream.length} Total {data.bidStream.length === 1 ? 'Bid' : 'Bids'} Logged
          </span>
        </div>

        {data.bidStream.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-xs italic">
            No live bidding shouts were recorded during this auction cycle.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-[10px] uppercase font-bold text-gray-500">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Subscriber</th>
                  <th className="py-2.5 px-3">Ticket</th>
                  <th className="py-2.5 px-3 text-right">Discount Bid</th>
                  <th className="py-2.5 px-3 text-right">Jump</th>
                  <th className="py-2.5 px-3 text-right">Resulting Net Pot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[11px]">
                {data.bidStream.map((bid, idx) => {
                  const prevBid = idx > 0 ? data.bidStream[idx - 1] : null;
                  const jump = prevBid ? bid.amount - prevBid.amount : 0;
                  const resultingPot = Math.max(0, data.totalValue - bid.amount);
                  const isWinningBid = idx === data.bidStream.length - 1;

                  let timeStr = '—';
                  try {
                    const d = new Date(bid.timestamp);
                    if (!isNaN(d.getTime())) {
                      timeStr = d.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      });
                    }
                  } catch {}

                  return (
                    <tr 
                      key={bid.id || idx}
                      className={isWinningBid ? 'bg-emerald-50/70 font-bold' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                    >
                      <td className="py-2 px-3 font-mono text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-mono text-gray-500">
                        {timeStr}
                      </td>
                      <td className="py-2 px-3 text-gray-900 font-semibold">
                        <div className="flex items-center gap-1.5">
                          {isWinningBid && <Trophy size={12} className="text-amber-500 shrink-0" />}
                          <span>{bid.memberName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-indigo-700 font-bold">
                        #{bid.ticketNumber}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-extrabold text-rose-600">
                        {formatCurrency(bid.amount)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-gray-500">
                        {jump > 0 ? `+${formatCurrency(jump)}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-emerald-700">
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
      <div className="pdf-section border-t border-gray-200 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[10px] text-gray-400">
        <div>
          <p className="font-bold text-gray-700">{data.organizerName} — Administration Office</p>
          <p>Generated on {new Date().toLocaleDateString('en-GB')}, {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-bold text-gray-700">Certified Official Ledger Record</p>
          <p>Recorded to Supabase PostgreSQL Immutable Audit Ledger</p>
        </div>
      </div>

    </div>
  );
}
