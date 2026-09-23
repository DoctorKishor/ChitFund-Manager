import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet, WalletType } from '../context/WalletContext';
import { supabase } from '../utils/supabase/client';
import LiveAuctionEngine from './LiveAuctionEngine';
import CashVaultLedger from './CashVaultLedger';
import MemberMatrix from './MemberMatrix';
import CommunicationBroadcastCenter from './CommunicationBroadcastCenter';
import ReportsCenter from './ReportsCenter';
import UserAccessManager from './UserAccessManager';
import SettingsManager from './SettingsManager';
import AuctionCountdownBanner from './AuctionCountdownBanner';
import AuctionScheduleModal from './AuctionScheduleModal';
import QuickMemberCollectModal, { CollectableMember } from './QuickMemberCollectModal';
import QuickPersonalDrawModal from './QuickPersonalDrawModal';
import QuickAtmWithdrawalModal from './QuickAtmWithdrawalModal';
import PaymentChecklistPrintModal from './PaymentChecklistPrintModal';
import SlideToConfirm from './SlideToConfirm';
import { HelpTooltip } from './HelpTooltip';
import { triggerHapticFeedback } from '../utils/haptics';
import { computeNextAuctionDateTime, formatTime12h, getFirstSundayOnOrAfterDay } from '../utils/auctionSchedule';
import { 
  DollarSign, 
  Users, 
  Briefcase, 
  Calendar, 
  Printer, 
  Send, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft,
  Coins,
  Search,
  Check,
  X,
  ArrowRight,
  BarChart3,
  Rocket,
  CalendarDays,
  RefreshCw,
  Plus,
  Minus,
  MinusCircle,
  UserPlus,
  Phone,
  User,
  Trash2,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Edit3,
  AlertTriangle,
  Lock,
  Unlock,
  Sliders,
  ShieldCheck,
  Trophy,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Share2,
  CreditCard,
  Wallet,
  Banknote,
  CheckCheck,
  Landmark,
  Info,
  Sparkles,
  RotateCcw,
  Paperclip,
  Layers,
  Filter,
  Bell,
  MessageSquare,
  Copy,
  ExternalLink,
  QrCode,
  Zap,
  Clock
} from 'lucide-react';

