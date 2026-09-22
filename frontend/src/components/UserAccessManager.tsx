'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import { useMaintenance } from '@/context/MaintenanceContext';
import { supabase } from '../utils/supabase/client';
import { CustomRoleRecord } from '@/utils/rbac';
import RoleManagerPanel from './RoleManagerPanel';
import PassbookScannerModal from './PassbookScannerModal';
import PassbookQrCenterModal from './PassbookQrCenterModal';
import { StickerItem } from './PassbookSheetGeneratorModal';
import { getPassbookScanUrl } from '@/utils/qrCodeGenerator';
import { 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Lock, 
  Unlock, 
  RefreshCw,
  Sparkles,
  Phone,
  User,
  Shield,
  Briefcase,
  Layers,
  QrCode,
  Printer,
  Share2,
  Unlink,
  Sliders,
  CheckCircle2,
  Ban,
  UserX,
  Wrench,
  AlertTriangle
} from 'lucide-react';

interface ProfileRecord {
  id: string;
  full_name: string;
  phone_number: string;
  role: UserRole;
  created_at: string;
  passbook_token?: string;
  mpin?: string;
  is_blocked?: boolean;
  reschedule_acknowledgments?: Record<string, { acknowledgedAt: string; lastRescheduledAt?: string }>;
}

