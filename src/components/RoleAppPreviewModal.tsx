'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth, RolePreviewAuthProvider, broadcastRoleUpdate } from '@/context/AuthContext';
import { CustomRoleRecord, MainTabId, PermissionAction } from '@/utils/rbac';
import { triggerHapticFeedback } from '@/utils/haptics';
import DashboardContent from './DashboardContent';
import MemberMatrix from './MemberMatrix';
import LiveAuctionEngine from './LiveAuctionEngine';
import CashVaultLedger from './CashVaultLedger';
import ReportsCenter from './ReportsCenter';
import CommunicationBroadcastCenter from './CommunicationBroadcastCenter';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import {
  Monitor,
  Smartphone,
  Eye,
  ShieldCheck,
  Check,
  X,
  Save,
  RotateCcw,
  Sliders,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Lock,
  Unlock,
  Settings,
  ChevronRight,
  Info,
  ExternalLink,
  Shield,
  Users,
  Briefcase,
  Gavel,
  BarChart3,
  Vault,
  MessageSquare,
  HelpCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface RoleAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoleId?: string;
  onRoleUpdated?: () => void;
}

interface ActionMeta {
  key: PermissionAction;
  label: string;
  desc: string;
  category: string;
}

const ALL_TABS: { id: MainTabId; label: string; icon: any; desc: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, desc: 'Financial KPI cards, cycle progress & recent receipts' },
  { id: 'chits', label: 'Chit Groups', icon: Briefcase, desc: 'Scheme list, auction rules & launch month setup' },
  { id: 'members', label: 'Members', icon: Users, desc: 'Subscriber registry, ticket enrollments & passbooks' },
  { id: 'communication', label: 'Broadcaster', icon: MessageSquare, desc: 'WhatsApp templates, pre/post auction notices' },
  { id: 'auctions', label: 'Live Bidding', icon: Gavel, desc: 'Live auction arena, shout bids & winner awards' },
  { id: 'reports', label: 'Reports', icon: BarChart3, desc: 'Defaulters, profit & loss, dividend statements' },
  { id: 'cash', label: 'Treasury', icon: Vault, desc: 'Physical cash box, bank vaults, ATM relocations' },
  { id: 'users', label: 'Staff & Roles', icon: ShieldCheck, desc: 'Workforce accounts, custom roles & permissions' },
  { id: 'settings', label: 'Settings', icon: Settings, desc: 'Branding, security PIN policy & system configurations' },
];

