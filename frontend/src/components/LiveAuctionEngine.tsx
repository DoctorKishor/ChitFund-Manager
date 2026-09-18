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
  Send
} from 'lucide-react';

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
  // 1. Initial State Data (Loaded from Supabase)
  const [allGroups, setAllGroups] = useState<ChitGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [group, setGroup] = useState<ChitGroup | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Auction date override
  const [auctionDateOverride, setAuctionDateOverride] = useState<string | null>(null);

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

  // Fetch specific selected group and its enrolled members
  const fetchGroupDetails = async (groupId: string) => {
    try {
      const selected = allGroups.find(g => g.id === groupId);
      if (selected) {
        setGroup(selected);
      } else {
        const { data: groupData } = await supabase
          .from('chit_groups')
          .select('*')
          .eq('id', groupId)
          .maybeSingle();

        if (groupData) {
          setGroup({
            id: groupData.id,
            name: groupData.name,
            totalValue: Number(groupData.total_value),
            memberCount: groupData.member_count,
            currentMonth: (groupData.current_month !== undefined && groupData.current_month !== null) ? Number(groupData.current_month) : 0,
            durationMonths: groupData.duration_months,
            kai_iruppu_pool: Number(groupData.kai_iruppu_pool) || 0,
          });
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
        const memberCount = selected?.memberCount || 10;
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
    } catch (err) {
      console.error('Error fetching group members:', err);
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

  // Open Pop-up Bidding Modal for a Member
  const handleOpenBidModal = (memberId: string) => {
    if (group?.currentMonth === 0) {
      alert("No live auction takes place in Month 0 (Launch Phase). Advance to Month 1 to begin live auctions.");
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
      id: Math.random().toString(),
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

  const handleUndo = () => {
    if (!selectedGroupId || bids.length === 0) return;
    setGroupBidsMap(prev => {
      const currentGroupBids = prev[selectedGroupId] || [];
      const updated = {
        ...prev,
        [selectedGroupId]: currentGroupBids.slice(1)
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('chit_funds_live_bids_v1', JSON.stringify(updated));
        } catch (err) {
          console.error('Error saving bids to localStorage:', err);
        }
      }
      return updated;
    });
  };

  // Month 0 Launch Advance Action
  const handleAdvanceMonth0 = async () => {
    if (!group) return;
    const confirmLaunch = window.confirm(
      `CONFIRM LAUNCH (Month 0)?\n\nAll launch collections (${formatCurrency(group.totalValue)}) are allocated to the Organizer as Organizer Profit.\n\nAdvance "${group.name}" to Month 1 (Live Auctions Phase)?`
    );
    if (!confirmLaunch) return;

    try {
      setIsRecording(true);
      const { error } = await supabase
        .from('chit_groups')
        .update({ current_month: 1 })
        .eq('id', group.id);

      if (error) {
        alert('Error advancing to Month 1: ' + error.message);
        return;
      }

      // Record audit log
      await supabase.from('security_audit_logs').insert({
        action_description: `LAUNCH CONFIRMED: "${group.name}" — ${formatCurrency(group.totalValue)} allocated as Organizer Profit for Month 0. Group advanced to Month 1.`,
        target_table: 'chit_groups'
      });

      setGroup(prev => prev ? ({ ...prev, currentMonth: 1 }) : null);
      setAllGroups(prev => prev.map(g => g.id === group.id ? { ...g, currentMonth: 1 } : g));
      await fetchGroupDetails(group.id);
    } catch (err: any) {
      console.error('Error confirming launch:', err);
    } finally {
      setIsRecording(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!group || bids.length === 0) return;
    setIsRecording(true);

    const recordedMonth = group.currentMonth;
    const nextMonth = Math.min(group.durationMonths, group.currentMonth + 1);
    const isCompleting = nextMonth >= group.durationMonths && group.currentMonth === group.durationMonths;
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

    try {
      // 1. Update chit group month, pool, and status in Supabase
      if (group.id) {
        await supabase.from('chit_groups').update({
          current_month: nextMonth,
          kai_iruppu_pool: nextPool,
          status: isCompleting ? 'completed' : 'active',
        }).eq('id', group.id);

        // 2. Mark winning ticket as won in group_members
        if (winnerId && !winnerId.startsWith('slot-')) {
          await supabase.from('group_members').update({
            has_won_regular: true
          }).eq('id', winnerId);
        }

        // 3. Insert auction log
        const winningMember = members.find(m => m.id === winnerId);
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

        // 4. Record audit log
        await supabase.from('security_audit_logs').insert({
          action_description: `AUCTION CLOSED: Group "${group.name}" Month ${group.currentMonth} won by ${winningMember?.fullName || 'Member'} with discount ${formatCurrency(highestBid)}. Net Payout: ${formatCurrency(netPayout)}. Group advanced to Month ${nextMonth}.`,
          target_table: 'auction_logs',
        });
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

      setShowConfetti(true);
    } catch (err: any) {
      console.error('Error updating chit group in Supabase:', err);
      alert('Error updating auction in database: ' + err.message);
    } finally {
      setIsRecording(false);
    }
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
  const canonicalDate = getFirstSundayOnOrAfter10th(now.getFullYear(), now.getMonth());
  const auctionDateDisplay = auctionDateOverride
    ? fmtDate(new Date(auctionDateOverride)) + ' (Override)'
    : fmtDate(canonicalDate);

  const eligibleCount = members.filter(m => !m.hasWonRegular).length;

  return (
    <div className="min-h-[calc(100vh-140px)] lg:h-[calc(100vh-140px)] flex flex-col space-y-2.5 sm:space-y-3 animate-in fade-in duration-200">
      
      {/* ── STREAMLINED COMPACT REAL-TIME HUD & CONTROLS ─────────────────────── */}
      <div className="shrink-0 bg-white border border-gray-200 rounded-2xl p-3 sm:p-3.5 shadow-sm space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Chit Group:</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-gray-50 hover:bg-gray-100 border border-gray-200 focus:border-indigo-500 rounded-xl px-2.5 py-1 text-xs font-bold text-gray-900 focus:outline-none cursor-pointer transition-colors shadow-2xs"
            >
              {allGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} (Month {g.currentMonth} of {g.durationMonths} • {formatCurrency(g.totalValue)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Roll Call Button */}
            <button
              onClick={() => setShowRollCallModal(true)}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-98 text-indigo-700 border border-indigo-200 text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <Users size={13} />
              <span>Roll Call ({attendingMemberIds.length}/{eligibleCount})</span>
            </button>

            {/* Live Timeline Toggle Button */}
            <button
              onClick={() => setShowTimelineDrawer(true)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-800 text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <History size={13} className="text-indigo-600" />
              <span>Timeline ({bids.length})</span>
            </button>

            {/* Quick Undo Button */}
            <button
              onClick={handleUndo}
              disabled={bids.length === 0}
              title="Undo last recorded bid"
              className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-200 text-gray-700 text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <Undo2 size={13} />
              <span className="hidden sm:inline">Undo</span>
            </button>

            {/* Hammer Down & Sold Button */}
            <button
              onClick={() => {
                if (bids.length === 0) {
                  alert("Cannot close auction without any bids recorded.");
                  return;
                }
                setShowCloseModal(true);
              }}
              disabled={group.currentMonth === 0 || bids.length === 0}
              className="font-bold text-xs px-3.5 py-1.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all bg-gray-900 hover:bg-black active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white cursor-pointer"
            >
              <Gavel size={13} />
              <span>{isLaabaSeetuActive ? 'Close Laaba Seetu' : 'Hammer Down & Sold'}</span>
            </button>
          </div>
        </div>

        {/* Compact 4-Card Real-Time Status Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-gray-100">
          {/* 1. Live Leader */}
          <div className={`px-3 py-2 rounded-xl border transition-all flex items-center justify-between gap-2 ${
            bids.length > 0 
              ? 'bg-gradient-to-r from-indigo-50 to-indigo-100/70 border-indigo-300 text-indigo-950 shadow-2xs' 
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 block">
                {bids.length > 0 ? '👑 Live Leader' : 'Starting Bid'}
              </span>
              <span className="text-xs font-extrabold block truncate">
                {bids.length > 0 ? `${winnerName} (#${winnerTicket})` : 'Awaiting 1st Bid'}
              </span>
            </div>
            <span className="text-xs font-black text-indigo-700 shrink-0">
              {bids.length > 0 ? formatCurrency(highestBid) : formatCurrency(startingBaselineBid)}
            </span>
          </div>

          {/* 2. Winner Net Cash Payout */}
          <div className="px-3 py-2 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 block">Net Payout</span>
              <span className="text-[10px] text-emerald-700 font-semibold block truncate">Pot: {formatCurrency(group.totalValue)}</span>
            </div>
            <span className="text-xs font-black text-emerald-900 shrink-0">
              {formatCurrency(netPayout)}
            </span>
          </div>

          {/* 3. Monthly Member Due */}
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">Member Due</span>
              <span className="text-[10px] text-slate-500 font-medium block truncate">
                {isLaabaSeetuActive ? 'Laaba Seetu Free' : 'per member ticket'}
              </span>
            </div>
            <span className="text-xs font-black text-slate-900 shrink-0">
              {isLaabaSeetuActive ? '₹0 (FREE)' : formatCurrency(group.totalValue / group.durationMonths)}
            </span>
          </div>

          {/* 4. Accumulated Kai Iruppu Pool */}
          <div className="px-3 py-2 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">Kai Iruppu Pool</span>
              <span className="text-[10px] text-amber-700 font-medium block truncate">
                +{formatCurrency(highestBid)} on close
              </span>
            </div>
            <span className="text-xs font-black text-amber-800 shrink-0">
              {formatCurrency(group.kai_iruppu_pool)}
            </span>
          </div>
        </div>
      </div>

      {/* ── MONTH 0 LAUNCH BANNER (ORGANIZER PROFIT PHASE) ────────────────────── */}
      {group.currentMonth === 0 && (
        <div className="shrink-0 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-start space-x-2.5">
            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
              <Crown size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-amber-950">Month 0: Launch Month — Organizer Profit Phase</h4>
                <span className="text-[9px] font-black uppercase bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md">
                  No Auction
                </span>
              </div>
              <p className="text-[11px] text-amber-900/80 mt-0.5 max-w-2xl leading-relaxed">
                All {group.memberCount} member installments are pooled ({formatCurrency(group.totalValue)}) and allocated directly to the Organizer as <strong>Organizer Profit</strong>. Once launch collections are in hand, advance the group to <strong>Month 1</strong>.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdvanceMonth0}
            disabled={isRecording}
            className="bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
          >
            {isRecording ? (
              <>
                <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Advancing...</span>
              </>
            ) : (
              <>
                <Rocket size={14} />
                <span>Confirm Launch &amp; Advance</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── FULL CANVAS DYNAMIC AUTOSCALING MEMBER GRID ────────────────────────── */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col space-y-2.5">
        
        {/* Workspace Toolbar Header */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-gray-900">
              Active Bidders Grid ({visibleContenders.length} eligible)
            </span>
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              — Tap any member card to log their shouted bid
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOnlyAttending(v => !v)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all border cursor-pointer ${
                showOnlyAttending 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                  : 'bg-gray-100 border-gray-200 text-gray-700'
              }`}
            >
              {showOnlyAttending ? `Attending Only (${attendingMemberIds.length})` : `Show All (${members.length})`}
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
        <div className="fixed inset-0 bg-black/60 flex items-center sm:items-center justify-center z-50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3.5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm shrink-0">
                  #{activeContender.ticketNumber}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                    Logging Live Bid For
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900 truncate max-w-[240px] sm:max-w-[320px]">
                    {activeContender.fullName}
                  </h3>
                </div>
              </div>

              <button 
                onClick={() => setShowBidModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
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
                      className="p-3.5 bg-white hover:bg-indigo-600 hover:text-white active:bg-indigo-700 border border-gray-200 hover:border-indigo-600 rounded-xl text-center transition-all shadow-2xs group cursor-pointer"
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
          <div className="bg-white border-l border-gray-200 w-full max-w-md h-full p-5 space-y-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center space-x-2">
                  <History size={18} className="text-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-900">Live Bidding Timeline ({bids.length})</h3>
                </div>
                <button 
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
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <button
                onClick={handleUndo}
                disabled={bids.length === 0}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Undo2 size={14} />
                <span>Undo Last Bid</span>
              </button>

              <button
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
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
                onClick={() => setShowRollCallModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Done &amp; Begin Live Bidding ({attendingMemberIds.length} Bidders)
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 2: HAMMER DOWN & CONFIRM CLOSE ─────────────────────────────── */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative overflow-hidden max-h-[92vh] overflow-y-auto">
            
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
              <div className="space-y-5">
                <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div className="flex items-center space-x-2.5">
                    <Gavel className="text-indigo-600" size={20} />
                    <h3 className="text-sm sm:text-base font-bold text-gray-900">
                      🔨 Hammer Down &amp; Record Winner — Month {group.currentMonth}
                    </h3>
                  </div>
                  <button 
                    onClick={() => !isRecording && setShowCloseModal(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer"
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
                    className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClose}
                    disabled={isRecording}
                    className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
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

    </div>
  );
}
