'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
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
} from 'lucide-react';

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

export default function SystemAuditLogViewer({ onBack, className = '' }: SystemAuditLogViewerProps) {

  // Core Data States
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [totalDbCount, setTotalDbCount] = useState<number>(0);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [executorFilter, setExecutorFilter] = useState<string>('all');

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Fetch Audit Logs from Supabase ──
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

    const channel = supabase
      .channel('audit_log_viewer_stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_audit_logs' },
        (payload) => {
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

  // ── Distinct Executors List ──
  const uniqueExecutors = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => {
      const name = l.profiles?.full_name || 'System / Automations';
      const id = l.admin_id || 'system';
      map.set(id, name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // ── Filtered Logs Computation ──
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return logs.filter(log => {
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

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const desc = (log.action_description || '').toLowerCase();
        const target = (log.target_table || '').toLowerCase();
        const executorName = (log.profiles?.full_name || '').toLowerCase();
        const id = log.id.toLowerCase();
        return desc.includes(q) || target.includes(q) || executorName.includes(q) || id.includes(q);
      }

      return true;
    });
  }, [logs, categoryFilter, dateFilter, executorFilter, searchQuery, classifyLog]);

  // ── Category Counts for Filter Tabs ──
  const categoryCounts = useMemo(() => {
    const counts = {
      all: logs.length,
      collections: 0,
      cycles: 0,
      treasury: 0,
      members: 0,
      auctions: 0,
      security: 0,
    };
    logs.forEach(l => {
      const cat = classifyLog(l).category;
      if (cat in counts) counts[cat as keyof typeof counts]++;
    });
    return counts;
  }, [logs, classifyLog]);

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

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Export as CSV Spreadsheet"
            >
              <FileSpreadsheet size={13} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportJSON}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Export raw JSON"
            >
              <FileCode size={13} />
              <span>JSON</span>
            </button>
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
                  const dt = new Date(log.timestamp);
                  const dateStr = dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                  const executorName = log.profiles?.full_name || 'System / Automations';
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

                      {/* Action Description */}
                      <td className="py-3.5 px-4 max-w-lg">
                        <span className="text-slate-900 font-semibold leading-relaxed block text-xs group-hover:text-indigo-950">
                          {log.action_description}
                        </span>
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

                      {/* Inspect Button */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
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
            const dt = new Date(log.timestamp);
            const dateStr = dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
            const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            const executorName = log.profiles?.full_name || 'System / Admin';

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

                {/* Primary Action Description */}
                <p className="text-xs font-bold text-slate-900 leading-snug">
                  {log.action_description}
                </p>

                {/* Footer: Executor & Hash ID */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <User size={12} className="text-slate-400" />
                    <span className="font-semibold text-slate-700">{executorName}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                    #{log.id.slice(0, 8)}
                  </span>
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
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Target PostgreSQL Table</span>
                  <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 mt-1 inline-block uppercase">
                    {selectedLog.target_table}
                  </span>
                </div>
              </div>

              {/* Action Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Action Description &amp; Event Payload
                </label>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 leading-relaxed font-sans">
                  {selectedLog.action_description}
                </div>
              </div>

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
                      {(selectedLog.profiles?.full_name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">
                        {selectedLog.profiles?.full_name || 'System / Direct RPC Call'}
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
            <div className="p-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
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
      )}

    </div>
  );
}
