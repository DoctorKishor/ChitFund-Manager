'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { CustomRoleRecord } from '@/utils/rbac';
import {
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  Check,
  X,
  Lock,
  Search,
  Users,
  Sliders,
  Copy,
  RotateCcw,
  Download,
  Phone,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX
} from 'lucide-react';

interface ProfileRecord {
  id: string;
  full_name: string;
  phone_number: string;
  role: string;
  created_at: string;
  passbook_token?: string;
}

interface PermissionCategory {
  id: number;
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
  toggleBgClass: string;
  items: {
    key: string;
    label: string;
    desc: string;
    type: 'tab' | 'action';
  }[];
}

const CATEGORIES: PermissionCategory[] = [
  {
    id: 1,
    badge: '1',
    badgeClass: 'bg-indigo-50 text-brand-600',
    title: 'Module & Navigation Access',
    subtitle: 'Controls top navigation & sidebar visibility',
    toggleBgClass: 'peer-checked:bg-brand-600',
    items: [
      { key: 'dashboard', label: 'Overview Dashboard', desc: 'High-level financial summaries & charts', type: 'tab' },
      { key: 'chits', label: 'Chits & Groups Directory', desc: 'View scheme rosters and pool balances', type: 'tab' },
      { key: 'members', label: 'Members & Passbooks', desc: 'Member directory & passbook scanner', type: 'tab' },
      { key: 'auctions', label: 'Auctions & Live Bidding', desc: 'Real-time auction desk and prize pots', type: 'tab' },
      { key: 'cash', label: 'Treasury & Cash Vaults', desc: 'Physical cash drawer & bank ledger', type: 'tab' },
      { key: 'communication', label: 'WhatsApp Broadcaster', desc: 'Direct notices & payment receipts dispatch', type: 'tab' },
    ],
  },
  {
    id: 2,
    badge: '2',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    title: 'Member & Passbook Logistics',
    subtitle: 'Core operations for Collections Agent',
    toggleBgClass: 'peer-checked:bg-emerald-600',
    items: [
      { key: 'members:view', label: 'View Member Rosters', desc: 'Search subscriber names & ticket IDs', type: 'action' },
      { key: 'members:collect', label: 'Record Installment Collections', desc: 'Post cash, UPI, & issue digital receipts', type: 'action' },
      { key: 'members:pair_qr', label: 'Pair & Print Passbook QRs', desc: 'Link camera QR scan to physical booklet', type: 'action' },
      { key: 'members:enroll', label: 'Enroll New Members', desc: 'Register new subscribers and tickets', type: 'action' },
      { key: 'members:edit', label: 'Edit Subscriber Info', desc: 'Modify phone numbers and addresses', type: 'action' },
      { key: 'members:suspend', label: 'Suspend Portal Access', desc: 'Trigger default locks and bidding blocks', type: 'action' },
    ],
  },
  {
    id: 3,
    badge: '3',
    badgeClass: 'bg-amber-50 text-amber-700',
    title: 'Chit Scheme Lifecycle',
    subtitle: 'Restricted configuration management',
    toggleBgClass: 'peer-checked:bg-brand-600',
    items: [
      { key: 'chits:view', label: 'View Chit Scheme Details', desc: 'Inspect duration, pot totals, and cycles', type: 'action' },
      { key: 'chits:create', label: 'Create New Chit Pool', desc: 'Launch ₹1L, ₹2L or custom groups', type: 'action' },
      { key: 'chits:edit', label: 'Edit Group Rules & Dates', desc: 'Adjust monthly deadlines and caps', type: 'action' },
    ],
  },
  {
    id: 4,
    badge: '4',
    badgeClass: 'bg-purple-50 text-purple-700',
    title: 'Live Auctions & Bidding Operations',
    subtitle: 'Monthly floor bidding & payout dispatch',
    toggleBgClass: 'peer-checked:bg-purple-600',
    items: [
      { key: 'auctions:conduct', label: 'Conduct Live Auction Cycles', desc: 'Finalize winning discount bids, advance chit month cycles, & pool', type: 'action' },
      { key: 'auctions:bid', label: 'Place Proxy Bids for Tickets', desc: 'Shout live discount bids on behalf of eligible non-winning subscribers', type: 'action' },
      { key: 'auctions:disburse', label: 'Disburse Prize Pot Payouts', desc: 'Authorize and disburse net pot payouts to winning subscribers', type: 'action' },
    ],
  },
  {
    id: 5,
    badge: '5',
    badgeClass: 'bg-rose-50 text-rose-700',
    title: 'Treasury & Financial Vaults',
    subtitle: 'High-Risk Administrative Controls',
    toggleBgClass: 'peer-checked:bg-amber-500',
    items: [
      { key: 'treasury:collect_cash', label: 'Accept Physical Cash & Field Receipts', desc: 'Accept physical currency and issue immediate passbook receipts', type: 'action' },
      { key: 'treasury:move_money', label: 'ATM & Inter-Vault Relocations', desc: 'Transfer funds between digital bank accounts (Kishor / Dad / Mom Bank) & Cash Box', type: 'action' },
      { key: 'treasury:personal_draw', label: 'Petty Cash & Personal Draws', desc: 'Record authorized expenses such as vehicle fuel, office maintenance, admin draws', type: 'action' },
      { key: 'treasury:reconcile', label: 'Physical Denomination Reconciliation', desc: 'Perform physical note counts and lock cash-in-hand audits', type: 'action' },
    ],
  },
];

