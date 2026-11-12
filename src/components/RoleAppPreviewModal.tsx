'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import FontSizeSwitcher from './FontSizeSwitcher';
import UserProfileBadge from './UserProfileBadge';
import {
  Monitor,
  Smartphone,
  Eye,
  EyeOff,
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
  LayoutDashboard,
  Gavel,
  BarChart3,
  Vault,
  MessageSquare,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  MousePointer,
  Crosshair,
  Undo2,
  Filter,
  Search,
  Trash2,
  Plus,
  Coins,
  Landmark,
  Calendar,
  DollarSign,
  Send,
  Zap,
  ArrowRight,
  Rocket,
  ChevronDown
} from 'lucide-react';

interface RoleAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoleId?: string;
  onRoleUpdated?: () => void;
}

type CanvasTool = 'navigate' | 'inspect';

interface ActionMeta {
  key: PermissionAction;
  label: string;
  desc: string;
  category: string;
  icon: any;
}

interface ComponentInfo {
  type: 'tab' | 'action';
  key: string;
  name: string;
  category: string;
  desc: string;
  icon: any;
  isEnabled: boolean;
  targetEl?: HTMLElement;
  rect?: { top: number; left: number; width: number; height: number };
}

const ALL_TABS: { id: MainTabId; label: string; icon: any; desc: string }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, desc: 'Financial KPI cards, cycle progress & recent receipts' },
  { id: 'chits', label: 'Chits / Groups', icon: Briefcase, desc: 'Scheme list, auction rules & launch month setup' },
  { id: 'members', label: 'Members Directory', icon: Users, desc: 'Subscriber registry, ticket enrollments & passbooks' },
  { id: 'auctions', label: 'Auctions & Bidding', icon: Gavel, desc: 'Live auction arena, shout bids & winner awards' },
  { id: 'cash', label: 'Treasury', icon: Vault, desc: 'Physical cash box, bank vaults, ATM relocations' },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, desc: 'Defaulters, profit & loss, dividend statements' },
  { id: 'communication', label: 'Communication', icon: MessageSquare, desc: 'WhatsApp templates, pre/post auction notices' },
  { id: 'users', label: 'Roles & Staff', icon: ShieldCheck, desc: 'Workforce accounts, custom roles & permissions' },
  { id: 'settings', label: 'Portal Settings', icon: Settings, desc: 'Branding, security PIN policy & system configurations' },
];

const CATEGORY_TAB_MAP: Record<string, MainTabId> = {
  'Overview Dashboard': 'dashboard',
  'Chits & Groups Tab': 'chits',
  'Members Directory Tab': 'members',
  'Auctions & Bidding Tab': 'auctions',
  'Treasury Tab': 'cash',
  'Reports & Analytics Tab': 'reports',
  'Communication Tab': 'communication',
  'Roles & Staff Tab': 'users',
  'Portal Settings Tab': 'settings',
};

