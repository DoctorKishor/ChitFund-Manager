'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/utils/supabase/client';
import { useAuth, RolePreviewAuthProvider, broadcastRoleUpdate } from '@/context/AuthContext';
import { CustomRoleRecord, MainTabId, PermissionAction } from '@/utils/rbac';
import { triggerHapticFeedback } from '@/utils/haptics';
import DashboardContent from './DashboardContent';
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

const DEFAULT_SYSTEM_ROLES: CustomRoleRecord[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full unrestricted system control, treasury vaults, role assignment & audit logs',
    color: '#9333ea',
    is_system: true,
    is_privileged: true,
    allowed_tabs: ['dashboard', 'chits', 'members', 'auctions', 'cash', 'reports', 'communication', 'users', 'settings'],
    allowed_actions: [
      'dashboard:view_kpis', 'dashboard:quick_actions', 'dashboard:launch_month0', 'dashboard:advance_month', 'dashboard:revert_month', 'dashboard:view_reserves',
      'chits:view', 'chits:create', 'chits:edit', 'chits:launch_month0', 'chits:reschedule_auction', 'chits:configure_laaba_seetu', 'chits:swap_ticket', 'chits:delete',
      'members:view', 'members:enroll', 'members:edit', 'members:collect', 'members:waive_penalties', 'members:suspend', 'members:pair_qr', 'members:revoke_qr', 'members:batch_qr', 'members:reset_mpin', 'members:export', 'members:delete',
      'auctions:view', 'auctions:conduct', 'auctions:bid', 'auctions:conclude', 'auctions:override_floor', 'auctions:edit_historical', 'auctions:disburse', 'auctions:issue_receipt',
      'treasury:view', 'treasury:view_cash_box', 'treasury:view_banks', 'treasury:collect_cash', 'treasury:move_money', 'treasury:confirm_atm', 'treasury:deposit', 'treasury:recover_float', 'treasury:personal_draw', 'treasury:settle_draw', 'treasury:delete_transaction', 'treasury:reconcile',
      'reports:view', 'reports:view_pnl', 'reports:export', 'reports:export_checklist', 'reports:export_ledger', 'reports:view_defaulters', 'reports:view_audit_logs', 'reports:export_audit',
      'communication:view', 'communication:broadcast', 'communication:pre_auction', 'communication:post_auction', 'communication:due_alerts', 'communication:custom', 'communication:manage_templates',
      'system:manage_users', 'system:manage_staff', 'system:manage_roles', 'system:branding', 'system:maintenance_mode', 'system:reset_database'
    ],
  },
  {
    id: 'manager',
    name: 'Manager',
    description: 'Operational management, member enrollment, live bidding arena & WhatsApp dispatch',
    color: '#2563eb',
    is_system: true,
    is_privileged: true,
    allowed_tabs: ['dashboard', 'chits', 'members', 'auctions', 'communication', 'reports'],
    allowed_actions: [
      'dashboard:view_kpis', 'dashboard:quick_actions', 'dashboard:advance_month', 'dashboard:view_reserves',
      'chits:view', 'chits:create', 'chits:edit', 'chits:reschedule_auction', 'chits:configure_laaba_seetu', 'chits:swap_ticket',
      'members:view', 'members:enroll', 'members:edit', 'members:collect', 'members:suspend', 'members:pair_qr', 'members:revoke_qr', 'members:batch_qr', 'members:reset_mpin', 'members:export',
      'auctions:view', 'auctions:conduct', 'auctions:bid', 'auctions:conclude', 'auctions:disburse', 'auctions:issue_receipt',
      'treasury:view_cash_box', 'treasury:collect_cash', 'treasury:recover_float',
      'communication:view', 'communication:broadcast', 'communication:pre_auction', 'communication:post_auction', 'communication:due_alerts', 'communication:custom', 'communication:manage_templates',
      'reports:view', 'reports:export_checklist', 'reports:export_ledger', 'reports:view_defaulters'
    ],
  },
  {
    id: 'collections_agent',
    name: 'Collections Agent',
    description: 'Ground field agent: offline collections, booklet QR scanner pairing & payment broadcast',
    color: '#f59e0b',
    is_system: false,
    is_privileged: true,
    allowed_tabs: ['dashboard', 'members', 'communication'],
    allowed_actions: [
      'dashboard:quick_actions',
      'members:view', 'members:collect', 'members:pair_qr',
      'treasury:collect_cash',
      'communication:view', 'communication:broadcast', 'communication:due_alerts'
    ],
  },
  {
    id: 'auction_clerk',
    name: 'Auction Clerk',
    description: 'Assists organizer during monthly live bidding sessions by recording shouted proxy discounts',
    color: '#a855f7',
    is_system: false,
    is_privileged: true,
    allowed_tabs: ['dashboard', 'chits', 'members', 'auctions'],
    allowed_actions: [
      'chits:view',
      'members:view',
      'auctions:view', 'auctions:bid', 'auctions:issue_receipt'
    ],
  },
  {
    id: 'auditor',
    name: 'Auditor / CA',
    description: 'Read-only financial auditor access for balance sheets, ledger downloads & dividend statements',
    color: '#0d9488',
    is_system: false,
    is_privileged: true,
    allowed_tabs: ['dashboard', 'chits', 'members', 'cash', 'reports'],
    allowed_actions: [
      'dashboard:view_kpis', 'dashboard:view_reserves',
      'chits:view',
      'members:view', 'members:export',
      'auctions:view',
      'treasury:view', 'treasury:view_cash_box',
      'reports:view', 'reports:view_pnl', 'reports:export', 'reports:export_checklist', 'reports:export_ledger', 'reports:view_defaulters', 'reports:view_audit_logs', 'reports:export_audit'
    ],
  },
  {
    id: 'subscriber',
    name: 'Subscriber',
    description: 'Member portal: personal enrolled chits, ledger & live auction bidding room',
    color: '#10b981',
    is_system: true,
    is_privileged: false,
    allowed_tabs: ['dashboard', 'chits', 'members', 'auctions'],
    allowed_actions: [
      'chits:view', 'members:view', 'auctions:view', 'auctions:bid'
    ],
  },
];

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
  { key: 'dashboard:view_kpis', label: 'View Financial Overview Cards', desc: 'Show Total Collected, Target, and Pending dues summary cards', category: 'Overview Dashboard', icon: BarChart3 },
  { key: 'dashboard:quick_actions', label: 'Quick Actions (+ Record Payment & Menu)', desc: 'Show header "+ Record Payment" button and floating quick action shortcuts', category: 'Overview Dashboard', icon: Sparkles },
  { key: 'dashboard:launch_month0', label: 'Confirm Launch & Roll to Month 1', desc: 'Button to complete Month 0 and allocate Organizer Profit', category: 'Overview Dashboard', icon: Rocket },
  { key: 'dashboard:advance_month', label: 'Conclude & Advance Month', desc: 'Button to finish current monthly auction cycle and advance to next month', category: 'Overview Dashboard', icon: ArrowRight },
  { key: 'dashboard:revert_month', label: 'Revert to Previous Month (Revert to M{x})', desc: 'Roll back the active group cycle to the previous month in case of mistakes', category: 'Overview Dashboard', icon: RotateCcw },
  { key: 'dashboard:view_reserves', label: 'View Kai Iruppu History & Breakdown', desc: 'Expand the discount reserve card to see past auction contributions', category: 'Overview Dashboard', icon: ChevronDown },

  // 2. Chits & Groups Tab (8 Actions)
  { key: 'chits:view', label: 'View Chit Groups & Details', desc: 'Browse chit groups, scheme rules, pot amounts, and member lists', category: 'Chits & Groups Tab', icon: Briefcase },
  { key: 'chits:create', label: '+ Create New Chit Group', desc: 'Create new ₹1L, ₹2L, ₹5L, or custom chit scheme groups', category: 'Chits & Groups Tab', icon: Plus },
  { key: 'chits:edit', label: 'Edit Group Rules & Bidding Caps', desc: 'Change auction dates, maximum discount caps, and chit settings', category: 'Chits & Groups Tab', icon: Settings },
  { key: 'chits:launch_month0', label: 'Confirm Launch Month (Organizer Profit)', desc: 'Confirm first month collections and claim organizer profit', category: 'Chits & Groups Tab', icon: Sparkles },
  { key: 'chits:reschedule_auction', label: 'Reschedule Auction Date', desc: 'Change the date or time of upcoming live auctions and alert members', category: 'Chits & Groups Tab', icon: Calendar },
  { key: 'chits:configure_laaba_seetu', label: 'Configure Laaba Seetu (Free Month)', desc: 'Set bonus discount pool threshold for members\' free installment month', category: 'Chits & Groups Tab', icon: DollarSign },
  { key: 'chits:swap_ticket', label: 'Swap / Replace Member Tickets', desc: 'Transfer a ticket allocation from one member to another', category: 'Chits & Groups Tab', icon: ArrowRight },
  { key: 'chits:delete', label: 'Delete / Archive Chit Group', desc: 'Move completed chit groups to recycle bin or delete draft groups', category: 'Chits & Groups Tab', icon: Trash2 },

  // 3. Members Directory Tab (12 Actions)
  { key: 'members:view', label: 'View Members Directory', desc: 'Search member profiles, contact numbers, and enrolled tickets', category: 'Members Directory Tab', icon: Users },
  { key: 'members:enroll', label: '+ Add New Member', desc: 'Register a new subscriber and assign them a chit ticket', category: 'Members Directory Tab', icon: Plus },
  { key: 'members:edit', label: 'Edit Member Profile & Phone', desc: 'Update member name, mobile phone number, and address', category: 'Members Directory Tab', icon: Settings },
  { key: 'members:collect', label: 'Record Payment (+ Collect)', desc: 'Record cash, UPI, or bank installments and issue payment receipts', category: 'Members Directory Tab', icon: Coins },
  { key: 'members:waive_penalties', label: 'Waive Fines & Adjust Dues', desc: 'Waive late payment fines or enter custom due adjustments', category: 'Members Directory Tab', icon: Sliders },
  { key: 'members:suspend', label: 'Block / Suspend Member', desc: 'Temporarily lock member passbook login and disqualify from bidding', category: 'Members Directory Tab', icon: Lock },
  { key: 'members:pair_qr', label: 'Scan & Pair Passbook QR', desc: 'Use camera to scan and link a printed QR code to a member passbook', category: 'Members Directory Tab', icon: Zap },
  { key: 'members:revoke_qr', label: 'Unlink Lost Passbook QR', desc: 'Disconnect a lost or damaged passbook QR code from a member', category: 'Members Directory Tab', icon: Undo2 },
  { key: 'members:batch_qr', label: 'Print QR Sticker Sheets', desc: 'Generate printable sheets of blank QR stickers for passbooks', category: 'Members Directory Tab', icon: Layers },
  { key: 'members:reset_mpin', label: 'Reset Passbook PIN to 1234', desc: 'Reset member 4-digit passbook login PIN back to default 1234', category: 'Members Directory Tab', icon: RotateCcw },
  { key: 'members:export', label: 'Download Members List (Excel/CSV)', desc: 'Download complete member roster with phone numbers and tickets', category: 'Members Directory Tab', icon: ArrowRight },
  { key: 'members:delete', label: 'Delete Member Profile', desc: 'Permanently delete or deactivate a member profile', category: 'Members Directory Tab', icon: Trash2 },

  // 4. Auctions & Bidding Tab (8 Actions)
  { key: 'auctions:view', label: 'View Live Auction Arena', desc: 'Watch the auction countdown, live bids, and prize pot values', category: 'Auctions & Bidding Tab', icon: Gavel },
  { key: 'auctions:conduct', label: 'Start / Control Live Auction', desc: 'Start the auction timer, call for bids, and manage the live session', category: 'Auctions & Bidding Tab', icon: Zap },
  { key: 'auctions:bid', label: 'Place Bid for Member (Shout Bid)', desc: 'Submit a discount bid on behalf of an eligible non-winning member', category: 'Auctions & Bidding Tab', icon: Plus },
  { key: 'auctions:conclude', label: 'Declare Winner & Close Auction', desc: 'Confirm the winning bid discount and advance to the next month', category: 'Auctions & Bidding Tab', icon: CheckCircle2 },
  { key: 'auctions:override_floor', label: 'Override Minimum / Maximum Bid Limits', desc: 'Unlock floor bid or maximum discount limit during an auction', category: 'Auctions & Bidding Tab', icon: Sliders },
  { key: 'auctions:edit_historical', label: 'Edit Past Auction Results', desc: 'Fix accidental winning bid amounts or member errors in past months', category: 'Auctions & Bidding Tab', icon: RotateCcw },
  { key: 'auctions:disburse', label: 'Disburse Prize Money (Payout)', desc: 'Pay out the net prize pot to the winning member via cash or bank', category: 'Auctions & Bidding Tab', icon: Landmark },
  { key: 'auctions:issue_receipt', label: 'Print Winner Payout Receipt', desc: 'Generate and print the official winner prize payout settlement receipt', category: 'Auctions & Bidding Tab', icon: Check },

  // 5. Treasury Tab (12 Actions)
  { key: 'treasury:view', label: 'View All Cash & Bank Balances', desc: 'Combined total balance across Cash Box and all bank accounts', category: 'Treasury Tab', icon: Vault },
  { key: 'treasury:view_cash_box', label: 'View Cash Box (Cash in Hand)', desc: 'Check physical cash box balance and cash drawer money', category: 'Treasury Tab', icon: Coins },
  { key: 'treasury:view_banks', label: 'View Bank Balances (Kishor / Dad / Mom)', desc: 'Inspect account balances for digital collections and payments', category: 'Treasury Tab', icon: Landmark },
  { key: 'treasury:collect_cash', label: 'Accept Cash Payments', desc: 'Receive physical cash from members and add to Cash Box', category: 'Treasury Tab', icon: Plus },
  { key: 'treasury:move_money', label: 'Move Money (ATM / Bank Transfer)', desc: 'Withdraw money from bank into Cash Box or transfer between banks', category: 'Treasury Tab', icon: ArrowRight },
  { key: 'treasury:confirm_atm', label: 'Confirm ATM Cash Received in Box', desc: 'Verify physical cash arrived and credit it into Cash Box', category: 'Treasury Tab', icon: CheckCircle2 },
  { key: 'treasury:deposit', label: 'Deposit Owner Reserve / Extra Funds', desc: 'Add external personal or reserve money into the cash box', category: 'Treasury Tab', icon: Plus },
  { key: 'treasury:recover_float', label: 'Collect Field Cash from Staff', desc: 'Take collected cash from field agents and deposit into main box', category: 'Treasury Tab', icon: RotateCcw },
  { key: 'treasury:personal_draw', label: 'Log Expenses & Personal Spends', desc: 'Record petty cash expenses like petrol, maintenance, or owner draws', category: 'Treasury Tab', icon: DollarSign },
  { key: 'treasury:settle_draw', label: 'Repay Personal Advance / Spends', desc: 'Record repayment of borrowed money back into the cash box', category: 'Treasury Tab', icon: Check },
  { key: 'treasury:delete_transaction', label: 'Delete / Cancel Wrong Transaction', desc: 'Cancel or reverse an accidental payment or expense entry', category: 'Treasury Tab', icon: Trash2 },
  { key: 'treasury:reconcile', label: 'Cash Note Counter (₹500, ₹200, ₹100)', desc: 'Count physical currency notes and match with cash box balance', category: 'Treasury Tab', icon: Layers },

  // 6. Reports & Analytics Tab (8 Actions)
  { key: 'reports:view', label: 'View Reports & Analytics', desc: 'Access financial summaries, collection rates, and monthly progress', category: 'Reports & Analytics Tab', icon: BarChart3 },
  { key: 'reports:view_pnl', label: 'View Profit & Loss (Organizer Earnings)', desc: 'Inspect organizer profit, total turnover, and financial margins', category: 'Reports & Analytics Tab', icon: DollarSign },
  { key: 'reports:export', label: 'Download Reports (Excel/CSV)', desc: 'Download accounting statements and summaries as spreadsheet files', category: 'Reports & Analytics Tab', icon: ArrowRight },
  { key: 'reports:export_checklist', label: 'Print Monthly Collection Checklist', desc: 'Print sheet for agents to mark off dues physically in the field', category: 'Reports & Analytics Tab', icon: Layers },
  { key: 'reports:export_ledger', label: 'Download Passbook Ledgers (PDF)', desc: 'Download official member payment history statement PDFs', category: 'Reports & Analytics Tab', icon: BarChart3 },
  { key: 'reports:view_defaulters', label: 'View Defaulters & Overdue Dues', desc: 'See members with unpaid installments and overdue payment alerts', category: 'Reports & Analytics Tab', icon: AlertTriangle },
  { key: 'reports:view_audit_logs', label: 'View System Activity & Audit Logs', desc: 'View history of all staff logins, changes, payments, and edits', category: 'Reports & Analytics Tab', icon: Shield },
  { key: 'reports:export_audit', label: 'Download Activity Log (CSV)', desc: 'Export full history of system activities and changes', category: 'Reports & Analytics Tab', icon: ArrowRight },

  // 7. Communication Tab (7 Actions)
  { key: 'communication:view', label: 'View Message History & Logs', desc: 'Inspect sent WhatsApp messages, delivery times, and replies', category: 'Communication Tab', icon: MessageSquare },
  { key: 'communication:broadcast', label: 'Send WhatsApp Payment Receipts', desc: 'Send automated WhatsApp receipt message when payment is recorded', category: 'Communication Tab', icon: Send },
  { key: 'communication:pre_auction', label: 'Send Auction Reminders on WhatsApp', desc: 'Send upcoming auction date, time, and rules to members', category: 'Communication Tab', icon: Calendar },
  { key: 'communication:post_auction', label: 'Send Auction Results on WhatsApp', desc: 'Announce winner ticket, winning discount, and monthly dividend to members', category: 'Communication Tab', icon: MessageSquare },
  { key: 'communication:due_alerts', label: 'Send Payment Due Reminders (WhatsApp)', desc: 'Send WhatsApp reminder messages to members who haven\'t paid yet', category: 'Communication Tab', icon: AlertTriangle },
  { key: 'communication:custom', label: 'Send Custom WhatsApp Message', desc: 'Type and send a custom announcement message to members', category: 'Communication Tab', icon: MessageSquare },
  { key: 'communication:manage_templates', label: 'Edit WhatsApp Message Templates', desc: 'Change default Tamil and English WhatsApp message wording', category: 'Communication Tab', icon: Settings },

  // 8. Roles & Staff Tab (3 Actions)
  { key: 'system:manage_users', label: 'Manage Member Logins & Access', desc: 'View member portal accounts, reset passwords, or unblock logins', category: 'Roles & Staff Tab', icon: Users },
  { key: 'system:manage_staff', label: 'Manage Staff Accounts & Logins', desc: 'Add staff accounts, change passwords, and assign work roles', category: 'Roles & Staff Tab', icon: ShieldCheck },
  { key: 'system:manage_roles', label: 'Edit Roles & Permissions', desc: 'Create custom roles and turn features on or off for staff', category: 'Roles & Staff Tab', icon: Sliders },

  // 9. Portal Settings Tab (3 Actions)
  { key: 'system:branding', label: 'Change Business Name & Logo', desc: 'Set company name, tagline, and passbook header logo', category: 'Portal Settings Tab', icon: Sparkles },
  { key: 'system:maintenance_mode', label: 'Maintenance Mode (Lock App)', desc: 'Lock subscriber passbook portal while doing updates', category: 'Portal Settings Tab', icon: Lock },
  { key: 'system:reset_database', label: 'Clear Test Data / Factory Reset', desc: 'Delete sample data, reset balances, and start fresh', category: 'Portal Settings Tab', icon: Trash2 },
];

