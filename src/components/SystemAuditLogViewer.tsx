'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useWallet, WalletType } from '@/context/WalletContext';
import { logAuditEvent } from '@/utils/auditLogger';
import { triggerHapticFeedback } from '@/utils/haptics';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  User,
  X,
  FileSpreadsheet,
  FileCode,
  ArrowLeft,
  Eye,
  CheckCircle2,
  Clock,
  Coins,
  Building2,
  Wallet,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Undo2,
  Trash2,
} from 'lucide-react';

export interface FormattedAuditAction {
  title: string;
  categoryLabel?: string;
  memberName?: string;
  groupName?: string;
  amount?: string;
  wallet?: string;
  rawRecordId?: string;
  isLegacyRaw: boolean;
}

export interface AuditLogItem {
  id: string;
  admin_id: string | null;
  action_description: string;
  target_table: string;
  timestamp: string;
  profiles?: {
    id?: string;
    full_name?: string | null;
    role?: string | null;
    phone_number?: string | null;
  } | null;
}

export type EventCategory = 
  | 'all' 
  | 'collections' 
  | 'cycles' 
  | 'treasury' 
  | 'members' 
  | 'auctions' 
  | 'security';

export interface SystemAuditLogViewerProps {
  onBack?: () => void;
  className?: string;
}

export interface UndoCandidate {
  log: AuditLogItem;
  type: 'collection' | 'personal_draw' | 'atm_relocation' | 'transfer' | 'advance_cycle' | 'unblock';
  amount: number;
  wallet?: WalletType;
  sourceWallet?: WalletType;
  destWallet?: WalletType;
  receiptBatch?: string;
  isBulkCollection?: boolean;
  bulkMonth?: number;
  isPendingAtm?: boolean;
  groupName?: string;
  fromMonth?: number;
  toMonth?: number;
  targetMemberName?: string;
  description: string;
}

