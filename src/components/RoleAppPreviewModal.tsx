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
  ArrowRight
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
  { key: 'members:view', label: 'View Member Directory', desc: 'Browse subscriber roster, passbook tokens & contact details', category: 'Member Operations', icon: Users },
  { key: 'members:enroll', label: 'Enroll New Subscriber', desc: 'Register member profiles and allocate chit scheme tickets', category: 'Member Operations', icon: Plus },
  { key: 'members:edit', label: 'Edit Member Details', desc: 'Update mobile numbers, names, addresses and notes', category: 'Member Operations', icon: Settings },
  { key: 'members:collect', label: 'Collect Installment Payment', desc: 'Post cash, UPI or bank installments and issue digital receipts', category: 'Member Operations', icon: Coins },
  { key: 'members:suspend', label: 'Suspend / Lockout Standing', desc: 'Temporarily lock subscriber portal access', category: 'Member Operations', icon: Lock },
  { key: 'members:pair_qr', label: 'Pair Passbook QR Code', desc: 'Link physical passbook barcode to member account', category: 'Member Operations', icon: Zap },
  { key: 'members:revoke_qr', label: 'Revoke Passbook QR', desc: 'Unlink lost passbook sticker', category: 'Member Operations', icon: Undo2 },
  { key: 'members:batch_qr', label: 'Print Passbook QR Batches', desc: 'Generate printable QR sticker sheets', category: 'Member Operations', icon: Layers },
  { key: 'members:reset_mpin', label: 'Reset Security MPIN', desc: 'Restore member 4-digit PIN to default 1234', category: 'Member Operations', icon: RotateCcw },
  { key: 'members:export', label: 'Export Member Roster', desc: 'Download CSV / Excel member reports', category: 'Member Operations', icon: ArrowRight },
  { key: 'members:delete', label: 'Archive / Delete Member', desc: 'Soft-delete subscriber profile while preserving ledger', category: 'Member Operations', icon: Trash2 },

  // Chit Scheme Lifecycle
  { key: 'chits:view', label: 'View Chit Schemes', desc: 'View running groups, duration and totals', category: 'Chit Schemes', icon: Briefcase },
  { key: 'chits:create', label: 'Create New Chit Group', desc: 'Define chit value, duration & member count', category: 'Chit Schemes', icon: Plus },
  { key: 'chits:edit', label: 'Modify Scheme Rules', desc: 'Update auction date, time & schedule rules', category: 'Chit Schemes', icon: Settings },
  { key: 'chits:launch_month0', label: 'Execute Month 0 Launch', desc: 'Allocate full collection pool as Organizer Profit', category: 'Chit Schemes', icon: Sparkles },
  { key: 'chits:reschedule_auction', label: 'Reschedule Auction Date', desc: 'Postpone auction and dispatch WhatsApp alerts', category: 'Chit Schemes', icon: Calendar },
  { key: 'chits:configure_laaba_seetu', label: 'Configure Laaba Seetu Rules', desc: 'Define member profit free installment threshold', category: 'Chit Schemes', icon: DollarSign },
  { key: 'chits:delete', label: 'Delete Chit Group', desc: 'Archive completed or cancelled scheme', category: 'Chit Schemes', icon: Trash2 },

  // Live Auctions & Bidding
  { key: 'auctions:view', label: 'View Auction Floor', desc: 'Watch live bidding stream and floor stats', category: 'Floor Auctions', icon: Gavel },
  { key: 'auctions:conduct', label: 'Conduct Monthly Auction', desc: 'Start live countdown and manage floor timer', category: 'Floor Auctions', icon: Zap },
  { key: 'auctions:bid', label: 'Record Shouted Bids', desc: 'Log proxy discount bids on behalf of attendees', category: 'Floor Auctions', icon: Plus },
  { key: 'auctions:conclude', label: 'Conclude & Award Pot', desc: 'Lock highest discount and advance group cycle', category: 'Floor Auctions', icon: CheckCircle2 },
  { key: 'auctions:override_floor', label: 'Override Floor Discount', desc: 'Administrative discount floor override', category: 'Floor Auctions', icon: Sliders },
  { key: 'auctions:disburse', label: 'Disburse Prize Pot', desc: 'Pay winning subscriber prize from bank/cash', category: 'Floor Auctions', icon: Landmark },
  { key: 'auctions:issue_receipt', label: 'Issue Auction Voucher', desc: 'Export PDF auction voucher and winner receipt', category: 'Floor Auctions', icon: Check },

  // Treasury Multi-Vaults
  { key: 'treasury:view', label: 'View Global Treasury', desc: 'View combined balances of all 4 payment vaults', category: 'Multi-Vault Treasury', icon: Vault },
  { key: 'treasury:view_cash_box', label: 'View Physical Cash Box', desc: 'Inspect safe cash in hand and float cash', category: 'Multi-Vault Treasury', icon: Coins },
  { key: 'treasury:view_banks', label: 'View Private Bank Accounts', desc: 'Inspect Kishor Bank, Dad Bank and Mom Bank', category: 'Multi-Vault Treasury', icon: Landmark },
  { key: 'treasury:collect_cash', label: 'Collect Cash Into Safe', desc: 'Field cash inflow into Cash Box', category: 'Multi-Vault Treasury', icon: Plus },
  { key: 'treasury:move_money', label: 'Inter-Vault Transfer', desc: 'Move funds between banks and cash box', category: 'Multi-Vault Treasury', icon: ArrowRight },
  { key: 'treasury:confirm_atm', label: 'Confirm ATM Relocation', desc: 'Verify physical cash notes in safe after bank debit', category: 'Multi-Vault Treasury', icon: CheckCircle2 },
  { key: 'treasury:deposit', label: 'Deposit Reserve Cash', desc: 'Deposit external owner cash float into vaults', category: 'Multi-Vault Treasury', icon: Plus },
  { key: 'treasury:recover_float', label: 'Return Reserve Float', desc: 'Withdraw repaid reserve money back to owner', category: 'Multi-Vault Treasury', icon: RotateCcw },
  { key: 'treasury:personal_draw', label: 'Log Personal Draw', desc: 'Record personal expense or cash rotation with tags', category: 'Multi-Vault Treasury', icon: DollarSign },
  { key: 'treasury:settle_draw', label: 'Settle Personal Debt', desc: 'Record repayment of personal draw back to safe', category: 'Multi-Vault Treasury', icon: Check },
  { key: 'treasury:reconcile', label: 'Physical Cash Audit Reconcile', desc: 'Physical currency denomination count reconciliation', category: 'Multi-Vault Treasury', icon: Layers },

  // Communication & Broadcaster
  { key: 'communication:view', label: 'View Broadcaster Desk', desc: 'Browse WhatsApp templates and dispatched logs', category: 'Communication', icon: MessageSquare },
  { key: 'communication:broadcast', label: 'Dispatch WhatsApp Broadcast', desc: 'Send bulk WhatsApp reminders and notices', category: 'Communication', icon: Send },
  { key: 'communication:pre_auction', label: 'Pre-Auction Notice Dispatch', desc: 'Send 24h floor auction meeting notices', category: 'Communication', icon: Calendar },
  { key: 'communication:post_auction', label: 'Post-Auction Summary Dispatch', desc: 'Broadcast winner details and next due amount', category: 'Communication', icon: MessageSquare },
  { key: 'communication:due_alerts', label: 'Send Overdue Reminder Alerts', desc: 'Dispatch payment due notifications to defaulters', category: 'Communication', icon: AlertTriangle },
  { key: 'communication:custom', label: 'Compose Custom Broadcast', desc: 'Free-form WhatsApp broadcast message dispatch', category: 'Communication', icon: MessageSquare },
  { key: 'communication:manage_templates', label: 'Edit Message Templates', desc: 'Create and update reusable WhatsApp scripts', category: 'Communication', icon: Settings },

  // Reports & Auditing
  { key: 'reports:view', label: 'View Reports Center', desc: 'View monthly statements and balance sheets', category: 'Reports & Auditing', icon: BarChart3 },
  { key: 'reports:view_pnl', label: 'View Profit & Loss / Earnings', desc: 'Organizer profit and discount pool reserves', category: 'Reports & Auditing', icon: DollarSign },
  { key: 'reports:export', label: 'Export General Reports', desc: 'Download CSV / Excel reports for CA audit', category: 'Reports & Auditing', icon: ArrowRight },
  { key: 'reports:export_checklist', label: 'Generate Offline Printable Checklist', desc: 'Print physical collection register booklet', category: 'Reports & Auditing', icon: Layers },
  { key: 'reports:export_ledger', label: 'Export Full Cash Ledger', desc: 'Export physical passbook and transaction statements', category: 'Reports & Auditing', icon: BarChart3 },
  { key: 'reports:view_defaulters', label: 'View Defaulters & Arrears', desc: 'View outstanding balance list across all chits', category: 'Reports & Auditing', icon: AlertTriangle },
  { key: 'reports:view_audit_logs', label: 'View Security Audit Trail', desc: 'Inspect immutable administrative action log', category: 'Reports & Auditing', icon: Shield },
  { key: 'reports:export_audit', label: 'Export Security Audit Logs', desc: 'Export administrative tamper-proof audit trail', category: 'Reports & Auditing', icon: ArrowRight },

  // System Administration
  { key: 'system:manage_users', label: 'Manage Subscriber Accounts', desc: 'Provision and unblock subscriber credentials', category: 'System Governance', icon: Users },
  { key: 'system:manage_staff', label: 'Manage Staff Access Accounts', desc: 'Invite staff members and assign operational roles', category: 'System Governance', icon: ShieldCheck },
  { key: 'system:manage_roles', label: 'Create & Modify Security Roles', desc: 'Create custom roles and fine-tune permissions', category: 'System Governance', icon: Sliders },
  { key: 'system:maintenance_mode', label: 'Toggle Maintenance Lockout', desc: 'Emergency lockout of subscriber portal', category: 'System Governance', icon: Lock },
  { key: 'system:branding', label: 'Configure Branding & Logo', desc: 'Customize company title, tagline, and initials', category: 'System Governance', icon: Sparkles },
  { key: 'system:reset_database', label: 'Factory Reset & Data Purge', desc: 'Emergency wipe of test data and balance reset', category: 'System Governance', icon: Trash2 },
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
      if (lower.includes('record payment') || lower.includes('collect payment') || lower.includes('quick collect') || lower.includes('+ collect') || lower.includes('pay installment')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:collect')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Member Enrollment
      if (lower.includes('enroll') || lower.includes('add member') || lower.includes('new subscriber') || lower.includes('register member')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:enroll')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // QR Passbook Pairing
      if (lower.includes('pair qr') || lower.includes('scan passbook') || lower.includes('scan qr') || lower.includes('link passbook')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:pair_qr')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Batch QR Printing
      if (lower.includes('batch qr') || lower.includes('print qr') || lower.includes('qr sheets')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:batch_qr')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Reset MPIN
      if (lower.includes('reset pin') || lower.includes('reset mpin')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:reset_mpin')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Export Members
      if (lower.includes('export member') || lower.includes('export csv') || lower.includes('download roster')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'members:export')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Launch Month 0
      if (lower.includes('month 0') || lower.includes('launch month') || lower.includes('organizer profit')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'chits:launch_month0')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Reschedule Auction
      if (lower.includes('reschedule') || lower.includes('postpone auction')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'chits:reschedule_auction')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Auction Start / Conduct
      if (lower.includes('start auction') || lower.includes('conduct auction') || lower.includes('live arena')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'auctions:conduct')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Place Proxy Bid
      if (lower.includes('place bid') || lower.includes('proxy bid') || lower.includes('shout bid')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'auctions:bid')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Conclude Auction
      if (lower.includes('conclude') || lower.includes('award pot') || lower.includes('advance month')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'auctions:conclude')!;
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

      // WhatsApp Broadcast
      if (lower.includes('broadcast') || lower.includes('send reminder') || lower.includes('whatsapp alert')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'communication:broadcast')!;
        return { type: 'action', key: a.key, name: a.label, category: a.category, desc: a.desc, icon: a.icon, isEnabled: allowedActions.includes(a.key), targetEl: cur };
      }

      // Printable Checklist Booklet
      if (lower.includes('checklist') || lower.includes('print register') || lower.includes('collection sheet')) {
        const a = ALL_ACTIONS.find((x) => x.key === 'reports:export_checklist')!;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 md:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full h-full max-w-[1760px] bg-slate-900 border border-slate-700/80 rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* ── TOP COCKPIT BAR: Tool Switcher, Role Selector, Device Viewport, Save Controls ── */}
        <header className="h-16 px-4 sm:px-6 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between shrink-0 z-30 gap-3">
          
          {/* Left: Brand & Canvas Tool Mode Switcher (Figma Style) */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-brand-500/20 shrink-0">
              <Eye size={18} />
            </div>

            <div className="flex flex-col min-w-0 mr-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5 truncate">
                  UI Role Studio &amp; Configurator
                </span>
                <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/30">
                  <Sparkles size={10} /> Live Realtime Preview
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Interactive preview &amp; visual component editor
              </p>
            </div>

            {/* FIGMA CANVAS TOOL SWITCHER: Navigate vs Select & Edit */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCanvasTool('navigate');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  canvasTool === 'navigate'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Navigate & Test App Mode (Shortcut: V)"
              >
                <MousePointer size={14} />
                <span className="hidden md:inline">Navigate &amp; Test</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCanvasTool('inspect');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  canvasTool === 'inspect'
                    ? 'bg-purple-600 text-white shadow-xs animate-pulse'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Select & Edit Component Mode (Shortcut: C)"
              >
                <Crosshair size={14} />
                <span className="hidden md:inline">Select &amp; Edit</span>
              </button>
            </div>
          </div>

          {/* Center: Live Role Switcher Dropdown & Viewport Switcher */}
          <div className="flex items-center gap-2.5">
            {/* Role Switcher */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1">
              <span className="text-xs text-slate-400 font-medium mr-1.5 hidden lg:inline">Role:</span>
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
                  setViewportMode('mobile');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewportMode === 'mobile'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Real Mobile Smartphone Frame (390px)"
              >
                <Smartphone size={14} />
                <span className="hidden sm:inline">Mobile Frame</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewportMode('desktop');
                  triggerHapticFeedback('light');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewportMode === 'desktop'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Desktop View (Full Width)"
              >
                <Monitor size={14} />
                <span className="hidden sm:inline">Desktop</span>
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
              <span className="hidden md:inline">Inspector</span>
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

        {/* ── MAIN WORKSPACE: Live App Canvas (Center) + Inspector Panel (Right) ── */}
        <div className="flex-1 flex min-h-0 relative overflow-hidden bg-slate-950">
          
          {/* 1. APP CANVAS AREA */}
          <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] relative">
            
            {/* Quick Canvas Mode Indicator Banner */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-full px-3.5 py-1 text-xs flex items-center gap-2 shadow-lg select-none">
              {canvasTool === 'inspect' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  <span className="text-purple-300 font-bold">Select &amp; Edit Mode:</span>
                  <span className="text-slate-300 text-[11px]">Hover over any button or section to highlight and click to turn on/off</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-300 font-bold">Navigate &amp; Test Mode:</span>
                  <span className="text-slate-300 text-[11px]">Interact with the live application exactly as field staff</span>
                </>
              )}
            </div>

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

            {/* REAL MOBILE SMARTPHONE FRAME (Authentic 390px Viewport) */}
            {viewportMode === 'mobile' && (
              <div className="relative w-[390px] h-[812px] max-h-[92vh] bg-slate-900 rounded-[50px] p-3 shadow-2xl border-4 border-slate-700 flex flex-col overflow-hidden shrink-0">
                
                {/* Dynamic Island / Speaker Notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-40 flex items-center justify-center select-none pointer-events-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900 mr-2" />
                  <div className="w-2 h-2 rounded-full bg-blue-900/60" />
                </div>

                {/* Inner Screen */}
                <div className="w-full h-full bg-slate-50 rounded-[40px] overflow-hidden flex flex-col relative">
                  
                  {/* Status Bar */}
                  <div className="h-8 bg-white/95 backdrop-blur-md px-6 pt-1 flex items-center justify-between text-[11px] font-bold text-slate-800 shrink-0 select-none z-30 border-b border-slate-100">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span>5G</span>
                      <div className="w-5 h-2.5 border border-slate-800 rounded-xs p-0.5">
                        <div className="h-full w-3/4 bg-slate-800 rounded-xs" />
                      </div>
                    </div>
                  </div>

                  {/* App Screen in Isolated Frame (True 390px viewport width) */}
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
                        </div>
                      </IsolatedPreviewFrame>
                    </RolePreviewAuthProvider>
                  </div>

                  {/* Home Indicator Bar */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-400 rounded-full z-40 pointer-events-none" />
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

          {/* 2. RIGHT-SIDE INSPECTOR DRAWER / CONTROLS PANEL */}
          {isInspectorOpen && (
            <aside className="w-full sm:w-[440px] bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-30 shadow-xl overflow-hidden animate-in slide-in-from-right duration-200">
              
              {/* Inspector Header with Subtabs */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/70">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs">
                    <Sliders size={14} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Controls Inspector</h3>
                    <p className="text-[11px] text-slate-400">Live app permission &amp; component state</p>
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

              {/* Inspector Subtabs: All Controls vs Hidden Components */}
              <div className="px-4 pt-3 pb-2 border-b border-slate-800 flex items-center gap-2 bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setInspectorSubtab('controls')}
                  className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    inspectorSubtab === 'controls'
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
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
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <EyeOff size={13} />
                  <span>Hidden Components</span>
                  {totalHiddenCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950 text-rose-200 font-mono font-bold">
                      {totalHiddenCount}
                    </span>
                  )}
                </button>
              </div>

              {/* ── SUBTAB 1: ALL CONTROLS & TOGGLE SWITCHES ── */}
              {inspectorSubtab === 'controls' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Filter Pills & Search */}
                  <div className="p-3 border-b border-slate-800 space-y-2 bg-slate-900 shrink-0">
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
                    
                    {/* Primary Tabs Section */}
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

                    {/* Categorized Action Permissions Section */}
                    {(inspectorFilter === 'all' || inspectorFilter === 'actions') && (
                      <div className="space-y-6">
                        {actionsByCategory.map(([category, items]) => {
                          const enabledCount = items.filter((i) => allowedActions.includes(i.key)).length;
                          return (
                            <div key={category} className="space-y-2.5">
                              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                  {category}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {enabledCount}/{items.length} active
                                </span>
                              </div>

                              <div className="space-y-2">
                                {items.map((act) => {
                                  const Icon = act.icon;
                                  const isEnabled = allowedActions.includes(act.key);
                                  return (
                                    <div
                                      key={act.key}
                                      onClick={() => handleToggleAction(act.key)}
                                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                        isEnabled
                                          ? 'bg-slate-950/40 border-slate-700/80 hover:border-brand-500/50'
                                          : 'bg-slate-950/60 border-slate-850 opacity-50 hover:opacity-90'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                            isEnabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
                                          }`}
                                        >
                                          <Icon size={14} />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-bold text-white truncate">
                                              {act.label}
                                            </span>
                                            <span className="text-[9px] font-mono text-slate-500">
                                              {act.key}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{act.desc}</p>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        className={`w-8 h-4.5 rounded-full transition-colors relative shrink-0 p-0.5 ${
                                          isEnabled ? 'bg-brand-600' : 'bg-slate-700'
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
                          );
                        })}
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* ── SUBTAB 2: DEDICATED HIDDEN COMPONENTS & RESTORE LIST ── */}
              {inspectorSubtab === 'hidden' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  
                  {/* Top Action Bar: Restore All */}
                  <div className="p-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                      <EyeOff size={13} />
                      {totalHiddenCount} Component{totalHiddenCount === 1 ? '' : 's'} Disabled
                    </span>

                    {totalHiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={handleRestoreAllComponents}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title="Re-enable all tabs and action permissions"
                      >
                        <RotateCcw size={11} />
                        <span>Restore All</span>
                      </button>
                    )}
                  </div>

                  {/* List of Turned-Off / Hidden Elements */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    
                    {totalHiddenCount === 0 ? (
                      <div className="text-center py-16 px-4 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                          <ShieldCheck size={24} />
                        </div>
                        <h4 className="font-bold text-sm text-white">All UI Components Active</h4>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                          No buttons, tabs, or features are currently hidden for this role. Use the canvas cursor in <strong>Select &amp; Edit</strong> mode to click and hide any button.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* 1. Hidden Primary Tabs */}
                        {hiddenTabs.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                              Hidden Screen Tabs ({hiddenTabs.length})
                            </span>
                            <div className="space-y-2">
                              {hiddenTabs.map((t) => {
                                const Icon = t.icon;
                                return (
                                  <div
                                    key={t.id}
                                    className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/30 flex items-center justify-between gap-3 shadow-sm hover:border-rose-500/60 transition-all"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                                        <Icon size={16} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs font-bold text-white truncate">{t.label}</span>
                                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 font-mono">
                                            tab:{t.id}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{t.desc}</p>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleTab(t.id)}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
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
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                              Hidden Actions &amp; Buttons ({hiddenActions.length})
                            </span>
                            <div className="space-y-2">
                              {hiddenActions.map((a) => {
                                const Icon = a.icon;
                                return (
                                  <div
                                    key={a.key}
                                    className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/30 flex items-center justify-between gap-3 shadow-sm hover:border-rose-500/60 transition-all"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                                        <Icon size={16} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-xs font-bold text-white truncate">{a.label}</span>
                                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                            {a.key}
                                          </span>
                                        </div>
                                        <span className="text-[9px] font-semibold text-rose-400/90 block">
                                          {a.category}
                                        </span>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{a.desc}</p>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleAction(a.key)}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
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
              <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 text-xs">
                <span className="text-[11px] text-slate-400">
                  {allowedTabs.length} tabs · {allowedActions.length} actions enabled
                </span>
                <button
                  type="button"
                  onClick={handleSaveAndBroadcast}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  Save &amp; Broadcast
                </button>
              </div>

            </aside>
          )}

        </div>

      </div>
    </div>
  );
}
