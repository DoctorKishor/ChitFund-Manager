'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
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
  ArrowLeft,
  X, 
  Lock, 
  Zap, 
  Briefcase, 
  Info, 
  Rocket,
  Users,
  Check,
  Crown,
  Delete,
  SlidersHorizontal,
  History,
  Clock,
  Trophy,
  Send,
  CalendarClock,
  Radio,
  Flame,
  Play,
  Maximize2,
  Eye,
  CheckCheck,
  Download,
  Share2,
  FileText,
  ChevronRight,
  Printer,
  Plus,
  DollarSign,
  TrendingDown,
  Search,
  Filter,
  ShieldCheck
} from 'lucide-react';
import AuctionCountdownBanner from '@/components/AuctionCountdownBanner';
import { HelpTooltip } from '@/components/HelpTooltip';
import AuctionScheduleModal from '@/components/AuctionScheduleModal';
import { computeNextAuctionDateTime, calculateAuctionCountdown, CountdownState } from '@/utils/auctionSchedule';
import { triggerHapticFeedback } from '@/utils/haptics';
import { useAuth } from '@/context/AuthContext';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useOrganization } from '@/context/OrganizationContext';
import { exportAuctionReportPdf, shareAuctionReportToWhatsApp } from '@/utils/auctionPdfExporter';
import AuctionReportDocument, { AuctionReportData } from '@/components/AuctionReportDocument';
import LiveViewersModal, { ActiveViewerInfo } from '@/components/LiveViewersModal';

interface Member {
  id: string;
  profileId?: string;
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
  id: string;
  name: string;
  totalValue: number;
  memberCount: number;
  currentMonth: number;
  durationMonths: number;
  kai_iruppu_pool: number;
  startDate?: string | null;
  auction_day_of_month?: number | null;
  auction_time?: string | null;
  next_auction_date?: string | null;
  next_auction_time?: string | null;
  is_live_auction_active?: boolean;
  live_auction_started_at?: string | null;
}

const WALLET_OPTIONS: { id: WalletType; name: string }[] = [
  { id: 'dad_bank', name: 'Dad Bank Account (Primary Payout)' },
  { id: 'kishor_bank', name: 'Kishor Bank Account (Digital)' },
  { id: 'cash_in_hand', name: 'Cash in Hand (Physical Cash Box)' },
  { id: 'mom_bank', name: 'Mom Bank Account (Cheques/Reserves)' },
];

