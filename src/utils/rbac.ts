import { UserRole } from '@/context/AuthContext';
import { CashHandlingSubtab } from '@/components/CashVaultLedger';

export type MainTabId = 
  | 'dashboard' 
  | 'chits' 
  | 'members' 
  | 'communication' 
  | 'auctions' 
  | 'reports' 
  | 'cash'
  | 'users'
  | 'settings';

export type PermissionAction =
  // ── Overview & Dashboard Controls ──
  | 'dashboard:view_kpis'
  | 'dashboard:quick_actions'
  | 'dashboard:launch_month0'
  | 'dashboard:advance_month'
  | 'dashboard:revert_month'
  | 'dashboard:view_reserves'

  // ── Member & Passbook Logistics ──
  | 'members:view'
  | 'members:enroll'
  | 'members:edit'
  | 'members:collect'
  | 'members:waive_penalties'
  | 'members:suspend'
  | 'members:pair_qr'
  | 'members:revoke_qr'
  | 'members:batch_qr'
  | 'members:reset_mpin'
  | 'members:export'
  | 'members:delete'

  // ── Chit Scheme Lifecycle & Governance ──
  | 'chits:view'
  | 'chits:create'
  | 'chits:edit'
  | 'chits:launch_month0'
  | 'chits:reschedule_auction'
  | 'chits:configure_laaba_seetu'
  | 'chits:swap_ticket'
  | 'chits:delete'

  // ── Live Floor Auctions & Bidding Engine ──
  | 'auctions:view'
  | 'auctions:conduct'
  | 'auctions:bid'
  | 'auctions:conclude'
  | 'auctions:override_floor'
  | 'auctions:edit_historical'
  | 'auctions:disburse'
  | 'auctions:issue_receipt'

  // ── Treasury & Financial Multi-Vaults ──
  | 'treasury:view'
  | 'treasury:view_cash_box'
  | 'treasury:view_banks'
  | 'treasury:collect_cash'
  | 'treasury:move_money'
  | 'treasury:confirm_atm'
  | 'treasury:deposit'
  | 'treasury:recover_float'
  | 'treasury:personal_draw'
  | 'treasury:settle_draw'
  | 'treasury:delete_transaction'
  | 'treasury:reconcile'

  // ── Communication & WhatsApp Broadcaster ──
  | 'communication:view'
  | 'communication:broadcast'
  | 'communication:pre_auction'
  | 'communication:post_auction'
  | 'communication:due_alerts'
  | 'communication:custom'
  | 'communication:manage_templates'

  // ── Reports, P&L & Compliance Auditing ──
  | 'reports:view'
  | 'reports:view_pnl'
  | 'reports:export'
  | 'reports:export_checklist'
  | 'reports:export_ledger'
  | 'reports:view_defaulters'
  | 'reports:view_audit_logs'
  | 'reports:export_audit'

  // ── System Governance & Security Controls ──
  | 'system:manage_users'
  | 'system:manage_staff'
  | 'system:manage_roles'
  | 'system:maintenance_mode'
  | 'system:branding'
  | 'system:reset_database';

