'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth, UserRole } from '@/context/AuthContext';
import { useMaintenance } from '@/context/MaintenanceContext';
import { CustomRoleRecord } from '@/utils/rbac';
import MemberDetailsView from './MemberDetailsView';
import RoleManagerPanel from './RoleManagerPanel';
import PassbookScannerModal from './PassbookScannerModal';
import PassbookSheetGeneratorModal, { StickerItem } from './PassbookSheetGeneratorModal';
import PassbookInventoryModal from './PassbookInventoryModal';
import PassbookQrCenterModal from './PassbookQrCenterModal';
import { getPassbookScanUrl } from '@/utils/qrCodeGenerator';
import { 
  Users, 
  Search, 
  UserPlus, 
  Check, 
  Phone, 
  Mail, 
  Edit3, 
  Trash2, 
  ChevronRight,
  ShieldCheck,
  CheckCircle2, 
  XCircle,
  X,
  Plus,
  QrCode,
  Printer,
  Layers,
  Sparkles,
  Share2,
  Shield,
  Briefcase,
  UserCheck,
  Ban,
  UserX,
  Wrench,
  RefreshCw,
  Unlink,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  BookOpen,
  Download
} from 'lucide-react';

interface MemberGroupInfo {
  id: string;
  name: string;
  ticket: number;
  totalValue?: number;
  duration?: number;
  currentMonth?: number;
}

export interface MemberRecord {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  groups: MemberGroupInfo[];
  passbookToken?: string;
  mpin?: string;
  isBlocked?: boolean;
  rescheduleAcknowledgments?: Record<string, { acknowledgedAt: string; lastRescheduledAt?: string }>;
  createdAt?: string;
}

interface MemberMatrixProps {
  onAddAuditLog?: (desc: string) => void;
  defaultSubtab?: 'directory' | 'roles';
}

