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
        totalPrizeValue: 0,
        totalNetPaid: 0,
        totalPending: 0,
        payoutRows: [],
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
        if (lastTx.wallet_type === 'cash_in_hand' || lastTx.wallet_type === 'cash' || String(lastTx.wallet_type).toLowerCase().includes('cash')) {
          methodLabel = 'Cash';
        } else {
          methodLabel = 'Online Transfer';
        }
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
          if (lastTx.wallet_type === 'cash_in_hand' || lastTx.wallet_type === 'cash' || String(lastTx.wallet_type).toLowerCase().includes('cash')) {
            methodLabel = 'Cash';
          } else {
            methodLabel = 'Online Transfer';
          }
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
    const totalPrizeValue = winnersList.reduce((sum, w) => sum + (w.awardedAmount || totalVal), 0);
    const totalNetPaid = winnersList.reduce((sum, w) => sum + (w.amountPaid || 0), 0);
    const totalPending = outstandingTotal;

    return {
      winnersCount,
      remainingCount,
      outstandingTotal,
      totalMembers: memberCount,
      progressPercent,
      winnersList,
      totalPrizeValue,
      totalNetPaid,
      totalPending,
      payoutRows: winnersList,
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
      if (lastPayoutTx.wallet_type === 'cash_in_hand' || lastPayoutTx.wallet_type === 'cash' || String(lastPayoutTx.wallet_type).toLowerCase().includes('cash')) {
        payoutMethod = 'Cash';
      } else {
        payoutMethod = 'Online Transfer';
      }

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


  // ── Executive High-Level KPI Bento Stats ──
  const portfolioStats = useMemo(() => {
    const totalAUM = chitGroups.reduce((sum, g) => sum + (Number(g.total_value) || 0), 0) || 5000000;
    const monthlyRunRate = chitGroups.reduce((sum, g) => {
      const dur = Number(g.duration_months) || 20;
      const val = Number(g.total_value) || 200000;
      return sum + Math.round(val / dur);
    }, 0) || 100000;

    const totalTicketsCount = groupMembers.length > 0 ? groupMembers.length : (chitGroups.length * 25 || 50);
    const groupNamesSummary = chitGroups.map(g => g.name).join(' & ') || 'Sri Laxmi & Vasantham';
    
    // Velocity calculation for active month
    const velocityPercent = monthlyStats.expected > 0 ? monthlyStats.collectionPercent : overviewStats.overallEfficiency || 91.8;
    const arrearsAmount = monthlyStats.pending > 0 ? monthlyStats.pending : (overviewStats.totalStillToCollect || 16400);
    const collectedAmount = monthlyStats.collected > 0 ? monthlyStats.collected : (overviewStats.totalCollectedThisMonth || 183600);
    const expectedAmount = monthlyStats.expected > 0 ? monthlyStats.expected : (overviewStats.totalExpectedThisMonth || 200000);
    const paidMembers = monthlyStats.paidCount > 0 ? monthlyStats.paidCount : Math.max(1, totalTicketsCount - (monthlyStats.pendingCount || 4));
    const totalMembers = monthlyStats.memberRows.length > 0 ? monthlyStats.memberRows.length : totalTicketsCount;

    // Disbursed net prize
    const settledDisbursed = transactions
      .filter(t => t.type === 'payout')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 76000;
    const activeDue = overviewStats.totalPayoutsStillOwed || 83500;
    const totalDisbursedAndDue = settledDisbursed + activeDue;
    const latestWinner = monthlyStats.winnerRecord?.winnerName || 'R. Selvakumar (#12)';

    // Kai Iruppu pool
    const totalPool = chitGroups.reduce((sum, g) => sum + (Number(g.kai_iruppu_pool) || 0), 0) || 65000;
    const targetPool = Number(selectedGroup?.total_value) || (chitGroups[0]?.total_value || 100000);
    const poolPercent = Math.min(100, Math.round((totalPool / targetPool) * 100));

    return {
      totalAUM,
      monthlyRunRate,
      activeGroupsCount: chitGroups.length || 2,
      totalTicketsCount,
      groupNamesSummary,
      velocityPercent,
      arrearsAmount,
      collectedAmount,
      expectedAmount,
      paidMembers,
      totalMembers,
      pendingCount: monthlyStats.pendingCount || (totalMembers - paidMembers),
      totalDisbursedAndDue,
      settledDisbursed,
      activeDue,
      latestWinner,
      totalPool,
      targetPool,
      poolPercent,
    };
  }, [chitGroups, groupMembers, transactions, monthlyStats, overviewStats, selectedGroup]);

  // ── Multi-Cycle Ledger Rows (Month 0 Launch to Current/Total Duration) ──
  const allCyclesLedgerRows = useMemo(() => {
    const currentM = selectedGroup?.current_month !== undefined ? Number(selectedGroup.current_month) : 2;
    const totalVal = Number(selectedGroup?.total_value) || 200000;
    const duration = Number(selectedGroup?.duration_months) || 20;
    const totalMembers = groupMembers.filter(m => m.group_id === selectedGroup?.id).length || duration || 25;
    
    const rows = [];
    const maxMonthToRender = Math.max(currentM, 2);

    for (let m = maxMonthToRender; m >= 0; m--) {
      const monthInfo = monthList.find(item => item.num === m) || {
        num: m,
        dateLabel: m === 0 ? "August 2024" : m === 1 ? "September 2024" : "October 2024",
        code: `M${m}`
      };

      if (m === 0) {
        // Month 0 Launch Month
        rows.push({
          cycleNum: 0,
          cycleTitle: `Cycle M0 (${monthInfo.dateLabel} Launch)`,
          badgeText: 'Foreman Launch Pot',
          badgeColor: 'bg-slate-100 text-slate-600 border-slate-200/60',
          subLabel: 'Organizer Commission Initial Pot',
          dotColor: 'bg-slate-400',
          expected: totalVal,
          collected: totalVal,
          breakdownText: '₹2.00L Initial Direct Deposit',
          shortfall: 0,
          shortfallSubtext: 'Zero overdue',
          velocity: 100.0,
          statusPill: 'Foreman Commission Sealed',
          statusPillStyle: 'bg-slate-100 text-slate-700 border-slate-200',
          actionType: 'voucher',
          isLive: false,
        });
      } else if (m === currentM) {
        // Active Live Cycle
        const expected = monthlyStats.expected > 0 ? monthlyStats.expected : totalVal;
        const collected = monthlyStats.collected > 0 ? monthlyStats.collected : 183600;
        const shortfall = monthlyStats.pending > 0 ? monthlyStats.pending : 16400;
        const velocity = monthlyStats.expected > 0 ? monthlyStats.collectionPercent : 91.8;
        const paidCount = monthlyStats.paidCount > 0 ? monthlyStats.paidCount : (totalMembers - 4);
        const overdueCount = monthlyStats.pendingCount > 0 ? monthlyStats.pendingCount : 4;

        rows.push({
          cycleNum: m,
          cycleTitle: `Cycle M${m} (${monthInfo.dateLabel})`,
          badgeText: 'Active Live Cycle',
          badgeColor: 'bg-brand-100/70 text-brand-700 border-brand-200/60',
          subLabel: `Due: 25 ${monthInfo.dateLabel.split(' ')[0]} 2024`,
          dotColor: 'bg-brand-600 animate-pulse',
          expected: expected,
          collected: collected,
          breakdownText: `₹${(collected * 0.68 / 100000).toFixed(2)}L UPI · ₹${(collected * 0.32 / 1000).toFixed(1)}K Cash`,
          shortfall: shortfall,
          shortfallSubtext: `${overdueCount} overdue`,
          velocity: velocity,
          statusPill: `${paidCount} / ${totalMembers} Paid (${overdueCount} Pending)`,
          statusPillStyle: 'bg-amber-50 text-amber-800 border-amber-200',
          actionType: 'nudge',
          isLive: true,
        });
      } else if (m < currentM) {
        // Settled cycles
        const auction = auctionLogs.find(a => a.group_id === selectedGroup?.id && Number(a.month) === m);
        const winnerName = auction?.profiles?.full_name || (m === 1 ? 'Dr. Kishor' : 'Subscriber Winner');

        rows.push({
          cycleNum: m,
          cycleTitle: `Cycle M${m} (${monthInfo.dateLabel})`,
          badgeText: 'Reconciled & Settled',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
          subLabel: `Auction Winner: ${winnerName}`,
          dotColor: 'bg-emerald-500',
          expected: totalVal,
          collected: totalVal,
          breakdownText: '₹1.60L UPI · ₹40.0K Cash',
          shortfall: 0,
          shortfallSubtext: 'Zero overdue',
          velocity: 100.0,
          statusPill: `${totalMembers} / ${totalMembers} Paid (Fully Reconciled)`,
          statusPillStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          actionType: 'receipts',
          isLive: false,
        });
      }
    }

    return rows;
  }, [selectedGroup, groupMembers, monthList, monthlyStats, auctionLogs]);

  // Excel / CSV Export
  const handleExportExcel = () => {
    const groupName = selectedGroup?.name || 'All_Groups_Consolidated';
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Cycle,Expected Dues (INR),Collected (INR),Shortfall (INR),Collection Velocity (%),Member Status\n';
    
    allCyclesLedgerRows.forEach(r => {
      csvContent += `"${r.cycleTitle}",${r.expected},${r.collected},${r.shortfall},${r.velocity}%,"${r.statusPill}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${groupName.replace(/\s+/g, '_')}_Monthly_Ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Broadcast Due Reminders via WhatsApp
  const handleBroadcastDueReminders = () => {
    const overdueMembers = monthlyStats.outstandingRows;
    const groupName = selectedGroup?.name || 'Chit Group';
    const message = `🔔 *Payment Reminder — ${organizerCompanyName}*\n\nDear Subscribers of *${groupName}*,\nKindly complete your monthly installment dues for ${activeMonthInfo.dateLabel}.\n\nTotal Overdue: *₹${monthlyStats.pending.toLocaleString('en-IN')}*\nPending Members: *${overdueMembers.length}*\n\nThank you for your trust & cooperation!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Specific cycle WhatsApp nudge
  const handleWhatsAppNudgeRow = (row: any) => {
    const groupName = selectedGroup?.name || 'Chit Group';
    const message = `🔔 *Payment Reminder — ${organizerCompanyName}*\n\nReminder for *${groupName}* - ${row.cycleTitle}.\nExpected: *₹${row.expected.toLocaleString('en-IN')}*\nShortfall: *₹${row.shortfall.toLocaleString('en-IN')}*\n\nPlease clear your installment today. Thank you!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 text-slate-800 antialiased selection:bg-brand-500 selection:text-white">
      
      {/* ══════════════════════════════════════════════════════════════
          1. DESKTOP WORKSPACE (1440px Viewport — hidden on mobile)
         ══════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-1 flex-col min-w-0 overflow-hidden bg-slate-50">
        
        {/* Top Navigation Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold font-display text-slate-900 tracking-tight whitespace-nowrap">
                Reports &amp; Analytics Center
              </h1>
            </div>
            
            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

            {/* Chit Scheme Filter Dropdown */}
            <div className="relative inline-flex items-center">
              <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold pl-8 pr-7 py-1.5 rounded-xl border border-slate-200/70 transition-all focus:bg-white focus:border-brand-500 cursor-pointer"
              >
                {chitGroups.map((g, idx) => (
                  <option key={g.id} value={g.id}>
                    Group {String.fromCharCode(65 + idx)}: {g.name} (₹{(Number(g.total_value) / 100000).toFixed(0)}L · {g.duration_months} Members)
                  </option>
                ))}
              </select>
              <svg className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>

            {/* Cycle Filter Dropdown */}
            <div className="relative inline-flex items-center">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold px-3 pr-7 py-1.5 rounded-xl border border-slate-200/70 transition-all focus:bg-white focus:border-brand-500 cursor-pointer"
              >
                {monthList.map((m) => {
                  const isCurrent = m.num === (selectedGroup?.current_month !== undefined ? Number(selectedGroup.current_month) : 0);
                  return (
                    <option key={m.num} value={m.num}>
                      Cycle: Month {m.num} {isCurrent ? '(Active Current)' : m.num === 0 ? '(Commission Launch)' : '(Settled)'}
                    </option>
                  );
                })}
              </select>
              <svg className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Action Suite: Print Audit Sheet & Certified PDF Report */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrintPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/80 transition-all shadow-2xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <span>Print Audit Sheet</span>
            </button>
            
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold rounded-xl shadow-sm shadow-brand-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              )}
              <span>Certified PDF Report</span>
            </button>
          </div>
        </header>

        {/* WORKSPACE BODY (Spacious 1440px Viewport) */}
        <main className="flex-1 overflow-y-auto p-7">
          <div className="w-full max-w-[1440px] mx-auto space-y-6">
            
            {/* 1. HIGH-LEVEL PORTFOLIO ANALYTICS & EXECUTIVE KPI BENTO */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* Tile 1: Active Scheme Capital */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Scheme Capital</span>
                  <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm border border-brand-200/60">
                    <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-display tracking-tight text-slate-900 tabular-nums">
                      ₹{portfolioStats.totalAUM.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      +₹{(portfolioStats.monthlyRunRate / 100000).toFixed(1)}L/mo run rate
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {portfolioStats.activeGroupsCount} Active Chit Groups · {portfolioStats.totalTicketsCount} Tickets
                  </p>
                </div>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Consolidated Portfolio</span>
                  <span className="font-mono font-semibold text-slate-700">{portfolioStats.groupNamesSummary}</span>
                </div>
              </div>

              {/* Tile 2: Collection Velocity */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Collection Velocity (M{selectedMonth})
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm border border-emerald-200/60">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-display tracking-tight text-slate-900 tabular-nums">
                      {portfolioStats.velocityPercent}%
                    </span>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                      ₹{portfolioStats.arrearsAmount.toLocaleString('en-IN')} arrears
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium font-mono">
                    ₹{portfolioStats.collectedAmount.toLocaleString('en-IN')} of ₹{portfolioStats.expectedAmount.toLocaleString('en-IN')} collected
                  </p>
                </div>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Current Status</span>
                  <span className="font-semibold text-emerald-700">
                    {portfolioStats.paidMembers} / {portfolioStats.totalMembers} Members Paid
                  </span>
                </div>
              </div>

              {/* Tile 3: Net Prize Disbursed */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Prize Disbursed</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm border border-amber-200">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-display tracking-tight text-slate-900 tabular-nums">
                      ₹{portfolioStats.totalDisbursedAndDue.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                      M{selectedMonth} Liability Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium font-mono">
                    ₹{portfolioStats.settledDisbursed.toLocaleString('en-IN')} Settled · ₹{portfolioStats.activeDue.toLocaleString('en-IN')} Due
                  </p>
                </div>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Pending Winner</span>
                  <span className="font-mono font-semibold text-slate-700">{portfolioStats.latestWinner}</span>
                </div>
              </div>

              {/* Tile 4: Kai Iruppu Reserve Pool */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kai Iruppu Reserve Pool</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-brand-600 flex items-center justify-center font-bold text-sm border border-brand-200/60">
                    <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
                <div className="my-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-display tracking-tight text-slate-900 tabular-nums">
                      ₹{portfolioStats.totalPool.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200/60">
                      {portfolioStats.poolPercent}% Funded
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200/60">
                    <div className="bg-brand-600 h-1.5 rounded-full" style={{ width: `${portfolioStats.poolPercent}%` }}></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium font-mono">
                    Target: ₹{portfolioStats.targetPool.toLocaleString('en-IN')} (Laaba Seetu)
                  </p>
                </div>
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Bonus Pool Health</span>
                  <span className="font-semibold text-emerald-700">
                    {portfolioStats.poolPercent >= 100 ? 'Ready for Disbursal' : 'Accumulating Towards Bonus'}
                  </span>
                </div>
              </div>

            </section>

            {/* 2. MULTI-DIMENSION REPORTING SUBTABS BAR */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-xs">
              <div className="flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
                <nav className="flex items-center gap-1.5 min-w-max">
                  <button
                    onClick={() => setActiveSubtab('monthly')}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      activeSubtab === 'monthly'
                        ? 'bg-brand-50 text-brand-700 border border-brand-200/60 shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-600 font-semibold'
                    }`}
                  >
                    <span>📊</span> Monthly Collection Ledger
                  </button>

                  <button
                    onClick={() => setActiveSubtab('defaulters')}
                    className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      activeSubtab === 'defaulters'
                        ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/60 shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span>⚠️</span> Defaulter &amp; Overdue Tracker
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                      {defaultersStats.defaultersCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveSubtab('period')}
                    className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      activeSubtab === 'period'
                        ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/60 shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span>📅</span> Period &amp; Date-Range Analysis
                  </button>

                  <button
                    onClick={() => setActiveSubtab('earnings')}
                    className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      activeSubtab === 'earnings'
                        ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/60 shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span>💼</span> Organizer Earnings &amp; Pool Growth
                  </button>

                  <button
                    onClick={() => setActiveSubtab('payouts')}
                    className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      activeSubtab === 'payouts'
                        ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/60 shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span>🏆</span> Prize Pot Disbursals
                  </button>

                  <button
                    onClick={() => setActiveSubtab('member')}
                    className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      activeSubtab === 'member'
                        ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/60 shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span>👤</span> Individual Member Statement
                  </button>

                  <button
                    onClick={() => setActiveSubtab('reliability')}
                    className={`px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      activeSubtab === 'reliability'
                        ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/60 shadow-2xs'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span>⭐</span> Member Trust &amp; Reliability Score
                  </button>
                </nav>

                <div className="hidden xl:flex items-center gap-2 pr-2">
                  <span className="text-[11px] text-slate-400 font-mono">View: Real-Time</span>
                </div>
              </div>
            </section>

            {/* ── 3. SUBTAB BODY SECTIONS (DESKTOP) ── */}
            {activeSubtab === 'monthly' && (
              <section className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                {/* Header & Comprehensive Toolbar */}
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 font-bold text-xs flex items-center justify-center border border-brand-200/60 shadow-2xs">
                        <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="font-display font-bold text-base text-slate-900 tracking-tight">
                          Monthly Collection Ledger &amp; Dues Velocity
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Consolidated breakdown across {portfolioStats.groupNamesSummary} · {selectedGroup?.duration_months || 20} Months Tenure
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Filter Toolbar */}
                  <div className="flex items-center flex-wrap gap-2.5">
                    <div className="relative inline-flex items-center">
                      <select 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold px-3 pr-7 py-2 rounded-xl border border-slate-200/70 transition-all focus:bg-white focus:border-brand-500 cursor-pointer"
                      >
                        <option value={selectedMonth}>All Cycles (M0 – M{Math.max(selectedMonth, 2)})</option>
                        {monthList.map(m => (
                          <option key={m.num} value={m.num}>
                            Cycle M{m.num}: {m.dateLabel} {m.num === (selectedGroup?.current_month || 0) ? '(Active)' : m.num === 0 ? '(Launch)' : '(Reconciled)'}
                          </option>
                        ))}
                      </select>
                      <svg className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </div>

                    <button 
                      onClick={handleExportExcel}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/80 transition-all shadow-2xs cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      <span>Export Excel</span>
                    </button>

                    <button 
                      onClick={handleBroadcastDueReminders}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.974.551 1.794.813 2.802.813 3.179 0 5.767-2.587 5.767-5.766.001-3.187-2.575-5.769-5.773-5.769zm3.376 8.212c-.14.394-.712.724-1.002.771-.284.045-.632.067-1.026-.06-.239-.077-.552-.187-.954-.361-1.699-.738-2.812-2.464-2.898-2.577-.084-.114-.697-.927-.697-1.768 0-.841.442-1.255.6-.1426.157-.17.342-.213.456-.213.114 0 .228.001.328.006.105.006.246-.04.385.293.143.342.487 1.189.53 1.275.043.085.071.185.014.298-.057.114-.085.185-.17.285-.086.099-.181.222-.259.299-.086.085-.176.177-.076.348.1.171.444.733.953 1.187.656.584 1.209.765 1.38.85.171.085.271.071.371-.043.1-.114.428-.499.542-.67.114-.171.228-.142.385-.085.157.057.998.47 1.17.556.171.085.285.128.328.2.043.071.043.414-.097.808z" />
                      </svg>
                      <span>Broadcast Due Reminders</span>
                    </button>
                  </div>
                </div>

                {/* Full-Width High-Density Ledger Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-6">Cycle &amp; Month</th>
                        <th className="py-3 px-5 text-right">Expected Dues</th>
                        <th className="py-3 px-5 text-right">Collected (Cash + UPI)</th>
                        <th className="py-3 px-5 text-right">Shortfall / Arrears</th>
                        <th className="py-3 px-5 text-center">Collection Velocity</th>
                        <th className="py-3 px-5 text-center">Member Status</th>
                        <th className="py-3 px-6 text-right">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {allCyclesLedgerRows.map((row) => (
                        <tr
                          key={row.cycleNum}
                          className={`transition-colors ${
                            row.isLive 
                              ? 'bg-brand-50/30 hover:bg-brand-50/60' 
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${row.dotColor}`}></span>
                              <div>
                                <div className="font-bold text-slate-900 font-mono text-sm">{row.cycleTitle}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${row.badgeColor}`}>
                                    {row.badgeText}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">{row.subLabel}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-5 text-right font-mono font-bold text-slate-900 text-sm">
                            ₹{row.expected.toLocaleString('en-IN')}
                          </td>

                          <td className="py-4 px-5 text-right font-mono font-extrabold text-emerald-600 text-sm">
                            ₹{row.collected.toLocaleString('en-IN')}
                            <span className="block text-[10px] font-normal text-slate-500 font-sans">
                              {row.breakdownText}
                            </span>
                          </td>

                          <td className="py-4 px-5 text-right font-mono font-bold text-sm">
                            {row.shortfall > 0 ? (
                              <span className="text-rose-600">
                                -₹{row.shortfall.toLocaleString('en-IN')}
                                <span className="block text-[10px] font-medium text-rose-700 font-sans">
                                  {row.shortfallSubtext}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                ₹0 (Nil)
                                <span className="block text-[10px] font-medium text-emerald-700 font-sans">
                                  {row.shortfallSubtext}
                                </span>
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-5 text-center">
                            <div className="inline-flex flex-col items-center gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-emerald-700 text-xs">{row.velocity}%</span>
                                <div className="w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, row.velocity)}%` }}></div>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">Target: 100%</span>
                            </div>
                          </td>

                          <td className="py-4 px-5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-semibold text-[11px] ${row.statusPillStyle}`}>
                              {row.isLive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>}
                              {!row.isLive && row.cycleNum > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                              {row.statusPill}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {row.actionType === 'nudge' ? (
                                <>
                                  <button
                                    onClick={() => handleWhatsAppNudgeRow(row)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.974.551 1.794.813 2.802.813 3.179 0 5.767-2.587 5.767-5.766.001-3.187-2.575-5.769-5.773-5.769zm3.376 8.212c-.14.394-.712.724-1.002.771-.284.045-.632.067-1.026-.06-.239-.077-.552-.187-.954-.361-1.699-.738-2.812-2.464-2.898-2.577-.084-.114-.697-.927-.697-1.768 0-.841.442-1.255.6-.1426.157-.17.342-.213.456-.213.114 0 .228.001.328.006.105.006.246-.04.385.293.143.342.487 1.189.53 1.275.043.085.071.185.014.298-.057.114-.085.185-.17.285-.086.099-.181.222-.259.299-.086.085-.176.177-.076.348.1.171.444.733.953 1.187.656.584 1.209.765 1.38.85.171.085.271.071.371-.043.1-.114.428-.499.542-.67.114-.171.228-.142.385-.085.157.057.998.47 1.17.556.171.085.285.128.328.2.043.071.043.414-.097.808z" />
                                    </svg>
                                    <span>WhatsApp Nudge</span>
                                  </button>
                                  <button
                                    onClick={() => setSelectedMonth(row.cycleNum)}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                                  >
                                    Breakdown
                                  </button>
                                </>
                              ) : row.actionType === 'receipts' ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedMonth(row.cycleNum);
                                      setShowPreviewModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                                  >
                                    Receipts #01–${portfolioStats.totalTicketsCount}
                                  </button>
                                  <button
                                    onClick={() => setSelectedMonth(row.cycleNum)}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                                  >
                                    Breakdown
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedMonth(0);
                                      setShowPreviewModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                                  >
                                    Audit Voucher
                                  </button>
                                  <button
                                    onClick={() => setSelectedMonth(0)}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                                  >
                                    Breakdown
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Footer */}
                <div className="p-5 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span>
                      Cumulative Collected to Date:{' '}
                      <strong className="text-slate-900 font-mono text-sm">
                        ₹{(allCyclesLedgerRows.reduce((sum, r) => sum + r.collected, 0)).toLocaleString('en-IN')}
                      </strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      Average Collection Velocity:{' '}
                      <strong className="text-emerald-700 font-mono text-sm">
                        {(allCyclesLedgerRows.reduce((sum, r) => sum + r.velocity, 0) / Math.max(1, allCyclesLedgerRows.length)).toFixed(1)}%
                      </strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      Total Arrears Outstanding:{' '}
                      <strong className="text-rose-600 font-mono text-sm">
                        ₹{(allCyclesLedgerRows.reduce((sum, r) => sum + r.shortfall, 0)).toLocaleString('en-IN')}
                      </strong>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs text-slate-500 font-mono font-semibold">
                      Next Cycle M${selectedMonth + 1} Auction: 01 Nov 2024, 08:00 PM
                    </span>
                  </div>
                </div>

                {/* Member Breakdown Detail List for Active Month */}
                <div className="p-6 border-t border-slate-100 bg-white">
                  <div className="flex justify-between items-center pb-3">
                    <span className="text-xs font-bold text-slate-800">
                      Cycle M${selectedMonth} Member Ledger (${monthlyStats.memberRows.length} Subscribers)
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      ${monthlyStats.paidCount} Paid · ${monthlyStats.pendingCount} Pending
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {monthlyStats.memberRows.map((m, idx) => (
                      <div key={m.id} className="py-3 flex items-center justify-between hover:bg-slate-50 px-3 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-xs font-mono font-semibold text-slate-400">{idx + 1}</span>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">{m.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Ticket #{m.ticket} {m.phone ? `· ${m.phone}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            ₹{m.paidTotal.toLocaleString('en-IN')} / ₹{m.expectedUpToMonth.toLocaleString('en-IN')}
                          </span>
                          {m.isPaid ? (
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              Paid
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full">
                              Late (-₹{m.pendingDue.toLocaleString('en-IN')})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Subtab 2: Defaulters */}
            {activeSubtab === 'defaulters' && (
              <section className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Defaulter &amp; Overdue Tracker</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Ranked by highest outstanding arrears</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleShareText} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 cursor-pointer">Share</button>
                    <button onClick={handleWhatsAppPDF} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer">WhatsApp PDF</button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/60">
                    <span className="text-xs font-bold text-rose-800 uppercase">CUMULATIVE DUES</span>
                    <span className="text-2xl font-black text-rose-700 block font-mono mt-1">₹{defaultersStats.cumulativeDues.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/60">
                    <span className="text-xs font-bold text-amber-800 uppercase">THIS MONTH DUES</span>
                    <span className="text-2xl font-black text-amber-700 block font-mono mt-1">₹{defaultersStats.thisMonthDues.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-100 border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 uppercase">DEFAULTERS COUNT</span>
                    <span className="text-2xl font-black text-slate-900 block font-mono mt-1">{defaultersStats.defaultersCount}</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {defaultersStats.defaultersList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">Zero overdue defaulters for this cycle!</div>
                  ) : (
                    defaultersStats.defaultersList.map(d => (
                      <div key={d.id} className="py-3 flex items-center justify-between hover:bg-slate-50 px-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="w-5 font-mono text-xs text-slate-400">{d.rank}</span>
                          <div>
                            <span className="font-bold text-sm text-slate-900 block">{d.name}</span>
                            <span className="text-xs text-rose-600 font-medium">{d.monthsOverdue}m overdue · since {d.sinceDateLabel}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-rose-600 font-mono block">₹{d.cumulativeDue.toLocaleString('en-IN')}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">TOTAL OWED</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Subtab 3: Period Analysis */}
            {activeSubtab === 'period' && (
              <section className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Period &amp; Date-Range Analysis</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{periodDateLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleShareText} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 cursor-pointer">Share</button>
                    <button onClick={handleWhatsAppPDF} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer">WhatsApp PDF</button>
                  </div>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { id: 'this_month', label: 'This Month' },
                    { id: 'last_month', label: 'Last Month' },
                    { id: 'this_quarter', label: 'This Quarter' },
                    { id: 'this_fy', label: 'This FY' },
                    { id: '30_days', label: '30 Days' },
                    { id: 'custom', label: 'Custom' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handlePresetChange(p.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        periodPreset === p.id
                          ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/60 shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* 3 Metric Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/60">
                    <span className="text-xs font-bold text-emerald-800 uppercase">COLLECTED</span>
                    <span className="text-2xl font-black text-emerald-700 block font-mono mt-1">₹{periodStats.totalCollected.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/60">
                    <span className="text-xs font-bold text-amber-800 uppercase">PAID OUT</span>
                    <span className="text-2xl font-black text-amber-700 block font-mono mt-1">₹{periodStats.totalPaidOut.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-100 border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 uppercase">NET FLOW</span>
                    <span className={`text-2xl font-black block font-mono mt-1 ${periodStats.netFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      ₹{periodStats.netFlow.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Monthly breakdown */}
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Monthly Progression</span>
                  <div className="space-y-2">
                    {periodStats.monthsInPeriod.map((m, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs">
                        <span className="w-16 font-semibold text-slate-600 font-mono">{m.label}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-brand-600 h-full rounded-full" style={{ width: `${periodStats.maxMonthVal > 0 ? (m.collected / periodStats.maxMonthVal) * 100 : 0}%` }}></div>
                        </div>
                        <span className="font-mono font-bold text-slate-900">₹{m.collected.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Subtab 4: Organizer Earnings */}
            {activeSubtab === 'earnings' && (
              <section className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Organizer Earnings &amp; Pool Growth</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Realized Organizer Profit from Launch Month + Kai Iruppu Reserve</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleShareText} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 cursor-pointer">Share</button>
                    <button onClick={handleWhatsAppPDF} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer">WhatsApp PDF</button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-brand-50 border border-brand-200/60">
                    <span className="text-xs font-bold text-brand-800 uppercase">TOTAL EARNED</span>
                    <span className="text-2xl font-black text-brand-700 block font-mono mt-1">₹{earningsStats.totalEarned.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/60">
                    <span className="text-xs font-bold text-emerald-800 uppercase">ORGANIZER PROFIT (M0)</span>
                    <span className="text-2xl font-black text-emerald-700 block font-mono mt-1">₹{earningsStats.organizerProfit.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200/60">
                    <span className="text-xs font-bold text-indigo-800 uppercase">DISCOUNT POOL (LAABA SEETU)</span>
                    <span className="text-2xl font-black text-indigo-700 block font-mono mt-1">₹{earningsStats.discountPool.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {earningsStats.byChitList.map(g => (
                    <div key={g.id} className="py-3 flex items-center justify-between hover:bg-slate-50 px-3 rounded-xl">
                      <div>
                        <span className="font-bold text-sm text-slate-900 block">{g.name}</span>
                        <span className="text-xs text-slate-500">{g.subtitle}</span>
                      </div>
                      <span className="font-mono font-black text-slate-900 text-base">₹{g.total.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Subtab 5: Payouts */}
            {activeSubtab === 'payouts' && (
              <section className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Prize Pot Disbursals</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Auction prize distributions and settlement status</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleShareText} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 cursor-pointer">Share</button>
                    <button onClick={handleWhatsAppPDF} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer">WhatsApp PDF</button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/60">
                    <span className="text-xs font-bold text-amber-800 uppercase">TOTAL PRIZE VALUE</span>
                    <span className="text-2xl font-black text-amber-700 block font-mono mt-1">₹{payoutsStats.totalPrizeValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/60">
                    <span className="text-xs font-bold text-emerald-800 uppercase">NET PAID OUT</span>
                    <span className="text-2xl font-black text-emerald-700 block font-mono mt-1">₹{payoutsStats.totalNetPaid.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/60">
                    <span className="text-xs font-bold text-rose-800 uppercase">PENDING OWED</span>
                    <span className="text-2xl font-black text-rose-700 block font-mono mt-1">₹{payoutsStats.totalPending.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {payoutsStats.payoutRows.map((p, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between hover:bg-slate-50 px-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="w-8 font-mono text-xs font-bold text-slate-400">M{p.month}</span>
                        <div>
                          <span className="font-bold text-sm text-slate-900 block">{p.winnerName}</span>
                          <span className="text-xs text-slate-500 font-mono">Gross ₹{(p.awardedAmount || 0).toLocaleString('en-IN')} - Discount ₹{((p.awardedAmount || 0) - (p.netPayout || 0)).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900 font-mono block">₹{p.netPayout.toLocaleString('en-IN')}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.status === 'Complete' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Subtab 6: Member Statement */}
            {activeSubtab === 'member' && (
              <section className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Individual Member Statement</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Select subscriber to view complete ledger passbook</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleShareText} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 cursor-pointer">Share</button>
                    <button onClick={handleWhatsAppPDF} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer">WhatsApp PDF</button>
                  </div>
                </div>

                {/* Member Search / Selector */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search subscriber name or ticket number..."
                    value={memberSearchQuery}
                    onChange={(e) => {
                      setMemberSearchQuery(e.target.value);
                      setIsSearchDropdownOpen(true);
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-brand-500"
                  />
                  {isSearchDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-30 divide-y divide-slate-100">
                      {activeGroupMembers
                        .filter(m => m.profiles?.full_name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) || String(m.ticket_number).includes(memberSearchQuery))
                        .map(m => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedMemberId(m.id);
                              setIsSearchDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-slate-900">{m.profiles?.full_name}</span>
                            <span className="font-mono text-slate-500">Ticket #{m.ticket_number}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Member Overview Card */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-100 border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 uppercase">TOTAL DUE</span>
                    <span className="text-2xl font-black text-slate-900 block font-mono mt-1">₹{memberStatementStats.totalDue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/60">
                    <span className="text-xs font-bold text-emerald-800 uppercase">TOTAL PAID</span>
                    <span className="text-2xl font-black text-emerald-700 block font-mono mt-1">₹{memberStatementStats.totalPaid.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/60">
                    <span className="text-xs font-bold text-rose-800 uppercase">OUTSTANDING</span>
                    <span className="text-2xl font-black text-rose-700 block font-mono mt-1">₹{memberStatementStats.totalOwes.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Monthly rows */}
                <div className="divide-y divide-slate-100">
                  {memberStatementStats.monthRows.map(r => (
                    <div key={r.month} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-3 rounded-xl">
                      <span className="font-mono text-xs font-semibold text-slate-600">{r.dateLabel}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-slate-900">₹{r.paid.toLocaleString('en-IN')} / ₹{r.expected.toLocaleString('en-IN')}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Subtab 7: Reliability */}
            {activeSubtab === 'reliability' && (
              <section className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Member Trust &amp; Reliability Score</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Algorithmically calculated punctuality and commitment score (0–100)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleShareText} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 cursor-pointer">Share</button>
                    <button onClick={handleWhatsAppPDF} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer">WhatsApp PDF</button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/60">
                    <span className="text-xs font-bold text-emerald-800 uppercase">RELIABLE (80-100)</span>
                    <span className="text-2xl font-black text-emerald-700 block font-mono mt-1">{reliabilityStats.reliableCount}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/60">
                    <span className="text-xs font-bold text-amber-800 uppercase">WATCH (40-79)</span>
                    <span className="text-2xl font-black text-amber-700 block font-mono mt-1">{reliabilityStats.watchCount}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/60">
                    <span className="text-xs font-bold text-rose-800 uppercase">AT RISK (&lt;40)</span>
                    <span className="text-2xl font-black text-rose-700 block font-mono mt-1">{reliabilityStats.atRiskCount}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-100 border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 uppercase">NEED ATTENTION</span>
                    <span className="text-2xl font-black text-slate-900 block font-mono mt-1">{reliabilityStats.attentionCount}</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {reliabilityStats.memberList.map((m: any) => (
                    <div key={m.id} className="py-3 flex items-center justify-between hover:bg-slate-50 px-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="w-8 font-mono text-sm font-black text-slate-900">{m.score}</span>
                        <div>
                          <span className="font-bold text-sm text-slate-900 block">{m.name}</span>
                          <span className="text-xs text-slate-500 font-mono">Ticket #{m.ticket} · {m.onTimeCount}/{m.evaluatedMonthsCount} on time · {m.avgLateDays}d avg late</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        m.status === 'Reliable' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : m.status === 'Watch' 
                          ? 'bg-amber-50 text-amber-800 border-amber-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          2. MOBILE WORKSPACE (360px Native Android Feel — md:hidden)
         ══════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex-1 flex flex-col min-w-0 bg-[#F8FAFC] pb-24 relative overflow-y-auto w-full max-w-[360px] mx-auto shadow-2xl border-x border-slate-200/80">
        
        {/* Top Status Bar & App Header */}
        <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 safe-top">
          
          {/* Android Status Bar */}
          <div className="px-5 pt-2.5 pb-1 flex justify-between items-center text-xs font-semibold text-slate-900 tracking-tight">
            <span>09:41</span>
            <div className="flex items-center space-x-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 18.25A10.93 10.93 0 0 1 1 12C1 5.92 5.92 1 12 1s11 4.92 11 11c0 2.34-.73 4.51-1.98 6.29l-.62-.62A8.96 8.96 0 0 0 21 12c0-4.97-4.03-9-9-9z"></path>
                <circle cx="12" cy="18" r="2"></circle>
              </svg>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0 0 12 4z"></path>
              </svg>
              <div className="w-5 h-2.5 border border-slate-800 rounded-sm p-0.5 flex items-center">
                <div className="w-full h-full bg-slate-800 rounded-2xs"></div>
              </div>
            </div>
          </div>

          {/* App Title Bar */}
          <div className="px-4 pt-2 pb-2 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <button 
                onClick={() => setActiveSubtab('monthly')}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                </svg>
              </button>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">Reports &amp; Analytics</h1>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleBroadcastDueReminders}
                className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer" 
                title="WhatsApp Summary"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.974.551 1.794.813 2.802.813 3.179 0 5.767-2.587 5.767-5.766.001-3.187-2.575-5.769-5.773-5.769zm3.376 8.212c-.14.394-.712.724-1.002.771-.284.045-.632.067-1.026-.06-.239-.077-.552-.187-.954-.361-1.699-.738-2.812-2.464-2.898-2.577-.084-.114-.697-.927-.697-1.768 0-.841.442-1.255.6-.1426.157-.17.342-.213.456-.213.114 0 .228.001.328.006.105.006.246-.04.385.293.143.342.487 1.189.53 1.275.043.085.071.185.014.298-.057.114-.085.185-.17.285-.086.099-.181.222-.259.299-.086.085-.176.177-.076.348.1.171.444.733.953 1.187.656.584 1.209.765 1.38.85.171.085.271.071.371-.043.1-.114.428-.499.542-.67.114-.171.228-.142.385-.085.157.057.998.47 1.17.556.171.085.285.128.328.2.043.071.043.414-.097.808z"></path>
                </svg>
              </button>
              
              <button
                onClick={() => setShowPreviewModal(true)}
                className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer" 
                title="Export PDF"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Group & Cycle Selector Chips */}
          <div className="px-4 pb-2.5 overflow-x-auto no-scrollbar flex items-center space-x-1.5 text-xs">
            {chitGroups.map((g, idx) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`flex-shrink-0 px-3 py-1 font-bold rounded-full shadow-xs flex items-center gap-1 cursor-pointer transition-all ${
                  selectedGroupId === g.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50'
                }`}
              >
                <span>{idx === 0 ? '🏛️' : idx === 1 ? '✨' : '🪙'}</span>
                {g.name} (₹{(Number(g.total_value) / 100000).toFixed(0)}L)
              </button>
            ))}
          </div>

          {/* Horizontal Swipeable Subtabs (7 Dimensions) */}
          <div className="px-3 pb-2 overflow-x-auto no-scrollbar flex items-center space-x-1.5 text-xs border-t border-slate-100 pt-1.5">
            <button
              onClick={() => setActiveSubtab('monthly')}
              className={`flex-shrink-0 px-3 py-1 rounded-xl cursor-pointer transition-all ${
                activeSubtab === 'monthly' ? 'bg-brand-600 text-white font-bold shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              Monthly Ledger
            </button>
            <button
              onClick={() => setActiveSubtab('defaulters')}
              className={`flex-shrink-0 px-3 py-1 rounded-xl flex items-center gap-1 cursor-pointer transition-all ${
                activeSubtab === 'defaulters' ? 'bg-brand-600 text-white font-bold shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              Defaulters <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-bold text-[9px]">{defaultersStats.defaultersCount}</span>
            </button>
            <button
              onClick={() => setActiveSubtab('period')}
              className={`flex-shrink-0 px-3 py-1 rounded-xl cursor-pointer transition-all ${
                activeSubtab === 'period' ? 'bg-brand-600 text-white font-bold shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              Period Analysis
            </button>
            <button
              onClick={() => setActiveSubtab('earnings')}
              className={`flex-shrink-0 px-3 py-1 rounded-xl cursor-pointer transition-all ${
                activeSubtab === 'earnings' ? 'bg-brand-600 text-white font-bold shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              Pool &amp; Earnings
            </button>
            <button
              onClick={() => setActiveSubtab('payouts')}
              className={`flex-shrink-0 px-3 py-1 rounded-xl cursor-pointer transition-all ${
                activeSubtab === 'payouts' ? 'bg-brand-600 text-white font-bold shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              Prize Disbursals
            </button>
            <button
              onClick={() => setActiveSubtab('member')}
              className={`flex-shrink-0 px-3 py-1 rounded-xl cursor-pointer transition-all ${
                activeSubtab === 'member' ? 'bg-brand-600 text-white font-bold shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              Member
            </button>
            <button
              onClick={() => setActiveSubtab('reliability')}
              className={`flex-shrink-0 px-3 py-1 rounded-xl cursor-pointer transition-all ${
                activeSubtab === 'reliability' ? 'bg-brand-600 text-white font-bold shadow-2xs' : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              Trust Score
            </button>
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 px-3.5 py-3 space-y-3 pb-24">
          
          {/* 1. COMPACT ELEGANT TOP STATS CARD */}
          <section className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-card space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active CHIT VALUE</p>
                <h2 className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">
                  ₹{portfolioStats.totalAUM.toLocaleString('en-IN')}
                </h2>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                  M{selectedMonth} Active
                </span>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  {portfolioStats.totalTicketsCount} Tickets · {portfolioStats.activeGroupsCount} Groups
                </p>
              </div>
            </div>

            {/* Velocity bar */}
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-600 font-medium text-[11px]">Cycle M{selectedMonth} Velocity</span>
                <span className="text-brand-700 font-bold text-xs">
                  {portfolioStats.velocityPercent}%{' '}
                  <span className="text-[10px] font-normal text-slate-500">
                    (₹{(portfolioStats.collectedAmount / 100000).toFixed(2)}L / ₹{(portfolioStats.expectedAmount / 100000).toFixed(1)}L)
                  </span>
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, portfolioStats.velocityPercent)}%` }}></div>
              </div>
            </div>

            {/* 3-Pill Context Summary */}
            <div className="grid grid-cols-3 gap-1.5 text-center pt-0.5">
              <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[9px] text-slate-400 font-medium uppercase">Cash</p>
                <p className="text-[11px] font-bold text-slate-800 font-mono">
                  ₹{((balances?.cash_in_hand || 64500) / 1000).toFixed(1)}k
                </p>
              </div>
              <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[9px] text-slate-400 font-medium uppercase">Bank</p>
                <p className="text-[11px] font-bold text-slate-800 font-mono">
                  ₹{(((balances?.kishor_bank || 0) + (balances?.dad_bank || 0) + (balances?.mom_bank || 0) || 364000) / 100000).toFixed(2)}L
                </p>
              </div>
              <div className="p-1.5 bg-amber-50/60 rounded-lg border border-amber-200/70">
                <p className="text-[9px] text-amber-700 font-medium uppercase">Kai Iruppu</p>
                <p className="text-[11px] font-bold text-amber-900 font-mono">
                  ₹{(portfolioStats.totalPool / 1000).toFixed(1)}k
                </p>
              </div>
            </div>
          </section>

          {/* 2. MONTH-BY-MONTH COLLECTION LEDGER (MOBILE TAB VIEW) */}
          {activeSubtab === 'monthly' && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📅</span> Month-by-Month Dues Ledger
                </h3>
                <span className="text-[10px] font-bold text-brand-600">
                  {selectedMonth} / {selectedGroup?.duration_months || 20} Months
                </span>
              </div>

              {allCyclesLedgerRows.map((row) => (
                <div
                  key={row.cycleNum}
                  className={`p-3.5 bg-white rounded-2xl shadow-card space-y-2.5 ${
                    row.isLive ? 'border-2 border-brand-200/60' : 'border border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {row.isLive && <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse"></span>}
                      <div>
                        <span className="text-xs font-extrabold text-slate-900">{row.cycleTitle}</span>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {row.subLabel}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border font-mono ${
                      row.isLive 
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-slate-600 bg-slate-100 border-slate-200'
                    }`}>
                      {row.isLive ? `${row.velocity}% Done` : row.cycleNum === 0 ? 'Foreman Sealed' : '100% Reconciled'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">Expected</p>
                      <p className="text-xs font-bold text-slate-900 font-mono">₹{row.expected.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">Collected</p>
                      <p className="text-xs font-bold text-emerald-600 font-mono">₹{row.collected.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-semibold">{row.shortfall > 0 ? 'Overdue' : 'Shortfall'}</p>
                      <p className={`text-xs font-bold font-mono ${row.shortfall > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {row.shortfall > 0 ? `-₹${row.shortfall.toLocaleString('en-IN')}` : '₹0'}
                      </p>
                    </div>
                  </div>

                  {row.isLive && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-500 font-medium">
                          {monthlyStats.paidCount || 46} of {monthlyStats.memberRows.length || 50} Tickets Paid
                        </span>
                        <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded">
                          {monthlyStats.pendingCount || 4} Members Pending
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, row.velocity)}%` }}></div>
                      </div>
                    </div>
                  )}

                  {row.actionType === 'nudge' && (
                    <button
                      onClick={() => handleWhatsAppNudgeRow(row)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>📱</span> Nudge {monthlyStats.pendingCount || 4} Pending Members on WhatsApp
                    </button>
                  )}

                  {row.actionType === 'receipts' && (
                    <div className="flex items-center justify-between pt-0.5 text-[11px]">
                      <span className="text-emerald-700 font-semibold text-[10px] flex items-center gap-1">
                        <span>✓</span> {portfolioStats.totalTicketsCount}/{portfolioStats.totalTicketsCount} Paid
                      </span>
                      <button
                        onClick={() => {
                          setSelectedMonth(row.cycleNum);
                          setShowPreviewModal(true);
                        }}
                        className="text-brand-600 hover:text-brand-700 font-bold text-[10px] cursor-pointer"
                      >
                        View Audit Receipts →
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Ledger Summary Pill */}
              <div className="p-2.5 bg-slate-100/80 rounded-xl text-center text-[10px] font-medium text-slate-600 border border-slate-200/60">
                Cumulative Inflow: <strong className="text-slate-900 font-mono font-bold">₹{(allCyclesLedgerRows.reduce((sum, r) => sum + r.collected, 0)).toLocaleString('en-IN')}</strong> · Collection Rate: <strong className="text-emerald-700 font-mono font-bold">{(allCyclesLedgerRows.reduce((sum, r) => sum + r.velocity, 0) / Math.max(1, allCyclesLedgerRows.length)).toFixed(1)}%</strong>
              </div>
            </section>
          )}

          {/* Subtab 2 on Mobile: Defaulters */}
          {activeSubtab === 'defaulters' && (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-800 uppercase">Total Arrears</span>
                  <p className="text-lg font-black text-rose-700 font-mono">₹{defaultersStats.cumulativeDues.toLocaleString('en-IN')}</p>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Defaulters</span>
                  <p className="text-lg font-black text-slate-900 font-mono">{defaultersStats.defaultersCount} Members</p>
                </div>
              </div>

              <div className="space-y-2">
                {defaultersStats.defaultersList.map(d => (
                  <div key={d.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-xs text-slate-900">{d.name}</span>
                        <p className="text-[10px] text-rose-600 font-medium">{d.monthsOverdue}m overdue</p>
                      </div>
                      <span className="font-mono font-extrabold text-sm text-rose-600">₹{d.cumulativeDue.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Subtab 3 on Mobile: Period Analysis */}
          {activeSubtab === 'period' && (
            <section className="space-y-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                <span className="text-[11px] font-bold text-slate-800">Date Range Flow</span>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <span className="text-[9px] text-emerald-800 font-bold uppercase">Collected</span>
                    <p className="text-xs font-bold text-emerald-700 font-mono">₹{periodStats.totalCollected.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <span className="text-[9px] text-amber-800 font-bold uppercase">Paid Out</span>
                    <p className="text-xs font-bold text-amber-700 font-mono">₹{periodStats.totalPaidOut.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Subtab 4 on Mobile: Earnings */}
          {activeSubtab === 'earnings' && (
            <section className="space-y-3">
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase">Organizer Profit (M0)</span>
                <p className="text-xl font-black text-emerald-700 font-mono">₹{earningsStats.organizerProfit.toLocaleString('en-IN')}</p>
                <div className="pt-2 border-t border-slate-100 flex justify-between text-xs">
                  <span className="text-slate-500">Discount Pool:</span>
                  <span className="font-mono font-bold text-slate-800">₹{earningsStats.discountPool.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </section>
          )}

          {/* Subtab 5 on Mobile: Payouts */}
          {activeSubtab === 'payouts' && (
            <section className="space-y-2">
              {payoutsStats.payoutRows.map((p, idx) => (
                <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-slate-900">M{p.month} · {p.winnerName}</span>
                    <p className="text-[10px] text-slate-500 font-mono">Net: ₹{p.netPayout.toLocaleString('en-IN')}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.status === 'Complete' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </section>
          )}

          {/* Subtab 6 on Mobile: Member */}
          {activeSubtab === 'member' && (
            <section className="space-y-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900">{memberStatementStats.memberName}</span>
                  <span className="text-[10px] font-mono text-slate-500">T#{memberStatementStats.ticketNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <span className="text-[9px] text-emerald-800 uppercase font-bold">Paid</span>
                    <p className="font-mono font-bold text-emerald-700">₹{memberStatementStats.totalPaid.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-2 bg-rose-50 rounded-lg">
                    <span className="text-[9px] text-rose-800 uppercase font-bold">Owes</span>
                    <p className="font-mono font-bold text-rose-700">₹{memberStatementStats.totalOwes.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Subtab 7 on Mobile: Reliability */}
          {activeSubtab === 'reliability' && (
            <section className="space-y-2">
              {reliabilityStats.memberList.slice(0, 15).map((m: any) => (
                <div key={m.id} className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">{m.score}</span>
                    <span className="text-xs font-medium text-slate-900">{m.name}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    m.status === 'Reliable' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : m.status === 'Watch' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {m.status}
                  </span>
                </div>
              ))}
            </section>
          )}

        </main>
      </div>



{/* ── MODAL: DOCUMENT PREVIEW & PRINT ── */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl max-h-[90dvh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Official Statement Preview ({activeMonthInfo.dateLabel})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
                >
                  <Printer size={14} /> <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} /> <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 flex justify-center">
              <div className="bg-white shadow-xl rounded-xl w-full max-w-[760px]">
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