export interface CustomRoleRecord {
  id: string;
  name: string;
  description?: string;
  color?: string;
  is_system?: boolean;
  is_privileged?: boolean;
  allowed_tabs?: string[];
  allowed_actions?: string[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Tab Accessibility Matrix by Default System Role
 */
export const TAB_PERMISSIONS: Record<MainTabId, string[]> = {
  dashboard: ['admin', 'manager', 'collections_agent', 'auction_clerk', 'auditor', 'subscriber'],
  chits: ['admin', 'manager', 'auction_clerk', 'auditor', 'subscriber'],
  members: ['admin', 'manager', 'collections_agent', 'subscriber'],
  communication: ['admin', 'manager', 'collections_agent'],
  auctions: ['admin', 'manager', 'auction_clerk', 'subscriber'],
  reports: ['admin', 'auditor'],
  cash: ['admin'],
  users: ['admin'],
  settings: ['admin'],
};

/**
 * Treasury Subtab Accessibility Matrix by Default System Role
 * Private bank accounts and vault ledger are restricted to business owner/admin.
 */
export const TREASURY_SUBTAB_PERMISSIONS: Record<CashHandlingSubtab, string[]> = {
  overview: ['admin'],
  wallets: ['admin'],
  transfers: ['admin'],
  spends: ['admin'],
  denominations: ['admin'],
  ledger: ['admin'],
};

/**
 * Granular Action Permission Matrix by Default System Role
 */
export const ACTION_PERMISSIONS: Record<PermissionAction, string[]> = {
  // ── Overview & Dashboard Controls ──
  'dashboard:view_kpis': ['admin', 'manager', 'auditor'],
  'dashboard:quick_actions': ['admin', 'manager', 'collections_agent'],
  'dashboard:launch_month0': ['admin'],
  'dashboard:advance_month': ['admin', 'manager'],
  'dashboard:revert_month': ['admin'],
  'dashboard:view_reserves': ['admin', 'manager', 'auditor'],

  // ── Member & Passbook Logistics ──
  'members:view': ['admin', 'manager', 'collections_agent', 'auditor', 'subscriber'],
  'members:enroll': ['admin', 'manager'],
  'members:edit': ['admin', 'manager'],
  'members:collect': ['admin', 'manager', 'collections_agent'],
  'members:waive_penalties': ['admin'],
  'members:suspend': ['admin', 'manager'],
  'members:pair_qr': ['admin', 'manager', 'collections_agent'],
  'members:revoke_qr': ['admin', 'manager'],
  'members:batch_qr': ['admin', 'manager'],
  'members:reset_mpin': ['admin', 'manager'],
  'members:export': ['admin', 'manager', 'auditor'],
  'members:delete': ['admin'],

  // ── Chit Scheme Lifecycle & Governance ──
  'chits:view': ['admin', 'manager', 'auction_clerk', 'auditor', 'subscriber'],
  'chits:create': ['admin'],
  'chits:edit': ['admin', 'manager'],
  'chits:launch_month0': ['admin'],
  'chits:reschedule_auction': ['admin', 'manager'],
  'chits:configure_laaba_seetu': ['admin'],
  'chits:swap_ticket': ['admin', 'manager'],
  'chits:delete': ['admin'],

  // ── Live Floor Auctions & Bidding Engine ──
  'auctions:view': ['admin', 'manager', 'auction_clerk', 'auditor', 'subscriber'],
  'auctions:conduct': ['admin', 'manager'],
  'auctions:bid': ['admin', 'manager', 'auction_clerk', 'subscriber'],
  'auctions:conclude': ['admin', 'manager'],
  'auctions:override_floor': ['admin'],
  'auctions:edit_historical': ['admin'],
  'auctions:disburse': ['admin', 'manager'],
  'auctions:issue_receipt': ['admin', 'manager', 'auction_clerk'],

  // ── Treasury & Financial Multi-Vaults ──
  'treasury:view': ['admin', 'auditor'],
  'treasury:view_cash_box': ['admin', 'manager', 'auditor'],
  'treasury:view_banks': ['admin'],
  'treasury:collect_cash': ['admin', 'manager', 'collections_agent'],
  'treasury:move_money': ['admin'],
  'treasury:confirm_atm': ['admin'],
  'treasury:deposit': ['admin'],
  'treasury:recover_float': ['admin', 'manager'],
  'treasury:personal_draw': ['admin'],
  'treasury:settle_draw': ['admin'],
  'treasury:delete_transaction': ['admin'],
  'treasury:reconcile': ['admin'],

  // ── Communication & WhatsApp Broadcaster ──
  'communication:view': ['admin', 'manager', 'collections_agent'],
  'communication:broadcast': ['admin', 'manager', 'collections_agent'],
  'communication:pre_auction': ['admin', 'manager'],
  'communication:post_auction': ['admin', 'manager'],
  'communication:due_alerts': ['admin', 'manager', 'collections_agent'],
  'communication:custom': ['admin', 'manager'],
  'communication:manage_templates': ['admin', 'manager'],

  // ── Reports, P&L & Compliance Auditing ──
  'reports:view': ['admin', 'auditor'],
  'reports:view_pnl': ['admin', 'auditor'],
  'reports:export': ['admin', 'auditor'],
  'reports:export_checklist': ['admin', 'manager', 'collections_agent', 'auditor'],
  'reports:export_ledger': ['admin', 'manager', 'auditor'],
  'reports:view_defaulters': ['admin', 'manager', 'auditor'],
  'reports:view_audit_logs': ['admin', 'auditor'],
  'reports:export_audit': ['admin', 'auditor'],

  // ── System Governance & Security Controls ──
  'system:manage_users': ['admin'],
  'system:manage_staff': ['admin'],
  'system:manage_roles': ['admin'],
  'system:maintenance_mode': ['admin'],
  'system:branding': ['admin'],
  'system:reset_database': ['admin'],
};

/**
 * Helper to check if a user role can access a primary tab
 */
export function canAccessTab(role: UserRole | undefined, tab: MainTabId, customRole?: CustomRoleRecord | null): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  if (customRole && (customRole.id === role || customRole.id === role.toLowerCase())) {
    if (customRole.allowed_tabs && Array.isArray(customRole.allowed_tabs)) {
      return customRole.allowed_tabs.includes(tab);
    }
  }
  const allowed = TAB_PERMISSIONS[tab];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Helper to check if a user role can access a Treasury subtab
 */
export function canAccessTreasurySubtab(role: UserRole | undefined, subtab: CashHandlingSubtab): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  const allowed = TREASURY_SUBTAB_PERMISSIONS[subtab];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Helper to check if a user role has permission for a specific action
 */
export function hasPermission(role: UserRole | undefined, action: PermissionAction, customRole?: CustomRoleRecord | null): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  if (customRole && (customRole.id === role || customRole.id === role.toLowerCase())) {
    if (customRole.allowed_actions && Array.isArray(customRole.allowed_actions)) {
      return customRole.allowed_actions.includes(action);
    }
  }
  const allowed = ACTION_PERMISSIONS[action];
  return allowed ? allowed.includes(role) : false;
}

