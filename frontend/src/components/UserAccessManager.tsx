'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import { supabase } from '../utils/supabase/client';
import PassbookScannerModal from './PassbookScannerModal';
import PassbookSheetGeneratorModal, { StickerItem } from './PassbookSheetGeneratorModal';
import PassbookInventoryModal from './PassbookInventoryModal';
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
  AlertCircle,
  QrCode,
  Printer,
  Share2
} from 'lucide-react';

interface ProfileRecord {
  id: string;
  full_name: string;
  phone_number: string;
  role: UserRole;
  created_at: string;
  passbook_token?: string;
  mpin?: string;
}

const ROLE_META: Record<UserRole, { label: string; bg: string; text: string; border: string; desc: string }> = {
  admin: {
    label: 'Admin',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    desc: 'Full system control, treasury vaults, role assignment & audit logs',
  },
  manager: {
    label: 'Manager',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    desc: 'Operational management, collections, live bidding & broadcasts',
  },
  subscriber: {
    label: 'Subscriber',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    desc: 'Member portal, personal enrolled chits, ledger & statements',
  },
};

export default function UserAccessManager() {
  const { profile: currentAdminProfile } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Modal State: Create Profile
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newPhoneNumber, setNewPhoneNumber] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('subscriber');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Modal State: Edit Profile
  const [editingProfile, setEditingProfile] = useState<ProfileRecord | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editPhoneNumber, setEditPhoneNumber] = useState<string>('');
  const [editRole, setEditRole] = useState<UserRole>('subscriber');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Passbook QR modals
  const [pairingProfile, setPairingProfile] = useState<ProfileRecord | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printItems, setPrintItems] = useState<StickerItem[]>([]);
  const [printSheetTitle, setPrintSheetTitle] = useState<string>('Passbook QR Sticker Sheet');

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
    const qrLinkedCount = profiles.filter((p) => p.passbook_token).length;
    return { total, adminCount, managerCount, subscriberCount, qrLinkedCount };
  }, [profiles]);

  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  // Quick Role Change
  const handleQuickRoleChange = async (userId: string, newTargetRole: UserRole, userName: string) => {
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
      alert(`Pairing Failed: ${err.message}`);
    }
  };

  // 🖨️ Print Single Member Sticker
  const handlePrintSticker = (p: ProfileRecord) => {
    if (!p.passbook_token) {
      alert(`This user does not have a Passbook QR token linked yet.`);
      return;
    }

    setPrintItems([
      {
        token: p.passbook_token,
        name: p.full_name,
        phone: p.phone_number,
        groupName: 'Member Passbook',
      },
    ]);
    setPrintSheetTitle(`${p.full_name} — Passbook Sticker`);
    setIsPrintModalOpen(true);
  };

  // 🖨️ Print All Stickers
  const handlePrintAllStickers = () => {
    const items: StickerItem[] = filteredProfiles
      .filter((p) => p.passbook_token)
      .map((p) => ({
        token: p.passbook_token!,
        name: p.full_name,
        phone: p.phone_number,
        groupName: 'Member Passbook',
      }));

    if (items.length === 0) {
      alert('No users with linked passbook tokens in the current filtered list.');
      return;
    }

    setPrintItems(items);
    setPrintSheetTitle(`All Users Passbook Stickers (${items.length} items)`);
    setIsPrintModalOpen(true);
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
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName,
          phone_number: cleanPhone,
          role: editRole,
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── 1. TOP ANALYTICS & STATS RIBBON ── */}
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

      {/* ── 2. USERS DIRECTORY & ROLE ASSIGNMENT TABLE ── */}
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

          {/* Search, Inventory, Print & Add */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search user name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none w-44 sm:w-56"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsInventoryOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs flex items-center gap-1.5"
            >
              <Layers size={13} className="text-indigo-600" />
              <span>QR Inventory</span>
            </button>

            <button
              type="button"
              onClick={handlePrintAllStickers}
              className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs flex items-center gap-1.5"
            >
              <Printer size={13} className="text-indigo-600" />
              <span>Print Stickers</span>
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
                <th className="py-3 px-3">Current Role</th>
                <th className="py-3 px-3">Assign Role</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs font-medium text-gray-700">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-gray-400">
                    No users matching the selected search query or role filter.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const meta = ROLE_META[p.role] || ROLE_META.subscriber;
                  const isCurrentAdmin = p.id === currentAdminProfile?.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${meta.bg} ${meta.text} border ${meta.border}`}>
                            {p.full_name ? p.full_name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block flex items-center gap-1.5">
                              {p.full_name}
                              {isCurrentAdmin && (
                                <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-md">
                                  You
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
                        <div className="flex items-center gap-1.5">
                          {p.passbook_token ? (
                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              Linked 🟢
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                              Unlinked
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setPairingProfile(p)}
                            title="Pair QR sticker"
                            className="p-1 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-md"
                          >
                            <QrCode size={12} />
                          </button>

                          {p.passbook_token && (
                            <button
                              type="button"
                              onClick={() => handlePrintSticker(p)}
                              title="Print sticker"
                              className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-md"
                            >
                              <Printer size={12} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${meta.bg} ${meta.text} ${meta.border}`}>
                          {p.role === 'admin' ? <ShieldCheck size={11} /> : p.role === 'manager' ? <Briefcase size={11} /> : <UserCheck size={11} />}
                          {meta.label}
                        </span>
                      </td>

                      {/* Live Role Switcher Dropdown */}
                      <td className="py-3.5 px-3">
                        <select
                          value={p.role}
                          onChange={(e) => handleQuickRoleChange(p.id, e.target.value as UserRole, p.full_name)}
                          disabled={isCurrentAdmin}
                          className={`bg-gray-50 border border-gray-200 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer ${
                            isCurrentAdmin ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <option value="admin">👑 Admin (Full Access)</option>
                          <option value="manager">👔 Manager (Operations)</option>
                          <option value="subscriber">👤 Subscriber (Member Portal)</option>
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
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit Profile"
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

      {/* Add User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Register New User Profile</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProfile} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
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
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">System Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="subscriber">👤 Subscriber (Member Portal)</option>
                  <option value="manager">👔 Manager (Operations)</option>
                  <option value="admin">👑 Administrator (Full Control)</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="bg-slate-900 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Edit User Profile</h3>
              <button onClick={() => setEditingProfile(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
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
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="subscriber">👤 Subscriber</option>
                  <option value="manager">👔 Manager</option>
                  <option value="admin">👑 Administrator</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="bg-slate-900 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs"
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

      {/* A4 PDF Sheet Generator */}
      <PassbookSheetGeneratorModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        items={printItems}
        defaultTitle={printSheetTitle}
      />

      {/* Blank QR Inventory Modal */}
      <PassbookInventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        onRefresh={fetchProfiles}
      />
    </div>
  );
}
