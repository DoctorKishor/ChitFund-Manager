'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import FontSizeSwitcher from '@/components/FontSizeSwitcher';
import { 
  Ticket, 
  Wallet, 
  Trophy, 
  Sparkles, 
  History, 
  LogOut, 
  CheckCircle2, 
  ChevronRight, 
  FileText, 
  Layers, 
  ShieldCheck, 
  ArrowDownLeft, 
  Sun, 
  Moon,
  CalendarClock,
  Clock,
  Calendar,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Radio,
  ChevronDown,
  ChevronUp,
  Info,
  Flame,
  Gavel
} from 'lucide-react';
import AuctionCountdownBanner from '@/components/AuctionCountdownBanner';
import AuctionCountdownStack from '@/components/AuctionCountdownStack';
import AuctionRescheduleAlertModal, { RescheduledGroupNotice } from '@/components/AuctionRescheduleAlertModal';
import LiveAuctionStartedModal, { LiveGroupDetails } from '@/components/LiveAuctionStartedModal';
import SubscriberLiveAuctionArena, { LiveBidItem, GroupMemberItem } from '@/components/SubscriberLiveAuctionArena';
import { computeNextAuctionDateTime, formatTime12h } from '@/utils/auctionSchedule';

interface EnrolledGroup {
  groupId: string;
  groupName: string;
  totalValue: number;
  memberCount: number;
  durationMonths: number;
  currentMonth: number;
  kaiIruppuPool: number;
  status: string;
  startDate: string;
  ticketNumber: number;
  hasWonRegular: boolean;
  physicalBookSynced: boolean;
  monthlyInstallment: number;
  auctionDayOfMonth?: number | null;
  auctionTime?: string | null;
  nextAuctionDate?: string | null;
  nextAuctionTime?: string | null;
  lastRescheduledAt?: string | null;
  rescheduleReason?: string | null;
  isLiveAuctionActive?: boolean;
  liveAuctionStartedAt?: string | null;
  liveBidStream?: LiveBidItem[];
  members?: GroupMemberItem[];
}

interface SubscriberTransaction {
  id: string;
  groupId: string;
  groupName: string;
  type: string;
  amount: number;
  walletType: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface GroupAuction {
  id: string;
  groupId: string;
  groupName: string;
  month: number;
  winningDiscount: number;
  winnerId: string;
  winnerName: string;
  isLaabaSeetu: boolean;
  createdAt: string;
  netPayout: number;
  isCurrentSubscriberWinner: boolean;
}

export interface MonthDueItem {
  month: number;
  monthNameShort: string;
  monthNameLong: string;
  expectedDue: number;
  paidAmount: number;
  remainingDue: number;
  status: 'paid' | 'partial' | 'unpaid' | 'free_laaba';
  isOverdue: boolean;
  isCurrentCycle: boolean;
  dueDate: Date;
  formattedDueDate: string;
}

export interface GroupPaymentStatus {
  effectiveCurrentMonth: number;
  totalExpectedDue: number;
  totalPaidForGroup: number;
  outstandingBalance: number;
  isSettled: boolean;
  pendingMonthsCount: number;
  isPastDueDate: boolean;
  daysRemaining: number | null;
  daysOverdue: number | null;
  dueDate: Date;
  formattedDueDate: string;
  monthDues: MonthDueItem[];
}

function getGroupPaymentStatus(
  grp: EnrolledGroup,
  transactions: SubscriberTransaction[],
  auctions: GroupAuction[]
): GroupPaymentStatus {
  const groupAuctions = auctions.filter((a) => a.groupId === grp.groupId);
  const maxAuctionMonth = groupAuctions.length > 0 
    ? Math.max(...groupAuctions.map((a) => a.month || 0)) 
    : 0;

  // Effective active month: takes maximum of currentMonth in chit_groups, maxAuctionMonth, or 0
  const effectiveCurrentMonth = Math.max(
    grp.currentMonth !== undefined && grp.currentMonth !== null ? grp.currentMonth : 0,
    maxAuctionMonth
  );

  const groupTransactions = transactions.filter(
    (t) =>
      (t.groupId === grp.groupId || t.groupName === grp.groupName) &&
      t.type === 'collection' &&
      t.status === 'completed'
  );

  const totalPaidForGroup = groupTransactions.reduce(
    (sum, t) => sum + Number(t.amount || 0),
    0
  );

  const monthDues: MonthDueItem[] = [];

  for (let m = 0; m <= effectiveCurrentMonth; m++) {
    const monthAuction = groupAuctions.find((a) => a.month === m);
    const isLaaba = !!monthAuction?.isLaabaSeetu;
    const expectedDue = isLaaba ? 0 : grp.monthlyInstallment;

    // Check transactions tagged with "Month <m>"
    const monthPattern = new RegExp(`\\bMonth\\s+${m}\\b`, 'i');
    const taggedTransactions = groupTransactions.filter(
      (t) => t.notes && monthPattern.test(t.notes)
    );
    const taggedPaid = taggedTransactions.reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0
    );

    const monthNameShort = getChitMonthName(grp.startDate, m, 'short');
    const monthNameLong = getChitMonthName(grp.startDate, m, 'long');

    const cycleDueDate = computeNextAuctionDateTime({
      auction_day_of_month: grp.auctionDayOfMonth,
      auction_time: grp.auctionTime,
      next_auction_date: grp.nextAuctionDate,
      next_auction_time: grp.nextAuctionTime,
      start_date: grp.startDate,
      current_month: m,
    });

    monthDues.push({
      month: m,
      monthNameShort,
      monthNameLong,
      expectedDue,
      paidAmount: taggedPaid,
      remainingDue: Math.max(0, expectedDue - taggedPaid),
      status: isLaaba ? 'free_laaba' : taggedPaid >= expectedDue ? 'paid' : taggedPaid > 0 ? 'partial' : 'unpaid',
      isOverdue: false,
      isCurrentCycle: m === effectiveCurrentMonth,
      dueDate: cycleDueDate,
      formattedDueDate: cycleDueDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    });
  }

  // Calculate sum of tagged payments
  const sumTaggedPaid = monthDues.reduce((sum, item) => sum + item.paidAmount, 0);

  // If there are untagged payments or totalPaid exceeds tagged payments, apply FIFO fallback to unallocated months
  if (totalPaidForGroup > sumTaggedPaid) {
    let surplus = totalPaidForGroup - sumTaggedPaid;
    for (const item of monthDues) {
      if (surplus <= 0) break;
      if (item.remainingDue > 0) {
        const canTake = Math.min(surplus, item.remainingDue);
        item.paidAmount += canTake;
        item.remainingDue = Math.max(0, item.expectedDue - item.paidAmount);
        surplus -= canTake;
        if (item.paidAmount >= item.expectedDue) {
          item.status = 'paid';
        } else if (item.paidAmount > 0) {
          item.status = 'partial';
        }
      }
    }
  }