const ALL_ACTIONS: ActionMeta[] = [
  // Member Logistics
  { key: 'members:view', label: 'View Member Registry', desc: 'Browse subscribers and view enrollment tickets', category: 'Member Logistics' },
  { key: 'members:enroll', label: 'Enroll Member into Scheme', desc: 'Assign tickets to registered subscribers', category: 'Member Logistics' },
  { key: 'members:edit', label: 'Edit Member Details', desc: 'Update subscriber phone number, name & alias', category: 'Member Logistics' },
  { key: 'members:collect', label: 'Record Cash & UPI Collections', desc: 'Record installment payments and issue receipts', category: 'Member Logistics' },
  { key: 'members:suspend', label: 'Suspend / Lockout Standing', desc: 'Temporarily lock subscriber portal access', category: 'Member Logistics' },
  { key: 'members:pair_qr', label: 'Pair Passbook QR Code', desc: 'Link physical passbook barcode to member account', category: 'Member Logistics' },
  { key: 'members:revoke_qr', label: 'Revoke Passbook QR', desc: 'Unlink lost passbook sticker', category: 'Member Logistics' },
  { key: 'members:batch_qr', label: 'Print Passbook QR Batches', desc: 'Generate printable QR sticker sheets', category: 'Member Logistics' },
  { key: 'members:reset_mpin', label: 'Reset Security MPIN', desc: 'Restore member 4-digit PIN to default 1234', category: 'Member Logistics' },
  { key: 'members:export', label: 'Export Member Roster', desc: 'Download CSV / Excel member reports', category: 'Member Logistics' },
  { key: 'members:delete', label: 'Archive / Delete Member', desc: 'Soft-delete subscriber profile while preserving ledger', category: 'Member Logistics' },

  // Chit Scheme Lifecycle
  { key: 'chits:view', label: 'View Chit Schemes', desc: 'View running groups, duration and totals', category: 'Chit Schemes' },
  { key: 'chits:create', label: 'Create New Chit Group', desc: 'Define chit value, duration & member count', category: 'Chit Schemes' },
  { key: 'chits:edit', label: 'Modify Scheme Rules', desc: 'Update auction date, time & schedule rules', category: 'Chit Schemes' },
  { key: 'chits:launch_month0', label: 'Execute Month 0 Launch', desc: 'Allocate full collection pool as Organizer Profit', category: 'Chit Schemes' },
  { key: 'chits:reschedule_auction', label: 'Reschedule Auction Date', desc: 'Postpone auction and dispatch WhatsApp alerts', category: 'Chit Schemes' },
  { key: 'chits:configure_laaba_seetu', label: 'Configure Laaba Seetu Rules', desc: 'Define member profit free installment threshold', category: 'Chit Schemes' },
  { key: 'chits:delete', label: 'Delete Chit Group', desc: 'Archive completed or cancelled scheme', category: 'Chit Schemes' },

  // Live Auctions & Bidding
  { key: 'auctions:view', label: 'View Auction Floor', desc: 'Watch live bidding stream and floor stats', category: 'Floor Auctions' },
  { key: 'auctions:conduct', label: 'Conduct Monthly Auction', desc: 'Start live countdown and manage floor timer', category: 'Floor Auctions' },
  { key: 'auctions:bid', label: 'Record Shouted Bids', desc: 'Log proxy discount bids on behalf of attendees', category: 'Floor Auctions' },
  { key: 'auctions:conclude', label: 'Conclude & Award Pot', desc: 'Lock highest discount and advance group cycle', category: 'Floor Auctions' },
  { key: 'auctions:override_floor', label: 'Override Floor Discount', desc: 'Administrative discount floor override', category: 'Floor Auctions' },
  { key: 'auctions:disburse', label: 'Disburse Prize Pot', desc: 'Pay winning subscriber prize from bank/cash', category: 'Floor Auctions' },
  { key: 'auctions:issue_receipt', label: 'Issue Auction Voucher', desc: 'Export PDF auction voucher and winner receipt', category: 'Floor Auctions' },

  // Treasury Multi-Vaults
  { key: 'treasury:view', label: 'View Global Treasury', desc: 'View combined balances of all 4 payment vaults', category: 'Multi-Vault Treasury' },
  { key: 'treasury:view_cash_box', label: 'View Physical Cash Box', desc: 'Inspect safe cash in hand and float cash', category: 'Multi-Vault Treasury' },
  { key: 'treasury:view_banks', label: 'View Private Bank Accounts', desc: 'Inspect Kishor Bank, Dad Bank and Mom Bank', category: 'Multi-Vault Treasury' },
  { key: 'treasury:collect_cash', label: 'Collect Cash Into Safe', desc: 'Field cash inflow into Cash Box', category: 'Multi-Vault Treasury' },
  { key: 'treasury:move_money', label: 'Inter-Vault Transfer', desc: 'Move funds between banks and cash box', category: 'Multi-Vault Treasury' },
  { key: 'treasury:confirm_atm', label: 'Confirm ATM Relocation', desc: 'Verify physical cash notes in safe after bank debit', category: 'Multi-Vault Treasury' },
  { key: 'treasury:deposit', label: 'Deposit Reserve Cash', desc: 'Deposit external owner cash float into vaults', category: 'Multi-Vault Treasury' },
  { key: 'treasury:recover_float', label: 'Return Reserve Float', desc: 'Withdraw repaid reserve money back to owner', category: 'Multi-Vault Treasury' },
  { key: 'treasury:personal_draw', label: 'Log Personal Draw', desc: 'Record personal expense or cash rotation with tags', category: 'Multi-Vault Treasury' },
  { key: 'treasury:settle_draw', label: 'Settle Personal Debt', desc: 'Record repayment of personal draw back to safe', category: 'Multi-Vault Treasury' },
  { key: 'treasury:reconcile', label: 'Physical Cash Audit Reconcile', desc: 'Physical currency denomination count reconciliation', category: 'Multi-Vault Treasury' },

  // Communication & Broadcaster
  { key: 'communication:view', label: 'View Broadcaster Desk', desc: 'Browse WhatsApp templates and dispatched logs', category: 'Communication' },
  { key: 'communication:broadcast', label: 'Dispatch WhatsApp Broadcast', desc: 'Send bulk WhatsApp reminders and notices', category: 'Communication' },
  { key: 'communication:pre_auction', label: 'Pre-Auction Notice Dispatch', desc: 'Send 24h floor auction meeting notices', category: 'Communication' },
  { key: 'communication:post_auction', label: 'Post-Auction Summary Dispatch', desc: 'Broadcast winner details and next due amount', category: 'Communication' },
  { key: 'communication:due_alerts', label: 'Send Overdue Reminder Alerts', desc: 'Dispatch payment due notifications to defaulters', category: 'Communication' },
  { key: 'communication:custom', label: 'Compose Custom Broadcast', desc: 'Free-form WhatsApp broadcast message dispatch', category: 'Communication' },
  { key: 'communication:manage_templates', label: 'Edit Message Templates', desc: 'Create and update reusable WhatsApp scripts', category: 'Communication' },

  // Reports & Auditing
  { key: 'reports:view', label: 'View Reports Center', desc: 'View monthly statements and balance sheets', category: 'Reports & Auditing' },
  { key: 'reports:view_pnl', label: 'View Profit & Loss / Earnings', desc: 'Organizer profit and discount pool reserves', category: 'Reports & Auditing' },
  { key: 'reports:export', label: 'Export General Reports', desc: 'Download CSV / Excel reports for CA audit', category: 'Reports & Auditing' },
  { key: 'reports:export_checklist', label: 'Generate Offline Printable Checklist', desc: 'Print physical collection register booklet', category: 'Reports & Auditing' },
  { key: 'reports:export_ledger', label: 'Export Full Cash Ledger', desc: 'Export physical passbook and transaction statements', category: 'Reports & Auditing' },
  { key: 'reports:view_defaulters', label: 'View Defaulters & Arrears', desc: 'View outstanding balance list across all chits', category: 'Reports & Auditing' },
  { key: 'reports:view_audit_logs', label: 'View Security Audit Trail', desc: 'Inspect immutable administrative action log', category: 'Reports & Auditing' },
  { key: 'reports:export_audit', label: 'Export Security Audit Logs', desc: 'Export administrative tamper-proof audit trail', category: 'Reports & Auditing' },

  // System Administration
  { key: 'system:manage_users', label: 'Manage Subscriber Accounts', desc: 'Provision and unblock subscriber credentials', category: 'System Governance' },
  { key: 'system:manage_staff', label: 'Manage Staff Access Accounts', desc: 'Invite staff members and assign operational roles', category: 'System Governance' },
  { key: 'system:manage_roles', label: 'Create & Modify Security Roles', desc: 'Create custom roles and fine-tune permissions', category: 'System Governance' },
  { key: 'system:maintenance_mode', label: 'Toggle Maintenance Lockout', desc: 'Emergency lockout of subscriber portal', category: 'System Governance' },
  { key: 'system:branding', label: 'Configure Branding & Logo', desc: 'Customize company title, tagline, and initials', category: 'System Governance' },
  { key: 'system:reset_database', label: 'Factory Reset & Data Purge', desc: 'Emergency wipe of test data and balance reset', category: 'System Governance' },
];

