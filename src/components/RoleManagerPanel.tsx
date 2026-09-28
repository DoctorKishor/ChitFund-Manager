'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { CustomRoleRecord } from '@/utils/rbac';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  Save,
  Check,
  X,
  Lock,
  Search,
  Users,
  Sparkles,
  RefreshCw,
  Sliders,
  Palette,
  Eye,
  Layers,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight
} from 'lucide-react';

interface RoleCategoryConfig {
  id: string;
  title: string;
  icon: any;
  description: string;
  items: {
    key: string;
    label: string;
    desc: string;
    type: 'tab' | 'action';
  }[];
}

const PRESET_COLORS = [
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Purple', value: '#9333EA' },
  { name: 'Sky Blue', value: '#0284C7' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Amber', value: '#D97706' },
  { name: 'Rose', value: '#E11D48' },
  { name: 'Fuchsia', value: '#C026D3' },
  { name: 'Slate', value: '#475569' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Orange', value: '#EA580C' },
];

const PERMISSION_CATEGORIES: RoleCategoryConfig[] = [
  {
    id: 'navigation',
    title: 'Navigation & Module Tabs',
    icon: Layers,
    description: 'Control which core navigation panels and screens are accessible in the primary sidebar.',
    items: [
      { key: 'dashboard', label: 'Dashboard & Analytics', desc: 'View high-level cash overview and active chits KPI summary.', type: 'tab' },
      { key: 'chits', label: 'Chit Groups Management', desc: 'Browse and inspect all family & community chit funds.', type: 'tab' },
      { key: 'members', label: 'Members Matrix & Passbooks', desc: 'View subscriber rosters, ticket assignments, and physical QR codes.', type: 'tab' },
      { key: 'auctions', label: 'Live Auction Arena', desc: 'Enter the real-time bidding room and view live discount shoutings.', type: 'tab' },
      { key: 'cash', label: 'Treasury & Multi-Vault Ledger', desc: 'Inspect physical cash box, digital bank accounts, and transactions.', type: 'tab' },
      { key: 'communication', label: 'WhatsApp Broadcasts', desc: 'Compose reminders, auction results, and member alerts.', type: 'tab' },
      { key: 'reports', label: 'Reports & Statements', desc: 'Export financial ledgers, member passbook summaries, and receipts.', type: 'tab' },
      { key: 'users', label: 'Access Control & Roles', desc: 'Manage registered users, QR pairing, and custom role permissions.', type: 'tab' },
      { key: 'settings', label: 'System Settings', desc: 'Configure global parameters, backup tools, and security rules.', type: 'tab' },
    ],
  },
  {
    id: 'chits_ops',
    title: 'Chit Fund Operations',
    icon: Sparkles,
    description: 'Permissions for creating, editing, and managing chit group life cycles.',
    items: [
      { key: 'chits:view', label: 'View Chit Groups', desc: 'Inspect chit group details, installment schedules, and month states.', type: 'action' },
      { key: 'chits:create', label: 'Create New Chit Fund', desc: 'Launch new chit fund schemes with custom value, duration, and member slots.', type: 'action' },
      { key: 'chits:edit', label: 'Edit Group Parameters', desc: 'Modify group notes, custom installment rules, or dates.', type: 'action' },
      { key: 'chits:delete', label: 'Delete / Archive Chit Fund', desc: 'Permanently remove or archive completed chit groups.', type: 'action' },
    ],
  },
  {
    id: 'members_ops',
    title: 'Member Management & Collections',
    icon: Users,
    description: 'Permissions for member enrollments, physical passbooks, and monthly collections.',
    items: [
      { key: 'members:view', label: 'View Member Rosters', desc: 'Browse enrolled tickets, contact info, and payment records.', type: 'action' },
      { key: 'members:enroll', label: 'Enroll Subscribers', desc: 'Assign members to chit tickets and initialize payment profiles.', type: 'action' },
      { key: 'members:collect', label: 'Record Monthly Collections', desc: 'Accept physical cash/UPI collections and sync with passbooks.', type: 'action' },
      { key: 'members:edit', label: 'Edit Member Profiles', desc: 'Update phone numbers, full names, and bank details.', type: 'action' },
      { key: 'members:delete', label: 'Remove / Unenroll Member', desc: 'Expel a ticket or transfer slot to another subscriber.', type: 'action' },
    ],
  },
  {
    id: 'auctions_ops',
    title: 'Live Auction Bidding & Payouts',
    icon: CircleDot,
    description: 'Permissions for conducting live monthly bidding cycles and winner disbursements.',
    items: [
      { key: 'auctions:view', label: 'Spectate Live Auctions', desc: 'View active auction room, participant bids, and countdowns.', type: 'action' },
      { key: 'auctions:bid', label: 'Place Discount Bids', desc: 'Shout live discount bids on behalf of an eligible ticket.', type: 'action' },
      { key: 'auctions:conduct', label: 'Conduct & Close Auction', desc: 'Finalize winning bid, advance chit month, and accumulate discount pool.', type: 'action' },
      { key: 'auctions:disburse', label: 'Disburse Prize Pot Payout', desc: 'Execute net payout transfer/cash disbursement to the winning subscriber.', type: 'action' },
    ],
  },
  {
    id: 'treasury_ops',
    title: 'Treasury & 4-Vault Ledger',
    icon: ShieldCheck,
    description: 'Permissions for physical cash box handling, digital bank accounts, and ATM relocations.',
    items: [
      { key: 'treasury:view', label: 'View Multi-Vault Balances', desc: 'Inspect real-time balances of Cash Box, Kishor Bank, Dad Bank, and Mom Bank.', type: 'action' },
      { key: 'treasury:move_money', label: 'Relocate Funds / ATM Draw', desc: 'Perform bank-to-cash or inter-vault transfers with physical verification.', type: 'action' },
      { key: 'treasury:deposit', label: 'Direct Vault Deposit', desc: 'Add capital injections or external deposits into any vault.', type: 'action' },
      { key: 'treasury:personal_draw', label: 'Record Personal Draws / Spends', desc: 'Log authorized petty cash expenses (petrol, maintenance, etc.).', type: 'action' },
      { key: 'treasury:recover_float', label: 'Recover Admin Float', desc: 'Record repayments or re-credits to floating accounts.', type: 'action' },
      { key: 'treasury:reconcile', label: 'Physical Cash Reconcile', desc: 'Perform cash-in-hand denomination audits and lock reconciliations.', type: 'action' },
    ],
  },
  {
    id: 'security_ops',
    title: 'Administration & Security',
    icon: ShieldAlert,
    description: 'High-level administration controls, security audit logs, and broadcast messaging.',
    items: [
      { key: 'system:manage_users', label: 'Manage Users & Permissions', desc: 'Assign roles to profiles, pair passbook QR tokens, and edit permissions.', type: 'action' },
      { key: 'communication:broadcast', label: 'Send WhatsApp Broadcasts', desc: 'Transmit mass notifications and payment reminders to all subscribers.', type: 'action' },
      { key: 'reports:export', label: 'Export Audit & Tax Reports', desc: 'Generate CSV / PDF ledgers for offline compliance and bookkeeping.', type: 'action' },
    ],
  },
];

export default function RoleManagerPanel({ onRoleUpdated }: { onRoleUpdated?: () => void }) {
  const { profile: currentAdminProfile } = useAuth();
  const [roles, setRoles] = useState<CustomRoleRecord[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('admin');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing state for active role
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editColor, setEditColor] = useState<string>('#6366F1');
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [allowedActions, setAllowedActions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New Role Creation modal
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState<boolean>(false);
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleDescription, setNewRoleDescription] = useState<string>('');
  const [newRoleColor, setNewRoleColor] = useState<string>('#6366F1');
  const [isCreatingRole, setIsCreatingRole] = useState<boolean>(false);

  // Fetch Roles and Member counts from Supabase
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const { data: rolesData, error: rolesError } = await supabase
        .from('custom_roles')
        .select('*')
        .order('is_system', { ascending: false })
        .order('created_at', { ascending: true });

      if (rolesError) throw rolesError;

      // Fetch profile counts per role
      const { data: profileCountsData, error: profileError } = await supabase
        .from('profiles')
        .select('role');

      const counts: Record<string, number> = {};
      if (profileCountsData) {
        profileCountsData.forEach((p: any) => {
          counts[p.role] = (counts[p.role] || 0) + 1;
        });
      }

      setRoles(rolesData || []);
      setRoleCounts(counts);

      if (rolesData && rolesData.length > 0) {
        const found = rolesData.find((r) => r.id === selectedRoleId);
        if (!found) {
          selectRole(rolesData[0]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching custom roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const activeRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) || roles[0];
  }, [roles, selectedRoleId]);

  const selectRole = (role: CustomRoleRecord) => {
    setSelectedRoleId(role.id);
    setEditName(role.name);
    setEditDescription(role.description || '');
    setEditColor(role.color || '#6366F1');
    setAllowedTabs(role.allowed_tabs || []);
    setAllowedActions(role.allowed_actions || []);
    setSaveSuccess(false);
  };

  useEffect(() => {
    if (activeRole) {
      setEditName(activeRole.name);
      setEditDescription(activeRole.description || '');
      setEditColor(activeRole.color || '#6366F1');
      setAllowedTabs(activeRole.allowed_tabs || []);
      setAllowedActions(activeRole.allowed_actions || []);
      setSaveSuccess(false);
    }
  }, [activeRole?.id]);

  const filteredRoles = useMemo(() => {
    return roles.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [roles, searchQuery]);

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
    const allTabs = PERMISSION_CATEGORIES[0].items.map((i) => i.key);
    const allActs = PERMISSION_CATEGORIES.slice(1).flatMap((c) => c.items.map((i) => i.key));
    setAllowedTabs(allTabs);
    setAllowedActions(allActs);
  };

  // Clear All Permissions
  const handleClearAll = () => {
    if (activeRole?.id === 'admin') return;
    setAllowedTabs([]);
    setAllowedActions([]);
  };

  // Save Role Changes to Supabase
  const handleSaveRole = async () => {
    if (!activeRole) return;
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('custom_roles')
        .update({
          name: editName.trim() || activeRole.name,
          description: editDescription.trim(),
          color: editColor,
          allowed_tabs: activeRole.id === 'admin' ? activeRole.allowed_tabs : allowedTabs,
          allowed_actions: activeRole.id === 'admin' ? activeRole.allowed_actions : allowedActions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeRole.id);

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchRoles();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      alert(`Failed to save role: ${err.message}`);
    } finally {
      setIsSaving(false);
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
    const confirmMessage = assignedCount > 0
      ? `Warning: There are currently ${assignedCount} user(s) assigned to "${activeRole.name}". Deleting this role will automatically reassign those users to Subscriber. Proceed?`
      : `Are you sure you want to delete custom role "${activeRole.name}"?`;

    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase.from('custom_roles').delete().eq('id', activeRole.id);
      if (error) throw error;

      alert(`Role "${activeRole.name}" deleted successfully.`);
      setSelectedRoleId('subscriber');
      await fetchRoles();
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
      const defaultTabs: string[] = ['dashboard', 'chits', 'members', 'auctions'];
      const defaultActions: string[] = ['chits:view', 'members:view', 'auctions:view', 'auctions:bid'];

      const { error } = await supabase.from('custom_roles').insert({
        id: generatedId,
        name: cleanName,
        description: newRoleDescription.trim() || 'Custom organizational role',
        color: newRoleColor,
        is_system: false,
        allowed_tabs: defaultTabs,
        allowed_actions: defaultActions,
      });

      if (error) throw error;

      setIsNewRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRoleColor('#6366F1');
      setSelectedRoleId(generatedId);
      await fetchRoles();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      alert(`Failed to create role: ${err.message}`);
    } finally {
      setIsCreatingRole(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xs text-gray-900 flex flex-col md:flex-row min-h-[650px] animate-in fade-in duration-200">
      
      {/* ── MOBILE ROLE SELECTOR CAROUSEL (Mobile only: < md) ── */}
      <div className="block md:hidden bg-slate-50 border-b border-gray-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
            <Shield size={14} className="text-indigo-600" />
            <span>Select Role to Configure</span>
          </div>
          <button
            type="button"
            onClick={() => setIsNewRoleModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs active:scale-95"
          >
            <Plus size={12} />
            <span>Add Role</span>
          </button>
        </div>

        {/* Scrollable Role Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {roles.map((role) => {
            const isSelected = role.id === activeRole?.id;
            const memberCount = roleCounts[role.id] || 0;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                  isSelected
                    ? 'bg-white text-gray-900 border-indigo-400 shadow-xs ring-1 ring-indigo-400/30'
                    : 'bg-white/80 text-gray-600 border-gray-200 hover:bg-white'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: role.color || '#6366F1' }}
                />
                <span>{role.name}</span>
                <span className="text-[10px] text-gray-400 font-mono">({memberCount})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LEFT SIDEBAR: DESKTOP ROLES LIST (Desktop: >= md) ── */}
      <div className="hidden md:flex w-72 lg:w-80 bg-slate-50/70 border-r border-gray-200/80 p-4 flex-col justify-between shrink-0">
        <div className="space-y-3.5">
          {/* Header & New Role Button */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-200/60">
            <div className="flex items-center gap-2">
              <Shield className="text-indigo-600" size={17} />
              <span className="font-extrabold text-xs tracking-wider uppercase text-gray-900">Configured Roles</span>
            </div>
            <button
              type="button"
              onClick={() => setIsNewRoleModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
            >
              <Plus size={13} />
              <span>Add Role</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {/* Role Items */}
          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredRoles.map((role) => {
              const isSelected = role.id === activeRole?.id;
              const memberCount = roleCounts[role.id] || 0;

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role)}
                  className={`w-full text-left p-2.5 rounded-2xl flex items-center justify-between transition-all group ${
                    isSelected
                      ? 'bg-white border border-gray-300/80 shadow-xs text-gray-900 ring-1 ring-black/5'
                      : 'hover:bg-white/70 border border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: role.color || '#6366F1' }}
                    />
                    <div className="truncate">
                      <p className="text-xs font-bold truncate flex items-center gap-1.5">
                        <span className={isSelected ? 'text-gray-900 font-black' : 'text-gray-700'}>{role.name}</span>
                        {role.is_system && (
                          <span title="System Role" className="inline-flex">
                            <Lock size={10} className="text-gray-400 group-hover:text-gray-600 shrink-0" />
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] text-gray-400 font-mono block">
                        {memberCount} {memberCount === 1 ? 'user' : 'users'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {role.is_system ? (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                        System
                      </span>
                    ) : (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Custom
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Info hint */}
        <div className="pt-3 border-t border-gray-200/70 text-[11px] text-gray-500 flex items-start gap-1.5">
          <Info size={13} className="text-indigo-600 shrink-0 mt-0.5" />
          <span>Members with custom roles inherit assigned module &amp; action permissions instantly.</span>
        </div>
      </div>

      {/* ── RIGHT PANEL: ROLE CONFIGURATION & PERMISSIONS ── */}
      <div className="flex-1 p-4 sm:p-6 lg:p-7 flex flex-col justify-between bg-white overflow-y-auto">
        {activeRole ? (
          <div className="space-y-5 sm:space-y-6">
            
            {/* Header: Role Identity & Save/Delete Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 sm:pb-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-xs shrink-0 uppercase border border-white/20"
                  style={{ backgroundColor: editColor }}
                >
                  {editName ? editName.charAt(0) : 'R'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-gray-900">
                      {activeRole.name}
                    </h2>
                    {activeRole.is_system && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Lock size={10} /> System Protected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Role ID: <code className="font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">{activeRole.id}</code> · {roleCounts[activeRole.id] || 0} active members
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {!activeRole.is_system && (
                  <button
                    type="button"
                    onClick={handleDeleteRole}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Trash2 size={13} />
                    <span className="hidden sm:inline">Delete Role</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveRole}
                  disabled={isSaving}
                  className={`px-4 sm:px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all ${
                    saveSuccess
                      ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                      : 'bg-slate-900 hover:bg-black text-white'
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <Check size={14} />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>{isSaving ? 'Saving...' : 'Save Role'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Role Profile Settings (Name, Color & Description) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 bg-slate-50/70 border border-gray-200/80 rounded-2xl p-4 sm:p-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Role Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Field Officer / Treasury Auditor"
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>Role Theme Color</span>
                  <span className="text-[10px] font-mono text-gray-400">{editColor}</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setEditColor(c.value)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        editColor.toLowerCase() === c.value.toLowerCase() ? 'ring-2 ring-indigo-600 ring-offset-2 scale-110' : 'opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    >
                      {editColor.toLowerCase() === c.value.toLowerCase() && <Check size={12} className="text-white drop-shadow-xs" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-7 h-7 rounded-lg border border-gray-200 bg-white cursor-pointer p-0.5 ml-1"
                    title="Custom Hex Color"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Role Description &amp; Scope</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Explain the duties and operational scope of this role..."
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 resize-none shadow-2xs"
                />
              </div>
            </div>

            {/* Quick Bulk Action Bar */}
            {activeRole.id !== 'admin' && (
              <div className="flex items-center justify-between bg-indigo-50/50 px-3.5 py-2.5 rounded-xl border border-indigo-100">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sliders size={13} className="text-indigo-600" />
                  Configure Granular Permissions
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Grant All
                  </button>
                  <span className="text-indigo-200">·</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] font-bold text-gray-500 hover:text-rose-600 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}

            {/* Categorized Permissions Grid */}
            <div className="space-y-4 sm:space-y-5">
              {PERMISSION_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <div key={cat.id} className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
                      <IconComponent size={16} className="text-indigo-600" />
                      <div>
                        <h4 className="text-xs font-black text-gray-900 tracking-wide uppercase">{cat.title}</h4>
                        <p className="text-[10px] text-gray-500">{cat.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {cat.items.map((item) => {
                        const isGranted =
                          activeRole.id === 'admin' ||
                          (item.type === 'tab'
                            ? allowedTabs.includes(item.key)
                            : allowedActions.includes(item.key));

                        return (
                          <div
                            key={item.key}
                            onClick={() => {
                              if (activeRole.id === 'admin') return;
                              if (item.type === 'tab') toggleTab(item.key);
                              else toggleAction(item.key);
                            }}
                            className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-all cursor-pointer select-none ${
                              isGranted
                                ? 'bg-indigo-50/70 border-indigo-200 text-gray-900 shadow-2xs'
                                : 'bg-gray-50/50 border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                            } ${activeRole.id === 'admin' ? 'cursor-not-allowed opacity-90' : 'hover:scale-[1.005]'}`}
                          >
                            <div className="space-y-0.5">
                              <p className={`text-xs font-bold ${isGranted ? 'text-indigo-900 font-extrabold' : 'text-gray-800'}`}>
                                {item.label}
                              </p>
                              <p className="text-[10px] text-gray-500 leading-relaxed">{item.desc}</p>
                            </div>

                            {/* Toggle Switch */}
                            <div
                              className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                                isGranted ? 'bg-indigo-600' : 'bg-gray-300'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                                  isGranted ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Shield size={40} className="text-gray-300 mb-3" />
            <p className="text-sm font-bold">Select or create a role to view permissions</p>
          </div>
        )}
      </div>

      {/* ── CREATE NEW ROLE MODAL ── */}
      {isNewRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl text-gray-900 my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="text-indigo-600" size={18} />
                <h3 className="font-bold text-sm text-gray-900">Create New Custom Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewRoleModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewRole} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Role Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Field Collector / Treasury Auditor"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Color Palette</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setNewRoleColor(c.value)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        newRoleColor.toLowerCase() === c.value.toLowerCase() ? 'ring-2 ring-indigo-600 ring-offset-2 scale-110' : 'opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.value }}
                    >
                      {newRoleColor.toLowerCase() === c.value.toLowerCase() && <Check size={12} className="text-white drop-shadow-xs" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-gray-200 bg-white cursor-pointer p-0.5 ml-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe what this custom role is responsible for..."
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewRoleModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRole}
                  className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs active:scale-95 transition-all text-center"
                >
                  {isCreatingRole ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
