'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { triggerHapticFeedback } from '@/utils/haptics';
import RoleManagerPanel from './RoleManagerPanel';
import RoleAppPreviewModal from './RoleAppPreviewModal';
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
  Check,
  Edit3,
  Ban,
  UserX
} from 'lucide-react';

interface StaffProfile {
  id: string;
  full_name: string;
  phone_number: string;
  role: string;
  email?: string;
  is_blocked?: boolean;
  is_deleted?: boolean;
  created_at: string;
  passbook_token?: string;
  reschedule_acknowledgments?: any;
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
  const { profile: currentAdminProfile, user: currentAdminUser, canPerformAction } = useAuth();
  const canManageStaff = canPerformAction('system:manage_staff');
  const canManageRoles = canPerformAction('system:manage_roles');
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
  const [isDeleteStaffOpen, setIsDeleteStaffOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [selectedPreviewRoleId, setSelectedPreviewRoleId] = useState<string>('collections_agent');
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

  // Edit staff form state
  const [editFullName, setEditFullName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editRole, setEditRole] = useState<string>('collections_agent');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete staff state
  const [isDeletingStaff, setIsDeletingStaff] = useState<boolean>(false);

  // Reset password state
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Helper: Resolve true email (prioritize Supabase auth user email for admin, then profile email, or reschedule_acknowledgments)
  const resolveStaffEmail = (staff: StaffProfile): string | null => {
    if (staff.id === currentAdminProfile?.id || staff.role === 'admin') {
      return currentAdminUser?.email || currentAdminProfile?.email || staff.email || null;
    }
    return staff.email || staff.reschedule_acknowledgments?.email || null;
  };

  // 1. Fetch Staff Profiles & Roles
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

      // Fetch profiles with non-subscriber role
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesErr) {
        console.warn('Error querying profiles:', profilesErr.message);
      }

      const allProfiles = (profilesData || []) as StaffProfile[];

      // Auto-cleanup probe test user from the database if detected
      const probeUser = allProfiles.find(p => p.phone_number === '9876543210' || p.full_name === 'Test Staff Probe');
      if (probeUser) {
        // Purge permanently from database
        supabase.from('profiles').delete().eq('id', probeUser.id).then();
      }

      // Filter staff: non-subscriber, not deleted, and exclude any test probe artifact
      const staffOnly = allProfiles.filter(p => 
        p.role !== 'subscriber' && 
        !p.is_deleted && 
        p.phone_number !== '9876543210' && 
        p.full_name !== 'Test Staff Probe'
      );

