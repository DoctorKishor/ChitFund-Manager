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
  // Chit Management
  | 'chits:create'
  | 'chits:edit'
  | 'chits:delete'
  | 'chits:view'
  // Member Management
  | 'members:enroll'
  | 'members:edit'
  | 'members:delete'
  | 'members:view'
  | 'members:collect'
  // Live Auctions
  | 'auctions:bid'
  | 'auctions:conduct'
  | 'auctions:disburse'
  | 'auctions:view'
  // Treasury & Vault
  | 'treasury:view'
  | 'treasury:move_money'
  | 'treasury:deposit'
  | 'treasury:personal_draw'
  | 'treasury:recover_float'
  | 'treasury:reconcile'
  | 'treasury:collect_cash'
  // Communication
  | 'communication:broadcast'
  | 'communication:view'
  // Reports
  | 'reports:export'
  | 'reports:view'
  // System & Roles
  | 'system:manage_users';

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
  // Chit Group Controls
  'chits:create': ['admin'],
  'chits:edit': ['admin', 'manager'],
  'chits:delete': ['admin'],
  'chits:view': ['admin', 'manager', 'auction_clerk', 'auditor', 'subscriber'],

  // Member Controls
  'members:enroll': ['admin', 'manager'],
  'members:edit': ['admin', 'manager'],
  'members:delete': ['admin'],
  'members:view': ['admin', 'manager', 'collections_agent', 'subscriber'],
  'members:collect': ['admin', 'manager', 'collections_agent'],

  // Live Auctions & Payouts
  'auctions:bid': ['admin', 'manager', 'auction_clerk', 'subscriber'],
  'auctions:conduct': ['admin', 'manager'],
  'auctions:disburse': ['admin', 'manager'],
  'auctions:view': ['admin', 'manager', 'auction_clerk', 'subscriber'],

  // Treasury & Cash Operations (High-Risk Admin Only)
  'treasury:view': ['admin'],
  'treasury:move_money': ['admin'],
  'treasury:deposit': ['admin'],
  'treasury:personal_draw': ['admin'],
  'treasury:recover_float': ['admin'],
  'treasury:reconcile': ['admin'],
  'treasury:collect_cash': ['admin', 'manager', 'collections_agent'],

  // Communication Center
  'communication:broadcast': ['admin', 'manager', 'collections_agent'],
  'communication:view': ['admin', 'manager', 'collections_agent'],

  // Reports
  'reports:export': ['admin', 'auditor'],
  'reports:view': ['admin', 'auditor'],

  // System Administration
  'system:manage_users': ['admin'],
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

