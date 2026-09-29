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
  KeyRound
} from 'lucide-react';

interface MemberGroupInfo {
  id: string;
  name: string;
  ticket: number;
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
  const [allChitGroups, setAllChitGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPins, setShowPins] = useState<boolean>(false);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [qrFilter, setQrFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

  // Selected member drilldown
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

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

  // Fetch all profiles, enrollments, and chit groups
  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
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
            name
          )
        `);

      if (memberGroupsError) {
        console.warn('Note fetching member groups:', memberGroupsError.message);
      }

      // 3. Fetch chit groups list for filter
      const { data: groupsData } = await supabase
        .from('chit_groups')
        .select('id, name')
        .order('name', { ascending: true });

      if (groupsData) {
        setAllChitGroups(groupsData);
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

    return { total, activeInChits, adminCount, managerCount, subscriberCount, customRolesCount, qrLinkedCount, blockedCount };
  }, [members, customRoles]);

  // ── Filtered members list ──
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Role filter
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;

      // Group filter
      if (groupFilter !== 'all' && !m.groups.some((g) => g.id === groupFilter)) return false;

      // QR filter
      if (qrFilter === 'linked' && !m.passbookToken) return false;
      if (qrFilter === 'unlinked' && m.passbookToken) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        m.fullName.toLowerCase().includes(q) ||
        m.phoneNumber.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.groups.some((g) => g.name.toLowerCase().includes(q) || String(g.ticket).includes(q))
      );
    });
  }, [members, roleFilter, groupFilter, qrFilter, searchQuery]);

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
  const handlePrintMemberStickers = (e: React.MouseEvent, member: MemberRecord) => {
    e.stopPropagation();
    if (!member.passbookToken) {
      alert(`This member does not have a Passbook QR token linked yet. Tap "Pair Passbook QR" first.`);
      return;
    }

    const items: StickerItem[] = [];

    if (member.groups.length > 0) {
      member.groups.forEach((g) => {
        items.push({
          token: member.passbookToken!,
          name: member.fullName,
          phone: member.phoneNumber,
          groupName: g.name,
          ticketNumber: g.ticket,
        });
      });
    } else {
      items.push({
        token: member.passbookToken,
        name: member.fullName,
        phone: member.phoneNumber,
        groupName: 'Universal Passbook',
      });
    }

    setPrintItems(items);
    setPrintSheetTitle(`${member.fullName} — Passbook Sticker Sheet (${items.length} copies)`);
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
🔑 *Initial MPIN*: ${member.mpin || '1234'}

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

    if (!confirm(`Are you sure you want to remove "${member.fullName}"? This will unenroll them from all chits and delete their profile.`)) {
      return;
    }

    try {
      await supabase.from('group_members').delete().eq('profile_id', member.id);
      const { error } = await supabase.from('profiles').delete().eq('id', member.id);
      if (error) throw error;

      if (onAddAuditLog) {
        onAddAuditLog(`DELETE subscriber profile: Removed ${member.fullName}`);
      }

      await fetchData();
    } catch (err: any) {
      console.error('Error deleting member:', err);
      alert('Error deleting member: ' + err.message);
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
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* ── 1. TOP HEADER & SUB-NAVIGATION RIBBON ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-gray-200 rounded-3xl p-3 sm:p-4 shadow-2xs">
        
        {/* Subtab Switchers */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 rounded-2xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setCurrentSubtab('directory')}
            className={`flex-1 sm:flex-none px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              currentSubtab === 'directory'
                ? 'bg-white text-gray-900 shadow-xs ring-1 ring-black/5'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Users size={15} className={currentSubtab === 'directory' ? 'text-indigo-600' : 'text-gray-400'} />
            <span>Members Directory</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
              currentSubtab === 'directory' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentSubtab('roles')}
            className={`flex-1 sm:flex-none px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              currentSubtab === 'roles'
                ? 'bg-white text-gray-900 shadow-xs ring-1 ring-black/5'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Shield size={15} className={currentSubtab === 'roles' ? 'text-indigo-600' : 'text-gray-400'} />
            <span>Roles &amp; Permissions</span>
            {stats.customRolesCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                currentSubtab === 'roles' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-200 text-gray-600'
              }`}>
                +{stats.customRolesCount}
              </span>
            )}
          </button>
        </div>

        {/* Top Actions: Maintenance Toggle, QR tools, Add Member & Refresh */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          
          {/* Portal Maintenance Mode Toggle */}
          <button
            type="button"
            disabled={isTogglingMaintenance}
            onClick={handleToggleMaintenance}
            className={`px-3 sm:px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-2xs active:scale-95 ${
              isMaintenanceMode
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 font-extrabold shadow-amber-500/20 ring-2 ring-amber-400/40 animate-pulse'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
            }`}
            title={
              isMaintenanceMode
                ? 'System Maintenance Mode is ON: Click to turn OFF'
                : 'Click to enable Portal Maintenance Mode'
            }
          >
            <Wrench
              size={13}
              className={isMaintenanceMode ? 'text-slate-950 animate-bounce' : 'text-gray-500'}
            />
            <span className="hidden md:inline">Maintenance</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                isMaintenanceMode
                  ? 'bg-slate-950 text-amber-300'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {isMaintenanceMode ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Blank QR Inventory */}
          <button
            type="button"
            onClick={() => setIsInventoryOpen(true)}
            className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-3 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
            title="Manage pre-printed physical QR stickers"
          >
            <Layers size={14} className="text-indigo-600" />
            <span className="hidden sm:inline">QR Inventory</span>
          </button>

          {/* Passbook QR Center */}
          <button
            type="button"
            onClick={() => {
              setSelectedSubscribersForPrint(null);
              setQrCenterTab('subscribers');
              setIsQrCenterOpen(true);
            }}
            className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-3 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
            title="Passbook QR batch generation and sticker printing hub"
          >
            <QrCode size={14} className="text-indigo-600" />
            <span className="hidden sm:inline">QR Center</span>
          </button>

          {/* Add Member Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <Plus size={14} />
            <span>Add Member</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              fetchData();
              fetchCustomRoles();
            }}
            title="Refresh Directory"
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-xl transition-all border border-gray-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* ── 2. SUBTAB CONTENT: ROLES & PERMISSIONS PANEL ── */}
      {currentSubtab === 'roles' && (
        <RoleManagerPanel
          onRoleUpdated={() => {
            fetchCustomRoles();
            fetchData();
          }}
        />
      )}

      {/* ── 3. SUBTAB CONTENT: MEMBERS DIRECTORY ── */}
      {currentSubtab === 'directory' && (
        <div className="space-y-4 sm:space-y-6">
          
          {/* Top Analytics 5-Card Stats Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Members</span>
                <Users size={15} className="text-slate-700" />
              </div>
              <p className="text-2xl font-black text-gray-900 mt-1">{stats.total}</p>
              <span className="text-[10px] text-gray-400 font-semibold">Registered in Directory</span>
            </div>

            <div className="bg-white border border-blue-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between text-blue-600">
                <span className="text-[11px] font-bold uppercase tracking-wider">In Chits</span>
                <Briefcase size={15} />
              </div>
              <p className="text-2xl font-black text-blue-700 mt-1">{stats.activeInChits}</p>
              <span className="text-[10px] text-blue-600 font-semibold">Enrolled Subscribers</span>
            </div>

            <div className="bg-white border border-purple-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between text-purple-600">
                <span className="text-[11px] font-bold uppercase tracking-wider">Admins</span>
                <ShieldCheck size={15} />
              </div>
              <p className="text-2xl font-black text-purple-700 mt-1">{stats.adminCount}</p>
              <span className="text-[10px] text-purple-600 font-semibold">Full System Access</span>
            </div>

            <div className="bg-white border border-sky-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between text-sky-600">
                <span className="text-[11px] font-bold uppercase tracking-wider">Managers</span>
                <UserCheck size={15} />
              </div>
              <p className="text-2xl font-black text-sky-700 mt-1">{stats.managerCount}</p>
              <span className="text-[10px] text-sky-600 font-semibold">Operations &amp; Bidding</span>
            </div>

            <div className="bg-white border border-emerald-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-emerald-600">
                <span className="text-[11px] font-bold uppercase tracking-wider">QR Linked</span>
                <QrCode size={15} />
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-1">{stats.qrLinkedCount}</p>
              <span className="text-[10px] text-emerald-600 font-semibold">Active Digital Keys</span>
            </div>
          </div>

          {/* Search, Group & Role Filters Bar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            
            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, phone, tickets, chit groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none shadow-2xs"
              />
            </div>

            {/* Filter Dropdowns & Print All */}
            <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
              
              {/* Chit Group Filter */}
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-700 focus:outline-none shadow-2xs"
              >
                <option value="all">All Chit Groups</option>
                {allChitGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-700 focus:outline-none shadow-2xs"
              >
                <option value="all">All Roles</option>
                <option value="subscriber">Subscriber</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                {customRoles.filter((r) => !r.is_system).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              {/* QR Status Filter */}
              <select
                value={qrFilter}
                onChange={(e) => setQrFilter(e.target.value as any)}
                className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-700 focus:outline-none shadow-2xs"
              >
                <option value="all">All Passbooks</option>
                <option value="linked">QR Linked 🟢</option>
                <option value="unlinked">Unlinked</option>
              </select>
            </div>
          </div>

          {/* ── MOBILE MEMBER CARDS STREAM (md:hidden) ── */}
          <div className="md:hidden space-y-3.5">
            {filteredMembers.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center text-gray-400 text-xs shadow-2xs">
                No members found matching your search. Use &quot;Add Member&quot; to enroll new subscribers.
              </div>
            ) : (
              filteredMembers.map((member) => {
                const initial = member.fullName.charAt(0).toUpperCase();
                const meta = getRoleMeta(member.role);
                const isCurrentAdmin = member.id === currentAdminProfile?.id;
                const cleanPhone = normalizePhoneDigits(member.phoneNumber);

                return (
                  <div
                    key={member.id}
                    onClick={() => setSelectedMemberId(member.id)}
                    className="bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs transition-all active:scale-[0.99] cursor-pointer"
                  >
                    {/* Header: Avatar, Name, Role badge, Blocked badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 text-white shadow-2xs ${
                            member.isBlocked ? 'ring-2 ring-rose-500 opacity-80' : ''
                          }`}
                          style={{ backgroundColor: meta.color }}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold text-gray-900 text-sm leading-snug ${member.isBlocked ? 'line-through text-gray-500' : ''}`}>
                              {member.fullName}
                            </span>
                            {isCurrentAdmin && (
                              <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-md">
                                You
                              </span>
                            )}
                            {member.isBlocked && (
                              <span className="text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                <Ban size={9} /> Blocked
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border text-white"
                              style={{ backgroundColor: meta.color, borderColor: meta.color }}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono">
                              ID: {member.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions: Edit & Delete */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditModal(e, member)}
                          title="Edit member profile"
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors active:scale-95"
                        >
                          <Edit3 size={15} />
                        </button>
                        {!isCurrentAdmin && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteMember(e, member)}
                            title="Remove member"
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors active:scale-95"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                        <ChevronRight size={18} className="text-gray-400 ml-0.5" />
                      </div>
                    </div>

                    {/* Passbook QR Status Strip */}
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-gray-150 text-xs" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <QrCode size={14} className={member.passbookToken ? 'text-indigo-600' : 'text-gray-400'} />
                        <span className="font-bold text-gray-700 text-[11px]">Passbook:</span>
                        {member.passbookToken ? (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                            Linked 🟢
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-md">
                            Unlinked
                          </span>
                        )}

                        <span className="text-[10px] font-mono font-bold bg-white border border-gray-200 px-1.5 py-0.5 rounded text-slate-700 flex items-center gap-0.5">
                          <KeyRound size={9} className="text-indigo-500" />
                          <span>{member.mpin || '1234'}</span>
                          {(!member.mpin || member.mpin === '1234') && (
                            <span className="text-[8px] font-bold text-amber-600 ml-0.5">(Def)</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPairingMember(member)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg shadow-2xs"
                        >
                          {member.passbookToken ? 'Re-Link 📷' : 'Pair QR 📷'}
                        </button>

                        {member.passbookToken && (
                          <button
                            type="button"
                            onClick={(e) => handleUnlinkPassbook(e, member)}
                            title="Unlink / Revoke lost passbook QR"
                            className="p-1.5 text-rose-500 hover:text-rose-700 bg-white border border-rose-200 rounded-lg"
                          >
                            <Unlink size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Enrolled Chits Badges */}
                    {member.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {member.groups.map((g, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 bg-gray-50 text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-xl border border-gray-200/80"
                          >
                            <span>{g.name}</span>
                            <strong className="text-indigo-600 font-mono">#{g.ticket}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Inline Role Selector Dropdown */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs font-bold text-gray-600">Assign Role:</span>
                      <select
                        value={member.role}
                        onChange={(e) => handleQuickRoleChange(member.id, e.target.value, member.fullName)}
                        disabled={isCurrentAdmin}
                        className={`bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-2.5 py-1 focus:outline-none focus:border-indigo-500 ${
                          isCurrentAdmin ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="subscriber">👤 Subscriber</option>
                        <option value="manager">👔 Manager</option>
                        <option value="admin">👑 Admin</option>
                        {customRoles.filter((r) => !r.is_system).map((r) => (
                          <option key={r.id} value={r.id}>
                            🛡️ {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Footer: Phone/WhatsApp & Block action */}
                    <div className="pt-2 flex items-center justify-between gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {cleanPhone ? (
                          <>
                            <a
                              href={`tel:+91${cleanPhone}`}
                              className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-gray-200 active:scale-95 transition-all"
                            >
                              <Phone size={12} className="text-indigo-600" />
                              <span>Call</span>
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleShareWhatsApp(e, member)}
                              className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-emerald-200 active:scale-95 transition-all"
                            >
                              <Share2 size={12} />
                              <span>WhatsApp</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No phone</span>
                        )}
                      </div>

                      {!isCurrentAdmin && (
                        <button
                          type="button"
                          onClick={() => handleToggleBlock(member)}
                          className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                            member.isBlocked
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {member.isBlocked ? <Ban size={12} /> : <UserX size={12} />}
                          <span>{member.isBlocked ? 'Unblock' : 'Block'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── DESKTOP MEMBERS DIRECTORY TABLE (hidden md:block) ── */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-3xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                  <tr>
                    <th className="py-4 px-6">Member Profile</th>
                    <th className="py-4 px-5">Phone</th>
                    <th className="py-4 px-5">
                      <div className="flex items-center gap-1.5">
                        <span>MPIN</span>
                        <button
                          type="button"
                          onClick={() => setShowPins(!showPins)}
                          title={showPins ? 'Hide All PINs' : 'Show All PINs'}
                          className="p-0.5 text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          {showPins ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </th>
                    <th className="py-4 px-5">Passbook QR Key</th>
                    <th className="py-4 px-5">Enrolled Chits &amp; Tickets</th>
                    <th className="py-4 px-5">Notice Acks</th>
                    <th className="py-4 px-5">Role &amp; Assignment</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center text-gray-400 text-xs">
                        No members found matching your search. Use &quot;Add Member&quot; to enroll new subscribers.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => {
                      const initial = member.fullName.charAt(0).toUpperCase();
                      const meta = getRoleMeta(member.role);
                      const isCurrentAdmin = member.id === currentAdminProfile?.id;
                      const cleanPhone = normalizePhoneDigits(member.phoneNumber);
                      const isDefaultPin = !member.mpin || member.mpin === '1234';

                      return (
                        <tr
                          key={member.id}
                          onClick={() => setSelectedMemberId(member.id)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          {/* Member Name & Avatar */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3.5">
                              <div
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 text-white group-hover:scale-105 transition-transform shadow-2xs ${
                                  member.isBlocked ? 'ring-2 ring-rose-500 opacity-80' : ''
                                }`}
                                style={{ backgroundColor: meta.color }}
                              >
                                {initial}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 block text-xs group-hover:text-indigo-600 transition-colors leading-snug flex items-center gap-1.5">
                                  <span className={member.isBlocked ? 'line-through text-gray-500' : ''}>
                                    {member.fullName}
                                  </span>
                                  {isCurrentAdmin && (
                                    <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-md">
                                      You
                                    </span>
                                  )}
                                  {member.isBlocked && (
                                    <span className="text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                      <Ban size={9} /> Blocked
                                    </span>
                                  )}
                                </span>
                                <span className="text-[11px] text-gray-400 font-mono mt-0.5 block">
                                  ID: {member.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-1.5 font-mono font-medium text-gray-700">
                              <span>{member.phoneNumber || '—'}</span>
                              {cleanPhone && (
                                <a
                                  href={`tel:+91${cleanPhone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Call member"
                                  className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                >
                                  <Phone size={11} />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Security PIN (MPIN) */}
                          <td className="py-4 px-5 font-mono" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 text-[11px] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                {showPins ? (member.mpin || '1234') : '••••'}
                              </span>
                              {isDefaultPin ? (
                                <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded">
                                  Default
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded">
                                  Custom
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Passbook QR Status & Tools */}
                          <td className="py-4 px-5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              {member.passbookToken ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                                  <CheckCircle2 size={11} /> Linked
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">
                                  Unlinked
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => setPairingMember(member)}
                                title={member.passbookToken ? "Re-link / Replace with a new blank QR sticker" : "Scan blank QR sticker on physical passbook to pair"}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                              >
                                <QrCode size={13} />
                              </button>

                              {member.passbookToken && (
                                <button
                                  type="button"
                                  onClick={(e) => handleUnlinkPassbook(e, member)}
                                  title="Unlink / Revoke lost passbook QR"
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                                >
                                  <Unlink size={13} />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Enrolled Chits */}
                          <td className="py-4 px-5">
                            {member.groups.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {member.groups.map((g, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200"
                                  >
                                    <span>{g.name}</span>
                                    <strong className="text-indigo-600 font-mono">#{g.ticket}</strong>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">No active groups</span>
                            )}
                          </td>

                          {/* Notice Acks Status */}
                          <td className="py-4 px-5">
                            {(() => {
                              const ackCount = Object.keys(member.rescheduleAcknowledgments || {}).length;
                              if (ackCount > 0) {
                                return (
                                  <span
                                    title={`Acknowledged ${ackCount} reschedule notice(s)`}
                                    className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  >
                                    <CheckCircle2 size={10} className="text-emerald-600" />
                                    <span>Acked ({ackCount})</span>
                                  </span>
                                );
                              }
                              return <span className="text-[10px] text-gray-300 font-medium">—</span>;
                            })()}
                          </td>

                          {/* Role & Inline Switcher */}
                          <td className="py-4 px-5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shadow-2xs text-white shrink-0"
                                style={{ backgroundColor: meta.color, borderColor: meta.color }}
                              >
                                {meta.label}
                              </span>

                              <select
                                value={member.role}
                                onChange={(e) => handleQuickRoleChange(member.id, e.target.value, member.fullName)}
                                disabled={isCurrentAdmin}
                                className={`bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer ${
                                  isCurrentAdmin ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                <option value="subscriber">👤 Subscriber</option>
                                <option value="manager">👔 Manager</option>
                                <option value="admin">👑 Admin</option>
                                {customRoles.filter((r) => !r.is_system).map((r) => (
                                  <option key={r.id} value={r.id}>
                                    🛡️ {r.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Share */}
                              <button
                                type="button"
                                onClick={(e) => handleShareWhatsApp(e, member)}
                                title="Share passbook login card via WhatsApp"
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                              >
                                <Share2 size={14} />
                              </button>

                              {/* Block / Unblock Portal Access */}
                              {!isCurrentAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleBlock(member)}
                                  title={member.isBlocked ? "Unblock Portal Access" : "Block Portal Access"}
                                  className={`p-2 rounded-xl transition-colors ${
                                    member.isBlocked
                                      ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                                      : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                  }`}
                                >
                                  {member.isBlocked ? <Ban size={14} /> : <UserX size={14} />}
                                </button>
                              )}

                              {/* Edit Profile */}
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditModal(e, member)}
                                title="Edit member profile"
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                              >
                                <Edit3 size={14} />
                              </button>

                              {/* Delete Profile */}
                              {!isCurrentAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteMember(e, member)}
                                  title="Remove member"
                                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
