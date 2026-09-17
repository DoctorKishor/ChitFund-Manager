'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Undo2, 
  Gavel, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Coins, 
  Calendar,
  Sparkles,
  ArrowRight,
  X,
  Lock,
  Zap
} from 'lucide-react';

interface Member {
  id: string;
  fullName: string;
  ticketNumber: number;
  hasWonRegular: boolean;
}

interface Bid {
  id: string;
  memberId: string;
  memberName: string;
  ticketNumber: number;
  amount: number;
  timestamp: string;
}

interface ChitGroup {
  name: string;
  totalValue: number;
  memberCount: number;
  currentMonth: number;
  durationMonths: number;
  kai_iruppu_pool: number;
}

// ── Utility: First Sunday on-or-after the 10th ──────────────────────────────
function getFirstSundayOnOrAfter10th(year: number, month: number): Date {
  const d = new Date(year, month, 10);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  return d;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function LiveAuctionEngine() {
  // 1. Initial State Data
  const [group, setGroup] = useState<ChitGroup>({
    name: 'G-Elite-Weekly-301',
    totalValue: 100000,
    memberCount: 10,
    currentMonth: 4,
    durationMonths: 20,
    kai_iruppu_pool: 60000, // Starts accumulated at ₹60,000 for demonstration
  });

  const [members, setMembers] = useState<Member[]>([
    { id: 'm1', fullName: 'Ramesh Kumar (Dad)', ticketNumber: 1, hasWonRegular: true },
    { id: 'm2', fullName: 'Geetha Kumar (Mom)', ticketNumber: 2, hasWonRegular: false },
    { id: 'm3', fullName: 'Priya Subramanian', ticketNumber: 3, hasWonRegular: false },
    { id: 'm4', fullName: 'Balaji Srinivasan', ticketNumber: 4, hasWonRegular: false },
    { id: 'm5', fullName: 'Kishor (Admin)', ticketNumber: 5, hasWonRegular: false },
    { id: 'm6', fullName: 'Rajesh Nair', ticketNumber: 6, hasWonRegular: true },
    { id: 'm7', fullName: 'Ananya Sen', ticketNumber: 7, hasWonRegular: false },
    { id: 'm8', fullName: 'Amit Patel', ticketNumber: 8, hasWonRegular: false },
    { id: 'm9', fullName: 'Divya Nair', ticketNumber: 9, hasWonRegular: false },
    { id: 'm10', fullName: 'Suresh Babu', ticketNumber: 10, hasWonRegular: false },
  ]);

  const [bids, setBids] = useState<Bid[]>([
    { id: 'b2', memberId: 'm4', memberName: 'Balaji Srinivasan', ticketNumber: 4, amount: 35000, timestamp: '03:01:22' },
    { id: 'b1', memberId: 'm3', memberName: 'Priya Subramanian', ticketNumber: 3, amount: 30000, timestamp: '02:58:45' },
  ]);

  const [activeLoggingMemberId, setActiveLoggingMemberId] = useState<string | null>(null);
  const [bidInputVal, setBidInputVal] = useState<string>('');
  
  // Closing Modal States
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);

  // Holiday Month + Next Discount Pool
  const [isHolidayMonth, setIsHolidayMonth] = useState<boolean>(false);
  const [nextDiscountPool, setNextDiscountPool] = useState<number>(0);

  // Auction date override
  const [auctionDateOverride, setAuctionDateOverride] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when open
  useEffect(() => {
    if (activeLoggingMemberId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeLoggingMemberId]);

  // Laaba Seetu triggers if accumulated pool matches or exceeds total chit value (₹1L)
  const isLaabaSeetuActive = group.kai_iruppu_pool >= group.totalValue;

  // Auction date calculation
  const now = new Date();
  const canonicalDate = getFirstSundayOnOrAfter10th(now.getFullYear(), now.getMonth());
  const auctionDateDisplay = auctionDateOverride
    ? fmtDate(new Date(auctionDateOverride)) + ' (Override)'
    : fmtDate(canonicalDate);

  // In a holiday month, bidding is OPEN regardless of Laaba Seetu (pool overflow)
  // The highest bid is compounded forward into nextDiscountPool instead of paying dividends
  const biddingLocked = isLaabaSeetuActive && !isHolidayMonth;

  const highestBid = biddingLocked
    ? 0
    : (bids.length > 0 ? Math.max(...bids.map(b => b.amount)) : 0);
  
  const winningBidObj = biddingLocked ? null : bids.find(b => b.amount === highestBid);
  const winnerName = biddingLocked
    ? 'Company Profit (Laaba Seetu)'
    : (winningBidObj ? winningBidObj.memberName : 'No bids yet');
  const winnerTicket = winningBidObj ? winningBidObj.ticketNumber : null;
  const winnerId = winningBidObj ? winningBidObj.memberId : null;

  // Payout logic depends on holiday vs regular vs Laaba Seetu month
  // Holiday month: no discount — winner receives full pool; high bid compounds to nextDiscountPool
  // Regular month: winner receives pool minus high bid; high bid split as dividends
  // Laaba Seetu (non-holiday): locked, entire pool to company profit
  const netPayout = biddingLocked
    ? 0
    : isHolidayMonth
      ? group.totalValue // full pool out — no discount applied this month
      : (group.totalValue - highestBid);

  const totalDividend = (biddingLocked || isHolidayMonth) ? 0 : highestBid;
  const dividendPerMember = totalDividend / (group.memberCount - 1);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // 3. User Actions
  const handleCardClick = (memberId: string, hasWon: boolean) => {
    if (hasWon || biddingLocked) return;
    setActiveLoggingMemberId(memberId);
    const currentMax = bids.length > 0 ? bids[0].amount : 25000;
    setBidInputVal((currentMax + 1000).toString());
  };

  const handleLogBid = (e: React.FormEvent, memberId: string) => {
    e.preventDefault();
    if (biddingLocked) return;

    const bidAmount = Number(bidInputVal);
    const member = members.find(m => m.id === memberId);
    
    if (isNaN(bidAmount) || bidAmount <= 0 || !member) return;
    
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

    const newBid: Bid = {
      id: Math.random().toString(),
      memberId,
      memberName: member.fullName,
      ticketNumber: member.ticketNumber,
      amount: bidAmount,
      timestamp: timeStr
    };

    setBids([newBid, ...bids]);
    setActiveLoggingMemberId(null);
    setBidInputVal('');
  };

  const handleUndo = () => {
    if (bids.length === 0 || biddingLocked) return;
    setBids(bids.slice(1));
  };

  const handleCloseAuction = () => {
    if (!biddingLocked && bids.length === 0) {
      alert("Cannot close auction without any bids recorded.");
      return;
    }
    setShowCloseModal(true);
  };

  const handleConfirmClose = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      setShowConfetti(true);

      if (biddingLocked) {
        // Laaba Seetu (non-holiday): reset accumulated pool, advance month
        setGroup(prev => ({
          ...prev,
          currentMonth: Math.min(prev.durationMonths, prev.currentMonth + 1),
          kai_iruppu_pool: 0
        }));
      } else if (isHolidayMonth) {
        // Holiday month: compound high bid into next discount pool, advance month
        setNextDiscountPool(prev => prev + highestBid);
        setGroup(prev => ({
          ...prev,
          currentMonth: Math.min(prev.durationMonths, prev.currentMonth + 1)
        }));
        // No winner flagged — bidding was for compounding purposes
      } else {
        // Regular month: mark winner, advance month
        if (winnerId) {
          setMembers(prev => prev.map(m => m.id === winnerId ? { ...m, hasWonRegular: true } : m));
        }
        setGroup(prev => ({
          ...prev,
          currentMonth: Math.min(prev.durationMonths, prev.currentMonth + 1)
        }));
      }
      setBids([]);

      setTimeout(() => {
        setShowConfetti(false);
        setShowCloseModal(false);
      }, 3000);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {/* Session Lifecycle Dashboard */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`h-2 w-2 rounded-full ${
                biddingLocked ? 'bg-indigo-500 animate-ping'
                : isHolidayMonth ? 'bg-amber-500 animate-pulse'
                : 'bg-red-500 animate-pulse'
              }`}></span>
              <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded ${
                biddingLocked
                  ? 'text-indigo-600 bg-indigo-50 border-indigo-200'
                  : isHolidayMonth
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-red-700 bg-red-50 border-red-200'
              }`}>
                {biddingLocked ? 'Laaba Seetu Session' : isHolidayMonth ? 'Holiday Month — Bid Compounds Forward' : 'Live Bidding Room'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight mt-1">
              {group.name} - Lifecycle Dashboard
            </h2>
            {/* Auction Date */}
            <div className="flex items-center gap-2 mt-1">
              <Calendar size={12} className="text-gray-400" />
              <span className="text-[11px] text-gray-500">Auction: <span className={`font-semibold ${auctionDateOverride ? 'text-amber-600' : 'text-gray-700'}`}>{auctionDateDisplay}</span></span>
              <button
                onClick={() => setShowDatePicker(v => !v)}
                className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors"
              >
                Reschedule
              </button>
              {auctionDateOverride && (
                <button
                  onClick={() => { setAuctionDateOverride(null); setShowDatePicker(false); }}
                  className="text-[9px] font-bold text-red-600 border border-red-150 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {showDatePicker && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-indigo-500"
                  onChange={(e) => { setAuctionDateOverride(e.target.value || null); setShowDatePicker(false); }}
                />
                <button onClick={() => setShowDatePicker(false)} className="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Holiday Month Toggle */}
            <button
              onClick={() => setIsHolidayMonth(v => !v)}
              className={`font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 border transition-all duration-200 ${
                isHolidayMonth
                  ? 'bg-amber-50 border-amber-200 text-amber-700 font-extrabold'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              <Zap size={13} />
              {isHolidayMonth ? 'Holiday Month ON' : 'Holiday Month OFF'}
            </button>
            <button
              onClick={handleCloseAuction}
              disabled={!biddingLocked && bids.length === 0}
              className="font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all duration-200 bg-gray-900 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
              {biddingLocked ? 'Process Laaba Seetu Closeout' : isHolidayMonth ? 'Compound Bid & Close Month' : 'Close Auction & Record Winner'}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-5 border-t border-gray-100 pt-4">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-150">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Current Month</span>
            <span className="text-lg font-bold text-gray-900 mt-1 block">Month {group.currentMonth} of {group.durationMonths}</span>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-150">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Chit Value (Pool)</span>
            <span className="text-lg font-bold text-gray-900 mt-1 block">{formatCurrency(group.totalValue)}</span>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-150">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Running Highest Bid</span>
            <span className="text-lg font-bold text-indigo-600 mt-1 block flex items-center gap-1.5">
              <TrendingUp size={16} />
              {biddingLocked ? '₹0 (Laaba Seetu)' : formatCurrency(highestBid)}
            </span>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-150">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Winner Payout</span>
            <span className="text-lg font-bold text-green-700 mt-1 block">
              {biddingLocked ? '₹0 (Laaba Seetu)' : formatCurrency(netPayout)}
            </span>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-150">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Accumulated Pool</span>
            <span className="text-lg font-bold text-amber-600 mt-1 block flex items-center gap-1.5">
              <Coins size={16} />
              {formatCurrency(group.kai_iruppu_pool)}
            </span>
          </div>

          <div className={`p-3 rounded-lg border ${
            nextDiscountPool > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-150'
          }`}>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Next Discount Pool</span>
            <span className={`text-lg font-bold mt-1 block flex items-center gap-1.5 ${
              nextDiscountPool > 0 ? 'text-amber-600' : 'text-gray-400'
            }`}>
              <Sparkles size={14} />
              {nextDiscountPool > 0 ? formatCurrency(nextDiscountPool) : '—'}
            </span>
          </div>
        </div>

        {/* Dynamic Simulation Pool Adjuster Widget */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 border border-gray-150 rounded-lg p-3 mt-4">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-gray-500">Simulate Accumulated Pool (₹):</span>
            <input 
              type="number"
              value={group.kai_iruppu_pool}
              onChange={(e) => setGroup(prev => ({ ...prev, kai_iruppu_pool: Number(e.target.value) }))}
              className="w-28 bg-white border border-gray-250 rounded px-2.5 py-1 text-xs text-gray-950 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setGroup(prev => ({ ...prev, kai_iruppu_pool: 60000 }))}
              className="bg-white hover:bg-gray-105 text-gray-700 font-bold text-[10px] px-3 py-1.5 rounded transition-all border border-gray-200"
            >
              Reset to ₹60K (Regular Mode)
            </button>
            <button 
              onClick={() => setNextDiscountPool(0)}
              className="bg-white hover:bg-gray-105 text-gray-700 font-bold text-[10px] px-3 py-1.5 rounded transition-all border border-gray-200"
            >
              Clear Discount Pool
            </button>
            <button 
              onClick={() => setGroup(prev => ({ ...prev, kai_iruppu_pool: prev.totalValue }))}
              className="bg-gray-900 hover:bg-black text-white font-bold text-[10px] px-3.5 py-1.5 rounded flex items-center gap-1 shadow-sm transition-all"
            >
              <Zap size={12} />
              Trigger Laaba Seetu (Set ₹1,00,000)
            </button>
          </div>
        </div>
      </div>

      {/* Split Work Space Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* 1. Left Pane (Member Selection Matrix) */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5 space-y-4 relative shadow-sm">
          
          {/* Overlay Banner: only show if bidding is locked (Laaba Seetu + not holiday month) */}
          {biddingLocked && (
            <div className="absolute inset-0 bg-white/90 rounded-xl z-20 flex flex-col items-center justify-center p-6 text-center space-y-3 backdrop-blur-[1px]">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center animate-bounce">
                <Lock size={20} />
              </div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Bidding Mechanics Disabled</h3>
              <p className="text-xs text-gray-500 max-w-[280px]">
                The accumulated pool of <strong className="text-amber-600">{formatCurrency(group.kai_iruppu_pool)}</strong> matches or exceeds the total monthly chit value of <strong className="text-indigo-600">{formatCurrency(group.totalValue)}</strong>, locking this session as <strong>Laaba Seetu</strong>.
                <br /><span className="text-indigo-600 text-[10px] mt-1 block">Toggle "Holiday Month" above to keep bidding open and compound the bid forward instead.</span>
              </p>
            </div>
          )}

          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <User size={16} className="text-indigo-600" />
              Member Selection Matrix
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {biddingLocked
                ? 'Bidding locked — Laaba Seetu. Toggle Holiday Month to re-enable.'
                : isHolidayMonth
                  ? 'Holiday Month: bids compound into next discount pool. No dividends paid.'
                  : 'Click an eligible member below to log a shouted bid instantly'}
            </p>
          </div>

          {/* Grid of Member Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map((member) => {
              const isLogging = activeLoggingMemberId === member.id;
              const hasWon = member.hasWonRegular;

              return (
                <div
                  key={member.id}
                  onClick={() => !isLogging && handleCardClick(member.id, hasWon)}
                  className={`relative rounded-xl p-4 border transition-all duration-200 overflow-hidden ${
                    hasWon 
                      ? 'bg-gray-50 border-gray-100 opacity-40 cursor-not-allowed'
                      : isLogging
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500/20'
                        : biddingLocked
                          ? 'bg-gray-50 border-gray-100 opacity-40 cursor-not-allowed'
                          : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 cursor-pointer shadow-sm'
                  }`}
                >
                  {!isLogging ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          hasWon ? 'bg-gray-200 text-gray-400' : 'bg-gray-50 text-indigo-600 border border-gray-200'
                        }`}>
                          {member.fullName.charAt(0)}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-xs font-bold text-gray-900 truncate">{member.fullName}</span>
                          <span className="text-[10px] text-gray-500 mt-0.5">Ticket #{member.ticketNumber}</span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {hasWon ? (
                          <span className="bg-gray-100 text-gray-400 border border-gray-250 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                            Already Won
                          </span>
                        ) : (
                          <span className="bg-green-50 text-green-700 border border-green-200 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                            Eligible
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form 
                      onSubmit={(e) => handleLogBid(e, member.id)} 
                      onClick={(e) => e.stopPropagation()} 
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase">Log Bid for Ticket #{member.ticketNumber}</span>
                        <button 
                          type="button" 
                          onClick={() => setActiveLoggingMemberId(null)}
                          className="text-gray-400 hover:text-gray-600 p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1 text-xs text-gray-400 font-bold">₹</span>
                          <input
                            ref={inputRef}
                            type="number"
                            placeholder="Amount"
                            value={bidInputVal}
                            onChange={(e) => setBidInputVal(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-6 py-1 text-xs font-semibold text-gray-900 focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1 rounded transition-colors duration-150 shrink-0"
                        >
                          Enter
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Right Pane (Bidding Timeline Feed) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between relative shadow-sm">
          
          <div className="space-y-4">
            
            {/* Header with Undo Button */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Gavel size={16} className="text-indigo-600" />
                Bidding Timeline
              </h3>
              
              <button
                onClick={handleUndo}
                disabled={bids.length === 0 || biddingLocked}
                className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-200 hover:border-gray-250 text-gray-700 text-[10px] font-bold px-2.5 py-1.5 rounded transition-all duration-150"
              >
                <Undo2 size={12} />
                Undo Last Entry
              </button>
            </div>

            {/* Scrollable Timeline Stream */}
            <div className="space-y-3 min-h-[360px] max-h-[420px] overflow-y-auto pr-2">
              {bids.length === 0 ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 space-y-2 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <Gavel size={32} className="text-gray-300 animate-pulse" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Awaiting Bid Session</p>
                  <p className="text-[10px] text-gray-400 max-w-[180px] text-center">Click member spots on the left matrix to begin logging bids.</p>
                </div>
              ) : (
                bids.map((bid, index) => {
                  const isTopBid = index === 0;

                  return (
                    <div 
                      key={bid.id} 
                      className={`flex justify-between items-center p-3 rounded-lg border transition-all duration-200 ${
                        isTopBid 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm' 
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 overflow-hidden mr-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isTopBid ? 'bg-indigo-600 animate-pulse' : 'bg-gray-400'}`}></span>
                        <div className="flex flex-col overflow-hidden">
                          <span className={`text-xs font-semibold truncate ${isTopBid ? 'text-indigo-900' : 'text-gray-700'}`}>
                            {bid.memberName}
                          </span>
                          <span className="text-[9px] text-gray-400 mt-0.5">Ticket #{bid.ticketNumber}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <span className="text-[9px] font-mono text-gray-400 font-semibold">{bid.timestamp}</span>
                        <span className={`text-xs font-extrabold ${isTopBid ? 'text-indigo-600' : 'text-gray-650'}`}>
                          {formatCurrency(bid.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Session Closing Summary Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative overflow-hidden">
            
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none bg-indigo-50/50 flex items-center justify-center">
                <div className="text-center space-y-2 animate-bounce">
                  <Sparkles className="text-indigo-600 mx-auto" size={42} />
                  <p className="text-sm font-bold text-gray-900">
                    {isLaabaSeetuActive ? 'Laaba Seetu Profit Recorded!' : 'Chit Group Updated Successfully!'}
                  </p>
                </div>
              </div>
            )}

            {!showConfetti && (
              <>
                <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div className="flex items-center space-x-2.5">
                    <Calendar className="text-indigo-600" size={20} />
                    <h3 className="text-base font-bold text-gray-900">
                      {biddingLocked ? 'Laaba Seetu Closeout' : isHolidayMonth ? 'Holiday Month — Compound & Close' : 'Record Auction Winner'} - Month {group.currentMonth}
                    </h3>
                  </div>
                  <button 
                    onClick={() => !isRecording && setShowCloseModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Details Sheet */}
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Recipient/Allocation</span>
                      <span className="font-bold text-gray-900 flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-indigo-600" />
                        {biddingLocked ? 'Company Profit (Laaba Seetu)' : isHolidayMonth ? 'Full Pool to Winner (No Dividend)' : winnerName}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-2.5">
                      <span className="text-gray-500">Winning Discount Bid</span>
                      <span className="font-bold text-indigo-600">
                        {biddingLocked ? 'N/A (Bidding Locked)' : formatCurrency(highestBid)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-2.5">
                      <span className="text-gray-500">Net Cash Payout to Member</span>
                      <span className="font-bold text-green-600">{formatCurrency(netPayout)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-2.5">
                      <span className="text-gray-500">Dividend per Subscriber</span>
                      <span className="font-bold text-gray-700">
                        {isHolidayMonth ? 'N/A (Holiday — Bid Compounds)' : formatCurrency(dividendPerMember)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-2.5">
                      <span className="text-gray-500">Locked Company Profit</span>
                      <span className="font-bold text-amber-600">
                        {biddingLocked ? formatCurrency(group.kai_iruppu_pool) : '₹0 (Regular Month)'}
                      </span>
                    </div>

                    {isHolidayMonth && highestBid > 0 && (
                      <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-2.5">
                        <span className="text-gray-500">Compounds into Next Pool</span>
                        <span className="font-bold text-amber-600">{formatCurrency(highestBid)}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3.5 flex items-start space-x-2.5">
                    <AlertCircle className="text-indigo-600 shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-indigo-900 leading-relaxed">
                      {biddingLocked
                        ? `Laaba Seetu month. Entire accumulated pool of ${formatCurrency(group.kai_iruppu_pool)} locked as company profit. Pool resets to ₹0 and group advances to Month ${group.currentMonth + 1}.`
                        : isHolidayMonth
                          ? `Holiday Month: bidding was live. The high bid of ${formatCurrency(highestBid)} will NOT be paid as dividends — it compounds into the Next Discount Pool (current: ${formatCurrency(nextDiscountPool + highestBid)}). The winner receives the full pool of ${formatCurrency(netPayout)}.`
                          : `Recording sets winner to 'Already Won', distributes dividend of ${formatCurrency(dividendPerMember)} to other members, and advances group to Month ${group.currentMonth + 1}.`
                      }
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    disabled={isRecording}
                    className="border border-gray-200 hover:bg-gray-150 text-gray-600 font-bold text-xs px-4 py-2 rounded-lg transition-colors duration-150"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClose}
                    disabled={isRecording}
                    className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2 rounded-lg transition-colors duration-150 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isRecording ? (
                      <>
                        <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Recording...
                      </>
                    ) : (
                      biddingLocked ? 'Lock Profit & Close Month' : isHolidayMonth ? 'Compound Bid & Advance Month' : 'Confirm & Record Winner'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