export default function MemberMatrix({ onAddAuditLog, defaultSubtab = 'directory' }: MemberMatrixProps) {
  const { profile: currentAdminProfile } = useAuth();
  const { isMaintenanceMode, toggleMaintenanceMode } = useMaintenance();

  // Subtab navigation: Directory vs Roles & Permissions
  const [currentSubtab, setCurrentSubtab] = useState<'directory' | 'roles'>(defaultSubtab);

  // Core data states
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleRecord[]>([]);
  const [allChitGroups, setAllChitGroups] = useState<{ id: string; name: string; total_value?: number; duration?: number; current_month?: number }[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [allAuctionLogs, setAllAuctionLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [qrFilter, setQrFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [tableFilter, setTableFilter] = useState<'all' | 'paired' | 'unpaired' | 'blocked' | 'pending_mpin'>('all');

  // Selected member drilldown
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Selected member in desktop inspection drawer
  const [drawerMemberId, setDrawerMemberId] = useState<string | null>(null);

  // Add / Edit Member Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newPhoneNumber, setNewPhoneNumber] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('subscriber');
  const [editIsBlocked, setEditIsBlocked] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Passbook QR Modals
  const [pairingMember, setPairingMember] = useState<MemberRecord | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(false);
  const [isQrCenterOpen, setIsQrCenterOpen] = useState<boolean>(false);
  const [qrCenterTab, setQrCenterTab] = useState<'subscribers' | 'batches'>('subscribers');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printItems, setPrintItems] = useState<StickerItem[]>([]);
  const [printSheetTitle, setPrintSheetTitle] = useState<string>('Passbook QR Sticker Sheet');
  const [selectedSubscribersForPrint, setSelectedSubscribersForPrint] = useState<StickerItem[] | null>(null);

  // Maintenance Toggle state
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState<boolean>(false);

  // Role creation modal trigger from header
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState<boolean>(false);

  const handleExportRolesPolicy = () => {
    const policyData = {
      system: 'ChitFunds.io Access Control Policy',
      exportedAt: new Date().toISOString(),
      roles: customRoles.map((r) => ({
        id: r.id,
        name: r.name,
        isSystem: r.is_system,
        description: r.description,
        color: r.color,
        allowedTabs: r.allowed_tabs || [],
        allowedActions: r.allowed_actions || [],
      })),
    };
    const blob = new Blob([JSON.stringify(policyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chitfunds_rbac_policy_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const normalizePhoneDigits = (raw: string): string => {
    const digits = (raw || '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  // Fetch Roles from Supabase
  const fetchCustomRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Error fetching custom roles:', error);
        return;
      }
      if (data) {
        setCustomRoles(data);
      }
    } catch (err) {
      console.error('Failed to load custom roles:', err);
    }
  };

  // Fetch all profiles, enrollments, transactions, and chit groups
  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // 2. Fetch all group member enrollments
      const { data: memberGroupsData, error: memberGroupsError } = await supabase
        .from('group_members')
        .select(`
          id,
          profile_id,
          group_id,
          ticket_number,
          chit_groups (
            id,
            name,
            total_value,
            duration,
            current_month
          )
        `);

      if (memberGroupsError) {
        console.warn('Note fetching member groups:', memberGroupsError.message);
      }

      // 3. Fetch chit groups list for filter
      const { data: groupsData } = await supabase
        .from('chit_groups')
        .select('id, name, total_value, duration, current_month')
        .order('name', { ascending: true });

      if (groupsData) {
        setAllChitGroups(groupsData);
      }

      // 4. Fetch collections
      const { data: txsData } = await supabase
        .from('transactions')
        .select('id, profile_id, group_id, group_member_id, amount, type, status, cycle_month, notes');
      if (txsData) {
        setAllTransactions(txsData);
      }

      // 5. Fetch auction logs
      const { data: logsData } = await supabase
        .from('auction_logs')
        .select('id, group_id, month, winning_bidder_id, winning_discount, is_laaba_seetu');
      if (logsData) {
        setAllAuctionLogs(logsData);
      }

      if (profilesData) {
        setMembers(
          profilesData.map((p: any) => {
            const memberGroupRecords = (memberGroupsData || []).filter((gm: any) => gm.profile_id === p.id);
            const assignedGroups: MemberGroupInfo[] = memberGroupRecords.map((gm: any) => {
              const groupObj = Array.isArray(gm.chit_groups) ? gm.chit_groups[0] : gm.chit_groups;
              return {
                id: gm.group_id,
                name: groupObj?.name || 'Chit Group',
                ticket: gm.ticket_number,
                totalValue: groupObj?.total_value,
                duration: groupObj?.duration,
                currentMonth: groupObj?.current_month,
              };
            });

            return {
              id: p.id,
              fullName: p.full_name || 'Member',
              phoneNumber: p.phone_number || '',
              role: p.role || 'subscriber',
              groups: assignedGroups,
              passbookToken: p.passbook_token || undefined,
              mpin: p.mpin || '1234',
              isBlocked: p.is_blocked || false,
              rescheduleAcknowledgments: p.reschedule_acknowledgments || undefined,
              createdAt: p.created_at,
            };
          })
        );
      }
    } catch (err) {
      console.error('Error fetching member matrix data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchCustomRoles();
  }, []);

  // ── Role display helper ──
  const getRoleMeta = (roleId: string) => {
    const custom = customRoles.find((r) => r.id === roleId);
    if (custom) {
      return {
        label: custom.name,
        color: custom.color || '#6366F1',
        isSystem: custom.is_system,
      };
    }
    if (roleId === 'admin') return { label: 'Admin', color: '#9333EA', isSystem: true };
    if (roleId === 'manager') return { label: 'Manager', color: '#0284C7', isSystem: true };
    return { label: 'Subscriber', color: '#059669', isSystem: true };
  };

  // ── Avatar style helper ──
  const getAvatarStyle = (name: string, role: string) => {
    if (role === 'admin') {
      return 'bg-gradient-to-tr from-brand-600 to-indigo-500 text-white';
    }
    const colors = [
      'bg-amber-100 text-amber-800',
      'bg-purple-100 text-purple-700',
      'bg-blue-100 text-blue-700',
      'bg-teal-100 text-teal-800',
      'bg-emerald-100 text-emerald-800',
      'bg-indigo-100 text-indigo-700',
    ];
    const charCode = (name.charCodeAt(0) || 0) + (name.charCodeAt(name.length - 1) || 0);
    return colors[charCode % colors.length];
  };

  // ── Initials helper for mobile avatars ──
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // ── Mobile avatar palette helper from Stitch design ──
  const getMobileCardAvatar = (member: MemberRecord, idx: number) => {
    if (member.role === 'admin') {
      return {
        bg: 'bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white',
        ticketText: 'text-indigo-100',
      };
    }
    const palettes = [
      { bg: 'bg-amber-100 text-amber-800', ticketText: 'text-amber-700' },
      { bg: 'bg-purple-100 text-purple-700', ticketText: 'text-purple-600' },
      { bg: 'bg-blue-100 text-blue-700', ticketText: 'text-blue-600' },
      { bg: 'bg-teal-100 text-teal-800', ticketText: 'text-teal-700' },
    ];
    return palettes[idx % palettes.length];
  };

  // ── Live status helper for mobile card roster ──
  const getMemberStatusInfo = (member: MemberRecord) => {
    const wonLog = allAuctionLogs.find((a: any) => a.winning_bidder_id === member.id);
    const isWinner = !!wonLog;
    const netPayout = wonLog
      ? Math.max(0, Number(wonLog.total_value || 100000) - Number(wonLog.winning_discount || 0))
      : 0;

    const memberTxs = allTransactions.filter(
      (t: any) => t.profile_id === member.id && t.type === 'collection'
    );
    const totalPaid = memberTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    let totalExpected = 0;
    member.groups.forEach((g) => {
      const totalVal = Number(g.totalValue || 100000);
      const duration = Number(g.duration || 20);
      const currentMonth = Number(g.currentMonth ?? 1);
      const inst = duration > 0 ? totalVal / duration : 10000;
      totalExpected += inst * Math.max(1, currentMonth + 1);
    });
    const outstandingDue = Math.max(0, totalExpected - totalPaid);

    const isPassbookLinked = !!member.passbookToken;
    const isDefaultMpin = !member.mpin || member.mpin === '1234';

    return {
      isWinner,
      wonMonth: wonLog?.month,
      netPayout,
      totalPaid,
      outstandingDue,
      isPassbookLinked,
      isDefaultMpin,
    };
  };

  // ── Statistics calculation ──
  const stats = useMemo(() => {
    const total = members.length;
    const activeInChits = members.filter((m) => m.groups.length > 0).length;
    const adminCount = members.filter((m) => m.role === 'admin').length;
    const managerCount = members.filter((m) => m.role === 'manager').length;
    const subscriberCount = members.filter((m) => m.role === 'subscriber').length;
    const customRolesCount = customRoles.filter((r) => !r.is_system).length;
    const qrLinkedCount = members.filter((m) => !!m.passbookToken).length;
    const blockedCount = members.filter((m) => !!m.isBlocked).length;
    const customMpinCount = members.filter((m) => m.mpin && m.mpin !== '1234').length;
    const pendingMpinCount = members.filter((m) => !m.mpin || m.mpin === '1234').length;
    const mpinPercent = total > 0 ? Math.round((customMpinCount / total) * 100) : 0;
    const totalTickets = members.reduce((sum, m) => sum + m.groups.length, 0);
    const dualTicketHolders = members.filter((m) => m.groups.length > 1).length;

    return {
      total,
      activeInChits,
      adminCount,
      managerCount,
      subscriberCount,
      customRolesCount,
      qrLinkedCount,
      blockedCount,
      customMpinCount,
      pendingMpinCount,
      mpinPercent,
      totalTickets,
      dualTicketHolders,
    };
  }, [members, customRoles]);

  // ── Filtered members list ──
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Role filter
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;

      // Group filter
      if (groupFilter !== 'all' && !m.groups.some((g) => g.id === groupFilter)) return false;

      // Table Status filter
      if (tableFilter === 'paired' && !m.passbookToken) return false;
      if (tableFilter === 'unpaired' && m.passbookToken) return false;
      if (tableFilter === 'pending_mpin' && (m.mpin && m.mpin !== '1234')) return false;
      if (tableFilter === 'blocked' && !m.isBlocked) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        m.fullName.toLowerCase().includes(q) ||
        m.phoneNumber.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        (m.passbookToken && m.passbookToken.toLowerCase().includes(q)) ||
        m.groups.some((g) => g.name.toLowerCase().includes(q) || String(g.ticket).includes(q))
      );
    });
  }, [members, roleFilter, groupFilter, qrFilter, tableFilter, searchQuery]);

  // ── Active Drawer Member for Desktop Inspection Panel ──
  const activeDrawerMember = useMemo(() => {
    if (drawerMemberId) {
      const found = members.find((m) => m.id === drawerMemberId);
      if (found) return found;
    }
    return filteredMembers[0] || members[0] || null;
  }, [drawerMemberId, filteredMembers, members]);

  // ── Live Financial Aggregates for Active Drawer Member ──
  const activeDrawerFinancials = useMemo(() => {
    if (!activeDrawerMember) {
      return {
        totalPaid: 0,
        outstandingDue: 0,
        enrolledValue: 0,
        prizeWon: 'None Yet',
        prizeWonSub: 'Eligible to Bid',
      };
    }

    // 1. Enrolled chit value
    const enrolledValue = activeDrawerMember.groups.reduce((sum, g) => {
      return sum + Number(g.totalValue || 100000);
    }, 0);

    // 2. Collections paid
    const memberTxs = allTransactions.filter(
      (t: any) => t.profile_id === activeDrawerMember.id && t.type === 'collection'
    );
    const totalPaid = memberTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    // 3. Expected dues
    let totalExpected = 0;
    activeDrawerMember.groups.forEach((g) => {
      const totalVal = Number(g.totalValue || 100000);
      const duration = Number(g.duration || 20);
      const currentMonth = Number(g.currentMonth ?? 1);
      const inst = duration > 0 ? totalVal / duration : 10000;
      totalExpected += inst * Math.max(1, currentMonth + 1);
    });

    const outstandingDue = Math.max(0, totalExpected - totalPaid);

    // 4. Prize won check in auction_logs
    const wonLog = allAuctionLogs.find((a: any) => a.winning_bidder_id === activeDrawerMember.id);
    let prizeWon = 'None Yet';
    let prizeWonSub = 'Eligible to Bid';
    if (wonLog) {
      prizeWon = `Month ${wonLog.month} Winner`;
      prizeWonSub = `Disbursed ₹${Number(wonLog.winning_discount || 0).toLocaleString('en-IN')}`;
    }

    return { totalPaid, outstandingDue, enrolledValue, prizeWon, prizeWonSub };
  }, [activeDrawerMember, allTransactions, allAuctionLogs]);

  // ── Reset MPIN to Default 1234 ──
  const handleResetMpin = async (member: MemberRecord) => {
    if (!confirm(`Reset quick login MPIN for "${member.fullName}" to default "1234"?`)) return;
    try {
      const { error } = await supabase.from('profiles').update({ mpin: '1234' }).eq('id', member.id);
      if (error) throw error;
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, mpin: '1234' } : m)));
      alert(`MPIN for ${member.fullName} has been reset to default 1234.`);
      if (onAddAuditLog) onAddAuditLog(`MPIN RESET: Reset MPIN for ${member.fullName} to default 1234`);
    } catch (err: any) {
      alert(`Failed to reset MPIN: ${err.message}`);
    }
  };

  // ── Send WhatsApp Notification for MPIN ──
  const handleNotifyMpin = (member: MemberRecord) => {
    const cleanPhone = normalizePhoneDigits(member.phoneNumber);
    if (!cleanPhone) {
      alert('This member has no phone number recorded.');
      return;
    }
    const text = encodeURIComponent(
      `Hello ${member.fullName},\n\nYour ChitFunds Portal quick login MPIN is set to default 1234.\n\nPlease log in to your account and set your personalized 4-digit security MPIN.`
    );
    window.open(`https://wa.me/91${cleanPhone}?text=${text}`, '_blank');
  };

  // ── Quick Role Change ──
  const handleQuickRoleChange = async (userId: string, newTargetRole: string, userName: string) => {
    if (userId === currentAdminProfile?.id) {
      alert('Security Warning: You cannot modify your own administrator role to prevent lockouts.');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newTargetRole })
        .eq('id', userId);

      if (error) throw error;

      setMembers((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newTargetRole } : p))
      );

      if (onAddAuditLog) {
        onAddAuditLog(`ROLE CHANGE: Assigned role [${newTargetRole}] to ${userName}`);
      }
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  // ── Quick Block / Unblock Portal Access ──
  const handleToggleBlock = async (m: MemberRecord) => {
    if (m.id === currentAdminProfile?.id) {
      alert('Security Protection: You cannot block your own active administrator account.');
      return;
    }

    const newStatus = !m.isBlocked;
    const actionName = newStatus ? 'block portal access for' : 'unblock portal access for';
    if (!confirm(`Are you sure you want to ${actionName} "${m.fullName}"?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: newStatus })
        .eq('id', m.id);

      if (error) throw error;

      setMembers((prev) =>
        prev.map((item) => (item.id === m.id ? { ...item, isBlocked: newStatus } : item))
      );

      if (onAddAuditLog) {
        onAddAuditLog(`${newStatus ? 'BLOCKED' : 'UNBLOCKED'} portal access for subscriber ${m.fullName}`);
      }
    } catch (err: any) {
      alert(`Failed to update access status: ${err.message}`);
    }
  };

  // 📷 Handle QR Pairing
  const handlePairScanSuccess = async (scannedToken: string) => {
    if (!pairingMember) return;

    try {
      const { data, error } = await supabase.rpc('pair_passbook_qr', {
        p_token: scannedToken,
        p_profile_id: pairingMember.id,
      });

      if (error) throw error;
      if (!data || !data.success) throw new Error(data?.error || 'Failed to pair QR code.');

      alert(`Success: Passbook QR token paired to ${pairingMember.fullName}!`);
      setPairingMember(null);
      await fetchData();

      if (onAddAuditLog) {
        onAddAuditLog(`PAIRED Passbook QR [${scannedToken.slice(0, 8)}...] to ${pairingMember.fullName}`);
      }
    } catch (err: any) {
      alert(`Pairing Failed: ${err.message}`);
    }
  };

  // 🔗 Revoke / Unlink Passbook QR
  const handleUnlinkPassbook = async (e: React.MouseEvent, m: MemberRecord) => {
    e.stopPropagation();
    if (!m.passbookToken) return;

    if (!confirm(`Are you sure you want to unlink the passbook QR token from "${m.fullName}"?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('revoke_passbook_qr', {
        p_profile_id: m.id,
      });

      if (error) throw error;
      if (!data || !data.success) throw new Error(data?.error || 'Failed to revoke QR code.');

      alert(`Passbook QR unlinked from ${m.fullName}.`);
      await fetchData();

      if (onAddAuditLog) {
        onAddAuditLog(`REVOKED Passbook QR for ${m.fullName}`);
      }
    } catch (err: any) {
      alert(`Unlink failed: ${err.message}`);
    }
  };

  // 🖨️ Print Single Member Stickers
  const handlePrintMemberStickers = (e?: React.MouseEvent, member?: MemberRecord | null) => {
    if (e) e.stopPropagation();
    const target = member || activeDrawerMember;
    if (!target) return;
    if (!target.passbookToken) {
      alert(`This member does not have a Passbook QR token linked yet. Tap "Pair QR" first.`);
      return;
    }

    const items: StickerItem[] = [];

    if (target.groups.length > 0) {
      target.groups.forEach((g) => {
        items.push({
          token: target.passbookToken!,
          name: target.fullName,
          phone: target.phoneNumber,
          groupName: g.name,
          ticketNumber: g.ticket,
        });
      });
    } else {
      items.push({
        token: target.passbookToken,
        name: target.fullName,
        phone: target.phoneNumber,
        groupName: 'Universal Passbook',
      });
    }

    setPrintItems(items);
    setPrintSheetTitle(`${target.fullName} — Passbook Sticker Sheet (${items.length} copies)`);
    setIsPrintModalOpen(true);
  };

  // 🖨️ Print All Filtered Members Stickers
  const handlePrintAllStickers = () => {
    const items: StickerItem[] = [];

    filteredMembers.forEach((m) => {
      if (m.passbookToken) {
        if (m.groups.length > 0) {
          m.groups.forEach((g) => {
            items.push({
              token: m.passbookToken!,
              name: m.fullName,
              phone: m.phoneNumber,
              groupName: g.name,
              ticketNumber: g.ticket,
            });
          });
        } else {
          items.push({
            token: m.passbookToken,
            name: m.fullName,
            phone: m.phoneNumber,
            groupName: 'Universal Passbook',
          });
        }
      }
    });

    if (items.length === 0) {
      alert('No members with linked passbook tokens found in the current view.');
      return;
    }

    setPrintItems(items);
    setPrintSheetTitle(`All Members Passbook Sticker Sheet (${items.length} stickers)`);
    setIsPrintModalOpen(true);
  };

  // 💬 Share WhatsApp Passbook Card
  const handleShareWhatsApp = (e: React.MouseEvent, member: MemberRecord) => {
    e.stopPropagation();
    const cleanPhone = normalizePhoneDigits(member.phoneNumber);
    if (!cleanPhone) {
      alert('This member does not have a valid mobile number.');
      return;
    }

    const scanUrl = member.passbookToken ? getPassbookScanUrl(member.passbookToken) : 'https://chitfund.app';
    const message = `📱 *Hello ${member.fullName}!*
Welcome to your Chit Fund Member Portal.

Access your digital passbook, payment ledger & live auction bidding anytime:
🔗 *Passbook Direct Link*: ${scanUrl}
👤 *Mobile Number*: ${cleanPhone}
🔑 *Login PIN*: Use the default PIN *1234* and change it after your first login.

_(Point any camera at your physical pocket book QR sticker to log in instantly)_`;

    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Maintenance Toggle Action
  const handleToggleMaintenance = async () => {
    const nextState = !isMaintenanceMode;
    const promptText = nextState
      ? "⚠️ Turn ON System Maintenance Mode?\n\nNon-admin users (Subscribers and Managers) will immediately be restricted from accessing the portal and will see the 'System Maintenance in Progress' screen.\n\nOnly logged-in Administrators will have workspace access."
      : "Turn OFF Maintenance Mode and restore portal access for all members?";

    if (!confirm(promptText)) return;

    try {
      setIsTogglingMaintenance(true);
      const res = await toggleMaintenanceMode(nextState);
      if (!res.success) {
        alert(`Failed to update maintenance mode: ${res.error}`);
      } else {
        if (onAddAuditLog) {
          onAddAuditLog(`SYSTEM: ${nextState ? 'ENABLED' : 'DISABLED'} System Maintenance Mode`);
        }
      }
    } catch (err: any) {
      alert(`Error toggling maintenance mode: ${err.message}`);
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  // Open Add Member Modal
  const handleOpenAddModal = () => {
    setEditingMember(null);
    setNewFullName('');
    setNewPhoneNumber('');
    setNewRole('subscriber');
    setEditIsBlocked(false);
    setIsAddModalOpen(true);
  };

  // Open Edit Member Modal
  const handleOpenEditModal = (e: React.MouseEvent, member: MemberRecord) => {
    e.stopPropagation();
    setEditingMember(member);
    setNewFullName(member.fullName);
    setNewPhoneNumber(member.phoneNumber);
    setNewRole(member.role);
    setEditIsBlocked(member.isBlocked || false);
    setIsAddModalOpen(true);
  };

  // Submit Add or Edit Member Form
  const handleSubmitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanName = newFullName.trim();
    const cleanPhone = normalizePhoneDigits(newPhoneNumber);

    if (!cleanName) {
      alert('Please enter a valid member name.');
      return;
    }

    if (cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingMember) {
        const isTargetAdmin = editingMember.id === currentAdminProfile?.id;
        const finalBlockedStatus = isTargetAdmin ? false : editIsBlocked;

        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: cleanName,
            phone_number: cleanPhone,
            role: newRole,
            is_blocked: finalBlockedStatus,
          })
          .eq('id', editingMember.id);

        if (error) throw error;

        if (onAddAuditLog) {
          onAddAuditLog(
            `EDIT profile: Updated details for ${cleanName} (${cleanPhone}) [Role: ${newRole}]`
          );
        }
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            full_name: cleanName,
            phone_number: cleanPhone,
            role: newRole,
          });

        if (error) throw error;

        if (onAddAuditLog) {
          onAddAuditLog(
            `REGISTER new profile: Created ${cleanName} (${cleanPhone}) [Role: ${newRole}]`
          );
        }
      }

      setIsAddModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving member:', err);
      alert('Database error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Member Profile
  const handleDeleteMember = async (e: React.MouseEvent, member: MemberRecord) => {
    e.stopPropagation();
    if (member.id === currentAdminProfile?.id) {
      alert('Security Protection: You cannot delete your own active administrator account.');
      return;
    }

    // Check transaction history
    const { data: txs } = await supabase
      .from('transactions')
      .select('id')
      .eq('profile_id', member.id);

    const txCount = txs?.length || 0;
    const confirmPrompt = txCount > 0
      ? `"${member.fullName}" has ${txCount} historical financial transaction record(s).\n\nTo preserve accounting ledger integrity, their profile will be archived and hidden from active rosters, while all transaction history is securely retained.\n\nProceed to archive this member?`
      : `Are you sure you want to remove "${member.fullName}"? This will archive their profile.`;

    if (!confirm(confirmPrompt)) {
      return;
    }

    try {
      // Soft-delete profile
      const { error } = await supabase
        .from('profiles')
        .update({ is_deleted: true })
        .eq('id', member.id);
      if (error) throw error;

      // Log in security audit logs
      await supabase.from('security_audit_logs').insert({
        admin_id: currentAdminProfile?.id || null,
        action_description: `MEMBER ARCHIVED: ${member.fullName} (${member.phoneNumber || 'No Phone'}) archived by admin. ${txCount} transactions preserved in ledger.`,
        target_table: 'profiles',
      });

      if (onAddAuditLog) {
        onAddAuditLog(`ARCHIVE subscriber profile: ${member.fullName} (${txCount} txs preserved)`);
      }

      await fetchData();
    } catch (err: any) {
      console.error('Error archiving member:', err);
      alert('Error archiving member: ' + err.message);
    }
  };

  // If a member is selected, render their dedicated Member Profile Detail View
  if (selectedMemberId) {
    return (
      <MemberDetailsView
        memberId={selectedMemberId}
        onBack={() => setSelectedMemberId(null)}
        onAddAuditLog={onAddAuditLog}
      />
    );
  }

  // Linked subscribers for QR Center
  const linkedSubscribersForCenter: StickerItem[] = members
    .filter((m) => m.passbookToken)
    .map((m) => ({
      token: m.passbookToken!,
      name: m.fullName,
      phone: m.phoneNumber,
      groupName: m.groups[0]?.name || 'Universal Passbook',
      ticketNumber: m.groups[0]?.ticket,
    }));

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs animate-in fade-in duration-200">
      
      {/* ── DESKTOP HEADER (hidden md:flex) ── */}
      <header className="hidden md:flex min-h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3 items-center justify-between gap-4 flex-shrink-0 z-20">
        {/* Header Left: Clean Title, Badge & Subtabs */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold font-display text-slate-900 tracking-tight whitespace-nowrap">
              Members Directory &amp; Access Control
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/60 whitespace-nowrap">
              {currentSubtab === 'roles'
                ? `${customRoles.filter((r) => r.is_system).length || 3} System Roles · ${customRoles.filter((r) => !r.is_system).length || 3} Custom`
                : `${stats.total} Registered`}
            </span>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

          {/* Clean Subtab Switcher */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/70 text-xs">
            <button
              type="button"
              onClick={() => setCurrentSubtab('directory')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                currentSubtab === 'directory'
                  ? 'bg-white font-bold text-brand-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Members Directory
            </button>
            <button
              type="button"
              onClick={() => setCurrentSubtab('roles')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                currentSubtab === 'roles'
                  ? 'bg-white font-bold text-brand-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <span>Roles &amp; Staff</span>
              {currentSubtab === 'roles' && (
                <span className="text-[9px] bg-brand-100 text-brand-700 font-bold px-1.5 py-0.2 rounded-full">
                  Active
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Header Right */}
        {currentSubtab === 'roles' ? (
          <div className="flex items-center gap-3">
            {/* Maintenance Mode Switch */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs">
              <span className={`w-2 h-2 rounded-full ${isMaintenanceMode ? 'bg-amber-500 ring-2 ring-amber-200 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">Maintenance</span>
              <div className="h-3 w-px bg-slate-200"></div>
              <button
                type="button"
                disabled={isTogglingMaintenance}
                onClick={handleToggleMaintenance}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors uppercase cursor-pointer ${
                  isMaintenanceMode ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
              >
                {isMaintenanceMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Export Roles Policy */}
            <button
              type="button"
              onClick={handleExportRolesPolicy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Policy</span>
            </button>

            {/* Create Custom Role CTA */}
            <button
              type="button"
              onClick={() => setIsCreateRoleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold rounded-xl shadow-sm shadow-brand-500/25 transition-all whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              <span>+ Create Custom Role</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            {/* Chit Group Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setGroupFilter('all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer ${
                  groupFilter === 'all'
                    ? 'bg-white text-xs font-bold text-slate-900 shadow-xs border border-slate-200/60'
                    : 'text-xs font-medium text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>All Groups</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                  {allChitGroups.length} Pools
                </span>
              </button>
              {allChitGroups.map((g, idx) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupFilter(g.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer ${
                    groupFilter === g.id
                      ? 'bg-white text-xs font-bold text-slate-900 shadow-xs border border-slate-200/60'
                      : 'text-xs font-medium text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${idx % 2 === 0 ? 'bg-indigo-500' : 'bg-amber-400'}`}></span>
                  <span>{g.name}</span>
                </button>
              ))}
            </div>

            {/* Clean Enroll Member CTA */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold rounded-xl shadow-sm shadow-brand-500/25 transition-all whitespace-nowrap cursor-pointer"
            >
              <UserPlus size={14} />
              <span>Enroll Member</span>
            </button>
          </div>
        )}
      </header>

      {/* ── MOBILE TOP BAR & QUICK FILTERS (md:hidden from Stitch) ── */}
      <header className="md:hidden bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 safe-top">
        {/* App Title & Sub-header */}
        <div className="px-5 pt-3 pb-3 flex flex-col gap-3.5 border-b border-slate-100/80">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Members &amp; Passbooks</h1>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Add Member</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCurrentSubtab('directory')}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  currentSubtab === 'directory'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Members Directory
              </button>
              <button
                type="button"
                onClick={() => setCurrentSubtab('roles')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  currentSubtab === 'roles'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Roles &amp; Staff</span>
                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-bold">
                  {customRoles.length + 3}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl shadow-xs">
              <span className={`w-2 h-2 rounded-full ${isMaintenanceMode ? 'bg-amber-500 ring-2 ring-amber-200 animate-pulse' : 'bg-emerald-500 ring-2 ring-emerald-200'}`}></span>
              <span className="text-[10px] font-bold text-slate-600">Portal:</span>
              <button
                type="button"
                disabled={isTogglingMaintenance}
                onClick={handleToggleMaintenance}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  isMaintenanceMode ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700 hover:bg-amber-100'
                }`}
              >
                {isMaintenanceMode ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="px-5 pb-3">
          <div 
            className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              type="button"
              onClick={() => setTableFilter('all')}
              className={`flex-shrink-0 px-3 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                tableFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('paired')}
              className={`flex-shrink-0 px-3 py-1 rounded-full transition-all cursor-pointer ${
                tableFilter === 'paired'
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
              }`}
            >
              Linked QR ({stats.qrLinkedCount})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('unpaired')}
              className={`flex-shrink-0 px-3 py-1 rounded-full transition-all cursor-pointer ${
                tableFilter === 'unpaired'
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'bg-white border border-slate-200 text-amber-700 font-medium hover:bg-slate-50'
              }`}
            >
              Unlinked ({stats.total - stats.qrLinkedCount})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('pending_mpin')}
              className={`flex-shrink-0 px-3 py-1 rounded-full transition-all cursor-pointer ${
                tableFilter === 'pending_mpin'
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'bg-white border border-slate-200 text-slate-500 font-medium hover:bg-slate-50'
              }`}
            >
              Pending MPIN ({stats.pendingMpinCount})
            </button>
          </div>
        </div>
      </header>

      {/* ── SUBTAB 1: ROLES & PERMISSIONS VIEW ── */}
      {currentSubtab === 'roles' && (
        <RoleManagerPanel
          onRoleUpdated={() => {
            fetchCustomRoles();
            fetchData();
          }}
          isCreateModalOpen={isCreateRoleModalOpen}
          setIsCreateModalOpen={setIsCreateRoleModalOpen}
          onExportPolicy={handleExportRolesPolicy}
        />
      )}

      {/* ── SUBTAB 2: MEMBERS DIRECTORY VIEW ── */}
      {currentSubtab === 'directory' && (
        <main className="flex-1 overflow-y-auto p-4 sm:p-7">
          <div className="w-full max-w-[1550px] mx-auto space-y-6">

            {/* Top Stat KPI Strip with Contextual Actions Relocated from Header */}
            <section className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              {/* KPI 1: Subscribers Roster */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subscribers Roster</span>
                    <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold font-display">
                      {stats.total}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black font-display text-slate-900">{stats.total}</span>
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                      {stats.subscriberCount} Subscribers / {stats.adminCount + stats.managerCount} Staff
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-emerald-600 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>
                    {stats.blockedCount === 0 ? '100% active account standing' : `${stats.total - stats.blockedCount} active standing (${stats.blockedCount} blocked)`}
                  </span>
                </div>
              </div>

              {/* KPI 2: Physical Passbook QRs */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Physical Passbook QRs</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60 whitespace-nowrap">
                      {stats.qrLinkedCount} Paired
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black font-display text-slate-900">
                      {stats.qrLinkedCount} <span className="text-base font-normal text-slate-400">/ {stats.total}</span>
                    </span>
                    <span className="text-xs text-amber-600 font-semibold whitespace-nowrap">
                      ({stats.total - stats.qrLinkedCount} Unlinked)
                    </span>
                  </div>
                </div>
                {/* Integrated Contextual Logistics Action Pills */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInventoryOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 font-semibold bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Layers size={13} className="text-slate-500" />
                    <span>QR Inventory</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubscribersForPrint(null);
                      setQrCenterTab('subscribers');
                      setIsQrCenterOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 font-semibold bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Printer size={13} className="text-brand-600" />
                    <span>Print Sheet</span>
                  </button>
                </div>
              </div>

              {/* KPI 3: MPIN Security Set */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">MPIN Security Set</span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-brand-700 text-[10px] font-bold border border-brand-200/60 whitespace-nowrap">
                      {stats.customMpinCount} / {stats.total} Ready
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black font-display text-slate-900">{stats.mpinPercent}%</span>
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Quick Login Enabled</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{stats.total - stats.customMpinCount} pending self-service MPIN</span>
                  <span
                    onClick={() => {
                      const firstPending = members.find(m => !m.mpin || m.mpin === '1234');
                      if (firstPending) handleNotifyMpin(firstPending);
                    }}
                    className="text-brand-600 font-semibold cursor-pointer hover:underline text-[11px]"
                  >
                    Notify
                  </span>
                </div>
              </div>

              {/* KPI 4: Multi-Group Tickets */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Multi-Group Tickets</span>
                    <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center text-xs font-bold">
                      🎟️
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black font-display text-slate-900">{stats.totalTickets}</span>
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Active Subscriptions</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-indigo-600 font-medium">
                  {stats.dualTicketHolders} members hold dual tickets in secondary group
                </div>
              </div>
            </section>

            {/* ── DESKTOP MASTER LAYOUT: Table (68%) + Live Member Profile Drawer (32%) ── */}
            <div className="hidden md:grid grid-cols-1 xl:grid-cols-12 gap-7 items-start">
              
              {/* Table Section: 8 cols out of 12 */}
              <section className="xl:col-span-8 bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
                <div>
                  {/* Table Header Toolbar */}
                  <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative w-60">
                        <input
                          type="text"
                          placeholder="Search name, ticket or phone..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-brand-500 focus:border-brand-500 transition-all focus:outline-none"
                        />
                        <Search size={14} className="text-slate-400 absolute left-2.5 top-2.5" />
                      </div>

                      {/* Filter Pills */}
                      <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setTableFilter('all')}
                          className={`px-2 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                            tableFilter === 'all'
                              ? 'bg-white text-slate-900 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          All ({stats.total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableFilter('paired')}
                          className={`px-2 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                            tableFilter === 'paired'
                              ? 'bg-white text-slate-900 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          QR Paired ({stats.qrLinkedCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableFilter('unpaired')}
                          className={`px-2 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                            tableFilter === 'unpaired'
                              ? 'bg-white text-slate-900 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Unpaired ({stats.total - stats.qrLinkedCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableFilter('blocked')}
                          className={`px-2 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                            tableFilter === 'blocked'
                              ? 'bg-white text-slate-900 shadow-2xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Blocked ({stats.blockedCount})
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs">
                        <span className={`w-2 h-2 rounded-full ${isMaintenanceMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                        <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                          {isMaintenanceMode ? 'Maintenance Mode' : 'Portal Active'}
                        </span>
                        <div className="h-3 w-px bg-slate-200"></div>
                        <label className="inline-flex items-center cursor-pointer" title="Toggle subscriber audit maintenance lock">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 mr-1.5 whitespace-nowrap">Audit Lock</span>
                          <button
                            type="button"
                            disabled={isTogglingMaintenance}
                            onClick={handleToggleMaintenance}
                            className={`w-6 h-3.5 rounded-full relative transition-colors p-0.5 flex items-center cursor-pointer ${
                              isMaintenanceMode ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
                            }`}
                          >
                            <div className="w-2.5 h-2.5 bg-white rounded-full shadow-xs"></div>
                          </button>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (activeDrawerMember) handleShareWhatsApp({} as any, activeDrawerMember);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Share2 size={13} className="text-slate-500" />
                        <span>WhatsApp Notice</span>
                      </button>
                    </div>
                  </div>

                  {/* Members List Table Stream */}
                  <div className="divide-y divide-slate-100 text-xs">
                    {filteredMembers.length === 0 ? (
                      <div className="py-14 text-center text-slate-400 text-xs font-medium">
                        No members found matching your search. Use &quot;Enroll Member&quot; to add new subscribers.
                      </div>
                    ) : (
                      filteredMembers.map((member) => {
                        const initial = member.fullName.charAt(0).toUpperCase();
                        const isSelected = member.id === activeDrawerMember?.id;
                        const avatarClass = getAvatarStyle(member.fullName, member.role);
                        const isCurrentAdmin = member.id === currentAdminProfile?.id;

                        return (
                          <div
                            key={member.id}
                            onClick={() => setDrawerMemberId(member.id)}
                            className={`grid grid-cols-12 px-6 py-4 items-center transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50/30 ring-1 ring-inset ring-brand-500/20'
                                : 'hover:bg-slate-50/70'
                            }`}
                          >
                            {/* Member Name, Role & Avatar (col-span-4) */}
                            <div className="col-span-4 flex items-center gap-3 min-w-0 pr-2">
                              <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center font-display shadow-xs shrink-0 ${avatarClass}`}>
                                {initial}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-bold text-slate-900 truncate ${member.isBlocked ? 'line-through text-slate-400' : ''}`}>
                                    {member.fullName}
                                  </span>
                                  <span className={`text-[10px] uppercase font-bold py-0.5 px-1.5 rounded leading-tight ${
                                    member.role === 'admin'
                                      ? 'bg-brand-100 text-brand-700'
                                      : member.role === 'manager'
                                      ? 'bg-sky-100 text-sky-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {member.role === 'admin' ? 'Admin' : member.role === 'manager' ? 'Manager' : 'Subscriber'}
                                  </span>
                                </div>
                                <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                                  {member.phoneNumber ? `+91 ${member.phoneNumber}` : '—'}
                                </p>
                              </div>
                            </div>

                            {/* Enrolled Chits (col-span-3) */}
                            <div className="col-span-3 pr-2">
                              {member.groups.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {member.groups.map((g, idx) => (
                                    <span
                                      key={idx}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold text-[11px] whitespace-nowrap ${
                                        idx % 2 === 0
                                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                                          : 'bg-amber-50 text-amber-800 border-amber-200/60'
                                      }`}
                                    >
                                      <span className="font-bold">{g.name}:</span> #{g.ticket}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No active groups</span>
                              )}
                            </div>

                            {/* Passbook QR Status (col-span-2) */}
                            <div className="col-span-2 pr-2" onClick={(e) => e.stopPropagation()}>
                              {member.passbookToken ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                    <span className="font-mono text-slate-800 font-semibold whitespace-nowrap text-[11px]">
                                      {member.passbookToken}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    Linked Booklet
                                  </span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPairingMember(member)}
                                  className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-bold bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 whitespace-nowrap cursor-pointer transition-colors"
                                >
                                  <Plus size={12} className="text-amber-600" />
                                  <span>Pair QR</span>
                                </button>
                              )}
                            </div>

                            {/* Status Pill (col-span-1) */}
                            <div className="col-span-1 text-center" onClick={(e) => e.stopPropagation()}>
                              {member.isBlocked ? (
                                <button
                                  type="button"
                                  disabled={isCurrentAdmin}
                                  onClick={() => handleToggleBlock(member)}
                                  className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer whitespace-nowrap"
                                  title="Blocked portal access: Click to unblock"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Blocked
                                </button>
                              ) : (!member.mpin || member.mpin === '1234') ? (
                                <button
                                  type="button"
                                  onClick={() => handleNotifyMpin(member)}
                                  className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer whitespace-nowrap"
                                  title="Default MPIN active: Click to notify via WhatsApp"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Pending
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isCurrentAdmin}
                                  onClick={() => handleToggleBlock(member)}
                                  className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                                  title="Active standing: Click to suspend"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active
                                </button>
                              )}
                            </div>

                            {/* Row Actions: WhatsApp & Passbook (col-span-2) */}
                            <div className="col-span-2 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => handleShareWhatsApp(e, member)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="WhatsApp Message"
                              >
                                <Share2 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedMemberId(member.id)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Passbook
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Pagination / Summary Footer */}
                <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Showing {filteredMembers.length} registered users</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">All data synchronized in real-time with Supabase</span>
                  </div>
                </div>
              </section>

              {/* Right Panel: Subscriber Inspection & Security Hub (4 cols out of 12) */}
              <aside className="xl:col-span-4 space-y-5">
                {activeDrawerMember ? (
                  <>
                    {/* Member Detail Card */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden">
                      {/* Member Profile Header with Edit Profile and Role Selection */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl font-bold flex items-center justify-center font-display text-base shadow-sm shrink-0 ${getAvatarStyle(activeDrawerMember.fullName, activeDrawerMember.role)}`}>
                            {activeDrawerMember.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-bold text-base text-slate-900 leading-tight truncate">
                                {activeDrawerMember.fullName}
                              </h3>
                              {/* Edit Profile Trigger */}
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditModal(e, activeDrawerMember)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded-md border border-brand-200/60 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <Edit3 size={11} />
                                <span>Edit</span>
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              📞 +91 {activeDrawerMember.phoneNumber || '—'}
                            </p>
                          </div>
                        </div>

                        {/* Role Assignment Dropdown */}
                        <div className="text-right shrink-0">
                          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Assigned Role</label>
                          <select
                            value={activeDrawerMember.role}
                            onChange={(e) => handleQuickRoleChange(activeDrawerMember.id, e.target.value, activeDrawerMember.fullName)}
                            disabled={activeDrawerMember.id === currentAdminProfile?.id}
                            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:ring-brand-500 focus:border-brand-500 cursor-pointer disabled:opacity-50"
                          >
                            <option value="subscriber">Subscriber</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                            {customRoles.filter((r) => !r.is_system).map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Physical QR Binding Card with Re-bind & Revoke Lifecycle Actions */}
                      <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center shadow-2xs shrink-0">
                              <QrCode size={22} className={activeDrawerMember.passbookToken ? 'text-slate-800' : 'text-slate-400'} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap ${
                                  activeDrawerMember.passbookToken
                                    ? 'text-emerald-700 bg-emerald-100/70'
                                    : 'text-amber-700 bg-amber-100/70'
                                }`}>
                                  {activeDrawerMember.passbookToken ? 'Passbook Linked' : 'Unlinked Passbook'}
                                </span>
                              </div>
                              <p className="font-mono text-xs font-bold text-slate-800 mt-0.5 truncate">
                                {activeDrawerMember.passbookToken || 'No QR paired'}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {activeDrawerMember.passbookToken ? 'Physical passbook booklet paired' : 'Scan blank QR to pair'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPairingMember(activeDrawerMember)}
                              className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 bg-white border border-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              {activeDrawerMember.passbookToken ? 'Re-bind' : 'Pair QR'}
                            </button>
                            {activeDrawerMember.passbookToken && (
                              <button
                                type="button"
                                onClick={(e) => handleUnlinkPassbook(e, activeDrawerMember)}
                                title="Revoke physical passbook authorization"
                                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Financial Ledger Aggregates (2x2 Grid) */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">Passbook Financial Summary</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Total Paid</span>
                            <p className="text-sm font-bold text-emerald-600 font-display mt-0.5">
                              ₹{activeDrawerFinancials.totalPaid.toLocaleString('en-IN')}
                            </p>
                            <span className="text-[10px] text-slate-400">Ledger Collections</span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Outstanding Due</span>
                            <p className="text-sm font-bold text-rose-600 font-display mt-0.5">
                              ₹{activeDrawerFinancials.outstandingDue.toLocaleString('en-IN')}
                            </p>
                            <span className="text-[10px] text-amber-600 font-semibold">
                              {activeDrawerFinancials.outstandingDue === 0 ? 'Fully Paid' : 'Cycle Pending'}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Enrolled Chit Value</span>
                            <p className="text-sm font-bold text-slate-900 font-display mt-0.5">
                              ₹{activeDrawerFinancials.enrolledValue.toLocaleString('en-IN')}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {activeDrawerMember.groups.length} Slot{activeDrawerMember.groups.length !== 1 ? 's' : ''} Enrolled
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Prize Pot Won</span>
                            <p className="text-sm font-bold text-slate-700 font-display mt-0.5">
                              {activeDrawerFinancials.prizeWon}
                            </p>
                            <span className="text-[10px] text-emerald-600 font-semibold">
                              {activeDrawerFinancials.prizeWonSub}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Account Moderation & Controls with Active/Suspended Segmented Control */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Account Moderation &amp; Controls</h4>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs border border-slate-100">
                          <div>
                            <p className="font-semibold text-slate-800">Quick Login MPIN</p>
                            <p className="text-[10px] text-slate-400">
                              {(!activeDrawerMember.mpin || activeDrawerMember.mpin === '1234')
                                ? 'Default PIN 1234 active'
                                : 'Initialized on member mobile device'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleResetMpin(activeDrawerMember)}
                            className="text-xs font-bold text-brand-600 hover:text-brand-700 px-2.5 py-1 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Reset MPIN
                          </button>
                        </div>

                        {/* High-visibility Active / Suspended Cutoff Toggle Control */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-800">Account Access State</p>
                              <p className="text-[10px] text-slate-400">Instant subscriber portal &amp; auction bidding cutoff</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
                            <button
                              type="button"
                              disabled={activeDrawerMember.id === currentAdminProfile?.id}
                              onClick={() => {
                                if (activeDrawerMember.isBlocked) handleToggleBlock(activeDrawerMember);
                              }}
                              className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${
                                !activeDrawerMember.isBlocked
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${!activeDrawerMember.isBlocked ? 'bg-white' : 'bg-slate-400'}`}></span>
                              <span>Active (Allowed)</span>
                            </button>
                            <button
                              type="button"
                              disabled={activeDrawerMember.id === currentAdminProfile?.id}
                              onClick={() => {
                                if (!activeDrawerMember.isBlocked) handleToggleBlock(activeDrawerMember);
                              }}
                              className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${
                                activeDrawerMember.isBlocked
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'hover:bg-white text-slate-600 hover:text-rose-700'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${activeDrawerMember.isBlocked ? 'bg-white' : 'bg-slate-400'}`}></span>
                              <span>Suspended</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Featured Secondary Actions: Full Passbook Ledger & Messaging */}
                      <div className="mt-5 space-y-2">
                        <button
                          type="button"
                          onClick={() => setSelectedMemberId(activeDrawerMember.id)}
                          className="w-full py-2.5 px-3 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-xs rounded-xl shadow-sm shadow-brand-500/25 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <BookOpen size={16} />
                          <span>View Subscriber Ledger &amp; Passbook</span>
                        </button>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={(e) => handleShareWhatsApp(e, activeDrawerMember)}
                            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Share2 size={14} />
                            <span>WhatsApp Notice</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handlePrintMemberStickers(e, activeDrawerMember)}
                            className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Printer size={14} />
                            <span>Export PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Batch QR Logistics Widget */}
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/20 text-indigo-100">
                          Physical Logistics
                        </span>
                        <span className="text-xs text-amber-300 font-semibold">
                          {stats.total - stats.qrLinkedCount} Awaiting Bind
                        </span>
                      </div>
                      <h4 className="font-display font-bold text-sm mt-2">Print Passbook QR Sticker Labels</h4>
                      <p className="text-xs text-slate-300 mt-1">
                        Generate high-density A4 label sheets (3x8 grid) with member names, ticket IDs, and encrypted QR check tokens for direct booklet pasting.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubscribersForPrint(null);
                          setQrCenterTab('batches');
                          setIsQrCenterOpen(true);
                        }}
                        className="mt-4 w-full py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Printer size={15} />
                        <span>Download PDF Sticker Sheet (A4)</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-xs">
                    Select a member from the directory to inspect their profile.
                  </div>
                )}
              </aside>
            </div>

            {/* ── MOBILE MEMBER CARDS STREAM (md:hidden from Stitch) ── */}
            <div className="md:hidden space-y-3.5 pb-28">
              {/* Search Input Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, ticket # or mobile..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200/90 rounded-2xl pl-9 pr-4 py-3 text-slate-800 placeholder-slate-400 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_2px_6px_-1px_rgba(15,23,42,0.02)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>

              {/* Subscriber Cards Roster (Clean & Decongested) */}
              {filteredMembers.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-500 text-xs shadow-2xs">
                  No members found matching your search. Use &quot;Add Member&quot; to enroll new subscribers.
                </div>
              ) : (
                filteredMembers.map((member, idx) => {
                  const initial = getInitials(member.fullName);
                  const cleanPhone = normalizePhoneDigits(member.phoneNumber);
                  const avatarStyle = getMobileCardAvatar(member, idx);
                  const firstTicket = member.groups[0]?.ticket;
                  const statusInfo = getMemberStatusInfo(member);

                  return (
                    <div
                      key={member.id}
                      onClick={() => setSelectedMemberId(member.id)}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_2px_6px_-1px_rgba(15,23,42,0.02)] hover:border-indigo-200 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3.5">
                          <div className={`w-12 h-12 rounded-2xl ${avatarStyle.bg} font-bold flex flex-col items-center justify-center shadow-xs shrink-0`}>
                            <span className="text-sm leading-none">{initial}</span>
                            {firstTicket && (
                              <span className={`text-[9px] font-mono mt-0.5 ${avatarStyle.ticketText}`}>
                                #{firstTicket}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">
                                {member.fullName}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              {cleanPhone ? `+91 ${cleanPhone}` : 'No phone recorded'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {statusInfo.isWinner ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Prize: ₹{statusInfo.netPayout.toLocaleString('en-IN')}
                            </span>
                          ) : statusInfo.outstandingDue > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Due: ₹{statusInfo.outstandingDue.toLocaleString('en-IN')}
                            </span>
                          ) : !statusInfo.isPassbookLinked ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              QR Unlinked
                            </span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          )}

                          <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </main>
      )}

      {/* ── ADD / EDIT MEMBER MODAL ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <UserPlus size={18} />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">
                  {editingMember ? 'Edit Member Profile' : 'Enroll New Member Profile'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitMember} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  10-Digit Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  System Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={editingMember?.id === currentAdminProfile?.id}
                  className={`w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-bold focus:outline-none ${
                    editingMember?.id === currentAdminProfile?.id ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="subscriber">👤 Subscriber (Passbook &amp; Auctions)</option>
                  <option value="manager">👔 Manager (Operations &amp; Collections)</option>
                  <option value="admin">👑 Admin (Full Workspace Access)</option>
                  {customRoles.filter((r) => !r.is_system).map((r) => (
                    <option key={r.id} value={r.id}>
                      🛡️ {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Block Portal Access Toggle in Edit Mode */}
              {editingMember && (
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  editIsBlocked
                    ? 'bg-rose-50 border-rose-200 ring-1 ring-rose-200'
                    : 'bg-gray-50/80 border-gray-200'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {editIsBlocked ? (
                          <Ban size={15} className="text-rose-600 shrink-0" />
                        ) : (
                          <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                        )}
                        <span className={`text-xs font-bold ${
                          editIsBlocked ? 'text-rose-900' : 'text-gray-900'
                        }`}>
                          Block Portal Access
                        </span>
                        {editIsBlocked && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-rose-200 text-rose-800">
                            Suspended
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        {editIsBlocked
                          ? 'Portal access is blocked. This user cannot sign in with phone/MPIN or passbook QR.'
                          : 'Allow user to sign in to member passbook, check balances, and bid in auctions.'}
                      </p>
                      {editingMember.id === currentAdminProfile?.id && (
                        <span className="text-[10px] text-amber-700 font-semibold block pt-0.5">
                          Security Notice: You cannot block your own active administrator account.
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={editingMember.id === currentAdminProfile?.id}
                      onClick={() => setEditIsBlocked(!editIsBlocked)}
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                        editIsBlocked ? 'bg-rose-600' : 'bg-gray-300'
                      } ${editingMember.id === currentAdminProfile?.id ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                          editIsBlocked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {isSubmitting ? 'Saving...' : editingMember ? 'Save Changes' : 'Enroll Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CAMERA QR SCANNER MODAL FOR PAIRING / RE-LINKING ── */}
      <PassbookScannerModal
        isOpen={!!pairingMember}
        onClose={() => setPairingMember(null)}
        onScanSuccess={handlePairScanSuccess}
        title={pairingMember?.passbookToken ? "Re-Link / Replace Passbook QR" : "Pair Physical Passbook QR"}
        subtitle={
          pairingMember?.passbookToken
            ? `Point camera at a new blank QR sticker to replace the lost/damaged passbook code for ${pairingMember.fullName}`
            : "Point camera at the QR sticker on the member's physical pocket book"
        }
        targetMemberName={pairingMember?.fullName}
      />

      {/* ── A4 PDF STICKER SHEET EXPORTER ── */}
      <PassbookSheetGeneratorModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        items={printItems}
        defaultTitle={printSheetTitle}
      />

      {/* ── BLANK QR INVENTORY MODAL ── */}
      <PassbookInventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        onRefresh={fetchData}
      />

      {/* ── UNIFIED PASSBOOK QR CENTER MODAL ── */}
      <PassbookQrCenterModal
        isOpen={isQrCenterOpen}
        onClose={() => {
          setIsQrCenterOpen(false);
          setSelectedSubscribersForPrint(null);
        }}
        registeredSubscribers={selectedSubscribersForPrint || linkedSubscribersForCenter}
        defaultTab={qrCenterTab}
        onRefresh={fetchData}
      />
    </div>
  );
}
