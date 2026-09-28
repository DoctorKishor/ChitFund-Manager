'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { 
  Trophy, 
  Crown, 
  Flame, 
  Radio, 
  Sparkles, 
  TrendingUp, 
  ArrowUp, 
  ArrowLeft,
  History, 
  CheckCircle2, 
  Clock, 
  User, 
  Users, 
  Coins, 
  Banknote,
  Gavel,
  Zap,
  Info,
  ChevronRight,
  ShieldCheck,
  Award,
  Eye,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

export interface LiveBidItem {
  id: string;
  memberId: string;
  memberName: string;
  ticketNumber: number;
  amount: number;
  timestamp: string;
}

export interface GroupMemberItem {
  id: string;
  profileId?: string;
  fullName: string;
  ticketNumber: number;
  hasWonRegular: boolean;
}

export interface LiveChitGroupDetails {
  groupId: string;
  groupName: string;
  totalValue: number;
  memberCount: number;
  durationMonths: number;
  currentMonth: number;
  kaiIruppuPool: number;
  ticketNumber: number;
  hasWonRegular: boolean;
  isLiveAuctionActive?: boolean;
  liveAuctionStartedAt?: string | null;
  liveBidStream?: LiveBidItem[];
  members?: GroupMemberItem[];
}

export interface SubscriberLiveAuctionArenaProps {
  group: LiveChitGroupDetails;
  currentUserId?: string;
  isDark?: boolean;
  onExit: () => void;
}