export default function UserAccessManager() {
  const { profile: currentAdminProfile } = useAuth();
  const [currentTab, setCurrentTab] = useState<'users' | 'roles'>('users');
  
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal State: Create Profile
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newPhoneNumber, setNewPhoneNumber] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('subscriber');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Modal State: Edit Profile
  const [editingProfile, setEditingProfile] = useState<ProfileRecord | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editPhoneNumber, setEditPhoneNumber] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('subscriber');
  const [editIsBlocked, setEditIsBlocked] = useState<boolean>(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Passbook QR Center modal
  const [pairingProfile, setPairingProfile] = useState<ProfileRecord | null>(null);
  const [isQrCenterOpen, setIsQrCenterOpen] = useState<boolean>(false);
  const [qrCenterTab, setQrCenterTab] = useState<'subscribers' | 'batches'>('subscribers');
  const [selectedSubscribersForPrint, setSelectedSubscribersForPrint] = useState<StickerItem[] | null>(null);

  // Fetch Roles from Supabase
  const fetchCustomRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching custom roles:', error);
        return;
      }
      if (data) {
        setCustomRoles(data);
      }
    } catch (err) {
      console.error('Failed to load custom roles:', err);
    }
  };

  // Fetch all profiles from Supabase
  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching profiles:', error);
        return;
      }

      if (data) {
        setProfiles(data as ProfileRecord[]);
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchCustomRoles();
  }, []);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.phone_number.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
      );
    });
  }, [profiles, roleFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = profiles.length;
    const adminCount = profiles.filter((p) => p.role === 'admin').length;
    const managerCount = profiles.filter((p) => p.role === 'manager').length;
    const subscriberCount = profiles.filter((p) => p.role === 'subscriber').length;
    const customRolesCount = customRoles.filter((r) => !r.is_system).length;
    const qrLinkedCount = profiles.filter((p) => p.passbook_token).length;
    const blockedCount = profiles.filter((p) => p.is_blocked).length;
    return { total, adminCount, managerCount, subscriberCount, customRolesCount, qrLinkedCount, blockedCount };
  }, [profiles, customRoles]);

  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  // Helper for role display metadata
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

  // Quick Role Change
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

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newTargetRole } : p))
      );
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  // Quick Block / Unblock Portal Access
  const handleToggleBlock = async (p: ProfileRecord) => {
    if (p.id === currentAdminProfile?.id) {
      alert('Security Protection: You cannot block your own administrator account.');
      return;
    }

    const newStatus = !p.is_blocked;
    const actionName = newStatus ? 'block portal access for' : 'unblock portal access for';
    if (!confirm(`Are you sure you want to ${actionName} "${p.full_name}"?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: newStatus })
        .eq('id', p.id);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, is_blocked: newStatus } : item))
      );
    } catch (err: any) {
      alert(`Failed to update access status: ${err.message}`);
    }
  };

  // 📷 Handle QR Pairing
  const handlePairScanSuccess = async (scannedToken: string) => {
    if (!pairingProfile) return;

    try {
      const { data, error } = await supabase.rpc('pair_passbook_qr', {
        p_token: scannedToken,
        p_profile_id: pairingProfile.id,
      });

      if (error) throw error;
      if (!data || !data.success) throw new Error(data?.error || 'Failed to pair QR code.');

      alert(`Success: Passbook QR token paired to ${pairingProfile.full_name}!`);
      setPairingProfile(null);
      await fetchProfiles();
    } catch (err: any) {
      throw err;
    }
  };

  // Registered subscribers with passbook tokens
  const linkedSubscribers: StickerItem[] = useMemo(() => {
    return profiles
      .filter((p) => p.passbook_token)
      .map((p) => ({
        token: p.passbook_token!,
        name: p.full_name,
        phone: p.phone_number,
        groupName: 'Member Passbook',
      }));
  }, [profiles]);

  // 🖨️ Print Single Member Sticker
  const handlePrintSticker = (p: ProfileRecord) => {
    if (!p.passbook_token) {
      alert(`This user does not have a Passbook QR token linked yet.`);
      return;
    }

    setSelectedSubscribersForPrint([
      {
        token: p.passbook_token,
        name: p.full_name,
        phone: p.phone_number,
        groupName: 'Member Passbook',
      },
    ]);
    setQrCenterTab('subscribers');
    setIsQrCenterOpen(true);
  };

  // 🔗 Revoke / Unlink Passbook QR
  const handleUnlinkPassbook = async (p: ProfileRecord) => {
    if (!p.passbook_token) return;

    if (!confirm(`Are you sure you want to unlink the passbook QR token from "${p.full_name}"?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('revoke_passbook_qr', {
        p_profile_id: p.id,
      });

      if (error) throw error;
      if (!data || !data.success) throw new Error(data?.error || 'Failed to revoke QR code.');

      alert(`Passbook QR unlinked from ${p.full_name}.`);
      await fetchProfiles();
    } catch (err: any) {
      alert(`Unlink failed: ${err.message}`);
    }
  };

  // 💬 WhatsApp Share
  const handleShareWhatsApp = (p: ProfileRecord) => {
    const cleanPhone = normalizePhone(p.phone_number);
    if (!cleanPhone) {
      alert('This user does not have a valid mobile number.');
      return;
    }

    const scanUrl = p.passbook_token ? getPassbookScanUrl(p.passbook_token) : 'https://chitfund.app';
    const message = `📱 *Hello ${p.full_name}!*
Welcome to Chit Fund Manager.

Access your digital passbook & auctions anytime:
🔗 *Passbook Link*: ${scanUrl}
👤 *Mobile*: ${cleanPhone}
🔑 *Initial PIN*: ${p.mpin || '1234'}`;

    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Handle Create Profile
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingCreate) return;

    const cleanName = newFullName.trim();
    const cleanPhone = normalizePhone(newPhoneNumber);

    if (!cleanName || cleanPhone.length !== 10) {
      alert('Please enter a valid full name and 10-digit mobile number.');
      return;
    }

    try {
      setIsSubmittingCreate(true);
      const { error } = await supabase.from('profiles').insert({
        full_name: cleanName,
        phone_number: cleanPhone,
        role: newRole,
      });

      if (error) throw error;

      setIsCreateModalOpen(false);
      setNewFullName('');
      setNewPhoneNumber('');
      setNewRole('subscriber');
      await fetchProfiles();
    } catch (err: any) {
      alert(`Failed to create profile: ${err.message}`);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Edit Profile
  const handleOpenEditModal = (p: ProfileRecord) => {
    setEditingProfile(p);
    setEditFullName(p.full_name);
    setEditPhoneNumber(p.phone_number);
    setEditRole(p.role);
    setEditIsBlocked(p.is_blocked || false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || isSubmittingEdit) return;

    const cleanName = editFullName.trim();
    const cleanPhone = normalizePhone(editPhoneNumber);

    if (!cleanName || cleanPhone.length !== 10) {
      alert('Please enter a valid full name and 10-digit mobile number.');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      const isTargetAdmin = editingProfile.id === currentAdminProfile?.id;
      const finalBlockedStatus = isTargetAdmin ? false : editIsBlocked;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName,
          phone_number: cleanPhone,
          role: editRole,
          is_blocked: finalBlockedStatus,
        })
        .eq('id', editingProfile.id);

      if (error) throw error;

      setEditingProfile(null);
      await fetchProfiles();
    } catch (err: any) {
      alert(`Failed to update profile: ${err.message}`);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete Profile
  const handleDeleteProfile = async (p: ProfileRecord) => {
    if (p.id === currentAdminProfile?.id) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (!confirm(`Are you sure you want to delete profile "${p.full_name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', p.id);
      if (error) throw error;
      await fetchProfiles();
    } catch (err: any) {
      alert(`Failed to delete profile: ${err.message}`);
    }
  };

  const { isMaintenanceMode, toggleMaintenanceMode } = useMaintenance();
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState<boolean>(false);

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
      }
    } catch (err: any) {
      alert(`Error toggling maintenance mode: ${err.message}`);
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── 1. TOP SUB-NAVIGATION RIBBON ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-3xl p-3 sm:p-4 shadow-2xs">
        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 rounded-2xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setCurrentTab('users')}
            className={`flex-1 sm:flex-none px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              currentTab === 'users'
                ? 'bg-white text-gray-900 shadow-xs ring-1 ring-black/5'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Users size={15} className={currentTab === 'users' ? 'text-indigo-600' : 'text-gray-400'} />
            <span>Users Directory</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
              currentTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('roles')}
            className={`flex-1 sm:flex-none px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              currentTab === 'roles'
                ? 'bg-white text-gray-900 shadow-xs ring-1 ring-black/5'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Shield size={15} className={currentTab === 'roles' ? 'text-indigo-600' : 'text-gray-400'} />
            <span>Roles &amp; Permissions</span>
            {stats.customRolesCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                currentTab === 'roles' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-200 text-gray-600'
              }`}>
                +{stats.customRolesCount}
              </span>
            )}
          </button>
        </div>

        {/* Maintenance Mode Toggle & Refresh Actions */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
          {/* Portal Maintenance Toggle Button */}
          <button
            type="button"
            disabled={isTogglingMaintenance}
            onClick={handleToggleMaintenance}
            className={`px-3 sm:px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border shadow-2xs active:scale-95 ${
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
              size={14}
              className={isMaintenanceMode ? 'text-slate-950 animate-bounce' : 'text-gray-500'}
            />
            <span className="hidden sm:inline">Portal Maintenance</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${
                isMaintenanceMode
                  ? 'bg-slate-950 text-amber-300'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {isMaintenanceMode ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              fetchProfiles();
              fetchCustomRoles();
            }}
            title="Refresh Users &amp; Roles"
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-xl transition-all border border-transparent hover:border-gray-200"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* ── 2. TAB CONTENT: ROLES MANAGER PANEL ── */}
      {currentTab === 'roles' && (
        <RoleManagerPanel
          onRoleUpdated={() => {
            fetchCustomRoles();
            fetchProfiles();
          }}
        />
      )}

      {/* ── 3. TAB CONTENT: USERS DIRECTORY ── */}
      {currentTab === 'users' && (
        <div className="space-y-6">
          
          {/* Top Analytics & Stats Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-xs font-bold uppercase tracking-wider">Total Users</span>
                <Users size={16} className="text-slate-700" />
              </div>
              <p className="text-2xl font-black text-gray-900 mt-1">{stats.total}</p>
              <span className="text-[10px] text-gray-400 font-semibold">Registered in Supabase</span>
            </div>

            <div className="bg-white border border-purple-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-purple-600">
                <span className="text-xs font-bold uppercase tracking-wider">Admins</span>
                <ShieldCheck size={16} />
              </div>
              <p className="text-2xl font-black text-purple-700 mt-1">{stats.adminCount}</p>
              <span className="text-[10px] text-purple-600 font-semibold">Full Unrestricted Access</span>
            </div>

            <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-blue-600">
                <span className="text-xs font-bold uppercase tracking-wider">Managers</span>
                <Briefcase size={16} />
              </div>
              <p className="text-2xl font-black text-blue-700 mt-1">{stats.managerCount}</p>
              <span className="text-[10px] text-blue-600 font-semibold">Operations &amp; Bidding</span>
            </div>

            <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-600">
                <span className="text-xs font-bold uppercase tracking-wider">Subscribers</span>
                <UserCheck size={16} />
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-1">{stats.subscriberCount}</p>
              <span className="text-[10px] text-emerald-600 font-semibold">Passbook &amp; Member Portal</span>
            </div>

            <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-indigo-600">
                <span className="text-xs font-bold uppercase tracking-wider">QR Linked</span>
                <QrCode size={16} />
              </div>
              <p className="text-2xl font-black text-indigo-700 mt-1">{stats.qrLinkedCount}</p>
              <span className="text-[10px] text-indigo-600 font-semibold">Active Digital Keys</span>
            </div>
          </div>

          {/* Users Directory & Role Assignment Table */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            
            {/* Header, Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <UserCheck size={18} className="text-indigo-600" />
                  Users Directory &amp; Access Controls
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Assign roles, manage passbook QR digital keys, and generate print sheets
                </p>
              </div>

              {/* Search, Filter, Passbook QRs & Add User */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search user name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none w-44 sm:w-52"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-700 focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  {customRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubscribersForPrint(null);
                    setQrCenterTab('subscribers');
                    setIsQrCenterOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-[0.98] text-gray-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  <QrCode size={14} className="text-indigo-600" />
                  <span>Passbook QRs</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs active:scale-95"
                >
                  <Plus size={14} />
                  <span>Add User</span>
                </button>
              </div>
            </div>

            {/* Profiles Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-3">User Profile</th>
                    <th className="py-3 px-3">Phone Number</th>
                    <th className="py-3 px-3">Passbook QR</th>
                    <th className="py-3 px-3">Notice Acks</th>
                    <th className="py-3 px-3">Current Role</th>
                    <th className="py-3 px-3">Assign Role</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs font-medium text-gray-700">
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-gray-400">
                        No users matching the selected search query or role filter.
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((p) => {
                      const meta = getRoleMeta(p.role);
                      const isCurrentAdmin = p.id === currentAdminProfile?.id;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Name & Avatar */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 text-white shadow-2xs ${
                                  p.is_blocked ? 'ring-2 ring-rose-500 opacity-80' : ''
                                }`}
                                style={{ backgroundColor: meta.color }}
                              >
                                {p.full_name ? p.full_name.charAt(0) : 'U'}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 block flex items-center gap-1.5">
                                  <span className={p.is_blocked ? 'line-through text-gray-500' : ''}>{p.full_name}</span>
                                  {isCurrentAdmin && (
                                    <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-md">
                                      You
                                    </span>
                                  )}
                                  {p.is_blocked && (
                                    <span className="text-[9px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                      <Ban size={9} /> Blocked
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">ID: {p.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className="py-3.5 px-3 font-mono font-semibold text-gray-800">
                            {p.phone_number || '—'}
                          </td>

                          {/* Passbook QR */}
                          <td className="py-3.5 px-3">
                            {p.passbook_token ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  Linked 🟢
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handlePrintSticker(p)}
                                  title="Print passbook sticker"
                                  className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-md transition-colors"
                                >
                                  <Printer size={12} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setPairingProfile(p)}
                                  title="Re-pair with a new QR sticker"
                                  className="p-1 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-md transition-colors"
                                >
                                  <QrCode size={12} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUnlinkPassbook(p)}
                                  title="Unlink / Revoke Passbook QR"
                                  className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
                                >
                                  <Unlink size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPairingProfile(p)}
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2.5 py-1 rounded-lg transition-all"
                              >
                                <QrCode size={12} />
                                <span>Pair QR</span>
                              </button>
                            )}
                          </td>

                          {/* Notice Acks Status */}
                          <td className="py-3.5 px-3">
                            {p.role === 'subscriber' ? (
                              (() => {
                                const ackCount = Object.keys(p.reschedule_acknowledgments || {}).length;
                                if (ackCount > 0) {
                                  const latestAck = Object.values(p.reschedule_acknowledgments || {})
                                    .sort((a, b) => new Date(b.acknowledgedAt).getTime() - new Date(a.acknowledgedAt).getTime())[0];
                                  const latestDate = latestAck?.acknowledgedAt
                                    ? new Date(latestAck.acknowledgedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                    : '';
                                  return (
                                    <span
                                      title={`Acknowledged ${ackCount} reschedule notice(s). Latest: ${latestDate}`}
                                      className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    >
                                      <CheckCircle2 size={10} className="text-emerald-600" />
                                      <span>Acked ({ackCount})</span>
                                    </span>
                                  );
                                }
                                return (
                                  <span className="text-[10px] text-gray-400 font-medium">
                                    No notices
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-[10px] text-gray-300 font-medium">—</span>
                            )}
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-3">
                            <span
                              className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shadow-2xs text-white"
                              style={{ backgroundColor: meta.color, borderColor: meta.color }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              {meta.label}
                            </span>
                          </td>

                          {/* Live Role Switcher Dropdown */}
                          <td className="py-3.5 px-3">
                            <select
                              value={p.role}
                              onChange={(e) => handleQuickRoleChange(p.id, e.target.value, p.full_name)}
                              disabled={isCurrentAdmin}
                              className={`bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer ${
                                isCurrentAdmin ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              {customRoles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.is_system ? (r.id === 'admin' ? '👑 ' : r.id === 'manager' ? '👔 ' : '👤 ') : '🛡️ '}
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Action buttons */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleShareWhatsApp(p)}
                                title="Share WhatsApp Passbook Card"
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              >
                                <Share2 size={13} />
                              </button>

                              {!isCurrentAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleBlock(p)}
                                  title={p.is_blocked ? "Unblock Portal Access" : "Block Portal Access"}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    p.is_blocked
                                      ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                                      : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                  }`}
                                >
                                  {p.is_blocked ? <Ban size={13} /> : <UserX size={13} />}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(p)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Edit Profile & Access"
                              >
                                <Edit3 size={13} />
                              </button>

                              {!isCurrentAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProfile(p)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Delete Profile"
                                >
                                  <Trash2 size={13} />
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

      {/* Add User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-gray-900 text-sm">Register New User Profile</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProfile} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">10-Digit Mobile Number *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">System Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                >
                  {customRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.is_system ? (r.id === 'admin' ? '👑 ' : r.id === 'manager' ? '👔 ' : '👤 ') : '🛡️ '}
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs active:scale-95 transition-all text-center"
                >
                  {isSubmittingCreate ? 'Creating...' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-gray-900 text-sm">Edit User Profile</h3>
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Assigned Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  disabled={editingProfile.id === currentAdminProfile?.id}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 ${
                    editingProfile.id === currentAdminProfile?.id ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  {customRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.is_system ? (r.id === 'admin' ? '👑 ' : r.id === 'manager' ? '👔 ' : '👤 ') : '🛡️ '}
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Block Portal Access Toggle */}
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
                    {editingProfile.id === currentAdminProfile?.id && (
                      <span className="text-[10px] text-amber-700 font-semibold block pt-0.5">
                        Security Notice: You cannot block your own active administrator account.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={editingProfile.id === currentAdminProfile?.id}
                    onClick={() => setEditIsBlocked(!editIsBlocked)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                      editIsBlocked ? 'bg-rose-600' : 'bg-gray-300'
                    } ${editingProfile.id === currentAdminProfile?.id ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                        editIsBlocked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs active:scale-95 transition-all text-center"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera QR Scanner Modal for Pairing */}
      <PassbookScannerModal
        isOpen={!!pairingProfile}
        onClose={() => setPairingProfile(null)}
        onScanSuccess={handlePairScanSuccess}
        title="Pair Passbook QR Sticker"
        subtitle="Point camera at physical passbook QR code"
        targetMemberName={pairingProfile?.full_name}
      />

      {/* Unified Passbook QR Center Modal */}
      <PassbookQrCenterModal
        isOpen={isQrCenterOpen}
        onClose={() => {
          setIsQrCenterOpen(false);
          setSelectedSubscribersForPrint(null);
        }}
        registeredSubscribers={selectedSubscribersForPrint || linkedSubscribers}
        defaultTab={qrCenterTab}
        onRefresh={fetchProfiles}
      />
    </div>
  );
}
