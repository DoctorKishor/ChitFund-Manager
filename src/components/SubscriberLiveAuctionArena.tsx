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
  AlertCircle,
  Share2,
  PartyPopper
} from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';
import ConfettiEffect from '@/components/ConfettiEffect';

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
  const [sessionStatus, setSessionStatus] = useState<'active' | 'paused' | 'concluded'>(() => {
    return group.isLiveAuctionActive ? 'active' : 'paused';
  });
  const [liveBids, setLiveBids] = useState<LiveBidItem[]>(() => {
    return Array.isArray(group.liveBidStream) ? group.liveBidStream : [];
  });
  const [isLiveActiveLocally, setIsLiveActiveLocally] = useState<boolean>(group.isLiveAuctionActive !== false);
  const prevTopBidAmountRef = useRef<number>(0);

  // Synchronize when prop changes (only when session is active)
  useEffect(() => {
    if (sessionStatus !== 'paused' && sessionStatus !== 'concluded' && Array.isArray(group.liveBidStream)) {
      setLiveBids((prev) => {
        if (prev.length === 0 || (group.liveBidStream && group.liveBidStream.length > prev.length)) {
          return group.liveBidStream || [];
        }
        return prev;
      });
    }
  }, [group.liveBidStream, sessionStatus]);

  useEffect(() => {
    if (group.isLiveAuctionActive !== undefined) {
      setIsLiveActiveLocally(group.isLiveAuctionActive);
      if (group.isLiveAuctionActive) {
        setSessionStatus('active');
      }
    }
  }, [group.isLiveAuctionActive]);

  // Track current sessionStatus and isLiveActive in refs for event listeners
  const sessionStatusRef = useRef<'active' | 'paused' | 'concluded'>(sessionStatus);
  useEffect(() => {
    sessionStatusRef.current = sessionStatus;
  }, [sessionStatus]);

  const isLiveActiveRef = useRef<boolean>(isLiveActiveLocally);
  useEffect(() => {
    isLiveActiveRef.current = isLiveActiveLocally;
  }, [isLiveActiveLocally]);

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
        broadcast: {
          self: false,
        },
      },
    });

    presenceChannel
      .on('broadcast', { event: 'new_bid' }, (payload: any) => {
        // Do NOT update bids if session is paused or concluded or not live
        if (sessionStatusRef.current === 'paused' || sessionStatusRef.current === 'concluded' || !isLiveActiveRef.current) {
          return;
        }
        if (payload.payload?.bid) {
          const newBid: LiveBidItem = payload.payload.bid;
          setLiveBids((prev) => {
            if (prev.some((b) => b.id === newBid.id)) return prev;
            return [newBid, ...prev];
          });
          triggerHapticFeedback('success');
        } else if (Array.isArray(payload.payload?.bids)) {
          setLiveBids(payload.payload.bids);
          triggerHapticFeedback('success');
        }
      })
      .on('broadcast', { event: 'bids_sync' }, (payload: any) => {
        // Do NOT update bids if session is paused or concluded or not live
        if (sessionStatusRef.current === 'paused' || sessionStatusRef.current === 'concluded' || !isLiveActiveRef.current) {
          return;
        }
        if (Array.isArray(payload.payload?.bids)) {
          setLiveBids(payload.payload.bids);
        }
      })
      .on('broadcast', { event: 'session_state' }, (payload: any) => {
        const p = payload.payload;
        if (!p) return;
        if (p.status === 'concluded' || p.concluded === true) {
          setSessionStatus('concluded');
          setIsLiveActiveLocally(false);
          if (Array.isArray(p.bids)) {
            setLiveBids(p.bids);
          }
        } else if (p.status === 'paused' || p.isLiveAuctionActive === false) {
          setSessionStatus('paused');
          setIsLiveActiveLocally(false);
          // Keep current bids frozen as they were when live was paused
        } else if (p.isLiveAuctionActive === true) {
          setSessionStatus('active');
          setIsLiveActiveLocally(true);
          if (Array.isArray(p.bids)) {
            setLiveBids(p.bids);
          }
        }
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chit_groups', filter: `id=eq.${group.groupId}` },
        (payload: any) => {
          if (payload.new?.is_live_auction_active !== undefined) {
            const isLive = payload.new.is_live_auction_active;
            setIsLiveActiveLocally(isLive);
            if (isLive) {
              setSessionStatus('active');
              if (payload.new?.live_bid_stream && Array.isArray(payload.new.live_bid_stream)) {
                setLiveBids(payload.new.live_bid_stream);
              }
            } else {
              if (payload.new.current_month > group.currentMonth || payload.new.status === 'completed') {
                setSessionStatus('concluded');
                if (payload.new?.live_bid_stream && Array.isArray(payload.new.live_bid_stream)) {
                  setLiveBids(payload.new.live_bid_stream);
                }
              } else {
                setSessionStatus('paused');
                // When paused, do NOT update liveBids so top bidder and leading bid stay frozen
              }
            }
          } else if (isLiveActiveRef.current && sessionStatusRef.current === 'active') {
            if (payload.new?.live_bid_stream && Array.isArray(payload.new.live_bid_stream)) {
              setLiveBids(payload.new.live_bid_stream);
            }
          }
        }
      )

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
          const myMember = group.members?.find(
            (m) => (group.ticketNumber && m.ticketNumber === group.ticketNumber) || 
                   (currentUserId && m.profileId === currentUserId)
          );
          const myFullName = myMember?.fullName || `Ticket #${group.ticketNumber || '?'}`;

          await presenceChannel.track({
            role: 'subscriber',
            profile_id: currentUserId,
            ticket_number: group.ticketNumber,
            name: myFullName,
            has_won_regular: group.hasWonRegular,
            joined_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [group.groupId, currentUserId, group.ticketNumber, group.members, group.hasWonRegular]);

  const bids: LiveBidItem[] = liveBids;

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

  // Check if viewing user is the auction winner
  const isCurrentSubscriberWinner = useMemo(() => {
    if (!topBidObj) return false;
    return Boolean(
      (group.ticketNumber && topBidObj.ticketNumber === group.ticketNumber) ||
      (currentUserId && (topBidObj.memberId === currentUserId || (topBidObj as any).profileId === currentUserId))
    );
  }, [topBidObj, group.ticketNumber, currentUserId]);

  const isEligibleFuture = !group.hasWonRegular && !isCurrentSubscriberWinner;
  const alreadyWonPast = group.hasWonRegular && !isCurrentSubscriberWinner;
  const isNextMonthLaabaSeetu = projectedPool >= group.totalValue;

  return (
    <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-200">
      
      {/* ── 1. SESSION PAUSED / STANDBY OVERLAY (When Admin Clicks "End Live" without Closing) ── */}
      {sessionStatus === 'paused' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-md border border-[#27264E] bg-[#1D1D41] text-white rounded-3xl p-5 sm:p-6 shadow-2xl text-center space-y-4 my-auto animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center border border-[#FFBB38]/30 bg-[#FFBB38]/15 text-[#FFBB38] shadow-xs">
              <Radio size={28} className="animate-pulse" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-[#FFBB38]/30 bg-[#FFBB38]/20 text-[#FFBB38]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFBB38] animate-ping" />
                Live Broadcast Paused
              </span>
              <h3 className="text-base sm:text-lg font-black text-white mt-2">Live Session on Standby</h3>
              <p className="text-xs mt-1 leading-relaxed text-[#AEABD8]">
                The administrator has paused the live telecast for <strong>{group.groupName}</strong>. All logged bids remain securely saved.
              </p>
            </div>

            {/* Current Top Bid Snapshot */}
            {highestBid > 0 && topBidObj ? (
              <div className="p-3.5 rounded-2xl border border-[#27264E] bg-[#141332] text-left space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#AEABD8] font-medium">Leading Bid So Far:</span>
                  <span className="font-mono font-bold text-[#E41414]">
                    -{formatCurrency(highestBid)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#AEABD8] font-medium">Top Bidder:</span>
                  <span className="font-bold text-white">
                    {topBidObj.memberName} (#{topBidObj.ticketNumber})
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl border border-[#27264E] bg-[#141332] text-xs text-left text-[#AEABD8]">
                No bids were recorded prior to pausing.
              </div>
            )}

            <div className="p-3 rounded-2xl border border-[#27264E] bg-[#141332] text-xs text-left flex items-start gap-2 text-[#AEABD8]">
              <Info size={15} className="text-[#FFBB38] shrink-0 mt-0.5" />
              <span>You may stay on this floor waiting for resumption, or return to the auction tab.</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setSessionStatus('active')}
                className="flex-1 py-3 rounded-2xl text-xs sm:text-sm font-bold border border-[#27264E] bg-[#141332] hover:bg-[#27264E] text-[#AEABD8] hover:text-white transition-all cursor-pointer active:scale-95"
              >
                Stay on Floor
              </button>

              <button
                type="button"
                onClick={onExit}
                className="flex-1 py-3 rounded-2xl bg-[#6359E9] hover:bg-[#6F64FF] text-white font-bold text-xs sm:text-sm shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <LogOut size={15} />
                <span>Exit to History</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. AUCTION CONCLUDED & WINNER SEALED OVERLAY (When Admin Clicks "Close Auction") ── */}
      {sessionStatus === 'concluded' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          
          {/* VARIANT A: CURRENT SUBSCRIBER WON THE AUCTION */}
          {isCurrentSubscriberWinner ? (
            <div className="w-full max-w-lg space-y-4 my-auto animate-in zoom-in-95 duration-200">
              <ConfettiEffect durationMs={8000} particleCount={150} />
              
              <div className="relative overflow-hidden p-5 sm:p-7 rounded-3xl border border-[#FFBB38]/60 bg-[#1D1D41] text-white shadow-2xl text-center space-y-4 sm:space-y-5">
                {/* Decorative radial glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#FFBB38]/15 rounded-full blur-3xl pointer-events-none" />

                <div className="relative">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-gradient-to-tr from-[#FFBB38] via-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 animate-bounce">
                    <Trophy size={36} className="sm:w-10 sm:h-10 text-slate-950" />
                  </div>
                  
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider mt-3 border border-[#FFBB38]/40 bg-[#FFBB38]/20 text-[#FFBB38]">
                    <Sparkles size={13} /> Official Auction Winner
                  </span>
                  
                  <h3 className="text-xl sm:text-3xl font-black mt-2 tracking-tight text-white">
                    🎉 CONGRATULATIONS!
                  </h3>
                  <p className="text-xs sm:text-sm font-extrabold mt-1 text-[#FFBB38]">
                    You won the Month {group.currentMonth} auction!
                  </p>
                  <p className="text-[11px] font-mono mt-0.5 text-[#AEABD8]">
                    Ticket #{group.ticketNumber} · {group.groupName}
                  </p>
                </div>

                {/* Net Take-Home Prize Pot Highlight Card */}
                <div className="p-4 sm:p-5 rounded-2xl border border-[#27264E] bg-[#141332] text-left space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#AEABD8] font-medium">Total Chit Pot:</span>
                    <span className="font-bold font-mono text-white">{formatCurrency(group.totalValue)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#AEABD8] font-medium">Your Winning Discount Bid:</span>
                    <span className="font-mono font-bold text-[#E41414]">-{formatCurrency(highestBid)}</span>
                  </div>

                  <div className="pt-3 border-t border-[#27264E] flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <span className="text-xs font-black uppercase tracking-wider text-[#FFBB38]">
                      Your Net Take-Home Pot:
                    </span>
                    <span className="text-2xl sm:text-3xl font-mono font-black text-[#02B15A]">
                      {formatCurrency(netPayout)}
                    </span>
                  </div>
                </div>

                {/* Organizer Payout Note */}
                <div className="p-3.5 rounded-2xl border border-[#FFBB38]/20 bg-[#FFBB38]/10 text-amber-200 text-left flex items-start gap-2.5 text-xs">
                  <ShieldCheck size={18} className="text-[#FFBB38] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    Your winning bid has been permanently recorded in the ledger. The organizer will disburse your take-home prize pot of <strong>{formatCurrency(netPayout)}</strong>.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const text = encodeURIComponent(
                        `🏆 *CHIT AUCTION VICTORY!*\n\nI won the Month ${group.currentMonth} auction for *${group.groupName}*!\n💰 Net Take-Home Pot: ${formatCurrency(netPayout)}\n🎉 Thank you Chit Funds Manager!`
                      );
                      window.open(`https://wa.me/?text=${text}`, '_blank');
                    }}
                    className="flex-1 py-3 sm:py-3.5 rounded-2xl bg-[#02B15A] hover:bg-[#02B15A]/90 text-white font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    <Share2 size={16} />
                    <span>Share Win on WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={onExit}
                    className="flex-1 py-3 sm:py-3.5 rounded-2xl font-bold text-xs sm:text-sm border border-[#27264E] bg-[#141332] hover:bg-[#27264E] text-white cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <LogOut size={15} />
                    <span>Return to Dashboard</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* VARIANT B & C: SOMEONE ELSE WON */
            <div className="w-full max-w-md border border-[#27264E] bg-[#1D1D41] text-white rounded-3xl p-5 sm:p-6 shadow-2xl text-center space-y-4 my-auto animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 mx-auto rounded-2xl border border-[#6359E9]/30 bg-[#6359E9]/20 flex items-center justify-center">
                <Trophy size={28} className="text-[#FFBB38]" />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-[#27264E] bg-[#141332] text-[#AEABD8]">
                  Month {group.currentMonth} Concluded
                </span>
                <h3 className="text-lg font-black mt-2 text-white">Live Auction Has Ended</h3>
                <p className="text-xs mt-0.5 text-[#AEABD8]">
                  The bidding round for {group.groupName} has been sealed.
                </p>
              </div>

              {/* Winner Summary Card */}
              {topBidObj ? (
                <div className="p-3.5 rounded-2xl border border-[#27264E] bg-[#141332] text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#AEABD8] font-medium">Round Winner:</span>
                    <span className="font-bold flex items-center gap-1 text-white">
                      <Trophy size={12} className="text-[#FFBB38] shrink-0" />
                      <span className="truncate">{topBidObj.memberName}</span>
                      <span className="text-[#AEABD8] font-mono">(#{topBidObj.ticketNumber})</span>
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-[#AEABD8] font-medium">Winning Discount:</span>
                    <span className="font-mono font-bold text-[#E41414]">
                      -{formatCurrency(highestBid)}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#27264E] flex justify-between items-baseline">
                    <span className="text-[#AEABD8] font-semibold">Winner Net Take-Home:</span>
                    <span className="text-sm sm:text-base font-mono font-black text-[#02B15A]">
                      {formatCurrency(netPayout)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-[#27264E] bg-[#141332] text-xs text-[#AEABD8]">
                  No bids were recorded in this live round.
                </div>
              )}

              {/* Personalized Eligibility vs Already-Won Notification */}
              {isEligibleFuture ? (
                <div className="p-3.5 rounded-2xl border border-[#6359E9]/40 bg-[#141332] text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-[#64CFF6]">
                    <Sparkles size={14} />
                    <span>🍀 Better luck next time!</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#AEABD8]">
                    You are eligible to bid in <strong>Month {Math.min(group.durationMonths, group.currentMonth + 1)}</strong>. Keep an eye on the schedule for the next live round!
                  </p>
                  {isNextMonthLaabaSeetu && (
                    <div className="pt-2 mt-1 border-t border-[#27264E] text-[11px] font-bold flex items-center gap-1.5 text-[#FFBB38]">
                      <PartyPopper size={13} className="shrink-0" />
                      <span>Next month is <strong>Laaba Seetu (லாப சீட்டு)</strong> with <strong>₹0 due</strong>!</span>
                    </div>
                  )}
                </div>
              ) : alreadyWonPast ? (
                <div className="p-3.5 rounded-2xl border border-[#FFBB38]/30 bg-[#141332] text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#FFBB38]">
                    <Crown size={14} />
                    <span>Prize Already Received</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#AEABD8]">
                    You have already won your chit pot in a previous round for this group. Thank you for following the live proceedings!
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={onExit}
                className="w-full py-3 rounded-2xl bg-[#6359E9] hover:bg-[#6F64FF] text-white font-bold text-xs sm:text-sm shadow-lg cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <LogOut size={15} />
                <span>Return to Auction History</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 1. TOP HEADER & BACK NAVIGATION */}
      <div className="p-3.5 sm:p-5 rounded-3xl border border-[#27264E] bg-[#1D1D41] text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="p-2 sm:p-2.5 rounded-2xl border border-[#27264E] bg-[#141332] hover:bg-[#27264E] text-[#AEABD8] hover:text-white transition-all cursor-pointer shrink-0 active:scale-95 flex items-center justify-center"
            title="Back to Auction History"
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-[#E41414]/20 border border-[#E41414]/40 text-[#FF5555]">
                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-[#E41414]" />
                </span>
                <span>Live Bidding Floor</span>
              </span>

              {/* Live Viewer Counter Badge (Static for subscribers, Admin only has modal) */}
              <div
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold border border-[#02B15A]/30 bg-[#02B15A]/15 text-[#02B15A]"
                title={`${viewerCount} subscriber${viewerCount === 1 ? '' : 's'} viewing this live auction`}
              >
                <Eye size={11} className="text-[#02B15A]" />
                <span className="font-mono">{viewerCount}</span>
                <span>{viewerCount === 1 ? 'Viewing' : 'Viewing'}</span>
              </div>

              <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-[#27264E] bg-[#141332] text-[#64CFF6] font-mono">
                Month {group.currentMonth} of {group.durationMonths}
              </span>
            </div>

            <h2 className="text-sm sm:text-xl font-black tracking-tight truncate mt-1 text-white">
              {group.groupName}
            </h2>
          </div>
        </div>

        {/* Total Chit Value Badge */}
        <div className="p-2 sm:p-3 rounded-2xl border border-[#27264E] bg-[#141332] self-start sm:self-auto shrink-0 font-mono">
          <span className="text-[8px] sm:text-[9px] font-bold text-[#AEABD8] uppercase tracking-wider block">Total Chit Value</span>
          <span className="text-sm sm:text-lg font-black text-[#02B15A]">
            {formatCurrency(group.totalValue)}
          </span>
        </div>
      </div>

      {/* 2. AT-A-GLANCE AUCTION FINANCIAL HERO CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {/* Card 1: Top Discount Bid */}
        <div className="p-2.5 sm:p-4 rounded-2xl border border-[#27264E] bg-[#1D1D41] flex flex-col justify-between transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#AEABD8] flex items-center gap-1">
              <Flame size={12} className="text-[#E41414] shrink-0" />
              <span>Top Discount</span>
            </span>
            {highestBid > 0 && (
              <span className="text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-[#E41414]/30 bg-[#E41414]/20 text-[#FF5555]">
                Surrendered
              </span>
            )}
          </div>
          <div className="mt-1.5 font-mono">
            <div className="text-base sm:text-2xl font-black text-[#E41414] tracking-tight">
              {highestBid > 0 ? `-₹${highestBid.toLocaleString('en-IN')}` : '₹0'}
            </div>
            <p className="text-[9px] sm:text-[10px] text-[#AEABD8] mt-0.5 truncate">
              {topBidObj ? `By ${topBidObj.memberName} (#${topBidObj.ticketNumber})` : 'Awaiting 1st bid'}
            </p>
          </div>
        </div>

        {/* Card 2: Take-Home Prize Pot */}
        <div className="p-2.5 sm:p-4 rounded-2xl border border-[#27264E] bg-[#1D1D41] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#AEABD8] flex items-center gap-1">
              <Banknote size={12} className="text-[#02B15A] shrink-0" />
              <span>Net Payout</span>
            </span>
            <span className="text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-[#02B15A]/30 bg-[#02B15A]/20 text-[#02B15A]">
              Take-home
            </span>
          </div>
          <div className="mt-1.5 font-mono">
            <div className="text-base sm:text-2xl font-black text-[#02B15A] tracking-tight">
              {formatCurrency(netPayout)}
            </div>
            <p className="text-[9px] sm:text-[10px] text-[#AEABD8] mt-0.5 truncate">
              {highestBid > 0 ? `₹${group.totalValue.toLocaleString('en-IN')} − ₹${highestBid.toLocaleString('en-IN')}` : 'Full Chit Value'}
            </p>
          </div>
        </div>

        {/* Card 3: Running Discount Pool */}
        <div className="p-2.5 sm:p-4 rounded-2xl border border-[#27264E] bg-[#1D1D41] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#AEABD8] flex items-center gap-1">
              <Coins size={12} className="text-[#FFBB38] shrink-0" />
              <span>Pool</span>
            </span>
            <span className="text-[9px] font-mono text-[#FFBB38] font-bold">
              {laabaProgress}%
            </span>
          </div>
          <div className="mt-1.5 font-mono">
            <div className="text-base sm:text-2xl font-black tracking-tight text-[#FFBB38]">
              {formatCurrency(projectedPool)}
            </div>
            <p className="text-[9px] sm:text-[10px] text-[#AEABD8] mt-0.5 truncate">
              {isLaabaSeetuActive ? '🎉 Laaba Seetu Ready' : `Goal: ${formatCurrency(group.totalValue)}`}
            </p>
          </div>
        </div>

        {/* Card 4: Total Auction Turns */}
        <div className="p-2.5 sm:p-4 rounded-2xl border border-[#27264E] bg-[#1D1D41] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#AEABD8] flex items-center gap-1">
              <Gavel size={12} className="text-[#64CFF6] shrink-0" />
              <span>Activity</span>
            </span>
            <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.2 rounded border border-[#6359E9]/40 bg-[#6359E9]/20 text-[#64CFF6]">
              Live
            </span>
          </div>
          <div className="mt-1.5 font-mono">
            <div className="text-base sm:text-2xl font-black tracking-tight text-white">
              {bids.length} {bids.length === 1 ? 'Turn' : 'Turns'}
            </div>
            <p className="text-[9px] sm:text-[10px] text-[#AEABD8] mt-0.5 truncate">
              {rankedBidders.filter((b) => b.highestBid > 0).length} shouting contenders
            </p>
          </div>
        </div>
      </div>

      {/* 3. SUBSCRIBER SELF-STATUS BANNER */}
      {isCurrentUserTopBidder ? (
        <div className="p-3.5 sm:p-4 rounded-2xl border border-[#FFBB38]/50 bg-[#1D1D41] text-[#FFBB38] flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-black flex items-center justify-center shrink-0 shadow-md bg-[#FFBB38] text-slate-950">
              <Crown size={20} />
            </div>
            <div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider block text-[#FFBB38]">
                Current Standings
              </span>
              <h4 className="text-xs sm:text-base font-black text-white leading-snug">
                🌟 You are currently the Leading Bidder!
              </h4>
              <p className="text-[11px] sm:text-xs mt-0.5 text-[#AEABD8]">
                Your bid of <strong>{formatCurrency(highestBid)}</strong> is in Rank #1. Net payout if closed: <strong className="text-[#02B15A]">{formatCurrency(netPayout)}</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : group.hasWonRegular ? (
        <div className="p-3 sm:p-3.5 rounded-2xl border border-[#27264E] bg-[#1D1D41] text-[#AEABD8] flex items-center gap-3">
          <Award className="text-[#FFBB38] shrink-0" size={18} />
          <div className="text-xs">
            <span className="font-bold block text-white">
              Previous Auction Winner (Ticket #{group.ticketNumber})
            </span>
            <span className="text-[11px] text-[#AEABD8]">
              You have already won your prize pot in a previous month. You are enjoying spectator access to this live round.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 sm:p-3.5 rounded-2xl border border-[#27264E] bg-[#1D1D41] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border border-[#6359E9]/40 bg-[#6359E9]/20 text-[#64CFF6]">
              <Radio size={16} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider block text-[#64CFF6]">
                Eligible Contender · Ticket #{group.ticketNumber}
              </span>
              <p className="text-xs font-semibold leading-snug text-[#AEABD8]">
                The bidding floor is open. Shout your discount bids directly to the Counter Manager to move up the leaderboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. SEGMENTED TABS: LIVE LEADERBOARD RANKING VS BID LOG STREAM */}
      <div className="flex items-center justify-between border-b pb-2 pt-1 border-[#27264E]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('ranking')}
            className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
              activeSubTab === 'ranking'
                ? 'bg-[#6359E9] text-white shadow-md'
                : 'bg-[#141332] border border-[#27264E] text-[#AEABD8] hover:text-white'
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
                ? 'bg-[#6359E9] text-white shadow-md'
                : 'bg-[#141332] border border-[#27264E] text-[#AEABD8] hover:text-white'
            }`}
          >
            <History size={13} />
            <span>Turns Feed ({bids.length})</span>
          </button>
        </div>

        <div className="text-[10px] sm:text-[11px] font-mono text-[#AEABD8] flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#02B15A]" />
          </span>
          <span className="hidden xs:inline">Realtime Supabase Sync</span>
        </div>
      </div>

      {/* 5. TAB A: DYNAMIC LEADERBOARD RANKING CARDS LIST */}
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
                    ? 'z-30 scale-[1.02] shadow-xl ring-2 ring-[#FFBB38]'
                    : isTop
                      ? 'bg-[#1D1D41] border-[#FFBB38]/60 ring-2 ring-[#FFBB38]/30 shadow-xl z-10 scale-[1.01]'
                      : bidder.isCurrentUser
                        ? 'bg-[#1D1D41] border-[#6359E9] ring-1 ring-[#6359E9]/50'
                        : hasBids
                          ? 'bg-[#1D1D41] border-[#27264E] hover:border-[#6359E9]/40'
                          : 'bg-[#141332] border-[#27264E]/70 opacity-70'
                } ${isHighlighting ? 'animate-pulse' : ''}`}
              >
                {/* Left: Rank Badge & Bidder Info */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  {/* Rank Position Pill */}
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black font-mono text-xs shrink-0 shadow-xs ${
                    isTop
                      ? 'bg-gradient-to-br from-[#FFBB38] to-amber-600 text-slate-950 shadow-amber-500/40'
                      : rank === 2 && hasBids
                        ? 'bg-[#27264E] text-white font-bold'
                        : rank === 3 && hasBids
                          ? 'bg-[#27264E] text-[#FFBB38] font-bold'
                          : 'bg-[#141332] text-[#AEABD8] border border-[#27264E]'
                  }`}>
                    {isTop ? <Crown size={15} /> : `#${rank}`}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className={`text-xs sm:text-sm font-black truncate ${
                        isTop ? 'text-[#FFBB38]' : 'text-white'
                      }`}>
                        {bidder.fullName}
                      </h4>

                      <span className="text-[9px] sm:text-[10px] font-bold font-mono px-1.5 py-0.2 rounded border border-[#27264E] bg-[#141332] text-[#AEABD8]">
                        #{bidder.ticketNumber}
                      </span>

                      {bidder.isCurrentUser && (
                        <span className="text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#6359E9] text-white shadow-xs">
                          YOU
                        </span>
                      )}

                      {isClimbing && (
                        <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-[#02B15A] text-white flex items-center gap-0.5 animate-bounce">
                          <ArrowUp size={10} />
                          <span>Climbing</span>
                        </span>
                      )}

                      {isTop && (
                        <span className="text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-[#FFBB38]/40 bg-[#FFBB38]/20 text-[#FFBB38] flex items-center gap-1">
                          <Crown size={10} />
                          <span>Leader</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] sm:text-[11px] text-[#AEABD8] flex items-center gap-1.5 mt-0.5">
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
                        <span className="font-medium italic text-[#AEABD8]/70">
                          Awaiting turn
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Highest Bid Amount & Projected Payout */}
                <div className="text-right font-mono shrink-0">
                  {hasBids ? (
                    <div>
                      <div className={`text-xs sm:text-base font-black ${
                        isTop ? 'text-[#E41414]' : 'text-white'
                      }`}>
                        {formatCurrency(bidder.highestBid)}
                      </div>
                      {isTop && (
                        <span className="text-[9px] sm:text-[10px] font-bold text-[#02B15A] block">
                          Take-home: {formatCurrency(group.totalValue - bidder.highestBid)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] sm:text-xs font-semibold text-[#AEABD8]/70 italic">
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
            <div className="text-center py-10 rounded-2xl border border-[#27264E] bg-[#1D1D41] p-6 text-[#AEABD8]">
              <History className="mx-auto h-10 w-10 text-[#AEABD8] mb-2" />
              <h4 className="text-sm font-bold text-white">No Bidding Turns Recorded Yet</h4>
              <p className="text-[11px] text-[#AEABD8] max-w-xs mx-auto mt-1">
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
                      ? 'border-[#E41414]/50 bg-[#1D1D41] text-white ring-1 ring-[#E41414]/20'
                      : 'border-[#27264E] bg-[#1D1D41] text-[#AEABD8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black font-mono ${
                      isCurrentTop
                        ? 'bg-[#E41414] text-white'
                        : 'bg-[#141332] text-[#AEABD8] border border-[#27264E]'
                    }`}>
                      {bids.length - index}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate text-white">
                          {bid.memberName}
                        </span>
                        <span className="text-[10px] font-mono px-1 rounded bg-[#141332] text-[#AEABD8] border border-[#27264E]">
                          #{bid.ticketNumber}
                        </span>
                        {isCurrentTop && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-[#E41414] text-white">
                            Current Top
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-[#AEABD8]">
                        {bid.timestamp}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono shrink-0">
                    <span className="text-xs sm:text-sm font-black text-[#E41414]">
                      -{formatCurrency(bid.amount)}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-[#02B15A] block">
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
