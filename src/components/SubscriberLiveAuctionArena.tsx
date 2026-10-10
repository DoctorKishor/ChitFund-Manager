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
  PartyPopper,
  RefreshCw
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

  const [liveClockTime, setLiveClockTime] = useState<string>('11:42:15 AM');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setLiveClockTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const topBidderName = topBidObj
    ? topBidObj.memberName
    : rankedBidders.length > 0 && rankedBidders[0].highestBid > 0
    ? rankedBidders[0].fullName
    : 'Awaiting 1st Bid';

  const topBidderTicket = topBidObj
    ? topBidObj.ticketNumber
    : rankedBidders.length > 0 && rankedBidders[0].highestBid > 0
    ? rankedBidders[0].ticketNumber
    : (group.ticketNumber || 1);

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

      {/* ── 2. SCREEN 4: NATIVE ANDROID LIVE AUCTION SCOREBOARD ── */}
      <div className="-mx-3.5 sm:-mx-6 -mt-4 sm:-mt-6 pb-28">
        {/* TOP CANOPY HEADER (Royal Indigo with Status Bar, App Bar & Sub-Canopy) */}
        <header className="w-full bg-[#2A1DB8] text-white sticky top-0 z-30 shadow-md">
          {/* Status Bar */}
          <div className="w-full px-4 pt-2 pb-1 flex items-center justify-between text-[11px] font-semibold text-white/90 select-none">
            <span>9:09</span>
            <div className="flex items-center gap-1.5 opacity-90 text-[13px]">
              <span className="text-[11px] font-mono">5G</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-mono">100%</span>
            </div>
          </div>

          {/* App Bar */}
          <div className="h-14 px-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onExit}
                aria-label="Back"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors shrink-0 cursor-pointer"
              >
                <ArrowLeft size={22} className="text-white" />
              </button>
              <div className="flex flex-col truncate">
                <h1 className="font-bold text-[16px] leading-tight truncate text-white">Live Auction Scoreboard</h1>
                <span className="text-[11px] text-white/80 leading-none truncate mt-0.5">Offline Auction Floor · Desk Feed</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 text-white shadow-sm shrink-0 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white" />
              <span className="font-bold text-[11px] tracking-wide uppercase">LIVE</span>
              <Radio size={14} />
            </div>
          </div>

          {/* Sub Canopy Information Strip */}
          <div className="px-4 pb-3.5 pt-0.5 flex flex-col gap-1.5 border-t border-white/10 bg-[#2417a8]">
            <div className="flex items-center justify-between text-white">
              <span className="font-bold text-[13px] truncate">
                {group.groupName} · Month {group.currentMonth} of {group.durationMonths}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/15 text-[11px] font-semibold shrink-0 font-mono">
                Your Ticket: #{group.ticketNumber}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/80">
              <span className="flex items-center gap-1">
                <Users size={14} className="text-amber-300" /> {rankedBidders.length} Eligible Contenders
              </span>
              <span className="text-white/40">•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck size={14} className="text-emerald-300" /> Total Pot: ₹{group.totalValue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </header>

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="flex flex-col w-full px-3.5 pt-3 gap-3.5">
          {/* HERO LEADING DISCOUNT BID CARD */}
          <div className="relative w-full rounded-2xl overflow-hidden p-4 text-white bg-gradient-to-br from-[#1a00a7] via-[#2A1DB8] to-[#005cab] shadow-xl border border-white/15">
            <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />
            <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-blue-400/15 blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-3">
              {/* Top Row: Pill + Round/Sync */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20">
                  <Trophy size={14} className="text-amber-300" />
                  <span className="text-[11px] font-bold tracking-wider uppercase text-amber-200">
                    LEADING DISCOUNT BID
                  </span>
                </div>
                <span className="text-[11px] font-medium text-white/80 flex items-center gap-1 font-mono">
                  <RefreshCw size={12} className="text-emerald-400 animate-spin" /> {liveClockTime} · Round {group.currentMonth}
                </span>
              </div>

              {/* Big Discount Value Display */}
              <div className="flex items-baseline gap-2 pt-0.5 font-mono">
                <span className="text-[34px] font-black tracking-tight text-white leading-none drop-shadow-sm">
                  ₹{highestBid.toLocaleString('en-IN')}
                </span>
                <span className="text-[12px] font-bold uppercase tracking-wider text-white/80 bg-white/15 px-2 py-0.5 rounded font-sans">
                  Highest Discount
                </span>
              </div>

              {/* Current Top Contender Box */}
              <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-200 text-stone-900 font-extrabold flex flex-col items-center justify-center shadow-md shrink-0 ring-2 ring-amber-300/60">
                    <span className="text-[14px] leading-none">👑</span>
                    <span className="text-[10px] font-black">#1</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] truncate text-white">
                        {topBidderName} (Ticket #{topBidderTicket})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="px-1.5 py-0.5 bg-emerald-500/30 text-emerald-200 text-[10px] font-bold rounded border border-emerald-400/40 flex items-center gap-0.5">
                        <CheckCircle2 size={11} /> Current Top Contender
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-white/70 block uppercase font-medium">Floor Desk</span>
                  <span className="text-[12px] font-bold text-amber-300 font-mono">Shouted #{topBidderTicket}</span>
                </div>
              </div>

              {/* Winner Net Take-Home Box */}
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between text-white font-mono">
                <div className="flex items-center gap-2">
                  <Banknote size={20} className="text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[11px] block text-emerald-200/90 font-medium leading-tight font-sans">
                      Winner Net Take-Home
                    </span>
                    <span className="text-[16px] font-extrabold text-emerald-300 leading-tight">
                      ₹{netPayout.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/60 block font-mono">Pot − Discount</span>
                  <span className="text-[11px] font-semibold text-white/90">
                    ₹{group.totalValue.toLocaleString('en-IN')} − ₹{highestBid.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SEGMENTED TAB SELECTOR (Leaderboard vs Activity Log) */}
          <div className="w-full flex p-1 bg-[#EEF1F6] rounded-xl gap-1 select-none border border-[#E5E9F2]">
            <button
              type="button"
              onClick={() => setActiveSubTab('ranking')}
              className={`flex-1 py-2 rounded-lg font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'ranking'
                  ? 'bg-[#2A1DB8] text-white shadow-xs'
                  : 'text-[#636F85] hover:text-[#151B26]'
              }`}
            >
              <Trophy size={14} /> Live Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('feed')}
              className={`flex-1 py-2 rounded-lg font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'feed'
                  ? 'bg-[#2A1DB8] text-white shadow-xs font-bold'
                  : 'text-[#636F85] hover:text-[#151B26]'
              }`}
            >
              <History size={14} /> Turns Activity Log ({bids.length})
            </button>
          </div>

          {/* TAB CONTENT A: ACTIVE BIDDERS STANDING */}
          {activeSubTab === 'ranking' && (
            <div className="w-full bg-white rounded-2xl p-3.5 shadow-xs border border-[#E5E9F2] flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-[#E5E9F2]">
                <div className="flex items-center gap-1.5">
                  <Trophy size={16} className="text-[#2A1DB8]" />
                  <h2 className="font-bold text-[14px] text-[#151B26]">Active Bidders Standing</h2>
                </div>
                <span className="text-[11px] text-[#636F85] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {bids.length} Recorded Bids
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {rankedBidders.map((bidder, index) => {
                  const rank = index + 1;
                  const hasBids = bidder.highestBid > 0;
                  const isTop = bidder.isTopBidder && hasBids;
                  const isClimbing = climbingMemberIds.has(bidder.id);

                  // 1. Top Leader
                  if (isTop) {
                    return (
                      <div
                        key={bidder.id}
                        ref={(el) => {
                          if (el) cardRefs.current.set(bidder.id, el);
                          else cardRefs.current.delete(bidder.id);
                        }}
                        className={`p-2.5 rounded-xl bg-amber-50/80 border-2 border-amber-400 shadow-xs flex items-center justify-between gap-2.5 transition-all ${
                          isClimbing ? 'scale-[1.02] ring-2 ring-amber-300' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-400 text-stone-900 font-extrabold text-[12px] flex items-center justify-center shrink-0 shadow-xs">
                            👑
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-[13px] text-amber-950 truncate">{bidder.fullName}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-amber-200/80 text-amber-800 font-bold rounded font-mono">
                                #{bidder.ticketNumber}
                              </span>
                            </div>
                            <span className="text-[11px] text-amber-700 font-medium">Current Leading Bid</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono">
                          <div className="font-black text-[15px] text-amber-700">
                            ₹{bidder.highestBid.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium">
                            Take-home: ₹{(group.totalValue - bidder.highestBid).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 2. Current Viewing Subscriber (YOU)
                  if (bidder.isCurrentUser) {
                    return (
                      <div
                        key={bidder.id}
                        ref={(el) => {
                          if (el) cardRefs.current.set(bidder.id, el);
                          else cardRefs.current.delete(bidder.id);
                        }}
                        className={`p-2.5 rounded-xl bg-blue-50/80 border-2 border-[#2A1DB8] shadow-xs flex items-center justify-between gap-2.5 transition-all ${
                          isClimbing ? 'scale-[1.02] ring-2 ring-blue-300' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#2A1DB8] text-white font-bold text-[12px] flex items-center justify-center shrink-0 shadow-xs font-mono">
                            #{rank}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-[13px] text-[#151B26] truncate">{bidder.fullName}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-[#2A1DB8] text-white font-black rounded">
                                YOU
                              </span>
                            </div>
                            <span className="text-[11px] text-[#2A1DB8] font-semibold font-mono">
                              Your Ticket #{group.ticketNumber}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono">
                          <div className="font-extrabold text-[14px] text-[#2A1DB8]">
                            {hasBids ? `₹${bidder.highestBid.toLocaleString('en-IN')}` : 'No Bid Yet'}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 3. Other Contenders
                  return (
                    <div
                      key={bidder.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(bidder.id, el);
                        else cardRefs.current.delete(bidder.id);
                      }}
                      className={`p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E9F2] flex items-center justify-between gap-2.5 transition-all ${
                        isClimbing ? 'scale-[1.02] ring-2 ring-indigo-400' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#EEF1F6] text-[#636F85] font-bold text-[12px] flex items-center justify-center shrink-0 font-mono">
                          #{rank}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-[13px] text-[#151B26] truncate">{bidder.fullName}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-[#EEF1F6] text-[#636F85] font-mono rounded">
                              #{bidder.ticketNumber}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <div className="font-semibold text-[14px] text-[#151B26]">
                          {hasBids ? `₹${bidder.highestBid.toLocaleString('en-IN')}` : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB CONTENT B: TURNS ACTIVITY LOG */}
          {activeSubTab === 'feed' && (
            <div className="w-full bg-white rounded-2xl p-3.5 shadow-xs border border-[#E5E9F2] flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-[#E5E9F2]">
                <div className="flex items-center gap-1.5">
                  <History size={16} className="text-[#2A1DB8]" />
                  <h2 className="font-bold text-[14px] text-[#151B26]">Live Bidding Turns Stream</h2>
                </div>
                <span className="text-[11px] text-[#636F85] font-medium font-mono">
                  {bids.length} Total Shouts
                </span>
              </div>

              {bids.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-[#E5E9F2] bg-[#F8FAFC] p-4 text-[#636F85]">
                  <History className="mx-auto h-8 w-8 text-slate-400 mb-1.5" />
                  <h4 className="text-xs font-bold text-[#151B26]">No Bidding Turns Recorded Yet</h4>
                  <p className="text-[10px] text-[#636F85] mt-0.5">
                    As soon as the counter manager logs shouts and bids, real-time entries will appear here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {bids.map((bid, index) => {
                    const isCurrentTop = index === 0;
                    return (
                      <div
                        key={bid.id || `bid-${index}`}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                          isCurrentTop
                            ? 'border-amber-400 bg-amber-50/80 text-amber-950'
                            : 'border-[#E5E9F2] bg-[#F8FAFC] text-[#151B26]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black font-mono ${
                              isCurrentTop
                                ? 'bg-amber-400 text-stone-900'
                                : 'bg-[#EEF1F6] text-[#636F85]'
                            }`}
                          >
                            {bids.length - index}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate text-[#151B26]">
                                {bid.memberName}
                              </span>
                              <span className="text-[10px] font-mono px-1 rounded bg-[#EEF1F6] text-[#636F85]">
                                #{bid.ticketNumber}
                              </span>
                              {isCurrentTop && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-400 text-stone-900 font-mono">
                                  Top
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-[#636F85]">
                              {bid.timestamp}
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono shrink-0">
                          <span className="text-xs font-black text-amber-700">
                            -₹{bid.amount.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[9px] font-semibold text-emerald-600 block">
                            Pot: ₹{(group.totalValue - bid.amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* OFFLINE DESK FLOOR NOTICE */}
          <div className="rounded-2xl p-3 bg-white border border-[#E5E9F2] shadow-xs flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <Radio size={20} className="text-[#2A1DB8] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#636F85] leading-relaxed font-medium">
                Bids are shouted offline in person or over call, and recorded live by the Counter Manager.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