  // If NO payments were tagged at all (e.g. general collections), allocate totalPaid purely FIFO from M0 onwards
  if (sumTaggedPaid === 0 && totalPaidForGroup > 0) {
    let remainingPool = totalPaidForGroup;
    for (const item of monthDues) {
      if (remainingPool <= 0) {
        item.paidAmount = 0;
        item.remainingDue = item.expectedDue;
        item.status = item.expectedDue === 0 ? 'free_laaba' : 'unpaid';
        continue;
      }
      const canTake = Math.min(remainingPool, item.expectedDue);
      item.paidAmount = canTake;
      item.remainingDue = Math.max(0, item.expectedDue - canTake);
      remainingPool -= canTake;
      if (item.paidAmount >= item.expectedDue) {
        item.status = 'paid';
      } else if (item.paidAmount > 0) {
        item.status = 'partial';
      } else {
        item.status = item.expectedDue === 0 ? 'free_laaba' : 'unpaid';
      }
    }
  }

  const totalExpectedDue = monthDues.reduce((sum, item) => sum + item.expectedDue, 0);
  const outstandingBalance = monthDues.reduce((sum, item) => sum + item.remainingDue, 0);
  const isSettled = outstandingBalance === 0;
  const pendingMonthsCount = monthDues.filter((item) => item.remainingDue > 0).length;

  const now = new Date();
  // Mark overdue months
  monthDues.forEach((item) => {
    if (item.remainingDue > 0) {
      if (item.month < effectiveCurrentMonth) {
        item.isOverdue = true;
      } else if (now.getTime() >= item.dueDate.getTime()) {
        item.isOverdue = true;
      }
    }
  });

  // Target due date is the current cycle's auction date
  const currentMonthDueItem = monthDues.find((item) => item.month === effectiveCurrentMonth) || monthDues[monthDues.length - 1];
  const dueDate = currentMonthDueItem ? currentMonthDueItem.dueDate : new Date();
  const formattedDueDate = currentMonthDueItem ? currentMonthDueItem.formattedDueDate : '';

  let isPastDueDate = false;
  let daysRemaining: number | null = null;
  let daysOverdue: number | null = null;

  if (outstandingBalance > 0) {
    const hasPastArrears = monthDues.some((item) => item.month < effectiveCurrentMonth && item.remainingDue > 0);
    if (hasPastArrears) {
      isPastDueDate = true;
      const diffMs = now.getTime() - dueDate.getTime();
      daysOverdue = diffMs > 0 ? Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24))) : 1;
    } else if (now.getTime() >= dueDate.getTime()) {
      isPastDueDate = true;
      const diffMs = now.getTime() - dueDate.getTime();
      daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } else {
      isPastDueDate = false;
      const diffMs = dueDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  return {
    effectiveCurrentMonth,
    totalExpectedDue,
    totalPaidForGroup,
    outstandingBalance,
    isSettled,
    pendingMonthsCount,
    isPastDueDate,
    daysRemaining,
    daysOverdue,
    dueDate,
    formattedDueDate,
    monthDues,
  };
}

function getChitMonthName(
  startDateStr: string | null | undefined,
  monthNumber: number,
  format: 'short' | 'long' = 'long'
): string {
  if (!startDateStr) {
    const d = new Date();
    return d.toLocaleString('en-IN', { month: format });
  }
  try {
    const base = new Date(startDateStr);
    // Month 0 = startDate month, Month 1 = startDate + 1 month, etc.
    const targetDate = new Date(base.getFullYear(), base.getMonth() + monthNumber, base.getDate() || 1);
    return targetDate.toLocaleString('en-IN', { month: format });
  } catch (e) {
    const d = new Date();
    return d.toLocaleString('en-IN', { month: format });
  }
}