// Intelligent Action Text Matching Rules
const ACTION_MATCH_RULES: { key: PermissionAction; match: (lower: string) => boolean }[] = [
  // 1. Overview Dashboard
  { key: 'dashboard:view_kpis', match: (t) => t.includes('total collected') || t.includes('target:') || t.includes('to collect') || t.includes('financial overview') },
  { key: 'dashboard:quick_actions', match: (t) => t.includes('quick action') || t.includes('speed dial') || t.includes('floating action') },
  { key: 'dashboard:launch_month0', match: (t) => t.includes('confirm launch & roll to month 1') || t.includes('confirm launch') },
  { key: 'dashboard:advance_month', match: (t) => t.includes('conclude & advance month') || t.includes('conclude & advance') },
  { key: 'dashboard:revert_month', match: (t) => t.includes('revert to m') || t.includes('revert month') || t.includes('roll back active cycle') },
  { key: 'dashboard:view_reserves', match: (t) => t.includes('kai iruppu') || t.includes('history (') || (t.includes('breakdown') && t.includes('reserve')) },

  // 2. Chits & Groups Tab
  { key: 'chits:create', match: (t) => t.includes('create group') || t.includes('new scheme') || t.includes('new chit') || t.includes('create chit') },
  { key: 'chits:edit', match: (t) => t.includes('edit chit') || t.includes('edit rules') || t.includes('edit group') || t.includes('bidding cap') },
  { key: 'chits:launch_month0', match: (t) => t.includes('launch month (organizer profit)') },
  { key: 'chits:reschedule_auction', match: (t) => t.includes('reschedule') || t.includes('postpone auction') },
  { key: 'chits:configure_laaba_seetu', match: (t) => t.includes('laaba seetu') || t.includes('free month') || t.includes('bonus discount pool') },
  { key: 'chits:swap_ticket', match: (t) => t.includes('swap ticket') || t.includes('swap / replace') || t.includes('replace ticket') || t.includes('swap member') },
  { key: 'chits:delete', match: (t) => t.includes('recycle bin') || t.includes('delete scheme') || t.includes('delete chit') || t.includes('archive scheme') || t.includes('delete / archive') },
  { key: 'chits:view', match: (t) => t.includes('view chit') || t.includes('scheme list') || t.includes('all schemes') },

  // 3. Members Directory Tab
  { key: 'members:enroll', match: (t) => t.includes('enroll') || t.includes('add member') || t.includes('new subscriber') || t.includes('register member') },
  { key: 'members:collect', match: (t) => t.includes('record payment') || t.includes('collect payment') || t.includes('quick collect') || t.includes('+ collect') || t.includes('pay installment') || t === 'record' },
  { key: 'members:edit', match: (t) => t.includes('edit member') || t.includes('edit information') || t.includes('edit profile') },
  { key: 'members:delete', match: (t) => t.includes('delete member') || t.includes('archive member') || t.includes('delete subscriber') },
  { key: 'members:suspend', match: (t) => t.includes('suspend') || t.includes('block member') || t.includes('lockout standing') || t.includes('in good standing') },
  { key: 'members:pair_qr', match: (t) => t.includes('pair qr') || t.includes('scan passbook') || t.includes('scan qr') || t.includes('link passbook') || t.includes('re-bind qr') },
  { key: 'members:revoke_qr', match: (t) => t.includes('revoke') || t.includes('lost booklet') || t.includes('unlink') || t.includes('unlink qr') },
  { key: 'members:batch_qr', match: (t) => t.includes('batch qr') || t.includes('print qr') || t.includes('qr sheets') || t.includes('print sticker') },
  { key: 'members:reset_mpin', match: (t) => t.includes('reset pin') || t.includes('reset mpin') || t.includes('default 1234') },
  { key: 'members:export', match: (t) => t.includes('export member') || t.includes('download roster') || t.includes('download members') },
  { key: 'members:waive_penalties', match: (t) => t.includes('waive fine') || t.includes('waive penalty') || t.includes('adjust dues') || t.includes('waive') },
  { key: 'members:view', match: (t) => t.includes('members directory') || t.includes('subscriber registry') || t.includes('view members') },

  // 4. Auctions & Bidding Tab
  { key: 'auctions:conduct', match: (t) => t.includes('start auction') || t.includes('conduct auction') || t.includes('live arena') || t.includes('begin live') || t.includes('begin auction') },
  { key: 'auctions:bid', match: (t) => t.includes('place bid') || t.includes('proxy bid') || t.includes('shout bid') || t.includes('shout') },
  { key: 'auctions:conclude', match: (t) => t.includes('declare winner') || t.includes('close auction') },
  { key: 'auctions:override_floor', match: (t) => t.includes('override') || t.includes('early live auction') || t.includes('floor limit') },
  { key: 'auctions:edit_historical', match: (t) => t.includes('edit past auction') || t.includes('fix auction') || t.includes('past auction results') },
  { key: 'auctions:disburse', match: (t) => t.includes('confirm & disburse') || t.includes('disburse pot') || t.includes('disburse payout') || t.includes('prize money') },
  { key: 'auctions:issue_receipt', match: (t) => t.includes('winner voucher') || t.includes('issue receipt') || t.includes('payout receipt') || t.includes('settlement receipt') },
  { key: 'auctions:view', match: (t) => t.includes('view live auction') || t.includes('live auction arena') || t.includes('auction countdown') },

  // 5. Treasury Tab
  { key: 'treasury:confirm_atm', match: (t) => t.includes('confirm atm') || t.includes('atm cash') || t.includes('atm withdrawal') },
  { key: 'treasury:personal_draw', match: (t) => t.includes('personal draw') || t.includes('log spend') || t.includes('cash spend') || t.includes('petty cash') },
  { key: 'treasury:move_money', match: (t) => t.includes('move money') || t.includes('bank transfer') || t.includes('inter-vault') || t.includes('relocation') },
  { key: 'treasury:reconcile', match: (t) => t.includes('count notes') || t.includes('denomination') || t.includes('reconcil') || t.includes('cash note counter') },
  { key: 'treasury:deposit', match: (t) => t.includes('deposit reserve') || t.includes('deposit owner') || t.includes('extra funds') },
  { key: 'treasury:recover_float', match: (t) => t.includes('collect field cash') || t.includes('recover float') || t.includes('staff float') },
  { key: 'treasury:settle_draw', match: (t) => t.includes('repay personal') || t.includes('settle draw') || t.includes('repay advance') },
  { key: 'treasury:delete_transaction', match: (t) => t.includes('delete transaction') || t.includes('cancel transaction') || t.includes('reverse payment') },
  { key: 'treasury:view_cash_box', match: (t) => t.includes('cash box') || t.includes('cash in hand') },
  { key: 'treasury:view_banks', match: (t) => t.includes('bank balances') || t.includes('kishor bank') || t.includes('dad bank') || t.includes('mom bank') },
  { key: 'treasury:collect_cash', match: (t) => t.includes('accept cash') || t.includes('receive cash') },
  { key: 'treasury:view', match: (t) => t.includes('all cash & bank') || t.includes('treasury balances') },

  // 6. Reports & Analytics Tab
  { key: 'reports:export_checklist', match: (t) => t.includes('checklist') || t.includes('print register') || t.includes('collection sheet') || t.includes('collection checklist') },
  { key: 'reports:export_audit', match: (t) => t.includes('export activity') || t.includes('download activity') || t.includes('export audit') },
  { key: 'reports:export_ledger', match: (t) => t.includes('passbook ledger') || t.includes('download passbook') || t.includes('statement pdf') },
  { key: 'reports:view_defaulters', match: (t) => t.includes('defaulter') || t.includes('overdue dues') || t.includes('unpaid installment') },
  { key: 'reports:view_audit_logs', match: (t) => t.includes('audit log') || t.includes('system activity') || t.includes('activity log') },
  { key: 'reports:view_pnl', match: (t) => t.includes('profit & loss') || t.includes('p&l') || t.includes('organizer earnings') },
  { key: 'reports:export', match: (t) => t.includes('download reports') || t.includes('export csv') || t.includes('export excel') },
  { key: 'reports:view', match: (t) => t.includes('reports & analytics') || t.includes('view reports') },

  // 7. Communication Tab
  { key: 'communication:broadcast', match: (t) => t.includes('broadcast') || t.includes('send receipt') || t.includes('whatsapp receipt') },
  { key: 'communication:due_alerts', match: (t) => t.includes('due reminder') || t.includes('send reminder') || t.includes('whatsapp alert') || t.includes('remind all') || t === 'remind' },
  { key: 'communication:pre_auction', match: (t) => t.includes('pre-auction') || t.includes('auction reminder') },
  { key: 'communication:post_auction', match: (t) => t.includes('post-auction') || t.includes('auction result') },
  { key: 'communication:custom', match: (t) => t.includes('custom message') || t.includes('custom announcement') },
  { key: 'communication:manage_templates', match: (t) => t.includes('message template') || t.includes('edit template') },
  { key: 'communication:view', match: (t) => t.includes('message history') || t.includes('view messages') },

  // 8. Roles & Staff Tab
  { key: 'system:manage_users', match: (t) => t.includes('member login') || t.includes('subscriber login') || t.includes('subscriber account') },
  { key: 'system:manage_staff', match: (t) => t.includes('staff account') || t.includes('staff directory') || t.includes('manage staff') },
  { key: 'system:manage_roles', match: (t) => t.includes('edit role') || t.includes('role permissions') || t.includes('manage roles') },

  // 9. Portal Settings Tab
  { key: 'system:branding', match: (t) => t.includes('branding') || t.includes('business name') || t.includes('logo') },
  { key: 'system:maintenance_mode', match: (t) => t.includes('maintenance') || t.includes('lock app') || t.includes('lockout') },
  { key: 'system:reset_database', match: (t) => t.includes('clear test data') || t.includes('factory reset') || t.includes('reset database') },
];