const ALL_ACTIONS: ActionMeta[] = [
  // 1. Overview Dashboard (6 Actions)
  { key: 'dashboard:view_kpis', label: 'View Financial KPIs & Reserves', desc: 'Inspect high-level cash collections, pool totals & active cycle targets', category: 'Overview Dashboard', icon: BarChart3 },
  { key: 'dashboard:quick_actions', label: 'Access Dashboard Quick Actions', desc: 'Use floating and header quick action shortcuts for payments and spends', category: 'Overview Dashboard', icon: Sparkles },
  { key: 'dashboard:launch_month0', label: 'Confirm Launch & Roll to Month 1', desc: 'Confirm Launch Month collections and roll to Month 1 (Organizer Profit)', category: 'Overview Dashboard', icon: Rocket },
  { key: 'dashboard:advance_month', label: 'Conclude Cycle & Advance Month', desc: 'Close active auction month cycle and advance chit to the next month', category: 'Overview Dashboard', icon: ArrowRight },
  { key: 'dashboard:revert_month', label: 'Roll Back / Revert Cycle Month', desc: 'Revert active chit cycle to the preceding month in case of errors', category: 'Overview Dashboard', icon: RotateCcw },
  { key: 'dashboard:view_reserves', label: 'View Kai Iruppu Reserve History', desc: 'Expand and inspect historical discount breakdown in Kai Iruppu pool', category: 'Overview Dashboard', icon: ChevronDown },

  // 2. Chits & Groups Tab (8 Actions)
  { key: 'chits:view', label: 'View Chit Schemes', desc: 'Inspect duration, pot totals, cycle history, and enrolled tickets', category: 'Chits & Groups Tab', icon: Briefcase },
  { key: 'chits:create', label: 'Create New Chit Schemes', desc: 'Launch ₹1L, ₹2L, ₹5L, ₹10L, ₹25L, or custom scheme groups', category: 'Chits & Groups Tab', icon: Plus },
  { key: 'chits:edit', label: 'Edit Scheme Rules & Caps', desc: 'Modify installment deadlines, maximum bid caps, and group parameters', category: 'Chits & Groups Tab', icon: Settings },
  { key: 'chits:launch_month0', label: 'Execute Month 0 Launch', desc: 'Confirm Launch Month collections and allocate Organizer Profit pool', category: 'Chits & Groups Tab', icon: Sparkles },
  { key: 'chits:reschedule_auction', label: 'Reschedule Auction Schedule', desc: 'Postpone or advance monthly auction dates and notify members', category: 'Chits & Groups Tab', icon: Calendar },
  { key: 'chits:configure_laaba_seetu', label: 'Configure Laaba Seetu Rules', desc: 'Set bonus profit discount threshold and pool rollover parameters', category: 'Chits & Groups Tab', icon: DollarSign },
  { key: 'chits:swap_ticket', label: 'Swap / Substitute Member Tickets', desc: 'Transfer enrolled ticket allocations between members in active groups', category: 'Chits & Groups Tab', icon: ArrowRight },
  { key: 'chits:delete', label: 'Delete / Archive Schemes', desc: 'Permanently archive completed pools or delete draft chit schemes', category: 'Chits & Groups Tab', icon: Trash2 },

  // 3. Members Directory Tab (12 Actions)
  { key: 'members:view', label: 'View Member Directory', desc: 'Search subscriber profiles, enrolled chits, and contact records', category: 'Members Directory Tab', icon: Users },
  { key: 'members:enroll', label: 'Enroll New Subscribers', desc: 'Register new member profiles and allocate chit scheme tickets', category: 'Members Directory Tab', icon: Plus },
  { key: 'members:edit', label: 'Edit Member Details', desc: 'Update subscriber phone numbers, addresses, and account notes', category: 'Members Directory Tab', icon: Settings },
  { key: 'members:collect', label: 'Collect Installment Payments', desc: 'Post cash, UPI, or bank installments and issue digital receipts', category: 'Members Directory Tab', icon: Coins },
  { key: 'members:waive_penalties', label: 'Waive Fines & Adjust Dues', desc: 'Authorize manual penalty fee waivers and custom member installments', category: 'Members Directory Tab', icon: Sliders },
  { key: 'members:suspend', label: 'Suspend / Block Portal Access', desc: 'Lock subscriber passbook logins and disqualify from live auctions', category: 'Members Directory Tab', icon: Lock },
  { key: 'members:pair_qr', label: 'Pair Physical Passbook QR', desc: 'Camera scan and link printed QR codes to member passbooks', category: 'Members Directory Tab', icon: Zap },
  { key: 'members:revoke_qr', label: 'Revoke / Unlink Passbook QR', desc: 'Unpair lost or damaged passbook QR tokens from member profile', category: 'Members Directory Tab', icon: Undo2 },
  { key: 'members:batch_qr', label: 'Generate Passbook QR Sheets', desc: 'Create printable batches of blank QR stickers for new booklets', category: 'Members Directory Tab', icon: Layers },
  { key: 'members:reset_mpin', label: 'Reset Passbook MPIN', desc: 'Reset subscriber 4-digit passbook portal PIN to default 1234', category: 'Members Directory Tab', icon: RotateCcw },
  { key: 'members:export', label: 'Export Member Directory CSV', desc: 'Download complete roster with phone numbers and ticket status', category: 'Members Directory Tab', icon: ArrowRight },
  { key: 'members:delete', label: 'Delete Subscriber Records', desc: 'Permanently deactivate or purge member profiles from registry', category: 'Members Directory Tab', icon: Trash2 },

  // 4. Auctions & Bidding Tab (8 Actions)
  { key: 'auctions:view', label: 'View Live Auction Floor', desc: 'Monitor active countdowns, shouted bids, and prize pot values', category: 'Auctions & Bidding Tab', icon: Gavel },
  { key: 'auctions:conduct', label: 'Conduct & Moderate Sessions', desc: 'Start live countdown timer, accept shouts, and moderate bidding desk', category: 'Auctions & Bidding Tab', icon: Zap },
  { key: 'auctions:bid', label: 'Place Proxy Bids for Tickets', desc: 'Shout live discount bids on behalf of eligible non-winning subscribers', category: 'Auctions & Bidding Tab', icon: Plus },
  { key: 'auctions:conclude', label: 'Conclude Cycle & Advance Month', desc: 'Lock winning discount, calculate pot, and advance to next month cycle', category: 'Auctions & Bidding Tab', icon: CheckCircle2 },
  { key: 'auctions:override_floor', label: 'Override Floor / Bid Caps', desc: 'Administrative unlock of minimum floor bid or maximum discount limit', category: 'Auctions & Bidding Tab', icon: Sliders },
  { key: 'auctions:edit_historical', label: 'Correct Historical Auction Logs', desc: 'Fix accidental bid amounts or winner ticket errors with audit logging', category: 'Auctions & Bidding Tab', icon: RotateCcw },
  { key: 'auctions:disburse', label: 'Authorize Prize Pot Payouts', desc: 'Disburse net prize pot to winning subscriber via bank or cash', category: 'Auctions & Bidding Tab', icon: Landmark },
  { key: 'auctions:issue_receipt', label: 'Issue Winner Payout Voucher', desc: 'Generate and print official prize pot payout settlement certificate', category: 'Auctions & Bidding Tab', icon: Check },

  // 5. Treasury Tab (12 Actions)
  { key: 'treasury:view', label: 'View Global Treasury', desc: 'Combined financial balances across all 4 operational vaults', category: 'Treasury Tab', icon: Vault },
  { key: 'treasury:view_cash_box', label: 'View Cash Box Drawer Balance', desc: 'Inspect physical cash-in-hand running balance and safe drawer', category: 'Treasury Tab', icon: Coins },
  { key: 'treasury:view_banks', label: 'View Private Bank Balances', desc: 'Inspect digital balances of Kishor Bank, Dad Bank, and Mom Bank', category: 'Treasury Tab', icon: Landmark },
  { key: 'treasury:collect_cash', label: 'Accept Physical Paper Cash', desc: 'Receive physical currency from members and issue passbook receipts', category: 'Treasury Tab', icon: Plus },
  { key: 'treasury:move_money', label: 'Initiate ATM & Bank Relocations', desc: 'Debit bank accounts (Kishor / Dad / Mom Bank) for cash box funding', category: 'Treasury Tab', icon: ArrowRight },
  { key: 'treasury:confirm_atm', label: 'Confirm Physical ATM Arrival', desc: 'Step 2 physical verification: credit cash box after physical delivery', category: 'Treasury Tab', icon: CheckCircle2 },
  { key: 'treasury:deposit', label: 'Deposit Reserve Cash', desc: 'Deposit external owner cash float or reserve capital into vaults', category: 'Treasury Tab', icon: Plus },
  { key: 'treasury:recover_float', label: 'Recover Agent Field Float', desc: 'Recover floating collections from ground collection agents into vault', category: 'Treasury Tab', icon: RotateCcw },
  { key: 'treasury:personal_draw', label: 'Record Petty Cash & Personal Draws', desc: 'Log expenses such as vehicle fuel, office maintenance, or admin draws', category: 'Treasury Tab', icon: DollarSign },
  { key: 'treasury:settle_draw', label: 'Settle & Repay Personal Debts', desc: 'Record repayment of personal advances and draws back into the vault', category: 'Treasury Tab', icon: Check },
  { key: 'treasury:delete_transaction', label: 'Void / Reverse Financial Entries', desc: 'Authorize cancellation of erroneous transaction entries in vault ledger', category: 'Treasury Tab', icon: Trash2 },
  { key: 'treasury:reconcile', label: 'Denomination Note Count Audit', desc: 'Perform physical note counts (₹500, ₹200, ₹100, etc.) and lock audit', category: 'Treasury Tab', icon: Layers },

  // 6. Reports & Analytics Tab (8 Actions)
  { key: 'reports:view', label: 'View Reports & Analytics Center', desc: 'Access financial summaries, collection progress, and cycle velocity', category: 'Reports & Analytics Tab', icon: BarChart3 },
  { key: 'reports:view_pnl', label: 'View Financial P&L & Margins', desc: 'Inspect organizer profit revenue, active chit value, and gross yield', category: 'Reports & Analytics Tab', icon: DollarSign },
  { key: 'reports:export', label: 'Export General Reports', desc: 'Download CSV / Excel statements and ledger data for accounting audit', category: 'Reports & Analytics Tab', icon: ArrowRight },
  { key: 'reports:export_checklist', label: 'Print Monthly Field Checklists', desc: 'Generate printable collection checklists for field agents to mark dues', category: 'Reports & Analytics Tab', icon: Layers },
  { key: 'reports:export_ledger', label: 'Export Member Passbook Ledgers', desc: 'Download official individual or group PDF & CSV financial statements', category: 'Reports & Analytics Tab', icon: BarChart3 },
  { key: 'reports:view_defaulters', label: 'View Defaulters & Overdue Aging', desc: 'Analyze overdue aging brackets (30/60/90 days) and outstanding dues', category: 'Reports & Analytics Tab', icon: AlertTriangle },
  { key: 'reports:view_audit_logs', label: 'Inspect Security Audit Logs', desc: 'Tamper-evident chronological ledger of all administrative mutations', category: 'Reports & Analytics Tab', icon: Shield },
  { key: 'reports:export_audit', label: 'Export Security Audit Trail', desc: 'Export full immutable audit event ledger as CSV spreadsheet or JSON', category: 'Reports & Analytics Tab', icon: ArrowRight },

  // 7. Communication Tab (7 Actions)
  { key: 'communication:view', label: 'View Broadcast History & Logs', desc: 'Inspect WhatsApp delivery logs, timestamps, and subscriber replies', category: 'Communication Tab', icon: MessageSquare },
  { key: 'communication:broadcast', label: 'Dispatch Instant Payment Receipts', desc: 'Send automated WhatsApp transaction receipts immediately upon payment', category: 'Communication Tab', icon: Send },
  { key: 'communication:pre_auction', label: 'Broadcast Pre-Auction Notices', desc: 'Send upcoming auction schedules, date/time, and bidding instructions', category: 'Communication Tab', icon: Calendar },
  { key: 'communication:post_auction', label: 'Broadcast Auction Results', desc: 'Announce winning discount, winner ticket, and monthly dividend to members', category: 'Communication Tab', icon: MessageSquare },
  { key: 'communication:due_alerts', label: 'Broadcast Monthly Due Reminders', desc: 'Dispatch bulk WhatsApp alerts for pending installments & defaulters', category: 'Communication Tab', icon: AlertTriangle },
  { key: 'communication:custom', label: 'Compose Custom WhatsApp Broadcast', desc: 'Free-form manual WhatsApp message composing and dispatching', category: 'Communication Tab', icon: MessageSquare },
  { key: 'communication:manage_templates', label: 'Manage Message Templates', desc: 'Edit official Tamil and English WhatsApp alert message templates', category: 'Communication Tab', icon: Settings },

  // 8. Roles & Staff Tab (3 Actions)
  { key: 'system:manage_users', label: 'Manage Subscriber Accounts', desc: 'Provision, inspect, and unblock subscriber credentials & portal standing', category: 'Roles & Staff Tab', icon: Users },
  { key: 'system:manage_staff', label: 'Manage Staff Identities & Logins', desc: 'Provision staff accounts, edit profiles, suspend, or delete team members', category: 'Roles & Staff Tab', icon: ShieldCheck },
  { key: 'system:manage_roles', label: 'Configure Custom Roles & RBAC', desc: 'Create custom roles, edit permission matrix, and clone role policies', category: 'Roles & Staff Tab', icon: Sliders },

  // 9. Portal Settings Tab (3 Actions)
  { key: 'system:branding', label: 'Configure Organization Branding', desc: 'Customize company display title, tagline, and brand logo initials', category: 'Portal Settings Tab', icon: Sparkles },
  { key: 'system:maintenance_mode', label: 'Toggle System Maintenance Lockout', desc: 'Emergency lockout of member passbook portal during critical maintenance', category: 'Portal Settings Tab', icon: Lock },
  { key: 'system:reset_database', label: 'Factory Reset & Test Data Purge', desc: 'Purge test transactions, reset balances, and restore initial state', category: 'Portal Settings Tab', icon: Trash2 },
];