// ── Utility: First Sunday on-or-after the 10th of a given month ──────────────
function getFirstSundayOnOrAfter10th(year: number, month: number): Date {
  const d = new Date(year, month, 10);
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatAuctionDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Utility: Phone Normalization (extract core 10 digits) ────────────────────
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// ── Utility: Levenshtein Distance for typo & fuzzy name matching ─────────────
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// ── FIFO Ledger Types ─────────────────────────────────────────────────────────
interface LedgerEntry {
  month: number;
  label: string;
  original: number;
  paid: number;
}

interface FifoMember {
  id: string;
  name: string;
  ticket: number;
  group: string;
  ledger: LedgerEntry[];
}

interface DashboardContentProps {
  activeTab: string;
  setActiveTab?: (tab: string) => void;
}

export default function DashboardContent({ activeTab, setActiveTab }: DashboardContentProps) {
  const { profile } = useAuth();
  const { balances, updateBalance } = useWallet();

  // Group Creation & Enrollment States
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupValue, setNewGroupValue] = useState('100000');
  const [newGroupDuration, setNewGroupDuration] = useState('5');
  const [newGroupAuctionDay, setNewGroupAuctionDay] = useState<number>(10);
  const [newGroupAuctionTime, setNewGroupAuctionTime] = useState<string>('19:00');
  const [newGroupStartDate, setNewGroupStartDate] = useState(() => {
    const now = new Date();
    const sunday = getFirstSundayOnOrAfterDay(now.getFullYear(), now.getMonth(), 10);
    const yyyy = sunday.getFullYear();
    const mm = String(sunday.getMonth() + 1).padStart(2, '0');
    const dd = String(sunday.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [targetSlotForAssign, setTargetSlotForAssign] = useState<number | null>(null);
  const [enrollments, setEnrollments] = useState<{ id?: string; name: string; phone: string }[]>([
    { id: undefined, name: '', phone: '' },
    { id: undefined, name: '', phone: '' },
    { id: undefined, name: '', phone: '' },
    { id: undefined, name: '', phone: '' },
    { id: undefined, name: '', phone: '' },
  ]);

  // Wizard Setup States
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [dropdownHighlightedIndex, setDropdownHighlightedIndex] = useState(0);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // New Member Modal States for Wizard Step 2 & Master Directory
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [isCreatingMember, setIsCreatingMember] = useState(false);

  // Live Supabase Directory
  const [masterDirectory, setMasterDirectory] = useState<{ id?: string; name: string; phone: string }[]>([]);

  // Chits Directory Switcher States (Loaded from Supabase)
  const [showWizard, setShowWizard] = useState(false);
  const [groupFilter, setGroupFilter] = useState<'all' | 'active' | 'draft' | 'completed' | 'bin'>('all');
  const [localGroups, setLocalGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [isDuplicatingGroupId, setIsDuplicatingGroupId] = useState<string | null>(null);
  const [isRestoringGroupId, setIsRestoringGroupId] = useState<string | null>(null);

  // Group Workspace Dashboard States
  const [selectedWorkspaceGroupId, setSelectedWorkspaceGroupId] = useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [loadingWorkspaceMembers, setLoadingWorkspaceMembers] = useState(false);

  // Edit Group Advanced Modal States (ChitBase Architecture)
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [editActiveTab, setEditActiveTab] = useState<'details' | 'members'>('details');
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupStatus, setEditGroupStatus] = useState<'draft' | 'active' | 'completed'>('active');
  const [editGroupValue, setEditGroupValue] = useState<number>(100000);
  const [editGroupMemberCount, setEditGroupMemberCount] = useState<number>(5);
  const [editGroupCurrentMonth, setEditGroupCurrentMonth] = useState<number>(0);
  const [editGroupStartDate, setEditGroupStartDate] = useState<string>('');
  const [editGroupMembers, setEditGroupMembers] = useState<any[]>([]);
  const [editMemberSearchQuery, setEditMemberSearchQuery] = useState('');
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Advanced ChitBase Member Action Sub-Modals
  const [splitModalTicket, setSplitModalTicket] = useState<any | null>(null);
  const [splitPayers, setSplitPayers] = useState<{ name: string; part: number }[]>([]);
  
  const [exitModalTicket, setExitModalTicket] = useState<any | null>(null);
  const [exitMonthVal, setExitMonthVal] = useState<number>(2);

  const [transferModalTicket, setTransferModalTicket] = useState<any | null>(null);
  const [transferRecipientId, setTransferRecipientId] = useState<string>('');
  const [transferMonthVal, setTransferMonthVal] = useState<number>(2);

  const [customAmountModalTicket, setCustomAmountModalTicket] = useState<any | null>(null);
  const [customAmountVal, setCustomAmountVal] = useState<number>(0);

  const [expandedTimingTicketIds, setExpandedTimingTicketIds] = useState<number[]>([]);
  const [expandedEditTicketIds, setExpandedEditTicketIds] = useState<number[]>([]);
  const [draggedTicketNum, setDraggedTicketNum] = useState<number | null>(null);
  const [dragOverTicketNum, setDragOverTicketNum] = useState<number | null>(null);
  const [printChecklistGroup, setPrintChecklistGroup] = useState<any | null>(null);

  // High-Security Delete Group Modal States
  const [deletingGroup, setDeletingGroup] = useState<any | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'permanent'>('soft');
  const [deletePhraseInput, setDeletePhraseInput] = useState('');
  const [deleteSliderVal, setDeleteSliderVal] = useState(0);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Pending ATM Physical Cash Inflow Verification Queue
  const [pendingAtmRelocations, setPendingAtmRelocations] = useState<any[]>([]);
  const [isVerifyingAtmId, setIsVerifyingAtmId] = useState<string | null>(null);

  const fetchPendingAtmRelocations = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('type', 'atm_withdrawal')
        .eq('status', 'pending_verification')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setPendingAtmRelocations(data);
      }
    } catch (err) {
      console.error('Error fetching pending ATM relocations:', err);
    }
  };

  const handleConfirmAtmInflowFromDashboard = async (tx: any) => {
    try {
      setIsVerifyingAtmId(tx.id);
      triggerHapticFeedback('light');

      const amount = Number(tx.amount || 0);
      // 1. Credit Cash in Hand
      await updateBalance('cash_in_hand', amount);

      // 2. Update transaction status in Supabase to 'completed'
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const updatedNotes = tx.notes
        ? `${tx.notes} | Verified & Credited to Cash Box on ${dateStr}`
        : `ATM Cash Withdrawal verified into Physical Cash Box on ${dateStr}`;

      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          notes: updatedNotes,
        })
        .eq('id', tx.id);

      if (error) throw error;

      // 3. Security Audit Log
      await supabase.from('security_audit_logs').insert({
        action_description: `ATM RELOCATION CONFIRMED: ₹${amount.toLocaleString('en-IN')} verified & credited into Physical Cash Box from Dashboard.`,
        target_table: 'transactions',
      });

      triggerHapticFeedback('success');
      await fetchPendingAtmRelocations();
      if (activeDashboardGroupId) {
        await fetchDashboardData(activeDashboardGroupId);
      }
      alert(`✓ Verified & Credited ₹${amount.toLocaleString('en-IN')} into Physical Cash Box!`);
    } catch (err: any) {
      console.error('Error confirming ATM inflow:', err);
      alert('Error confirming ATM inflow: ' + (err.message || 'Unknown error'));
    } finally {
      setIsVerifyingAtmId(null);
    }
  };

  // Fetch real groups from Supabase
  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      const { data, error } = await supabase
        .from('chit_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('chit_groups fetch note:', error.message);
        return;
      }

      if (data) {
        setLocalGroups(
          data.map((g: any) => ({
            id: g.id,
            name: g.name,
            totalValue: Number(g.total_value),
            currentMonth: (g.current_month !== undefined && g.current_month !== null) ? Number(g.current_month) : 0,
            duration: g.duration_months,
            memberCount: g.member_count || g.duration_months,
            kaiIruppuPool: Number(g.kai_iruppu_pool || 0),
            status: g.status || 'active',
            startDate: g.start_date || '',
            active: g.status !== 'completed',
            auctionDayOfMonth: g.auction_day_of_month !== undefined && g.auction_day_of_month !== null ? Number(g.auction_day_of_month) : 10,
            auctionTime: g.auction_time || '19:00',
            nextAuctionDate: g.next_auction_date || null,
            nextAuctionTime: g.next_auction_time || g.auction_time || '19:00',
            deletedAt: g.deleted_at || null,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching groups from Supabase:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Fetch registered profiles from Supabase
  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setMasterDirectory(
          data.map((p: any) => ({
            id: p.id,
            name: p.full_name,
            phone: p.phone_number,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching directory:', err);
    }
  };

  // Fetch members for the selected workspace group
  const fetchWorkspaceMembers = async (groupId: string) => {
    try {
      setLoadingWorkspaceMembers(true);
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          ticket_number,
          has_won_regular,
          physical_book_synced,
          profile_id,
          split_pool,
          custom_installment,
          exit_month,
          transferred_from,
          transfer_effective_month,
          profiles:profile_id (
            id,
            full_name,
            phone_number
          )
        `)
        .eq('group_id', groupId)
        .order('ticket_number', { ascending: true });

      if (error) {
        console.warn('Error fetching group members:', error.message);
        return;
      }

      if (data) {
        setWorkspaceMembers(
          data.map((m: any) => {
            const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return {
              id: m.id,
              ticket: m.ticket_number,
              hasWon: m.has_won_regular,
              bookSynced: m.physical_book_synced,
              profileId: m.profile_id || undefined,
              splitPool: m.profile_id ? (m.split_pool || null) : null,
              customInstallment: m.profile_id && m.custom_installment ? Number(m.custom_installment) : null,
              exitMonth: m.profile_id ? (m.exit_month || null) : null,
              transferredFrom: m.profile_id ? (m.transferred_from || null) : null,
              transferEffectiveMonth: m.profile_id ? (m.transfer_effective_month || null) : null,
              name: prof?.full_name || 'Subscriber',
              phone: prof?.phone_number || '',
            };
          })
        );
      }
    } catch (err) {
      console.error('Error in fetchWorkspaceMembers:', err);
    } finally {
      setLoadingWorkspaceMembers(false);
    }
  };



  const openEditGroupModal = async (g: any) => {
    setEditingGroup(g);
    setEditActiveTab('details');
    setEditGroupName(g.name || '');
    setEditGroupStatus(g.status || (g.active ? 'active' : 'draft'));
    setEditGroupValue(g.totalValue || 100000);
    const count = g.duration || g.memberCount || 5;
    setEditGroupMemberCount(count);
    setEditGroupCurrentMonth((g.currentMonth !== undefined && g.currentMonth !== null) ? g.currentMonth : 0);
    setEditGroupStartDate(g.startDate || new Date().toISOString().split('T')[0]);
    setIsAdvancedExpanded(false);
    setEditMemberSearchQuery('');

    // Fetch enrolled tickets for this group
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          ticket_number,
          has_won_regular,
          physical_book_synced,
          profile_id,
          split_pool,
          custom_installment,
          exit_month,
          transferred_from,
          transfer_effective_month,
          profiles:profile_id (
            id,
            full_name,
            phone_number
          )
        `)
        .eq('group_id', g.id)
        .order('ticket_number', { ascending: true });

      if (error) {
        console.warn('Note fetching edit group members:', error.message);
      }

      // Map all 1..count slots so no ticket slot is ever undefined
      const mapped = Array.from({ length: count }, (_, idx) => {
        const tNum = idx + 1;
        const row = data?.find((m: any) => m.ticket_number === tNum);
        const prof = Array.isArray(row?.profiles) ? row.profiles[0] : row?.profiles;
        const dirProfile = row?.profile_id ? masterDirectory.find(p => p.id === row.profile_id) : null;
        const resolvedName = prof?.full_name || dirProfile?.name || (row?.profile_id ? 'Subscriber' : '');
        const resolvedPhone = prof?.phone_number || dirProfile?.phone || '';

        return {
          id: row?.id || `unassigned-${g.id}-${tNum}`,
          ticket: tNum,
          hasWon: !!row?.has_won_regular,
          bookSynced: row?.physical_book_synced ?? true,
          profileId: row?.profile_id || undefined,
          splitPool: row?.profile_id ? (row?.split_pool || null) : null,
          customInstallment: row?.profile_id && row?.custom_installment ? Number(row.custom_installment) : null,
          exitMonth: row?.profile_id ? (row?.exit_month || null) : null,
          transferredFrom: row?.profile_id ? (row?.transferred_from || null) : null,
          transferEffectiveMonth: row?.profile_id ? (row?.transfer_effective_month || null) : null,
          name: resolvedName,
          phone: resolvedPhone,
        };
      });

      setEditGroupMembers(mapped);
    } catch (err) {
      console.error('Error fetching edit group members:', err);
    }
  };

  const handleSaveEditGroup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingGroup || !editGroupName.trim()) return;

    try {
      setIsSavingEdit(true);
      const valNum = Number(editGroupValue);
      const countNum = Number(editGroupMemberCount);

      // 1. Update chit_groups in Supabase
      const { error: groupError } = await supabase
        .from('chit_groups')
        .update({
          name: editGroupName.trim(),
          total_value: valNum,
          member_count: countNum,
          duration_months: countNum,
          current_month: Number(editGroupCurrentMonth),
          start_date: editGroupStartDate,
          status: editGroupStatus,
        })
        .eq('id', editingGroup.id);

      if (groupError) {
        alert(`Error updating chit group parameters: ${groupError.message}`);
        return;
      }

      // 2. Sync group_members to Supabase for all slots
      for (const m of editGroupMembers) {
        const payload: any = {
          group_id: editingGroup.id,
          ticket_number: m.ticket,
          profile_id: m.profileId || null,
          has_won_regular: m.hasWon,
          physical_book_synced: m.bookSynced ?? true,
          split_pool: m.profileId ? (m.splitPool || null) : null,
          custom_installment: m.profileId ? (m.customInstallment || null) : null,
          exit_month: m.profileId ? (m.exitMonth || null) : null,
          transferred_from: m.profileId ? (m.transferredFrom || null) : null,
          transfer_effective_month: m.profileId ? (m.transferEffectiveMonth || null) : null,
        };
        await supabase
          .from('group_members')
          .upsert(payload, { onConflict: 'group_id,ticket_number' });
      }

      // If member count was decreased, clean up orphaned tickets beyond the new count
      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', editingGroup.id)
        .gt('ticket_number', countNum);

      // Update local state
      setLocalGroups(prev =>
        prev.map(cg =>
          cg.id === editingGroup.id
            ? {
                ...cg,
                name: editGroupName.trim(),
                totalValue: valNum,
                memberCount: countNum,
                duration: countNum,
                currentMonth: Number(editGroupCurrentMonth),
                startDate: editGroupStartDate,
                status: editGroupStatus,
                active: editGroupStatus === 'active',
              }
            : cg
        )
      );

      if (selectedWorkspaceGroupId === editingGroup.id) {
        setSelectedWorkspaceGroupId(editingGroup.id);
        fetchWorkspaceMembers(editingGroup.id);
      }

      if (activeDashboardGroupId === editingGroup.id) {
        fetchDashboardData(editingGroup.id);
      }
      await fetchGroups();

      setEditingGroup(null);
      triggerHapticFeedback('success');
    } catch (err: any) {
      alert(`Error saving edit group: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleReassignTicketMember = async (ticketNum: number, currentRecordId: string | undefined, newProfileId: string, newName: string, newPhone: string) => {
    if (!editingGroup?.id) return;
    try {
      const { data, error } = await supabase
        .from('group_members')
        .upsert({
          group_id: editingGroup.id,
          ticket_number: ticketNum,
          profile_id: newProfileId,
          physical_book_synced: true,
          transferred_from: null,
          transfer_effective_month: null,
          exit_month: null,
          split_pool: null,
          custom_installment: null,
        }, { onConflict: 'group_id,ticket_number' })
        .select()
        .single();

      if (error) {
        alert(`Failed to reassign member: ${error.message}`);
        return;
      }

      const assignedId = data?.id || currentRecordId || `member-${ticketNum}`;

      setEditGroupMembers(prev =>
        prev.map(m =>
          m.ticket === ticketNum
            ? { ...m, id: assignedId, profileId: newProfileId, name: newName, phone: newPhone, transferredFrom: null, transferEffectiveMonth: null, exitMonth: null, splitPool: null, customInstallment: null }
            : m
        )
      );

      if (selectedWorkspaceGroupId === editingGroup?.id) {
        setWorkspaceMembers(prev =>
          prev.map(m =>
            m.ticket === ticketNum
              ? { ...m, id: assignedId, profileId: newProfileId, name: newName, phone: newPhone, transferredFrom: null, transferEffectiveMonth: null, exitMonth: null, splitPool: null, customInstallment: null }
              : m
          )
        );
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'group_members',
          desc: `ASSIGNED TICKET #${ticketNum}: Set subscriber to "${newName}" (${newPhone})`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);
    } catch (err: any) {
      alert(`Error reassigning member: ${err.message}`);
    }
  };

  const handleSaveSplit = async (ticketId: string, payers: { name: string; part: number }[]) => {
    try {
      const ticketObj = editGroupMembers.find(m => m.id === ticketId);
      const isTempId = !ticketId || ticketId.startsWith('unassigned-') || ticketId.startsWith('member-');

      if (isTempId && editingGroup?.id && ticketObj) {
        await supabase.from('group_members').upsert({
          group_id: editingGroup.id,
          ticket_number: ticketObj.ticket,
          profile_id: ticketObj.profileId || null,
          split_pool: payers.length > 0 ? payers : null,
          physical_book_synced: true,
        }, { onConflict: 'group_id,ticket_number' });
      } else if (!isTempId) {
        const { error } = await supabase
          .from('group_members')
          .update({ split_pool: payers.length > 0 ? payers : null })
          .eq('id', ticketId);

        if (error) {
          alert(`Failed to save split pool: ${error.message}`);
          return;
        }
      }

      setEditGroupMembers(prev =>
        prev.map(m => m.id === ticketId ? { ...m, splitPool: payers.length > 0 ? payers : null } : m)
      );

      if (selectedWorkspaceGroupId === editingGroup?.id) {
        setWorkspaceMembers(prev =>
          prev.map(m => m.id === ticketId ? { ...m, splitPool: payers.length > 0 ? payers : null } : m)
        );
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'group_members',
          desc: `SPLIT POOL CONFIGURED: ${payers.length} co-payers saved for ticket`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      setSplitModalTicket(null);
    } catch (err: any) {
      alert(`Error saving split pool: ${err.message}`);
    }
  };

  const handleSaveExit = async (ticketId: string, exitMonth: number | null) => {
    try {
      const ticketObj = editGroupMembers.find(m => m.id === ticketId);
      const isTempId = !ticketId || ticketId.startsWith('unassigned-') || ticketId.startsWith('member-');

      if (isTempId && editingGroup?.id && ticketObj) {
        await supabase.from('group_members').upsert({
          group_id: editingGroup.id,
          ticket_number: ticketObj.ticket,
          profile_id: ticketObj.profileId || null,
          exit_month: exitMonth,
          physical_book_synced: true,
        }, { onConflict: 'group_id,ticket_number' });
      } else if (!isTempId) {
        const { error } = await supabase
          .from('group_members')
          .update({ exit_month: exitMonth })
          .eq('id', ticketId);

        if (error) {
          alert(`Failed to update member exit: ${error.message}`);
          return;
        }
      }

      setEditGroupMembers(prev =>
        prev.map(m => m.id === ticketId ? { ...m, exitMonth } : m)
      );

      if (selectedWorkspaceGroupId === editingGroup?.id) {
        setWorkspaceMembers(prev =>
          prev.map(m => m.id === ticketId ? { ...m, exitMonth } : m)
        );
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'group_members',
          desc: exitMonth ? `MEMBER EXIT SCHEDULED: Stops paying from Month ${exitMonth}` : `MEMBER RE-INSTATED: Cleared exit status`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      setExitModalTicket(null);
    } catch (err: any) {
      alert(`Error saving member exit: ${err.message}`);
    }
  };

  const handleSaveTransfer = async (ticketId: string, recipientProfileId: string, startMonth: number) => {
    try {
      const targetProfile = masterDirectory.find(p => p.id === recipientProfileId);
      if (!targetProfile) {
        alert('Please select a recipient subscriber.');
        return;
      }

      const currentTicket = editGroupMembers.find(m => m.id === ticketId);
      const prevProfileId = currentTicket?.profileId || null;
      const isTempId = !ticketId || ticketId.startsWith('unassigned-') || ticketId.startsWith('member-');

      if (isTempId && editingGroup?.id && currentTicket) {
        await supabase.from('group_members').upsert({
          group_id: editingGroup.id,
          ticket_number: currentTicket.ticket,
          profile_id: recipientProfileId,
          transferred_from: prevProfileId,
          transfer_effective_month: startMonth,
          physical_book_synced: true,
        }, { onConflict: 'group_id,ticket_number' });
      } else if (!isTempId) {
        const { error } = await supabase
          .from('group_members')
          .update({
            profile_id: recipientProfileId,
            transferred_from: prevProfileId,
            transfer_effective_month: startMonth,
          })
          .eq('id', ticketId);

        if (error) {
          alert(`Failed to transfer ticket: ${error.message}`);
          return;
        }
      }

      setEditGroupMembers(prev =>
        prev.map(m =>
          m.id === ticketId
            ? {
                ...m,
                profileId: recipientProfileId,
                name: targetProfile.name,
                phone: targetProfile.phone,
                transferredFrom: prevProfileId,
                transferEffectiveMonth: startMonth,
              }
            : m
        )
      );

      if (selectedWorkspaceGroupId === editingGroup?.id) {
        setWorkspaceMembers(prev =>
          prev.map(m =>
            m.id === ticketId
              ? {
                  ...m,
                  profileId: recipientProfileId,
                  name: targetProfile.name,
                  phone: targetProfile.phone,
                  transferredFrom: prevProfileId,
                  transferEffectiveMonth: startMonth,
                }
              : m
          )
        );
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'group_members',
          desc: `TICKET TRANSFERRED: Handed over to "${targetProfile.name}" starting from Month ${startMonth}`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      setTransferModalTicket(null);
    } catch (err: any) {
      alert(`Error transferring ticket: ${err.message}`);
    }
  };

  const handleSaveCustomAmount = async (ticketId: string, amount: number | null) => {
    try {
      const ticketObj = editGroupMembers.find(m => m.id === ticketId);
      const isTempId = !ticketId || ticketId.startsWith('unassigned-') || ticketId.startsWith('member-');

      if (isTempId && editingGroup?.id && ticketObj) {
        await supabase.from('group_members').upsert({
          group_id: editingGroup.id,
          ticket_number: ticketObj.ticket,
          profile_id: ticketObj.profileId || null,
          custom_installment: amount,
          physical_book_synced: true,
        }, { onConflict: 'group_id,ticket_number' });
      } else if (!isTempId) {
        const { error } = await supabase
          .from('group_members')
          .update({ custom_installment: amount })
          .eq('id', ticketId);

        if (error) {
          alert(`Failed to save custom amount: ${error.message}`);
          return;
        }
      }

      setEditGroupMembers(prev =>
        prev.map(m => m.id === ticketId ? { ...m, customInstallment: amount } : m)
      );

      if (selectedWorkspaceGroupId === editingGroup?.id) {
        setWorkspaceMembers(prev =>
          prev.map(m => m.id === ticketId ? { ...m, customInstallment: amount } : m)
        );
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'group_members',
          desc: amount ? `CUSTOM DUE SET: ₹${amount.toLocaleString('en-IN')}/mo on ticket` : `CUSTOM DUE CLEARED: Reset to baseline installment`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      setCustomAmountModalTicket(null);
    } catch (err: any) {
      alert(`Error saving custom amount: ${err.message}`);
    }
  };

  const handleUnassignTicket = async (ticketRecordId: string, ticketNum: number) => {
    try {
      triggerHapticFeedback('light');
      if (editingGroup?.id) {
        await supabase
          .from('group_members')
          .upsert({
            group_id: editingGroup.id,
            ticket_number: ticketNum,
            profile_id: null,
            physical_book_synced: true,
            split_pool: null,
            custom_installment: null,
            exit_month: null,
            transferred_from: null,
            transfer_effective_month: null,
          }, { onConflict: 'group_id,ticket_number' });
      } else if (ticketRecordId && !ticketRecordId.startsWith('unassigned-') && !ticketRecordId.startsWith('member-')) {
        await supabase
          .from('group_members')
          .update({
            profile_id: null,
            split_pool: null,
            custom_installment: null,
            exit_month: null,
            transferred_from: null,
            transfer_effective_month: null,
          })
          .eq('id', ticketRecordId);
      }

      setEditGroupMembers(prev =>
        prev.map(m =>
          m.ticket === ticketNum
            ? { ...m, profileId: undefined, name: '', phone: '', splitPool: null, customInstallment: null, exitMonth: null, transferredFrom: null, transferEffectiveMonth: null }
            : m
        )
      );

      if (selectedWorkspaceGroupId === editingGroup?.id) {
        setWorkspaceMembers(prev =>
          prev.map(m =>
            m.ticket === ticketNum
              ? { ...m, profileId: undefined, name: '', phone: '', splitPool: null, customInstallment: null, exitMonth: null, transferredFrom: null, transferEffectiveMonth: null }
              : m
          )
        );
      }
    } catch (err: any) {
      console.error('Error unassigning ticket:', err);
    }
  };


  const handleSwapTicketSlots = (fromTicket: number, toTicket: number) => {
    if (editGroupStatus !== 'draft') {
      alert('🔒 Ticket numbers are locked because this chit group is active.\n\nTicket slot reordering is only permitted while the chit group is in Draft mode.');
      return;
    }
    if (fromTicket === toTicket || fromTicket < 1 || toTicket < 1 || toTicket > editGroupMemberCount) return;
    triggerHapticFeedback('light');

    setEditGroupMembers(prev => {
      const fromMember = prev.find(m => m.ticket === fromTicket);
      const toMember = prev.find(m => m.ticket === toTicket);

      return prev.map(m => {
        if (m.ticket === fromTicket) {
          return {
            ...m,
            profileId: toMember?.profileId,
            name: toMember?.name || '',
            phone: toMember?.phone || '',
            hasWon: toMember?.hasWon ?? false,
            bookSynced: toMember?.bookSynced ?? true,
            splitPool: toMember?.splitPool || null,
            customInstallment: toMember?.customInstallment || null,
            exitMonth: toMember?.exitMonth || null,
            transferredFrom: toMember?.transferredFrom || null,
            transferEffectiveMonth: toMember?.transferEffectiveMonth || null,
          };
        }
        if (m.ticket === toTicket) {
          return {
            ...m,
            profileId: fromMember?.profileId,
            name: fromMember?.name || '',
            phone: fromMember?.phone || '',
            hasWon: fromMember?.hasWon ?? false,
            bookSynced: fromMember?.bookSynced ?? true,
            splitPool: fromMember?.splitPool || null,
            customInstallment: fromMember?.customInstallment || null,
            exitMonth: fromMember?.exitMonth || null,
            transferredFrom: fromMember?.transferredFrom || null,
            transferEffectiveMonth: fromMember?.transferEffectiveMonth || null,
          };
        }
        return m;
      });
    });
  };

  // ── Duplicate Chit Group & Clone All Enrolled Tickets (Supabase Persistent) ──
  const handleDuplicateGroup = async (sourceGroup: any) => {
    try {
      setIsDuplicatingGroupId(sourceGroup.id);
      triggerHapticFeedback('light');

      // 1. Fetch all members assigned to this source group
      const { data: members, error: memErr } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', sourceGroup.id)
        .order('ticket_number', { ascending: true });

      if (memErr) throw memErr;

      // 2. Insert new duplicated group in Supabase
      const newName = `${sourceGroup.name} (Copy)`;
      const { data: newGroup, error: groupErr } = await supabase
        .from('chit_groups')
        .insert({
          name: newName,
          total_value: sourceGroup.totalValue,
          duration_months: sourceGroup.duration,
          member_count: sourceGroup.memberCount || sourceGroup.duration,
          current_month: 0,
          status: 'draft',
          kai_iruppu_pool: 0,
          start_date: new Date().toISOString().split('T')[0],
          auction_day_of_month: sourceGroup.auctionDayOfMonth || 10,
          auction_time: sourceGroup.auctionTime || '19:00',
          next_auction_date: null,
          next_auction_time: sourceGroup.auctionTime || '19:00',
        })
        .select()
        .single();

      if (groupErr) throw groupErr;

      // 3. Clone all member tickets into group_members for the new group
      if (members && members.length > 0) {
        const clonedMembers = members.map((m: any) => ({
          group_id: newGroup.id,
          profile_id: m.profile_id,
          ticket_number: m.ticket_number,
          has_won_regular: false,
          physical_book_synced: false,
          split_pool: m.split_pool || null,
          custom_installment: m.custom_installment || null,
          exit_month: null,
          transferred_from: null,
          transfer_effective_month: null,
        }));

        const { error: insertMemErr } = await supabase
          .from('group_members')
          .insert(clonedMembers);

        if (insertMemErr) throw insertMemErr;
      }

      // 4. Security audit log
      await supabase.from('security_audit_logs').insert({
        action_description: `GROUP DUPLICATED: "${sourceGroup.name}" cloned into new group "${newName}" with ${members?.length || 0} tickets.`,
        target_table: 'chit_groups',
      });

      triggerHapticFeedback('success');
      await fetchGroups();
      alert(`✓ Chit Group "${sourceGroup.name}" duplicated successfully as "${newName}" with all member tickets cloned!`);
    } catch (err: any) {
      console.error('Error duplicating group:', err);
      alert('Failed to duplicate group: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDuplicatingGroupId(null);
    }
  };

  const openSoftDeleteModal = (group: any) => {
    setDeletingGroup(group);
    setDeleteMode('soft');
    setDeletePhraseInput('');
    setDeleteSliderVal(0);
  };

  const openPermanentDeleteModal = (group: any) => {
    setDeletingGroup(group);
    setDeleteMode('permanent');
    setDeletePhraseInput('');
    setDeleteSliderVal(0);
  };

  // ── Move Chit Group to Recycle Bin (Soft Delete Execution) ─────────────────
  const handleExecuteSoftDeleteGroup = async () => {
    if (!deletingGroup) return;
    try {
      setIsDeletingGroup(true);
      triggerHapticFeedback('light');

      const { error } = await supabase
        .from('chit_groups')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
        })
        .eq('id', deletingGroup.id);

      if (error) throw error;

      await supabase.from('security_audit_logs').insert({
        action_description: `GROUP MOVED TO RECYCLE BIN: "${deletingGroup.name}" (${deletingGroup.id}) marked as deleted.`,
        target_table: 'chit_groups',
      });

      triggerHapticFeedback('success');
      if (selectedWorkspaceGroupId === deletingGroup.id) {
        setSelectedWorkspaceGroupId(null);
      }
      setDeletingGroup(null);
      setDeletePhraseInput('');
      setDeleteSliderVal(0);
      await fetchGroups();
      alert(`🗑️ "${deletingGroup.name}" moved to Recycle Bin.`);
    } catch (err: any) {
      console.error('Error moving group to recycle bin:', err);
      alert('Failed to move group to recycle bin: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // ── Restore Chit Group from Recycle Bin ────────────────────────────────────
  const handleRestoreGroup = async (group: any) => {
    try {
      setIsRestoringGroupId(group.id);
      triggerHapticFeedback('light');

      const { error } = await supabase
        .from('chit_groups')
        .update({
          status: 'draft',
          deleted_at: null,
        })
        .eq('id', group.id);

      if (error) throw error;

      await supabase.from('security_audit_logs').insert({
        action_description: `GROUP RESTORED FROM RECYCLE BIN: "${group.name}" (${group.id}) restored to Draft status.`,
        target_table: 'chit_groups',
      });

      triggerHapticFeedback('success');
      await fetchGroups();
      alert(`✨ "${group.name}" restored successfully to Draft!`);
    } catch (err: any) {
      console.error('Error restoring group:', err);
      alert('Failed to restore group: ' + (err.message || 'Unknown error'));
    } finally {
      setIsRestoringGroupId(null);
    }
  };

  // ── Permanent Deletion / Purge from Supabase Execution ───────────────────
  const handleExecutePermanentDeleteGroup = async () => {
    if (!deletingGroup) return;
    try {
      setIsDeletingGroup(true);
      triggerHapticFeedback('warning');

      // 1. Delete transactions for this group
      await supabase.from('transactions').delete().eq('group_id', deletingGroup.id);

      // 2. Delete auction_logs for this group
      await supabase.from('auction_logs').delete().eq('group_id', deletingGroup.id);

      // 3. Delete group_members
      await supabase.from('group_members').delete().eq('group_id', deletingGroup.id);

      // 4. Delete chit_group
      const { error } = await supabase.from('chit_groups').delete().eq('id', deletingGroup.id);

      if (error) {
        alert(`Database error deleting group: ${error.message}`);
        return;
      }

      // 5. Audit log
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      await supabase.from('security_audit_logs').insert({
        action_description: `PERMANENTLY PURGED CHIT GROUP: "${deletingGroup.name}" (Pool ₹${deletingGroup.totalValue?.toLocaleString('en-IN')}) with all enrolled tickets and logs`,
        target_table: 'chit_groups',
      });

      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'chit_groups',
          desc: `PERMANENTLY PURGED CHIT GROUP: "${deletingGroup.name}" (Pool ₹${deletingGroup.totalValue?.toLocaleString('en-IN')}) with all enrolled tickets and logs`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      // Update state
      setLocalGroups(prev => prev.filter(g => g.id !== deletingGroup.id));
      if (selectedWorkspaceGroupId === deletingGroup.id) {
        setSelectedWorkspaceGroupId(null);
      }
      setDeletingGroup(null);
      setDeletePhraseInput('');
      setDeleteSliderVal(0);
      alert(`✅ Chit Group "${deletingGroup.name}" has been permanently purged from Supabase.`);
    } catch (err: any) {
      alert(`Error purging group: ${err.message}`);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteMode === 'soft') {
      await handleExecuteSoftDeleteGroup();
    } else {
      await handleExecutePermanentDeleteGroup();
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchProfiles();
    fetchPendingAtmRelocations();

    const channel = supabase
      .channel('realtime_atm_dashboard_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchPendingAtmRelocations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auction Schedule Configuration Modal state for Chits Directory cards
  const [scheduleModalGroup, setScheduleModalGroup] = useState<any | null>(null);

  // Compute canonical auction date for a group (uses computeNextAuctionDateTime for 100% unified math)
  const getGroupAuctionDate = (groupId: string, monthNum: number = 1): { display: string; isOverride: boolean; isOrientation?: boolean } => {
    if (monthNum === 0) {
      return { display: 'Orientation Collection Session (No Auction)', isOverride: false, isOrientation: true };
    }
    const group = localGroups.find(g => g.id === groupId);
    if (group?.nextAuctionDate) {
      const parts = group.nextAuctionDate.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const timeDisplay = group?.nextAuctionTime || group?.auctionTime ? ` · ${formatTime12h(group?.nextAuctionTime || group?.auctionTime)}` : '';
      return { display: formatAuctionDate(d) + timeDisplay + ' (Override)', isOverride: true };
    }
    const targetDate = computeNextAuctionDateTime({
      auction_day_of_month: group?.auctionDayOfMonth,
      auction_time: group?.auctionTime,
      next_auction_date: null,
      next_auction_time: null,
      start_date: group?.startDate,
      current_month: monthNum,
    });
    const timeDisplay = group?.auctionTime ? ` · ${formatTime12h(group.auctionTime)}` : '';
    return { display: formatAuctionDate(targetDate) + timeDisplay, isOverride: false };
  };

  // Reports Center Natural Language States
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Dashboard Dues & Collection States (Real defaults: 0)
  const [actualCollections, setActualCollections] = useState(0);
  const targetCollections = useMemo(() => {
    return localGroups.reduce((acc, g) => acc + (g.totalValue / (g.duration || 1)), 0);
  }, [localGroups]);

  // FIFO Cumulative Ledger — Starts empty until groups & dues are registered
  const [fifoMembers, setFifoMembers] = useState<FifoMember[]>([]);

  // Derive total outstanding per member
  const getMemberTotalDue = (member: FifoMember) =>
    member.ledger.reduce((sum, e) => sum + (e.original - e.paid), 0);

  // Expanded ledger rows state
  const [expandedLedgerIds, setExpandedLedgerIds] = useState<string[]>([]);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank' | 'Cheque'>('Cash');

  // Derive selected member for payment dialog
  const selectedFifoMember = fifoMembers.find(m => m.id === selectedMemberId) ?? null;
  const selectedMemberTotalDue = selectedFifoMember ? getMemberTotalDue(selectedFifoMember) : 0;

  // Dynamic Audit Log State (Starts empty, records live actions)
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // ── ChitBase Master Dashboard States ──────────────────────────────────────────
  const [activeDashboardGroupId, setActiveDashboardGroupId] = useState<string>('');
  const [selectedDashboardMonth, setSelectedDashboardMonth] = useState<number>(1);
  const [hidePaidMembers, setHidePaidMembers] = useState<boolean>(false);
  const [recordingPaymentMember, setRecordingPaymentMember] = useState<any | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [paymentWalletType, setPaymentWalletType] = useState<string>('cash_in_hand');
  const [quickPaymentAmount, setQuickPaymentAmount] = useState<string>('');
  const [paymentDateType, setPaymentDateType] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customPaymentDate, setCustomPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentAllocationMode, setPaymentAllocationMode] = useState<'auto' | 'custom'>('auto');
  const [paymentCustomMonths, setPaymentCustomMonths] = useState<number[]>([]);
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState<string>('');
  const [receiptFileToUpload, setReceiptFileToUpload] = useState<File | null>(null);
  const [dashboardTransactions, setDashboardTransactions] = useState<any[]>([]);
  const [dashboardAuctionLogs, setDashboardAuctionLogs] = useState<any[]>([]);
  const [dashboardGroupMembers, setDashboardGroupMembers] = useState<any[]>([]);
  const [loadingDashboardData, setLoadingDashboardData] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [isMarkingAllPaid, setIsMarkingAllPaid] = useState<boolean>(false);
  const [isClosingMonth, setIsClosingMonth] = useState<boolean>(false);
  const [showKaiIruppuBreakdown, setShowKaiIruppuBreakdown] = useState<boolean>(false);

  // Winner Prize Payout Disbursal Hub States
  const [showDisbursePayoutModal, setShowDisbursePayoutModal] = useState<boolean>(false);
  const [disbursePayoutAmount, setDisbursePayoutAmount] = useState<string>('');
  const [disbursePayoutWallet, setDisbursePayoutWallet] = useState<WalletType>('dad_bank');
  const [disbursePayoutDateType, setDisbursePayoutDateType] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [disbursePayoutCustomDate, setDisbursePayoutCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [disbursePayoutNote, setDisbursePayoutNote] = useState<string>('');
  const [disbursePayoutReceiptUrl, setDisbursePayoutReceiptUrl] = useState<string>('');
  const [disburseReceiptFileToUpload, setDisburseReceiptFileToUpload] = useState<File | null>(null);
  const [isProcessingDisbursal, setIsProcessingDisbursal] = useState<boolean>(false);
  const [disburseDeductThisMonth, setDisburseDeductThisMonth] = useState<boolean>(false);
  const [disburseDeductArrearMonths, setDisburseDeductArrearMonths] = useState<number[]>([]);
  const [disburseDeductAdvanceMonths, setDisburseDeductAdvanceMonths] = useState<number[]>([]);

  // Smooth Auto-Centering Refs & Effects for Selected Month & Active Chit Group Sliders
  const monthButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const chitGroupButtonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => {
      const activeMonthBtn = monthButtonsRef.current.get(selectedDashboardMonth);
      if (activeMonthBtn) {
        activeMonthBtn.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedDashboardMonth, activeDashboardGroupId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const activeGroupBtn = chitGroupButtonsRef.current.get(activeDashboardGroupId);
      if (activeGroupBtn) {
        activeGroupBtn.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeDashboardGroupId]);

  // ── Floating Action Button (FAB) Speed-Dial States ───────────────────────────
  const [isFabOpen, setIsFabOpen] = useState<boolean>(false);
  const [showQuickCollectModal, setShowQuickCollectModal] = useState<boolean>(false);
  const [showQuickPersonalDrawModal, setShowQuickPersonalDrawModal] = useState<boolean>(false);
  const [showQuickAtmModal, setShowQuickAtmModal] = useState<boolean>(false);

  // Handler for member selected from Quick Collect Modal (either via search or Passbook QR scan)
  const handleQuickMemberSelected = (member: CollectableMember) => {
    // 1. Switch to member's chit group & month if different
    if (member.groupId !== activeDashboardGroupId) {
      setActiveDashboardGroupId(member.groupId);
      setSelectedDashboardMonth(member.currentMonth !== undefined && member.currentMonth !== null ? member.currentMonth : 0);
    }

    // 2. Open existing recordingPaymentMember modal
    setRecordingPaymentMember({
      id: member.id,
      ticket: member.ticket,
      name: member.name,
      phone: member.phone,
      profileId: member.profileId,
      customInstallment: member.customInstallment,
      effectiveDue: member.effectiveDue,
      remaining: member.remainingThisMonth,
      totalPendingToday: member.totalPendingToday,
    });
    setEditingTransaction(null);
    const defaultAmount = member.totalPendingToday > 0 
      ? member.totalPendingToday 
      : (member.remainingThisMonth > 0 ? member.remainingThisMonth : 20000);
    setQuickPaymentAmount(defaultAmount.toString());
    setPaymentWalletType('cash_in_hand');
    setPaymentAllocationMode('auto');
    setPaymentCustomMonths([member.currentMonth]);
    setPaymentDateType('today');
    setCustomPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNote('');
    setPaymentReceiptUrl('');
    setIsFabOpen(false);
  };

  // ── Remind All Modal States & Handlers (ChitBase Style) ─────────────────────────
  const [showRemindModal, setShowRemindModal] = useState<boolean>(false);
  const [remindModalTab, setRemindModalTab] = useState<'individual' | 'group'>('individual');
  const [remindPhoneInputs, setRemindPhoneInputs] = useState<{ [memberId: string]: string }>({});
  const [savingMemberPhoneId, setSavingMemberPhoneId] = useState<string | null>(null);
  const [remindCopied, setRemindCopied] = useState<boolean>(false);

  // Helper: Generate individual subscriber WhatsApp reminder URL
  const generateMemberReminderWhatsAppUrl = (
    member: any,
    dueAmount: number,
    group: any,
    monthNum: number,
    phoneOverride?: string
  ) => {
    const rawPhone = phoneOverride || member.phone || '';
    const cleanDigits = normalizePhone(rawPhone);
    const effectivePhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const chitName = group?.name || 'Chit Fund';

    const text = `*Chit Fund Payment Reminder* 🔔\n\nDear *${member.name}* (Ticket #${member.ticket}),\n\nThis is a gentle reminder for your chit installment of *₹${dueAmount.toLocaleString('en-IN')}* for *${chitName}* (Month ${monthNum}).\n\nKindly arrange to settle the pending balance at your earliest convenience.\n\nThank you! 🙏`;

    if (effectivePhone) {
      return `https://wa.me/${effectivePhone}?text=${encodeURIComponent(text)}`;
    }
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  // Helper: Save phone number permanently to profile & open WhatsApp
  const handleSavePhoneAndSend = async (
    member: any,
    dueAmount: number,
    group: any,
    monthNum: number
  ) => {
    const enteredPhone = remindPhoneInputs[member.id]?.trim();
    if (!enteredPhone) {
      alert('Please enter a valid phone number.');
      return;
    }
    const cleanDigits = normalizePhone(enteredPhone);
    if (cleanDigits.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setSavingMemberPhoneId(member.id);

      if (member.profileId) {
        const { error: profErr } = await supabase
          .from('profiles')
          .update({ phone_number: cleanDigits })
          .eq('id', member.profileId);
        if (profErr) {
          console.warn('Error updating profile phone:', profErr.message);
        }
      }

      setDashboardGroupMembers(prev =>
        prev.map(m => (m.id === member.id ? { ...m, phone: cleanDigits } : m))
      );

      const url = generateMemberReminderWhatsAppUrl(member, dueAmount, group, monthNum, cleanDigits);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(`Failed to save phone number: ${err.message}`);
    } finally {
      setSavingMemberPhoneId(null);
    }
  };

  // Helper: Generate Group Broadcast Message text
  const generateGroupBroadcastText = (pendingMembersList: any[], group: any, monthNum: number) => {
    const chitName = group?.name || 'Chit Fund';
    const totalDue = pendingMembersList.reduce((sum, m) => sum + (m.remaining || 0), 0);
    const memberLines = pendingMembersList
      .map(m => `• *${m.name}* (Ticket #${m.ticket}) — *₹${(m.remaining || 0).toLocaleString('en-IN')}* pending`)
      .join('\n');

    return `🔔 *${chitName} — Month ${monthNum} Payment Reminder* 🔔\n\nDear Members,\nPlease find the collection status for Month ${monthNum}:\n\n${memberLines}\n\n*Total Pending: ₹${totalDue.toLocaleString('en-IN')}*\n\nKindly settle the pending dues via Cash or UPI at your earliest convenience.\n\nThank you! 🙏`;
  };

  // Helper: client-side image downscaling & compression to protect Supabase 500MB DB & 1GB Storage limits
  // Compresses any 5-10MB mobile photo down to ~30-50 KB without quality loss for receipts
  const compressImage = (file: File, maxWidth = 900, maxHeight = 900, quality = 0.72): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Image compression failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
    });
  };

  // Helper: compute effective ISO date timestamp based on date pill selection
  const computeEffectivePaymentDate = (dateType: 'today' | 'yesterday' | 'custom', customDate: string) => {
    const now = new Date();
    if (dateType === 'today') {
      return now.toISOString();
    } else if (dateType === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return yesterday.toISOString();
    } else {
      if (!customDate) return now.toISOString();
      const [year, month, day] = customDate.split('-').map(Number);
      const custom = new Date(year, (month || 1) - 1, day || 1, now.getHours(), now.getMinutes(), now.getSeconds());
      return custom.toISOString();
    }
  };

  // Helper: handle local image upload for receipt attachment
  const handleReceiptPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Photo size exceeds 15MB limit. Please choose a smaller image.');
      return;
    }
    setReceiptFileToUpload(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPaymentReceiptUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto-select first active group when groups load
  useEffect(() => {
    const validGroups = localGroups.filter(g => g.status !== 'deleted');
    if (validGroups.length > 0) {
      if (!activeDashboardGroupId || !validGroups.some(g => g.id === activeDashboardGroupId)) {
        const firstActive = validGroups.find(g => g.status === 'active') || validGroups[0];
        setActiveDashboardGroupId(firstActive.id);
        setSelectedDashboardMonth(firstActive.currentMonth !== undefined && firstActive.currentMonth !== null ? firstActive.currentMonth : 0);
      }
    }
  }, [localGroups, activeDashboardGroupId]);

  // Fetch group data for dashboard
  const fetchDashboardData = async (groupId: string) => {
    if (!groupId) return;
    try {
      setLoadingDashboardData(true);

      // 1. Fetch group members with profiles
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select(`
          id,
          ticket_number,
          has_won_regular,
          profile_id,
          custom_installment,
          profiles:profile_id (
            id,
            full_name,
            phone_number
          )
        `)
        .eq('group_id', groupId)
        .order('ticket_number', { ascending: true });

      if (membersError) console.warn('Error fetching group members for dashboard:', membersError.message);

      if (membersData) {
        setDashboardGroupMembers(
          membersData.map((m: any) => {
            const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return {
              id: m.id,
              ticket: m.ticket_number,
              hasWon: m.has_won_regular,
              profileId: m.profile_id,
              customInstallment: m.custom_installment ? Number(m.custom_installment) : null,
              name: prof?.full_name || `Subscriber #${m.ticket_number}`,
              phone: prof?.phone_number || '',
            };
          })
        );
      }

      // 2. Fetch transactions for this group
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (txError) console.warn('Error fetching transactions for dashboard:', txError.message);
      if (txData) {
        setDashboardTransactions(txData);
      }

      // 3. Fetch auction logs for this group joined with winner profiles
      const { data: logsData, error: logsError } = await supabase
        .from('auction_logs')
        .select(`
          *,
          winning_bidder:winning_bidder_id (
            id,
            full_name,
            phone_number
          )
        `)
        .eq('group_id', groupId)
        .order('month', { ascending: true });

      if (logsError) console.warn('Error fetching auction logs for dashboard:', logsError.message);
      if (logsData) {
        setDashboardAuctionLogs(
          logsData.map((l: any) => {
            const prof = Array.isArray(l.winning_bidder) ? l.winning_bidder[0] : l.winning_bidder;
            let bidStreamWinner = '';
            let bidStreamTicket: number | null = null;
            if (Array.isArray(l.bid_stream) && l.bid_stream.length > 0) {
              const maxBid = l.bid_stream.reduce((prev: any, curr: any) => (Number(curr.amount) > Number(prev.amount) ? curr : prev), l.bid_stream[0]);
              bidStreamWinner = maxBid?.memberName || '';
              bidStreamTicket = maxBid?.ticketNumber || null;
            }
            const discountAmt = Number(l.winning_discount ?? l.winning_bid ?? 0);
            return {
              ...l,
              winning_discount: discountAmt,
              winning_bid: discountAmt,
              winner_name: prof?.full_name || bidStreamWinner || 'Subscriber',
              winner_profile_id: l.winning_bidder_id,
              winner_phone: prof?.phone_number || '',
              winner_ticket: bidStreamTicket,
            };
          })
        );
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoadingDashboardData(false);
    }
  };

  useEffect(() => {
    if (activeDashboardGroupId) {
      fetchDashboardData(activeDashboardGroupId);
    }
  }, [activeDashboardGroupId]);

  // Helper: compute total collections paid by member for a specific month
  const getMemberPaidAmountForMonth = (profileIdOrMemberId: string, month: number) => {
    const monthPattern = new RegExp(`\\bMonth\\s+${month}\\b`, 'i');
    return dashboardTransactions
      .filter(t => 
        t.type === 'collection' && 
        (t.profile_id === profileIdOrMemberId || t.group_member_id === profileIdOrMemberId) &&
        (t.notes ? monthPattern.test(t.notes) : true)
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  };

  // Helper: Month label formatting (e.g. "Aug '26 M0 Launch & Orientation" or "Sep '26 M1 (1st Auction)")
  const getDashboardMonthLabel = (group: any, monthNum: number) => {
    let baseDate = new Date();
    if (group?.startDate) {
      const parsed = new Date(group.startDate);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }
    if (monthNum === 0) {
      const monthName = baseDate.toLocaleDateString('en-US', { month: 'short' });
      const yearShort = baseDate.getFullYear().toString().slice(-2);
      return `${monthName} '${yearShort} M0 Launch`;
    }
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthNum, 1);
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const yearShort = d.getFullYear().toString().slice(-2);
    return `${monthName} '${yearShort} M${monthNum}${monthNum === 1 ? ' (1st Auction)' : ''}`;
  };

  // Helper: compute smart multi-month payment allocations for live breakdown preview
  const computePaymentAllocations = (
    member: any,
    amountStr: string,
    mode: 'auto' | 'custom',
    customMonths: number[]
  ) => {
    const totalAmount = parseFloat(amountStr) || 0;
    if (!member || !activeDashboardGroupId || totalAmount <= 0) {
      return { allocations: [], deferredArrears: [], unallocated: totalAmount, totalAllocated: 0, monthsSummary: [] };
    }

    const activeGroup = localGroups.find(g => g.id === activeDashboardGroupId) || localGroups[0];
    const duration = activeGroup?.duration || activeGroup?.memberCount || 20;
    const totalChitVal = activeGroup?.totalValue || 200000;
    const baseInst = Math.round(totalChitVal / (activeGroup?.memberCount || duration || 1));
    const memberInst = member.customInstallment !== null && member.customInstallment !== undefined ? member.customInstallment : baseInst;

    const activeCurrentCycleMonth = (activeGroup?.currentMonth !== undefined && activeGroup?.currentMonth !== null) 
      ? Number(activeGroup.currentMonth) 
      : 0;

    // Build month breakdown for all months from 0 to duration (N+1 total cycles: M0 Launch + M1..MN)
    const monthsData: {
      month: number;
      label: string;
      expectedDue: number;
      alreadyPaid: number;
      remainingDue: number;
      isArrear: boolean;
      isCurrent: boolean;
      isFuture: boolean;
    }[] = [];

    for (let m = 0; m <= duration; m++) {
      const alreadyPaid = getMemberPaidAmountForMonth(member.profileId || member.id, m);
      const isArrear = m < activeCurrentCycleMonth;
      const isCurrent = m === activeCurrentCycleMonth;
      const isFuture = m > activeCurrentCycleMonth;
      const expectedDue = memberInst;
      const remainingDue = Math.max(0, expectedDue - alreadyPaid);

      monthsData.push({
        month: m,
        label: `M${m}`,
        expectedDue,
        alreadyPaid,
        remainingDue,
        isArrear,
        isCurrent,
        isFuture,
      });
    }

    const allocations: {
      month: number;
      amount: number;
      type: 'arrear' | 'current' | 'advance';
      statusAfter: 'cleared' | 'partial' | 'overpaid';
      priorPaid: number;
      due: number;
    }[] = [];

    const deferredArrears: {
      month: number;
      remainingDue: number;
    }[] = [];

    let remainingToAllocate = totalAmount;

    if (mode === 'auto') {
      // FIFO Order: 1) Past unpaid arrears (< activeCurrentCycleMonth), 2) Active current month (=== activeCurrentCycleMonth), 3) Upcoming advance months (> activeCurrentCycleMonth)
      const orderedMonths = [
        ...monthsData.filter(m => m.isArrear && m.remainingDue > 0),
        ...monthsData.filter(m => m.isCurrent),
        ...monthsData.filter(m => m.isFuture),
      ];

      for (const m of orderedMonths) {
        if (remainingToAllocate <= 0) break;
        const targetDue = m.remainingDue > 0 ? m.remainingDue : m.expectedDue;
        const canTake = targetDue > 0 ? targetDue : memberInst;
        const applying = Math.min(remainingToAllocate, canTake);
        if (applying > 0) {
          allocations.push({
            month: m.month,
            amount: applying,
            type: m.isArrear ? 'arrear' : m.isCurrent ? 'current' : 'advance',
            statusAfter: (m.alreadyPaid + applying) >= m.expectedDue ? 'cleared' : 'partial',
            priorPaid: m.alreadyPaid,
            due: m.expectedDue,
          });
          remainingToAllocate -= applying;
        }
      }
    } else {
      // Custom / Targeted Mode: Apply only to selected months
      const selectedSet = new Set(customMonths);
      
      // Identify deferred past arrears that are NOT selected
      monthsData.filter(m => m.isArrear && m.remainingDue > 0 && !selectedSet.has(m.month)).forEach(m => {
        deferredArrears.push({ month: m.month, remainingDue: m.remainingDue });
      });

      // Allocate in order among selected months
      const selectedMonthsData = monthsData.filter(m => selectedSet.has(m.month));
      for (const m of selectedMonthsData) {
        if (remainingToAllocate <= 0) break;
        const targetDue = m.remainingDue > 0 ? m.remainingDue : m.expectedDue;
        const canTake = targetDue > 0 ? targetDue : memberInst;
        const applying = Math.min(remainingToAllocate, canTake);
        if (applying > 0) {
          allocations.push({
            month: m.month,
            amount: applying,
            type: m.isArrear ? 'arrear' : m.isCurrent ? 'current' : 'advance',
            statusAfter: (m.alreadyPaid + applying) >= m.expectedDue ? 'cleared' : 'partial',
            priorPaid: m.alreadyPaid,
            due: m.expectedDue,
          });
          remainingToAllocate -= applying;
        }
      }
    }

    // Surplus cash handling
    if (remainingToAllocate > 0) {
      if (allocations.length > 0) {
        allocations[allocations.length - 1].amount += remainingToAllocate;
        allocations[allocations.length - 1].statusAfter = 'overpaid';
      } else {
        allocations.push({
          month: activeCurrentCycleMonth,
          amount: remainingToAllocate,
          type: 'current',
          statusAfter: 'overpaid',
          priorPaid: 0,
          due: memberInst,
        });
      }
      remainingToAllocate = 0;
    }

    const totalAllocated = totalAmount - remainingToAllocate;

    return { allocations, deferredArrears, unallocated: remainingToAllocate, totalAllocated, monthsSummary: monthsData };
  };

  // 1-Tap Record Quick Payment Handler (with Smart Multi-Month Allocation)
  const handleRecordQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingPaymentMember || !activeDashboardGroupId) return;

    const amt = parseFloat(quickPaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    try {
      setIsProcessingPayment(true);

      // 1. Process receipt image compression & Supabase Storage upload
      let finalReceiptUrl = paymentReceiptUrl || null;
      if (receiptFileToUpload) {
        try {
          const compressedBlob = await compressImage(receiptFileToUpload);
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
          const filePath = `${activeDashboardGroupId}/${fileName}`;

          const { error: storageErr } = await supabase.storage
            .from('receipts')
            .upload(filePath, compressedBlob, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!storageErr) {
            const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
            finalReceiptUrl = publicUrl;
          } else {
            console.warn('Supabase storage upload note:', storageErr.message);
          }
        } catch (imgErr) {
          console.warn('Image compression/upload note:', imgErr);
        }
      }

      const effectiveDateStr = computeEffectivePaymentDate(paymentDateType, customPaymentDate);
      
      // 2. Compute allocations
      const { allocations } = computePaymentAllocations(
        recordingPaymentMember,
        quickPaymentAmount,
        paymentAllocationMode,
        paymentCustomMonths
      );

      if (allocations.length === 0) {
        alert('Please specify at least one target month or enter a valid amount.');
        return;
      }

      // 3. Build atomic collection rows per allocated month
      const rowsToInsert = allocations.map(item => {
        const typeLabel = item.type === 'arrear' 
          ? ' (Arrear Cleared)' 
          : item.type === 'advance' 
            ? ' (Advance Pre-paid)' 
            : '';
        const defaultNote = `Month ${item.month}${typeLabel} collection payment - Ticket #${recordingPaymentMember.ticket} (${recordingPaymentMember.name})`;
        const finalNote = paymentNote.trim() ? `${defaultNote} — Note: ${paymentNote.trim()}` : defaultNote;

        return {
          group_id: activeDashboardGroupId,
          profile_id: recordingPaymentMember.profileId || null,
          group_member_id: recordingPaymentMember.id || null,
          wallet_type: paymentWalletType,
          type: 'collection',
          status: 'completed',
          amount: item.amount,
          notes: finalNote,
          verification_proof_url: finalReceiptUrl,
          created_at: effectiveDateStr,
          created_by: profile?.id || null,
        };
      });

      const { error: txErr } = await supabase
        .from('transactions')
        .insert(rowsToInsert);

      if (txErr) {
        alert('Failed to record payment in database: ' + txErr.message);
        return;
      }

      // 4. Increment global treasury balance for this wallet by total amount
      await updateBalance(paymentWalletType as any, amt);

      // 5. Update audit logs with allocation summary
      const summaryStr = allocations.map(a => `M${a.month}: ₹${a.amount.toLocaleString('en-IN')}`).join(', ');
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'transactions',
          desc: `COLLECTION: Received ₹${amt.toLocaleString('en-IN')} via ${paymentWalletType.replace(/_/g, ' ')} from ${recordingPaymentMember.name} (Ticket #${recordingPaymentMember.ticket}) — [${summaryStr}]`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      setRecordingPaymentMember(null);
      setQuickPaymentAmount('');
      setPaymentNote('');
      setPaymentReceiptUrl('');
      setReceiptFileToUpload(null);
      setPaymentDateType('today');
      setPaymentAllocationMode('auto');
      setPaymentCustomMonths([]);
      await fetchDashboardData(activeDashboardGroupId);
    } catch (err: any) {
      console.error('Error processing quick payment:', err);
      alert('An error occurred while processing payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Open Edit Payment Modal Handler
  const handleOpenEditPayment = (tx: any) => {
    setEditingTransaction(tx);
    setRecordingPaymentMember(null);
    setQuickPaymentAmount(String(tx.amount || ''));
    setPaymentWalletType(tx.wallet_type || 'cash_in_hand');
    setPaymentNote(tx.notes || '');
    setPaymentReceiptUrl(tx.verification_proof_url || '');
    setReceiptFileToUpload(null);

    if (tx.created_at) {
      const txDate = new Date(tx.created_at);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      if (isSameDay(txDate, today)) {
        setPaymentDateType('today');
        setCustomPaymentDate(today.toISOString().split('T')[0]);
      } else if (isSameDay(txDate, yesterday)) {
        setPaymentDateType('yesterday');
        setCustomPaymentDate(yesterday.toISOString().split('T')[0]);
      } else {
        setPaymentDateType('custom');
        setCustomPaymentDate(txDate.toISOString().split('T')[0]);
      }
    } else {
      setPaymentDateType('today');
      setCustomPaymentDate(new Date().toISOString().split('T')[0]);
    }
  };

  // Save Payment Edit Handler
  const handleSavePaymentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction || !activeDashboardGroupId) return;

    const newAmt = parseFloat(quickPaymentAmount);
    if (isNaN(newAmt) || newAmt <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    try {
      setIsProcessingPayment(true);

      // 1. Process receipt image compression & upload if new file picked
      let finalReceiptUrl = paymentReceiptUrl || null;
      if (receiptFileToUpload) {
        try {
          const compressedBlob = await compressImage(receiptFileToUpload);
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
          const filePath = `${activeDashboardGroupId}/${fileName}`;

          const { error: storageErr } = await supabase.storage
            .from('receipts')
            .upload(filePath, compressedBlob, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!storageErr) {
            const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
            finalReceiptUrl = publicUrl;
          } else {
            console.warn('Supabase storage upload note:', storageErr.message);
          }
        } catch (imgErr) {
          console.warn('Image compression/upload note:', imgErr);
        }
      }

      const effectiveDateStr = computeEffectivePaymentDate(paymentDateType, customPaymentDate);
      const oldAmt = Number(editingTransaction.amount || 0);
      const oldWallet = editingTransaction.wallet_type;
      const newWallet = paymentWalletType;

      // 2. Update transaction in database
      const { error: updateErr } = await supabase
        .from('transactions')
        .update({
          amount: newAmt,
          wallet_type: newWallet,
          notes: paymentNote,
          verification_proof_url: finalReceiptUrl,
          created_at: effectiveDateStr,
        })
        .eq('id', editingTransaction.id);

      if (updateErr) {
        alert('Failed to update payment: ' + updateErr.message);
        return;
      }

      // 3. Adjust treasury balances accurately
      if (oldWallet === newWallet) {
        const delta = newAmt - oldAmt;
        if (delta !== 0) {
          await updateBalance(newWallet as any, delta);
        }
      } else {
        await updateBalance(oldWallet as any, -oldAmt);
        await updateBalance(newWallet as any, newAmt);
      }

      // 4. Audit log
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'transactions',
          desc: `PAYMENT EDITED: Updated receipt #${editingTransaction.id.slice(0, 8)} to ₹${newAmt.toLocaleString('en-IN')} (${newWallet.replace(/_/g, ' ')})`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      setEditingTransaction(null);
      setQuickPaymentAmount('');
      setPaymentNote('');
      setPaymentReceiptUrl('');
      setReceiptFileToUpload(null);
      await fetchDashboardData(activeDashboardGroupId);
    } catch (err: any) {
      console.error('Error updating payment:', err);
      alert('An error occurred while updating payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Delete/Void Payment Handler
  const handleDeletePayment = async (tx: any) => {
    const amt = Number(tx.amount || 0);
    const confirmMsg = `Are you sure you want to void/delete this payment receipt of ₹${amt.toLocaleString('en-IN')}?\n\nThis will deduct ₹${amt.toLocaleString('en-IN')} from ${tx.wallet_type?.replace(/_/g, ' ')} balance.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsProcessingPayment(true);

      // 0. Clean up storage if URL points to Supabase storage
      if (tx.verification_proof_url && tx.verification_proof_url.includes('/storage/v1/object/public/receipts/')) {
        try {
          const path = tx.verification_proof_url.split('/storage/v1/object/public/receipts/')[1];
          if (path) {
            await supabase.storage.from('receipts').remove([decodeURIComponent(path)]);
          }
        } catch (e) {
          console.warn('Storage cleanup note:', e);
        }
      }

      // 1. Delete from database
      const { error: delErr } = await supabase
        .from('transactions')
        .delete()
        .eq('id', tx.id);

      if (delErr) {
        alert('Failed to delete payment: ' + delErr.message);
        return;
      }

      // 2. Revert wallet balance
      await updateBalance(tx.wallet_type as any, -amt);

      // 3. Audit log
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'transactions',
          desc: `PAYMENT DELETED: Voided ₹${amt.toLocaleString('en-IN')} from ${tx.wallet_type?.replace(/_/g, ' ')}`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      if (editingTransaction?.id === tx.id) {
        setEditingTransaction(null);
      }

      await fetchDashboardData(activeDashboardGroupId);
    } catch (err: any) {
      console.error('Error deleting payment:', err);
      alert('An error occurred while deleting payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ── Winner Prize Payout Disbursal Handlers ──────────────────────────────────
  const handleOpenDisburseModal = (remainingDue: number) => {
    setDisbursePayoutAmount(remainingDue > 0 ? remainingDue.toString() : '');
    setDisbursePayoutWallet('dad_bank');
    setDisbursePayoutDateType('today');
    setDisbursePayoutCustomDate(new Date().toISOString().split('T')[0]);
    setDisbursePayoutNote('');
    setDisbursePayoutReceiptUrl('');
    setDisburseReceiptFileToUpload(null);
    setDisburseDeductThisMonth(false);
    setDisburseDeductArrearMonths([]);
    setDisburseDeductAdvanceMonths([]);
    setShowDisbursePayoutModal(true);
  };

  const handleDisburseReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Photo size exceeds 15MB limit. Please choose a smaller image.');
      return;
    }
    setDisburseReceiptFileToUpload(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setDisbursePayoutReceiptUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRecordPrizePayoutSubmit = async (
    e: React.FormEvent,
    activeGroup: any,
    currentMonthAuction: any,
    netPrizePot: number,
    remainingDue: number,
    deductionsList: { month: number; amount: number; label: string }[] = []
  ) => {
    e.preventDefault();
    if (!activeGroup || !currentMonthAuction) return;

    const netCashAmount = Number(disbursePayoutAmount) || 0;
    const totalDeductions = deductionsList.reduce((sum, d) => sum + d.amount, 0);

    if (netCashAmount <= 0 && totalDeductions <= 0) {
      alert('Please enter a valid disbursal or deduction amount.');
      return;
    }

    const currentBal = balances[disbursePayoutWallet as keyof typeof balances] || 0;
    if (netCashAmount > 0 && currentBal < netCashAmount) {
      const confirmProceed = window.confirm(
        `Warning: Selected vault (${disbursePayoutWallet.replace(/_/g, ' ')}) has ${formatCurrency(currentBal)}, which is less than the payout amount (${formatCurrency(netCashAmount)}).\n\nDo you still wish to record this payout?`
      );
      if (!confirmProceed) return;
    }

    try {
      setIsProcessingDisbursal(true);

      const effectiveDate = computeEffectivePaymentDate(disbursePayoutDateType, disbursePayoutCustomDate);
      const winningBid = Number(currentMonthAuction.winning_discount ?? currentMonthAuction.winning_bid ?? 0);
      const winnerProfileId = currentMonthAuction.winning_bidder_id || currentMonthAuction.winner_profile_id || currentMonthAuction.winner_id;
      const memberMatch = dashboardGroupMembers.find(m => 
        (winnerProfileId && (m.profileId === winnerProfileId || m.id === winnerProfileId)) ||
        (currentMonthAuction.winner_name && m.name.toLowerCase() === currentMonthAuction.winner_name.toLowerCase())
      );
      const winnerName = memberMatch?.name || currentMonthAuction.winner_name || currentMonthAuction.winning_bidder?.full_name || 'Subscriber';

      let finalReceiptUrl = disbursePayoutReceiptUrl || null;
      if (disburseReceiptFileToUpload) {
        try {
          const compressedBlob = await compressImage(disburseReceiptFileToUpload);
          const reader = new FileReader();
          const base64Data = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(compressedBlob);
          });
          finalReceiptUrl = base64Data;
        } catch (compErr) {
          console.warn('Disbursal receipt compression warning:', compErr);
        }
      }

      const deductionSummaryStr = deductionsList.length > 0 
        ? ` (Offset ${deductionsList.map(d => `M${d.month}: ${formatCurrency(d.amount)}`).join(', ')})`
        : '';
      const noteText = `Month ${selectedDashboardMonth} Winner Prize Payout - ${winnerName} (Discount: ${formatCurrency(winningBid)})${deductionSummaryStr}${disbursePayoutNote.trim() ? ` — Note: ${disbursePayoutNote.trim()}` : ''}`;

      // 1. If net cash handed over > 0, insert 'payout' transaction and debit wallet
      if (netCashAmount > 0) {
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            group_id: activeGroup.id,
            group_member_id: memberMatch?.id || null,
            profile_id: memberMatch?.profileId || (winnerProfileId || null),
            type: 'payout',
            status: 'completed',
            amount: netCashAmount,
            wallet_type: disbursePayoutWallet,
            notes: noteText,
            verification_proof_url: finalReceiptUrl,
            created_at: effectiveDate,
            created_by: profile?.id || null,
          });

        if (txError) {
          alert(`Failed to save prize payout: ${txError.message}`);
          return;
        }

        // Debit treasury wallet by net cash amount
        await updateBalance(disbursePayoutWallet as any, -netCashAmount);
      }

      // 2. For each deducted month, insert 'collection' transaction automatically
      if (deductionsList.length > 0) {
        const collectionRows = deductionsList.map(d => ({
          group_id: activeGroup.id,
          group_member_id: memberMatch?.id || null,
          profile_id: memberMatch?.profileId || (winnerProfileId || null),
          type: 'collection',
          status: 'completed',
          amount: d.amount,
          wallet_type: disbursePayoutWallet,
          notes: `Month ${d.month} installment auto-settled & deducted from Month ${selectedDashboardMonth} Winner Prize Payout — Ticket #${memberMatch?.ticket || 1} (${winnerName})`,
          created_at: effectiveDate,
          created_by: profile?.id || null,
        }));

        const { error: collError } = await supabase
          .from('transactions')
          .insert(collectionRows);

        if (collError) {
          console.warn('Auto collection insert note:', collError.message);
        }
      }

      // 3. Audit Log
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'transactions',
          desc: `PRIZE SETTLEMENT: Paid ${formatCurrency(netCashAmount)} net cash to ${winnerName} for Month ${selectedDashboardMonth} via ${disbursePayoutWallet.replace(/_/g, ' ')}${deductionSummaryStr}`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      setShowDisbursePayoutModal(false);
      setDisbursePayoutAmount('');
      setDisbursePayoutNote('');
      setDisbursePayoutReceiptUrl('');
      setDisburseReceiptFileToUpload(null);
      setDisburseDeductThisMonth(false);
      setDisburseDeductArrearMonths([]);
      setDisburseDeductAdvanceMonths([]);
      await fetchDashboardData(activeDashboardGroupId);
      alert(`✅ Successfully recorded prize settlement for ${winnerName}!\n• Net Cash Paid Out: ${formatCurrency(netCashAmount)}${deductionSummaryStr ? `\n• Dues Settled & Marked PAID: ${deductionSummaryStr}` : ''}`);
    } catch (err: any) {
      alert(`Error recording prize disbursal: ${err.message}`);
    } finally {
      setIsProcessingDisbursal(false);
    }
  };

  const handleSharePayoutWhatsApp = (
    activeGroup: any,
    winnerName: string,
    winnerPhone: string,
    monthNum: number,
    netPrizePot: number,
    winningBid: number,
    totalDisbursed: number,
    remainingDue: number,
    recentWalletName?: string,
    deductionsSummary?: string
  ) => {
    const rawDigits = normalizePhone(winnerPhone);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const text = encodeURIComponent(
`🏆 *CHIT PRIZE SETTLEMENT RECEIPT*
───────────────────────
🏢 *Group:* ${activeGroup.name}
🗓️ *Month:* Month ${monthNum} (${getDashboardMonthLabel(activeGroup, monthNum)})
👤 *Winner Subscriber:* ${winnerName}
💰 *Total Chit Value:* ${formatCurrency(activeGroup.totalValue)}
📉 *Winning Discount Bid:* ${formatCurrency(winningBid)}
───────────────────────
💵 *Gross Prize Pot Due:* ${formatCurrency(netPrizePot)}
${deductionsSummary ? `➖ *Installment Deductions / Offsets:*\n${deductionsSummary}\n───────────────────────\n` : ''}💸 *Net Cash Transferred:* ${formatCurrency(totalDisbursed)}
${recentWalletName ? `🏦 *Disbursed Via:* ${recentWalletName}\n` : ''}📅 *Date:* ${dateStr}
⚖️ *Remaining Balance Due:* ${formatCurrency(remainingDue)}
───────────────────────
${remainingDue === 0 ? '✅ *STATUS: FULLY SETTLED*' : '⏳ *STATUS: PARTIALLY SETTLED*'}
Thank you for being a valued member of our Chit Fund family! 🙏`
    );

    const waUrl = rawDigits.length === 10
      ? `https://wa.me/91${rawDigits}?text=${text}`
      : `https://wa.me/?text=${text}`;

    window.open(waUrl, '_blank');
  };

  // Mark All Paid Handler
  const handleMarkAllPaid = async () => {
    const activeGroup = localGroups.find(g => g.id === activeDashboardGroupId);
    if (!activeGroup || dashboardGroupMembers.length === 0) return;

    const standardInstallment = Math.round(activeGroup.totalValue / (activeGroup.memberCount || activeGroup.duration || 1));
    const isLaaba = (activeGroup.kaiIruppuPool || 0) >= activeGroup.totalValue;
    const monthDue = isLaaba ? 0 : standardInstallment;

    if (monthDue === 0) {
      alert('This month is a Laaba Seetu month with ₹0 installment due for members.');
      return;
    }

    const pendingMembers: { member: any; unpaidAmount: number }[] = [];
    dashboardGroupMembers.forEach(m => {
      const memDue = m.customInstallment !== null ? m.customInstallment : monthDue;
      const paid = getMemberPaidAmountForMonth(m.profileId || m.id, selectedDashboardMonth);
      const remaining = Math.max(0, memDue - paid);
      if (remaining > 0) {
        pendingMembers.push({ member: m, unpaidAmount: remaining });
      }
    });

    if (pendingMembers.length === 0) {
      alert('All members have already paid their dues for Month ' + selectedDashboardMonth + '!');
      return;
    }

    const totalToCollect = pendingMembers.reduce((sum, p) => sum + p.unpaidAmount, 0);
    const confirm = window.confirm(
      `Mark all ${pendingMembers.length} remaining members as PAID for Month ${selectedDashboardMonth}?\n\nTotal to collect: ₹${totalToCollect.toLocaleString('en-IN')} into Cash in Hand.`
    );
    if (!confirm) return;

    try {
      setIsMarkingAllPaid(true);

      const txsToInsert = pendingMembers.map(p => ({
        group_id: activeDashboardGroupId,
        profile_id: p.member.profileId || null,
        group_member_id: p.member.id || null,
        wallet_type: 'cash_in_hand',
        type: 'collection',
        status: 'completed',
        amount: p.unpaidAmount,
        notes: `Month ${selectedDashboardMonth} collection payment - Ticket #${p.member.ticket} (${p.member.name}) [Bulk Mark All Paid]`,
        created_by: profile?.id || null,
      }));

      const { error: insertErr } = await supabase.from('transactions').insert(txsToInsert);
      if (insertErr) {
        alert('Error bulk inserting transactions: ' + insertErr.message);
        return;
      }

      // Update Cash in Hand treasury balance
      await updateBalance('cash_in_hand', totalToCollect);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'transactions',
          desc: `BULK COLLECTION: Marked all ${pendingMembers.length} members paid for Month ${selectedDashboardMonth} (₹${totalToCollect.toLocaleString('en-IN')} to Cash in Hand)`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      await fetchDashboardData(activeDashboardGroupId);
    } catch (err: any) {
      console.error('Error marking all paid:', err);
      alert('Failed to mark all paid.');
    } finally {
      setIsMarkingAllPaid(false);
    }
  };

  // Close Month Cycle Handler / Confirm Launch
  const handleCloseMonth = async () => {
    const activeGroup = localGroups.find(g => g.id === activeDashboardGroupId);
    if (!activeGroup) return;

    const currentMonth = activeGroup.currentMonth !== undefined && activeGroup.currentMonth !== null ? activeGroup.currentMonth : 0;
    const maxMonths = activeGroup.duration || activeGroup.memberCount || 20;

    if (selectedDashboardMonth !== currentMonth) {
      alert(`You are currently viewing Month ${selectedDashboardMonth}. The active ongoing month is Month ${currentMonth}.`);
      return;
    }

    if (currentMonth === 0) {
      const confirmLaunch = window.confirm(
        `CONFIRM LAUNCH (Month 0)?\n\nAll launch collections (₹${activeGroup.totalValue?.toLocaleString('en-IN')}) are allocated to the Organizer as Organizer Profit.\n\nAdvance "${activeGroup.name}" to Month 1 (Live Auctions Phase)?`
      );
      if (!confirmLaunch) return;

      try {
        setIsClosingMonth(true);
        const { error } = await supabase
          .from('chit_groups')
          .update({ current_month: 1 })
          .eq('id', activeDashboardGroupId);

        if (error) {
          alert('Error advancing to Month 1: ' + error.message);
          return;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setAuditLogs(prev => [
          {
            timestamp: `Today, ${timeStr}`,
            table: 'chit_groups',
            desc: `LAUNCH CONFIRMED: "${activeGroup.name}" — ₹${activeGroup.totalValue?.toLocaleString('en-IN')} allocated as Organizer Profit for Month 0. Group advanced to Month 1.`,
            executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
          },
          ...prev,
        ]);

        await fetchGroups();
        setSelectedDashboardMonth(1);
      } catch (err: any) {
        console.error('Error confirming launch:', err);
      } finally {
        setIsClosingMonth(false);
      }
      return;
    }

    if (currentMonth >= maxMonths) {
      const confirmComplete = window.confirm(
        `This chit group has reached its final duration (${maxMonths} months). Close this final month and mark group as Completed?`
      );
      if (!confirmComplete) return;

      try {
        setIsClosingMonth(true);
        await supabase
          .from('chit_groups')
          .update({ status: 'completed' })
          .eq('id', activeDashboardGroupId);

        await fetchGroups();
        alert(`Group "${activeGroup.name}" is now marked as Completed!`);
      } catch (err: any) {
        console.error('Error completing group:', err);
      } finally {
        setIsClosingMonth(false);
      }
      return;
    }

    const nextMonth = currentMonth + 1;
    const confirm = window.confirm(
      `Close Month ${currentMonth} and advance "${activeGroup.name}" to Month ${nextMonth}?`
    );
    if (!confirm) return;

    try {
      setIsClosingMonth(true);
      const { error } = await supabase
        .from('chit_groups')
        .update({ current_month: nextMonth })
        .eq('id', activeDashboardGroupId);

      if (error) {
        alert('Error advancing month: ' + error.message);
        return;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'chit_groups',
          desc: `ADVANCED CYCLE: Group "${activeGroup.name}" advanced from Month ${currentMonth} to Month ${nextMonth}`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      await fetchGroups();
      setSelectedDashboardMonth(nextMonth);
    } catch (err: any) {
      console.error('Error closing month:', err);
    } finally {
      setIsClosingMonth(false);
    }
  };

  // Revert / Rollback Active Month Cycle Handler
  const handleRevertMonth = async () => {
    const activeGroup = localGroups.find(g => g.id === activeDashboardGroupId);
    if (!activeGroup) return;

    const currentMonth = activeGroup.currentMonth !== undefined && activeGroup.currentMonth !== null ? activeGroup.currentMonth : 0;
    if (currentMonth <= 0) {
      alert('This chit group is currently at Month 0 (Launch Month) and cannot be rolled back further.');
      return;
    }

    const prevMonth = currentMonth - 1;
    const confirmRevert = window.confirm(
      `REVERT ACTIVE MONTH CYCLE?\n\nAre you sure you want to revert "${activeGroup.name}" from Month ${currentMonth} back to Month ${prevMonth}${prevMonth === 0 ? ' (Launch & Orientation Phase)' : ''}?\n\n(All past recorded collections and subscriber ledger entries remain completely preserved.)`
    );
    if (!confirmRevert) return;

    try {
      setIsClosingMonth(true);
      const { error } = await supabase
        .from('chit_groups')
        .update({ current_month: prevMonth, status: 'active' })
        .eq('id', activeDashboardGroupId);

      if (error) {
        alert('Error reverting month: ' + error.message);
        return;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'chit_groups',
          desc: `REVERTED CYCLE: "${activeGroup.name}" rolled back from Month ${currentMonth} to Month ${prevMonth} by Admin`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      await fetchGroups();
      setSelectedDashboardMonth(prevMonth);
    } catch (err: any) {
      console.error('Error reverting month:', err);
      alert('Failed to revert month.');
    } finally {
      setIsClosingMonth(false);
    }
  };

  // WhatsApp Receipt Link Generator
  const generateWhatsAppReceiptUrl = (member: any, paidAmount: number, totalDue: number, tx?: any) => {
    const activeGroup = localGroups.find(g => g.id === activeDashboardGroupId);
    const dateStr = tx?.created_at 
      ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const rawPhone = member.phone || '';
    const digits = rawPhone.replace(/\D/g, '');
    const cleanPhone = digits.length === 10 ? `91${digits}` : digits;

    const remaining = Math.max(0, totalDue - paidAmount);
    const msg = 
`*CHIT FUNDS PAYMENT RECEIPT* 🧾
----------------------------------
*Group:* ${activeGroup?.name || 'Chit Group'}
*Month:* Month ${selectedDashboardMonth}
*Ticket No:* #${member.ticket}
*Subscriber:* ${member.name}
*Amount Paid:* ₹${Number(tx?.amount || paidAmount).toLocaleString('en-IN')}
*Payment Mode:* ${tx?.wallet_type ? tx.wallet_type.replace(/_/g, ' ').toUpperCase() : 'Cash'}
*Date:* ${dateStr}
----------------------------------
*Total Due this Month:* ₹${totalDue.toLocaleString('en-IN')}
*Remaining Balance:* ₹${remaining.toLocaleString('en-IN')}
*Status:* ${remaining === 0 ? '✅ FULLY CLEARED' : '⏳ PARTIAL'}

Thank you for your prompt payment! 🙏`;

    const encodedMsg = encodeURIComponent(msg);
    return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
  };

  const handleDurationChange = (val: string) => {
    setNewGroupDuration(val);
    const num = Number(val);
    if (isNaN(num) || num <= 0) return;
    
    setEnrollments(prev => {
      const copy = [...prev];
      if (copy.length < num) {
        while (copy.length < num) {
          copy.push({ id: undefined, name: '', phone: '' });
        }
      } else if (copy.length > num) {
        return copy.slice(0, num);
      }
      return copy;
    });
  };

  const handleEnrollmentChange = (index: number, field: 'name' | 'phone', val: string) => {
    setEnrollments(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleClearSlot = (index: number) => {
    setEnrollments(prev => {
      const copy = [...prev];
      copy[index] = { id: undefined, name: '', phone: '' };
      return copy;
    });
  };

  // Helper: Auto-generate clean, readable Chit Group name
  const handleAutoGenerateName = () => {
    const val = Number(newGroupValue) || 100000;
    const dur = Number(newGroupDuration) || 20;
    const valFormatted = val >= 100000 ? `${val / 100000}L` : `${val / 1000}K`;
    let dateSuffix = '2026';
    if (newGroupStartDate) {
      const d = new Date(newGroupStartDate);
      if (!isNaN(d.getTime())) {
        const monthShort = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const yearShort = d.getFullYear().toString().slice(-2);
        dateSuffix = `${monthShort}${yearShort}`;
      }
    }
    const genName = `G-${valFormatted}-${dur}M-${dateSuffix}`;
    setNewGroupName(genName);
    triggerHapticFeedback('light');
  };

  // Helper: Automatically calculate & snap Launch Date (Month 0 Start) to the 1st Sunday on/after the selected cutoff day
  const updateLaunchDateFromRule = (cutoffDay: number, baseDateStr?: string) => {
    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    if (baseDateStr) {
      const parts = baseDateStr.split('-');
      if (parts.length === 3) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
      }
    }
    const sunday = getFirstSundayOnOrAfterDay(year, month, cutoffDay);
    const yyyy = sunday.getFullYear();
    const mm = String(sunday.getMonth() + 1).padStart(2, '0');
    const dd = String(sunday.getDate()).padStart(2, '0');
    setNewGroupStartDate(`${yyyy}-${mm}-${dd}`);
  };

  // Helper: Clear all slots
  const handleClearAllSlots = () => {
    triggerHapticFeedback('light');
    const dur = Number(newGroupDuration) || 5;
    setEnrollments(Array.from({ length: dur }, () => ({ id: undefined, name: '', phone: '' })));
  };

  const handleAssignExistingMember = (member: { id?: string; name: string; phone: string }, targetSlotIndex?: number) => {
    const isAlreadyAdded = enrollments.some(e => e.name.toLowerCase() === member.name.toLowerCase());
    if (isAlreadyAdded) {
      alert(`"${member.name}" is already assigned to a ticket in this chit group.`);
      return;
    }
    const slotIdx = (targetSlotIndex !== undefined && targetSlotIndex >= 0) 
      ? targetSlotIndex 
      : (targetSlotForAssign !== null && targetSlotForAssign >= 0)
        ? targetSlotForAssign
        : enrollments.findIndex(e => e.name === '');

    if (slotIdx !== -1 && slotIdx < enrollments.length) {
      setEnrollments(prev => {
        const copy = [...prev];
        copy[slotIdx] = member;
        return copy;
      });
      setMemberSearchQuery('');
      setIsSearchDropdownOpen(false);
      setTargetSlotForAssign(null);
      triggerHapticFeedback('light');
    } else {
      alert("All spots are fully enrolled! To enroll more, increase group duration in Step 1.");
    }
  };

  // Real-time phone duplicate check for modal
  const duplicatePhoneSubscriber = useMemo(() => {
    const clean = normalizePhone(newMemberPhone);
    if (clean.length < 10) return null;
    return masterDirectory.find(m => normalizePhone(m.phone) === clean) || null;
  }, [newMemberPhone, masterDirectory]);

  // Real-time name fuzzy similarity check for modal (handles minor typos like Kishor vs Kishore)
  const similarNameSubscriber = useMemo(() => {
    const input = newMemberName.trim();
    if (input.length < 3) return null;
    
    // Find closest member whose name is not identical
    for (const member of masterDirectory) {
      if (member.name.toLowerCase().trim() === input.toLowerCase().trim()) continue;
      
      const dist = levenshteinDistance(input, member.name);
      // If edit distance is 1 or 2 (or one is substring of another with length >= 4)
      if (dist <= 2 || (input.length >= 4 && member.name.toLowerCase().includes(input.toLowerCase()))) {
        return member;
      }
    }
    return null;
  }, [newMemberName, masterDirectory]);

  const handleCreateAndAssignMember = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newMemberName.trim();
    const cleanPhone = newMemberPhone.trim();
    const normalizedDigits = normalizePhone(cleanPhone);

    if (!cleanName) {
      alert('Please enter a subscriber full name.');
      return;
    }
    if (!cleanPhone || normalizedDigits.length === 0) {
      alert('Phone Number Required:\n\nPlease enter a valid 10-digit mobile number.');
      return;
    }
    if (normalizedDigits.length < 10) {
      alert(`Invalid Phone Number Warning:\n\nThe phone number entered is too short (${normalizedDigits.length}/10 digits).\nExpected exactly 10 digits (e.g. 9842235740). You entered: "${cleanPhone}". Please check and re-enter.`);
      return;
    }
    if (normalizedDigits.length > 10) {
      alert(`Invalid Phone Number Warning:\n\nThe phone number entered has too many digits (${normalizedDigits.length}/10 digits).\nExpected exactly 10 digits (e.g. 9842235740). You entered: "${cleanPhone}". Please check and re-enter.`);
      return;
    }

    // Check duplicate phone in master directory
    const existingWithPhone = masterDirectory.find(m => normalizePhone(m.phone) === normalizedDigits);
    if (existingWithPhone) {
      alert(`Duplicate Phone Error: Phone number "${cleanPhone}" is already registered to "${existingWithPhone.name}". Please use a unique number or assign ${existingWithPhone.name} directly.`);
      return;
    }

    try {
      setIsCreatingMember(true);
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          full_name: cleanName,
          phone_number: normalizedDigits,
          role: 'subscriber',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('unique')) {
          alert(`Database Error: Phone number "${cleanPhone}" is already registered to another subscriber in Supabase.`);
        } else {
          alert(`Failed to save subscriber to database: ${error.message}`);
        }
        return;
      }

      const newSubscriber = {
        id: data.id,
        name: data.full_name || cleanName,
        phone: data.phone_number || cleanPhone,
      };

      // Add to local master directory
      setMasterDirectory(prev => [newSubscriber, ...prev]);

      // If we are currently editing a group, assign to the first empty slot in editGroupMembers
      if (editingGroup) {
        const firstEmptySlot = editGroupMembers.find(m => !m.profileId);
        if (firstEmptySlot) {
          await handleReassignTicketMember(
            firstEmptySlot.ticket,
            firstEmptySlot.id,
            newSubscriber.id,
            newSubscriber.name,
            newSubscriber.phone
          );
        }
      }

      // Assign to the targeted spot or first empty spot in enrollments
      const targetSlot = (targetSlotForAssign !== null && targetSlotForAssign >= 0) 
        ? targetSlotForAssign 
        : enrollments.findIndex(e => e.name === '');

      if (targetSlot !== -1 && targetSlot < enrollments.length) {
        setEnrollments(prev => {
          const copy = [...prev];
          copy[targetSlot] = newSubscriber;
          return copy;
        });
      }

      // Add audit log
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      await supabase.from('security_audit_logs').insert({
        action_description: `NEW SUBSCRIBER REGISTERED: "${cleanName}" (${cleanPhone}) — enrolled in Ticket #${targetSlot !== -1 ? targetSlot + 1 : 'N/A'}`,
        target_table: 'profiles',
      });

      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'profiles',
          desc: `NEW SUBSCRIBER REGISTERED: "${cleanName}" (${cleanPhone}) — enrolled in Ticket #${targetSlot !== -1 ? targetSlot + 1 : 'N/A'}`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      // Reset modal state
      setNewMemberName('');
      setNewMemberPhone('');
      setMemberSearchQuery('');
      setIsSearchDropdownOpen(false);
      setTargetSlotForAssign(null);
      setShowCreateMemberModal(false);
      triggerHapticFeedback('success');
    } catch (err: any) {
      alert(`Error creating member: ${err.message}`);
    } finally {
      setIsCreatingMember(false);
    }
  };

  const handleCreateGroup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isCreatingGroup) return;

    const duration = Number(newGroupDuration);
    
    if (enrollments.length !== duration) {
      alert(`Validation Failure: Enrolled spots (${enrollments.length}) must match group duration in months (${duration}).`);
      return;
    }

    const filledCount = enrollments.filter(slot => slot.name && slot.name.trim() !== '').length;
    const isFullyEnrolled = filledCount === duration && enrollments.every(slot => slot.id);
    const groupStatus = isFullyEnrolled ? 'active' : 'draft';

    try {
      setIsCreatingGroup(true);
      triggerHapticFeedback('light');

      const { data: groupData, error: groupError } = await supabase.from('chit_groups').insert({
        name: newGroupName.trim(),
        total_value: Number(newGroupValue),
        member_count: duration,
        duration_months: duration,
        current_month: 0,
        kai_iruppu_pool: 0,
        status: groupStatus,
        start_date: newGroupStartDate,
        auction_day_of_month: Number(newGroupAuctionDay || 10),
        auction_time: newGroupAuctionTime || '19:00',
        next_auction_date: null,
        next_auction_time: newGroupAuctionTime || '19:00',
      }).select().single();

      if (groupError) {
        alert(`Failed to create group in database: ${groupError.message}`);
        return;
      }

      // Insert enrolled members into group_members
      if (groupData) {
        const memberInserts = enrollments
          .map((slot, idx) => ({ slot, ticketNum: idx + 1 }))
          .filter(({ slot }) => slot.id)
          .map(({ slot, ticketNum }) => ({
            group_id: groupData.id,
            profile_id: slot.id,
            ticket_number: ticketNum,
            has_won_regular: false,
            physical_book_synced: true,
          }));

        if (memberInserts.length > 0) {
          const { error: membersError } = await supabase
            .from('group_members')
            .insert(memberInserts);
          if (membersError) {
            console.warn('group_members insert note:', membersError.message);
          }
        }
      }

      // Security Audit Log
      await supabase.from('security_audit_logs').insert({
        action_description: `NEW CHIT GROUP CREATED: "${newGroupName}" (₹${Number(newGroupValue).toLocaleString('en-IN')}, ${duration} Months, ${filledCount}/${duration} tickets assigned, Status: ${groupStatus.toUpperCase()})`,
        target_table: 'chit_groups',
      });

      triggerHapticFeedback('success');
      alert(`✅ Success: Chit Group "${newGroupName}" created in Supabase (Status: ${groupStatus.toUpperCase()})!\n${filledCount} of ${duration} spots assigned.${!isFullyEnrolled ? ' You can assign the remaining slots anytime in the Chits tab.' : ''}`);
      await fetchGroups();

      // Reset form
      setNewGroupName('');
      setNewGroupValue('100000');
      setNewGroupDuration('5');
      setNewGroupAuctionDay(10);
      setNewGroupAuctionTime('19:00');
      setTargetSlotForAssign(null);
      setEnrollments([
        { id: undefined, name: '', phone: '' },
        { id: undefined, name: '', phone: '' },
        { id: undefined, name: '', phone: '' },
        { id: undefined, name: '', phone: '' },
        { id: undefined, name: '', phone: '' },
      ]);
      setWizardStep(1);
      setShowWizard(false);
    } catch (err: any) {
      alert(`Error creating group: ${err.message}`);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const member = fifoMembers.find(m => m.id === selectedMemberId);
    if (!member) return;

    const totalDue = getMemberTotalDue(member);
    if (amountNum > totalDue) {
      alert(`Payment (₹${amountNum.toLocaleString('en-IN')}) exceeds FIFO cumulative balance (₹${totalDue.toLocaleString('en-IN')}).`);
      return;
    }

    // FIFO Walk: apply credit to oldest unpaid ledger entries first
    let remaining = amountNum;
    const updatedLedger = member.ledger.map(entry => {
      if (remaining <= 0) return entry;
      const owed = entry.original - entry.paid;
      if (owed <= 0) return entry;
      const applying = Math.min(remaining, owed);
      remaining -= applying;
      return { ...entry, paid: entry.paid + applying };
    });

    setFifoMembers(prev => prev.map(m =>
      m.id === selectedMemberId ? { ...m, ledger: updatedLedger } : m
    ));

    setActualCollections(prev => prev + amountNum);

    let targetWallet: 'cash_in_hand' | 'kishor_bank' | 'dad_bank' | 'mom_bank' = 'cash_in_hand';
    if (paymentMode === 'UPI') targetWallet = 'kishor_bank';
    if (paymentMode === 'Bank') targetWallet = 'dad_bank';
    if (paymentMode === 'Cheque') targetWallet = 'mom_bank';
    updateBalance(targetWallet, amountNum);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    setAuditLogs(prev => [
      {
        timestamp: `Today, ${timeStr}`,
        table: 'transactions',
        desc: `FIFO CREDIT ₹${amountNum.toLocaleString('en-IN')} via ${paymentMode} from ${member.name} — oldest arrears cleared first`,
        executor: 'Kishor (Admin)'
      },
      ...prev
    ]);

    setSelectedMemberId(null);
    setPaymentAmount('');
    alert(`FIFO credit of ₹${amountNum.toLocaleString('en-IN')} applied. Oldest overdue balances cleared first.`);
  };

  const isUserAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Render content based on active tab and simulated role
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': {
        const activeGroup = localGroups.find(g => g.id === activeDashboardGroupId) || localGroups[0];
        const totalDuration = activeGroup?.duration || activeGroup?.memberCount || 20;
        const totalChitVal = activeGroup?.totalValue || 200000;
        const baseInstallment = Math.round(totalChitVal / (activeGroup?.memberCount || totalDuration || 1));
        const isLaaba = (activeGroup?.kaiIruppuPool || 0) >= totalChitVal;
        const defaultDue = isLaaba ? 0 : baseInstallment;
        const activeCycle = (activeGroup?.currentMonth !== undefined && activeGroup?.currentMonth !== null)
          ? Number(activeGroup.currentMonth)
          : 0;

        // Compute dues, paid, status for each member
        const memberStats = dashboardGroupMembers.map(member => {
          const effectiveDue = isLaaba ? 0 : (member.customInstallment !== null && member.customInstallment !== undefined ? member.customInstallment : defaultDue);
          const paid = getMemberPaidAmountForMonth(member.profileId || member.id, selectedDashboardMonth);
          const remaining = Math.max(0, effectiveDue - paid);
          const status = remaining === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

          // Calculate cumulative balance owed across all months up to the current active running cycle
          let totalDueUpToActiveCycle = 0;
          let totalPaidUpToActiveCycle = 0;
          for (let m = 0; m <= activeCycle; m++) {
            const mDue = isLaaba ? 0 : (member.customInstallment !== null && member.customInstallment !== undefined ? member.customInstallment : defaultDue);
            totalDueUpToActiveCycle += mDue;
            totalPaidUpToActiveCycle += getMemberPaidAmountForMonth(member.profileId || member.id, m);
          }
          const totalPendingToday = Math.max(0, totalDueUpToActiveCycle - totalPaidUpToActiveCycle);

          return {
            ...member,
            effectiveDue,
            paid,
            remaining,
            totalPendingToday,
            status,
          };
        });

        const pendingList = memberStats.filter(m => m.status !== 'paid');
        const paidList = memberStats.filter(m => m.status === 'paid');
        const partialCount = memberStats.filter(m => m.status === 'partial').length;
        const unpaidCount = memberStats.filter(m => m.status === 'unpaid').length;

        const targetCollectionsTotal = memberStats.reduce((sum, m) => sum + m.effectiveDue, 0);
        const actualCollectionsTotal = memberStats.reduce((sum, m) => sum + m.paid, 0);
        const pendingCollectionsTotal = Math.max(0, targetCollectionsTotal - actualCollectionsTotal);
        const completionPct = targetCollectionsTotal > 0 ? Math.min(100, Math.round((actualCollectionsTotal / targetCollectionsTotal) * 100)) : 100;

        // Auction log for selected month
        const currentMonthAuction = dashboardAuctionLogs.find(l => Number(l.month) === Number(selectedDashboardMonth));

        // Month range generator for carousel (starts at Month 0 Launch Month)
        const monthsRange = [0, ...Array.from({ length: totalDuration }, (_, i) => i + 1)];

        // Recent transactions for this group / month
        const currentMonthTransactions = dashboardTransactions.filter(t => 
          t.type === 'collection' && (t.notes?.includes(`Month ${selectedDashboardMonth}`) || !t.notes)
        );

        // Kai Iruppu (கை இருப்பு) Accumulated Pool & Laaba Seetu Metrics
        const activeKaiIruppuPool = Number(activeGroup?.kaiIruppuPool || activeGroup?.kai_iruppu_pool || 0);
        const laabaGoalPct = totalChitVal > 0 ? Math.min(100, Math.round((activeKaiIruppuPool / totalChitVal) * 100)) : 0;
        const remainingToLaaba = Math.max(0, totalChitVal - activeKaiIruppuPool);
        const isLaabaActive = activeKaiIruppuPool >= totalChitVal;
        const completedGroupAuctions = dashboardAuctionLogs
          .filter(l => Number(l.winning_discount ?? l.winning_bid ?? 0) > 0)
          .sort((a, b) => Number(a.month) - Number(b.month));
        const totalDiscountsRecorded = completedGroupAuctions.reduce((sum, l) => sum + Number(l.winning_discount ?? l.winning_bid ?? 0), 0);

        return (
          <div className="space-y-4 sm:space-y-6">
            {/* ⚠️ HIGH-PRIORITY ALERT BANNER: Pending Physical Cash Box Verification */}
            {pendingAtmRelocations.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 via-amber-100/50 to-orange-50 border-2 border-amber-300/90 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm space-y-2.5 sm:space-y-3 animate-in fade-in zoom-in-95 duration-200">
                {/* Banner Header: Sleek single-line layout on mobile */}
                <div className="flex items-center justify-between gap-2 border-b border-amber-200/70 pb-2 sm:pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 shadow-xs animate-pulse">
                      <AlertCircle size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-tight truncate">
                          Pending Cash Box Verification
                        </h3>
                        <span className="text-[9px] sm:text-[10px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full shadow-2xs shrink-0">
                          {pendingAtmRelocations.length} Pending
                        </span>
                      </div>
                    </div>
                  </div>

                  {setActiveTab && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('cash')}
                      className="text-[10px] sm:text-xs font-bold text-amber-900 hover:text-black bg-white/90 hover:bg-white px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-amber-300 transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                      title="Open Treasury"
                    >
                      <Banknote size={13} className="text-indigo-600" />
                      <span className="hidden xs:inline sm:inline">Treasury</span>
                      <ArrowRight size={11} />
                    </button>
                  )}
                </div>

                <p className="text-[10px] sm:text-xs text-amber-900/80 font-medium leading-tight">
                  Bank balance was debited for ATM cash withdrawal. Confirm once physical currency notes are placed inside the Physical Cash Box:
                </p>

                {/* Pending Inflow Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                  {pendingAtmRelocations.map((item) => {
                    let sourceName = 'Kishor Bank';
                    let sourceIcon = '📱';
                    const n = (item.notes || '').toLowerCase();
                    if (n.includes('dad')) {
                      sourceName = "Dad's Bank";
                      sourceIcon = '🏦';
                    } else if (n.includes('mom')) {
                      sourceName = "Mom's Bank";
                      sourceIcon = '🏛️';
                    }

                    const isVerifying = isVerifyingAtmId === item.id;
                    const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-amber-200/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex items-center justify-between gap-2.5 shadow-2xs hover:border-amber-400 transition-colors"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{sourceIcon}</span>
                            <span className="text-xs font-extrabold text-gray-800 truncate">{sourceName}</span>
                          </div>
                          <div className="text-base sm:text-xl font-black text-gray-900 font-mono tracking-tight leading-none">
                            ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                            <Clock size={9} />
                            <span>Debited on {dateStr}, {timeStr}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleConfirmAtmInflowFromDashboard(item)}
                          disabled={isVerifying}
                          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs px-3 sm:px-3.5 py-2 rounded-xl flex items-center gap-1 transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isVerifying ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <Check size={13} className="stroke-[3]" />
                          )}
                          <span>Confirm Inflow</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Chit Groups Pill Switcher Bar */}
            <div className="bg-white border border-gray-200 rounded-2xl p-2.5 sm:p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-nowrap scroll-smooth">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 px-1.5 sm:px-2 flex items-center gap-1.5">
                  <Briefcase size={13} className="text-indigo-600" />
                  Chits:
                </span>
                {localGroups.filter(g => g.status !== 'deleted').length === 0 ? (
                  <span className="text-xs text-gray-400 italic">No active chit groups found</span>
                ) : (
                  localGroups.filter(g => g.status !== 'deleted').map((group) => {
                    const isSelected = (activeGroup?.id === group.id);
                    return (
                      <button
                        key={group.id}
                        ref={(el) => {
                          if (el) {
                            chitGroupButtonsRef.current.set(group.id, el);
                          } else {
                            chitGroupButtonsRef.current.delete(group.id);
                          }
                        }}
                        onClick={() => {
                          setActiveDashboardGroupId(group.id);
                          setSelectedDashboardMonth(group.currentMonth !== undefined && group.currentMonth !== null ? group.currentMonth : 0);
                        }}
                        className={`flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border whitespace-nowrap active:scale-95 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          group.status === 'active' 
                            ? isSelected ? 'bg-emerald-400' : 'bg-emerald-500'
                            : group.status === 'draft' 
                            ? isSelected ? 'bg-amber-300' : 'bg-amber-500'
                            : isSelected ? 'bg-blue-300' : 'bg-blue-500'
                        }`} />
                        <span className={isSelected ? 'text-white font-bold' : 'text-gray-800 font-bold'}>{group.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                          isSelected ? 'bg-indigo-700 text-white' : 'bg-gray-200/70 text-gray-700'
                        }`}>
                          {formatCurrency(group.totalValue)}
                        </span>
                        {(group.kaiIruppuPool || 0) > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold flex items-center gap-1 ${
                            isSelected ? 'bg-amber-400 text-amber-950 shadow-2xs' : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`} title={`Kai Iruppu Pool: ${formatCurrency(group.kaiIruppuPool)}`}>
                            <span>💰 {formatCurrency(group.kaiIruppuPool)}</span>
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Action Button: Create New Group */}
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold px-3.5 py-2 sm:py-1.5 rounded-xl transition-all shrink-0 shadow-2xs active:scale-95 w-full sm:w-auto"
              >
                <Plus size={14} />
                <span>New Group</span>
              </button>
            </div>

            {/* Horizontal Month Carousel Navigator */}
            {activeGroup && (
              <div className="bg-white border border-gray-200 rounded-2xl p-2 sm:p-3 shadow-2xs flex items-center justify-between gap-1.5 sm:gap-2">
                <button
                  onClick={() => setSelectedDashboardMonth(prev => Math.max(0, prev - 1))}
                  disabled={selectedDashboardMonth <= 0}
                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0 active:scale-95"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-1 px-1 flex-nowrap scroll-smooth">
                  {monthsRange.map((mNum) => {
                    const isSelected = (selectedDashboardMonth === mNum);
                    const isOngoingCurrent = ((activeGroup.currentMonth ?? 0) === mNum);
                    const label = getDashboardMonthLabel(activeGroup, mNum);

                    return (
                      <button
                        key={mNum}
                        ref={(el) => {
                          if (el) {
                            monthButtonsRef.current.set(mNum, el);
                          } else {
                            monthButtonsRef.current.delete(mNum);
                          }
                        }}
                        onClick={() => setSelectedDashboardMonth(mNum)}
                        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border whitespace-nowrap active:scale-95 ${
                          isSelected
                            ? mNum === 0
                              ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-500/20'
                              : 'bg-gray-900 text-white border-black shadow-xs ring-2 ring-gray-900/10'
                            : isOngoingCurrent
                            ? mNum === 0
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-200'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {isSelected ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        ) : mNum === 0 ? (
                          <span className="text-[10px]">👑</span>
                        ) : null}
                        <span>{label}</span>
                        {isOngoingCurrent && (
                          <span className={`text-[9px] uppercase tracking-wider px-1 py-0.2 rounded font-semibold ${
                            isSelected ? 'bg-white/20 text-white' : mNum === 0 ? 'bg-amber-200/80 text-amber-900' : 'bg-indigo-200/60 text-indigo-800'
                          }`}>
                            Current
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setSelectedDashboardMonth(prev => Math.min(totalDuration, prev + 1))}
                  disabled={selectedDashboardMonth >= totalDuration}
                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0 active:scale-95"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ── Compact Kai Iruppu (கை இருப்பு) Auction Accumulated Pool Ribbon ── */}
            {activeGroup && (
              <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-2xs space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Left: Pool Amount & Label */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                      <Coins size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                          கை இருப்பு · Kai Iruppu Pool
                        </span>
                        {isLaabaActive && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded flex items-center gap-1">
                            <Sparkles size={10} /> Laaba Seetu Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-base sm:text-lg font-black text-gray-900 font-mono tracking-tight">
                          {formatCurrency(activeKaiIruppuPool)}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          / {formatCurrency(totalChitVal)}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium hidden md:inline">
                          ({isLaabaActive ? 'Threshold Reached!' : `${formatCurrency(remainingToLaaba)} to free month`})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Slim Progress & Breakdown Button */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 justify-between sm:justify-end">
                    <div className="flex items-center gap-2 min-w-[140px] sm:min-w-[180px]">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(activeKaiIruppuPool > 0 ? 5 : 0, laabaGoalPct)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold font-mono text-gray-600 shrink-0">
                        {laabaGoalPct}%
                      </span>
                    </div>

                    {completedGroupAuctions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowKaiIruppuBreakdown(prev => !prev)}
                        className="flex items-center gap-1 text-[11px] font-bold text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-xl transition-all shrink-0 active:scale-95 cursor-pointer"
                        title="Toggle monthly auction discounts history"
                      >
                        <span>History ({completedGroupAuctions.length})</span>
                        {showKaiIruppuBreakdown ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Compact Expandable Discount History */}
                {showKaiIruppuBreakdown && (
                  <div className="pt-2 border-t border-gray-100 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span className="font-bold text-gray-700">Monthly Auction Discount Contributions:</span>
                      <span>Total: <strong className="text-gray-900 font-mono">{formatCurrency(totalDiscountsRecorded)}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap scrollbar-none">
                      {completedGroupAuctions.map((log) => {
                        const disc = Number(log.winning_discount ?? log.winning_bid ?? 0);
                        return (
                          <div
                            key={log.id || log.month}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shrink-0 flex items-center gap-2 text-xs"
                          >
                            <span className="font-extrabold text-indigo-700">M{log.month}</span>
                            <span className="text-gray-600 font-medium truncate max-w-[120px]">{log.winner_name || 'Subscriber'}</span>
                            <span className="font-black font-mono text-emerald-600">+{formatCurrency(disc)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Collection Progress Hero Card (Single Full-Width Card) */}
            {activeGroup && (
              <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-7 shadow-2xs relative overflow-hidden space-y-5 sm:space-y-6">
                <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-4 sm:gap-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-lg border ${
                        selectedDashboardMonth === 0
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                      }`}>
                        {selectedDashboardMonth === 0 ? (
                          <>👑 {activeGroup.name} · Month 0 (Launch Month — Organizer Profit Phase)</>
                        ) : (
                          <>{activeGroup.name} · Month {selectedDashboardMonth} of {totalDuration}</>
                        )}
                      </span>
                      {isLaaba && selectedDashboardMonth > 0 && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Sparkles size={11} /> Laaba Seetu Active
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-baseline gap-2.5 mt-2">
                      <span className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight leading-none">
                        {formatCurrency(actualCollectionsTotal)}
                      </span>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        COLLECTED
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-5 mt-2.5 text-xs text-gray-500 font-medium">
                      <span>Target: <strong className="text-gray-900 font-bold">{formatCurrency(targetCollectionsTotal)}</strong></span>
                      <span className="text-gray-300 hidden sm:inline">•</span>
                      <span>Pending: <strong className="text-amber-600 font-bold">{formatCurrency(pendingCollectionsTotal)}</strong></span>
                    </div>
                  </div>

                  {/* Actions & Paid Progress */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-center flex items-center justify-between sm:block shadow-2xs">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Paid Members</span>
                      <div className="text-base font-black text-gray-900 sm:mt-0.5">
                        <span className="text-emerald-600">{paidList.length}</span> / {dashboardGroupMembers.length}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                      <button
                        onClick={handleMarkAllPaid}
                        disabled={isMarkingAllPaid || pendingList.length === 0}
                        className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 sm:px-4 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                      >
                        <CheckCheck size={14} />
                        <span className="truncate">{isMarkingAllPaid ? 'Recording...' : 'Mark All Paid'}</span>
                      </button>

                      {/* Remind All Pending Members WhatsApp Hub Button */}
                      {pendingList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setRemindModalTab('individual');
                            setShowRemindModal(true);
                          }}
                          className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs px-3.5 sm:px-4 py-2.5 rounded-xl transition-all shadow-2xs active:scale-95"
                          title="Send individual or group WhatsApp reminders to pending members"
                        >
                          <Send size={13} className="text-emerald-600" />
                          <span className="truncate">Remind All ({pendingList.length})</span>
                        </button>
                      )}

                      {/* In-App Revert Active Month Button */}
                      {(activeGroup.currentMonth ?? 0) > 0 && (
                        <button
                          onClick={handleRevertMonth}
                          disabled={isClosingMonth}
                          className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs px-3 py-2.5 rounded-xl transition-all shadow-xs border border-gray-200 active:scale-95"
                          title={`Roll back active cycle to Month ${(activeGroup.currentMonth ?? 1) - 1}`}
                        >
                          <RotateCcw size={13} className="text-gray-500" />
                          <span className="truncate">Revert to M{(activeGroup.currentMonth ?? 1) - 1}</span>
                        </button>
                      )}

                      {selectedDashboardMonth === 0 ? (
                        <button
                          onClick={handleCloseMonth}
                          disabled={isClosingMonth || selectedDashboardMonth !== (activeGroup.currentMonth ?? 0)}
                          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                        >
                          <Rocket size={14} />
                          <span className="truncate">{isClosingMonth ? 'Confirming...' : 'Confirm Launch & Roll to M1'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleCloseMonth}
                          disabled={isClosingMonth || selectedDashboardMonth !== (activeGroup.currentMonth ?? 0)}
                          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                        >
                          <ArrowRight size={14} />
                          <span className="truncate">{isClosingMonth ? 'Closing...' : 'Close Month'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Smooth Progress Bar */}
                <div className="space-y-2 pt-1">
                  <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-gray-200">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-500 shadow-xs"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 font-semibold">
                    <span>{completionPct}% Collected</span>
                    <span>{pendingList.length} members remaining</span>
                  </div>
                </div>

                {/* ── Prominent Winner Prize Pot & Disbursal Hub Card ────────────────────────── */}
                {(() => {
                  if (selectedDashboardMonth === 0) {
                    return (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Rocket size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                                Month 0: Launch Month — Organizer Profit Phase
                              </span>
                              <span className="bg-amber-200 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                No Auction
                              </span>
                            </div>
                            <p className="text-xs text-amber-800 mt-0.5">
                              The full <strong>{formatCurrency(totalChitVal)}</strong> collected pool is reserved and allocated directly to the Organizer as <strong>Organizer Profit</strong>.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200">
                          {(() => {
                            const { display } = getGroupAuctionDate(activeGroup.id, 0);
                            return (
                              <span className="text-xs text-amber-900 font-bold flex items-center gap-1.5 bg-white/70 border border-amber-200 px-3 py-1.5 rounded-xl shadow-2xs">
                                <CalendarDays size={13} className="text-amber-700" />
                                <span>{display}</span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  }

                  if (!currentMonthAuction) {
                    return (
                      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gray-200 text-gray-500 flex items-center justify-center shrink-0">
                            <Trophy size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-700">
                              Auction for Month {selectedDashboardMonth} has not taken place yet
                            </div>
                            <p className="text-[11px] text-gray-400">
                              Conduct live bidding in the Live Auction Engine to declare this month's winning subscriber and unlock prize disbursal.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {(() => {
                            const { display } = getGroupAuctionDate(activeGroup.id, selectedDashboardMonth);
                            return (
                              <span className="text-xs text-indigo-700 font-bold flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl">
                                <CalendarDays size={13} className="text-indigo-600" />
                                <span>Scheduled: <strong>{display}</strong></span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  }

                  // Auction Won Month — Render full Disbursal Hub Card!
                  const winningBid = Number(currentMonthAuction.winning_discount ?? currentMonthAuction.winning_bid ?? 0);
                  const netPrizePot = Math.max(0, totalChitVal - winningBid);
                  const winnerProfileId = currentMonthAuction.winning_bidder_id || currentMonthAuction.winner_profile_id || currentMonthAuction.winner_id;
                  const winnerMember = dashboardGroupMembers.find(m => 
                    (winnerProfileId && (m.profileId === winnerProfileId || m.id === winnerProfileId)) ||
                    (currentMonthAuction.winner_name && m.name.toLowerCase() === currentMonthAuction.winner_name.toLowerCase())
                  );
                  const winnerName = winnerMember?.name || currentMonthAuction.winner_name || currentMonthAuction.winning_bidder?.full_name || 'Subscriber';
                  const winnerPhone = winnerMember?.phone || currentMonthAuction.winner_phone || currentMonthAuction.winning_bidder?.phone_number || '';
                  const winnerTicketNum = winnerMember?.ticket || currentMonthAuction.winner_ticket;

                  // Find payout transactions for this month
                  const monthPattern = new RegExp(`\\bMonth\\s+${selectedDashboardMonth}\\b|\\bM${selectedDashboardMonth}\\b|\\bM\\s*${selectedDashboardMonth}\\b`, 'i');
                  const monthPayoutTxs = dashboardTransactions.filter(t =>
                    t.type === 'payout' && (
                      (t.notes && monthPattern.test(t.notes)) ||
                      (winnerProfileId && (t.profile_id === winnerProfileId || t.group_member_id === winnerProfileId)) ||
                      (winnerMember && (t.group_member_id === winnerMember.id || t.profile_id === winnerMember.profileId))
                    )
                  );
                  const totalPrizeDisbursed = monthPayoutTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
                  const remainingPrizeDue = Math.max(0, netPrizePot - totalPrizeDisbursed);
                  const isSettled = remainingPrizeDue === 0 && (totalPrizeDisbursed > 0 || netPrizePot === 0);
                  const isPartial = totalPrizeDisbursed > 0 && remainingPrizeDue > 0;

                  return (
                    <div className={`rounded-2xl border-2 p-4 sm:p-5 shadow-sm space-y-4 transition-all ${
                      isSettled 
                        ? 'bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white border-emerald-300' 
                        : isPartial
                        ? 'bg-gradient-to-br from-amber-50/70 via-yellow-50/40 to-white border-amber-300'
                        : 'bg-gradient-to-br from-rose-50/60 via-indigo-50/40 to-white border-rose-300'
                    }`}>
                      {/* Top Header: Winner Badge & Disbursal Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-gray-200/70 pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                            isSettled ? 'bg-emerald-600 text-white' : isPartial ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white'
                          }`}>
                            <Trophy size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                                Month {selectedDashboardMonth} Auction Winner
                              </span>
                              {winnerTicketNum && (
                                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.2 rounded-md">
                                  Ticket #{winnerTicketNum}
                                </span>
                              )}
                            </div>
                            <div className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                              <span>{winnerName}</span>
                              {winnerPhone && (
                                <a 
                                  href={`tel:${normalizePhone(winnerPhone)}`} 
                                  className="text-gray-400 hover:text-emerald-600 transition-colors p-1"
                                  title={`Call ${winnerName}`}
                                >
                                  <Phone size={13} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Disbursal Status Badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isSettled ? (
                            <span className="bg-emerald-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
                              <CheckCheck size={14} /> Fully Disbursed
                            </span>
                          ) : isPartial ? (
                            <span className="bg-amber-500 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
                              <AlertCircle size={14} /> Partially Disbursed
                            </span>
                          ) : (
                            <span className="bg-rose-600 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 animate-pulse">
                              <AlertCircle size={14} /> Disbursal Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Financial Figures Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                        <div className="bg-white/90 border border-gray-200/80 rounded-xl p-3 shadow-2xs">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Winning Discount</span>
                          <span className="text-sm sm:text-base font-extrabold text-indigo-700 font-mono">
                            {formatCurrency(winningBid)}
                          </span>
                          <span className="text-[9px] text-emerald-700 font-bold block mt-0.5 flex items-center gap-1">
                            <Sparkles size={10} className="text-amber-500 shrink-0" />
                            <span>Pooled to Kai Iruppu</span>
                          </span>
                        </div>

                        <div className="bg-white/90 border border-gray-200/80 rounded-xl p-3 shadow-2xs">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Net Prize Pot Due</span>
                          <span className="text-sm sm:text-base font-extrabold text-gray-900 font-mono">
                            {formatCurrency(netPrizePot)}
                          </span>
                          <span className="text-[9px] text-gray-400 block mt-0.5">Total Chit − Winning Bid</span>
                        </div>

                        <div className="bg-white/90 border border-gray-200/80 rounded-xl p-3 shadow-2xs">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Disbursed So Far</span>
                          <span className={`text-sm sm:text-base font-extrabold font-mono ${totalPrizeDisbursed > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {formatCurrency(totalPrizeDisbursed)}
                          </span>
                          <span className="text-[9px] text-gray-400 block mt-0.5">{monthPayoutTxs.length} transfer(s)</span>
                        </div>

                        <div className={`border rounded-xl p-3 shadow-2xs ${
                          remainingPrizeDue > 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-emerald-50/80 border-emerald-200'
                        }`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                            remainingPrizeDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}>
                            {remainingPrizeDue > 0 ? 'Balance Pending' : 'Balance Settled'}
                          </span>
                          <span className={`text-sm sm:text-base font-extrabold font-mono ${
                            remainingPrizeDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}>
                            {formatCurrency(remainingPrizeDue)}
                          </span>
                          <span className="text-[9px] text-gray-500 block mt-0.5">
                            {remainingPrizeDue === 0 ? '✓ Zero balance' : 'Pay to winner'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons & Recent Payout Receipts */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Disburse Prize Button when pending or Settled Badge */}
                          {remainingPrizeDue > 0 ? (
                            <button
                              onClick={() => handleOpenDisburseModal(remainingPrizeDue)}
                              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                            >
                              <Banknote size={15} />
                              <span>Disburse Prize ({formatCurrency(remainingPrizeDue)})</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl shadow-2xs">
                              <CheckCheck size={14} className="text-emerald-700" />
                              <span>Prize Pot Fully Disbursed</span>
                            </div>
                          )}

                          {/* WhatsApp Payout Receipt Generator Button */}
                          <button
                            onClick={() => handleSharePayoutWhatsApp(
                              activeGroup,
                              winnerName,
                              winnerPhone,
                              selectedDashboardMonth,
                              netPrizePot,
                              winningBid,
                              totalPrizeDisbursed,
                              remainingPrizeDue,
                              monthPayoutTxs[0]?.wallet_type?.replace(/_/g, ' ')
                            )}
                            className="flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-2xs active:scale-95"
                            title="Generate & Send WhatsApp Payout Receipt"
                          >
                            <Send size={13} className="text-emerald-700" />
                            <span>WhatsApp Receipt</span>
                          </button>
                        </div>

                        {/* Recent Disbursals Miniature Tag */}
                        {monthPayoutTxs.length > 0 && (
                          <div className="flex items-center gap-2 overflow-x-auto text-[11px] text-gray-600">
                            <span className="font-bold text-gray-400 uppercase text-[9px]">Receipts:</span>
                            {monthPayoutTxs.map((tx, idx) => (
                              <span key={tx.id || idx} className="bg-white border border-gray-200 px-2.5 py-1 rounded-lg font-medium shrink-0 flex items-center gap-1.5 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <strong>{formatCurrency(tx.amount)}</strong>
                                <span className="text-gray-400 capitalize">({tx.wallet_type?.replace(/_/g, ' ')})</span>
                                {tx.verification_proof_url && (
                                  <a href={tx.verification_proof_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800" title="View attached receipt">
                                    <Paperclip size={11} />
                                  </a>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* "Yet to Pay" Section (Pending Member Action Cards) */}
            {activeGroup && (
              <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xs">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3.5">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                      <Users size={18} className="text-indigo-600" />
                      <span>{pendingList.length} yet to pay</span>
                      <span className="text-xs font-normal text-gray-500 hidden sm:inline">
                        ({partialCount} partial · {unpaidCount} unpaid)
                      </span>
                      <HelpTooltip text="Subscribers with unpaid or partial dues for the selected month cycle." />
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setRemindModalTab('individual');
                          setShowRemindModal(true);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl transition-all active:scale-95 shadow-2xs"
                      >
                        <Send size={13} className="text-emerald-600" />
                        <span>Remind All</span>
                      </button>
                    )}
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg">
                      Month {selectedDashboardMonth} Dues
                    </span>
                  </div>
                </div>

                {loadingDashboardData ? (
                  <div className="py-10 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw size={15} className="animate-spin text-indigo-600" />
                    <span>Loading subscriber dues...</span>
                  </div>
                ) : pendingList.length === 0 ? (
                  <div className="py-10 text-center bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-1.5">
                    <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
                    <p className="text-sm font-bold text-emerald-900">All subscribers have paid for Month {selectedDashboardMonth}!</p>
                    <p className="text-xs text-emerald-600 font-medium">Total collected: {formatCurrency(actualCollectionsTotal)}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {pendingList.map((member) => {
                      const initial = member.name.charAt(0).toUpperCase() || 'S';
                      return (
                        <div
                          key={member.id}
                          className="bg-gray-50/80 hover:bg-white border border-gray-200/90 hover:border-gray-300 rounded-2xl p-4 sm:p-4.5 flex items-center justify-between gap-3 sm:gap-4 transition-all shadow-2xs"
                        >
                          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                            {/* Avatar */}
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                              {initial}
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 text-sm leading-snug">{member.name}</span>
                                <span className="text-[10px] font-bold bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded-md font-mono shrink-0">
                                  #{member.ticket}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs leading-normal flex-wrap">
                                {member.status === 'partial' ? (
                                  <span className="text-amber-800 font-extrabold bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider shrink-0">
                                    Partial
                                  </span>
                                ) : (
                                  <span className="text-rose-800 font-extrabold bg-rose-100/80 border border-rose-200 px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider shrink-0">
                                    Unpaid
                                  </span>
                                )}
                                <span className="text-gray-500 font-medium whitespace-nowrap">
                                  Due: <strong className="text-gray-900 font-extrabold">{formatCurrency(member.remaining)}</strong>
                                </span>
                                {member.paid > 0 && (
                                  <span className="text-emerald-600 font-medium hidden sm:inline">
                                    (Paid: {formatCurrency(member.paid)})
                                  </span>
                                )}
                              </div>

                              {member.status === 'partial' && (
                                <div className="w-28 sm:w-32 bg-gray-200 rounded-full h-1.5 overflow-hidden mt-1.5">
                                  <div
                                    className="bg-amber-500 h-full rounded-full"
                                    style={{ width: `${Math.min(100, (member.paid / member.effectiveDue) * 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* 1-Tap Record Button */}
                            <button
                              onClick={() => {
                                setRecordingPaymentMember(member);
                                setEditingTransaction(null);
                                const defaultAmount = (member.totalPendingToday > 0 
                                  ? member.totalPendingToday 
                                  : (member.remaining > 0 ? member.remaining : 20000));
                                setQuickPaymentAmount(defaultAmount.toString());
                                setPaymentWalletType('cash_in_hand');
                                setPaymentAllocationMode('auto');
                                setPaymentCustomMonths([selectedDashboardMonth]);
                                setPaymentDateType('today');
                                setCustomPaymentDate(new Date().toISOString().split('T')[0]);
                                setPaymentNote('');
                                setPaymentReceiptUrl('');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 sm:px-4 py-2.5 rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1.5 active:scale-95"
                            >
                              <Coins size={13} />
                              <span>Record</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Collapsible Paid Members Section */}
                {paidList.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setHidePaidMembers(!hidePaidMembers)}
                      className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1.5 py-1 active:scale-95"
                    >
                      {hidePaidMembers ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                      <span>{hidePaidMembers ? 'Show' : 'Hide'} Paid Members ({paidList.length})</span>
                    </button>

                    {!hidePaidMembers && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {paidList.map((member) => {
                          const memTx = dashboardTransactions.find(t => 
                            t.type === 'collection' && 
                            (t.profile_id === member.profileId || t.group_member_id === member.id) &&
                            (t.notes?.includes(`Month ${selectedDashboardMonth}`) || !t.notes)
                          );

                          return (
                            <div
                              key={member.id}
                              className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-2.5 flex items-center justify-between text-xs hover:border-emerald-300 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                <span className="font-semibold text-gray-900 truncate">{member.name}</span>
                                <span className="text-[10px] text-gray-500 font-mono">#{member.ticket}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold text-emerald-700">
                                  {formatCurrency(member.paid)} paid
                                </span>
                                {memTx && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditPayment(memTx)}
                                    title="Edit payment receipt"
                                    className="p-1 text-emerald-700 hover:text-indigo-700 hover:bg-emerald-100 rounded-md transition-colors"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Payments Breakdown Ledger & WhatsApp Sharing */}
            {activeGroup && (
              <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-2xs">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Banknote size={16} className="text-indigo-600" />
                      <span>Payments Breakdown Ledger</span>
                      <HelpTooltip text={`Live payment receipts logged for Month ${selectedDashboardMonth}. Includes instant WhatsApp sharing and receipt editing.`} />
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-gray-500 shrink-0">
                    {currentMonthTransactions.length} receipts
                  </span>
                </div>

                {currentMonthTransactions.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-xs">
                    No payment receipts logged for Month {selectedDashboardMonth} yet. Use "Record" above to log collections.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {currentMonthTransactions.map((tx) => {
                      const matchedMember = dashboardGroupMembers.find(m => m.profileId === tx.profile_id || m.id === tx.group_member_id);
                      const memberName = matchedMember?.name || 'Subscriber';
                      const ticketNum = matchedMember?.ticket || '?';
                      const dateStr = tx.created_at 
                        ? new Date(tx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) + ', ' + new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : 'Today';

                      return (
                        <div key={tx.id} className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50/50 rounded-lg px-2">
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                              #{ticketNum}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="text-xs font-bold text-gray-900 truncate">{memberName}</span>
                                <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded shrink-0">
                                  {tx.wallet_type?.replace(/_/g, ' ').toUpperCase() || 'CASH'}
                                </span>
                                {tx.verification_proof_url && (
                                  <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded flex items-center gap-0.5 shrink-0">
                                    <Paperclip size={9} /> Receipt
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                <span>{dateStr}</span>
                                {tx.notes && <span className="text-gray-500 italic max-w-[150px] sm:max-w-xs truncate">· {tx.notes}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0 pt-1 sm:pt-0">
                            <span className="text-xs font-bold text-emerald-600 mr-1">
                              +{formatCurrency(Number(tx.amount || 0))}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {/* WhatsApp Share Button */}
                              {matchedMember && (
                                <a
                                  href={generateWhatsAppReceiptUrl(matchedMember, Number(tx.amount || 0), baseInstallment, tx)}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Share receipt on WhatsApp"
                                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-colors active:scale-95"
                                >
                                  <Share2 size={12} />
                                  <span className="text-[10px]">Share</span>
                                </a>
                              )}

                              {/* Edit Payment Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditPayment(tx)}
                                title="Edit payment"
                                className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-lg transition-colors active:scale-95"
                              >
                                <Edit3 size={13} />
                              </button>

                              {/* Delete/Void Payment Button */}
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(tx)}
                                title="Delete payment receipt"
                                className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 rounded-lg transition-colors active:scale-95"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Unified Quick Record & Edit Payment Modal */}
            {(recordingPaymentMember || editingTransaction) && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                <form
                  onSubmit={editingTransaction ? handleSavePaymentEdit : handleRecordQuickPayment}
                  className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 w-full max-w-md space-y-3.5 sm:space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto my-auto"
                >
                  {/* Modal Header */}
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        editingTransaction 
                          ? 'bg-indigo-100 text-indigo-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {editingTransaction ? <Edit3 size={16} /> : <Coins size={16} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">
                          {editingTransaction ? 'Edit payment' : 'Record Installment Payment'}
                        </h4>
                        <p className="text-[10px] text-gray-500">
                          {editingTransaction 
                            ? `Receipt #${editingTransaction.id.slice(0, 8)} · Month ${selectedDashboardMonth}`
                            : `Month ${selectedDashboardMonth} · ${activeGroup?.name}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRecordingPaymentMember(null);
                        setEditingTransaction(null);
                      }}
                      className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Subscriber Details Card */}
                  {(() => {
                    const matchedMember = editingTransaction 
                      ? dashboardGroupMembers.find(m => m.profileId === editingTransaction.profile_id || m.id === editingTransaction.group_member_id)
                      : recordingPaymentMember;
                    const subscriberName = matchedMember?.name || (editingTransaction ? 'Subscriber' : recordingPaymentMember?.name || 'Subscriber');
                    const ticketNum = matchedMember?.ticket || (recordingPaymentMember ? recordingPaymentMember.ticket : '?');

                    return (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {subscriberName.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Subscriber</span>
                            <span className="font-bold text-gray-900 truncate block">{subscriberName}</span>
                            <span className="text-gray-500 text-[10px] font-mono">#{ticketNum}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {recordingPaymentMember ? (
                            <>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                                {recordingPaymentMember.totalPendingToday > recordingPaymentMember.remaining ? 'Total Due Today' : 'Remaining Due'}
                              </span>
                              <span className="font-extrabold text-amber-600 text-sm">
                                {formatCurrency(recordingPaymentMember.totalPendingToday > 0 ? recordingPaymentMember.totalPendingToday : recordingPaymentMember.remaining)}
                              </span>
                              {recordingPaymentMember.totalPendingToday > recordingPaymentMember.remaining && (
                                <span className="text-[9px] text-gray-500 font-medium block">
                                  (M{selectedDashboardMonth} Due: {formatCurrency(recordingPaymentMember.remaining)})
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Logged Amount</span>
                              <span className="font-bold text-indigo-600">{formatCurrency(Number(editingTransaction.amount || 0))}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Payment Amount Input (Large Centered High-Legibility Input for Parents) */}
                  <div className="space-y-1.5 text-center">
                    <label className="text-[11px] text-gray-500 font-extrabold uppercase tracking-wider block">
                      Payment Amount (₹)
                    </label>
                    <div className="relative max-w-[320px] mx-auto">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400 select-none">
                        ₹
                      </span>
                      <input
                        type="number"
                        required
                        placeholder="0"
                        value={quickPaymentAmount}
                        onChange={(e) => setQuickPaymentAmount(e.target.value)}
                        className="w-full bg-white border-2 border-gray-200 focus:border-indigo-600 rounded-2xl pl-10 pr-6 py-3.5 text-2xl sm:text-3xl font-black text-gray-900 tracking-tight shadow-xs text-center focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Payment Distribution Preview Card */}
                  {recordingPaymentMember && parseFloat(quickPaymentAmount) > 0 && (
                    <div className="space-y-2 bg-slate-50 border border-gray-200 rounded-xl p-3 animate-in fade-in duration-150">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Coins size={12} className="text-emerald-600" />
                          <span>How this payment applies:</span>
                        </span>
                        <span className="text-xs font-black text-gray-900">
                          Total: {formatCurrency(parseFloat(quickPaymentAmount))}
                        </span>
                      </div>

                      {(() => {
                        const activeGroup = localGroups.find(g => g.id === activeDashboardGroupId) || localGroups[0];
                        let baseDate = new Date();
                        if (activeGroup?.startDate) {
                          const parsed = new Date(activeGroup.startDate);
                          if (!isNaN(parsed.getTime())) baseDate = parsed;
                        }

                        const { allocations } = computePaymentAllocations(
                          recordingPaymentMember,
                          quickPaymentAmount,
                          'auto',
                          []
                        );

                        if (allocations.length === 0) return null;

                        return (
                          <div className="space-y-1.5">
                            {allocations.map((alloc) => {
                              const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + alloc.month, 1);
                              const monthName = d.toLocaleDateString('en-US', { month: 'short' });
                              const yearShort = d.getFullYear().toString().slice(-2);
                              const formattedMonthLabel = alloc.month === 0 
                                ? `${monthName} '${yearShort} (M0 Launch)`
                                : `${monthName} '${yearShort} (M${alloc.month})`;

                              const badgeStyle = alloc.type === 'arrear'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : alloc.type === 'current'
                                  ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                  : 'bg-purple-100 text-purple-800 border-purple-200';

                              const typeName = alloc.type === 'arrear'
                                ? 'Old Dues Cleared'
                                : alloc.type === 'current'
                                  ? 'Month Settled'
                                  : 'Advance Credit';

                              return (
                                <div
                                  key={alloc.month}
                                  className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 shadow-2xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-gray-900">{formattedMonthLabel}</span>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeStyle}`}>
                                      {typeName}
                                    </span>
                                    {alloc.statusAfter === 'partial' && (
                                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                        Partial (Remaining: {formatCurrency(Math.max(0, alloc.due - (alloc.priorPaid + alloc.amount)))})
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-black text-gray-900">
                                    {formatCurrency(alloc.amount)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* 4-Wallet Selector (Receiving Account / Vault) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Receiving Account / Vault</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'cash_in_hand', label: 'Cash in Hand', icon: Banknote },
                        { id: 'kishor_bank', label: 'Kishor Bank (UPI)', icon: Landmark },
                        { id: 'dad_bank', label: 'Dad Bank', icon: Landmark },
                        { id: 'mom_bank', label: 'Mom Bank', icon: Landmark },
                      ].map((w) => {
                        const Icon = w.icon;
                        const isSelected = (paymentWalletType === w.id);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setPaymentWalletType(w.id)}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            <Icon size={14} className={isSelected ? 'text-indigo-600' : 'text-gray-500'} />
                            <span className="truncate">{w.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date Selector (Today / Yesterday / Custom) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Date</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'today', label: 'Today' },
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: 'custom', label: '📅 Custom' },
                      ].map((d) => {
                        const isSelected = paymentDateType === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setPaymentDateType(d.id as any)}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                              isSelected
                                ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>

                    {paymentDateType === 'custom' && (
                      <div className="mt-1.5 animate-in fade-in duration-150">
                        <input
                          type="date"
                          value={customPaymentDate}
                          onChange={(e) => setCustomPaymentDate(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Note (optional) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Note (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Paid via GPay / Handed cash to Dad"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900 focus:outline-none"
                    />
                  </div>

                  {/* Receipt Photo Attachment */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Receipt Attachment</label>
                    {paymentReceiptUrl ? (
                      <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={paymentReceiptUrl}
                            alt="Receipt preview"
                            className="w-10 h-10 object-cover rounded-lg border border-emerald-300"
                          />
                          <div className="text-left">
                            <span className="text-xs font-bold text-emerald-900 block">Receipt Attached</span>
                            <span className="text-[10px] text-emerald-700">Photo ready</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPaymentReceiptUrl('')}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-1 rounded-lg hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id="dashboard-receipt-upload"
                          accept="image/*"
                          onChange={handleReceiptPhotoUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="dashboard-receipt-upload"
                          className="flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/70 hover:bg-gray-100 rounded-xl py-2.5 px-3 text-xs text-gray-600 font-semibold cursor-pointer transition-colors"
                        >
                          <Paperclip size={14} className="text-gray-500" />
                          <span>Attach receipt photo</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                    {editingTransaction ? (
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(editingTransaction)}
                        disabled={isProcessingPayment}
                        className="w-full sm:w-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    ) : <div className="hidden sm:block" />}

                    <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setRecordingPaymentMember(null);
                          setEditingTransaction(null);
                        }}
                        className="w-full sm:w-auto border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 sm:py-2 rounded-xl transition-all text-center"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isProcessingPayment}
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 sm:py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Check size={14} />
                        <span>
                          {isProcessingPayment 
                            ? 'Saving...' 
                            : editingTransaction 
                              ? 'Save changes' 
                              : 'Confirm Payment'}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Live System Activity and Audit Log */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert size={16} className="text-indigo-650" />
                Live System Audit Log
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-gray-600">
                  <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 rounded-lg">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Table</th>
                      <th className="py-2.5 px-3">Action Description</th>
                      <th className="py-2.5 px-3 text-right">Executor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-400 text-xs">
                          No transactions logged yet. Real database transactions will appear here live.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, index) => (
                        <tr key={index} className="hover:bg-gray-50/50">
                          <td className="py-3 px-3 font-medium text-gray-400">{log.timestamp}</td>
                          <td className="py-3 px-3">
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                              {log.table}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-700">{log.desc}</td>
                          <td className="py-3 px-3 text-right font-medium text-indigo-600">{log.executor}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

    case 'auctions':
      return <LiveAuctionEngine />;

    case 'cash':
      return <CashVaultLedger />;

    case 'members':
      return (
        <MemberMatrix 
          onAddAuditLog={(desc) => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            setAuditLogs(prev => [
              {
                timestamp: `Today, ${timeStr}`,
                table: 'profiles',
                desc,
                executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin'
              },
              ...prev
            ]);
          }} 
        />
      );

    case 'communication':
      return (
        <CommunicationBroadcastCenter 
          onAddAuditLog={(desc) => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            setAuditLogs(prev => [
              {
                timestamp: `Today, ${timeStr}`,
                table: 'chit_groups',
                desc,
                executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin'
              },
              ...prev
            ]);
          }}
        />
      );

    case 'reports':
      return <ReportsCenter />;

    case 'users':
      return (
        <MemberMatrix 
          defaultSubtab="roles"
          onAddAuditLog={(desc) => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            setAuditLogs(prev => [
              {
                timestamp: `Today, ${timeStr}`,
                table: 'profiles',
                desc,
                executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin'
              },
              ...prev
            ]);
          }} 
        />
      );

    case 'settings':
      return <SettingsManager />;

    case 'chits':
      const selectedWorkspaceGroup = localGroups.find(g => g.id === selectedWorkspaceGroupId);

      return (
        <div className="space-y-4 sm:space-y-6">
          
          {/* 1. CHIT GROUP WORKSPACE VIEW */}
          {selectedWorkspaceGroupId && selectedWorkspaceGroup && !showWizard ? (
            <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
              
              {/* Workspace Top Navigation Bar */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkspaceGroupId(null)}
                    className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs w-fit active:scale-95"
                  >
                    <ArrowLeft size={14} /> Back to Directory
                  </button>
                  <div className="h-5 w-px bg-gray-200 hidden sm:block"></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      selectedWorkspaceGroup.status === 'draft' ? 'bg-amber-500' : selectedWorkspaceGroup.status === 'completed' ? 'bg-purple-500' : 'bg-green-500 animate-pulse'
                    }`}></span>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate max-w-[180px] sm:max-w-none">{selectedWorkspaceGroup.name}</h3>
                    <span className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                      selectedWorkspaceGroup.status === 'draft'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : selectedWorkspaceGroup.status === 'completed'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {selectedWorkspaceGroup.status ? selectedWorkspaceGroup.status.toUpperCase() : 'ACTIVE'}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded">
                      Month {selectedWorkspaceGroup.currentMonth} of {selectedWorkspaceGroup.duration}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  <button
                    type="button"
                    onClick={() => openEditGroupModal(selectedWorkspaceGroup)}
                    className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                  >
                    <Edit3 size={13} className="text-gray-500" /> Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => openSoftDeleteModal(selectedWorkspaceGroup)}
                    className="border border-red-200 bg-red-50/60 hover:bg-red-100 text-red-700 font-bold text-xs px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs active:scale-95"
                    title="Move group to Recycle Bin"
                  >
                    <Trash2 size={13} className="text-red-600" /> Move to Bin
                  </button>
                </div>
              </div>

              {/* Group Key Metric Statistics (2x2 on mobile, 4 on desktop) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-white border border-gray-200 p-3 sm:p-3.5 rounded-2xl shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">Total Pool Value</span>
                  <span className="text-base sm:text-lg font-bold text-gray-900 mt-0.5 block truncate">{formatCurrency(selectedWorkspaceGroup.totalValue)}</span>
                  <span className="text-[10px] text-gray-400 truncate block">{selectedWorkspaceGroup.duration} Tickets</span>
                </div>

                <div className="bg-white border border-gray-200 p-3 sm:p-3.5 rounded-2xl shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">Monthly Installment</span>
                  <span className="text-base sm:text-lg font-bold text-indigo-600 mt-0.5 block truncate">
                    {formatCurrency(selectedWorkspaceGroup.totalValue / selectedWorkspaceGroup.duration)}
                  </span>
                  <span className="text-[10px] text-gray-400 truncate block">per member</span>
                </div>

                <div className="bg-white border border-gray-200 p-3 sm:p-3.5 rounded-2xl shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">Accumulated Pool</span>
                  <span className="text-base sm:text-lg font-bold text-emerald-600 mt-0.5 block truncate">
                    {formatCurrency(selectedWorkspaceGroup.kaiIruppuPool || 0)}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium truncate block">Kai Iruppu</span>
                </div>

                <div className="bg-white border border-gray-200 p-3 sm:p-3.5 rounded-2xl shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">Scheduled Auction</span>
                  <span className="text-xs sm:text-xs font-bold text-gray-800 mt-1 block truncate">
                    {getGroupAuctionDate(selectedWorkspaceGroup.id).display}
                  </span>
                  <button
                    type="button"
                    onClick={() => setScheduleModalGroup(selectedWorkspaceGroup)}
                    className="text-[9px] font-bold text-indigo-600 hover:underline mt-0.5 block cursor-pointer"
                  >
                    Configure Schedule →
                  </button>
                </div>
              </div>

              {/* Month 0 / Launch Status Banner */}
              {selectedWorkspaceGroup.currentMonth === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                        Month 0: Launch Month — Organizer Profit Phase
                      </h4>
                    </div>
                    <p className="text-xs text-amber-800">
                      All {selectedWorkspaceGroup.duration} member installments are pooled and allocated directly to the Organizer as Organizer Profit ({formatCurrency(selectedWorkspaceGroup.totalValue)}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalGroups(prev => prev.map(grp =>
                        grp.id === selectedWorkspaceGroup.id ? { ...grp, currentMonth: 1 } : grp
                      ));
                      const now = new Date();
                      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                      setAuditLogs(prev => [
                        {
                          timestamp: `Today, ${timeStr}`,
                          table: 'chit_groups',
                          desc: `LAUNCH CONFIRMED for "${selectedWorkspaceGroup.name}" — ₹${selectedWorkspaceGroup.totalValue.toLocaleString('en-IN')} allocated as Organizer Profit. Group advanced to Month 1.`,
                          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin'
                        },
                        ...prev
                      ]);
                      alert(`✅ Launch confirmed! ₹${selectedWorkspaceGroup.totalValue.toLocaleString('en-IN')} allocated as Organizer Profit for Month 0. Group now advances to Month 1.`);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 active:scale-95 w-full sm:w-auto"
                  >
                    <Rocket size={14} /> Confirm Launch &amp; Roll to M1
                  </button>
                </div>
              )}

              {/* Live Auction Countdown & Schedule Banner */}
              <AuctionCountdownBanner
                groupId={selectedWorkspaceGroup.id}
                groupName={selectedWorkspaceGroup.name}
                currentMonth={selectedWorkspaceGroup.currentMonth}
                durationMonths={selectedWorkspaceGroup.duration}
                auctionDayOfMonth={selectedWorkspaceGroup.auctionDayOfMonth}
                auctionTime={selectedWorkspaceGroup.auctionTime}
                nextAuctionDate={selectedWorkspaceGroup.nextAuctionDate}
                nextAuctionTime={selectedWorkspaceGroup.nextAuctionTime}
                allowConfigure={true}
                onScheduleUpdated={fetchGroups}
                compact={false}
              />

              {/* Enrolled Member Ticket Roster Matrix */}
              <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-150 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Users size={16} className="text-indigo-600" />
                      Enrolled Ticket Matrix
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Live status of assigned tickets and auction winning eligibility
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback('light');
                        setPrintChecklistGroup(selectedWorkspaceGroup);
                      }}
                      className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title="Print monthly payment checklist sheet / PDF"
                    >
                      <Printer size={13} className="text-gray-600" />
                      <span>Print Checklist</span>
                    </button>

                    <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl w-fit border border-gray-200">
                      Total: {workspaceMembers.length} / {selectedWorkspaceGroup.duration} Tickets
                    </span>
                  </div>
                </div>

                {loadingWorkspaceMembers ? (
                  <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-indigo-600" /> Loading enrolled ticket matrix from Supabase...
                  </div>
                ) : workspaceMembers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No individual member tickets linked to this group yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                    {workspaceMembers.map((member) => (
                      <div 
                        key={member.id} 
                        className={`p-3 sm:p-3.5 rounded-2xl border transition-all space-y-2 ${
                          member.hasWon
                            ? 'bg-gray-50/80 border-gray-200 opacity-80'
                            : 'bg-white border-gray-200 shadow-2xs hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-150 flex items-center justify-center shrink-0">
                              #{member.ticket}
                            </span>
                            <div className="min-w-0">
                              <strong className="text-xs text-gray-900 block truncate max-w-[140px] sm:max-w-[170px]">{member.name}</strong>
                              <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                                <Phone size={10} className="shrink-0" /> {member.phone || 'No phone'}
                              </span>
                            </div>
                          </div>

                          {member.hasWon ? (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full shrink-0">
                              Won
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
                              Eligible
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : !showWizard ? (
            /* 2. DIRECTORY VIEW */
            <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-200">
               {/* Summary Header banner */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">Chit Groups Directory</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Active Groups: <strong className="text-gray-700">{localGroups.filter(g => g.status !== 'deleted' && (g.status === 'active' || (!g.status && g.active))).length}</strong> · Total Value: <strong className="text-indigo-600">{formatCurrency(localGroups.filter(g => g.status !== 'deleted').reduce((acc, g) => acc + g.totalValue, 0))}</strong>
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setShowWizard(true)}
                    className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2 sm:py-2 rounded-xl transition-all shadow-xs active:scale-95 w-full sm:w-auto text-center"
                  >
                    + New Group
                  </button>
                </div>
              </div>

              {/* Filter Actions row (Horizontally scrollable on small mobile screens) */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-1 flex-nowrap sm:flex-wrap">
                <button
                  onClick={() => setGroupFilter('all')}
                  className={`text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl border transition-all shrink-0 whitespace-nowrap active:scale-95 ${
                    groupFilter === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs ring-2 ring-indigo-500/20'
                      : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({localGroups.filter(g => g.status !== 'deleted').length})
                </button>
                <button
                  onClick={() => setGroupFilter('active')}
                  className={`text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl border transition-all shrink-0 whitespace-nowrap active:scale-95 ${
                    groupFilter === 'active'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs ring-2 ring-emerald-500/20'
                      : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Active ({localGroups.filter(g => g.status !== 'deleted' && (g.status === 'active' || (!g.status && g.active))).length})
                </button>
                <button
                  onClick={() => setGroupFilter('draft')}
                  className={`text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl border transition-all shrink-0 whitespace-nowrap active:scale-95 ${
                    groupFilter === 'draft'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs ring-2 ring-amber-500/20'
                      : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Draft ({localGroups.filter(g => g.status === 'draft').length})
                </button>
                <button
                  onClick={() => setGroupFilter('completed')}
                  className={`text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl border transition-all shrink-0 whitespace-nowrap active:scale-95 ${
                    groupFilter === 'completed'
                      ? 'bg-purple-600 text-white border-purple-700 shadow-2xs ring-2 ring-purple-500/20'
                      : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Completed ({localGroups.filter(g => g.status === 'completed').length})
                </button>
                <button
                  onClick={() => setGroupFilter('bin')}
                  className={`text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl border transition-all shrink-0 whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
                    groupFilter === 'bin'
                      ? 'bg-rose-600 text-white border-rose-700 shadow-2xs ring-2 ring-rose-500/20'
                      : 'bg-rose-50/50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <Trash2 size={12} />
                  <span>Recycle Bin ({localGroups.filter(g => g.status === 'deleted').length})</span>
                </button>
              </div>

              {/* ── RECYCLE BIN VIEW ── */}
              {groupFilter === 'bin' ? (
                <div className="space-y-3">
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                        <Trash2 size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                          Recycle Bin
                          <span className="text-[10px] font-extrabold bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full">
                            {localGroups.filter(g => g.status === 'deleted').length} Groups
                          </span>
                        </h4>
                        <p className="text-xs text-rose-800 mt-0.5">
                          Soft-deleted groups are securely preserved here. You can restore them to Draft anytime or permanently purge them.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {localGroups.filter(g => g.status === 'deleted').length === 0 ? (
                      <div className="col-span-full py-12 px-6 bg-white border border-dashed border-gray-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-2 shadow-2xs">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
                          <Trash2 size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-gray-900">Recycle Bin is Empty</h4>
                        <p className="text-xs text-gray-500">No deleted chit groups found.</p>
                      </div>
                    ) : (
                      localGroups
                        .filter(g => g.status === 'deleted')
                        .map((g) => (
                          <div key={g.id} className="bg-white border-2 border-rose-150 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs hover:border-rose-300 transition-colors flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <div className="flex flex-col space-y-1 min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <span className="w-2 h-2 rounded-full shrink-0 bg-rose-500"></span>
                                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate max-w-[150px] sm:max-w-[180px]">{g.name}</h4>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border inline-block bg-rose-50 text-rose-700 border-rose-200">
                                      IN RECYCLE BIN
                                    </span>
                                  </div>
                                </div>
                                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                                  <Trash2 size={15} />
                                </div>
                              </div>

                              <div className="bg-rose-50/60 border border-rose-150 rounded-xl p-2.5 space-y-1 text-[11px] text-rose-950">
                                <div className="flex justify-between">
                                  <span className="text-rose-700 font-medium">Total Pool:</span>
                                  <strong className="font-bold text-gray-900">{formatCurrency(g.totalValue)}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-rose-700 font-medium">Duration:</span>
                                  <strong>{g.duration} Months ({g.memberCount || g.duration} Tickets)</strong>
                                </div>
                                {g.deletedAt && (
                                  <div className="flex justify-between pt-1 border-t border-rose-200/60 text-[10px]">
                                    <span className="text-rose-600">Deleted:</span>
                                    <span className="font-medium text-rose-800">
                                      {new Date(g.deletedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                              <button
                                type="button"
                                disabled={isRestoringGroupId === g.id}
                                onClick={() => handleRestoreGroup(g)}
                                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-xs py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                              >
                                {isRestoringGroupId === g.id ? (
                                  <RefreshCw size={13} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={13} />
                                )}
                                <span>Restore Group</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openPermanentDeleteModal(g)}
                                className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                              >
                                <Trash2 size={13} />
                                <span>Delete Perm</span>
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ) : (
                /* ── ACTIVE / DRAFT / COMPLETED DIRECTORY GRID ── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {localGroups.filter(g => {
                    if (g.status === 'deleted') return false;
                    if (groupFilter === 'all') return true;
                    if (groupFilter === 'draft') return g.status === 'draft';
                    if (groupFilter === 'completed') return g.status === 'completed';
                    return g.status === 'active' || (!g.status && g.active);
                  }).length === 0 ? (
                    <div className="col-span-full py-12 px-6 bg-white border border-gray-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-3 shadow-2xs">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Briefcase size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-gray-900">No Groups in this Category</h4>
                        <p className="text-xs text-gray-500 max-w-sm">
                          There are no chit groups with status <strong>{groupFilter}</strong> currently.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowWizard(true)}
                        className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs active:scale-95"
                      >
                        + Create First Group
                      </button>
                    </div>
                  ) : (
                  localGroups
                    .filter(g => {
                      if (g.status === 'deleted') return false;
                      if (groupFilter === 'all') return true;
                      if (groupFilter === 'draft') return g.status === 'draft';
                      if (groupFilter === 'completed') return g.status === 'completed';
                      return g.status === 'active' || (!g.status && g.active);
                    })
                    .map((g) => {
                      const progressPercent = (g.currentMonth / g.duration) * 100;
                      
                      return (
                        <div key={g.id} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-2xs hover:border-gray-300 transition-colors flex flex-col justify-between">
                          <div className="space-y-3">
                            {/* Card Top */}
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col space-y-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    g.status === 'draft' ? 'bg-amber-500' : g.status === 'completed' ? 'bg-purple-500' : 'bg-green-500 animate-pulse'
                                  }`}></span>
                                  <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate max-w-[150px] sm:max-w-[180px]">{g.name}</h4>
                                </div>
                                <div>
                                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border inline-block ${
                                    g.status === 'draft'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : g.status === 'completed'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    {g.status ? g.status.toUpperCase() : 'ACTIVE'}
                                  </span>
                                </div>
                              </div>

                              {/* Quick Action Icons */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  title="Edit chit details"
                                  onClick={() => openEditGroupModal(g)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors active:scale-95"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  type="button"
                                  title="Move to Recycle Bin"
                                  onClick={() => openSoftDeleteModal(g)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors active:scale-95"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Horizontal Progress bar — or Launch Month badge */}
                            {g.currentMonth === 0 ? (
                              <div className="flex items-center gap-2 py-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Launch Month — Organizer Profit Phase</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                                  <span>Progress</span>
                                  <span>Month {g.currentMonth} of {g.duration}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}

                            {/* Metadata Tracks */}
                            <div className="space-y-1.5 text-[10px] sm:text-[11px] text-gray-500">
                              <div className="flex justify-between">
                                <span>Total Pool:</span>
                                <strong className="text-gray-900">{formatCurrency(g.totalValue)}</strong>
                              </div>
                              <div className="flex justify-between">
                                <span>Monthly Installment:</span>
                                <strong className="text-indigo-600">{formatCurrency(g.totalValue / g.duration)}</strong>
                              </div>
                              {g.currentMonth === 0 && (
                                <div className="flex justify-between">
                                  <span>Organizer Profit:</span>
                                  <strong className="text-amber-600">{formatCurrency(g.totalValue)}</strong>
                                </div>
                              )}
                              {(() => {
                                const { display, isOverride } = getGroupAuctionDate(g.id);
                                return (
                                  <div className="flex justify-between items-center">
                                    <span>Auction Date:</span>
                                    <div className="flex items-center gap-1">
                                      <strong className={isOverride ? 'text-amber-600' : 'text-gray-700'}>{display}</strong>
                                      <button
                                        onClick={() => setScheduleModalGroup(g)}
                                        className="text-[8px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded hover:bg-indigo-100 transition-colors cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Footer Split Button containers */}
                          {g.currentMonth === 0 ? (
                            // Month-0 Launch: show a single Confirm Launch CTA spanning full width
                            <div className="pt-3 border-t border-gray-100">
                              <button
                                onClick={() => {
                                  setLocalGroups(prev => prev.map(grp =>
                                    grp.id === g.id ? { ...grp, currentMonth: 1 } : grp
                                  ));
                                  const now = new Date();
                                  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                                  setAuditLogs(prev => [
                                    {
                                      timestamp: `Today, ${timeStr}`,
                                      table: 'chit_groups',
                                      desc: `LAUNCH CONFIRMED for "${g.name}" — ₹${g.totalValue.toLocaleString('en-IN')} allocated as Organizer Profit. Group advanced to Month 1.`,
                                      executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin'
                                    },
                                    ...prev
                                  ]);
                                  alert(`✅ Launch confirmed! ₹${g.totalValue.toLocaleString('en-IN')} allocated as Organizer Profit for Month 0. Group now advances to Month 1.`);
                                }}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95"
                              >
                                <Rocket size={13} /> Confirm Launch &amp; Roll to M1
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWorkspaceGroupId(g.id);
                                  fetchWorkspaceMembers(g.id);
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95"
                              >
                                <Briefcase size={12} /> Workspace
                              </button>
                              <button
                                type="button"
                                disabled={isDuplicatingGroupId === g.id}
                                onClick={() => handleDuplicateGroup(g)}
                                className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
                              >
                                {isDuplicatingGroupId === g.id ? (
                                  <>
                                    <RefreshCw size={12} className="animate-spin text-indigo-600" />
                                    <span>Cloning...</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={12} />
                                    <span>Duplicate</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            /* 3. UPGRADED CHIT SETUP WIZARD VIEW */
            <div className="space-y-3.5 sm:space-y-5 animate-in fade-in duration-200">
              
              {/* Setup Wizard Progress Navigation Bar */}
              <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Sparkles size={15} />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wider">Chit Setup Wizard</h3>
                  </div>
                  <button
                    onClick={() => {
                      triggerHapticFeedback('light');
                      setShowWizard(false);
                    }}
                    className="text-[11px] text-gray-400 hover:text-gray-700 underline font-semibold transition-colors py-1 px-1.5"
                  >
                    Exit Wizard
                  </button>
                </div>

                {/* Step Indicators */}
                <div className="flex items-center justify-between gap-1 sm:gap-3 w-full sm:w-auto">
                  
                  {/* Step 1 Pill */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback('light');
                      setWizardStep(1);
                    }}
                    className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all ${
                      wizardStep === 1 
                        ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200' 
                        : 'hover:bg-gray-50 text-gray-500'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      wizardStep === 1 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : wizardStep > 1 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-gray-200 text-gray-500'
                    }`}>
                      {wizardStep > 1 ? <Check size={11} /> : '1'}
                    </span>
                    <span className={`text-[11px] sm:text-xs truncate ${wizardStep === 1 ? 'font-bold text-indigo-950' : 'font-semibold'}`}>
                      <span className="hidden sm:inline">1. </span>Basic<span className="hidden md:inline"> & Schedule</span>
                    </span>
                  </button>
                  
                  <div className="flex-1 sm:w-4 h-px bg-gray-200"></div>

                  {/* Step 2 Pill */}
                  <button
                    type="button"
                    disabled={!newGroupName.trim() || !newGroupValue || !newGroupDuration}
                    onClick={() => {
                      triggerHapticFeedback('light');
                      setWizardStep(2);
                    }}
                    className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all ${
                      wizardStep === 2 
                        ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200' 
                        : 'hover:bg-gray-50 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      wizardStep === 2 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : wizardStep > 2 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-gray-200 text-gray-500'
                    }`}>
                      {wizardStep > 2 ? <Check size={11} /> : '2'}
                    </span>
                    <span className={`text-[11px] sm:text-xs truncate ${wizardStep === 2 ? 'font-bold text-indigo-950' : 'font-semibold'}`}>
                      <span className="hidden sm:inline">2. </span>Members
                    </span>
                  </button>

                  <div className="flex-1 sm:w-4 h-px bg-gray-200"></div>

                  {/* Step 3 Pill */}
                  <button
                    type="button"
                    disabled={!newGroupName.trim() || !newGroupValue || !newGroupDuration}
                    onClick={() => {
                      triggerHapticFeedback('light');
                      setWizardStep(3);
                    }}
                    className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all ${
                      wizardStep === 3 
                        ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200' 
                        : 'hover:bg-gray-50 text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      wizardStep === 3 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      3
                    </span>
                    <span className={`text-[11px] sm:text-xs truncate ${wizardStep === 3 ? 'font-bold text-indigo-950' : 'font-semibold'}`}>
                      <span className="hidden sm:inline">3. </span>Review<span className="hidden md:inline"> & Launch</span>
                    </span>
                  </button>
                </div>
              </div>

              {/* ── STEP 1: BASIC INFO & SCHEDULE ── */}
              {wizardStep === 1 && (
                <div className="space-y-3.5 sm:space-y-4 animate-in fade-in duration-150">
                  
                  {/* Step 1 Main Form Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-4 sm:space-y-5 shadow-2xs">
                    <div className="border-b border-gray-150 pb-3 flex items-center justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2">
                        <span>Step 1: Chit Parameters &amp; Schedule</span>
                      </h4>
                      <button
                        type="button"
                        onClick={handleAutoGenerateName}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shrink-0 active:scale-95"
                      >
                        <Sparkles size={12} /> Auto-Name
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-5">
                      
                      {/* 1. Group Name */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                          Group Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="e.g. G-2L-10M-OCT26"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none transition-colors"
                          />
                          {newGroupName && (
                            <button
                              type="button"
                              onClick={() => setNewGroupName('')}
                              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 2. Total Pool Value */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                          Total Pool Value (₹) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">₹</span>
                          <input
                            type="number"
                            required
                            placeholder="100000"
                            value={newGroupValue}
                            onChange={(e) => setNewGroupValue(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl pl-7 pr-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none transition-colors"
                          />
                        </div>
                        {/* Target Presets */}
                        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                          {[
                            { label: '₹1L', val: 100000 },
                            { label: '₹2L', val: 200000 },
                            { label: '₹5L', val: 500000 },
                            { label: '₹10L', val: 1000000 },
                          ].map(preset => {
                            const isSelected = newGroupValue === preset.val.toString();
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  triggerHapticFeedback('light');
                                  setNewGroupValue(preset.val.toString());
                                }}
                                className={`text-[10px] font-bold py-1.5 rounded-lg transition-all text-center active:scale-95 border ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Duration & Member Count */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                          Duration / Tickets (Months) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            min={1}
                            max={50}
                            placeholder="20"
                            value={newGroupDuration}
                            onChange={(e) => handleDurationChange(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none transition-colors"
                          />
                        </div>
                        {/* Duration Presets */}
                        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                          {[5, 10, 20, 25].map(val => {
                            const isSelected = newGroupDuration === val.toString();
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => {
                                  triggerHapticFeedback('light');
                                  handleDurationChange(val.toString());
                                }}
                                className={`text-[10px] font-bold py-1.5 rounded-lg transition-all text-center active:scale-95 border ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                }`}
                              >
                                {val}m
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>

                    {/* Schedule Row */}
                    <div className="border-t border-gray-150 pt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-5">
                      
                      {/* Launch Date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                          Launch Date (Month 0) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            required
                            value={newGroupStartDate}
                            onChange={(e) => setNewGroupStartDate(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none font-semibold"
                          />
                        </div>
                      </div>

                      {/* Recurring Auction Rule Dropdown */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                          Monthly Auction Rule
                        </label>
                        <select
                          value={newGroupAuctionDay}
                          onChange={(e) => {
                            const day = Number(e.target.value);
                            setNewGroupAuctionDay(day);
                            updateLaunchDateFromRule(day, newGroupStartDate);
                            triggerHapticFeedback('light');
                          }}
                          className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none"
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>
                              1st Sunday on/after {day}th {day === 10 ? '(Default)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Recurring Auction Time */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                          Auction Bidding Time
                        </label>
                        <input
                          type="time"
                          value={newGroupAuctionTime}
                          onChange={(e) => setNewGroupAuctionTime(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none"
                        />
                      </div>

                    </div>
                  </div>

                  {/* Dynamic Real-time Chit Math Breakdown Card */}
                  {Number(newGroupValue) > 0 && Number(newGroupDuration) > 0 && (
                    <div className="bg-gradient-to-br from-indigo-50/70 via-indigo-50/30 to-purple-50/50 border border-indigo-150 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <Coins size={14} className="text-indigo-600" />
                          Financial Projections
                        </h5>
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                          {newGroupDuration} Tickets
                        </span>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
                        <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 sm:p-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Monthly Due</span>
                          <strong className="text-sm sm:text-base font-extrabold text-indigo-700 mt-0.5 block">
                            {formatCurrency(Math.round(Number(newGroupValue) / Number(newGroupDuration)))}
                          </strong>
                          <span className="text-[10px] text-gray-500">per member / mo</span>
                        </div>

                        <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 sm:p-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Month 0 Launch</span>
                          <strong className="text-sm sm:text-base font-extrabold text-amber-700 mt-0.5 block">
                            {formatCurrency(Number(newGroupValue))}
                          </strong>
                          <span className="text-[10px] text-amber-600 font-semibold">Organizer Profit</span>
                        </div>

                        <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 sm:p-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Total Lifecycle</span>
                          <strong className="text-sm sm:text-base font-extrabold text-gray-900 mt-0.5 block">
                            {Number(newGroupDuration) + 1} Months
                          </strong>
                          <span className="text-[10px] text-gray-500">M0 to M{newGroupDuration}</span>
                        </div>

                        <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 sm:p-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">1st Live Auction (M1)</span>
                          <strong className="text-xs sm:text-sm font-extrabold text-gray-900 mt-0.5 block truncate">
                            {(() => {
                              const targetDate = computeNextAuctionDateTime({
                                auction_day_of_month: newGroupAuctionDay,
                                auction_time: newGroupAuctionTime,
                                next_auction_date: null,
                                next_auction_time: newGroupAuctionTime,
                                start_date: newGroupStartDate,
                                current_month: 0,
                              });
                              return targetDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                            })()}
                          </strong>
                          <span className="text-[10px] text-gray-500">{formatTime12h(newGroupAuctionTime)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Step 1 Footer */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={!newGroupName.trim() || !newGroupValue || !newGroupDuration}
                      onClick={() => {
                        triggerHapticFeedback('light');
                        setWizardStep(2);
                      }}
                      className="bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white font-bold text-xs px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all w-full sm:w-auto cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span>Proceed to Step 2: Assign Members</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: ASSIGN GROUP MEMBERS ── */}
              {wizardStep === 2 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-4 sm:space-y-5 shadow-2xs animate-in fade-in duration-150">
                  
                  {/* Step 2 Header & Quick Actions Bar */}
                  <div className="border-b border-gray-150 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900">
                        Step 2: Assign Subscribers ({enrollments.filter(e => e.name !== '').length}/{newGroupDuration})
                      </h4>
                      {enrollments.every(e => e.name !== '') ? (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={11} /> 100% Enrolled
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          {enrollments.filter(e => !e.name).length} Open
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {enrollments.some(e => e.name) && (
                        <button
                          type="button"
                          onClick={handleClearAllSlots}
                          className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-colors active:scale-95"
                        >
                          <RotateCcw size={12} />
                          <span>Clear</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setTargetSlotForAssign(null);
                          setNewMemberName(memberSearchQuery.trim());
                          setNewMemberPhone('');
                          setShowCreateMemberModal(true);
                        }}
                        className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors shadow-xs active:scale-95"
                      >
                        <UserPlus size={13} />
                        <span>+ Register</span>
                      </button>
                    </div>
                  </div>

                  {/* Fast Search & Auto-Suggest Combobox */}
                  <div className="bg-gray-50/90 border border-gray-200 rounded-2xl p-2.5 sm:p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block flex items-center gap-1">
                        <Search size={11} /> Search &amp; Assign {targetSlotForAssign !== null ? `(Slot #${targetSlotForAssign + 1})` : ''}
                      </label>
                      {targetSlotForAssign !== null && (
                        <button
                          type="button"
                          onClick={() => setTargetSlotForAssign(null)}
                          className="text-[10px] text-gray-500 hover:text-gray-900 underline font-semibold"
                        >
                          Cancel Slot #{targetSlotForAssign + 1}
                        </button>
                      )}
                    </div>

                    {(() => {
                      const filteredMembers = masterDirectory.filter(
                        m => m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || m.phone.includes(memberSearchQuery)
                      );
                      const totalItems = 1 + filteredMembers.length;

                      return (
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-400">
                            <Search size={13} />
                          </span>
                          <input
                            type="text"
                            placeholder={targetSlotForAssign !== null ? `Type name for Slot #${targetSlotForAssign + 1}...` : "Search subscriber name or phone..."}
                            value={memberSearchQuery}
                            onFocus={() => {
                              setIsSearchDropdownOpen(true);
                              setDropdownHighlightedIndex(0);
                            }}
                            onChange={(e) => {
                              setMemberSearchQuery(e.target.value);
                              setIsSearchDropdownOpen(true);
                              setDropdownHighlightedIndex(0);
                            }}
                            onKeyDown={(e) => {
                              if (!isSearchDropdownOpen || memberSearchQuery.trim().length === 0) {
                                if (e.key === 'ArrowDown') {
                                  setIsSearchDropdownOpen(true);
                                }
                                return;
                              }

                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setDropdownHighlightedIndex(prev => (prev + 1) % totalItems);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setDropdownHighlightedIndex(prev => (prev - 1 + totalItems) % totalItems);
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (dropdownHighlightedIndex === 0) {
                                  setNewMemberName(memberSearchQuery.trim());
                                  setNewMemberPhone('');
                                  setShowCreateMemberModal(true);
                                  setIsSearchDropdownOpen(false);
                                } else {
                                  const targetMember = filteredMembers[dropdownHighlightedIndex - 1];
                                  if (targetMember) {
                                    const isAlreadyEnrolled = enrollments.some(
                                      en => en.name.toLowerCase() === targetMember.name.toLowerCase()
                                    );
                                    if (!isAlreadyEnrolled) {
                                      handleAssignExistingMember(targetMember);
                                    }
                                  }
                                }
                              } else if (e.key === 'Escape') {
                                setIsSearchDropdownOpen(false);
                              }
                            }}
                            className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-10 py-2 text-xs font-semibold text-gray-900 focus:outline-none shadow-2xs"
                          />
                          {memberSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setMemberSearchQuery('');
                                setIsSearchDropdownOpen(false);
                              }}
                              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 p-1"
                            >
                              <X size={13} />
                            </button>
                          )}

                          {/* Dropdown Suggestions */}
                          {isSearchDropdownOpen && memberSearchQuery.trim().length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-gray-100">
                              {/* Create Option (Index 0) */}
                              <div
                                onClick={() => {
                                  setNewMemberName(memberSearchQuery.trim());
                                  setNewMemberPhone('');
                                  setShowCreateMemberModal(true);
                                  setIsSearchDropdownOpen(false);
                                }}
                                className={`p-2.5 cursor-pointer flex items-center justify-between text-xs transition-colors ${
                                  dropdownHighlightedIndex === 0
                                    ? 'bg-indigo-100/90 text-indigo-950 font-bold ring-1 ring-inset ring-indigo-400'
                                    : 'hover:bg-indigo-50 text-indigo-600 font-semibold bg-indigo-50/40'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <UserPlus size={14} />
                                  Create &quot;{memberSearchQuery}&quot;
                                </span>
                                <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                  {dropdownHighlightedIndex === 0 && <span>↵</span>} + New
                                </span>
                              </div>

                              {/* Matching Master Directory Members */}
                              {filteredMembers.map((member, idx) => {
                                const isAlreadyEnrolled = enrollments.some(
                                  e => e.name.toLowerCase() === member.name.toLowerCase()
                                );
                                const isHighlighted = dropdownHighlightedIndex === idx + 1;

                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      if (!isAlreadyEnrolled) {
                                        handleAssignExistingMember(member);
                                      }
                                    }}
                                    className={`p-2.5 flex items-center justify-between text-xs transition-colors ${
                                      isAlreadyEnrolled
                                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                                        : isHighlighted
                                          ? 'bg-indigo-50 text-indigo-950 font-bold ring-1 ring-inset ring-indigo-300'
                                          : 'hover:bg-gray-50 cursor-pointer text-gray-800'
                                    }`}
                                  >
                                    <div>
                                      <span className="font-bold block">{member.name}</span>
                                      <span className="text-[10px] text-gray-400">{member.phone}</span>
                                    </div>
                                    <div>
                                      {isAlreadyEnrolled ? (
                                        <span className="text-[9px] font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded">Enrolled</span>
                                      ) : isHighlighted ? (
                                        <span className="text-[10px] font-bold text-white bg-indigo-600 px-2.5 py-0.5 rounded shadow-sm">
                                          ↵ Assign
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded hover:bg-indigo-100">
                                          Assign →
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Group Enrollment Slots Grid */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Enrolled Tickets ({enrollments.filter(e => e.name !== '').length}/{newGroupDuration})
                      </h5>
                      <span className="text-[10px] text-gray-400">
                        {enrollments.some(e => e.name === '') ? 'Tap slot to assign' : '✓ All tickets assigned'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[340px] sm:max-h-[420px] overflow-y-auto pr-1">
                      {enrollments.map((slot, index) => {
                        const isTargeted = targetSlotForAssign === index;
                        return (
                          <div 
                            key={index} 
                            className={`flex gap-2.5 items-center p-2.5 sm:p-3 rounded-xl border transition-all ${
                              slot.name 
                                ? 'bg-white border-gray-200 shadow-2xs hover:border-gray-300' 
                                : isTargeted
                                  ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-200'
                                  : 'border-dashed border-gray-250 bg-gray-50/60 hover:bg-gray-100/70 hover:border-indigo-300 cursor-pointer'
                            }`}
                            onClick={() => {
                              if (!slot.name) {
                                triggerHapticFeedback('light');
                                setTargetSlotForAssign(index);
                                setIsSearchDropdownOpen(true);
                              }
                            }}
                          >
                            <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              slot.name
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                                : isTargeted
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-gray-200 text-gray-500'
                            }`}>
                              {index + 1}
                            </span>

                            {slot.name ? (
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                <div className="truncate">
                                  <span className="text-xs font-bold text-gray-900 block truncate">{slot.name}</span>
                                  <span className="text-[10px] text-gray-500 block truncate flex items-center gap-1 mt-0.5">
                                    <Phone size={10} className="text-gray-400 shrink-0" />
                                    {slot.phone}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHapticFeedback('light');
                                    handleClearSlot(index);
                                  }}
                                  title="Unassign member"
                                  className="text-red-600 hover:text-red-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-red-200 shrink-0 bg-red-50/50 hover:bg-red-50 transition-colors flex items-center gap-1 active:scale-95"
                                >
                                  <Trash2 size={10} /> Clear
                                </button>
                              </div>
                            ) : (
                              <div className="flex-1 min-w-0 flex items-center justify-between">
                                <span className={`text-xs font-semibold truncate ${isTargeted ? 'text-indigo-700' : 'text-gray-400'}`}>
                                  {isTargeted ? 'Selected' : 'Open Slot'}
                                </span>
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg shrink-0">
                                  + Fill
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Master Member Directory */}
                  <div className="space-y-2 border-t border-gray-150 pt-3.5">
                    <div className="flex items-center justify-between">
                      <h5 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                        Master Directory ({masterDirectory.length})
                      </h5>
                      <span className="text-[10px] text-gray-400">Tap to assign to open slot</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {masterDirectory.length === 0 ? (
                        <div className="col-span-full py-4 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          No subscribers found. Tap <strong>&quot;+ Register&quot;</strong> to add one.
                        </div>
                      ) : (
                        masterDirectory.map((member, i) => {
                          const isAlreadyAdded = enrollments.some(e => e.name.toLowerCase() === member.name.toLowerCase());

                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={isAlreadyAdded}
                              onClick={() => handleAssignExistingMember(member)}
                              className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all relative active:scale-95 flex flex-col justify-between ${
                                isAlreadyAdded 
                                  ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed' 
                                  : 'bg-white hover:bg-indigo-50/50 border-gray-200 hover:border-indigo-300 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1 w-full">
                                <span className="text-xs sm:text-sm font-bold text-gray-900 block truncate">{member.name}</span>
                                {isAlreadyAdded && (
                                  <span className="text-[8px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                                    Enrolled
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] sm:text-[11px] text-gray-500 block truncate mt-1 flex items-center gap-1">
                                <Phone size={10} className="text-gray-400 shrink-0" />
                                {member.phone}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Navigation Step 2 Buttons */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 pt-3 border-t border-gray-150">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback('light');
                        setWizardStep(1);
                      }}
                      className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors active:scale-95 text-center"
                    >
                      <ArrowLeft size={13} className="inline mr-1" /> Back
                    </button>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                      <span className="text-[11px] text-gray-500 font-medium text-center sm:text-right">
                        <strong>{enrollments.filter(e => e.name && e.name.trim() !== '').length}/{newGroupDuration}</strong> tickets
                        {enrollments.some(e => !e.name || e.name.trim() === '') && (
                          <span className="text-amber-600 font-bold ml-1.5">(Draft)</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light');
                          setWizardStep(3);
                        }}
                        className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-6 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                      >
                        <span>Proceed to Review</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: REVIEW & LAUNCH PLAN ── */}
              {wizardStep === 3 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-4 sm:space-y-5 shadow-2xs animate-in fade-in duration-150">
                  <div className="border-b border-gray-150 pb-3 flex items-center justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900">Step 3: Review &amp; Launch</h4>
                    <div>
                      {enrollments.every(e => e.name !== '') ? (
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Active Launch
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Draft ({enrollments.filter(e => !e.name).length} Open)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 sm:p-3">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Group</span>
                      <strong className="text-gray-900 mt-0.5 block truncate text-xs sm:text-sm font-bold">{newGroupName}</strong>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 sm:p-3">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Pool Value</span>
                      <strong className="text-indigo-600 mt-0.5 block truncate text-xs sm:text-sm font-extrabold">{formatCurrency(Number(newGroupValue))}</strong>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 sm:p-3">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Lifecycle</span>
                      <strong className="text-gray-900 mt-0.5 block truncate text-xs sm:text-sm font-bold">{Number(newGroupDuration) + 1} Months (M0-M{newGroupDuration})</strong>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 sm:p-3">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Monthly Due</span>
                      <strong className="text-emerald-700 mt-0.5 block truncate text-xs sm:text-sm font-extrabold">
                        {formatCurrency(Math.round(Number(newGroupValue) / Number(newGroupDuration)))} / member
                      </strong>
                    </div>
                  </div>

                  {/* Operational Timeline Preview Box */}
                  <div className="bg-gradient-to-br from-gray-50 via-indigo-50/20 to-gray-50 border border-gray-200 rounded-2xl p-3 sm:p-4 space-y-2.5">
                    <h5 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-indigo-600" />
                      Timeline
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                      
                      {/* Month 0 Card */}
                      <div className="bg-white border border-amber-200 rounded-xl p-2.5 sm:p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-amber-900 flex items-center gap-1">
                            <Rocket size={12} className="text-amber-600" /> Month 0: Launch
                          </span>
                          <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            Organizer Profit
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600">
                          {newGroupStartDate} · All {newGroupDuration} members pay first installment ({formatCurrency(Math.round(Number(newGroupValue) / Number(newGroupDuration)))}). No auction held.
                        </p>
                      </div>

                      {/* Month 1 Card */}
                      <div className="bg-white border border-indigo-200 rounded-xl p-2.5 sm:p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-indigo-950 flex items-center gap-1">
                            <Trophy size={12} className="text-indigo-600" /> Month 1: 1st Auction
                          </span>
                          <span className="text-[9px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                            Live Bidding
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600">
                          {newGroupAuctionDay}th of next month · {formatTime12h(newGroupAuctionTime)}. Winning discount accumulates to <code>kai_iruppu_pool</code>.
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* Enrolled Subscribers Grid */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                      Enrolled Subscribers ({enrollments.filter(e => e.name && e.name.trim() !== '').length} of {newGroupDuration})
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                      {enrollments.map((slot, index) => (
                        <span key={index} className={`border text-[11px] px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1.5 ${
                          slot.name 
                            ? 'bg-white border-gray-200 text-gray-800 font-semibold' 
                            : 'bg-amber-50/50 border-amber-200 text-amber-700 italic'
                        }`}>
                          <span className="w-3.5 h-3.5 rounded-full bg-gray-100 text-gray-600 text-[8px] font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span>{slot.name || 'Open Slot'}</span>
                          {slot.phone && <span className="text-[10px] text-gray-400">({slot.phone})</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Navigation Step 3 Buttons */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 pt-3 border-t border-gray-150">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHapticFeedback('light');
                        setWizardStep(2);
                      }}
                      className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors active:scale-95 text-center"
                    >
                      <ArrowLeft size={13} className="inline mr-1" /> Back to Members
                    </button>
                    <button
                      type="button"
                      disabled={isCreatingGroup}
                      onClick={handleCreateGroup}
                      className={`font-bold text-xs px-7 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer ${
                        isCreatingGroup
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gray-900 hover:bg-black text-white'
                      }`}
                    >
                      {isCreatingGroup ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Saving Group in Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Rocket size={14} />
                          <span>Create Chit Group &amp; Enroll Slots</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      );

      default:
        return null;
    }
  };

  return (
    <>
      {renderTabContent()}

      {/* ── UPGRADED CHITBASE-INSPIRED CHIT GROUP SETTINGS MODAL ──────── */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden my-auto">
            
            {/* 1. Modal Top Bar */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <ArrowLeft size={13} /> Back
                </button>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Edit Chit Group</h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    {formatCurrency(editGroupValue)} · {editGroupMemberCount} Members · <span className="capitalize font-semibold text-indigo-600">{editGroupStatus}</span>
                  </p>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => setEditingGroup(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 2. Top Tab Switcher */}
            <div className="flex border-b border-gray-150 bg-gray-50/70 px-5 pt-2 gap-2">
              <button
                type="button"
                onClick={() => setEditActiveTab('details')}
                className={`py-2 px-4 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
                  editActiveTab === 'details'
                    ? 'bg-white text-indigo-600 border-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 border-transparent'
                }`}
              >
                <Briefcase size={14} /> Chit Details
              </button>
              <button
                type="button"
                onClick={() => setEditActiveTab('members')}
                className={`py-2 px-4 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
                  editActiveTab === 'members'
                    ? 'bg-white text-indigo-600 border-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 border-transparent'
                }`}
              >
                <Users size={14} /> Members
                <span className="bg-indigo-50 text-indigo-700 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold border border-indigo-100">
                  {editGroupMembers.length}
                </span>
              </button>
            </div>

            {/* 3. Scrollable Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">

              {editActiveTab === 'details' ? (
                <form id="edit-chit-form" onSubmit={handleSaveEditGroup} className="space-y-6">
                  
                  {/* Section A: Name & Status */}
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Chit details</span>
                      <h4 className="text-xs font-bold text-gray-500 uppercase mt-0.5">Name &amp; status</h4>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-700 block">Chit Name *</label>
                      <input
                        type="text"
                        required
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        placeholder="e.g. Sample Test Group"
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Status 3-Pills */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-700 block">Status</label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setEditGroupStatus('draft')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                            editGroupStatus === 'draft'
                              ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <Edit3 size={14} className={editGroupStatus === 'draft' ? 'text-amber-600' : 'text-gray-400'} />
                          Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditGroupStatus('active')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                            editGroupStatus === 'active'
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-sm ring-1 ring-emerald-400'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <CheckCircle2 size={14} className={editGroupStatus === 'active' ? 'text-emerald-600' : 'text-gray-400'} />
                          Active
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditGroupStatus('completed')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                            editGroupStatus === 'completed'
                              ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-sm'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <Trophy size={14} className={editGroupStatus === 'completed' ? 'text-purple-600' : 'text-gray-400'} />
                          Completed
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 italic mt-1">
                        {editGroupStatus === 'draft' && 'Draft mode: Enrollment open, no auction bids or treasury postings yet.'}
                        {editGroupStatus === 'active' && 'Active: In-progress chit fund for monthly collections and live auctions.'}
                        {editGroupStatus === 'completed' && 'Completed: All monthly cycles and winner payouts concluded.'}
                      </p>
                    </div>

                    {/* Active Month Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-700 block">Current Active Month *</label>
                      <select
                        value={editGroupCurrentMonth}
                        onChange={(e) => setEditGroupCurrentMonth(parseInt(e.target.value) || 0)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none"
                      >
                        <option value={0}>Month 0 (Launch Month — Organizer Profit Phase)</option>
                        {Array.from({ length: editGroupMemberCount }).map((_, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            Month {idx + 1} {idx === 0 ? '(1st Live Auction)' : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-gray-500">
                        Directly controls the ongoing monthly cycle. You can advance or revert this anytime.
                      </p>
                    </div>
                  </div>

                  <hr className="border-gray-150" />

                  {/* Section B: Size & Timing */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-gray-900">Size &amp; timing</h4>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Key fields</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Member Shares Stepper */}
                      <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-800">Member shares *</span>
                          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() => {
                                if (editGroupMemberCount > 1) {
                                  setEditGroupMemberCount(prev => prev - 1);
                                }
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm"
                            >
                              <Minus size={13} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={editGroupMemberCount}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setEditGroupMemberCount(val);
                              }}
                              className="w-10 text-center font-bold text-xs text-gray-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setEditGroupMemberCount(prev => prev + 1)}
                              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                        <span className="text-[11px] text-gray-500 block">
                          {editGroupMembers.length} of {editGroupMemberCount} assigned
                        </span>
                      </div>

                      {/* Duration Stepper (Synced 1:1) */}
                      <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-800">Duration (Months) *</span>
                          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                            <button
                              type="button"
                              onClick={() => {
                                if (editGroupMemberCount > 1) {
                                  setEditGroupMemberCount(prev => prev - 1);
                                }
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-10 text-center font-bold text-xs text-gray-900">
                              {editGroupMemberCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditGroupMemberCount(prev => prev + 1)}
                              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                        <span className="text-[11px] text-gray-500 block">
                          {editGroupMemberCount} planned, {editGroupMemberCount} months
                        </span>
                      </div>
                    </div>

                    {/* Validation Badges */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider block">
                            SHARES LIVE {editGroupMembers.length} / {editGroupMemberCount}
                          </span>
                          <p className="text-[11px] text-emerald-800 mt-0.5">
                            {editGroupMembers.length === editGroupMemberCount 
                              ? 'Share count matches the members assigned.' 
                              : `${editGroupMemberCount - editGroupMembers.length} tickets need member assignment.`}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider block">
                            MONTHS LIVE {editGroupMemberCount} / {editGroupMemberCount}
                          </span>
                          <p className="text-[11px] text-emerald-800 mt-0.5">
                            Duration and monthly plan are ready.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Start Month Picker */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-700 block">Start Month *</label>
                      <input
                        type="date"
                        value={editGroupStartDate}
                        onChange={(e) => setEditGroupStartDate(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
                      />
                      <p className="text-[10px] text-gray-500">
                        Changing the start month shifts dashboard months only before this chit has payments, lifts, or closed months.
                      </p>
                    </div>
                  </div>

                  <hr className="border-gray-150" />

                  {/* Section C: Set up the money */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Set up the money</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">Summary of monthly contributions, Organizer profit, and Laaba Seetu</p>
                    </div>

                    {/* Total Chit Value Input */}
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                      <label className="text-[11px] font-bold text-gray-700 block">
                        Total chit value — the prize pot (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-gray-400 font-bold text-sm">₹</span>
                        <input
                          type="number"
                          min={1000}
                          step={1000}
                          required
                          value={editGroupValue}
                          onChange={(e) => setEditGroupValue(Math.max(1000, parseInt(e.target.value) || 0))}
                          className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-2 text-sm font-bold text-gray-900 focus:outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium">
                        Roughly {formatCurrency(Math.round(editGroupValue / (editGroupMemberCount || 1)))} per member each month.
                      </p>
                    </div>

                    {/* 3-Stage Formula Flow */}
                    <div className="p-3 bg-white border border-gray-200 rounded-2xl flex items-center justify-around text-center shadow-sm">
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block">MEMBERS</span>
                        <strong className="text-xs font-extrabold text-gray-800">{editGroupMemberCount}</strong>
                      </div>
                      <ArrowRight size={14} className="text-gray-300" />
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block">EACH PAYS / MO</span>
                        <strong className="text-xs font-extrabold text-indigo-600">
                          {formatCurrency(Math.round(editGroupValue / (editGroupMemberCount || 1)))}
                        </strong>
                      </div>
                      <ArrowRight size={14} className="text-gray-300" />
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block">WINNER TAKES</span>
                        <strong className="text-xs font-extrabold text-amber-600">
                          {formatCurrency(editGroupValue)}
                        </strong>
                      </div>
                    </div>

                    {/* Step 1 Card: How much does each member pay */}
                    <div className="p-4 bg-white border border-gray-200 rounded-2xl space-y-3 shadow-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-900 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                          <h5 className="text-xs font-bold text-gray-900">How much does each member pay every month?</h5>
                        </div>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={11} /> All set
                        </span>
                      </div>

                      <div className="p-3 bg-emerald-50/50 border border-emerald-150 rounded-xl text-xs text-emerald-900 font-medium">
                        Everyone pays <strong>{formatCurrency(Math.round(editGroupValue / (editGroupMemberCount || 1)))}</strong> every month — that&apos;s a <strong>{formatCurrency(editGroupValue)}</strong> pot collected each month.
                      </div>
                    </div>

                    {/* Step 2 Card: Month 0 Organizer Profit */}
                    <div className="p-4 bg-white border border-gray-200 rounded-2xl space-y-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                        <h5 className="text-xs font-bold text-gray-900">Month 0 Launch Month (Organizer Profit)</h5>
                      </div>
                      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <p className="font-semibold">Launch Month Allocation:</p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          All {editGroupMemberCount} members pay their first installment (<strong>{formatCurrency(editGroupValue)}</strong> total), which is taken directly by the Organizer as <strong>Organizer Profit</strong>. No auction occurs in Month 0.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 Card: Laaba Seetu Bonus Month */}
                    <div className="p-4 bg-white border border-gray-200 rounded-2xl space-y-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                        <h5 className="text-xs font-bold text-gray-900">Laaba Seetu (லாப சீட்டு — Profit Month)</h5>
                      </div>
                      <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                        <p className="font-semibold">Threshold: When Kai Iruppu Pool &ge; {formatCurrency(editGroupValue)}</p>
                        <p className="text-[11px] text-emerald-800">
                          Subscribers pay <strong>₹0 installment due</strong>. The prize pot is funded entirely by accumulated auction discounts, and auction bidding continues normally!
                        </p>
                      </div>
                    </div>

                  </div>

                  <hr className="border-gray-150" />

                  {/* Section D: REVIEW — Does this look right? */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">REVIEW — does this look right?</span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-gray-200">
                        <span className="text-gray-500">Members</span>
                        <strong className="text-gray-900">{editGroupMemberCount}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-200">
                        <span className="text-gray-500">Each member pays / month</span>
                        <strong className="text-gray-900">{formatCurrency(Math.round(editGroupValue / (editGroupMemberCount || 1)))}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-200">
                        <span className="text-gray-500">Collected each month</span>
                        <strong className="text-gray-900">{formatCurrency(editGroupValue)}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-200">
                        <span className="text-gray-500">Prize pot — winner takes</span>
                        <strong className="text-amber-600">{formatCurrency(editGroupValue)}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-200">
                        <span className="text-gray-500">Monthly draws</span>
                        <strong className="text-gray-900">{editGroupMemberCount} · from {editGroupStartDate || 'Active cycle'}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-200">
                        <span className="text-gray-500">Organizer Profit</span>
                        <strong className="text-amber-600">{formatCurrency(editGroupValue)} (Month 0)</strong>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                      <CheckCircle2 size={14} /> The money adds up — collection matches the pot.
                    </div>
                  </div>

                  {/* Section E: Advanced & Danger Zone */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsAdvancedExpanded(prev => !prev)}
                      className="w-full p-3.5 bg-gray-50 hover:bg-gray-100/80 flex justify-between items-center text-xs font-bold text-gray-700 transition-colors"
                    >
                      <span>ADVANCED</span>
                      <span className="text-indigo-600 text-[11px] font-bold">
                        {isAdvancedExpanded ? 'Hide' : 'Show'}
                      </span>
                    </button>

                    {isAdvancedExpanded && (
                      <div className="p-4 bg-red-50/50 border-t border-red-100 space-y-3">
                        <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider block">DANGER ZONE</span>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <p className="text-xs text-red-800">
                            Permanently delete this chit group and all its enrolled tickets &amp; auction data.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const target = editingGroup;
                              setEditingGroup(null);
                              setDeletingGroup(target);
                              setDeletePhraseInput('');
                              setDeleteSliderVal(0);
                            }}
                            className="border border-red-300 bg-white hover:bg-red-50 text-red-700 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm shrink-0 self-start sm:self-auto"
                          >
                            <Trash2 size={13} className="text-red-600" /> Delete Group
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </form>
              ) : (
                /* TAB 2: MEMBERS MANAGEMENT (ChitBase Architecture) */
                <div className="space-y-3.5">
                  {/* Top Members Header */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 pb-3 border-b border-gray-150">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-gray-900">Members &amp; Tickets</h4>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded-full">
                          {editGroupMembers.filter(m => m.profileId).length}/{editGroupMemberCount} Assigned
                        </span>
                        {editGroupStatus === 'draft' ? (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                            Draft (Reordering Open)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Lock size={10} /> Tickets Locked ({editGroupStatus.toUpperCase()})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {editGroupStatus === 'draft'
                          ? '↕️ Drag cards or use arrows to reorder ticket slots (Draft mode only)'
                          : '🔒 Ticket numbers cannot be changed once the chit group becomes active.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Expand / Collapse All Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light');
                          if (expandedEditTicketIds.length > 0) {
                            setExpandedEditTicketIds([]);
                          } else {
                            setExpandedEditTicketIds(Array.from({ length: editGroupMemberCount }, (_, i) => i + 1));
                          }
                        }}
                        className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold text-[11px] px-2.5 py-1.5 rounded-xl transition-colors shrink-0"
                      >
                        {expandedEditTicketIds.length > 0 ? 'Collapse All' : 'Expand All'}
                      </button>

                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={editMemberSearchQuery}
                          onChange={(e) => setEditMemberSearchQuery(e.target.value)}
                          className="bg-gray-50 border border-gray-200 rounded-xl pl-7 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none w-28 sm:w-36"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setNewMemberName('');
                          setNewMemberPhone('');
                          setShowCreateMemberModal(true);
                        }}
                        className="bg-gray-900 hover:bg-black text-white font-bold text-[11px] px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors shadow-sm shrink-0"
                      >
                        <UserPlus size={13} /> + Member
                      </button>
                    </div>
                  </div>

                  {/* Member Tickets Roster List */}
                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {Array.from({ length: editGroupMemberCount }).map((_, idx) => {
                      const ticketNum = idx + 1;
                      const member = editGroupMembers.find(m => m.ticket === ticketNum);
                      const standardDue = Math.round(editGroupValue / (editGroupMemberCount || 1));
                      const effectiveDue = member?.customInstallment || standardDue;
                      const isExpanded = expandedEditTicketIds.includes(ticketNum);
                      const isTimingExpanded = expandedTimingTicketIds.includes(ticketNum);
                      const isBeingDragged = draggedTicketNum === ticketNum;
                      const isDragOver = dragOverTicketNum === ticketNum;
                      const isDraft = editGroupStatus === 'draft';
                      const totalShares = member?.profileId
                        ? editGroupMembers.filter(m => m.profileId === member.profileId).length
                        : 0;

                      if (editMemberSearchQuery && member?.name && !member.name.toLowerCase().includes(editMemberSearchQuery.toLowerCase())) {
                        return null;
                      }

                      return (
                        <div
                          key={ticketNum}
                          draggable={isDraft}
                          onDragStart={(e) => {
                            if (!isDraft) return;
                            setDraggedTicketNum(ticketNum);
                            e.dataTransfer.setData('text/plain', String(ticketNum));
                          }}
                          onDragOver={(e) => {
                            if (!isDraft) return;
                            e.preventDefault();
                            if (dragOverTicketNum !== ticketNum) {
                              setDragOverTicketNum(ticketNum);
                            }
                          }}
                          onDragLeave={() => {
                            if (!isDraft) return;
                            if (dragOverTicketNum === ticketNum) {
                              setDragOverTicketNum(null);
                            }
                          }}
                          onDrop={(e) => {
                            if (!isDraft) return;
                            e.preventDefault();
                            if (draggedTicketNum !== null && draggedTicketNum !== ticketNum) {
                              handleSwapTicketSlots(draggedTicketNum, ticketNum);
                            }
                            setDraggedTicketNum(null);
                            setDragOverTicketNum(null);
                          }}
                          onDragEnd={() => {
                            setDraggedTicketNum(null);
                            setDragOverTicketNum(null);
                          }}
                          className={`rounded-2xl border transition-all ${
                            isDragOver
                              ? 'border-indigo-500 ring-2 ring-indigo-300 bg-indigo-50/50 scale-[1.01]'
                              : isBeingDragged
                                ? 'opacity-40 border-dashed border-indigo-400 bg-gray-50'
                                : member?.profileId 
                                  ? 'bg-white border-gray-200 shadow-2xs hover:border-gray-300' 
                                  : 'border-dashed border-gray-300 bg-gray-50/60'
                          }`}
                        >
                          {/* ── CARD HEADER (Always visible & Clickable to Expand) ── */}
                          <div
                            onClick={() => {
                              triggerHapticFeedback('light');
                              setExpandedEditTicketIds(prev =>
                                isExpanded ? prev.filter(id => id !== ticketNum) : [...prev, ticketNum]
                              );
                            }}
                            className="p-3 sm:p-3.5 flex items-center justify-between gap-2 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Drag Handle (Draft Only) or Lock Indicator (Active Groups) */}
                              {isDraft ? (
                                <div
                                  title="Drag to reorder ticket"
                                  onClick={(e) => e.stopPropagation()}
                                  className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-600 shrink-0 hidden sm:block"
                                >
                                  <GripVertical size={16} />
                                </div>
                              ) : (
                                <div
                                  title="Ticket order is locked for active groups"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 text-gray-300 shrink-0 hidden sm:block"
                                >
                                  <Lock size={13} />
                                </div>
                              )}

                              {/* Mobile Reorder Buttons (Draft Mode Only) */}
                              {isDraft && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex flex-col gap-0.5 shrink-0 sm:hidden"
                                >
                                  <button
                                    type="button"
                                    disabled={ticketNum === 1}
                                    onClick={() => handleSwapTicketSlots(ticketNum, ticketNum - 1)}
                                    className="p-0.5 text-gray-400 hover:text-gray-900 disabled:opacity-20"
                                  >
                                    <ArrowUp size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={ticketNum === editGroupMemberCount}
                                    onClick={() => handleSwapTicketSlots(ticketNum, ticketNum + 1)}
                                    className="p-0.5 text-gray-400 hover:text-gray-900 disabled:opacity-20"
                                  >
                                    <ArrowDown size={11} />
                                  </button>
                                </div>
                              )}

                              {/* Ticket Badge */}
                              <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                                member?.profileId
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                                  : 'bg-gray-200 text-gray-500'
                              }`}>
                                #{ticketNum}
                              </span>

                              {/* Member Identity & Details */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-xs sm:text-sm font-bold truncate ${member?.profileId ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                    {member?.name || (member?.profileId ? 'Subscriber' : 'Unassigned Ticket')}
                                  </span>
                                  {member?.phone && (
                                    <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                                      ({member.phone})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-500 font-medium truncate flex items-center gap-1.5 mt-0.5">
                                  <span>Pays <strong className="text-emerald-700">≈ {formatCurrency(effectiveDue)}/mo</strong></span>
                                  {totalShares > 1 && (
                                    <span className="text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded text-[9px]">
                                      {totalShares}x shares
                                    </span>
                                  )}
                                  {member?.profileId && member?.splitPool && (
                                    <span className="text-purple-700 font-bold bg-purple-50 border border-purple-100 px-1.5 py-0.2 rounded text-[9px]">
                                      👥 Pool
                                    </span>
                                  )}
                                  {member?.profileId && member?.exitMonth && (
                                    <span className="text-red-700 font-bold bg-red-50 border border-red-100 px-1.5 py-0.2 rounded text-[9px]">
                                      ⚠️ Exits M{member.exitMonth}
                                    </span>
                                  )}
                                  {member?.profileId && member?.transferredFrom && (
                                    <span className="text-amber-700 font-bold bg-amber-50 border border-amber-100 px-1.5 py-0.2 rounded text-[9px]">
                                      🔄 Transferred
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions & Chevron */}
                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {member?.profileId && (
                                <button
                                  type="button"
                                  title="Unassign ticket"
                                  onClick={() => handleUnassignTicket(member.id, ticketNum)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}

                              <div
                                onClick={() => {
                                  triggerHapticFeedback('light');
                                  setExpandedEditTicketIds(prev =>
                                    isExpanded ? prev.filter(id => id !== ticketNum) : [...prev, ticketNum]
                                  );
                                }}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>
                          </div>

                          {/* ── EXPANDED CONTROLS BODY ── */}
                          {isExpanded && (
                            <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-gray-100 animate-in fade-in duration-150 text-xs">
                              
                              {/* Shares Stepper & Timing Line */}
                              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Shares:</span>
                                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-0.5 shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (member?.profileId) {
                                          const extra = editGroupMembers.filter(m => m.profileId === member.profileId && m.ticket !== ticketNum);
                                          if (extra.length > 0) {
                                            handleUnassignTicket(extra[extra.length - 1].id, extra[extra.length - 1].ticket);
                                          }
                                        }
                                      }}
                                      className="w-6 h-6 rounded-lg hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs"
                                    >
                                      <Minus size={11} />
                                    </button>
                                    <span className="w-7 text-center font-bold text-xs text-gray-900">
                                      {member?.profileId ? `${totalShares}x` : '0x'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (member?.profileId) {
                                          const emptySlot = editGroupMembers.find(m => !m.profileId && m.ticket !== ticketNum);
                                          if (emptySlot) {
                                            handleReassignTicketMember(emptySlot.ticket, emptySlot.id, member.profileId, member.name, member.phone);
                                          } else {
                                            alert('All ticket slots are currently filled.');
                                          }
                                        }
                                      }}
                                      className="w-6 h-6 rounded-lg hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs"
                                    >
                                      <Plus size={11} />
                                    </button>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedTimingTicketIds(prev =>
                                      isTimingExpanded ? prev.filter(id => id !== ticketNum) : [...prev, ticketNum]
                                    );
                                  }}
                                  className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
                                >
                                  Share timing {isTimingExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              </div>

                              {/* Action Buttons Row */}
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!member?.profileId) return;
                                    setCustomAmountModalTicket(member);
                                    setCustomAmountVal(member?.customInstallment || standardDue);
                                  }}
                                  disabled={!member?.profileId}
                                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
                                    member?.profileId && member?.customInstallment
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                                  }`}
                                >
                                  {member?.profileId && member?.customInstallment ? `Custom: ₹${member.customInstallment.toLocaleString('en-IN')}` : 'Set custom amount'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!member?.profileId) return;
                                    setSplitModalTicket(member);
                                    setSplitPayers(member?.splitPool || [
                                      { name: member?.name || 'Person 1', part: Math.round(standardDue / 2) },
                                      { name: 'Person 2', part: Math.round(standardDue / 2) }
                                    ]);
                                  }}
                                  disabled={!member?.profileId}
                                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
                                    member?.profileId && member?.splitPool
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                                  }`}
                                >
                                  {member?.profileId && member?.splitPool ? `Pool (${member.splitPool.length} payers)` : 'Split into pool'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!member?.profileId) return;
                                    setExitModalTicket(member);
                                    setExitMonthVal(member?.exitMonth || (editingGroup?.currentMonth || 1) + 1);
                                  }}
                                  disabled={!member?.profileId}
                                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
                                    member?.profileId && member?.exitMonth
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                                  }`}
                                >
                                  {member?.profileId && member?.exitMonth ? `Exits M${member.exitMonth}` : 'Member leaves chit...'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!member?.profileId) return;
                                    setTransferModalTicket(member);
                                    setTransferRecipientId('');
                                    setTransferMonthVal((editingGroup?.currentMonth || 1) + 1);
                                  }}
                                  disabled={!member?.profileId}
                                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-all ${
                                    member?.profileId && member?.transferredFrom
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'
                                  }`}
                                >
                                  {member?.profileId && member?.transferredFrom ? 'Transferred' : 'Transfer shares...'}
                                </button>
                              </div>

                              {/* Expanded Share Timing Details */}
                              {isTimingExpanded && (
                                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5 text-xs animate-in fade-in duration-150">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Share Timeline</span>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between py-0.5 border-b border-gray-200">
                                      <span>Month 1 (Launch)</span>
                                      <span className="text-gray-500 font-semibold">1x · Collected</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span>Month 2 onward</span>
                                      <span className="text-indigo-600 font-semibold">
                                        {member?.profileId ? `${totalShares}x active` : 'Unassigned'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Active Split Pool Summary Tag */}
                              {member?.profileId && member?.splitPool && (
                                <div className="p-2 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider block">👥 Joint Split Pool Active:</span>
                                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                                    {member.splitPool.map((p: any, pIdx: number) => (
                                      <span key={pIdx} className="bg-white border border-purple-200 px-2 py-0.5 rounded-md font-semibold">
                                        {p.name}: {formatCurrency(p.part)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Active Exit Warning Tag */}
                              {member?.profileId && member?.exitMonth && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex justify-between items-center">
                                  <span>⚠️ Scheduled to exit on <strong>Month {member.exitMonth}</strong></span>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveExit(member.id, null)}
                                    className="text-[10px] font-bold text-red-700 underline"
                                  >
                                    Re-instate
                                  </button>
                                </div>
                              )}

                              {/* Reassign Subscriber Selector */}
                              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 text-[11px]">
                                <span className="text-gray-500 font-medium">Reassign Subscriber:</span>
                                <select
                                  value={member?.profileId || ''}
                                  onChange={(e) => {
                                    const selectedProfileId = e.target.value;
                                    const targetProfile = masterDirectory.find(p => p.id === selectedProfileId);
                                    if (targetProfile) {
                                      handleReassignTicketMember(ticketNum, member?.id, targetProfile.id!, targetProfile.name, targetProfile.phone);
                                    }
                                  }}
                                  className="bg-gray-50 border border-gray-200 text-gray-800 text-[11px] font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 max-w-[200px]"
                                >
                                  <option value="" disabled>Select Subscriber</option>
                                  {masterDirectory.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                                  ))}
                                </select>
                              </div>

                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* 4. Modal Sticky Action Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-150 bg-gray-50 flex justify-between items-center z-10">
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSaveEditGroup()}
                disabled={isSavingEdit || !editGroupName.trim()}
                className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Update Group
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── 1. SUB-MODAL: SPLIT INTO A POOL (Screenshot 3) ──────── */}
      {splitModalTicket && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 w-full max-w-sm space-y-4 shadow-2xl relative max-h-[90dvh] overflow-y-auto my-auto">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Split {splitModalTicket.name}&apos;s share</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Add each person who pays a part of this one share. Their payments are collected and tracked...
                </p>
              </div>
              <button onClick={() => setSplitModalTicket(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>Who Pays</span>
                <span>Their Part</span>
              </div>

              {splitPayers.map((payer, pIdx) => (
                <div key={pIdx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={payer.name}
                    placeholder={`Person ${pIdx + 1}`}
                    onChange={(e) => {
                      const copy = [...splitPayers];
                      copy[pIdx].name = e.target.value;
                      setSplitPayers(copy);
                    }}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-2 text-gray-400 text-xs font-bold">₹</span>
                    <input
                      type="number"
                      value={payer.part || ''}
                      placeholder="0"
                      onChange={(e) => {
                        const copy = [...splitPayers];
                        copy[pIdx].part = Number(e.target.value) || 0;
                        setSplitPayers(copy);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-6 pr-2 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                    />
                  </div>
                  {splitPayers.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setSplitPayers(splitPayers.filter((_, i) => i !== pIdx))}
                      className="text-gray-400 hover:text-red-600 p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => setSplitPayers([...splitPayers, { name: `Person ${splitPayers.length + 1}`, part: 0 }])}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-1"
              >
                + Add person
              </button>
            </div>

            {/* Total Payers Summary Bar */}
            <div className="bg-gray-900 text-white rounded-2xl p-3 flex justify-between items-center text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <Users size={14} /> {splitPayers.filter(p => p.name.trim()).length} PAYERS
              </span>
              <strong className="text-sm font-extrabold">
                {formatCurrency(splitPayers.reduce((sum, p) => sum + (p.part || 0), 0))}/mo
              </strong>
            </div>

            <p className="text-[10px] text-gray-400 text-center">
              Target ticket due: {formatCurrency(Math.round(editGroupValue / (editGroupMemberCount || 1)))}/mo.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSplitModalTicket(null)}
                className="w-full sm:w-auto border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 sm:py-2 rounded-xl transition-colors text-center"
              >
                Cancel
              </button>
              {splitModalTicket.splitPool && (
                <button
                  type="button"
                  onClick={() => handleSaveSplit(splitModalTicket.id, [])}
                  className="w-full sm:w-auto border border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs px-3 py-2.5 sm:py-2 rounded-xl transition-colors text-center"
                >
                  Clear Split
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSaveSplit(splitModalTicket.id, splitPayers)}
                className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 sm:py-2 rounded-xl transition-colors shadow-sm text-center"
              >
                Save split
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. SUB-MODAL: MEMBER LEAVES THE CHIT (Screenshot 4) ──────── */}
      {exitModalTicket && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 w-full max-w-sm space-y-4 shadow-2xl relative max-h-[90dvh] overflow-y-auto my-auto">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Member leaves the chit</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {exitModalTicket.name} · Ticket #{exitModalTicket.ticket}
                </p>
              </div>
              <button onClick={() => setExitModalTicket(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-700 block">Member stops paying from:</label>
              <select
                value={exitMonthVal}
                onChange={(e) => setExitMonthVal(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none"
              >
                {Array.from({ length: editGroupMemberCount }).map((_, i) => {
                  const mNum = i + 1;
                  return (
                    <option key={mNum} value={mNum}>
                      Month {mNum} {mNum <= (editingGroup?.currentMonth || 1) ? '(Current/Past)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Now vs After Table */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden text-xs">
              <div className="grid grid-cols-4 bg-gray-50 p-2.5 font-bold text-[10px] text-gray-400 uppercase tracking-wider">
                <span>Month</span>
                <span>Member</span>
                <span>Now</span>
                <span className="text-right">After</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-[140px] overflow-y-auto">
                {Array.from({ length: editGroupMemberCount }).slice(exitMonthVal - 1).map((_, idx) => {
                  const mNum = exitMonthVal + idx;
                  const stdDue = Math.round(editGroupValue / (editGroupMemberCount || 1));
                  return (
                    <div key={mNum} className="grid grid-cols-4 p-2.5 text-xs items-center">
                      <span className="font-bold text-gray-800">M{mNum}</span>
                      <span className="truncate text-gray-600">{exitModalTicket.name}</span>
                      <span className="text-gray-500">{formatCurrency(stdDue)}</span>
                      <span className="text-right font-bold text-red-600">₹0</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs flex justify-between items-center font-bold">
              <span className="text-gray-500">These months collect in total:</span>
              <span className="text-gray-900">
                {formatCurrency(Math.round(editGroupValue / (editGroupMemberCount || 1)) * Math.max(1, editGroupMemberCount - exitMonthVal + 1))} → <strong className="text-red-600">₹0</strong>
              </span>
            </div>

            <p className="text-[10px] text-gray-400">
              They pay up to the month before. Payments and wins stay on record; nothing is deleted.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setExitModalTicket(null)}
                className="w-full sm:w-auto border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 sm:py-2 rounded-xl transition-colors text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveExit(exitModalTicket.id, exitMonthVal)}
                className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 sm:py-2 rounded-xl transition-colors shadow-sm text-center"
              >
                End shares
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. SUB-MODAL: TRANSFER SHARES ──────── */}
      {transferModalTicket && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 w-full max-w-sm space-y-4 shadow-2xl relative max-h-[90dvh] overflow-y-auto my-auto">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Transfer Ticket #{transferModalTicket.ticket}</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Transfer future payments and bidding rights from {transferModalTicket.name} to another subscriber
                </p>
              </div>
              <button onClick={() => setTransferModalTicket(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 block">Select New Subscriber *</label>
                <select
                  value={transferRecipientId}
                  onChange={(e) => setTransferRecipientId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
                >
                  <option value="" disabled>Choose recipient subscriber</option>
                  {masterDirectory
                    .filter(p => p.id !== transferModalTicket.profileId)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 block">Transfer Effective From:</label>
                <select
                  value={transferMonthVal}
                  onChange={(e) => setTransferMonthVal(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                >
                  {Array.from({ length: editGroupMemberCount }).map((_, i) => {
                    const mNum = i + 1;
                    return (
                      <option key={mNum} value={mNum}>
                        Month {mNum} {mNum <= (editingGroup?.currentMonth || 1) ? '(Upcoming)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
              <p className="font-bold">Transfer Summary:</p>
              <p>• Previous payments remain credited to {transferModalTicket.name}.</p>
              <p>• Dues and live bidding rights from Month {transferMonthVal} transfer to the new subscriber.</p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTransferModalTicket(null)}
                className="w-full sm:w-auto border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 sm:py-2 rounded-xl transition-colors text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!transferRecipientId}
                onClick={() => handleSaveTransfer(transferModalTicket.id, transferRecipientId, transferMonthVal)}
                className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 sm:py-2 rounded-xl transition-colors shadow-sm disabled:opacity-50 text-center"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. SUB-MODAL: CUSTOM AMOUNT ──────── */}
      {customAmountModalTicket && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 w-full max-w-sm space-y-4 shadow-2xl relative max-h-[90dvh] overflow-y-auto my-auto">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Custom Monthly Due</h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Ticket #{customAmountModalTicket.ticket} · {customAmountModalTicket.name}
                </p>
              </div>
              <button onClick={() => setCustomAmountModalTicket(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-700 block">Monthly Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={customAmountVal || ''}
                  placeholder="e.g. 15000"
                  onChange={(e) => setCustomAmountVal(Number(e.target.value) || 0)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-gray-500">
                Standard baseline installment: {formatCurrency(Math.round(editGroupValue / (editGroupMemberCount || 1)))}/mo.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCustomAmountModalTicket(null)}
                className="w-full sm:w-auto border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 sm:py-2 rounded-xl transition-colors text-center"
              >
                Cancel
              </button>
              {customAmountModalTicket.customInstallment && (
                <button
                  type="button"
                  onClick={() => handleSaveCustomAmount(customAmountModalTicket.id, null)}
                  className="w-full sm:w-auto border border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs px-3 py-2.5 sm:py-2 rounded-xl transition-colors text-center"
                >
                  Clear Custom
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSaveCustomAmount(customAmountModalTicket.id, customAmountVal > 0 ? customAmountVal : null)}
                className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 sm:py-2 rounded-xl transition-colors shadow-sm text-center"
              >
                Save Custom Amount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIGH-SECURITY MULTI-STEP CONFIRMATION MODAL (SOFT & PERMANENT DELETE) */}
      {deletingGroup && (() => {
        const isSoft = deleteMode === 'soft';
        const requiredPhrase = `DELETE ${deletingGroup.name}`;
        const isPhraseMatched = 
          deletePhraseInput.trim().toUpperCase() === requiredPhrase.toUpperCase() ||
          deletePhraseInput.trim().toUpperCase() === 'DELETE' ||
          deletePhraseInput.trim().toLowerCase() === deletingGroup.name.toLowerCase();

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
            <div className={`bg-white border-2 rounded-2xl p-4 sm:p-6 w-full max-w-lg space-y-4 shadow-2xl relative max-h-[90dvh] overflow-y-auto my-auto ${
              isSoft ? 'border-amber-200' : 'border-red-200'
            }`}>
              
              {/* Header */}
              <div className={`flex justify-between items-start border-b pb-3 ${
                isSoft ? 'border-amber-100' : 'border-red-100'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    isSoft ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold ${
                      isSoft ? 'text-amber-950' : 'text-red-900'
                    }`}>
                      {isSoft ? 'Move Chit Group to Recycle Bin' : 'Permanent Deletion Warning'}
                    </h4>
                    <p className={`text-xs font-semibold mt-0.5 ${
                      isSoft ? 'text-amber-700' : 'text-red-700'
                    }`}>
                      &quot;{deletingGroup.name}&quot; ({formatCurrency(deletingGroup.totalValue)})
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setDeletingGroup(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Warning Description Box */}
              {isSoft ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs text-amber-900">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertCircle size={14} className="text-amber-600 shrink-0" />
                    This group will be moved to the Recycle Bin.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 pl-1">
                    <li>The group will be hidden from active lists and dashboard calculations.</li>
                    <li>All subscriber assignments, tickets, and logs remain safely preserved.</li>
                    <li>You can restore this group back to active status at any time from the Recycle Bin tab.</li>
                  </ul>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-2 text-xs text-red-900">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-red-600 shrink-0" />
                    This action is permanent and completely irreversible!
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-red-800 pl-1">
                    <li>All {deletingGroup.duration} enrolled subscriber tickets will be unlinked.</li>
                    <li>All historical auction bidding logs and discount pool records will be purged.</li>
                    <li>The group configuration will be permanently removed from Supabase.</li>
                  </ul>
                </div>
              )}

              {/* Safety Verification Step 1: Type Required Phrase */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] text-gray-700 font-bold block">
                  Step 1: Type <span className={`font-mono px-1.5 py-0.5 rounded select-all font-bold ${
                    isSoft ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  }`}>DELETE {deletingGroup.name}</span> (or <span className={`font-mono px-1.5 py-0.5 rounded font-bold ${
                    isSoft ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  }`}>DELETE</span>) below:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`Type DELETE ${deletingGroup.name}`}
                    value={deletePhraseInput}
                    onChange={(e) => setDeletePhraseInput(e.target.value)}
                    className={`w-full bg-gray-50 border rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none transition-colors ${
                      isPhraseMatched
                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900'
                        : isSoft ? 'border-gray-300 focus:border-amber-400' : 'border-gray-300 focus:border-red-400'
                    }`}
                    autoFocus
                  />
                  {isPhraseMatched && (
                    <span className="absolute right-3 top-2 text-emerald-600 text-xs font-bold flex items-center gap-1">
                      <Check size={14} /> Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Safety Verification Step 2: Slide to Confirm Slider */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-gray-700 flex items-center gap-1.5">
                    {isPhraseMatched ? (
                      <Unlock size={13} className="text-emerald-600" />
                    ) : (
                      <Lock size={13} className="text-gray-400" />
                    )}
                    Step 2: {isSoft ? 'Slide to move to Recycle Bin' : 'Slide to confirm permanent deletion'}
                  </span>
                  {isPhraseMatched && (
                    <span className="text-[10px] font-bold text-emerald-600">
                      Unlocked
                    </span>
                  )}
                </div>

                <SlideToConfirm
                  disabled={!isPhraseMatched || isDeletingGroup}
                  onConfirm={handleConfirmDelete}
                  label={isSoft ? "Slide to move to Recycle Bin" : "Slide to confirm deletion"}
                  confirmedLabel={isSoft ? "Moving to Recycle Bin..." : "Confirmed! Deleting Group..."}
                  loadingLabel={isSoft ? "Updating Supabase..." : "Purging from Supabase..."}
                  isLoading={isDeletingGroup}
                  colorVariant={isSoft ? "amber" : "red"}
                />

                <p className="text-[10px] text-gray-400 text-center">
                  {!isPhraseMatched
                    ? '🔒 Complete Step 1 above to unlock the confirmation slider'
                    : isSoft ? '👉 Drag the circular button to the right to move to Recycle Bin' : '👉 Drag the circular button to the right to confirm deletion'}
                </p>
              </div>

              {/* Action Controls Footer */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setDeletingGroup(null)}
                  className="w-full sm:w-auto border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 sm:py-2 rounded-xl transition-colors text-center"
                >
                  Cancel &amp; Keep Group
                </button>
                <button
                  type="button"
                  disabled={!isPhraseMatched || isDeletingGroup}
                  onClick={handleConfirmDelete}
                  className={`w-full sm:w-auto font-bold text-xs px-5 py-2.5 sm:py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 text-center ${
                    isPhraseMatched && !isDeletingGroup
                      ? isSoft
                        ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                        : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isDeletingGroup ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> {isSoft ? 'Moving to Bin...' : 'Purging from Supabase...'}
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} /> {isSoft ? 'Move to Recycle Bin' : 'Delete Group Permanently'}
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Global Auction Schedule Configuration Modal (accessible across Chits directory, Dashboard, and Workspace) */}
      {scheduleModalGroup && (
        <AuctionScheduleModal
          isOpen={!!scheduleModalGroup}
          onClose={() => setScheduleModalGroup(null)}
          groupId={scheduleModalGroup.id}
          groupName={scheduleModalGroup.name}
          currentMonth={scheduleModalGroup.currentMonth}
          startDate={scheduleModalGroup.startDate}
          auctionDayOfMonth={scheduleModalGroup.auctionDayOfMonth}
          auctionTime={scheduleModalGroup.auctionTime}
          nextAuctionDate={scheduleModalGroup.nextAuctionDate}
          nextAuctionTime={scheduleModalGroup.nextAuctionTime}
          onScheduleUpdated={(updated) => {
            setLocalGroups(prev =>
              prev.map(g =>
                g.id === scheduleModalGroup.id
                  ? {
                      ...g,
                      auctionDayOfMonth: updated.auctionDayOfMonth,
                      auctionTime: updated.auctionTime,
                      nextAuctionDate: updated.nextAuctionDate,
                      nextAuctionTime: updated.nextAuctionTime,
                    }
                  : g
              )
            );
            setScheduleModalGroup(null);
          }}
        />
      )}

      {/* Global Create / Register Subscriber Modal Popup */}
      {showCreateMemberModal && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 w-full max-w-md space-y-4 shadow-2xl relative max-h-[90dvh] overflow-y-auto my-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Register New Subscriber</h4>
                  <p className="text-[11px] text-gray-500">Saves to Supabase directory and assigns to open slot</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCreateMemberModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAndAssignMember} className="space-y-4">
              {/* Subscriber Name Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                  Subscriber Full Name *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    <User size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Similar / Fuzzy Name Suggestion (e.g. Kishor vs Kishore) */}
                {similarNameSubscriber && (
                  <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-blue-900 animate-in fade-in duration-200">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>💡</span>
                        <span>Similar subscriber found in directory</span>
                      </div>
                      <p className="text-[11px] text-blue-700">
                        Did you mean <strong>{similarNameSubscriber.name}</strong> ({similarNameSubscriber.phone})?
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateMemberModal(false);
                        if (editingGroup) {
                          const firstEmpty = editGroupMembers.find(m => !m.profileId);
                          if (firstEmpty) {
                            handleReassignTicketMember(firstEmpty.ticket, firstEmpty.id, similarNameSubscriber.id!, similarNameSubscriber.name, similarNameSubscriber.phone);
                          }
                        } else {
                          handleAssignExistingMember(similarNameSubscriber);
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shrink-0 transition-colors shadow-sm self-start sm:self-auto"
                    >
                      Assign {similarNameSubscriber.name} →
                    </button>
                  </div>
                )}
              </div>

              {/* Phone Number Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                    Phone Number (10 Digits) *
                  </label>
                  {newMemberPhone.trim() && (
                    <span className={`text-[10px] font-bold ${
                      normalizePhone(newMemberPhone).length === 10
                        ? 'text-emerald-600'
                        : normalizePhone(newMemberPhone).length < 10
                          ? 'text-amber-600'
                          : 'text-rose-600'
                    }`}>
                      {normalizePhone(newMemberPhone).length === 10
                        ? '✓ Valid 10 digits'
                        : `${normalizePhone(newMemberPhone).length}/10 digits`}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    <Phone size={14} />
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9842235740"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    className={`w-full bg-gray-50 border rounded-lg pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none transition-colors font-mono ${
                      duplicatePhoneSubscriber
                        ? 'border-amber-400 focus:border-amber-500 bg-amber-50/30'
                        : !newMemberPhone.trim()
                          ? 'border-gray-200 focus:border-indigo-500'
                          : normalizePhone(newMemberPhone).length === 10
                            ? 'border-emerald-400 focus:border-emerald-500 bg-emerald-50/20'
                            : 'border-amber-400 focus:border-amber-500 bg-amber-50/20'
                    }`}
                  />
                </div>
                {newMemberPhone.trim() && normalizePhone(newMemberPhone).length !== 10 && (
                  <p className="text-[10px] text-amber-600 font-medium">
                    ⚠️ Phone number must be exactly 10 digits ({normalizePhone(newMemberPhone).length > 10 ? `${normalizePhone(newMemberPhone).length - 10} digits too many` : `${10 - normalizePhone(newMemberPhone).length} digits remaining`})
                  </p>
                )}
                <p className="text-[10px] text-gray-400">Used for WhatsApp auction broadcasts &amp; collection alerts</p>

                {/* Duplicate Phone Warning Alert */}
                {duplicatePhoneSubscriber && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2.5 text-xs animate-in fade-in duration-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-900 block">Phone number already registered</span>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          This phone number is already registered to <strong>{duplicatePhoneSubscriber.name}</strong> ({duplicatePhoneSubscriber.phone}).
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateMemberModal(false);
                        if (editingGroup) {
                          const firstEmpty = editGroupMembers.find(m => !m.profileId);
                          if (firstEmpty) {
                            handleReassignTicketMember(firstEmpty.ticket, firstEmpty.id, duplicatePhoneSubscriber.id!, duplicatePhoneSubscriber.name, duplicatePhoneSubscriber.phone);
                          }
                        } else {
                          handleAssignExistingMember(duplicatePhoneSubscriber);
                        }
                      }}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <UserPlus size={13} /> Assign {duplicatePhoneSubscriber.name} to Open Slot Instead →
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateMemberModal(false)}
                  className="w-full sm:w-auto border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 sm:py-2 rounded-xl transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingMember || !newMemberName.trim() || !newMemberPhone.trim() || duplicatePhoneSubscriber !== null}
                  className={`w-full sm:w-auto font-bold text-xs px-5 py-2.5 sm:py-2 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5 text-center ${
                    duplicatePhoneSubscriber !== null
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
                  }`}
                >
                  {isCreatingMember ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Saving...
                    </>
                  ) : duplicatePhoneSubscriber ? (
                    <>
                      <AlertCircle size={14} /> Phone Already In Use
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Register &amp; Enroll
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Disburse Winner Prize Payout Modal ────────────────────────────────────── */}
      {showDisbursePayoutModal && (() => {
        const activeGroup = localGroups.find(g => g.id === activeDashboardGroupId) || localGroups[0];
        const totalDuration = activeGroup?.duration || activeGroup?.memberCount || 20;
        const totalChitVal = activeGroup?.totalValue || 200000;
        const currentMonthAuction = dashboardAuctionLogs.find(l => Number(l.month) === Number(selectedDashboardMonth));
        const winningBid = currentMonthAuction ? Number(currentMonthAuction.winning_discount ?? currentMonthAuction.winning_bid ?? 0) : 0;
        const netPrizePot = currentMonthAuction ? Math.max(0, totalChitVal - winningBid) : 0;
        const winnerProfileId = currentMonthAuction?.winning_bidder_id || currentMonthAuction?.winner_profile_id || currentMonthAuction?.winner_id;
        const winnerMember = dashboardGroupMembers.find(m => 
          (winnerProfileId && (m.profileId === winnerProfileId || m.id === winnerProfileId)) ||
          (currentMonthAuction?.winner_name && m.name.toLowerCase() === currentMonthAuction.winner_name.toLowerCase())
        );
        const winnerName = winnerMember?.name || currentMonthAuction?.winner_name || currentMonthAuction?.winning_bidder?.full_name || 'Subscriber';
        const winnerPhone = winnerMember?.phone || currentMonthAuction?.winner_phone || currentMonthAuction?.winning_bidder?.phone_number || '';
        const winnerInst = Number(winnerMember?.customInstallment || Math.round(totalChitVal / totalDuration));

        // Robust Winner monthly payment calculation helper
        const getWinnerPaidForMonth = (mNum: number) => {
          return dashboardTransactions
            .filter(t => {
              if (t.type !== 'collection') return false;
              const matchesMember = (
                (winnerMember?.profileId && t.profile_id === winnerMember.profileId) ||
                (winnerMember?.id && t.group_member_id === winnerMember.id) ||
                (currentMonthAuction?.winner_name && t.notes && t.notes.toLowerCase().includes(currentMonthAuction.winner_name.toLowerCase()))
              );
              if (!matchesMember) return false;
              if (!t.notes) return Number(mNum) === Number(activeGroup?.currentMonth || 0);
              const match = t.notes.match(/\bMonth\s+(\d+)\b/i);
              if (match) {
                return Number(match[1]) === Number(mNum);
              }
              return Number(mNum) === Number(activeGroup?.currentMonth || 0);
            })
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        };

        const isLaabaMonth = (activeGroup?.kaiIruppuPool || activeGroup?.kai_iruppu_pool || 0) >= totalChitVal && selectedDashboardMonth > 0;
        const currentExpectedDue = isLaabaMonth ? 0 : winnerInst;
        const currentMonthPaid = getWinnerPaidForMonth(selectedDashboardMonth);
        const currentMonthUnpaid = Math.max(0, currentExpectedDue - currentMonthPaid);

        // Past Arrears calculation (Months 0 to selectedDashboardMonth - 1)
        const arrearCandidates: { month: number; unpaid: number; expected: number; paid: number }[] = [];
        for (let m = 0; m < selectedDashboardMonth; m++) {
          const paid = getWinnerPaidForMonth(m);
          const exp = (activeGroup?.kaiIruppuPool || activeGroup?.kai_iruppu_pool || 0) >= totalChitVal && m > 0 ? 0 : winnerInst;
          const unpaid = Math.max(0, exp - paid);
          arrearCandidates.push({ month: m, unpaid, expected: exp, paid });
        }
        const unpaidArrears = arrearCandidates.filter(a => a.unpaid > 0);

        // Advance Candidate Months (Next up to 4 months)
        const advanceCandidates: number[] = [];
        for (let m = selectedDashboardMonth + 1; m <= Math.min(selectedDashboardMonth + 4, totalDuration - 1); m++) {
          advanceCandidates.push(m);
        }

        // Active Deductions List
        const activeDeductionsList: { month: number; amount: number; label: string }[] = [];
        if (disburseDeductThisMonth && currentMonthUnpaid > 0) {
          activeDeductionsList.push({
            month: selectedDashboardMonth,
            amount: currentMonthUnpaid,
            label: `Month ${selectedDashboardMonth} Installment`,
          });
        }
        disburseDeductArrearMonths.forEach(m => {
          const paid = getWinnerPaidForMonth(m);
          const exp = (activeGroup?.kaiIruppuPool || activeGroup?.kai_iruppu_pool || 0) >= totalChitVal && m > 0 ? 0 : winnerInst;
          const unpaid = Math.max(0, exp - paid);
          if (unpaid > 0) {
            activeDeductionsList.push({
              month: m,
              amount: unpaid,
              label: `Month ${m} Arrear`,
            });
          }
        });
        disburseDeductAdvanceMonths.forEach(m => {
          const paid = getWinnerPaidForMonth(m);
          const exp = winnerInst;
          const unpaid = Math.max(0, exp - paid);
          const amt = unpaid > 0 ? unpaid : winnerInst;
          activeDeductionsList.push({
            month: m,
            amount: amt,
            label: `Month ${m} Advance`,
          });
        });

        const totalDeductionsAmount = activeDeductionsList.reduce((sum, d) => sum + d.amount, 0);

        const monthPattern = new RegExp(`\\bMonth\\s+${selectedDashboardMonth}\\b|\\bM${selectedDashboardMonth}\\b|\\bM\\s*${selectedDashboardMonth}\\b`, 'i');
        const monthPayoutTxs = dashboardTransactions.filter(t =>
          t.type === 'payout' && (
            (t.notes && monthPattern.test(t.notes)) ||
            (winnerProfileId && (t.profile_id === winnerProfileId || t.group_member_id === winnerProfileId)) ||
            (winnerMember && (t.group_member_id === winnerMember.id || t.profile_id === winnerMember.profileId))
          )
        );
        const totalPrizeDisbursed = monthPayoutTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const remainingPrizeDue = Math.max(0, netPrizePot - totalPrizeDisbursed);
        const amountNum = Number(disbursePayoutAmount) || 0;

        // Interactive deduction toggle handlers that automatically synchronize net cash amount
        const toggleThisMonthDeduction = () => {
          const nextVal = !disburseDeductThisMonth;
          setDisburseDeductThisMonth(nextVal);
          const otherDeductions = (
            disburseDeductArrearMonths.reduce((sum, m) => sum + Math.max(0, winnerInst - getWinnerPaidForMonth(m)), 0) +
            disburseDeductAdvanceMonths.reduce((sum, m) => {
              const u = Math.max(0, winnerInst - getWinnerPaidForMonth(m));
              return sum + (u > 0 ? u : winnerInst);
            }, 0)
          );
          const thisMonthAmt = nextVal ? currentMonthUnpaid : 0;
          const newNet = Math.max(0, remainingPrizeDue - (otherDeductions + thisMonthAmt));
          setDisbursePayoutAmount(newNet.toString());
        };

        const toggleArrearMonth = (m: number) => {
          const nextList = disburseDeductArrearMonths.includes(m)
            ? disburseDeductArrearMonths.filter(x => x !== m)
            : [...disburseDeductArrearMonths, m];
          setDisburseDeductArrearMonths(nextList);

          const thisMonthAmt = disburseDeductThisMonth ? currentMonthUnpaid : 0;
          const arrearAmt = nextList.reduce((sum, x) => sum + Math.max(0, winnerInst - getWinnerPaidForMonth(x)), 0);
          const advanceAmt = disburseDeductAdvanceMonths.reduce((sum, x) => {
            const u = Math.max(0, winnerInst - getWinnerPaidForMonth(x));
            return sum + (u > 0 ? u : winnerInst);
          }, 0);
          const newNet = Math.max(0, remainingPrizeDue - (thisMonthAmt + arrearAmt + advanceAmt));
          setDisbursePayoutAmount(newNet.toString());
        };

        const toggleAdvanceMonth = (m: number) => {
          const nextList = disburseDeductAdvanceMonths.includes(m)
            ? disburseDeductAdvanceMonths.filter(x => x !== m)
            : [...disburseDeductAdvanceMonths, m];
          setDisburseDeductAdvanceMonths(nextList);

          const thisMonthAmt = disburseDeductThisMonth ? currentMonthUnpaid : 0;
          const arrearAmt = disburseDeductArrearMonths.reduce((sum, x) => sum + Math.max(0, winnerInst - getWinnerPaidForMonth(x)), 0);
          const advanceAmt = nextList.reduce((sum, x) => {
            const u = Math.max(0, winnerInst - getWinnerPaidForMonth(x));
            return sum + (u > 0 ? u : winnerInst);
          }, 0);
          const newNet = Math.max(0, remainingPrizeDue - (thisMonthAmt + arrearAmt + advanceAmt));
          setDisbursePayoutAmount(newNet.toString());
        };

        const walletOptions: { id: WalletType; label: string; icon: string; bal: number }[] = [
          { id: 'dad_bank', label: "Dad's Bank", icon: '🏦', bal: balances.dad_bank },
          { id: 'cash_in_hand', label: 'Cash in Hand', icon: '💵', bal: balances.cash_in_hand },
          { id: 'kishor_bank', label: "Kishor UPI", icon: '📱', bal: balances.kishor_bank },
          { id: 'mom_bank', label: "Mom's Bank", icon: '🏛️', bal: balances.mom_bank },
        ];

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
            <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 w-full max-w-lg space-y-3.5 shadow-2xl my-auto animate-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
                    <Banknote size={19} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight leading-tight">
                      Disburse Prize Payout
                    </h4>
                    <p className="text-[11px] text-gray-500 font-medium truncate">
                      {activeGroup?.name} · M{selectedDashboardMonth} Winner: <strong className="text-gray-900">{winnerName}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDisbursePayoutModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center shrink-0 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Pot Summary Pill */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Gross Prize Pot</span>
                  <span className="text-base sm:text-lg font-extrabold text-gray-900 font-mono">{formatCurrency(netPrizePot)}</span>
                  <span className="text-[10px] text-gray-500 block">
                    (₹{totalChitVal.toLocaleString('en-IN')} − ₹{winningBid.toLocaleString('en-IN')} bid)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Remaining Due</span>
                  <span className={`text-base sm:text-lg font-extrabold font-mono ${remainingPrizeDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {formatCurrency(remainingPrizeDue)}
                  </span>
                  {totalPrizeDisbursed > 0 && (
                    <span className="text-[10px] text-emerald-700 font-bold block">
                      ✓ {formatCurrency(totalPrizeDisbursed)} already paid
                    </span>
                  )}
                </div>
              </div>

              {/* ── Net Settlement Offsets Section ── */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 size={14} className="text-indigo-600 shrink-0" />
                    <span className="text-xs font-bold text-gray-900 truncate">
                      Installment Offsets (Optional)
                    </span>
                  </div>
                  {totalDeductionsAmount > 0 && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md shrink-0">
                      − {formatCurrency(totalDeductionsAmount)} offset
                    </span>
                  )}
                </div>

                {/* 1. Past Pending Balances / Arrears Status */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                    1. Past Pending Balances / Arrears
                  </span>
                  {unpaidArrears.length > 0 ? (
                    <div className="space-y-1.5">
                      {unpaidArrears.map(a => {
                        const isChecked = disburseDeductArrearMonths.includes(a.month);
                        return (
                          <button
                            key={a.month}
                            type="button"
                            onClick={() => toggleArrearMonth(a.month)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                              isChecked
                                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/40'
                                : 'bg-white border-amber-200/80 hover:bg-amber-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                isChecked ? 'bg-amber-600 border-amber-700 text-white' : 'bg-white border-amber-300'
                              }`}>
                                {isChecked && <Check size={11} className="stroke-[3]" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-amber-950 truncate">
                                  Deduct Month {a.month} Past Arrear
                                </div>
                                <span className="text-[10px] text-amber-800">
                                  Owes {formatCurrency(a.unpaid)} from M{a.month}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-extrabold text-rose-600 font-mono shrink-0">
                              −{formatCurrency(a.unpaid)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-2.5 py-1.5 text-emerald-800 text-xs font-medium">
                      <span className="flex items-center gap-1.5 truncate">
                        <Check size={13} className="text-emerald-600 shrink-0" />
                        <span>No Past Arrears Pending</span>
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0 font-mono">
                        ₹0 Due
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Current Month Installment Deduction Toggle */}
                <div className="space-y-1 pt-1 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                    2. Current Month Installment (Month {selectedDashboardMonth})
                  </span>
                  {currentMonthUnpaid > 0 ? (
                    <button
                      type="button"
                      onClick={toggleThisMonthDeduction}
                      className={`w-full flex items-center justify-between p-2 sm:p-2.5 rounded-xl border text-left transition-all ${
                        disburseDeductThisMonth
                          ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-400/40'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                          disburseDeductThisMonth ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-gray-300'
                        }`}>
                          {disburseDeductThisMonth && <Check size={12} className="stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                            <span>Deduct Month {selectedDashboardMonth} Due</span>
                            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.2 rounded">
                              Mark PAID 🟢
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500 block">
                            Current due: {formatCurrency(currentMonthUnpaid)}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-rose-600 font-mono shrink-0">
                        −{formatCurrency(currentMonthUnpaid)}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200 rounded-xl px-2.5 py-1.5 text-emerald-800 text-xs font-medium">
                      <span className="flex items-center gap-1.5 truncate">
                        <Check size={13} className="text-emerald-600 shrink-0" />
                        <span>Month {selectedDashboardMonth} Due Already Paid</span>
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0 font-mono">
                        {formatCurrency(currentMonthPaid)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Pre-pay Advance Upcoming Months (Clean 2-Column Grid) */}
                {advanceCandidates.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">
                      3. Pre-pay Advance Months (Optional)
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {advanceCandidates.map(m => {
                        const isSelected = disburseDeductAdvanceMonths.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => toggleAdvanceMonth(m)}
                            className={`w-full py-2 px-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-400/30'
                                : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isSelected ? 'bg-white text-indigo-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {isSelected ? '✓' : '+'}
                            </span>
                            <span>Month {m}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Calculation Summary Footer Pill */}
                {totalDeductionsAmount > 0 && (
                  <div className="bg-white border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between text-xs font-medium">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-gray-500 block">Gross Prize: {formatCurrency(netPrizePot)}</span>
                      <span className="text-[11px] text-rose-600 font-semibold block">Deductions Offset: −{formatCurrency(totalDeductionsAmount)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Net Cash Paid</span>
                      <span className="text-sm font-extrabold text-indigo-900 font-mono">
                        = {formatCurrency(Math.max(0, remainingPrizeDue - totalDeductionsAmount))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={(e) => handleRecordPrizePayoutSubmit(e, activeGroup, currentMonthAuction, netPrizePot, remainingPrizeDue, activeDeductionsList)} className="space-y-3">
                {/* Net Cash Handed Over Input */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider truncate">
                      Net Cash Payout (₹)
                    </label>
                    <span className="text-[10px] sm:text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md shrink-0">
                      Due: {formatCurrency(Math.max(0, remainingPrizeDue - totalDeductionsAmount))}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      max={totalChitVal * 2}
                      value={disbursePayoutAmount}
                      onChange={(e) => setDisbursePayoutAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 focus:bg-white rounded-2xl text-2xl font-extrabold text-gray-900 focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Source Wallet Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                    Paid From Which Vault / Bank?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {walletOptions.map(w => {
                      const isSelected = disbursePayoutWallet === w.id;
                      const isLowBal = w.bal < amountNum && amountNum > 0;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setDisbursePayoutWallet(w.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-500/20'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">{w.icon}</span>
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-emerald-700 text-white' : isLowBal ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {formatCurrency(w.bal)}
                            </span>
                          </div>
                          <div className="text-xs font-bold truncate">{w.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Disbursal Date Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                    Payment Date
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDisbursePayoutDateType('today')}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        disbursePayoutDateType === 'today'
                          ? 'bg-gray-900 text-white border-black shadow-xs'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisbursePayoutDateType('yesterday')}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        disbursePayoutDateType === 'yesterday'
                          ? 'bg-gray-900 text-white border-black shadow-xs'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisbursePayoutDateType('custom')}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        disbursePayoutDateType === 'custom'
                          ? 'bg-gray-900 text-white border-black shadow-xs'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      Custom Date
                    </button>
                  </div>
                  {disbursePayoutDateType === 'custom' && (
                    <input
                      type="date"
                      value={disbursePayoutCustomDate}
                      onChange={(e) => setDisbursePayoutCustomDate(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-indigo-500"
                    />
                  )}
                </div>

                {/* Reference Note & Receipt Upload */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                      Reference Note / Cheque No. (Optional)
                    </label>
                    <input
                      type="text"
                      value={disbursePayoutNote}
                      onChange={(e) => setDisbursePayoutNote(e.target.value)}
                      placeholder="e.g. Cheque #492019 or IMPS Ref #81920"
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none"
                    />
                  </div>

                  {/* Receipt Photo Attachment */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Paperclip size={13} className="text-gray-400" />
                        Attach Receipt / Cheque Photo (Optional)
                      </span>
                      {disbursePayoutReceiptUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setDisbursePayoutReceiptUrl('');
                            setDisburseReceiptFileToUpload(null);
                          }}
                          className="text-rose-600 hover:text-rose-700 text-[10px] font-bold"
                        >
                          Remove Photo
                        </button>
                      )}
                    </label>
                    {disbursePayoutReceiptUrl ? (
                      <div className="relative w-full h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                        <img src={disbursePayoutReceiptUrl} alt="Receipt preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-xl p-2.5 flex items-center justify-center gap-2 cursor-pointer bg-gray-50/50 transition-colors">
                        <Paperclip size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-500 font-semibold">Tap to attach cheque / transfer screenshot</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDisburseReceiptUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowDisbursePayoutModal(false)}
                    className="w-full sm:flex-1 py-3 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-colors text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingDisbursal || (amountNum <= 0 && totalDeductionsAmount <= 0)}
                    className="w-full sm:flex-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95 text-center"
                  >
                    {isProcessingDisbursal ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Recording Disbursal...
                      </>
                    ) : (
                      <>
                        <Banknote size={15} /> Disburse {formatCurrency(amountNum)}
                        {totalDeductionsAmount > 0 ? ` (+ Settle ${formatCurrency(totalDeductionsAmount)})` : ''}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── Remind All Modal (ChitBase Feature) ─────────────────────────────────── */}
      {showRemindModal && (() => {
        const activeGroup = localGroups.find(g => g.id === activeDashboardGroupId) || localGroups[0];
        const isLaaba = (activeGroup?.kaiIruppuPool || 0) >= (activeGroup?.totalValue || 200000);
        const totalChitVal = activeGroup?.totalValue || 200000;
        const totalDuration = activeGroup?.duration || activeGroup?.memberCount || 20;
        const baseInstallment = Math.round(totalChitVal / (activeGroup?.memberCount || totalDuration || 1));
        const defaultDue = isLaaba ? 0 : baseInstallment;

        // Compute pending members list
        const pendingMembersList = dashboardGroupMembers
          .map(member => {
            const effectiveDue = isLaaba ? 0 : (member.customInstallment !== null && member.customInstallment !== undefined ? member.customInstallment : defaultDue);
            const paid = getMemberPaidAmountForMonth(member.profileId || member.id, selectedDashboardMonth);
            const remaining = Math.max(0, effectiveDue - paid);
            return {
              ...member,
              effectiveDue,
              paid,
              remaining,
            };
          })
          .filter(m => m.remaining > 0);

        const groupBroadcastMsg = generateGroupBroadcastText(pendingMembersList, activeGroup, selectedDashboardMonth);

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-md sm:max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto my-auto">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                    Remind All
                  </h3>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">
                    {pendingMembersList.length} pending {pendingMembersList.length === 1 ? 'member' : 'members'} · Month {selectedDashboardMonth}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRemindModal(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Segmented Tab Switcher (Group Message vs Individual) */}
              <div className="bg-gray-100/90 p-1 rounded-2xl flex gap-1">
                <button
                  type="button"
                  onClick={() => setRemindModalTab('group')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    remindModalTab === 'group'
                      ? 'bg-white text-gray-900 shadow-2xs font-extrabold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Group Message
                </button>
                <button
                  type="button"
                  onClick={() => setRemindModalTab('individual')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    remindModalTab === 'individual'
                      ? 'bg-white text-gray-900 shadow-2xs font-extrabold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Individual
                </button>
              </div>

              {/* Description Sub-note */}
              <p className="text-xs text-gray-500 leading-relaxed">
                {remindModalTab === 'individual'
                  ? "Members with a saved number get a direct WhatsApp link. Add a number for others. It's saved to their profile permanently."
                  : `Compile a single broadcast reminder containing all ${pendingMembersList.length} pending members to paste into your WhatsApp group.`}
              </p>

              {/* Tab 1: Individual Reminders */}
              {remindModalTab === 'individual' && (
                <div className="space-y-3 pt-1">
                  {pendingMembersList.length === 0 ? (
                    <div className="py-8 text-center bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-1.5">
                      <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-900">All members have paid for Month {selectedDashboardMonth}!</p>
                      <p className="text-[11px] text-emerald-600">No pending dues to remind.</p>
                    </div>
                  ) : (
                    pendingMembersList.map((member) => {
                      const hasPhone = !!(member.phone && member.phone.trim().length >= 10);
                      const currentInputPhone = remindPhoneInputs[member.id] !== undefined ? remindPhoneInputs[member.id] : (member.phone || '');

                      return (
                        <div
                          key={member.id}
                          className="bg-white border border-gray-200/90 hover:border-gray-300 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all"
                        >
                          {/* Member Title & Pending Amount */}
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-extrabold text-xs sm:text-sm text-gray-900 leading-snug">
                                  {member.name}
                                </h4>
                                <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono">
                                  #{member.ticket}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-gray-500 mt-0.5">
                                <strong className="text-gray-900 font-extrabold">{formatCurrency(member.remaining)}</strong> pending
                              </p>
                            </div>

                            {hasPhone && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                <Phone size={10} /> Saved
                              </span>
                            )}
                          </div>

                          {/* Phone input & Send Button */}
                          <div className="flex items-center gap-2">
                            {hasPhone ? (
                              <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 min-w-0">
                                <Phone size={12} className="text-emerald-600 shrink-0" />
                                <span className="font-mono truncate">+91 {member.phone}</span>
                              </div>
                            ) : (
                              <input
                                type="tel"
                                placeholder="Add phone number"
                                value={currentInputPhone}
                                onChange={(e) =>
                                  setRemindPhoneInputs(prev => ({
                                    ...prev,
                                    [member.id]: e.target.value,
                                  }))
                                }
                                className="flex-1 px-3.5 py-2 bg-white border border-gray-300 focus:border-emerald-500 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none min-w-0"
                              />
                            )}

                            {hasPhone ? (
                              <a
                                href={generateMemberReminderWhatsAppUrl(member, member.remaining, activeGroup, selectedDashboardMonth)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#10B981] hover:bg-[#059669] text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 shrink-0"
                              >
                                <Send size={13} />
                                <span>Send</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSavePhoneAndSend(member, member.remaining, activeGroup, selectedDashboardMonth)}
                                disabled={savingMemberPhoneId === member.id}
                                className="bg-[#10B981] hover:bg-[#059669] text-white font-extrabold text-xs px-3.5 sm:px-4 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 shrink-0 disabled:opacity-50"
                              >
                                {savingMemberPhoneId === member.id ? (
                                  <RefreshCw size={13} className="animate-spin" />
                                ) : (
                                  <Check size={13} />
                                )}
                                <span>Save &amp; Send</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 2: Group Broadcast Message */}
              {remindModalTab === 'group' && (
                <div className="space-y-3 pt-1">
                  <div className="relative bg-gray-50 border border-gray-200 rounded-2xl p-3.5 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-700 border-b border-gray-200 pb-2">
                      <span className="flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-emerald-600" />
                        WhatsApp Group Broadcast Template
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {pendingMembersList.length} Subscribers
                      </span>
                    </div>

                    <pre className="text-xs font-sans text-gray-800 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto select-all bg-white p-3 rounded-xl border border-gray-200">
                      {groupBroadcastMsg}
                    </pre>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(groupBroadcastMsg);
                        setRemindCopied(true);
                        setTimeout(() => setRemindCopied(false), 2000);
                      }}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl border border-gray-200 transition-colors active:scale-95"
                    >
                      {remindCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{remindCopied ? 'Copied to Clipboard!' : 'Copy Message'}</span>
                    </button>

                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(groupBroadcastMsg)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white font-extrabold text-xs rounded-xl transition-all shadow-xs active:scale-95 text-center"
                    >
                      <Send size={14} />
                      <span>Share to Group</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── FLOATING ACTION BUTTON (FAB) & SPEED-DIAL MENU ──────────────────── */}
      {activeTab === 'dashboard' && (
        <>
          {/* Backdrop Blur Overlay when FAB is Open */}
          {isFabOpen && (
            <div
              onClick={() => setIsFabOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 animate-in fade-in duration-150"
            />
          )}

          <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2.5 select-none">
            {/* Speed Dial Menu Items */}
            {isFabOpen && (
              <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-3 duration-200">
                
                {/* 1. Quick Collect Payment (Primary Action) */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setIsFabOpen(false);
                    setShowQuickCollectModal(true);
                  }}
                  className="flex items-center gap-2.5 bg-white hover:bg-emerald-50 text-gray-900 border border-gray-200 px-4 py-2.5 rounded-2xl shadow-xl transition-all active:scale-95 group cursor-pointer"
                >
                  <span className="text-xs font-black tracking-tight text-gray-900">
                    Quick Collect Payment
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Coins size={16} />
                  </div>
                </button>

                {/* 2. Log Cash Spend / Personal Draw */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setIsFabOpen(false);
                    setShowQuickPersonalDrawModal(true);
                  }}
                  className="flex items-center gap-2.5 bg-white hover:bg-rose-50 text-gray-900 border border-gray-200 px-4 py-2.5 rounded-2xl shadow-xl transition-all active:scale-95 group cursor-pointer"
                >
                  <span className="text-xs font-black tracking-tight text-gray-900">
                    Log Cash Spend (Draw)
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <MinusCircle size={16} />
                  </div>
                </button>

                {/* 3. Send Dues Reminder */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setIsFabOpen(false);
                    setRemindModalTab('individual');
                    setShowRemindModal(true);
                  }}
                  className="flex items-center gap-2.5 bg-white hover:bg-emerald-50 text-gray-900 border border-gray-200 px-4 py-2.5 rounded-2xl shadow-xl transition-all active:scale-95 group cursor-pointer"
                >
                  <span className="text-xs font-black tracking-tight text-gray-900">
                    Send Dues Reminder
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Send size={15} />
                  </div>
                </button>

                {/* 4. ATM Cash Withdrawal */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setIsFabOpen(false);
                    setShowQuickAtmModal(true);
                  }}
                  className="flex items-center gap-2.5 bg-white hover:bg-indigo-50 text-gray-900 border border-gray-200 px-4 py-2.5 rounded-2xl shadow-xl transition-all active:scale-95 group cursor-pointer"
                >
                  <span className="text-xs font-black tracking-tight text-gray-900">
                    ATM Cash Withdrawal
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Landmark size={15} />
                  </div>
                </button>

              </div>
            )}

            {/* Main Primary FAB Trigger Button */}
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('light');
                setIsFabOpen(prev => !prev);
              }}
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 cursor-pointer ${
                isFabOpen
                  ? 'bg-gray-900 text-white rotate-45 ring-4 ring-gray-900/20'
                  : 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-white ring-4 ring-emerald-500/30 hover:scale-105 shadow-emerald-900/30'
              }`}
              title="Quick Actions &amp; Collect"
            >
              <Plus size={26} className={`stroke-[2.5] transition-transform duration-200 ${isFabOpen ? 'rotate-90' : ''}`} />
            </button>
          </div>
        </>
      )}

      {/* ── QUICK ACTION MODALS ──────────────────────────────────────────────── */}
      
      {/* 1. Quick Member Collect Modal (Search + Passbook QR Scanner) */}
      <QuickMemberCollectModal
        isOpen={showQuickCollectModal}
        onClose={() => setShowQuickCollectModal(false)}
        onSelectMember={handleQuickMemberSelected}
        activeGroupId={activeDashboardGroupId}
        activeMonth={selectedDashboardMonth}
      />

      {/* 2. Quick Personal Draw / Spend Modal */}
      <QuickPersonalDrawModal
        isOpen={showQuickPersonalDrawModal}
        onClose={() => setShowQuickPersonalDrawModal(false)}
        onSuccess={() => {
          if (activeDashboardGroupId) {
            fetchDashboardData(activeDashboardGroupId);
          }
        }}
      />

      {/* 3. Quick ATM Cash Withdrawal Modal */}
      <QuickAtmWithdrawalModal
        isOpen={showQuickAtmModal}
        onClose={() => setShowQuickAtmModal(false)}
        onSuccess={() => {
          if (activeDashboardGroupId) {
            fetchDashboardData(activeDashboardGroupId);
          }
        }}
      />

      {/* 4. Payment Checklist Printout Modal (A4 Single Page Format) */}
      {printChecklistGroup && (
        <PaymentChecklistPrintModal
          group={printChecklistGroup}
          onClose={() => setPrintChecklistGroup(null)}
        />
      )}
    </>
  );
}