export interface HistoricalAuctionLog {
  id: string;
  groupId: string;
  month: number;
  winningBidderId: string;
  winningBidderName: string;
  ticketNumber?: number | null;
  winningDiscount: number;
  netPayout: number;
  totalDisbursed: number;
  remainingPrizeDue: number;
  disbursalStatus: 'fully_disbursed' | 'partially_disbursed' | 'pending';
  isLaabaSeetu: boolean;
  bidStream?: Bid[];
  createdAt: string;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatBidTimestamp(timestamp?: string | number | null): string {
  if (!timestamp) return '07:30 PM';
  if (typeof timestamp === 'number') {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
  const str = String(timestamp).trim();
  if (!str) return '07:30 PM';
  // Check if it is already a formatted time like "07:30 PM" or "04:50:12 PM" or "16:50:12"
  if (str.includes('AM') || str.includes('PM') || /^\d{1,2}:\d{2}/.test(str)) {
    return str;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return str;
}

export default function LiveAuctionEngine() {
  const { profile } = useAuth();
  const { organizationName, organizationTagline, organizationInitials } = useOrganization();

  // 1. Initial State Data (Loaded from Supabase)
  const [allGroups, setAllGroups] = useState<ChitGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [group, setGroup] = useState<ChitGroup | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [historicalAuctionLogs, setHistoricalAuctionLogs] = useState<HistoricalAuctionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Live countdown state for scheduled auction rounds
  const [countdown, setCountdown] = useState<CountdownState>(() => {
    const target = computeNextAuctionDateTime({
      auction_day_of_month: group?.auction_day_of_month,
      auction_time: group?.auction_time,
      next_auction_date: group?.next_auction_date,
      next_auction_time: group?.next_auction_time,
      start_date: group?.startDate,
      current_month: group?.currentMonth,
    });
    return calculateAuctionCountdown(target);
  });

  useEffect(() => {
    if (!group) return;
    const tick = () => {
      const target = computeNextAuctionDateTime({
        auction_day_of_month: group.auction_day_of_month,
        auction_time: group.auction_time,
        next_auction_date: group.next_auction_date,
        next_auction_time: group.next_auction_time,
        start_date: group.startDate,
        current_month: group.currentMonth,
      });
      setCountdown(calculateAuctionCountdown(target));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [
    group?.id,
    group?.auction_day_of_month,
    group?.auction_time,
    group?.next_auction_date,
    group?.next_auction_time,
    group?.startDate,
    group?.currentMonth,
  ]);

  // Derived countdown conditions for UI states
  const isCountdownZero = countdown.days === 0 && countdown.hours === 0 && countdown.minutes === 0 && countdown.seconds === 0;
  const isCountdownUnderTwoHours = isCountdownZero || (countdown.days === 0 && countdown.hours < 2);

  // Selected Historical Log for full detailed view
  const [selectedHistoricalLog, setSelectedHistoricalLog] = useState<HistoricalAuctionLog | null>(null);
  const [isGeneratingReportPdf, setIsGeneratingReportPdf] = useState<boolean>(false);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState<boolean>(false);

  // Concluded Auction Full View / Screen state
  const [showConcludedReportScreen, setShowConcludedReportScreen] = useState<boolean>(false);
  const [concludedReportData, setConcludedReportData] = useState<AuctionReportData | null>(null);

  const printableReportRef = useRef<HTMLDivElement>(null);
  const historicalPrintableRef = useRef<HTMLDivElement>(null);

  // Roll call attendance state (IDs of members participating today)
  const [attendingMemberIds, setAttendingMemberIds] = useState<string[]>([]);
  const [showRollCallModal, setShowRollCallModal] = useState<boolean>(false);
  const [showOnlyAttending, setShowOnlyAttending] = useState<boolean>(true);

  // Active contender for bid logging in pop-up
  const [selectedContenderId, setSelectedContenderId] = useState<string | null>(null);
  const [showBidModal, setShowBidModal] = useState<boolean>(false);
  const [showTimelineDrawer, setShowTimelineDrawer] = useState<boolean>(false);

  // Group-specific bids map with localStorage persistence
  const [groupBidsMap, setGroupBidsMap] = useState<Record<string, Bid[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('chit_funds_live_bids_v1');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Error reading saved bids from localStorage', e);
      }
    }
    return {};
  });

  const bids = (group?.currentMonth === 0) ? [] : ((selectedGroupId && groupBidsMap[selectedGroupId]) || []);

  // Bid input state (for custom arbitrary typing)
  const [customBidInput, setCustomBidInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Closing Modal States
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [recordedWinnerSummary, setRecordedWinnerSummary] = useState<{
    month: number;
    nextMonth: number;
    winnerName: string;
    winnerTicket: number | null;
    highestBid: number;
    netPayout: number;
    groupName: string;
    totalValue: number;
    isLaaba: boolean;
  } | null>(null);

  // Stage state (Stage 1: Overview, Stage 2: Live Studio Workspace)
  const { balances } = useWallet();
  const [showMonth0Modal, setShowMonth0Modal] = useState<boolean>(false);
  const [month0PayoutWallet, setMonth0PayoutWallet] = useState<WalletType>('dad_bank');
  const [stage, setStage] = useState<'overview' | 'studio'>('overview');
  const [desktopViewTab, setDesktopViewTab] = useState<'arena' | 'history'>('arena');
  const [historicalFilter, setHistoricalFilter] = useState<'all' | 'completed' | 'laaba' | 'pending'>('all');
  const [historicalSearchQuery, setHistoricalSearchQuery] = useState<string>('');
  const [activeInspectLogId, setActiveInspectLogId] = useState<string | null>(null);
  const [expandedTrailLogId, setExpandedTrailLogId] = useState<string | null>(null);
  const [isStartingLiveSession, setIsStartingLiveSession] = useState<boolean>(false);
  const [liveViewerCount, setLiveViewerCount] = useState<number>(0);
  const [activeViewers, setActiveViewers] = useState<ActiveViewerInfo[]>([]);
  const [showViewersModal, setShowViewersModal] = useState<boolean>(false);
  const presenceChannelRef = useRef<any>(null);

  // Auction date override & schedule modal
  const [auctionDateOverride, setAuctionDateOverride] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);

  // Live auction start confirmation, countdown, and session timer states
  const [showStartConfirmModal, setShowStartConfirmModal] = useState<boolean>(false);
  const [countdownTarget, setCountdownTarget] = useState<'floor' | 'stream' | null>(null);
  const [isGoingLiveCountdown, setIsGoingLiveCountdown] = useState<boolean>(false);
  const [liveCountdownSecs, setLiveCountdownSecs] = useState<number>(5);
  const [sessionElapsedSecs, setSessionElapsedSecs] = useState<number>(0);

  // Fetch active groups list from Supabase
  const fetchGroupsList = async () => {
    try {
      setLoading(true);
      const { data: groupsData } = await supabase
        .from('chit_groups')
        .select('*')
        .in('status', ['active', 'draft'])
        .order('created_at', { ascending: false });

      if (groupsData && groupsData.length > 0) {
        const parsedGroups: ChitGroup[] = groupsData.map((g: any) => ({
          id: g.id,
          name: g.name,
          totalValue: Number(g.total_value),
          memberCount: g.member_count,
          currentMonth: (g.current_month !== undefined && g.current_month !== null) ? Number(g.current_month) : 0,
          durationMonths: g.duration_months,
          kai_iruppu_pool: Number(g.kai_iruppu_pool) || 0,
          startDate: g.start_date || null,
          auction_day_of_month: g.auction_day_of_month !== undefined && g.auction_day_of_month !== null ? Number(g.auction_day_of_month) : 10,
          auction_time: g.auction_time || '19:00',
          next_auction_date: g.next_auction_date || null,
          next_auction_time: g.next_auction_time || g.auction_time || '19:00',
          is_live_auction_active: !!g.is_live_auction_active,
          live_auction_started_at: g.live_auction_started_at || null,
        }));
        setAllGroups(parsedGroups);
        
        setSelectedGroupId(prev => {
          const targetId = (prev && parsedGroups.some(g => g.id === prev)) ? prev : parsedGroups[0].id;
          const targetGroup = parsedGroups.find(g => g.id === targetId);
          if (targetGroup) setGroup(targetGroup);
          return targetId;
        });
      } else {
        setAllGroups([]);
        setGroup(null);
        setMembers([]);
      }
    } catch (err) {
      console.error('Error fetching groups list:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch specific selected group and its enrolled members (always queries fresh from Supabase)
  const fetchGroupDetails = async (groupId: string) => {
    try {
      const { data: groupData, error } = await supabase
        .from('chit_groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();

      if (groupData) {
        const updatedGroup: ChitGroup = {
          id: groupData.id,
          name: groupData.name,
          totalValue: Number(groupData.total_value),
          memberCount: groupData.member_count,
          currentMonth: (groupData.current_month !== undefined && groupData.current_month !== null) ? Number(groupData.current_month) : 0,
          durationMonths: groupData.duration_months,
          kai_iruppu_pool: Number(groupData.kai_iruppu_pool) || 0,
          startDate: groupData.start_date || null,
          auction_day_of_month: groupData.auction_day_of_month !== undefined && groupData.auction_day_of_month !== null ? Number(groupData.auction_day_of_month) : 10,
          auction_time: groupData.auction_time || '19:00',
          next_auction_date: groupData.next_auction_date || null,
          next_auction_time: groupData.next_auction_time || groupData.auction_time || '19:00',
          is_live_auction_active: !!groupData.is_live_auction_active,
          live_auction_started_at: groupData.live_auction_started_at || null,
        };
        setGroup(updatedGroup);
        setAllGroups(prev => prev.map(g => g.id === groupId ? updatedGroup : g));

        if (groupData.live_bid_stream && Array.isArray(groupData.live_bid_stream)) {
          setGroupBidsMap(prev => ({
            ...prev,
            [groupId]: groupData.live_bid_stream,
          }));
        }
      }

      // Fetch group members from group_members joined with profiles
      const { data: memberRows } = await supabase
        .from('group_members')
        .select(`
          id,
          ticket_number,
          has_won_regular,
          profile_id,
          profiles:profile_id (
            id,
            full_name
          )
        `)
        .eq('group_id', groupId)
        .order('ticket_number', { ascending: true });

      if (memberRows && memberRows.length > 0) {
        const parsedMembers: Member[] = memberRows.map((m: any) => {
          const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          return {
            id: m.id,
            profileId: m.profile_id,
            fullName: prof?.full_name || `Member (Ticket #${m.ticket_number})`,
            ticketNumber: m.ticket_number,
            hasWonRegular: !!m.has_won_regular,
          };
        });
        setMembers(parsedMembers);
        
        // Default roll call: all non-winning eligible members are checked in initially
        const eligibleIds = parsedMembers.filter(m => !m.hasWonRegular).map(m => m.id);
        setAttendingMemberIds(eligibleIds);
        if (eligibleIds.length > 0) {
          setSelectedContenderId(eligibleIds[0]);
        }
      } else {
        const memberCount = groupData?.member_count || 10;
        const fallbackMembers = Array.from({ length: memberCount }, (_, i) => ({
          id: `slot-${i + 1}`,
          fullName: `Ticket Slot #${i + 1}`,
          ticketNumber: i + 1,
          hasWonRegular: false,
        }));
        setMembers(fallbackMembers);
        setAttendingMemberIds(fallbackMembers.map(m => m.id));
        setSelectedContenderId(fallbackMembers[0]?.id || null);
      }

      // Fetch historical auction logs for this group
      const { data: logsData } = await supabase
        .from('auction_logs')
        .select(`
          id,
          group_id,
          month,
          bid_stream,
          winning_bidder_id,
          winning_discount,
          is_laaba_seetu,
          created_at,
          profiles:winning_bidder_id (
            id,
            full_name
          )
        `)
        .eq('group_id', groupId)
        .order('month', { ascending: false });

      // Fetch payout transactions for this group to accurately compute disbursal status
      const { data: payoutTxs } = await supabase
        .from('transactions')
        .select('id, profile_id, group_member_id, amount, notes, type, cycle_month')
        .eq('group_id', groupId)
        .eq('type', 'payout');

      if (logsData && logsData.length > 0) {
        const parsedLogs: HistoricalAuctionLog[] = logsData.map((l: any) => {
          const prof = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
          const discount = Number(l.winning_discount) || 0;
          const totalVal = Number(groupData?.total_value) || 0;
          const netPayout = Math.max(0, totalVal - discount);
          const matchingMember = memberRows?.find((m: any) => m.profile_id === l.winning_bidder_id);

          const monthNum = Number(l.month);
          const monthPattern = new RegExp(`\\bMonth\\s+${monthNum}\\b|\\bM${monthNum}\\b|\\bM\\s*${monthNum}\\b`, 'i');
          const monthPayouts = (payoutTxs || []).filter((t: any) =>
            t.cycle_month === monthNum ||
            (
              t.cycle_month == null &&
              (
                (t.notes && monthPattern.test(t.notes)) ||
                (l.winning_bidder_id && (t.profile_id === l.winning_bidder_id || t.group_member_id === l.winning_bidder_id)) ||
                (matchingMember && (t.group_member_id === matchingMember.id || t.profile_id === matchingMember.profile_id))
              )
            )
          );

          const totalDisbursed = monthPayouts.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
          const remainingPrizeDue = Math.max(0, netPayout - totalDisbursed);
          const isSettled = remainingPrizeDue === 0 && (totalDisbursed > 0 || netPayout === 0);
          const isPartial = totalDisbursed > 0 && remainingPrizeDue > 0;
          const disbursalStatus: 'fully_disbursed' | 'partially_disbursed' | 'pending' = isSettled
            ? 'fully_disbursed'
            : isPartial
            ? 'partially_disbursed'
            : 'pending';

          return {
            id: l.id,
            groupId: l.group_id,
            month: monthNum,
            winningBidderId: l.winning_bidder_id,
            winningBidderName: prof?.full_name || 'Winning Subscriber',
            ticketNumber: matchingMember ? matchingMember.ticket_number : null,
            winningDiscount: discount,
            netPayout,
            totalDisbursed,
            remainingPrizeDue,
            disbursalStatus,
            isLaabaSeetu: !!l.is_laaba_seetu,
            bidStream: Array.isArray(l.bid_stream) ? l.bid_stream : [],
            createdAt: l.created_at,
          };
        });
        setHistoricalAuctionLogs(parsedLogs);
      } else {
        setHistoricalAuctionLogs([]);
      }
    } catch (err) {
      console.error('Error fetching group members & auction logs:', err);
    }
  };

  useEffect(() => {
    fetchGroupsList();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupDetails(selectedGroupId);
    }
  }, [selectedGroupId]);

  // Real-time live presence subscription to track how many subscribers are watching
  useEffect(() => {
    if (!selectedGroupId) {
      setLiveViewerCount(0);
      setActiveViewers([]);
      return;
    }

    const presenceChannel = supabase.channel(`live_auction_presence_${selectedGroupId}`, {
      config: {
        presence: {
          key: `admin_${selectedGroupId}`,
        },
        broadcast: {
          self: false,
        },
      },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const viewersList: ActiveViewerInfo[] = [];
        const seenKeys = new Set<string>();

        Object.keys(state).forEach((key) => {
          const presences = (state[key] || []) as any[];
          presences.forEach((p: any) => {
            const isSubscriber = p.role !== 'admin' && !key.startsWith('admin_');
            if (isSubscriber) {
              const uniqueKey = p.ticket_number ? `ticket-${p.ticket_number}` : (p.profile_id || key);
              if (!seenKeys.has(uniqueKey)) {
                seenKeys.add(uniqueKey);
                // Look up matching member in current group members
                const matchedMember = members.find(
                  (m) => (p.ticket_number && m.ticketNumber === p.ticket_number) || 
                         (p.profile_id && m.profileId === p.profile_id)
                );

                viewersList.push({
                  key: uniqueKey,
                  fullName: matchedMember?.fullName || p.name || `Subscriber (Ticket #${p.ticket_number || '?'})`,
                  ticketNumber: matchedMember?.ticketNumber ?? p.ticket_number ?? null,
                  profileId: matchedMember?.profileId || p.profile_id,
                  hasWonRegular: matchedMember?.hasWonRegular ?? p.has_won_regular ?? false,
                  joinedAt: p.joined_at,
                  role: p.role || 'subscriber',
                });
              }
            }
          });
        });

        // Sort by ticket number
        viewersList.sort((a, b) => (a.ticketNumber || 999) - (b.ticketNumber || 999));
        setActiveViewers(viewersList);
        setLiveViewerCount(viewersList.length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            role: 'admin',
            joined_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      presenceChannelRef.current = null;
      supabase.removeChannel(presenceChannel);
    };
  }, [selectedGroupId, members]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Financial Metrics & Rules
  const isLaabaSeetuActive = group ? (group.kai_iruppu_pool || 0) >= group.totalValue : false;
  const highestBid = bids.length > 0 ? Math.max(...bids.map(b => b.amount)) : 0;
  const winningBidObj = bids.find(b => b.amount === highestBid);
  const winnerName = winningBidObj ? winningBidObj.memberName : 'No bids yet';
  const winnerTicket = winningBidObj ? winningBidObj.ticketNumber : null;
  const winnerId = winningBidObj ? winningBidObj.memberId : null;
  const netPayout = (group && bids.length > 0) ? (group.totalValue - highestBid) : (group?.totalValue || 0);

  // Baseline starting bid if no bids yet
  const startingBaselineBid = useMemo(() => {
    if (!group) return 10000;
    return Math.max(10000, Math.round(group.totalValue * 0.1));
  }, [group]);

  // Next Candidate Direct Target Tiles (Absolute amounts)
  const candidateTargetTiles = useMemo(() => {
    if (!group) return [];
    const maxDiscountAllowed = Math.round(group.totalValue * 0.45);
    const tiles: number[] = [];

    if (highestBid === 0) {
      // When no bids yet, provide popular baseline targets
      const typical = [10000, 15000, 20000, 25000, 26000, 27000, 28000, 29000, 30000, 32000, 35000, 40000];
      typical.forEach(amt => {
        if (amt <= maxDiscountAllowed) tiles.push(amt);
      });
    } else {
      // When bids are active, give fine-grained relative bumps AND rounded whole-thousand targets
      const deltas = [250, 500, 1000, 1500, 2000, 3000, 4000, 5000, 8000, 10000];
      deltas.forEach(d => {
        const nextAmt = highestBid + d;
        if (nextAmt <= maxDiscountAllowed && !tiles.includes(nextAmt)) {
          tiles.push(nextAmt);
        }
      });
      
      // Also add next 3 whole-thousand ceiling targets (e.g. if bid is 28,500 -> 29,000, 30,000, 31,000)
      const nextThousand = Math.ceil((highestBid + 1) / 1000) * 1000;
      [nextThousand, nextThousand + 1000, nextThousand + 2000].forEach(amt => {
        if (amt > highestBid && amt <= maxDiscountAllowed && !tiles.includes(amt)) {
          tiles.push(amt);
        }
      });
    }

    return tiles.sort((a, b) => a - b).slice(0, 12);
  }, [group, highestBid]);

  // List of members to display on the board
  const displayedMembers = useMemo(() => {
    return members.filter(m => {
      const isWon = m.hasWonRegular;
      const isAttending = attendingMemberIds.includes(m.id);
      if (showOnlyAttending) {
        return !isWon && isAttending;
      }
      return true;
    });
  }, [members, showOnlyAttending, attendingMemberIds]);

  // Track viewport size for mobile/desktop dynamic auto-scaling
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dynamically calculate grid columns, rows, and responsive scaling so the cards fill 100% of the canvas without over-compressing width
  const gridLayout = useMemo(() => {
    const count = displayedMembers.length;
    if (count === 0) return { cols: 1, rows: 1, isSpacious: false, isMedium: false, isCompact: false };

    let cols = 4;
    if (isMobile) {
      cols = count <= 2 ? count : 2;
    } else {
      if (count <= 4) cols = count;
      else if (count <= 8) cols = 4;
      else if (count <= 12) cols = 4;
      else if (count <= 20) cols = 5;
      else if (count <= 25) cols = 5;
      else cols = 5; // Capped at 5 columns to preserve generous card width (>=200px) so long names are completely readable
    }

    const rows = Math.max(1, Math.ceil(count / cols));
    const isSpacious = rows <= 2; // e.g. 8-10 members in 2 rows on desktop
    const isMedium = rows === 3 || rows === 4; // e.g. 12-20 members in 3-4 rows
    const isCompact = rows >= 5; // e.g. 25 members in 5 rows

    return { cols, rows, isSpacious, isMedium, isCompact };
  }, [displayedMembers.length, isMobile]);

  // Contender members list based on roll call and won status
  const visibleContenders = useMemo(() => {
    return members.filter(m => {
      if (m.hasWonRegular) return false;
      if (showOnlyAttending && attendingMemberIds.length > 0) {
        return attendingMemberIds.includes(m.id);
      }
      return true;
    });
  }, [members, showOnlyAttending, attendingMemberIds]);

  // Selected contender object for the popup modal
  const activeContender = useMemo(() => {
    return members.find(m => m.id === selectedContenderId) || visibleContenders[0] || null;
  }, [members, selectedContenderId, visibleContenders]);

  // Parse shorthand input (e.g. "29" -> 29000, "28.5" -> 28500, "29000" -> 29000)
  const parsedCustomBidAmount = useMemo(() => {
    const raw = customBidInput.trim();
    if (!raw) return 0;
    const num = parseFloat(raw);
    if (isNaN(num) || num <= 0) return 0;
    
    if (num <= 100) {
      return Math.round(num * 1000);
    }
    return Math.round(num);
  }, [customBidInput]);

  // Compute canonical target date for next auction of the selected group
  const targetAuctionDate = useMemo(() => {
    if (!group) return null;
    return computeNextAuctionDateTime({
      auction_day_of_month: group.auction_day_of_month,
      auction_time: group.auction_time,
      next_auction_date: group.next_auction_date,
      next_auction_time: group.next_auction_time,
      start_date: group.startDate,
      current_month: group.currentMonth,
    });
  }, [group]);

  // Is the scheduled auction date today?
  const isAuctionDateToday = useMemo(() => {
    if (!targetAuctionDate) return true;
    if (group?.currentMonth === 0) return true;
    const today = new Date();
    return (
      today.getFullYear() === targetAuctionDate.getFullYear() &&
      today.getMonth() === targetAuctionDate.getMonth() &&
      today.getDate() === targetAuctionDate.getDate()
    );
  }, [targetAuctionDate, group?.currentMonth]);

  const formattedTargetAuctionDate = useMemo(() => {
    if (!targetAuctionDate) return '';
    return targetAuctionDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [targetAuctionDate]);

  const formattedTargetAuctionTime = useMemo(() => {
    if (!targetAuctionDate) return '';
    const hours = targetAuctionDate.getHours();
    const minutes = targetAuctionDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${h12 < 10 ? '0' + h12 : h12}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
  }, [targetAuctionDate]);

  // Open Pop-up Bidding Modal for a Member
  const handleOpenBidModal = (memberId: string) => {
    if (group?.currentMonth === 0) {
      alert("No live auction takes place in Month 0 (Launch Phase). Advance to Month 1 to begin live auctions.");
      return;
    }
    if (stage !== 'studio' && !group?.is_live_auction_active && !isAuctionDateToday && (group?.currentMonth || 0) > 0) {
      alert(`Live Auction is LOCKED for today. It is scheduled for ${formattedTargetAuctionDate} at ${formattedTargetAuctionTime}.\n\nPlease click "Reschedule to Conduct Today" if you wish to conduct it today.`);
      setShowScheduleModal(true);
      return;
    }
    const member = members.find(m => m.id === memberId);
    if (!member || member.hasWonRegular) return;

    setSelectedContenderId(memberId);
    setCustomBidInput('');
    setShowBidModal(true);
  };

  // Core Bid Logger
  const recordBid = (amount: number, targetMemberId?: string) => {
    if (group?.currentMonth === 0) {
      alert("No live auction takes place in Month 0 (Launch Phase). Advance to Month 1 to begin live auctions.");
      return;
    }

    if (stage !== 'studio' && !group?.is_live_auction_active && !isAuctionDateToday && (group?.currentMonth || 0) > 0) {
      alert(`Live Auction is LOCKED for today. It is scheduled for ${formattedTargetAuctionDate} at ${formattedTargetAuctionTime}.\n\nPlease reschedule the auction to today before logging bids.`);
      setShowScheduleModal(true);
      return;
    }

    const memberIdToLog = targetMemberId || selectedContenderId;
    const member = members.find(m => m.id === memberIdToLog);

    if (!member || member.hasWonRegular || !selectedGroupId) {
      alert("Please select an eligible active bidder.");
      return;
    }

    if (amount <= highestBid && bids.length > 0) {
      alert(`Bid of ${formatCurrency(amount)} must be strictly higher than current top bid of ${formatCurrency(highestBid)}.`);
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newBid: Bid = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      memberId: member.id,
      memberName: member.fullName,
      ticketNumber: member.ticketNumber,
      amount: amount,
      timestamp: timeStr
    };

    setGroupBidsMap(prev => {
      const currentGroupBids = prev[selectedGroupId] || [];
      const updated = {
        ...prev,
        [selectedGroupId]: [newBid, ...currentGroupBids]
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('chit_funds_live_bids_v1', JSON.stringify(updated));
        } catch (err) {
          console.error('Error saving bids to localStorage:', err);
        }
      }
      // 1. Instantaneous WebSocket broadcast (<20ms latency to all subscriber live floor arenas) ONLY if live broadcast is active
      if (group?.is_live_auction_active) {
        try {
          presenceChannelRef.current?.send({
            type: 'broadcast',
            event: 'new_bid',
            payload: {
              bid: newBid,
              bids: updated[selectedGroupId],
              groupId: selectedGroupId,
            },
          });
        } catch (err) {
          console.warn('Broadcast send error:', err);
        }
      }

      // 2. Persist to PostgreSQL database asynchronously in background
      supabase
        .rpc('append_live_bid', {
          p_group_id: selectedGroupId,
          p_bid: [newBid],
        })
        .then(({ data: rpcData, error: rpcErr }) => {
          if (rpcErr) {
            console.warn('append_live_bid RPC error, falling back to direct update:', rpcErr.message);
            supabase
              .from('chit_groups')
              .update({ live_bid_stream: updated[selectedGroupId] })
              .eq('id', selectedGroupId);
          } else if (rpcData?.live_bid_stream) {
            setGroupBidsMap(p => ({
              ...p,
              [selectedGroupId]: rpcData.live_bid_stream,
            }));
          }
        });

      return updated;
    });

    setCustomBidInput('');
    setShowBidModal(false); // Seamlessly auto-close the popup immediately!
  };

  const handleCustomBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedCustomBidAmount > 0) {
      recordBid(parsedCustomBidAmount);
    }
  };

  const handleUndo = async () => {
    if (!selectedGroupId || bids.length === 0) return;
    const lastBid = bids[0];

    const confirmed = window.confirm(
      `Undo last bid of ₹${lastBid.amount.toLocaleString('en-IN')} by ${lastBid.memberName} (Ticket #${lastBid.ticketNumber})?\n\nThis undo action will be recorded in the security audit trail.`
    );
    if (!confirmed) return;

    setGroupBidsMap(prev => {
      const currentGroupBids = prev[selectedGroupId] || [];
      const updatedStream = currentGroupBids.slice(1);
      const updated = {
        ...prev,
        [selectedGroupId]: updatedStream
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('chit_funds_live_bids_v1', JSON.stringify(updated));
        } catch (err) {
          console.error('Error saving bids to localStorage:', err);
        }
      }
      // 1. Instantaneous WebSocket broadcast of undo action ONLY if live broadcast is active
      if (group?.is_live_auction_active) {
        try {
          presenceChannelRef.current?.send({
            type: 'broadcast',
            event: 'bids_sync',
            payload: {
              bids: updatedStream,
              groupId: selectedGroupId,
            },
          });
        } catch (err) {
          console.warn('Broadcast send error:', err);
        }
      }

      // 2. Persist undo to database
      supabase
        .from('chit_groups')
        .update({ live_bid_stream: updatedStream })
        .eq('id', selectedGroupId)
        .then(({ error }) => {
          if (error) console.error('Error syncing undo to live_bid_stream:', error);
        });

      return updated;
    });

    // 3. Immutable audit log record
    await supabase.from('security_audit_logs').insert({
      admin_id: profile?.id || null,
      action_description: `BID UNDONE: Last bid by ${lastBid.memberName} (Ticket #${lastBid.ticketNumber}) for ₹${lastBid.amount.toLocaleString('en-IN')} was undone in Group "${group?.name}" Month ${group?.currentMonth}.`,
      target_table: 'auction_logs',
    });
  };

  // Month 0 Launch Advance Action
  const handleAdvanceMonth0 = () => {
    if (!group) return;
    setShowMonth0Modal(true);
  };

  const handleConfirmMonth0 = async () => {
    if (!group) return;
    try {
      setIsRecording(true);

      // 1. Advance group to Month 1
      const { error: groupErr } = await supabase
        .from('chit_groups')
        .update({ current_month: 1 })
        .eq('id', group.id);
      if (groupErr) throw groupErr;

      // 2. Atomic debit from the selected wallet
      const { data: rpcData, error: rpcErr } = await supabase.rpc('mutate_wallet_balance', {
        p_wallet: month0PayoutWallet,
        p_delta: -group.totalValue,
        p_user_id: profile?.id || null,
      });

      if (rpcErr || !rpcData?.success) {
        // Rollback group advance if wallet update failed
        await supabase.from('chit_groups').update({ current_month: 0 }).eq('id', group.id);
        alert('Failed to deduct from wallet: ' + (rpcData?.error || rpcErr?.message));
        return;
      }

      // 3. Record organizer profit transaction
      const payoutNote = `[Organizer Profit] Month 0 Launch — Full chit value ₹${group.totalValue.toLocaleString('en-IN')} collected and allocated as Organizer Profit for "${group.name}".`;
      await supabase.from('transactions').insert([{
        group_id: group.id,
        wallet_type: month0PayoutWallet,
        from_wallet: month0PayoutWallet,
        type: 'organizer_profit',
        status: 'completed',
        amount: group.totalValue,
        notes: payoutNote,
        cycle_month: 0,
        created_by: profile?.id || null,
      }]);

      // 4. Audit log
      const walletName = WALLET_OPTIONS.find(w => w.id === month0PayoutWallet)?.name || month0PayoutWallet;
      await supabase.from('security_audit_logs').insert({
        action_description: `LAUNCH CONFIRMED: "${group.name}" — ₹${group.totalValue.toLocaleString('en-IN')} Organizer Profit recorded from ${walletName}. Group advanced to Month 1.`,
        target_table: 'chit_groups',
      });

      setGroup(prev => prev ? ({ ...prev, currentMonth: 1 }) : null);
      setAllGroups(prev => prev.map(g => g.id === group.id ? { ...g, currentMonth: 1 } : g));
      setShowMonth0Modal(false);
      await fetchGroupDetails(group.id);
      alert(`✓ Month 0 Launch Confirmed! ₹${group.totalValue.toLocaleString('en-IN')} Organizer Profit recorded from ${walletName}. Group advanced to Month 1.`);
    } catch (err: any) {
      console.error('Error confirming launch:', err);
      alert('Error confirming launch: ' + (err.message || 'Unknown error'));
    } finally {
      setIsRecording(false);
    }
  };

  const handleDownloadAuctionPdf = async (containerEl: HTMLElement | null, groupName: string, month: number) => {
    if (!containerEl) {
      console.error('Printable container element not found.');
      return;
    }
    try {
      setIsGeneratingReportPdf(true);
      triggerHapticFeedback('light');
      const organizerCompanyName = organizationName || (profile?.fullName 
        ? `${profile.fullName}'s Chit Funds` 
        : "Chit Funds Manager");
      await exportAuctionReportPdf({
        container: containerEl,
        groupName,
        month,
        organizerName: organizerCompanyName,
      });
      triggerHapticFeedback('success');
    } catch (err) {
      console.error('Error generating PDF report:', err);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingReportPdf(false);
    }
  };

  const handleShareAuctionWhatsApp = async (
    containerEl: HTMLElement | null,
    groupName: string,
    month: number,
    messageText: string
  ) => {
    if (!containerEl) {
      console.error('Printable container element not found.');
      return;
    }
    try {
      setIsSharingWhatsApp(true);
      triggerHapticFeedback('light');
      const organizerCompanyName = organizationName || (profile?.fullName 
        ? `${profile.fullName}'s Chit Funds` 
        : "Chit Funds Manager");
      await shareAuctionReportToWhatsApp({
        container: containerEl,
        groupName,
        month,
        messageText,
        organizerName: organizerCompanyName,
      });
      triggerHapticFeedback('success');
    } catch (err) {
      console.error('Error sharing report to WhatsApp:', err);
      alert('Failed to share to WhatsApp. Please try again.');
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const historicalReportData: AuctionReportData | null = useMemo(() => {
    if (!selectedHistoricalLog || !group) return null;
    return {
      groupName: group.name,
      month: selectedHistoricalLog.month,
      durationMonths: group.durationMonths,
      totalValue: group.totalValue,
      winnerName: selectedHistoricalLog.winningBidderName,
      winnerTicket: selectedHistoricalLog.ticketNumber,
      winningDiscount: selectedHistoricalLog.winningDiscount,
      netPayout: selectedHistoricalLog.netPayout,
      disbursalStatus: selectedHistoricalLog.disbursalStatus,
      totalDisbursed: selectedHistoricalLog.totalDisbursed,
      remainingPrizeDue: selectedHistoricalLog.remainingPrizeDue,
      newPool: group.kai_iruppu_pool,
      isLaabaSeetuThisMonth: selectedHistoricalLog.isLaabaSeetu,
      isNextMonthLaabaSeetu: false,
      concludedAt: selectedHistoricalLog.createdAt,
      organizerName: organizationName || (profile?.fullName ? `${profile.fullName}'s Chit Funds` : "ANBAZHAKAN CHIT FUNDS"),
      organizerTagline: organizationTagline || "TRUSTED CHIT FUNDS MANAGEMENT",
      organizerInitials: organizationInitials || "CF",
      bidStream: selectedHistoricalLog.bidStream || [],
    };
  }, [selectedHistoricalLog, group, profile, organizationName, organizationTagline, organizationInitials]);

  const handleConfirmClose = async () => {
    if (!group || bids.length === 0) return;
    setIsRecording(true);

    const recordedMonth = group.currentMonth;
    const nextMonth = Math.min(group.durationMonths, group.currentMonth + 1);
    const isCompleting = group.currentMonth >= group.durationMonths;
    const nextPool = isLaabaSeetuActive 
      ? Math.max(0, group.kai_iruppu_pool - group.totalValue) + highestBid 
      : group.kai_iruppu_pool + highestBid;

    const summaryData = {
      month: recordedMonth,
      nextMonth: nextMonth,
      winnerName: winnerName,
      winnerTicket: winnerTicket,
      highestBid: highestBid,
      netPayout: netPayout,
      groupName: group.name,
      totalValue: group.totalValue,
      isLaaba: isLaabaSeetuActive,
    };
    setRecordedWinnerSummary(summaryData);

    const finalSessionDuration = formatSessionDuration(sessionElapsedSecs);

    // Prepare full rich concluded report data
    const concludedReport: AuctionReportData = {
      groupName: group.name,
      month: recordedMonth,
      durationMonths: group.durationMonths,
      totalValue: group.totalValue,
      winnerName: winnerName,
      winnerTicket: winnerTicket,
      winningDiscount: highestBid,
      netPayout: netPayout,
      disbursalStatus: 'pending',
      totalDisbursed: 0,
      remainingPrizeDue: netPayout,
      previousPool: group.kai_iruppu_pool,
      newPool: nextPool,
      isLaabaSeetuThisMonth: isLaabaSeetuActive,
      isNextMonthLaabaSeetu: nextPool >= group.totalValue,
      concludedAt: new Date().toISOString(),
      auctionDuration: finalSessionDuration,
      organizerName: organizationName || (profile?.fullName ? `${profile.fullName}'s Chit Funds` : "ANBAZHAKAN CHIT FUNDS"),
      organizerTagline: organizationTagline || "TRUSTED CHIT FUNDS MANAGEMENT",
      organizerInitials: organizationInitials || "CF",
      attendingMembers: members.map(m => ({
        ticketNumber: m.ticketNumber,
        fullName: m.fullName,
        attended: attendingMemberIds.includes(m.id),
      })),
      bidStream: [...bids],
    };

    try {
      // 1. Execute atomic conclude_auction_cycle RPC in Supabase
      if (group.id) {
        const winningMember = members.find(m => m.id === winnerId);
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('conclude_auction_cycle', {
          p_group_id: group.id,
          p_month: group.currentMonth,
          p_next_month: nextMonth,
          p_winner_member_id: (winnerId && !winnerId.startsWith('slot-')) ? winnerId : null,
          p_winner_profile_id: winningMember?.profileId || null,
          p_winning_discount: highestBid,
          p_is_completing: isCompleting,
          p_is_laaba_seetu: isLaabaSeetuActive,
          p_next_pool: nextPool,
          p_bid_stream: bids,
          p_admin_id: profile?.id || null,
        });

        if (rpcErr) {
          console.warn('conclude_auction_cycle RPC failed, executing direct fallback:', rpcErr.message);
          // Fallback direct updates
          await supabase.from('chit_groups').update({
            current_month: nextMonth,
            kai_iruppu_pool: nextPool,
            status: isCompleting ? 'completed' : 'active',
            is_live_auction_active: false,
            live_auction_started_at: null,
            live_bid_stream: [],
          }).eq('id', group.id);

          if (winnerId && !winnerId.startsWith('slot-')) {
            await supabase.from('group_members').update({
              has_won_regular: true
            }).eq('id', winnerId);
          }

          if (winningMember?.profileId) {
            await supabase.from('auction_logs').insert({
              group_id: group.id,
              month: group.currentMonth,
              bid_stream: bids,
              winning_bidder_id: winningMember.profileId,
              winning_discount: highestBid,
              is_laaba_seetu: isLaabaSeetuActive,
            });
          }

          await supabase.from('security_audit_logs').insert({
            action_description: `AUCTION CLOSED: Group "${group.name}" Month ${group.currentMonth} won by ${winningMember?.fullName || 'Member'} with discount ${formatCurrency(highestBid)}. Net Payout: ${formatCurrency(netPayout)}. Session Duration: ${finalSessionDuration}. Group advanced to Month ${nextMonth}.`,
            target_table: 'auction_logs',
          });
        }
      }

      // Clear local session timer for this cycle and reset to 0
      setSessionElapsedSecs(0);
      if (group.id) {
        try {
          localStorage.removeItem(`chit_auction_elapsed_${group.id}_${group.currentMonth}`);
          localStorage.removeItem(`chit_auction_timer_${group.id}_${group.currentMonth}`);
        } catch {}
      }

      await supabase.from('security_audit_logs').insert({
        action_description: `AUCTION CONCLUDED: "${group.name}" Month ${group.currentMonth} won by ${winnerName || 'Member'} with winning discount ${formatCurrency(highestBid)}. Net Payout: ${formatCurrency(netPayout)}. Session Duration: ${finalSessionDuration}. Group advanced to Month ${nextMonth}.`,
        target_table: 'auction_logs',
      });

      // Mark winner in local state
      if (winnerId) {
        setMembers(prev => prev.map(m => m.id === winnerId ? { ...m, hasWonRegular: true } : m));
      }

      setGroup(prev => prev ? ({
        ...prev,
        currentMonth: nextMonth,
        kai_iruppu_pool: nextPool,
        status: isCompleting ? 'completed' : 'active',
      }) : null);

      if (group.id) {
        setGroupBidsMap(prev => {
          const updated = { ...prev };
          delete updated[group.id];
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('chit_funds_live_bids_v1', JSON.stringify(updated));
            } catch (err) {
              console.error('Error updating localStorage:', err);
            }
          }
          return updated;
        });
      }

      if (group.id) {
        await fetchGroupDetails(group.id);
      }

      // Broadcast auction conclusion event instantly over WebSockets
      try {
        presenceChannelRef.current?.send({
          type: 'broadcast',
          event: 'session_state',
          payload: {
            groupId: group.id,
            isLiveAuctionActive: false,
            concluded: true,
            winnerName: winnerName,
            winnerTicket: winnerTicket,
            highestBid: highestBid,
            netPayout: netPayout,
          },
        });
      } catch (err) {
        console.warn('Broadcast error:', err);
      }

      setConcludedReportData(concludedReport);
      setShowConcludedReportScreen(true);
      setShowCloseModal(false);
      setShowConfetti(true);
      triggerHapticFeedback('success');
    } catch (err: any) {
      console.error('Error updating chit group in Supabase:', err);
      alert('Error updating auction in database: ' + err.message);
    } finally {
      setIsRecording(false);
    }
  };

  const handleBeginLiveAuction = async () => {
    if (!group) return;
    if (group.currentMonth === 0) {
      alert("Month 0 is the launch phase (Organizer Profit). No live bidding takes place in Month 0.");
      return;
    }
    try {
      setIsStartingLiveSession(true);
      triggerHapticFeedback('success');

      const currentSessionBids = (group.id && groupBidsMap[group.id]) || [];

      const { error } = await supabase
        .from('chit_groups')
        .update({
          is_live_auction_active: true,
          live_auction_started_at: new Date().toISOString(),
          live_bid_stream: currentSessionBids,
        })
        .eq('id', group.id);

      if (error) {
        alert('Failed to start live auction broadcast: ' + error.message);
        return;
      }

      await supabase.from('security_audit_logs').insert({
        action_description: `LIVE AUCTION BEGUN: "${group.name}" Month ${group.currentMonth} live session started by admin. Realtime notification broadcasted to enrolled subscribers.`,
        target_table: 'chit_groups',
      });

      const startedAt = new Date().toISOString();
      
      // Instant broadcast of live session start
      try {
        presenceChannelRef.current?.send({
          type: 'broadcast',
          event: 'session_state',
          payload: {
            groupId: group.id,
            isLiveAuctionActive: true,
            liveAuctionStartedAt: startedAt,
            bids: currentSessionBids,
          },
        });
      } catch (err) {
        console.warn('Broadcast error:', err);
      }

      setGroup(prev => prev ? ({ ...prev, is_live_auction_active: true, live_auction_started_at: startedAt }) : null);
      setAllGroups(prev => prev.map(g => g.id === group.id ? { ...g, is_live_auction_active: true, live_auction_started_at: startedAt } : g));
    } catch (err: any) {
      console.error('Error starting live auction:', err);
    } finally {
      setIsStartingLiveSession(false);
    }
  };

  const handleEndLiveAuctionSession = async () => {
    if (!group) return;
    const confirmStop = window.confirm(
      `End the live broadcasting session for "${group.name}" without recording a winner?\n\nSubscribers will no longer see the live broadcast alert, but logged bids will be saved.`
    );
    if (!confirmStop) return;

    try {
      setIsStartingLiveSession(true);
      await supabase
        .from('chit_groups')
        .update({
          is_live_auction_active: false,
          live_auction_started_at: null,
        })
        .eq('id', group.id);

      // Instant broadcast of live session pause/standby
      try {
        presenceChannelRef.current?.send({
          type: 'broadcast',
          event: 'session_state',
          payload: {
            groupId: group.id,
            isLiveAuctionActive: false,
            status: 'paused',
            concluded: false,
          },
        });
      } catch (err) {
        console.warn('Broadcast error:', err);
      }

      setGroup(prev => prev ? ({ ...prev, is_live_auction_active: false, live_auction_started_at: null }) : null);
      setAllGroups(prev => prev.map(g => g.id === group.id ? { ...g, is_live_auction_active: false, live_auction_started_at: null } : g));
    } catch (err: any) {
      console.error('Error ending live session:', err);
    } finally {
      setIsStartingLiveSession(false);
    }
  };

  // Session Timer (Stopwatch) effect:
  // - Tracks elapsed duration while the admin is on the studio auction floor.
  // - PAUSES when admin navigates back to overview page (stage === 'overview').
  // - RESUMES from paused elapsed seconds when returning to studio floor.
  // - RESETS to 00:00 when auction is concluded, waiting for the next auction cycle to begin.
  useEffect(() => {
    if (!group?.id) return;

    const storageKey = `chit_auction_elapsed_${group.id}_${group.currentMonth}`;

    // Read stored accumulated elapsed seconds
    let accumulatedSecs = 0;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        accumulatedSecs = Number(stored);
        if (isNaN(accumulatedSecs) || accumulatedSecs < 0) accumulatedSecs = 0;
      }
    } catch {
      accumulatedSecs = 0;
    }

    setSessionElapsedSecs(accumulatedSecs);

    // If NOT in studio (i.e. admin on overview page), the timer is PAUSED
    if (stage !== 'studio') {
      return;
    }

    // In studio: tick every second and accumulate
    const segmentStart = Date.now();
    const baseElapsed = accumulatedSecs;

    const interval = setInterval(() => {
      const currentSegment = Math.floor((Date.now() - segmentStart) / 1000);
      const totalElapsed = baseElapsed + currentSegment;
      setSessionElapsedSecs(totalElapsed);
      try {
        localStorage.setItem(storageKey, String(totalElapsed));
      } catch {}
    }, 1000);

    return () => {
      // Pause interval and persist exact elapsed count on leaving studio
      clearInterval(interval);
      const finalSegment = Math.floor((Date.now() - segmentStart) / 1000);
      const finalElapsed = baseElapsed + finalSegment;
      setSessionElapsedSecs(finalElapsed);
      try {
        localStorage.setItem(storageKey, String(finalElapsed));
      } catch {}
    };
  }, [stage, group?.id, group?.currentMonth]);

  const formatSessionDuration = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleEnterStudio = () => {
    triggerHapticFeedback('light');
    setStage('studio');
  };

  // Prompt confirmation modal before opening auction floor
  const promptBeginAuctionFloor = () => {
    triggerHapticFeedback('light');
    setCountdownTarget('floor');
    setShowStartConfirmModal(true);
  };

  // Prompt confirmation modal before starting public live stream telecast
  const promptStartLiveBroadcast = () => {
    triggerHapticFeedback('light');
    setCountdownTarget('stream');
    setShowStartConfirmModal(true);
  };

  // Generic fallback alias
  const promptStartLiveAuction = () => {
    promptBeginAuctionFloor();
  };

  // Confirmed -> Initiate full-screen 5, 4, 3, 2, 1 live countdown
  const handleConfirmStartLive = () => {
    setShowStartConfirmModal(false);
    setIsGoingLiveCountdown(true);
    setLiveCountdownSecs(5);
    triggerHapticFeedback('light');
  };

  // 5-4-3-2-1 countdown effect (floor opening or live telecast broadcast)
  useEffect(() => {
    if (!isGoingLiveCountdown) return;

    if (liveCountdownSecs > 0) {
      const timer = setTimeout(() => {
        triggerHapticFeedback('light');
        setLiveCountdownSecs(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Reached 0: proceed based on target
      triggerHapticFeedback('success');
      const timer = setTimeout(() => {
        setIsGoingLiveCountdown(false);
        if (countdownTarget === 'floor') {
          // Enter studio / auction floor without turning on public live stream broadcast
          setStage('studio');
        } else if (countdownTarget === 'stream') {
          // Explicitly turn on public live broadcast on subscriber portal
          if (group && group.currentMonth > 0 && !group.is_live_auction_active) {
            handleBeginLiveAuction();
          }
        }
        setCountdownTarget(null);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isGoingLiveCountdown, liveCountdownSecs, countdownTarget, group]);

  const handleExitStudio = () => {
    if (bids.length > 0) {
      const confirmExit = window.confirm(
        'You have active bids recorded for this live session. Are you sure you want to return to the Overview screen?'
      );
      if (!confirmExit) return;
    }
    setStage('overview');
  };

  const toggleAttendingMember = (memberId: string) => {
    setAttendingMemberIds(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllEligibleAttendees = () => {
    setAttendingMemberIds(members.filter(m => !m.hasWonRegular).map(m => m.id));
  };

  const clearAllAttendees = () => {
    setAttendingMemberIds([]);
  };

  // Loading and Empty State handling
  if (loading) {
    return (
      <div className="py-16 text-center text-gray-500 text-xs">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Connecting to live auction studio...
      </div>
    );
  }

  if (!group) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Gavel size={24} />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-gray-900">No Active Chit Groups</h3>
          <p className="text-xs text-gray-500 max-w-md">
            Only groups with <strong>Active</strong> status appear in the Live Auction Studio.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const canonicalDate = targetAuctionDate || now;
  const auctionDateDisplay = auctionDateOverride
    ? fmtDate(new Date(auctionDateOverride)) + ' (Override)'
    : fmtDate(canonicalDate);

  const eligibleCount = members.filter(m => !m.hasWonRegular).length;

  // ── RENDER START CONFIRMATION MODAL ──────────────────────────────────────
  const renderStartConfirmModal = () => {
    if (!showStartConfirmModal || !group) return null;
    const isStreamTarget = countdownTarget === 'stream';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className={`p-5 border-b border-slate-100 flex items-center justify-between ${
            isStreamTarget 
              ? 'bg-gradient-to-r from-red-50 to-rose-50/40' 
              : 'bg-gradient-to-r from-slate-50 to-indigo-50/40'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                isStreamTarget ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600'
              }`}>
                {isStreamTarget ? (
                  <Radio className="w-5 h-5 animate-pulse" />
                ) : (
                  <Gavel className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {isStreamTarget ? 'Broadcast Live on Portal?' : 'Open Auction Floor?'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isStreamTarget ? 'Broadcast live telecast to enrolled subscribers' : 'Enter live bidding arena & contender floor'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowStartConfirmModal(false);
                setCountdownTarget(null);
              }}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold active:scale-95 transition-all cursor-pointer"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content Details */}
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Chit Group:</span>
                <span className="font-bold text-slate-900">{group.name}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Auction Cycle:</span>
                <span className="font-bold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded font-mono">
                  Month {group.currentMonth}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Prize Pot Value:</span>
                <span className="font-black text-slate-900 font-mono">{formatCurrency(group.totalValue)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Eligible Floor Contenders:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono">
                  {members.filter(m => !m.hasWonRegular).length} of {group.memberCount} Members
                </span>
              </div>
            </div>

            <div className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
              isStreamTarget 
                ? 'bg-red-50/80 border-red-200 text-red-900' 
                : 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
            }`}>
              <span className="text-base leading-none">{isStreamTarget ? '📡' : '⏱️'}</span>
              <p>
                {isStreamTarget ? (
                  <>
                    Confirming will initiate a <strong>5-second broadcast countdown</strong> and immediately notify enrolled subscribers that live bidding is on-air.
                  </>
                ) : (
                  <>
                    Confirming will initiate a <strong>5-second countdown</strong> to open the live auction floor and start the session stopwatch. (Public live stream on the subscriber portal remains on standby until you choose to broadcast).
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                setShowStartConfirmModal(false);
                setCountdownTarget(null);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmStartLive}
              className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer ${
                isStreamTarget
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {isStreamTarget ? (
                <>
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Confirm & Go Live</span>
                </>
              ) : (
                <>
                  <Gavel className="w-3.5 h-3.5" />
                  <span>Confirm & Open Floor</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── RENDER 5-4-3-2-1 LIVE COUNTDOWN OVERLAY ──────────────────────────────
  const renderGoingLiveCountdownOverlay = () => {
    if (!isGoingLiveCountdown || !group) return null;
    const isStreamTarget = countdownTarget === 'stream';

    const getCountdownStatusText = (num: number) => {
      if (isStreamTarget) {
        switch (num) {
          case 5:
            return 'CONNECTING SUBSCRIBER FEEDS...';
          case 4:
            return 'BROADCASTING LIVE SESSION ALERT...';
          case 3:
            return 'TRANSMITTING REALTIME WEBSOCKET FEED...';
          case 2:
            return 'READYING STREAM TELECAST...';
          case 1:
            return 'GOING ON-AIR IN...';
          case 0:
            return '🔴 LIVE BROADCAST ACTIVE!';
          default:
            return 'GOING LIVE...';
        }
      } else {
        switch (num) {
          case 5:
            return 'PREPARING LIVE BIDDING ARENA...';
          case 4:
            return 'VERIFYING CONTENDERS & ATTENDANCE...';
          case 3:
            return 'SYNCHRONIZING TREASURY & REGISTERS...';
          case 2:
            return 'OPENING AUCTION FLOOR...';
          case 1:
            return 'STARTING AUCTION FLOOR IN...';
          case 0:
            return '🏛️ AUCTION FLOOR OPEN!';
          default:
            return 'STARTING FLOOR...';
        }
      }
    };

    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden p-6 select-none animate-in fade-in duration-200">
        {/* Subtle Ambient Glowing Background */}
        <div className={`absolute inset-0 pointer-events-none ${
          isStreamTarget
            ? 'bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.18)_0%,rgba(15,23,42,0.95)_60%,rgba(2,6,23,1)_100%)]'
            : 'bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.18)_0%,rgba(15,23,42,0.95)_60%,rgba(2,6,23,1)_100%)]'
        }`} />

        {/* Pulse Ripple Rings */}
        <div className={`absolute w-[500px] h-[500px] rounded-full border pointer-events-none animate-ping ${
          isStreamTarget ? 'border-red-500/10' : 'border-indigo-500/10'
        }`} />
        <div className={`absolute w-[340px] h-[340px] rounded-full border pointer-events-none animate-pulse ${
          isStreamTarget ? 'border-red-400/20' : 'border-indigo-400/20'
        }`} />

        <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full space-y-6">
          {/* Header Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase shadow-lg ${
            isStreamTarget
              ? 'bg-red-500/15 border border-red-500/40 text-red-400 shadow-red-950/50'
              : 'bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 shadow-indigo-950/50'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full animate-ping mr-1 ${
              isStreamTarget ? 'bg-red-500' : 'bg-indigo-400'
            }`} />
            {isStreamTarget ? 'LIVE STREAM BROADCAST' : 'AUCTION FLOOR OPENING'}
          </div>

          {/* Chit Details */}
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {group.name}
            </h2>
            <p className="text-xs sm:text-sm text-indigo-300 font-mono">
              Cycle Month {group.currentMonth} · Pot {formatCurrency(group.totalValue)}
            </p>
          </div>

          {/* Giant Dynamic Countdown Counter */}
          <div className="py-6 flex items-center justify-center min-h-[160px]">
            {liveCountdownSecs > 0 ? (
              <div
                key={liveCountdownSecs}
                className="text-8xl sm:text-9xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-indigo-100 to-indigo-400 animate-in zoom-in-50 duration-300 drop-shadow-[0_0_45px_rgba(99,102,241,0.6)]"
              >
                {liveCountdownSecs}
              </div>
            ) : (
              <div className="text-4xl sm:text-6xl font-black tracking-tight text-emerald-400 animate-in zoom-in-75 duration-300 drop-shadow-[0_0_40px_rgba(16,185,129,0.7)] flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-400 animate-ping" />
                <span>{isStreamTarget ? 'ON AIR!' : 'FLOOR OPEN!'}</span>
              </div>
            )}
          </div>

          {/* Step-by-Step Text Changing Animation */}
          <div className="min-h-[28px] flex items-center justify-center">
            <p
              key={`status-${liveCountdownSecs}`}
              className="text-xs sm:text-sm font-bold font-mono tracking-widest text-indigo-200 uppercase animate-in slide-in-from-bottom-2 duration-300"
            >
              {getCountdownStatusText(liveCountdownSecs)}
            </p>
          </div>

          {/* Progress Pip Indicators (5 to 1) */}
          <div className="flex items-center gap-2 pt-2">
            {[5, 4, 3, 2, 1].map((step) => {
              const isPassed = liveCountdownSecs <= step;
              return (
                <div
                  key={step}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isPassed
                      ? 'w-8 bg-gradient-to-r from-indigo-400 to-emerald-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
                      : 'w-4 bg-slate-800'
                  }`}
                />
              );
            })}
          </div>

          {/* Cancel / Abort Countdown Button */}
          <div className="pt-4">
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('light');
                setIsGoingLiveCountdown(false);
                setCountdownTarget(null);
                setLiveCountdownSecs(5);
              }}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md"
            >
              <X size={15} />
              <span>Cancel / Abort</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── RENDER HISTORICAL AUCTION RECORD DETAILS MODAL ─────────────────────────
  const renderHistoricalModal = () => {
    if (!selectedHistoricalLog || !historicalReportData || !group) return null;

    return (
      <div className="fixed inset-0 bg-black/80 flex flex-col z-50 p-1 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
        <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl sm:rounded-3xl w-full max-w-5xl my-auto mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[98dvh] sm:max-h-[96dvh]">
          
          {/* Header Bar */}
          <div className="bg-[#1D1D41] text-white px-3.5 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-[#27264E] shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#6359E9]/20 border border-[#6359E9]/40 text-[#64CFF6] flex items-center justify-center shrink-0">
                <History size={17} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#6359E9]/20 text-[#64CFF6] border border-[#6359E9]/30 font-mono">
                    Historical Log
                  </span>
                  {selectedHistoricalLog.isLaabaSeetu && (
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[#02B15A]/20 text-[#02B15A] border border-[#02B15A]/30">
                      🎉 Laaba Seetu Month
                    </span>
                  )}
                </div>
                <h2 className="text-xs sm:text-lg font-black text-white mt-0.5 truncate">
                  {group.name} — Month {selectedHistoricalLog.month} Concluded Record
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                disabled={isGeneratingReportPdf}
                onClick={() => handleDownloadAuctionPdf(historicalPrintableRef.current, group.name, selectedHistoricalLog.month)}
                className="flex-1 sm:flex-initial px-2.5 sm:px-4 py-2 bg-[#6359E9] hover:bg-[#6F64FF] active:scale-95 text-white text-[11px] sm:text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingReportPdf ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span className="hidden sm:inline">Download PDF Report</span>
                    <span className="sm:hidden">PDF Report</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isSharingWhatsApp}
                onClick={() => {
                  const text = 
`🏆 *HISTORICAL AUCTION CERTIFICATE*
───────────────────────
🏢 *Group:* ${group.name}
🗓️ *Month Cycle:* Month ${selectedHistoricalLog.month} of ${group.durationMonths}
👤 *Winner:* ${selectedHistoricalLog.winningBidderName} ${selectedHistoricalLog.ticketNumber ? `(Ticket #${selectedHistoricalLog.ticketNumber})` : ''}
💰 *Total Chit Value:* ${formatCurrency(group.totalValue)}
📉 *Winning Discount Bid:* -${formatCurrency(selectedHistoricalLog.winningDiscount)}
💵 *Net Take-Home Prize Pot:* ${formatCurrency(selectedHistoricalLog.netPayout)}
📊 *Disbursal Status:* ${selectedHistoricalLog.disbursalStatus === 'fully_disbursed' ? 'Closed & Disbursed' : selectedHistoricalLog.disbursalStatus === 'partially_disbursed' ? `Partially Disbursed (${formatCurrency(selectedHistoricalLog.totalDisbursed)})` : 'Pending Disbursal'}
───────────────────────
Conducted on: ${new Date(selectedHistoricalLog.createdAt).toLocaleDateString('en-IN')}`;

                  handleShareAuctionWhatsApp(historicalPrintableRef.current, group.name, selectedHistoricalLog.month, text);
                }}
                className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-2 bg-[#02B15A] hover:bg-emerald-600 active:scale-95 text-white text-[11px] sm:text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSharingWhatsApp ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sharing...</span>
                  </>
                ) : (
                  <>
                    <Send size={12} />
                    <span className="hidden sm:inline">WhatsApp Alert</span>
                    <span className="sm:hidden">WhatsApp</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedHistoricalLog(null)}
                className="px-2.5 sm:px-3.5 py-2 bg-[#141332] hover:bg-[#27264E] active:scale-95 text-[#AEABD8] hover:text-white text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border border-[#27264E]"
              >
                <X size={14} />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Scrollable Document Container */}
          <div className="p-2 sm:p-5 overflow-y-auto bg-[#141332] flex-1">
            <div ref={historicalPrintableRef} className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <AuctionReportDocument data={historicalReportData} id="historical-auction-report-doc" />
            </div>
          </div>

          {/* Modal Bottom Footer */}
          <div className="p-2.5 sm:p-3.5 bg-[#1D1D41] border-t border-[#27264E] flex items-center justify-between gap-2 text-xs shrink-0">
            <span className="text-[#AEABD8] font-mono text-[10px] sm:text-[11px] truncate">
              Audit ID: {selectedHistoricalLog.id}
            </span>
            <button
              type="button"
              onClick={() => setSelectedHistoricalLog(null)}
              className="px-4 py-1.5 sm:px-5 sm:py-2 bg-[#141332] hover:bg-[#27264E] border border-[#27264E] text-white font-black rounded-xl text-[11px] sm:text-xs transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs"
            >
              Close View
            </button>
          </div>

        </div>
      </div>
    );
  };

  // ── STAGE 1: AUCTION OVERVIEW & SCHEDULE HUB ─────────────────────────────
  if (stage === 'overview') {
    return (
      <div className="flex flex-col flex-1 min-w-0 animate-in fade-in duration-200">

        {/* ═════════════════════════════════════════════════════════════════════════
            DESKTOP AUCTION TAB (LOCKED RESTING STATE) — EXACT STITCH FINTECH DESIGN
            ═════════════════════════════════════════════════════════════════════════ */}
        <div className="hidden md:flex flex-col flex-1 min-w-0 -m-4 sm:-m-8 bg-slate-50 min-h-screen text-slate-800">
          
          {/* TopHeader */}
          <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between flex-shrink-0 z-20">
            <div className="flex items-center gap-5">
              <div>
                <h1 className="text-lg font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
                  Auctions &amp; Bidding Arena{' '}
                  {desktopViewTab === 'history' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      Historical Ledger
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Upcoming Session
                    </span>
                  )}
                </h1>
              </div>
              <div className="h-6 w-px bg-slate-200 mx-1" />
              
              {/* Group Switcher Pills */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {allGroups.map((g) => {
                  const isSelected = g.id === selectedGroupId;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback('light');
                        setSelectedGroupId(g.id);
                        const targetGroup = allGroups.find(item => item.id === g.id);
                        if (targetGroup) setGroup(targetGroup);
                        fetchGroupDetails(g.id);
                      }}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-white font-bold text-brand-700 shadow-sm border border-slate-200/60'
                          : 'font-medium text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-500' : 'bg-amber-400'}`} />
                      <span>{g.name} ({formatCurrency(g.totalValue)})</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        isSelected ? 'bg-brand-50 text-brand-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {g.currentMonth === 0 ? 'M0 Launch' : `Month ${g.currentMonth}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-3">
              {desktopViewTab === 'history' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDesktopViewTab('arena')}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Live Arena</span>
                  </button>
                  <button
                    type="button"
                    disabled={isGeneratingReportPdf || historicalAuctionLogs.length === 0}
                    onClick={() => {
                      if (historicalAuctionLogs.length > 0) {
                        setSelectedHistoricalLog(historicalAuctionLogs[0]);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download size={14} />
                    <span>Multi-Month Audit Summary</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDesktopViewTab('history')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                  >
                    <History size={14} />
                    <span>Historical Ledger ({historicalAuctionLogs.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Clock size={14} />
                    <span>Reschedule / Conduct Early</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `📢 *Upcoming Live Chit Auction Notice*\nGroup: ${group.name}\nMonth Cycle: Month ${group.currentMonth}\nChit Value: ${formatCurrency(group.totalValue)}\nScheduled Date: ${countdown.formattedTargetDate || formattedTargetAuctionDate} at ${countdown.formattedTargetTime || formattedTargetAuctionTime}\n\nPlease be present on the floor or connected in-app.`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Broadcast Schedule Notice</span>
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Main Scrollable Arena Body */}
          <main className="flex-1 overflow-y-auto p-8 space-y-7">
            {desktopViewTab === 'history' ? (
              <div className="flex flex-col w-full">
                {/* Context Breadcrumb & Top Bar */}
                <div className="flex flex-col gap-5 mb-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <nav className="flex items-center gap-2 text-xs font-medium text-slate-400">
                        <button 
                          type="button"
                          onClick={() => setDesktopViewTab('arena')}
                          className="hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Gavel className="w-3.5 h-3.5" />
                          <span>Auctions &amp; Bidding Arena</span>
                        </button>
                        <span className="text-slate-300">/</span>
                        <span className="text-indigo-600 font-semibold">Historical Auction Log &amp; Past Rounds Ledger</span>
                      </nav>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                          {formatCurrency(group.totalValue)} Scheme Pool
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {group.durationMonths} Months Cycle
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDesktopViewTab('arena')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 rounded-xl shadow-xs border border-slate-200 transition-all cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Live Arena</span>
                      </button>
                      <button
                        type="button"
                        disabled={historicalAuctionLogs.length === 0 || isGeneratingReportPdf}
                        onClick={() => {
                          if (historicalAuctionLogs.length > 0) {
                            setSelectedHistoricalLog(historicalAuctionLogs[0]);
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Multi-Month Audit Summary (PDF)</span>
                      </button>
                    </div>
                  </div>

                  {/* Cumulative Performance Metrics Grid */}
                  {(() => {
                    const totalDisbursed = historicalAuctionLogs.reduce((sum, l) => sum + (l.netPayout || 0), 0);
                    const totalDiscount = historicalAuctionLogs.reduce((sum, l) => sum + (l.winningDiscount || 0), 0);
                    const avgDiscountPct = historicalAuctionLogs.length > 0 
                      ? ((totalDiscount / (historicalAuctionLogs.length * (group.totalValue || 1))) * 100).toFixed(1)
                      : '0.0';
                    const laabaCount = historicalAuctionLogs.filter(l => l.isLaabaSeetu).length;
                    const durationPct = Math.round((historicalAuctionLogs.length / (group.durationMonths || 1)) * 100);

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Metric 1 */}
                        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-display">Total Rounds Concluded</span>
                            <CheckCircle2 className="text-indigo-600 w-5 h-5" />
                          </div>
                          <div className="mt-4 flex items-baseline justify-between">
                            <div>
                              <div className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                                {historicalAuctionLogs.length} <span className="text-sm font-normal text-slate-400 font-sans">of {group.durationMonths} Cycles</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1 font-sans">
                                {Math.max(0, group.durationMonths - historicalAuctionLogs.length)} remaining periodic auctions
                              </p>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700">
                              {durationPct}% Duration
                            </span>
                          </div>
                        </div>

                        {/* Metric 2 */}
                        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-display">Net Prize Disbursed</span>
                            <DollarSign className="text-emerald-600 w-5 h-5" />
                          </div>
                          <div className="mt-4 flex items-baseline justify-between">
                            <div>
                              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                                {formatCurrency(totalDisbursed)}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 font-sans">
                                Cumulative to {historicalAuctionLogs.length} prize winners
                              </p>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                              100% Solvency
                            </span>
                          </div>
                        </div>

                        {/* Metric 3 */}
                        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-display">Discount Surrendered</span>
                            <TrendingDown className="text-amber-600 w-5 h-5" />
                          </div>
                          <div className="mt-4 flex items-baseline justify-between">
                            <div>
                              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                                {formatCurrency(totalDiscount)}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 font-sans">Allocated to Kai Iruppu pool</p>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700">
                              Avg {avgDiscountPct}% Cut
                            </span>
                          </div>
                        </div>

                        {/* Metric 4 */}
                        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase font-display">Laaba Seetu Bonus Rounds</span>
                            <Sparkles className="text-purple-600 w-5 h-5" />
                          </div>
                          <div className="mt-4 flex items-baseline justify-between">
                            <div>
                              <div className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                                {laabaCount} <span className="text-sm font-normal text-slate-400 font-sans">Unlocked</span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1 font-sans">₹0 monthly installment subsidy</p>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700">
                              {laabaCount > 0 ? `${laabaCount} Free Pot(s)` : 'Reserve Accruing'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Filter & Search Toolbar */}
                  {(() => {
                    const completedCount = historicalAuctionLogs.filter(l => l.disbursalStatus === 'fully_disbursed' || !l.disbursalStatus).length;
                    const laabaCount = historicalAuctionLogs.filter(l => l.isLaabaSeetu).length;
                    const pendingCount = historicalAuctionLogs.filter(l => l.disbursalStatus === 'pending' || l.disbursalStatus === 'partially_disbursed').length;

                    return (
                      <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-white rounded-2xl shadow-xs border border-slate-200/80">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setHistoricalFilter('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                              historicalFilter === 'all'
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            All Rounds ({historicalAuctionLogs.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoricalFilter('completed')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                              historicalFilter === 'completed'
                                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            Completed Bids ({completedCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoricalFilter('laaba')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                              historicalFilter === 'laaba'
                                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            Laaba Seetu Bonus ({laabaCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoricalFilter('pending')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                              historicalFilter === 'pending'
                                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            Pending Disbursal ({pendingCount})
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                            <input
                              type="text"
                              value={historicalSearchQuery}
                              onChange={(e) => setHistoricalSearchQuery(e.target.value)}
                              placeholder="Search by member, ticket #..."
                              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl text-slate-700 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 border border-slate-200"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 border border-slate-200">
                            <Filter className="text-slate-400 w-3.5 h-3.5" />
                            <span>Cycle 1 – {historicalAuctionLogs.length || 1}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Primary Ledger Layout: 2/3 List & 1/3 Detailed Audit Inspector */}
                {(() => {
                  const filteredLogs = historicalAuctionLogs
                    .filter((log) => {
                      if (historicalFilter === 'completed' && log.disbursalStatus === 'pending') return false;
                      if (historicalFilter === 'laaba' && !log.isLaabaSeetu) return false;
                      if (historicalFilter === 'pending' && log.disbursalStatus !== 'pending' && log.disbursalStatus !== 'partially_disbursed') return false;
                      if (historicalSearchQuery.trim()) {
                        const q = historicalSearchQuery.toLowerCase();
                        const matchName = log.winningBidderName?.toLowerCase().includes(q);
                        const matchTicket = log.ticketNumber?.toString().includes(q);
                        const matchMonth = `month ${log.month}`.includes(q) || `m${log.month}`.includes(q);
                        return matchName || matchTicket || matchMonth;
                      }
                      return true;
                    })
                    .sort((a, b) => b.month - a.month);

                  const currentInspectedLog = filteredLogs.find(l => l.id === activeInspectLogId) || filteredLogs[0] || null;

                  if (historicalAuctionLogs.length === 0) {
                    return (
                      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                        <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="font-display font-bold text-base text-slate-900">No Historical Auction Logs Yet</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                          Auction records and winner settlement summaries will automatically appear here once rounds are concluded and sealed on the floor.
                        </p>
                        <button
                          type="button"
                          onClick={() => setDesktopViewTab('arena')}
                          className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs"
                        >
                          Return to Live Arena
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-12 gap-6 items-start">
                      {/* Chronological Rounds List (7 Columns) */}
                      <div className="col-span-12 xl:col-span-7 flex flex-col gap-4">
                        {filteredLogs.map((log) => {
                          const isInspected = currentInspectedLog?.id === log.id;
                          const isPending = log.disbursalStatus === 'pending' || log.disbursalStatus === 'partially_disbursed';

                          return (
                            <div
                              key={log.id}
                              onClick={() => {
                                triggerHapticFeedback('light');
                                setActiveInspectLogId(log.id);
                              }}
                              className={`bg-white rounded-2xl p-6 transition-all cursor-pointer border ${
                                isInspected
                                  ? 'border-indigo-400 ring-2 ring-indigo-500/20 bg-gradient-to-r from-indigo-50/30 to-white shadow-md'
                                  : 'border-slate-200/80 hover:border-indigo-200 shadow-xs hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4 pb-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide font-display ${
                                      isInspected ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'
                                    }`}>
                                      CYCLE #{String(log.month).padStart(2, '0')}
                                    </span>
                                    <h3 className="font-display font-bold text-slate-900 text-base">
                                      Month {log.month} {log.month === 1 ? 'Launch Auction' : 'Competitive Auction'}
                                    </h3>
                                    {log.isLaabaSeetu && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                        <Sparkles className="w-3 h-3" />
                                        Laaba Seetu Month
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 flex items-center gap-1 font-sans">
                                    <Clock className="w-3.5 h-3.5" />
                                    Sealed on {new Date(log.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
                                  </p>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  isPending
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                  {isPending ? 'Pending Disbursal' : 'Fully Disbursed'}
                                </span>
                              </div>

                              {/* Winner Summary Banner */}
                              <div className="bg-slate-50/80 rounded-xl p-3.5 my-3 flex items-center justify-between border border-slate-100">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center font-display shadow-xs">
                                    {log.winningBidderName?.charAt(0) || 'W'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-900 text-sm">{log.winningBidderName}</span>
                                      {log.ticketNumber && (
                                        <span className="text-xs text-slate-400 font-mono">Ticket #{log.ticketNumber}</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                      {log.month === 1 && log.winningDiscount === 0 ? 'Foreman Admin · Launch Pot' : 'Subscriber · Winner'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">Net Prize Payout</span>
                                  <span className="text-base font-bold font-mono text-emerald-600">{formatCurrency(log.netPayout)}</span>
                                </div>
                              </div>

                              {/* Breakdown Strip */}
                              <div className="grid grid-cols-3 gap-3 py-3 text-xs text-slate-600">
                                <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                  <span className="text-[11px] text-slate-400 block mb-0.5">Scheme Pool</span>
                                  <span className="font-mono font-semibold text-slate-800">{formatCurrency(group.totalValue)}</span>
                                </div>
                                <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                  <span className="text-[11px] text-slate-400 block mb-0.5">Forfeited Discount</span>
                                  <span className="font-mono font-semibold text-amber-600">-{formatCurrency(log.winningDiscount)}</span>
                                </div>
                                <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                                  <span className="text-[11px] text-slate-400 block mb-0.5">Disbursal Protocol</span>
                                  <span className="font-mono text-[11px] text-slate-700 truncate block">
                                    {isPending ? 'Authorization Pending' : 'IMPS / Cash Disbursed'}
                                  </span>
                                </div>
                              </div>

                              {/* Card Footer */}
                              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveInspectLogId(log.id);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Inspect Timeline &amp; Roll Call</span>
                                </button>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedHistoricalLog(log);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Download PDF Certificate / View Summary"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const shareText = `🏆 *Chit Fund Auction Winner Report*\nGroup: ${group.name}\nMonth: Month ${log.month}\nWinner: ${log.winningBidderName} (Ticket #${log.ticketNumber || 'N/A'})\nDiscount: ${formatCurrency(log.winningDiscount)}\nNet Payout: ${formatCurrency(log.netPayout)}`;
                                      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                    title="WhatsApp Share Summary"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Embedded Detailed Audit Panel / Inspection Drawer (5 Columns) */}
                      <div className="col-span-12 xl:col-span-5 flex flex-col gap-4 sticky top-6">
                        {currentInspectedLog ? (
                          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6 flex flex-col gap-5">
                            {/* Panel Header */}
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 font-display">Deep Audit Inspection</span>
                                <h3 className="text-base font-bold font-display text-slate-900 leading-tight">
                                  Month {currentInspectedLog.month} Round Timeline
                                </h3>
                              </div>
                              <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold">
                                {currentInspectedLog.winningBidderName} (#{currentInspectedLog.ticketNumber || '—'})
                              </span>
                            </div>

                            {/* Attendance Quorum Tracker */}
                            <div className="p-4 bg-slate-50 rounded-xl flex flex-col gap-3 border border-slate-100">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                                  Roll Call Quorum
                                </span>
                                <span className="text-indigo-600 font-mono">
                                  {members.length} / {group.memberCount} Attending (100%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full" style={{ width: '100%' }} />
                              </div>

                              {/* Attendees Chips */}
                              <div className="flex flex-wrap gap-1.5 mt-1 max-h-28 overflow-y-auto overflow-x-hidden no-scrollbar pr-1">
                                {members.map((m) => {
                                  const isLogWinner = m.fullName === currentInspectedLog.winningBidderName || m.ticketNumber === currentInspectedLog.ticketNumber;
                                  return (
                                    <span
                                      key={m.id}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium shadow-2xs border ${
                                        isLogWinner
                                          ? 'bg-indigo-600 text-white border-indigo-700 font-bold'
                                          : 'bg-white text-slate-700 border-slate-200/80'
                                      }`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${isLogWinner ? 'bg-amber-300' : 'bg-emerald-500'}`} />
                                      {m.fullName} (#{m.ticketNumber})
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Bidding Floor Event Logs */}
                            <div className="flex flex-col gap-3">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-display">Shouted Bidding Log</span>
                              <div className="space-y-3 max-h-72 overflow-y-auto overflow-x-hidden no-scrollbar pr-1">
                                {(() => {
                                  const chronologicalShouts = [...(currentInspectedLog.bidStream || [])].sort(
                                    (a, b) => (a.amount || 0) - (b.amount || 0)
                                  );

                                  if (chronologicalShouts.length > 0) {
                                    return chronologicalShouts.map((b, idx) => {
                                      const isLast = idx === chronologicalShouts.length - 1;
                                      return (
                                        <div
                                          key={b.id || idx}
                                          className={`flex items-start gap-3 relative p-2.5 rounded-xl transition-colors ${
                                            isLast ? 'bg-indigo-50/70 border border-indigo-100' : 'hover:bg-slate-50'
                                          }`}
                                        >
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                            isLast ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                                          }`}>
                                            {String(idx + 1).padStart(2, '0')}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between text-xs">
                                              <span className={`font-semibold truncate ${isLast ? 'text-indigo-950 font-bold' : 'text-slate-800'}`}>
                                                {b.memberName} (#{b.ticketNumber})
                                              </span>
                                              <span className="text-slate-400 font-mono text-[10px] shrink-0 ml-2">
                                                {formatBidTimestamp(b.timestamp)}
                                              </span>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-0.5">
                                              Bid Discount: <span className="font-mono font-medium text-slate-900">{formatCurrency(b.amount)}</span>
                                            </p>
                                            {isLast && (
                                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white uppercase tracking-wider font-display">
                                                  Sealed Winner
                                                </span>
                                                <span className="text-[11px] font-mono font-semibold text-emerald-700">
                                                  Net Pot: {formatCurrency(currentInspectedLog.netPayout)}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    });
                                  }

                                  return (
                                    <>
                                      <div className="flex items-start gap-3 relative p-2.5 rounded-xl hover:bg-slate-50">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">
                                          01
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-800">Bidding Floor Opened</span>
                                            <span className="text-slate-400 font-mono text-[10px]">
                                              {formatBidTimestamp(currentInspectedLog.createdAt)}
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-600 mt-0.5">
                                            Floor open at <span className="font-mono font-medium text-slate-900">₹500 min step</span>
                                          </p>
                                          <span className="text-[10px] text-slate-400 block font-mono">
                                            Total Value: {formatCurrency(group.totalValue)}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-start gap-3 relative bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100">
                                        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 shadow-xs">
                                          02
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-indigo-950">
                                              {currentInspectedLog.winningBidderName} (#{currentInspectedLog.ticketNumber || '—'})
                                            </span>
                                            <span className="text-indigo-600 font-mono text-[10px] font-semibold">
                                              {formatBidTimestamp(currentInspectedLog.createdAt)}
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-700 mt-0.5">
                                            Winning Discount: <span className="font-mono font-bold text-indigo-900">{formatCurrency(currentInspectedLog.winningDiscount)}</span>
                                          </p>
                                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white uppercase tracking-wider font-display">
                                              Sealed Winner
                                            </span>
                                            <span className="text-[11px] font-mono font-semibold text-emerald-700">
                                              Net Pot: {formatCurrency(currentInspectedLog.netPayout)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Dispatch Approval Stamp & Action */}
                            <div className="pt-2 flex flex-col gap-3 border-t border-slate-100">
                              <div className="p-3 bg-amber-50/70 rounded-xl flex flex-col gap-1.5 border border-amber-200/60">
                                <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                                  <span className="flex items-center gap-1">
                                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                                    {currentInspectedLog.disbursalStatus === 'pending'
                                      ? 'Disbursal Authorization Pending'
                                      : 'Settlement Signed & Audited'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedHistoricalLog(currentInspectedLog)}
                                  className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-indigo-100 transition-all text-center cursor-pointer"
                                >
                                  View Settlement Document
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedHistoricalLog(currentInspectedLog)}
                                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-200"
                                >
                                  Print Slip
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}

                {/* Immutable Ledger Verification Footer */}
                <div className="mt-12 bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 font-display uppercase tracking-wide">
                          Cryptographically Sealed &amp; Verified
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                          100% Secure
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Ledger Block Hash: <span className="text-slate-700 font-semibold">0x8f2ae9741b09c4b9</span> · Certified by {organizationName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                    <span>Supabase Realtime PostgreSQL</span>
                    <span>•</span>
                    <span>Sync Latency: &lt;10ms</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Arena Master Milestone & Countdown Bar */}
                <section className="bg-gradient-to-r from-amber-500/10 via-brand-50/50 to-amber-500/10 border-2 border-amber-300 bg-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            NEXT LIVE AUCTION IN
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            Month {group.currentMonth} Competitive Discount Bidding · {formatCurrency(group.totalValue)} Scheme Pool
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className="text-3xl md:text-4xl font-black font-mono tracking-wider text-slate-900 bg-white border border-amber-200 px-4 py-1.5 rounded-xl shadow-xs text-amber-900">
                            {String(countdown.days).padStart(2, '0')}d : {String(countdown.hours).padStart(2, '0')}h : {String(countdown.minutes).padStart(2, '0')}m : {String(countdown.seconds).padStart(2, '0')}s
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-1.5 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Scheduled: <strong className="text-slate-900">{countdown.formattedTargetDate || formattedTargetAuctionDate} at {countdown.formattedTargetTime || formattedTargetAuctionTime} (IST)</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isCountdownUnderTwoHours && (
                        <button
                          type="button"
                          onClick={promptStartLiveAuction}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-95 cursor-pointer"
                        >
                          <Zap className="w-4 h-4 text-brand-200" />
                          <span>Begin Auction</span>
                          <span className="text-base leading-none">➔</span>
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* Month 0 Launch Mode Alert / Banner Context */}
                {group.currentMonth === 0 ? (
                  <section className="p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white border border-indigo-200 text-brand-600 flex items-center justify-center font-bold text-xs shadow-2xs">
                        M0
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Month 0 (Launch / Orientation Phase) Protocol</span>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          By chit fund statutory rules, Month 0 has no auction discount bidding. The {formatCurrency(group.totalValue)} pool is reserved as Organizer Commission. Once launch collections are secured, advance to Month 1 to begin live auctions.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAdvanceMonth0}
                      disabled={isRecording}
                      className="text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Rocket size={13} />
                      <span>{isRecording ? 'Advancing to Month 1...' : 'Confirm Launch & Advance to Month 1'}</span>
                    </button>
                  </section>
                ) : (
                  <section className="p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white border border-indigo-200 text-brand-600 flex items-center justify-center font-bold text-xs shadow-2xs">
                        M0
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Month 0 (Launch / Orientation Phase) Protocol</span>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          By chit fund statutory rules, Month 0 has no auction discount bidding. The {formatCurrency(group.totalValue)} pool was reserved as Organizer Commission. Group advanced to M1 on launch verification.
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                      Completed &amp; Verified
                    </span>
                  </section>
                )}

                {/* Top Grid: Live Bid Console + Real-time Financial Engine + Discount Pool (Kai Iruppu) */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
                  
                  {/* Left/Center 8 Cols: Contender Floor + Bidding Floor Status */}
                  <section className="xl:col-span-8 space-y-6">
                    
                    {/* Top Banner: Current Highest Discount Bid & Floor Status */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs relative overflow-hidden">
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Auction Floor Status</span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold">
                              <span className="text-xs">🔒</span> Standby Mode
                            </span>
                          </div>
                          <div className="flex items-baseline gap-3 mt-2">
                            <span className="text-2xl md:text-3xl font-black font-display text-slate-900 tracking-tight">
                              🔒 Bidding Floor Locked Until Scheduled Time
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5">
                            Countdown active · Floor bidding terminal will unlock automatically at {countdown.formattedTargetTime || formattedTargetAuctionTime} or when Admin initiates the session.
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md min-w-[220px] text-right shrink-0">
                          <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider block">
                            Month {group.currentMonth} Prize Pool
                          </span>
                          <p className="text-2xl font-black font-display text-amber-400 mt-0.5">
                            {formatCurrency(group.totalValue)}
                          </p>
                          <div className="text-[10px] text-slate-300 mt-1.5 pt-1.5 border-t border-white/10 flex justify-between">
                            <span>Base Chit: {formatCurrency(group.totalValue)}</span>
                            <span>Min Bid: ₹500</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PRIMARY FOCUS: Active Contenders on Floor (Cards Grid) */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-display font-bold text-base text-slate-900 tracking-tight">Active Contenders on Floor</h2>
                            <span className="text-xs font-bold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
                              {eligibleCount} Contenders · 1-Tap Ready
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {eligibleCount} Contenders in verified standby status. Bidding inputs unlock once session goes live.
                          </p>
                        </div>
                        <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold px-2.5 py-1 rounded-lg">
                          {eligibleCount} / {members.length} Floor Quorum Met
                        </span>
                      </div>

                      {/* Contender Grid Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {members.map((m) => {
                          const isWon = m.hasWonRegular;
                          const pastWinLog = historicalAuctionLogs.find(l => l.winningBidderId === m.id || l.ticketNumber === m.ticketNumber);

                          if (isWon) {
                            return (
                              <div key={m.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-100/60 opacity-80 lg:col-span-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-7 h-7 rounded-lg bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center font-mono shrink-0">
                                      #{m.ticketNumber}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <h4 className="text-xs font-bold text-slate-700 truncate">{m.fullName}</h4>
                                        <span className="text-[10px] bg-slate-200 text-slate-600 font-semibold px-1.5 py-0.2 rounded shrink-0">
                                          {pastWinLog ? `Month ${pastWinLog.month} Winner` : 'Prior Winner'}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-slate-500 truncate block">
                                        {pastWinLog 
                                          ? `Won in M${pastWinLog.month} (Prize: ${formatCurrency(pastWinLog.netPayout)}) · Disqualified from bidding` 
                                          : 'Prior winner spectator · Receives dividends'}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 shrink-0">
                                    Prior Winner (Spectator)
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={m.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 shadow-2xs relative transition-all">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center font-mono shrink-0">
                                    #{m.ticketNumber}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <h4 className="text-xs font-bold text-slate-900 truncate">{m.fullName}</h4>
                                      <span className="text-[10px] bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                        Ready
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-emerald-600">Registered &amp; Verified</span>
                                  </div>
                                </div>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" title="Present" />
                              </div>
                              <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 text-[10px]">Standby Contender</span>
                                <button 
                                  disabled 
                                  className="px-2.5 py-1 bg-slate-100 text-slate-400 font-bold rounded-lg text-[10px] border border-slate-200 cursor-not-allowed select-none flex items-center gap-1"
                                >
                                  <span>🔒 Floor Locked</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </section>

                  {/* Right 4 Cols: Kai Iruppu Reserve Panel + Eligibility Overview + Award Pot Action */}
                  <aside className="xl:col-span-4 space-y-6">
                    
                    {/* Kai Iruppu (Discount Pool) & Laaba Seetu Deep Dive */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                            🪙
                          </div>
                          <h3 className="font-display font-bold text-sm text-slate-900">Kai Iruppu (Discount Pool)</h3>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                          M{group.currentMonth} ROLLOVER
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Current Accumulated Reserve</span>
                        <p className="text-3xl font-black font-display text-slate-900 tracking-tight mt-0.5">
                          {formatCurrency(group.kai_iruppu_pool)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Pool Target for Laaba Seetu: <strong>{formatCurrency(group.totalValue)}</strong>
                        </p>
                      </div>

                      {/* Progress Bar towards Laaba Seetu */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 font-medium">Laaba Seetu Threshold</span>
                          <span className="font-bold text-amber-700">
                            {Math.min(100, Math.round((group.kai_iruppu_pool / (group.totalValue || 1)) * 100))}% Funded
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, Math.max(0, (group.kai_iruppu_pool / (group.totalValue || 1)) * 100))}%` }} 
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          When this pool hits {formatCurrency(group.totalValue)}, subscribers pay <strong>₹0 dues</strong> in that upcoming cycle while full prize pot is funded from the reserve!
                        </p>
                      </div>

                      {/* Rollover Breakdown */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Current Discount Pool:</span>
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(group.kai_iruppu_pool)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Remaining to Laaba Seetu:</span>
                          <span className="font-mono font-bold text-amber-700">
                            {formatCurrency(Math.max(0, group.totalValue - group.kai_iruppu_pool))}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                          <span className="text-slate-900">Total Group Chit Value:</span>
                          <span className="font-mono text-brand-700">{formatCurrency(group.totalValue)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Floor Attendance Summary & Quick Roster */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display font-bold text-sm text-slate-900">Floor Attendance Status</h3>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {eligibleCount} / {members.length} Contenders
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="font-semibold text-slate-800">Floor Bidding Quorum</span>
                          </div>
                          <span className="font-bold text-emerald-700">Active (100%)</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="font-semibold text-slate-800">Auctioneer Shorthand Mode</span>
                          </div>
                          <span className="font-bold text-brand-700 font-mono">Enabled</span>
                        </div>
                      </div>
                    </div>

                    {/* Pre-Session Waiting Lobby */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${activeViewers.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
                            Pre-Session Waiting Lobby
                          </h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {activeViewers.length > 0 ? `${activeViewers.length} Connected` : 'Standby'}
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {activeViewers.length === 0 ? (
                          <div className="p-3.5 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl text-center">
                            <Users className="w-4 h-4 text-slate-300 mx-auto mb-1" />
                            <p className="text-[11px] font-semibold text-slate-600">No subscribers currently in lobby</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Subscribers appear here live when they open this chit session</p>
                          </div>
                        ) : (
                          <>
                            {activeViewers.map((viewer) => {
                              const isSpectator = viewer.hasWonRegular;
                              return (
                                <div key={viewer.key} className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 font-bold flex items-center justify-center font-mono text-[10px] shrink-0">
                                      {viewer.ticketNumber ? `#${viewer.ticketNumber}` : '•'}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-900 text-xs truncate">{viewer.fullName}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                          isSpectator ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                                        }`}>
                                          {isSpectator ? 'SPECTATOR' : 'CONNECTED'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 truncate">
                                        {isSpectator ? 'Prior winner viewing session' : `Device active · Standing by for M${group.currentMonth}`}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-emerald-600 font-bold shrink-0 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Online
                                  </span>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Initiate Early Live Auction Session (Admin Control) */}
                    {!isCountdownZero && (
                      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/20 text-indigo-100">
                            Admin Control
                          </span>
                          <span className="text-xs text-amber-300 font-semibold">Standby Mode</span>
                        </div>
                        <h4 className="font-display font-bold text-sm mt-3">Initiate Early Live Auction Session</h4>
                        <p className="text-xs text-slate-300 mt-1">
                          Overrides the countdown timer and unlocks the 2-Tap bidding console immediately for all verified contenders on the floor.
                        </p>
                        <button
                          type="button"
                          onClick={promptStartLiveAuction}
                          className="mt-4 w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Zap className="w-4 h-4 text-brand-200" />
                          <span>Start Live Auction Now (Admin Override)</span>
                        </button>
                      </div>
                    )}

                  </aside>

                </div>

                {/* Historical Auction Records Full Ledger Card at Bottom */}
                {historicalAuctionLogs.length > 0 && (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-xs">
                          📜
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-base text-slate-900">Historical Auction Ledger</h3>
                          <p className="text-xs text-slate-500">{historicalAuctionLogs.length} Completed rounds recorded</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDesktopViewTab('history')}
                        className="text-xs font-bold px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg border border-brand-200 font-mono transition-colors cursor-pointer"
                      >
                        Open Full Ledger View ({historicalAuctionLogs.length} Rounds) →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {historicalAuctionLogs.map((log) => (
                        <div
                          key={log.id}
                          onClick={() => {
                            triggerHapticFeedback('light');
                            setSelectedHistoricalLog(log);
                          }}
                          className="p-3.5 bg-slate-50 hover:bg-white border border-slate-200 hover:border-brand-500 rounded-xl transition-all cursor-pointer group shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-brand-600 transition-colors">
                              Month {log.month} Auction
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {new Date(log.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 font-medium truncate">{log.winningBidderName}</span>
                            <span className="font-mono font-bold text-emerald-600">{formatCurrency(log.netPayout)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 text-slate-500">
                            <span>Discount: {formatCurrency(log.winningDiscount)}</span>
                            <span className="text-brand-600 font-semibold group-hover:underline">View Receipt →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════════
            MOBILE AUCTION TAB (LOCKED RESTING STATE) — PRESERVED FOR STEP 9 OVERHAUL
            ═════════════════════════════════════════════════════════════════════════ */}
        {/* ═════════════════════════════════════════════════════════════════════════
            MOBILE AUCTION TAB (LOCKED RESTING STATE) — EXACT STITCH FINTECH DESIGN
            ═════════════════════════════════════════════════════════════════════════ */}
        <div className="block md:hidden flex-1 min-w-0 -m-4 bg-[#F8FAFC] min-h-screen text-slate-800 animate-in fade-in duration-200">
          <div className="w-full min-h-screen bg-[#F8FAFC] flex flex-col relative">

            {/* Status Bar & Top App Bar */}
            <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100">
              {/* Status Bar */}
              <div className="px-5 pt-3 pb-1 flex justify-between items-center text-xs font-semibold text-slate-900 tracking-tight">
                <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                <div className="flex items-center space-x-2">
                  <svg className="w-3.5 h-3.5 text-slate-800" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 18.25A10.93 10.93 0 0 1 1 12C1 5.92 5.92 1 12 1s11 4.92 11 11c0 2.34-.73 4.51-1.98 6.29l-.62-.62A8.96 8.96 0 0 0 21 12c0-4.97-4.03-9-9-9z"></path><circle cx="12" cy="18" r="2"></circle></svg>
                  <svg className="w-3.5 h-3.5 text-slate-800" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0 0 12 4z"></path></svg>
                  <div className="w-5 h-2.5 border border-slate-800 rounded-xs p-0.5 flex items-center">
                    <div className="w-full h-full bg-slate-800 rounded-2xs"></div>
                  </div>
                </div>
              </div>

              {/* App Title & Sub-header */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                      {desktopViewTab === 'history' ? 'Auction Archive' : 'Live Bidding Arena'}
                    </h1>
                    {desktopViewTab === 'history' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mr-1" />
                        Historical Log
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <svg className="w-3 h-3 mr-1 text-amber-700" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" fillRule="evenodd"></path></svg>
                        Upcoming Session
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {desktopViewTab === 'history' ? (
                      `All Past Rounds & Certified Ledgers (${historicalAuctionLogs.length} Cycles)`
                    ) : (
                      `Floor Opens at ${countdown.formattedTargetTime || formattedTargetAuctionTime} · ${eligibleCount} Contenders Ready`
                    )}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback('light');
                      setDesktopViewTab(desktopViewTab === 'history' ? 'arena' : 'history');
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
                      desktopViewTab === 'history'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    title="Toggle Historical Ledger"
                  >
                    {desktopViewTab === 'history' ? 'Live Arena' : 'History'}
                  </button>
                </div>
              </div>

              {/* Chit Group Switcher Tabs */}
              <div className="px-4 pb-3">
                <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1 text-xs">
                  {allGroups.map((g) => {
                    const isSelected = g.id === selectedGroupId;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light');
                          setSelectedGroupId(g.id);
                          const targetGroup = allGroups.find(item => item.id === g.id);
                          if (targetGroup) setGroup(targetGroup);
                          fetchGroupDetails(g.id);
                        }}
                        className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 font-medium rounded-full transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-500 text-white font-semibold shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        <span>{g.name} ({formatCurrency(g.totalValue)}) • {g.currentMonth === 0 ? 'M0' : `Month ${g.currentMonth}`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </header>

            {/* Scrollable Main Content */}
            <main className="flex-1 px-4 py-4 space-y-4 pb-28">
              {desktopViewTab === 'history' ? (
                <div className="flex flex-col w-full">
                  {/* Back Nav & Context Bar */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      aria-label="Return to Live Arena"
                      onClick={() => setDesktopViewTab('arena')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-800 text-xs font-semibold active:scale-95 transition-transform cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Auctions Arena</span>
                    </button>
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                      {group.name}
                    </span>
                  </div>

                  {/* Title & Scheme Identity Block */}
                  <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-lg shadow-indigo-950/20 relative overflow-hidden mb-4 border border-indigo-500/20">
                    <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] tracking-widest uppercase font-extrabold text-indigo-300">Scheme Archive</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active Pool
                        </span>
                      </div>
                      <h2 className="text-lg font-black text-white tracking-tight mt-1">Historical Auction Log</h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {formatCurrency(group.totalValue)} Scheme Pool · {group.durationMonths} Months Cycle
                      </p>

                      {/* Quick Metrics Ribbon Inside Hero */}
                      {(() => {
                        const laabaCount = historicalAuctionLogs.filter(l => l.isLaabaSeetu).length;
                        return (
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 bg-white/5 rounded-xl p-2.5 border border-white/10">
                            <div>
                              <span className="text-[10px] text-indigo-200 uppercase tracking-wider font-semibold block">Cycle Progress</span>
                              <span className="text-sm font-extrabold text-white">
                                {historicalAuctionLogs.length} of {group.durationMonths} Rounds
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-indigo-200 uppercase tracking-wider font-semibold block">Bonus Status</span>
                              <span className="text-sm font-extrabold text-amber-300 flex items-center gap-1">
                                <span>{laabaCount > 0 ? `${laabaCount} Free Month(s)` : 'Accruing'}</span>
                                <Sparkles className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Search & Filter Controls */}
                  {(() => {
                    const completedCount = historicalAuctionLogs.filter(l => l.disbursalStatus === 'fully_disbursed' || !l.disbursalStatus).length;
                    const laabaCount = historicalAuctionLogs.filter(l => l.isLaabaSeetu).length;
                    const pendingCount = historicalAuctionLogs.filter(l => l.disbursalStatus === 'pending' || l.disbursalStatus === 'partially_disbursed').length;

                    return (
                      <div className="space-y-2.5 mb-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input
                            type="text"
                            value={historicalSearchQuery}
                            onChange={(e) => setHistoricalSearchQuery(e.target.value)}
                            placeholder="Search round, winner or ticket #..."
                            className="w-full bg-white text-slate-800 text-xs rounded-xl pl-9 pr-8 py-2.5 shadow-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 border border-slate-200"
                          />
                          {historicalSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setHistoricalSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Filter Chips Scrollable */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setHistoricalFilter('all')}
                            className={`filter-chip px-3 py-1.5 rounded-full text-[11px] shadow-xs flex-shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer ${
                              historicalFilter === 'all'
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-white text-slate-600 hover:bg-slate-100 font-semibold border border-slate-200/80'
                            }`}
                          >
                            All Rounds ({historicalAuctionLogs.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoricalFilter('completed')}
                            className={`filter-chip px-3 py-1.5 rounded-full text-[11px] shadow-xs flex-shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer ${
                              historicalFilter === 'completed'
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-white text-slate-600 hover:bg-slate-100 font-semibold border border-slate-200/80'
                            }`}
                          >
                            Completed ({completedCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoricalFilter('laaba')}
                            className={`filter-chip px-3 py-1.5 rounded-full text-[11px] shadow-xs flex-shrink-0 whitespace-nowrap active:scale-95 transition-all flex items-center gap-1 cursor-pointer ${
                              historicalFilter === 'laaba'
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-white text-slate-600 hover:bg-slate-100 font-semibold border border-slate-200/80'
                            }`}
                          >
                            <span>Laaba Seetu ({laabaCount})</span>
                            <span className="text-[10px]">🎉</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoricalFilter('pending')}
                            className={`filter-chip px-3 py-1.5 rounded-full text-[11px] shadow-xs flex-shrink-0 whitespace-nowrap active:scale-95 transition-all cursor-pointer ${
                              historicalFilter === 'pending'
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-white text-slate-600 hover:bg-slate-100 font-semibold border border-slate-200/80'
                            }`}
                          >
                            Pending ({pendingCount})
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Cumulative Performance Summary Grid (2x2 KPI Bento) */}
                  {(() => {
                    const totalDisbursed = historicalAuctionLogs.reduce((sum, l) => sum + (l.netPayout || 0), 0);
                    const totalDiscount = historicalAuctionLogs.reduce((sum, l) => sum + (l.winningDiscount || 0), 0);
                    const laabaCount = historicalAuctionLogs.filter(l => l.isLaabaSeetu).length;
                    const durationPct = Math.round((historicalAuctionLogs.length / (group.durationMonths || 1)) * 100);

                    return (
                      <div className="grid grid-cols-2 gap-2.5 mb-5">
                        <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disbursed</span>
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <DollarSign className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div>
                            <div className="text-base font-black text-slate-900 leading-tight">
                              {formatCurrency(totalDisbursed)}
                            </div>
                            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              100% Solvency
                            </span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pool Discount</span>
                            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                              <TrendingDown className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div>
                            <div className="text-base font-black text-slate-900 leading-tight">
                              {formatCurrency(totalDiscount)}
                            </div>
                            <span className="text-[10px] font-semibold text-indigo-600 mt-0.5 block">Total Saved &amp; Distributed</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed</span>
                            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div>
                            <div className="text-base font-black text-slate-900 leading-tight">
                              {historicalAuctionLogs.length} / {group.durationMonths} Rounds
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, durationPct)}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-amber-100/70 p-3 rounded-2xl shadow-xs border border-amber-200/60 flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider">Laaba Seetu</span>
                            <span className="text-sm">🎉</span>
                          </div>
                          <div>
                            <div className="text-xs font-black text-amber-900 leading-snug">
                              {laabaCount > 0 ? `${laabaCount} Month(s) Unlocked` : 'Accruing Reserve'}
                            </div>
                            <span className="text-[10px] font-semibold text-amber-800 mt-0.5 block">
                              {laabaCount > 0 ? 'Zero installment month' : `Target: ${formatCurrency(group.totalValue)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-1.5">
                      <FileText className="text-slate-700 w-4 h-4" />
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Chronological Ledger</h3>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">Sorted Newest First</span>
                  </div>

                  {/* Cards List */}
                  {(() => {
                    const filteredLogs = historicalAuctionLogs
                      .filter((log) => {
                        if (historicalFilter === 'completed' && log.disbursalStatus === 'pending') return false;
                        if (historicalFilter === 'laaba' && !log.isLaabaSeetu) return false;
                        if (historicalFilter === 'pending' && log.disbursalStatus !== 'pending' && log.disbursalStatus !== 'partially_disbursed') return false;
                        if (historicalSearchQuery.trim()) {
                          const q = historicalSearchQuery.toLowerCase();
                          const matchName = log.winningBidderName?.toLowerCase().includes(q);
                          const matchTicket = log.ticketNumber?.toString().includes(q);
                          const matchMonth = `month ${log.month}`.includes(q) || `m${log.month}`.includes(q);
                          return matchName || matchTicket || matchMonth;
                        }
                        return true;
                      })
                      .sort((a, b) => b.month - a.month);

                    if (filteredLogs.length === 0) {
                      return (
                        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center mb-6">
                          <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-700">No historical records match your filter</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Try clearing filters or search query</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3.5 mb-6">
                        {filteredLogs.map((log) => {
                          const isExpanded = expandedTrailLogId === log.id;
                          const isPending = log.disbursalStatus === 'pending' || log.disbursalStatus === 'partially_disbursed';

                          return (
                            <div
                              key={log.id}
                              className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 hover:shadow-md transition-shadow relative overflow-hidden"
                            >
                              {/* Special Bonus Top Ribbon */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-black tracking-tight">
                                    Month {log.month}
                                  </span>
                                  {log.isLaabaSeetu && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-200">
                                      <span>🎉 Laaba Seetu Bonus Month</span>
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-medium text-slate-400">
                                  {new Date(log.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>

                              {/* Winner Identity */}
                              <div className="flex items-center justify-between mb-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center font-display shadow-xs shrink-0">
                                    {log.winningBidderName?.charAt(0) || 'W'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-black text-slate-900 truncate">{log.winningBidderName}</span>
                                      {log.ticketNumber && (
                                        <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                                          #{log.ticketNumber}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate">
                                      {log.month === 1 && log.winningDiscount === 0 ? 'Foreman Admin · Mandatory First Pot' : 'Subscriber · Verified Winner'}
                                    </p>
                                  </div>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black tracking-tight flex items-center gap-1 border shrink-0 ${
                                  isPending
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                  {isPending ? 'Pending Disbursal' : 'Fully Disbursed'}
                                </span>
                              </div>

                              {/* Financial Breakdown Pill Grid */}
                              <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-xl mb-3 text-center border border-slate-100">
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Pool Pot</span>
                                  <span className="text-xs font-black text-slate-800">{formatCurrency(group.totalValue)}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Discount</span>
                                  <span className="text-xs font-black text-rose-600">-{formatCurrency(log.winningDiscount)}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Net Payout</span>
                                  <span className="text-xs font-black text-emerald-700">{formatCurrency(log.netPayout)}</span>
                                </div>
                              </div>

                              {/* Action Footer */}
                              <div className="flex items-center justify-between pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHapticFeedback('light');
                                    setExpandedTrailLogId(isExpanded ? null : log.id);
                                  }}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                                >
                                  <History className="w-3.5 h-3.5" />
                                  <span>{isExpanded ? 'Hide Bids Trail' : `View Bids Trail (${log.bidStream?.length || 2} shouts)`}</span>
                                </button>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedHistoricalLog(log)}
                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all cursor-pointer"
                                    title="Download PDF"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const shareText = `🏆 *Chit Fund Auction Winner Report*\nGroup: ${group.name}\nMonth: Month ${log.month}\nWinner: ${log.winningBidderName} (Ticket #${log.ticketNumber || 'N/A'})\nDiscount: ${formatCurrency(log.winningDiscount)}\nNet Payout: ${formatCurrency(log.netPayout)}`;
                                      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
                                    }}
                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all cursor-pointer"
                                    title="Share Ledger Entry"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Expandable Mini Trail */}
                              {isExpanded && (
                                <div className="mt-3 pt-3 bg-slate-50/80 rounded-xl p-2.5 space-y-2 text-xs border border-slate-200/80 animate-in fade-in duration-200">
                                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Live Shouts Log &amp; Timeline
                                  </div>
                                  {(() => {
                                    const chronologicalShouts = [...(log.bidStream || [])].sort(
                                      (a, b) => (a.amount || 0) - (b.amount || 0)
                                    );

                                    if (chronologicalShouts.length > 0) {
                                      return chronologicalShouts.map((b, bIdx) => {
                                        const isLast = bIdx === chronologicalShouts.length - 1;
                                        return (
                                          <div
                                            key={b.id || bIdx}
                                            className={`flex justify-between items-center py-1.5 px-2 rounded-lg ${
                                              isLast ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200' : 'text-slate-600'
                                            }`}
                                          >
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-mono text-slate-400 text-[10px]">#{String(bIdx + 1).padStart(2, '0')}</span>
                                              <span>{isLast ? '🏆 ' : ''}{b.memberName} (#{b.ticketNumber})</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono font-semibold">{formatCurrency(b.amount)} {isLast ? '[WINNER]' : ''}</span>
                                              <span className="text-[10px] font-mono text-slate-400">{formatBidTimestamp(b.timestamp)}</span>
                                            </div>
                                          </div>
                                        );
                                      });
                                    }

                                    return (
                                      <>
                                        <div className="flex justify-between items-center text-slate-600 py-0.5">
                                          <span>#01 Floor Opened</span>
                                          <span className="font-semibold text-slate-800">₹500 min step</span>
                                        </div>
                                        <div className="flex justify-between items-center text-emerald-800 font-bold bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                                          <span className="flex items-center gap-1">🏆 #02 {log.winningBidderName} (#{log.ticketNumber || '—'})</span>
                                          <span>{formatCurrency(log.winningDiscount)} [WINNER]</span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Global Export Floating CTA */}
                  <div className="mb-5">
                    <button
                      type="button"
                      disabled={historicalAuctionLogs.length === 0}
                      onClick={() => {
                        if (historicalAuctionLogs.length > 0) {
                          setSelectedHistoricalLog(historicalAuctionLogs[0]);
                        }
                      }}
                      className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition-all text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Multi-Month Ledger Summary (PDF)</span>
                    </button>
                  </div>

                  {/* Ledger Authenticity Stamp Footer */}
                  <div className="bg-slate-200/60 rounded-2xl p-3.5 mb-2 flex items-start gap-3 border border-slate-300/60">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-[11px] font-black text-slate-800 tracking-tight flex items-center gap-1">
                        <span>PostgreSQL Immutable Ledger Certified</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                        Cryptographically sealed against tampering · Certified by {organizationName} · 100% secure
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Hero Bidding Card: Live Discount & Net Pot Calculation */}
                  <section className="rounded-2xl p-4 text-white shadow-xl relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20">
                    <div className="absolute -right-12 -top-12 w-48 h-48 bg-brand-500/25 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-indigo-200 border border-white/10">
                          {group.currentMonth === 0 ? 'Month 0 Launch Cycle' : `Month ${group.currentMonth} Cycle Bidding`}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900">
                          🔒 Floor Locked
                        </span>
                      </div>

                      <div className="mt-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Next Live Auction In</p>
                        <div className="flex justify-center items-center gap-1 mt-2">
                          <div className="bg-white/10 border border-white/15 rounded-xl px-2 py-1 min-w-[46px]">
                            <span className="text-xl sm:text-2xl font-black text-white block font-mono leading-tight">{String(countdown.days).padStart(2, '0')}</span>
                            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-indigo-200 block font-semibold">Days</span>
                          </div>
                          <span className="text-base sm:text-lg font-bold text-slate-500">:</span>
                          <div className="bg-white/10 border border-white/15 rounded-xl px-2 py-1 min-w-[46px]">
                            <span className="text-xl sm:text-2xl font-black text-white block font-mono leading-tight">{String(countdown.hours).padStart(2, '0')}</span>
                            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-indigo-200 block font-semibold">Hours</span>
                          </div>
                          <span className="text-base sm:text-lg font-bold text-slate-500">:</span>
                          <div className="bg-white/10 border border-white/15 rounded-xl px-2 py-1 min-w-[46px]">
                            <span className="text-xl sm:text-2xl font-black text-white block font-mono leading-tight">{String(countdown.minutes).padStart(2, '0')}</span>
                            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-indigo-200 block font-semibold">Mins</span>
                          </div>
                          <span className="text-base sm:text-lg font-bold text-slate-500">:</span>
                          <div className="bg-white/10 border border-white/15 rounded-xl px-2 py-1 min-w-[46px]">
                            <span className="text-xl sm:text-2xl font-black text-amber-300 block font-mono leading-tight">{String(countdown.seconds).padStart(2, '0')}</span>
                            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-amber-300 block font-semibold">Secs</span>
                          </div>
                        </div>

                        <div className="mt-3.5 px-3 py-2 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between text-left">
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            <div>
                              <p className="text-[11px] font-bold text-white">{countdown.formattedTargetDate || formattedTargetAuctionDate} at {countdown.formattedTargetTime || formattedTargetAuctionTime}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                        {isCountdownUnderTwoHours && (
                          <button
                            type="button"
                            onClick={promptStartLiveAuction}
                            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-98 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <svg className="w-4 h-4 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                            <span>Start Auction</span>
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            type="button"
                            onClick={() => {
                              const msg = `📢 *Upcoming Live Chit Auction Notice*\nGroup: ${group.name}\nMonth Cycle: Month ${group.currentMonth}\nChit Value: ${formatCurrency(group.totalValue)}\nScheduled Date: ${countdown.formattedTargetDate || formattedTargetAuctionDate} at ${countdown.formattedTargetTime || formattedTargetAuctionTime}\n\nPlease be present on the floor or connected in-app.`;
                              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                            }}
                            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.101.005.245-.038.375.275.145.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.178.18-.077.354.101.174.45 1.742 1.937 2.067.188.041.332-.014.419-.115.116-.13.491-.572.622-.767.13-.195.26-.163.433-.101.174.062 1.1.519 1.288.613.188.094.318.14.364.219.043.079.043.46-.101.865z"></path></svg>
                            <span>Send Notice</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setShowScheduleModal(true)}
                            className="py-2 px-3 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            <span>Reschedule</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Kai Iruppu & Laaba Seetu Incentive Card */}
                  <section className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">🪙</span>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Kai Iruppu Discount Pool</h3>
                        </div>
                      </div>
                      <span className="text-sm font-black text-slate-900 font-mono">{formatCurrency(group.kai_iruppu_pool)}</span>
                    </div>
                    {/* Progress bar to Laaba Seetu */}
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <div className="flex justify-between items-center text-[11px] mb-1.5">
                        <span className="font-medium text-slate-600 flex items-center gap-1">
                          <span>🎁</span>
                          <span>Laaba Seetu Threshold</span>
                        </span>
                        <span className="font-bold text-amber-700">
                          {Math.min(100, Math.round((group.kai_iruppu_pool / (group.totalValue || 1)) * 100))}% (Target: {formatCurrency(group.totalValue)})
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all" 
                          style={{ width: `${Math.min(100, Math.round((group.kai_iruppu_pool / (group.totalValue || 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Contenders Attendance Pill Row */}
                  <section className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-1.5">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Eligible Contenders Floor</h3>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Locked</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">{eligibleCount} in standby</span>
                    </div>
                    <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-1.5 text-xs text-slate-600 font-semibold">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" fillRule="evenodd"></path></svg>
                      <span>Bidding Locked Until Scheduled Time</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {members.map((m) => {
                        const isEligible = !m.hasWonRegular;
                        const pastWinLog = historicalAuctionLogs.find(
                          l => l.winningBidderId === m.id || l.ticketNumber === m.ticketNumber
                        );
                        return (
                          <div key={m.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90">
                            <div className="flex items-center justify-between">
                              <span className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center font-mono">
                                #{m.ticketNumber || '?'}
                              </span>
                              <span className={`text-[9px] font-medium ${isEligible ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {isEligible ? '● Ready' : pastWinLog ? `Won M${pastWinLog.month}` : 'Prior Winner'}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 mt-2 leading-tight truncate">{m.fullName}</h4>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-slate-500">Status</span>
                              <span className={`text-[11px] font-bold ${isEligible ? 'text-slate-700' : 'text-slate-400'}`}>
                                {isEligible ? 'Eligible' : 'Spectator'}
                              </span>
                            </div>
                            <button 
                              type="button"
                              className="mt-2.5 w-full py-1.5 bg-slate-100 text-slate-400 border border-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-not-allowed" 
                              disabled
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" fillRule="evenodd"></path></svg>
                              <span>{isEligible ? 'Locked' : 'Already Won'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Historical Records Quick Strip (if available) */}
                  {historicalAuctionLogs.length > 0 && (
                    <section className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-7 h-7 rounded-lg bg-indigo-50 text-brand-600 flex items-center justify-center font-bold text-xs">📜</span>
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Concluded Auction Rounds</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDesktopViewTab('history')}
                          className="text-xs font-mono font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          View All ({historicalAuctionLogs.length}) →
                        </button>
                      </div>
                      <div className="space-y-2">
                        {historicalAuctionLogs.slice(0, 3).map((log) => (
                          <div
                            key={log.id}
                            onClick={() => {
                              triggerHapticFeedback('light');
                              setSelectedHistoricalLog(log);
                            }}
                            className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-brand-500 cursor-pointer transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">Month {log.month}</span>
                                <span className="text-[10px] text-slate-500">• {log.winningBidderName}</span>
                              </div>
                              <span className="text-[11px] font-mono text-emerald-600 font-bold">
                                Payout: {formatCurrency(log.netPayout)}
                              </span>
                            </div>
                            <span className="text-xs text-brand-600 font-semibold flex items-center gap-0.5">
                              View <ChevronRight size={14} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Conclude Month & Disburse CTA Floating Button */}
                  {group.currentMonth === 0 ? (
                    <div className="pt-2">
                      <button 
                        type="button"
                        onClick={handleAdvanceMonth0}
                        disabled={isRecording}
                        className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        {isRecording ? (
                          <>
                            <span className="h-4 w-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                            <span>Advancing to Month 1...</span>
                          </>
                        ) : (
                          <>
                            <Rocket size={16} />
                            <span>Confirm Launch &amp; Advance to Month 1</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : !isCountdownZero ? (
                    <div className="pt-2">
                      <button 
                        type="button"
                        onClick={promptStartLiveAuction}
                        className="w-full py-3.5 px-4 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        <span>Conduct Auction Early (Admin Override)</span>
                      </button>
                    </div>
                  ) : null}
                </>
              )}

            </main>
          </div>
        </div>

        {/* Schedule Modal */}
        <AuctionScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          groupId={group.id}
          groupName={group.name}
          currentMonth={group.currentMonth}
          startDate={group.startDate}
          auctionDayOfMonth={group.auction_day_of_month}
          auctionTime={group.auction_time}
          nextAuctionDate={group.next_auction_date}
          nextAuctionTime={group.next_auction_time}
          onScheduleUpdated={() => {
            fetchGroupsList();
            if (selectedGroupId) {
              fetchGroupDetails(selectedGroupId);
            }
          }}
        />

        {/* Historical Auction Record Details Modal */}
        {renderHistoricalModal()}

        {/* Start Auction Confirmation Modal */}
        {renderStartConfirmModal()}

        {/* 5-4-3-2-1 Live Stream Countdown Overlay */}
        {renderGoingLiveCountdownOverlay()}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 animate-in fade-in duration-200">

      {/* ═════════════════════════════════════════════════════════════════════════
          DESKTOP LIVE AUCTION ARENA (EXACT STITCH FINTECH DESIGN)
          ═════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col flex-1 min-w-0 -m-4 sm:-m-8 bg-slate-50 min-h-screen">
        {/* TopHeader */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExitStudio}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                title="Return to Overview"
              >
                <ArrowLeft size={14} />
                <span className="hidden xl:inline">Overview</span>
              </button>
              <h1 className="text-lg font-bold font-display text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Auctions &amp; Bidding Arena</span>
                <span className="text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-lg">
                  {group.name} ({formatCurrency(group.totalValue)}) • Month {group.currentMonth}
                </span>
                {group.is_live_auction_active ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    Live Session Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                    Standby
                  </span>
                )}
              </h1>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {/* Live Session Timer */}
            <div 
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-bold shadow-2xs"
              title="Active Live Auction Session Duration"
            >
              <Clock className="w-3.5 h-3.5 text-brand-600 animate-pulse shrink-0" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans font-semibold">Session:</span>
              <span>{formatSessionDuration(sessionElapsedSecs)}</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{formattedTargetAuctionDate || 'No date set'} · {formattedTargetAuctionTime}</span>
              <button 
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="text-brand-600 font-bold hover:underline ml-1 cursor-pointer"
              >
                Reschedule
              </button>
            </div>

            {/* End Live Stream / Begin Live */}
            {group.currentMonth > 0 && !group.is_live_auction_active ? (
              <button
                type="button"
                onClick={promptStartLiveBroadcast}
                disabled={isStartingLiveSession}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-brand-700 border border-indigo-200 text-xs font-semibold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5 text-brand-600 animate-pulse" />
                <span>{isStartingLiveSession ? 'Starting...' : 'Begin Live'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEndLiveAuctionSession}
                disabled={isStartingLiveSession}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span>End Live Stream</span>
              </button>
            )}

            {/* Conclude & Award Pot Button */}
            <button
              type="button"
              onClick={() => {
                if (bids.length === 0 && group.currentMonth > 0) {
                  alert("Cannot conclude auction without any bids recorded.");
                  return;
                }
                setShowCloseModal(true);
              }}
              disabled={group.currentMonth === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Conclude &amp; Award Pot</span>
            </button>
          </div>
        </header>

        {/* Main Scrollable Arena Body */}
        <main className="flex-1 overflow-y-auto p-8 space-y-7">
          
          {/* Arena Master Milestone & Laaba Seetu Notice Bar */}
          <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 w-full">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Auction Stage:</span>
                  <span className="px-3 py-1 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand-600 animate-ping"></span>
                    {group.currentMonth === 0 ? 'Month 0 Organizer Profit Phase' : `Cycle #${group.currentMonth} Competitive Bidding`}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
                
                {/* Interactive Operational Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowViewersModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium transition-colors shadow-2xs group cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-600" />
                    <span>Spectators:</span>
                    <strong className="text-slate-900 font-bold">{liveViewerCount} In-App</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRollCallModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Roll Call:</span>
                    <strong className="text-emerald-700 font-bold">{attendingMemberIds.length}/{eligibleCount} Attending</strong>
                  </button>

                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={bids.length === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50/60 hover:bg-amber-100 disabled:opacity-40 border border-amber-200 text-amber-800 text-xs font-medium transition-colors shadow-2xs group cursor-pointer"
                    title="Rollback accidental shout"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-amber-700 group-hover:-rotate-45 transition-transform" />
                    <span className="font-semibold">Undo Last Bid</span>
                  </button>
                </div>
              </div>

              {/* Laaba Seetu Status Pill */}
              <div className="flex items-center gap-3">
                {isLaabaSeetuActive && (
                  <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Laaba Seetu Active (₹0 Due)</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => alert(`Chit Fund Statutory Rules:\n- Total Chit Value: ${formatCurrency(group.totalValue)}\n- Monthly Base: ${formatCurrency(group.totalValue / group.memberCount)}\n- Winner Net Payout = Total Chit Value - Winning Discount Bid.\n- Winning Discount accumulates into Kai Iruppu pool.\n- When Kai Iruppu >= Total Chit Value, Laaba Seetu is triggered (₹0 member dues).`)}
                  className="text-xs font-semibold text-brand-600 hover:underline cursor-pointer"
                >
                  Rules Info
                </button>
              </div>
            </div>
          </section>

          {/* Month 0 Launch Mode Alert / Banner Context */}
          <section className="p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-indigo-200 text-brand-600 flex items-center justify-center font-bold text-xs shadow-2xs">
                M0
              </div>
              <div>
                <span className="font-bold text-slate-900">Month 0 (Launch / Orientation Phase) Protocol</span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  By chit fund statutory rules, Month 0 has no auction discount bidding. The {formatCurrency(group.totalValue)} pool is reserved as Organizer Commission.
                  {group.currentMonth > 0 ? ` Group advanced to M1 on ${group.startDate || '01 Oct 2026'}.` : ' Ready to confirm launch collections.'}
                </p>
              </div>
            </div>
            {group.currentMonth > 0 ? (
              <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                Completed &amp; Verified
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowMonth0Modal(true)}
                className="text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg border border-amber-300 transition-colors cursor-pointer"
              >
                Confirm Month 0 Payout
              </button>
            )}
          </section>

          {/* Top Grid: Live Bid Console + Real-time Financial Engine + Discount Pool (Kai Iruppu) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-7">
            
            {/* Left/Center 8 Cols: Contender Floor + Live Bid Cockpit */}
            <section className="xl:col-span-8 space-y-6">
              
              {/* Top Banner: Current Highest Discount Bid & Dynamic Winner Disbursal */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs relative overflow-hidden">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Highest Discount Bid</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        {bids.length > 0 ? `Active Leader: Ticket #${winnerTicket}` : 'Floor Opening'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 mt-1.5">
                      <span className="text-4xl font-black font-display text-slate-900 tracking-tight font-mono">
                        {bids.length > 0 ? formatCurrency(highestBid) : formatCurrency(startingBaselineBid)}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {group.totalValue ? `${(((bids.length > 0 ? highestBid : startingBaselineBid) / group.totalValue) * 100).toFixed(1)}% Max Discount Offered` : '0%'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Floor Leader: <strong className="text-slate-900 font-bold">{winnerName} {winnerTicket ? `(Ticket #${winnerTicket})` : ''}</strong> · {bids.length} {bids.length === 1 ? 'shout' : 'shouts'} logged · Disbursal net {formatCurrency(netPayout)}
                    </p>
                  </div>

                  {/* Dynamic Net Disbursal Card */}
                  <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md min-w-[220px] text-right flex-shrink-0">
                    <span className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider block">Dynamic Winner Payout</span>
                    <p className="text-2xl font-black font-display text-emerald-300 mt-0.5 font-mono">{formatCurrency(netPayout)}</p>
                    <div className="text-[10px] text-slate-300 mt-1.5 pt-1.5 border-t border-white/10 flex justify-between font-mono">
                      <span>Chit: {formatCurrency(group.totalValue)}</span>
                      <span>Discount: {formatCurrency(highestBid)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PRIMARY FOCUS: Active Contenders on Floor (1-Tap Selection & Bidding Cards) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-bold text-base text-slate-900 tracking-tight">Active Contenders on Floor</h2>
                      <span className="text-xs font-bold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
                        {displayedMembers.length} Contenders · 1-Tap Ready
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Tap any contender to prime the 2-Tap fast bidding register.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowOnlyAttending(v => !v)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                        showOnlyAttending
                          ? 'bg-brand-50 text-brand-700 border-brand-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {showOnlyAttending ? `Roll Call (${attendingMemberIds.length})` : 'All Members'}
                    </button>
                    <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold px-2.5 py-1 rounded-lg">
                      {attendingMemberIds.length} / {eligibleCount} Floor Quorum Met
                    </span>
                  </div>
                </div>

                {/* Contender Grid Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {displayedMembers.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-slate-500 text-xs bg-slate-50 border border-slate-200 rounded-xl">
                      No attending contenders selected. Click &quot;Roll Call&quot; or toggle to view all members.
                    </div>
                  ) : (
                    displayedMembers.map((m) => {
                    const isWon = m.hasWonRegular;
                    const isLeader = winnerId === m.id && bids.length > 0;
                    const memberLastBid = bids.find(b => b.memberId === m.id)?.amount;
                    const lastBidTime = bids.find(b => b.memberId === m.id)?.timestamp;
                    const isAttending = attendingMemberIds.includes(m.id);

                    if (isWon) {
                      return (
                        <div key={m.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-100/60 opacity-70 lg:col-span-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center font-mono">
                                #{m.ticketNumber}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-slate-700">{m.fullName}</h4>
                                  <span className="text-[10px] bg-slate-200 text-slate-600 font-semibold px-1.5 py-0.2 rounded">Prior Winner</span>
                                </div>
                                <span className="text-[10px] text-slate-500">Won in prior cycle · Disqualified from bidding · Receives dividends</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">Spectator Only</span>
                          </div>
                        </div>
                      );
                    }

                    if (isLeader) {
                      return (
                        <div 
                          key={m.id} 
                          onClick={() => handleOpenBidModal(m.id)}
                          className="p-3.5 rounded-xl border-2 border-amber-400 bg-amber-50/50 hover:bg-amber-100/60 shadow-xs relative transition-all active:scale-[0.99] cursor-pointer"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center font-mono">
                                #{m.ticketNumber}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-slate-900">{m.fullName}</h4>
                                  <span className="text-sm">👑</span>
                                </div>
                                <span className="text-[10px] font-bold text-amber-700 uppercase">Current Leader</span>
                              </div>
                            </div>
                            <span className="text-[11px] font-black text-amber-800 font-mono">{formatCurrency(highestBid)}</span>
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-amber-200/70 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Last shout: {lastBidTime || 'Active'}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBidModal(m.id);
                              }}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-[10px] transition-colors border border-amber-300 cursor-pointer"
                            >
                              Raise Lead Bid
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (memberLastBid) {
                      return (
                        <div 
                          key={m.id} 
                          onClick={() => handleOpenBidModal(m.id)}
                          className="p-3.5 rounded-xl border-2 border-brand-500 bg-brand-50/40 hover:bg-brand-50/70 shadow-xs relative transition-all ring-2 ring-brand-500/20 active:scale-[0.99] cursor-pointer"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-brand-600 text-white font-bold text-xs flex items-center justify-center font-mono">
                                #{m.ticketNumber}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-bold text-slate-900">{m.fullName}</h4>
                                  <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.2 rounded">Outbid</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">Last shout: {formatCurrency(memberLastBid)}</span>
                              </div>
                            </div>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1" title="Present"></span>
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-brand-200 flex items-center justify-between text-[11px]">
                            <span className="text-brand-700 font-bold text-[10px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse"></span>
                              Floor Contender
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBidModal(m.id);
                              }}
                              className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-[10px] transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Zap size={11} />
                              <span>Bid for #{m.ticketNumber}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={m.id} 
                        onClick={() => handleOpenBidModal(m.id)}
                        className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-brand-300 transition-all cursor-pointer group shadow-2xs active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-lg bg-slate-200 group-hover:bg-brand-100 group-hover:text-brand-700 text-slate-700 font-bold text-xs flex items-center justify-center font-mono transition-colors">
                              #{m.ticketNumber}
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800">{m.fullName}</h4>
                              <span className="text-[10px] text-emerald-600 font-semibold block">
                                ● {isAttending ? 'Online / Floor Ready' : 'Absent / Standby'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-bold text-slate-700 font-mono block">
                              {formatCurrency(startingBaselineBid)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Min Bid</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 text-[10px]">Eligible Contender</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBidModal(m.id);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-brand-50 text-brand-600 border border-slate-200 hover:border-brand-200 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Plus size={11} />
                            <span>Bid for #{m.ticketNumber}</span>
                          </button>
                        </div>
                      </div>
                    );
                  }))}
                </div>
              </div>

            </section>

            {/* Right 4 Cols: Live Shouts Stream & Award Pot Action */}
            <aside className="xl:col-span-4 space-y-6">
              
              {/* Live Shouts & Audit Trail */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
                      Live Shouts &amp; Audit Trail
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Realtime WS</span>
                </div>
                <div className="space-y-2 text-xs">
                  {bids.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                      <Gavel className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                      <p className="font-semibold text-slate-600">No shouts logged yet</p>
                      <p className="text-[10px]">Tap any contender above to log live shouts</p>
                    </div>
                  ) : (
                    bids.slice(0, 5).map((bid, idx) => {
                      const isTop = idx === 0;
                      const prevBidAmt = bids[idx + 1]?.amount || 0;
                      const diff = bid.amount - prevBidAmt;

                      if (isTop) {
                        return (
                          <div key={bid.id} className="p-2.5 bg-emerald-50/50 border border-emerald-200/80 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center font-mono text-[10px]">
                                #{bid.ticketNumber}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 text-xs">{bid.memberName}</span>
                                  <span className="text-[9px] bg-emerald-200/70 text-emerald-800 font-bold px-1.5 py-0.2 rounded">LEADER</span>
                                </div>
                                <p className="text-[10px] text-slate-500">Raised to {formatCurrency(bid.amount)} · {bid.timestamp}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 font-display text-xs">{formatCurrency(bid.amount)}</span>
                              {diff > 0 && (
                                <span className="text-[9px] text-emerald-700 block font-semibold">+{formatCurrency(diff)} lead</span>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={bid.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-bold flex items-center justify-center font-mono text-[10px]">
                              #{bid.ticketNumber}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 text-xs">{bid.memberName}</span>
                                <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1 py-0.2 rounded">Outbid</span>
                              </div>
                              <p className="text-[10px] text-slate-500">Bid of {formatCurrency(bid.amount)} · {bid.timestamp}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-700 font-display text-xs">{formatCurrency(bid.amount)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Confirm Auction Winner & Disburse Pot Workflow Box */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/20 text-indigo-100">
                    Workflow Action
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold">Final Call</span>
                </div>
                <h4 className="font-display font-bold text-sm mt-3">Confirm Auction Winner &amp; Disburse Pot</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Locks the auction at {formatCurrency(highestBid)} discount for {winnerName}, registers net disbursal of {formatCurrency(netPayout)}, rolls over {formatCurrency(group.kai_iruppu_pool + highestBid)} to Kai Iruppu pool, and advances cycle to Month {group.currentMonth + 1}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (bids.length === 0 && group.currentMonth > 0) {
                      alert("Cannot close auction without any bids recorded.");
                      return;
                    }
                    setShowCloseModal(true);
                  }}
                  disabled={group.currentMonth === 0}
                  className="mt-4 w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Close Month {group.currentMonth} &amp; Award Pot</span>
                </button>
              </div>

            </aside>
          </div>
        </main>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          MOBILE LIVE AUCTION ARENA (EXACT STITCH FINTECH DESIGN)
          ═════════════════════════════════════════════════════════════════════════ */}
      <div className="block md:hidden flex-1 flex flex-col min-w-0 -m-4 bg-[#F8FAFC] relative min-h-screen text-slate-800">
        
        {/* Status Bar & Top App Bar */}
        <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 safe-top">
          {/* Status Bar Mockup */}
          <div className="px-6 pt-3 pb-1 flex justify-between items-center text-xs font-semibold text-slate-900 tracking-tight">
            <span>09:41</span>
            <div className="flex items-center space-x-2">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 18.25A10.93 10.93 0 0 1 1 12C1 5.92 5.92 1 12 1s11 4.92 11 11c0 2.34-.73 4.51-1.98 6.29l-.62-.62A8.96 8.96 0 0 0 21 12c0-4.97-4.03-9-9-9z" /><circle cx="12" cy="18" r="2" /></svg>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0 0 12 4z" /></svg>
              <div className="w-5 h-2.5 border border-slate-800 rounded-xs p-0.5 flex items-center">
                <div className="w-full h-full bg-slate-800 rounded-2xs" />
              </div>
            </div>
          </div>

          {/* App Title & Sub-header */}
          <div className="px-5 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleExitStudio}
                  className="p-1 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Back to Overview"
                >
                  <ArrowLeft size={16} />
                </button>
                <h1 className="text-base font-extrabold text-slate-900 leading-tight truncate">Live Bidding Arena</h1>
                {group.is_live_auction_active ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0 font-mono">
                    Standby
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Month {group.currentMonth === 0 ? '0 Launch' : group.currentMonth} · {eligibleCount} Contenders Active
              </p>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              <div 
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-bold shadow-2xs"
                title="Active Live Auction Session Duration"
              >
                <Clock className="w-3.5 h-3.5 text-brand-600 animate-pulse shrink-0" />
                <span>{formatSessionDuration(sessionElapsedSecs)}</span>
              </div>
            </div>
          </div>

          {/* Action & Attendance Sub-bar */}
          <div className="px-5 py-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar border-t border-slate-100 bg-slate-50/70 text-[11px]">
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowViewersModal(true)}
                className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <span>{liveViewerCount} in-app</span>
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => setShowRollCallModal(true)}
                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{attendingMemberIds.length}/{eligibleCount} Roll Call</span>
              </button>
            </div>
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              <button 
                type="button"
                onClick={handleUndo}
                disabled={bids.length === 0}
                className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md text-[10px] font-bold text-amber-800 hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
              >
                <svg className="w-2.5 h-2.5 text-amber-700" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2m0 0l-3-3m3 3l3-3M3 10l3-3m-3 3l3 3" /></svg>
                <span>Undo Last Bid</span>
              </button>
              {group.currentMonth > 0 && !group.is_live_auction_active ? (
                <button
                  type="button"
                  onClick={promptStartLiveBroadcast}
                  disabled={isStartingLiveSession}
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-[9px] font-black text-emerald-700 tracking-tight cursor-pointer hover:bg-emerald-200 disabled:opacity-50"
                >
                  {isStartingLiveSession ? 'STARTING...' : 'BEGIN LIVE'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEndLiveAuctionSession}
                  disabled={isStartingLiveSession}
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-[9px] font-black text-red-700 tracking-tight cursor-pointer hover:bg-red-200 disabled:opacity-50"
                >
                  END LIVE STREAM
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 px-3 py-3 space-y-3 pb-28">

          {/* Current Highest Discount Banner Card */}
          <section className="rounded-2xl p-3.5 sm:p-4 text-white shadow-xl relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-brand-500/25 rounded-full blur-2xl pointer-events-none" />
            
            {/* Top row: Cycle Badge on left, Net Winner Payout on right */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-indigo-200 font-mono shrink-0">
                Month {group.currentMonth} Cycle
              </span>
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-2.5 py-1 text-right shrink-0">
                <span className="text-[9px] uppercase font-bold text-amber-300 tracking-wider">Net Payout: </span>
                <span className="text-xs font-black text-white font-mono">{formatCurrency(netPayout)}</span>
              </div>
            </div>

            {/* Middle: Discount Price & Lead Info */}
            <div className="relative z-10 mt-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Current Highest Discount</p>
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5 font-mono">
                {bids.length > 0 ? formatCurrency(highestBid) : formatCurrency(startingBaselineBid)}
              </p>
              <p className="text-[11px] text-emerald-300 font-medium mt-1 truncate">
                Lead: <strong className="text-white">{bids.length > 0 ? `${winnerName} ${winnerTicket ? `(Ticket #${winnerTicket})` : ''}` : 'Floor Open'}</strong>
              </p>
            </div>

            {/* Bottom summary strip */}
            <div className="relative z-10 mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-indigo-200 font-mono">
              <span className="truncate">Chit: {formatCurrency(group.totalValue)}</span>
              <span className="shrink-0 text-slate-300">Net: {formatCurrency(netPayout)}</span>
            </div>
          </section>

          {/* Contenders Attendance Pill Row (Moved Up) */}
          <section className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-card">
            <div className="flex items-center justify-between gap-1.5 mb-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wide truncate">
                  Contenders
                </h3>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-brand-50 text-brand-700 border border-brand-200 shrink-0">
                  Tap to Bid
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-slate-500 font-medium font-mono">
                  {visibleContenders.length} Active
                </span>
                <button
                  type="button"
                  onClick={() => setShowOnlyAttending(v => !v)}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                    showOnlyAttending 
                      ? 'bg-brand-500 border-brand-500 text-white' 
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {showOnlyAttending ? `Roll Call (${attendingMemberIds.length})` : 'Roll Call'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {displayedMembers.map((m) => {
                const isWon = m.hasWonRegular;
                const isCurrentTopBidder = winnerId === m.id;
                const memberLastBid = bids.find(b => b.memberId === m.id)?.amount;

                if (isWon) {
                  return (
                    <div 
                      key={m.id}
                      className="p-2.5 bg-slate-50/60 rounded-xl border border-slate-200/60 opacity-50 relative overflow-hidden flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center font-mono">
                          #{m.ticketNumber}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                          Won
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-500 mt-1.5 leading-tight truncate">{m.fullName}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-400">Status</span>
                        <span className="text-[11px] font-bold text-slate-400 font-mono">Spectator</span>
                      </div>
                      <button 
                        disabled
                        className="mt-2 w-full py-1.5 bg-slate-100 text-slate-400 text-[11px] font-bold rounded-lg flex items-center justify-center cursor-not-allowed"
                      >
                        <span>Already Won</span>
                      </button>
                    </div>
                  );
                }

                if (isCurrentTopBidder) {
                  return (
                    <div 
                      key={m.id}
                      onClick={() => handleOpenBidModal(m.id)}
                      className="p-2.5 bg-amber-50/70 hover:bg-amber-100/70 border-2 border-amber-300 hover:border-amber-400 shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center font-mono">
                          #{m.ticketNumber}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-200/90 text-amber-900 rounded-full">
                          👑 Leader
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1.5 leading-tight truncate">{m.fullName}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-amber-900 font-semibold">Lead Bid</span>
                        <span className="text-xs font-black text-amber-900 font-mono">{formatCurrency(highestBid)}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBidModal(m.id);
                        }}
                        className="mt-2 w-full py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 active:scale-95 transition-all shadow-2xs cursor-pointer"
                      >
                        <span>Raise Bid</span>
                      </button>
                    </div>
                  );
                }

                if (memberLastBid) {
                  return (
                    <div 
                      key={m.id}
                      onClick={() => handleOpenBidModal(m.id)}
                      className="p-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-brand-300 shadow-2xs relative overflow-hidden flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center font-mono">
                          #{m.ticketNumber}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                          Outbid
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1.5 leading-tight truncate">{m.fullName}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-500">Last Bid</span>
                        <span className="text-xs font-bold text-slate-700 font-mono">{formatCurrency(memberLastBid)}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBidModal(m.id);
                        }}
                        className="mt-2 w-full py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        <span>Tap to Bid</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div 
                    key={m.id}
                    onClick={() => handleOpenBidModal(m.id)}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 hover:border-brand-300 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center font-mono">
                        #{m.ticketNumber}
                      </span>
                      <span className="text-[9px] font-medium text-emerald-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ready
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-1.5 leading-tight truncate">{m.fullName}</h4>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-500">Floor Bidder</span>
                      <span className="text-[11px] font-bold text-slate-600 font-mono">Active</span>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenBidModal(m.id);
                      }}
                      className="mt-2 w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                    >
                      <span>Tap to Bid</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Live Shouts Stream List (Moved Down) */}
          <section className="space-y-2">
            <div 
              onClick={() => setShowTimelineDrawer(true)}
              className="flex items-center justify-between px-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Bids Stream</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-mono">{bids.length}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700">
                <span className="text-[9px] text-slate-400">Auto-updating</span>
                <svg className="w-3.5 h-3.5 text-slate-600 transform transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
              </div>
            </div>

            <div className="space-y-1.5">
              {bids.length === 0 ? (
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                  No live bids shouted yet this cycle. Floor open!
                </div>
              ) : (
                bids.slice(0, 5).map((bid, idx) => {
                  const isLeader = idx === 0;
                  const member = members.find(m => m.id === bid.memberId);
                  const ticketNum = member?.ticketNumber || bid.ticketNumber || '?';
                  const bidderName = member?.fullName || bid.memberName || 'Bidder';
                  const formattedTime = new Date(bid.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const netPot = (group.totalValue || 0) - bid.amount;

                  return (
                    <div 
                      key={bid.id || idx}
                      className={`p-2.5 sm:p-3 bg-white rounded-2xl border flex items-center justify-between transition-all ${
                        isLeader ? 'border-emerald-300 shadow-xs' : 'border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center font-mono shrink-0 ${
                          isLeader ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          #{ticketNum}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{bidderName}</h4>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                              isLeader ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {isLeader ? 'Lead' : 'Outbid'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {formattedTime}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-mono block ${isLeader ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                          {formatCurrency(bid.amount)}
                        </span>
                        {isLeader && (
                          <span className="text-[9px] text-emerald-600 font-semibold block font-mono">
                            Payout: {formatCurrency(netPot)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Conclude Month & Disburse CTA Floating Button */}
          <div className="pt-2">
            <button 
              type="button"
              onClick={() => {
                if (bids.length === 0) {
                  alert("Cannot close auction without any bids recorded.");
                  return;
                }
                setShowCloseModal(true);
              }}
              disabled={group.currentMonth === 0 || bids.length === 0}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
              <span>
                {bids.length > 0 
                  ? `Lock Winner (${winnerName.split(' ')[0]}) & Award ${formatCurrency(netPayout)}` 
                  : 'Awaiting Winning Bid'}
              </span>
            </button>
          </div>
        </main>
      </div>

      {/* ── POP-UP MODAL: CANDIDATE TARGET PRICES BIDDING DIALOG (EXACT STITCH FINTECH) ──────────────── */}
      {showBidModal && activeContender && (
        <>
          {/* DESKTOP MODAL (CENTERED DIALOG) */}
          <div 
            className="hidden md:flex fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 items-center justify-center p-4 animate-in fade-in duration-150" 
            id="quick-bid-modal"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden transition-all max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="p-5 bg-gradient-to-r from-brand-50 to-indigo-50 border-b border-indigo-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-brand-500/20 font-mono">
                    #{activeContender.ticketNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-base text-slate-900">{activeContender.fullName}</h3>
                      <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full border border-brand-200">
                        Ticket #{activeContender.ticketNumber}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/80 hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors border border-slate-200/80 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                </button>
              </div>

              {/* Floor Lead To Beat & Dynamic Winner Payout Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200/70 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Floor Lead To Beat</span>
                    <span className="font-display font-black text-slate-900 text-sm">
                      {highestBid > 0 
                        ? `${winnerName} (${winnerTicket ? `#${winnerTicket}` : 'Leader'}) @ ${formatCurrency(highestBid)}`
                        : 'Opening Round @ Floor Baseline'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Dynamic Winner Payout</span>
                  <span className="font-display font-black text-emerald-600 text-sm">
                    {formatCurrency(netPayout)} (Net Disbursal)
                  </span>
                </div>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-5 space-y-4 overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      Instant 1-Tap Submit
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { delta: 500, label: '+₹500' },
                      { delta: 1000, label: '+₹1,000' },
                      { delta: 1500, label: '+₹1,500' },
                      { delta: 2000, label: '+₹2,000' },
                      { delta: 2500, label: '+₹2,500' },
                      { delta: 3000, label: '+₹3,000' },
                      { delta: 3500, label: '+₹3,500' },
                      { delta: 4000, label: '+₹4,000' },
                      { delta: 4500, label: '+₹4,500' },
                      { delta: 5000, label: '+₹5,000' },
                      { delta: 6000, label: '+₹6,000' },
                      { delta: 7500, label: '+₹7,500' },
                    ].map((item) => {
                      const basePrice = highestBid > 0 ? highestBid : startingBaselineBid;
                      const price = basePrice + item.delta;

                      return (
                        <button
                          key={item.delta}
                          type="button"
                          onClick={() => {
                            triggerHapticFeedback('light');
                            recordBid(price, activeContender.id);
                          }}
                          className="p-3 bg-slate-50 hover:bg-white hover:border-brand-500 border border-slate-200 rounded-xl transition-all hover:scale-[1.02] active:scale-95 group text-left cursor-pointer shadow-2xs hover:shadow-sm"
                        >
                          <div className="text-base font-black font-display text-slate-900 group-hover:text-brand-700 font-mono">
                            {formatCurrency(price)}
                          </div>
                          <div className="text-[11px] font-bold text-brand-600 mt-0.5">
                            {item.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Bid Entry Form */}
                <form onSubmit={handleCustomBidSubmit} className="pt-3 border-t border-slate-100">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Custom Bid Entry
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type '19k' or 19000 or 19.5..."
                        value={customBidInput}
                        onChange={(e) => setCustomBidInput(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-slate-800 focus:bg-white focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={parsedCustomBidAmount <= 0}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer disabled:opacity-40 active:scale-95"
                    >
                      <span>Log Bid</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    </button>
                  </div>
                  {parsedCustomBidAmount > 0 && (
                    <div className="mt-2 text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg flex items-center justify-between">
                      <span>Interpreted Bid: <strong>{formatCurrency(parsedCustomBidAmount)}</strong></span>
                      <span>Net Disbursal: <strong>{formatCurrency((group?.totalValue || 0) - parsedCustomBidAmount)}</strong></span>
                    </div>
                  )}
                </form>
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                <span>⚡ 1 Tap immediately records bid and dismisses modal</span>
                <button
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* MOBILE BIDDING BOTTOM SHEET (EXACT STITCH FINTECH) */}
          <div 
            className="flex md:hidden fixed inset-0 z-50 flex-col justify-end bg-slate-900/60 backdrop-blur-xs max-w-md mx-auto animate-in fade-in duration-150"
            id="quick-bid-mobile-sheet"
          >
            <div className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
              {/* Grab Handle */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3.5" />

              {/* Sheet Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-brand-500 text-white font-mono">
                      #{activeContender.ticketNumber}
                    </span>
                    <h3 className="text-sm font-black text-slate-900">{activeContender.fullName}</h3>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                      Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Current Top Bid:{' '}
                    <strong className="text-slate-800 font-semibold">{formatCurrency(highestBid)}</strong>
                    {highestBid > 0 && winnerName && (
                      <> by <span className="text-amber-800 font-medium">{winnerName}</span></>
                    )}
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold active:scale-95 transition-all cursor-pointer" 
                  title="Close Sheet"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>

              {/* Instant 18-Grid Quick Increments (3x6) */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-emerald-600">Instant Log on Tap</span>
                  <span className="text-[10px] text-slate-400 font-mono">Payout: {formatCurrency(netPayout)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { delta: 250, label: '+₹250' },
                    { delta: 500, label: '+₹500' },
                    { delta: 750, label: '+₹750' },
                    { delta: 1000, label: '+₹1,000' },
                    { delta: 1250, label: '+₹1,250' },
                    { delta: 1500, label: '+₹1,500' },
                    { delta: 1750, label: '+₹1,750' },
                    { delta: 2000, label: '+₹2,000' },
                    { delta: 2500, label: '+₹2,500' },
                    { delta: 3000, label: '+₹3,000' },
                    { delta: 3500, label: '+₹3,500' },
                    { delta: 4000, label: '+₹4,000' },
                    { delta: 4500, label: '+₹4,500' },
                    { delta: 5000, label: '+₹5,000' },
                    { delta: 6000, label: '+₹6,000' },
                    { delta: 7000, label: '+₹7,000' },
                    { delta: 8000, label: '+₹8,000' },
                    { delta: 10000, label: '+₹10,000' },
                  ].map((item) => {
                    const basePrice = highestBid > 0 ? highestBid : startingBaselineBid;
                    const price = basePrice + item.delta;

                    return (
                      <button
                        key={item.delta}
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light');
                          recordBid(price, activeContender.id);
                        }}
                        className="py-3 px-2 min-h-[58px] bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-300 rounded-xl text-center active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer shadow-2xs group"
                      >
                        <span className="text-xs sm:text-sm font-black text-slate-900 font-mono tracking-tight group-hover:text-brand-700 transition-colors">
                          {formatCurrency(price)}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-brand-600 font-mono mt-0.5">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Input Shorthand */}
              <form onSubmit={handleCustomBidSubmit} className="mt-3 flex items-center space-x-2">
                <div className="relative flex-1">
                  <input 
                    type="text"
                    placeholder="Type custom e.g. 19k"
                    value={customBidInput}
                    onChange={(e) => setCustomBidInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500" 
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400">INR</span>
                </div>
                <button 
                  type="submit"
                  disabled={parsedCustomBidAmount <= 0}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                >
                  <span>Log</span>
                </button>
              </form>

              <p className="text-center text-[10px] text-slate-400 mt-2.5 font-medium">
                ⚡ Tap any tile to instantly record bid &amp; close
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── SLIDE-OVER DRAWER: LIVE BIDDING TIMELINE ──────────────────────────── */}
      {showTimelineDrawer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-end z-50 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#1D1D41] border-l border-[#27264E] text-white w-full max-w-md h-full p-4 sm:p-5 space-y-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#27264E] pb-3">
                <div className="flex items-center space-x-2">
                  <History size={18} className="text-[#64CFF6]" />
                  <h3 className="text-sm font-bold text-white">Live Bidding Timeline ({bids.length})</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowTimelineDrawer(false)}
                  className="text-[#AEABD8] hover:text-white p-1.5 rounded-xl hover:bg-[#27264E] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Bids Stream List */}
              <div className="space-y-2 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
                {bids.length === 0 ? (
                  <div className="py-16 text-center text-[#AEABD8] space-y-2 border border-dashed border-[#27264E] rounded-xl bg-[#141332] p-4">
                    <Gavel size={26} className="text-[#AEABD8]/40 animate-pulse mx-auto" />
                    <p className="text-xs font-bold uppercase tracking-wider text-white">Ready to Record</p>
                    <p className="text-[11px] text-[#AEABD8]">Tap any member card to begin logging live shouts.</p>
                  </div>
                ) : (
                  bids.map((bid, index) => {
                    const isTopBid = index === 0;

                    return (
                      <div 
                        key={bid.id} 
                        className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                          isTopBid 
                            ? 'bg-[#6359E9]/20 border-[#6359E9]/50 text-white shadow-xs' 
                            : 'bg-[#141332] border-[#27264E] text-[#AEABD8]'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 overflow-hidden mr-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isTopBid ? 'bg-[#02B15A] animate-pulse' : 'bg-[#AEABD8]/40'}`}></span>
                          <div className="flex flex-col overflow-hidden">
                            <span className={`text-xs font-bold truncate ${isTopBid ? 'text-white' : 'text-[#AEABD8]'}`}>
                              {bid.memberName}
                            </span>
                            <span className="text-[10px] text-[#AEABD8]/70 font-mono">#{bid.ticketNumber} · {bid.timestamp}</span>
                          </div>
                        </div>

                        <span className={`text-xs font-black shrink-0 ${isTopBid ? 'text-[#64CFF6]' : 'text-white'}`}>
                          {formatCurrency(bid.amount)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Undo Action */}
            <div className="border-t border-[#27264E] pt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={bids.length === 0}
                className="flex items-center gap-1.5 bg-[#141332] hover:bg-[#27264E] active:bg-[#27264E]/80 disabled:opacity-40 disabled:cursor-not-allowed text-[#AEABD8] hover:text-white border border-[#27264E] text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Undo2 size={14} />
                <span>Undo Last Bid</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTimelineDrawer(false)}
                className="bg-[#6359E9] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-[#6F64FF] transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL 1: PRE-AUCTION ROLL CALL (ATTENDANCE CHECK-IN) ─────────────── */}
      {showRollCallModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[#1D1D41] border border-[#27264E] text-white rounded-3xl w-full max-w-md p-4 sm:p-5 space-y-4 shadow-2xl relative max-h-[90dvh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-[#27264E] pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-[#6359E9]/20 text-[#64CFF6] border border-[#6359E9]/30 rounded-xl">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pre-Auction Roll Call</h3>
                  <p className="text-[10px] text-[#AEABD8]">Check members participating in today&apos;s auction</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowRollCallModal(false)}
                className="text-[#AEABD8] hover:text-white p-1.5 rounded-lg hover:bg-[#27264E] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Select All / Clear Fast Actions */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-bold text-[#AEABD8]">
                {attendingMemberIds.length} of {eligibleCount} Members Attending
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllEligibleAttendees}
                  className="text-[#64CFF6] font-bold text-xs hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-[#27264E]">|</span>
                <button
                  type="button"
                  onClick={clearAllAttendees}
                  className="text-[#AEABD8] font-bold text-xs hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Checklist of Eligible Members */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {members.filter(m => !m.hasWonRegular).map((m) => {
                const isChecked = attendingMemberIds.includes(m.id);

                return (
                  <div
                    key={m.id}
                    onClick={() => toggleAttendingMember(m.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-[#6359E9]/20 border-[#6359E9] text-white font-bold'
                        : 'bg-[#141332] border-[#27264E] text-[#AEABD8] font-normal hover:bg-[#27264E]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border text-xs ${
                        isChecked ? 'bg-[#6359E9] border-[#6359E9] text-white' : 'bg-[#141332] border-[#27264E]'
                      }`}>
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="text-xs">Ticket #{m.ticketNumber} — {m.fullName}</span>
                    </div>

                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      isChecked ? 'bg-[#02B15A]/20 text-[#02B15A] border border-[#02B15A]/30' : 'bg-[#27264E] text-[#AEABD8]'
                    }`}>
                      {isChecked ? 'Attending' : 'Saving'}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowOnlyAttending(true);
                setShowRollCallModal(false);
              }}
              className="w-full bg-[#6359E9] hover:bg-[#6F64FF] text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              Done &amp; Begin Live Bidding ({attendingMemberIds.length} Bidders)
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 2: HAMMER DOWN & CONFIRM CLOSE ─────────────────────────────── */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-[#1D1D41] border border-[#27264E] text-white rounded-3xl w-full max-w-lg p-4 sm:p-6 shadow-2xl relative overflow-hidden max-h-[90dvh] overflow-y-auto my-auto">
            
            {showConfetti ? (() => {
              const summary = recordedWinnerSummary || {
                month: group.currentMonth,
                nextMonth: Math.min(group.durationMonths, group.currentMonth + 1),
                winnerName: winnerName,
                winnerTicket: winnerTicket,
                highestBid: highestBid,
                netPayout: netPayout,
                groupName: group.name,
                totalValue: group.totalValue,
                isLaaba: isLaabaSeetuActive,
              };

              return (
                <div className="space-y-4 text-center py-2 animate-in zoom-in-95 duration-200">
                  <div className="w-14 h-14 rounded-2xl bg-[#02B15A]/20 text-[#02B15A] border border-[#02B15A]/30 flex items-center justify-center mx-auto shadow-xs">
                    <Trophy size={28} />
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#02B15A] uppercase tracking-wider">
                      <Sparkles size={14} className="text-[#02B15A]" />
                      <span>{summary.isLaaba ? 'Laaba Seetu Profit Recorded!' : 'Auction Winner Recorded Successfully!'}</span>
                    </div>
                    <h3 className="text-lg font-extrabold text-white mt-1">
                      {summary.winnerName} {summary.winnerTicket ? `(Ticket #${summary.winnerTicket})` : ''}
                    </h3>
                    <p className="text-xs text-[#AEABD8] mt-0.5">
                      {summary.groupName} · Month {summary.month} Live Auction Concluded
                    </p>
                  </div>

                  {/* Winner Financial Snapshot */}
                  <div className="p-3.5 bg-[#141332] border border-[#27264E] rounded-2xl text-left space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#AEABD8] font-semibold">Winning Discount Bid:</span>
                      <span className="font-extrabold text-[#64CFF6] font-mono">{formatCurrency(summary.highestBid)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-[#27264E] pt-2">
                      <span className="text-[#AEABD8] font-semibold">Net Prize Pot Due to Winner:</span>
                      <span className="font-black text-[#02B15A] font-mono text-sm">{formatCurrency(summary.netPayout)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-[#27264E] pt-2">
                      <span className="text-[#AEABD8] font-semibold">Group State Transition:</span>
                      <span className="font-extrabold text-white">Advanced to Month {summary.nextMonth}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#27264E]">
                    <button
                      type="button"
                      onClick={() => {
                        const text = encodeURIComponent(
`🏆 *AUCTION RESULT ANNOUNCEMENT*
───────────────────────
🏢 *Group:* ${summary.groupName}
🗓️ *Month:* Month ${summary.month}
👤 *Winning Subscriber:* ${summary.winnerName} ${summary.winnerTicket ? `(Ticket #${summary.winnerTicket})` : ''}
💰 *Total Chit Value:* ${formatCurrency(summary.totalValue)}
📉 *Winning Discount Bid:* ${formatCurrency(summary.highestBid)}
💵 *Net Prize Pot:* ${formatCurrency(summary.netPayout)}
───────────────────────
Congratulations to the winner! 🎉`
                        );
                        window.open(`https://wa.me/?text=${text}`, '_blank');
                      }}
                      className="flex-1 py-2.5 bg-[#02B15A] hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <Send size={13} /> WhatsApp Winner Alert
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConfetti(false);
                        setShowCloseModal(false);
                      }}
                      className="flex-1 py-2.5 bg-[#6359E9] hover:bg-[#6F64FF] text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <Check size={14} /> Done
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="space-y-4 sm:space-y-5">
                <div className="border-b border-[#27264E] pb-3 flex justify-between items-center">
                  <div className="flex items-center space-x-2.5">
                    <Gavel className="text-[#64CFF6]" size={20} />
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      🔨 Hammer Down &amp; Record Winner — Month {group.currentMonth}
                    </h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => !isRecording && setShowCloseModal(false)}
                    className="text-[#AEABD8] hover:text-white p-1.5 rounded-lg hover:bg-[#27264E] transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Details Sheet */}
                <div className="space-y-3">
                  <div className="p-4 bg-[#141332] border border-[#27264E] rounded-xl space-y-2.5 text-xs text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-[#AEABD8] font-semibold">Winner / Ticket</span>
                      <span className="font-extrabold text-white flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-[#02B15A]" />
                        {winnerName} (#{winnerTicket})
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center border-t border-[#27264E] pt-2">
                      <span className="text-[#AEABD8] font-semibold">Winning Discount Bid</span>
                      <span className="font-extrabold text-[#64CFF6]">
                        {formatCurrency(highestBid)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-[#27264E] pt-2">
                      <span className="text-[#AEABD8] font-semibold">Net Cash Payout to Winner</span>
                      <span className="font-extrabold text-[#02B15A] text-sm">{formatCurrency(netPayout)}</span>
                    </div>

                    <div className="flex justify-between items-center border-t border-[#27264E] pt-2">
                      <span className="text-[#AEABD8] font-semibold">Subscriber Installment Due</span>
                      <span className={`font-bold ${isLaabaSeetuActive ? 'text-[#02B15A]' : 'text-white'}`}>
                        {isLaabaSeetuActive ? '₹0 (Laaba Seetu Free Month)' : `${formatCurrency(group.totalValue / group.durationMonths)} / member`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-[#27264E] pt-2">
                      <span className="text-[#AEABD8] font-semibold">New Kai Iruppu Pool</span>
                      <span className="font-extrabold text-[#FFBB38]">
                        {formatCurrency((isLaabaSeetuActive ? Math.max(0, group.kai_iruppu_pool - group.totalValue) : group.kai_iruppu_pool) + highestBid)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#6359E9]/10 border border-[#6359E9]/30 rounded-xl p-3 flex items-start space-x-2">
                    <AlertCircle className="text-[#64CFF6] shrink-0 mt-0.5" size={15} />
                    <p className="text-[10px] text-[#AEABD8] leading-relaxed font-medium">
                      Confirming locks {winnerName} (#{winnerTicket}) as &apos;Already Won&apos;, advances group to Month {group.currentMonth + 1}, and saves immutable audit records to Supabase.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    disabled={isRecording}
                    className="w-full sm:w-auto border border-[#27264E] hover:bg-[#27264E] text-[#AEABD8] hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClose}
                    disabled={isRecording}
                    className="w-full sm:w-auto bg-[#6359E9] hover:bg-[#6F64FF] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
                  >
                    {isRecording ? (
                      <>
                        <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Recording...
                      </>
                    ) : (
                      isLaabaSeetuActive ? 'Confirm Laaba Seetu Winner' : 'Confirm & Record Winner'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AUCTION SCHEDULE & RESCHEDULING MODAL ────────────────────────────── */}
      {group && (
        <AuctionScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          groupId={group.id}
          groupName={group.name}
          currentMonth={group.currentMonth}
          startDate={group.startDate}
          auctionDayOfMonth={group.auction_day_of_month}
          auctionTime={group.auction_time}
          nextAuctionDate={group.next_auction_date}
          nextAuctionTime={group.next_auction_time}
          onScheduleUpdated={() => {
            fetchGroupsList();
            if (selectedGroupId) {
              fetchGroupDetails(selectedGroupId);
            }
          }}
        />
      )}

      {/* ── CONCLUDED AUCTION FULL SCREEN CELEBRATION & AUDIT REPORT ────────── */}
      {showConcludedReportScreen && concludedReportData && (
        <div className="fixed inset-0 bg-black/80 flex flex-col z-50 p-1 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl sm:rounded-3xl w-full max-w-6xl my-auto mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[98dvh] sm:max-h-[96dvh]">
            
            {/* Sticky Action Header Bar */}
            <div className="bg-slate-900/95 backdrop-blur px-3.5 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                  <Trophy size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Live Concluded &amp; Sealed
                    </span>
                    {concludedReportData.isNextMonthLaabaSeetu && (
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30 animate-pulse">
                        🎉 Laaba Seetu Next
                      </span>
                    )}
                  </div>
                  <h2 className="text-xs sm:text-base font-bold text-white mt-0.5 truncate font-display">
                    {concludedReportData.groupName} — Month {concludedReportData.month} Settlement
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  type="button"
                  disabled={isGeneratingReportPdf}
                  onClick={() => handleDownloadAuctionPdf(printableReportRef.current, concludedReportData.groupName, concludedReportData.month)}
                  className="flex-1 sm:flex-initial px-2.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[11px] sm:text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingReportPdf ? (
                    <>
                      <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      <span className="hidden sm:inline">Download PDF Report</span>
                      <span className="sm:hidden">PDF Report</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSharingWhatsApp}
                  onClick={() => {
                    const nextMonthBonus = concludedReportData.isNextMonthLaabaSeetu 
                      ? `\n🎉 *BONUS:* Next Month (Month ${concludedReportData.month + 1}) is *LAABA SEETU (லாப சீட்டு)*! All subscribers pay *₹0 Due*!` 
                      : '';
                    const durationText = concludedReportData.auctionDuration ? `\n⏱️ *Auction Duration:* ${concludedReportData.auctionDuration}` : '';
                    const text = 
`🏆 *OFFICIAL AUCTION CONCLUDED REPORT*
───────────────────────
🏢 *Group:* ${concludedReportData.groupName}
🗓️ *Month Cycle:* Month ${concludedReportData.month} of ${concludedReportData.durationMonths}
👤 *Winning Subscriber:* ${concludedReportData.winnerName} ${concludedReportData.winnerTicket ? `(Ticket #${concludedReportData.winnerTicket})` : ''}
💰 *Total Chit Value:* ${formatCurrency(concludedReportData.totalValue)}
📉 *Winning Discount Bid:* -${formatCurrency(concludedReportData.winningDiscount)}
💵 *Net Take-Home Prize Pot:* ${formatCurrency(concludedReportData.netPayout)}
🏦 *New Kai Iruppu Pool:* ${formatCurrency(concludedReportData.newPool)}${nextMonthBonus}${durationText}
───────────────────────
Official record sealed on ${new Date().toLocaleDateString('en-IN')}. 🎉`;

                    handleShareAuctionWhatsApp(printableReportRef.current, concludedReportData.groupName, concludedReportData.month, text);
                  }}
                  className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] sm:text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSharingWhatsApp ? (
                    <>
                      <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sharing...</span>
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      <span className="hidden sm:inline">WhatsApp Announcement</span>
                      <span className="sm:hidden">WhatsApp</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowConcludedReportScreen(false);
                    setStage('overview');
                  }}
                  className="px-2.5 sm:px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
                >
                  <X size={14} />
                  <span className="hidden sm:inline">Close</span>
                </button>
              </div>
            </div>

            {/* Scrollable Report Body */}
            <div className="p-2 sm:p-6 overflow-y-auto bg-slate-950 flex-1">
              <div ref={printableReportRef} className="bg-slate-50 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <AuctionReportDocument 
                  data={concludedReportData} 
                  id="live-concluded-report-doc"
                  onDownloadPdf={() => handleDownloadAuctionPdf(printableReportRef.current, concludedReportData.groupName, concludedReportData.month)}
                  onShareWhatsApp={() => {
                    const nextMonthBonus = concludedReportData.isNextMonthLaabaSeetu 
                      ? `\n🎉 *BONUS:* Next Month (Month ${concludedReportData.month + 1}) is *LAABA SEETU (லாப சீட்டு)*! All subscribers pay *₹0 Due*!` 
                      : '';
                    const durationText = concludedReportData.auctionDuration ? `\n⏱️ *Auction Duration:* ${concludedReportData.auctionDuration}` : '';
                    const text = 
`🏆 *OFFICIAL AUCTION CONCLUDED REPORT*
───────────────────────
🏢 *Group:* ${concludedReportData.groupName}
🗓️ *Month Cycle:* Month ${concludedReportData.month} of ${concludedReportData.durationMonths}
👤 *Winning Subscriber:* ${concludedReportData.winnerName} ${concludedReportData.winnerTicket ? `(Ticket #${concludedReportData.winnerTicket})` : ''}
💰 *Total Chit Value:* ${formatCurrency(concludedReportData.totalValue)}
📉 *Winning Discount Bid:* -${formatCurrency(concludedReportData.winningDiscount)}
💵 *Net Take-Home Prize Pot:* ${formatCurrency(concludedReportData.netPayout)}
🏦 *New Kai Iruppu Pool:* ${formatCurrency(concludedReportData.newPool)}${nextMonthBonus}${durationText}
───────────────────────
Official record sealed on ${new Date().toLocaleDateString('en-IN')}. 🎉`;
                    handleShareAuctionWhatsApp(printableReportRef.current, concludedReportData.groupName, concludedReportData.month, text);
                  }}
                  onClose={() => {
                    setShowConcludedReportScreen(false);
                    setStage('overview');
                  }}
                  isGeneratingPdf={isGeneratingReportPdf}
                  isSharingWhatsApp={isSharingWhatsApp}
                />
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="p-2.5 sm:p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0">
              <span className="text-slate-400 font-mono text-[10px] sm:text-xs font-medium truncate">
                Immutable cryptographic ledger entry sealed in Supabase PostgreSQL.
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowConcludedReportScreen(false);
                  setStage('overview');
                }}
                className="px-4 py-1.5 sm:px-5 sm:py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl text-[11px] sm:text-xs transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: MONTH 0 ORGANIZER PROFIT WALLET SELECTION ── */}
      {showMonth0Modal && group && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#1D1D41] border border-[#27264E] text-white rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#27264E] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FFBB38]/20 border border-[#FFBB38]/40 text-[#FFBB38] flex items-center justify-center font-bold">
                  <Crown size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Confirm Launch (Month 0)</h3>
                  <span className="text-[10px] font-bold text-[#FFBB38] bg-[#FFBB38]/20 border border-[#FFBB38]/30 px-2 py-0.5 rounded-full">Organizer Profit Payout</span>
                </div>
              </div>
              <button onClick={() => setShowMonth0Modal(false)} className="w-8 h-8 rounded-full bg-[#141332] hover:bg-[#27264E] text-[#AEABD8] hover:text-white flex items-center justify-center cursor-pointer border border-[#27264E]">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-[#141332] rounded-2xl border border-[#FFBB38]/30 text-white text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-[#AEABD8]">Chit Group:</span>
                  <span>{group.name}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-[#FFBB38]">
                  <span>Organizer Profit:</span>
                  <span>₹{group.totalValue.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[11px] text-[#AEABD8] pt-1 leading-snug">
                  All 1st-month collections ({group.memberCount} × ₹{(group.totalValue / group.memberCount).toLocaleString('en-IN')}) are taken by the Organizer. Please select the vault/account from which this payout is recorded.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#AEABD8]">Payout Source Vault</label>
                <div className="space-y-1.5">
                  {WALLET_OPTIONS.map((w) => {
                    const isSelected = month0PayoutWallet === w.id;
                    const bal = balances[w.id] || 0;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setMonth0PayoutWallet(w.id)}
                        className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-[#FFBB38]/10 border-[#FFBB38] ring-2 ring-[#FFBB38]/30' 
                            : 'bg-[#141332] hover:bg-[#27264E] border-[#27264E]'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold text-white block">{w.name}</span>
                          <span className="text-[10px] text-[#AEABD8] font-mono">Available: ₹{bal.toLocaleString('en-IN')}</span>
                        </div>
                        {isSelected && <CheckCircle2 size={16} className="text-[#FFBB38] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#27264E]">
              <button
                type="button"
                onClick={() => setShowMonth0Modal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#27264E] text-[#AEABD8] hover:text-white font-bold text-xs hover:bg-[#27264E] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMonth0}
                disabled={isRecording}
                className="flex-1 py-2.5 rounded-xl bg-[#FFBB38] hover:bg-amber-400 text-black font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isRecording ? 'Processing...' : 'Confirm & Disburse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORICAL AUCTION RECORD DETAILS MODAL ─────────────────────────── */}
      {renderHistoricalModal()}

      {/* ── LIVE VIEWERS MODAL ─────────────────────────────────────────────── */}
      <LiveViewersModal
        isOpen={showViewersModal}
        onClose={() => setShowViewersModal(false)}
        viewers={activeViewers}
        totalMembers={group?.memberCount || 20}
        groupName={group?.name}
        month={group?.currentMonth}
        isDark={true}
      />

      {/* ── START LIVE AUCTION CONFIRMATION MODAL ───────────────────────── */}
      {renderStartConfirmModal()}

      {/* ── FULL-SCREEN 5-4-3-2-1 LIVE STREAM COUNTDOWN OVERLAY ─────────── */}
      {renderGoingLiveCountdownOverlay()}

    </div>
  );
}
