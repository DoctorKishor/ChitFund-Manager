'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useOrganization } from '@/context/OrganizationContext';
import { triggerHapticFeedback } from '@/utils/haptics';
import { extractReceiptNumber } from '@/utils/receiptNumber';
import { PaymentReceiptModal, PaymentAllocationItem } from './PaymentReceiptModal';
import {
  Search,
  Receipt,
  Download,
  Share2,
  Copy,
  Check,
  Calendar,
  Filter,
  RefreshCw,
  Wallet,
  Clock,
  User,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

export interface ConsolidatedReceiptItem {
  receiptNo: string;
  primaryTxId: string;
  allTxIds: string[];
  totalAmount: number;
  walletType: WalletType;
  createdAt: string;
  memberId: string | null;
  memberName: string;
  memberPhone: string;
  groupId: string | null;
  groupName: string;
  ticketNumber: number | string;
  cycleMonth: number;
  isMultiMonth: boolean;
  allocations: PaymentAllocationItem[];
  notes: string;
  proofUrl?: string | null;
  transaction: any;
  groupObj: any;
  memberObj: any;
}

export default function ReceiptsVaultViewer() {
  const { profile } = useAuth();
  const { organizationName } = useOrganization();
  const { balances } = useWallet();

  // Core Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { name: string; phone: string }>>({});
  const [groupsMap, setGroupsMap] = useState<Record<string, any>>({});
  const [membersMap, setMembersMap] = useState<Record<string, any>>({});

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedWallet, setSelectedWallet] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'amount_desc' | 'amount_asc'>('newest');

  // UI Interactive States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ConsolidatedReceiptItem | null>(null);
  const [showFiltersModal, setShowFiltersModal] = useState<boolean>(false);

  // ── Fetch Transactions & Metadata ──
  const fetchReceiptsData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [txsRes, profilesRes, groupsRes, membersRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('type', 'collection')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('profiles')
          .select('id, full_name, phone_number'),
        supabase
          .from('chit_groups')
          .select('id, name, total_value, monthly_installment, start_date'),
        supabase
          .from('group_members')
          .select('id, profile_id, group_id, ticket_number, custom_installment'),
      ]);

      if (txsRes.data) setRawTransactions(txsRes.data);

      if (profilesRes.data) {
        const pMap: Record<string, { name: string; phone: string }> = {};
        profilesRes.data.forEach((p: any) => {
          pMap[p.id] = { name: p.full_name || 'Subscriber', phone: p.phone_number || '' };
        });
        setProfilesMap(pMap);
      }

      if (groupsRes.data) {
        const gMap: Record<string, any> = {};
        groupsRes.data.forEach((g: any) => {
          gMap[g.id] = g;
        });
        setGroupsMap(gMap);
      }

      if (membersRes.data) {
        const mMap: Record<string, any> = {};
        membersRes.data.forEach((m: any) => {
          mMap[m.id] = m;
        });
        setMembersMap(mMap);
      }
    } catch (err) {
      console.error('Error fetching receipts vault data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReceiptsData();

    // Realtime listener on transactions table
    const channelName = `receipts_vault_stream_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          fetchReceiptsData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReceiptsData]);

  // ── Consolidate Batched Transactions into Unified Receipts ──
  const consolidatedReceipts = useMemo<ConsolidatedReceiptItem[]>(() => {
    const receiptsMap = new Map<string, ConsolidatedReceiptItem>();

    rawTransactions.forEach((tx) => {
      const receiptNo = extractReceiptNumber(tx);
      const group = tx.group_id ? groupsMap[tx.group_id] : null;
      const profileInfo = tx.profile_id ? profilesMap[tx.profile_id] : null;
      const memberEnroll = tx.group_member_id ? membersMap[tx.group_member_id] : null;

      const memberName = profileInfo?.name || 'Subscriber';
      const memberPhone = profileInfo?.phone || '';
      const groupName = group?.name || 'General Chit Fund';
      const ticketNum = memberEnroll?.ticket_number ?? 1;

      // Check if this receipt number was already encountered in the stream
      if (receiptsMap.has(receiptNo)) {
        const existing = receiptsMap.get(receiptNo)!;
        existing.totalAmount += Number(tx.amount || 0);
        existing.allTxIds.push(tx.id);
        existing.allocations.push({
          month: tx.cycle_month ?? 1,
          amount: Number(tx.amount || 0),
          type: 'current',
        });
        existing.isMultiMonth = true;
      } else {
        // Parse any embedded allocations from note metadata if present
        const allocMatch = (tx.notes || '').match(/\[Batch:[^|]+\|Total:[^|]+\|Alloc:([^\]]+)\]/);
        let parsedAllocations: PaymentAllocationItem[] = [];

        if (allocMatch && allocMatch[1]) {
          try {
            parsedAllocations = allocMatch[1].split(';').map((item: string) => {
              const [m, a, t] = item.split(':');
              return {
                month: parseInt(m, 10),
                amount: parseFloat(a),
                type: (t as any) || 'current',
              };
            });
          } catch {
            parsedAllocations = [];
          }
        }

        if (parsedAllocations.length === 0) {
          parsedAllocations = [
            {
              month: tx.cycle_month ?? 1,
              amount: Number(tx.amount || 0),
              type: 'current',
            },
          ];
        }

        receiptsMap.set(receiptNo, {
          receiptNo,
          primaryTxId: tx.id,
          allTxIds: [tx.id],
          totalAmount: Number(tx.amount || 0),
          walletType: (tx.wallet_type as WalletType) || 'cash_in_hand',
          createdAt: tx.created_at,
          memberId: tx.profile_id || null,
          memberName,
          memberPhone,
          groupId: tx.group_id || null,
          groupName,
          ticketNumber: ticketNum,
          cycleMonth: tx.cycle_month ?? 1,
          isMultiMonth: parsedAllocations.length > 1,
          allocations: parsedAllocations,
          notes: tx.notes || '',
          proofUrl: tx.verification_proof_url || null,
          transaction: tx,
          groupObj: group,
          memberObj: {
            id: tx.profile_id,
            name: memberName,
            phone: memberPhone,
            ticket: ticketNum,
          },
        });
      }
    });

    return Array.from(receiptsMap.values());
  }, [rawTransactions, groupsMap, profilesMap, membersMap]);

  // ── Filtering & Searching ──
  const filteredReceipts = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return consolidatedReceipts.filter((item) => {
      // 1. Date Scope Filter
      const txTime = new Date(item.createdAt).getTime();
      if (dateFilter === 'today' && txTime < todayStart) return false;
      if (dateFilter === '7days' && txTime < sevenDaysAgo) return false;
      if (dateFilter === 'month' && txTime < thisMonthStart) return false;
      if (dateFilter === 'custom') {
        if (customStartDate && txTime < new Date(customStartDate + 'T00:00:00').getTime()) return false;
        if (customEndDate && txTime > new Date(customEndDate + 'T23:59:59').getTime()) return false;
      }

      // 2. Chit Group Filter
      if (selectedGroupId !== 'all' && item.groupId !== selectedGroupId) return false;

      // 3. Wallet / Account Filter
      if (selectedWallet !== 'all' && item.walletType !== selectedWallet) return false;

      // 4. Free-Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const rNo = item.receiptNo.toLowerCase();
        const mName = item.memberName.toLowerCase();
        const mPhone = item.memberPhone.toLowerCase();
        const gName = item.groupName.toLowerCase();
        const amtStr = item.totalAmount.toString();
        const formattedAmt = `₹${item.totalAmount.toLocaleString('en-IN')}`.toLowerCase();
        const ticketStr = `ticket #${item.ticketNumber}`.toLowerCase();
        const monthStr = `month ${item.cycleMonth}`.toLowerCase();

        return (
          rNo.includes(q) ||
          mName.includes(q) ||
          mPhone.includes(q) ||
          gName.includes(q) ||
          amtStr.includes(q) ||
          formattedAmt.includes(q) ||
          ticketStr.includes(q) ||
          monthStr.includes(q)
        );
      }

      return true;
    }).sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOrder === 'amount_desc') return b.totalAmount - a.totalAmount;
      if (sortOrder === 'amount_asc') return a.totalAmount - b.totalAmount;
      return 0;
    });
  }, [
    consolidatedReceipts,
    dateFilter,
    customStartDate,
    customEndDate,
    selectedGroupId,
    selectedWallet,
    searchQuery,
    sortOrder,
  ]);

  // ── Metrics & Totals Calculation ──
  const metrics = useMemo(() => {
    const totalCount = filteredReceipts.length;
    let totalVolume = 0;
    let cashVolume = 0;
    let digitalVolume = 0;

    filteredReceipts.forEach((r) => {
      totalVolume += r.totalAmount;
      if (r.walletType === 'cash_in_hand') {
        cashVolume += r.totalAmount;
      } else {
        digitalVolume += r.totalAmount;
      }
    });

    const avgAmount = totalCount > 0 ? Math.round(totalVolume / totalCount) : 0;

    return {
      totalCount,
      totalVolume,
      cashVolume,
      digitalVolume,
      avgAmount,
    };
  }, [filteredReceipts]);

  // ── Copy Helper ──
  const handleCopyReceiptNo = (receiptNo: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(receiptNo);
    setCopiedId(receiptNo);
    triggerHapticFeedback('light');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── WhatsApp Share Helper ──
  const handleShareWhatsApp = (item: ConsolidatedReceiptItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHapticFeedback('light');

    const dateStr = new Date(item.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const walletLabel =
      item.walletType === 'cash_in_hand'
        ? 'Physical Cash Box'
        : item.walletType === 'kishor_bank'
        ? 'Kishor Bank (UPI)'
        : item.walletType === 'dad_bank'
        ? "Dad's Bank Account"
        : "Mom's Account";

    const msg =
      `🧾 *OFFICIAL PAYMENT RECEIPT*\n` +
      `--------------------------------\n` +
      `*Receipt No:* \`${item.receiptNo}\`\n` +
      `*Subscriber:* ${item.memberName} (Ticket #${item.ticketNumber})\n` +
      `*Chit Group:* ${item.groupName}\n` +
      `*Amount Received:* ₹${item.totalAmount.toLocaleString('en-IN')}\n` +
      `*Payment Mode:* ${walletLabel}\n` +
      `*Cycle Month:* ${item.isMultiMonth ? 'Multi-Month Settlement' : `Month ${item.cycleMonth}`}\n` +
      `*Date & Time:* ${dateStr}\n` +
      `*Status:* Confirmed & Audited in System Ledger ✓\n` +
      `--------------------------------\n` +
      `_Issued by ${organizationName || 'Chit Funds Management'}_`;

    const cleanPhone = (item.memberPhone || '').replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* ── HEADER BANNER: SEARCH, REFRESH, TOTALS ── */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/70 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs">
              <Receipt size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                  Receipts Archive &amp; Search
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Search, verify, download, and re-issue all member payment receipts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => fetchReceiptsData(true)}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh Receipts"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-indigo-600' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* ── KEY SUMMARY STATS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Receipts Issued
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 font-mono">
                {metrics.totalCount}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">receipts</span>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
              Total Collected
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-emerald-800 font-mono">
                ₹{metrics.totalVolume.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
              Cash Box Portion
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-800 font-mono">
                ₹{metrics.cashVolume.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block mb-1">
              Bank / UPI Digital
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-indigo-800 font-mono">
                ₹{metrics.digitalVolume.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* ── SEARCH & PRIMARY FILTER BAR ── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 pt-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Receipt No (e.g. RCP-20261113-1705-4B92), member name, phone, or group..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Date Presets (Scrollable on mobile) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7days', label: '7 Days' },
                { id: 'month', label: 'This Month' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setDateFilter(t.id);
                  triggerHapticFeedback('light');
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  dateFilter === t.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowFiltersModal(true)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedGroupId !== 'all' || selectedWallet !== 'all' || dateFilter === 'custom'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>More Filters</span>
              {(selectedGroupId !== 'all' || selectedWallet !== 'all' || dateFilter === 'custom') && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(selectedGroupId !== 'all' || selectedWallet !== 'all' || dateFilter === 'custom') && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-[11px]">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Active Filters:</span>
            {selectedGroupId !== 'all' && (
              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold flex items-center gap-1">
                <span>Group: {groupsMap[selectedGroupId]?.name || 'Selected Group'}</span>
                <button type="button" onClick={() => setSelectedGroupId('all')} className="hover:text-indigo-900 cursor-pointer">
                  <X size={11} />
                </button>
              </span>
            )}
            {selectedWallet !== 'all' && (
              <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center gap-1 capitalize">
                <span>Vault: {selectedWallet.replace(/_/g, ' ')}</span>
                <button type="button" onClick={() => setSelectedWallet('all')} className="hover:text-amber-950 cursor-pointer">
                  <X size={11} />
                </button>
              </span>
            )}
            {dateFilter === 'custom' && (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
                <span>Range: {customStartDate || 'Start'} → {customEndDate || 'End'}</span>
                <button type="button" onClick={() => setDateFilter('all')} className="hover:text-emerald-950 cursor-pointer">
                  <X size={11} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedGroupId('all');
                setSelectedWallet('all');
                setDateFilter('all');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-slate-400 hover:text-rose-600 font-bold underline cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── RECEIPTS STREAM: MOBILE CARDS (md:hidden) ── */}
      <div className="md:hidden space-y-3 pb-24">
        {loading ? (
          <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
            <RefreshCw size={18} className="animate-spin text-indigo-600 mx-auto mb-2" />
            <span>Loading receipt vault...</span>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
            <Receipt size={28} className="text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No receipts found</p>
            <p className="text-[11px] text-slate-400">Try modifying your search keywords or active filters.</p>
          </div>
        ) : (
          filteredReceipts.map((item) => {
            const dt = new Date(item.createdAt);
            const dateStr = dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

            return (
              <div
                key={item.receiptNo}
                onClick={() => setSelectedReceipt(item)}
                className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-300 transition-all cursor-pointer active:scale-[0.99] space-y-3"
              >
                {/* Header: Receipt Number Badge & Time */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-xs text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <span>{item.receiptNo}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyReceiptNo(item.receiptNo, e)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Copy Receipt No"
                    >
                      {copiedId === item.receiptNo ? (
                        <Check size={12} className="text-emerald-600 font-bold" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                    <Clock size={11} />
                    <span>{dateStr}, {timeStr}</span>
                  </div>
                </div>

                {/* Member & Group Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="font-black text-sm text-slate-900 leading-tight">
                      {item.memberName}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {item.groupName} · Ticket #{item.ticketNumber}
                    </p>
                  </div>

                  {/* Paid Amount */}
                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-base text-emerald-700 block">
                      ₹{item.totalAmount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block capitalize">
                      {item.walletType.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Badges & Actions Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {item.isMultiMonth
                        ? `Multi-Month (${item.allocations.map((a) => `M${a.month}`).join(', ')})`
                        : `Month ${item.cycleMonth}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Paid ✓
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => handleShareWhatsApp(item, e)}
                      className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                      title="Share via WhatsApp"
                    >
                      <Share2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(item)}
                      className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── RECEIPTS STREAM: DESKTOP TABLE (hidden md:block) ── */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                <th className="py-3 px-4">Receipt Number</th>
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3">Subscriber &amp; Ticket</th>
                <th className="py-3 px-3">Chit Group</th>
                <th className="py-3 px-3">Cycle Month</th>
                <th className="py-3 px-3">Mode</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin text-indigo-600 mx-auto mb-2" />
                    <span>Loading receipt vault records...</span>
                  </td>
                </tr>
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt size={28} className="text-slate-300 mx-auto mb-1.5" />
                    <p className="font-bold text-slate-700 text-xs">No matching receipts found</p>
                    <p className="text-[11px] text-slate-400">Try adjusting your search terms or filter constraints.</p>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((item) => {
                  const dt = new Date(item.createdAt);
                  const dateStr = dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                  return (
                    <tr
                      key={item.receiptNo}
                      onClick={() => setSelectedReceipt(item)}
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                    >
                      {/* Receipt No */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs text-indigo-950 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg">
                            {item.receiptNo}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyReceiptNo(item.receiptNo, e)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Copy Receipt Number"
                          >
                            {copiedId === item.receiptNo ? (
                              <Check size={12} className="text-emerald-600 font-bold" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        <div>{dateStr}</div>
                        <div className="text-[10px] text-slate-400">{timeStr}</div>
                      </td>

                      {/* Member */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs">{item.memberName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ticket #{item.ticketNumber} {item.memberPhone ? `· ${item.memberPhone}` : ''}
                        </div>
                      </td>

                      {/* Chit Group */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-700">{item.groupName}</span>
                      </td>

                      {/* Cycle Month */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.isMultiMonth
                            ? `Multi (${item.allocations.map((a) => `M${a.month}`).join(', ')})`
                            : `Month ${item.cycleMonth}`}
                        </span>
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200 capitalize">
                          {item.walletType.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono font-black text-sm text-emerald-700">
                        ₹{item.totalAmount.toLocaleString('en-IN')}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleShareWhatsApp(item, e)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Share on WhatsApp"
                          >
                            <Share2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(item)}
                            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                          >
                            <Eye size={12} />
                            <span>View</span>
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

        {/* Table Footer */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-800">{filteredReceipts.length}</span> of{' '}
            <span className="font-bold text-slate-800">{consolidatedReceipts.length}</span> receipts
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Active Vault Balance: Cash ₹{(balances['cash_in_hand'] ?? 0).toLocaleString('en-IN')} · Bank ₹{((balances['kishor_bank'] ?? 0) + (balances['dad_bank'] ?? 0) + (balances['mom_bank'] ?? 0)).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* ── MORE FILTERS MODAL ── */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setShowFiltersModal(false)}
          />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 z-10 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-indigo-600" />
                <h3 className="font-black text-slate-900 text-base">Filter Receipts</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter 1: Chit Group */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Chit Group
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="all">All Chit Groups</option>
                {Object.values(groupsMap).map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 2: Payment Wallet */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Collection Vault / Method
              </label>
              <select
                value={selectedWallet}
                onChange={(e) => setSelectedWallet(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="all">All Accounts / Vaults</option>
                <option value="cash_in_hand">Cash Box (Physical Notes)</option>
                <option value="kishor_bank">Kishor Bank (UPI / NetBanking)</option>
                <option value="dad_bank">Dad's Bank Account</option>
                <option value="mom_bank">Mom's Account</option>
              </select>
            </div>

            {/* Filter 3: Custom Date Range */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Custom Date Range
                </label>
                {dateFilter === 'custom' && (
                  <span className="text-[10px] font-bold text-indigo-600">Active</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">Start Date</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setDateFilter('custom');
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5">End Date</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setDateFilter('custom');
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Filter 4: Sort Order */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Sort Ordering
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="newest">Newest Receipts First</option>
                <option value="oldest">Oldest Receipts First</option>
                <option value="amount_desc">Highest Amount First</option>
                <option value="amount_asc">Lowest Amount First</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupId('all');
                  setSelectedWallet('all');
                  setDateFilter('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setSortOrder('newest');
                }}
                className="text-xs text-slate-500 hover:text-rose-600 font-bold underline cursor-pointer"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Apply Filters ({filteredReceipts.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMBEDDED PAYMENT RECEIPT MODAL VIEWER ── */}
      {selectedReceipt && (
        <PaymentReceiptModal
          isOpen={Boolean(selectedReceipt)}
          onClose={() => setSelectedReceipt(null)}
          transaction={selectedReceipt.transaction}
          member={selectedReceipt.memberObj}
          group={selectedReceipt.groupObj || {
            id: selectedReceipt.groupId,
            name: selectedReceipt.groupName,
            monthly_installment: selectedReceipt.totalAmount,
          }}
          month={selectedReceipt.cycleMonth}
          totalDue={selectedReceipt.totalAmount}
          allocations={selectedReceipt.allocations}
          totalCollectedAmount={selectedReceipt.totalAmount}
          pastPendingDues={0}
        />
      )}
    </div>
  );
}