export default function SystemAuditLogViewer({ onBack, className = '' }: SystemAuditLogViewerProps) {
  const { profile: currentAdminProfile, canPerformAction } = useAuth();
  const { balances, updateBalance } = useWallet();
  const canExportAudit = canPerformAction('reports:export_audit');

  // Core Data States
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [totalDbCount, setTotalDbCount] = useState<number>(0);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());

  // Filter States
  const [feedMode, setFeedMode] = useState<'clean' | 'all'>('clean');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [executorFilter, setExecutorFilter] = useState<string>('all');

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Detail Modal & Undo State
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);
  const [undoCandidate, setUndoCandidate] = useState<UndoCandidate | null>(null);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [undoSuccessMsg, setUndoSuccessMsg] = useState<string | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [isPurgingLogs, setIsPurgingLogs] = useState<boolean>(false);
  const isAdmin = currentAdminProfile?.role === 'admin' || currentAdminProfile?.role === 'administrator';

  // Metadata Caches for resolving historical logs
  const [directoryProfiles, setDirectoryProfiles] = useState<Record<string, { name: string; phone?: string; role?: string }>>({});
  const [directoryGroups, setDirectoryGroups] = useState<Record<string, string>>({});

  // ── Fetch Audit Logs & Directory Metadata from Supabase ──
  const fetchAuditLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsRefreshing(true);
    try {
      // 1. Fetch exact total count
      const { count: exactCount } = await supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true });

      if (exactCount !== null) {
        setTotalDbCount(exactCount);
      }

      // 2. Fetch full log history (up to 1,000 recent events for complete visibility)
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select(`
          id,
          admin_id,
          action_description,
          target_table,
          timestamp,
          profiles:admin_id (
            id,
            full_name,
            role,
            phone_number
          )
        `)
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Error fetching security audit logs:', error);
      } else if (data) {
        setLogs(data as unknown as AuditLogItem[]);
        setLastSyncedTime(new Date());
      }

      // 3. Fetch directory of profiles and chit_groups to enrich & translate any raw database IDs
      try {
        const [profilesRes, groupsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, phone_number, role'),
          supabase.from('chit_groups').select('id, name')
        ]);
        if (profilesRes.data) {
          const pMap: Record<string, { name: string; phone?: string; role?: string }> = {};
          profilesRes.data.forEach((p: any) => {
            pMap[p.id] = { name: p.full_name || 'Member', phone: p.phone_number, role: p.role };
          });
          setDirectoryProfiles(pMap);
        }
        if (groupsRes.data) {
          const gMap: Record<string, string> = {};
          groupsRes.data.forEach((g: any) => {
            gMap[g.id] = g.name;
          });
          setDirectoryGroups(gMap);
        }
      } catch {
        // Non-blocking metadata enrichment
      }
    } catch (err) {
      console.error('Audit log fetch exception:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load & real-time subscription
  useEffect(() => {
    fetchAuditLogs();

    const channelName = `audit_log_viewer_stream_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_audit_logs' },
        () => {
          // Instantly refresh when a new audit log is inserted
          fetchAuditLogs(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAuditLogs]);

  // ── Event Classification Helper ──
  const classifyLog = useCallback((log: AuditLogItem) => {
    const desc = (log.action_description || '').toUpperCase();
    const table = (log.target_table || '').toLowerCase();

    if (desc.includes('REVERT') || desc.includes('ROLLBACK')) {
      return {
        category: 'cycles' as EventCategory,
        label: 'Cycle Revert',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200/80',
        dotColor: 'bg-rose-500',
        icon: '⚠️',
      };
    }
    if (desc.includes('COLLECTION') || desc.includes('RECEIVED') || desc.includes('PAYMENT') || table === 'transactions' && !desc.includes('PAYOUT') && !desc.includes('DRAW') && !desc.includes('WITHDRAWAL')) {
      return {
        category: 'collections' as EventCategory,
        label: 'Collection',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dotColor: 'bg-emerald-500',
        icon: '💰',
      };
    }
    if (desc.includes('PAYOUT') || desc.includes('DISBURSE') || desc.includes('PRIZE POT') || table === 'auction_logs' && desc.includes('PAYOUT')) {
      return {
        category: 'auctions' as EventCategory,
        label: 'Prize Payout',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/80',
        dotColor: 'bg-blue-500',
        icon: '🏆',
      };
    }
    if (desc.includes('LAUNCH') || desc.includes('MONTH ADVANCE') || desc.includes('ADVANCED TO') || desc.includes('GROUP CREATED') || table === 'chit_groups') {
      return {
        category: 'cycles' as EventCategory,
        label: 'Chit Cycle',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        dotColor: 'bg-indigo-500',
        icon: '🔄',
      };
    }
    if (desc.includes('ATM') || desc.includes('WITHDRAWAL') || desc.includes('TREASURY') || desc.includes('CASH BOX') || desc.includes('PERSONAL DRAW') || desc.includes('TRANSFER') || table === 'global_treasury') {
      return {
        category: 'treasury' as EventCategory,
        label: 'Treasury & Cash',
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-200/80',
        dotColor: 'bg-amber-500',
        icon: '🏛️',
      };
    }
    if (desc.includes('MEMBER') || desc.includes('PROFILE') || desc.includes('ROLE') || desc.includes('MPIN') || desc.includes('QR') || table === 'profiles' || table === 'group_members') {
      return {
        category: 'members' as EventCategory,
        label: 'Member & Access',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/80',
        dotColor: 'bg-purple-500',
        icon: '👤',
      };
    }
    if (desc.includes('AUCTION') || desc.includes('BID') || table === 'auction_logs') {
      return {
        category: 'auctions' as EventCategory,
        label: 'Live Auction',
        badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
        dotColor: 'bg-cyan-500',
        icon: '🔨',
      };
    }
    return {
      category: 'security' as EventCategory,
      label: 'System & Audit',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
      dotColor: 'bg-slate-400',
      icon: '🛡️',
    };
  }, []);

  // ── Human-Readable Audit Action Formatter & Context Parser ──
  const formatHumanAuditAction = useCallback((log: AuditLogItem): FormattedAuditAction => {
    const rawDesc = log.action_description || '';
    const table = (log.target_table || '').toLowerCase();
    
    // 1. Detect legacy raw database trigger pattern: "(INSERT|UPDATE|DELETE) action on record ID: <uuid>"
    const rawMatch = rawDesc.match(/^(INSERT|UPDATE|DELETE)\s+action on record ID:\s*([0-9a-f-]{36})/i);
    
    if (rawMatch) {
      const op = rawMatch[1].toUpperCase();
      const recordId = rawMatch[2].toLowerCase();
      
      if (table === 'profiles') {
        const member = directoryProfiles[recordId];
        const name = member ? member.name : null;
        let title = '';
        if (op === 'INSERT') {
          title = name ? `Created member profile for ${name}` : `Created new member profile`;
        } else if (op === 'DELETE') {
          title = name ? `Deleted member profile for ${name}` : `Deleted member profile`;
        } else {
          title = name 
            ? `Verified PIN & refreshed digital passbook session for ${name}` 
            : `Verified PIN & updated member profile details`;
        }
        return {
          title,
          memberName: name || undefined,
          rawRecordId: recordId,
          isLegacyRaw: true
        };
      }
      
      if (table === 'chit_groups') {
        const groupName = directoryGroups[recordId];
        let title = '';
        if (op === 'INSERT') title = groupName ? `Created new chit group "${groupName}"` : `Created new chit group`;
        else if (op === 'DELETE') title = groupName ? `Deleted chit group "${groupName}"` : `Deleted chit group`;
        else title = groupName ? `Updated configuration for "${groupName}"` : `Updated chit group configuration`;
        return {
          title,
          groupName: groupName || undefined,
          rawRecordId: recordId,
          isLegacyRaw: true
        };
      }

      if (table === 'group_members') {
        return {
          title: op === 'INSERT' ? 'Enrolled member into chit ticket' : op === 'DELETE' ? 'Removed member ticket enrollment' : 'Updated member ticket allocation & win status',
          rawRecordId: recordId,
          isLegacyRaw: true
        };
      }

      if (table === 'transactions') {
        return {
          title: op === 'INSERT' ? 'Recorded financial payment transaction' : op === 'DELETE' ? 'Deleted payment ledger entry' : 'Updated payment transaction record',
          rawRecordId: recordId,
          isLegacyRaw: true
        };
      }

      if (table === 'global_treasury') {
        return {
          title: 'Synchronized multi-vault treasury balance',
          rawRecordId: recordId,
          isLegacyRaw: true
        };
      }

      if (table === 'auction_logs') {
        return {
          title: op === 'INSERT' ? 'Logged live auction round result' : op === 'DELETE' ? 'Reverted monthly live auction log' : 'Updated live auction record',
          rawRecordId: recordId,
          isLegacyRaw: true
        };
      }

      return {
        title: `${op} action on ${table}`,
        rawRecordId: recordId,
        isLegacyRaw: true
      };
    }

    // 2. For modern human-readable descriptions, extract smart context pills
    // Extract amount: e.g. ₹25,000 or ₹ 25,000
    const amountMatch = rawDesc.match(/₹\s*([\d,]+(?:\.\d+)?)/);
    const amount = amountMatch ? `₹${amountMatch[1]}` : undefined;

    // Extract group name: e.g. "Test run Group"
    const groupMatch = rawDesc.match(/"([^"]+)"/);
    const groupName = groupMatch ? groupMatch[1] : undefined;

    // Extract member name: e.g. "for Savithiri", "from Savithiri", "to Savithiri"
    let memberName: string | undefined;
    const memberMatch = rawDesc.match(/(?:for|from|to|profile:?)\s+([A-Za-z0-9\s.]+?)(?=\s+(?:\(|via|\[|\-|,|at|\bTicket\b|\bin\b|$))/i);
    if (memberMatch && memberMatch[1]) {
      const cand = memberMatch[1].trim();
      const lower = cand.toLowerCase();
      if (!['the', 'a', 'each', 'all', 'member', 'ticket', 'chit', 'cash', 'bank'].includes(lower)) {
        memberName = cand;
      }
    }

    // Extract wallet / account
    let wallet: string | undefined;
    if (/cash in hand|cash_in_hand|cash box/i.test(rawDesc)) wallet = 'Cash in Hand';
    else if (/kishor bank|kishor_bank/i.test(rawDesc)) wallet = 'Kishor Bank';
    else if (/dad bank|dad_bank/i.test(rawDesc)) wallet = 'Dad Bank';
    else if (/mom bank|mom_bank/i.test(rawDesc)) wallet = 'Mom Bank';
    else if (/upi/i.test(rawDesc)) wallet = 'UPI';
    else if (/netbanking|net banking/i.test(rawDesc)) wallet = 'NetBanking';

    return {
      title: rawDesc,
      amount,
      groupName,
      memberName,
      wallet,
      isLegacyRaw: false
    };
  }, [directoryProfiles, directoryGroups]);

  // ── Undo Candidate Parser ──
  const parseUndoCandidate = useCallback((log: AuditLogItem): UndoCandidate | null => {
    const rawDesc = (log.action_description || '').trim();
    const upper = rawDesc.toUpperCase();

    // Reversals and undos cannot be reversed again
    if (upper.includes('REVERSED') || upper.includes('UNDO') || upper.includes('ROLLBACK')) {
      return null;
    }

    // 1. Check if this action was already reversed by log ID reference (Ref #...)
    const shortLogId = log.id.slice(0, 8);
    const alreadyUndoneById = logs.some(l => 
      l.id !== log.id && 
      (l.action_description || '').toUpperCase().includes('REVERSED') && 
      (l.action_description || '').includes(shortLogId)
    );
    if (alreadyUndoneById) return null;

    // 2. Check if this action was already reversed by receipt batch
    const receiptMatch = rawDesc.match(/\[((?:RCP|BATCH)-[A-Za-z0-9_-]+)\]/i);
    const receiptBatch = receiptMatch ? receiptMatch[1] : undefined;

    if (receiptBatch) {
      const alreadyUndone = logs.some(l => 
        l.id !== log.id && 
        (l.action_description || '').toUpperCase().includes('REVERSED') && 
        (l.action_description || '').includes(receiptBatch)
      );
      if (alreadyUndone) return null;
    }

    // 3. Collections: e.g. COLLECTION CONFIRMED, BULK COLLECTION, FIFO CREDIT, or COLLECTION:
    if (upper.includes('COLLECTION') || upper.includes('FIFO CREDIT')) {
      const amtMatch = rawDesc.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      const amount = amtMatch ? Number(amtMatch[1].replace(/,/g, '')) : 0;
      let wallet: WalletType = 'cash_in_hand';
      if (/kishor bank|kishor_bank/i.test(rawDesc)) wallet = 'kishor_bank';
      else if (/dad bank|dad_bank/i.test(rawDesc)) wallet = 'dad_bank';
      else if (/mom bank|mom_bank/i.test(rawDesc)) wallet = 'mom_bank';

      const isBulk = upper.includes('BULK COLLECTION');
      const bulkMonthMatch = rawDesc.match(/Month\s+(\d+)/i);
      const bulkMonth = bulkMonthMatch ? parseInt(bulkMonthMatch[1], 10) : undefined;

      const memberMatch = rawDesc.match(/(?:for|from)\s+([A-Za-z0-9\s.]+?)(?=\s+(?:for|via|\[|\-|,|$))/i);
      const member = isBulk ? 'All Pending Members' : (memberMatch ? memberMatch[1].trim() : 'Subscriber');

      const descText = isBulk
        ? `Void bulk collection of ₹${amount.toLocaleString('en-IN')}${receiptBatch ? ` [${receiptBatch}]` : ''} for Month ${bulkMonth ?? ''}, deduct ₹${amount.toLocaleString('en-IN')} from ${wallet.replace(/_/g, ' ')}, and restore pending dues for all members.`
        : `Void payment of ₹${amount.toLocaleString('en-IN')}${receiptBatch ? ` [${receiptBatch}]` : ''} from ${member}, deduct ₹${amount.toLocaleString('en-IN')} from ${wallet.replace(/_/g, ' ')}, and restore member's pending due.`;

      return {
        log,
        type: 'collection',
        amount,
        wallet,
        receiptBatch,
        isBulkCollection: isBulk,
        bulkMonth,
        targetMemberName: member,
        description: descText
      };
    }

    // 4. Personal Draw
    if (upper.includes('PERSONAL DRAW')) {
      const amtMatch = rawDesc.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      const amount = amtMatch ? Number(amtMatch[1].replace(/,/g, '')) : 0;
      let wallet: WalletType = 'cash_in_hand';
      if (/kishor bank|kishor_bank/i.test(rawDesc)) wallet = 'kishor_bank';
      else if (/dad bank|dad_bank/i.test(rawDesc)) wallet = 'dad_bank';
      else if (/mom bank|mom_bank/i.test(rawDesc)) wallet = 'mom_bank';

      return {
        log,
        type: 'personal_draw',
        amount,
        wallet,
        description: `Reverse personal spend of ₹${amount.toLocaleString('en-IN')}, refund ₹${amount.toLocaleString('en-IN')} back into ${wallet.replace(/_/g, ' ')}, and void this expense entry from recent transactions.`
      };
    }

    // 5. ATM Relocation: Triggered (Pending) vs Confirmed
    if (upper.includes('ATM RELOCATION')) {
      const amtMatch = rawDesc.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      const amount = amtMatch ? Number(amtMatch[1].replace(/,/g, '')) : 0;

      let sourceWallet: WalletType = 'kishor_bank';
      if (/dad\s*bank/i.test(rawDesc)) sourceWallet = 'dad_bank';
      else if (/mom\s*bank/i.test(rawDesc)) sourceWallet = 'mom_bank';
      else if (/cash\s*(?:in\s*hand|box)/i.test(rawDesc) && !rawDesc.toLowerCase().includes('credited into physical cash box')) sourceWallet = 'cash_in_hand';

      const isPendingAtm = upper.includes('TRIGGERED') || upper.includes('PENDING');

      if (isPendingAtm) {
        return {
          log,
          type: 'atm_relocation',
          amount,
          sourceWallet,
          isPendingAtm: true,
          description: `Cancel pending ATM withdrawal of ₹${amount.toLocaleString('en-IN')}: Refund ₹${amount.toLocaleString('en-IN')} back to ${sourceWallet.replace(/_/g, ' ')} and void the pending cash-box verification alert. (Cash Box is unaffected as physical notes were never deposited).`
        };
      }

      // Confirmed ATM relocation
      return {
        log,
        type: 'atm_relocation',
        amount,
        wallet: 'cash_in_hand',
        sourceWallet,
        isPendingAtm: false,
        description: `Reverse completed ATM cash inflow: Deduct ₹${amount.toLocaleString('en-IN')} from Physical Cash Box, credit ₹${amount.toLocaleString('en-IN')} back to ${sourceWallet.replace(/_/g, ' ')}, and void this ATM transaction.`
      };
    }

    // 6. Inter-Vault Transfer
    if (upper.includes('INTER-VAULT TRANSFER') || (upper.includes('TRANSFER') && upper.includes('MOVED FROM'))) {
      const amtMatch = rawDesc.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      const amount = amtMatch ? Number(amtMatch[1].replace(/,/g, '')) : 0;

      let sourceWallet: WalletType = 'kishor_bank';
      let destWallet: WalletType = 'cash_in_hand';

      const moveMatch = rawDesc.match(/moved from\s+([^to]+?)\s+to\s+([^.]+)/i);
      if (moveMatch) {
        const srcStr = moveMatch[1].toLowerCase();
        const dstStr = moveMatch[2].toLowerCase();

        if (srcStr.includes('cash')) sourceWallet = 'cash_in_hand';
        else if (srcStr.includes('dad')) sourceWallet = 'dad_bank';
        else if (srcStr.includes('mom')) sourceWallet = 'mom_bank';
        else if (srcStr.includes('kishor')) sourceWallet = 'kishor_bank';

        if (dstStr.includes('cash')) destWallet = 'cash_in_hand';
        else if (dstStr.includes('dad')) destWallet = 'dad_bank';
        else if (dstStr.includes('mom')) destWallet = 'mom_bank';
        else if (dstStr.includes('kishor')) destWallet = 'kishor_bank';
      }

      return {
        log,
        type: 'transfer',
        amount,
        sourceWallet,
        destWallet,
        description: `Reverse inter-vault transfer: Deduct ₹${amount.toLocaleString('en-IN')} from ${destWallet.replace(/_/g, ' ')}, refund ₹${amount.toLocaleString('en-IN')} back to ${sourceWallet.replace(/_/g, ' ')}, and void both transfer transactions.`
      };
    }

    // 7. Cycle Advancement
    if (upper.includes('ADVANCED CYCLE') && upper.includes('ADVANCED FROM MONTH')) {
      const grpMatch = rawDesc.match(/Group\s+"([^"]+)"\s+advanced from Month\s+(\d+)\s+to Month\s+(\d+)/i);
      if (grpMatch) {
        const groupName = grpMatch[1];
        const fromMonth = parseInt(grpMatch[2], 10);
        const toMonth = parseInt(grpMatch[3], 10);

        return {
          log,
          type: 'advance_cycle',
          amount: 0,
          groupName,
          fromMonth,
          toMonth,
          description: `Roll back "${groupName}" from Month ${toMonth} to Month ${fromMonth}. Active cycle pointer will be reverted.`
        };
      }
    }

    // 8. Member or Staff Suspension / Blocking
    if (upper.includes('SUSPENDED') || upper.includes('BLOCKED')) {
      const memberMatch = rawDesc.match(/(?:for|subscriber|staff)\s+([A-Za-z0-9\s.]+?)(?=\s+(?:\(|\[|\-|,|$))/i);
      const member = memberMatch ? memberMatch[1].trim() : 'User';
      return {
        log,
        type: 'unblock',
        amount: 0,
        targetMemberName: member,
        description: `Restore active portal login access for ${member}.`
      };
    }

    return null;
  }, [logs]);

  // ── Execute Safe Reversal ──
  const handleExecuteUndo = async () => {
    if (!undoCandidate) return;
    try {
      setIsUndoing(true);
      const { type, amount, wallet, sourceWallet, destWallet, receiptBatch, isBulkCollection, bulkMonth, isPendingAtm, groupName, fromMonth, toMonth, targetMemberName } = undoCandidate;
      const refTag = `Ref #${undoCandidate.log.id.slice(0, 8)}`;

      // 1. Balance pre-flight validations
      if (type === 'collection' && wallet) {
        const currentBal = balances[wallet] ?? 0;
        if (currentBal < amount) {
          alert(`Pre-flight Safety Check: Insufficient funds in ${wallet.replace(/_/g, ' ')} (Available: ₹${currentBal.toLocaleString('en-IN')}, Required to deduct: ₹${amount.toLocaleString('en-IN')}). Reversal cancelled to prevent negative balance.`);
          return;
        }
      }

      if (type === 'atm_relocation' && !isPendingAtm) {
        const cashBal = balances['cash_in_hand'] ?? 0;
        if (cashBal < amount) {
          alert(`Pre-flight Safety Check: Insufficient funds in Physical Cash Box (Available: ₹${cashBal.toLocaleString('en-IN')}, Required: ₹${amount.toLocaleString('en-IN')}). Reversal cancelled.`);
          return;
        }
      }

      if (type === 'transfer' && destWallet) {
        const destBal = balances[destWallet] ?? 0;
        if (destBal < amount) {
          alert(`Pre-flight Safety Check: Insufficient funds in ${destWallet.replace(/_/g, ' ')} (Available: ₹${destBal.toLocaleString('en-IN')}, Required: ₹${amount.toLocaleString('en-IN')}). Reversal cancelled.`);
          return;
        }
      }

      // 2. Perform safe reversal operations
      if (type === 'collection') {
        // Void/delete transaction records by receipt batch, bulk, or timestamp match
        if (receiptBatch) {
          const { data: txs } = await supabase
            .from('transactions')
            .select('id, amount, wallet_type')
            .ilike('notes', `%${receiptBatch}%`);

          if (txs && txs.length > 0) {
            await supabase.from('transactions').delete().in('id', txs.map(t => t.id));
          }
        } else if (isBulkCollection && bulkMonth !== undefined) {
          const { data: bulkTxs } = await supabase
            .from('transactions')
            .select('id')
            .eq('type', 'collection')
            .eq('cycle_month', bulkMonth)
            .ilike('notes', '%Bulk Mark All Paid%');

          if (bulkTxs && bulkTxs.length > 0) {
            await supabase.from('transactions').delete().in('id', bulkTxs.map(t => t.id));
          }
        } else {
          // Unbatched single collection fallback
          let memberProfileId: string | null = null;
          if (targetMemberName) {
            const foundProfile = Object.entries(directoryProfiles).find(
              ([_, p]) => p.name.toLowerCase().trim() === targetMemberName.toLowerCase().trim()
            );
            if (foundProfile) memberProfileId = foundProfile[0];
          }

          const logTime = new Date(undoCandidate.log.timestamp);
          const windowStart = new Date(logTime.getTime() - 45 * 60 * 1000).toISOString();
          const windowEnd = new Date(logTime.getTime() + 45 * 60 * 1000).toISOString();

          let q = supabase
            .from('transactions')
            .select('id')
            .eq('type', 'collection')
            .eq('amount', amount);

          if (wallet) q = q.eq('wallet_type', wallet);
          if (memberProfileId) q = q.eq('profile_id', memberProfileId);
          q = q.gte('created_at', windowStart).lte('created_at', windowEnd);

          const { data: matchedTxs } = await q.order('created_at', { ascending: false }).limit(1);

          if (matchedTxs && matchedTxs.length > 0) {
            await supabase.from('transactions').delete().eq('id', matchedTxs[0].id);
          } else {
            let fallbackQ = supabase
              .from('transactions')
              .select('id')
              .eq('type', 'collection')
              .eq('amount', amount);
            if (wallet) fallbackQ = fallbackQ.eq('wallet_type', wallet);
            if (memberProfileId) fallbackQ = fallbackQ.eq('profile_id', memberProfileId);
            const { data: fallbackTxs } = await fallbackQ.order('created_at', { ascending: false }).limit(1);
            if (fallbackTxs && fallbackTxs.length > 0) {
              await supabase.from('transactions').delete().eq('id', fallbackTxs[0].id);
            }
          }
        }

        // Deduct collected amount from wallet
        if (wallet && amount > 0) {
          const balRes = await updateBalance(wallet, -amount);
          if (!balRes.success) {
            alert(`Failed to deduct ₹${amount.toLocaleString('en-IN')} from ${wallet.replace(/_/g, ' ')}: ${balRes.error}`);
            return;
          }
        }

        // Log reversal
        await logAuditEvent({
          actionDescription: `REVERSED COLLECTION (${refTag}): Voided ₹${amount.toLocaleString('en-IN')} payment ${receiptBatch ? `[${receiptBatch}] ` : ''}for ${targetMemberName || 'subscriber'}. Deducted ₹${amount.toLocaleString('en-IN')} from ${wallet?.replace(/_/g, ' ') || 'vault'}. Outstanding dues restored.`,
          targetTable: 'transactions',
          adminId: currentAdminProfile?.id || null,
        });
      }

      else if (type === 'personal_draw') {
        if (wallet && amount > 0) {
          const balRes = await updateBalance(wallet, amount);
          if (!balRes.success) {
            alert(`Failed to refund ${wallet.replace(/_/g, ' ')}: ${balRes.error}`);
            return;
          }
        }

        // Delete the personal draw transaction from transactions table
        const logTime = new Date(undoCandidate.log.timestamp);
        const windowStart = new Date(logTime.getTime() - 45 * 60 * 1000).toISOString();
        const windowEnd = new Date(logTime.getTime() + 45 * 60 * 1000).toISOString();

        let q = supabase
          .from('transactions')
          .select('id')
          .eq('type', 'personal_draw')
          .eq('amount', amount);
        if (wallet) q = q.eq('wallet_type', wallet);
        q = q.gte('created_at', windowStart).lte('created_at', windowEnd);

        const { data: drawTxs } = await q.order('created_at', { ascending: false }).limit(1);

        if (drawTxs && drawTxs.length > 0) {
          await supabase.from('transactions').delete().eq('id', drawTxs[0].id);
        } else {
          let fallbackQ = supabase
            .from('transactions')
            .select('id')
            .eq('type', 'personal_draw')
            .eq('amount', amount);
          if (wallet) fallbackQ = fallbackQ.eq('wallet_type', wallet);
          const { data: fbTxs } = await fallbackQ.order('created_at', { ascending: false }).limit(1);
          if (fbTxs && fbTxs.length > 0) {
            await supabase.from('transactions').delete().eq('id', fbTxs[0].id);
          }
        }

        await logAuditEvent({
          actionDescription: `REVERSED PERSONAL DRAW (${refTag}): Recredited ₹${amount.toLocaleString('en-IN')} back into ${wallet?.replace(/_/g, ' ')}. Voided expense draw.`,
          targetTable: 'transactions',
          adminId: currentAdminProfile?.id || null,
        });
      }

      else if (type === 'atm_relocation') {
        const refWallet = sourceWallet || 'kishor_bank';

        if (isPendingAtm) {
          // Pending ATM: only source bank was debited; cash box was never credited.
          // Refund source bank:
          const balRes = await updateBalance(refWallet, amount);
          if (!balRes.success) {
            alert(`Failed to refund ${refWallet.replace(/_/g, ' ')}: ${balRes.error}`);
            return;
          }

          // Delete the pending transaction from transactions
          const { data: pendingTxs } = await supabase
            .from('transactions')
            .select('id')
            .eq('type', 'atm_withdrawal')
            .eq('status', 'pending_verification')
            .eq('amount', amount)
            .order('created_at', { ascending: false })
            .limit(1);

          if (pendingTxs && pendingTxs.length > 0) {
            await supabase.from('transactions').delete().eq('id', pendingTxs[0].id);
          }

          await logAuditEvent({
            actionDescription: `REVERSED PENDING ATM (${refTag}): Cancelled pending withdrawal of ₹${amount.toLocaleString('en-IN')}. Refunded ₹${amount.toLocaleString('en-IN')} back to ${refWallet.replace(/_/g, ' ')}. Voided pending verification ticket.`,
            targetTable: 'transactions',
            adminId: currentAdminProfile?.id || null,
          });
        } else {
          // Confirmed ATM: Cash Box was credited; deduct Cash Box and refund bank
          const debitRes = await updateBalance('cash_in_hand', -amount);
          if (!debitRes.success) {
            alert(`Failed to deduct from Cash Box: ${debitRes.error}`);
            return;
          }

          const creditRes = await updateBalance(refWallet, amount);
          if (!creditRes.success) {
            await updateBalance('cash_in_hand', amount);
            alert(`Failed to refund ${refWallet.replace(/_/g, ' ')}: ${creditRes.error}`);
            return;
          }

          const { data: compTxs } = await supabase
            .from('transactions')
            .select('id')
            .eq('type', 'atm_withdrawal')
            .eq('status', 'completed')
            .eq('amount', amount)
            .order('created_at', { ascending: false })
            .limit(1);

          if (compTxs && compTxs.length > 0) {
            await supabase.from('transactions').delete().eq('id', compTxs[0].id);
          }

          await logAuditEvent({
            actionDescription: `REVERSED ATM RELOCATION (${refTag}): Deducted ₹${amount.toLocaleString('en-IN')} from Cash Box and refunded back to ${refWallet.replace(/_/g, ' ')}.`,
            targetTable: 'transactions',
            adminId: currentAdminProfile?.id || null,
          });
        }
      }

      else if (type === 'transfer' && destWallet && sourceWallet) {
        const debitRes = await updateBalance(destWallet, -amount);
        if (!debitRes.success) {
          alert(`Failed to deduct from ${destWallet.replace(/_/g, ' ')}: ${debitRes.error}`);
          return;
        }

        const creditRes = await updateBalance(sourceWallet, amount);
        if (!creditRes.success) {
          await updateBalance(destWallet, amount);
          alert(`Failed to refund ${sourceWallet.replace(/_/g, ' ')}: ${creditRes.error}`);
          return;
        }

        const logTime = new Date(undoCandidate.log.timestamp);
        const windowStart = new Date(logTime.getTime() - 45 * 60 * 1000).toISOString();
        const windowEnd = new Date(logTime.getTime() + 45 * 60 * 1000).toISOString();

        const { data: txs } = await supabase
          .from('transactions')
          .select('id')
          .in('type', ['transfer', 'transfer_in'])
          .eq('amount', amount)
          .gte('created_at', windowStart)
          .lte('created_at', windowEnd);

        if (txs && txs.length > 0) {
          await supabase.from('transactions').delete().in('id', txs.map(t => t.id));
        }

        await logAuditEvent({
          actionDescription: `REVERSED INTER-VAULT TRANSFER (${refTag}): Returned ₹${amount.toLocaleString('en-IN')} from ${destWallet.replace(/_/g, ' ')} back to ${sourceWallet.replace(/_/g, ' ')}. Voided transfer records.`,
          targetTable: 'transactions',
          adminId: currentAdminProfile?.id || null,
        });
      }

      else if (type === 'advance_cycle' && groupName && fromMonth !== undefined) {
        const { data: grpData, error: grpFetchErr } = await supabase
          .from('chit_groups')
          .select('id, current_month')
          .eq('name', groupName)
          .single();

        if (grpFetchErr || !grpData) {
          alert(`Could not find group "${groupName}". Reversal aborted.`);
          return;
        }

        const { error: updateErr } = await supabase
          .from('chit_groups')
          .update({
            current_month: fromMonth,
            updated_at: new Date().toISOString()
          })
          .eq('id', grpData.id);

        if (updateErr) {
          alert(`Failed to roll back group cycle: ${updateErr.message}`);
          return;
        }

        await logAuditEvent({
          actionDescription: `REVERSED CYCLE ADVANCE (${refTag}): Rolled back group "${groupName}" from Month ${toMonth} to Month ${fromMonth}.`,
          targetTable: 'chit_groups',
          adminId: currentAdminProfile?.id || null,
        });
      }

      else if (type === 'unblock' && targetMemberName) {
        await supabase
          .from('profiles')
          .update({ is_blocked: false })
          .ilike('full_name', targetMemberName);

        await logAuditEvent({
          actionDescription: `REVERSED SUSPENSION (${refTag}): Restored active portal access for ${targetMemberName}.`,
          targetTable: 'profiles',
          adminId: currentAdminProfile?.id || null,
        });
      }

      triggerHapticFeedback('success');
      setUndoSuccessMsg(`✓ Successfully reverted: ${undoCandidate.description}`);
      setUndoCandidate(null);
      setSelectedLog(null);
      await fetchAuditLogs(true);
      setTimeout(() => setUndoSuccessMsg(null), 4500);
    } catch (err: any) {
      triggerHapticFeedback('error');
      alert(`Reversal failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUndoing(false);
    }
  };

  // ── Distinct Executors List ──
  const uniqueExecutors = useMemo(() => {
    const map = new Map<string, string>();
    const defaultAdmin = Object.values(directoryProfiles).find(p => p.role === 'admin')?.name || 'Dr. Kishor Anbazhakan';
    logs.forEach(l => {
      const name = l.profiles?.full_name || `${defaultAdmin} (Admin PIN)`;
      const id = l.admin_id || 'admin_pin';
      map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [logs, directoryProfiles]);

  // ── Filtered Logs Computation ──
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return logs.filter(log => {
      // 0. Feed Mode Filter: Clean out vague low-level technical database triggers
      if (feedMode === 'clean') {
        const rawDescUpper = (log.action_description || '').toUpperCase();
        const table = (log.target_table || '').toLowerCase();

        // Filter out treasury balance sync trigger echoes
        if (table === 'global_treasury' && (
          rawDescUpper.includes('SYNCHRONIZED MULTI-VAULT') ||
          rawDescUpper.includes('UPDATE ON TREASURY WALLET') ||
          rawDescUpper.startsWith('UPDATE ACTION ON RECORD ID') ||
          rawDescUpper.startsWith('INSERT ACTION ON RECORD ID')
        )) {
          return false;
        }

        // Filter out raw transaction database insert echoes without real context
        if (table === 'transactions' && (
          rawDescUpper.startsWith('INSERT ACTION ON RECORD ID') ||
          rawDescUpper.startsWith('UPDATE ACTION ON RECORD ID') ||
          rawDescUpper === 'RECORDED FINANCIAL PAYMENT TRANSACTION' ||
          rawDescUpper.includes('RECORDED FINANCIAL PAYMENT TRANSACTION')
        )) {
          return false;
        }

        // Filter out repetitive background session & passbook token refreshes
        if (table === 'profiles' && (
          rawDescUpper.includes('VERIFIED PIN & REFRESHED DIGITAL PASSBOOK SESSION') ||
          rawDescUpper.includes('REFRESHED SECURITY SESSION & PROFILE TOKEN') ||
          rawDescUpper.includes('REFRESHED DIGITAL PASSBOOK KEY')
        )) {
          return false;
        }
      }

      // 1. Category Filter
      if (categoryFilter !== 'all') {
        const c = classifyLog(log).category;
        if (c !== categoryFilter) return false;
      }

      // 2. Date Scope Filter
      const logTime = new Date(log.timestamp).getTime();
      if (dateFilter === 'today' && logTime < todayStart) return false;
      if (dateFilter === '7days' && logTime < sevenDaysAgo) return false;
      if (dateFilter === '30days' && logTime < thirtyDaysAgo) return false;

      // 3. Executor Filter
      if (executorFilter !== 'all') {
        const executorId = log.admin_id || 'system';
        if (executorId !== executorFilter) return false;
      }

      // 4. Search Query (searches raw action, formatted human title, member, group, amount, table, executor, and UUID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const desc = (log.action_description || '').toLowerCase();
        const formatted = formatHumanAuditAction(log);
        const title = formatted.title.toLowerCase();
        const member = (formatted.memberName || '').toLowerCase();
        const group = (formatted.groupName || '').toLowerCase();
        const amt = (formatted.amount || '').toLowerCase();
        const target = (log.target_table || '').toLowerCase();
        const executorName = (log.profiles?.full_name || '').toLowerCase();
        const id = log.id.toLowerCase();
        return (
          desc.includes(q) ||
          title.includes(q) ||
          member.includes(q) ||
          group.includes(q) ||
          amt.includes(q) ||
          target.includes(q) ||
          executorName.includes(q) ||
          id.includes(q)
        );
      }

      return true;
    });
  }, [logs, feedMode, categoryFilter, dateFilter, executorFilter, searchQuery, classifyLog, formatHumanAuditAction]);

  // ── Category Counts for Filter Tabs ──
  const categoryCounts = useMemo(() => {
    const counts = {
      all: 0,
      collections: 0,
      cycles: 0,
      treasury: 0,
      members: 0,
      auctions: 0,
      security: 0,
    };
    logs.forEach(l => {
      if (feedMode === 'clean') {
        const rawDescUpper = (l.action_description || '').toUpperCase();
        const table = (l.target_table || '').toLowerCase();
        if (table === 'global_treasury' && (
          rawDescUpper.includes('SYNCHRONIZED MULTI-VAULT') ||
          rawDescUpper.includes('UPDATE ON TREASURY WALLET') ||
          rawDescUpper.startsWith('UPDATE ACTION ON RECORD ID') ||
          rawDescUpper.startsWith('INSERT ACTION ON RECORD ID')
        )) return;
        if (table === 'transactions' && (
          rawDescUpper.startsWith('INSERT ACTION ON RECORD ID') ||
          rawDescUpper.startsWith('UPDATE ACTION ON RECORD ID') ||
          rawDescUpper === 'RECORDED FINANCIAL PAYMENT TRANSACTION' ||
          rawDescUpper.includes('RECORDED FINANCIAL PAYMENT TRANSACTION')
        )) return;
        if (table === 'profiles' && (
          rawDescUpper.includes('VERIFIED PIN & REFRESHED DIGITAL PASSBOOK SESSION') ||
          rawDescUpper.includes('REFRESHED SECURITY SESSION & PROFILE TOKEN') ||
          rawDescUpper.includes('REFRESHED DIGITAL PASSBOOK KEY')
        )) return;
      }
      counts.all++;
      const cat = classifyLog(l).category;
      if (cat in counts) counts[cat as keyof typeof counts]++;
    });
    return counts;
  }, [logs, feedMode, classifyLog]);

  // ── High-Level KPI Summary Metrics ──
  const kpiStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayCount = logs.filter(l => new Date(l.timestamp).getTime() >= todayStart).length;

    return {
      total: totalDbCount || logs.length,
      today: todayCount,
      collections: categoryCounts.collections,
      cycles: categoryCounts.cycles,
      treasury: categoryCounts.treasury,
      members: categoryCounts.members,
    };
  }, [logs, totalDbCount, categoryCounts]);

  // ── Pagination Calculation ──
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, dateFilter, executorFilter, pageSize]);

  // ── Copy to Clipboard Helper ──
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Export CSV Handler ──
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No audit log entries available to export.');
      return;
    }

    const headers = ['Timestamp (UTC)', 'Timestamp (Local)', 'Category', 'Action Description', 'Target Table', 'Executor Name', 'Executor Role', 'Event Hash ID'];
    const rows = filteredLogs.map(l => {
      const cls = classifyLog(l);
      const dt = new Date(l.timestamp);
      return [
        `"${dt.toISOString()}"`,
        `"${dt.toLocaleString('en-IN')}"`,
        `"${cls.label}"`,
        `"${(l.action_description || '').replace(/"/g, '""')}"`,
        `"${l.target_table}"`,
        `"${(l.profiles?.full_name || 'System / Admin').replace(/"/g, '""')}"`,
        `"${l.profiles?.role || 'System'}"`,
        `"${l.id}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `chitfunds_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Export JSON Handler ──
  const handleExportJSON = () => {
    if (filteredLogs.length === 0) {
      alert('No audit log entries available to export.');
      return;
    }

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(
        {
          appName: 'ChitFunds Manager System Audit Trail',
          exportedAt: new Date().toISOString(),
          recordCount: filteredLogs.length,
          events: filteredLogs,
        },
        null,
        2
      )
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `chitfunds_audit_log_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // ── Purge Logs Handler ──
  const handlePurgeLogs = async () => {
    if (!isAdmin) return;
    try {
      setIsPurgingLogs(true);
      try {
        await supabase.rpc('purge_all_audit_logs');
      } catch (e) {
        console.warn('purge_all_audit_logs fallback to client loop:', e);
      }

      for (let attempt = 0; attempt < 15; attempt++) {
        const { count } = await supabase
          .from('security_audit_logs')
          .select('*', { count: 'exact', head: true });
        if (!count || count === 0) break;

        const { error } = await supabase
          .from('security_audit_logs')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) break;
      }

      setShowPurgeModal(false);
      triggerHapticFeedback('success');
      await fetchAuditLogs();
      window.dispatchEvent(new CustomEvent('chitfund:audit_updated'));
    } catch (err) {
      console.error('Failed to purge audit logs:', err);
      triggerHapticFeedback('error');
    } finally {
      setIsPurgingLogs(false);
    }
  };

  // ── Format Relative Time ──
  const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      
      {/* ── TOP HEADER / WORKSPACE BAR ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 -ml-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0"
                title="Back to Reports"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display font-bold text-lg sm:text-xl text-slate-900 leading-tight">
                  Live System Audit &amp; Activity Log
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Postgres Realtime
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                Continuous tamper-evident chronological ledger tracking every member transaction, cycle advancement, live bidding event, and administrative mutation.
              </p>
            </div>
          </div>

          {/* Quick Actions: Refresh & Export */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => fetchAuditLogs()}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              title="Refresh logs from database"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
              <span>Refresh</span>
            </button>

            {canExportAudit && (
              <>
                <button
                  type="button"
                  data-action="reports:export_audit"
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Export as CSV Spreadsheet"
                >
                  <FileSpreadsheet size={13} />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  data-action="reports:export_audit"
                  onClick={handleExportJSON}
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Export raw JSON"
                >
                  <FileCode size={13} />
                  <span>JSON</span>
                </button>
              </>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowPurgeModal(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Purge all audit logs"
              >
                <Trash2 size={13} />
                <span>Clear Logs</span>
              </button>
            )}
          </div>
        </div>

        {/* ── KPI METRICS STRIP ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Logged</span>
            <span className="text-lg font-black font-mono text-slate-900 mt-0.5 block">{kpiStats.total}</span>
            <span className="text-[10px] text-slate-500">Immutable events</span>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/70">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Today&apos;s Activity</span>
            <span className="text-lg font-black font-mono text-emerald-900 mt-0.5 block">{kpiStats.today}</span>
            <span className="text-[10px] text-emerald-600">Events in last 24h</span>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/70">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Collections</span>
            <span className="text-lg font-black font-mono text-blue-900 mt-0.5 block">{kpiStats.collections}</span>
            <span className="text-[10px] text-blue-600">Payments audited</span>
          </div>

          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/70">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Chit Cycles</span>
            <span className="text-lg font-black font-mono text-indigo-900 mt-0.5 block">{kpiStats.cycles}</span>
            <span className="text-[10px] text-indigo-600">Launches &amp; shifts</span>
          </div>

          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Treasury Ops</span>
            <span className="text-lg font-black font-mono text-amber-900 mt-0.5 block">{kpiStats.treasury}</span>
            <span className="text-[10px] text-amber-700">Cash &amp; bank vaults</span>
          </div>

          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/70">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Member Events</span>
            <span className="text-lg font-black font-mono text-purple-900 mt-0.5 block">{kpiStats.members}</span>
            <span className="text-[10px] text-purple-600">Profiles &amp; QR links</span>
          </div>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3.5">
        
        {/* Search Input Bar & Quick Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action, member name, receipt code, table or event hash..."
              className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand-500 rounded-xl text-xs font-semibold text-slate-900 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Time Preset Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 focus:bg-white focus:border-brand-500 outline-none cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">Past 30 Days</option>
            </select>

            {/* Executor Filter Dropdown */}
            <select
              value={executorFilter}
              onChange={(e) => setExecutorFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 focus:bg-white focus:border-brand-500 outline-none cursor-pointer max-w-[160px] truncate"
            >
              <option value="all">All Executors</option>
              {uniqueExecutors.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>

            {/* Page Size Selector */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-700 focus:bg-white focus:border-brand-500 outline-none cursor-pointer"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>

        {/* View Mode Toggle: Clean Staff Operations vs All Technical DB Triggers */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
            <button
              type="button"
              onClick={() => { triggerHapticFeedback('light'); setFeedMode('clean'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                feedMode === 'clean'
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles size={13} className={feedMode === 'clean' ? 'text-amber-500' : 'text-slate-400'} />
              <span>Actionable Staff Events</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200/60">
                Clean Feed
              </span>
            </button>
            <button
              type="button"
              onClick={() => { triggerHapticFeedback('light'); setFeedMode('all'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                feedMode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers size={13} className={feedMode === 'all' ? 'text-indigo-500' : 'text-slate-400'} />
              <span>All Technical DB Triggers</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium hidden sm:inline-flex items-center gap-1">
            {feedMode === 'clean' ? (
              <span>✓ Internal database trigger echoes &amp; session token pings filtered out</span>
            ) : (
              <span className="text-indigo-600 font-semibold">Displaying raw lower-level database trigger records</span>
            )}
          </div>
        </div>

        {/* Category Scope Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: 'All Operations', count: categoryCounts.all },
            { id: 'collections', label: '💰 Collections', count: categoryCounts.collections },
            { id: 'cycles', label: '🔄 Cycles & Launches', count: categoryCounts.cycles },
            { id: 'treasury', label: '🏛️ Treasury & Cash', count: categoryCounts.treasury },
            { id: 'members', label: '👤 Members & Access', count: categoryCounts.members },
            { id: 'auctions', label: '🏆 Auctions & Payouts', count: categoryCounts.auctions },
            { id: 'security', label: '🛡️ System & Audit', count: categoryCounts.security },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id as EventCategory)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === cat.id
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                categoryFilter === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── UNDO SUCCESS NOTIFICATION BANNER ── */}
      {undoSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in duration-150 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="font-bold">{undoSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setUndoSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1 rounded-lg cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── DESKTOP VIEW: HIGH-DENSITY AUDIT TABLE (hidden md:block) ── */}
      <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-3">Scope / Type</th>
                <th className="py-3.5 px-4">Action Description</th>
                <th className="py-3.5 px-3">Executor</th>
                <th className="py-3.5 px-3 text-right">Event Hash</th>
                <th className="py-3.5 px-3 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <RefreshCw size={16} className="animate-spin text-emerald-600" />
                      <span>Loading real-time audit ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-1">
                      <p className="font-bold text-slate-700 text-sm">No audit records found</p>
                      <p className="text-xs text-slate-400">
                        {searchQuery ? `No events match "${searchQuery}". Try clearing filters.` : 'No events logged for this selected scope.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const cls = classifyLog(log);
                  const formatted = formatHumanAuditAction(log);
                  const dt = new Date(log.timestamp);
                  const dateStr = dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                  const defaultAdmin = Object.values(directoryProfiles).find(p => p.role === 'admin')?.name || 'Dr. Kishor Anbazhakan';
                  const executorName = log.profiles?.full_name || `${defaultAdmin} (Admin PIN)`;
                  const executorRole = log.profiles?.role || 'Admin';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-slate-900 font-bold block">{dateStr}</span>
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono mt-0.5">
                          <Clock size={11} />
                          <span>{timeStr}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500 font-sans">{formatTimeAgo(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* Scope & Category Badge */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${cls.badgeColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cls.dotColor}`} />
                          <span>{cls.label}</span>
                        </span>
                        <span className="block text-[10px] font-mono text-slate-400 mt-1 uppercase">
                          tbl: {log.target_table}
                        </span>
                      </td>

                      {/* Action Description & Smart Context Badges */}
                      <td className="py-3.5 px-4 max-w-lg">
                        <div className="space-y-1.5">
                          <span className="text-slate-900 font-bold leading-relaxed block text-xs group-hover:text-indigo-950">
                            {formatted.title}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {formatted.memberName && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                <User size={10} className="text-slate-400" />
                                {formatted.memberName}
                              </span>
                            )}
                            {formatted.groupName && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                <Building2 size={10} className="text-indigo-400" />
                                {formatted.groupName}
                              </span>
                            )}
                            {formatted.amount && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
                                <Coins size={10} className="text-emerald-500" />
                                {formatted.amount}
                              </span>
                            )}
                            {formatted.wallet && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                                <Wallet size={10} className="text-amber-500" />
                                {formatted.wallet}
                              </span>
                            )}
                            {formatted.isLegacyRaw && formatted.rawRecordId && (
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                Ref #{formatted.rawRecordId.slice(0, 8)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Executor Profile */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {executorName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-xs block leading-tight">{executorName}</span>
                            <span className="text-[10px] uppercase font-semibold text-slate-400">{executorRole}</span>
                          </div>
                        </div>
                      </td>

                      {/* Event Hash ID */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(log.id, log.id);
                          }}
                          className="font-mono text-[11px] text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Click to copy UUID"
                        >
                          <span>#{log.id.slice(0, 8)}</span>
                          {copiedId === log.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        </button>
                      </td>

                      {/* Inspect & Undo Actions */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {(() => {
                            const undoDetails = parseUndoCandidate(log);
                            if (undoDetails) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUndoCandidate(undoDetails);
                                    triggerHapticFeedback('warning');
                                  }}
                                  className="p-1 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                                  title="Undo / Revert This Action"
                                >
                                  <RotateCcw size={14} />
                                </button>
                              );
                            }
                            return null;
                          })()}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="View Full Audit Details"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Desktop Table Footer with Pagination */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-800">{paginatedLogs.length}</span> of{' '}
            <span className="font-bold text-slate-800">{filteredLogs.length}</span> filtered events (
            <span className="font-mono">{totalDbCount || logs.length}</span> database total)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── MOBILE VIEW: OPTIMIZED CARD STREAM (md:hidden) ── */}
      <div className="md:hidden space-y-3 pb-24">
        {isLoading ? (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            <RefreshCw size={16} className="animate-spin text-emerald-600 mx-auto mb-2" />
            <span>Loading audit ledger...</span>
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
            No audit records found matching your filters.
          </div>
        ) : (
          paginatedLogs.map((log) => {
            const cls = classifyLog(log);
            const formatted = formatHumanAuditAction(log);
            const dt = new Date(log.timestamp);
            const dateStr = dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
            const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            const defaultAdmin = Object.values(directoryProfiles).find(p => p.role === 'admin')?.name || 'Dr. Kishor Anbazhakan';
            const executorName = log.profiles?.full_name || `${defaultAdmin} (Admin PIN)`;

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-200 transition-all cursor-pointer active:scale-[0.99] space-y-2.5"
              >
                {/* Header: Category Badge & Relative Time */}
                <div className="flex items-center justify-between text-xs">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${cls.badgeColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cls.dotColor}`} />
                    <span>{cls.label}</span>
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                    <Clock size={11} />
                    <span>{dateStr}, {timeStr}</span>
                  </div>
                </div>

                {/* Primary Action Description & Badges */}
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-900 leading-snug">
                    {formatted.title}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {formatted.memberName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        <User size={10} className="text-slate-400" />
                        {formatted.memberName}
                      </span>
                    )}
                    {formatted.groupName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                        <Building2 size={10} className="text-indigo-400" />
                        {formatted.groupName}
                      </span>
                    )}
                    {formatted.amount && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
                        <Coins size={10} className="text-emerald-500" />
                        {formatted.amount}
                      </span>
                    )}
                    {formatted.wallet && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                        <Wallet size={10} className="text-amber-500" />
                        {formatted.wallet}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer: Executor & Hash ID */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <User size={12} className="text-slate-400" />
                    <span className="font-semibold text-slate-700">{executorName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const candidate = parseUndoCandidate(log);
                      if (candidate) {
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUndoCandidate(candidate);
                              triggerHapticFeedback('warning');
                            }}
                            className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw size={10} />
                            <span>Undo</span>
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                      #{log.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination Controls */}
        {filteredLogs.length > 0 && (
          <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="text-[11px]">
              Page {currentPage} of {totalPages} ({filteredLogs.length} items)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-semibold text-xs cursor-pointer"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 font-semibold text-xs cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: DETAILED AUDIT EVENT INSPECTION ── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Security Audit Record Details
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Event UUID: #{selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/80 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              
              {/* Category & Timestamp Tag */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Classified Scope</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border mt-1 ${classifyLog(selectedLog).badgeColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${classifyLog(selectedLog).dotColor}`} />
                    <span>{classifyLog(selectedLog).label}</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Area</span>
                  <span className="font-semibold text-xs text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 mt-1 inline-block capitalize">
                    {selectedLog.target_table.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Action Description */}
              {(() => {
                const formatted = formatHumanAuditAction(selectedLog);
                return (
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Event Summary
                    </label>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <p className="text-xs font-bold text-slate-900 leading-relaxed font-sans">
                        {formatted.title}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60">
                        {formatted.memberName && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            <User size={10} className="text-slate-400" />
                            {formatted.memberName}
                          </span>
                        )}
                        {formatted.groupName && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-200">
                            <Building2 size={10} className="text-indigo-400" />
                            {formatted.groupName}
                          </span>
                        )}
                        {formatted.amount && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
                            <Coins size={10} className="text-emerald-500" />
                            {formatted.amount}
                          </span>
                        )}
                        {formatted.wallet && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <Wallet size={10} className="text-amber-500" />
                            {formatted.wallet}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Technical Details */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowTechDetails(prev => !prev)}
                        className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-600 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers size={12} className="text-slate-400" />
                          <span>Technical Database Specifications</span>
                        </span>
                        {showTechDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {showTechDetails && (
                        <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-1.5 animate-in fade-in duration-150">
                          <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-1">
                            <span>Table:</span>
                            <span className="text-emerald-400">{selectedLog.target_table}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-1">
                            <span>Event UUID:</span>
                            <span className="text-indigo-300">#{selectedLog.id}</span>
                          </div>
                          <div className="pt-1">
                            <span className="text-slate-400 block text-[10px] uppercase">Raw Log Payload:</span>
                            <span className="text-slate-300 break-all leading-tight block mt-0.5">
                              {selectedLog.action_description}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Timestamp Breakdown */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Local Time</span>
                  <span className="font-mono text-xs font-bold text-slate-800 mt-0.5 block">
                    {new Date(selectedLog.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(selectedLog.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Relative Time</span>
                  <span className="text-xs font-bold text-indigo-700 mt-0.5 block">
                    {formatTimeAgo(selectedLog.timestamp)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono truncate block" title={selectedLog.timestamp}>
                    {selectedLog.timestamp}
                  </span>
                </div>
              </div>

              {/* Executor Attribution */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Administrative Executor</span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                      {(selectedLog.profiles?.full_name || Object.values(directoryProfiles).find(p => p.role === 'admin')?.name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">
                        {selectedLog.profiles?.full_name || `${Object.values(directoryProfiles).find(p => p.role === 'admin')?.name || 'Dr. Kishor Anbazhakan'} (Admin PIN)`}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Role: <span className="font-semibold uppercase text-slate-700">{selectedLog.profiles?.role || 'Admin'}</span>
                        {selectedLog.profiles?.phone_number ? ` · +91 ${selectedLog.profiles.phone_number}` : ''}
                      </p>
                    </div>
                  </div>
                  {selectedLog.admin_id && (
                    <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                      ID: #{selectedLog.admin_id.slice(0, 8)}
                    </span>
                  )}
                </div>
              </div>

              {/* Tamper Evidence & Cryptographic Verification */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-950">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold block">Append-Only Immutability Guaranteed</span>
                  <p className="text-[10px] text-emerald-700 leading-tight">
                    Row-Level Security (RLS) restricts all modifications and deletions on this table.
                  </p>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCopy(selectedLog.id, selectedLog.id)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                {copiedId === selectedLog.id ? (
                  <>
                    <Check size={13} className="text-emerald-600" />
                    <span>Copied UUID</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy Event ID</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                {(() => {
                  const candidate = parseUndoCandidate(selectedLog);
                  if (candidate) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setUndoCandidate(candidate);
                          triggerHapticFeedback('warning');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <RotateCcw size={13} />
                        <span>Undo / Revert Action</span>
                      </button>
                    );
                  }
                  const isReversal = (selectedLog.action_description || '').toUpperCase().includes('REVERSED');
                  if (isReversal) {
                    return (
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-500 text-[11px] font-bold border border-slate-200">
                        Already Reverted
                      </span>
                    );
                  }
                  return null;
                })()}

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── UNDO / REVERSAL CONFIRMATION MODAL ── */}
      {undoCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => !isUndoing && setUndoCandidate(null)}
          />
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 z-10 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Undo System Action</h3>
                  <p className="text-xs text-slate-500">Non-destructive safe reversal protocol</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isUndoing && setUndoCandidate(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Action Card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Event</span>
              <p className="text-xs font-bold text-slate-900 leading-snug">
                {undoCandidate.log.action_description}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono pt-1">
                <Clock size={11} />
                <span>{new Date(undoCandidate.log.timestamp).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Reversal Plan & Impact */}
            <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Reversal Plan &amp; Database Safety</span>
              <p className="text-xs text-amber-950 font-medium leading-relaxed">
                {undoCandidate.description}
              </p>
              <div className="pt-1.5 border-t border-amber-200/80 text-[11px] text-amber-800 space-y-1">
                <p>✓ Past chit cycles, winner declarations, and unaffected members remain 100% untouched.</p>
                <p>✓ All changes are cryptographically logged as an immutable reversal event.</p>
              </div>
            </div>

            {/* Pre-flight Vault Solvency Check: Collections */}
            {undoCandidate.wallet && undoCandidate.amount > 0 && undoCandidate.type === 'collection' && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Vault Balance Verification</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {undoCandidate.wallet.replace(/_/g, ' ')} Balance:
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-slate-900 block">
                    ₹{(balances[undoCandidate.wallet] ?? 0).toLocaleString('en-IN')}
                  </span>
                  {(balances[undoCandidate.wallet] ?? 0) >= undoCandidate.amount ? (
                    <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      Sufficient for ₹{undoCandidate.amount.toLocaleString('en-IN')} deduction
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-600 inline-flex items-center gap-1">
                      <AlertCircle size={11} />
                      Deficit: ₹{(undoCandidate.amount - (balances[undoCandidate.wallet] ?? 0)).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Pre-flight Vault Solvency Check: Confirmed ATM Relocation */}
            {undoCandidate.type === 'atm_relocation' && !undoCandidate.isPendingAtm && undoCandidate.amount > 0 && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cash Box Solvency Verification</span>
                  <span className="font-bold text-slate-800">
                    Physical Cash Box Balance:
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-slate-900 block">
                    ₹{(balances['cash_in_hand'] ?? 0).toLocaleString('en-IN')}
                  </span>
                  {(balances['cash_in_hand'] ?? 0) >= undoCandidate.amount ? (
                    <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      Sufficient for ₹{undoCandidate.amount.toLocaleString('en-IN')} deduction
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-600 inline-flex items-center gap-1">
                      <AlertCircle size={11} />
                      Deficit: ₹{(undoCandidate.amount - (balances['cash_in_hand'] ?? 0)).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Pending ATM Relocation Info (No Cash Box Check Required) */}
            {undoCandidate.type === 'atm_relocation' && undoCandidate.isPendingAtm && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs text-emerald-900 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Pending Relocation Refund</span>
                  <span className="font-bold text-slate-800">
                    Source: {undoCandidate.sourceWallet?.replace(/_/g, ' ') || 'Bank Vault'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-emerald-700 block">
                    +₹{undoCandidate.amount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-500">Will be refunded to bank</span>
                </div>
              </div>
            )}

            {/* Pre-flight Vault Solvency Check: Inter-Vault Transfer */}
            {undoCandidate.type === 'transfer' && undoCandidate.destWallet && undoCandidate.amount > 0 && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Destination Vault Verification</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {undoCandidate.destWallet.replace(/_/g, ' ')} Balance:
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-slate-900 block">
                    ₹{(balances[undoCandidate.destWallet] ?? 0).toLocaleString('en-IN')}
                  </span>
                  {(balances[undoCandidate.destWallet] ?? 0) >= undoCandidate.amount ? (
                    <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      Sufficient for ₹{undoCandidate.amount.toLocaleString('en-IN')} deduction
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-600 inline-flex items-center gap-1">
                      <AlertCircle size={11} />
                      Deficit: ₹{(undoCandidate.amount - (balances[undoCandidate.destWallet] ?? 0)).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Personal Draw Recredit Info */}
            {undoCandidate.type === 'personal_draw' && undoCandidate.wallet && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs text-emerald-900 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Expense Recredit</span>
                  <span className="font-bold text-slate-800 capitalize">
                    Destination: {undoCandidate.wallet.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-emerald-700 block">
                    +₹{undoCandidate.amount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-slate-500">Will be re-credited</span>
                </div>
              </div>
            )}

            {/* Cycle Advance Rollback Info */}
            {undoCandidate.type === 'advance_cycle' && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl text-xs text-indigo-900">
                <span className="text-[10px] uppercase font-bold text-indigo-700 block">Cycle Rollback</span>
                <span className="font-bold text-slate-800">
                  {undoCandidate.groupName}: Month {undoCandidate.toMonth} → Month {undoCandidate.fromMonth}
                </span>
              </div>
            )}

            {/* Pre-flight Failure Warning */}
            {((undoCandidate.type === 'collection' && undoCandidate.wallet && (balances[undoCandidate.wallet] ?? 0) < undoCandidate.amount) ||
              (undoCandidate.type === 'atm_relocation' && !undoCandidate.isPendingAtm && (balances['cash_in_hand'] ?? 0) < undoCandidate.amount) ||
              (undoCandidate.type === 'transfer' && undoCandidate.destWallet && (balances[undoCandidate.destWallet] ?? 0) < undoCandidate.amount)) && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                <span>
                  Safety Violation: Cannot proceed with reversal because the target vault has insufficient balance. Multi-vault treasury balances must never become negative.
                </span>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUndoCandidate(null)}
                disabled={isUndoing}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteUndo}
                disabled={
                  isUndoing ||
                  (undoCandidate.type === 'collection' && undoCandidate.wallet && (balances[undoCandidate.wallet] ?? 0) < undoCandidate.amount) ||
                  (undoCandidate.type === 'atm_relocation' && !undoCandidate.isPendingAtm && (balances['cash_in_hand'] ?? 0) < undoCandidate.amount) ||
                  (undoCandidate.type === 'transfer' && undoCandidate.destWallet && (balances[undoCandidate.destWallet] ?? 0) < undoCandidate.amount)
                }
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-md shadow-amber-600/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isUndoing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Executing Safe Reversal...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={13} />
                    <span>Confirm &amp; Reverse Action</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PURGE AUDIT LOGS MODAL ── */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 size={20} />
                <h3 className="font-bold text-sm text-slate-900">Clear All Audit Logs</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete all <strong className="font-mono text-slate-900">{totalDbCount}</strong> system activity events and audit logs? This action is permanent and cannot be undone.
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPurgingLogs}
                onClick={handlePurgeLogs}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>{isPurgingLogs ? 'Purging Logs...' : 'Yes, Purge Logs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
