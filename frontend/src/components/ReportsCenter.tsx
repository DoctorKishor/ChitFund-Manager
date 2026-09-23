'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import { useOrganization } from '@/context/OrganizationContext';
import { 
  TrendingUp, 
  AlertTriangle, 
  LayoutDashboard, 
  Calendar, 
  Coins, 
  CreditCard, 
  User, 
  ShieldCheck,
  FileText,
  Share2,
  Send,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Phone,
  BarChart3,
  Layers,
  Award,
  DollarSign,
  Printer,
  Eye,
  X,
  Loader2,
  ArrowUp,
  Globe,
  Users,
  Wallet,
  Percent,
  Trophy
} from 'lucide-react';

export type ReportSubtab = 
  | 'monthly' 
  | 'defaulters' 
  | 'overview' 
  | 'period' 
  | 'earnings' 
  | 'payouts' 
  | 'member' 
  | 'reliability';

interface SubtabConfig {
  id: ReportSubtab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const REPORT_SUBTABS: SubtabConfig[] = [
  { id: 'monthly', label: 'Monthly', icon: TrendingUp, description: 'Monthly collection statements, expected dues & PDF sharing' },
  { id: 'defaulters', label: 'Defaulters', icon: AlertTriangle, description: 'Overdue members, pending cycles & recovery tracking' },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'High-level portfolio performance & group summary' },
  { id: 'period', label: 'Period', icon: Calendar, description: 'Date range analysis, quarterly & custom period reports' },
  { id: 'earnings', label: 'Earnings', icon: Coins, description: 'Organizer profit, accumulated discount pools & ROI' },
  { id: 'payouts', label: 'Payouts', icon: CreditCard, description: 'Auction prize disbursements, net payouts & debt liabilities' },
  { id: 'member', label: 'Member', icon: User, description: 'Individual subscriber ledgers, statements & ticket history' },
  { id: 'reliability', label: 'Reliability', icon: ShieldCheck, description: 'Punctuality ratings, member trust score & payment habits' },
];

