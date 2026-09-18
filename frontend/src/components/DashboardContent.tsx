import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { supabase } from '../utils/supabase/client';
import LiveAuctionEngine from './LiveAuctionEngine';
import CashVaultLedger from './CashVaultLedger';
import MemberMatrix from './MemberMatrix';
import CommunicationBroadcastCenter from './CommunicationBroadcastCenter';
import { 
  DollarSign, 
  Users, 
  Briefcase, 
  Calendar, 
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
  UserPlus,
  Phone,
  User,
  Trash2,
  ArrowLeft,
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
  Paperclip
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
}

export default function DashboardContent({ activeTab }: DashboardContentProps) {
  const { profile } = useAuth();
  const { balances, updateBalance } = useWallet();

  // Group Creation & Enrollment States
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupValue, setNewGroupValue] = useState('100000');
  const [newGroupDuration, setNewGroupDuration] = useState('5');
  const [newGroupStartDate, setNewGroupStartDate] = useState(new Date().toISOString().split('T')[0]);
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
  const [groupFilter, setGroupFilter] = useState<'all' | 'active' | 'draft' | 'completed'>('all');
  const [localGroups, setLocalGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

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

  // High-Security Delete Group Modal States
  const [deletingGroup, setDeletingGroup] = useState<any | null>(null);
  const [deletePhraseInput, setDeletePhraseInput] = useState('');
  const [deleteSliderVal, setDeleteSliderVal] = useState(0);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

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
              profileId: m.profile_id,
              splitPool: m.split_pool || null,
              customInstallment: m.custom_installment ? Number(m.custom_installment) : null,
              exitMonth: m.exit_month || null,
              transferredFrom: m.transferred_from || null,
              transferEffectiveMonth: m.transfer_effective_month || null,
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

  const handleToggleWorkspaceBookSync = async (memberId: string, currentSync: boolean) => {
    const nextSync = !currentSync;
    setWorkspaceMembers(prev => prev.map(m => m.id === memberId ? { ...m, bookSynced: nextSync } : m));

    try {
      await supabase
        .from('group_members')
        .update({ physical_book_synced: nextSync })
        .eq('id', memberId);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'group_members',
          desc: `UPDATE physical book sync state to [${nextSync ? 'YES' : 'NO'}] for ticket`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);
    } catch (err) {
      console.error('Error updating sync state:', err);
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
          splitPool: row?.split_pool || null,
          customInstallment: row?.custom_installment ? Number(row.custom_installment) : null,
          exitMonth: row?.exit_month || null,
          transferredFrom: row?.transferred_from || null,
          transferEffectiveMonth: row?.transfer_effective_month || null,
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
          current_month: editGroupCurrentMonth,
          status: editGroupStatus,
          start_date: editGroupStartDate || null,
        })
        .eq('id', editingGroup.id);

      if (groupError) {
        alert(`Failed to update group: ${groupError.message}`);
        return;
      }

      // 2. Update local state
      setLocalGroups(prev =>
        prev.map(g =>
          g.id === editingGroup.id
            ? {
                ...g,
                name: editGroupName.trim(),
                totalValue: valNum,
                duration: countNum,
                memberCount: countNum,
                currentMonth: editGroupCurrentMonth,
                status: editGroupStatus,
                startDate: editGroupStartDate,
                active: editGroupStatus !== 'completed',
              }
            : g
        )
      );

      // 3. Security audit log
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'chit_groups',
          desc: `UPDATED CHIT GROUP: "${editGroupName.trim()}" (Status: ${editGroupStatus.toUpperCase()}, Pool: ₹${valNum.toLocaleString('en-IN')}, Duration: ${countNum}M)`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      // 4. Refresh workspace members if on this group's workspace
      if (selectedWorkspaceGroupId === editingGroup.id) {
        fetchWorkspaceMembers(editingGroup.id);
      }

      setEditingGroup(null);
    } catch (err: any) {
      alert(`Error editing group: ${err.message}`);
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
            ? { ...m, id: assignedId, profileId: newProfileId, name: newName, phone: newPhone }
            : m
        )
      );

      if (selectedWorkspaceGroupId === editingGroup?.id) {
        setWorkspaceMembers(prev =>
          prev.map(m =>
            m.ticket === ticketNum
              ? { ...m, id: assignedId, profileId: newProfileId, name: newName, phone: newPhone }
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
      const { error } = await supabase
        .from('group_members')
        .update({ split_pool: payers.length > 0 ? payers : null })
        .eq('id', ticketId);

      if (error) {
        alert(`Failed to save split pool: ${error.message}`);
        return;
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
      const { error } = await supabase
        .from('group_members')
        .update({ exit_month: exitMonth })
        .eq('id', ticketId);

      if (error) {
        alert(`Failed to update member exit: ${error.message}`);
        return;
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
      const prevProfileId = currentTicket?.profileId;

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
      const { error } = await supabase
        .from('group_members')
        .update({ custom_installment: amount })
        .eq('id', ticketId);

      if (error) {
        alert(`Failed to save custom amount: ${error.message}`);
        return;
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
      if (!ticketRecordId.startsWith('unassigned-')) {
        const { error } = await supabase
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

        if (error) {
          alert(`Failed to unassign ticket: ${error.message}`);
          return;
        }
      }

      setEditGroupMembers(prev =>
        prev.map(m =>
          m.ticket === ticketNum
            ? { ...m, profileId: undefined, name: '', phone: '', splitPool: null, customInstallment: null, exitMonth: null }
            : m
        )
      );

      if (selectedWorkspaceGroupId === editingGroup?.id) {
        setWorkspaceMembers(prev =>
          prev.map(m =>
            m.ticket === ticketNum
              ? { ...m, profileId: undefined, name: '', phone: '', splitPool: null, customInstallment: null, exitMonth: null }
              : m
          )
        );
      }
    } catch (err: any) {
      alert(`Error unassigning ticket: ${err.message}`);
    }
  };


  const handleExecuteDeleteGroup = async () => {
    if (!deletingGroup) return;
    try {
      setIsDeletingGroup(true);

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

      // Audit log
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'chit_groups',
          desc: `PERMANENTLY DELETED CHIT GROUP: "${deletingGroup.name}" (Pool ₹${deletingGroup.totalValue?.toLocaleString('en-IN')}) with all enrolled tickets and logs`,
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
      alert(`✅ Chit Group "${deletingGroup.name}" has been permanently removed.`);
    } catch (err: any) {
      alert(`Error deleting group: ${err.message}`);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchProfiles();
  }, []);

  // Auction Date Reschedule Override State: { [groupId]: ISO date string }
  const [auctionDateOverrides, setAuctionDateOverrides] = useState<Record<string, string>>({});
  const [rescheduleGroupId, setRescheduleGroupId] = useState<string | null>(null);
  const [rescheduleInputVal, setRescheduleInputVal] = useState<string>('');

  // Compute canonical auction date for a group (uses today's month/year as calendar anchor or group.startDate)
  const getGroupAuctionDate = (groupId: string, monthNum: number = 1): { display: string; isOverride: boolean; isOrientation?: boolean } => {
    if (monthNum === 0) {
      return { display: 'Orientation Collection Session (No Auction)', isOverride: false, isOrientation: true };
    }
    if (auctionDateOverrides[groupId]) {
      const parts = auctionDateOverrides[groupId].split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return { display: formatAuctionDate(d) + ' (Override)', isOverride: true };
    }
    const group = localGroups.find(g => g.id === groupId);
    let baseDate = new Date();
    if (group?.startDate) {
      const parsed = new Date(group.startDate);
      if (!isNaN(parsed.getTime())) {
        baseDate = parsed;
      }
    }
    // M0 is baseDate + 0 (Launch/Orientation Month)
    // M1 is baseDate + 1 (1st Auction Month)
    // M2 is baseDate + 2, etc.
    const targetMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthNum, 1);
    const canonical = getFirstSundayOnOrAfter10th(targetMonthDate.getFullYear(), targetMonthDate.getMonth());
    return { display: formatAuctionDate(canonical), isOverride: false };
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
    if (localGroups.length > 0) {
      if (!activeDashboardGroupId || !localGroups.some(g => g.id === activeDashboardGroupId)) {
        const firstActive = localGroups.find(g => g.status === 'active') || localGroups[0];
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

      // 3. Fetch auction logs for this group
      const { data: logsData, error: logsError } = await supabase
        .from('auction_logs')
        .select('*')
        .eq('group_id', groupId)
        .order('month', { ascending: true });

      if (logsError) console.warn('Error fetching auction logs for dashboard:', logsError.message);
      if (logsData) {
        setDashboardAuctionLogs(logsData);
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
    return dashboardTransactions
      .filter(t => 
        t.type === 'collection' && 
        (t.profile_id === profileIdOrMemberId || t.group_member_id === profileIdOrMemberId) &&
        (t.notes?.includes(`Month ${month}`) || !t.notes)
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

  // 1-Tap Record Quick Payment Handler
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
      const defaultNote = `Month ${selectedDashboardMonth} collection payment - Ticket #${recordingPaymentMember.ticket} (${recordingPaymentMember.name})`;
      const finalNote = paymentNote.trim() ? `${defaultNote} — Note: ${paymentNote.trim()}` : defaultNote;

      // 2. Insert collection transaction (only tiny ~80 byte URL saved in database)
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          group_id: activeDashboardGroupId,
          profile_id: recordingPaymentMember.profileId || null,
          group_member_id: recordingPaymentMember.id || null,
          wallet_type: paymentWalletType,
          type: 'collection',
          status: 'completed',
          amount: amt,
          notes: finalNote,
          verification_proof_url: finalReceiptUrl,
          created_at: effectiveDateStr,
          created_by: profile?.id || null,
        });

      if (txErr) {
        alert('Failed to record payment in database: ' + txErr.message);
        return;
      }

      // 3. Increment global treasury balance for this wallet
      await updateBalance(paymentWalletType as any, amt);

      // 4. Update audit logs
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'transactions',
          desc: `COLLECTION: Received ₹${amt.toLocaleString('en-IN')} via ${paymentWalletType.replace(/_/g, ' ')} from ${recordingPaymentMember.name} (Ticket #${recordingPaymentMember.ticket}, Month ${selectedDashboardMonth})`,
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

  const handleAssignExistingMember = (member: { id?: string; name: string; phone: string }) => {
    const isAlreadyAdded = enrollments.some(e => e.name.toLowerCase() === member.name.toLowerCase());
    if (isAlreadyAdded) {
      alert(`"${member.name}" is already assigned to a ticket in this chit group.`);
      return;
    }
    const firstEmptyIndex = enrollments.findIndex(e => e.name === '');
    if (firstEmptyIndex !== -1) {
      setEnrollments(prev => {
        const copy = [...prev];
        copy[firstEmptyIndex] = member;
        return copy;
      });
      setMemberSearchQuery('');
      setIsSearchDropdownOpen(false);
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

      // Assign to the first empty spot in enrollments
      const firstEmptyIndex = enrollments.findIndex(e => e.name === '');
      if (firstEmptyIndex !== -1) {
        setEnrollments(prev => {
          const copy = [...prev];
          copy[firstEmptyIndex] = newSubscriber;
          return copy;
        });
      }

      // Add audit log
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setAuditLogs(prev => [
        {
          timestamp: `Today, ${timeStr}`,
          table: 'profiles',
          desc: `NEW SUBSCRIBER REGISTERED: "${cleanName}" (${cleanPhone}) — enrolled in Ticket #${firstEmptyIndex !== -1 ? firstEmptyIndex + 1 : 'N/A'}`,
          executor: profile?.fullName ? `${profile.fullName} (Admin)` : 'Admin',
        },
        ...prev,
      ]);

      // Reset modal state
      setNewMemberName('');
      setNewMemberPhone('');
      setMemberSearchQuery('');
      setIsSearchDropdownOpen(false);
      setShowCreateMemberModal(false);
    } catch (err: any) {
      alert(`Error creating member: ${err.message}`);
    } finally {
      setIsCreatingMember(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const { data: groupData, error: groupError } = await supabase.from('chit_groups').insert({
        name: newGroupName.trim(),
        total_value: Number(newGroupValue),
        member_count: duration,
        duration_months: duration,
        current_month: 0,
        kai_iruppu_pool: 0,
        status: groupStatus,
        start_date: newGroupStartDate,
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

      alert(`Success: Chit Group "${newGroupName}" created in Supabase (Status: ${groupStatus.toUpperCase()})!\n${filledCount} of ${duration} spots assigned.${!isFullyEnrolled ? ' You can assign the remaining slots anytime in the Chits tab.' : ''}`);
      await fetchGroups();

      // Reset form
      setNewGroupName('');
      setNewGroupValue('100000');
      setNewGroupDuration('5');
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

        // Compute dues, paid, status for each member
        const memberStats = dashboardGroupMembers.map(member => {
          const effectiveDue = isLaaba ? 0 : (member.customInstallment !== null && member.customInstallment !== undefined ? member.customInstallment : defaultDue);
          const paid = getMemberPaidAmountForMonth(member.profileId || member.id, selectedDashboardMonth);
          const remaining = Math.max(0, effectiveDue - paid);
          const status = remaining === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
          return {
            ...member,
            effectiveDue,
            paid,
            remaining,
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

        return (
          <div className="space-y-6">
            {/* Top Chit Groups Pill Switcher Bar */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 px-2 flex items-center gap-1.5">
                  <Briefcase size={13} className="text-indigo-600" />
                  Chits:
                </span>
                {localGroups.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">No chit groups found</span>
                ) : (
                  localGroups.map((group) => {
                    const isSelected = (activeGroup?.id === group.id);
                    return (
                      <button
                        key={group.id}
                        onClick={() => {
                          setActiveDashboardGroupId(group.id);
                          setSelectedDashboardMonth(group.currentMonth !== undefined && group.currentMonth !== null ? group.currentMonth : 0);
                        }}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm shadow-indigo-100 ring-2 ring-indigo-500/20'
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
                      </button>
                    );
                  })
                )}
              </div>

              {/* Action Button: Create New Group */}
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all shrink-0 shadow-sm"
              >
                <Plus size={14} />
                <span>New Group</span>
              </button>
            </div>

            {/* Horizontal Month Carousel Navigator */}
            {activeGroup && (
              <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedDashboardMonth(prev => Math.max(0, prev - 1))}
                  disabled={selectedDashboardMonth <= 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 px-1">
                  {monthsRange.map((mNum) => {
                    const isSelected = (selectedDashboardMonth === mNum);
                    const isOngoingCurrent = ((activeGroup.currentMonth ?? 0) === mNum);
                    const label = getDashboardMonthLabel(activeGroup, mNum);

                    return (
                      <button
                        key={mNum}
                        onClick={() => setSelectedDashboardMonth(mNum)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                          isSelected
                            ? mNum === 0
                              ? 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-500/20'
                              : 'bg-gray-900 text-white border-black shadow-sm ring-2 ring-gray-900/10'
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
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Collection Progress Hero Card */}
            {activeGroup && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm relative overflow-hidden space-y-5">
                <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
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
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Sparkles size={11} /> Laaba Seetu Active
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        {formatCurrency(actualCollectionsTotal)}
                      </span>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        COLLECTED
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Target: <strong className="text-gray-900 font-bold">{formatCurrency(targetCollectionsTotal)}</strong></span>
                      <span className="text-gray-300">•</span>
                      <span>Pending: <strong className="text-amber-600 font-bold">{formatCurrency(pendingCollectionsTotal)}</strong></span>
                    </div>
                  </div>

                  {/* Actions & Fraction Progress */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-center">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Paid Members</span>
                      <div className="text-sm font-extrabold text-gray-900 mt-0.5">
                        <span className="text-emerald-600">{paidList.length}</span> / {dashboardGroupMembers.length}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleMarkAllPaid}
                        disabled={isMarkingAllPaid || pendingList.length === 0}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <CheckCheck size={14} />
                        <span>{isMarkingAllPaid ? 'Recording...' : 'Mark All Paid'}</span>
                      </button>

                      {/* In-App Revert Active Month Button */}
                      {(activeGroup.currentMonth ?? 0) > 0 && (
                        <button
                          onClick={handleRevertMonth}
                          disabled={isClosingMonth}
                          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs px-3 py-2.5 rounded-xl transition-all shadow-sm border border-gray-200"
                          title={`Roll back active cycle to Month ${(activeGroup.currentMonth ?? 1) - 1}`}
                        >
                          <RotateCcw size={13} className="text-gray-500" />
                          <span>Revert to M{(activeGroup.currentMonth ?? 1) - 1}</span>
                        </button>
                      )}

                      {selectedDashboardMonth === 0 ? (
                        <button
                          onClick={handleCloseMonth}
                          disabled={isClosingMonth || selectedDashboardMonth !== (activeGroup.currentMonth ?? 0)}
                          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Rocket size={14} />
                          <span>{isClosingMonth ? 'Confirming...' : 'Confirm Launch & Roll to M1'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleCloseMonth}
                          disabled={isClosingMonth || selectedDashboardMonth !== (activeGroup.currentMonth ?? 0)}
                          className="flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <ArrowRight size={14} />
                          <span>{isClosingMonth ? 'Closing...' : 'Close Month'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Smooth Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-gray-200">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500 font-semibold">
                    <span>{completionPct}% Collected</span>
                    <span>{pendingList.length} members remaining</span>
                  </div>
                </div>

                {/* Bottom Winner / Cycle Pill */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Trophy size={14} />
                    </div>
                    <div>
                      {selectedDashboardMonth === 0 ? (
                        <div className="text-xs">
                          <span className="font-bold text-amber-900">Month 0: Launch Month — Organizer Profit Phase</span>
                          <span className="text-gray-600 ml-1.5">
                            (Full {formatCurrency(totalChitVal)} pot collected is allocated directly to the Organizer as Organizer Profit · No auction held)
                          </span>
                        </div>
                      ) : currentMonthAuction ? (
                        <div className="text-xs">
                          <span className="font-bold text-gray-900">
                            Won · {currentMonthAuction.winner_name || 'Subscriber'}
                          </span>
                          <span className="text-gray-500 ml-1.5">
                            (Winning Discount: <strong className="text-indigo-600">{formatCurrency(currentMonthAuction.winning_bid || 0)}</strong> · Net Payout: <strong className="text-emerald-600">{formatCurrency(totalChitVal - (currentMonthAuction.winning_bid || 0))}</strong>)
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600 flex items-center gap-1.5">
                          <span>Auction for Month {selectedDashboardMonth} has not been conducted yet.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Auction Date / Link */}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const { display, isOrientation } = getGroupAuctionDate(activeGroup.id, selectedDashboardMonth);
                      return (
                        <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                          <CalendarDays size={12} className={isOrientation ? "text-amber-600" : "text-indigo-600"} />
                          <span>{isOrientation ? 'Session:' : 'Auction:'} <strong className="text-gray-800">{display}</strong></span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* "Yet to Pay" Section (Pending Member Action Cards) */}
            {activeGroup && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Users size={16} className="text-indigo-600" />
                      <span>{pendingList.length} yet to pay</span>
                      <span className="text-xs font-normal text-gray-500">
                        ({partialCount} partial · {unpaidCount} unpaid)
                      </span>
                    </h3>
                  </div>
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                    Month {selectedDashboardMonth} Dues
                  </span>
                </div>

                {loadingDashboardData ? (
                  <div className="py-8 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-indigo-600" />
                    <span>Loading subscriber dues...</span>
                  </div>
                ) : pendingList.length === 0 ? (
                  <div className="py-8 text-center bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-800">All subscribers have paid for Month {selectedDashboardMonth}!</p>
                    <p className="text-[11px] text-emerald-600">Total collected: {formatCurrency(actualCollectionsTotal)}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pendingList.map((member) => {
                      const initial = member.name.charAt(0).toUpperCase() || 'S';
                      return (
                        <div
                          key={member.id}
                          className="bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                              {initial}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-900 text-xs truncate">{member.name}</span>
                                <span className="text-[10px] font-bold bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded font-mono">
                                  #{member.ticket}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px]">
                                {member.status === 'partial' ? (
                                  <span className="text-amber-700 font-bold bg-amber-100/70 border border-amber-200 px-1.5 py-0.2 rounded text-[9px] uppercase">
                                    Partial
                                  </span>
                                ) : (
                                  <span className="text-rose-700 font-bold bg-rose-100/70 border border-rose-200 px-1.5 py-0.2 rounded text-[9px] uppercase">
                                    Unpaid
                                  </span>
                                )}
                                <span className="text-gray-500">
                                  Due: <strong className="text-gray-900">{formatCurrency(member.remaining)}</strong>
                                </span>
                                {member.paid > 0 && (
                                  <span className="text-emerald-600 font-medium">
                                    (Paid: {formatCurrency(member.paid)})
                                  </span>
                                )}
                              </div>

                              {member.status === 'partial' && (
                                <div className="w-28 bg-gray-200 rounded-full h-1.5 overflow-hidden mt-1">
                                  <div
                                    className="bg-amber-500 h-full rounded-full"
                                    style={{ width: `${Math.min(100, (member.paid / member.effectiveDue) * 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 1-Tap Record Button */}
                          <button
                            onClick={() => {
                              setRecordingPaymentMember(member);
                              setEditingTransaction(null);
                              setQuickPaymentAmount(member.remaining.toString());
                              setPaymentWalletType('cash_in_hand');
                              setPaymentDateType('today');
                              setCustomPaymentDate(new Date().toISOString().split('T')[0]);
                              setPaymentNote('');
                              setPaymentReceiptUrl('');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5"
                          >
                            <Coins size={13} />
                            <span>Record</span>
                          </button>
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
                      className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1.5 py-1"
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
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Banknote size={16} className="text-indigo-600" />
                      <span>Payments Breakdown Ledger</span>
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Live transaction receipts for Month {selectedDashboardMonth} with edit/delete & 1-click WhatsApp sharing
                    </p>
                  </div>
                  <span className="text-xs font-bold text-gray-500">
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
                        <div key={tx.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50/50 rounded-lg px-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                              #{ticketNum}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-900">{memberName}</span>
                                <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded">
                                  {tx.wallet_type?.replace(/_/g, ' ').toUpperCase() || 'CASH'}
                                </span>
                                {tx.verification_proof_url && (
                                  <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded flex items-center gap-0.5">
                                    <Paperclip size={9} /> Receipt
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                <span>{dateStr}</span>
                                {tx.notes && <span className="text-gray-500 italic max-w-xs truncate">· {tx.notes}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-between sm:justify-end">
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
                                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition-colors"
                                >
                                  <Share2 size={12} />
                                  <span className="hidden sm:inline">Share</span>
                                </a>
                              )}

                              {/* Edit Payment Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditPayment(tx)}
                                title="Edit payment"
                                className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-lg transition-colors"
                              >
                                <Edit3 size={13} />
                              </button>

                              {/* Delete/Void Payment Button */}
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(tx)}
                                title="Delete payment receipt"
                                className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 rounded-lg transition-colors"
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
              <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <form
                  onSubmit={editingTransaction ? handleSavePaymentEdit : handleRecordQuickPayment}
                  className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-md space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
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
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Remaining Due</span>
                              <span className="font-bold text-amber-600">{formatCurrency(recordingPaymentMember.remaining)}</span>
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

                  {/* Payment Amount Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Payment Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-base text-gray-400 font-bold">₹</span>
                      <input
                        type="number"
                        required
                        placeholder="Amount"
                        value={quickPaymentAmount}
                        onChange={(e) => setQuickPaymentAmount(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-2 text-base font-bold text-gray-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Chips */}
                  <div className="flex gap-2">
                    {recordingPaymentMember && recordingPaymentMember.remaining > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setQuickPaymentAmount(recordingPaymentMember.remaining.toString())}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-1.5 rounded-lg transition-colors border border-gray-200"
                        >
                          Full ({formatCurrency(recordingPaymentMember.remaining)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickPaymentAmount(Math.floor(recordingPaymentMember.remaining / 2).toString())}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-1.5 rounded-lg transition-colors border border-gray-200"
                        >
                          Half ({formatCurrency(Math.floor(recordingPaymentMember.remaining / 2))})
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setQuickPaymentAmount('')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors border border-gray-200"
                    >
                      Clear
                    </button>
                  </div>

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
                  <div className="flex items-center justify-between pt-2">
                    {editingTransaction ? (
                      <button
                        type="button"
                        onClick={() => handleDeletePayment(editingTransaction)}
                        disabled={isProcessingPayment}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    ) : <div />}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRecordingPaymentMember(null);
                          setEditingTransaction(null);
                        }}
                        className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2 rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isProcessingPayment}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
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
      return (
        <div className="space-y-6">
          
          {/* Analytical Overview Suite */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-650" />
                Reports & Real-Time Portfolio Analytics
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time metrics compiled directly from your active Supabase chit groups and treasury ledger.
              </p>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Active Groups</span>
                <span className="text-xl font-bold text-gray-900 mt-1 block">{localGroups.filter(g => g.active).length}</span>
                <span className="text-[10px] text-indigo-600 mt-1 block">Live from Supabase</span>
              </div>

              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Value Managed</span>
                <span className="text-xl font-bold text-gray-900 mt-1 block">
                  {formatCurrency(localGroups.reduce((acc, g) => acc + (g.totalValue || 0), 0))}
                </span>
                <span className="text-[10px] text-gray-500 mt-1 block">Across all active groups</span>
              </div>

              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Treasury Cash Liquid</span>
                <span className="text-xl font-bold text-green-600 mt-1 block">
                  {formatCurrency(balances.cash_in_hand)}
                </span>
                <span className="text-[10px] text-gray-500 mt-1 block">Physical Cash Box</span>
              </div>
            </div>
          </div>

          {/* Quick analytic statistics columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Average Monthly Dividend</span>
              <span className="text-lg font-bold text-gray-900 mt-1 block">
                {localGroups.length === 0 ? '₹0' : formatCurrency(0)}
              </span>
              <span className="text-[10px] text-gray-400 mt-1 block">
                {localGroups.length === 0 ? 'No active auctions yet' : 'Calculated per active auction'}
              </span>
            </div>

            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Collected Funds (Actual)</span>
              <span className="text-lg font-bold text-gray-900 mt-1 block">{formatCurrency(actualCollections)}</span>
              <span className="text-[10px] text-gray-500 mt-1 block">
                Target baseline: {formatCurrency(targetCollections)}
              </span>
            </div>

            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Outstanding Dues</span>
              <span className="text-lg font-bold text-amber-600 mt-1 block">
                {formatCurrency(Math.max(0, targetCollections - actualCollections))}
              </span>
              <span className="text-[10px] text-gray-500 mt-1 block">
                {fifoMembers.filter(m => getMemberTotalDue(m) > 0).length} pending subscribers
              </span>
            </div>
          </div>

        </div>
      );

    case 'chits':
      const selectedWorkspaceGroup = localGroups.find(g => g.id === selectedWorkspaceGroupId);

      return (
        <div className="space-y-6">
          
          {/* 1. CHIT GROUP WORKSPACE VIEW */}
          {selectedWorkspaceGroupId && selectedWorkspaceGroup && !showWizard ? (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Workspace Top Navigation Bar */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkspaceGroupId(null)}
                    className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <ArrowLeft size={14} /> Back to Directory
                  </button>
                  <div className="h-5 w-px bg-gray-200 hidden sm:block"></div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      selectedWorkspaceGroup.status === 'draft' ? 'bg-amber-500' : selectedWorkspaceGroup.status === 'completed' ? 'bg-purple-500' : 'bg-green-500 animate-pulse'
                    }`}></span>
                    <h3 className="text-base font-bold text-gray-900">{selectedWorkspaceGroup.name}</h3>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                      selectedWorkspaceGroup.status === 'draft'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : selectedWorkspaceGroup.status === 'completed'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {selectedWorkspaceGroup.status ? selectedWorkspaceGroup.status.toUpperCase() : 'ACTIVE'}
                    </span>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded">
                      Month {selectedWorkspaceGroup.currentMonth} of {selectedWorkspaceGroup.duration}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditGroupModal(selectedWorkspaceGroup)}
                    className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 size={13} className="text-gray-500" /> Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingGroup(selectedWorkspaceGroup);
                      setDeletePhraseInput('');
                      setDeleteSliderVal(0);
                    }}
                    className="border border-red-200 bg-red-50/60 hover:bg-red-100 text-red-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Trash2 size={13} className="text-red-600" /> Delete Group
                  </button>
                </div>
              </div>

              {/* Group Key Metric Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 p-3.5 rounded-xl shadow-sm">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Pool Value</span>
                  <span className="text-lg font-bold text-gray-900 mt-0.5 block">{formatCurrency(selectedWorkspaceGroup.totalValue)}</span>
                  <span className="text-[10px] text-gray-400">{selectedWorkspaceGroup.duration} Member Tickets</span>
                </div>

                <div className="bg-white border border-gray-200 p-3.5 rounded-xl shadow-sm">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Monthly Installment</span>
                  <span className="text-lg font-bold text-indigo-600 mt-0.5 block">
                    {formatCurrency(selectedWorkspaceGroup.totalValue / selectedWorkspaceGroup.duration)}
                  </span>
                  <span className="text-[10px] text-gray-400">per ticket / month</span>
                </div>

                <div className="bg-white border border-gray-200 p-3.5 rounded-xl shadow-sm">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Accumulated Pool</span>
                  <span className="text-lg font-bold text-emerald-600 mt-0.5 block">
                    {formatCurrency(selectedWorkspaceGroup.kaiIruppuPool || 0)}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium">Kai Iruppu (Discount Pool)</span>
                </div>

                <div className="bg-white border border-gray-200 p-3.5 rounded-xl shadow-sm">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Scheduled Auction</span>
                  <span className="text-xs font-bold text-gray-800 mt-1 block">
                    {getGroupAuctionDate(selectedWorkspaceGroup.id).display}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleGroupId(selectedWorkspaceGroup.id);
                      setRescheduleInputVal(auctionDateOverrides[selectedWorkspaceGroup.id] || '');
                    }}
                    className="text-[9px] font-bold text-indigo-600 hover:underline mt-0.5 block"
                  >
                    Reschedule Date →
                  </button>
                </div>
              </div>

              {/* Month 0 / Launch Status Banner */}
              {selectedWorkspaceGroup.currentMonth === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
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
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow shrink-0"
                  >
                    <Rocket size={14} /> Confirm Launch &amp; Roll to Month 1
                  </button>
                </div>
              ) : (
                <div className="bg-indigo-50/60 border border-indigo-150 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Coins size={14} className="text-indigo-600" />
                      Month {selectedWorkspaceGroup.currentMonth} Auction Cycle Active
                    </h4>
                    <p className="text-xs text-indigo-800">
                      All eligible non-winning subscribers can place live discount bids. Maximum prize pot: <strong>{formatCurrency(selectedWorkspaceGroup.totalValue)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Enrolled Member Ticket Roster Matrix */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-150 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Users size={16} className="text-indigo-600" />
                      Enrolled Ticket Matrix &amp; Physical Book Sync
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Live status of all {selectedWorkspaceGroup.duration} assigned tickets, winning eligibility, and pocket book sync
                    </p>
                  </div>
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-3 py-1 rounded">
                    Total: {workspaceMembers.length} / {selectedWorkspaceGroup.duration} Tickets
                  </span>
                </div>

                {loadingWorkspaceMembers ? (
                  <div className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Loading enrolled ticket matrix from Supabase...
                  </div>
                ) : workspaceMembers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    No individual member tickets linked to this group yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {workspaceMembers.map((member) => (
                      <div 
                        key={member.id} 
                        className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                          member.hasWon
                            ? 'bg-gray-50 border-gray-250 opacity-80'
                            : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-150 flex items-center justify-center shrink-0">
                              #{member.ticket}
                            </span>
                            <div>
                              <strong className="text-xs text-gray-900 block truncate max-w-[140px]">{member.name}</strong>
                              <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                <Phone size={10} /> {member.phone || 'No phone'}
                              </span>
                            </div>
                          </div>

                          {member.hasWon ? (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">
                              Already Won
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              Eligible
                            </span>
                          )}
                        </div>

                        {/* Pocket Book Sync Toggle */}
                        <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[10px]">
                          <span className="text-gray-500 font-medium">Physical Pocket Book:</span>
                          <button
                            type="button"
                            onClick={() => handleToggleWorkspaceBookSync(member.id, member.bookSynced)}
                            className={`font-bold px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                              member.bookSynced
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {member.bookSynced ? (
                              <>
                                <Check size={11} /> Synced
                              </>
                            ) : (
                              <>
                                <AlertCircle size={11} /> Pending Sync
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : !showWizard ? (
            /* 2. DIRECTORY VIEW */
            <div className="space-y-4 animate-in fade-in duration-200">
              
               {/* Summary Header banner */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Chit Groups Directory</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Active Groups: <strong className="text-gray-700">{localGroups.filter(g => g.active).length}</strong> | Total Value Managed: <strong className="text-indigo-600">{formatCurrency(localGroups.reduce((acc, g) => acc + g.totalValue, 0))}</strong>
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setShowWizard(true)}
                    className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow"
                  >
                    + New Group
                  </button>
                </div>
              </div>

              {/* Filter Actions row */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setGroupFilter('all')}
                  className={`text-[10px] font-bold px-3.5 py-1.5 rounded-lg border transition-all ${
                    groupFilter === 'all'
                      ? 'bg-indigo-50 text-indigo-600 border-indigo-150'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Show All ({localGroups.length})
                </button>
                <button
                  onClick={() => setGroupFilter('active')}
                  className={`text-[10px] font-bold px-3.5 py-1.5 rounded-lg border transition-all ${
                    groupFilter === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-200'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Active ({localGroups.filter(g => g.status === 'active' || (!g.status && g.active)).length})
                </button>
                <button
                  onClick={() => setGroupFilter('draft')}
                  className={`text-[10px] font-bold px-3.5 py-1.5 rounded-lg border transition-all ${
                    groupFilter === 'draft'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-200'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Draft ({localGroups.filter(g => g.status === 'draft').length})
                </button>
                <button
                  onClick={() => setGroupFilter('completed')}
                  className={`text-[10px] font-bold px-3.5 py-1.5 rounded-lg border transition-all ${
                    groupFilter === 'completed'
                      ? 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-200'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Completed ({localGroups.filter(g => g.status === 'completed').length})
                </button>
              </div>

              {/* Groups Card Directory Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {localGroups.filter(g => {
                  if (groupFilter === 'all') return true;
                  if (groupFilter === 'draft') return g.status === 'draft';
                  if (groupFilter === 'completed') return g.status === 'completed';
                  return g.status === 'active' || (!g.status && g.active);
                }).length === 0 ? (
                  <div className="col-span-full py-12 px-6 bg-white border border-gray-200 rounded-xl text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
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
                      className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow"
                    >
                      + Create First Group
                    </button>
                  </div>
                ) : (
                localGroups
                  .filter(g => {
                    if (groupFilter === 'all') return true;
                    if (groupFilter === 'draft') return g.status === 'draft';
                    if (groupFilter === 'completed') return g.status === 'completed';
                    return g.status === 'active' || (!g.status && g.active);
                  })
                  .map((g) => {
                    const progressPercent = (g.currentMonth / g.duration) * 100;
                    
                    return (
                      <div key={g.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm hover:border-gray-300 transition-colors flex flex-col justify-between">
                        <div className="space-y-3">
                          {/* Card Top */}
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  g.status === 'draft' ? 'bg-amber-500' : g.status === 'completed' ? 'bg-purple-500' : 'bg-green-500 animate-pulse'
                                }`}></span>
                                <h4 className="text-xs font-bold text-gray-900 truncate max-w-[140px]">{g.name}</h4>
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
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Edit chit details"
                                onClick={() => openEditGroupModal(g)}
                                className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                title="Delete group"
                                onClick={() => {
                                  setDeletingGroup(g);
                                  setDeletePhraseInput('');
                                  setDeleteSliderVal(0);
                                }}
                                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} />
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
                              <div className="w-full bg-gray-105 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-indigo-650 h-full rounded-full transition-all duration-350"
                                  style={{ width: `${progressPercent}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {/* Metadata Tracks */}
                          <div className="space-y-1.5 text-[10px] text-gray-500">
                            <div className="flex justify-between">
                              <span>Total Pool:</span>
                              <strong className="text-gray-700">{formatCurrency(g.totalValue)}</strong>
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
                                      onClick={() => { setRescheduleGroupId(g.id); setRescheduleInputVal(auctionDateOverrides[g.id] || ''); }}
                                      className="text-[8px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded hover:bg-indigo-100 transition-colors"
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
                              className="w-full bg-amber-600 hover:bg-amber-755 text-white font-bold text-[10px] py-2 rounded flex items-center justify-center gap-1.5 transition-all shadow-sm"
                            >
                              <Rocket size={12} /> Confirm Launch &amp; Roll to Month 1
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
                              className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 font-bold text-[10px] py-1.5 rounded transition-all flex items-center justify-center gap-1"
                            >
                              <Briefcase size={11} /> Dashboard
                            </button>
                            <button
                              onClick={() => {
                                const copy = {
                                  ...g,
                                  id: Math.random().toString(),
                                  name: `${g.name} (Copy)`
                                };
                                setLocalGroups(prev => [copy, ...prev]);
                                alert(`Chit Group template "${g.name}" duplicated successfully!`);
                              }}
                              className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-[10px] py-1.5 rounded transition-all"
                            >
                              Duplicate
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* 3. SETUP WIZARD VIEW */
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Setup Wizard Progress Indicator */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Chit Setup Wizard</h3>
                  <button
                    onClick={() => setShowWizard(false)}
                    className="text-[10px] text-gray-500 hover:text-gray-900 underline font-semibold ml-2"
                  >
                    Cancel Wizard
                  </button>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 1 
                        ? 'bg-gray-900 text-white shadow shadow-black/30' 
                        : wizardStep > 1 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      {wizardStep > 1 ? <Check size={12} /> : '1'}
                    </span>
                    <span className={`text-xs font-semibold ${wizardStep === 1 ? 'text-gray-900' : 'text-gray-400'}`}>Basic Info</span>
                  </div>
                  
                  <div className="w-8 h-px bg-gray-200"></div>

                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 2 
                        ? 'bg-gray-900 text-white shadow shadow-black/30' 
                        : wizardStep > 2 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      {wizardStep > 2 ? <Check size={12} /> : '2'}
                    </span>
                    <span className={`text-xs font-semibold ${wizardStep === 2 ? 'text-gray-900' : 'text-gray-400'}`}>Assign Members</span>
                  </div>

                  <div className="w-8 h-px bg-gray-200"></div>

                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 3 
                        ? 'bg-gray-900 text-white shadow shadow-black/30' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      3
                    </span>
                    <span className={`text-xs font-semibold ${wizardStep === 3 ? 'text-gray-900' : 'text-gray-400'}`}>Monthly Plan</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: BASIC INFO */}
              {wizardStep === 1 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 shadow-sm">
                  <div className="border-b border-gray-150 pb-3">
                    <h4 className="text-sm font-bold text-gray-900">Step 1: Basic Information</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Define name, monthly pool targets, and chit duration</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Group Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. G-Elite-Weekly-301"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Total Pool Value (₹)</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 100000"
                        value={newGroupValue}
                        onChange={(e) => setNewGroupValue(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none"
                      />
                      {/* Target Presets */}
                      <div className="flex gap-1.5 mt-1.5">
                        {[{ label: '₹1L', val: 100000 }, { label: '₹2L', val: 200000 }, { label: '₹5L', val: 500000 }, { label: '₹10L', val: 1000000 }].map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setNewGroupValue(preset.val.toString())}
                            className="bg-gray-55 hover:bg-gray-105 border border-gray-200 text-[9px] text-gray-600 font-bold px-2 py-1 rounded transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Duration / Member Count (Months)</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={50}
                        placeholder="e.g. 20"
                        value={newGroupDuration}
                        onChange={(e) => handleDurationChange(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none"
                      />
                      {/* Duration Presets */}
                      <div className="flex gap-1.5 mt-1.5">
                        {[10, 20, 25, 50].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleDurationChange(val.toString())}
                            className="bg-gray-55 hover:bg-gray-105 border border-gray-200 text-[9px] text-gray-600 font-bold px-2.5 py-1 rounded transition-colors"
                          >
                            {val}m
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Launch Date / Month 0 Start</label>
                      <input
                        type="date"
                        required
                        value={newGroupStartDate}
                        onChange={(e) => setNewGroupStartDate(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none font-semibold"
                      />
                      <span className="text-[10px] text-gray-400 block">Sets the start month for Month 0 Launch calculations</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-150">
                    <button
                      type="button"
                      disabled={!newGroupName.trim() || !newGroupValue || !newGroupDuration}
                      onClick={() => setWizardStep(2)}
                      className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow"
                    >
                      Next: Assign Members <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: ASSIGN MEMBERS */}
              {wizardStep === 2 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-6 shadow-sm">
                  <div className="border-b border-gray-150 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Step 2: Assign Group Members</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Search &amp; assign subscribers to each ticket slot or register new members</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-3 py-1 rounded border transition-colors ${
                        enrollments.every(e => e.name !== '')
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-600 border-indigo-150'
                      }`}>
                        Enrolled: {enrollments.filter(e => e.name !== '').length} / {newGroupDuration} spots
                      </span>
                    </div>
                  </div>

                  {/* Fast Search & Auto-Suggest Combobox */}
                  <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                        Quick Search &amp; Assign Subscriber
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setNewMemberName(memberSearchQuery.trim());
                          setNewMemberPhone('');
                          setShowCreateMemberModal(true);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline"
                      >
                        <UserPlus size={12} /> + Register New Member
                      </button>
                    </div>

                    {(() => {
                      const filteredMembers = masterDirectory.filter(
                        m => m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || m.phone.includes(memberSearchQuery)
                      );
                      const totalItems = 1 + filteredMembers.length;

                      return (
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-400">
                            <Search size={14} />
                          </span>
                          <input
                            type="text"
                            placeholder="Type member name to search or register... (↑/↓ to navigate, Enter to select)"
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
                            className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-lg pl-9 pr-20 py-2 text-xs font-semibold text-gray-900 focus:outline-none shadow-sm"
                          />
                          {memberSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setMemberSearchQuery('');
                                setIsSearchDropdownOpen(false);
                              }}
                              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                            >
                              <X size={14} />
                            </button>
                          )}

                          {/* Dropdown Suggestions */}
                          {isSearchDropdownOpen && memberSearchQuery.trim().length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-gray-100">
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
                                  Create &amp; Assign &quot;{memberSearchQuery}&quot;
                                </span>
                                <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                  {dropdownHighlightedIndex === 0 && <span>↵</span>} + New
                                </span>
                              </div>

                              {/* Matching Master Directory Members (Index 1..N) */}
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
                                          ↵ Enter to Assign
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded hover:bg-indigo-100">
                                          Assign to Next Slot →
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {filteredMembers.length === 0 && (
                                <div className="p-3 text-center text-xs text-gray-400">
                                  No existing subscribers matched &quot;{memberSearchQuery}&quot;. Press <strong>Enter</strong> to register this member.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Group Enrollment Spots (Slots Grid) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Enrolled Chit Ticket Spots ({enrollments.filter(e => e.name !== '').length} of {newGroupDuration})
                      </h5>
                      <span className="text-[10px] text-gray-400">
                        {enrollments.some(e => e.name === '') ? 'Click directory below or search above to fill' : '✓ All tickets assigned!'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[260px] overflow-y-auto pr-1">
                      {enrollments.map((slot, index) => (
                        <div 
                          key={index} 
                          className={`flex gap-2.5 items-center p-3 rounded-xl border transition-all ${
                            slot.name 
                              ? 'bg-white border-gray-200 shadow-sm' 
                              : 'border-dashed border-gray-250 bg-gray-50/50'
                          }`}
                        >
                          <span className={`text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            slot.name
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                              : 'bg-gray-200 text-gray-500'
                          }`}>
                            #{index + 1}
                          </span>

                          {slot.name ? (
                            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                              <div className="truncate">
                                <span className="text-xs font-bold text-gray-900 block truncate">{slot.name}</span>
                                <span className="text-[10px] text-gray-500 mt-0.5 block truncate flex items-center gap-1">
                                  <Phone size={10} className="text-gray-400 shrink-0" />
                                  {slot.phone}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleClearSlot(index)}
                                title="Unassign member from this slot"
                                className="text-red-600 hover:text-red-700 text-[10px] font-bold px-2 py-1 rounded border border-red-200 shrink-0 bg-red-50/50 hover:bg-red-50 transition-colors flex items-center gap-1"
                              >
                                <Trash2 size={11} /> Clear
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium italic">Empty ticket slot #{index + 1}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Master Member Directory */}
                  <div className="space-y-3 border-t border-gray-150 pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h5 className="text-[10px] font-bold text-indigo-650 uppercase tracking-wider">
                          Master Subscriber Directory ({masterDirectory.length})
                        </h5>
                        <p className="text-[11px] text-gray-500">Click any subscriber to assign to next available slot</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNewMemberName('');
                            setNewMemberPhone('');
                            setShowCreateMemberModal(true);
                          }}
                          className="bg-gray-900 hover:bg-black text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
                        >
                          <UserPlus size={13} /> + Add Member
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[170px] overflow-y-auto pr-1">
                      {masterDirectory.length === 0 ? (
                        <div className="col-span-full py-6 text-center text-xs text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                          No subscribers found in database. Click <strong>&quot;+ Add Member&quot;</strong> above to create your first subscriber.
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
                              className={`p-3 rounded-xl border text-left transition-all relative ${
                                isAlreadyAdded 
                                  ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed' 
                                  : 'bg-white hover:bg-indigo-50/40 border-gray-200 hover:border-indigo-300 shadow-sm'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-xs font-bold text-gray-900 block truncate">{member.name}</span>
                                {isAlreadyAdded && (
                                  <span className="text-[8px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded shrink-0">
                                    Enrolled
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-500 mt-0.5 block truncate">{member.phone}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Navigation Step 2 Buttons */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-4 border-t border-gray-150">
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors"
                    >
                      Back
                    </button>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-500 font-medium">
                        <strong>{enrollments.filter(e => e.name && e.name.trim() !== '').length} of {newGroupDuration}</strong> assigned
                        {enrollments.some(e => !e.name || e.name.trim() === '') && (
                          <span className="text-amber-600 font-bold ml-1.5">(Creates in Draft Mode)</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setWizardStep(3)}
                        className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow transition-all"
                      >
                        Next: Monthly Plan <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: MONTHLY PLAN REVIEW */}
              {wizardStep === 3 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-6 shadow-sm">
                  <div className="border-b border-gray-150 pb-3">
                    <h4 className="text-sm font-bold text-gray-900">Step 3: Review Monthly Plan</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Verify baseline payments and member lists before finalizing</p>
                  </div>

                  {/* Review Summary Details Card */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-gray-400 block">Group Name</span>
                        <strong className="text-gray-800 mt-1 block">{newGroupName}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Chit Value (Pool)</span>
                        <strong className="text-indigo-650 mt-1 block">{formatCurrency(Number(newGroupValue))}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Member spots / Duration</span>
                        <strong className="text-gray-800 mt-1 block">{newGroupDuration} months</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Baseline Fixed Monthly Due</span>
                        <strong className="text-emerald-700 mt-1 block">
                          {formatCurrency(Number(newGroupValue) / Number(newGroupDuration))}/member
                        </strong>
                      </div>
                    </div>

                    <div className="border-t border-gray-150 pt-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-gray-550 uppercase tracking-wider block">
                          Enrolled Subscribers ({enrollments.filter(e => e.name && e.name.trim() !== '').length} of {newGroupDuration})
                        </span>
                        {enrollments.some(e => !e.name || e.name.trim() === '') && (
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Will Create in Draft Mode
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {enrollments.map((slot, index) => (
                          <span key={index} className={`border text-[10px] px-2.5 py-1 rounded shadow-sm ${
                            slot.name ? 'bg-white border-gray-200 text-gray-700 font-semibold' : 'bg-amber-50/50 border-amber-200 text-amber-700 italic'
                          }`}>
                            Ticket #{index + 1}: {slot.name || 'Unassigned (Open Slot)'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 border-t border-gray-150">
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={isCreatingGroup}
                      onClick={handleCreateGroup}
                      className={`font-bold text-xs px-6 py-2.5 rounded-lg transition-colors duration-155 flex items-center justify-center gap-1.5 shadow ${
                        isCreatingGroup
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gray-900 hover:bg-black text-white'
                      }`}
                    >
                      {isCreatingGroup ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" /> Creating Group in Supabase...
                        </>
                      ) : (
                        'Create Group & Enroll Slots'
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
                <div className="space-y-4">
                  {/* Top Members Header */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-gray-150">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Members</h4>
                      <p className="text-[11px] text-gray-500">
                        {editGroupMembers.filter(m => m.profileId).length} members · {editGroupMembers.filter(m => m.profileId).length}/{editGroupMemberCount} shares filled
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Filter members..."
                          value={editMemberSearchQuery}
                          onChange={(e) => setEditMemberSearchQuery(e.target.value)}
                          className="bg-gray-50 border border-gray-200 rounded-xl pl-7 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewMemberName('');
                          setNewMemberPhone('');
                          setShowCreateMemberModal(true);
                        }}
                        className="bg-gray-900 hover:bg-black text-white font-bold text-[11px] px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
                      >
                        <UserPlus size={13} /> + Add Member
                      </button>
                    </div>
                  </div>

                  {/* Informational Timing Banner */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-600 space-y-0.5">
                    <p className="font-semibold text-gray-800">
                      Months 1–{editingGroup?.currentMonth || 1} are already collected and stay exactly as they are.
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Share changes and adjustments apply from <strong>month {(editingGroup?.currentMonth || 1) + 1}</strong> onward.
                    </p>
                  </div>

                  {/* Member Tickets Roster List */}
                  <div className="space-y-3">
                    {Array.from({ length: editGroupMemberCount }).map((_, idx) => {
                      const ticketNum = idx + 1;
                      const member = editGroupMembers.find(m => m.ticket === ticketNum);
                      const standardDue = Math.round(editGroupValue / (editGroupMemberCount || 1));
                      const effectiveDue = member?.customInstallment || standardDue;
                      const isTimingExpanded = expandedTimingTicketIds.includes(ticketNum);

                      if (editMemberSearchQuery && member?.name && !member.name.toLowerCase().includes(editMemberSearchQuery.toLowerCase())) {
                        return null;
                      }

                      return (
                        <div
                          key={ticketNum}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            member?.profileId 
                              ? 'bg-white border-gray-200 shadow-sm hover:border-gray-300' 
                              : 'border-dashed border-gray-300 bg-gray-50/60'
                          }`}
                        >
                          {/* Card Header Line */}
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-150 text-[11px] font-bold flex items-center justify-center shrink-0">
                                  #{ticketNum}
                                </span>
                                <h5 className="text-sm font-bold text-gray-900">
                                  {member?.name || (member?.profileId ? 'Subscriber' : 'Unassigned Ticket')}
                                </h5>
                                {member?.phone && (
                                  <span className="text-[10px] text-gray-400 font-medium">({member.phone})</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 font-medium pl-8">
                                Pays <strong className="text-emerald-700">≈ {formatCurrency(effectiveDue)}/mo</strong> · wins up to <strong className="text-gray-900">{formatCurrency(editGroupValue)}</strong>
                              </p>
                            </div>

                            {/* Unassign / Remove Button */}
                            {member?.profileId && (
                              <button
                                type="button"
                                title="Unassign ticket"
                                onClick={() => handleUnassignTicket(member.id, ticketNum)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          {/* Stepper & Timing Toggle Line */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                            {/* Shares Stepper */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-1 shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (member?.profileId) {
                                      // Unassign one extra ticket with this profileId
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
                                <span className="w-8 text-center font-bold text-xs text-gray-900">
                                  {member?.profileId ? `${editGroupMembers.filter(m => m.profileId === member.profileId).length}x` : '0x'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (member?.profileId) {
                                      // Assign next empty ticket with this profileId
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

                            {/* Share timing dropdown toggle */}
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedTimingTicketIds(prev =>
                                  isTimingExpanded ? prev.filter(id => id !== ticketNum) : [...prev, ticketNum]
                                );
                              }}
                              className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
                            >
                              Share timing {isTimingExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>

                          <p className="text-[10px] text-gray-400 italic">
                            Adding starts a new split from month {(editingGroup?.currentMonth || 1) + 1} — months already collected stay unchanged.
                          </p>

                          {/* 4 Action Buttons Row (ChitBase inspired) */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCustomAmountModalTicket(member);
                                setCustomAmountVal(member?.customInstallment || standardDue);
                              }}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                                member?.customInstallment
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {member?.customInstallment ? `Custom: ₹${member.customInstallment.toLocaleString('en-IN')}` : 'Set a custom amount'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSplitModalTicket(member);
                                setSplitPayers(member?.splitPool || [
                                  { name: member?.name || 'Person 1', part: Math.round(standardDue / 2) },
                                  { name: 'Person 2', part: Math.round(standardDue / 2) }
                                ]);
                              }}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                                member?.splitPool
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {member?.splitPool ? `Pool (${member.splitPool.length} payers)` : 'Split into a pool'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setExitModalTicket(member);
                                setExitMonthVal(member?.exitMonth || (editingGroup?.currentMonth || 1) + 1);
                              }}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                                member?.exitMonth
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {member?.exitMonth ? `Exits M${member.exitMonth}` : 'Member leaves the chit...'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setTransferModalTicket(member);
                                setTransferRecipientId('');
                                setTransferMonthVal((editingGroup?.currentMonth || 1) + 1);
                              }}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                                member?.transferredFrom
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {member?.transferredFrom ? 'Transferred' : 'Transfer shares...'}
                            </button>
                          </div>

                          {/* Expanded Share Timing Details */}
                          {isTimingExpanded && (
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs animate-in fade-in duration-150">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Share Timeline Breakdown</span>
                              <div className="space-y-1 text-[11px]">
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                  <span>Month 1 (Launch / Historical)</span>
                                  <span className="text-gray-500 font-semibold">1x · Locked (collected)</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                  <span>Month 2 onward</span>
                                  <span className="text-indigo-600 font-semibold">
                                    {member?.profileId ? `${editGroupMembers.filter(m => m.profileId === member.profileId).length}x active` : 'Unassigned'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Active Split Pool Summary Tag */}
                          {member?.splitPool && (
                            <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider block">👥 Joint Split Pool Active:</span>
                              <div className="flex flex-wrap gap-2 text-[11px]">
                                {member.splitPool.map((p: any, pIdx: number) => (
                                  <span key={pIdx} className="bg-white border border-purple-200 px-2 py-0.5 rounded-md font-semibold">
                                    {p.name}: {formatCurrency(p.part)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Active Exit Warning Tag */}
                          {member?.exitMonth && (
                            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex justify-between items-center">
                              <span>⚠️ Member scheduled to stop paying from <strong>Month {member.exitMonth}</strong>.</span>
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
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative">
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

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSplitModalTicket(null)}
                className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Cancel
              </button>
              {splitModalTicket.splitPool && (
                <button
                  type="button"
                  onClick={() => handleSaveSplit(splitModalTicket.id, [])}
                  className="border border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs px-3 py-2 rounded-xl transition-colors"
                >
                  Clear Split
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSaveSplit(splitModalTicket.id, splitPayers)}
                className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors shadow-sm"
              >
                Save split
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. SUB-MODAL: MEMBER LEAVES THE CHIT (Screenshot 4) ──────── */}
      {exitModalTicket && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative">
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

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setExitModalTicket(null)}
                className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveExit(exitModalTicket.id, exitMonthVal)}
                className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors shadow-sm"
              >
                End shares
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. SUB-MODAL: TRANSFER SHARES ──────── */}
      {transferModalTicket && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative">
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

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTransferModalTicket(null)}
                className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!transferRecipientId}
                onClick={() => handleSaveTransfer(transferModalTicket.id, transferRecipientId, transferMonthVal)}
                className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. SUB-MODAL: CUSTOM AMOUNT ──────── */}
      {customAmountModalTicket && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative">
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
                  step={500}
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

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCustomAmountModalTicket(null)}
                className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors"
              >
                Cancel
              </button>
              {customAmountModalTicket.customInstallment && (
                <button
                  type="button"
                  onClick={() => handleSaveCustomAmount(customAmountModalTicket.id, null)}
                  className="border border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs px-3 py-2 rounded-xl transition-colors"
                >
                  Clear Custom
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSaveCustomAmount(customAmountModalTicket.id, customAmountVal > 0 ? customAmountVal : null)}
                className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors shadow-sm"
              >
                Save Custom Amount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIGH-SECURITY MULTI-STEP DANGER DELETE CONFIRMATION MODAL */}
      {deletingGroup && (() => {
        const requiredPhrase = `DELETE ${deletingGroup.name}`;
        const isPhraseMatched = 
          deletePhraseInput.trim().toUpperCase() === requiredPhrase.toUpperCase() ||
          deletePhraseInput.trim().toUpperCase() === 'DELETE' ||
          deletePhraseInput.trim().toLowerCase() === deletingGroup.name.toLowerCase();
        const isSliderReady = isPhraseMatched && deleteSliderVal >= 98;

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white border-2 border-red-200 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl relative">
              
              {/* Danger Header */}
              <div className="flex justify-between items-start border-b border-red-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-red-900">
                      Permanent Deletion Warning
                    </h4>
                    <p className="text-xs text-red-700 font-semibold mt-0.5">
                      &quot;{deletingGroup.name}&quot; ({formatCurrency(deletingGroup.totalValue)})
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setDeletingGroup(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Warning Description Box */}
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

              {/* Safety Verification Step 1: Type Required Phrase */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] text-gray-700 font-bold block">
                  Step 1: Type <span className="font-mono bg-red-100 text-red-800 px-1.5 py-0.5 rounded select-all font-bold">DELETE {deletingGroup.name}</span> (or <span className="font-mono bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">DELETE</span>) below:
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
                        : 'border-gray-300 focus:border-red-400'
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
                  <span className="font-bold text-gray-700 flex items-center gap-1">
                    {isPhraseMatched ? (
                      <Unlock size={13} className="text-emerald-600" />
                    ) : (
                      <Lock size={13} className="text-gray-400" />
                    )}
                    Step 2: Slide all the way to confirm deletion
                  </span>
                  <span className={`font-bold ${isSliderReady ? 'text-red-600' : 'text-gray-400'}`}>
                    {deleteSliderVal}%
                  </span>
                </div>

                <div className="relative flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={deleteSliderVal}
                    disabled={!isPhraseMatched || isDeletingGroup}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDeleteSliderVal(val);
                      if (val >= 100 && isPhraseMatched) {
                        handleExecuteDeleteGroup();
                      }
                    }}
                    className={`w-full h-8 rounded-xl appearance-none cursor-pointer transition-all ${
                      !isPhraseMatched
                        ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-100 via-red-300 to-red-600 accent-red-600'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-gray-400 text-center">
                  {!isPhraseMatched
                    ? '🔒 Complete Step 1 above to unlock the confirmation slider'
                    : '👉 Drag the slider to 100% to trigger permanent deletion'}
                </p>
              </div>

              {/* Action Controls Footer */}
              <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setDeletingGroup(null)}
                  className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel &amp; Keep Group
                </button>
                <button
                  type="button"
                  disabled={!isSliderReady || isDeletingGroup}
                  onClick={handleExecuteDeleteGroup}
                  className={`font-bold text-xs px-5 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 ${
                    isSliderReady && !isDeletingGroup
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isDeletingGroup ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Purging from Supabase...
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} /> Delete Group Permanently
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Global Reschedule Date Override Popover (accessible on Dashboard, Chits directory, and Workspace) */}
      {rescheduleGroupId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <CalendarDays size={14} className="text-indigo-600" />
                Reschedule Auction Date
              </h4>
              <button onClick={() => setRescheduleGroupId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Select New Date</label>
              <input
                type="date"
                value={rescheduleInputVal}
                onChange={(e) => setRescheduleInputVal(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
                autoFocus
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Canonical (auto): {formatAuctionDate(getFirstSundayOnOrAfter10th(new Date().getFullYear(), new Date().getMonth()))}
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
              {auctionDateOverrides[rescheduleGroupId] && (
                <button
                  type="button"
                  onClick={() => { 
                    setAuctionDateOverrides(prev => { 
                      const n = {...prev}; 
                      delete n[rescheduleGroupId!]; 
                      return n; 
                    }); 
                    setRescheduleGroupId(null); 
                  }}
                  className="text-[10px] font-bold text-red-650 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Clear Override
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (rescheduleInputVal) setAuctionDateOverrides(prev => ({ ...prev, [rescheduleGroupId!]: rescheduleInputVal }));
                  setRescheduleGroupId(null);
                }}
                className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Create / Register Subscriber Modal Popup */}
      {showCreateMemberModal && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
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

              <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateMemberModal(false)}
                  className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingMember || !newMemberName.trim() || !newMemberPhone.trim() || duplicatePhoneSubscriber !== null}
                  className={`font-bold text-xs px-5 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 ${
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
    </>
  );
}