// Helper: Intelligent DOM Element Component Resolver
function resolveComponentFromDOM(
  el: HTMLElement,
  allowedTabs: MainTabId[],
  allowedActions: PermissionAction[]
): ComponentInfo | null {
  // Walk up parents (up to 5 levels) to find nearest recognizable component container or button
  let cur: HTMLElement | null = el;
  let steps = 0;

  while (cur && steps < 6 && cur !== cur.ownerDocument?.body) {
    // 1. Direct permission key attribute
    const attrKey = cur.getAttribute('data-permission-key') || cur.getAttribute('data-action-key');
    if (attrKey) {
      const match = ALL_ACTIONS.find((a) => a.key === attrKey);
      if (match) {
        return {
          type: 'action',
          key: match.key,
          name: match.label,
          category: match.category,
          desc: match.desc,
          icon: match.icon,
          isEnabled: allowedActions.includes(match.key),
          targetEl: cur,
        };
      }
    }

    // 1. Direct explicit data-action check (High Priority)
    const explicitAction = cur.getAttribute('data-action') as PermissionAction | null;
    if (explicitAction) {
      const a = ALL_ACTIONS.find((x) => x.key === explicitAction);
      if (a) {
        return {
          type: 'action',
          key: a.key,
          name: a.label,
          category: a.category,
          desc: a.desc,
          icon: a.icon,
          isEnabled: allowedActions.includes(a.key),
          targetEl: cur,
        };
      }
    }

    // 2. Direct tab ID attribute
    const tabAttr = cur.getAttribute('data-tab-id') || cur.getAttribute('data-nav-tab');
    if (tabAttr) {
      const matchTab = ALL_TABS.find((t) => t.id === tabAttr);
      if (matchTab) {
        return {
          type: 'tab',
          key: matchTab.id,
          name: `${matchTab.label} Navigation Tab`,
          category: 'Navigation Tabs',
          desc: matchTab.desc,
          icon: matchTab.icon,
          isEnabled: allowedTabs.includes(matchTab.id),
          targetEl: cur,
        };
      }
    }

    // 3. Match button / link / card text patterns
    const isClickable = cur.tagName === 'BUTTON' || cur.tagName === 'A' || cur.getAttribute('role') === 'button' || cur.classList.contains('cursor-pointer');
    const text = (cur.innerText || cur.getAttribute('aria-label') || cur.getAttribute('title') || '').trim();

    if (isClickable && text.length > 0) {
      const lower = text.toLowerCase();

      // Collect / Payment
      if (lower.includes('record payment') || lower.includes('collect payment') || lower.includes('quick collect') || lower.includes('+ collect') || lower.includes('pay installment') || lower === 'record') {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:collect')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Member Enrollment
      if (lower.includes('enroll') || lower.includes('add member') || lower.includes('new subscriber') || lower.includes('register member')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:enroll')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Member Edit
      if (lower.includes('edit member') || lower.includes('edit information')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:edit')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Member Delete / Archive
      if (lower.includes('archive / delete') || lower.includes('archive member') || lower.includes('delete subscriber') || lower.includes('delete member')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:delete')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Member Suspend
      if (lower.includes('suspend') || lower.includes('lockout standing') || lower.includes('in good standing')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:suspend')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // QR Passbook Pairing
      if (lower.includes('pair qr') || lower.includes('scan passbook') || lower.includes('scan qr') || lower.includes('link passbook') || lower.includes('re-bind qr')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:pair_qr')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Revoke QR
      if (lower.includes('revoke') || lower.includes('lost booklet') || lower.includes('unlink')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:revoke_qr')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Batch QR Printing
      if (lower.includes('batch qr') || lower.includes('print qr') || lower.includes('qr sheets') || lower.includes('print sticker')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:batch_qr')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Reset MPIN
      if (lower.includes('reset pin') || lower.includes('reset mpin')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:reset_mpin')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Export Members
      if (lower.includes('export member') || lower.includes('export csv') || lower.includes('download roster') || lower.includes('export pdf')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:export')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Create Chit Group
      if (lower.includes('create group') || lower.includes('new scheme') || lower.includes('new chit') || lower.includes('create chit')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'chits:create')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Edit Chit Rules
      if (lower.includes('edit chit') || lower.includes('edit rules') || lower.includes('edit group')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'chits:edit')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Delete Chit Scheme
      if (lower.includes('move to recycle bin') || lower.includes('delete scheme') || lower.includes('delete chit') || lower.includes('archive scheme')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'chits:delete')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Revert Month
      if (lower.includes('revert to m') || lower.includes('revert month') || lower.includes('roll back active cycle')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'dashboard:revert_month');
        if (a) return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Kai Iruppu Reserves History
      if (lower.includes('history (') || (lower.includes('breakdown') && lower.includes('kai iruppu'))) {
        const a = ALL_ACTIONS.find((x) => x.key === 'dashboard:view_reserves');
        if (a) return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Launch Month 0
      if (lower.includes('month 0') || lower.includes('launch month') || lower.includes('organizer profit') || lower.includes('confirm launch')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'dashboard:launch_month0') || ALL_ACTIONS.find((x) => x.key === 'chits:launch_month0')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Reschedule Auction
      if (lower.includes('reschedule') || lower.includes('postpone auction')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'chits:reschedule_auction')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Auction Start / Conduct
      if (lower.includes('start auction') || lower.includes('conduct auction') || lower.includes('live arena') || lower.includes('begin live') || lower.includes('begin auction') || lower.includes('end live stream')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'auctions:conduct')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Floor Override
      if (lower.includes('admin override') || lower.includes('early live auction') || lower.includes('start live auction now')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'auctions:override_floor')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Place Proxy Bid
      if (lower.includes('place bid') || lower.includes('proxy bid') || lower.includes('shout bid') || lower.includes('shout')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'auctions:bid')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Conclude Auction / Advance Month
      if (lower.includes('conclude') || lower.includes('award pot') || lower.includes('advance month') || lower.includes('close month')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'dashboard:advance_month') || ALL_ACTIONS.find((x) => x.key === 'auctions:conclude')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Disburse Payout
      if (lower.includes('confirm & disburse') || lower.includes('disburse pot') || lower.includes('disburse payout')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'auctions:disburse')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Issue Receipt / Voucher
      if (lower.includes('download pdf report') || lower.includes('pdf report') || lower.includes('winner voucher') || lower.includes('issue receipt')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'auctions:issue_receipt')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // ATM Relocation
      if (lower.includes('atm') || lower.includes('relocation') || lower.includes('withdraw cash')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'treasury:confirm_atm')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Personal Draw / Spend
      if (lower.includes('personal draw') || lower.includes('log spend') || lower.includes('cash spend')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'treasury:personal_draw')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Inter-vault Transfer
      if (lower.includes('transfer') || lower.includes('move money') || lower.includes('inter-vault')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'treasury:move_money')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Reconcile Notes
      if (lower.includes('count notes') || lower.includes('denomination') || lower.includes('reconcil')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'treasury:reconcile')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // WhatsApp Broadcast
      if (lower.includes('broadcast') || lower.includes('send reminder') || lower.includes('whatsapp alert') || lower.includes('remind all') || lower === 'remind') {
        const a = ALL_ACTIONS.find((x) => x.key === 'communication:broadcast') || ALL_ACTIONS.find((x) => x.key === 'communication:due_alerts')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Printable Checklist Booklet
      if (lower.includes('checklist') || lower.includes('print register') || lower.includes('collection sheet')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'reports:export_checklist')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Export Audit Logs
      if (lower.includes('export csv') || lower.includes('export json') || lower.includes('audit log')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'reports:export_audit')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Branding
      if (lower.includes('save organization branding') || lower.includes('branding')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'system:branding')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Maintenance Mode
      if (lower.includes('engage lockout') || lower.includes('restore access') || lower.includes('maintenance')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'system:maintenance_mode')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Navigation tab items check
      for (const t of ALL_TABS) {
        if (lower === t.label.toLowerCase() || lower.startsWith(t.label.toLowerCase())) {
          return {
            type: 'tab',
            key: t.id,
            name: `${t.label} Navigation Tab`,
            category: 'Navigation Tabs',
            desc: t.desc,
            icon: t.icon,
            isEnabled: allowedTabs.includes(t.id),
            targetEl: cur,
          };
        }
      }
    }

    cur = cur.parentElement;
    steps++;
  }

  return null;
}

// ── ISOLATED PREVIEW IFRAME COMPONENT (Gives TRUE 390px Mobile Viewport & Figma Inspector) ──
interface IsolatedPreviewFrameProps {
  viewportMode: 'desktop' | 'mobile';
  canvasTool: CanvasTool;
  ghostMode: boolean;
  allowedTabs: MainTabId[];
  allowedActions: PermissionAction[];
  onSelectComponent: (info: ComponentInfo) => void;
  children: React.ReactNode;
}

function IsolatedPreviewFrame({
  viewportMode,
  canvasTool,
  ghostMode,
  allowedTabs,
  allowedActions,
  onSelectComponent,
  children,
}: IsolatedPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeDoc, setIframeDoc] = useState<Document | null>(null);
  const [hoveredComponent, setHoveredComponent] = useState<ComponentInfo | null>(null);

  // Sync styles from main window head into iframe document head
  const syncStyles = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Ensure viewport meta tag is present for accurate mobile media query evaluation
    if (!doc.head.querySelector('meta[name="viewport"]')) {
      const meta = doc.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0';
      doc.head.prepend(meta);
    }

    // Copy all style and link tags from main window
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      const href = (node as any).href || (node as any).getAttribute?.('data-href') || node.textContent?.slice(0, 40);
      if (href && doc.head.querySelector(`[data-sync-key="${encodeURIComponent(href)}"]`)) {
        return; // Avoid duplicating
      }

      const clone = node.cloneNode(true) as HTMLElement;
      if (href) clone.setAttribute('data-sync-key', encodeURIComponent(href));
      doc.head.appendChild(clone);
    });

    // Custom CSS for iframe resets and Figma inspector
    if (!doc.head.querySelector('#cf-preview-custom-css')) {
      const customStyle = doc.createElement('style');
      customStyle.id = 'cf-preview-custom-css';
      customStyle.textContent = `
        html, body {
          margin: 0;
          padding: 0;
          min-height: 100%;
          background-color: #f8fafc;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        * { box-sizing: border-box; }
        body.cf-inspect-active * {
          cursor: crosshair !important;
        }
        .cf-figma-highlight {
          outline: 2px solid #8b5cf6 !important;
          outline-offset: -1px !important;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.35) !important;
          transition: all 0.1s ease !important;
        }
      `;
      doc.head.appendChild(customStyle);
    }

    setIframeDoc(doc);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (iframe.contentDocument?.readyState === 'complete') {
      syncStyles();
    } else {
      iframe.addEventListener('load', syncStyles);
      return () => iframe.removeEventListener('load', syncStyles);
    }
  }, [syncStyles, viewportMode]);

  // Handle Figma-like inspection hover and click inside the iframe document
  useEffect(() => {
    if (!iframeDoc) return;

    if (canvasTool === 'inspect') {
      iframeDoc.body.classList.add('cf-inspect-active');
    } else {
      iframeDoc.body.classList.remove('cf-inspect-active');
      setHoveredComponent(null);
      return;
    }

    let currentHighlightedEl: HTMLElement | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target === iframeDoc.body || target === iframeDoc.documentElement) return;

      const comp = resolveComponentFromDOM(target, allowedTabs, allowedActions);
      if (comp && comp.targetEl) {
        if (currentHighlightedEl && currentHighlightedEl !== comp.targetEl) {
          currentHighlightedEl.classList.remove('cf-figma-highlight');
        }
        currentHighlightedEl = comp.targetEl;
        currentHighlightedEl.classList.add('cf-figma-highlight');

        const r = comp.targetEl.getBoundingClientRect();
        setHoveredComponent({
          ...comp,
          rect: {
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          },
        });
      }
    };

    const handleMouseLeave = () => {
      if (currentHighlightedEl) {
        currentHighlightedEl.classList.remove('cf-figma-highlight');
        currentHighlightedEl = null;
      }
      setHoveredComponent(null);
    };

    const handleClick = (e: MouseEvent) => {
      if (canvasTool !== 'inspect') return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const comp = resolveComponentFromDOM(target, allowedTabs, allowedActions);
      if (comp) {
        onSelectComponent(comp);
      }
    };

    iframeDoc.addEventListener('mouseover', handleMouseOver);
    iframeDoc.addEventListener('mouseleave', handleMouseLeave);
    iframeDoc.addEventListener('click', handleClick, true);

    return () => {
      if (currentHighlightedEl) {
        currentHighlightedEl.classList.remove('cf-figma-highlight');
      }
      iframeDoc.removeEventListener('mouseover', handleMouseOver);
      iframeDoc.removeEventListener('mouseleave', handleMouseLeave);
      iframeDoc.removeEventListener('click', handleClick, true);
    };
  }, [iframeDoc, canvasTool, allowedTabs, allowedActions, onSelectComponent]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      <iframe
        ref={iframeRef}
        title="Live Role Preview Frame"
        className="w-full h-full border-0 bg-slate-50"
        style={{ border: 'none', width: '100%', height: '100%' }}
      />

      {/* Floating Figma-style Component Inspection Badge */}
      {canvasTool === 'inspect' && hoveredComponent && hoveredComponent.rect && iframeDoc && (
        <div
          className="absolute z-50 pointer-events-none transition-all duration-75"
          style={{
            top: `${Math.max(8, hoveredComponent.rect.top - 36)}px`,
            left: `${Math.max(8, hoveredComponent.rect.left)}px`,
          }}
        >
          <div className="bg-slate-900/95 backdrop-blur-md text-white border border-brand-500/80 rounded-lg px-2.5 py-1 text-xs font-bold shadow-2xl flex items-center gap-2 pointer-events-auto">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse shrink-0" />
            <span className="text-brand-300 font-extrabold truncate max-w-[180px]">
              {hoveredComponent.name}
            </span>
            <span className="text-[10px] text-slate-400 font-mono px-1 py-0.2 rounded bg-slate-800">
              {hoveredComponent.key}
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                hoveredComponent.isEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {hoveredComponent.isEnabled ? 'Active' : 'Hidden'}
            </span>
            <button
              type="button"
              onClick={() => onSelectComponent(hoveredComponent)}
              className="ml-1 px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-500 text-[10px] text-white font-extrabold cursor-pointer transition-colors"
            >
              {hoveredComponent.isEnabled ? 'Click to Turn Off' : 'Click to Restore'}
            </button>
          </div>
        </div>
      )}

      {/* Render app tree inside isolated iframe via React Portal */}
      {iframeDoc?.body && createPortal(children, iframeDoc.body)}
    </div>
  );
}

// ── MAIN MODAL COMPONENT ──
export default function RoleAppPreviewModal({
  isOpen,
  onClose,
  initialRoleId = 'collections_agent',
  onRoleUpdated,
}: RoleAppPreviewModalProps) {
  const { profile: currentAdminProfile } = useAuth();
  const [allRoles, setAllRoles] = useState<CustomRoleRecord[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(initialRoleId);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('mobile');
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('navigate');
  const [ghostMode, setGhostMode] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [inspectorSubtab, setInspectorSubtab] = useState<'controls' | 'hidden'>('controls');
  const [previewTab, setPreviewTab] = useState<MainTabId>('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; actionKey?: string; isRestore?: boolean } | null>(null);

  const [inspectorFilter, setInspectorFilter] = useState<'all' | 'tabs' | 'actions'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
      const tabMeta = ALL_TABS.find((t) => t.id === tabId);
      const name = tabMeta ? `${tabMeta.label} Tab` : tabId;
      if (exists) {
        setToastMessage({ text: `Turned off ${name}`, actionKey: tabId, isRestore: false });
        return prev.filter((t) => t !== tabId);
      } else {
        setToastMessage({ text: `Restored ${name}`, actionKey: tabId, isRestore: true });
        return [...prev, tabId];
      }
    });
  };

  // 3. Toggle Action Permission on/off in live preview
  const handleToggleAction = (actionKey: PermissionAction) => {
    triggerHapticFeedback('light');
    setAllowedActions((prev) => {
      const exists = prev.includes(actionKey);
      const actMeta = ALL_ACTIONS.find((a) => a.key === actionKey);
      const name = actMeta ? actMeta.label : actionKey;
      if (exists) {
        setToastMessage({ text: `Turned off ${name}`, actionKey, isRestore: false });
        return prev.filter((a) => a !== actionKey);
      } else {
        setToastMessage({ text: `Restored ${name}`, actionKey, isRestore: true });
        return [...prev, actionKey];
      }
    });
  };

  // Click handler from Figma Canvas Inspector
  const handleCanvasComponentToggle = (comp: ComponentInfo) => {
    if (comp.type === 'tab') {
      handleToggleTab(comp.key as MainTabId);
    } else {
      handleToggleAction(comp.key as PermissionAction);
    }
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
      setToastMessage({ text: `Reverted all permissions to role defaults` });
    }
  };

  // Restore all hidden components at once
  const handleRestoreAllComponents = () => {
    setAllowedTabs(ALL_TABS.map((t) => t.id));
    setAllowedActions(ALL_ACTIONS.map((a) => a.key));
    triggerHapticFeedback('success');
    setToastMessage({ text: `Restored all tabs and action permissions` });
  };

  // Computed list of currently hidden components
  const hiddenTabs = useMemo(() => {
    return ALL_TABS.filter((t) => !allowedTabs.includes(t.id));
  }, [allowedTabs]);

  const hiddenActions = useMemo(() => {
    return ALL_ACTIONS.filter((a) => !allowedActions.includes(a.key));
  }, [allowedActions]);

  const totalHiddenCount = hiddenTabs.length + hiddenActions.length;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 md:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="relative w-full h-full max-w-[1760px] bg-slate-50 border border-slate-200/90 rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 font-sans">
        
        {/* ── TOP COCKPIT BAR: Tool Switcher, Role Selector, Device Viewport, Save Controls ── */}
        <header className="px-3 sm:px-6 py-2 sm:py-0 sm:h-16 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 z-30 gap-2 sm:gap-3">
          
          {/* Row 1 on mobile / Left on desktop: Brand Logo, Role Badge & Primary Actions */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-md shadow-brand-500/20 shrink-0">
                <Eye size={17} />
              </div>

              <div className="flex flex-col min-w-0 mr-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight truncate">
                    Role Simulator
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200/80 truncate">
                    {activeRole?.name || 'Staff'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 hidden sm:block truncate">
                  Interactive Android &amp; Desktop UI preview
                </p>
              </div>
            </div>

            {/* Mobile Header Quick Actions: Inspector Pill, Save & Close */}
            <div className="flex items-center gap-1.5 sm:hidden">
              <button
                type="button"
                onClick={() => setIsInspectorOpen((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isInspectorOpen
                    ? 'bg-brand-50 border border-brand-200 text-brand-700 shadow-2xs'
                    : 'bg-slate-100 border border-slate-200/80 text-slate-700 hover:bg-slate-200'
                }`}
                title="Toggle Controls Inspector"
              >
                <Sliders size={12} />
                <span>Inspector</span>
                {totalHiddenCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500 text-white font-mono">
                    {totalHiddenCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveAndBroadcast}
                disabled={isSaving}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-2xs active:scale-95 cursor-pointer"
              >
                {isSaving ? '...' : saveSuccess ? '✓' : 'Save'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Row 2 on mobile / Center on desktop: Canvas Tools & Viewport Toggles */}
          <div className="flex items-center justify-between sm:justify-start gap-2 overflow-x-auto scrollbar-none w-full sm:w-auto pb-0.5 sm:pb-0">
            {/* Viewport Device Switcher */}
            <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-xl p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewportMode('mobile');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewportMode === 'mobile'
                    ? 'bg-white text-brand-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Android Smartphone Viewport"
              >
                <Smartphone size={13} />
                <span>Android App</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewportMode('desktop');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewportMode === 'desktop'
                    ? 'bg-white text-brand-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Desktop View (Full Width)"
              >
                <Monitor size={13} />
                <span>Desktop</span>
              </button>
            </div>

            {/* Mode Switcher: Navigate vs Inspect */}
            <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-xl p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCanvasTool('navigate');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  canvasTool === 'navigate'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Navigate & Test Live App Mode"
              >
                <MousePointer size={13} />
                <span>Test Mode</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCanvasTool('inspect');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  canvasTool === 'inspect'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Select & Edit Component Mode"
              >
                <Crosshair size={13} />
                <span>Select &amp; Edit</span>
              </button>
            </div>

            {/* Role Switcher Dropdown */}
            <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-xl px-2.5 py-1 shrink-0">
              <span className="text-[11px] text-slate-500 font-medium mr-1 hidden lg:inline">Role:</span>
              <select
                value={selectedRoleId}
                onChange={(e) => {
                  setSelectedRoleId(e.target.value);
                  triggerHapticFeedback('light');
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                {allRoles.map((r) => (
                  <option key={r.id} value={r.id} className="bg-white text-slate-900">
                    {r.name} {r.is_system ? '(System)' : '(Custom)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Desktop Right Actions: Inspector Toggle, Save & Broadcast, Close */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsInspectorOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isInspectorOpen
                  ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-2xs'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/80'
              }`}
              title="Toggle Controls Inspector"
            >
              <Sliders size={13} />
              <span>Inspector</span>
              {totalHiddenCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono">
                  {totalHiddenCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveAndBroadcast}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-brand-600 hover:bg-brand-700 active:scale-95 text-white shadow-brand-500/25'
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
                  <span>Save &amp; Broadcast</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer ml-1"
              aria-label="Close Preview"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* ── MAIN WORKSPACE: Live App Canvas (Center) + Inspector Panel (Right) ── */}
        <div className="flex-1 flex min-h-0 relative overflow-hidden bg-slate-100/70">
          
          {/* 1. APP CANVAS AREA */}
          <div className="flex-1 flex flex-col items-center justify-center p-1 sm:p-4 md:p-6 overflow-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] relative">
            
            {/* DESKTOP FRAME */}
            {viewportMode === 'desktop' && (
              <div className="w-full h-full max-h-[880px] bg-white rounded-2xl shadow-xl border border-slate-200/90 flex flex-col overflow-hidden relative">
                
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

                {/* Desktop App View in Isolated Frame */}
                <div className="flex-1 flex min-h-0 relative overflow-hidden bg-slate-50">
                  <RolePreviewAuthProvider
                    roleId={selectedRoleId}
                    roleName={activeRole?.name}
                    allowedTabs={allowedTabs}
                    allowedActions={allowedActions}
                  >
                    <IsolatedPreviewFrame
                      viewportMode="desktop"
                      canvasTool={canvasTool}
                      ghostMode={ghostMode}
                      allowedTabs={allowedTabs}
                      allowedActions={allowedActions}
                      onSelectComponent={handleCanvasComponentToggle}
                    >
                      <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
                        {/* 1. Sidebar Navigation (Sticky on Desktop) */}
                        <Sidebar 
                          activeTab={previewTab} 
                          setActiveTab={(t: string) => setPreviewTab(t as MainTabId)} 
                          mobileOpen={mobileDrawerOpen} 
                          setMobileOpen={setMobileDrawerOpen} 
                        />

                        {/* Main Layout Area */}
                        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
                          
                          {/* Top Header Bar (Desktop only) */}
                          <header className="h-16 border-b border-slate-200/80 bg-white hidden md:flex items-center justify-between px-6 lg:px-8 sticky top-0 z-20 shadow-xs" data-purpose="top-navigation">
                            <div className="flex items-center space-x-3 min-w-0">
                              <h1 className="font-display font-bold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-2 truncate">
                                {ALL_TABS.find((t) => t.id === previewTab)?.label || 'Overview Dashboard'}
                                {previewTab === 'dashboard' && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 hidden sm:inline-flex">
                                    Live Cycle
                                  </span>
                                )}
                              </h1>
                            </div>
                            <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
                              <FontSizeSwitcher />
                              <UserProfileBadge />
                            </div>
                          </header>

                          {/* Main Content Board Canvas */}
                          <main className="flex-1 p-3 sm:p-6 md:p-8 pb-28 md:pb-8 space-y-6 overflow-y-auto w-full max-w-[1700px] mx-auto bg-slate-50">
                            <DashboardContent 
                              activeTab={previewTab} 
                              setActiveTab={(t: string) => setPreviewTab(t as MainTabId)} 
                            />
                          </main>

                          {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
                          <MobileBottomNav 
                            activeTab={previewTab} 
                            setActiveTab={(t: string) => setPreviewTab(t as MainTabId)} 
                            onOpenDrawer={() => setMobileDrawerOpen(true)} 
                          />
                        </div>
                      </div>
                    </IsolatedPreviewFrame>
                  </RolePreviewAuthProvider>
                </div>
              </div>
            )}

            {/* NATIVE ANDROID SMARTPHONE FRAME */}
            {viewportMode === 'mobile' && (
              <div className="relative w-full max-w-[395px] h-[820px] max-h-[90vh] bg-slate-900 rounded-[38px] p-2.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-[5px] border-slate-800 flex flex-col overflow-hidden shrink-0 select-none">
                
                {/* Android Hardware Side Buttons */}
                <div className="absolute -left-[7px] top-28 w-1.5 h-12 bg-slate-700 rounded-l-sm" />
                <div className="absolute -left-[7px] top-44 w-1.5 h-12 bg-slate-700 rounded-l-sm" />
                <div className="absolute -right-[7px] top-32 w-1.5 h-10 bg-slate-700 rounded-r-sm" />

                {/* Inner Android Screen */}
                <div className="w-full h-full bg-slate-50 rounded-[30px] overflow-hidden flex flex-col relative shadow-inner">
                  
                  {/* Android Status Bar */}
                  <div className="h-7.5 bg-white/95 backdrop-blur-md px-5 flex items-center justify-between text-[11px] font-semibold text-slate-700 shrink-0 select-none z-30 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 tracking-tight">10:30</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse ml-0.5" />
                    </div>

                    {/* Minimal Centered Punch-Hole Camera (Real Android) */}
                    <div className="w-3.5 h-3.5 bg-black rounded-full ring-2 ring-slate-800/20 shadow-inner flex items-center justify-center pointer-events-none">
                      <div className="w-1 h-1 rounded-full bg-indigo-950/80" />
                    </div>

                    {/* Native Android Status Icons */}
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
                      <span className="font-bold text-[9px] text-slate-700">5G</span>
                      <svg className="w-3.5 h-3.5 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z" />
                      </svg>
                      <div className="flex items-center gap-0.5">
                        <span className="text-[10px] font-bold">98%</span>
                        <div className="w-3.5 h-2 border border-slate-700 rounded-xs p-0.5 flex items-center">
                          <div className="h-full w-full bg-slate-800 rounded-2xs" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* App Screen in Isolated Frame */}
                  <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-slate-50">
                    <RolePreviewAuthProvider
                      roleId={selectedRoleId}
                      roleName={activeRole?.name}
                      allowedTabs={allowedTabs}
                      allowedActions={allowedActions}
                    >
                      <IsolatedPreviewFrame
                        viewportMode="mobile"
                        canvasTool={canvasTool}
                        ghostMode={ghostMode}
                        allowedTabs={allowedTabs}
                        allowedActions={allowedActions}
                        onSelectComponent={handleCanvasComponentToggle}
                      >
                        <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-20">
                          
                          {/* Android App Top Header Bar */}
                          <header className="h-14 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                CF
                              </div>
                              <div>
                                <div className="font-display font-bold text-sm text-slate-900 leading-none flex items-center gap-1">
                                  ChitFunds<span className="text-brand-600">.Admin</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium">Fintech Workspace</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/60">
                                {activeRole?.name || 'Staff'}
                              </span>
                            </div>
                          </header>

                          {/* Main Content Board Canvas in True Mobile View (Single Column, Stacked Cards) */}
                          <main className="flex-1 p-3 pb-24 space-y-4 overflow-y-auto w-full bg-slate-50">
                            <DashboardContent 
                              activeTab={previewTab} 
                              setActiveTab={(t: string) => setPreviewTab(t as MainTabId)} 
                            />
                          </main>

                          {/* Simulated Native Mobile Bottom Navigation */}
                          <MobileBottomNav 
                            activeTab={previewTab} 
                            setActiveTab={(t: string) => setPreviewTab(t as MainTabId)} 
                            onOpenDrawer={() => setMobileDrawerOpen(true)} 
                          />

                          {/* Slide-over Mobile Navigation Drawer */}
                          <Sidebar 
                            activeTab={previewTab} 
                            setActiveTab={(t: string) => setPreviewTab(t as MainTabId)} 
                            mobileOpen={mobileDrawerOpen} 
                            setMobileOpen={setMobileDrawerOpen} 
                          />
                        </div>
                      </IsolatedPreviewFrame>
                    </RolePreviewAuthProvider>
                  </div>

                  {/* Android Gesture Navigation Pill */}
                  <div className="h-4 bg-white/95 flex items-center justify-center shrink-0 z-30 border-t border-slate-100">
                    <div className="w-24 h-1 bg-slate-400 rounded-full" />
                  </div>
                </div>
              </div>
            )}

            {/* Floating Toast Notification on Component Toggle */}
            {toastMessage && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white border border-brand-500/80 rounded-2xl px-4 py-2.5 text-xs font-bold shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
                <span className={`w-2.5 h-2.5 rounded-full ${toastMessage.isRestore ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>{toastMessage.text}</span>
                {toastMessage.actionKey && (
                  <button
                    type="button"
                    onClick={() => {
                      if (ALL_TABS.some((t) => t.id === toastMessage.actionKey)) {
                        handleToggleTab(toastMessage.actionKey as MainTabId);
                      } else {
                        handleToggleAction(toastMessage.actionKey as PermissionAction);
                      }
                      setToastMessage(null);
                    }}
                    className="ml-2 text-brand-300 hover:text-white underline text-[11px] font-extrabold cursor-pointer"
                  >
                    Undo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            )}

          </div>

          {/* 2. RIGHT-SIDE INSPECTOR DRAWER / MOBILE BOTTOM SHEET */}
          {isInspectorOpen && (
            <>
              {/* Mobile Backdrop Overlay */}
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
                onClick={() => setIsInspectorOpen(false)}
              />

              <aside className="fixed inset-x-0 bottom-0 h-[82vh] md:h-auto md:static md:w-[440px] bg-white border-t md:border-t-0 md:border-l border-slate-200 rounded-t-3xl md:rounded-none flex flex-col shrink-0 z-50 md:z-30 shadow-2xl md:shadow-none overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-right duration-200 text-slate-800">
                {/* Android Drag Handle Pill (Mobile only) */}
                <div className="pt-2.5 pb-1 md:hidden flex justify-center shrink-0 bg-slate-50">
                  <div className="w-12 h-1 bg-slate-300 rounded-full" />
                </div>

                {/* Inspector Header with Subtabs */}
                <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs">
                      <Sliders size={14} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Controls Inspector</h3>
                      <p className="text-[11px] text-slate-500">Live app permission &amp; component state</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetToDatabase}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      title="Revert to database values"
                    >
                      <RotateCcw size={11} />
                      <span>Revert</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsInspectorOpen(false)}
                      className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 md:hidden ml-1 cursor-pointer"
                      aria-label="Close Inspector"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Inspector Subtabs: All Controls vs Hidden Components */}
                <div className="px-3 sm:px-4 pt-2.5 pb-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/70">
                  <button
                    type="button"
                    onClick={() => setInspectorSubtab('controls')}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      inspectorSubtab === 'controls'
                        ? 'bg-white text-brand-700 shadow-2xs border border-slate-200/80'
                        : 'bg-slate-100/90 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sliders size={13} />
                    <span>All Controls</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectorSubtab('hidden')}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      inspectorSubtab === 'hidden'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs'
                        : 'bg-slate-100/90 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <EyeOff size={13} />
                    <span>Hidden Components</span>
                    {totalHiddenCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-mono font-bold">
                        {totalHiddenCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* ── SUBTAB 1: ALL CONTROLS & TOGGLE SWITCHES ── */}
                {inspectorSubtab === 'controls' && (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/30">
                    {/* Filter Pills & Search */}
                    <div className="p-3 border-b border-slate-100 space-y-2 bg-white shrink-0">
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs">
                        <button
                          type="button"
                          onClick={() => setInspectorFilter('all')}
                          className={`flex-1 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                            inspectorFilter === 'all' ? 'bg-white text-brand-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          All ({ALL_TABS.length + ALL_ACTIONS.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectorFilter('tabs')}
                          className={`flex-1 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                            inspectorFilter === 'tabs' ? 'bg-white text-brand-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Tabs ({allowedTabs.length}/{ALL_TABS.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectorFilter('actions')}
                          className={`flex-1 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                            inspectorFilter === 'actions' ? 'bg-white text-brand-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Actions ({allowedActions.length}/{ALL_ACTIONS.length})
                        </button>
                      </div>

                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search buttons, tabs or actions..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Scrollable List of Toggle Switches */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5">
                      
                      {/* Primary Tabs Section */}
                      {(inspectorFilter === 'all' || inspectorFilter === 'tabs') && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                            <span className="text-xs font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
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
                                      ? 'bg-white border-slate-200/90 hover:border-brand-300 shadow-2xs'
                                      : 'bg-slate-50/80 border-slate-200/60 opacity-60 hover:opacity-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        isEnabled ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400'
                                      }`}
                                    >
                                      <Icon size={16} />
                                    </div>
                                    <div className="min-w-0">
                                      <span className={`text-xs font-bold block truncate ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                                        {tab.label}
                                      </span>
                                      <p className="text-[10px] text-slate-500 truncate">{tab.desc}</p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 p-0.5 ${
                                      isEnabled ? 'bg-brand-600' : 'bg-slate-200'
                                    }`}
                                  >
                                    <div
                                      className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
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

                      {/* Categorized Action Permissions Section */}
                      {(inspectorFilter === 'all' || inspectorFilter === 'actions') && (
                        <div className="space-y-5">
                          {actionsByCategory.map(([category, items]) => {
                            const tabId = CATEGORY_TAB_MAP[category];
                            const isTabEnabled = tabId ? allowedTabs.includes(tabId) : true;
                            const enabledCount = items.filter((i) => allowedActions.includes(i.key)).length;

                            return (
                              <div key={category} className="space-y-2">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                      {category}
                                    </span>
                                    {tabId && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleTab(tabId)}
                                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                                          isTabEnabled
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100'
                                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                        }`}
                                        title="Toggle master tab navigation visibility"
                                      >
                                        {isTabEnabled ? 'Tab Active' : 'Tab Hidden'}
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {enabledCount}/{items.length} active
                                  </span>
                                </div>

                                {isTabEnabled ? (
                                  <div className="space-y-1.5">
                                    {items.map((act) => {
                                      const Icon = act.icon;
                                      const isEnabled = allowedActions.includes(act.key);
                                      return (
                                        <div
                                          key={act.key}
                                          onClick={() => handleToggleAction(act.key)}
                                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                            isEnabled
                                              ? 'bg-white border-slate-200/90 hover:border-brand-300 shadow-2xs'
                                              : 'bg-slate-50/80 border-slate-200/60 opacity-60 hover:opacity-100'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div
                                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                isEnabled ? 'bg-indigo-50 text-brand-600' : 'bg-slate-100 text-slate-400'
                                              }`}
                                            >
                                              <Icon size={14} />
                                            </div>
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`text-xs font-bold truncate ${isEnabled ? 'text-slate-900' : 'text-slate-600'}`}>
                                                  {act.label}
                                                </span>
                                                <span className="text-[9px] font-mono text-slate-400">
                                                  {act.key}
                                                </span>
                                              </div>
                                              <p className="text-[10px] text-slate-500 truncate mt-0.5">{act.desc}</p>
                                            </div>
                                          </div>

                                          <button
                                            type="button"
                                            className={`w-8 h-4.5 rounded-full transition-colors relative shrink-0 p-0.5 ${
                                              isEnabled ? 'bg-brand-600' : 'bg-slate-200'
                                            }`}
                                          >
                                            <div
                                              className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform ${
                                                isEnabled ? 'translate-x-3.5' : 'translate-x-0'
                                              }`}
                                            />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Lock size={13} className="text-slate-400 shrink-0" />
                                      <span className="truncate">Tab navigation hidden. Enable tab above to unlock.</span>
                                    </div>
                                    {tabId && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleTab(tabId)}
                                        className="text-[11px] font-bold text-brand-600 hover:text-brand-700 shrink-0 ml-2 cursor-pointer"
                                      >
                                        Enable
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── SUBTAB 2: DEDICATED HIDDEN COMPONENTS & RESTORE LIST ── */}
                {inspectorSubtab === 'hidden' && (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/30">
                    
                    {/* Top Action Bar: Restore All */}
                    <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
                      <span className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                        <EyeOff size={13} />
                        {totalHiddenCount} Component{totalHiddenCount === 1 ? '' : 's'} Disabled
                      </span>

                      {totalHiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={handleRestoreAllComponents}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Re-enable all tabs and action permissions"
                        >
                          <RotateCcw size={11} />
                          <span>Restore All</span>
                        </button>
                      )}
                    </div>

                    {/* List of Turned-Off / Hidden Elements */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
                      
                      {totalHiddenCount === 0 ? (
                        <div className="text-center py-16 px-4 space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                            <ShieldCheck size={24} />
                          </div>
                          <h4 className="font-bold text-sm text-slate-900">All UI Components Active</h4>
                          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                            No buttons, tabs, or features are currently hidden for this role. Use the canvas cursor in <strong>Select &amp; Edit</strong> mode to click and hide any button.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* 1. Hidden Primary Tabs */}
                          {hiddenTabs.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Hidden Screen Tabs ({hiddenTabs.length})
                              </span>
                              <div className="space-y-2">
                                {hiddenTabs.map((t) => {
                                  const Icon = t.icon;
                                  return (
                                    <div
                                      key={t.id}
                                      className="p-3 rounded-xl bg-white border border-rose-200 flex items-center justify-between gap-3 shadow-2xs hover:border-rose-300 transition-all"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                          <Icon size={16} />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-slate-900 truncate">{t.label}</span>
                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-mono font-bold">
                                              tab:{t.id}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{t.desc}</p>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleTab(t.id)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
                                        title="Restore this tab to live app"
                                      >
                                        <Eye size={12} />
                                        <span>Restore</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 2. Hidden Action Buttons / Functions */}
                          {hiddenActions.length > 0 && (
                            <div className="space-y-2 pt-2">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Hidden Actions &amp; Buttons ({hiddenActions.length})
                              </span>
                              <div className="space-y-2">
                                {hiddenActions.map((a) => {
                                  const Icon = a.icon;
                                  return (
                                    <div
                                      key={a.key}
                                      className="p-3 rounded-xl bg-white border border-rose-200 flex items-center justify-between gap-3 shadow-2xs hover:border-rose-300 transition-all"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                          <Icon size={16} />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-bold text-slate-900 truncate">{a.label}</span>
                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                                              {a.key}
                                            </span>
                                          </div>
                                          <span className="text-[9px] font-semibold text-rose-600 block">
                                            {a.category}
                                          </span>
                                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{a.desc}</p>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleAction(a.key)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
                                        title="Restore this button / action to live app"
                                      >
                                        <Eye size={12} />
                                        <span>Restore</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                    </div>
                  </div>
                )}

                {/* Inspector Footer Bar */}
                <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-between shrink-0 text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {allowedTabs.length} tabs · {allowedActions.length} actions enabled
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveAndBroadcast}
                    className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs cursor-pointer shadow-sm shadow-brand-500/25 active:scale-95 transition-all"
                  >
                    Save &amp; Broadcast
                  </button>
                </div>

            </aside>
          </>
        )}

        </div>

      </div>
    </div>
  );
}