      // If active admin is missing from staff list, inject active session admin
      const hasActiveAdmin = staffOnly.some(s => s.id === currentAdminProfile?.id);
      if (!hasActiveAdmin && currentAdminProfile) {
        staffOnly.unshift({
          id: currentAdminProfile.id,
          full_name: currentAdminProfile.fullName,
          phone_number: currentAdminProfile.phoneNumber,
          role: currentAdminProfile.role || 'admin',
          email: currentAdminUser?.email || currentAdminProfile.email,
          created_at: new Date().toISOString(),
          is_blocked: false,
          is_deleted: false,
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAdminProfile?.id, currentAdminUser?.email]);

  // 2. Filter Staff Search & Role Filter
  const filteredStaff = useMemo(() => {
    return staffMembers.filter((staff) => {
      const staffEmail = resolveStaffEmail(staff) || '';
      const matchesSearch = 
        staff.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.phone_number?.includes(searchQuery) ||
        staff.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staffEmail.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === 'all' || staff.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [staffMembers, searchQuery, roleFilter, currentAdminUser?.email]);

  // 3. Open Edit Staff Modal
  const handleOpenEditStaff = (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setEditFullName(staff.full_name);
    setEditEmail(resolveStaffEmail(staff) || '');
    setEditPhone(staff.phone_number);
    setEditRole(staff.role);
    setEditError(null);
    setIsEditStaffOpen(true);
    triggerHapticFeedback('light');
  };

  // 4. Save Edited Staff Details
  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    const cleanName = editFullName.trim();
    const cleanPhone = editPhone.replace(/\D/g, '');
    const cleanEmail = editEmail.trim();

    if (!cleanName) {
      setEditError('Full legal name is required.');
      triggerHapticFeedback('warning');
      return;
    }

    if (cleanPhone.length !== 10) {
      setEditError('Please enter a valid 10-digit mobile number.');
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError(null);

      const updatedMetadata = {
        ...(selectedStaff.reschedule_acknowledgments || {}),
        email: cleanEmail || null,
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: cleanName,
          phone_number: cleanPhone,
          role: editRole,
          reschedule_acknowledgments: updatedMetadata,
        })
        .eq('id', selectedStaff.id);

      if (error) throw error;

      // Update local state immediately
      setStaffMembers(prev => prev.map(s => {
        if (s.id === selectedStaff.id) {
          return {
            ...s,
            full_name: cleanName,
            phone_number: cleanPhone,
            role: editRole,
            email: cleanEmail || undefined,
            reschedule_acknowledgments: updatedMetadata,
          };
        }
        return s;
      }));

      triggerHapticFeedback('success');
      if (onAddAuditLog) {
        onAddAuditLog(`EDIT STAFF: Updated staff record for ${cleanName} (Role: ${editRole})`);
      }

      setIsEditStaffOpen(false);
      setSelectedStaff(null);
    } catch (err: any) {
      triggerHapticFeedback('error');
      setEditError(err.message || 'Failed to update staff record.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 5. Open Delete Staff Confirmation Modal
  const handleOpenDeleteStaff = (staff: StaffProfile) => {
    if (staff.id === currentAdminProfile?.id) {
      alert('Security Policy: You cannot delete your own active administrator account.');
      triggerHapticFeedback('error');
      return;
    }
    setSelectedStaff(staff);
    setIsDeleteStaffOpen(true);
    triggerHapticFeedback('warning');
  };

  // 6. Confirm Permanently Removing Staff
  const handleConfirmDeleteStaff = async () => {
    if (!selectedStaff) return;
    if (selectedStaff.id === currentAdminProfile?.id) return;

    try {
      setIsDeletingStaff(true);

      // Permanently remove workforce access: soft delete profile and demote role
      const { error } = await supabase
        .from('profiles')
        .update({
          is_deleted: true,
          role: 'subscriber',
        })
        .eq('id', selectedStaff.id);

      if (error) throw error;

      // Remove from active staff list
      setStaffMembers(prev => prev.filter(s => s.id !== selectedStaff.id));
      triggerHapticFeedback('success');

      if (onAddAuditLog) {
        onAddAuditLog(`DELETED STAFF: Revoked workforce access for ${selectedStaff.full_name} (${selectedStaff.phone_number})`);
      }

      setIsDeleteStaffOpen(false);
      setSelectedStaff(null);
    } catch (err: any) {
      triggerHapticFeedback('error');
      alert(`Failed to delete staff member: ${err.message}`);
    } finally {
      setIsDeletingStaff(false);
    }
  };

  // 7. Provision New Staff Member
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanPhone = newPhone.replace(/\D/g, '');

    if (!newFullName.trim()) {
      setFormError('Full name is required.');
      triggerHapticFeedback('warning');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError('Please enter a valid official work email address.');
      triggerHapticFeedback('warning');
      return;
    }

    if (cleanPhone.length !== 10) {
      setFormError('Mobile number must be exactly 10 digits.');
      triggerHapticFeedback('warning');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setFormError('Temporary password must be at least 6 characters.');
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsSubmittingStaff(true);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      // Use isolated client so active admin session is not interrupted
      const isolatedClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      // Direct staff confirmation & reset emails to production Cloudflare Pages deployment address
      const productionSiteUrl = 'https://chitfund-manager.pages.dev';
      const redirectBase = typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')
        ? window.location.origin
        : productionSiteUrl;

      const { data: authData, error: authErr } = await isolatedClient.auth.signUp({
        email: cleanEmail,
        password: newPassword,
        options: {
          emailRedirectTo: `${redirectBase}/`,
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
        throw new Error('User provisioning returned empty identity.');
      }

      // Upsert profile record explicitly with email in reschedule_acknowledgments
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: newUserId,
        full_name: newFullName.trim(),
        phone_number: cleanPhone,
        role: newRole,
        is_blocked: false,
        is_deleted: false,
        reschedule_acknowledgments: { email: cleanEmail },
      });

      if (profileErr) {
        console.warn('Profile synchronization notice:', profileErr.message);
      }

      if (onAddAuditLog) {
        onAddAuditLog(`PROVISIONED STAFF: Created account for ${newFullName} (${cleanEmail}) as [${newRole}]`);
      }

      triggerHapticFeedback('success');
      setFormSuccess(`Staff account created for ${newFullName}! Login credentials issued.`);

      // Append to local list immediately
      setStaffMembers(prev => [
        {
          id: newUserId,
          full_name: newFullName.trim(),
          phone_number: cleanPhone,
          role: newRole,
          email: cleanEmail,
          created_at: new Date().toISOString(),
          is_blocked: false,
          is_deleted: false,
          reschedule_acknowledgments: { email: cleanEmail },
        },
        ...prev
      ]);

      setTimeout(() => {
        setIsAddStaffOpen(false);
        setNewFullName('');
        setNewEmail('');
        setNewPhone('');
        setNewPassword('');
        setFormSuccess(null);
      }, 1500);

    } catch (err: any) {
      triggerHapticFeedback('error');
      setFormError(err.message || 'Failed to provision staff member.');
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // 8. Role Quick Switch Dropdown
  const handleUpdateStaffRole = async (staffId: string, targetRoleId: string, staffName: string) => {
    if (staffId === currentAdminProfile?.id) {
      alert('Security Policy: You cannot demote your own administrator account.');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: targetRoleId })
        .eq('id', staffId);

      if (error) throw error;

      setStaffMembers(prev => prev.map(s => s.id === staffId ? { ...s, role: targetRoleId } : s));
      triggerHapticFeedback('light');

      if (onAddAuditLog) {
        onAddAuditLog(`STAFF ROLE: Updated role to [${targetRoleId}] for ${staffName}`);
      }
    } catch (err: any) {
      alert(`Failed to update role: ${err.message}`);
    }
  };

  // 9. Suspend / Reactivate Access (Temporary lockout, does NOT delete data)
  const handleToggleStaffStatus = async (staff: StaffProfile) => {
    if (staff.id === currentAdminProfile?.id) {
      alert('Security Protection: You cannot suspend your own active administrator account.');
      return;
    }

    const nextBlocked = !staff.is_blocked;
    const promptMsg = nextBlocked
      ? `Suspend portal access for ${staff.full_name}?\n\nThis temporarily blocks their login. Their audit history and records will remain safe. (To delete permanently, use the Delete button).`
      : `Reactivate portal access for ${staff.full_name}?`;

    if (!confirm(promptMsg)) {
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
        onAddAuditLog(`${nextBlocked ? 'SUSPENDED' : 'REACTIVATED'} STAFF: Account access updated for ${staff.full_name}`);
      }
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  // 10. Send Password Reset Email
  const handleSendPasswordResetEmail = async (staff: StaffProfile) => {
    const targetEmail = resolveStaffEmail(staff);
    if (!targetEmail) {
      alert(`No registered email found for ${staff.full_name}. Please use Edit to assign their official work email first.`);
      triggerHapticFeedback('warning');
      return;
    }

    try {
      setIsResettingPassword(true);
      const productionSiteUrl = 'https://chitfund-manager.pages.dev';
      const redirectBase = typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')
        ? window.location.origin
        : productionSiteUrl;

      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${redirectBase}/`,
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
                Staff workforce identities, work email credentials, and RBAC permissions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('light');
              setSelectedPreviewRoleId('collections_agent');
              setIsPreviewModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-brand-700 text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap active:scale-95"
            title="Preview entire application exactly as experienced by field staff roles and configure screens in real-time"
          >
            <Eye size={16} className="text-brand-600" />
            <span className="hidden sm:inline">Live Role App Preview</span>
            <span className="sm:hidden">App Preview</span>
          </button>

          {canManageStaff && (
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('light');
                setIsAddStaffOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <UserPlus size={16} />
              <span>Add Staff Member</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Subtab Navigation: Staff Directory vs Role Permissions ── */}
      <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl w-fit text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            triggerHapticFeedback('light');
            setActiveSubtab('staff');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
            activeSubtab === 'staff'
              ? 'bg-white text-slate-900 shadow-xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User size={14} />
          <span>Staff Directory ({staffMembers.length})</span>
        </button>

        {canManageRoles && (
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('light');
              setActiveSubtab('roles');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubtab === 'roles'
                ? 'bg-white text-slate-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders size={14} />
            <span>Role Permissions ({availableRoles.length})</span>
          </button>
        )}
      </div>

      {/* ── SUBTAB 1: STAFF DIRECTORY TABLE ── */}
      {activeSubtab === 'staff' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search staff by name, phone, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-medium"
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

            {/* Role Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold uppercase text-slate-400 mr-1 shrink-0">Filter:</span>
              <button
                type="button"
                onClick={() => { triggerHapticFeedback('light'); setRoleFilter('all'); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  roleFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Staff
              </button>
              {availableRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => { triggerHapticFeedback('light'); setRoleFilter(role.id); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    roleFilter === role.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {role.name}
                </button>
              ))}
            </div>
          </div>

          {/* Staff Roster Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200/80 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Contact &amp; Identity</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.map((staff) => {
                    const roleBadge = getRoleStyle(staff.role);
                    const isSelf = staff.id === currentAdminProfile?.id;
                    const staffEmail = resolveStaffEmail(staff);

                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Member */}
                        <td className="py-3.5 px-4">
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
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                              <Phone size={12} className="text-slate-400" />
                              <span>+91 {staff.phone_number || '—'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                              <Mail size={12} className="text-slate-400 shrink-0" />
                              {staffEmail ? (
                                <span className="truncate max-w-[220px] font-mono text-slate-800 font-medium">{staffEmail}</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 italic">
                                  <span>No email assigned</span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditStaff(staff)}
                                    className="text-[10px] font-bold text-indigo-600 hover:underline not-italic cursor-pointer"
                                  >
                                    + Add
                                  </button>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role Select Dropdown */}
                        <td className="py-3.5 px-4">
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
                        <td className="py-3.5 px-4">
                          {staff.is_blocked ? (
                            <span 
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200"
                              title="Portal access suspended (user cannot log in)"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Suspended
                            </span>
                          ) : (
                            <span 
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
                              title="Active workforce credentials verified"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active Access
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {/* 0. Live Preview App as this Role */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPreviewRoleId(staff.role);
                                setIsPreviewModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-brand-700 transition-colors cursor-pointer"
                              title={`Live Preview & Configure App as ${staff.role}`}
                            >
                              <Eye size={14} />
                            </button>

                            {/* 1. Edit Staff */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditStaff(staff)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="Edit Staff Details"
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* 2. Reset Password */}
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

                            {/* 3. Suspend Access (Lockout) */}
                            <button
                              type="button"
                              onClick={() => handleToggleStaffStatus(staff)}
                              disabled={isSelf}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                staff.is_blocked
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                  : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                              title={staff.is_blocked ? 'Reactivate Account' : 'Suspend Access (Lockout)'}
                            >
                              <ShieldAlert size={14} />
                            </button>

                            {/* 4. Delete Staff Permanently */}
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteStaff(staff)}
                              disabled={isSelf}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Permanently Remove Staff Member"
                            >
                              <Trash2 size={14} />
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
                const staffEmail = resolveStaffEmail(staff);

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
                          {staffEmail ? (
                            <span className="text-[10px] text-slate-600 font-mono block truncate max-w-[200px]">
                              {staffEmail}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic block">
                              No email assigned
                            </span>
                          )}
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
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPreviewRoleId(staff.role);
                          setIsPreviewModalOpen(true);
                        }}
                        className="text-xs font-bold text-brand-700 flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 cursor-pointer"
                        title="Live Preview App as this Role"
                      >
                        <Eye size={13} />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditStaff(staff)}
                        className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
                        title="Edit Details"
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStaff(staff);
                          setIsResetPasswordOpen(true);
                        }}
                        className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
                        title="Reset Password"
                      >
                        <KeyRound size={13} />
                        <span>Key</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStaffStatus(staff)}
                        disabled={isSelf}
                        className={`text-xs font-bold flex items-center justify-center gap-1 py-2 px-2 rounded-xl cursor-pointer ${
                          staff.is_blocked
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        } disabled:opacity-40`}
                        title={staff.is_blocked ? 'Reactivate' : 'Suspend Access'}
                      >
                        <ShieldAlert size={13} />
                        <span>{staff.is_blocked ? 'Unlock' : 'Lock'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDeleteStaff(staff)}
                        disabled={isSelf}
                        className="text-xs font-bold text-rose-700 flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 cursor-pointer disabled:opacity-40"
                        title="Delete Permanently"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
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
          <RoleManagerPanel 
            onOpenAuditLogs={onOpenAuditLogs}
            onRoleUpdated={fetchStaffData}
          />
        </div>
      )}

      {/* ── MODAL 1: ADD / PROVISION NEW STAFF MEMBER ── */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => !isSubmittingStaff && setIsAddStaffOpen(false)}
          />

          <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl border-t sm:border border-slate-200 z-50 p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
                  placeholder="e.g. ramesh.agent@gmail.com"
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
                    placeholder="e.g. StaffPass@2026"
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

      {/* ── MODAL 2: EDIT STAFF DETAILS ── */}
      {isEditStaffOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isSavingEdit && setIsEditStaffOpen(false)}
          />

          <div className="relative bg-white w-full max-w-md rounded-3xl border border-slate-200 z-50 p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Staff Profile</h3>
                  <p className="text-[10px] text-slate-400">Modify workforce identity and permissions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditStaffOpen(false)}
                disabled={isSavingEdit}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditStaff} className="space-y-3.5">
              {/* Full Name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Work Email */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Official Work Email (Login ID)
                </label>
                <input
                  type="email"
                  placeholder="e.g. staff.member@gmail.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Phone */}
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
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Assigned System Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  disabled={selectedStaff.id === currentAdminProfile?.id}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer disabled:opacity-60"
                >
                  {availableRoles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {selectedStaff.id === currentAdminProfile?.id && (
                  <span className="text-[10px] text-amber-600 mt-1 block">
                    Your own administrator role cannot be altered here.
                  </span>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditStaffOpen(false)}
                  disabled={isSavingEdit}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: PERMANENT DELETE STAFF CONFIRMATION ── */}
      {isDeleteStaffOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => !isDeletingStaff && setIsDeleteStaffOpen(false)}
          />

          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-rose-200 z-50 p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
              <UserX size={24} />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Permanently Remove Staff?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove <strong>{selectedStaff.full_name}</strong> from staff access?
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-[11px] text-rose-800 leading-relaxed">
              ⚠️ This will permanently revoke their workforce privileges and remove them from the staff roster.
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsDeleteStaffOpen(false)}
                disabled={isDeletingStaff}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Keep Staff
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                disabled={isDeletingStaff}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-600/25 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeletingStaff ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: RESET PASSWORD (CREDENTIAL OVERRIDE) ── */}
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

            {resolveStaffEmail(selectedStaff) ? (
              <p className="text-xs text-slate-600 leading-relaxed">
                Trigger a secure password reset link to <strong>{resolveStaffEmail(selectedStaff)}</strong>.
              </p>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                No email address is registered for this staff member. Please use <strong>Edit</strong> to assign their official work email before triggering a reset link.
              </div>
            )}

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
                disabled={isResettingPassword || !resolveStaffEmail(selectedStaff)}
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
      {/* ── MODAL 5: ROLE APP PREVIEW & SCREEN CONFIGURATOR ── */}
      <RoleAppPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        initialRoleId={selectedPreviewRoleId || 'collections_agent'}
        onRoleUpdated={() => {
          fetchStaffData();
        }}
      />
    </div>
  );
}
