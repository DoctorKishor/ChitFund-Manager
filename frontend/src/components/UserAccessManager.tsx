'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import { supabase } from '../utils/supabase/client';
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
  AlertCircle
} from 'lucide-react';

interface ProfileRecord {
  id: string;
  full_name: string;
  phone_number: string;
  role: UserRole;
  created_at: string;
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

  // Role summary stats
  const stats = useMemo(() => {
    const total = profiles.length;
    const adminCount = profiles.filter((p) => p.role === 'admin').length;
    const managerCount = profiles.filter((p) => p.role === 'manager').length;
    const subscriberCount = profiles.filter((p) => p.role === 'subscriber').length;

    return { total, adminCount, managerCount, subscriberCount };
  }, [profiles]);

  // Action: Quick Role Change
  const handleQuickRoleChange = async (profileId: string, newTargetRole: UserRole, personName: string) => {
    if (profileId === currentAdminProfile?.id && newTargetRole !== 'admin') {
      alert("You cannot remove Admin role from your own active admin account.");
      return;
    }

    if (!confirm(`Change ${personName}'s role to ${ROLE_META[newTargetRole].label.toUpperCase()}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newTargetRole })
        .eq('id', profileId);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role: newTargetRole } : p))
      );
      alert(`✓ Successfully updated ${personName}'s role to ${ROLE_META[newTargetRole].label}!`);
    } catch (err: any) {
      console.error('Error updating role:', err);
      alert('Failed to update role: ' + (err.message || 'Unknown error'));
    }
  };

  // Action: Create Profile
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newPhoneNumber.trim()) {
      alert("Please provide both full name and phone number.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const cleanPhone = newPhoneNumber.replace(/\D/g, '');
      const newId = crypto.randomUUID();

      const { data, error } = await supabase
        .from('profiles')
        .insert([
          {
            id: newId,
            full_name: newFullName.trim(),
            phone_number: cleanPhone,
            role: newRole,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProfiles([data as ProfileRecord, ...profiles]);
      }

      setIsCreateModalOpen(false);
      setNewFullName('');
      setNewPhoneNumber('');
      setNewRole('subscriber');
      alert(`✓ Successfully registered ${newFullName.trim()} as ${ROLE_META[newRole].label}!`);
    } catch (err: any) {
      console.error('Error creating profile:', err);
      alert('Error creating profile: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Action: Edit Profile
  const handleOpenEditModal = (p: ProfileRecord) => {
    setEditingProfile(p);
    setEditFullName(p.full_name);
    setEditPhoneNumber(p.phone_number);
    setEditRole(p.role);
  };

  const handleConfirmEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    if (editingProfile.id === currentAdminProfile?.id && editRole !== 'admin') {
      alert("You cannot remove Admin role from your own active admin account.");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const cleanPhone = editPhoneNumber.replace(/\D/g, '');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editFullName.trim(),
          phone_number: cleanPhone,
          role: editRole,
        })
        .eq('id', editingProfile.id);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editingProfile.id
            ? { ...p, full_name: editFullName.trim(), phone_number: cleanPhone, role: editRole }
            : p
        )
      );

      setEditingProfile(null);
      alert(`✓ Successfully updated profile for ${editFullName.trim()}!`);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      alert('Error updating profile: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Action: Delete Profile
  const handleDeleteProfile = async (p: ProfileRecord) => {
    if (p.id === currentAdminProfile?.id) {
      alert("You cannot delete your own active admin profile.");
      return;
    }

    if (!confirm(`Are you sure you want to delete profile "${p.full_name}" (${p.phone_number})?\n\nWarning: This will remove user access and disassociate any non-critical profile linkages.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', p.id);
      if (error) throw error;

      setProfiles((prev) => prev.filter((item) => item.id !== p.id));
      alert(`✓ Removed profile "${p.full_name}".`);
    } catch (err: any) {
      console.error('Error deleting profile:', err);
      alert('Error deleting profile: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── 1. TOP ANALYTICS & ROLE METRIC CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Users */}
        <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-gray-700" /> Total Users
            </span>
            <span className="text-[10px] font-extrabold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              Registered
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-black font-mono text-gray-900 block">
            {stats.total}
          </span>
          <span className="text-[11px] text-gray-400 font-medium">All workspace profiles</span>
        </div>

        {/* Admins */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-purple-600" /> Admins
            </span>
            <span className="text-[9px] font-extrabold bg-purple-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
              Full Access
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-black font-mono text-purple-900 block">
            {stats.adminCount}
          </span>
          <span className="text-[11px] text-purple-700 font-medium">System administrators</span>
        </div>

        {/* Managers */}
        <div className="bg-white border border-blue-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase size={14} className="text-blue-600" /> Managers
            </span>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
              Operations
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-black font-mono text-blue-900 block">
            {stats.managerCount}
          </span>
          <span className="text-[11px] text-blue-600 font-medium">Operational staff</span>
        </div>

        {/* Subscribers */}
        <div className="bg-white border border-emerald-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck size={14} className="text-emerald-600" /> Subscribers
            </span>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              Member Portal
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-800 block">
            {stats.subscriberCount}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Enrolled subscribers</span>
        </div>

      </div>

      {/* ── 2. ROLE PERMISSION MATRIX OVERVIEW BANNER ── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 border border-indigo-500/20 rounded-3xl p-5 sm:p-6 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Shield size={20} />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Role-Based Access Control (RBAC) Hierarchy
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                Live permission gates mapped across tabs, auctions, broadcasts, and treasury operations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus size={15} /> Add User Profile
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          
          {/* Admin Role Card */}
          <div className="bg-white/5 border border-purple-400/30 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                <ShieldCheck size={14} /> ADMIN
              </span>
              <span className="text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full">
                Full Privileges
              </span>
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1">
              <li className="flex items-center gap-1.5">✓ All 7 Primary Tabs (Treasury, Reports, Chits)</li>
              <li className="flex items-center gap-1.5">✓ Group Creation, Deletion &amp; Month Advance</li>
              <li className="flex items-center gap-1.5">✓ Treasury Vault Transfers &amp; Float Recovery</li>
              <li className="flex items-center gap-1.5">✓ User Role Assignment &amp; Security Audits</li>
            </ul>
          </div>

          {/* Manager Role Card */}
          <div className="bg-white/5 border border-blue-400/30 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-300 flex items-center gap-1.5">
                <Briefcase size={14} /> MANAGER
              </span>
              <span className="text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                Operations
              </span>
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1">
              <li className="flex items-center gap-1.5">✓ Member Matrix &amp; Dues Collection Logging</li>
              <li className="flex items-center gap-1.5">✓ Live Bidding Engine &amp; Prize Pot Disbursal</li>
              <li className="flex items-center gap-1.5">✓ WhatsApp Broadcasting &amp; Reminders</li>
              <li className="flex items-center gap-1.5">✓ Treasury View &amp; Move Money Operations</li>
            </ul>
          </div>

          {/* Subscriber Role Card */}
          <div className="bg-white/5 border border-emerald-400/30 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                <UserCheck size={14} /> SUBSCRIBER
              </span>
              <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                Member Portal
              </span>
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1">
              <li className="flex items-center gap-1.5">✓ View Personal Enrolled Chit Tickets</li>
              <li className="flex items-center gap-1.5">✓ Live Auction Bidding Participation</li>
              <li className="flex items-center gap-1.5">✓ Personal Payment History &amp; Passbook</li>
              <li className="flex items-center gap-1.5 text-slate-400">✗ Blocked from Treasury &amp; Admin Config</li>
            </ul>
          </div>

        </div>
      </div>

      {/* ── 3. USERS DIRECTORY & LIVE ROLE ASSIGNMENT TABLE ── */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
        
        {/* Header, Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <UserCheck size={18} className="text-indigo-600" />
              Users Directory &amp; Role Assignments
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Assign and modify roles in real-time to adjust access permissions
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search user name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none w-44 sm:w-60"
              />
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              {[
                { id: 'all', label: `All (${stats.total})` },
                { id: 'admin', label: `Admin (${stats.adminCount})` },
                { id: 'manager', label: `Manager (${stats.managerCount})` },
                { id: 'subscriber', label: `Subscriber (${stats.subscriberCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    roleFilter === tab.id
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchProfiles}
              title="Refresh profiles"
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
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
                <th className="py-3 px-3">Current Role</th>
                <th className="py-3 px-3">Assign / Change Role</th>
                <th className="py-3 px-3">Joined Date</th>
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

                      {/* Joined Date */}
                      <td className="py-3.5 px-3 text-gray-400 font-mono text-[11px]">
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit3 size={14} />
                          </button>
                          {!isCurrentAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteProfile(p)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Profile"
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

      {/* ── CREATE USER MODAL ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <UserCheck size={20} className="text-indigo-600" />
                  Register New User Profile
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create a profile and assign their access role
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Kishor / Anbazhakan / Subscriber Name"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9943609010"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Initial Role Assignment</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                >
                  <option value="subscriber">👤 Subscriber (Member Portal Access)</option>
                  <option value="manager">👔 Manager (Operations & Collections Access)</option>
                  <option value="admin">👑 Admin (Full System & Treasury Access)</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="flex-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCreate ? 'Registering...' : '+ Register Profile'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ── */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <Edit3 size={20} className="text-indigo-600" />
                  Edit User Profile
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Update full name, phone number or assigned role
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmEditProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Assigned Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                >
                  <option value="subscriber">👤 Subscriber (Member Portal)</option>
                  <option value="manager">👔 Manager (Operations & Collections)</option>
                  <option value="admin">👑 Admin (Full System & Treasury)</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="flex-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