export default function RoleAppPreviewModal({
  isOpen,
  onClose,
  initialRoleId = 'collections_agent',
  onRoleUpdated,
}: RoleAppPreviewModalProps) {
  const { profile: currentAdminProfile } = useAuth();
  const [allRoles, setAllRoles] = useState<CustomRoleRecord[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(initialRoleId);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [previewTab, setPreviewTab] = useState<MainTabId>('dashboard');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [inspectorFilter, setInspectorFilter] = useState<'all' | 'tabs' | 'actions'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showInspectorHighlights, setShowInspectorHighlights] = useState<boolean>(false);

  // Live editable working copy of the selected role's permissions
  const [allowedTabs, setAllowedTabs] = useState<MainTabId[]>([]);
  const [allowedActions, setAllowedActions] = useState<PermissionAction[]>([]);

  // 1. Fetch available custom roles
  const loadRoles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('*')
        .order('is_system', { ascending: false });

      if (!error && data) {
        setAllRoles(data as CustomRoleRecord[]);
      }
    } catch (e) {
      console.warn('Error loading custom roles in preview modal:', e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadRoles();
    }
  }, [isOpen, loadRoles]);

  // Synchronize initial role id if passed
  useEffect(() => {
    if (initialRoleId) {
      setSelectedRoleId(initialRoleId);
    }
  }, [initialRoleId]);

  // Active selected role record
  const activeRole = useMemo(() => {
    return allRoles.find((r) => r.id === selectedRoleId) || allRoles[0];
  }, [allRoles, selectedRoleId]);

  // Sync working permissions when active role changes
  useEffect(() => {
    if (activeRole) {
      setAllowedTabs((activeRole.allowed_tabs as MainTabId[]) || []);
      setAllowedActions((activeRole.allowed_actions as PermissionAction[]) || []);

      // If active preview tab is not allowed, switch to first allowed tab
      const currentAllowed = (activeRole.allowed_tabs as MainTabId[]) || [];
      if (currentAllowed.length > 0 && !currentAllowed.includes(previewTab)) {
        setPreviewTab(currentAllowed[0]);
      }
    }
  }, [activeRole?.id, activeRole?.updated_at]);

  // Auto-switch preview tab if current tab is toggled off
  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(previewTab)) {
      setPreviewTab(allowedTabs[0]);
    }
  }, [allowedTabs, previewTab]);

  // 2. Toggle Tab on/off in live preview
  const handleToggleTab = (tabId: MainTabId) => {
    triggerHapticFeedback('light');
    setAllowedTabs((prev) => {
      const exists = prev.includes(tabId);
      if (exists) {
        return prev.filter((t) => t !== tabId);
      } else {
        return [...prev, tabId];
      }
    });
  };

  // 3. Toggle Action Permission on/off in live preview
  const handleToggleAction = (actionKey: PermissionAction) => {
    triggerHapticFeedback('light');
    setAllowedActions((prev) => {
      const exists = prev.includes(actionKey);
      if (exists) {
        return prev.filter((a) => a !== actionKey);
      } else {
        return [...prev, actionKey];
      }
    });
  };

  // 4. Save and Broadcast Changes to Live Staff in Real-Time
  const handleSaveAndBroadcast = async () => {
    if (!activeRole) return;
    try {
      setIsSaving(true);
      triggerHapticFeedback('light');

      const isPrivileged = activeRole.id !== 'subscriber';

      const { error } = await supabase
        .from('custom_roles')
        .update({
          allowed_tabs: activeRole.id === 'admin' ? activeRole.allowed_tabs : allowedTabs,
          allowed_actions: activeRole.id === 'admin' ? activeRole.allowed_actions : allowedActions,
          is_privileged: isPrivileged,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeRole.id);

      if (error) throw error;

      // Broadcast changes across all connected staff devices instantly
      await broadcastRoleUpdate(activeRole.id);

      setSaveSuccess(true);
      triggerHapticFeedback('success');
      setTimeout(() => setSaveSuccess(false), 2500);

      await loadRoles();
      if (onRoleUpdated) onRoleUpdated();
    } catch (err: any) {
      triggerHapticFeedback('error');
      alert('Failed to save role: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to original database defaults
  const handleResetToDatabase = () => {
    if (activeRole) {
      setAllowedTabs((activeRole.allowed_tabs as MainTabId[]) || []);
      setAllowedActions((activeRole.allowed_actions as PermissionAction[]) || []);
      triggerHapticFeedback('light');
    }
  };

  // Filtered action items for the Inspector search
  const filteredActions = useMemo(() => {
    return ALL_ACTIONS.filter((act) => {
      const matchesSearch =
        act.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [searchQuery]);

  // Group actions by category
  const actionsByCategory = useMemo(() => {
    const map = new Map<string, ActionMeta[]>();
    filteredActions.forEach((act) => {
      if (!map.has(act.category)) map.set(act.category, []);
      map.get(act.category)!.push(act);
    });
    return Array.from(map.entries());
  }, [filteredActions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full h-full max-w-[1720px] bg-slate-900 border border-slate-700/80 rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* ── TOP COCKPIT BAR: Role Selector, Device Viewport, Save Controls ── */}
        <header className="h-16 px-4 sm:px-6 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0 z-30">
          {/* Left: Brand & Live Role Selector */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-brand-500/20 shrink-0">
              <Eye size={18} />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5 truncate">
                  Role Screen Simulator &amp; Permission Configurator
                </span>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/30">
                  <Sparkles size={10} /> Live Realtime Preview
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Preview how the app renders for staff and toggle buttons/tabs on or off
              </p>
            </div>
          </div>

          {/* Center: Live Role Switcher Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1">
              <span className="text-xs text-slate-400 font-medium mr-1.5 hidden lg:inline">Simulating Role:</span>
              <select
                value={selectedRoleId}
                onChange={(e) => {
                  setSelectedRoleId(e.target.value);
                  triggerHapticFeedback('light');
                }}
                className="bg-transparent text-xs font-bold text-brand-300 focus:outline-none cursor-pointer pr-2"
              >
                {allRoles.map((r) => (
                  <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                    {r.name} {r.is_system ? '(System)' : '(Custom)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Viewport Device Switcher */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => {
                  setViewportMode('desktop');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewportMode === 'desktop'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Desktop View (Full Screen)"
              >
                <Monitor size={14} />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewportMode('mobile');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewportMode === 'mobile'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mobile View (Phone Frame)"
              >
                <Smartphone size={14} />
                <span className="hidden sm:inline">Mobile Frame</span>
              </button>
            </div>
          </div>

          {/* Right: Inspector Drawer Toggle, Save & Close Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsInspectorOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isInspectorOpen
                  ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Toggle Controls Inspector"
            >
              <Sliders size={13} />
              <span className="hidden md:inline">Permissions Inspector</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndBroadcast}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-brand-600 hover:bg-brand-500 active:scale-95 text-white shadow-brand-500/25'
              }`}
            >
              {isSaving ? (
                <span>Syncing...</span>
              ) : saveSuccess ? (
                <>
                  <Check size={14} />
                  <span>Synced!</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span className="hidden sm:inline">Save &amp; Broadcast</span>
                  <span className="sm:hidden">Save</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1"
              aria-label="Close Preview"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* ── MAIN WORKSPACE: Live App Frame (Center) + Inspector Panel (Right) ── */}
        <div className="flex-1 flex min-h-0 relative overflow-hidden bg-slate-950">
          
          {/* 1. APP CANVAS AREA */}
          <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
            
            {/* DESKTOP FRAME */}
            {viewportMode === 'desktop' && (
              <div className="w-full h-full max-h-[880px] bg-white rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden relative">
                
                {/* Desktop Window Titlebar */}
                <div className="h-9 bg-slate-100 border-b border-slate-200/90 px-4 flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-[11px] font-mono text-slate-500 ml-2">
                      chitfund-manager.pages.dev / [{activeRole?.name}]
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                      {allowedTabs.length} Tabs Allowed
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                      {allowedActions.length} Actions Enabled
                    </span>
                  </div>
                </div>

                {/* Desktop App View Wrapped in RolePreviewAuthProvider */}
                <div className="flex-1 flex min-h-0 relative overflow-hidden bg-slate-50">
                  <RolePreviewAuthProvider
                    roleId={selectedRoleId}
                    roleName={activeRole?.name}
                    allowedTabs={allowedTabs}
                    allowedActions={allowedActions}
                  >
                    <div className="flex-1 flex min-w-0 h-full">
                      {/* Simulated Desktop Sidebar */}
                      <Sidebar
                        activeTab={previewTab}
                        setActiveTab={(tab: string) => setPreviewTab(tab as MainTabId)}
                      />

                      {/* Simulated Desktop Tab Content */}
                      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-slate-50">
                        {renderSimulatedTabContent(previewTab, setPreviewTab)}
                      </div>
                    </div>
                  </RolePreviewAuthProvider>
                </div>
              </div>
            )}

            {/* MOBILE FRAME (Realistic iPhone / Android Smartphone Bezel) */}
            {viewportMode === 'mobile' && (
              <div className="relative w-[390px] h-[780px] max-h-[92vh] bg-slate-900 rounded-[50px] p-3 shadow-2xl border-4 border-slate-700 flex flex-col overflow-hidden shrink-0">
                {/* Dynamic Island / Speaker Notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-40 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900 mr-2" />
                  <div className="w-2 h-2 rounded-full bg-blue-900/60" />
                </div>

                {/* Inner Screen */}
                <div className="w-full h-full bg-slate-50 rounded-[40px] overflow-hidden flex flex-col relative">
                  
                  {/* Status Bar */}
                  <div className="h-8 bg-white/80 backdrop-blur-md px-6 pt-1 flex items-center justify-between text-[11px] font-bold text-slate-800 shrink-0 select-none z-30">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span>5G</span>
                      <div className="w-5 h-2.5 border border-slate-800 rounded-xs p-0.5">
                        <div className="h-full w-3/4 bg-slate-800 rounded-xs" />
                      </div>
                    </div>
                  </div>

                  {/* App Screen Wrapped in RolePreviewAuthProvider */}
                  <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-slate-50">
                    <RolePreviewAuthProvider
                      roleId={selectedRoleId}
                      roleName={activeRole?.name}
                      allowedTabs={allowedTabs}
                      allowedActions={allowedActions}
                    >
                      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto pb-16">
                        {renderSimulatedTabContent(previewTab, setPreviewTab)}
                      </div>

                      {/* Simulated Mobile Bottom Navigation */}
                      <MobileBottomNav
                        activeTab={previewTab}
                        setActiveTab={(tab: string) => setPreviewTab(tab as MainTabId)}
                      />
                    </RolePreviewAuthProvider>
                  </div>

                  {/* Home Indicator Bar */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-400 rounded-full z-40 pointer-events-none" />
                </div>
              </div>
            )}

          </div>

          {/* 2. RIGHT-SIDE INSPECTOR DRAWER / CONTROLS PANEL */}
          {isInspectorOpen && (
            <aside className="w-full sm:w-[420px] bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-30 shadow-xl overflow-hidden animate-in slide-in-from-right duration-200">
              
              {/* Inspector Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs">
                    <Sliders size={14} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Controls Inspector</h3>
                    <p className="text-[11px] text-slate-400">Toggle permissions to preview in real-time</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetToDatabase}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Revert to database values"
                >
                  <RotateCcw size={11} />
                  <span>Revert</span>
                </button>
              </div>

              {/* Inspector Filter Tabs & Search */}
              <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-900">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setInspectorFilter('all')}
                    className={`flex-1 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                      inspectorFilter === 'all' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({ALL_TABS.length + ALL_ACTIONS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorFilter('tabs')}
                    className={`flex-1 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                      inspectorFilter === 'tabs' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tabs ({allowedTabs.length}/{ALL_TABS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorFilter('actions')}
                    className={`flex-1 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                      inspectorFilter === 'actions' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Actions ({allowedActions.length}/{ALL_ACTIONS.length})
                  </button>
                </div>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search buttons, tabs or actions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Scrollable List of Toggle Switches */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* 1. PRIMARY TABS SECTION */}
                {(inspectorFilter === 'all' || inspectorFilter === 'tabs') && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="text-xs font-bold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={13} />
                        Primary Screen Tabs
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {allowedTabs.length} of {ALL_TABS.length} enabled
                      </span>
                    </div>

                    <div className="space-y-2">
                      {ALL_TABS.filter((t) =>
                        t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.desc.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map((tab) => {
                        const Icon = tab.icon;
                        const isEnabled = allowedTabs.includes(tab.id);
                        return (
                          <div
                            key={tab.id}
                            onClick={() => handleToggleTab(tab.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isEnabled
                                ? 'bg-brand-950/30 border-brand-500/40 hover:bg-brand-950/50'
                                : 'bg-slate-950/60 border-slate-800/80 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isEnabled ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-500'
                                }`}
                              >
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-white block truncate">
                                  {tab.label}
                                </span>
                                <p className="text-[10px] text-slate-400 truncate">{tab.desc}</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`w-9 h-5 rounded-full transition-colors relative shrink-0 p-0.5 ${
                                isEnabled ? 'bg-brand-600' : 'bg-slate-700'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                  isEnabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. GRANULAR ACTION BUTTONS PERMISSIONS BY CATEGORY */}
                {(inspectorFilter === 'all' || inspectorFilter === 'actions') && (
                  <div className="space-y-5">
                    {actionsByCategory.map(([category, actions]) => (
                      <div key={category} className="space-y-2.5">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Shield size={12} />
                            {category}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {actions.filter((a) => allowedActions.includes(a.key)).length}/{actions.length} active
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {actions.map((act) => {
                            const isEnabled = allowedActions.includes(act.key);
                            return (
                              <div
                                key={act.key}
                                onClick={() => handleToggleAction(act.key)}
                                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                  isEnabled
                                    ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
                                    : 'bg-slate-950/50 border-slate-800/60 opacity-50 hover:opacity-90'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-200 truncate">
                                      {act.label}
                                    </span>
                                    {isEnabled ? (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                                        ON
                                      </span>
                                    ) : (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-500 font-mono">
                                        OFF
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                                    {act.desc}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  className={`w-8 h-4.5 rounded-full transition-colors relative shrink-0 p-0.5 ${
                                    isEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                                  }`}
                                >
                                  <div
                                    className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                                      isEnabled ? 'translate-x-3.5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Inspector Footer Note */}
              <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <span className="text-[11px] text-slate-400">
                  Changes update live preview automatically.
                </span>
                <button
                  type="button"
                  onClick={handleSaveAndBroadcast}
                  className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Apply &amp; Save
                </button>
              </div>

            </aside>
          )}

        </div>

      </div>
    </div>
  );
}

// Helper to render the simulated authentic app screen for the active preview tab
function renderSimulatedTabContent(
  tab: MainTabId,
  setTab: (t: MainTabId) => void
) {
  switch (tab) {
    case 'dashboard':
      return <DashboardContent activeTab="dashboard" setActiveTab={(t) => setTab(t as MainTabId)} />;
    case 'members':
      return <MemberMatrix />;
    case 'auctions':
      return <LiveAuctionEngine />;
    case 'communication':
      return <CommunicationBroadcastCenter />;
    case 'reports':
      return <ReportsCenter />;
    case 'cash':
      return <CashVaultLedger />;
    case 'chits':
      return <DashboardContent activeTab="chits" setActiveTab={(t) => setTab(t as MainTabId)} />;
    default:
      return (
        <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[360px]">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-brand-600 flex items-center justify-center font-bold">
            <ShieldCheck size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {tab.toUpperCase()} Section
          </h3>
          <p className="text-xs text-slate-500 max-w-sm">
            This module is enabled for this role. Staff can access and perform permitted operations here.
          </p>
        </div>
      );
  }
}
