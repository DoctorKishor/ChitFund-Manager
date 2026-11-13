'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth, broadcastRoleUpdate } from '@/context/AuthContext';
import { CustomRoleRecord, MainTabId, PermissionAction } from '@/utils/rbac';
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
  UserX,
  Eye,
  Layers,
  Edit3
} from 'lucide-react';
import RoleAppPreviewModal from './RoleAppPreviewModal';

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
  tabKey: MainTabId;
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
  toggleBgClass: string;
  items: {
    key: PermissionAction;
    label: string;
    desc: string;
  }[];
}

const CATEGORIES: PermissionCategory[] = [
  {
    id: 1,
    tabKey: 'dashboard',
    badge: '1',
    badgeClass: 'bg-indigo-50 text-brand-600',
    title: 'Overview Dashboard',
    subtitle: 'Financial overview cards, cycle progress, and quick action buttons',
    toggleBgClass: 'peer-checked:bg-brand-600',
    items: [
      { key: 'dashboard:view_kpis', label: 'View Financial Overview Cards', desc: 'Show Total Collected, Target, and Pending dues summary cards' },
      { key: 'dashboard:quick_actions', label: 'Quick Actions (+ Record Payment & Menu)', desc: 'Show header "+ Record Payment" button and floating quick action shortcuts' },
      { key: 'dashboard:launch_month0', label: 'Confirm Launch & Roll to Month 1', desc: 'Button to complete Month 0 and allocate Organizer Profit' },
      { key: 'dashboard:advance_month', label: 'Conclude & Advance Month', desc: 'Button to finish current monthly auction cycle and advance to next month' },
      { key: 'dashboard:revert_month', label: 'Revert to Previous Month (Revert to M{x})', desc: 'Roll back the active group cycle to the previous month in case of mistakes' },
      { key: 'dashboard:view_reserves', label: 'View Kai Iruppu History & Breakdown', desc: 'Expand the discount reserve card to see past auction contributions' },
    ],
  },
  {
    id: 2,
    tabKey: 'chits',
    badge: '2',
    badgeClass: 'bg-sky-50 text-sky-700',
    title: 'Chits & Groups Tab',
    subtitle: 'Group setup, monthly rules, and Launch Month operations',
    toggleBgClass: 'peer-checked:bg-sky-600',
    items: [
      { key: 'chits:view', label: 'View Chit Groups & Details', desc: 'Browse chit groups, scheme rules, pot amounts, and member lists' },
      { key: 'chits:create', label: '+ Create New Chit Group', desc: 'Create new ₹1L, ₹2L, ₹5L, or custom chit scheme groups' },
      { key: 'chits:edit', label: 'Edit Group Rules & Bidding Caps', desc: 'Change auction dates, maximum discount caps, and chit settings' },
      { key: 'chits:launch_month0', label: 'Confirm Launch Month (Organizer Profit)', desc: 'Confirm first month collections and claim organizer profit' },
      { key: 'chits:reschedule_auction', label: 'Reschedule Auction Date', desc: 'Change the date or time of upcoming live auctions and alert members' },
      { key: 'chits:configure_laaba_seetu', label: 'Configure Laaba Seetu (Free Month)', desc: 'Set bonus discount pool threshold for members\' free installment month' },
      { key: 'chits:swap_ticket', label: 'Swap / Replace Member Tickets', desc: 'Transfer a ticket allocation from one member to another' },
      { key: 'chits:delete', label: 'Delete / Archive Chit Group', desc: 'Move completed chit groups to recycle bin or delete draft groups' },
    ],
  },
  {
    id: 3,
    tabKey: 'members',
    badge: '3',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    title: 'Members Directory Tab',
    subtitle: 'Member profiles, ticket enrollments & physical passbooks',
    toggleBgClass: 'peer-checked:bg-emerald-600',
    items: [
      { key: 'members:view', label: 'View Members Directory', desc: 'Search member profiles, contact numbers, and enrolled tickets' },
      { key: 'members:enroll', label: '+ Add New Member', desc: 'Register a new subscriber and assign them a chit ticket' },
      { key: 'members:edit', label: 'Edit Member Profile & Phone', desc: 'Update member name, mobile phone number, and address' },
      { key: 'members:collect', label: 'Record Payment (+ Collect)', desc: 'Record cash, UPI, or bank installments and issue payment receipts' },
      { key: 'members:waive_penalties', label: 'Waive Fines & Adjust Dues', desc: 'Waive late payment fines or enter custom due adjustments' },
      { key: 'members:suspend', label: 'Block / Suspend Member', desc: 'Temporarily lock member passbook login and disqualify from bidding' },
      { key: 'members:pair_qr', label: 'Scan & Pair Passbook QR', desc: 'Use camera to scan and link a printed QR code to a member passbook' },
      { key: 'members:revoke_qr', label: 'Unlink Lost Passbook QR', desc: 'Disconnect a lost or damaged passbook QR code from a member' },
      { key: 'members:batch_qr', label: 'Print QR Sticker Sheets', desc: 'Generate printable sheets of blank QR stickers for passbooks' },
      { key: 'members:reset_mpin', label: 'Reset Passbook PIN to 1234', desc: 'Reset member 4-digit passbook login PIN back to default 1234' },
      { key: 'members:export', label: 'Download Members List (Excel/CSV)', desc: 'Download complete member roster with phone numbers and tickets' },
      { key: 'members:delete', label: 'Delete Member Profile', desc: 'Permanently delete or deactivate a member profile' },
    ],
  },
  {
    id: 4,
    tabKey: 'auctions',
    badge: '4',
    badgeClass: 'bg-purple-50 text-purple-700',
    title: 'Auctions & Bidding Tab',
    subtitle: 'Live auction floor desk, real-time bidding shouts & prize disbursements',
    toggleBgClass: 'peer-checked:bg-purple-600',
    items: [
      { key: 'auctions:view', label: 'View Live Auction Arena', desc: 'Watch the auction countdown, live bids, and prize pot values' },
      { key: 'auctions:conduct', label: 'Start / Control Live Auction', desc: 'Start the auction timer, call for bids, and manage the live session' },
      { key: 'auctions:bid', label: 'Place Bid for Member (Shout Bid)', desc: 'Submit a discount bid on behalf of an eligible non-winning member' },
      { key: 'auctions:conclude', label: 'Declare Winner & Close Auction', desc: 'Confirm the winning bid discount and advance to the next month' },
      { key: 'auctions:override_floor', label: 'Override Minimum / Maximum Bid Limits', desc: 'Unlock floor bid or maximum discount limit during an auction' },
      { key: 'auctions:edit_historical', label: 'Edit Past Auction Results', desc: 'Fix accidental winning bid amounts or member errors in past months' },
      { key: 'auctions:disburse', label: 'Disburse Prize Money (Payout)', desc: 'Pay out the net prize pot to the winning member via cash or bank' },
      { key: 'auctions:issue_receipt', label: 'Print Winner Payout Receipt', desc: 'Generate and print the official winner prize payout settlement receipt' },
    ],
  },
  {
    id: 5,
    tabKey: 'cash',
    badge: '5',
    badgeClass: 'bg-amber-50 text-amber-700',
    title: 'Treasury Tab',
    subtitle: 'Multi-vault balances, physical cash safe, ATM relocations & reconciliations',
    toggleBgClass: 'peer-checked:bg-amber-500',
    items: [
      { key: 'treasury:view', label: 'View All Cash & Bank Balances', desc: 'Combined total balance across Cash Box and all bank accounts' },
      { key: 'treasury:view_cash_box', label: 'View Cash Box (Cash in Hand)', desc: 'Check physical cash box balance and cash drawer money' },
      { key: 'treasury:view_banks', label: 'View Bank Balances (Kishor / Dad / Mom)', desc: 'Inspect account balances for digital collections and payments' },
      { key: 'treasury:collect_cash', label: 'Accept Cash Payments', desc: 'Receive physical cash from members and add to Cash Box' },
      { key: 'treasury:move_money', label: 'Move Money (ATM / Bank Transfer)', desc: 'Withdraw money from bank into Cash Box or transfer between banks' },
      { key: 'treasury:confirm_atm', label: 'Confirm ATM Cash Received in Box', desc: 'Verify physical cash arrived and credit it into Cash Box' },
      { key: 'treasury:deposit', label: 'Deposit Owner Reserve / Extra Funds', desc: 'Add external personal or reserve money into the cash box' },
      { key: 'treasury:recover_float', label: 'Collect Field Cash from Staff', desc: 'Take collected cash from field agents and deposit into main box' },
      { key: 'treasury:personal_draw', label: 'Log Expenses & Personal Spends', desc: 'Record petty cash expenses like petrol, maintenance, or owner draws' },
      { key: 'treasury:settle_draw', label: 'Repay Personal Advance / Spends', desc: 'Record repayment of borrowed money back into the cash box' },
      { key: 'treasury:delete_transaction', label: 'Delete / Cancel Wrong Transaction', desc: 'Cancel or reverse an accidental payment or expense entry' },
      { key: 'treasury:reconcile', label: 'Cash Note Counter (₹500, ₹200, ₹100)', desc: 'Count physical currency notes and match with cash box balance' },
    ],
  },
  {
    id: 6,
    tabKey: 'reports',
    badge: '6',
    badgeClass: 'bg-blue-50 text-blue-700',
    title: 'Reports & Analytics Tab',
    subtitle: 'P&L margins, printable field registers, defaulters & audit logs',
    toggleBgClass: 'peer-checked:bg-blue-600',
    items: [
      { key: 'reports:view', label: 'View Reports & Analytics', desc: 'Access financial summaries, collection rates, and monthly progress' },
      { key: 'reports:view_pnl', label: 'View Profit & Loss (Organizer Earnings)', desc: 'Inspect organizer profit, total turnover, and financial margins' },
      { key: 'reports:export', label: 'Download Reports (Excel/CSV)', desc: 'Download accounting statements and summaries as spreadsheet files' },
      { key: 'reports:export_checklist', label: 'Print Monthly Collection Checklist', desc: 'Print sheet for agents to mark off dues physically in the field' },
      { key: 'reports:export_ledger', label: 'Download Passbook Ledgers (PDF)', desc: 'Download official member payment history statement PDFs' },
      { key: 'reports:view_defaulters', label: 'View Defaulters & Overdue Dues', desc: 'See members with unpaid installments and overdue payment alerts' },
      { key: 'reports:view_receipts', label: 'Search & View Payment Receipts', desc: 'Search, audit, verify, download, and re-issue subscriber payment receipts' },
      { key: 'reports:view_audit_logs', label: 'View System Activity & Audit Logs', desc: 'View history of all staff logins, changes, payments, and edits' },
      { key: 'reports:export_audit', label: 'Download Activity Log (CSV)', desc: 'Export full history of system activities and changes' },
    ],
  },
  {
    id: 7,
    tabKey: 'communication',
    badge: '7',
    badgeClass: 'bg-teal-50 text-teal-700',
    title: 'Communication Tab',
    subtitle: 'WhatsApp payment receipts, pre-auction floor notices & due alerts',
    toggleBgClass: 'peer-checked:bg-teal-600',
    items: [
      { key: 'communication:view', label: 'View Message History & Logs', desc: 'Inspect sent WhatsApp messages, delivery times, and replies' },
      { key: 'communication:broadcast', label: 'Send WhatsApp Payment Receipts', desc: 'Send automated WhatsApp receipt message when payment is recorded' },
      { key: 'communication:pre_auction', label: 'Send Auction Reminders on WhatsApp', desc: 'Send upcoming auction date, time, and rules to members' },
      { key: 'communication:post_auction', label: 'Send Auction Results on WhatsApp', desc: 'Announce winner ticket, winning discount, and monthly dividend' },
      { key: 'communication:due_alerts', label: 'Send Payment Due Reminders (WhatsApp)', desc: 'Send WhatsApp reminder messages to members who haven\'t paid yet' },
      { key: 'communication:custom', label: 'Send Custom WhatsApp Message', desc: 'Type and send a custom announcement message to members' },
      { key: 'communication:manage_templates', label: 'Edit WhatsApp Message Templates', desc: 'Change default Tamil and English WhatsApp message wording' },
    ],
  },
  {
    id: 8,
    tabKey: 'users',
    badge: '8',
    badgeClass: 'bg-violet-50 text-violet-700',
    title: 'Roles & Staff Tab',
    subtitle: 'Workforce accounts, custom roles & permission settings',
    toggleBgClass: 'peer-checked:bg-violet-600',
    items: [
      { key: 'system:manage_users', label: 'Manage Member Logins & Access', desc: 'View member portal accounts, reset passwords, or unblock logins' },
      { key: 'system:manage_staff', label: 'Manage Staff Accounts & Logins', desc: 'Add staff accounts, change passwords, and assign work roles' },
      { key: 'system:manage_roles', label: 'Edit Roles & Permissions', desc: 'Create custom roles and turn features on or off for staff' },
    ],
  },
  {
    id: 9,
    tabKey: 'settings',
    badge: '9',
    badgeClass: 'bg-rose-50 text-rose-700',
    title: 'Portal Settings Tab',
    subtitle: 'Business branding, emergency app lock & system controls',
    toggleBgClass: 'peer-checked:bg-rose-600',
    items: [
      { key: 'system:branding', label: 'Change Business Name & Logo', desc: 'Set company name, tagline, and passbook header logo' },
      { key: 'system:maintenance_mode', label: 'Maintenance Mode (Lock App)', desc: 'Lock subscriber passbook portal while doing updates' },
      { key: 'system:reset_database', label: 'Clear Test Data / Factory Reset', desc: 'Delete sample data, reset balances, and start fresh' },
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
  onOpenAuditLogs?: () => void;
  onAddAuditLog?: (desc: string) => void;
}

export default function RoleManagerPanel({
  onRoleUpdated,
  isCreateModalOpen: externalIsCreateModalOpen,
  setIsCreateModalOpen: externalSetIsCreateModalOpen,
  onExportPolicy,
  onOpenAuditLogs,
  onAddAuditLog,
}: RoleManagerPanelProps) {
  const { profile: currentAdminProfile } = useAuth();
  const [roles, setRoles] = useState<CustomRoleRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('collections_agent');

  // Editing state for active role
  const [editName, setEditName] = useState<string>('');
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

  // Live Role Preview Modal state
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

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
    setEditName(role.name);
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
    const allTabs = CATEGORIES.map((cat) => cat.tabKey);
    const allActs: string[] = [];
    CATEGORIES.forEach((cat) => {
      cat.items.forEach((item) => {
        allActs.push(item.key);
      });
    });
    setAllowedTabs(allTabs);
    setAllowedActions(allActs);
  };

  // Quick toggle all actions belonging to a specific tab
  const toggleAllActionsInTab = (cat: PermissionCategory, enable: boolean) => {
    if (activeRole?.id === 'admin') return;
    const tabActionKeys = cat.items.map((i) => i.key);
    setAllowedActions((prev) => {
      if (enable) {
        const merged = new Set([...prev, ...tabActionKeys]);
        return Array.from(merged);
      } else {
        return prev.filter((k) => !tabActionKeys.includes(k as any));
      }
    });
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
    setEditName(activeRole.name);
    setAllowedTabs(activeRole.allowed_tabs || []);
    setAllowedActions(activeRole.allowed_actions || []);
    setEditColor(activeRole.color || '#4F46E5');
  };

  // Save Role Changes to Supabase
  const handleSaveRole = async () => {
    if (!activeRole) return;
    try {
      setIsSaving(true);
      const isPrivileged = activeRole.id !== 'subscriber';
      const { error } = await supabase
        .from('custom_roles')
        .update({
          name: editName ? editName.trim() : activeRole.name,
          color: editColor,
          is_privileged: isPrivileged,
          allowed_tabs: activeRole.id === 'admin' ? activeRole.allowed_tabs : allowedTabs,
          allowed_actions: activeRole.id === 'admin' ? activeRole.allowed_actions : allowedActions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeRole.id);

      if (error) throw error;

      // Broadcast changes across all connected staff sessions in real-time
      await broadcastRoleUpdate(activeRole.id);

      if (onAddAuditLog) {
        onAddAuditLog(`UPDATED ROLE PERMISSIONS: Modified access matrix for role "${activeRole.name}"`);
      }

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
        is_privileged: cloneId !== 'subscriber',
        allowed_tabs: allowedTabs,
        allowed_actions: allowedActions,
      });

      if (error) throw error;

      await broadcastRoleUpdate(cloneId);

      if (onAddAuditLog) {
        onAddAuditLog(`CLONED ROLE: Created new role "${cloneName}" from template "${activeRole.name}"`);
      }

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

      if (onAddAuditLog) {
        onAddAuditLog(`DELETED ROLE: Removed custom role "${activeRole.name}" (reassigned ${assignedCount} users to Subscriber)`);
      }

      setSelectedRoleId('subscriber');
      await fetchData();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      alert(`Failed to delete role: ${err.message}`);
    }
  };

  // Export Active Role Policy Helper
  const handleExportActivePolicy = () => {
    if (onExportPolicy) {
      onExportPolicy();
      return;
    }
    const policyData = {
      system: 'ChitFunds.io Role Policy',
      exportedAt: new Date().toISOString(),
      role: activeRole ? {
        id: activeRole.id,
        name: editName || activeRole.name,
        color: editColor,
        isSystem: activeRole.is_system,
        description: activeRole.description,
        allowedTabs,
        allowedActions,
      } : null,
    };
    const blob = new Blob([JSON.stringify(policyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `role_policy_${activeRole?.id || 'role'}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      <main className="hidden md:block flex-1 overflow-y-auto p-4 sm:p-7">
        <div className="w-full max-w-[1550px] mx-auto space-y-6">

          {/* Top Overview Metrics Strip */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Metric 1: Active Staff & Admins */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Staff &amp; Workforce</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-black font-display text-slate-900">{staffCount} Personnel</span>
                <span className="text-xs text-slate-500 font-medium">({adminProfiles.length} Admins)</span>
              </div>
            </div>

            {/* Metric 2: Security Architecture */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Configured Roles</span>
                <span 
                  onClick={onOpenAuditLogs}
                  className="text-brand-600 font-semibold cursor-pointer hover:underline text-[10px]"
                >
                  Audit Logs
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-black font-display text-slate-900">{roles.length} Roles</span>
                <span className="text-xs text-slate-500 font-medium">({customRoles.length} Custom)</span>
              </div>
            </div>

            {/* Metric 3: Permission Checkpoints */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RBAC Security</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-black font-display text-slate-900">{CATEGORIES.length} Categories</span>
                <span className="text-xs text-emerald-600 font-bold">Zero-Trust</span>
              </div>
            </div>

            {/* Metric 4: Default Subscriber Tier */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subscriber Portal</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-black font-display text-slate-900">{subscriberCount} Members</span>
                <span className="text-xs text-slate-500 font-medium">Read-Only</span>
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
                          <div className="mt-2 pt-2 border-t border-brand-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-mono text-[10px] text-slate-400">role_{role.id}</span>
                            <span className="font-mono text-brand-600 font-semibold text-[11px] shrink-0">
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
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                {/* Upper Row: Role Identity, Badges, and Color Picker */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl font-bold flex items-center justify-center font-display text-xl shadow-xs shrink-0"
                      style={{
                        backgroundColor: `${editColor}18`,
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
                        <span className="text-[11px] font-bold py-0.5 px-2.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full whitespace-nowrap">
                          {activeRole?.is_system ? 'Protected System Role' : 'Custom Field Role'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ID: {activeRole?.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Accent Color Picker */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Color:
                    </span>
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-full border border-slate-200/80">
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
                </div>

                {/* Lower Row: Summary Badges & Action Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-brand-700 font-semibold border border-indigo-100 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-brand-500" />
                      <span>{allowedTabs.length} of 9 Tabs Allowed</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{allowedActions.length} Actions Enabled</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium">
                      {assignedPersonnel.length} Assigned Staff
                    </span>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsPreviewModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-brand-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95"
                      title="Open Live App Preview & Screen Configurator"
                    >
                      <Eye className="w-3.5 h-3.5 text-brand-600" />
                      <span>Live App Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportActivePolicy}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Export role permission policy to JSON"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>Export</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDefaults}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Reset Defaults
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
                      ) : isSaving ? (
                        <span>Saving...</span>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
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
                  {CATEGORIES.map((cat) => {
                    const isTabEnabled = activeRole?.id === 'admin' || allowedTabs.includes(cat.tabKey);
                    const activeActionsCount = cat.items.filter((i) => allowedActions.includes(i.key)).length;

                    return (
                      <div key={cat.id} className="p-5 space-y-4">
                        {/* Category Header with Master Tab Switch */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl ${cat.badgeClass} flex items-center justify-center font-bold text-sm font-display shrink-0`}>
                              {cat.badge}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-display font-bold text-sm text-slate-900 tracking-tight">
                                  {cat.title}
                                </h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isTabEnabled 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                  {isTabEnabled ? `${activeActionsCount}/${cat.items.length} Actions Active` : 'Tab Hidden'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {cat.subtitle}
                              </p>
                            </div>
                          </div>

                          {/* Master Tab Toggle Switch + Tab Quick Presets */}
                          <div className="flex items-center gap-3 self-end sm:self-auto bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-xl">
                            {isTabEnabled && (
                              <div className="flex items-center gap-1.5 mr-1 border-r border-slate-200 pr-3 hidden md:flex">
                                <button
                                  type="button"
                                  onClick={() => toggleAllActionsInTab(cat, true)}
                                  disabled={activeRole?.id === 'admin'}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                  Enable All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleAllActionsInTab(cat, false)}
                                  disabled={activeRole?.id === 'admin'}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                  Clear
                                </button>
                              </div>
                            )}

                            <div className="text-right">
                              <span className="text-xs font-bold block text-slate-800">
                                {isTabEnabled ? 'Tab Access Enabled' : 'Tab Access Disabled'}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {isTabEnabled ? 'Visible in app navigation' : 'Hidden from staff navigation'}
                              </span>
                            </div>

                            <label className="relative inline-flex items-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isTabEnabled}
                                disabled={activeRole?.id === 'admin'}
                                onChange={() => toggleTab(cat.tabKey)}
                                className="sr-only peer"
                              />
                              <div
                                className={`w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${cat.toggleBgClass}`}
                              ></div>
                            </label>
                          </div>
                        </div>

                        {/* Granular Permissions Section */}
                        {isTabEnabled ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                            {cat.items.map((item) => {
                              const isChecked = activeRole?.id === 'admin' || allowedActions.includes(item.key);
                              return (
                                <label
                                  key={item.key}
                                  className={`flex items-start justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                    isChecked
                                      ? 'border-brand-200/80 bg-brand-50/20 hover:bg-brand-50/30 shadow-2xs'
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
                                      onChange={() => toggleAction(item.key)}
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
                        ) : (
                          /* Collapsed / Informative Banner when Master Tab Toggle is Disabled */
                          <div className="py-3.5 px-4 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex items-center justify-between text-xs text-slate-500">
                            <div className="flex items-center gap-2.5">
                              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                              <span>This entire tab is <strong>hidden from navigation</strong> for {activeRole?.name}. Enable the master toggle above to display and configure granular permissions.</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleTab(cat.tabKey)}
                              disabled={activeRole?.id === 'admin'}
                              className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline shrink-0 ml-3 cursor-pointer"
                            >
                              Enable Tab Access
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

      {/* ── MOBILE ROLES & PERMISSIONS WORKSPACE (block md:hidden matching Stitch Mobile) ── */}
      <div className="block md:hidden w-full flex-1 flex flex-col relative">

        {/* Horizontal Role Pills Selector */}
        <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 sticky top-0 z-20 backdrop-blur-xs">
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar text-xs">
            {/* Built-in Roles */}
            {builtInRoles.map((role) => {
              const isSelected = role.id === selectedRoleId;
              const count = roleCounts[role.id] || 0;
              const emoji = ROLE_EMOJIS[role.id] || '🛡️';

              if (isSelected) {
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => selectRole(role)}
                    className="flex-shrink-0 px-3 py-1.5 bg-brand-600 text-white font-bold rounded-full shadow-xs flex items-center gap-1.5 ring-2 ring-brand-200 cursor-pointer"
                  >
                    <span>{emoji} {role.name}</span>
                    {count > 0 && (
                      <span className="text-[10px] bg-brand-700 text-brand-100 px-1.5 py-0.2 rounded-full font-mono">
                        {count}
                      </span>
                    )}
                  </button>
                );
              }

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role)}
                  className="flex-shrink-0 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-full shadow-2xs hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{emoji} {role.name}</span>
                  {count > 0 && (
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-mono">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Custom Roles */}
            {customRoles.map((role) => {
              const isSelected = role.id === selectedRoleId;
              const count = roleCounts[role.id] || 0;
              const emoji = ROLE_EMOJIS[role.id] || '🛡️';

              if (isSelected) {
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => selectRole(role)}
                    className="flex-shrink-0 px-3 py-1.5 bg-brand-600 text-white font-bold rounded-full shadow-xs flex items-center gap-1.5 ring-2 ring-brand-200 cursor-pointer"
                  >
                    <span>{emoji} {role.name}</span>
                    {count > 0 && (
                      <span className="text-[10px] bg-brand-700 text-brand-100 px-1.5 py-0.2 rounded-full font-mono">
                        {count}
                      </span>
                    )}
                  </button>
                );
              }

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role)}
                  className="flex-shrink-0 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-full shadow-2xs hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{emoji} {role.name}</span>
                  {count > 0 && (
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-mono">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 px-4 py-4 space-y-4 pb-28">

          {/* Active Role Header Banner (Optimized for Mobile with Clean Visual Hierarchy) */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-card space-y-3.5">
            {/* Top Row: Role Avatar + Full Name + Role Tag + Edit Button */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-11 h-11 rounded-2xl font-bold flex items-center justify-center text-xl shadow-xs shrink-0"
                  style={{ backgroundColor: `${editColor}18`, color: editColor }}
                >
                  {ROLE_EMOJIS[activeRole?.id || ''] || '💳'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-sm font-bold text-slate-900 leading-snug">
                      {activeRole?.name}
                    </h2>
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 shrink-0">
                      {activeRole?.is_system ? 'System Role' : 'Custom Role'}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 font-mono mt-0.5 truncate">
                    ID: {activeRole?.id}
                  </p>
                </div>
              </div>

              {!activeRole?.is_system && (
                <button
                  type="button"
                  onClick={() => {
                    const newTitle = prompt('Edit Role Name:', activeRole?.name);
                    if (newTitle && newTitle.trim()) {
                      setEditName(newTitle.trim());
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-brand-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-1 shadow-2xs"
                >
                  <Edit3 size={12} className="text-brand-600" />
                  <span>Edit Name</span>
                </button>
              )}
            </div>

            {/* Accent Color Palette Selector Bar (Clean Dedicated Row) */}
            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Accent Theme Color
              </span>
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-full border border-slate-200/80">
                {COLOR_PRESETS.map((p) => {
                  const isActive = editColor.toLowerCase() === p.hex.toLowerCase();
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setEditColor(p.hex)}
                      title={p.name}
                      className={`w-4 h-4 rounded-full transition-all hover:scale-110 cursor-pointer ${p.bgClass} ${
                        isActive ? 'ring-2 ring-brand-500 ring-offset-1 scale-110' : 'opacity-75 hover:opacity-100'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Bottom Row: Assigned Personnel Count + Preview App Button */}
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                <span className="font-medium text-slate-500">Assigned:</span>
                <span className="font-bold text-slate-900 truncate">
                  {assignedPersonnel.length} Staff Member{assignedPersonnel.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-brand-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs transition-all shrink-0"
              >
                <Eye size={13} className="text-brand-600" />
                <span>Live Preview</span>
              </button>
            </div>
          </div>

          {/* Dynamic Categories Rendering (Matching Desktop & Native Mobile UX) */}
          {CATEGORIES.map((cat) => {
            const isTabEnabled = activeRole?.id === 'admin' || allowedTabs.includes(cat.tabKey);
            const activeActionsCount = cat.items.filter((i) => allowedActions.includes(i.key)).length;

            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
                <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-md ${cat.badgeClass} text-[11px] font-bold flex items-center justify-center font-display shrink-0`}>
                      {cat.badge}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">{cat.title}</h3>
                      <span className={`text-[10px] font-semibold ${isTabEnabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {isTabEnabled ? `${activeActionsCount}/${cat.items.length} Active` : 'Tab Disabled'}
                      </span>
                    </div>
                  </div>

                  {/* Master Tab Switch */}
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={isTabEnabled}
                      disabled={activeRole?.id === 'admin'}
                      onChange={() => toggleTab(cat.tabKey)}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all ${cat.toggleBgClass}`}
                    ></div>
                  </label>
                </div>

                {isTabEnabled ? (
                  <div className="divide-y divide-slate-100 text-xs">
                    {cat.items.map((item) => {
                      const isChecked = activeRole?.id === 'admin' || allowedActions.includes(item.key);
                      return (
                        <div
                          key={item.key}
                          onClick={() => {
                            if (activeRole?.id !== 'admin') {
                              toggleAction(item.key);
                            }
                          }}
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked ? 'bg-brand-50/15' : ''
                          }`}
                        >
                          <div className="pr-3 min-w-0">
                            <span className={`font-bold block text-xs truncate ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>
                              {item.label}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate mt-0.5">{item.desc}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={activeRole?.id === 'admin'}
                            onChange={() => toggleAction(item.key)}
                            className={`w-4 h-4 rounded border-slate-300 focus:ring-brand-500 cursor-pointer shrink-0 ${
                              activeRole?.id === 'admin' ? 'cursor-not-allowed text-brand-600 opacity-80' : 'text-brand-600'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">Tab navigation hidden for this role.</span>
                    <button
                      type="button"
                      onClick={() => toggleTab(cat.tabKey)}
                      disabled={activeRole?.id === 'admin'}
                      className="font-bold text-brand-600 ml-2 shrink-0 cursor-pointer"
                    >
                      Enable
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Assigned Staff Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Assigned Staff Members</h3>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(true)}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
              >
                + Assign
              </button>
            </div>
            {assignedPersonnel.length > 0 ? (
              <div className="space-y-2">
                {assignedPersonnel.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">{user.full_name}</span>
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded whitespace-nowrap">
                            {user.role === 'admin' ? 'Super Admin' : activeRole?.name}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{user.phone_number}</p>
                      </div>
                    </div>
                    {user.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberFromRole(user.id, user.full_name)}
                        className="text-[11px] text-rose-600 font-semibold hover:underline cursor-pointer shrink-0 pl-2"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">No staff members currently assigned to this role.</p>
            )}
          </div>

        </div>

        {/* Sticky Bottom Save Changes Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-3 safe-bottom z-40 shadow-nav flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSaveRole}
            disabled={isSaving}
            className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" strokeWidth={2.5} />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Permission Changes'}</span>
              </>
            )}
          </button>
        </div>

      </div>

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

      {/* Live Role Preview & Screen Configurator Modal */}
      <RoleAppPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        initialRoleId={selectedRoleId}
        onRoleUpdated={() => {
          fetchData();
          onRoleUpdated?.();
        }}
      />

    </div>
  );
}