// Helper: Intelligent DOM Element Component Resolver
function resolveComponentFromDOM(
  el: HTMLElement,
  allowedTabs: MainTabId[],
  allowedActions: PermissionAction[]
): ComponentInfo | null {
  // Walk up parents (up to 6 levels) to find nearest recognizable component container or button
  let cur: HTMLElement | null = el;
  let steps = 0;

  while (cur && steps < 6 && cur !== cur.ownerDocument?.body) {
    // 1. Direct permission key attribute (Highest Priority)
    const attrKey = cur.getAttribute('data-permission-key') || cur.getAttribute('data-action-key') || cur.getAttribute('data-action');
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
    const isClickable = cur.tagName === 'BUTTON' || cur.tagName === 'A' || cur.getAttribute('role') === 'button' || cur.classList.contains('cursor-pointer') || cur.onclick !== null;
    const rawText = (cur.innerText || cur.textContent || cur.getAttribute('aria-label') || cur.getAttribute('title') || '').trim();

    if (isClickable && rawText.length > 0) {
      const lower = rawText.toLowerCase();

      // Check against granular action match rules
      for (const rule of ACTION_MATCH_RULES) {
        if (rule.match(lower)) {
          const a = ALL_ACTIONS.find((x) => x.key === rule.key);
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
      }

      // Check against navigation tab labels
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

    // Mirror HTML & Body classes / inline styles from parent window (for Next.js font variables & dark/light theme)
    if (document.documentElement.className && doc.documentElement.className !== document.documentElement.className) {
      doc.documentElement.className = document.documentElement.className;
    }
    if (document.body.className && doc.body.className !== document.body.className) {
      doc.body.className = document.body.className;
    }
    const htmlStyle = document.documentElement.getAttribute('style');
    if (htmlStyle) {
      doc.documentElement.setAttribute('style', htmlStyle);
    }

    // Copy all style and link tags from main window
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      const href = (node as any).href || (node as any).getAttribute?.('data-href') || node.textContent?.slice(0, 80);
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

  // Handle Figma-like inspection hover, click, and event forwarding inside iframe
  useEffect(() => {
    if (!iframeDoc) return;

    // 1. Forward mouse and touch movement to parent window so drag sliders (like SlideToConfirm) never lose tracking
    const forwardMouseEvent = (e: MouseEvent) => {
      if (e.target !== iframeDoc.body && e.target !== iframeDoc.documentElement) {
        window.dispatchEvent(new MouseEvent(e.type, {
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          bubbles: true,
          cancelable: true,
        }));
      }
    };

    const forwardTouchEvent = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        window.dispatchEvent(new TouchEvent(e.type, {
          touches: Array.from(e.touches) as any,
          targetTouches: Array.from(e.targetTouches) as any,
          changedTouches: Array.from(e.changedTouches) as any,
          bubbles: true,
          cancelable: true,
        }));
      }
    };

    iframeDoc.addEventListener('mousemove', forwardMouseEvent, { passive: true });
    iframeDoc.addEventListener('mouseup', forwardMouseEvent, { passive: true });
    iframeDoc.addEventListener('touchmove', forwardTouchEvent, { passive: true });
    iframeDoc.addEventListener('touchend', forwardTouchEvent, { passive: true });

    if (canvasTool === 'inspect') {
      iframeDoc.body.classList.add('cf-inspect-active');
    } else {
      iframeDoc.body.classList.remove('cf-inspect-active');
      setHoveredComponent(null);
      return () => {
        iframeDoc.removeEventListener('mousemove', forwardMouseEvent);
        iframeDoc.removeEventListener('mouseup', forwardMouseEvent);
        iframeDoc.removeEventListener('touchmove', forwardTouchEvent);
        iframeDoc.removeEventListener('touchend', forwardTouchEvent);
      };
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

    const handleScroll = () => {
      if (currentHighlightedEl) {
        const r = currentHighlightedEl.getBoundingClientRect();
        setHoveredComponent((prev) => prev ? {
          ...prev,
          rect: {
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          },
        } : null);
      }
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
    iframeDoc.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    iframeDoc.addEventListener('click', handleClick, true);

    return () => {
      if (currentHighlightedEl) {
        currentHighlightedEl.classList.remove('cf-figma-highlight');
      }
      iframeDoc.removeEventListener('mousemove', forwardMouseEvent);
      iframeDoc.removeEventListener('mouseup', forwardMouseEvent);
      iframeDoc.removeEventListener('touchmove', forwardTouchEvent);
      iframeDoc.removeEventListener('touchend', forwardTouchEvent);
      iframeDoc.removeEventListener('mouseover', handleMouseOver);
      iframeDoc.removeEventListener('mouseleave', handleMouseLeave);
      iframeDoc.removeEventListener('scroll', handleScroll, true);
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
            top: `${hoveredComponent.rect.top < 44 ? hoveredComponent.rect.top + (hoveredComponent.rect.height || 36) + 8 : Math.max(8, hoveredComponent.rect.top - 36)}px`,
            left: `${Math.max(8, Math.min(hoveredComponent.rect.left, (iframeRef.current?.clientWidth || 390) - 290))}px`,
            maxWidth: 'calc(100% - 16px)',
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
  const [allRoles, setAllRoles] = useState<CustomRoleRecord[]>(DEFAULT_SYSTEM_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(initialRoleId);
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('mobile');
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('navigate');
  const [ghostMode, setGhostMode] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
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

  // Bulk enable all actions in category
  const handleEnableAllCategoryActions = (items: ActionMeta[]) => {
    triggerHapticFeedback('light');
    setAllowedActions((prev) => {
      const keys = items.map((i) => i.key);
      const set = new Set([...prev, ...keys]);
      return Array.from(set);
    });
    setToastMessage({ text: `Enabled all actions in section`, isRestore: true });
  };

  // Bulk clear all actions in category
  const handleClearCategoryActions = (items: ActionMeta[]) => {
    triggerHapticFeedback('light');
    setAllowedActions((prev) => {
      const keys = new Set(items.map((i) => i.key));
      return prev.filter((k) => !keys.has(k));
    });
    setToastMessage({ text: `Disabled actions in section`, isRestore: false });
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
                                    role="switch"
                                    aria-checked={isEnabled}
                                    aria-label={isEnabled ? `Disable ${tab.label} Tab` : `Enable ${tab.label} Tab`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleTab(tab.id);
                                    }}
                                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 p-0.5 cursor-pointer ${
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
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">
                                      {category}
                                    </span>
                                    {tabId && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleTab(tabId)}
                                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer shrink-0 ${
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
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isTabEnabled && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleEnableAllCategoryActions(items)}
                                          className="text-[9px] font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                          title="Enable all actions under this category"
                                        >
                                          All
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleClearCategoryActions(items)}
                                          className="text-[9px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                          title="Clear all actions under this category"
                                        >
                                          Clear
                                        </button>
                                      </div>
                                    )}
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {enabledCount}/{items.length} active
                                    </span>
                                  </div>
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
                                            role="switch"
                                            aria-checked={isEnabled}
                                            aria-label={isEnabled ? `Disable ${act.label}` : `Enable ${act.label}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleAction(act.key);
                                            }}
                                            className={`w-8 h-4.5 rounded-full transition-colors relative shrink-0 p-0.5 cursor-pointer ${
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
