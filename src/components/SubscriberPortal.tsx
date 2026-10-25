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
  Gavel,
  Settings,
  KeyRound,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Check,
  Smartphone,
  User,
  Shield,
  QrCode,
  Sliders,
  Copy,
  Crown,
  ArrowRight,
  Gift,
  Bell,
  Receipt,
  BookOpen,
  Flag
} from 'lucide-react';
import AuctionCountdownBanner from '@/components/AuctionCountdownBanner';
import AuctionRescheduleAlertModal, { RescheduledGroupNotice } from '@/components/AuctionRescheduleAlertModal';
import LiveAuctionStartedModal, { LiveGroupDetails } from '@/components/LiveAuctionStartedModal';
import SubscriberLiveAuctionArena, { LiveBidItem, GroupMemberItem } from '@/components/SubscriberLiveAuctionArena';
import { computeNextAuctionDateTime, formatTime12h } from '@/utils/auctionSchedule';

interface EnrolledGroup {
  groupId: string;
  groupMemberId?: string;
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
  customInstallment?: number | null;
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
  groupMemberId?: string | null;
  groupName: string;
  type: string;
  amount: number;
  walletType: string;
  status: string;
  cycleMonth?: number | null;
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

  const groupTransactions = transactions.filter((t) => {
    if (t.groupId !== grp.groupId && t.groupName !== grp.groupName) return false;
    if (t.type !== 'collection' || t.status !== 'completed') return false;

    // If transaction has explicit groupMemberId, match it directly
    if (t.groupMemberId && grp.groupMemberId) {
      return t.groupMemberId === grp.groupMemberId;
    }

    // If transaction notes mention ticket number explicitly
    if (t.notes) {
      if (t.notes.includes(`Ticket #${grp.ticketNumber}`) || t.notes.includes(`Ticket #${grp.ticketNumber} `)) {
        return true;
      }
      const ticketMatch = t.notes.match(/Ticket\s*#(\d+)/i);
      if (ticketMatch && Number(ticketMatch[1]) !== grp.ticketNumber) {
        return false;
      }
    }

    return true;
  });

  const totalPaidForGroup = groupTransactions.reduce(
    (sum, t) => sum + Number(t.amount || 0),
    0
  );

  const monthDues: MonthDueItem[] = [];

  for (let m = 0; m <= effectiveCurrentMonth; m++) {
    const monthAuction = groupAuctions.find((a) => a.month === m);
    const isLaaba = !!monthAuction?.isLaabaSeetu || (m === effectiveCurrentMonth && m > 0 && Number(grp.kaiIruppuPool || 0) >= Number(grp.totalValue || 200000));
    const expectedDue = isLaaba ? 0 : (grp.customInstallment || grp.monthlyInstallment);

    // Check transactions tagged with "Month <m>" or structured cycleMonth
    const monthPattern = new RegExp(`\\bMonth\\s+${m}\\b|\\bM${m}\\b`, 'i');
    const taggedTransactions = groupTransactions.filter((t) => 
      t.cycleMonth !== null && t.cycleMonth !== undefined
        ? Number(t.cycleMonth) === Number(m)
        : (t.notes ? monthPattern.test(t.notes) : false)
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
    let year: number;
    let month: number;
    if (startDateStr.includes('-')) {
      const parts = startDateStr.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
    } else {
      const base = new Date(startDateStr);
      year = base.getFullYear();
      month = base.getMonth();
    }
    // Set day strictly to 1 so end-of-month dates (e.g. 31st) never overflow shorter months like February or April
    const targetDate = new Date(year, month + monthNumber, 1);
    return targetDate.toLocaleString('en-IN', { month: format });
  } catch (e) {
    const d = new Date();
    return d.toLocaleString('en-IN', { month: format });
  }
}

export default function SubscriberPortal() {
  const { profile, signOut, updateMpin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'overview' | 'chits' | 'passbook' | 'auctions' | 'settings'>('overview');
  
  const [groups, setGroups] = useState<EnrolledGroup[]>([]);
  const [transactions, setTransactions] = useState<SubscriberTransaction[]>([]);
  const [auctions, setAuctions] = useState<GroupAuction[]>([]);
  const [selectedTx, setSelectedTx] = useState<SubscriberTransaction | null>(null);
  const [selectedPassbookGroup, setSelectedPassbookGroup] = useState<string>('all');

  const [syncing, setSyncing] = useState(false);

  // Settings Tab PIN Change States
  const [currentPinInput, setCurrentPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmPinInput, setConfirmPinInput] = useState<string>('');
  const [showCurrentPin, setShowCurrentPin] = useState<boolean>(false);
  const [showNewPin, setShowNewPin] = useState<boolean>(false);
  const [showConfirmPin, setShowConfirmPin] = useState<boolean>(false);
  const [isSavingPin, setIsSavingPin] = useState<boolean>(false);
  const [pinSuccessMessage, setPinSuccessMessage] = useState<string | null>(null);
  const [pinErrorMessage, setPinErrorMessage] = useState<string | null>(null);

  // Default PIN Reminder Popup States
  const [showDefaultPinModal, setShowDefaultPinModal] = useState<boolean>(false);
  const [modalCurrentPin, setModalCurrentPin] = useState<string>('');
  const [modalNewPin, setModalNewPin] = useState<string>('');
  const [modalConfirmPin, setModalConfirmPin] = useState<string>('');
  const [modalShowNewPin, setModalShowNewPin] = useState<boolean>(false);
  const [modalShowConfirmPin, setModalShowConfirmPin] = useState<boolean>(false);
  const [modalIsSaving, setModalIsSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Reschedule alert states
  const [rescheduleAcknowledgments, setRescheduleAcknowledgments] = useState<Record<string, { acknowledgedAt: string; lastRescheduledAt?: string }>>({});
  const [sessionDismissedReschedules, setSessionDismissedReschedules] = useState<string[]>([]);
  const [isAlertModalDismissed, setIsAlertModalDismissed] = useState<boolean>(false);

  // Live auction realtime alert states
  const [dismissedLiveAuctionGroupIds, setDismissedLiveAuctionGroupIds] = useState<string[]>([]);
  const [activeLiveArenaGroupId, setActiveLiveArenaGroupId] = useState<string | null>(null);

  // Expandable monthly dues breakdown state per group
  const [expandedBreakdownGroupIds, setExpandedBreakdownGroupIds] = useState<string[]>([]);

  // Screen 1, 2 & 3 states: Apple Wallet card stack, Passbook filter, Schedule filter, Payment modal
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(0);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [passbookFilter, setPassbookFilter] = useState<'all' | 'installments' | 'payouts'>('all');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [showScheduleInfoModal, setShowScheduleInfoModal] = useState<boolean>(false);
  const [showMpinForm, setShowMpinForm] = useState<boolean>(false);

  const toggleBreakdown = (groupId: string) => {
    setExpandedBreakdownGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  // Check if subscriber is using default PIN (1234) and trigger reminder popup
  useEffect(() => {
    if (!profile) return;
    const isDefault = profile.isDefaultPin || profile.mpin === '1234';
    if (!isDefault) return;

    if (typeof window !== 'undefined') {
      const pref = localStorage.getItem('cf_pin_prompt_preference');
      const dismissedThisSession = sessionStorage.getItem('cf_pin_prompt_dismissed_session');
      if (pref !== 'never' && !dismissedThisSession) {
        const timer = setTimeout(() => {
          setShowDefaultPinModal(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [profile?.isDefaultPin, profile?.mpin]);

  const handleUpdatePinFromSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinErrorMessage(null);
    setPinSuccessMessage(null);

    const cleanNew = newPinInput.trim();
    const cleanConfirm = confirmPinInput.trim();
    const cleanCurrent = currentPinInput.trim();

    if (!cleanNew || cleanNew.length < 4 || cleanNew.length > 6 || !/^\d+$/.test(cleanNew)) {
      setPinErrorMessage('New PIN must be between 4 and 6 digits (numbers only).');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setPinErrorMessage('New PIN and Confirm PIN do not match.');
      return;
    }

    if (cleanNew === '1234') {
      setPinErrorMessage('Please choose a secure PIN other than the default 1234.');
      return;
    }

    try {
      setIsSavingPin(true);
      const res = await updateMpin(cleanCurrent || (profile?.mpin || '1234'), cleanNew);
      if (res.success) {
        setPinSuccessMessage('Security PIN updated successfully! You can now use your new PIN to log in.');
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        // Clear any previous "never" preference if they explicitly set a custom PIN
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cf_pin_prompt_preference');
        }
      } else {
        setPinErrorMessage(res.error || 'Failed to update PIN.');
      }
    } catch (err: any) {
      setPinErrorMessage(err.message || 'Error updating PIN.');
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleUpdatePinFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanNew = modalNewPin.trim();
    const cleanConfirm = modalConfirmPin.trim();

    if (!cleanNew || cleanNew.length < 4 || cleanNew.length > 6 || !/^\d+$/.test(cleanNew)) {
      setModalError('New PIN must be 4 to 6 numeric digits.');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setModalError('PIN and Confirmation do not match.');
      return;
    }

    if (cleanNew === '1234') {
      setModalError('Please pick a new PIN other than 1234.');
      return;
    }

    try {
      setModalIsSaving(true);
      const res = await updateMpin('1234', cleanNew);
      if (res.success) {
        setShowDefaultPinModal(false);
        setModalNewPin('');
        setModalConfirmPin('');
        alert('✅ Security PIN successfully updated! Your account is now secured.');
      } else {
        setModalError(res.error || 'Failed to update PIN.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Error updating PIN.');
    } finally {
      setModalIsSaving(false);
    }
  };

  const handleDismissModalLater = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('cf_pin_prompt_dismissed_session', 'true');
    }
    setShowDefaultPinModal(false);
  };

  const handleDismissModalNever = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cf_pin_prompt_preference', 'never');
    }
    setShowDefaultPinModal(false);
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
    const channelName = `subscriber_portal_realtime_${profile.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
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
          // Only trigger full data reload if structural parameters changed (month advanced, status completed, etc.)
          if (payload.new && payload.old && (payload.new.current_month !== payload.old.current_month || payload.new.status !== payload.old.status)) {
            loadSubscriberData(true);
          }
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
      .on('broadcast', { event: 'data_changed' }, () => {
        loadSubscriberData(true);
      })
      .subscribe();

    // Also listen to global broadcast channel for zero-latency cross-client updates
    const broadcastChan = supabase
      .channel('chit_fund_global_sync')
      .on('broadcast', { event: 'data_changed' }, () => {
        loadSubscriberData(true);
      })
      .subscribe();

    // Auto-sync on window focus and tab visibility change
    const handleFocusSync = () => {
      loadSubscriberData(true);
    };

    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleFocusSync);

    // 3s silent background sync fallback for rapid realtime updates
    const pollInterval = setInterval(() => {
      loadSubscriberData(true);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChan);
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

      // Call RPC first to allow security definer update for anon/subscriber sessions
      const { data: rpcData, error: rpcError } = await supabase.rpc('acknowledge_auction_reschedule', {
        p_profile_id: profile.id,
        p_group_id: groupId,
        p_rescheduled_at: lastRescheduledAt,
      });

      if (!rpcError && rpcData?.success) {
        setRescheduleAcknowledgments(rpcData.reschedule_acknowledgments || updatedAcks);
      } else {
        // Fallback to direct update if caller has admin/manager privileges
        const { error } = await supabase
          .from('profiles')
          .update({ reschedule_acknowledgments: updatedAcks })
          .eq('id', profile.id);

        if (error) {
          console.error('Failed to persist reschedule acknowledgment:', error);
        } else {
          setRescheduleAcknowledgments(updatedAcks);
        }
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

  const isDark = false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#F4F6FB] text-[#151B26]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-[#2A1DB8] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-tight text-[#636F85]">Loading Member Passbook...</span>
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
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300 bg-[#F4F6FB] text-[#151B26]">
      
      {/* 1. TOP APP BAR / CANOPY (Only rendered in Overview Tab) */}
      {activeTab === 'overview' && (
        <header className="sticky top-0 w-full z-40 bg-gradient-to-b from-[#1C128A] via-[#2A1DB8] to-[#3424CA] text-white shadow-md">
          {/* Android Status Bar Simulation on Mobile */}
          <div className="flex md:hidden items-center justify-between px-4 pt-2 pb-1 text-white/80 text-[11px] font-mono">
            <span className="font-bold text-white">9:09</span>
            <div className="flex items-center gap-1.5 opacity-90 text-[10px]">
              <span>4G</span>
              <Radio size={12} />
              <span className="w-4 h-2 rounded-xs border border-white/80 inline-flex items-center p-0.5">
                <span className="w-full h-full bg-white rounded-xs"></span>
              </span>
            </div>
          </div>

          {/* App Header Canopy Content */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 pb-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full p-0.5 flex items-center justify-center bg-white/10 ring-2 ring-white/20 shrink-0">
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-amber-400 to-indigo-300 flex items-center justify-center text-slate-900 font-extrabold text-sm shadow-xs">
                  {profile?.fullName?.charAt(0)?.toUpperCase() || 'A'}
                </div>
              </div>
              <div className="flex flex-col truncate">
                <h1 className="text-base sm:text-lg font-bold leading-tight flex items-center gap-1 truncate text-white">
                  <span>Hello, {profile?.fullName || 'Subscriber'}</span>
                  <span className="text-[16px]">👋</span>
                </h1>
                <span className="text-[11px] text-indigo-200 mt-0.5 truncate font-mono">
                  {groups.length} Active {groups.length === 1 ? 'Chit Group' : 'Chit Groups'} · ID #{profile?.phoneNumber ? profile.phoneNumber.slice(-4) : (profile?.id?.slice(0, 6) || 'RC-9041')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* LIVE SYNC BUTTON */}
              <button
                onClick={() => loadSubscriberData(false)}
                title="Sync Latest Data with Ledger"
                aria-label="Refresh and sync data"
                disabled={syncing}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin text-cyan-300' : ''} />
              </button>

              {/* NOTIFICATIONS BELL */}
              <button
                aria-label="Notifications"
                onClick={() => {
                  if (activeRescheduleNotices.length > 0) setIsAlertModalDismissed(false);
                }}
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                type="button"
              >
                <Bell size={16} />
                {(overdueGroups.length > 0 || activeRescheduleNotices.length > 0) && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-[#1a00a7] animate-pulse"></span>
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-5xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 flex-1">

        {/* DESKTOP TABS (5 Streamlined Tabs at top) */}
        <div className="hidden md:flex items-center gap-2 border-b border-[#E5E9F2] pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#2A1DB8] text-white shadow-md shadow-[#2A1DB8]/20'
                : 'text-[#636F85] hover:text-[#151B26] hover:bg-slate-100'
            }`}
          >
            <Layers size={13} /> Overview
          </button>
          <button
            onClick={() => setActiveTab('chits')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'chits'
                ? 'bg-[#2A1DB8] text-white shadow-md shadow-[#2A1DB8]/20'
                : 'text-[#636F85] hover:text-[#151B26] hover:bg-slate-100'
            }`}
          >
            <Ticket size={13} /> My Chits ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('passbook')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'passbook'
                ? 'bg-[#2A1DB8] text-white shadow-md shadow-[#2A1DB8]/20'
                : 'text-[#636F85] hover:text-[#151B26] hover:bg-slate-100'
            }`}
          >
            <History size={13} /> Passbook Ledger ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('auctions')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'auctions'
                ? 'bg-[#2A1DB8] text-white shadow-md shadow-[#2A1DB8]/20'
                : 'text-[#636F85] hover:text-[#151B26] hover:bg-slate-100'
            }`}
          >
            <Trophy size={13} /> Auctions ({auctions.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#2A1DB8] text-white shadow-md shadow-[#2A1DB8]/20'
                : 'text-[#636F85] hover:text-[#151B26] hover:bg-slate-100'
            }`}
          >
            <Settings size={13} /> Settings &amp; Security
          </button>
        </div>

        {/* TAB CONTENTS */}

        {/* TAB 1: SCREEN 1 OVERVIEW & ACTIVE CHITS (Apple Wallet Popout Design) */}
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
            {/* Live Auction Banner (Compact Sleek Pill) */}
            {(() => {
              const liveGroup = groups.find((g) => g.isLiveAuctionActive);
              if (liveGroup) {
                const topBid = liveGroup.liveBidStream && liveGroup.liveBidStream.length > 0
                  ? Math.max(...liveGroup.liveBidStream.map((b) => b.amount))
                  : 0;

                return (
                  <div className="bg-white rounded-2xl p-3 shadow-xs border border-[#E5E9F2] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider truncate">
                          Live Auction in Progress
                        </span>
                        <span className="text-xs text-[#636F85] font-mono truncate">
                          Month {liveGroup.currentMonth} / {liveGroup.durationMonths} · {topBid > 0 ? `Discount ₹${topBid.toLocaleString('en-IN')}` : liveGroup.groupName}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveLiveArenaGroupId(liveGroup.groupId);
                        setActiveTab('auctions');
                      }}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-[#2A1DB8] hover:bg-[#1B0F8C] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <span>Join Arena</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            {/* Hero Chit Passbook Card: Apple Wallet Layered 3D Card Stack */}
            {groups.length === 0 ? (
              <div className="text-center py-10 rounded-2xl border border-[#E5E9F2] bg-white p-6 text-[#636F85]">
                <Ticket className="mx-auto h-10 w-10 text-[#636F85] mb-2" />
                <h3 className="text-sm font-bold text-[#151B26]">No Enrolled Chits Found</h3>
                <p className="text-[11px] text-[#636F85] max-w-xs mx-auto mt-1">
                  You are not currently enrolled in any chit groups. Contact your Chit Fund Manager.
                </p>
              </div>
            ) : (
              <div className="mt-2 relative">
                {/* Peek Under-Cards (Apple Wallet Style Stack) */}
                {groups.length > 1 && groups.map((g, idx) => {
                  if (idx === selectedCardIndex) return null;
                  const isGold = idx % 2 === 1;
                  const gPayment = getGroupPaymentStatus(g, transactions, auctions);
                  const isLaaba = g.kaiIruppuPool >= g.totalValue;

                  return (
                    <div
                      key={`under-card-${g.groupId}`}
                      onClick={() => setSelectedCardIndex(idx)}
                      title="Tap to bring this card to front"
                      style={{
                        zIndex: 10 - idx,
                        transform: `scale(${0.94 - idx * 0.02}) translateY(-${12 + idx * 6}px)`,
                      }}
                      className={`w-[93%] mx-auto h-20 -mb-12 rounded-2xl p-3.5 text-white shadow-lg cursor-pointer transition-all duration-300 hover:-translate-y-4 hover:scale-[0.96] flex items-start justify-between active:scale-95 ${
                        isGold
                          ? 'bg-gradient-to-r from-[#B45309] via-[#D97706] to-[#FBBF24] shadow-[0_4px_16px_rgba(217,119,6,0.22)]'
                          : 'bg-gradient-to-r from-[#047857] via-[#059669] to-[#10B981] shadow-[0_4px_16px_rgba(5,150,105,0.22)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Ticket size={17} className="text-amber-200 shrink-0" />
                        <span className="font-bold text-xs sm:text-sm text-white truncate">{g.groupName}</span>
                      </div>
                      <span className="text-[10px] bg-black/25 px-2.5 py-0.5 rounded-full font-semibold text-amber-100 shrink-0">
                        {isLaaba ? '₹0 Due (Laaba Seetu)' : `₹${gPayment.outstandingBalance.toLocaleString('en-IN')} Due`}
                      </span>
                    </div>
                  );
                })}

                {/* Active Front Card (Apple Wallet Popout Animation) */}
                {(() => {
                  const safeIndex = selectedCardIndex < groups.length ? selectedCardIndex : 0;
                  const activeGrp = groups[safeIndex] || groups[0];
                  const paymentInfo = getGroupPaymentStatus(activeGrp, transactions, auctions);
                  const isLaaba = activeGrp.kaiIruppuPool >= activeGrp.totalValue;
                  const isWon = activeGrp.hasWonRegular;

                  return (
                    <div 
                      key={`top-card-${activeGrp.groupId}`}
                      className="relative z-20 w-full rounded-2xl overflow-hidden p-5 shadow-[0_16px_36px_rgba(30,27,75,0.25)] ring-1 ring-white/30 bg-gradient-to-br from-[#1a00a7] via-[#1D4ED8] to-[#0284C7] text-white transition-all duration-500 ease-out hover:shadow-[0_20px_45px_rgba(26,0,167,0.35)]"
                    >
                      {/* Organic Translucent Wave Overlays */}
                      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/15 blur-[2px] pointer-events-none" />
                      <div className="absolute -bottom-16 -left-10 w-44 h-44 rounded-full bg-[#389BFF]/30 blur-[2px] pointer-events-none" />
                      <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

                      <div className="relative z-10 flex flex-col justify-between min-h-[195px]">
                        {/* Top Row: Series & Value + Crest */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-indigo-200 tracking-wider uppercase font-bold">
                                {activeGrp.totalValue >= 500000 ? 'Platinum Chit Series' : 'Gold Growth Series'}
                              </span>
                              <span className="text-[10px] bg-[#FFE082]/30 text-amber-200 font-extrabold px-2 py-0.5 rounded-full font-mono">
                                ₹{activeGrp.totalValue.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <h2 className="text-xl sm:text-2xl text-white font-extrabold leading-tight mt-1 truncate tracking-tight">
                              {activeGrp.groupName}
                            </h2>
                            <p className="text-xs text-white/90 mt-0.5">
                              Subscriber: <span className="font-semibold text-white">{profile?.fullName || 'Subscriber'}</span>
                            </p>
                          </div>

                          {/* Crest Badge */}
                          <div className="shrink-0 w-12 h-12 rounded-full p-1 bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md ring-2 ring-white/40">
                            <Trophy size={24} className="text-amber-300 drop-shadow-xs" />
                          </div>
                        </div>

                        {/* Middle Row: Ticket Badge & Status Pill */}
                        <div className="my-3 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-semibold border border-white/15 font-mono">
                            <Ticket size={14} className="text-cyan-300" />
                            <span>Ticket #{activeGrp.ticketNumber} / {activeGrp.memberCount}</span>
                          </div>

                          <span className={`text-white text-xs px-3 py-1 rounded-full font-bold shadow-md ring-1 ring-white/30 inline-flex items-center gap-1 ${
                            isWon ? 'bg-[#D97706]' : 'bg-[#059669]'
                          }`}>
                            {isWon ? (
                              <>
                                <Crown size={14} /> Won (Disbursed)
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={14} /> Eligible to Bid
                              </>
                            )}
                          </span>
                        </div>

                        {/* Bottom Row: Monthly Due & Passbook Slip Button */}
                        <div className="flex items-end justify-between pt-2.5 border-t border-white/20">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-white/80 font-medium uppercase tracking-wider">
                              Monthly Due
                            </span>
                            <div className="flex items-baseline gap-2 mt-0.5">
                              <span className="text-2xl font-extrabold tracking-tight font-mono text-white">
                                {isLaaba ? '₹0' : `₹${paymentInfo.outstandingBalance.toLocaleString('en-IN')}`}
                              </span>
                              <span className="text-[10px] text-indigo-100 font-bold bg-white/10 px-2 py-0.5 rounded-full font-mono">
                                {isLaaba ? 'Laaba Seetu Free Month' : `Due ${paymentInfo.formattedDueDate}`}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPassbookGroup(activeGrp.groupId);
                              setActiveTab('passbook');
                            }}
                            className="flex items-center gap-1 text-white bg-white/25 hover:bg-white/30 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm ring-1 ring-white/20 active:scale-95"
                          >
                            <span>Passbook Slip</span>
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Card Switching Dots (if more than 1 chit enrolled) */}
                {groups.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-2.5">
                    {groups.map((_, dotIdx) => (
                      <button
                        key={`card-dot-${dotIdx}`}
                        onClick={() => setSelectedCardIndex(dotIdx)}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          dotIdx === selectedCardIndex ? 'w-5 bg-[#2A1DB8]' : 'w-1.5 bg-slate-300'
                        }`}
                        title={`Switch to Chit #${dotIdx + 1}`}
                      />
                    ))}
                    <span className="text-[10px] text-[#636F85] ml-1">Tap card or dots to switch</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick Stat Summary Row (Spacious & Simple Clean White Cards) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-[#E5E9F2] flex flex-col justify-between">
                <div className="flex items-center gap-1 text-[#636F85] mb-1">
                  <Wallet size={15} className="text-[#2A1DB8] shrink-0" />
                  <span className="text-[10px] font-semibold truncate">Total Paid</span>
                </div>
                <span className="text-sm sm:text-base font-mono font-extrabold text-[#151B26] truncate">
                  ₹{totalPaid.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-[#636F85] mt-0.5 truncate">
                  {transactions.filter(t => t.type === 'collection' && t.status === 'completed').length} Installments
                </span>
              </div>

              <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-[#E5E9F2] flex flex-col justify-between">
                <div className="flex items-center gap-1 text-[#636F85] mb-1">
                  <Trophy size={15} className="text-amber-500 shrink-0" />
                  <span className="text-[10px] font-semibold truncate">Prize Status</span>
                </div>
                <span className={`text-sm sm:text-base font-extrabold truncate ${
                  wonGroupsCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}>
                  {wonGroupsCount > 0 ? `${wonGroupsCount} Won` : 'Eligible'}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 mt-0.5 truncate">
                  {wonGroupsCount > 0 ? 'Prize Disbursed' : 'Open to Bid'}
                </span>
              </div>

              <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-[#E5E9F2] flex flex-col justify-between">
                <div className="flex items-center gap-1 text-[#636F85] mb-1">
                  <Clock size={15} className="text-rose-500 shrink-0" />
                  <span className="text-[10px] font-semibold truncate">Next Due</span>
                </div>
                <span className={`text-sm sm:text-base font-mono font-extrabold truncate ${
                  totalOverdueAmount > 0 ? 'text-rose-600' : 'text-[#151B26]'
                }`}>
                  ₹{(totalOverdueAmount > 0 
                    ? totalOverdueAmount 
                    : (groups[0] ? getGroupPaymentStatus(groups[0], transactions, auctions).outstandingBalance : 0)
                  ).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-[#636F85] mt-0.5 truncate">
                  {overdueGroups.length > 0 ? 'Payment Overdue' : 'Due on Cycle'}
                </span>
              </div>
            </div>

            {/* Recent Activity (Clean White Container with 100% Real Dynamic Rows) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#151B26]">
                  Recent Activity
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('passbook')}
                  className="text-xs text-[#2A1DB8] hover:text-[#1B0F8C] font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>View All Passbook</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-[#E5E9F2] flex flex-col gap-2.5">
                {(() => {
                  const completedTxs = transactions.filter(t => t.type === 'collection' && t.status === 'completed');
                  const wonAuction = auctions.find(a => a.isCurrentSubscriberWinner);
                  const activeCardGrp = groups[selectedCardIndex] || groups[0];
                  const hasLaaba = activeCardGrp ? activeCardGrp.kaiIruppuPool >= activeCardGrp.totalValue : false;

                  if (completedTxs.length === 0 && !wonAuction && !hasLaaba) {
                    return (
                      <div className="py-6 text-center text-xs text-[#636F85]">
                        No payment activity recorded yet for your account.
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Real Dynamic Collection Payments (up to 3) */}
                      {completedTxs.slice(0, 3).map((tx, txIdx) => (
                        <div key={tx.id}>
                          <div 
                            onClick={() => setSelectedTx(tx)}
                            className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 rounded-xl px-1.5 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-2xl bg-[#EEECFE] text-[#2A1DB8] border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs">
                                <Receipt size={20} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs sm:text-sm font-bold text-[#151B26] leading-tight truncate">
                                  {tx.groupName}
                                </span>
                                <span className="text-[11px] text-[#636F85] font-mono mt-0.5 truncate">
                                  {!tx.walletType || tx.walletType.toLowerCase().includes('cash') ? 'Cash in Hand' : 'UPI / Bank'} · {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 font-mono">
                              <span className="text-xs sm:text-sm font-extrabold text-[#151B26] block">
                                - ₹{Number(tx.amount).toLocaleString('en-IN')}
                              </span>
                              <span className="inline-block text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-0.5">
                                Paid
                              </span>
                            </div>
                          </div>
                          {txIdx < Math.min(completedTxs.length, 3) - 1 && (
                            <div className="h-[1px] bg-[#E5E9F2] w-full my-1" />
                          )}
                        </div>
                      ))}

                      {/* Real Dynamic Won Auction Prize Pot Disbursal (Shown only if member actually won) */}
                      {wonAuction && (
                        <>
                          <div className="h-[1px] bg-[#E5E9F2] w-full my-1" />
                          <div className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
                                <Trophy size={20} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs sm:text-sm font-bold text-[#151B26] leading-tight truncate">
                                  Prize Pot Disbursal (Month {wonAuction.month})
                                </span>
                                <span className="text-[11px] text-[#636F85] mt-0.5 truncate">
                                  {wonAuction.groupName} · Net Disbursed Payout
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 font-mono">
                              <span className="text-xs sm:text-sm font-extrabold text-emerald-600 block">
                                + ₹{wonAuction.netPayout.toLocaleString('en-IN')}
                              </span>
                              <span className="inline-block text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-0.5">
                                Disbursed
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Real Dynamic Laaba Seetu Free Month Entry (Shown only if this chit is in Laaba Seetu) */}
                      {hasLaaba && (
                        <>
                          <div className="h-[1px] bg-[#E5E9F2] w-full my-1" />
                          <div className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 shadow-2xs">
                                <Gift size={20} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs sm:text-sm font-bold text-[#151B26] leading-tight truncate">
                                  Laaba Seetu Free Month
                                </span>
                                <span className="text-[11px] text-[#636F85] mt-0.5 truncate">
                                  Discount Pool Funded · ₹0 Due
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 font-mono">
                              <span className="text-xs sm:text-sm font-extrabold text-amber-700 block">
                                ₹0 Due
                              </span>
                              <span className="inline-block text-[10px] text-amber-800 font-bold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full mt-0.5">
                                100% Waived
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Primary Pinned Action Button */}
            <div className="w-full pt-1">
              <button
                type="button"
                onClick={() => setShowPaymentModal(true)}
                className="w-full h-[52px] bg-[#2A1DB8] hover:bg-[#1B0F8C] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-[#2A1DB8]/20 active:scale-[0.99] transition-all cursor-pointer"
              >
                <Wallet size={18} />
                <span>Make Monthly Installment Payment</span>
              </button>
              <div className="flex items-center justify-center gap-1.5 mt-2.5 text-center px-2">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span className="text-[10px] text-[#636F85]">
                  Government Registered Chit Fund · Tamil Nadu Chit Funds Act Compliant
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SCREEN 3 SUBSCRIBER CHITS (Exact 360px Native Android 20-Month Chit Schedule) */}
        {activeTab === 'chits' && (() => {
          const activeGrp = groups[selectedCardIndex] || groups[0] || null;
          const pInfo = activeGrp ? getGroupPaymentStatus(activeGrp, transactions, auctions) : null;
          const totalMonths = activeGrp?.durationMonths || 20;
          const paidMonthsCount = pInfo ? pInfo.monthDues.filter((m) => m.status === 'paid' || m.status === 'free_laaba').length : 0;
          const remainingMonthsCount = Math.max(0, totalMonths - paidMonthsCount);
          const cyclePct = activeGrp && activeGrp.durationMonths > 0
            ? Math.min(100, Math.round(((pInfo?.effectiveCurrentMonth ?? 1) / activeGrp.durationMonths) * 100))
            : 10;

          const getMonthDateStr = (m: number) => {
            if (!activeGrp?.startDate) return `Month ${m}`;
            try {
              let year: number;
              let month: number;
              let day: number;
              if (activeGrp.startDate.includes('-')) {
                const parts = activeGrp.startDate.split('-');
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                day = parseInt(parts[2], 10) || 15;
              } else {
                const base = new Date(activeGrp.startDate);
                year = base.getFullYear();
                month = base.getMonth();
                day = base.getDate() || 15;
              }
              const targetYear = year + Math.floor((month + m) / 12);
              const targetMonth = ((month + m) % 12 + 12) % 12;
              const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
              const safeDay = Math.min(day, maxDays);
              const d = new Date(targetYear, targetMonth, safeDay);
              return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch {
              return `Month ${m}`;
            }
          };

          const getMaturityDateStr = () => {
            if (!activeGrp?.startDate) return 'Upon completion of batch';
            try {
              let year: number;
              let month: number;
              let day: number;
              if (activeGrp.startDate.includes('-')) {
                const parts = activeGrp.startDate.split('-');
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                day = parseInt(parts[2], 10) || 15;
              } else {
                const base = new Date(activeGrp.startDate);
                year = base.getFullYear();
                month = base.getMonth();
                day = base.getDate() || 15;
              }
              const targetYear = year + Math.floor((month + totalMonths) / 12);
              const targetMonth = ((month + totalMonths) % 12 + 12) % 12;
              const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
              const safeDay = Math.min(day, maxDays);
              const d = new Date(targetYear, targetMonth, safeDay);
              return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch {
              return 'Upon completion of batch';
            }
          };

          const m1Auction = auctions.find((a) => a.groupId === activeGrp?.groupId && a.month === 1);
          const m1WinningBidText = m1Auction?.winningDiscount 
            ? `Winning Bid ₹${m1Auction.winningDiscount.toLocaleString('en-IN')}` 
            : 'Live Bidding Pending';

          const currentMonthNum = pInfo?.effectiveCurrentMonth ?? 2;
          const upcomingStartMonth = currentMonthNum + 1;
          const upcomingMonthsCount = Math.max(0, totalMonths - upcomingStartMonth);
          const maxRemainingPayable = upcomingMonthsCount * (activeGrp?.monthlyInstallment || 10000);

          const displayedDues = pInfo?.monthDues.filter((item) => {
            if (scheduleFilter === 'paid') return item.status === 'paid' || item.status === 'free_laaba';
            if (scheduleFilter === 'pending') return item.remainingDue > 0;
            return true;
          }) || [];

          return (
            <div className="space-y-0 -mx-3.5 sm:-mx-6 -mt-4 sm:-mt-6 pb-28 animate-in fade-in duration-200 bg-[#F4F6FB] text-[#151B26]">
              {/* 1. TOP CANOPY HEADER (Royal Indigo with Status Bar & App Bar) */}
              <header className="w-full bg-gradient-to-b from-[#1C128A] via-[#2A1DB8] to-[#3424CA] text-white sticky top-0 z-30 shadow-sm border-b border-white/10">
                {/* Android Native Status Bar */}
                <div className="h-6 px-4 flex items-center justify-between text-xs font-semibold text-white/90 select-none pt-1">
                  <span className="tracking-tight text-[11px] font-bold">9:09</span>
                  <div className="flex items-center gap-1.5 opacity-90 text-[13px]">
                    <span className="text-[11px] font-mono">5G</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] font-mono">100%</span>
                  </div>
                </div>

                {/* App Bar */}
                <div className="h-14 px-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      aria-label="Back"
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white active:bg-white/15 transition-colors cursor-pointer"
                    >
                      <ArrowRight className="rotate-180" size={20} />
                    </button>
                    <h1 className="text-[17px] font-bold tracking-tight text-white">
                      {totalMonths}-Month Chit Schedule
                    </h1>
                  </div>
                  {groups.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx = (selectedCardIndex + 1) % groups.length;
                        setSelectedCardIndex(nextIdx);
                      }}
                      title="Switch Chit Group"
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 active:bg-white/15 transition-colors cursor-pointer"
                    >
                      <Sliders size={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowScheduleInfoModal((prev) => !prev)}
                      aria-label="Schedule Information"
                      title="Schedule Information"
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 active:bg-white/15 transition-colors cursor-pointer"
                    >
                      <Info size={20} />
                    </button>
                  )}
                </div>
              </header>

              {/* Information modal toggle */}
              {showScheduleInfoModal && (
                <div className="mx-3.5 mt-2.5 p-3.5 rounded-2xl bg-white border border-[#E5E9F2] text-xs text-[#636F85] space-y-1.5 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between text-[#151B26] font-bold">
                    <span className="flex items-center gap-1.5 text-[#2A1DB8]">
                      <Sparkles size={14} /> Chit Schedule Mechanics
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowScheduleInfoModal(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <p>• <strong>Month 0:</strong> Launch round reserved for Organizer Profit.</p>
                  <p>• <strong>Months 1..N:</strong> Monthly live auctions among eligible non-winning subscribers.</p>
                  <p>• <strong>Laaba Seetu:</strong> ₹0 free installment months funded when the group discount pool reaches the total chit value.</p>
                </div>
              )}

              {/* MAIN SCROLLABLE CONTENT */}
              <div className="flex flex-col w-full px-3.5 pt-3 gap-3.5">
                {/* 2. GROUP SUMMARY CARD */}
                <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#2A1DB8] via-[#3325D8] to-[#1C0FB3] text-white p-4 shadow-md">
                  {/* Organic bubble wave overlays */}
                  <div className="absolute -right-8 -bottom-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none blur-lg" />
                  <div className="absolute -left-6 -top-10 w-28 h-28 rounded-full bg-[#5244E8]/40 pointer-events-none blur-md" />
                  
                  <div className="relative z-10 flex flex-col gap-3">
                    {/* Title & Subtitle */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                          <ShieldCheck size={12} /> {activeGrp?.groupName || 'Chit Plan'}
                        </span>
                        <h2 className="text-[19px] font-extrabold tracking-tight text-white pt-1">
                          {activeGrp?.groupName || 'Chit Group'} (₹{(activeGrp?.totalValue || 200000).toLocaleString('en-IN')})
                        </h2>
                        <p className="text-[12px] font-medium text-white/80">
                          Ticket #{activeGrp?.ticketNumber ?? 1} of {activeGrp?.memberCount ?? 20} · Monthly Due ₹{(activeGrp?.monthlyInstallment || 10000).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
                        <Wallet size={20} />
                      </div>
                    </div>

                    {/* Term Progress */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-white/90">
                        <span>Term Progress</span>
                        <span className="font-mono">
                          Month {currentMonthNum} / {totalMonths} Completed ({cyclePct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-black/20 overflow-hidden p-0.5">
                        <div
                          className="bg-gradient-to-r from-emerald-400 to-emerald-300 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(6, cyclePct)}%` }}
                        />
                      </div>
                    </div>

                    {/* 3 Quick Chips */}
                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
                      <div className="bg-white/15 backdrop-blur-md rounded-xl p-2 text-center border border-white/10">
                        <p className="text-[10px] text-white/75 font-semibold font-sans">Total</p>
                        <p className="text-[14px] font-extrabold text-white">{totalMonths} Mos</p>
                      </div>
                      <div className="bg-white/15 backdrop-blur-md rounded-xl p-2 text-center border border-white/10">
                        <p className="text-[10px] text-white/75 font-semibold font-sans">Paid</p>
                        <p className="text-[14px] font-extrabold text-emerald-300">{paidMonthsCount} Mos</p>
                      </div>
                      <div className="bg-white/15 backdrop-blur-md rounded-xl p-2 text-center border border-white/10">
                        <p className="text-[10px] text-white/75 font-semibold font-sans">Remaining</p>
                        <p className="text-[14px] font-extrabold text-white">{remainingMonthsCount} Mos</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 3. SEGMENT FILTER TABS (Clean light pill selector) */}
                <div className="bg-[#EEF1F6] rounded-2xl p-1 flex items-center justify-between gap-1 select-none border border-[#E5E9F2]">
                  <button
                    type="button"
                    onClick={() => setScheduleFilter('all')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-center text-[12px] font-bold transition-all cursor-pointer ${
                      scheduleFilter === 'all'
                        ? 'bg-[#2A1DB8] text-white shadow-xs'
                        : 'text-[#636F85] hover:text-[#151B26]'
                    }`}
                  >
                    All {totalMonths} Months
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleFilter('paid')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-center text-[12px] font-semibold transition-all cursor-pointer ${
                      scheduleFilter === 'paid'
                        ? 'bg-[#2A1DB8] text-white shadow-xs font-bold'
                        : 'text-[#636F85] hover:text-[#151B26]'
                    }`}
                  >
                    Paid ({paidMonthsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleFilter('pending')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-center text-[12px] font-semibold transition-all cursor-pointer ${
                      scheduleFilter === 'pending'
                        ? 'bg-[#2A1DB8] text-white shadow-xs font-bold'
                        : 'text-[#636F85] hover:text-[#151B26]'
                    }`}
                  >
                    Pending ({remainingMonthsCount})
                  </button>
                </div>

                {/* 4. MONTH-BY-MONTH SCHEDULE LIST */}
                <section className="space-y-3">
                  {displayedDues.map((item) => {
                    const monthDateStr = getMonthDateStr(item.month);
                    const isCurrentDue = item.month === currentMonthNum && item.remainingDue > 0;
                    const isPaid = item.status === 'paid';
                    const isLaaba = item.status === 'free_laaba' || item.expectedDue === 0;

                    // A. Current Due Highlight Card
                    if (isCurrentDue) {
                      return (
                        <div
                          key={`m-${item.month}`}
                          className="bg-red-50/80 rounded-2xl p-3.5 shadow-xs border-2 border-red-300 flex flex-col gap-2.5 relative overflow-hidden"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-[14px] bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <AlertTriangle size={22} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h3 className="text-[14px] font-bold text-red-950 leading-snug">
                                    Month {item.month} (Current Due)
                                  </h3>
                                </div>
                                <p className="text-[11px] text-red-800 font-medium">
                                  Due by {item.formattedDueDate || monthDateStr}
                                </p>
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <span className="text-[16px] font-extrabold text-red-600">
                                ₹{item.remainingDue.toLocaleString('en-IN')} Due
                              </span>
                              <div className="mt-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                                  {pInfo?.isPastDueDate
                                    ? `${pInfo.daysOverdue ?? 1} Days Overdue`
                                    : `Due in ${pInfo?.daysRemaining ?? 5} Days`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-red-200">
                            <span className="text-[11px] font-semibold text-red-700 flex items-center gap-1">
                              <Clock size={14} /> Immediate Payment Required
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowPaymentModal(true)}
                              className="px-3.5 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-xs active:scale-95 transition-transform cursor-pointer"
                            >
                              Pay Now
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // B. Laaba Seetu Free Month Card
                    if (isLaaba) {
                      return (
                        <div
                          key={`m-${item.month}`}
                          className="bg-amber-50/80 rounded-2xl p-3.5 shadow-xs border border-amber-300 flex flex-col gap-2.5"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-[14px] bg-[#D97706] text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Sparkles size={22} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1">
                                  <h3 className="text-[14px] font-bold text-amber-950 leading-snug">
                                    Month {item.month} · Laaba Seetu
                                  </h3>
                                </div>
                                <p className="text-[11px] text-amber-800 font-medium">
                                  {monthDateStr} · Free Month 🎉
                                </p>
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <span className="text-[16px] font-extrabold text-amber-700">
                                ₹0 (Free)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-amber-100/70 px-3 py-1.5 rounded-xl border border-amber-300/60">
                            <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                              <Gift size={14} className="text-amber-600" /> 100% Waived from Discount Pool
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-1.5 py-0.5 rounded">
                              Bonus
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // C. Month 0 Launch Month Card
                    if (item.month === 0) {
                      return (
                        <div
                          key={`m-${item.month}`}
                          className="bg-white rounded-2xl p-3.5 shadow-xs border border-[#E5E9F2] flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-[14px] bg-[#2A1DB8] text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Flag size={20} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h3 className="text-[14px] font-bold text-[#151B26] leading-snug">
                                    Month 0 (Launch Month)
                                  </h3>
                                </div>
                                <p className="text-[11px] text-[#636F85]">
                                  {monthDateStr} · Organizer Profit Round
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end font-mono">
                              <span className="text-[14px] font-bold text-[#151B26]">
                                ₹{item.expectedDue.toLocaleString('en-IN')}
                              </span>
                              {isPaid ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold mt-0.5 border border-emerald-200 font-sans">
                                  <CheckCircle2 size={11} /> Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold mt-0.5 border border-red-200 font-sans">
                                  Due
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // D. Month 1 Regular Auction Month Card
                    if (item.month === 1) {
                      return (
                        <div
                          key={`m-${item.month}`}
                          className="bg-white rounded-2xl p-3.5 shadow-xs border border-[#E5E9F2] flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-[14px] bg-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Gavel size={20} />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h3 className="text-[14px] font-bold text-[#151B26] leading-snug">
                                    Month 1 Auction
                                  </h3>
                                </div>
                                <p className="text-[11px] text-[#636F85]">
                                  {monthDateStr} · {m1WinningBidText}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end font-mono">
                              <span className="text-[14px] font-bold text-[#151B26]">
                                ₹{item.expectedDue.toLocaleString('en-IN')}
                              </span>
                              {isPaid ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold mt-0.5 border border-emerald-200 font-sans">
                                  <CheckCircle2 size={11} /> Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold mt-0.5 border border-red-200 font-sans">
                                  Due
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // E. Other Standard Month Cards
                    return (
                      <div
                        key={`m-${item.month}`}
                        className="bg-white rounded-2xl p-3.5 shadow-xs border border-[#E5E9F2] flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-[14px] bg-[#2A1DB8] text-white flex items-center justify-center shrink-0 shadow-xs">
                              <Receipt size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="text-[14px] font-bold text-[#151B26] leading-snug">
                                  Month {item.month} Installment
                                </h3>
                              </div>
                              <p className="text-[11px] text-[#636F85]">
                                {monthDateStr}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end font-mono">
                            <span className="text-[14px] font-bold text-[#151B26]">
                              ₹{item.expectedDue.toLocaleString('en-IN')}
                            </span>
                            {isPaid ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold mt-0.5 border border-emerald-200 font-sans">
                                <CheckCircle2 size={11} /> Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold mt-0.5 border border-red-200 font-sans">
                                ₹{item.remainingDue.toLocaleString('en-IN')} Due
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* 5. FUTURE CYCLES SECTION */}
                  {(scheduleFilter === 'all' || scheduleFilter === 'pending') && upcomingMonthsCount > 0 && (
                    <div className="pt-2">
                      <h4 className="text-[13px] font-bold text-[#151B26] mb-2 flex items-center gap-1.5">
                        <Calendar size={16} className="text-[#2A1DB8]" />
                        Upcoming Auction Cycles (Months {upcomingStartMonth} – {totalMonths})
                      </h4>
                      {/* Clean Summary Card for upcoming months */}
                      <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#E5E9F2] flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-[13px] font-bold text-[#151B26]">Months {upcomingStartMonth} – {totalMonths}</p>
                            <p className="text-[12px] font-semibold text-[#2A1DB8]">
                              Fixed Monthly Installment: ₹{(activeGrp?.monthlyInstallment || 10000).toLocaleString('en-IN')}/mo
                            </p>
                          </div>
                          <span className="w-8 h-8 rounded-full bg-[#F4F6FB] border border-[#E5E9F2] flex items-center justify-center text-[#2A1DB8] text-[11px] font-bold font-mono">
                            {upcomingMonthsCount}
                          </span>
                        </div>
                        {/* Business Rule Note */}
                        <div className="bg-[#F8FAFC] rounded-xl p-2.5 border border-[#E2E8F0]">
                          <p className="text-[11px] text-[#636F85] leading-relaxed">
                            <strong className="text-[#151B26] font-bold">Note:</strong> Bonus Laaba Seetu free months will be credited automatically whenever the accumulated discount pool reaches the chit value of ₹{(activeGrp?.totalValue || 200000).toLocaleString('en-IN')}.
                          </p>
                        </div>
                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E5E9F2]">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-semibold text-[#636F85]">Total Remaining Payable</span>
                            <span className="text-[13px] font-extrabold text-[#151B26] font-mono">
                              ₹{maxRemainingPayable.toLocaleString('en-IN')} max
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-semibold text-[#636F85]">Chit Maturity Date</span>
                            <span className="text-[13px] font-extrabold text-[#151B26]">
                              {getMaturityDateStr()}
                            </span>
                          </div>
                        </div>
                        {/* Regulatory Note */}
                        <div className="flex items-center gap-1.5 pt-1 text-[10px] text-[#636F85] border-t border-dashed border-[#E5E9F2]">
                          <Gavel size={14} className="text-[#2A1DB8] shrink-0" />
                          <span>Regulated under Tamil Nadu Chit Funds Act, 1982.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* 6. FLOATING QUICK PAY ACTION BAR (Shown when there is an active due) */}
              {pInfo && pInfo.outstandingBalance > 0 && (
                <div className="fixed bottom-16 left-0 right-0 z-30 max-w-md mx-auto px-3.5 py-2.5 flex items-center justify-between gap-3 bg-white/95 backdrop-blur-md border-t border-[#E5E9F2] shadow-xl">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Month {currentMonthNum} Due
                    </span>
                    <span className="text-[16px] font-extrabold text-[#151B26] font-mono tabular-nums leading-tight">
                      ₹{pInfo.outstandingBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(true)}
                    className="flex-1 h-11 rounded-full bg-[#2A1DB8] hover:bg-[#1B0F8C] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer"
                  >
                    <Wallet size={18} />
                    <span>Pay Current Month</span>
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 3: SCREEN 2 PASSBOOK & LEDGER (Exact 360px Native Android Design) */}
        {activeTab === 'passbook' && (
          <div className="space-y-0 -mx-3.5 sm:-mx-6 -mt-4 sm:-mt-6 animate-in fade-in duration-200">
            {/* 1. PASSBOOK TOP ACTION BAR */}
            <div className="bg-[#1a00a7] text-white px-4 py-2.5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  aria-label="Go back to overview"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowRight className="rotate-180" size={18} />
                </button>
                <h2 className="text-base font-bold text-white tracking-tight">Passbook &amp; Ledger</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label="Download PDF"
                  title="Download / Print E-Passbook"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
                >
                  <FileText size={15} />
                </button>
                {groups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = (selectedCardIndex + 1) % groups.length;
                      setSelectedCardIndex(nextIdx);
                      setSelectedPassbookGroup(groups[nextIdx].groupId);
                    }}
                    aria-label="Filter group"
                    title="Switch Chit Group"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Sliders size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* 2. CANOPY HERO PASSBOOK CARD CONTAINER */}
            {(() => {
              const activePassbookGrp = groups.find((g) => g.groupId === selectedPassbookGroup) || groups[selectedCardIndex] || groups[0] || null;
              const pInfo = activePassbookGrp ? getGroupPaymentStatus(activePassbookGrp, transactions, auctions) : null;
              const cyclePct = activePassbookGrp && activePassbookGrp.durationMonths > 0
                ? Math.min(100, Math.round(((pInfo?.effectiveCurrentMonth ?? 1) / activePassbookGrp.durationMonths) * 100))
                : 10;
              const isLaaba = activePassbookGrp ? activePassbookGrp.kaiIruppuPool >= activePassbookGrp.totalValue : false;

              // Filter transactions based on selectedPassbookGroup and passbookFilter
              const grpTransactions = transactions.filter((tx) =>
                selectedPassbookGroup === 'all' || !activePassbookGrp
                  ? true
                  : tx.groupId === activePassbookGrp.groupId || tx.groupName === activePassbookGrp.groupName
              );

              const completedCollections = grpTransactions.filter((t) => t.type === 'collection' && t.status === 'completed');
              const grpTotalPaid = completedCollections.reduce((sum, t) => sum + Number(t.amount || 0), 0);
              const wonAuction = auctions.find((a) =>
                activePassbookGrp ? a.groupId === activePassbookGrp.groupId && a.isCurrentSubscriberWinner : a.isCurrentSubscriberWinner
              );
              const prizePayoutAmt = wonAuction ? wonAuction.netPayout : (activePassbookGrp?.hasWonRegular ? activePassbookGrp.totalValue * 0.88 : 0);

              return (
                <div className="flex flex-col w-full">
                  {/* Top Indigo Canopy with Floating Card */}
                  <div className="bg-[#1a00a7] px-3.5 pt-2 pb-6 text-white relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none blur-2xl" />
                    
                    <div className="relative w-full mx-auto">
                      {/* Under-shadow layer */}
                      <div className="absolute -top-1.5 inset-x-2.5 h-14 bg-blue-600/40 rounded-2xl -z-0 transform scale-[0.97]" />
                      
                      {/* Hero Passbook Card */}
                      <div className="relative z-10 w-full rounded-2xl p-4 bg-gradient-to-br from-[#1a00a7] to-[#0075d6] text-white shadow-[0_12px_28px_rgba(26,0,167,0.32)] overflow-hidden">
                        <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
                        <div className="absolute right-8 top-10 w-28 h-28 rounded-full bg-cyan-300/15 pointer-events-none blur-sm" />

                        {/* Top Card Row */}
                        <div className="relative z-10 flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xs">
                              <User size={16} className="text-white" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-200">Subscriber</p>
                              <h2 className="text-sm font-bold text-white tracking-tight">{profile?.fullName || 'Subscriber'}</h2>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-bold text-white font-mono">
                            Ticket #{activePassbookGrp?.ticketNumber ?? 1} / {activePassbookGrp?.memberCount ?? 20}
                          </span>
                        </div>

                        {/* Middle Card Row: Group & Due */}
                        <div className="relative z-10">
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-200 font-bold tracking-wide">
                            <Sparkles size={13} />
                            {activePassbookGrp?.groupName || 'Chit Group'} (₹{activePassbookGrp?.totalValue?.toLocaleString('en-IN') || '2,00,000'} Total Value)
                          </span>
                          <div className="flex items-baseline justify-between mt-1">
                            <div className="flex items-baseline gap-1.5 font-mono">
                              <span className="text-2xl font-extrabold text-white tracking-tight">
                                {isLaaba ? '₹0' : `₹${(pInfo?.outstandingBalance ?? 10000).toLocaleString('en-IN')}`}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-amber-300/20 text-amber-200 text-[10px] font-bold font-sans">
                                {isLaaba ? 'Free Month' : 'Due'}
                              </span>
                            </div>
                            <span className="text-xs text-white/80 font-medium">
                              {isLaaba ? 'Laaba Seetu Bonus' : `Due ${pInfo?.formattedDueDate ?? '15 Oct'}`}
                            </span>
                          </div>
                        </div>

                        {/* Cycle Progress bar */}
                        <div className="relative z-10 mt-2.5 pt-2 bg-white/10 rounded-xl px-2.5 py-2">
                          <div className="flex justify-between items-center text-white/90 text-[11px] font-semibold mb-1">
                            <span>Cycle Progress</span>
                            <span className="font-mono">Month {pInfo?.effectiveCurrentMonth ?? 2} / {activePassbookGrp?.durationMonths ?? 20} · {cyclePct}% Completed</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-300 rounded-full transition-all duration-500" style={{ width: `${Math.max(6, cyclePct)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. WHITE / LIGHT PULL-UP SHEET CONTAINER */}
                  <div className="relative -mt-3.5 bg-[#F4F6FB] rounded-t-3xl shadow-md px-3.5 pt-3 pb-8 z-20 flex-1 border-t border-[#E5E9F2]">
                    {/* Pull-handle bar */}
                    <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3.5" />

                    {/* Quick Stat Glance Row */}
                    <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                      <div className="p-3 bg-white rounded-2xl flex flex-col justify-between border border-[#E5E9F2] shadow-xs">
                        <div className="flex items-center gap-1.5 text-[#636F85] mb-1">
                          <Wallet size={15} className="text-[#2A1DB8]" />
                          <span className="text-[11px] uppercase font-bold tracking-wider">Total Paid</span>
                        </div>
                        <p className="text-lg font-extrabold text-[#151B26] font-mono">
                          ₹{grpTotalPaid.toLocaleString('en-IN')}
                        </p>
                        <span className="text-[11px] text-[#636F85] font-medium">
                          {completedCollections.length} Installments
                        </span>
                      </div>

                      <div className="p-3 bg-white rounded-2xl flex flex-col justify-between border border-[#E5E9F2] shadow-xs">
                        <div className="flex items-center gap-1.5 text-[#636F85] mb-1">
                          <Trophy size={15} className="text-emerald-600" />
                          <span className="text-[11px] uppercase font-bold tracking-wider">Prize Payout</span>
                        </div>
                        <p className="text-lg font-extrabold text-emerald-600 font-mono">
                          ₹{prizePayoutAmt.toLocaleString('en-IN')}
                        </p>
                        <span className="text-[11px] text-[#636F85] font-medium">
                          {activePassbookGrp?.hasWonRegular ? 'Auction Winner' : 'Pending Win'}
                        </span>
                      </div>
                    </div>

                    {/* Filter Segment Pills [ All History | Installments | Payouts ] */}
                    <div className="flex p-1 bg-[#EEF1F6] border border-[#E5E9F2] rounded-2xl mb-4">
                      <button
                        type="button"
                        onClick={() => setPassbookFilter('all')}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                          passbookFilter === 'all'
                            ? 'bg-[#2A1DB8] text-white shadow-xs'
                            : 'text-[#636F85] hover:text-[#151B26]'
                        }`}
                      >
                        All History
                      </button>
                      <button
                        type="button"
                        onClick={() => setPassbookFilter('installments')}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all text-center cursor-pointer ${
                          passbookFilter === 'installments'
                            ? 'bg-[#2A1DB8] text-white shadow-xs'
                            : 'text-[#636F85] hover:text-[#151B26]'
                        }`}
                      >
                        Installments
                      </button>
                      <button
                        type="button"
                        onClick={() => setPassbookFilter('payouts')}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all text-center cursor-pointer ${
                          passbookFilter === 'payouts'
                            ? 'bg-[#2A1DB8] text-white shadow-xs'
                            : 'text-[#636F85] hover:text-[#151B26]'
                        }`}
                      >
                        Payouts
                      </button>
                    </div>

                    {/* Timeline Grouped Entries */}
                    <div className="flex flex-col gap-4">
                      {/* Section 1: Recent Collections Timeline */}
                      <section className="flex flex-col gap-2">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#2A1DB8]" />
                            <h3 className="text-xs font-bold text-[#151B26] uppercase tracking-wide">Recent Collections</h3>
                          </div>
                          <span className="text-[11px] font-semibold text-[#636F85]">Verified Entries</span>
                        </div>

                        {completedCollections.length === 0 ? (
                          <div className="p-4 rounded-2xl border border-[#E5E9F2] bg-white text-center text-xs text-[#636F85] shadow-xs">
                            No payment receipts recorded yet for this group.
                          </div>
                        ) : (
                          <div className="flex flex-col rounded-2xl border border-[#E5E9F2] overflow-hidden bg-white shadow-xs divide-y divide-[#E5E9F2]">
                            {completedCollections
                              .filter(() => passbookFilter !== 'payouts')
                              .map((tx) => (
                                <div
                                  key={tx.id}
                                  onClick={() => setSelectedTx(tx)}
                                  className="p-3 flex items-center justify-between gap-2 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-[#2A1DB8] flex items-center justify-center shrink-0 text-white shadow-xs">
                                      <Receipt size={20} />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-xs sm:text-sm font-bold text-[#151B26] truncate">{tx.groupName}</h4>
                                      <p className="text-[11px] text-[#636F85] font-mono truncate">
                                        {!tx.walletType || tx.walletType.toLowerCase().includes('cash') ? 'Cash in Hand' : 'UPI / GPay'} · {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 font-mono">
                                    <span className="text-xs sm:text-sm font-extrabold text-[#151B26] tracking-tight block">
                                      - ₹{Number(tx.amount).toLocaleString('en-IN')}
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                      Verified Paid
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </section>

                      {/* Section 2: Payouts & Benefits */}
                      {(passbookFilter === 'all' || passbookFilter === 'payouts') && (
                        <section className="flex flex-col gap-2">
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <h3 className="text-xs font-bold text-[#151B26] uppercase tracking-wide">Benefits &amp; Payouts</h3>
                            </div>
                            <span className="text-[11px] font-semibold text-[#636F85]">Scheme Credits</span>
                          </div>

                          {!wonAuction && !isLaaba ? (
                            <div className="p-4 rounded-2xl border border-[#E5E9F2] bg-white text-center text-xs text-[#636F85] shadow-xs">
                              No auction prize payouts or bonus credits recorded yet for this chit.
                            </div>
                          ) : (
                            <div className="flex flex-col rounded-2xl border border-[#E5E9F2] overflow-hidden bg-white shadow-xs divide-y divide-[#E5E9F2]">
                              {/* Winner Payout Entry (if won) */}
                              {wonAuction && (
                                <div className="p-3 flex items-center justify-between gap-2 hover:bg-[#F8FAFC] transition-colors">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-[#059669] flex items-center justify-center shrink-0 text-white shadow-xs">
                                      <Trophy size={20} />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-xs sm:text-sm font-bold text-[#151B26] truncate">Month {wonAuction.month} Winner Prize Pot</h4>
                                      <p className="text-[11px] text-[#636F85] truncate">Direct Bank Transfer</p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 font-mono">
                                    <span className="text-xs sm:text-sm font-extrabold text-emerald-600 tracking-tight block">
                                      + ₹{wonAuction.netPayout.toLocaleString('en-IN')}
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                      Disbursed
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Laaba Seetu Free Month Entry (only when pool >= totalValue) */}
                              {isLaaba && (
                                <div className="p-3 flex items-center justify-between gap-2 hover:bg-[#F8FAFC] transition-colors">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-[#D97706] flex items-center justify-center shrink-0 text-white shadow-xs">
                                      <Gift size={20} />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="text-xs sm:text-sm font-bold text-[#151B26] truncate">Laaba Seetu Free Month</h4>
                                      <p className="text-[11px] text-[#636F85] truncate">Scheme Benefit · Discount Pool</p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 font-mono">
                                    <span className="text-xs sm:text-sm font-extrabold text-amber-700 tracking-tight block">
                                      ₹0 Due
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold">
                                      ₹{(activePassbookGrp?.monthlyInstallment || 10000).toLocaleString('en-IN')} Waived
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      )}
                    </div>

                    {/* Statutory Trust Note */}
                    <div className="mt-4 p-2.5 bg-white rounded-xl flex items-center gap-2 border border-[#E5E9F2] shadow-xs">
                      <ShieldCheck size={18} className="text-[#2A1DB8] shrink-0" />
                      <p className="text-[11px] text-[#636F85] font-medium leading-tight">
                        Tamil Nadu Chit Funds Act, 1982 Registered · Digitally Signed Ledger
                      </p>
                    </div>

                    {/* Download PDF E-Passbook CTA */}
                    <div className="mt-4 mb-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="w-full h-11 rounded-full bg-[#2A1DB8] hover:bg-[#1B0F8C] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <FileText size={16} />
                        <span>Download PDF E-Passbook</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 4: SCREEN 4 LIVE AUCTION SCOREBOARD */}
        {activeTab === 'auctions' && (
          <div className="space-y-4">
            {(() => {
              const liveOrActiveGrp = groups.find((g) => g.groupId === activeLiveArenaGroupId) || groups.find((g) => g.isLiveAuctionActive) || groups[selectedCardIndex] || groups[0];
              if (!liveOrActiveGrp) {
                return (
                  <div className="text-center py-10 rounded-2xl border border-[#E5E9F2] bg-white p-6 text-[#636F85] shadow-xs">
                    <Trophy className="mx-auto h-10 w-10 text-[#636F85] mb-2" />
                    <h3 className="text-sm font-bold text-[#151B26]">No Enrolled Chit Groups Yet</h3>
                    <p className="text-[11px] text-[#636F85] max-w-xs mx-auto mt-1">
                      Live auction scoreboards and floor feeds will appear once you are enrolled in a chit group.
                    </p>
                  </div>
                );
              }
              return (
                <SubscriberLiveAuctionArena
                  group={liveOrActiveGrp}
                  currentUserId={profile?.id}
                  isDark={isDark}
                  onExit={() => {
                    setActiveLiveArenaGroupId(null);
                    setActiveTab('overview');
                  }}
                />
              );
            })()}
          </div>
        )}

        {/* TAB 5: SCREEN 5 ACCOUNT & SECURITY SETTINGS (Exact 360px Native Android Design) */}
        {activeTab === 'settings' && (
          <div className="space-y-0 -mx-3.5 sm:-mx-6 -mt-4 sm:-mt-6 pb-28 animate-in fade-in duration-200 bg-[#F4F6FB] text-[#151B26]">
            {/* 1. TOP CANOPY HEADER (Deep Royal Indigo Gradient with Status Bar & App Bar) */}
            <header className="w-full bg-gradient-to-b from-[#1C128A] via-[#2A1DB8] to-[#3424CA] text-white sticky top-0 z-30 shadow-md border-b border-white/10">
              {/* Android Native Status Bar */}
              <div className="h-6 px-4 flex items-center justify-between text-xs font-semibold text-white/90 select-none pt-1">
                <span className="tracking-tight text-[11px] font-bold">9:09</span>
                <div className="flex items-center gap-1.5 opacity-90 text-[13px]">
                  <span className="text-[11px] font-mono">5G</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-mono">100%</span>
                </div>
              </div>

              {/* App Bar Navigation */}
              <div className="h-14 px-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    aria-label="Go Back"
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform text-white cursor-pointer"
                  >
                    <ArrowRight className="rotate-180" size={20} />
                  </button>
                  <h1 className="text-[17px] font-bold tracking-tight text-white leading-tight">
                    Account &amp; Settings
                  </h1>
                </div>

                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-[11px] font-semibold">
                    <ShieldCheck size={13} className="text-emerald-300" />
                    <span>100% Protected</span>
                  </div>
                </div>
              </div>
            </header>

            {/* MAIN SCROLLABLE CONTENT */}
            <div className="flex flex-col w-full px-3.5 pt-3 gap-3.5">
              {/* 1. SUBSCRIBER PROFILE HERO CARD */}
              <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1C128A] via-[#2A1DB8] to-[#3424CA] text-white p-4 shadow-md border border-indigo-400/20">
                {/* Organic Ambient Backdrops */}
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -left-6 -top-6 w-28 h-28 bg-blue-400/20 rounded-full blur-xl pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center gap-3">
                    {/* Profile Avatar with Online / Verified Badge */}
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md text-white font-extrabold text-xl flex items-center justify-center ring-2 ring-white/60 shadow-md">
                        {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 ring-2 ring-white rounded-full flex items-center justify-center shadow-xs">
                        <Check size={10} className="text-white font-bold" />
                      </span>
                    </div>

                    {/* Subscriber Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-[17px] font-bold text-white truncate leading-tight">
                          {profile?.fullName || 'Subscriber'}
                        </h2>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-300/40 text-[10px] font-bold text-emerald-200">
                          Verified
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-white/80 text-[12px] font-medium">
                        <Smartphone size={13} className="text-white/70" />
                        <span className="font-mono">
                          {profile?.phoneNumber ? `+91 ${profile.phoneNumber}` : 'Mobile linked via Passbook'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Membership Details Pill */}
                  <div className="mt-3.5 pt-2.5 border-t border-white/15 flex items-center justify-between text-[11px] text-white/90">
                    <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1.5 rounded-xl border border-white/10 w-full justify-between">
                      <span className="font-medium flex items-center gap-1">
                        <KeyRound size={14} className="text-indigo-200" />
                        Member ID: <span className="font-bold text-white font-mono">#{profile?.id ? profile.id.slice(0, 7).toUpperCase() : 'SUBSCRIBER'}</span>
                      </span>
                      <span className="text-indigo-200 font-semibold">• {groups.length} Active Groups</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. 4-DIGIT LOGIN MPIN CARD (With tactile bubbles + form) */}
              <section className="bg-white rounded-2xl p-4 shadow-xs border border-[#E5E9F2]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#EEECFE] border border-[#2A1DB8]/20 flex items-center justify-center text-[#2A1DB8] shrink-0">
                      <KeyRound size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold text-[#151B26] leading-tight">Quick Login MPIN</h3>
                      <p className="text-[12px] text-[#636F85] mt-0.5 leading-snug">4-digit security PIN to log in with mobile</p>
                    </div>
                  </div>
                  {profile?.isDefaultPin || profile?.mpin === '1234' ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      Default 1234
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-[#2A1DB8] border border-indigo-200 shrink-0">
                      Secured
                    </span>
                  )}
                </div>

                {/* 4 Tactile Floating MPIN Bubbles (User-Preferred Design) */}
                <div className="my-4 py-1 flex items-center justify-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-[#F4F6FB] border border-[#E5E9F2] flex items-center justify-center shadow-xs">
                    <div className="w-3 h-3 rounded-full bg-[#2A1DB8]" />
                  </div>
                  <div className="w-11 h-11 rounded-full bg-[#F4F6FB] border border-[#E5E9F2] flex items-center justify-center shadow-xs">
                    <div className="w-3 h-3 rounded-full bg-[#2A1DB8]" />
                  </div>
                  <div className="w-11 h-11 rounded-full bg-[#F4F6FB] border border-[#E5E9F2] flex items-center justify-center shadow-xs">
                    <div className="w-3 h-3 rounded-full bg-[#2A1DB8]" />
                  </div>
                  <div className="w-11 h-11 rounded-full bg-[#F4F6FB] border border-[#E5E9F2] flex items-center justify-center shadow-xs">
                    <div className="w-3 h-3 rounded-full bg-[#2A1DB8]" />
                  </div>
                </div>

                {/* Change MPIN Action Buttons */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowMpinForm(!showMpinForm)}
                    className="flex-1 h-11 rounded-full bg-[#2A1DB8] hover:bg-[#1B0F8C] text-white font-semibold text-[13px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                  >
                    <RefreshCw size={15} />
                    <span>{showMpinForm ? 'Close Form' : 'Change MPIN'}</span>
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hello Manager, I forgot my 4-digit Passbook MPIN for ticket account (${profile?.fullName || 'Subscriber'}). Please assist with verification.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 h-11 rounded-full bg-[#F4F6FB] hover:bg-slate-100 border border-[#E5E9F2] text-[#636F85] hover:text-[#151B26] font-semibold text-[13px] flex items-center justify-center active:scale-[0.98] transition-all"
                  >
                    Forgot?
                  </a>
                </div>

                {/* Expandable Change PIN Form */}
                {showMpinForm && (
                  <div className="mt-4 pt-4 border-t border-[#E5E9F2] space-y-3 animate-in fade-in duration-150">
                    {pinSuccessMessage && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                        <CheckCircle2 size={16} className="shrink-0" />
                        <span>{pinSuccessMessage}</span>
                      </div>
                    )}

                    {pinErrorMessage && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{pinErrorMessage}</span>
                      </div>
                    )}

                    <form onSubmit={handleUpdatePinFromSettings} className="space-y-3">
                      {/* Current PIN */}
                      <div>
                        <label className="block text-[11px] font-semibold text-[#636F85] mb-1">
                          Current PIN {(!profile?.isDefaultPin && profile?.mpin !== '1234') ? '' : '(Default is 1234)'}
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPin ? 'text' : 'password'}
                            maxLength={6}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Enter current PIN"
                            value={currentPinInput}
                            onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border border-[#E2E8F0] bg-[#F8FAFC] text-[#151B26] placeholder:text-slate-400 transition-all outline-none focus:border-[#2A1DB8]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPin(!showCurrentPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#636F85] hover:text-[#151B26] cursor-pointer"
                          >
                            {showCurrentPin ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* New PIN */}
                      <div>
                        <label className="block text-[11px] font-semibold text-[#636F85] mb-1">
                          New 4-Digit PIN
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPin ? 'text' : 'password'}
                            maxLength={6}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Enter 4-digit PIN"
                            value={newPinInput}
                            onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border border-[#E2E8F0] bg-[#F8FAFC] text-[#151B26] placeholder:text-slate-400 transition-all outline-none focus:border-[#2A1DB8]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPin(!showNewPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#636F85] hover:text-[#151B26] cursor-pointer"
                          >
                            {showNewPin ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm PIN */}
                      <div>
                        <label className="block text-[11px] font-semibold text-[#636F85] mb-1">
                          Confirm New PIN
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPin ? 'text' : 'password'}
                            maxLength={6}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Re-enter new PIN"
                            value={confirmPinInput}
                            onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border border-[#E2E8F0] bg-[#F8FAFC] text-[#151B26] placeholder:text-slate-400 transition-all outline-none focus:border-[#2A1DB8]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPin(!showConfirmPin)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#636F85] hover:text-[#151B26] cursor-pointer"
                          >
                            {showConfirmPin ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSavingPin || !newPinInput || !confirmPinInput}
                        className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#2A1DB8] hover:bg-[#1B0F8C] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isSavingPin ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" /> Saving New PIN...
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={14} /> Update Security PIN
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </section>

              {/* 3. READING & DISPLAY PREFERENCES CARD (Accessibility Focus) */}
              <section className="bg-white rounded-2xl p-4 shadow-xs border border-[#E5E9F2] space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 border border-amber-200">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#151B26] leading-tight">Display &amp; Accessibility</h3>
                    <p className="text-[11px] text-[#636F85]">Comfortable reading for every member</p>
                  </div>
                </div>

                {/* Font Size Preference via FontSizeSwitcher */}
                <div className="pt-1">
                  <label className="block text-[12px] font-semibold text-[#151B26] mb-1.5 flex items-center justify-between">
                    <span>Text Scaling Size</span>
                    <span className="text-[11px] font-normal text-[#636F85]">Normal · Large · Huge</span>
                  </label>
                  <div className="p-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <FontSizeSwitcher />
                  </div>
                </div>

                {/* Theme Mode Preference */}
                <div className="pt-1 border-t border-[#E5E9F2] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold block text-[#151B26]">Interface Theme</span>
                    <span className="text-[10px] text-[#636F85]">
                      Currently: {theme === 'dark' ? '🌙 Cyber Fintech Dark' : '☀️ High-Contrast Light'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-slate-100 text-[#151B26] text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    {theme === 'dark' ? <Moon size={13} className="text-amber-500" /> : <Sun size={13} className="text-amber-500" />}
                    <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
                  </button>
                </div>
              </section>

              {/* 4. CHIT OFFICE & MANAGER SUPPORT CARD */}
              <section className="bg-white rounded-2xl p-4 shadow-xs border border-[#E5E9F2]">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-200">
                    <Smartphone size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-bold text-[#151B26] leading-tight">Chit Office &amp; Support</h3>
                    <p className="text-[12px] text-[#636F85] mt-0.5 leading-snug">
                      Have a question about your passbook or auction schedules?
                    </p>
                  </div>
                </div>

                {/* Action Buttons Grid */}
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  <a
                    href="tel:+914428120000"
                    className="h-11 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-slate-100 text-[#151B26] font-semibold text-[12px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                  >
                    <Smartphone size={15} className="text-[#2A1DB8]" />
                    <span>Call Office</span>
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hello Manager, I have a question regarding my chit passbook (${profile?.fullName || 'Subscriber'}).`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 hover:bg-[#25D366]/25 text-[#128C7E] font-semibold text-[12px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                  >
                    <span>💬 WhatsApp</span>
                  </a>
                </div>

                <div className="mt-2.5 text-[11px] text-[#636F85] flex items-center justify-center gap-1">
                  <Clock size={13} />
                  <span>Mon – Sat, 9:30 AM to 6:30 PM</span>
                </div>
              </section>

              {/* 5. STATUTORY TRUST & SIGN OUT SECTION */}
              <section className="space-y-3 pt-1">
                {/* Statutory Government Trust Badge */}
                <div className="bg-white border border-[#E5E9F2] shadow-xs rounded-xl p-3 flex items-start gap-2.5 text-[#636F85]">
                  <ShieldCheck size={20} className="text-[#2A1DB8] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#2A1DB8]">
                      Tamil Nadu Chit Funds Act, 1982 Registered
                    </h4>
                    <p className="text-[11px] text-[#636F85] leading-tight mt-0.5">
                      Digitally certified passbook records and legally binding registered chit batches.
                    </p>
                  </div>
                </div>

                {/* Log Out Button */}
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full h-11 rounded-xl bg-red-50 hover:bg-red-100 active:scale-[0.98] border border-red-200 text-red-600 font-bold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Log Out</span>
                </button>

                <div className="text-center pt-1 pb-2">
                  <p className="text-[10px] text-[#636F85]/80 font-mono">
                    Royal ChitPass Mobile v2.4 · 100% Zero-Loss Guaranteed
                  </p>
                </div>
              </section>
            </div>
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

      {/* 4.7. DEFAULT PIN (1234) REMINDER MODAL POPUP */}
      {showDefaultPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md border border-[#27264E] bg-[#1D1D41] text-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#FFBB38]/15 border border-[#FFBB38]/30 text-[#FFBB38] flex items-center justify-center shrink-0 shadow-inner">
                <Shield size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFBB38]/20 text-[#FFBB38] border border-[#FFBB38]/30 uppercase tracking-wider">
                    Security Recommendation
                  </span>
                </div>
                <h3 className="text-base font-black tracking-tight mt-1 text-white">Change Default PIN</h3>
                <p className="text-xs text-[#AEABD8] mt-1 leading-relaxed">
                  Your account is currently using the default PIN (<span className="font-mono font-bold text-[#FFBB38]">1234</span>). For your privacy and passbook protection, please set a private security PIN.
                </p>
              </div>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-[#E41414]/10 border border-[#E41414]/30 text-[#FF5555] text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePinFromModal} className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-[#AEABD8] mb-1">
                  New 4-6 Digit Security PIN
                </label>
                <div className="relative">
                  <input
                    type={modalShowNewPin ? 'text' : 'password'}
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Enter new PIN (e.g. 5829)"
                    value={modalNewPin}
                    onChange={(e) => setModalNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border border-[#27264E] bg-[#141332] text-white placeholder:text-[#AEABD8]/40 transition-all outline-none focus:border-[#6359E9]"
                  />
                  <button
                    type="button"
                    onClick={() => setModalShowNewPin(!modalShowNewPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AEABD8] hover:text-white"
                  >
                    {modalShowNewPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#AEABD8] mb-1">
                  Confirm New PIN
                </label>
                <div className="relative">
                  <input
                    type={modalShowConfirmPin ? 'text' : 'password'}
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Confirm new PIN"
                    value={modalConfirmPin}
                    onChange={(e) => setModalConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border border-[#27264E] bg-[#141332] text-white placeholder:text-[#AEABD8]/40 transition-all outline-none focus:border-[#6359E9]"
                  />
                  <button
                    type="button"
                    onClick={() => setModalShowConfirmPin(!modalShowConfirmPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AEABD8] hover:text-white"
                  >
                    {modalShowConfirmPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={modalIsSaving || !modalNewPin || !modalConfirmPin}
                className="w-full py-2.5 px-4 rounded-xl bg-[#6359E9] hover:bg-[#6F64FF] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {modalIsSaving ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Updating PIN...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} /> Set New PIN Now
                  </>
                )}
              </button>
            </form>

            {/* Actions for reminder dismissal */}
            <div className="pt-3 border-t border-[#27264E] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleDismissModalNever}
                className="text-[#AEABD8] hover:text-white text-[11px] underline underline-offset-2 transition-colors cursor-pointer"
              >
                Never remind again
              </button>

              <button
                type="button"
                onClick={handleDismissModalLater}
                className="px-3 py-1.5 rounded-xl font-semibold text-[11px] transition-colors cursor-pointer bg-[#141332] hover:bg-[#27264E] text-[#AEABD8] hover:text-white border border-[#27264E]"
              >
                Do it later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. TRANSACTION DETAIL POPUP MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-sm border border-[#27264E] bg-[#1D1D41] text-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#27264E]">
              <h3 className="text-sm font-bold flex items-center gap-1.5 text-white">
                <FileText size={15} className="text-[#64CFF6]" /> Receipt Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="text-xs text-[#AEABD8] hover:text-white p-1.5 rounded-lg hover:bg-[#141332] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#AEABD8]">Chit Group:</span>
                <span className="font-bold text-white">{selectedTx.groupName}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-[#AEABD8]">Paid Amount:</span>
                <span className="font-black text-[#02B15A] text-sm">₹{Number(selectedTx.amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#AEABD8]">Payment Mode:</span>
                <span className="uppercase font-mono font-semibold text-white">
                  {!selectedTx.walletType || selectedTx.walletType.toLowerCase().includes('cash') ? 'Cash in Hand' : 'Online Transfer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#AEABD8]">Date:</span>
                <span className="font-mono text-white">{new Date(selectedTx.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#AEABD8]">Status:</span>
                <span className="text-[#02B15A] font-bold uppercase">{selectedTx.status}</span>
              </div>
              {selectedTx.notes && (
                <div className="pt-2 border-t border-[#27264E] text-[11px] text-[#AEABD8]">
                  <span className="opacity-60 block mb-0.5">Notes:</span>
                  {selectedTx.notes}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedTx(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] bg-[#141332] hover:bg-[#27264E] text-white border border-[#27264E] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 6. INSTALLMENT PAYMENT INSTRUCTIONS MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm border border-[#E5E9F2] bg-white text-[#151B26] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto my-auto animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E9F2]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#2A1DB8] flex items-center justify-center text-white">
                  <Wallet size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#151B26]">Make Installment Payment</h3>
                  <span className="text-[10px] text-[#636F85]">Verified Collection Desk</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-xs text-[#636F85] hover:text-[#151B26] p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Selected Chit Due Snapshot */}
            {(() => {
              const activeGrp = groups[selectedCardIndex] || groups[0];
              const pInfo = activeGrp ? getGroupPaymentStatus(activeGrp, transactions, auctions) : null;
              const dueAmt = pInfo?.outstandingBalance ?? 10000;

              return (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#636F85]">Chit Group:</span>
                      <span className="font-bold text-[#151B26] truncate max-w-[180px]">{activeGrp?.groupName || 'Chit Group'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-[#636F85]">Ticket Number:</span>
                      <span className="font-bold text-[#2A1DB8]">#{activeGrp?.ticketNumber || 1}</span>
                    </div>
                    <div className="pt-2 border-t border-[#E2E8F0] flex justify-between items-baseline font-mono">
                      <span className="text-xs text-[#636F85]">Monthly Due:</span>
                      <span className="text-lg font-black text-[#151B26]">
                        ₹{dueAmt.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Payment Instructions */}
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs space-y-1.5">
                    <div className="font-bold text-[#2A1DB8] flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Official Payment Options
                    </div>
                    <p className="text-[11px] text-[#636F85] leading-relaxed">
                      You can pay via <strong>UPI (GPay / PhonePe / Paytm)</strong> to the Chit Fund treasury, or deposit cash at the office counter.
                    </p>
                  </div>

                  {/* WhatsApp Notify Button */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hello Chit Manager, I would like to pay my monthly installment of ₹${dueAmt.toLocaleString(
                        'en-IN'
                      )} for ${activeGrp?.groupName || 'Chit Group'} (Ticket #${activeGrp?.ticketNumber || 1}). Please share payment QR or confirm cash receipt.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <span>💬 Notify Manager on WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold transition-all bg-[#F4F6FB] hover:bg-slate-100 text-[#151B26] border border-[#E5E9F2] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 7. FIXED MOBILE BOTTOM NAVIGATION BAR (Screen 1 Royal ChitPass Active Pill Design) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[#E5E9F2] px-2 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {/* 1. Overview */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center justify-center min-w-[56px] h-12 px-3 rounded-full transition-all duration-200 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#EEECFE] text-[#2A1DB8] font-bold shadow-xs'
                : 'text-[#636F85] hover:text-[#151B26]'
            }`}
          >
            <Layers size={18} />
            <span className="text-[10px] mt-0.5">Overview</span>
          </button>

          {/* 2. My Chits */}
          <button
            type="button"
            onClick={() => setActiveTab('chits')}
            className={`flex flex-col items-center justify-center min-w-[56px] h-12 px-3 rounded-full transition-all duration-200 cursor-pointer ${
              activeTab === 'chits'
                ? 'bg-[#EEECFE] text-[#2A1DB8] font-bold shadow-xs'
                : 'text-[#636F85] hover:text-[#151B26]'
            }`}
          >
            <Wallet size={18} />
            <span className="text-[10px] mt-0.5">My Chits</span>
          </button>

          {/* 3. Live Arena */}
          <button
            type="button"
            onClick={() => setActiveTab('auctions')}
            className={`flex flex-col items-center justify-center min-w-[56px] h-12 px-3 rounded-full transition-all duration-200 cursor-pointer ${
              activeTab === 'auctions'
                ? 'bg-[#EEECFE] text-[#2A1DB8] font-bold shadow-xs'
                : 'text-[#636F85] hover:text-[#151B26]'
            }`}
          >
            <Gavel size={18} />
            <span className="text-[10px] mt-0.5">Live Arena</span>
          </button>

          {/* 4. Passbook */}
          <button
            type="button"
            onClick={() => setActiveTab('passbook')}
            className={`flex flex-col items-center justify-center min-w-[56px] h-12 px-3 rounded-full transition-all duration-200 cursor-pointer ${
              activeTab === 'passbook'
                ? 'bg-[#EEECFE] text-[#2A1DB8] font-bold shadow-xs'
                : 'text-[#636F85] hover:text-[#151B26]'
            }`}
          >
            <BookOpen size={18} />
            <span className="text-[10px] mt-0.5">Passbook</span>
          </button>

          {/* 5. Security / Settings */}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center min-w-[56px] h-12 px-3 rounded-full transition-all duration-200 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#EEECFE] text-[#2A1DB8] font-bold shadow-xs'
                : 'text-[#636F85] hover:text-[#151B26]'
            }`}
          >
            <ShieldCheck size={18} />
            <span className="text-[10px] mt-0.5">Security</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