export default function SubscriberLiveAuctionArena({
  group,
  currentUserId,
  isDark = true,
  onExit,
}: SubscriberLiveAuctionArenaProps) {
  const [activeSubTab, setActiveSubTab] = useState<'ranking' | 'feed'>('ranking');
  const [newBidAnimationId, setNewBidAnimationId] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const prevTopBidAmountRef = useRef<number>(0);

  // FLIP animation refs for smooth physical climbing transitions
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevTops = useRef<Map<string, number>>(new Map());
  const [climbingMemberIds, setClimbingMemberIds] = useState<Set<string>>(new Set());

  // Presence channel to broadcast subscriber's viewing presence in real-time
  useEffect(() => {
    if (!group.groupId) return;

    const presenceKey = currentUserId || `sub_${group.ticketNumber}_${Math.random().toString(36).substring(2, 7)}`;
    const presenceChannel = supabase.channel(`live_auction_presence_${group.groupId}`, {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        let subscriberViewers = 0;
        Object.keys(state).forEach((key) => {
          const presences = (state[key] || []) as any[];
          const isSubscriber = presences.some((p) => p.role !== 'admin' && !key.startsWith('admin_'));
          if (isSubscriber) {
            subscriberViewers += 1;
          }
        });
        setViewerCount(Math.max(1, subscriberViewers));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            role: 'subscriber',
            profile_id: currentUserId,
            ticket_number: group.ticketNumber,
            joined_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [group.groupId, currentUserId, group.ticketNumber]);

  const bids: LiveBidItem[] = useMemo(() => {
    return Array.isArray(group.liveBidStream) ? group.liveBidStream : [];
  }, [group.liveBidStream]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Top overall discount bid
  const highestBid = useMemo(() => {
    return bids.length > 0 ? Math.max(...bids.map((b) => b.amount)) : 0;
  }, [bids]);

  const topBidObj = useMemo(() => {
    return bids.find((b) => b.amount === highestBid) || null;
  }, [bids, highestBid]);

  // Net payout = Total Value - Highest Bid
  const netPayout = useMemo(() => {
    return Math.max(0, group.totalValue - highestBid);
  }, [group.totalValue, highestBid]);

  // Accumulated Discount Pool running computation
  const isLaabaSeetuActive = (group.kaiIruppuPool || 0) >= group.totalValue;
  const projectedPool = isLaabaSeetuActive
    ? Math.max(0, group.kaiIruppuPool - group.totalValue) + highestBid
    : (group.kaiIruppuPool || 0) + highestBid;

  const laabaProgress = Math.min(100, Math.round((projectedPool / (group.totalValue || 1)) * 100));

  // Trigger haptic feedback and highlight animation when a new top bid arrives
  useEffect(() => {
    if (highestBid > prevTopBidAmountRef.current && prevTopBidAmountRef.current > 0) {
      triggerHapticFeedback('success');
      if (topBidObj) {
        setNewBidAnimationId(topBidObj.id);
        const timer = setTimeout(() => setNewBidAnimationId(null), 3000);
        return () => clearTimeout(timer);
      }
    }
    prevTopBidAmountRef.current = highestBid;
  }, [highestBid, topBidObj]);

  // Aggregate members ranking:
  const rankedBidders = useMemo(() => {
    const rawMembers: GroupMemberItem[] = group.members && group.members.length > 0
      ? group.members
      : Array.from({ length: group.memberCount || 20 }, (_, i) => ({
          id: `slot-${i + 1}`,
          fullName: `Ticket #${i + 1}`,
          ticketNumber: i + 1,
          hasWonRegular: false,
        }));

    // Filter out previous regular winners (only eligible contenders in this month's auction)
    const contenders = rawMembers.filter((m) => !m.hasWonRegular);

    const membersWithBids = contenders.map((member) => {
      const memberBids = bids.filter(
        (b) => b.memberId === member.id || b.ticketNumber === member.ticketNumber
      );
      const memberHighestBid = memberBids.length > 0 ? Math.max(...memberBids.map((b) => b.amount)) : 0;
      const lastBid = memberBids[0] || null;

      const isCurrentUser = Boolean(
        (currentUserId && member.profileId === currentUserId) ||
        (group.ticketNumber && member.ticketNumber === group.ticketNumber)
      );

      return {
        ...member,
        highestBid: memberHighestBid,
        totalTurns: memberBids.length,
        lastBidTime: lastBid ? lastBid.timestamp : null,
        isCurrentUser,
        isTopBidder: memberHighestBid > 0 && memberHighestBid === highestBid,
      };
    });

    // Sort by highestBid DESC. Ties sorted by ticketNumber ASC.
    return membersWithBids.sort((a, b) => {
      if (b.highestBid !== a.highestBid) {
        return b.highestBid - a.highestBid;
      }
      return a.ticketNumber - b.ticketNumber;
    });
  }, [group.members, group.memberCount, group.ticketNumber, bids, currentUserId, highestBid]);

  // Check if current logged-in subscriber is top bidder
  const isCurrentUserTopBidder = useMemo(() => {
    return rankedBidders.some((b) => b.isCurrentUser && b.isTopBidder);
  }, [rankedBidders]);

  // FLIP (First, Last, Invert, Play) physical climbing animation
  useLayoutEffect(() => {
    if (activeSubTab !== 'ranking') return;

    const newlyClimbing = new Set<string>();

    cardRefs.current.forEach((el, id) => {
      if (!el) return;
      const currentRect = el.getBoundingClientRect();
      const prevTop = prevTops.current.get(id);

      if (prevTop !== undefined) {
        const deltaY = prevTop - currentRect.top;
        if (Math.abs(deltaY) > 2) {
          if (deltaY > 0) {
            newlyClimbing.add(id);
          }
          // Invert: snap element to previous coordinate
          el.style.transform = `translateY(${deltaY}px)`;
          el.style.transition = 'none';

          // Force reflow
          void el.offsetHeight;

          // Play: smooth 1.2s hardware-accelerated climbing transition
          requestAnimationFrame(() => {
            el.style.transition = 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 1.2s ease, border-color 1.2s ease, background 1.2s ease';
            el.style.transform = 'translateY(0px)';
          });
        }
      }
      // Record new position for next update
      prevTops.current.set(id, currentRect.top);
    });

    if (newlyClimbing.size > 0) {
      setClimbingMemberIds(newlyClimbing);
      const timer = setTimeout(() => setClimbingMemberIds(new Set()), 1800);
      return () => clearTimeout(timer);
    }
  }, [rankedBidders, activeSubTab]);

  return (
    <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-200">
      {/* ── BROADCAST ENDED MODAL / OVERLAY ── */}
      {group.isLiveAuctionActive === false && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-sm border rounded-3xl p-5 sm:p-6 shadow-2xl text-center space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center">
              <Radio size={28} className="opacity-70" />
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Session Concluded
              </span>
              <h3 className="text-base font-black mt-2">Live Auction Has Ended</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                The admin has closed or concluded this live bidding session. Winner announcements and finalized passbook statements are updated in the general Auction tab.
              </p>
            </div>

            <button
              type="button"
              onClick={onExit}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-900/30 cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <LogOut size={15} />
              <span>Return to Auction History</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP HEADER & BACK NAVIGATION */}
      <div className={`p-3.5 sm:p-5 rounded-3xl border shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isDark 
          ? 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-indigo-500/30 text-white' 
          : 'bg-gradient-to-r from-white via-indigo-50/50 to-white border-indigo-200 text-slate-900'
      }`}>
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className={`p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer shrink-0 active:scale-95 flex items-center justify-center ${
              isDark 
                ? 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300' 
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs'
            }`}
            title="Back to Auction History"
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                isDark 
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400' 
                  : 'bg-rose-100 border border-rose-300 text-rose-700'
              }`}>
                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-rose-500" />
                </span>
                <span>Live Bidding Floor</span>
              </span>

              {/* Live Viewer Counter */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold border ${
                isDark 
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' 
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              }`}>
                <Eye size={11} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                <span className="font-mono">{viewerCount}</span>
                <span>{viewerCount === 1 ? 'Watching' : 'Watching'}</span>
              </span>

              <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md border font-mono ${
                isDark 
                  ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' 
                  : 'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                Month {group.currentMonth} of {group.durationMonths}
              </span>
            </div>

            <h2 className="text-sm sm:text-xl font-black tracking-tight truncate mt-1">
              {group.groupName}
            </h2>
          </div>
        </div>

        {/* Total Chit Value Badge */}
        <div className={`p-2 sm:p-3 rounded-2xl border self-start sm:self-auto shrink-0 font-mono ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-xs'
        }`}>
          <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Chit Value</span>
          <span className="text-sm sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(group.totalValue)}
          </span>
        </div>
      </div>

      {/* 2. AT-A-GLANCE AUCTION FINANCIAL HERO CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {/* Card 1: Top Discount Bid */}
        <div className={`p-2.5 sm:p-4 rounded-2xl border flex flex-col justify-between transition-all ${
          highestBid > 0
            ? isDark
              ? 'bg-gradient-to-b from-rose-950/30 to-slate-900 border-rose-500/30'
              : 'bg-rose-50/80 border-rose-300'
            : isDark
              ? 'bg-slate-900/90 border-slate-800'
              : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Flame size={12} className="text-rose-500 shrink-0" />
              <span>Top Discount</span>
            </span>
            {highestBid > 0 && (
              <span className={`text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                isDark ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                Surrendered
              </span>
            )}
          </div>
          <div className="mt-1.5 font-mono">
            <div className="text-base sm:text-2xl font-black text-rose-600 dark:text-rose-500 tracking-tight">
              {highestBid > 0 ? `-₹${highestBid.toLocaleString('en-IN')}` : '₹0'}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
              {topBidObj ? `By ${topBidObj.memberName} (#${topBidObj.ticketNumber})` : 'Awaiting 1st bid'}
            </p>
          </div>
        </div>

        {/* Card 2: Take-Home Prize Pot */}
        <div className={`p-2.5 sm:p-4 rounded-2xl border flex flex-col justify-between ${
          isDark 
            ? 'bg-gradient-to-b from-emerald-950/30 to-slate-900 border-emerald-500/30' 
            : 'bg-emerald-50/80 border-emerald-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Banknote size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Net Payout</span>
            </span>
            <span className={`text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
              isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}>
              Take-home
            </span>
          </div>
          <div className="mt-1.5 font-mono">
            <div className="text-base sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCurrency(netPayout)}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
              {highestBid > 0 ? `₹${group.totalValue.toLocaleString('en-IN')} − ₹${highestBid.toLocaleString('en-IN')}` : 'Full Chit Value'}
            </p>
          </div>
        </div>

        {/* Card 3: Running Discount Pool */}
        <div className={`p-2.5 sm:p-4 rounded-2xl border flex flex-col justify-between ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Coins size={12} className="text-amber-500 shrink-0" />
              <span>Pool</span>
            </span>
            <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 font-bold">
              {laabaProgress}%
            </span>
          </div>
          <div className="mt-1.5 font-mono">
            <div className={`text-base sm:text-2xl font-black tracking-tight ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
              {formatCurrency(projectedPool)}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
              {isLaabaSeetuActive ? '🎉 Laaba Seetu Ready' : `Goal: ${formatCurrency(group.totalValue)}`}
            </p>
          </div>
        </div>

        {/* Card 4: Total Auction Turns */}
        <div className={`p-2.5 sm:p-4 rounded-2xl border flex flex-col justify-between ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Gavel size={12} className="text-indigo-500 shrink-0" />
              <span>Activity</span>
            </span>
            <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded border ${
              isDark ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-100 text-indigo-800 border-indigo-200'
            }`}>
              Live
            </span>
          </div>
          <div className="mt-1.5 font-mono">
            <div className={`text-base sm:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {bids.length} {bids.length === 1 ? 'Turn' : 'Turns'}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
              {rankedBidders.filter((b) => b.highestBid > 0).length} shouting contenders
            </p>
          </div>
        </div>
      </div>

      {/* 3. SUBSCRIBER SELF-STATUS BANNER (OPTIMIZED CONTRAST FOR LIGHT & DARK MODES) */}
      {isCurrentUserTopBidder ? (
        <div className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-lg transition-all ${
          isDark 
            ? 'bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border-amber-500/50 text-amber-200 shadow-amber-950/30' 
            : 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 border-amber-600 text-white shadow-amber-500/20'
        }`}>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-black flex items-center justify-center shrink-0 shadow-md ${
              isDark ? 'bg-amber-500 text-slate-950' : 'bg-white text-amber-600'
            }`}>
              <Crown size={20} />
            </div>
            <div>
              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider block ${
                isDark ? 'text-amber-400' : 'text-amber-100'
              }`}>
                Current Standings
              </span>
              <h4 className="text-xs sm:text-base font-black text-white leading-snug">
                🌟 You are currently the Leading Bidder!
              </h4>
              <p className={`text-[11px] sm:text-xs mt-0.5 ${
                isDark ? 'text-amber-200/90' : 'text-amber-50'
              }`}>
                Your bid of <strong>{formatCurrency(highestBid)}</strong> is in Rank #1. Net payout if closed: <strong>{formatCurrency(netPayout)}</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : group.hasWonRegular ? (
        <div className={`p-3 sm:p-3.5 rounded-2xl border flex items-center gap-3 ${
          isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-800'
        }`}>
          <Award className="text-amber-500 shrink-0" size={18} />
          <div className="text-xs">
            <span className={`font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Previous Auction Winner (Ticket #{group.ticketNumber})
            </span>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              You have already won your prize pot in a previous month. You are enjoying spectator access to this live round.
            </span>
          </div>
        </div>
      ) : (
        <div className={`p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
          isDark 
            ? 'bg-indigo-950/20 border-indigo-500/30 text-indigo-200' 
            : 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
        }`}>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              isDark ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border-indigo-200'
            }`}>
              <Radio size={16} className="animate-pulse" />
            </div>
            <div>
              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider block ${
                isDark ? 'text-indigo-400' : 'text-indigo-700'
              }`}>
                Eligible Contender · Ticket #{group.ticketNumber}
              </span>
              <p className={`text-xs font-semibold leading-snug ${
                isDark ? 'text-slate-300' : 'text-slate-800'
              }`}>
                The bidding floor is open. Shout your discount bids directly to the Counter Manager to move up the leaderboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. SEGMENTED TABS: LIVE LEADERBOARD RANKING VS BID LOG STREAM */}
      <div className="flex items-center justify-between border-b pb-2 pt-1 border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('ranking')}
            className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
              activeSubTab === 'ranking'
                ? 'bg-indigo-600 text-white shadow-md'
                : isDark
                  ? 'bg-slate-800/70 text-slate-400 hover:text-white'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
          >
            <Trophy size={13} />
            <span>Leaderboard ({rankedBidders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('feed')}
            className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
              activeSubTab === 'feed'
                ? 'bg-indigo-600 text-white shadow-md'
                : isDark
                  ? 'bg-slate-800/70 text-slate-400 hover:text-white'
                  : 'bg-slate-100 text-slate-700 hover:text-slate-900'
            }`}
          >
            <History size={13} />
            <span>Turns Feed ({bids.length})</span>
          </button>
        </div>

        <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="hidden xs:inline">Realtime Supabase Sync</span>
        </div>
      </div>

      {/* 5. TAB A: DYNAMIC LEADERBOARD RANKING CARDS LIST (WITH PHYSICAL FLIP CLIMBING ANIMATION) */}
      {activeSubTab === 'ranking' && (
        <div className="space-y-2 sm:space-y-2.5 relative">
          {rankedBidders.map((bidder, index) => {
            const rank = index + 1;
            const hasBids = bidder.highestBid > 0;
            const isTop = bidder.isTopBidder && hasBids;
            const isHighlighting = newBidAnimationId && isTop;
            const isClimbing = climbingMemberIds.has(bidder.id);

            return (
              <div
                key={bidder.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(bidder.id, el);
                  else cardRefs.current.delete(bidder.id);
                }}
                className={`relative rounded-2xl p-3 sm:p-4 border transition-all duration-300 flex items-center justify-between gap-2.5 sm:gap-3 ${
                  isClimbing
                    ? 'z-30 scale-[1.02] shadow-xl ring-2 ring-amber-400'
                    : isTop
                      ? isDark
                        ? 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/60 ring-2 ring-amber-500/20 shadow-amber-950/40 z-10 scale-[1.01]'
                        : 'bg-gradient-to-r from-amber-50 via-white to-white border-amber-400 ring-2 ring-amber-400/30 shadow-amber-200/50 z-10 scale-[1.01]'
                      : bidder.isCurrentUser
                        ? isDark
                          ? 'bg-indigo-950/30 border-indigo-500/40 ring-1 ring-indigo-500/30'
                          : 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-300/30'
                        : hasBids
                          ? isDark
                            ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                          : isDark
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-70'
                            : 'bg-slate-50/80 border-slate-200/70 opacity-70'
                } ${isHighlighting ? 'animate-pulse' : ''}`}
              >
                {/* Left: Rank Badge & Bidder Info */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  {/* Rank Position Pill */}
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black font-mono text-xs shrink-0 shadow-xs ${
                    isTop
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-amber-500/40'
                      : rank === 2 && hasBids
                        ? 'bg-slate-300 text-slate-900 font-bold'
                        : rank === 3 && hasBids
                          ? 'bg-amber-700 text-white font-bold'
                          : isDark
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                  }`}>
                    {isTop ? <Crown size={15} /> : `#${rank}`}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className={`text-xs sm:text-sm font-black truncate ${
                        isTop 
                          ? isDark ? 'text-amber-300' : 'text-amber-900' 
                          : isDark ? 'text-white' : 'text-slate-900'
                      }`}>
                        {bidder.fullName}
                      </h4>

                      <span className={`text-[9px] sm:text-[10px] font-bold font-mono px-1.5 py-0.2 rounded border ${
                        isDark ? 'bg-slate-800/60 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        #{bidder.ticketNumber}
                      </span>

                      {bidder.isCurrentUser && (
                        <span className="text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-600 text-white shadow-xs">
                          YOU
                        </span>
                      )}

                      {isClimbing && (
                        <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-emerald-500 text-white flex items-center gap-0.5 animate-bounce">
                          <ArrowUp size={10} />
                          <span>Climbing</span>
                        </span>
                      )}

                      {isTop && (
                        <span className={`text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold'
                        }`}>
                          <Crown size={10} />
                          <span>Leader</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                      {hasBids ? (
                        <>
                          <span className="font-medium">
                            {bidder.totalTurns} {bidder.totalTurns === 1 ? 'turn' : 'turns'}
                          </span>
                          {bidder.lastBidTime && (
                            <>
                              <span>•</span>
                              <span className="font-mono opacity-85">{bidder.lastBidTime}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <span className="font-medium italic text-slate-400 dark:text-slate-500">
                          Awaiting turn
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Highest Bid Amount & Projected Payout (Take-home only shown for Rank #1 Leader) */}
                <div className="text-right font-mono shrink-0">
                  {hasBids ? (
                    <div>
                      <div className={`text-xs sm:text-base font-black ${
                        isTop ? 'text-rose-600 dark:text-rose-500' : isDark ? 'text-white' : 'text-slate-900'
                      }`}>
                        {formatCurrency(bidder.highestBid)}
                      </div>
                      {isTop && (
                        <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block">
                          Take-home: {formatCurrency(group.totalValue - bidder.highestBid)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 italic">
                      No bids yet
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. TAB B: LIVE TURNS ACTIVITY FEED STREAM */}
      {activeSubTab === 'feed' && (
        <div className="space-y-2">
          {bids.length === 0 ? (
            <div className={`text-center py-10 rounded-2xl border p-6 ${
              isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <History className="mx-auto h-10 w-10 text-slate-400 mb-2" />
              <h4 className="text-sm font-bold">No Bidding Turns Recorded Yet</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                As soon as the counter manager logs shouts and bids, real-time entries will appear here.
              </p>
            </div>
          ) : (
            bids.map((bid, index) => {
              const isCurrentTop = index === 0;
              return (
                <div
                  key={bid.id || `bid-${index}`}
                  className={`p-3 sm:p-3.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all shadow-2xs ${
                    isCurrentTop
                      ? isDark
                        ? 'bg-rose-950/30 border-rose-500/40 text-white ring-1 ring-rose-500/20'
                        : 'bg-rose-50/90 border-rose-300 text-slate-900'
                      : isDark
                        ? 'bg-slate-900/80 border-slate-800 text-slate-300'
                        : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black font-mono ${
                      isCurrentTop
                        ? 'bg-rose-500 text-white'
                        : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {bids.length - index}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {bid.memberName}
                        </span>
                        <span className={`text-[10px] font-mono px-1 rounded ${
                          isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                        }`}>
                          #{bid.ticketNumber}
                        </span>
                        {isCurrentTop && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-500 text-white">
                            Current Top
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {bid.timestamp}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono shrink-0">
                    <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400">
                      -{formatCurrency(bid.amount)}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                      Pot: {formatCurrency(group.totalValue - bid.amount)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
