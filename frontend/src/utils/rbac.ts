import { UserRole } from '@/context/AuthContext';
import { CashHandlingSubtab } from '@/components/CashVaultLedger';

export type MainTabId = 
  | 'dashboard' 
  | 'chits' 
  | 'members' 
  | 'communication' 
  | 'auctions' 
  | 'reports' 
  | 'cash';

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
  // Communication
  | 'communication:broadcast'
  | 'communication:view'
  // Reports
  | 'reports:export'
  | 'reports:view'
  // System & Roles
  | 'system:manage_users';

/**
 * Tab Accessibility Matrix by Role
 */
export const TAB_PERMISSIONS: Record<MainTabId, UserRole[]> = {
  dashboard: ['admin', 'manager', 'subscriber'],
  chits: ['admin', 'manager', 'subscriber'],
  members: ['admin', 'manager', 'subscriber'],
  communication: ['admin', 'manager'],
  auctions: ['admin', 'manager', 'subscriber'],
  reports: ['admin', 'manager'],
  cash: ['admin', 'manager'],
};

/**
 * Treasury Subtab Accessibility Matrix by Role
 */
export const TREASURY_SUBTAB_PERMISSIONS: Record<CashHandlingSubtab, UserRole[]> = {
  overview: ['admin', 'manager'],
  wallets: ['admin', 'manager'],
  transfers: ['admin', 'manager'],
  spends: ['admin', 'manager'],
  denominations: ['admin', 'manager'],
  ledger: ['admin', 'manager'],
};

/**
 * Granular Action Permission Matrix by Role
 */
export const ACTION_PERMISSIONS: Record<PermissionAction, UserRole[]> = {
  // Chit Group Controls
  'chits:create': ['admin'],
  'chits:edit': ['admin', 'manager'],
  'chits:delete': ['admin'],
  'chits:view': ['admin', 'manager', 'subscriber'],

  // Member Controls
  'members:enroll': ['admin', 'manager'],
  'members:edit': ['admin', 'manager'],
  'members:delete': ['admin'],
  'members:view': ['admin', 'manager', 'subscriber'],
  'members:collect': ['admin', 'manager'],

  // Live Auctions & Payouts
  'auctions:bid': ['admin', 'manager', 'subscriber'],
  'auctions:conduct': ['admin', 'manager'],
  'auctions:disburse': ['admin', 'manager'],
  'auctions:view': ['admin', 'manager', 'subscriber'],

  // Treasury & Cash Operations
  'treasury:view': ['admin', 'manager'],
  'treasury:move_money': ['admin', 'manager'],
  'treasury:deposit': ['admin', 'manager'],
  'treasury:personal_draw': ['admin', 'manager'],
  'treasury:recover_float': ['admin', 'manager'],
  'treasury:reconcile': ['admin', 'manager'],

  // Communication Center
  'communication:broadcast': ['admin', 'manager'],
  'communication:view': ['admin', 'manager'],

  // Reports
  'reports:export': ['admin', 'manager'],
  'reports:view': ['admin', 'manager'],

  // System Administration
  'system:manage_users': ['admin'],
};

/**
 * Helper to check if a user role can access a primary tab
 */
export function canAccessTab(role: UserRole | undefined, tab: MainTabId): boolean {
  if (!role) return false;
  const allowed = TAB_PERMISSIONS[tab];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Helper to check if a user role can access a Treasury subtab
 */
export function canAccessTreasurySubtab(role: UserRole | undefined, subtab: CashHandlingSubtab): boolean {
  if (!role) return false;
  const allowed = TREASURY_SUBTAB_PERMISSIONS[subtab];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Helper to check if a user role has permission for a specific action
 */
export function hasPermission(role: UserRole | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  const allowed = ACTION_PERMISSIONS[action];
  return allowed ? allowed.includes(role) : false;
}
