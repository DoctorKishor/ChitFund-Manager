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
  Printer
} from 'lucide-react';
import AuctionCountdownBanner from '@/components/AuctionCountdownBanner';
import { HelpTooltip } from '@/components/HelpTooltip';
import AuctionScheduleModal from '@/components/AuctionScheduleModal';
import { computeNextAuctionDateTime } from '@/utils/auctionSchedule';
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
  const [isStartingLiveSession, setIsStartingLiveSession] = useState<boolean>(false);
  const [liveViewerCount, setLiveViewerCount] = useState<number>(0);
  const [activeViewers, setActiveViewers] = useState<ActiveViewerInfo[]>([]);
  const [showViewersModal, setShowViewersModal] = useState<boolean>(false);
  const presenceChannelRef = useRef<any>(null);

  // Auction date override & schedule modal
  const [auctionDateOverride, setAuctionDateOverride] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);

  // Fetch active groups list from Supabase
  const fetchGroupsList = async () => {
    try {
      setLoading(true);
      const { data: groupsData } = await supabase
        .from('chit_groups')
        .select('*')
        .eq('status', 'active')
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
          if (prev && parsedGroups.some(g => g.id === prev)) return prev;
          return parsedGroups[0].id;
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
    if (!selectedGroupId || stage !== 'studio') {
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
  }, [selectedGroupId, stage, members]);

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
    if (!isAuctionDateToday && (group?.currentMonth || 0) > 0) {
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

    if (!isAuctionDateToday && (group?.currentMonth || 0) > 0) {
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
            action_description: `AUCTION CLOSED: Group "${group.name}" Month ${group.currentMonth} won by ${winningMember?.fullName || 'Member'} with discount ${formatCurrency(highestBid)}. Net Payout: ${formatCurrency(netPayout)}. Group advanced to Month ${nextMonth}.`,
            target_table: 'auction_logs',
          });
        }
      }

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

  const handleEnterStudio = () => {
    triggerHapticFeedback('light');
    setStage('studio');
  };

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

  // ── RENDER HISTORICAL AUCTION RECORD DETAILS MODAL ─────────────────────────
  const renderHistoricalModal = () => {
    if (!selectedHistoricalLog || !historicalReportData || !group) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/60 flex flex-col z-50 p-1 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-5xl my-auto mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[98dvh] sm:max-h-[96dvh]">
          
          {/* Header Bar */}
          <div className="bg-white text-slate-900 px-3.5 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                <History size={17} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                    Historical Log
                  </span>
                  {selectedHistoricalLog.isLaabaSeetu && (
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                      🎉 Laaba Seetu Month
                    </span>
                  )}
                </div>
                <h2 className="text-xs sm:text-lg font-black text-slate-900 mt-0.5 truncate">
                  {group.name} — Month {selectedHistoricalLog.month} Concluded Record
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                disabled={isGeneratingReportPdf}
                onClick={() => handleDownloadAuctionPdf(historicalPrintableRef.current, group.name, selectedHistoricalLog.month)}
                className="flex-1 sm:flex-initial px-2.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] sm:text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] sm:text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                className="px-2.5 sm:px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-200"
              >
                <X size={14} />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Scrollable Document Container */}
          <div className="p-2 sm:p-5 overflow-y-auto bg-slate-100/80 flex-1">
            <div ref={historicalPrintableRef} className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <AuctionReportDocument data={historicalReportData} id="historical-auction-report-doc" />
            </div>
          </div>

          {/* Modal Bottom Footer */}
          <div className="p-2.5 sm:p-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2 text-xs shrink-0">
            <span className="text-slate-500 font-mono text-[10px] sm:text-[11px] truncate">
              Audit ID: {selectedHistoricalLog.id}
            </span>
            <button
              type="button"
              onClick={() => setSelectedHistoricalLog(null)}
              className="px-4 py-1.5 sm:px-5 sm:py-2 bg-slate-900 hover:bg-black text-white font-black rounded-xl text-[11px] sm:text-xs transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs"
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
      <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-200">
        {/* Top Header Chit Selector */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Gavel size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Live Auction Hub</span>
              <h2 className="text-sm sm:text-base font-black text-gray-900 leading-tight">
                {group.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Chit Group:</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-gray-50 hover:bg-gray-100 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none cursor-pointer transition-colors shadow-2xs"
            >
              {allGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} (Month {g.currentMonth} of {g.durationMonths} • {formatCurrency(g.totalValue)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── COUNTDOWN & SCHEDULE BANNER ──── */}
        <AuctionCountdownBanner
          groupId={group.id}
          groupName={group.name}
          currentMonth={group.currentMonth}
          durationMonths={group.durationMonths}
          auctionDayOfMonth={group.auction_day_of_month}
          auctionTime={group.auction_time}
          nextAuctionDate={group.next_auction_date}
          nextAuctionTime={group.next_auction_time}
          startDate={group.startDate}
          allowConfigure={true}
          onScheduleUpdated={() => {
            fetchGroupsList();
            if (selectedGroupId) {
              fetchGroupDetails(selectedGroupId);
            }
          }}
          compact={false}
        />

        {/* ── GROUP SNAPSHOT KEY METRICS ──── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span>Total Chit Pot</span>
              <HelpTooltip text="Gross prize pot value collected across all members per monthly cycle." />
            </span>
            <span className="text-base sm:text-lg font-black text-gray-900 mt-0.5 block">
              {formatCurrency(group.totalValue)}
            </span>
            <span className="text-[10px] text-indigo-600 font-semibold mt-0.5 block">
              {formatCurrency(group.totalValue / group.durationMonths)} / member
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span>Current Cycle</span>
              <HelpTooltip text="Active auction month index and remaining rounds in this chit group." />
            </span>
            <span className="text-base sm:text-lg font-black text-gray-900 mt-0.5 block">
              Month {group.currentMonth} <span className="text-xs text-gray-400 font-medium">of {group.durationMonths}</span>
            </span>
            <span className="text-[10px] text-gray-500 font-semibold mt-0.5 block">
              {group.durationMonths - group.currentMonth} months remaining
            </span>
          </div>

          <div className="bg-white border border-amber-200/80 bg-amber-50/20 rounded-2xl p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center justify-between">
              <span>Kai Iruppu Pool</span>
              <HelpTooltip text="Accumulated winning bid discounts. When this reaches the total chit value, a Laaba Seetu (₹0 installment) month triggers." />
            </span>
            <span className="text-base sm:text-lg font-black text-amber-900 mt-0.5 block">
              {formatCurrency(group.kai_iruppu_pool)}
            </span>
            <span className="text-[10px] text-amber-700 font-semibold mt-0.5 block">
              {isLaabaSeetuActive ? '🎉 Laaba Seetu Active' : `${Math.round((group.kai_iruppu_pool / group.totalValue) * 100)}% toward Laaba Seetu`}
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span>Eligible Bidders</span>
              <HelpTooltip text="Subscribers who haven't won a chit prize yet and are eligible to bid in this round." />
            </span>
            <span className="text-base sm:text-lg font-black text-gray-900 mt-0.5 block">
              {eligibleCount} <span className="text-xs text-gray-400 font-medium">/ {members.length}</span>
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
              {members.length - eligibleCount} already won
            </span>
          </div>
        </div>

        {/* ── STAGE 1 STATUS & STUDIO ENTRY ACTION CARD ──── */}
        {group.currentMonth === 0 ? (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-2xl shrink-0 shadow-sm">
                  <Crown size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-amber-950 flex items-center gap-1.5">
                      <span>Month 0: Launch Phase (Organizer Profit)</span>
                      <HelpTooltip text={`In Month 0, all ${group.memberCount} member installments (${formatCurrency(group.totalValue)}) are allocated to the Organizer as Organizer Profit. Once launch collections are secured, advance to Month 1 to begin monthly live auctions.`} />
                    </h3>
                    <span className="text-[9px] font-black uppercase bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                      No Live Auction
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAdvanceMonth0}
                disabled={isRecording}
                className="bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-extrabold text-xs px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer ml-auto"
              >
                {isRecording ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Advancing to Month 1...</span>
                  </>
                ) : (
                  <>
                    <Rocket size={15} />
                    <span>Confirm Launch &amp; Advance to Month 1</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2.5 sm:p-3 rounded-2xl text-white shrink-0 shadow-sm ${
                  isAuctionDateToday ? 'bg-emerald-600' : 'bg-amber-500'
                }`}>
                  {isAuctionDateToday ? <Flame size={22} className="animate-pulse" /> : <Lock size={22} />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-gray-900 flex items-center gap-1.5">
                      <span>{isAuctionDateToday ? 'Live Auction Ready to Commence' : 'Live Auction Locked for Today'}</span>
                      <HelpTooltip text={
                        isAuctionDateToday 
                          ? 'The live auction is scheduled for today. Enter the dedicated auction studio to conduct roll call, trigger member notifications, and record live shouted bids.'
                          : 'Live bidding is restricted to the scheduled date to prevent unscheduled bids and keep all members synchronized. To conduct this auction today, please reschedule the date.'
                      } />
                    </h3>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      isAuctionDateToday 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}>
                      Scheduled: {formattedTargetAuctionDate} ({formattedTargetAuctionTime})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                {!isAuctionDateToday && (
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 border border-gray-300 cursor-pointer"
                  >
                    <CalendarClock size={15} className="text-indigo-600" />
                    <span>Reschedule Date</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleEnterStudio}
                  className={`px-5 sm:px-6 py-2.5 sm:py-3 font-black text-xs sm:text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer ${
                    isAuctionDateToday
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/20 ring-2 ring-emerald-500/30'
                      : 'bg-slate-900 hover:bg-black text-white shadow-slate-900/20'
                  }`}
                >
                  <Maximize2 size={16} />
                  <span>Enter Auction Studio</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 5. HISTORICAL AUCTION WINNING DETAILS LIST ─────────────────── */}
        <div className="bg-white border border-gray-200 rounded-3xl p-3.5 sm:p-6 shadow-sm space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Trophy size={15} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-base font-black text-gray-900 truncate flex items-center gap-1.5">
                  <span>Historical Auction Records</span>
                  <HelpTooltip text="Concluded monthly auction rounds, winning subscriber declarations, and net payouts." />
                </h3>
              </div>
            </div>

            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] sm:text-xs font-bold font-mono shrink-0">
              {historicalAuctionLogs.length} {historicalAuctionLogs.length === 1 ? 'Round' : 'Rounds'}
            </span>
          </div>

          {historicalAuctionLogs.length === 0 ? (
            <div className="text-center py-8 sm:py-10 px-3 sm:px-4 bg-gray-50/70 border border-dashed border-gray-200 rounded-2xl space-y-2">
              <Trophy className="mx-auto h-8 w-8 text-gray-300" />
              <h4 className="text-xs sm:text-sm font-bold text-gray-700">No Auction Rounds Completed Yet</h4>
              <p className="text-[10px] sm:text-[11px] text-gray-400 max-w-sm mx-auto leading-relaxed">
                Starting from Month 1, each finalized auction round will automatically be cataloged here with the winner ticket, discount forfeited, and net take-home payout.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {historicalAuctionLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setSelectedHistoricalLog(log);
                  }}
                  role="button"
                  tabIndex={0}
                  className="rounded-2xl p-3 sm:p-4 border border-gray-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 transition-all shadow-2xs space-y-2.5 cursor-pointer group hover:shadow-md active:scale-[0.99]"
                >
                  {/* Top Badges & Timestamp Row */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] sm:text-[11px] font-bold font-mono group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        Month {log.month} Auction
                      </span>

                      {log.isLaabaSeetu && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-[9px] sm:text-[10px] font-bold">
                          🎉 Laaba Seetu
                        </span>
                      )}

                      <span className="text-[10px] sm:text-[11px] text-gray-400">
                        {new Date(log.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="shrink-0">
                      {log.disbursalStatus === 'fully_disbursed' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shadow-2xs">
                          <CheckCheck size={12} className="text-emerald-600" />
                          <span>Disbursed</span>
                        </span>
                      ) : log.disbursalStatus === 'partially_disbursed' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full shadow-2xs">
                          <AlertCircle size={12} className="text-amber-600" />
                          <span>Partial (₹{log.totalDisbursed.toLocaleString('en-IN')})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                          <AlertCircle size={12} className="text-rose-600" />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial Breakdown (Receipt Row format on mobile, 3-col on desktop) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2.5 bg-gray-50/90 group-hover:bg-indigo-50/30 border border-gray-100 group-hover:border-indigo-100 rounded-xl p-2.5 sm:p-3 transition-colors">
                    {/* Winner Info */}
                    <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1 pb-1 sm:pb-0 border-b sm:border-b-0 border-gray-200/60">
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Auction Winner
                      </span>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-gray-900 truncate">
                        <Trophy size={13} className="text-amber-500 shrink-0" />
                        <span className="truncate">{log.winningBidderName}</span>
                        {log.ticketNumber && (
                          <span className="text-[10px] font-mono text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-1 rounded">
                            #{log.ticketNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Winning Discount */}
                    <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1 pb-1 sm:pb-0 border-b sm:border-b-0 border-gray-200/60">
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Discount Surrendered
                      </span>
                      <span className="text-xs sm:text-sm font-mono font-black text-rose-600">
                        -₹{log.winningDiscount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Net Winner Payout */}
                    <div className="flex sm:flex-col justify-between sm:justify-start items-center sm:items-start gap-1">
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Net Winner Payout
                      </span>
                      <span className="text-xs sm:text-sm font-mono font-black text-emerald-600">
                        ₹{log.netPayout.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Action Hint Strip */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[10px] sm:text-[11px] text-indigo-600 font-bold group-hover:text-indigo-800 transition-colors">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <FileText size={12} className="shrink-0" />
                      <span className="truncate">View timeline, timestamps &amp; PDF</span>
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] sm:text-xs shrink-0 ml-2">
                      <span>Details</span>
                      <ChevronRight size={13} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
      </div>
    );
  }

  // ── STAGE 2: FULL-SCREEN LIVE AUCTION STUDIO WORKSPACE ───────────────────
  return (
    <div className="min-h-[calc(100vh-140px)] lg:h-[calc(100vh-140px)] flex flex-col space-y-2.5 sm:space-y-3 animate-in fade-in duration-200">
      
      {/* ── TOP STUDIO CONTROL & BROADCAST BAR ──────────────────────────────── */}
      <div className="shrink-0 bg-white border border-gray-200 rounded-2xl p-2.5 sm:p-3.5 shadow-xs space-y-2 sm:space-y-2.5">
        {/* Row 1: Studio Title, Cycle & Live Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={handleExitStudio}
              className="p-1 sm:p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer shrink-0"
              title="Return to Overview"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Overview</span>
            </button>

            <span className="font-black text-xs sm:text-sm text-gray-900 truncate">
              {group.name}
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
              M{group.currentMonth}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {group.is_live_auction_active ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white flex items-center gap-1 shadow-xs animate-pulse">
                  <Flame size={10} /> Live
                </span>

                {/* Real-Time Live Viewer Counter Badge (Interactive Click to View Room List) */}
                <button
                  type="button"
                  onClick={() => setShowViewersModal(true)}
                  className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-extrabold border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                    liveViewerCount > 0 
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 shadow-xs ring-1 ring-emerald-400/30' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-gray-200'
                  }`}
                  title="Click to see list of active live viewers"
                >
                  <Eye size={12} className={liveViewerCount > 0 ? 'text-emerald-600 animate-pulse' : 'text-gray-400'} />
                  <span className="font-mono">{liveViewerCount}</span>
                  <span className="hidden sm:inline font-sans text-[9px] text-emerald-600 font-bold">
                    {liveViewerCount === 1 ? 'viewer' : 'viewers'}
                  </span>
                </button>
              </div>
            ) : (
              <span className="text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                Standby
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Action Control Buttons - Clean 2x2 Grid on Mobile, 4-Column Bar on Desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2">
          {/* 1. Broadcast Trigger */}
          {group.currentMonth > 0 && !group.is_live_auction_active ? (
            <button
              type="button"
              onClick={handleBeginLiveAuction}
              disabled={isStartingLiveSession}
              className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 active:scale-98 text-white text-[11px] sm:text-xs font-black py-1.5 px-2.5 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Radio size={12} className="animate-pulse" />
              <span>{isStartingLiveSession ? 'Starting...' : 'Begin Live'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEndLiveAuctionSession}
              disabled={isStartingLiveSession}
              className="flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-1.5 px-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <span>End Live</span>
            </button>
          )}

          {/* 2. Roll Call */}
          <button
            type="button"
            onClick={() => setShowRollCallModal(true)}
            className="flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-98 text-indigo-700 border border-indigo-200 text-[11px] sm:text-xs font-bold py-1.5 px-2 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <Users size={12} />
            <span>Roll Call ({attendingMemberIds.length}/{eligibleCount})</span>
          </button>

          {/* 3. Live Timeline */}
          <button
            type="button"
            onClick={() => setShowTimelineDrawer(true)}
            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 text-[11px] sm:text-xs font-bold py-1.5 px-2 rounded-xl transition-all shadow-2xs cursor-pointer"
          >
            <History size={12} className="text-indigo-600" />
            <span>Timeline ({bids.length})</span>
          </button>

          {/* 4. Quick Undo & Hammer Down / Close */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={bids.length === 0}
              title="Undo last recorded bid"
              className="p-1.5 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-200 text-gray-700 text-[11px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              <Undo2 size={12} />
            </button>

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
              className="flex-1 font-bold text-[11px] sm:text-xs py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 shadow-xs transition-all bg-gray-900 hover:bg-black active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white cursor-pointer"
            >
              <Gavel size={12} />
              <span>{isLaabaSeetuActive ? 'Close Laaba' : 'Close Auction'}</span>
            </button>
          </div>
        </div>

        {/* Compact 3-Card Real-Time Status Bar in a single horizontal grid on mobile */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1.5 border-t border-gray-100">
          {/* 1. Live Leader / Starting Bid */}
          <div className={`p-1.5 sm:p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
            bids.length > 0 
              ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/70 border-indigo-300 text-indigo-950 shadow-2xs' 
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-indigo-700 truncate block">
              {bids.length > 0 ? '👑 Leader' : 'Opening Bid'}
            </span>
            <div className="flex items-baseline justify-between gap-1 mt-0.5">
              <span className="text-[10px] sm:text-xs font-extrabold truncate text-gray-900">
                {bids.length > 0 ? winnerName.split(' ')[0] : 'Min'}
              </span>
              <span className="text-[11px] sm:text-xs font-black text-indigo-700 shrink-0 font-mono">
                {bids.length > 0 ? formatCurrency(highestBid) : formatCurrency(startingBaselineBid)}
              </span>
            </div>
          </div>

          {/* 2. Winner Net Cash Payout */}
          <div className="p-1.5 sm:p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-emerald-800 truncate block">
                Net Payout
              </span>
              <span className="text-[8px] sm:text-[9px] text-emerald-600 font-mono hidden sm:inline">
                Pot: {formatCurrency(group.totalValue)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 mt-0.5">
              <span className="text-[9px] sm:text-[10px] text-emerald-700 font-semibold truncate sm:hidden">
                Pot: {formatCurrency(group.totalValue)}
              </span>
              <span className="text-[11px] sm:text-xs font-black text-emerald-900 shrink-0 font-mono ml-auto">
                {formatCurrency(netPayout)}
              </span>
            </div>
          </div>

          {/* 3. Accumulated Kai Iruppu Pool */}
          <div className="p-1.5 sm:p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-amber-800 truncate block">
                Kai Iruppu
              </span>
              <span className="text-[8px] sm:text-[9px] text-amber-600 font-mono hidden sm:inline">
                +{formatCurrency(highestBid)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 mt-0.5">
              <span className="text-[9px] sm:text-[10px] text-amber-700 font-medium truncate sm:hidden">
                +{formatCurrency(highestBid)}
              </span>
              <span className="text-[11px] sm:text-xs font-black text-amber-800 shrink-0 font-mono ml-auto">
                {formatCurrency(group.kai_iruppu_pool)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FULL CANVAS DYNAMIC AUTOSCALING MEMBER GRID ────────────────────────── */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-2xl p-2.5 sm:p-4 shadow-sm flex flex-col space-y-2">
        
        {/* Workspace Toolbar Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Users size={14} className="text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-gray-900 truncate">
              Active Bidders ({visibleContenders.length})
            </span>
            <span className="text-[10px] text-gray-400 hidden sm:inline truncate">
              — Tap card to log bid
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowOnlyAttending(v => !v)}
              className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg transition-all border cursor-pointer ${
                showOnlyAttending 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                  : 'bg-gray-100 border-gray-200 text-gray-700'
              }`}
            >
              {showOnlyAttending ? `Attending (${attendingMemberIds.length})` : `All (${members.length})`}
            </button>
          </div>
        </div>

        {/* Auto-Scaling Grid (fills 100% of the available canvas) */}
        {displayedMembers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl p-5 bg-gray-50/50">
            <Users size={24} className="mx-auto text-gray-300 mb-1.5" />
            <p className="font-bold text-gray-600">No active bidders checked in</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Click &apos;Roll Call&apos; at the top to check in participating members.</p>
          </div>
        ) : (
          <div 
            className="flex-1 min-h-0 grid gap-2 sm:gap-2.5 w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${gridLayout.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridLayout.rows}, minmax(0, 1fr))`
            }}
          >
            {displayedMembers.map((m) => {
              const isWon = m.hasWonRegular;
              const isCurrentTopBidder = winnerId === m.id;
              const memberLastBid = bids.find(b => b.memberId === m.id)?.amount;

              if (isWon) {
                return (
                  <div
                    key={m.id}
                    className="h-full rounded-2xl border border-gray-200 bg-gray-50/60 opacity-45 p-2.5 sm:p-3 flex flex-col justify-between cursor-not-allowed select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-lg bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center">
                        #{m.ticketNumber}
                      </span>
                      <span className="text-[9px] font-bold uppercase bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        Won
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-gray-500 block truncate">
                        {m.fullName}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleOpenBidModal(m.id)}
                  className={`h-full w-full rounded-2xl border text-left transition-all flex flex-col justify-between group cursor-pointer hover:shadow-md active:scale-98 ${
                    gridLayout.isSpacious 
                      ? 'p-3.5 sm:p-4' 
                      : gridLayout.isMedium 
                      ? 'p-2.5 sm:p-3' 
                      : 'p-2 sm:p-2.5'
                  } ${
                    isCurrentTopBidder
                      ? 'bg-gradient-to-br from-emerald-50 via-teal-50/70 to-emerald-100/50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500/30 shadow-xs'
                      : 'bg-white hover:bg-indigo-50/60 hover:border-indigo-300 border-gray-200 text-gray-800 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`${
                      gridLayout.isSpacious 
                        ? 'w-9 h-9 sm:w-10 sm:h-10 text-xs sm:text-sm' 
                        : gridLayout.isMedium 
                        ? 'w-7 h-7 sm:w-8 sm:h-8 text-xs' 
                        : 'w-6 h-6 sm:w-7 sm:h-7 text-[11px]'
                    } rounded-xl font-black flex items-center justify-center transition-all ${
                      isCurrentTopBidder
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}>
                      #{m.ticketNumber}
                    </span>

                    {isCurrentTopBidder ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                        <Crown size={11} /> Top Leader
                      </span>
                    ) : memberLastBid ? (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 group-hover:text-indigo-600 font-medium">
                        Tap to bid
                      </span>
                    )}
                  </div>

                  <div className="w-full min-w-0 mt-1">
                    <span 
                      title={m.fullName}
                      className={`${
                        gridLayout.isSpacious 
                          ? 'text-sm sm:text-base' 
                          : gridLayout.isMedium 
                          ? 'text-xs sm:text-sm' 
                          : 'text-xs'
                      } font-black block leading-snug line-clamp-2 break-words ${
                        isCurrentTopBidder ? 'text-emerald-950' : 'text-gray-900 group-hover:text-indigo-950'
                      }`}
                    >
                      {m.fullName}
                    </span>

                    <div className="mt-0.5 flex items-center justify-between text-xs">
                      {isCurrentTopBidder ? (
                        <span className={`${gridLayout.isSpacious ? 'text-sm' : 'text-xs'} font-black text-emerald-700`}>
                          {formatCurrency(highestBid)}
                        </span>
                      ) : memberLastBid ? (
                        <span className="text-gray-500 font-medium">
                          Last: <strong className="text-gray-900">{formatCurrency(memberLastBid)}</strong>
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">
                          No bid yet
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* ── POP-UP MODAL: CANDIDATE TARGET PRICES BIDDING DIALOG ──────────────── */}
      {showBidModal && activeContender && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative max-h-[90dvh] overflow-y-auto animate-in zoom-in-95 duration-150 my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm shrink-0">
                  #{activeContender.ticketNumber}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block truncate">
                    Logging Live Bid For
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900 truncate">
                    {activeContender.fullName}
                  </h3>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowBidModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Highest Live Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Current Top Bid</span>
                <span className="font-extrabold text-gray-900 text-sm">{formatCurrency(highestBid)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Live Leader</span>
                <span className="font-bold text-indigo-700 truncate block max-w-[150px]">{winnerName}</span>
              </div>
            </div>

            {/* 1-Tap Candidate Target Price Tiles (Auto-closes on tap) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  🎯 Next Candidate Target Prices (1-Tap Log)
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold">Auto-closes on tap</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
                {candidateTargetTiles.map((price) => {
                  const diff = price - highestBid;
                  return (
                    <button
                      key={price}
                      type="button"
                      onClick={() => recordBid(price, activeContender.id)}
                      className="p-3 bg-white hover:bg-indigo-600 hover:text-white active:bg-indigo-700 border border-gray-200 hover:border-indigo-600 rounded-xl text-center transition-all shadow-2xs group cursor-pointer"
                    >
                      <span className="text-xs sm:text-sm font-black text-gray-900 group-hover:text-white block">
                        {formatCurrency(price)}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 group-hover:text-indigo-200 block mt-0.5">
                        +{formatCurrency(diff)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Shorthand Amount Form (e.g. "29" = ₹29,000) */}
            <form onSubmit={handleCustomBidSubmit} className="pt-3 border-t border-gray-100 space-y-2.5">
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                ⚡ Arbitrary Shouted Amount (Type &apos;29&apos; = ₹29,000)
              </label>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-2.5 text-xs text-gray-400 font-bold">₹</span>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="e.g. 29 or 28.5 or 29000"
                    value={customBidInput}
                    onChange={(e) => setCustomBidInput(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-2 text-xs sm:text-sm font-bold text-gray-900 focus:outline-none shadow-2xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={parsedCustomBidAmount <= 0}
                  className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-40 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  Log {parsedCustomBidAmount > 0 ? formatCurrency(parsedCustomBidAmount) : 'Bid'}
                </button>
              </div>

              {parsedCustomBidAmount > 0 && (
                <div className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center justify-between">
                  <span>Interpreted Bid: <strong>{formatCurrency(parsedCustomBidAmount)}</strong></span>
                  <span>Net Payout: <strong>{formatCurrency((group?.totalValue || 0) - parsedCustomBidAmount)}</strong></span>
                </div>
              )}
            </form>

          </div>
        </div>
      )}

      {/* ── SLIDE-OVER DRAWER: LIVE BIDDING TIMELINE ──────────────────────────── */}
      {showTimelineDrawer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-end z-50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border-l border-gray-200 w-full max-w-md h-full p-4 sm:p-5 space-y-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-2">
                  <History size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-900">Live Bidding Timeline ({bids.length})</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowTimelineDrawer(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Bids Stream List */}
              <div className="space-y-2 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
                {bids.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 space-y-2 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-4">
                    <Gavel size={26} className="text-gray-300 animate-pulse mx-auto" />
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Ready to Record</p>
                    <p className="text-[11px] text-gray-400">Tap any member card to begin logging live shouts.</p>
                  </div>
                ) : (
                  bids.map((bid, index) => {
                    const isTopBid = index === 0;

                    return (
                      <div 
                        key={bid.id} 
                        className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                          isTopBid 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-2xs' 
                            : 'bg-gray-50/70 border-gray-200 text-gray-600'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 overflow-hidden mr-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isTopBid ? 'bg-indigo-600 animate-pulse' : 'bg-gray-400'}`}></span>
                          <div className="flex flex-col overflow-hidden">
                            <span className={`text-xs font-bold truncate ${isTopBid ? 'text-indigo-950' : 'text-gray-800'}`}>
                              {bid.memberName}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">#{bid.ticketNumber} · {bid.timestamp}</span>
                          </div>
                        </div>

                        <span className={`text-xs font-black shrink-0 ${isTopBid ? 'text-indigo-700' : 'text-gray-700'}`}>
                          {formatCurrency(bid.amount)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Undo Action */}
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={bids.length === 0}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Undo2 size={14} />
                <span>Undo Last Bid</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTimelineDrawer(false)}
                className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL 1: PRE-AUCTION ROLL CALL (ATTENDANCE CHECK-IN) ─────────────── */}
      {showRollCallModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-4 sm:p-5 space-y-4 shadow-2xl relative max-h-[90dvh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Pre-Auction Roll Call</h3>
                  <p className="text-[10px] text-gray-500">Check members participating in today&apos;s auction</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowRollCallModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Select All / Clear Fast Actions */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-bold text-gray-700">
                {attendingMemberIds.length} of {eligibleCount} Members Attending
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllEligibleAttendees}
                  className="text-indigo-600 font-bold text-xs hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={clearAllAttendees}
                  className="text-gray-500 font-bold text-xs hover:underline cursor-pointer"
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
                        ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-gray-50 border-gray-200 text-gray-600 font-normal hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center border text-xs ${
                        isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'
                      }`}>
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="text-xs">Ticket #{m.ticketNumber} — {m.fullName}</span>
                    </div>

                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      isChecked ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isChecked ? 'Attending' : 'Saving'}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowRollCallModal(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              Done &amp; Begin Live Bidding ({attendingMemberIds.length} Bidders)
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 2: HAMMER DOWN & CONFIRM CLOSE ─────────────────────────────── */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg p-4 sm:p-6 shadow-2xl relative overflow-hidden max-h-[90dvh] overflow-y-auto my-auto">
            
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
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                    <Trophy size={28} />
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
                      <Sparkles size={14} className="text-emerald-600" />
                      <span>{summary.isLaaba ? 'Laaba Seetu Profit Recorded!' : 'Auction Winner Recorded Successfully!'}</span>
                    </div>
                    <h3 className="text-lg font-extrabold text-gray-900 mt-1">
                      {summary.winnerName} {summary.winnerTicket ? `(Ticket #${summary.winnerTicket})` : ''}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {summary.groupName} · Month {summary.month} Live Auction Concluded
                    </p>
                  </div>

                  {/* Winner Financial Snapshot */}
                  <div className="p-3.5 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border border-emerald-200/80 rounded-2xl text-left space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-semibold">Winning Discount Bid:</span>
                      <span className="font-extrabold text-indigo-700 font-mono">{formatCurrency(summary.highestBid)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-emerald-200/60 pt-2">
                      <span className="text-gray-500 font-semibold">Net Prize Pot Due to Winner:</span>
                      <span className="font-black text-emerald-700 font-mono text-sm">{formatCurrency(summary.netPayout)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-emerald-200/60 pt-2">
                      <span className="text-gray-500 font-semibold">Group State Transition:</span>
                      <span className="font-extrabold text-gray-800">Advanced to Month {summary.nextMonth}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
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
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <Send size={13} /> WhatsApp Winner Alert
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConfetti(false);
                        setShowCloseModal(false);
                      }}
                      className="flex-1 py-2.5 bg-gray-900 hover:bg-black text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    >
                      <Check size={14} /> Done
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="space-y-4 sm:space-y-5">
                <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div className="flex items-center space-x-2.5">
                    <Gavel className="text-indigo-600" size={20} />
                    <h3 className="text-sm sm:text-base font-bold text-gray-900">
                      🔨 Hammer Down &amp; Record Winner — Month {group.currentMonth}
                    </h3>
                  </div>
                  <button 
                    type="button"
                    onClick={() => !isRecording && setShowCloseModal(false)}
                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Details Sheet */}
                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-semibold">Winner / Ticket</span>
                      <span className="font-extrabold text-gray-900 flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        {winnerName} (#{winnerTicket})
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                      <span className="text-gray-500 font-semibold">Winning Discount Bid</span>
                      <span className="font-extrabold text-indigo-700">
                        {formatCurrency(highestBid)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                      <span className="text-gray-500 font-semibold">Net Cash Payout to Winner</span>
                      <span className="font-extrabold text-emerald-700 text-sm">{formatCurrency(netPayout)}</span>
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                      <span className="text-gray-500 font-semibold">Subscriber Installment Due</span>
                      <span className={`font-bold ${isLaabaSeetuActive ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {isLaabaSeetuActive ? '₹0 (Laaba Seetu Free Month)' : `${formatCurrency(group.totalValue / group.durationMonths)} / member`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                      <span className="text-gray-500 font-semibold">New Kai Iruppu Pool</span>
                      <span className="font-extrabold text-amber-600">
                        {formatCurrency((isLaabaSeetuActive ? Math.max(0, group.kai_iruppu_pool - group.totalValue) : group.kai_iruppu_pool) + highestBid)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-start space-x-2">
                    <AlertCircle className="text-indigo-600 shrink-0 mt-0.5" size={15} />
                    <p className="text-[10px] text-indigo-900 leading-relaxed font-medium">
                      Confirming locks {winnerName} (#{winnerTicket}) as &apos;Already Won&apos;, advances group to Month {group.currentMonth + 1}, and saves immutable audit records to Supabase.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    disabled={isRecording}
                    className="w-full sm:w-auto border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClose}
                    disabled={isRecording}
                    className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
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
        <div className="fixed inset-0 bg-slate-900/60 flex flex-col z-50 p-1 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-5xl my-auto mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[98dvh] sm:max-h-[96dvh]">
            
            {/* Sticky Action Header Bar */}
            <div className="bg-white text-slate-900 px-3.5 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <Trophy size={17} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live Concluded &amp; Sealed
                    </span>
                    {concludedReportData.isNextMonthLaabaSeetu && (
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                        🎉 Laaba Seetu Next
                      </span>
                    )}
                  </div>
                  <h2 className="text-xs sm:text-lg font-black text-slate-900 mt-0.5 truncate">
                    {concludedReportData.groupName} — Month {concludedReportData.month} Report
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  type="button"
                  disabled={isGeneratingReportPdf}
                  onClick={() => handleDownloadAuctionPdf(printableReportRef.current, concludedReportData.groupName, concludedReportData.month)}
                  className="flex-1 sm:flex-initial px-2.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] sm:text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                    const text = 
`🏆 *OFFICIAL AUCTION CONCLUDED REPORT*
───────────────────────
🏢 *Group:* ${concludedReportData.groupName}
🗓️ *Month Cycle:* Month ${concludedReportData.month} of ${concludedReportData.durationMonths}
👤 *Winning Subscriber:* ${concludedReportData.winnerName} ${concludedReportData.winnerTicket ? `(Ticket #${concludedReportData.winnerTicket})` : ''}
💰 *Total Chit Value:* ${formatCurrency(concludedReportData.totalValue)}
📉 *Winning Discount Bid:* -${formatCurrency(concludedReportData.winningDiscount)}
💵 *Net Take-Home Prize Pot:* ${formatCurrency(concludedReportData.netPayout)}
🏦 *New Kai Iruppu Pool:* ${formatCurrency(concludedReportData.newPool)}${nextMonthBonus}
───────────────────────
Official record sealed on ${new Date().toLocaleDateString('en-IN')}. 🎉`;

                    handleShareAuctionWhatsApp(printableReportRef.current, concludedReportData.groupName, concludedReportData.month, text);
                  }}
                  className="flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] sm:text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                  onClick={() => {
                    setShowConcludedReportScreen(false);
                    setStage('overview');
                  }}
                  className="px-2.5 sm:px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-200"
                >
                  <X size={14} />
                  <span className="hidden sm:inline">Close</span>
                </button>
              </div>
            </div>

            {/* Scrollable Report Body */}
            <div className="p-2 sm:p-6 overflow-y-auto bg-slate-100/80 flex-1">
              <div ref={printableReportRef} className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <AuctionReportDocument data={concludedReportData} id="live-concluded-report-doc" />
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="p-2.5 sm:p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2 text-xs shrink-0">
              <span className="text-slate-500 font-mono text-[10px] sm:text-xs font-medium truncate">
                Saved to immutable ledger.
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowConcludedReportScreen(false);
                  setStage('overview');
                }}
                className="px-4 py-1.5 sm:px-5 sm:py-2 bg-slate-900 hover:bg-black text-white font-black rounded-xl text-[11px] sm:text-xs transition-all active:scale-95 cursor-pointer shrink-0 shadow-xs"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: MONTH 0 ORGANIZER PROFIT WALLET SELECTION ── */}
      {showMonth0Modal && group && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Crown size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Confirm Launch (Month 0)</h3>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Organizer Profit Payout</span>
                </div>
              </div>
              <button onClick={() => setShowMonth0Modal(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-950 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Chit Group:</span>
                  <span>{group.name}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-amber-900">
                  <span>Organizer Profit:</span>
                  <span>₹{group.totalValue.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[11px] text-amber-800/90 pt-1 leading-snug">
                  All 1st-month collections ({group.memberCount} × ₹{(group.totalValue / group.memberCount).toLocaleString('en-IN')}) are taken by the Organizer. Please select the vault/account from which this payout is recorded.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Payout Source Vault</label>
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
                            ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300' 
                            : 'bg-gray-50/60 hover:bg-gray-100 border-gray-200'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold text-gray-900 block">{w.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">Available: ₹{bal.toLocaleString('en-IN')}</span>
                        </div>
                        {isSelected && <CheckCircle2 size={16} className="text-amber-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowMonth0Modal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMonth0}
                disabled={isRecording}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
        isDark={false}
      />

    </div>
  );
}