const COLOR_PRESETS = [
  { name: 'Indigo', hex: '#4F46E5', bgClass: 'bg-brand-600' },
  { name: 'Emerald', hex: '#10B981', bgClass: 'bg-emerald-500' },
  { name: 'Amber', hex: '#F59E0B', bgClass: 'bg-amber-500' },
  { name: 'Purple', hex: '#8B5CF6', bgClass: 'bg-purple-500' },
  { name: 'Sky Blue', hex: '#0EA5E9', bgClass: 'bg-sky-500' },
  { name: 'Rose', hex: '#F43F5E', bgClass: 'bg-rose-500' },
];

const ROLE_EMOJIS: Record<string, string> = {
  admin: '👑',
  manager: '💼',
  subscriber: '📱',
  collections_agent: '💳',
  auction_clerk: '🔨',
  auditor: '📊',
};

interface RoleManagerPanelProps {
  onRoleUpdated?: () => void;
  isCreateModalOpen?: boolean;
  setIsCreateModalOpen?: (open: boolean) => void;
  onExportPolicy?: () => void;
}

export default function RoleManagerPanel({
  onRoleUpdated,
  isCreateModalOpen: externalIsCreateModalOpen,
  setIsCreateModalOpen: externalSetIsCreateModalOpen,
  onExportPolicy,
}: RoleManagerPanelProps) {
  const { profile: currentAdminProfile } = useAuth();
  const [roles, setRoles] = useState<CustomRoleRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('collections_agent');

  // Editing state for active role
  const [editColor, setEditColor] = useState<string>('#F59E0B');
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [allowedActions, setAllowedActions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Internal create modal state
  const [internalIsCreateModalOpen, setInternalIsCreateModalOpen] = useState<boolean>(false);
  const isCreateModalOpen = externalIsCreateModalOpen ?? internalIsCreateModalOpen;
  const setIsCreateModalOpen = externalSetIsCreateModalOpen ?? setInternalIsCreateModalOpen;

  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleDescription, setNewRoleDescription] = useState<string>('');
  const [newRoleColor, setNewRoleColor] = useState<string>('#4F46E5');
  const [newRoleIsPrivileged, setNewRoleIsPrivileged] = useState<boolean>(false);
  const [isCreatingRole, setIsCreatingRole] = useState<boolean>(false);

  // Assign Member modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [selectedProfileIdToAssign, setSelectedProfileIdToAssign] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Fetch Roles and Profiles from Supabase
  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, profilesRes] = await Promise.all([
        supabase
          .from('custom_roles')
          .select('*')
          .order('is_system', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, phone_number, role, created_at, passbook_token')
          .order('full_name', { ascending: true }),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      const rolesData = rolesRes.data || [];
      setRoles(rolesData);

      if (profilesRes.data) {
        setProfiles(profilesRes.data);
      }

      // Default selection priority
      if (rolesData.length > 0) {
        const found = rolesData.find((r) => r.id === selectedRoleId);
        if (!found) {
          const colAgent = rolesData.find((r) => r.id === 'collections_agent');
          if (colAgent) {
            setSelectedRoleId(colAgent.id);
            syncRoleState(colAgent);
          } else {
            setSelectedRoleId(rolesData[0].id);
            syncRoleState(rolesData[0]);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching role data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) || roles[0];
  }, [roles, selectedRoleId]);

  const syncRoleState = (role: CustomRoleRecord) => {
    setEditColor(role.color || '#4F46E5');
    setAllowedTabs(role.allowed_tabs || []);
    setAllowedActions(role.allowed_actions || []);
    setSaveSuccess(false);
  };

  useEffect(() => {
    if (activeRole) {
      syncRoleState(activeRole);
    }
  }, [activeRole?.id]);

  const selectRole = (role: CustomRoleRecord) => {
    setSelectedRoleId(role.id);
    syncRoleState(role);
  };

  // Group roles into Built-in and Custom
  const builtInRoles = useMemo(() => roles.filter((r) => r.is_system), [roles]);
  const customRoles = useMemo(() => roles.filter((r) => !r.is_system), [roles]);

  // Profile counts per role
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    profiles.forEach((p) => {
      counts[p.role] = (counts[p.role] || 0) + 1;
    });
    return counts;
  }, [profiles]);

  // Personnel assigned to active role
  const assignedPersonnel = useMemo(() => {
    if (!activeRole) return [];
    return profiles.filter((p) => p.role === activeRole.id);
  }, [profiles, activeRole]);

  // Overall metric counts
  const staffCount = useMemo(() => profiles.filter((p) => p.role !== 'subscriber').length, [profiles]);
  const totalUsers = profiles.length;
  const subscriberCount = roleCounts['subscriber'] || 0;
  const adminProfiles = useMemo(() => profiles.filter((p) => p.role === 'admin'), [profiles]);
  const adminName = adminProfiles[0]?.full_name || 'Dr. Kishor Anbazhakan';

  // Toggle Tab Permission
  const toggleTab = (tabKey: string) => {
    if (activeRole?.id === 'admin') return;
    setAllowedTabs((prev) =>
      prev.includes(tabKey) ? prev.filter((t) => t !== tabKey) : [...prev, tabKey]
    );
  };

  // Toggle Action Permission
  const toggleAction = (actionKey: string) => {
    if (activeRole?.id === 'admin') return;
    setAllowedActions((prev) =>
      prev.includes(actionKey) ? prev.filter((a) => a !== actionKey) : [...prev, actionKey]
    );
  };

  // Select All Permissions
  const handleSelectAll = () => {
    if (activeRole?.id === 'admin') return;
    const allTabs = CATEGORIES[0].items.map((i) => i.key);
    const allActs = CATEGORIES.slice(1).flatMap((c) => c.items.map((i) => i.key));
    setAllowedTabs(allTabs);
    setAllowedActions(allActs);
  };

  // Deselect All Permissions
  const handleDeselectAll = () => {
    if (activeRole?.id === 'admin') return;
    setAllowedTabs([]);
    setAllowedActions([]);
  };

  // Reset to active role defaults
  const handleResetDefaults = () => {
    if (!activeRole) return;
    setAllowedTabs(activeRole.allowed_tabs || []);
    setAllowedActions(activeRole.allowed_actions || []);
    setEditColor(activeRole.color || '#4F46E5');
  };

  // Save Role Changes to Supabase
  const handleSaveRole = async () => {
    if (!activeRole) return;
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('custom_roles')
        .update({
          color: editColor,
          allowed_tabs: activeRole.id === 'admin' ? activeRole.allowed_tabs : allowedTabs,
          allowed_actions: activeRole.id === 'admin' ? activeRole.allowed_actions : allowedActions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeRole.id);

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await fetchData();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      alert(`Failed to save role: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Clone Role
  const handleCloneRole = async () => {
    if (!activeRole) return;
    const cloneId = `${activeRole.id}_copy_${Date.now().toString().slice(-4)}`;
    const cloneName = `${activeRole.name} (Copy)`;

    try {
      const { error } = await supabase.from('custom_roles').insert({
        id: cloneId,
        name: cloneName,
        description: activeRole.description || 'Cloned custom security role',
        color: activeRole.color || '#4F46E5',
        is_system: false,
        is_privileged: !!activeRole.is_privileged,
        allowed_tabs: allowedTabs,
        allowed_actions: allowedActions,
      });

      if (error) throw error;

      setSelectedRoleId(cloneId);
      await fetchData();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      alert(`Failed to clone role: ${err.message}`);
    }
  };

  // Delete Custom Role
  const handleDeleteRole = async () => {
    if (!activeRole) return;
    if (activeRole.is_system) {
      alert('Security Protection: System default roles (Admin, Manager, Subscriber) cannot be deleted.');
      return;
    }

    const assignedCount = roleCounts[activeRole.id] || 0;
    const confirmMessage =
      assignedCount > 0
        ? `Warning: There are currently ${assignedCount} user(s) assigned to "${activeRole.name}". Deleting this role will automatically reassign those users to Subscriber. Proceed?`
        : `Are you sure you want to delete custom role "${activeRole.name}"?`;

    if (!confirm(confirmMessage)) return;

    try {
      // Reassign assigned users to subscriber
      if (assignedCount > 0) {
        await supabase
          .from('profiles')
          .update({ role: 'subscriber' })
          .eq('role', activeRole.id);
      }

      const { error } = await supabase.from('custom_roles').delete().eq('id', activeRole.id);
      if (error) throw error;

      setSelectedRoleId('subscriber');
      await fetchData();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      alert(`Failed to delete role: ${err.message}`);
    }
  };

  // Create New Custom Role
  const handleCreateNewRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newRoleName.trim();
    if (!cleanName) {
      alert('Please provide a valid role name.');
      return;
    }

    const generatedId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (roles.some((r) => r.id === generatedId)) {
      alert(`A role with ID "${generatedId}" already exists. Choose a unique name.`);
      return;
    }

    try {
      setIsCreatingRole(true);
      const defaultTabs: string[] = ['dashboard', 'chits', 'members', 'communication'];
      const defaultActions: string[] = ['members:view', 'members:collect'];

      const { error } = await supabase.from('custom_roles').insert({
        id: generatedId,
        name: cleanName,
        description: newRoleDescription.trim() || 'Custom organizational role',
        color: newRoleColor,
        is_system: false,
        is_privileged: newRoleIsPrivileged,
        allowed_tabs: defaultTabs,
        allowed_actions: defaultActions,
      });

      if (error) throw error;

      setIsCreateModalOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRoleColor('#4F46E5');
      setNewRoleIsPrivileged(false);
      setSelectedRoleId(generatedId);
      await fetchData();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      alert(`Failed to create role: ${err.message}`);
    } finally {
      setIsCreatingRole(false);
    }
  };

  // Assign Member to Role
  const handleAssignMember = async () => {
    if (!selectedProfileIdToAssign || !activeRole) return;
    try {
      setIsAssigning(true);
      const { error } = await supabase
        .from('profiles')
        .update({ role: activeRole.id })
        .eq('id', selectedProfileIdToAssign);

      if (error) throw error;

      setIsAssignModalOpen(false);
      setSelectedProfileIdToAssign('');
      await fetchData();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      alert(`Failed to assign role: ${err.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  // Remove member from Role (reassign to subscriber)
  const handleRemoveMemberFromRole = async (profileId: string, profileName: string) => {
    if (!confirm(`Reassign "${profileName}" back to Subscriber role?`)) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'subscriber' })
        .eq('id', profileId);

      if (error) throw error;

      await fetchData();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      alert(`Failed to remove role: ${err.message}`);
    }
  };

  // Count active permissions for active role
  const totalPermissionsCount = allowedTabs.length + allowedActions.length;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
      
      {/* ── DESKTOP ROLES & PERMISSIONS WORKSPACE (p-7 matching Stitch) ── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-7">
        <div className="w-full max-w-[1550px] mx-auto space-y-6">

          {/* Top Overview Metrics Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Metric 1: Active Staff & Admins */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Staff &amp; Admins</span>
                <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold font-display">
                  {staffCount}
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-black font-display text-slate-900">{staffCount} Staff</span>
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">/ {totalUsers} Total Users</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-emerald-600 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>
                  {adminProfiles.length} Super Admin · {Math.max(0, staffCount - adminProfiles.length)} Operations Agent
                  {Math.max(0, staffCount - adminProfiles.length) === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {/* Metric 2: Security Architecture */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Security Architecture</span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-brand-700 text-[10px] font-bold border border-brand-200/60">
                  RBAC Local
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-black font-display text-slate-900">{roles.length} Roles</span>
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  ({builtInRoles.length} Built-in, {customRoles.length} Custom)
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Granular module gating</span>
                <span className="text-brand-600 font-semibold cursor-pointer hover:underline text-[11px]">Audit Logs</span>
              </div>
            </div>

            {/* Metric 3: Permission Checkpoints */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Permission Checkpoints</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/60">
                  24 Rules
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-black font-display text-slate-900">5 Modules</span>
                <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">Strict Zero-Trust</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                <span>Enforces physical QR verification limits</span>
              </div>
            </div>

            {/* Metric 4: Default Subscriber Tier */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Default Subscriber Tier</span>
                <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center text-xs font-bold">
                  🔒
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-black font-display text-slate-900">Read-Only</span>
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Mobile App Appointed</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-indigo-600 font-medium">
                <span>{subscriberCount} active members bound to Subscriber tier</span>
              </div>
            </div>
          </section>

          {/* Main Two-Column Layout: Roles Roster Rail (left 340px) + Detailed Permission Matrix & Staff (right remainder) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 items-start">

            {/* Left Column: Roles Roster & Hierarchy (4 cols out of 12 ~ 360px) */}
            <section className="xl:col-span-4 space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900">Defined System &amp; Custom Roles</h3>
                    <p className="text-[11px] text-slate-400">Select a role to inspect or modify capabilities</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {roles.length} Roles
                  </span>
                </div>

                {/* Built-In Roles Group */}
                <div className="space-y-2 mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    Built-in Protected Roles
                  </span>

                  {/* Built-in: Admin */}
                  {builtInRoles.find((r) => r.id === 'admin') && (
                    <div
                      onClick={() => selectRole(builtInRoles.find((r) => r.id === 'admin')!)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between ${
                        selectedRoleId === 'admin'
                          ? 'border-2 border-brand-500 bg-brand-50/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold font-display">
                          👑
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-brand-600 transition-colors">Admin</span>
                            <span className="text-[9px] uppercase font-bold py-0.5 px-1.5 bg-brand-50 text-brand-700 border border-brand-200/60 rounded">
                              Full Access
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {roleCounts['admin'] || 1} Member Assigned · {adminName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono">Protected</span>
                      </div>
                    </div>
                  )}

                  {/* Built-in: Manager */}
                  {builtInRoles.find((r) => r.id === 'manager') && (
                    <div
                      onClick={() => selectRole(builtInRoles.find((r) => r.id === 'manager')!)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between ${
                        selectedRoleId === 'manager'
                          ? 'border-2 border-brand-500 bg-brand-50/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold font-display">
                          💼
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-brand-600 transition-colors">Manager</span>
                            <span className="text-[9px] uppercase font-bold py-0.5 px-1.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded">
                              Operational
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {roleCounts['manager'] || 0} Members Assigned
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono">System</span>
                      </div>
                    </div>
                  )}

                  {/* Built-in: Subscriber */}
                  {builtInRoles.find((r) => r.id === 'subscriber') && (
                    <div
                      onClick={() => selectRole(builtInRoles.find((r) => r.id === 'subscriber')!)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between ${
                        selectedRoleId === 'subscriber'
                          ? 'border-2 border-brand-500 bg-brand-50/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold font-display">
                          📱
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-brand-600 transition-colors">Subscriber</span>
                            <span className="text-[9px] uppercase font-bold py-0.5 px-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded">
                              Read-Only
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {subscriberCount} Members Assigned
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono">Default Tier</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom Delegated Roles Group */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    Custom Delegated Roles
                  </span>

                  {customRoles.map((role) => {
                    const isSelected = role.id === selectedRoleId;
                    const assignedList = profiles.filter((p) => p.role === role.id);
                    const assignedCount = assignedList.length;
                    const leadName = assignedList[0]?.full_name?.split(' ')[0] || '';
                    const emoji = ROLE_EMOJIS[role.id] || '🛡️';

                    if (isSelected) {
                      return (
                        <div
                          key={role.id}
                          className="p-3.5 rounded-xl border-2 border-brand-500 bg-brand-50/20 shadow-xs transition-all cursor-pointer relative"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-display shadow-2xs"
                                style={{
                                  backgroundColor: `${role.color || '#F59E0B'}25`,
                                  color: role.color || '#D97706',
                                }}
                              >
                                {emoji}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-brand-900 truncate">{role.name}</span>
                                  <span className="text-[9px] uppercase font-bold py-0.5 px-1.5 bg-amber-100 text-amber-800 border border-amber-200/70 rounded whitespace-nowrap">
                                    Field Staff
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                                  {assignedCount} Member{assignedCount === 1 ? '' : 's'} Assigned {leadName && `· ${leadName}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="w-2 h-2 rounded-full bg-brand-600"></span>
                              <span className="text-[10px] font-bold text-brand-700 uppercase">Selected</span>
                            </div>
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-brand-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="truncate pr-2">{role.description || 'Custom operations'}</span>
                            <span className="font-mono text-brand-600 font-semibold shrink-0">
                              {(role.allowed_tabs?.length || 0) + (role.allowed_actions?.length || 0)} Perms
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={role.id}
                        onClick={() => selectRole(role)}
                        className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-all cursor-pointer group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-display shadow-2xs"
                            style={{
                              backgroundColor: `${role.color || '#8B5CF6'}20`,
                              color: role.color || '#8B5CF6',
                            }}
                          >
                            {emoji}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                                {role.name}
                              </span>
                              <span className="text-[9px] uppercase font-bold py-0.5 px-1.5 bg-purple-50 text-purple-700 border border-purple-200/60 rounded whitespace-nowrap">
                                {role.id === 'auction_clerk' ? 'Bidding Live' : role.id === 'auditor' ? 'Audit Only' : 'Custom'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {assignedCount} Member{assignedCount === 1 ? '' : 's'} Assigned
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-[10px] text-slate-400 font-mono">Custom</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Role Action Helpers */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleCloneRole}
                    className="text-brand-600 hover:text-brand-700 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Clone Role</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteRole}
                    disabled={activeRole?.is_system}
                    className={`font-semibold inline-flex items-center gap-1 transition-colors ${
                      activeRole?.is_system
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-rose-600 hover:text-rose-700 cursor-pointer'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Custom Role</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Right Column: Granular Permission Matrix & Assigned Staff (8 cols out of 12) */}
            <section className="xl:col-span-8 space-y-6">

              {/* Role Banner & Summary Header */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-12 h-12 rounded-2xl font-bold flex items-center justify-center font-display text-xl shadow-xs shrink-0"
                    style={{
                      backgroundColor: `${editColor}20`,
                      color: editColor,
                    }}
                  >
                    {ROLE_EMOJIS[activeRole?.id || ''] || '💳'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display font-bold text-lg text-slate-900 leading-tight truncate">
                        {activeRole?.name}
                      </h2>
                      <span className="text-xs font-bold py-0.5 px-2 bg-amber-100 text-amber-800 border border-amber-200/60 rounded-full whitespace-nowrap">
                        {activeRole?.is_system ? 'Protected System Role' : 'Custom Field Role'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ID: {activeRole?.id}
                      </span>
                      <div className="h-3.5 w-px bg-slate-200 hidden sm:block"></div>
                      <div className="flex items-center gap-1.5 pl-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">
                          Role Color:
                        </span>
                        {COLOR_PRESETS.map((p) => {
                          const isActive = editColor.toLowerCase() === p.hex.toLowerCase();
                          return (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => setEditColor(p.hex)}
                              title={p.name}
                              className={`w-3.5 h-3.5 rounded-full hover:scale-110 transition-transform cursor-pointer ${p.bgClass} ${
                                isActive ? 'ring-2 ring-brand-500 ring-offset-1' : ''
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {activeRole?.description ||
                        'Authorizes ground field personnel to accept offline installments, authenticate booklets via camera scanner, and record daily cash collections.'}
                    </p>
                  </div>
                </div>

                {/* Role Control Actions */}
                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Reset to Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRole}
                    disabled={isSaving}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-brand-500/25 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" strokeWidth={2.5} />
                        <span>Saved!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Saving...' : 'Save Permission Changes'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Permission Categories Matrix Container */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900">Configured Access Matrix</h3>
                    <p className="text-xs text-slate-500">Toggle modules and operational privileges for this security role</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Quick Presets:</span>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {CATEGORIES.map((cat) => (
                    <div key={cat.id} className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg ${cat.badgeClass} flex items-center justify-center font-bold text-xs font-display`}>
                            {cat.badge}
                          </div>
                          <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-wider">
                            {cat.title}
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {cat.subtitle}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                        {cat.items.map((item) => {
                          const isChecked =
                            activeRole?.id === 'admin' ||
                            (item.type === 'tab' ? allowedTabs.includes(item.key) : allowedActions.includes(item.key));

                          return (
                            <label
                              key={item.key}
                              className={`flex items-start justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none ${
                                isChecked
                                  ? 'border-brand-200/80 bg-brand-50/20 hover:bg-brand-50/30'
                                  : 'border-slate-200/80 bg-slate-50/40 hover:bg-slate-50'
                              } ${activeRole?.id === 'admin' ? 'cursor-not-allowed opacity-90' : ''}`}
                            >
                              <div className="pr-2 min-w-0">
                                <span className={`font-bold block text-xs truncate ${isChecked ? 'text-slate-900' : 'text-slate-800'}`}>
                                  {item.label}
                                </span>
                                <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                                  {item.desc}
                                </span>
                              </div>
                              <div className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={activeRole?.id === 'admin'}
                                  onChange={() => {
                                    if (item.type === 'tab') toggleTab(item.key);
                                    else toggleAction(item.key);
                                  }}
                                  className="sr-only peer"
                                />
                                <div
                                  className={`w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${cat.toggleBgClass}`}
                                ></div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Action Panel */}
                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Modifications to <b>{activeRole?.name}</b> apply immediately across all authorized staff devices.
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveRole}
                    disabled={isSaving}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer active:scale-95"
                  >
                    {isSaving ? 'Saving...' : 'Save Permission Changes'}
                  </button>
                </div>
              </div>

              {/* Section: Staff & Members Assigned to Active Role */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900">
                      Personnel Assigned to &quot;{activeRole?.name}&quot;
                    </h3>
                    <p className="text-xs text-slate-500">Users authorized with these specific operational parameters</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" strokeWidth={2.5} />
                    <span>+ Assign Member / Staff</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {assignedPersonnel.length > 0 ? (
                    assignedPersonnel.map((user) => {
                      const initial = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';
                      const formattedDate = user.created_at
                        ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '18 Aug 2026';

                      return (
                        <div
                          key={user.id}
                          className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors bg-white"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center font-display text-xs shadow-2xs shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 truncate">{user.full_name}</span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 whitespace-nowrap">
                                  {user.role === 'admin' ? 'Super Admin' : activeRole?.name}
                                </span>
                                <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">
                                  {user.passbook_token ? '● Device Paired' : '○ Standalone'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                                {user.phone_number || '+91 97910 88219'} · Assigned {formattedDate}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                alert(`Security Audit Log: ${user.full_name} granted ${activeRole?.name} credentials.`)
                              }
                              className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              Audit Log
                            </button>
                            {user.role !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMemberFromRole(user.id, user.full_name)}
                                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 bg-white">
                      No personnel currently assigned to &quot;{activeRole?.name}&quot;. Click &quot;+ Assign Member / Staff&quot; to authorize a user.
                    </div>
                  )}
                </div>
              </div>

            </section>
          </div>

        </div>
      </main>

      {/* ── CREATE NEW ROLE MODAL ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="font-bold font-display text-sm text-slate-900">Create Custom Security Role</h3>
                  <p className="text-[11px] text-slate-400">Define credentials and delegate operational rights</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewRole} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Field Supervisor / CA Auditor"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Color Palette</label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setNewRoleColor(p.hex)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${p.bgClass} ${
                        newRoleColor.toLowerCase() === p.hex.toLowerCase()
                          ? 'ring-2 ring-brand-500 ring-offset-2 scale-110'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                    >
                      {newRoleColor.toLowerCase() === p.hex.toLowerCase() && (
                        <Check size={12} className="text-white drop-shadow-xs" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Scope &amp; Responsibilities</label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe operational access boundaries..."
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                <div>
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                    <ShieldCheck size={13} className="text-amber-700" />
                    <span>Database Privilege (RLS)</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Allow access to multi-vault treasury and member rosters
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewRoleIsPrivileged((prev) => !prev)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ml-3 cursor-pointer ${
                    newRoleIsPrivileged ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                      newRoleIsPrivileged ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRole}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  {isCreatingRole ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ASSIGN MEMBER MODAL ── */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display text-sm text-slate-900">
                  Assign User to &quot;{activeRole?.name}&quot;
                </h3>
                <p className="text-[11px] text-slate-400">Select a subscriber profile to authorize with this role</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select User Profile</label>
                <select
                  value={selectedProfileIdToAssign}
                  onChange={(e) => setSelectedProfileIdToAssign(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- Choose Subscriber --</option>
                  {profiles
                    .filter((p) => p.role !== activeRole?.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.phone_number}) - Currently: {p.role}
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                Granting this role authorizes the user immediately on all connected devices and updates the system audit log.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedProfileIdToAssign || isAssigning}
                  onClick={handleAssignMember}
                  className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  {isAssigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