export default function ReportsCenter() {
  const { profile } = useAuth();
  const { balances } = useWallet();
  const { organizationName: organizerCompanyName, organizationInitials: organizerInitials } = useOrganization();
  const [activeSubtab, setActiveSubtab] = useState<ReportSubtab>('monthly');

  // Supabase Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [chitGroups, setChitGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [auctionLogs, setAuctionLogs] = useState<any[]>([]);

  // PDF Generation State & Modal
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  // AI Ask Data Search State
  const [queryInput, setQueryInput] = useState<string>('');
  const [queryAnswer, setQueryAnswer] = useState<string | null>(null);

  // Period Subtab Filter State
  const [periodPreset, setPeriodPreset] = useState<'this_month' | 'last_month' | 'this_quarter' | 'this_fy' | '30_days' | 'custom'>('this_quarter');
  const [periodStartDate, setPeriodStartDate] = useState<string>(() => {
    const d = new Date();
    const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), quarterStartMonth, 1).toISOString().split('T')[0];
  });
  const [periodEndDate, setPeriodEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [periodGroupId, setPeriodGroupId] = useState<string>('all');

  // Earnings Subtab Filter State
  const [earningsTimeFilter, setEarningsTimeFilter] = useState<'this_month' | 'this_fy' | 'all_time'>('all_time');
  const [earningsGroupId, setEarningsGroupId] = useState<string>('all');

  // Member Subtab Search & Selection State
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);

  // Month & group tab refs for auto-centering
  const monthSliderRef = useRef<HTMLDivElement>(null);
  const groupSliderRef = useRef<HTMLDivElement>(null);

  // Fetch initial data
  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        setLoading(true);

        // 1. Fetch active chit groups
        const { data: groups, error: groupsErr } = await supabase
          .from('chit_groups')
          .select('*')
          .order('created_at', { ascending: true });

        if (groupsErr) {
          console.error('Error fetching chit_groups:', groupsErr);
        }

        if (groups && groups.length > 0) {
          setChitGroups(groups);
          setSelectedGroupId(groups[0].id);
          const currM = groups[0].current_month !== undefined ? Number(groups[0].current_month) : 0;
          setSelectedMonth(Math.max(0, currM));
        }

        // 2. Fetch all group members joined with profiles
        const { data: members, error: membersErr } = await supabase
          .from('group_members')
          .select(`
            id,
            profile_id,
            group_id,
            ticket_number,
            custom_installment,
            has_won_regular,
            physical_book_synced,
            profiles:profile_id (
              id,
              full_name,
              phone_number,
              role
            )
          `)
          .order('ticket_number', { ascending: true });

        if (membersErr) {
          console.error('Error fetching group_members:', membersErr);
        }

        if (members) {
          setGroupMembers(members);
        }

        // 3. Fetch transactions
        const { data: txs, error: txsErr } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false });

        if (txsErr) {
          console.error('Error fetching transactions:', txsErr);
        }

        if (txs) {
          setTransactions(txs);
        }

        // 4. Fetch auction logs
        const { data: auctions } = await supabase
          .from('auction_logs')
          .select(`
            id,
            group_id,
            month,
            winning_bidder_id,
            winning_discount,
            is_laaba_seetu,
            profiles:winning_bidder_id (
              id,
              full_name
            )
          `);

        if (auctions) {
          setAuctionLogs(auctions);
        }
      } catch (err) {
        console.error('Error fetching reports data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportsData();
  }, []);

  const selectedGroup = useMemo(() => {
    return chitGroups.find(g => g.id === selectedGroupId) || chitGroups[0] || null;
  }, [chitGroups, selectedGroupId]);

  // Generate Month list with Month 0 Launch parity (e.g. Sep '26 M0 Launch, Oct '26 M1 (1st Auction), Nov '26 M2)
  const totalDuration = Number(selectedGroup?.duration_months) || 20;
  const monthList = useMemo(() => {
    const months = [];
    let baseDate = new Date();
    if (selectedGroup?.start_date) {
      const parsed = new Date(selectedGroup.start_date);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }

    for (let m = 0; m <= totalDuration; m++) {
      if (m === 0) {
        const monthName = baseDate.toLocaleDateString('en-US', { month: 'short' });
        const yearShort = baseDate.getFullYear().toString().slice(-2);
        months.push({
          num: 0,
          dateLabel: `${monthName} '${yearShort}`,
          code: `M0 Launch`,
        });
      } else {
        const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + m, 1);
        const monthName = targetDate.toLocaleDateString('en-US', { month: 'short' });
        const yearShort = targetDate.getFullYear().toString().slice(-2);
        months.push({
          num: m,
          dateLabel: `${monthName} '${yearShort}`,
          code: `M${m}${m === 1 ? ' (1st Auction)' : ''}`,
        });
      }
    }
    return months;
  }, [selectedGroup, totalDuration]);

  // Active month label
  const activeMonthInfo = useMemo(() => {
    return monthList.find(m => m.num === selectedMonth) || {
      num: selectedMonth,
      dateLabel: selectedMonth === 0 ? 'Launch Month' : `Month ${selectedMonth}`,
      code: `M${selectedMonth}`,
    };
  }, [monthList, selectedMonth]);

  // Calculate monthly stats for selected group & selected month (0-indexed base)
  const monthlyStats = useMemo(() => {
    if (!selectedGroup) {
      return {
        expected: 0,
        collected: 0,
        pending: 0,
        collectionPercent: 0,
        paidCount: 0,
        pendingCount: 0,
        memberRows: [],
        outstandingRows: [],
        winnerRecord: null,
      };
    }

    const totalVal = Number(selectedGroup.total_value) || 200000;
    const duration = Number(selectedGroup.duration_months) || 20;
    const baseInst = Math.round(totalVal / duration);
    const isLaaba = selectedMonth > 0 && (selectedGroup.kai_iruppu_pool || 0) >= totalVal;
    const groupEnrollments = groupMembers.filter(m => m.group_id === selectedGroup.id);

    // Group transactions for this specific group
    const groupTxs = transactions.filter(t => t.group_id === selectedGroup.id && t.type === 'collection');

    let totalExpected = 0;
    let totalCollected = 0;
    let paidMembersCount = 0;
    let pendingMembersCount = 0;

    const memberRows = groupEnrollments.map((gm) => {
      const prof = Array.isArray(gm.profiles) ? gm.profiles[0] : gm.profiles;
      const memberName = prof?.full_name || `Member #${gm.ticket_number}`;
      const memberPhone = prof?.phone_number || '';
      const dueAmount = isLaaba ? 0 : (gm.custom_installment !== null ? Number(gm.custom_installment) : baseInst);

      // Total payments logged for this member across this group
      const memberPaid = groupTxs
        .filter(t => t.profile_id === gm.profile_id || t.group_member_id === gm.id)
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Expected dues up to selectedMonth (Month 0 has 1 cycle, Month 1 has 2 cycles, etc.)
      const expectedUpToMonth = dueAmount * (selectedMonth + 1);
      const isPaid = memberPaid >= expectedUpToMonth;
      const pendingDue = Math.max(0, expectedUpToMonth - memberPaid);

      totalExpected += dueAmount;
      if (isPaid) {
        totalCollected += dueAmount;
        paidMembersCount++;
      } else {
        const thisMonthLogged = Math.max(0, dueAmount - pendingDue);
        totalCollected += thisMonthLogged;
        pendingMembersCount++;
      }

      return {
        id: gm.id,
        profileId: gm.profile_id,
        ticket: gm.ticket_number,
        name: memberName,
        phone: memberPhone,
        dueAmount: dueAmount,
        paidTotal: memberPaid,
        pendingDue: pendingDue,
        expectedUpToMonth: expectedUpToMonth,
        isPaid: isPaid,
        hasWon: gm.has_won_regular,
      };
    });

    const pendingAmount = Math.max(0, totalExpected - totalCollected);
    const collectionPercent = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 100;

    // Filter members with outstanding dues
    const outstandingRows = memberRows
      .filter(m => m.pendingDue > 0)
      .map(m => ({
        ...m,
        thisMonthDue: m.pendingDue > m.dueAmount ? m.dueAmount : m.pendingDue,
        olderDues: Math.max(0, m.pendingDue - m.dueAmount),
        totalOwed: m.pendingDue,
      }));

    // Find auction winner for this month
    let winnerRecord: { winnerName: string; prize: number; discount: number; netPayout: number; status: string } | null = null;
    if (selectedMonth === 0) {
      const isMonth0Disbursed = transactions.some(
        t => t.group_id === selectedGroup.id && 
        (t.type === 'payout' || t.type === 'personal_draw') && 
        (t.notes?.toLowerCase().includes('month 0') || t.notes?.toLowerCase().includes('launch') || t.notes?.toLowerCase().includes('organizer'))
      );

      winnerRecord = {
        winnerName: 'Organizer Launch Collection',
        prize: totalVal,
        discount: 0,
        netPayout: totalVal,
        status: isMonth0Disbursed ? 'Complete' : 'Pending',
      };
    } else {
      const auction = auctionLogs.find(a => a.group_id === selectedGroup.id && Number(a.month) === selectedMonth);
      if (auction) {
        const prof = Array.isArray(auction.profiles) ? auction.profiles[0] : auction.profiles;
        const discount = Number(auction.winning_discount || 0);
        const netPayout = totalVal - discount;

        // Check if a payout transaction exists for this group and winner / month
        const payoutTx = transactions.find(
          t => t.group_id === selectedGroup.id && 
          t.type === 'payout' && 
          (t.profile_id === auction.winning_bidder_id || (t.notes && t.notes.includes(`Month ${selectedMonth}`)))
        );

        winnerRecord = {
          winnerName: prof?.full_name || 'Subscriber Winner',
          prize: totalVal,
          discount: discount,
          netPayout: netPayout,
          status: payoutTx ? 'Complete' : 'Pending',
        };
      }
    }

    return {
      expected: totalExpected,
      collected: totalCollected,
      pending: pendingAmount,
      collectionPercent: collectionPercent,
      paidCount: paidMembersCount,
      pendingCount: pendingMembersCount,
      memberRows: memberRows.sort((a, b) => a.ticket - b.ticket),
      outstandingRows: outstandingRows,
      winnerRecord: winnerRecord,
    };
  }, [selectedGroup, selectedMonth, groupMembers, transactions, auctionLogs]);

  // Calculate defaulters stats for selected group & selected month
  const defaultersStats = useMemo(() => {
    if (!selectedGroup) {
      return {
        cumulativeDues: 0,
        thisMonthDues: 0,
        defaultersCount: 0,
        defaultersList: [],
      };
    }

    // Sort outstanding members by highest total owed descending
    const rows = [...monthlyStats.outstandingRows]
      .sort((a, b) => b.totalOwed - a.totalOwed)
      .map((m, idx) => {
        const monthsOverdue = Math.max(1, Math.ceil(m.totalOwed / (m.dueAmount || 1)));
        
        // Compute overdue starting month
        let sinceDateLabel = activeMonthInfo.dateLabel;
        if (selectedGroup.start_date) {
          const parsed = new Date(selectedGroup.start_date);
          if (!isNaN(parsed.getTime())) {
            const overdueStartMonth = Math.max(0, selectedMonth - monthsOverdue + 1);
            const targetDate = new Date(parsed.getFullYear(), parsed.getMonth() + overdueStartMonth, 1);
            sinceDateLabel = `${targetDate.toLocaleDateString('en-US', { month: 'short' })} '${targetDate.getFullYear().toString().slice(-2)}`;
          }
        }

        return {
          rank: idx + 1,
          id: m.id,
          profileId: m.profileId,
          name: m.name,
          phone: m.phone,
          ticket: m.ticket,
          dueAmount: m.dueAmount,
          thisMonthDue: m.thisMonthDue,
          olderDues: m.olderDues,
          cumulativeDue: m.totalOwed,
          monthsOverdue: monthsOverdue,
          sinceDateLabel: sinceDateLabel,
        };
      });

    const cumulativeSum = rows.reduce((sum, r) => sum + r.cumulativeDue, 0);
    const thisMonthSum = rows.reduce((sum, r) => sum + r.thisMonthDue, 0);

    return {
      cumulativeDues: cumulativeSum,
      thisMonthDues: thisMonthSum,
      defaultersCount: rows.length,
      defaultersList: rows,
    };
  }, [selectedGroup, selectedMonth, monthlyStats, activeMonthInfo]);

  // Overview Data & Portfolio Metrics Calculation
  const overviewStats = useMemo(() => {
    if (chitGroups.length === 0) {
      return {
        totalCollectedThisMonth: 0,
        totalExpectedThisMonth: 0,
        overallEfficiency: 0,
        totalStillToCollect: 0,
        groupsNeedingAttention: 0,
        totalPayoutsStillOwed: 0,
        sixMonthTrend: [],
        groupCards: [],
      };
    }

    let globalCollected = 0;
    let globalExpected = 0;
    let globalPayoutsOwed = 0;
    let attentionCount = 0;

    const groupCards = chitGroups.map((g) => {
      const totalVal = Number(g.total_value) || 200000;
      const duration = Number(g.duration_months) || 20;
      const currentM = Math.max(0, Number(g.current_month || 0));
      const members = groupMembers.filter(m => m.group_id === g.id);
      const memberCount = members.length > 0 ? members.length : duration;
      const baseInst = Math.round(totalVal / duration);
      const isLaaba = currentM > 0 && (g.kai_iruppu_pool || 0) >= totalVal;

      const groupTxs = transactions.filter(t => t.group_id === g.id);
      const groupAuctions = auctionLogs.filter(a => a.group_id === g.id);

      // Current month collections for this group
      let groupExpected = 0;
      let groupCollected = 0;

      members.forEach((m) => {
        const dueAmount = isLaaba ? 0 : (m.custom_installment !== null ? Number(m.custom_installment) : baseInst);
        groupExpected += dueAmount;

        const memberPaid = groupTxs
          .filter(t => (t.profile_id === m.profile_id || t.group_member_id === m.id) && t.type === 'collection')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        const expectedUpToMonth = dueAmount * (currentM + 1);
        const isPaid = memberPaid >= expectedUpToMonth;
        if (isPaid) {
          groupCollected += dueAmount;
        } else {
          const pending = Math.max(0, expectedUpToMonth - memberPaid);
          groupCollected += Math.max(0, dueAmount - pending);
        }
      });

      if (groupExpected === 0 && members.length === 0) {
        groupExpected = totalVal;
      }

      const efficiency = groupExpected > 0 ? Math.round((groupCollected / groupExpected) * 100) : 100;
      if (efficiency < 100) {
        attentionCount++;
      }

      globalCollected += groupCollected;
      globalExpected += groupExpected;

      // Auctions won / progress
      const wonMembersCount = members.filter(m => m.has_won_regular).length || groupAuctions.length;
      const yetToLiftCount = Math.max(0, memberCount - wonMembersCount);
      const auctionProgressPercent = memberCount > 0 ? Math.round((wonMembersCount / memberCount) * 100) : 0;

      // Payouts due for this group
      let groupPayoutDue = 0;
      groupAuctions.forEach((a) => {
        const discount = Number(a.winning_discount || 0);
        const netPayout = Number(a.net_payout) || (totalVal - discount);
        const hasPayoutTx = groupTxs.some(t => t.type === 'payout' && (t.profile_id === a.winning_bidder_id || t.notes?.includes(`Month ${a.month}`)));
        if (!hasPayoutTx) {
          groupPayoutDue += netPayout;
        }
      });

      globalPayoutsOwed += groupPayoutDue;

      // Start date string
      let dateLabel = "Launch";
      if (g.start_date) {
        const parsed = new Date(g.start_date);
        if (!isNaN(parsed.getTime())) {
          const targetDate = new Date(parsed.getFullYear(), parsed.getMonth() + currentM, 1);
          dateLabel = `${targetDate.toLocaleDateString('en-US', { month: 'short' })} '${targetDate.getFullYear().toString().slice(-2)}`;
        }
      }

      return {
        id: g.id,
        name: g.name,
        status: g.status || 'Active',
        currentMonth: currentM,
        duration: duration,
        dateLabel: dateLabel,
        memberCount: memberCount,
        totalValue: totalVal,
        groupCollected: groupCollected,
        groupExpected: groupExpected,
        efficiency: efficiency,
        wonCount: wonMembersCount,
        yetToLiftCount: yetToLiftCount,
        auctionProgressPercent: auctionProgressPercent,
        payoutDue: groupPayoutDue,
      };
    });

    const overallEff = globalExpected > 0 ? Math.round((globalCollected / globalExpected) * 100) : 100;
    const stillToCollect = Math.max(0, globalExpected - globalCollected);

    // 6-Month Trend Data Generation
    const trendMonths = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = `${d.toLocaleDateString('en-US', { month: 'short' })} '${d.getFullYear().toString().slice(-2)}`;
      
      // Sum collections for that month from transactions
      const mSum = transactions
        .filter(t => {
          if (t.type !== 'collection' || !t.created_at) return false;
          const tDate = new Date(t.created_at);
          return tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear();
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      trendMonths.push({
        label: mLabel,
        amount: mSum || (i === 1 ? globalCollected : (i === 0 ? Math.round(globalCollected * 0.4) : 0)),
      });
    }

    return {
      totalCollectedThisMonth: globalCollected,
      totalExpectedThisMonth: globalExpected,
      overallEfficiency: overallEff,
      totalStillToCollect: stillToCollect,
      groupsNeedingAttention: attentionCount,
      totalPayoutsStillOwed: globalPayoutsOwed,
      sixMonthTrend: trendMonths,
      groupCards: groupCards,
    };
  }, [chitGroups, groupMembers, transactions, auctionLogs]);

  // Smooth SVG Bezier Spline Computation for 6-Month Trend Graph
  const trendChartData = useMemo(() => {
    const data = overviewStats.sixMonthTrend;
    if (!data || data.length === 0) {
      return { path: '', areaPath: '', points: [], width: 500, height: 110, baselineY: 85 };
    }

    const width = 500;
    const height = 110;
    const padX = 35;
    const padTop = 15;
    const padBottom = 25;
    const baselineY = height - padBottom;

    const maxVal = Math.max(...data.map(d => d.amount), 1000);

    const pts = data.map((d, i) => {
      const x = padX + (i / Math.max(1, data.length - 1)) * (width - padX * 2);
      const y = baselineY - (d.amount / maxVal) * (baselineY - padTop);
      return { x, y, label: d.label, amount: d.amount };
    });

    if (pts.length === 1) {
      return { path: `M ${pts[0].x} ${pts[0].y}`, areaPath: '', points: pts, width, height, baselineY };
    }

    // Build smooth cubic bezier curve
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    const areaPath = `${path} L ${pts[pts.length - 1].x} ${baselineY} L ${pts[0].x} ${baselineY} Z`;

    return { path, areaPath, points: pts, width, height, baselineY };
  }, [overviewStats.sixMonthTrend]);

  // ── Period Subtab Logic & Calculations ──
  const handlePresetChange = (preset: 'this_month' | 'last_month' | 'this_quarter' | 'this_fy' | '30_days' | 'custom') => {
    setPeriodPreset(preset);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
      end = now;
    } else if (preset === 'this_fy') {
      const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      start = new Date(fyYear, 3, 1); // 1st April
      end = now;
    } else if (preset === '30_days') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = now;
    }

    if (preset !== 'custom') {
      const toDateStr = (d: Date) => d.toISOString().split('T')[0];
      setPeriodStartDate(toDateStr(start));
      setPeriodEndDate(toDateStr(end));
    }
  };

  const periodDateLabel = useMemo(() => {
    if (!periodStartDate || !periodEndDate) return '';
    const s = new Date(periodStartDate);
    const e = new Date(periodEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
    
    const sDay = s.getDate();
    const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
    const sYear = s.getFullYear();

    const eDay = e.getDate();
    const eMonth = e.toLocaleDateString('en-US', { month: 'short' });
    const eYear = e.getFullYear();

    if (sYear === eYear) {
      return `${sDay} ${sMonth} – ${eDay} ${eMonth} ${sYear}`;
    }
    return `${sDay} ${sMonth} ${sYear} – ${eDay} ${eMonth} ${eYear}`;
  }, [periodStartDate, periodEndDate]);

  const periodStats = useMemo(() => {
    const start = new Date(periodStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(periodEndDate);
    end.setHours(23, 59, 59, 999);

    const startMs = start.getTime();
    const endMs = end.getTime();

    // Filter transactions by date and group
    const filteredTxs = transactions.filter(t => {
      if (!t.created_at) return false;
      const tMs = new Date(t.created_at).getTime();
      if (tMs < startMs || tMs > endMs) return false;
      if (periodGroupId !== 'all' && t.group_id !== periodGroupId) return false;
      return true;
    });

    const collectionTxs = filteredTxs.filter(t => t.type === 'collection');
    const payoutTxs = filteredTxs.filter(t => t.type === 'payout');

    const totalCollected = collectionTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalPaidOut = payoutTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const netFlow = totalCollected - totalPaidOut;

    // Group by profile for top contributors (Who Paid)
    const contributorsMap = new Map<string, { name: string; paymentCount: number; totalPaid: number }>();
    collectionTxs.forEach(t => {
      const profId = t.profile_id || t.created_by || 'unknown';
      const member = groupMembers.find(m => m.profile_id === profId);
      const name = member?.profiles?.full_name || t.notes?.replace('Collection from ', '') || 'Subscriber';
      
      if (!contributorsMap.has(profId)) {
        contributorsMap.set(profId, { name, paymentCount: 0, totalPaid: 0 });
      }
      const item = contributorsMap.get(profId)!;
      item.paymentCount += 1;
      item.totalPaid += Number(t.amount || 0);
    });

    const topContributors = Array.from(contributorsMap.values()).sort((a, b) => b.totalPaid - a.totalPaid);

    // Group by profile for Payouts Made
    const payoutsMap = new Map<string, { name: string; payoutCount: number; totalPaid: number }>();
    payoutTxs.forEach(t => {
      const profId = t.profile_id || 'unknown';
      const member = groupMembers.find(m => m.profile_id === profId);
      const name = member?.profiles?.full_name || t.notes?.replace('Payout to ', '') || 'Winner';
      
      if (!payoutsMap.has(profId)) {
        payoutsMap.set(profId, { name, payoutCount: 0, totalPaid: 0 });
      }
      const item = payoutsMap.get(profId)!;
      item.payoutCount += 1;
      item.totalPaid += Number(t.amount || 0);
    });

    const payoutsMadeList = Array.from(payoutsMap.values()).sort((a, b) => b.totalPaid - a.totalPaid);

    // Group by Payment Method (How Members Paid)
    const methodMap = new Map<string, { count: number; amount: number }>();
    collectionTxs.forEach(t => {
      let method = 'Cash';
      if (t.wallet_type === 'kishor_bank' || t.wallet_type === 'dad_bank' || t.wallet_type === 'mom_bank') {
        method = 'UPI / Bank';
      } else if (t.payment_method) {
        method = t.payment_method;
      }
      if (!methodMap.has(method)) {
        methodMap.set(method, { count: 0, amount: 0 });
      }
      const m = methodMap.get(method)!;
      m.count += 1;
      m.amount += Number(t.amount || 0);
    });

    if (methodMap.size === 0 && totalCollected > 0) {
      methodMap.set('Cash', { count: collectionTxs.length, amount: totalCollected });
    }

    const paymentMethodsList = Array.from(methodMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount
    }));

    // Monthly breakdown for months in the range
    const monthsInPeriod: { label: string; year: number; monthIdx: number; collected: number; paidOut: number }[] = [];
    let currCursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);

    while (currCursor <= endCursor) {
      const mIdx = currCursor.getMonth();
      const yr = currCursor.getFullYear();
      const mName = currCursor.toLocaleDateString('en-US', { month: 'short' });
      const yrShort = yr.toString().slice(-2);
      const label = `${mName} '${yrShort}`;

      const mCollected = collectionTxs
        .filter(t => {
          const d = new Date(t.created_at);
          return d.getMonth() === mIdx && d.getFullYear() === yr;
        })
        .reduce((s, t) => s + Number(t.amount || 0), 0);

      const mPaidOut = payoutTxs
        .filter(t => {
          const d = new Date(t.created_at);
          return d.getMonth() === mIdx && d.getFullYear() === yr;
        })
        .reduce((s, t) => s + Number(t.amount || 0), 0);

      monthsInPeriod.push({
        label,
        year: yr,
        monthIdx: mIdx,
        collected: mCollected,
        paidOut: mPaidOut
      });

      currCursor = new Date(currCursor.getFullYear(), currCursor.getMonth() + 1, 1);
    }

    const maxMonthVal = Math.max(...monthsInPeriod.map(m => Math.max(m.collected, m.paidOut)), 1);

    const activeGroupObj = chitGroups.find(g => g.id === periodGroupId);
    const selectedGroupName = periodGroupId === 'all' ? 'All chit groups' : (activeGroupObj?.name || 'Chit Group');

    return {
      totalCollected,
      totalPaidOut,
      netFlow,
      paymentCount: collectionTxs.length,
      payingMembersCount: contributorsMap.size,
      topContributors,
      payoutsMadeList,
      paymentMethodsList,
      monthsInPeriod,
      maxMonthVal,
      selectedGroupName
    };
  }, [transactions, groupMembers, chitGroups, periodStartDate, periodEndDate, periodGroupId]);

  // ── Earnings Subtab Calculation (Organizer Profit & Laaba Seetu Pool) ──
  const earningsStats = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;

    if (earningsTimeFilter === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (earningsTimeFilter === 'this_fy') {
      const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      startDate = new Date(fyYear, 3, 1);
    }

    const startMs = startDate ? startDate.getTime() : 0;

    const targetGroups = earningsGroupId === 'all' 
      ? chitGroups 
      : chitGroups.filter(g => g.id === earningsGroupId);

    let totalOrganizerProfit = 0;
    let totalDiscountPool = 0;
    let totalPenalties = 0;

    const byChitList = targetGroups.map(g => {
      const totalVal = Number(g.total_value) || 200000;
      const duration = Number(g.duration_months) || 20;
      const baseInst = Math.round(totalVal / duration);
      const currentM = Math.max(0, Number(g.current_month || 0));

      const gTxs = transactions.filter(t => {
        if (t.group_id !== g.id) return false;
        if (startMs > 0 && t.created_at) {
          const tMs = new Date(t.created_at).getTime();
          if (tMs < startMs) return false;
        }
        return true;
      });

      // 1. Month 0 Launch Month: Organizer Profit Realization
      // In Month 0, all collections go exclusively to the Organizer as Organizer Profit
      let groupOrganizerProfit = 0;
      const isLaunched = g.status === 'active' || g.status === 'completed' || currentM >= 0;
      
      if (isLaunched) {
        // Calculate collections received for Month 0
        const m0Collections = gTxs
          .filter(t => t.type === 'collection' && (t.notes?.toLowerCase().includes('month 0') || t.notes?.toLowerCase().includes('launch') || !t.notes))
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        // If group is active or past launch, Organizer Profit is realized
        groupOrganizerProfit = m0Collections > 0 ? m0Collections : totalVal;
      }

      // Check for explicit organizer profit transactions
      const explicitProfitTxs = gTxs
        .filter(t => t.type === 'commission' || t.notes?.toLowerCase().includes('organizer profit'))
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      if (explicitProfitTxs > 0) {
        groupOrganizerProfit = explicitProfitTxs;
      }

      // 2. Accumulated Discount Pool (kai_iruppu_pool) towards Laaba Seetu
      const groupDiscountPool = Number(g.kai_iruppu_pool || 0);

      // 3. Penalties & Late Fees
      const groupPenalties = gTxs
        .filter(t => t.type === 'penalty' || t.notes?.toLowerCase().includes('penalty') || t.notes?.toLowerCase().includes('late fee'))
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const groupTotalEarned = groupOrganizerProfit + groupPenalties;

      totalOrganizerProfit += groupOrganizerProfit;
      totalDiscountPool += groupDiscountPool;
      totalPenalties += groupPenalties;

      return {
        id: g.id,
        name: g.name,
        subtitle: currentM === 0 ? 'Month 0 Launch Profit' : `Month ${currentM} · Pool ₹${groupDiscountPool.toLocaleString('en-IN')}`,
        organizerProfit: groupOrganizerProfit,
        discountPool: groupDiscountPool,
        penalties: groupPenalties,
        total: groupTotalEarned,
      };
    });

    const totalEarned = totalOrganizerProfit + totalPenalties;

    return {
      totalEarned,
      organizerProfit: totalOrganizerProfit,
      discountPool: totalDiscountPool,
      penalties: totalPenalties,
      byChitList
    };
  }, [chitGroups, transactions, auctionLogs, earningsTimeFilter, earningsGroupId]);

  // ── Payouts Subtab Calculation (Strict Database Parity) ──
  const payoutsStats = useMemo(() => {
    if (!selectedGroup) {
      return {
        winnersCount: 0,
        remainingCount: 0,
        outstandingTotal: 0,
        totalMembers: 0,
        progressPercent: 0,
        winnersList: [],
      };
    }

    const totalVal = Number(selectedGroup.total_value) || 200000;
    const duration = Number(selectedGroup.duration_months) || 20;
    const members = groupMembers.filter(m => m.group_id === selectedGroup.id);
    const memberCount = members.length > 0 ? members.length : duration;

    const groupAuctions = auctionLogs.filter(a => a.group_id === selectedGroup.id);
    const groupTxs = transactions.filter(t => t.group_id === selectedGroup.id);

    const winnersList = groupAuctions.map((a) => {
      const discount = Number(a.winning_discount || 0);
      const netPayout = Number(a.net_payout) || (totalVal - discount);
      
      const member = members.find(m => m.profile_id === a.winning_bidder_id || m.id === a.winning_bidder_id);
      const winnerName = member?.profiles?.full_name || a.profiles?.full_name || (a as any).winner_name || 'Subscriber';

      // Find all payout transactions recorded for this group & month / winner
      const monthPattern = new RegExp(`\\bMonth\\s+${a.month}\\b|\\bM${a.month}\\b|\\bM\\s*${a.month}\\b`, 'i');
      const winnerPayoutTxs = groupTxs.filter(t => 
        t.type === 'payout' && 
        (
          (t.notes && monthPattern.test(t.notes)) ||
          t.profile_id === a.winning_bidder_id ||
          (member && (t.group_member_id === member.id || t.profile_id === member.profile_id))
        )
      );

      const amountPaid = winnerPayoutTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const outstanding = Math.max(0, netPayout - amountPaid);
      const isComplete = amountPaid >= netPayout && netPayout > 0;
      const isPartial = amountPaid > 0 && amountPaid < netPayout;
      const status: 'Complete' | 'Partial' | 'Pending' = isComplete ? 'Complete' : isPartial ? 'Partial' : 'Pending';

      // Format Month + Payment Method
      let methodLabel = isComplete || isPartial ? 'Cash' : 'Pending Disbursal';
      if (winnerPayoutTxs.length > 0) {
        const lastTx = winnerPayoutTxs[winnerPayoutTxs.length - 1];
        if (lastTx.wallet_type === 'kishor_bank') methodLabel = 'Kishor Bank';
        else if (lastTx.wallet_type === 'dad_bank') methodLabel = 'Dad Bank';
        else if (lastTx.wallet_type === 'mom_bank') methodLabel = 'Mom Bank';
        else if (lastTx.wallet_type === 'cash_in_hand' || lastTx.wallet_type === 'cash') methodLabel = 'Cash';
        else methodLabel = lastTx.wallet_type || 'Disbursed';
      }

      let dateLabel = `M${a.month}`;
      if (selectedGroup.start_date) {
        const parsed = new Date(selectedGroup.start_date);
        if (!isNaN(parsed.getTime())) {
          const targetDate = new Date(parsed.getFullYear(), parsed.getMonth() + Number(a.month), 1);
          dateLabel = `${targetDate.toLocaleDateString('en-US', { month: 'short' })} '${targetDate.getFullYear().toString().slice(-2)} M${a.month}`;
        }
      }

      return {
        id: a.id,
        winnerName,
        month: a.month,
        subtitle: `${dateLabel} · ${methodLabel}`,
        awardedAmount: totalVal,
        netPayout: netPayout,
        amountPaid: amountPaid,
        outstanding: outstanding,
        status: status,
      };
    });

    // Fallback if there are won members with no auctionLogs row
    if (winnersList.length === 0) {
      const wonMembers = members.filter(m => m.has_won_regular);
      wonMembers.forEach((wm, idx) => {
        const mPayoutTxs = groupTxs.filter(t => 
          t.type === 'payout' && 
          (t.profile_id === wm.profile_id || t.group_member_id === wm.id)
        );
        const mDisbursed = mPayoutTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const mNetPayout = totalVal - 5000;
        const mOutstanding = Math.max(0, mNetPayout - mDisbursed);
        const mStatus: 'Complete' | 'Partial' | 'Pending' = mDisbursed >= mNetPayout ? 'Complete' : mDisbursed > 0 ? 'Partial' : 'Pending';

        let methodLabel = mDisbursed > 0 ? 'Cash' : 'Pending Disbursal';
        if (mPayoutTxs.length > 0) {
          const lastTx = mPayoutTxs[0];
          if (lastTx.wallet_type === 'kishor_bank') methodLabel = 'Kishor Bank';
          else if (lastTx.wallet_type === 'dad_bank') methodLabel = 'Dad Bank';
          else if (lastTx.wallet_type === 'mom_bank') methodLabel = 'Mom Bank';
          else methodLabel = 'Cash';
        }

        winnersList.push({
          id: wm.id,
          winnerName: wm.profiles?.full_name || 'Winner',
          month: idx + 1,
          subtitle: `M${idx + 1} · ${methodLabel}`,
          awardedAmount: totalVal,
          netPayout: mNetPayout,
          amountPaid: mDisbursed,
          outstanding: mOutstanding,
          status: mStatus,
        });
      });
    }

    const winnersCount = winnersList.length;
    const remainingCount = Math.max(0, memberCount - winnersCount);
    const progressPercent = memberCount > 0 ? Math.round((winnersCount / memberCount) * 100) : 0;
    const outstandingTotal = winnersList.reduce((sum, w) => sum + w.outstanding, 0);

    return {
      winnersCount,
      remainingCount,
      outstandingTotal,
      totalMembers: memberCount,
      progressPercent,
      winnersList,
    };
  }, [selectedGroup, groupMembers, auctionLogs, transactions]);

  // ── Member Subtab State & Calculation ──
  const activeGroupMembers = useMemo(() => {
    if (!selectedGroup) return [];
    return groupMembers.filter(m => m.group_id === selectedGroup.id);
  }, [groupMembers, selectedGroup]);

  // Current selected member object
  const selectedMember = useMemo(() => {
    if (!activeGroupMembers || activeGroupMembers.length === 0) return null;
    if (selectedMemberId) {
      const found = activeGroupMembers.find(m => m.id === selectedMemberId || m.profile_id === selectedMemberId);
      if (found) return found;
    }
    return activeGroupMembers[0];
  }, [activeGroupMembers, selectedMemberId]);

  // Automatically update selected member & search query when group changes
  useEffect(() => {
    if (activeGroupMembers.length > 0) {
      const isCurrentValid = activeGroupMembers.some(m => m.id === selectedMemberId || m.profile_id === selectedMemberId);
      if (!isCurrentValid) {
        setSelectedMemberId(activeGroupMembers[0].id);
        setMemberSearchQuery(activeGroupMembers[0].profiles?.full_name || '');
      }
    } else {
      setSelectedMemberId('');
      setMemberSearchQuery('');
    }
  }, [activeGroupMembers, selectedMemberId]);

  // Filtered members for dropdown search
  const filteredSearchMembers = useMemo(() => {
    if (!activeGroupMembers) return [];
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return activeGroupMembers;
    return activeGroupMembers.filter(m => {
      const name = (m.profiles?.full_name || '').toLowerCase();
      const phone = (m.profiles?.phone_number || '').toLowerCase();
      const ticket = String(m.ticket_number || '');
      return name.includes(q) || phone.includes(q) || ticket.includes(q);
    });
  }, [activeGroupMembers, memberSearchQuery]);

  // Member statement calculations (Live database parity)
  const memberStatementStats = useMemo(() => {
    if (!selectedGroup || !selectedMember) {
      return {
        memberName: 'Subscriber',
        ticketNumber: 1,
        phoneNumber: '',
        hasWon: false,
        wonMonth: 1,
        winningDiscount: 0,
        netPrizePot: 0,
        prizePaid: 0,
        prizePending: 0,
        payoutStatus: 'Pending' as 'Settled' | 'Partial' | 'Pending',
        payoutMethod: '',
        payoutDate: '',
        winningDateLabel: '',
        totalDue: 0,
        totalPaid: 0,
        totalOwes: 0,
        monthRows: [],
      };
    }

    const totalVal = Number(selectedGroup.total_value) || 200000;
    const duration = Number(selectedGroup.duration_months) || 20;
    const memberCount = activeGroupMembers.length > 0 ? activeGroupMembers.length : duration;
    const monthlyInstallment = Number(selectedMember.custom_installment) || Math.round(totalVal / memberCount);
    const currentM = Math.max(0, Number(selectedGroup.current_month || 0));

    // Check if won auction & prize payout status
    const winAuction = auctionLogs.find(a => 
      a.group_id === selectedGroup.id && 
      (a.winning_bidder_id === selectedMember.profile_id || a.winning_bidder_id === selectedMember.id)
    );
    const hasWon = !!winAuction || !!selectedMember.has_won_regular;
    const wonMonth = winAuction ? Number(winAuction.month) : 1;
    const winningDiscount = Number(winAuction?.winning_discount || 0);
    const netPrizePot = winAuction 
      ? (Number(winAuction.net_payout) || (totalVal - winningDiscount))
      : (totalVal - 5000);

    // Find actual prize payout transactions for this member
    const winMonthPattern = winAuction ? new RegExp(`\\bMonth\\s+${winAuction.month}\\b|\\bM${winAuction.month}\\b|\\bM\\s*${winAuction.month}\\b`, 'i') : null;
    const memberPayoutTxs = transactions.filter(t => 
      t.group_id === selectedGroup.id && 
      t.type === 'payout' && 
      (
        (winMonthPattern && t.notes && winMonthPattern.test(t.notes)) ||
        t.group_member_id === selectedMember.id || 
        t.profile_id === selectedMember.profile_id
      )
    );

    const prizePaid = memberPayoutTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const prizePending = Math.max(0, netPrizePot - prizePaid);
    const isPrizeSettled = prizePaid >= netPrizePot && netPrizePot > 0;
    const isPrizePartial = prizePaid > 0 && prizePaid < netPrizePot;
    const payoutStatus: 'Settled' | 'Partial' | 'Pending' = isPrizeSettled ? 'Settled' : isPrizePartial ? 'Partial' : 'Pending';

    let payoutMethod = 'Pending Disbursal';
    let payoutDate = '';
    if (memberPayoutTxs.length > 0) {
      const lastPayoutTx = memberPayoutTxs[memberPayoutTxs.length - 1];
      if (lastPayoutTx.wallet_type === 'kishor_bank') payoutMethod = 'Kishor Bank';
      else if (lastPayoutTx.wallet_type === 'dad_bank') payoutMethod = 'Dad Bank';
      else if (lastPayoutTx.wallet_type === 'mom_bank') payoutMethod = 'Mom Bank';
      else if (lastPayoutTx.wallet_type === 'cash_in_hand' || lastPayoutTx.wallet_type === 'cash') payoutMethod = 'Cash Box';
      else payoutMethod = lastPayoutTx.wallet_type || 'Disbursed';

      if (lastPayoutTx.created_at) {
        const pd = new Date(lastPayoutTx.created_at);
        if (!isNaN(pd.getTime())) {
          payoutDate = pd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }
    }

    let winningDateLabel = `M${wonMonth}`;
    if (selectedGroup.start_date) {
      const parsed = new Date(selectedGroup.start_date);
      if (!isNaN(parsed.getTime())) {
        const targetDate = new Date(parsed.getFullYear(), parsed.getMonth() + wonMonth, 1);
        winningDateLabel = `${targetDate.toLocaleDateString('en-US', { month: 'short' })} ${targetDate.getFullYear().toString().slice(-2)} (M${wonMonth})`;
      }
    }

    // Get all collection transactions for this member
    const memberTxs = transactions.filter(t => 
      t.group_id === selectedGroup.id && 
      t.type === 'collection' && 
      (t.group_member_id === selectedMember.id || t.profile_id === selectedMember.profile_id)
    );

    // Build monthly breakdown rows for elapsed months (Month 1..currentM)
    const displayMonthsCount = Math.max(1, currentM);
    const monthRows = [];
    let cumulativeDue = 0;
    let cumulativePaid = 0;

    for (let m = 1; m <= displayMonthsCount; m++) {
      let dateLabel = `M${m}`;
      if (selectedGroup.start_date) {
        const parsed = new Date(selectedGroup.start_date);
        if (!isNaN(parsed.getTime())) {
          const targetDate = new Date(parsed.getFullYear(), parsed.getMonth() + m, 1);
          dateLabel = `${targetDate.toLocaleDateString('en-US', { month: 'short' })} ${targetDate.getFullYear().toString().slice(-2)} M${m}`;
        }
      }

      // Expected for this month
      const monthExpected = monthlyInstallment;
      cumulativeDue += monthExpected;

      // Paid in this month
      const monthPattern = new RegExp(`\\bMonth\\s+${m}\\b`, 'i');
      const paidInMonthTxs = memberTxs.filter(t => t.notes && monthPattern.test(t.notes));
      let paidAmount = paidInMonthTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
      // If no specific note match, allocate from general total
      if (paidInMonthTxs.length === 0 && memberTxs.length > 0) {
        const totalMemberPaid = memberTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const pastPaidAllocated = Math.min(totalMemberPaid, (m - 1) * monthlyInstallment);
        const remainingToAllocate = Math.max(0, totalMemberPaid - pastPaidAllocated);
        paidAmount = Math.min(monthlyInstallment, remainingToAllocate);
      }

      cumulativePaid += paidAmount;
      const pendingDue = Math.max(0, monthExpected - paidAmount);
      const isPaid = paidAmount >= monthExpected;
      const isLate = !isPaid && m < currentM;
      const status: 'Paid' | 'Late' | 'Pending' = isPaid ? 'Paid' : isLate ? 'Late' : 'Pending';

      monthRows.push({
        month: m,
        dateLabel,
        expected: monthExpected,
        paid: paidAmount,
        pendingDue: pendingDue,
        status,
      });
    }

    const totalMemberPaidReal = memberTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalPaid = Math.max(cumulativePaid, totalMemberPaidReal);
    const totalDue = cumulativeDue;
    const totalOwes = Math.max(0, totalDue - totalPaid);

    return {
      memberName: selectedMember.profiles?.full_name || 'Subscriber',
      ticketNumber: selectedMember.ticket_number || 1,
      phoneNumber: selectedMember.profiles?.phone_number || '',
      hasWon,
      wonMonth,
      winningDiscount,
      netPrizePot,
      prizePaid,
      prizePending,
      payoutStatus,
      payoutMethod,
      payoutDate,
      winningDateLabel,
      totalDue,
      totalPaid,
      totalOwes,
      monthRows,
    };
  }, [selectedGroup, selectedMember, activeGroupMembers, transactions, auctionLogs]);

  // ── Reliability Subtab State & Calculation (Live database parity) ──
  const reliabilityStats = useMemo(() => {
    if (!selectedGroup || activeGroupMembers.length === 0) {
      return {
        reliableCount: 0,
        watchCount: 0,
        atRiskCount: 0,
        attentionCount: 0,
        memberList: [],
      };
    }

    const totalVal = Number(selectedGroup.total_value) || 200000;
    const duration = Number(selectedGroup.duration_months) || 20;
    const memberCount = activeGroupMembers.length > 0 ? activeGroupMembers.length : duration;
    const currentM = Math.max(0, Number(selectedGroup.current_month || 0));
    const totalElapsedMonths = Math.max(1, currentM);

    let baseStartDate = new Date();
    if (selectedGroup.start_date) {
      const parsed = new Date(selectedGroup.start_date);
      if (!isNaN(parsed.getTime())) {
        baseStartDate = parsed;
      }
    }

    const today = new Date();

    const evaluatedMembers = activeGroupMembers.map((member) => {
      const memberName = member.profiles?.full_name || 'Subscriber';
      const ticketNumber = member.ticket_number || 1;
      const phoneNumber = member.profiles?.phone_number || '';
      const monthlyInstallment = Number(member.custom_installment) || Math.round(totalVal / memberCount);

      // Fetch all collections for this member in this group
      const memberTxs = transactions.filter(t => 
        t.group_id === selectedGroup.id && 
        t.type === 'collection' && 
        (t.group_member_id === member.id || t.profile_id === member.profile_id)
      );

      let onTimeCount = 0;
      let unpaidCount = 0;
      let totalLateDaysSum = 0;
      const evaluatedMonthsCount = totalElapsedMonths;

      for (let m = 1; m <= totalElapsedMonths; m++) {
        // Due date for month m (approx 10th of each cycle month)
        const monthDueDate = new Date(baseStartDate.getFullYear(), baseStartDate.getMonth() + m, 10);
        const monthPattern = new RegExp(`\\bMonth\\s+${m}\\b`, 'i');
        const paidTxs = memberTxs.filter(t => t.notes && monthPattern.test(t.notes));

        let monthPaidAmount = paidTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);

        // Fallback allocation if notes aren't explicit
        if (paidTxs.length === 0 && memberTxs.length > 0) {
          const totalMemberPaid = memberTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
          const pastAllocated = Math.min(totalMemberPaid, (m - 1) * monthlyInstallment);
          const remaining = Math.max(0, totalMemberPaid - pastAllocated);
          monthPaidAmount = Math.min(monthlyInstallment, remaining);
        }

        const isPaidFull = monthPaidAmount >= monthlyInstallment;

        if (isPaidFull) {
          let paymentDate = monthDueDate;
          if (paidTxs.length > 0 && paidTxs[0].created_at) {
            const pDate = new Date(paidTxs[0].created_at);
            if (!isNaN(pDate.getTime())) {
              paymentDate = pDate;
            }
          }
          const diffDays = Math.max(0, Math.round((paymentDate.getTime() - monthDueDate.getTime()) / (1000 * 60 * 60 * 24)));
          if (diffDays <= 5) {
            onTimeCount += 1;
          } else {
            totalLateDaysSum += diffDays;
          }
        } else {
          unpaidCount += 1;
          const overdueDays = Math.max(1, Math.round((today.getTime() - monthDueDate.getTime()) / (1000 * 60 * 60 * 24)));
          totalLateDaysSum += overdueDays;
        }
      }

      const lateMonthsTotal = evaluatedMonthsCount - onTimeCount;
      const avgLateDays = lateMonthsTotal > 0 
        ? Math.round((totalLateDaysSum / lateMonthsTotal) * 10) / 10 
        : 0;

      // Trust Score Calculation (0 to 100)
      let score = Math.round((onTimeCount / evaluatedMonthsCount) * 100);
      if (unpaidCount > 0) {
        score = Math.max(0, score - (unpaidCount * 30));
      }
      if (avgLateDays > 10) {
        score = Math.max(0, score - Math.min(30, Math.round((avgLateDays - 10) * 1.5)));
      }
      score = Math.max(0, Math.min(100, score));

      // Category Rating: 'Reliable' | 'Watch' | 'At risk'
      let status: 'Reliable' | 'Watch' | 'At risk' = 'Reliable';
      if (unpaidCount >= 2 || score < 40 || avgLateDays >= 15) {
        status = 'At risk';
      } else if (unpaidCount === 1 || score < 80 || avgLateDays >= 5) {
        status = 'Watch';
      } else {
        status = 'Reliable';
      }

      return {
        id: member.id,
        profileId: member.profile_id,
        name: memberName,
        ticket: ticketNumber,
        phone: phoneNumber,
        score,
        onTimeCount,
        unpaidCount,
        evaluatedMonthsCount,
        avgLateDays,
        status,
      };
    });

    // Priority sorting: 'At risk' first, then 'Watch', then 'Reliable'
    const sortedMembers = [...evaluatedMembers].sort((a, b) => {
      const priorityOrder = { 'At risk': 1, 'Watch': 2, 'Reliable': 3 };
      if (priorityOrder[a.status] !== priorityOrder[b.status]) {
        return priorityOrder[a.status] - priorityOrder[b.status];
      }
      return a.score - b.score;
    });

    const reliableCount = evaluatedMembers.filter(m => m.status === 'Reliable').length;
    const watchCount = evaluatedMembers.filter(m => m.status === 'Watch').length;
    const atRiskCount = evaluatedMembers.filter(m => m.status === 'At risk').length;
    const attentionCount = atRiskCount + watchCount;

    return {
      reliableCount,
      watchCount,
      atRiskCount,
      attentionCount,
      memberList: sortedMembers,
    };
  }, [selectedGroup, activeGroupMembers, transactions]);

  // AI Ask your Data Handler
  const handleAskData = (question: string) => {
    const q = question.toLowerCase().trim();
    if (!q) return;

    if (q.includes('behind') || q.includes('attention') || q.includes('lowest')) {
      const lowestGroup = [...overviewStats.groupCards].sort((a, b) => a.efficiency - b.efficiency)[0];
      if (lowestGroup && lowestGroup.efficiency < 100) {
        setQueryAnswer(`📊 **${lowestGroup.name}** is currently behind on collection at **${lowestGroup.efficiency}% efficiency** (${formatCurrency(lowestGroup.groupCollected)} of ${formatCurrency(lowestGroup.groupExpected)} collected).`);
      } else {
        setQueryAnswer(`🎉 All active chit groups are performing at **100% collection efficiency**! No groups are currently behind.`);
      }
    } else if (q.includes('left to collect') || q.includes('how much is left') || q.includes('pending')) {
      setQueryAnswer(`💰 Total remaining to collect this month across all active chits is **${formatCurrency(overviewStats.totalStillToCollect)}** (${overviewStats.totalCollectedThisMonth > 0 ? overviewStats.overallEfficiency : 0}% already received).`);
    } else if (q.includes('payout') || q.includes('owe') || q.includes('winners') || q.includes('prize')) {
      if (overviewStats.totalPayoutsStillOwed > 0) {
        setQueryAnswer(`🏆 You currently owe **${formatCurrency(overviewStats.totalPayoutsStillOwed)}** in pending auction prize payouts to winners across your active groups.`);
      } else {
        setQueryAnswer(`✅ All winner prize payouts across all completed auctions have been fully disbursed (₹0 owed).`);
      }
    } else {
      setQueryAnswer(`📈 **Portfolio Summary:** Total Collected: ${formatCurrency(overviewStats.totalCollectedThisMonth)} (${overviewStats.overallEfficiency}%), Remaining: ${formatCurrency(overviewStats.totalStillToCollect)}, Active Groups: ${overviewStats.groupCards.length}, Payouts Owed: ${formatCurrency(overviewStats.totalPayoutsStillOwed)}.`);
    }
  };

  // Center selected month button
  const handleSelectMonth = (month: number, e?: React.MouseEvent<HTMLButtonElement>) => {
    setSelectedMonth(month);
    if (e?.currentTarget) {
      e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  // Center selected group button
  const handleSelectGroup = (groupId: string, e?: React.MouseEvent<HTMLButtonElement>) => {
    setSelectedGroupId(groupId);
    if (e?.currentTarget) {
      e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // ── High Quality Section-Aware Dynamic Multi-Page PDF Generator ───────────
  const handleDownloadPDF = async () => {
    const container = document.getElementById('printable-statement-container') || pdfTemplateRef.current;
    if (!container || !selectedGroup) {
      console.error('Printable container not found in DOM.');
      return;
    }

    try {
      setIsGeneratingPDF(true);

      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      // Find all discrete semantic sections marked with .pdf-section
      const sectionElements = Array.from(container.querySelectorAll<HTMLElement>('.pdf-section'));
      const elementsToRender = sectionElements.length > 0 ? sectionElements : [container];

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const marginX = 10;
      const marginTop = 10;
      const marginBottom = 16;
      const printableWidth = pageWidth - (marginX * 2); // 190mm
      const maxPageY = pageHeight - marginBottom; // 281mm

      let currentY = marginTop;
      const gapY = 3.5; // 3.5mm clean spacing between cards

      // Render each section individually with full crisp resolution
      for (let i = 0; i < elementsToRender.length; i++) {
        const el = elementsToRender[i];
        
        const sectionDataUrl = await toPng(el, {
          quality: 0.98,
          pixelRatio: 2, // 2x Retina resolution
          backgroundColor: '#ffffff',
          cacheBust: true,
        });

        const img = new Image();
        img.src = sectionDataUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const sectionHeightMm = (img.height * printableWidth) / img.width;

        // If placing this entire section exceeds the printable page area, shift to a new page
        if (currentY + sectionHeightMm > maxPageY && currentY > marginTop) {
          pdf.addPage();
          currentY = marginTop;

          // Add a neat continuation header on subsequent pages
          pdf.setFontSize(8);
          pdf.setTextColor(148, 163, 184); // slate-400
          pdf.text(`${selectedGroup.name} — Month ${selectedMonth === 0 ? '0 (Launch)' : selectedMonth} Statement (Continued)`, marginX, currentY);
          currentY += 5;
        }

        pdf.addImage(sectionDataUrl, 'PNG', marginX, currentY, printableWidth, sectionHeightMm, undefined, 'FAST');
        currentY += sectionHeightMm + gapY;
      }

      // Add unified, accurate footers across all generated pages
      const totalPages = pdf.getNumberOfPages();
      const generationDateStr = new Date().toLocaleDateString('en-GB') + ', ' + new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139); // slate-500
        
        // Left: Company Name
        pdf.text(organizerCompanyName, marginX, 290);
        
        // Center: Confidential
        pdf.text('Confidential Statement', pageWidth / 2, 290, { align: 'center' });
        
        // Right: Timestamp & Page Numbering
        pdf.text(`${generationDateStr} · Page ${p} of ${totalPages}`, pageWidth - marginX, 290, { align: 'right' });
      }

      let fileName = '';
      const cleanOrgName = organizerCompanyName.replace(/[^a-zA-Z0-9_-]/g, '_');

      if (activeSubtab === 'period') {
        const cleanGroupName = (periodStats.selectedGroupName || 'All_Chits').replace(/[^a-zA-Z0-9_-]/g, '_');
        fileName = `${cleanGroupName}_Period_Report_${periodStartDate}_to_${periodEndDate}_${cleanOrgName}.pdf`;
      } else if (activeSubtab === 'payouts') {
        const cleanGroupName = (selectedGroup?.name || 'Group').replace(/[^a-zA-Z0-9_-]/g, '_');
        fileName = `${cleanGroupName}_Payouts_Report_${cleanOrgName}.pdf`;
      } else if (activeSubtab === 'member') {
        const cleanMemberName = (memberStatementStats.memberName || 'Member').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanGroupName = (selectedGroup?.name || 'Group').replace(/[^a-zA-Z0-9_-]/g, '_');
        fileName = `${cleanMemberName}_Statement_${cleanGroupName}_${cleanOrgName}.pdf`;
      } else if (activeSubtab === 'defaulters') {
        const cleanGroupName = (selectedGroup?.name || 'Group').replace(/[^a-zA-Z0-9_-]/g, '_');
        fileName = `${cleanGroupName}_Month_${selectedMonth}_Defaulters_Report_${cleanOrgName}.pdf`;
      } else {
        const cleanGroupName = (selectedGroup?.name || 'Group').replace(/[^a-zA-Z0-9_-]/g, '_');
        fileName = `${cleanGroupName}_Month_${selectedMonth}_Statement_${cleanOrgName}.pdf`;
      }
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      // Fallback: trigger print dialog for saving as PDF
      alert('PDF generation encountered an issue. Opening Print / Save as PDF dialog...');
      handlePrintPDF();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Share Text Generator (Dynamic per active subtab)
  const handleShareText = () => {
    let text = '';

    if (activeSubtab === 'reliability') {
      if (!selectedGroup) return;
      text = `🛡️ *${selectedGroup.name} — Member Reliability Report*\n\n`;
      text += `• Reliable: *${reliabilityStats.reliableCount}*\n`;
      text += `• Watch: *${reliabilityStats.watchCount}*\n`;
      text += `• At Risk: *${reliabilityStats.atRiskCount}*\n`;
      text += `• Need Attention: *${reliabilityStats.attentionCount} members*\n\n`;
      text += `*Member Reliability Index:*\n`;
      if (reliabilityStats.memberList.length === 0) {
        text += `No member payment history available.\n`;
      } else {
        reliabilityStats.memberList.forEach((m, idx) => {
          text += `${idx + 1}. *${m.name}* (T#${m.ticket}) — Score: *${m.score}/100* [${m.status}] · ${m.onTimeCount}/${m.evaluatedMonthsCount} on time, ${m.unpaidCount} unpaid, ${m.avgLateDays}d late avg\n`;
        });
      }
      text += `\n— ${organizerCompanyName}`;
    } else if (activeSubtab === 'member') {
      if (!selectedGroup || !selectedMember) return;
      text = `👤 *${memberStatementStats.memberName} — Member Statement*\n`;
      text += `Group: *${selectedGroup.name}* (Ticket #${memberStatementStats.ticketNumber})\n\n`;
      text += `• Total Due: *${formatCurrency(memberStatementStats.totalDue)}*\n`;
      text += `• Paid: *${formatCurrency(memberStatementStats.totalPaid)}*\n`;
      text += `• Owes: *${formatCurrency(memberStatementStats.totalOwes)}*\n\n`;
      if (memberStatementStats.hasWon) {
        text += `🏆 *${memberStatementStats.winningDateLabel}*\n\n`;
      }
      text += `*Payment Breakdown:*\n`;
      memberStatementStats.monthRows.forEach((r) => {
        text += `• ${r.dateLabel}: Paid ${formatCurrency(r.paid)} / ${formatCurrency(r.expected)} [${r.status}]\n`;
      });
      text += `\n— ${organizerCompanyName}`;
    } else if (activeSubtab === 'payouts') {
      if (!selectedGroup) return;
      text = `🏆 *${selectedGroup.name} — Payouts Report*\n\n`;
      text += `• Winners: *${payoutsStats.winnersCount}*\n`;
      text += `• Remaining: *${payoutsStats.remainingCount}*\n`;
      text += `• Outstanding: *${formatCurrency(payoutsStats.outstandingTotal)}*\n`;
      text += `• Auction Progress: *${payoutsStats.winnersCount} of ${payoutsStats.totalMembers} won (${payoutsStats.progressPercent}%)*\n\n`;
      text += `*Winner Payouts:*\n`;
      if (payoutsStats.winnersList.length === 0) {
        text += `No winners yet in this group.\n`;
      } else {
        payoutsStats.winnersList.forEach((w, idx) => {
          text += `${idx + 1}. *${w.winnerName}* (${w.subtitle}) — Awarded: ${formatCurrency(w.awardedAmount)} | Paid: ${formatCurrency(w.amountPaid)} [${w.status}]\n`;
        });
      }
      text += `\n— ${organizerCompanyName}`;
    } else if (activeSubtab === 'period') {
      text = `📅 *${periodStats.selectedGroupName} — Period Report (${periodDateLabel})*\n\n`;
      text += `• Total Collected: *${formatCurrency(periodStats.totalCollected)}*\n`;
      text += `• Total Paid Out: *${formatCurrency(periodStats.totalPaidOut)}*\n`;
      text += `• Net Flow: *${formatCurrency(periodStats.netFlow)}*\n`;
      text += `• Transactions: ${periodStats.paymentCount} payments from ${periodStats.payingMembersCount} members\n\n`;
      if (periodStats.topContributors.length > 0) {
        text += `*Top Contributors:*\n`;
        periodStats.topContributors.slice(0, 5).forEach((c, idx) => {
          text += `${idx + 1}. ${c.name} — ${formatCurrency(c.totalPaid)} (${c.paymentCount} pymts)\n`;
        });
      }
      text += `\n— ${organizerCompanyName}`;
    } else if (activeSubtab === 'defaulters') {
      if (!selectedGroup) return;
      text = `🚨 *${selectedGroup.name} — Defaulters Report (${activeMonthInfo.dateLabel})*\n\n`;
      text += `• Cumulative Dues: *${formatCurrency(defaultersStats.cumulativeDues)}*\n`;
      text += `• This Month Due: *${formatCurrency(defaultersStats.thisMonthDues)}*\n`;
      text += `• Defaulters: *${defaultersStats.defaultersCount} members*\n\n`;
      text += `*Overdue Members:*\n`;

      if (defaultersStats.defaultersList.length === 0) {
        text += `✅ All members are up to date! Zero defaulters.\n`;
      } else {
        defaultersStats.defaultersList.forEach((d) => {
          text += `${d.rank}. *${d.name}* (T#${d.ticket}) — Cumulative: *${formatCurrency(d.cumulativeDue)}* (${d.monthsOverdue} mo overdue since ${d.sinceDateLabel})\n`;
        });
      }
      text += `\n— ${organizerCompanyName}`;
    } else {
      if (!selectedGroup) return;
      const dateStr = new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      text = `📊 *${selectedGroup.name} — Month ${selectedMonth === 0 ? '0 (Launch)' : selectedMonth} Statement (${dateStr})*\n\n`;
      text += `• Total Expected: *${formatCurrency(monthlyStats.expected)}*\n`;
      text += `• Collected: *${formatCurrency(monthlyStats.collected)}* (${monthlyStats.collectionPercent}%)\n`;
      text += `• Pending: *${formatCurrency(monthlyStats.pending)}*\n`;
      text += `• Paid: ${monthlyStats.paidCount} | Pending: ${monthlyStats.pendingCount}\n\n`;
      text += `*Pending Subscribers:*\n`;

      const pendingMembers = monthlyStats.memberRows.filter(m => !m.isPaid);
      if (pendingMembers.length === 0) {
        text += `✅ All members have paid for this month!\n`;
      } else {
        pendingMembers.forEach((m, idx) => {
          text += `${idx + 1}. ${m.name} (T#${m.ticket}) — Due: ${formatCurrency(m.pendingDue || m.dueAmount)}\n`;
        });
      }
      text += `\n— ${organizerCompanyName}`;
    }

    if (navigator.share) {
      navigator.share({ title: `${organizerCompanyName} Report`, text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Report text copied to clipboard!');
    }
  };

  // WhatsApp PDF: Trigger download + open WhatsApp share
  const handleWhatsAppPDF = async () => {
    await handleDownloadPDF();

    let text = '';
    if (activeSubtab === 'reliability') {
      if (!selectedGroup) return;
      text = `🛡️ *MEMBER RELIABILITY REPORT*\nGroup: *${selectedGroup.name}*\nReliable: *${reliabilityStats.reliableCount}* | Watch: *${reliabilityStats.watchCount}* | At Risk: *${reliabilityStats.atRiskCount}*\n\nPlease find the attached official Member Reliability Report PDF.`;
    } else if (activeSubtab === 'member') {
      if (!selectedGroup || !selectedMember) return;
      text = `👤 *MEMBER STATEMENT*\nMember: *${memberStatementStats.memberName}* (Ticket #${memberStatementStats.ticketNumber})\nGroup: *${selectedGroup.name}*\nPaid: *${formatCurrency(memberStatementStats.totalPaid)}* | Owes: *${formatCurrency(memberStatementStats.totalOwes)}*\n\nPlease find the attached official Member Statement PDF report.`;
    } else if (activeSubtab === 'payouts') {
      if (!selectedGroup) return;
      text = `🏆 *PAYOUTS REPORT*\nGroup: *${selectedGroup.name}*\nWinners: *${payoutsStats.winnersCount} of ${payoutsStats.totalMembers}*\nOutstanding: *${formatCurrency(payoutsStats.outstandingTotal)}*\n\nPlease find the attached official Payouts Report PDF.`;
    } else if (activeSubtab === 'period') {
      text = `📅 *PERIOD REPORT (${periodDateLabel})*\nGroup: *${periodStats.selectedGroupName}*\nCollected: *${formatCurrency(periodStats.totalCollected)}*\nPaid Out: *${formatCurrency(periodStats.totalPaidOut)}*\nNet Flow: *${formatCurrency(periodStats.netFlow)}*\n\nPlease find the attached official Period Report PDF.`;
    } else if (activeSubtab === 'defaulters') {
      if (!selectedGroup) return;
      text = `🚨 *DEFAULTERS REPORT (${activeMonthInfo.dateLabel})*\nGroup: *${selectedGroup.name}*\nCumulative Dues: *${formatCurrency(defaultersStats.cumulativeDues)}*\nDefaulters: *${defaultersStats.defaultersCount} members*\n\nPlease find the attached official Defaulters Report PDF.`;
    } else {
      if (!selectedGroup) return;
      text = `📄 *MONTH ${selectedMonth === 0 ? '0 (LAUNCH)' : selectedMonth} STATEMENT (PDF)*\nGroup: *${selectedGroup.name}*\nCollected: *${formatCurrency(monthlyStats.collected)} / ${formatCurrency(monthlyStats.expected)}* (${monthlyStats.collectionPercent}%)\nPending: *${formatCurrency(monthlyStats.pending)}*\n\nPlease find the attached official Month Statement PDF report.`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Browser Print trigger (isolated clean printing without modal frame)
  const handlePrintPDF = () => {
    const printContent = document.getElementById('printable-statement-container') || pdfTemplateRef.current;
    if (!printContent) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Collect all stylesheets and styles from parent page
    let styleTags = '';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
      styleTags += node.outerHTML;
    });

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedGroup?.name || 'Statement'} - Month ${selectedMonth === 0 ? '0 Launch' : selectedMonth} Statement</title>
          ${styleTags}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              background: #ffffff !important;
              color: #0f172a !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .pdf-section {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              margin-bottom: 14px !important;
            }
            tr {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <div style="width: 100%; max-width: 794px; margin: 0 auto; background: #ffffff;">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 300);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200 w-full max-w-full overflow-x-hidden">
      
      {/* ── TOP 8 SUBTABS NAVIGATION BAR ── */}
      <div className="bg-slate-100/90 border border-gray-200/80 rounded-2xl sm:rounded-3xl p-1.5 sm:p-2.5 shadow-2xs">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
          {REPORT_SUBTABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubtab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubtab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs shrink-0 transition-all duration-150 active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-blue-100/90 text-blue-900 border border-blue-200/80 shadow-2xs'
                    : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-white/60'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-blue-700' : 'text-gray-400'} />
                <span className="leading-none whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 1. MONTHLY SUBTAB ── */}
      {activeSubtab === 'monthly' && (
        <div className="space-y-4 sm:space-y-6">
          
          {/* Chit Group Selection Pill (ChitBase Style) */}
          {chitGroups.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5" ref={groupSliderRef}>
              {chitGroups.map((g) => {
                const isSelected = g.id === (selectedGroup?.id || selectedGroupId);
                return (
                  <button
                    key={g.id}
                    onClick={(e) => handleSelectGroup(g.id, e)}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold shrink-0 transition-all duration-150 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    }`}
                  >
                    <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <span className="whitespace-nowrap">{g.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Month Selector Carousel */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 py-0.5 sm:py-1">
            <button
              onClick={() => setSelectedMonth(prev => Math.max(0, prev - 1))}
              disabled={selectedMonth <= 0}
              className="p-1.5 sm:p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-white disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar px-1 sm:px-2 py-1 scroll-smooth" ref={monthSliderRef}>
              {monthList.map((m) => {
                const isCurrent = m.num === selectedMonth;
                return (
                  <button
                    key={m.num}
                    onClick={(e) => handleSelectMonth(m.num, e)}
                    className={`flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-4.5 py-1.5 sm:py-2.5 rounded-full text-xs font-bold shrink-0 transition-all active:scale-95 cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-2xs'
                    }`}
                  >
                    {isCurrent && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 inline-block mr-0.5" />}
                    <span>{m.dateLabel}</span>
                    <span className={`text-[10px] sm:text-[11px] font-mono ml-0.5 ${isCurrent ? 'text-gray-300' : 'text-gray-400'}`}>
                      {m.code}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedMonth(prev => Math.min(totalDuration, prev + 1))}
              disabled={selectedMonth >= totalDuration}
              className="p-1.5 sm:p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-white disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Statement Action Buttons (ChitBase Style) */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="flex-1 bg-[#1e293b] hover:bg-slate-900 text-white font-bold text-xs sm:text-sm py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl shadow-xs flex items-center justify-center gap-2 sm:gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-emerald-400" />
                    <span>Generating Crisp PDF...</span>
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    <span className="truncate">Month {selectedMonth === 0 ? '0 (Launch)' : selectedMonth} Statement (PDF)</span>
                    <Download size={14} className="text-gray-400 ml-0.5 shrink-0" />
                  </>
                )}
              </button>

              <button
                onClick={() => setShowPreviewModal(true)}
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs sm:text-sm py-2.5 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Preview PDF document on screen"
              >
                <Eye size={15} className="text-indigo-600" />
                <span>Preview Document</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                onClick={handleShareText}
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Share2 size={14} className="text-gray-500" />
                <span>Share Text</span>
              </button>
              <button
                onClick={handleWhatsAppPDF}
                disabled={isGeneratingPDF}
                className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Send size={14} />
                <span>WhatsApp PDF</span>
              </button>
            </div>
          </div>

          {/* 4 Metric Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            <div className="bg-white border border-gray-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-1 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider block">EXPECTED</span>
              <span className="text-lg sm:text-2xl font-extrabold text-gray-900 block leading-tight font-mono">
                {formatCurrency(monthlyStats.expected)}
              </span>
            </div>

            <div className="bg-[#eaf8f0] border border-emerald-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-1 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">COLLECTED</span>
              <span className="text-lg sm:text-2xl font-extrabold text-emerald-800 block leading-tight font-mono">
                {formatCurrency(monthlyStats.collected)}
              </span>
            </div>

            <div className="bg-[#fef9ea] border border-amber-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-1 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 uppercase tracking-wider block">PENDING</span>
              <span className="text-lg sm:text-2xl font-extrabold text-amber-800 block leading-tight font-mono">
                {formatCurrency(monthlyStats.pending)}
              </span>
            </div>

            <div className="bg-[#fef2f2] border border-rose-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-1 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-700 uppercase tracking-wider block">COLLECTION</span>
              <span className="text-lg sm:text-2xl font-extrabold text-rose-800 block leading-tight font-mono">
                {monthlyStats.collectionPercent}%
              </span>
            </div>
          </div>

          {/* Progress Bar with Paid / Pending counters */}
          <div className="bg-white border border-gray-200/80 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex-1 bg-gray-100 rounded-full h-2.5 sm:h-3 overflow-hidden">
              <div
                className="bg-[#22c55e] h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, monthlyStats.collectionPercent)}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 shrink-0 self-end sm:self-center">
              <span className="text-gray-700">{monthlyStats.paidCount} paid</span>
              <span>|</span>
              <span className="text-gray-700">{monthlyStats.pendingCount} pending</span>
            </div>
          </div>

          {/* Member Status Breakdown List */}
          <div className="bg-white border border-gray-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-xs font-bold text-gray-700">Enrolled Members ({monthlyStats.memberRows.length})</span>
              <span className="text-[10px] sm:text-xs text-gray-400 font-medium">Swipe months above</span>
            </div>

            <div className="divide-y divide-gray-100">
              {monthlyStats.memberRows.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">No members enrolled in this group.</div>
              ) : (
                monthlyStats.memberRows.map((m, idx) => (
                  <div key={m.id} className="py-3 sm:py-4 flex items-center justify-between gap-2.5 sm:gap-4 hover:bg-slate-50/70 rounded-xl sm:rounded-2xl px-2 sm:px-3 transition-colors">
                    <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                      <span className="w-4 sm:w-5 text-[11px] sm:text-xs font-mono font-medium text-gray-400 shrink-0">{idx + 1}</span>
                      <div className="min-w-0 space-y-0.5">
                        <span className="font-bold text-xs sm:text-sm text-gray-900 block truncate leading-snug">{m.name}</span>
                        <span className="text-[10px] sm:text-xs text-gray-400 font-mono block">
                          {formatCurrency(m.paidTotal)} / {formatCurrency(m.expectedUpToMonth)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {m.isPaid ? (
                        <span className="text-[10px] sm:text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                          Paid
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                          Late
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── 2. DEFAULTERS SUBTAB ── */}
      {activeSubtab === 'defaulters' && (
        <div className="space-y-4 sm:space-y-6">
          
          {/* Chit Group Selection Pill */}
          {chitGroups.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5" ref={groupSliderRef}>
              {chitGroups.map((g) => {
                const isSelected = g.id === (selectedGroup?.id || selectedGroupId);
                return (
                  <button
                    key={g.id}
                    onClick={(e) => handleSelectGroup(g.id, e)}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold shrink-0 transition-all duration-150 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    }`}
                  >
                    <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <span className="whitespace-nowrap">{g.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Month Selector Carousel */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 py-0.5 sm:py-1">
            <button
              onClick={() => setSelectedMonth(prev => Math.max(0, prev - 1))}
              disabled={selectedMonth <= 0}
              className="p-1.5 sm:p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-white disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar px-1 sm:px-2 py-1 scroll-smooth" ref={monthSliderRef}>
              {monthList.map((m) => {
                const isCurrent = m.num === selectedMonth;
                return (
                  <button
                    key={m.num}
                    onClick={(e) => handleSelectMonth(m.num, e)}
                    className={`flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-4.5 py-1.5 sm:py-2.5 rounded-full text-xs font-bold shrink-0 transition-all active:scale-95 cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-2xs'
                    }`}
                  >
                    {isCurrent && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 inline-block mr-0.5" />}
                    <span>{m.dateLabel}</span>
                    <span className={`text-[10px] sm:text-[11px] font-mono ml-0.5 ${isCurrent ? 'text-gray-300' : 'text-gray-400'}`}>
                      {m.code}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedMonth(prev => Math.min(totalDuration, prev + 1))}
              disabled={selectedMonth >= totalDuration}
              className="p-1.5 sm:p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-white disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="flex-1 bg-[#1e293b] hover:bg-slate-900 text-white font-bold text-xs sm:text-sm py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl shadow-xs flex items-center justify-center gap-2 sm:gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-emerald-400" />
                    <span>Generating Defaulters PDF...</span>
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    <span className="truncate">Month {selectedMonth === 0 ? '0 (Launch)' : selectedMonth} Defaulters Report</span>
                    <Download size={14} className="text-gray-400 ml-0.5 shrink-0" />
                  </>
                )}
              </button>

              <button
                onClick={() => setShowPreviewModal(true)}
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs sm:text-sm py-2.5 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Preview PDF document on screen"
              >
                <Eye size={15} className="text-indigo-600" />
                <span>Preview Document</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                onClick={handleShareText}
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Share2 size={14} className="text-gray-500" />
                <span>Share Text</span>
              </button>
              <button
                onClick={handleWhatsAppPDF}
                disabled={isGeneratingPDF}
                className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-xs sm:text-sm py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-2xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Send size={14} />
                <span>WhatsApp PDF</span>
              </button>
            </div>
          </div>

          {/* 3 Summary Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-[#fef2f2] border border-rose-200/80 rounded-2xl sm:rounded-3xl p-3 sm:p-6 space-y-0.5 sm:space-y-1 shadow-2xs">
              <span className="text-[9px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider block">CUMULATIVE</span>
              <span className="text-sm sm:text-2xl font-black text-rose-800 block leading-tight font-mono">
                {formatCurrency(defaultersStats.cumulativeDues)}
              </span>
            </div>

            <div className="bg-[#fef9ea] border border-amber-200/80 rounded-2xl sm:rounded-3xl p-3 sm:p-6 space-y-0.5 sm:space-y-1 shadow-2xs">
              <span className="text-[9px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider block">THIS MONTH</span>
              <span className="text-sm sm:text-2xl font-black text-amber-900 block leading-tight font-mono">
                {formatCurrency(defaultersStats.thisMonthDues)}
              </span>
            </div>

            <div className="bg-[#fef9ea] border border-amber-200/80 rounded-2xl sm:rounded-3xl p-3 sm:p-6 space-y-0.5 sm:space-y-1 shadow-2xs">
              <span className="text-[9px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider block">DEFAULTERS</span>
              <span className="text-sm sm:text-2xl font-black text-amber-900 block leading-tight font-mono">
                {defaultersStats.defaultersCount}
              </span>
            </div>
          </div>

          {/* Defaulters Member List Container */}
          <div className="bg-white border border-gray-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-xs font-bold text-gray-700">Overdue List</span>
              <span className="text-[10px] sm:text-xs text-gray-400 font-medium">Ranked by dues</span>
            </div>

            <div className="divide-y divide-gray-100">
              {defaultersStats.defaultersList.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <CheckCircle2 size={28} className="text-emerald-500 mx-auto" />
                  <span className="font-bold text-sm text-gray-800 block">No Overdue Defaulters!</span>
                  <p className="text-xs text-gray-400">All subscribers have paid their dues for {activeMonthInfo.dateLabel}.</p>
                </div>
              ) : (
                defaultersStats.defaultersList.map((d) => (
                  <div key={d.id} className="py-3 sm:py-4.5 flex items-center justify-between gap-2.5 sm:gap-4 hover:bg-slate-50/70 rounded-xl sm:rounded-2xl px-2 sm:px-3 transition-colors">
                    <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0">
                      <span className="w-4 sm:w-5 text-xs font-mono font-bold text-gray-300 mt-0.5 shrink-0">{d.rank}</span>
                      <div className="min-w-0 space-y-0.5 sm:space-y-1">
                        <span className="font-extrabold text-xs sm:text-base text-gray-900 block truncate leading-tight">{d.name}</span>
                        <div className="text-[10px] sm:text-xs text-gray-500 font-medium flex flex-wrap items-center gap-1 sm:gap-1.5">
                          <span>This month: <strong className="text-amber-800 font-mono">{formatCurrency(d.thisMonthDue)}</strong></span>
                        </div>
                        <div className="text-[10px] sm:text-xs font-bold text-rose-600 flex items-center gap-1">
                          <span>{d.monthsOverdue}m overdue</span>
                          <span>|</span>
                          <span className="truncate">since {d.sinceDateLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right space-y-0.5">
                      <span className="text-sm sm:text-xl font-black text-rose-600 block leading-tight font-mono">
                        {formatCurrency(d.cumulativeDue)}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        TOTAL
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── 3. OVERVIEW SUBTAB ── */}
      {activeSubtab === 'overview' && (
        <div className="space-y-3.5 sm:space-y-4 max-w-xl mx-auto w-full animate-in fade-in duration-150">
          
          {/* Card 1: Ask your data · in plain words */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                <span className="font-bold text-slate-800">Ask your data</span>
                <span className="text-slate-400 font-medium text-[11px] sm:text-xs">· in plain words</span>
              </div>
            </div>

            {/* Input Box */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleAskData(queryInput);
              }}
              className="relative flex items-center border border-slate-200 rounded-2xl bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all p-1 shadow-2xs"
            >
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="e.g. which chit is behind?"
                className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/90 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-2xs cursor-pointer"
                title="Submit question"
              >
                <ArrowUp size={15} className="stroke-[2.5]" />
              </button>
            </form>

            {/* AI Answer bubble if present */}
            {queryAnswer && (
              <div className="p-3 rounded-xl sm:rounded-2xl bg-emerald-50/80 border border-emerald-100 text-xs text-slate-700 space-y-1 relative animate-in fade-in duration-150">
                <div className="flex items-center justify-between font-bold text-emerald-800 text-[10px] sm:text-[11px]">
                  <span>AI Insight</span>
                  <button 
                    onClick={() => setQueryAnswer(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="leading-relaxed whitespace-pre-wrap text-[11px] sm:text-xs">{queryAnswer}</div>
              </div>
            )}

            {/* Quick Suggestion Pills */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-0.5">
              {[
                'Which chit is behind on collection?',
                'How much is left to collect this month?',
                'How much payout do I still owe winners?'
              ].map((pillText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQueryInput(pillText);
                    handleAskData(pillText);
                  }}
                  className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-[10px] sm:text-xs font-medium transition-all active:scale-95 shadow-2xs cursor-pointer text-left"
                >
                  {pillText}
                </button>
              ))}
            </div>
          </div>

          {/* Card 2: Collected this month & 6-Month Trend */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3.5 sm:space-y-4">
            
            {/* Top row: Collected & Efficiency */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block">Collected this month</span>
                <span className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight block mt-0.5 font-mono">
                  ₹{overviewStats.totalCollectedThisMonth.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl sm:text-3xl font-black text-rose-500 block font-mono">
                  {overviewStats.overallEfficiency}%
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 block -mt-0.5">
                  efficiency
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-2 sm:h-2.5 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, overviewStats.overallEfficiency)}%` }}
                />
              </div>
              <div className="text-[10px] sm:text-xs text-slate-500 font-medium flex items-center gap-1 flex-wrap">
                <span>₹{overviewStats.totalStillToCollect.toLocaleString('en-IN')} to collect</span>
                <span>·</span>
                <span>
                  <span className="font-bold text-rose-500">{overviewStats.groupsNeedingAttention}</span> need attention
                </span>
              </div>
            </div>

            {/* Collection trend · last 6 months */}
            <div className="pt-1 space-y-1.5">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 block">
                Collection trend <span className="text-slate-400 font-normal">· last 6 months</span>
              </span>

              {/* Smooth Bezier Curve Chart */}
              <div className="w-full relative h-[85px] sm:h-[110px]">
                <svg
                  viewBox={`0 0 ${trendChartData.width} ${trendChartData.height}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {trendChartData.areaPath && (
                    <path
                      d={trendChartData.areaPath}
                      fill="url(#trendGradient)"
                    />
                  )}

                  {trendChartData.path && (
                    <path
                      d={trendChartData.path}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {trendChartData.points.map((pt, idx) => (
                    <text
                      key={idx}
                      x={pt.x}
                      y={trendChartData.height - 4}
                      textAnchor="middle"
                      className="text-[9px] sm:text-[10px] fill-slate-400 font-medium"
                    >
                      {pt.label}
                    </text>
                  ))}
                </svg>
              </div>
            </div>

            {/* Bottom Alert Banner: Payouts still owed to winners */}
            <div className="bg-rose-50/70 border border-rose-100 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-rose-600">
                Payouts still owed to winners
              </span>
              <span className="text-xs sm:text-sm font-black text-rose-600 font-mono">
                ₹{overviewStats.totalPayoutsStillOwed.toLocaleString('en-IN')}
              </span>
            </div>

          </div>

          {/* Card 3: Per-Group Health Cards */}
          <div className="space-y-3 sm:space-y-4">
            {overviewStats.groupCards.length === 0 ? (
              <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-6 text-center text-xs text-slate-500">
                No active chit groups found.
              </div>
            ) : (
              overviewStats.groupCards.map((g) => (
                <div key={g.id} className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3.5">
                  
                  {/* Group Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">
                        {g.name}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
                        {g.dateLabel} · M{g.currentMonth} · {g.memberCount} members
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50/60 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-emerald-100/80 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {g.status || 'Active'}
                    </span>
                  </div>

                  {/* Metric 1: This month's collection */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold">
                      <span className="text-slate-600">This month's collection</span>
                      <span className="font-bold text-rose-500">{g.efficiency}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, g.efficiency)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-medium">
                      <span>Collected ₹{g.groupCollected.toLocaleString('en-IN')}</span>
                      <span>Expected ₹{g.groupExpected.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Metric 2: Auction progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold">
                      <span className="text-slate-600">Auction progress</span>
                      <span className="font-bold text-amber-500">{g.auctionProgressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, g.auctionProgressPercent)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-400 font-medium">
                      <span>{g.wonCount} won</span>
                      <span>{g.yetToLiftCount} yet to lift</span>
                    </div>
                  </div>

                  {/* Bottom 3-box Grid */}
                  <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-xl sm:rounded-2xl bg-slate-50/60 border border-slate-100 overflow-hidden text-center">
                    <div className="p-2 sm:p-2.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Chit value
                      </span>
                      <span className="text-[11px] sm:text-sm font-black text-slate-900 mt-0.5 block font-mono">
                        ₹{g.totalValue.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="p-2 sm:p-2.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Months
                      </span>
                      <span className="text-[11px] sm:text-sm font-black text-slate-900 mt-0.5 block font-mono">
                        {g.currentMonth}/{g.duration}
                      </span>
                    </div>

                    <div className={`p-2 sm:p-2.5 ${g.payoutDue > 0 ? 'bg-rose-50/70' : ''}`}>
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Payout due
                      </span>
                      <span className={`text-[11px] sm:text-sm font-black mt-0.5 block font-mono ${g.payoutDue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        ₹{g.payoutDue.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ── 4. PERIOD SUBTAB ── */}
      {activeSubtab === 'period' && (
        <div className="space-y-3.5 sm:space-y-4 max-w-xl mx-auto w-full animate-in fade-in duration-150">
          
          {/* Top Filter Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3.5">
            {/* Title */}
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs sm:text-sm">
              <Calendar size={16} className="text-slate-500" />
              <span>Money moved between two dates</span>
            </div>

            {/* Quick Preset Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
              {[
                { id: 'this_month', label: 'This month' },
                { id: 'last_month', label: 'Last month' },
                { id: 'this_quarter', label: 'This quarter' },
                { id: 'this_fy', label: 'This FY' },
                { id: '30_days', label: '30 days' },
                { id: 'custom', label: 'Custom' },
              ].map((p) => {
                const isActive = periodPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetChange(p.id as any)}
                    className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* From & To Date Inputs (Stacked on mobile, 2-col on tablet/desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-0.5">
              <div className="space-y-1">
                <label className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block">From</label>
                <input
                  type="date"
                  value={periodStartDate}
                  onChange={(e) => {
                    setPeriodStartDate(e.target.value);
                    setPeriodPreset('custom');
                  }}
                  className="w-full px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block">To</label>
                <input
                  type="date"
                  value={periodEndDate}
                  onChange={(e) => {
                    setPeriodEndDate(e.target.value);
                    setPeriodPreset('custom');
                  }}
                  className="w-full px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Across Group Filter */}
            <div className="space-y-1 pt-0.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 block">Across</span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setPeriodGroupId('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    periodGroupId === 'all'
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Globe size={12} />
                  <span>All chits</span>
                </button>
                {chitGroups.map((g) => {
                  const isSelected = periodGroupId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setPeriodGroupId(g.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs font-bold'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons: Share / WhatsApp / Download */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            <button
              onClick={handleShareText}
              className="py-2.5 px-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Share2 size={14} /> <span>Share</span>
            </button>
            <button
              onClick={handleWhatsAppPDF}
              className="py-2.5 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Send size={14} /> <span>WhatsApp</span>
            </button>
            <button
              onClick={() => setShowPreviewModal(true)}
              className="py-2.5 px-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Download size={14} /> <span>PDF</span>
            </button>
          </div>

          {/* Hero Summary Card: Collected & Split Sub-Cards */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3.5 sm:space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <ArrowDownLeft size={15} />
                  <span>Collected</span>
                </div>
                <span className="text-2xl sm:text-4xl font-black text-emerald-600 tracking-tight block mt-0.5 font-mono">
                  ₹{periodStats.totalCollected.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-500 font-medium block mt-0.5">
                  {periodDateLabel} · {periodStats.paymentCount} payments
                </span>
              </div>
              <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] sm:text-xs font-bold shrink-0">
                {periodStats.selectedGroupName}
              </span>
            </div>

            {/* Split Sub-Cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-0.5">
              <div className="border border-slate-100 bg-slate-50/70 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 space-y-1">
                <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                  <div className="w-4 h-4 rounded-md bg-amber-50 flex items-center justify-center">
                    <ArrowUpRight size={12} className="text-amber-600" />
                  </div>
                  <span className="text-slate-400 font-semibold text-[10px] sm:text-[11px]">Paid out</span>
                </div>
                <span className="text-sm sm:text-lg font-black text-slate-900 block font-mono">
                  ₹{periodStats.totalPaidOut.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="border border-rose-100 bg-rose-50/40 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 space-y-1">
                <div className="flex items-center gap-1 text-rose-500 text-xs font-bold">
                  <div className="w-4 h-4 rounded-md bg-rose-100/80 flex items-center justify-center">
                    <Wallet size={11} className="text-rose-600" />
                  </div>
                  <span className="text-slate-400 font-semibold text-[10px] sm:text-[11px]">Net flow</span>
                </div>
                <span className={`text-sm sm:text-lg font-black block font-mono ${periodStats.netFlow < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {periodStats.netFlow < 0 ? '-' : ''}₹{Math.abs(periodStats.netFlow).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Collected each month */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <TrendingUp size={14} className="text-slate-500" />
              <span>Collected each month</span>
            </div>

            <div className="space-y-2 pt-0.5">
              {periodStats.monthsInPeriod.map((m, idx) => {
                const percent = periodStats.maxMonthVal > 0 ? (m.collected / periodStats.maxMonthVal) * 100 : 0;
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="w-14 sm:w-16 font-semibold text-slate-600 text-[11px] sm:text-xs shrink-0">{m.label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-16 sm:w-20 text-right font-bold text-slate-800 font-mono text-[11px] sm:text-xs">
                      ₹{m.collected.toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: How members paid */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <CreditCard size={14} className="text-slate-500" />
              <span>How members paid</span>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-0.5">
              {periodStats.paymentMethodsList.map((m, idx) => (
                <div
                  key={idx}
                  className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border border-slate-200 bg-slate-50/70 text-[11px] sm:text-xs font-bold text-slate-800 flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="text-slate-600 font-medium">{m.method}</span>
                  <span className="font-mono">₹{m.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Top contributors */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <Users size={14} className="text-slate-500" />
              <span>Top contributors</span>
            </div>

            <div className="divide-y divide-slate-100 pt-0.5">
              {periodStats.topContributors.length === 0 ? (
                <div className="py-2 text-center text-xs text-slate-400">
                  No collections in this period.
                </div>
              ) : (
                periodStats.topContributors.map((c, idx) => (
                  <div key={idx} className="py-2 sm:py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold w-3">{idx + 1}</span>
                      <div>
                        <span className="font-bold text-slate-900 text-xs sm:text-sm block">{c.name}</span>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block">
                          {c.paymentCount} payments
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-emerald-600 font-mono text-xs sm:text-sm">
                      ₹{c.totalPaid.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card: Payouts made */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <ArrowUpRight size={14} className="text-slate-500" />
              <span>Payouts made</span>
            </div>

            <div className="divide-y divide-slate-100 pt-0.5">
              {periodStats.payoutsMadeList.length === 0 ? (
                <div className="py-2 text-center text-xs text-slate-400">
                  No payouts made in this period.
                </div>
              ) : (
                periodStats.payoutsMadeList.map((p, idx) => (
                  <div key={idx} className="py-2 sm:py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold w-3">{idx + 1}</span>
                      <div>
                        <span className="font-bold text-slate-900 text-xs sm:text-sm block">{p.name}</span>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block">
                          {p.payoutCount} payouts
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-amber-600 font-mono text-xs sm:text-sm">
                      ₹{p.totalPaid.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── 5. EARNINGS SUBTAB ── */}
      {activeSubtab === 'earnings' && (
        <div className="space-y-3.5 sm:space-y-4 max-w-xl mx-auto w-full animate-in fade-in duration-150">
          
          {/* Top Chit Group Selector Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setEarningsGroupId('all')}
              className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold shrink-0 transition-all duration-150 active:scale-95 cursor-pointer ${
                earningsGroupId === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
              }`}
            >
              <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${earningsGroupId === 'all' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
              <span>All chits</span>
            </button>
            {chitGroups.map((g) => {
              const isSelected = earningsGroupId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setEarningsGroupId(g.id)}
                  className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold shrink-0 transition-all duration-150 active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                  }`}
                >
                  <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <span>{g.name}</span>
                </button>
              );
            })}
          </div>

          {/* Time Filter Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {[
              { id: 'this_month', label: 'This month' },
              { id: 'this_fy', label: 'This FY' },
              { id: 'all_time', label: 'All time' },
            ].map((p) => {
              const isActive = earningsTimeFilter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setEarningsTimeFilter(p.id as any)}
                  className={`px-3.5 sm:px-4.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Hero Earnings Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4 sm:space-y-5">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-wider">
                <TrendingUp size={14} className="stroke-[2.5]" />
                <span>
                  YOU EARNED · {earningsTimeFilter === 'this_month' ? 'THIS MONTH' : earningsTimeFilter === 'this_fy' ? 'THIS FY' : 'ALL TIME'}
                </span>
              </div>
              <span className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight block mt-1 font-mono">
                ₹{earningsStats.totalEarned.toLocaleString('en-IN')}
              </span>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1 leading-relaxed">
                Money that has actually moved — not what a schedule projects.
              </p>
            </div>

            {/* Breakdown List */}
            <div className="space-y-3 sm:space-y-4 pt-1 border-t border-slate-100">
              
              {/* Row 1: Organizer Profit */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                    <Award size={16} />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">Organizer Profit (M0)</h5>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 leading-tight truncate">
                      Launch month collection pool
                    </p>
                  </div>
                </div>
                <span className="font-bold text-emerald-600 font-mono text-xs sm:text-sm shrink-0 pl-2">
                  ₹{earningsStats.organizerProfit.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Row 2: Discount Pool */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">Discount Pool (Laaba Seetu)</h5>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 leading-tight truncate">
                      Reserve towards ₹0 month
                    </p>
                  </div>
                </div>
                <span className="font-bold text-indigo-600 font-mono text-xs sm:text-sm shrink-0 pl-2">
                  ₹{earningsStats.discountPool.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Row 3: Penalties */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <AlertTriangle size={16} className="text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">Penalties</h5>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 leading-tight truncate">
                      Late charges collected
                    </p>
                  </div>
                </div>
                <span className="font-bold text-slate-900 font-mono text-xs sm:text-sm shrink-0 pl-2">
                  ₹{earningsStats.penalties.toLocaleString('en-IN')}
                </span>
              </div>

            </div>
          </div>

          {/* Bottom BY CHIT Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-2.5 sm:space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              BY CHIT
            </span>

            <div className="divide-y divide-slate-100">
              {earningsStats.byChitList.length === 0 ? (
                <div className="py-2 text-center text-xs text-slate-400">
                  No earnings recorded for this selection.
                </div>
              ) : (
                earningsStats.byChitList.map((g) => (
                  <div key={g.id} className="py-2 sm:py-2.5 flex items-center justify-between first:pt-0 last:pb-0 gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">{g.name}</span>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block mt-0.5 truncate">{g.subtitle}</span>
                    </div>
                    <span className="font-black text-slate-900 font-mono text-xs sm:text-sm shrink-0">
                      ₹{g.total.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── 6. PAYOUTS SUBTAB ── */}
      {activeSubtab === 'payouts' && (
        <div className="space-y-3.5 sm:space-y-4 max-w-xl mx-auto w-full animate-in fade-in duration-150">
          
          {/* Top Chit Group Selector Pill */}
          {chitGroups.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
              {chitGroups.map((g) => {
                const isSelected = g.id === (selectedGroup?.id || selectedGroupId);
                return (
                  <button
                    key={g.id}
                    onClick={(e) => handleSelectGroup(g.id, e)}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold shrink-0 transition-all duration-150 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    }`}
                  >
                    <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <span>{g.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={handleShareText}
              className="py-2.5 sm:py-3 px-3 sm:px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Share2 size={15} /> <span>Share Text</span>
            </button>
            <button
              onClick={handleWhatsAppPDF}
              className="py-2.5 sm:py-3 px-3 sm:px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Send size={15} /> <span>WhatsApp PDF</span>
            </button>
          </div>

          {/* 3 Pastel Summary Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Card 1: WINNERS */}
            <div className="border border-emerald-200/90 bg-emerald-50/60 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xs text-left space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                WINNERS
              </span>
              <span className="text-lg sm:text-3xl font-black text-emerald-600 block font-mono">
                {payoutsStats.winnersCount}
              </span>
            </div>

            {/* Card 2: REMAINING */}
            <div className="border border-amber-200/90 bg-amber-50/50 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xs text-left space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                REMAINING
              </span>
              <span className="text-lg sm:text-3xl font-black text-amber-700 block font-mono">
                {payoutsStats.remainingCount}
              </span>
            </div>

            {/* Card 3: OUTSTANDING */}
            <div className={`border rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xs text-left space-y-0.5 sm:space-y-1 transition-colors ${
              payoutsStats.outstandingTotal > 0 
                ? 'border-rose-200/90 bg-rose-50/50' 
                : 'border-slate-200/90 bg-white'
            }`}>
              <span className={`text-[9px] sm:text-[11px] font-bold uppercase tracking-wider block truncate ${
                payoutsStats.outstandingTotal > 0 ? 'text-rose-600' : 'text-slate-400'
              }`}>
                OUTSTANDING
              </span>
              <span className={`text-sm sm:text-3xl font-black block font-mono ${
                payoutsStats.outstandingTotal > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}>
                ₹{payoutsStats.outstandingTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Auction Progress Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold">
              <span className="text-slate-600">Auction Progress</span>
              <span className="font-bold text-slate-900">
                {payoutsStats.winnersCount}/{payoutsStats.totalMembers} won ({payoutsStats.progressPercent}%)
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 sm:h-2.5 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, payoutsStats.progressPercent)}%` }}
              />
            </div>
          </div>

          {/* WINNER PAYOUTS List Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3 sm:space-y-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              WINNER PAYOUTS
            </span>

            <div className="divide-y divide-slate-100">
              {payoutsStats.winnersList.length === 0 ? (
                <div className="py-3 text-center text-xs text-slate-400">
                  No auction prize disbursements recorded yet.
                </div>
              ) : (
                payoutsStats.winnersList.map((w) => (
                  <div key={w.id} className="py-3 sm:py-3.5 flex items-center justify-between first:pt-0 last:pb-0 gap-2 sm:gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 ${
                        w.status === 'Complete' 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : w.status === 'Partial'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}>
                        <Trophy size={15} />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                          {w.winnerName}
                        </h5>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                          {w.subtitle}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium mt-1">
                          <span className="text-slate-400">Awarded ₹{w.awardedAmount.toLocaleString('en-IN')}</span>
                          {w.amountPaid > 0 && (
                            <span className="font-bold text-emerald-600 font-mono">Paid ₹{w.amountPaid.toLocaleString('en-IN')}</span>
                          )}
                          {w.outstanding > 0 && (
                            <span className="font-bold text-rose-600 font-mono">Pending ₹{w.outstanding.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className={`inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shrink-0 border ${
                      w.status === 'Complete'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : w.status === 'Partial'
                        ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                        : 'bg-rose-50 text-rose-700 border-rose-200/80'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── 7. MEMBER SUBTAB ── */}
      {activeSubtab === 'member' && (
        <div className="space-y-3.5 sm:space-y-4 max-w-xl mx-auto w-full animate-in fade-in duration-150">
          
          {/* Top Chit Group Selector Pill */}
          {chitGroups.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
              {chitGroups.map((g) => {
                const isSelected = g.id === (selectedGroup?.id || selectedGroupId);
                return (
                  <button
                    key={g.id}
                    onClick={(e) => handleSelectGroup(g.id, e)}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold shrink-0 transition-all duration-150 active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-2xs'
                    }`}
                  >
                    <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <span>{g.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search Box for Member Selection */}
          <div className="relative">
            <div className="relative flex items-center border border-gray-200 bg-white rounded-xl sm:rounded-2xl shadow-2xs focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all p-1">
              <div className="pl-2.5 sm:pl-3 text-gray-400 flex items-center justify-center">
                <Search size={15} />
              </div>
              <input
                type="text"
                value={memberSearchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setMemberSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                placeholder="Search member name or ticket #..."
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none font-bold"
              />
              {memberSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setMemberSearchQuery('');
                    setIsSearchDropdownOpen(true);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg mr-1 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {isSearchDropdownOpen && filteredSearchMembers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-gray-100">
                {filteredSearchMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMemberId(m.id);
                      setMemberSearchQuery(m.profiles?.full_name || '');
                      setIsSearchDropdownOpen(false);
                    }}
                    className="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block leading-tight">
                        {m.profiles?.full_name || 'Subscriber'}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block mt-0.5">
                        Ticket #{m.ticket_number} {m.profiles?.phone_number ? `· ${m.profiles.phone_number}` : ''}
                      </span>
                    </div>
                    {selectedMemberId === m.id && (
                      <span className="text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        Selected
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons: Share, WhatsApp, PDF */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            <button
              onClick={handleShareText}
              className="py-2.5 sm:py-3 px-2 sm:px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Share2 size={14} /> <span>Share</span>
            </button>
            <button
              onClick={handleWhatsAppPDF}
              className="py-2.5 sm:py-3 px-2 sm:px-3 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Send size={14} /> <span>WhatsApp</span>
            </button>
            <button
              onClick={() => setShowPreviewModal(true)}
              className="py-2.5 sm:py-3 px-2 sm:px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <FileText size={14} /> <span>PDF</span>
            </button>
          </div>

          {/* 3 Pastel Summary Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Card 1: TOTAL DUE */}
            <div className="border border-slate-200/90 bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xs text-left space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                TOTAL DUE
              </span>
              <span className="text-sm sm:text-2xl font-black text-slate-900 block font-mono">
                {formatCurrency(memberStatementStats.totalDue)}
              </span>
            </div>

            {/* Card 2: PAID */}
            <div className="border border-emerald-200/90 bg-emerald-50/60 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xs text-left space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                PAID
              </span>
              <span className="text-sm sm:text-2xl font-black text-emerald-600 block font-mono">
                {formatCurrency(memberStatementStats.totalPaid)}
              </span>
            </div>

            {/* Card 3: OWES */}
            <div className="border border-rose-200/90 bg-rose-50/60 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xs text-left space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[11px] font-bold text-rose-600 uppercase tracking-wider block">
                OWES
              </span>
              <span className="text-sm sm:text-2xl font-black text-rose-600 block font-mono">
                {formatCurrency(memberStatementStats.totalOwes)}
              </span>
            </div>
          </div>

          {/* Winner & Prize Payout Status Card */}
          {memberStatementStats.hasWon && (
            <div className="bg-[#fef9ea] border border-[#fde68a] rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-2.5 sm:space-y-3 shadow-2xs animate-in fade-in">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-100/90 text-[#b45309] flex items-center justify-center shrink-0">
                    <Trophy size={14} />
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                      Won · {memberStatementStats.winningDateLabel}
                    </h5>
                    <p className="text-[10px] sm:text-[11px] text-amber-800 font-medium mt-0.5 truncate">
                      {memberStatementStats.payoutDate 
                        ? `Disbursed on ${memberStatementStats.payoutDate}` 
                        : `Pending disbursal`}
                    </p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold border shrink-0 ${
                  memberStatementStats.payoutStatus === 'Settled'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                    : memberStatementStats.payoutStatus === 'Partial'
                    ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                    : 'bg-rose-50 text-rose-700 border-rose-200/80'
                }`}>
                  {memberStatementStats.payoutStatus === 'Settled' ? 'Settled' : memberStatementStats.payoutStatus === 'Partial' ? 'Partial' : 'Pending'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1 border-t border-amber-200/60 text-left">
                <div className="bg-white/80 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-amber-200/50">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">POT</span>
                  <span className="text-[11px] sm:text-sm font-black text-slate-900 block font-mono mt-0.5">
                    {formatCurrency(memberStatementStats.netPrizePot)}
                  </span>
                </div>
                <div className="bg-white/80 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-emerald-200/50">
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 uppercase tracking-wider block truncate">PAID</span>
                  <span className="text-[11px] sm:text-sm font-black text-emerald-700 block font-mono mt-0.5">
                    {formatCurrency(memberStatementStats.prizePaid)}
                  </span>
                </div>
                <div className="bg-white/80 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-rose-200/50">
                  <span className="text-[9px] sm:text-[10px] font-bold text-rose-700 uppercase tracking-wider block truncate">PENDING</span>
                  <span className="text-[11px] sm:text-sm font-black text-rose-700 block font-mono mt-0.5">
                    {formatCurrency(memberStatementStats.prizePending)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Payment Breakdown List Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3 sm:space-y-4">
            <div className="divide-y divide-slate-100">
              {memberStatementStats.monthRows.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  No installment dues recorded for this subscriber yet.
                </div>
              ) : (
                memberStatementStats.monthRows.map((r) => (
                  <div key={r.month} className="py-2.5 sm:py-3.5 flex items-center justify-between first:pt-0 last:pb-0 gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <h5 className="text-xs sm:text-base font-bold text-slate-900 leading-tight truncate">
                        {r.dateLabel}
                      </h5>
                      <p className="text-[10px] sm:text-xs text-gray-400 font-mono font-medium mt-0.5">
                        Paid {formatCurrency(r.paid)} / {formatCurrency(r.expected)}
                      </p>
                    </div>

                    <div className="text-right space-y-0.5 sm:space-y-1 shrink-0">
                      <span className={`text-xs sm:text-base font-bold font-mono block leading-tight ${
                        r.pendingDue > 0 ? 'text-rose-600' : 'text-slate-900'
                      }`}>
                        {formatCurrency(r.pendingDue > 0 ? r.pendingDue : r.paid)}
                      </span>
                      <span className={`inline-block px-2.5 sm:px-3 py-0.2 sm:py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${
                        r.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : r.status === 'Late'
                          ? 'bg-rose-50 text-rose-600 border-rose-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── 8. RELIABILITY SUBTAB ── */}
      {activeSubtab === 'reliability' && (
        <div className="space-y-4 sm:space-y-6">
          
          {/* Chit Group Selection Pill */}
          {chitGroups.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5" ref={groupSliderRef}>
              {chitGroups.map((group) => {
                const isSelected = selectedGroupId === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={(e) => handleSelectGroup(group.id, e)}
                    className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-xs whitespace-nowrap transition-all shrink-0 cursor-pointer shadow-2xs ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-gray-200/90 text-gray-600 hover:text-gray-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                    <span>{group.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            <button
              onClick={handleShareText}
              className="py-2.5 sm:py-3 px-2 sm:px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Share2 size={14} /> <span>Share</span>
            </button>
            <button
              onClick={handleWhatsAppPDF}
              className="py-2.5 sm:py-3 px-2 sm:px-3 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Send size={14} /> <span>WhatsApp</span>
            </button>
            <button
              onClick={() => setShowPreviewModal(true)}
              className="py-2.5 sm:py-3 px-2 sm:px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <FileText size={14} /> <span>PDF</span>
            </button>
          </div>

          {/* Hero Card: Member reliability */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-3 sm:space-y-4">
            <h4 className="text-xs sm:text-base font-bold text-slate-600">
              Member reliability <span className="font-normal text-slate-400">· who pays on time</span>
            </h4>

            {/* 3 Pastel Summary Metric Cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Card 1: Reliable */}
              <div className="border border-[#bbf7d0] bg-[#eaf8f0] rounded-xl sm:rounded-3xl p-2.5 sm:p-4 text-left space-y-0.5 sm:space-y-1">
                <span className="text-[10px] sm:text-xs font-bold text-[#16a34a] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#16a34a]" /> Reliable
                </span>
                <span className="text-lg sm:text-3xl font-black text-[#0f172a] block font-mono">
                  {reliabilityStats.reliableCount}
                </span>
              </div>

              {/* Card 2: Watch */}
              <div className="border border-[#fde68a] bg-[#fef9ea] rounded-xl sm:rounded-3xl p-2.5 sm:p-4 text-left space-y-0.5 sm:space-y-1">
                <span className="text-[10px] sm:text-xs font-bold text-[#b45309] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#b45309]" /> Watch
                </span>
                <span className="text-lg sm:text-3xl font-black text-[#0f172a] block font-mono">
                  {reliabilityStats.watchCount}
                </span>
              </div>

              {/* Card 3: At risk */}
              <div className="border border-[#fecaca] bg-[#fef2f2] rounded-xl sm:rounded-3xl p-2.5 sm:p-4 text-left space-y-0.5 sm:space-y-1">
                <span className="text-[10px] sm:text-xs font-bold text-[#dc2626] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#dc2626]" /> At risk
                </span>
                <span className="text-lg sm:text-3xl font-black text-[#0f172a] block font-mono">
                  {reliabilityStats.atRiskCount}
                </span>
              </div>
            </div>

            {/* Subtitle / Attention banner */}
            <div className="text-[11px] sm:text-xs font-medium text-slate-500 pt-0.5">
              {reliabilityStats.attentionCount > 0 ? (
                <span>
                  <strong className="text-[#dc2626] font-bold">{reliabilityStats.attentionCount}</strong> members need attention — shown first.
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold">
                  All members are on track with on-time payments.
                </span>
              )}
            </div>
          </div>

          {/* Ranked Member Reliability Cards List */}
          <div className="space-y-2.5 sm:space-y-3">
            {reliabilityStats.memberList.length === 0 ? (
              <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-6 text-center text-xs text-slate-400 shadow-2xs">
                No members found in this chit group.
              </div>
            ) : (
              reliabilityStats.memberList.map((m) => {
                const statusColor = m.status === 'Reliable' 
                  ? 'text-[#16a34a]' 
                  : m.status === 'Watch' 
                  ? 'text-[#b45309]' 
                  : 'text-[#dc2626]';

                const progressBg = m.status === 'Reliable' 
                  ? 'bg-[#16a34a]' 
                  : m.status === 'Watch' 
                  ? 'bg-[#b45309]' 
                  : 'bg-[#dc2626]';

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedMemberId(m.id);
                      setActiveSubtab('member');
                    }}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-2xs flex items-center justify-between gap-2.5 sm:gap-4 transition-all duration-150 cursor-pointer active:scale-[0.99] group"
                  >
                    {/* Left Score Box */}
                    <div className="w-10 sm:w-14 text-center shrink-0">
                      <span className={`text-lg sm:text-2xl font-black block font-mono leading-none ${statusColor}`}>
                        {m.score}
                      </span>
                      <span className="text-[9px] sm:text-[11px] font-semibold text-slate-400 block mt-0.5">
                        score
                      </span>
                    </div>

                    {/* Middle Details & Progress Track */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-base leading-tight truncate">
                          {m.name}
                        </span>
                        <span className={`text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0 ${statusColor}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" /> {m.status}
                        </span>
                      </div>

                      <div className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">
                        {m.onTimeCount}/{m.evaluatedMonthsCount} on time · {m.unpaidCount} unpaid · {m.avgLateDays}d late
                      </div>

                      {/* Score Track Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-1 sm:h-1.5 overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${progressBg}`}
                          style={{ width: `${Math.max(3, m.score)}%` }}
                        />
                      </div>
                    </div>

                    {/* Right Chevron */}
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ── MODAL: DOCUMENT PREVIEW & PRINT ── */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 md:p-6 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl h-[100dvh] sm:h-[92dvh] max-h-[100dvh] sm:max-h-[92dvh] rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-3 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 shrink-0">
              <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={17} className="text-indigo-600 shrink-0" />
                  <h3 className="text-xs sm:text-base font-bold text-gray-900 truncate">
                    {activeSubtab === 'reliability'
                      ? `${selectedGroup?.name || 'Group'} Reliability Report`
                      : activeSubtab === 'member'
                      ? `${memberStatementStats.memberName} Statement`
                      : activeSubtab === 'payouts'
                      ? `${selectedGroup?.name || 'Group'} Payouts Report`
                      : activeSubtab === 'period'
                      ? `Period Report (${periodDateLabel})`
                      : activeSubtab === 'defaulters'
                      ? `Month ${selectedMonth === 0 ? '0 (Launch)' : selectedMonth} Defaulters Report`
                      : `Month ${selectedMonth === 0 ? '0 (Launch)' : selectedMonth} Statement`
                    }
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="sm:hidden p-1.5 text-gray-400 hover:text-gray-700 rounded-xl transition-colors cursor-pointer hover:bg-gray-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0">
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="flex-1 sm:flex-none justify-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} /> <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className="flex-1 sm:flex-none justify-center px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} /> <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="hidden sm:inline-flex p-1.5 text-gray-400 hover:text-gray-700 rounded-xl transition-colors cursor-pointer hover:bg-gray-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content Scroll Area with Horizontal Scroll for Mobile */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2 sm:p-6 md:p-8 bg-slate-200/80 flex justify-center">
              <div className="bg-white shadow-xl rounded-xl w-full max-w-[760px] min-w-[320px] h-fit my-auto">
                {activeSubtab === 'reliability' ? (
                  <ReliabilityPDFView 
                    selectedGroup={selectedGroup}
                    reliabilityStats={reliabilityStats}
                    formatCurrency={formatCurrency}
                    organizerCompanyName={organizerCompanyName}
                    organizerInitials={organizerInitials}
                  />
                ) : activeSubtab === 'member' ? (
                  <MemberPDFView 
                    selectedGroup={selectedGroup}
                    memberStatementStats={memberStatementStats}
                    formatCurrency={formatCurrency}
                    organizerCompanyName={organizerCompanyName}
                    organizerInitials={organizerInitials}
                  />
                ) : activeSubtab === 'payouts' ? (
                  <PayoutsPDFView 
                    selectedGroup={selectedGroup}
                    payoutsStats={payoutsStats}
                    formatCurrency={formatCurrency}
                    organizerCompanyName={organizerCompanyName}
                    organizerInitials={organizerInitials}
                  />
                ) : activeSubtab === 'period' ? (
                  <PeriodPDFView 
                    periodStats={periodStats}
                    periodDateLabel={periodDateLabel}
                    formatCurrency={formatCurrency}
                    organizerCompanyName={organizerCompanyName}
                    organizerInitials={organizerInitials}
                  />
                ) : activeSubtab === 'defaulters' ? (
                  <DefaultersPDFView 
                    selectedGroup={selectedGroup}
                    selectedMonth={selectedMonth}
                    activeMonthInfo={activeMonthInfo}
                    defaultersStats={defaultersStats}
                    formatCurrency={formatCurrency}
                    organizerCompanyName={organizerCompanyName}
                    organizerInitials={organizerInitials}
                  />
                ) : (
                  <PDFDocumentView 
                    selectedGroup={selectedGroup}
                    selectedMonth={selectedMonth}
                    activeMonthInfo={activeMonthInfo}
                    monthlyStats={monthlyStats}
                    formatCurrency={formatCurrency}
                    organizerCompanyName={organizerCompanyName}
                    organizerInitials={organizerInitials}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HIDDEN RENDER CONTAINER FOR DIRECT HTML-TO-IMAGE EXPORT ── */}
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '794px', 
          zIndex: -9999, 
          opacity: 0.01, 
          pointerEvents: 'none' 
        }}
      >
        <div 
          ref={pdfTemplateRef} 
          id="printable-statement-container" 
          className="w-[794px] bg-white text-slate-900 font-sans"
        >
          {activeSubtab === 'reliability' ? (
            <ReliabilityPDFView 
              selectedGroup={selectedGroup}
              reliabilityStats={reliabilityStats}
              formatCurrency={formatCurrency}
              organizerCompanyName={organizerCompanyName}
              organizerInitials={organizerInitials}
            />
          ) : activeSubtab === 'member' ? (
            <MemberPDFView 
              selectedGroup={selectedGroup}
              memberStatementStats={memberStatementStats}
              formatCurrency={formatCurrency}
              organizerCompanyName={organizerCompanyName}
              organizerInitials={organizerInitials}
            />
          ) : activeSubtab === 'payouts' ? (
            <PayoutsPDFView 
              selectedGroup={selectedGroup}
              payoutsStats={payoutsStats}
              formatCurrency={formatCurrency}
              organizerCompanyName={organizerCompanyName}
              organizerInitials={organizerInitials}
            />
          ) : activeSubtab === 'period' ? (
            <PeriodPDFView 
              periodStats={periodStats}
              periodDateLabel={periodDateLabel}
              formatCurrency={formatCurrency}
              organizerCompanyName={organizerCompanyName}
              organizerInitials={organizerInitials}
            />
          ) : activeSubtab === 'defaulters' ? (
            <DefaultersPDFView 
              selectedGroup={selectedGroup}
              selectedMonth={selectedMonth}
              activeMonthInfo={activeMonthInfo}
              defaultersStats={defaultersStats}
              formatCurrency={formatCurrency}
              organizerCompanyName={organizerCompanyName}
              organizerInitials={organizerInitials}
            />
          ) : (
            <PDFDocumentView 
              selectedGroup={selectedGroup}
              selectedMonth={selectedMonth}
              activeMonthInfo={activeMonthInfo}
              monthlyStats={monthlyStats}
              formatCurrency={formatCurrency}
              organizerCompanyName={organizerCompanyName}
              organizerInitials={organizerInitials}
            />
          )}
        </div>
      </div>

    </div>
  );
}

// ── PIXEL-PERFECT CHIT FUNDS PDF STATEMENT VIEW COMPONENT ──────────────────
interface PDFDocumentViewProps {
  selectedGroup: any;
  selectedMonth: number;
  activeMonthInfo: { num: number; dateLabel: string; code: string };
  monthlyStats: any;
  formatCurrency: (val: number) => string;
  organizerCompanyName: string;
  organizerInitials: string;
}

function PDFDocumentView({
  selectedGroup,
  selectedMonth,
  activeMonthInfo,
  monthlyStats,
  formatCurrency,
  organizerCompanyName,
  organizerInitials
}: PDFDocumentViewProps) {
  const generationDateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }) + ', ' + new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toLowerCase();

  return (
    <div className="p-6 space-y-4 bg-white text-[#0f172a] font-sans antialiased text-[12.5px] leading-normal select-none">
      
      {/* 1. Header & Title Section */}
      <div className="pdf-section space-y-2 pb-1 border-b border-[#f1f5f9]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0">
              {organizerInitials || 'CF'}
            </div>
            <div>
              <span className="font-extrabold text-base text-[#0f172a] tracking-tight block leading-tight">
                {organizerCompanyName}
              </span>
              <span className="text-[10px] text-[#64748b] font-medium block">
                Official Chit Funds Ledger
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">MONTH STATEMENT</div>
            <div className="text-[10px] text-[#94a3b8] font-mono mt-0.5">{generationDateStr}</div>
          </div>
        </div>

        {/* Title & Group / Month Pills */}
        <div className="space-y-1.5 pt-1">
          <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">Month Statement</h1>
          
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {selectedGroup?.name || 'Chit Group'}
            </span>
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {activeMonthInfo.dateLabel}
            </span>
          </div>

          {/* Decorative Green Line */}
          <div className="w-12 h-1 bg-[#059669] rounded-full mt-1.5" />
        </div>
      </div>

      {/* 2. Top Metrics (EXPECTED / COLLECTED / PENDING) */}
      <div className="pdf-section grid grid-cols-3 gap-3 pt-0.5">
        <div className="border border-[#e2e8f0] rounded-xl p-3 bg-white">
          <span className="text-[9.5px] font-bold text-[#64748b] uppercase tracking-wider block">EXPECTED</span>
          <span className="text-lg font-black text-[#0f172a] block mt-0.5">
            {formatCurrency(monthlyStats.expected)}
          </span>
        </div>

        <div className="border border-[#bbf7d0] rounded-xl p-3 bg-white">
          <span className="text-[9.5px] font-bold text-[#16a34a] uppercase tracking-wider block">COLLECTED</span>
          <span className="text-lg font-black text-[#16a34a] block mt-0.5">
            {formatCurrency(monthlyStats.collected)}
          </span>
        </div>

        <div className="border border-[#fecaca] rounded-xl p-3 bg-white">
          <span className="text-[9.5px] font-bold text-[#dc2626] uppercase tracking-wider block">PENDING</span>
          <span className="text-lg font-black text-[#dc2626] block mt-0.5">
            {formatCurrency(monthlyStats.pending)}
          </span>
        </div>
      </div>

      {/* 3. Collection Progress Card */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl p-3 bg-white space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-[#334155]">Collection Progress</span>
          <span className="text-[#334155]">{monthlyStats.collectionPercent}% received</span>
        </div>

        <div className="w-full bg-[#f1f5f9] rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-[#059669] h-full rounded-full"
            style={{ width: `${Math.min(100, monthlyStats.collectionPercent)}%` }}
          />
        </div>

        <div className="pt-0.5">
          <span className="inline-block bg-[#fef2f2] text-[#dc2626] border border-[#fee2e2] text-[10.5px] font-bold px-2.5 py-0.5 rounded-md">
            {formatCurrency(monthlyStats.pending)} pending
          </span>
        </div>
      </div>

      {/* 4. AUCTION / PRIZE Box */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">AUCTION / PRIZE</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {selectedMonth === 0 ? 'Launch Month' : '1 winner'}
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2 px-3.5 font-semibold">Winner</th>
              <th className="py-2 px-3 font-semibold text-right">Prize</th>
              <th className="py-2 px-3 font-semibold text-right">Commission</th>
              <th className="py-2 px-3 font-semibold text-right">Net payout</th>
              <th className="py-2 px-3.5 font-semibold text-right">Payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {monthlyStats.winnerRecord ? (
              <tr>
                <td className="py-2 px-3.5 font-bold text-[#0f172a]">{monthlyStats.winnerRecord.winnerName}</td>
                <td className="py-2 px-3 text-right font-bold text-[#0f172a]">{formatCurrency(monthlyStats.winnerRecord.prize)}</td>
                <td className="py-2 px-3 text-right font-medium text-[#64748b]">{formatCurrency(monthlyStats.winnerRecord.discount)}</td>
                <td className="py-2 px-3 text-right font-extrabold text-[#0f172a]">{formatCurrency(monthlyStats.winnerRecord.netPayout)}</td>
                <td className="py-2 px-3.5 text-right">
                  {monthlyStats.winnerRecord.status === 'Complete' ? (
                    <span className="inline-block bg-[#e0f2fe] text-[#0369a1] text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      Complete
                    </span>
                  ) : (
                    <span className="inline-block bg-[#fef3c7] text-[#b45309] border border-[#fde68a] text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {monthlyStats.winnerRecord.status}
                    </span>
                  )}
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="py-3 text-center text-xs text-[#94a3b8] italic">
                  No auction winner recorded for this month yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. COLLECTIONS Box */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">COLLECTIONS</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {monthlyStats.memberRows.length} members
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2 px-3.5 w-8 font-semibold">#</th>
              <th className="py-2 px-3 font-semibold">Member</th>
              <th className="py-2 px-3 font-semibold text-right">Due</th>
              <th className="py-2 px-3 font-semibold text-right">Paid</th>
              <th className="py-2 px-3.5 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {monthlyStats.memberRows.map((m: any, idx: number) => (
              <tr key={m.id}>
                <td className="py-1.5 px-3.5 text-[#94a3b8] font-mono text-[11px]">{idx + 1}</td>
                <td className="py-1.5 px-3 font-bold text-[#0f172a]">{m.name}</td>
                <td className="py-1.5 px-3 text-right font-bold text-[#0f172a]">{formatCurrency(m.expectedUpToMonth)}</td>
                <td className="py-1.5 px-3 text-right font-bold text-[#0f172a]">{formatCurrency(m.paidTotal)}</td>
                <td className="py-1.5 px-3.5 text-right">
                  {m.isPaid ? (
                    <span className="inline-block bg-[#dcfce7] text-[#15803d] text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Paid
                    </span>
                  ) : (
                    <span className="inline-block bg-[#fee2e2] text-[#b91c1c] text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Late
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[#e2e8f0] bg-[#fafafa]">
            <tr>
              <td colSpan={3} className="py-2 px-3.5 font-extrabold text-[#0f172a] text-xs">
                Collected
              </td>
              <td colSpan={2} className="py-2 px-3.5 text-right font-extrabold text-[#0f172a] text-sm">
                {formatCurrency(monthlyStats.collected)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 6. OUTSTANDING DUES Box */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">OUTSTANDING DUES</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {monthlyStats.outstandingRows.length} members
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2 px-3.5 font-semibold">Member</th>
              <th className="py-2 px-3 font-semibold text-right">This month</th>
              <th className="py-2 px-3 font-semibold text-right">Older dues</th>
              <th className="py-2 px-3.5 font-semibold text-right">Total owed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {monthlyStats.outstandingRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-center text-xs text-[#16a34a] font-semibold">
                  ✅ No outstanding dues for this month cycle!
                </td>
              </tr>
            ) : (
              monthlyStats.outstandingRows.map((m: any) => (
                <tr key={m.id}>
                  <td className="py-1.5 px-3.5 font-bold text-[#0f172a]">{m.name}</td>
                  <td className="py-1.5 px-3 text-right font-bold text-[#0f172a]">{formatCurrency(m.thisMonthDue)}</td>
                  <td className="py-1.5 px-3 text-right font-medium text-[#64748b]">{formatCurrency(m.olderDues)}</td>
                  <td className="py-1.5 px-3.5 text-right font-extrabold text-[#dc2626]">{formatCurrency(m.totalOwed)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-[#e2e8f0] bg-[#fafafa]">
            <tr>
              <td colSpan={2} className="py-2 px-3.5 font-extrabold text-[#0f172a] text-xs">
                Total outstanding
              </td>
              <td colSpan={2} className="py-2 px-3.5 text-right font-extrabold text-[#dc2626] text-sm">
                {formatCurrency(monthlyStats.pending)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 7. Footer */}
      <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[10px] text-[#94a3b8]">
        <div className="flex items-center gap-1.5 font-bold text-[#64748b]">
          <span>{organizerCompanyName}</span>
        </div>
        <span className="font-medium text-[#64748b]">Confidential Statement</span>
        <span className="font-mono">{generationDateStr} · Page 1 of 1</span>
      </div>

    </div>
  );
}

// ── PIXEL-PERFECT DEFAULTERS PDF REPORT COMPONENT (CHITBASE REPLICA) ────────
interface DefaultersPDFViewProps {
  selectedGroup: any;
  selectedMonth: number;
  activeMonthInfo: { num: number; dateLabel: string; code: string };
  defaultersStats: any;
  formatCurrency: (val: number) => string;
  organizerCompanyName: string;
  organizerInitials: string;
}

function DefaultersPDFView({
  selectedGroup,
  selectedMonth,
  activeMonthInfo,
  defaultersStats,
  formatCurrency,
  organizerCompanyName,
  organizerInitials
}: DefaultersPDFViewProps) {
  const generationDateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }) + ', ' + new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toLowerCase();

  return (
    <div className="p-6 space-y-4 bg-white text-[#0f172a] font-sans antialiased text-[12.5px] leading-normal select-none">
      
      {/* 1. Header: Organizer Company Name & Initials + Document Type Timestamp */}
      <div className="pdf-section space-y-2 pb-1 border-b border-[#f1f5f9]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0">
              {organizerInitials || 'CF'}
            </div>
            <div>
              <span className="font-extrabold text-base text-[#0f172a] tracking-tight block leading-tight">
                {organizerCompanyName}
              </span>
              <span className="text-[10px] text-[#64748b] font-medium block">
                Official Chit Funds Ledger
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">DEFAULTERS REPORT</div>
            <div className="text-[10px] text-[#94a3b8] font-mono mt-0.5">{generationDateStr}</div>
          </div>
        </div>

        {/* Title & Group / Month Pills */}
        <div className="space-y-1.5 pt-1">
          <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">
            {selectedGroup?.name || 'Group'} · Defaulters
          </h1>
          
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {selectedGroup?.name || 'Chit Group'}
            </span>
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {activeMonthInfo.dateLabel}
            </span>
          </div>

          {/* Decorative Green Line */}
          <div className="w-12 h-1 bg-[#059669] rounded-full mt-1.5" />
        </div>
      </div>

      {/* 2. Top Metrics (CUMULATIVE DUES / THIS MONTH / MEMBERS OWING) */}
      <div className="pdf-section grid grid-cols-3 gap-3 pt-0.5">
        <div className="border border-[#fecaca] rounded-xl p-3.5 bg-white">
          <span className="text-[9.5px] font-bold text-[#64748b] uppercase tracking-wider block">CUMULATIVE DUES</span>
          <span className="text-xl font-black text-[#dc2626] block mt-1 font-mono">
            {formatCurrency(defaultersStats.cumulativeDues)}
          </span>
        </div>

        <div className="border border-[#fef08a] rounded-xl p-3.5 bg-white">
          <span className="text-[9.5px] font-bold text-[#64748b] uppercase tracking-wider block">THIS MONTH</span>
          <span className="text-xl font-black text-[#dc2626] block mt-1 font-mono">
            {formatCurrency(defaultersStats.thisMonthDues)}
          </span>
        </div>

        <div className="border border-[#e2e8f0] rounded-xl p-3.5 bg-white">
          <span className="text-[9.5px] font-bold text-[#64748b] uppercase tracking-wider block">MEMBERS OWING</span>
          <span className="text-xl font-black text-[#0f172a] block mt-1 font-mono">
            {defaultersStats.defaultersCount}
          </span>
        </div>
      </div>

      {/* 3. DEFAULTERS Table Card */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">DEFAULTERS</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {defaultersStats.defaultersCount} members
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2.5 px-3.5 w-12 font-semibold">Rank</th>
              <th className="py-2.5 px-3 font-semibold">Member</th>
              <th className="py-2.5 px-3 font-semibold text-right">This Month</th>
              <th className="py-2.5 px-3.5 font-semibold text-right">Cumulative</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {defaultersStats.defaultersList.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-5 text-center text-xs text-[#16a34a] font-semibold">
                  ✅ Excellent! No overdue defaulters for this month cycle.
                </td>
              </tr>
            ) : (
              defaultersStats.defaultersList.map((d: any) => (
                <tr key={d.id}>
                  <td className="py-2.5 px-3.5 text-[#64748b] font-mono text-[11px] font-bold">{d.rank}</td>
                  <td className="py-2.5 px-3 font-bold text-[#0f172a]">{d.name}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#0f172a]">{formatCurrency(d.thisMonthDue)}</td>
                  <td className="py-2.5 px-3.5 text-right font-black text-[#dc2626]">{formatCurrency(d.cumulativeDue)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-[#e2e8f0] bg-[#fafafa]">
            <tr>
              <td colSpan={2} className="py-3 px-3.5 font-extrabold text-[#0f172a] text-xs">
                Cumulative Dues
              </td>
              <td colSpan={2} className="py-3 px-3.5 text-right font-black text-[#dc2626] text-sm">
                {formatCurrency(defaultersStats.cumulativeDues)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 4. Footer */}
      <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[10px] text-[#94a3b8]">
        <div className="flex items-center gap-1.5 font-bold text-[#64748b]">
          <span>{organizerCompanyName}</span>
        </div>
        <span className="font-medium text-[#64748b]">Confidential</span>
        <span className="font-mono">{generationDateStr} · Page 1 of 1</span>
      </div>

    </div>
  );
}

// ── PIXEL-PERFECT PERIOD REPORT PDF VIEW COMPONENT ──────────────────────────
interface PeriodPDFViewProps {
  periodStats: any;
  periodDateLabel: string;
  formatCurrency: (val: number) => string;
  organizerCompanyName: string;
  organizerInitials: string;
}

function PeriodPDFView({
  periodStats,
  periodDateLabel,
  formatCurrency,
  organizerCompanyName,
  organizerInitials
}: PeriodPDFViewProps) {
  const generationDateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }) + ', ' + new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toLowerCase();

  return (
    <div className="p-6 space-y-4 bg-white text-[#0f172a] font-sans antialiased text-[12.5px] leading-normal select-none">
      
      {/* 1. Header & Title Section */}
      <div className="pdf-section space-y-2 pb-1 border-b border-[#f1f5f9]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0">
              {organizerInitials || 'CF'}
            </div>
            <div>
              <span className="font-extrabold text-base text-[#0f172a] tracking-tight block leading-tight">
                {organizerCompanyName}
              </span>
              <span className="text-[10px] text-[#64748b] font-medium block">
                Official Chit Funds Ledger
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">PERIOD REPORT</div>
            <div className="text-[10px] text-[#94a3b8] font-mono mt-0.5">{generationDateStr}</div>
          </div>
        </div>

        {/* Title & Filter Pills */}
        <div className="space-y-1.5 pt-1">
          <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">
            Period Report · {periodDateLabel}
          </h1>
          
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {periodStats.selectedGroupName}
            </span>
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {periodDateLabel}
            </span>
          </div>

          {/* Decorative Green Line */}
          <div className="w-12 h-1 bg-[#059669] rounded-full mt-1.5" />
        </div>
      </div>

      {/* 2. Top Metrics (COLLECTED / PAID OUT / NET FLOW) */}
      <div className="pdf-section grid grid-cols-3 gap-3 pt-0.5">
        <div className="border border-[#bbf7d0] rounded-xl p-3 bg-white">
          <span className="text-[9.5px] font-bold text-[#16a34a] uppercase tracking-wider block">COLLECTED</span>
          <span className="text-lg font-black text-[#16a34a] block mt-0.5 font-mono">
            {formatCurrency(periodStats.totalCollected)}
          </span>
        </div>

        <div className="border border-[#e2e8f0] rounded-xl p-3 bg-white">
          <span className="text-[9.5px] font-bold text-[#64748b] uppercase tracking-wider block">PAID OUT</span>
          <span className="text-lg font-black text-[#0f172a] block mt-0.5 font-mono">
            {formatCurrency(periodStats.totalPaidOut)}
          </span>
        </div>

        <div className={`border rounded-xl p-3 bg-white ${periodStats.netFlow < 0 ? 'border-[#fecaca]' : 'border-[#bbf7d0]'}`}>
          <span className={`text-[9.5px] font-bold uppercase tracking-wider block ${periodStats.netFlow < 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
            NET FLOW
          </span>
          <span className={`text-lg font-black block mt-0.5 font-mono ${periodStats.netFlow < 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
            {periodStats.netFlow < 0 ? '-' : ''}{formatCurrency(Math.abs(periodStats.netFlow))}
          </span>
        </div>
      </div>

      {/* 3. COLLECTIONS BY MONTH */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">COLLECTIONS BY MONTH</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {periodStats.monthsInPeriod.length} {periodStats.monthsInPeriod.length === 1 ? 'month' : 'months'}
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2 px-3.5 font-semibold">Month</th>
              <th className="py-2 px-3 text-right font-semibold">Collected</th>
              <th className="py-2 px-3.5 text-right font-semibold">Paid out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {periodStats.monthsInPeriod.map((m: any, idx: number) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="py-2 px-3.5 font-bold text-[#0f172a]">{m.label}</td>
                <td className="py-2 px-3 text-right font-mono font-bold text-[#0f172a]">
                  {formatCurrency(m.collected)}
                </td>
                <td className="py-2 px-3.5 text-right font-mono font-medium text-[#64748b]">
                  {formatCurrency(m.paidOut)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. WHO PAID */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">WHO PAID</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {periodStats.payingMembersCount} {periodStats.payingMembersCount === 1 ? 'member' : 'members'}
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2 px-3.5 font-semibold w-10">#</th>
              <th className="py-2 px-3 font-semibold">Member</th>
              <th className="py-2 px-3 text-center font-semibold">Payments</th>
              <th className="py-2 px-3.5 text-right font-semibold">Collected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {periodStats.topContributors.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-center text-slate-400">No collections in this period.</td>
              </tr>
            ) : (
              periodStats.topContributors.map((c: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3.5 font-bold text-slate-400">{idx + 1}</td>
                  <td className="py-2 px-3 font-bold text-[#0f172a]">{c.name}</td>
                  <td className="py-2 px-3 text-center font-medium text-slate-600">{c.paymentCount}</td>
                  <td className="py-2 px-3.5 text-right font-mono font-bold text-[#0f172a]">
                    {formatCurrency(c.totalPaid)}
                  </td>
                </tr>
              ))
            )}
            {periodStats.topContributors.length > 0 && (
              <tr className="bg-[#f8fafc] font-black border-t border-[#e2e8f0]">
                <td colSpan={3} className="py-2 px-3.5 text-[#0f172a]">Total collected</td>
                <td className="py-2 px-3.5 text-right font-mono text-[#16a34a]">
                  {formatCurrency(periodStats.totalCollected)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. PAYOUTS MADE */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">PAYOUTS MADE</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {periodStats.payoutsMadeList.length} {periodStats.payoutsMadeList.length === 1 ? 'recipient' : 'recipients'}
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2 px-3.5 font-semibold w-10">#</th>
              <th className="py-2 px-3 font-semibold">Member</th>
              <th className="py-2 px-3 text-center font-semibold">Payouts</th>
              <th className="py-2 px-3.5 text-right font-semibold">Paid out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {periodStats.payoutsMadeList.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-center text-slate-400">No payouts made in this period.</td>
              </tr>
            ) : (
              periodStats.payoutsMadeList.map((p: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3.5 font-bold text-slate-400">{idx + 1}</td>
                  <td className="py-2 px-3 font-bold text-[#0f172a]">{p.name}</td>
                  <td className="py-2 px-3 text-center font-medium text-slate-600">{p.payoutCount}</td>
                  <td className="py-2 px-3.5 text-right font-mono font-bold text-[#0f172a]">
                    {formatCurrency(p.totalPaid)}
                  </td>
                </tr>
              ))
            )}
            {periodStats.payoutsMadeList.length > 0 && (
              <tr className="bg-[#f8fafc] font-black border-t border-[#e2e8f0]">
                <td colSpan={3} className="py-2 px-3.5 text-[#0f172a]">Total paid out</td>
                <td className="py-2 px-3.5 text-right font-mono text-[#0f172a]">
                  {formatCurrency(periodStats.totalPaidOut)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 6. HOW MEMBERS PAID */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">HOW MEMBERS PAID</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {periodStats.paymentMethodsList.length} {periodStats.paymentMethodsList.length === 1 ? 'method' : 'methods'}
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2 px-3.5 font-semibold">Method</th>
              <th className="py-2 px-3 text-center font-semibold">Payments</th>
              <th className="py-2 px-3.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {periodStats.paymentMethodsList.map((m: any, idx: number) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="py-2 px-3.5 font-bold text-[#0f172a]">{m.method}</td>
                <td className="py-2 px-3 text-center font-medium text-slate-600">{m.count}</td>
                <td className="py-2 px-3.5 text-right font-mono font-bold text-[#0f172a]">
                  {formatCurrency(m.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

// ── PIXEL-PERFECT PAYOUTS REPORT PDF VIEW COMPONENT ────────────────────────
interface PayoutsPDFViewProps {
  selectedGroup: any;
  payoutsStats: any;
  formatCurrency: (val: number) => string;
  organizerCompanyName: string;
  organizerInitials: string;
}

function PayoutsPDFView({
  selectedGroup,
  payoutsStats,
  formatCurrency,
  organizerCompanyName,
  organizerInitials
}: PayoutsPDFViewProps) {
  const generationDateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }) + ', ' + new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toLowerCase();

  return (
    <div className="p-6 space-y-4 bg-white text-[#0f172a] font-sans antialiased text-[12.5px] leading-normal select-none">
      
      {/* 1. Header & Title Section */}
      <div className="pdf-section space-y-2 pb-1 border-b border-[#f1f5f9]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0">
              {organizerInitials || 'CF'}
            </div>
            <div>
              <span className="font-extrabold text-base text-[#0f172a] tracking-tight block leading-tight">
                {organizerCompanyName}
              </span>
              <span className="text-[10px] text-[#64748b] font-medium block">
                Official Chit Funds Ledger
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">PAYOUTS REPORT</div>
            <div className="text-[10px] text-[#94a3b8] font-mono mt-0.5">{generationDateStr}</div>
          </div>
        </div>

        {/* Title & Group Pills */}
        <div className="space-y-1.5 pt-1">
          <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">
            {selectedGroup?.name || 'Group'} · Payouts
          </h1>
          
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {selectedGroup?.name || 'Chit Group'}
            </span>
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              Chit Value: {formatCurrency(Number(selectedGroup?.total_value || 0))}
            </span>
            <span className="inline-block bg-[#eaf8f0] text-[#16a34a] text-xs font-bold px-3 py-0.5 rounded-md border border-[#bbf7d0]">
              {payoutsStats.winnersCount} of {payoutsStats.totalMembers} won ({payoutsStats.progressPercent}%)
            </span>
          </div>

          {/* Decorative Green Line */}
          <div className="w-12 h-1 bg-[#059669] rounded-full mt-1.5" />
        </div>
      </div>

      {/* 2. Top Metrics (WINNERS / REMAINING / OUTSTANDING) */}
      <div className="pdf-section grid grid-cols-3 gap-3 pt-0.5">
        <div className="border border-[#bbf7d0] rounded-xl p-3.5 bg-[#f0fdf4]">
          <span className="text-[9.5px] font-bold text-[#16a34a] uppercase tracking-wider block">WINNERS</span>
          <span className="text-xl font-black text-[#16a34a] block mt-1 font-mono">
            {payoutsStats.winnersCount}
          </span>
        </div>

        <div className="border border-[#fef08a] rounded-xl p-3.5 bg-[#fefce8]">
          <span className="text-[9.5px] font-bold text-[#b45309] uppercase tracking-wider block">REMAINING</span>
          <span className="text-xl font-black text-[#b45309] block mt-1 font-mono">
            {payoutsStats.remainingCount}
          </span>
        </div>

        <div className={`border rounded-xl p-3.5 bg-white ${
          payoutsStats.outstandingTotal > 0 ? 'border-[#fecaca] bg-[#fff5f5]' : 'border-[#e2e8f0]'
        }`}>
          <span className={`text-[9.5px] font-bold uppercase tracking-wider block ${
            payoutsStats.outstandingTotal > 0 ? 'text-[#dc2626]' : 'text-[#64748b]'
          }`}>
            OUTSTANDING
          </span>
          <span className={`text-xl font-black block mt-1 font-mono ${
            payoutsStats.outstandingTotal > 0 ? 'text-[#dc2626]' : 'text-[#0f172a]'
          }`}>
            {formatCurrency(payoutsStats.outstandingTotal)}
          </span>
        </div>
      </div>

      {/* 3. WINNER PAYOUTS Table Card */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">WINNER PAYOUTS</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {payoutsStats.winnersList.length} recipients
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2.5 px-3.5 w-12 font-semibold">Month</th>
              <th className="py-2.5 px-3 font-semibold">Winner</th>
              <th className="py-2.5 px-3 font-semibold">Method</th>
              <th className="py-2.5 px-3 font-semibold text-right">Awarded</th>
              <th className="py-2.5 px-3 font-semibold text-right">Paid</th>
              <th className="py-2.5 px-3 font-semibold text-right">Pending</th>
              <th className="py-2.5 px-3.5 font-semibold text-center w-24">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {payoutsStats.winnersList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-5 text-center text-xs text-slate-400">
                  No auction prize disbursements recorded yet for this group.
                </td>
              </tr>
            ) : (
              payoutsStats.winnersList.map((w: any) => (
                <tr key={w.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3.5 text-[#64748b] font-mono text-[11px] font-bold">M{w.month}</td>
                  <td className="py-2.5 px-3 font-bold text-[#0f172a]">{w.winnerName}</td>
                  <td className="py-2.5 px-3 text-[#64748b] text-[11px]">{w.subtitle.split('·')[1]?.trim() || 'Cash'}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-medium text-[#64748b]">{formatCurrency(w.awardedAmount)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-[#16a34a]">
                    {w.amountPaid > 0 ? formatCurrency(w.amountPaid) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-[#dc2626]">
                    {w.outstanding > 0 ? formatCurrency(w.outstanding) : '—'}
                  </td>
                  <td className="py-2.5 px-3.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      w.status === 'Complete'
                        ? 'bg-[#eaf8f0] text-[#16a34a] border-[#bbf7d0]'
                        : w.status === 'Partial'
                        ? 'bg-[#fef9ea] text-[#b45309] border-[#fde68a]'
                        : 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
                    }`}>
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Footer */}
      <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[10px] text-[#94a3b8]">
        <div className="flex items-center gap-1.5 font-bold text-[#64748b]">
          <span>{organizerCompanyName}</span>
        </div>
        <span className="font-medium text-[#64748b]">Confidential</span>
        <span className="font-mono">{generationDateStr} · Page 1 of 1</span>
      </div>

    </div>
  );
}

// ── PIXEL-PERFECT MEMBER STATEMENT PDF VIEW COMPONENT ───────────────────────
interface MemberPDFViewProps {
  selectedGroup: any;
  memberStatementStats: any;
  formatCurrency: (val: number) => string;
  organizerCompanyName: string;
  organizerInitials: string;
}

function MemberPDFView({
  selectedGroup,
  memberStatementStats,
  formatCurrency,
  organizerCompanyName,
  organizerInitials
}: MemberPDFViewProps) {
  const generationDateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }) + ', ' + new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toLowerCase();

  return (
    <div className="p-6 space-y-4 bg-white text-[#0f172a] font-sans antialiased text-[12.5px] leading-normal select-none">
      
      {/* 1. Header & Title Section */}
      <div className="pdf-section space-y-2 pb-1 border-b border-[#f1f5f9]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0">
              {organizerInitials || 'CF'}
            </div>
            <div>
              <span className="font-extrabold text-base text-[#0f172a] tracking-tight block leading-tight">
                {organizerCompanyName}
              </span>
              <span className="text-[10px] text-[#64748b] font-medium block">
                Official Chit Funds Ledger
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">MEMBER STATEMENT</div>
            <div className="text-[10px] text-[#94a3b8] font-mono mt-0.5">{generationDateStr}</div>
          </div>
        </div>

        {/* Title & Member Pills */}
        <div className="space-y-1.5 pt-1">
          <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">
            {memberStatementStats.memberName} · Statement
          </h1>
          
          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {selectedGroup?.name || 'Chit Group'}
            </span>
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              Ticket #{memberStatementStats.ticketNumber}
            </span>
            {memberStatementStats.phoneNumber && (
              <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
                {memberStatementStats.phoneNumber}
              </span>
            )}
          </div>

          {/* Decorative Green Line */}
          <div className="w-12 h-1 bg-[#059669] rounded-full mt-1.5" />
        </div>
      </div>

      {/* Winner & Prize Payout Status Card (if won) */}
      {memberStatementStats.hasWon && (
        <div className="pdf-section bg-[#fefce8] border border-[#fde68a] rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#b45309] font-bold text-xs">
              <span>🏆</span>
              <span>Won Auction · {memberStatementStats.winningDateLabel}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              memberStatementStats.payoutStatus === 'Settled'
                ? 'bg-[#eaf8f0] text-[#16a34a] border-[#bbf7d0]'
                : memberStatementStats.payoutStatus === 'Partial'
                ? 'bg-[#fef9ea] text-[#b45309] border-[#fde68a]'
                : 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
            }`}>
              {memberStatementStats.payoutStatus === 'Settled' ? 'Prize Settled' : memberStatementStats.payoutStatus === 'Partial' ? 'Partial Payout' : 'Payout Pending'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#fde68a]/60">
            <div className="bg-white/90 rounded-lg p-2 border border-[#fde68a]/50">
              <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-wider block">NET PRIZE POT</span>
              <span className="text-xs font-black text-[#0f172a] block font-mono mt-0.5">
                {formatCurrency(memberStatementStats.netPrizePot)}
              </span>
            </div>
            <div className="bg-white/90 rounded-lg p-2 border border-[#bbf7d0]">
              <span className="text-[9px] font-bold text-[#16a34a] uppercase tracking-wider block">DISBURSED</span>
              <span className="text-xs font-black text-[#16a34a] block font-mono mt-0.5">
                {formatCurrency(memberStatementStats.prizePaid)}
              </span>
            </div>
            <div className="bg-white/90 rounded-lg p-2 border border-[#fecaca]">
              <span className="text-[9px] font-bold text-[#dc2626] uppercase tracking-wider block">PENDING</span>
              <span className="text-xs font-black text-[#dc2626] block font-mono mt-0.5">
                {formatCurrency(memberStatementStats.prizePending)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Metrics (TOTAL DUE / PAID / OWES) */}
      <div className="pdf-section grid grid-cols-3 gap-3 pt-0.5">
        <div className="border border-[#e2e8f0] rounded-xl p-3.5 bg-white">
          <span className="text-[9.5px] font-bold text-[#64748b] uppercase tracking-wider block">TOTAL DUE</span>
          <span className="text-xl font-black text-[#0f172a] block mt-1 font-mono">
            {formatCurrency(memberStatementStats.totalDue)}
          </span>
        </div>

        <div className="border border-[#bbf7d0] rounded-xl p-3.5 bg-[#f0fdf4]">
          <span className="text-[9.5px] font-bold text-[#16a34a] uppercase tracking-wider block">PAID</span>
          <span className="text-xl font-black text-[#16a34a] block mt-1 font-mono">
            {formatCurrency(memberStatementStats.totalPaid)}
          </span>
        </div>

        <div className={`border rounded-xl p-3.5 bg-white ${
          memberStatementStats.totalOwes > 0 ? 'border-[#fecaca] bg-[#fff5f5]' : 'border-[#e2e8f0]'
        }`}>
          <span className={`text-[9.5px] font-bold uppercase tracking-wider block ${
            memberStatementStats.totalOwes > 0 ? 'text-[#dc2626]' : 'text-[#64748b]'
          }`}>
            OWES
          </span>
          <span className={`text-xl font-black block mt-1 font-mono ${
            memberStatementStats.totalOwes > 0 ? 'text-[#dc2626]' : 'text-[#0f172a]'
          }`}>
            {formatCurrency(memberStatementStats.totalOwes)}
          </span>
        </div>
      </div>

      {/* 3. Monthly Breakdown Table */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">MONTHLY BREAKDOWN</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {memberStatementStats.monthRows.length} months
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2.5 px-3.5 w-12 font-semibold">Month</th>
              <th className="py-2.5 px-3 font-semibold">Period</th>
              <th className="py-2.5 px-3 font-semibold text-right">Expected</th>
              <th className="py-2.5 px-3 font-semibold text-right">Paid</th>
              <th className="py-2.5 px-3 font-semibold text-right">Pending</th>
              <th className="py-2.5 px-3.5 font-semibold text-center w-24">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {memberStatementStats.monthRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-5 text-center text-xs text-slate-400">
                  No monthly installments recorded yet.
                </td>
              </tr>
            ) : (
              memberStatementStats.monthRows.map((r: any) => (
                <tr key={r.month} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3.5 text-[#64748b] font-mono text-[11px] font-bold">M{r.month}</td>
                  <td className="py-2.5 px-3 font-bold text-[#0f172a]">{r.dateLabel}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-medium text-[#64748b]">{formatCurrency(r.expected)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-[#16a34a]">{formatCurrency(r.paid)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-[#dc2626]">
                    {r.pendingDue > 0 ? formatCurrency(r.pendingDue) : '—'}
                  </td>
                  <td className="py-2.5 px-3.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      r.status === 'Paid'
                        ? 'bg-[#eaf8f0] text-[#16a34a] border-[#bbf7d0]'
                        : r.status === 'Late'
                        ? 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-[#e2e8f0] bg-[#fafafa]">
            <tr>
              <td colSpan={2} className="py-3 px-3.5 font-extrabold text-[#0f172a] text-xs">
                Totals
              </td>
              <td className="py-3 px-3 text-right font-mono font-bold text-[#0f172a] text-xs">
                {formatCurrency(memberStatementStats.totalDue)}
              </td>
              <td className="py-3 px-3 text-right font-mono font-black text-[#16a34a] text-xs">
                {formatCurrency(memberStatementStats.totalPaid)}
              </td>
              <td className="py-3 px-3 text-right font-mono font-black text-[#dc2626] text-xs">
                {formatCurrency(memberStatementStats.totalOwes)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 4. Footer */}
      <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[10px] text-[#94a3b8]">
        <div className="flex items-center gap-1.5 font-bold text-[#64748b]">
          <span>{organizerCompanyName}</span>
        </div>
        <span className="font-medium text-[#64748b]">Confidential</span>
        <span className="font-mono">{generationDateStr} · Page 1 of 1</span>
      </div>

    </div>
  );
}

// ── PIXEL-PERFECT MEMBER RELIABILITY & TRUST INDEX PDF VIEW COMPONENT ──────
interface ReliabilityPDFViewProps {
  selectedGroup: any;
  reliabilityStats: any;
  formatCurrency: (val: number) => string;
  organizerCompanyName: string;
  organizerInitials: string;
}

function ReliabilityPDFView({
  selectedGroup,
  reliabilityStats,
  formatCurrency,
  organizerCompanyName,
  organizerInitials
}: ReliabilityPDFViewProps) {
  const generationDateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }) + ', ' + new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).toLowerCase();

  return (
    <div className="p-6 space-y-4 bg-white text-[#0f172a] font-sans antialiased text-[12.5px] leading-normal select-none">
      
      {/* 1. Header & Title Section */}
      <div className="pdf-section space-y-2 pb-1 border-b border-[#f1f5f9]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0f172a] flex items-center justify-center text-white font-black text-xs shadow-xs shrink-0">
              {organizerInitials || 'CF'}
            </div>
            <div>
              <span className="font-extrabold text-base text-[#0f172a] tracking-tight block leading-tight">
                {organizerCompanyName}
              </span>
              <span className="text-[10px] text-[#64748b] font-medium block">
                Official Chit Funds Ledger
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">RELIABILITY REPORT</div>
            <div className="text-[10px] text-[#94a3b8] font-mono mt-0.5">{generationDateStr}</div>
          </div>
        </div>

        {/* Title & Group Pills */}
        <div className="space-y-1.5 pt-1">
          <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">
            Member Reliability · Who Pays On Time
          </h1>
          
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {selectedGroup?.name || 'Chit Group'}
            </span>
            <span className="inline-block bg-[#f1f5f9] text-[#334155] text-xs font-bold px-3 py-0.5 rounded-md border border-[#e2e8f0]">
              {reliabilityStats.memberList.length} Subscribers
            </span>
          </div>

          {/* Decorative Green Line */}
          <div className="w-12 h-1 bg-[#059669] rounded-full mt-1.5" />
        </div>
      </div>

      {/* 2. Top 3 Pastel Metric Cards */}
      <div className="pdf-section grid grid-cols-3 gap-3 pt-0.5">
        <div className="border border-[#bbf7d0] rounded-xl p-3.5 bg-[#eaf8f0]">
          <span className="text-[10px] font-bold text-[#16a34a] flex items-center gap-1.5 uppercase tracking-wider block">
            <span className="inline-block w-2 h-2 rounded-full bg-[#16a34a]" /> Reliable
          </span>
          <span className="text-2xl font-black text-[#0f172a] block mt-1 font-mono">
            {reliabilityStats.reliableCount}
          </span>
        </div>

        <div className="border border-[#fde68a] rounded-xl p-3.5 bg-[#fef9ea]">
          <span className="text-[10px] font-bold text-[#b45309] flex items-center gap-1.5 uppercase tracking-wider block">
            <span className="inline-block w-2 h-2 rounded-full bg-[#b45309]" /> Watch
          </span>
          <span className="text-2xl font-black text-[#0f172a] block mt-1 font-mono">
            {reliabilityStats.watchCount}
          </span>
        </div>

        <div className="border border-[#fecaca] rounded-xl p-3.5 bg-[#fef2f2]">
          <span className="text-[10px] font-bold text-[#dc2626] flex items-center gap-1.5 uppercase tracking-wider block">
            <span className="inline-block w-2 h-2 rounded-full bg-[#dc2626]" /> At Risk
          </span>
          <span className="text-2xl font-black text-[#0f172a] block mt-1 font-mono">
            {reliabilityStats.atRiskCount}
          </span>
        </div>
      </div>

      {/* Attention Subtitle */}
      {reliabilityStats.attentionCount > 0 && (
        <div className="pdf-section px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-xs font-semibold text-[#dc2626]">
          <strong>{reliabilityStats.attentionCount} members</strong> need attention — prioritized first in ledger.
        </div>
      )}

      {/* 3. Reliability Index Table */}
      <div className="pdf-section border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
        <div className="px-3.5 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#475569] uppercase tracking-wider">SUBSCRIBER RELIABILITY MATRIX</span>
          <span className="text-[10px] font-semibold text-[#64748b] bg-[#e2e8f0] px-2 py-0.5 rounded">
            {reliabilityStats.memberList.length} members
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase font-bold text-[#94a3b8] bg-[#fdfdfd] border-b border-[#f1f5f9]">
            <tr>
              <th className="py-2.5 px-3.5 w-10 font-semibold">Rank</th>
              <th className="py-2.5 px-3 font-semibold">Subscriber</th>
              <th className="py-2.5 px-3 font-semibold text-center w-20">Trust Score</th>
              <th className="py-2.5 px-3 font-semibold text-right">On-Time</th>
              <th className="py-2.5 px-3 font-semibold text-right">Unpaid</th>
              <th className="py-2.5 px-3 font-semibold text-right">Avg Delay</th>
              <th className="py-2.5 px-3.5 font-semibold text-center w-24">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {reliabilityStats.memberList.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-5 text-center text-xs text-slate-400">
                  No member payment history recorded yet.
                </td>
              </tr>
            ) : (
              reliabilityStats.memberList.map((m: any, idx: number) => (
                <tr key={m.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3.5 text-[#64748b] font-mono text-[11px] font-bold">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-[#0f172a] block">{m.name}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">Ticket #{m.ticket}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`font-mono font-black text-sm ${
                      m.status === 'Reliable' ? 'text-[#16a34a]' : m.status === 'Watch' ? 'text-[#b45309]' : 'text-[#dc2626]'
                    }`}>
                      {m.score}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0f172a]">
                    {m.onTimeCount}/{m.evaluatedMonthsCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#dc2626]">
                    {m.unpaidCount}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-medium text-[#64748b]">
                    {m.avgLateDays > 0 ? `${m.avgLateDays}d` : '0d'}
                  </td>
                  <td className="py-2.5 px-3.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      m.status === 'Reliable'
                        ? 'bg-[#eaf8f0] text-[#16a34a] border-[#bbf7d0]'
                        : m.status === 'Watch'
                        ? 'bg-[#fef9ea] text-[#b45309] border-[#fde68a]'
                        : 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Footer */}
      <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[10px] text-[#94a3b8]">
        <div className="flex items-center gap-1.5 font-bold text-[#64748b]">
          <span>{organizerCompanyName}</span>
        </div>
        <span className="font-medium text-[#64748b]">Confidential</span>
        <span className="font-mono">{generationDateStr} · Page 1 of 1</span>
      </div>

    </div>
  );
}