export default function SubscriberPortal() {
  const { profile, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'overview' | 'chits' | 'passbook' | 'auctions'>('overview');
  
  const [groups, setGroups] = useState<EnrolledGroup[]>([]);
  const [transactions, setTransactions] = useState<SubscriberTransaction[]>([]);
  const [auctions, setAuctions] = useState<GroupAuction[]>([]);
  const [selectedTx, setSelectedTx] = useState<SubscriberTransaction | null>(null);
  const [selectedPassbookGroup, setSelectedPassbookGroup] = useState<string>('all');

  const [syncing, setSyncing] = useState(false);

  // Reschedule alert states
  const [rescheduleAcknowledgments, setRescheduleAcknowledgments] = useState<Record<string, { acknowledgedAt: string; lastRescheduledAt?: string }>>({});
  const [sessionDismissedReschedules, setSessionDismissedReschedules] = useState<string[]>([]);
  const [isAlertModalDismissed, setIsAlertModalDismissed] = useState<boolean>(false);

  // Live auction realtime alert states
  const [dismissedLiveAuctionGroupIds, setDismissedLiveAuctionGroupIds] = useState<string[]>([]);
  const [activeLiveArenaGroupId, setActiveLiveArenaGroupId] = useState<string | null>(null);

  // Expandable monthly dues breakdown state per group
  const [expandedBreakdownGroupIds, setExpandedBreakdownGroupIds] = useState<string[]>([]);

  const toggleBreakdown = (groupId: string) => {
    setExpandedBreakdownGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  // Initialize theme from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('cf_subscriber_theme') as 'dark' | 'light';
      if (savedTheme) {
        setTheme(savedTheme);
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cf_subscriber_theme', newTheme);
    }
  };

  const loadSubscriberData = useCallback(async (isSilent = false) => {
    if (!profile?.id) return;
    try {
      if (!isSilent) setSyncing(true);
      const { data, error } = await supabase.rpc('get_subscriber_portal_data', {
        p_profile_id: profile.id,
      });

      if (error) {
        console.error('Failed to load subscriber portal data:', error);
        return;
      }

      if (data?.success) {
        setGroups(data.groups || []);
        setTransactions(data.transactions || []);
        setAuctions(data.auctions || []);
        if (data.profile?.rescheduleAcknowledgments) {
          setRescheduleAcknowledgments(data.profile.rescheduleAcknowledgments);
        }
      }
    } catch (err) {
      console.error('Error in subscriber data fetching:', err);
    } finally {
      setLoading(false);
      if (!isSilent) setSyncing(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadSubscriberData();
  }, [loadSubscriberData]);

  // Comprehensive Realtime subscriptions across all data mutation events
  useEffect(() => {
    if (!profile?.id) return;

    // Multi-table real-time listener for instant synchronization
    const channel = supabase
      .channel(`subscriber_portal_realtime_${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          loadSubscriberData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chit_groups' },
        (payload: any) => {
          if (payload.new && payload.new.id) {
            setGroups((prev) =>
              prev.map((grp) => {
                if (grp.groupId === payload.new.id) {
                  return {
                    ...grp,
                    groupName: payload.new.name || grp.groupName,
                    totalValue: Number(payload.new.total_value) || grp.totalValue,
                    currentMonth: payload.new.current_month !== undefined ? Number(payload.new.current_month) : grp.currentMonth,
                    kaiIruppuPool: Number(payload.new.kai_iruppu_pool) || grp.kaiIruppuPool,
                    isLiveAuctionActive: !!payload.new.is_live_auction_active,
                    liveAuctionStartedAt: payload.new.live_auction_started_at,
                    liveBidStream: payload.new.live_bid_stream !== undefined ? payload.new.live_bid_stream : grp.liveBidStream,
                    lastRescheduledAt: payload.new.last_rescheduled_at,
                    rescheduleReason: payload.new.reschedule_reason,
                    nextAuctionDate: payload.new.next_auction_date,
                    nextAuctionTime: payload.new.next_auction_time,
                    status: payload.new.status || grp.status,
                  };
                }
                return grp;
              })
            );
          }
          loadSubscriberData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        () => {
          loadSubscriberData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_logs' },
        () => {
          loadSubscriberData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => {
          loadSubscriberData(true);
        }
      )
      .subscribe();

    // Auto-sync on window focus and tab visibility change
    const handleFocusSync = () => {
      loadSubscriberData(true);
    };

    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleFocusSync);

    // 10s silent background sync fallback
    const pollInterval = setInterval(() => {
      loadSubscriberData(true);
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleFocusSync);
      clearInterval(pollInterval);
    };
  }, [profile?.id, loadSubscriberData]);

  // Compute active live group for popup
  const activeLiveGroup: LiveGroupDetails | null = useMemo(() => {
    const live = groups.find(
      (g) => g.isLiveAuctionActive && !dismissedLiveAuctionGroupIds.includes(g.groupId)
    );
    if (!live) return null;
    return {
      groupId: live.groupId,
      groupName: live.groupName,
      currentMonth: live.currentMonth,
      totalValue: live.totalValue,
      startedAt: live.liveAuctionStartedAt,
    };
  }, [groups, dismissedLiveAuctionGroupIds]);

  // Compute active reschedule notices to show in modal
  const activeRescheduleNotices: RescheduledGroupNotice[] = useMemo(() => {
    if (isAlertModalDismissed) return [];
    
    return groups
      .filter((grp) => {
        if (!grp.lastRescheduledAt) return false;
        if (sessionDismissedReschedules.includes(grp.groupId)) return false;
        
        const ack = rescheduleAcknowledgments[grp.groupId];
        if (ack?.acknowledgedAt) {
          const ackTime = new Date(ack.acknowledgedAt).getTime();
          const reschedTime = new Date(grp.lastRescheduledAt).getTime();
          // If acknowledged at or after the last reschedule timestamp, don't show
          if (ackTime >= reschedTime) return false;
        }
        return true;
      })
      .map((grp) => {
        const targetDate = computeNextAuctionDateTime({
          auction_day_of_month: grp.auctionDayOfMonth,
          auction_time: grp.auctionTime,
          next_auction_date: grp.nextAuctionDate,
          next_auction_time: grp.nextAuctionTime,
          start_date: grp.startDate,
          current_month: grp.currentMonth,
        });

        const newDateStr = targetDate.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const newTimeStr = formatTime12h(grp.nextAuctionTime || grp.auctionTime);

        return {
          groupId: grp.groupId,
          groupName: grp.groupName,
          currentMonth: grp.currentMonth,
          totalValue: grp.totalValue,
          newDateStr,
          newTimeStr,
          reason: grp.rescheduleReason || 'Schedule updated by Admin',
          lastRescheduledAt: grp.lastRescheduledAt || '',
        };
      });
  }, [groups, sessionDismissedReschedules, rescheduleAcknowledgments, isAlertModalDismissed]);

  const handleAcknowledgeReschedule = async (groupId: string, lastRescheduledAt: string) => {
    if (!profile?.id) return;
    try {
      const updatedAcks = {
        ...rescheduleAcknowledgments,
        [groupId]: {
          acknowledgedAt: new Date().toISOString(),
          lastRescheduledAt: lastRescheduledAt,
        },
      };

      const { error } = await supabase
        .from('profiles')
        .update({ reschedule_acknowledgments: updatedAcks })
        .eq('id', profile.id);

      if (error) {
        console.error('Failed to persist reschedule acknowledgment:', error);
      } else {
        setRescheduleAcknowledgments(updatedAcks);
      }
    } catch (err) {
      console.error('Error saving reschedule acknowledgment:', err);
    }
  };

  // Portfolio Totals
  const totalPaid = transactions
    .filter(t => t.type === 'collection' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const wonGroupsCount = groups.filter(g => g.hasWonRegular).length;

  const isDark = theme === 'dark';

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium tracking-tight opacity-70">Loading Member Passbook...</span>
        </div>
      </div>
    );
  }

  // Global Overdue Groups calculation
  const overdueGroups = groups
    .map((grp) => ({
      group: grp,
      paymentInfo: getGroupPaymentStatus(grp, transactions, auctions),
    }))
    .filter(
      (item) => !item.paymentInfo.isSettled && item.paymentInfo.isPastDueDate
    );

  const totalOverdueAmount = overdueGroups.reduce(
    (sum, item) => sum + item.paymentInfo.outstandingBalance,
    0
  );

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
      isDark ? 'bg-[#030712] text-slate-100' : 'bg-[#f4f6fb] text-slate-900'
    }`}>
      
      {/* 1. TOP APP BAR */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md transition-all ${
        isDark ? 'bg-slate-950/80 border-slate-800/80' : 'bg-white/80 border-slate-200/80'
      }`}>
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 h-14 flex items-center justify-between gap-2">
          
          {/* User Identity / Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-md shrink-0">
              {profile?.fullName?.charAt(0)?.toUpperCase() || 'M'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {profile?.fullName || 'Subscriber'}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase shrink-0">
                  Member
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {profile?.phoneNumber || profile?.email || 'Active Member'}
              </p>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* LIVE SYNC BUTTON */}
            <button
              onClick={() => loadSubscriberData(false)}
              title="Sync Latest Data with Ledger"
              aria-label="Refresh and sync data"
              disabled={syncing}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 shadow-2xs'
              }`}
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin text-indigo-400' : ''} />
              <span className="hidden sm:inline text-[11px] font-semibold">
                {syncing ? 'Syncing...' : 'Sync'}
              </span>
            </button>

            <FontSizeSwitcher />
            
            {/* LIGHT / DARK MODE TOGGLE */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Dark/Light Theme"
              className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                isDark 
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/20' 
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 shadow-2xs'
              }`}
            >
              {isDark ? (
                <Sun size={13} className="text-amber-400" />
              ) : (
                <Moon size={13} className="text-amber-700" />
              )}
              <span className="hidden sm:inline text-[11px] font-semibold">
                {isDark ? 'Light' : 'Dark'}
              </span>
            </button>

            {/* LOGOUT */}
            <button
              onClick={signOut}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all text-xs flex items-center gap-1 active:scale-95 font-semibold"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline text-[11px]">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-5xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 flex-1">
        
        {/* PROMINENT ORANGE OVERDUE REMINDER BANNER */}
        {overdueGroups.length > 0 && (
          <div className={`rounded-2xl p-3.5 sm:p-4 border shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
            isDark
              ? 'bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-amber-950/40 border-amber-500/40 text-amber-100'
              : 'bg-amber-100/80 border-amber-300 text-amber-950 shadow-xs'
          }`}>
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <AlertTriangle size={18} className="stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className={`text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5 ${
                  isDark ? 'text-amber-200' : 'text-amber-950'
                }`}>
                  <span>⚠️ Payment Past Due Date</span>
                  <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded font-bold border ${
                    isDark
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-amber-200 text-amber-900 border-amber-300'
                  }`}>
                    {overdueGroups.length} {overdueGroups.length === 1 ? 'Chit' : 'Chits'} Overdue
                  </span>
                </h3>
                <div className={`text-xs sm:text-sm font-mono font-black ${
                  isDark ? 'text-rose-400' : 'text-rose-700'
                }`}>
                  Total Overdue: ₹{totalOverdueAmount.toLocaleString('en-IN')}
                </div>
              </div>
              <p className={`text-[11px] mt-1 leading-relaxed font-medium ${
                isDark ? 'text-amber-200/90' : 'text-amber-900'
              }`}>
                The scheduled auction due date for{' '}
                <strong className={`font-bold ${isDark ? 'text-white underline decoration-amber-400/40' : 'text-amber-950 underline decoration-amber-900/30'}`}>
                  {overdueGroups
                    .map((g) => `${g.group.groupName} (${g.paymentInfo.daysOverdue} days past due)`)
                    .join(', ')}
                </strong>{' '}
                has passed. Please settle your installment at the counter or via online transfer.
              </p>
            </div>
          </div>
        )}

        {/* DESKTOP TABS (4 Streamlined Tabs at top) */}
        <div className={`hidden md:flex items-center gap-2 border-b pb-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers size={13} /> Overview
          </button>
          <button
            onClick={() => setActiveTab('chits')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'chits'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Ticket size={13} /> My Chits ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('passbook')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'passbook'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History size={13} /> Passbook Ledger ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('auctions')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'auctions'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Trophy size={13} /> Auctions ({auctions.length})
          </button>
        </div>

        {/* TAB CONTENTS */}

        {/* TAB 1: OVERVIEW & ACTIVE CHITS (Hero Welcome only here) */}
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-5">
            {/* HERO WELCOME & PORTFOLIO SNAPSHOT */}
            <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-4 sm:p-6 transition-all ${
              isDark 
                ? 'bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 border-indigo-500/20 text-white shadow-xl' 
                : 'bg-white border-slate-200 text-slate-900 shadow-xs'
            }`}>
              {isDark && (
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
              )}
              
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-indigo-400 font-mono text-[11px] uppercase tracking-wider font-bold">
                  <ShieldCheck size={14} /> Official Chit Passbook
                </div>
              </div>

              {/* GREETING TITLE */}
              <div className="relative z-10 mb-5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  வணக்கம், {profile?.fullName || 'Subscriber'}!
                </h1>
              </div>

              {/* 4-METRIC GRID */}
              <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5 mt-3.5 sm:mt-4">
                
                {/* Stat 1: Total Contributed */}
                <div className={`rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between ${
                  isDark 
                    ? 'bg-[#070b14]/80 backdrop-blur-sm border border-slate-800/90' 
                    : 'bg-slate-50 border border-slate-200 shadow-2xs'
                }`}>
                  <div className={`flex items-center justify-between mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className="text-[10px] font-semibold truncate">Total Paid</span>
                    <div className={`p-1 rounded-md shrink-0 ${
                      isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      <Wallet size={13} />
                    </div>
                  </div>
                  <div className="text-base sm:text-xl font-black font-mono tracking-tight text-emerald-500 whitespace-nowrap">
                    ₹{totalPaid.toLocaleString('en-IN')}
                  </div>
                  <p className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Across collections</p>
                </div>

                {/* Stat 2: Enrolled Tickets */}
                <div className={`rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between ${
                  isDark 
                    ? 'bg-[#070b14]/80 backdrop-blur-sm border border-slate-800/90' 
                    : 'bg-slate-50 border border-slate-200 shadow-2xs'
                }`}>
                  <div className={`flex items-center justify-between mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className="text-[10px] font-semibold truncate">Enrolled Chits</span>
                    <div className={`p-1 rounded-md shrink-0 ${
                      isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    }`}>
                      <Ticket size={13} />
                    </div>
                  </div>
                  <div className={`text-base sm:text-xl font-black font-mono tracking-tight flex items-baseline gap-1 whitespace-nowrap ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    <span>{groups.length}</span>
                    <span className="text-[10px] font-normal text-slate-400">Tickets</span>
                  </div>
                  <p className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {groups.map(g => `#${g.ticketNumber}`).join(', ') || 'No tickets'}
                  </p>
                </div>

                {/* Stat 3: Auction Status */}
                <div className={`rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between ${
                  isDark 
                    ? 'bg-[#070b14]/80 backdrop-blur-sm border border-slate-800/90' 
                    : 'bg-slate-50 border border-slate-200 shadow-2xs'
                }`}>
                  <div className={`flex items-center justify-between mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className="text-[10px] font-semibold truncate">Auction Status</span>
                    <div className={`p-1 rounded-md shrink-0 ${
                      isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      <Trophy size={13} />
                    </div>
                  </div>
                  <div className="text-base sm:text-xl font-black font-mono tracking-tight whitespace-nowrap">
                    {wonGroupsCount > 0 ? (
                      <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>{wonGroupsCount} Won</span>
                    ) : (
                      <span className={isDark ? 'text-indigo-400' : 'text-indigo-600'}>Eligible</span>
                    )}
                  </div>
                  <p className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {wonGroupsCount > 0 ? 'Prize Pot disbursed' : 'Eligible for bidding'}
                  </p>
                </div>

                {/* Stat 4: Sync Status */}
                <div className={`rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between ${
                  isDark 
                    ? 'bg-[#070b14]/80 backdrop-blur-sm border border-slate-800/90' 
                    : 'bg-slate-50 border border-slate-200 shadow-2xs'
                }`}>
                  <div className={`flex items-center justify-between mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className="text-[10px] font-semibold truncate">Passbook Sync</span>
                    <div className={`p-1 rounded-md shrink-0 ${
                      isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-600 border border-violet-100'
                    }`}>
                      <FileText size={13} />
                    </div>
                  </div>
                  <div className={`text-base sm:text-xl font-black font-mono tracking-tight flex items-center gap-1 whitespace-nowrap ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    <span>Synced</span>
                  </div>
                  <p className={`text-[9px] mt-0.5 truncate ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Counter & Digital</p>
                </div>

              </div>
            </div>

            {groups.length === 0 ? (
              <div className={`text-center py-10 rounded-2xl border p-6 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                <Ticket className="mx-auto h-10 w-10 text-slate-400 mb-2" />
                <h3 className="text-sm font-bold">No Enrolled Chits Found</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                  You are not currently enrolled in any chit groups. Contact your Chit Fund Manager.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* UPCOMING AUCTION COUNTDOWN STACK */}
                <AuctionCountdownStack groups={groups} theme={theme} />

                <div className="flex items-center justify-between px-0.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Ticket className="text-indigo-400" size={14} /> My Enrolled Groups ({groups.length})
                  </h2>
                </div>

                <div className="space-y-3">
                  {groups.map((grp) => {
                    const laabaProgress = Math.min(100, Math.round((grp.kaiIruppuPool / grp.totalValue) * 100));
                    const isLaabaReady = grp.kaiIruppuPool >= grp.totalValue;
                    const paymentInfo = getGroupPaymentStatus(grp, transactions, auctions);
                    const monthNameLong = getChitMonthName(grp.startDate, paymentInfo.effectiveCurrentMonth, 'long');
                    const monthNameShort = getChitMonthName(grp.startDate, paymentInfo.effectiveCurrentMonth, 'short');
                    const isBreakdownExpanded = expandedBreakdownGroupIds.includes(grp.groupId);

                    return (
                      <div
                        key={grp.groupId}
                        className={`border transition-all rounded-2xl p-3.5 sm:p-5 shadow-sm space-y-3.5 ${
                          isDark ? 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Header: Name + Value */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-bold font-mono border border-indigo-500/20 mb-1">
                              Ticket #{grp.ticketNumber}
                            </div>
                            <h3 className={`text-sm sm:text-base font-black tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {grp.groupName}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {grp.durationMonths} Months • Current: <strong className={`font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>Month {paymentInfo.effectiveCurrentMonth} ({monthNameLong})</strong>
                            </p>
                          </div>

                          <div className="text-right font-mono shrink-0">
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Chit Value</span>
                            <div className="text-sm sm:text-lg font-black text-emerald-500 whitespace-nowrap">
                              ₹{grp.totalValue.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        {/* Payment Status Alert Banner */}
                        <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col xs:flex-row xs:items-center justify-between gap-2 ${
                          paymentInfo.isSettled
                            ? isDark
                              ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : paymentInfo.isPastDueDate
                              ? isDark
                                ? 'bg-rose-950/30 border-rose-500/20 text-rose-300'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                              : isDark
                                ? 'bg-amber-950/30 border-amber-500/20 text-amber-300'
                                : 'bg-amber-50/80 border-amber-200 text-amber-900'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              paymentInfo.isSettled
                                ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                                : paymentInfo.isPastDueDate
                                  ? isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700'
                                  : isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {paymentInfo.isSettled ? (
                                <CheckCircle2 size={15} />
                              ) : paymentInfo.isPastDueDate ? (
                                <AlertTriangle size={15} />
                              ) : (
                                <Clock size={15} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold leading-snug flex items-center gap-1.5 flex-wrap">
                                {paymentInfo.isSettled ? (
                                  <span>All Dues Settled (Up to M{paymentInfo.effectiveCurrentMonth} • {monthNameShort})</span>
                                ) : paymentInfo.isPastDueDate ? (
                                  paymentInfo.pendingMonthsCount > 1 ? (
                                    <>
                                      <span className="font-mono font-black">({paymentInfo.pendingMonthsCount} Cycles Due):</span>
                                      <span className="font-mono font-black text-rose-500 underline decoration-rose-500/30">
                                        ₹{paymentInfo.outstandingBalance.toLocaleString('en-IN')} Total Pending
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-mono font-black">(M{paymentInfo.monthDues.find(m => m.remainingDue > 0)?.month ?? paymentInfo.effectiveCurrentMonth} • {paymentInfo.monthDues.find(m => m.remainingDue > 0)?.monthNameShort ?? monthNameShort}) Past Due Date:</span>
                                      <span className="font-mono font-black text-rose-500 underline decoration-rose-500/30">
                                        ₹{paymentInfo.outstandingBalance.toLocaleString('en-IN')}
                                      </span>
                                    </>
                                  )
                                ) : (
                                  <>
                                    <span className="font-mono font-black">({paymentInfo.pendingMonthsCount > 1 ? `${paymentInfo.pendingMonthsCount} Cycles` : `M${paymentInfo.effectiveCurrentMonth}`} • {monthNameShort}) Due in {paymentInfo.daysRemaining} days:</span>
                                    <span className={`font-mono font-black ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                                      ₹{paymentInfo.outstandingBalance.toLocaleString('en-IN')}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-[10px] opacity-75 mt-0.5">
                                {paymentInfo.isSettled ? (
                                  `Paid ₹${paymentInfo.totalPaidForGroup.toLocaleString('en-IN')} in full • All cycles up to date`
                                ) : paymentInfo.pendingMonthsCount > 1 ? (
                                  `⚠️ Unsettled: ${paymentInfo.monthDues.filter(m => m.remainingDue > 0).map(m => `M${m.month} (₹${m.remainingDue.toLocaleString('en-IN')})`).join(' + ')}`
                                ) : paymentInfo.isPastDueDate ? (
                                  `⚠️ ${paymentInfo.daysOverdue} days past auction due date (${paymentInfo.formattedDueDate})`
                                ) : (
                                  `Due on auction day (${paymentInfo.formattedDueDate}) • Payment window open`
                                )}
                              </p>
                            </div>
                          </div>

                          <span className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-md self-start xs:self-center shrink-0 ${
                            paymentInfo.isSettled
                              ? isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-200/80 text-emerald-900'
                              : paymentInfo.isPastDueDate
                                ? isDark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-200/80 text-rose-900'
                                : isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-200/80 text-amber-900'
                          }`}>
                            {paymentInfo.isSettled ? 'Paid' : paymentInfo.isPastDueDate ? 'Overdue' : 'Upcoming'}
                          </span>
                        </div>

                        {/* 3-Column Key Metrics */}
                        <div className={`grid grid-cols-3 gap-1.5 sm:gap-2 p-2.5 rounded-xl border ${
                          isDark ? 'bg-[#080d17] border-slate-800/80' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold block">Monthly Due</span>
                            <div className={`text-xs sm:text-sm font-bold font-mono mt-0.5 whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              ₹{grp.monthlyInstallment.toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold block">Total Paid</span>
                            <div className="text-xs sm:text-sm font-bold font-mono mt-0.5 text-emerald-500 whitespace-nowrap">
                              ₹{paymentInfo.totalPaidForGroup.toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold block">Auction Status</span>
                            <div className="text-xs sm:text-sm font-bold mt-0.5">
                              {grp.hasWonRegular ? (
                                <span className="text-amber-500 flex items-center gap-1 font-mono text-xs">
                                  <Trophy size={12} /> Won
                                </span>
                              ) : (
                                <span className="text-emerald-500 flex items-center gap-1 font-mono text-xs">
                                  <CheckCircle2 size={12} /> Eligible
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expandable Month-by-Month Dues Breakdown Matrix */}
                        <div className={`rounded-xl border overflow-hidden transition-all ${
                          isDark ? 'bg-[#060a13] border-slate-800' : 'bg-slate-50/80 border-slate-200'
                        }`}>
                          <button
                            type="button"
                            onClick={() => toggleBreakdown(grp.groupId)}
                            className={`w-full p-2.5 sm:p-3 flex items-center justify-between text-left transition-colors cursor-pointer ${
                              isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-100/80'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                <Layers size={13} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold block truncate">
                                  Month-by-Month Dues Breakdown
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {paymentInfo.monthDues.length} active {paymentInfo.monthDues.length === 1 ? 'cycle' : 'cycles'} (M0 to M{paymentInfo.effectiveCurrentMonth})
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right font-mono">
                                <span className="text-[9px] text-slate-400 uppercase block">Pending</span>
                                <span className={`text-xs font-black ${
                                  paymentInfo.isSettled ? 'text-emerald-500' : 'text-rose-500'
                                }`}>
                                  {paymentInfo.isSettled ? '₹0' : `₹${paymentInfo.outstandingBalance.toLocaleString('en-IN')}`}
                                </span>
                              </div>
                              <div className={`p-1 rounded-md ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {isBreakdownExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>
                          </button>

                          {/* Expanded Month Matrix */}
                          {isBreakdownExpanded && (
                            <div className={`p-2.5 sm:p-3 pt-0 border-t space-y-2 animate-in fade-in duration-200 ${
                              isDark ? 'border-slate-800/80 bg-slate-950/40' : 'border-slate-200/80 bg-white/60'
                            }`}>
                              <div className="space-y-1.5 pt-2">
                                {paymentInfo.monthDues.map((dueItem) => {
                                  return (
                                    <div
                                      key={`due-${grp.groupId}-m${dueItem.month}`}
                                      className={`p-2 sm:p-2.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                        dueItem.status === 'paid'
                                          ? isDark ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-200'
                                          : dueItem.status === 'partial'
                                            ? isDark ? 'bg-amber-950/20 border-amber-500/20' : 'bg-amber-50/60 border-amber-200'
                                            : dueItem.status === 'free_laaba'
                                              ? isDark ? 'bg-violet-950/20 border-violet-500/20' : 'bg-violet-50/60 border-violet-200'
                                              : isDark ? 'bg-rose-950/20 border-rose-500/20' : 'bg-rose-50/60 border-rose-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black shrink-0 ${
                                          dueItem.month === 0
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : dueItem.isCurrentCycle
                                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                              : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                                        }`}>
                                          M{dueItem.month}
                                        </span>
                                        <div className="min-w-0">
                                          <div className="font-bold flex items-center gap-1.5 flex-wrap text-[11px] sm:text-xs">
                                            <span>{dueItem.monthNameLong}</span>
                                            {dueItem.month === 0 && (
                                              <span className="text-[9px] font-normal opacity-70">👑 Launch Month</span>
                                            )}
                                            {dueItem.isCurrentCycle && (
                                              <span className="text-[9px] font-normal text-indigo-400">⚡ Current Cycle</span>
                                            )}
                                          </div>
                                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            Due Date: {dueItem.formattedDueDate}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Right: Amounts and Status Pill */}
                                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 font-mono">
                                        <div className="text-right">
                                          <div className="text-[11px] sm:text-xs">
                                            <span className="opacity-70">Paid: </span>
                                            <span className="font-bold text-emerald-500">₹{dueItem.paidAmount.toLocaleString('en-IN')}</span>
                                            <span className="opacity-50"> / ₹{dueItem.expectedDue.toLocaleString('en-IN')}</span>
                                          </div>
                                          {dueItem.remainingDue > 0 && (
                                            <div className="text-[10px] font-bold text-rose-500">
                                              Pending Due: ₹{dueItem.remainingDue.toLocaleString('en-IN')}
                                            </div>
                                          )}
                                        </div>

                                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0 ${
                                          dueItem.status === 'paid'
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : dueItem.status === 'partial'
                                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                              : dueItem.status === 'free_laaba'
                                                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        }`}>
                                          {dueItem.status === 'paid'
                                            ? 'Paid'
                                            : dueItem.status === 'partial'
                                              ? 'Partial'
                                              : dueItem.status === 'free_laaba'
                                                ? 'Free'
                                                : 'Unpaid'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Laaba Seetu Progress Box */}
                        <div className={`border rounded-xl p-2.5 sm:p-3 ${
                          isDark 
                            ? 'bg-gradient-to-r from-violet-950/40 to-indigo-950/40 border-violet-500/20' 
                            : 'bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200'
                        }`}>
                          <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1.5">
                            <span className="font-bold text-violet-500 flex items-center gap-1 truncate">
                              <Sparkles size={12} className="shrink-0" />
                              <span>லாப சீட்டு (Laaba Seetu)</span>
                            </span>
                            <span className={`font-mono font-bold whitespace-nowrap text-[10px] sm:text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>
                              ₹{grp.kaiIruppuPool.toLocaleString('en-IN')} / ₹{grp.totalValue.toLocaleString('en-IN')}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className={`w-full rounded-full h-2 overflow-hidden border ${
                            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-300'
                          }`}>
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isLaabaReady
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : 'bg-gradient-to-r from-violet-500 to-indigo-500'
                              }`}
                              style={{ width: `${Math.max(4, laabaProgress)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1.5">
                            <span>{isLaabaReady ? '🎉 Target reached! Next month is FREE' : `${laabaProgress}% towards ₹0 Free Month`}</span>
                            <span className="font-mono text-violet-500 font-bold">{laabaProgress}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RECENT PASSBOOK TRANSACTIONS */}
            <div className={`border rounded-2xl p-3.5 sm:p-5 shadow-sm space-y-3 ${
              isDark ? 'bg-slate-900/90 border-slate-800/90' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="text-indigo-400" size={13} /> Recent Collections ({transactions.length})
                </h3>
                <button
                  onClick={() => setActiveTab('passbook')}
                  className="text-[11px] text-indigo-400 hover:text-indigo-500 font-bold flex items-center gap-0.5"
                >
                  View All <ChevronRight size={13} />
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-[11px]">
                  No verified collection receipts yet.
                </div>
              ) : (
                <div className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-100'}`}>
                  {transactions.slice(0, 4).map((tx) => (
                    <div 
                      key={tx.id} 
                      onClick={() => setSelectedTx(tx)}
                      className={`py-2.5 flex items-center justify-between gap-2.5 cursor-pointer rounded-lg px-1 transition-all active:scale-[0.99] ${
                        isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <ArrowDownLeft size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{tx.groupName}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.2">
                            <span>
                              {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                            <span>•</span>
                            <span className={`uppercase text-[9px] px-1 py-0.2 rounded font-mono ${
                              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {!tx.walletType || tx.walletType.toLowerCase().includes('cash') ? 'CASH IN HAND' : 'ONLINE TRANSFER'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <div className="text-xs font-black text-emerald-500">
                          +₹{Number(tx.amount).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[9px] uppercase font-bold text-slate-400">
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ENROLLED CHITS FULL VIEW */}
        {activeTab === 'chits' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-0.5">
              <Ticket className="text-indigo-400" size={14} /> All Enrolled Chit Tickets ({groups.length})
            </h2>

            <div className="space-y-3">
              {groups.map((grp) => {
                const paymentInfo = getGroupPaymentStatus(grp, transactions, auctions);
                const monthNameLong = getChitMonthName(grp.startDate, grp.currentMonth, 'long');
                const monthNameShort = getChitMonthName(grp.startDate, grp.currentMonth, 'short');

                return (
                  <div
                    key={grp.groupId}
                    className={`border rounded-2xl p-3.5 sm:p-5 shadow-sm space-y-3 ${
                      isDark ? 'bg-slate-900/90 border-slate-800/90' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-bold font-mono border border-indigo-500/20 mb-1">
                          Ticket #{grp.ticketNumber}
                        </span>
                        <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{grp.groupName}</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {grp.durationMonths} Months Duration • {grp.memberCount} Members • Month {grp.currentMonth} ({monthNameLong}) of {grp.durationMonths}
                        </p>
                      </div>

                      <div className={`text-right font-mono shrink-0 p-2 rounded-xl border ${
                        isDark ? 'bg-[#080d17] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Value</span>
                        <div className="text-sm font-black text-emerald-500 whitespace-nowrap">
                          ₹{grp.totalValue.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Payment Status Alert Banner */}
                    <div className={`p-2.5 rounded-xl border flex flex-col xs:flex-row xs:items-center justify-between gap-2 ${
                      paymentInfo.isSettled
                        ? isDark
                          ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : paymentInfo.isPastDueDate
                          ? isDark
                            ? 'bg-rose-950/30 border-rose-500/20 text-rose-300'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                          : isDark
                            ? 'bg-amber-950/30 border-amber-500/20 text-amber-300'
                            : 'bg-amber-50/80 border-amber-200 text-amber-900'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          paymentInfo.isSettled
                            ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                            : paymentInfo.isPastDueDate
                              ? isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700'
                              : isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {paymentInfo.isSettled ? (
                            <CheckCircle2 size={15} />
                          ) : paymentInfo.isPastDueDate ? (
                            <AlertTriangle size={15} />
                          ) : (
                            <Clock size={15} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold leading-snug flex items-center gap-1.5 flex-wrap">
                            {paymentInfo.isSettled ? (
                              <span>All Dues Settled (Up to M{grp.currentMonth} • {monthNameShort})</span>
                            ) : paymentInfo.isPastDueDate ? (
                              paymentInfo.pendingMonthsCount > 1 ? (
                                <>
                                  <span className="font-mono font-black">({paymentInfo.pendingMonthsCount} Mos • {monthNameShort}) Overdue:</span>
                                  <span className="font-mono font-black text-rose-500 underline decoration-rose-500/30">
                                    ₹{paymentInfo.outstandingBalance.toLocaleString('en-IN')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="font-mono font-black">(M{grp.currentMonth} • {monthNameShort}) Past Due Date:</span>
                                  <span className="font-mono font-black text-rose-500 underline decoration-rose-500/30">
                                    ₹{paymentInfo.outstandingBalance.toLocaleString('en-IN')}
                                  </span>
                                </>
                              )
                            ) : (
                              <>
                                <span className="font-mono font-black">(M{grp.currentMonth} • {monthNameShort}) Due in {paymentInfo.daysRemaining} days:</span>
                                <span className={`font-mono font-black ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                                  ₹{paymentInfo.outstandingBalance.toLocaleString('en-IN')}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-[10px] opacity-75 mt-0.5">
                            {paymentInfo.isSettled ? (
                              `Paid ₹${paymentInfo.totalPaidForGroup.toLocaleString('en-IN')} in full • Up to date`
                            ) : paymentInfo.isPastDueDate ? (
                              `⚠️ ${paymentInfo.daysOverdue} days past auction due date (${paymentInfo.formattedDueDate})`
                            ) : (
                              `Due on auction day (${paymentInfo.formattedDueDate}) • Payment window open`
                            )}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-md self-start xs:self-center shrink-0 ${
                        paymentInfo.isSettled
                          ? isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-200/80 text-emerald-900'
                          : paymentInfo.isPastDueDate
                            ? isDark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-200/80 text-rose-900'
                            : isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-200/80 text-amber-900'
                      }`}>
                        {paymentInfo.isSettled ? 'Paid' : paymentInfo.isPastDueDate ? 'Overdue' : 'Upcoming'}
                      </span>
                    </div>

                    {/* 3-Column Key Metrics */}
                    <div className={`grid grid-cols-3 gap-1.5 sm:gap-2 p-2.5 rounded-xl border ${
                      isDark ? 'bg-[#080d17] border-slate-800/80' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold block">Monthly Due</span>
                        <div className={`text-xs sm:text-sm font-bold font-mono mt-0.5 whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          ₹{grp.monthlyInstallment.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold block">Total Paid</span>
                        <div className="text-xs sm:text-sm font-bold font-mono mt-0.5 text-emerald-500 whitespace-nowrap">
                          ₹{paymentInfo.totalPaidForGroup.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-semibold block">Auction Status</span>
                        <div className="text-xs sm:text-sm font-bold mt-0.5">
                          {grp.hasWonRegular ? (
                            <span className="text-amber-500 flex items-center gap-1 font-mono text-xs">
                              <Trophy size={12} /> Won
                            </span>
                          ) : (
                            <span className="text-emerald-500 flex items-center gap-1 font-mono text-xs">
                              <CheckCircle2 size={12} /> Eligible
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: PASSBOOK LEDGER */}
        {activeTab === 'passbook' && (
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-0.5">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="text-indigo-400" size={14} /> Official Member Passbook
                </h2>
              </div>
              <div className="text-left sm:text-right font-mono shrink-0">
                <span className="text-[10px] text-slate-400 uppercase">Verified Sum: </span>
                <span className="text-xs sm:text-sm font-black text-emerald-500">
                  ₹{transactions
                    .filter((tx) => selectedPassbookGroup === 'all' || tx.groupId === selectedPassbookGroup || tx.groupName === selectedPassbookGroup)
                    .reduce((acc, tx) => acc + Number(tx.amount || 0), 0)
                    .toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* CHIT GROUP FILTER (When enrolled in groups) */}
            {groups.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedPassbookGroup('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                    selectedPassbookGroup === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : isDark
                        ? 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>All Groups</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedPassbookGroup === 'all'
                      ? 'bg-white/20 text-white'
                      : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {transactions.length}
                  </span>
                </button>

                {groups.map((grp) => {
                  const grpTxCount = transactions.filter(t => t.groupId === grp.groupId || t.groupName === grp.groupName).length;
                  const isSelected = selectedPassbookGroup === grp.groupId || selectedPassbookGroup === grp.groupName;
                  return (
                    <button
                      key={`filter-${grp.groupId}`}
                      onClick={() => setSelectedPassbookGroup(grp.groupId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : isDark
                            ? 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                            : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate max-w-[160px]">{grp.groupName}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {grpTxCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {transactions.filter((tx) => selectedPassbookGroup === 'all' || tx.groupId === selectedPassbookGroup || tx.groupName === selectedPassbookGroup).length === 0 ? (
              <div className={`text-center py-10 rounded-2xl border p-6 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <FileText className="mx-auto h-10 w-10 text-slate-400 mb-2" />
                <h3 className="text-sm font-bold">No Passbook Entries Recorded</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                  {selectedPassbookGroup === 'all' 
                    ? 'Once your installments are recorded by the counter manager, entries will appear here.'
                    : 'No collections recorded yet for this chit group.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions
                  .filter((tx) => selectedPassbookGroup === 'all' || tx.groupId === selectedPassbookGroup || tx.groupName === selectedPassbookGroup)
                  .map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className={`border transition-all rounded-xl p-3 shadow-2xs flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] ${
                        isDark ? 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{tx.groupName}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>
                              {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span>•</span>
                            <span className={`uppercase text-[9px] px-1.5 py-0.2 rounded font-mono ${
                              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {!tx.walletType || tx.walletType.toLowerCase().includes('cash') ? 'CASH IN HAND' : 'ONLINE TRANSFER'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <div className="text-sm font-black text-emerald-500">
                          +₹{Number(tx.amount).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[9px] uppercase font-bold text-slate-400">
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AUCTIONS & BIDDING STUDIO */}
        {activeTab === 'auctions' && (
          <div className="space-y-4">
            {/* 4.1. CHECK IF CURRENTLY INSIDE A DEDICATED LIVE AUCTION ARENA */}
            {activeLiveArenaGroupId && groups.find((g) => g.groupId === activeLiveArenaGroupId) ? (
              <SubscriberLiveAuctionArena
                group={groups.find((g) => g.groupId === activeLiveArenaGroupId)!}
                currentUserId={profile?.id}
                isDark={isDark}
                onExit={() => setActiveLiveArenaGroupId(null)}
              />
            ) : (
              <>
                {/* 4.2. LIVE AUCTION ACTIVE HERO CALLOUT BANNERS (IF ANY) */}
                {groups.filter((g) => g.isLiveAuctionActive).length > 0 && (
                  <div className="space-y-3">
                    {groups
                      .filter((g) => g.isLiveAuctionActive)
                      .map((grp) => (
                        <div
                          key={grp.groupId}
                          className={`p-4 sm:p-5 rounded-3xl border shadow-xl relative overflow-hidden transition-all ${
                            isDark
                              ? 'bg-gradient-to-r from-rose-950/70 via-slate-900 to-indigo-950/70 border-rose-500/40 text-white'
                              : 'bg-gradient-to-r from-rose-50 via-white to-indigo-50 border-rose-300 text-slate-900'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-black uppercase tracking-wider">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                                  </span>
                                  <span>Live Auction Active</span>
                                </span>
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                                  Month {grp.currentMonth}
                                </span>
                              </div>
                              <h3 className="text-base sm:text-lg font-black truncate">{grp.groupName}</h3>
                              <p className="text-xs text-slate-400">
                                Total Chit Value: <strong className="text-emerald-500 font-mono">₹{grp.totalValue.toLocaleString('en-IN')}</strong> · Real-time Bidding Floor Open
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => setActiveLiveArenaGroupId(grp.groupId)}
                              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 via-indigo-600 to-indigo-700 hover:from-rose-500 hover:to-indigo-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/30 active:scale-95 transition-all cursor-pointer shrink-0"
                            >
                              <Radio size={16} className="animate-pulse" />
                              <span>Enter Live Bidding Floor</span>
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* UPCOMING AUCTION COUNTDOWN STACK */}
                <AuctionCountdownStack groups={groups} theme={theme} />

                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-0.5">
                  <Trophy className="text-indigo-400" size={14} /> Group Auction History ({auctions.length})
                </h2>

                {auctions.length === 0 ? (
                  <div className={`text-center py-10 rounded-2xl border p-6 ${
                    isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <Trophy className="mx-auto h-10 w-10 text-slate-400 mb-2" />
                    <h3 className="text-sm font-bold">No Auction Rounds Conducted Yet</h3>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                      Starting Month 1, live bidding discounts and winner announcements will be published here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auctions.map((auc) => (
                      <div
                        key={auc.id}
                        className={`rounded-2xl p-3.5 sm:p-5 border transition-all shadow-sm space-y-2.5 ${
                          auc.isCurrentSubscriberWinner
                            ? isDark 
                              ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/40' 
                              : 'bg-gradient-to-br from-amber-50 via-white to-white border-amber-300'
                            : isDark ? 'bg-slate-900/90 border-slate-800/90' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-bold font-mono border border-indigo-500/20 mb-1">
                              Month {auc.month} Auction
                            </span>
                            <h3 className={`text-xs sm:text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{auc.groupName}</h3>
                            <p className="text-[10px] text-slate-400">
                              {new Date(auc.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>

                          {auc.isLaabaSeetu && (
                            <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-500 text-[10px] font-bold border border-violet-500/30 shrink-0">
                              🎉 Laaba Seetu
                            </span>
                          )}
                        </div>

                        {/* Breakdown */}
                        <div className={`rounded-xl p-2.5 border space-y-1.5 text-xs ${
                          isDark ? 'bg-[#080d17] border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Winner</span>
                            <span className={`text-[11px] font-bold flex items-center gap-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              <Trophy size={12} className="text-amber-500" />
                              {auc.winnerName} {auc.isCurrentSubscriberWinner && '(You!)'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">Winning Discount</span>
                            <span className="text-[11px] font-mono font-bold text-rose-500">
                              -₹{Number(auc.winningDiscount).toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className={`pt-1.5 border-t flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                            <span className="text-[11px] font-semibold text-indigo-500">Winner Net Payout</span>
                            <span className="text-xs sm:text-sm font-mono font-black text-emerald-500">
                              ₹{Number(auc.netPayout).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </main>

      {/* 4.5. AUCTION RESCHEDULE ALERT POPUP MODAL */}
      <AuctionRescheduleAlertModal
        isOpen={activeRescheduleNotices.length > 0}
        notices={activeRescheduleNotices}
        isDark={isDark}
        onRemindLater={() => {
          setIsAlertModalDismissed(true);
        }}
        onAcknowledge={handleAcknowledgeReschedule}
      />

      {/* 4.6. LIVE AUCTION STARTED REAL-TIME POPUP MODAL */}
      <LiveAuctionStartedModal
        isOpen={Boolean(activeLiveGroup)}
        liveGroup={activeLiveGroup}
        onDismiss={() => {
          if (activeLiveGroup) {
            setDismissedLiveAuctionGroupIds((prev) => [...prev, activeLiveGroup.groupId]);
          }
        }}
        onViewLiveAuction={(groupId) => {
          setActiveTab('auctions');
          if (groupId) {
            setActiveLiveArenaGroupId(groupId);
            setDismissedLiveAuctionGroupIds((prev) => [...prev, groupId]);
          }
        }}
      />

      {/* 5. TRANSACTION DETAIL POPUP MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className={`w-full max-w-sm border rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto my-auto ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <FileText size={15} className="text-indigo-500" /> Receipt Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="text-xs opacity-60 hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="opacity-60">Chit Group:</span>
                <span className="font-bold">{selectedTx.groupName}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="opacity-60">Paid Amount:</span>
                <span className="font-black text-emerald-500 text-sm">₹{Number(selectedTx.amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Payment Mode:</span>
                <span className="uppercase font-mono font-semibold">
                  {!selectedTx.walletType || selectedTx.walletType.toLowerCase().includes('cash') ? 'Cash in Hand' : 'Online Transfer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Date:</span>
                <span className="font-mono">{new Date(selectedTx.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Status:</span>
                <span className="text-emerald-500 font-bold uppercase">{selectedTx.status}</span>
              </div>
              {selectedTx.notes && (
                <div className={`pt-2 border-t text-[11px] ${isDark ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-600'}`}>
                  <span className="opacity-60 block mb-0.5">Notes:</span>
                  {selectedTx.notes}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedTx(null)}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 6. FIXED MOBILE BOTTOM NAVIGATION BAR (4 Streamlined Tabs) */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t px-3 py-1.5 flex items-center justify-around transition-colors ${
        isDark ? 'bg-[#0c1220]/95 border-slate-800/90' : 'bg-white/95 border-slate-200 shadow-lg'
      }`}>
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold p-1 rounded-xl transition-all ${
            activeTab === 'overview' ? 'text-indigo-500 scale-105' : 'text-slate-400'
          }`}
        >
          <Layers size={18} />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('chits')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold p-1 rounded-xl transition-all ${
            activeTab === 'chits' ? 'text-indigo-500 scale-105' : 'text-slate-400'
          }`}
        >
          <Ticket size={18} />
          <span>My Chits</span>
        </button>

        <button
          onClick={() => setActiveTab('passbook')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold p-1 rounded-xl transition-all ${
            activeTab === 'passbook' ? 'text-indigo-500 scale-105' : 'text-slate-400'
          }`}
        >
          <History size={18} />
          <span>Passbook</span>
        </button>

        <button
          onClick={() => setActiveTab('auctions')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold p-1 rounded-xl transition-all ${
            activeTab === 'auctions' ? 'text-indigo-500 scale-105' : 'text-slate-400'
          }`}
        >
          <Trophy size={18} />
          <span>Auctions</span>
        </button>
      </nav>
    </div>
  );
}
