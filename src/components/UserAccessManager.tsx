'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { triggerHapticFeedback } from '@/utils/haptics';
import RoleManagerPanel from './RoleManagerPanel';
import {
  ShieldCheck,
  UserPlus,
  Search,
  KeyRound,
  ShieldAlert,
  Sliders,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Mail,
  Phone,
  User,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Check
} from 'lucide-react';

interface StaffProfile {
  id: string;
  full_name: string;
  phone_number: string;
  role: string;
  email?: string;
  is_blocked?: boolean;
  created_at: string;
  passbook_token?: string;
}

interface CustomRole {
  id: string;
  name: string;
  description?: string;
  color?: string;
  is_system?: boolean;
  is_privileged?: boolean;
  allowed_tabs?: string[];
  allowed_actions?: string[];
}

interface UserAccessManagerProps {
  onOpenAuditLogs?: () => void;
  onAddAuditLog?: (desc: string) => void;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  admin: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  manager: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  collections_agent: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  auction_clerk: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  auditor: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  subscriber: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

export default function UserAccessManager({ onOpenAuditLogs, onAddAuditLog }: UserAccessManagerProps) {
  const { profile: currentAdminProfile } = useAuth();
  const [activeSubtab, setActiveSubtab] = useState<'staff' | 'roles'>('staff');
  const [staffMembers, setStaffMembers] = useState<StaffProfile[]>([]);
  const [availableRoles, setAvailableRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modals state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState<boolean>(false);
  const [isEditStaffOpen, setIsEditStaffOpen] = useState<boolean>(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);

  // Add staff form state
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('collections_agent');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Reset password state
  const [resetPasswordInput, setResetPasswordInput] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Fetch Staff Members & Custom Roles
  const fetchStaffData = async () => {
    try {
      setLoading(true);

      // Fetch custom roles
      const { data: rolesData } = await supabase
        .from('custom_roles')
        .select('*')
        .order('is_system', { ascending: false });

      if (rolesData && rolesData.length > 0) {
        setAvailableRoles(rolesData);
      }

      // Fetch profiles with non-subscriber role OR all profiles to categorize staff
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesErr) {
        console.warn('Error querying profiles:', profilesErr.message);
      }

      // Filter staff (everyone who is NOT subscriber or who has a staff role)
      const allProfiles = profilesData || [];
      const staffOnly = allProfiles.filter(p => p.role !== 'subscriber');

      // If no staff found other than current admin, ensure current admin is present
      if (staffOnly.length === 0 && currentAdminProfile) {
        staffOnly.push({
          id: currentAdminProfile.id,
          full_name: currentAdminProfile.fullName,
          phone_number: currentAdminProfile.phoneNumber,
          role: currentAdminProfile.role || 'admin',
          created_at: new Date().toISOString(),
          is_blocked: false,
        });
      }

      setStaffMembers(staffOnly);
    } catch (err) {
      console.error('Failed to load staff accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();

    // Listen for realtime profile changes
    const channel = supabase
      .channel('staff-directory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchStaffData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_roles' }, () => {
        fetchStaffData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffMembers.filter(member => {
      const matchesSearch = 
        member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.phone_number.includes(searchQuery) ||
        (member.role || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [staffMembers, searchQuery, roleFilter]);

  // Handle Copy Phone/Email
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    triggerHapticFeedback('light');
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 2. Provision New Staff Member (Using Isolated Client so Admin Stays Logged In)
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanPhone = newPhone.replace(/\D/g, '').slice(-10);

    if (!newFullName.trim()) {
      setFormError('Please enter the staff member\'s full legal name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Please provide a valid official work email address.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setFormError('Please provide a valid 10-digit mobile number.');
      return;
    }
    if (newPassword.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsSubmittingStaff(true);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      // Use isolated Supabase instance with NO session persistence so the active Admin session is NEVER signed out
      const isolatedClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data: authData, error: authErr } = await isolatedClient.auth.signUp({
        email: cleanEmail,
        password: newPassword,
        options: {
          data: {
            full_name: newFullName.trim(),
            phone_number: cleanPhone,
            role: newRole,
          },
        },
      });

      if (authErr) throw authErr;

      const newUserId = authData.user?.id;
      if (!newUserId) {
        throw new Error('User creation returned empty identity.');
      }

      // Upsert profile record explicitly to ensure role and phone are pinned
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: newUserId,
        full_name: newFullName.trim(),
        phone_number: cleanPhone,
        role: newRole,
        is_blocked: false,
      });

      if (profileErr) {
        console.warn('Profile synchronization notice:', profileErr.message);
      }

      if (onAddAuditLog) {
        onAddAuditLog(`PROVISIONED STAFF: Created account for ${newFullName} (${cleanEmail}) as [${newRole}]`);
      }

      setFormSuccess(`Staff member created successfully! Account credentials: ${cleanEmail}`);
      triggerHapticFeedback('success');

      // Reset form
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setNewRole('collections_agent');

      // Refresh list
      await fetchStaffData();

      setTimeout(() => {
        setIsAddStaffOpen(false);
        setFormSuccess(null);
      }, 2000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to provision staff account.');
      triggerHapticFeedback('error');
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // 3. Update Staff Role
  const handleUpdateStaffRole = async (targetUserId: string, updatedRole: string, staffName: string) => {
    if (targetUserId === currentAdminProfile?.id) {
      alert('Security Protection: You cannot alter your own Administrator role.');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: updatedRole })
        .eq('id', targetUserId);

      if (error) throw error;

      setStaffMembers(prev => prev.map(s => s.id === targetUserId ? { ...s, role: updatedRole } : s));
      triggerHapticFeedback('light');

      if (onAddAuditLog) {
        onAddAuditLog(`ROLE REASSIGNMENT: Updated ${staffName}'s role to [${updatedRole}]`);
      }
    } catch (err: any) {
      alert('Failed to update role: ' + err.message);
    }
  };

  // 4. Toggle Suspend / Reactivate Staff
  const handleToggleStaffStatus = async (staff: StaffProfile) => {
    if (staff.id === currentAdminProfile?.id) {
      alert('Security Protection: You cannot suspend your own Administrator account.');
      return;
    }

    const nextBlocked = !staff.is_blocked;
    const actionLabel = nextBlocked ? 'SUSPEND' : 'REACTIVATE';

    if (!confirm(`Are you sure you want to ${actionLabel} access for ${staff.full_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: nextBlocked })
        .eq('id', staff.id);

      if (error) throw error;

      setStaffMembers(prev => prev.map(s => s.id === staff.id ? { ...s, is_blocked: nextBlocked } : s));
      triggerHapticFeedback('warning');

      if (onAddAuditLog) {
        onAddAuditLog(`${actionLabel} STAFF: Account standing updated for ${staff.full_name}`);
      }
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // 5. Send Password Reset Email
  const handleSendPasswordResetEmail = async (staff: StaffProfile) => {
    const targetEmail = staff.email || `${staff.phone_number}@chitfund.internal`;
    try {
      setIsResettingPassword(true);
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) throw error;

      setResetSuccessMsg(`Password reset link dispatched to ${targetEmail}`);
      triggerHapticFeedback('success');
      setTimeout(() => {
        setIsResetPasswordOpen(false);
        setResetSuccessMsg(null);
      }, 2500);
    } catch (err: any) {
      alert(`Failed to send password reset: ${err.message}`);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const getRoleStyle = (role: string) => {
    return ROLE_COLORS[role] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
              <ShieldCheck size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight font-display">
                  Team &amp; Access Management
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                First-class workforce identities, credentials, and RBAC permissions
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('light');
              setIsAddStaffOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer shadow-brand-500/20"
          >
            <UserPlus size={16} />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* ── Segmented Subtab Navigation (Native Mobile Pills) ── */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light');
            setActiveSubtab('staff');
          }}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubtab === 'staff'
              ? 'bg-white text-brand-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User size={15} />
          <span>Staff Directory ({staffMembers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light');
            setActiveSubtab('roles');
          }}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubtab === 'roles'
              ? 'bg-white text-brand-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders size={15} />
          <span>Role Permissions ({availableRoles.length})</span>
        </button>
      </div>

      {/* ── SUBTAB 1: STAFF DIRECTORY ── */}
      {activeSubtab === 'staff' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, phone, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-semibold">
              <span className="text-slate-400 uppercase text-[9px] font-bold tracking-wider mr-1">Filter:</span>
              {[
                { id: 'all', label: 'All Staff' },
                { id: 'admin', label: 'Admins' },
                { id: 'manager', label: 'Managers' },
                { id: 'collections_agent', label: 'Agents' },
                { id: 'auction_clerk', label: 'Clerks' },
                { id: 'auditor', label: 'Auditors' },
              ].map(chip => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setRoleFilter(chip.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    roleFilter === chip.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Staff List Table (Desktop) / Cards (Mobile) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Contact &amp; Identity</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((staff) => {
                    const roleBadge = getRoleStyle(staff.role);
                    const isSelf = staff.id === currentAdminProfile?.id;

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Name & Avatar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {staff.full_name ? staff.full_name.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate">
                                {staff.full_name}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.2 rounded">
                                  You (Active Session)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                              <Phone size={11} className="text-slate-400" />
                              <span>+91 {staff.phone_number || '—'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Mail size={11} className="text-slate-400" />
                              <span className="truncate max-w-[180px]">{staff.email || `${staff.phone_number}@chitfund.internal`}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role Select Dropdown */}
                        <td className="py-3 px-4">
                          <select
                            value={staff.role}
                            onChange={(e) => handleUpdateStaffRole(staff.id, e.target.value, staff.full_name)}
                            disabled={isSelf}
                            className={`text-xs font-bold rounded-lg px-2.5 py-1 border cursor-pointer focus:ring-2 focus:ring-brand-500/20 ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border} disabled:opacity-75 disabled:cursor-not-allowed`}
                          >
                            {availableRoles.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {staff.is_blocked ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active Access
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStaff(staff);
                                setIsResetPasswordOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="Reset Password"
                            >
                              <KeyRound size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStaffStatus(staff)}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                staff.is_blocked
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                  : 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                              title={staff.is_blocked ? 'Reactivate Account' : 'Suspend Access'}
                            >
                              <ShieldAlert size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Native Card-Based View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredStaff.map((staff) => {
                const roleBadge = getRoleStyle(staff.role);
                const isSelf = staff.id === currentAdminProfile?.id;

                return (
                  <div key={staff.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {staff.full_name ? staff.full_name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate text-sm">
                            {staff.full_name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono block">
                            +91 {staff.phone_number || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Status Pill */}
                      {staff.is_blocked ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          Suspended
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Active
                        </span>
                      )}
                    </div>

                    {/* Role Selector */}
                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Role</span>
                      <select
                        value={staff.role}
                        onChange={(e) => handleUpdateStaffRole(staff.id, e.target.value, staff.full_name)}
                        disabled={isSelf}
                        className={`text-xs font-bold rounded-lg px-2 py-1 border cursor-pointer ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border} disabled:opacity-75`}
                      >
                        {availableRoles.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mobile Actions Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStaff(staff);
                          setIsResetPasswordOpen(true);
                        }}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer"
                      >
                        <KeyRound size={13} />
                        <span>Reset Password</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStaffStatus(staff)}
                        disabled={isSelf}
                        className={`text-xs font-bold flex items-center gap-1.5 py-1 px-2.5 rounded-lg cursor-pointer ${
                          staff.is_blocked
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        } disabled:opacity-40`}
                      >
                        <ShieldAlert size={13} />
                        <span>{staff.is_blocked ? 'Reactivate' : 'Suspend'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredStaff.length === 0 && (
              <div className="text-center py-12 px-4 text-slate-400">
                <User size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-700">No staff members found matching criteria</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Click &quot;Add Staff Member&quot; to provision a new team identity.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUBTAB 2: ROLE PERMISSIONS (EMBEDDED ROLE MANAGER PANEL) ── */}
      {activeSubtab === 'roles' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
          <RoleManagerPanel onOpenAuditLogs={onOpenAuditLogs} />
        </div>
      )}

      {/* ── MODAL: ADD / PROVISION NEW STAFF MEMBER ── */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => !isSubmittingStaff && setIsAddStaffOpen(false)}
          />

          {/* Modal / Mobile Bottom Sheet */}
          <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl border-t sm:border border-slate-200 z-50 p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {/* Grab handle for mobile */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Provision Staff Member</h3>
                  <p className="text-[10px] text-slate-400">Issues verified Supabase credentials &amp; permissions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                disabled={isSubmittingStaff}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="mt-4 space-y-3.5">
              {/* Full Name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Work Email */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Official Work Email (Login ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ramesh.agent@chitfund.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Mobile Number (10 Digits) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* System Role */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Assigned System Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer"
                >
                  {availableRoles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.id === 'admin' ? 'Full Control' : r.id === 'manager' ? 'Operations & Auctions' : r.id === 'collections_agent' ? 'Field Collections' : r.id === 'auction_clerk' ? 'Floor Bidding' : 'Audit'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Initial Password */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Temporary Initial Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="e.g. AgentPass@2026"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Staff member will use this password to sign in via the Staff Portal.
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  disabled={isSubmittingStaff}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-brand-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingStaff ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Create Staff Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RESET PASSWORD ── */}
      {isResetPasswordOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isResettingPassword && setIsResetPasswordOpen(false)}
          />

          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-slate-200 z-50 p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Credential Override</h3>
                  <p className="text-[10px] text-slate-400">For {selectedStaff.full_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPasswordOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            {resetSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                {resetSuccessMsg}
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              Trigger a secure password reset link to <strong>{selectedStaff.email || `${selectedStaff.phone_number}@chitfund.internal`}</strong>.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetPasswordOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSendPasswordResetEmail(selectedStaff)}
                disabled={isResettingPassword}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isResettingPassword ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Send Reset Email</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
