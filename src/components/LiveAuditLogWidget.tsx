'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { triggerHapticFeedback } from '@/utils/haptics';
import {
  ShieldAlert,
  Clock,
  ExternalLink,
  RefreshCw,
  Tag,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export interface LiveAuditLogWidgetProps {
  onViewFullReport?: () => void;
  className?: string;
  limit?: number;
}

interface RawAuditLogItem {
  id: string;
  admin_id: string | null;
  action_description: string;
  target_table: string;
  timestamp: string;
  profiles?: {
    full_name?: string | null;
    role?: string | null;
  } | null;
}

interface FormattedWidgetLog {
  id: string;
  rawDesc: string;
  title: string;
  categoryLabel: string;
  badgeClass: string;
  dotColor: string;
  icon: string;
  amount?: string;
  wallet?: string;
  memberName?: string;
  groupName?: string;
  executor: string;
  role: string;
  timeStr: string;
  dateStr: string;
  relativeTime: string;
}

export default function LiveAuditLogWidget({
  onViewFullReport,
  className = '',
  limit = 8,
}: LiveAuditLogWidgetProps) {
  const [logs, setLogs] = useState<RawAuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [directoryProfiles, setDirectoryProfiles] = useState<Record<string, string>>({});
  const [directoryGroups, setDirectoryGroups] = useState<Record<string, string>>({});

  // ── Fetch Audit Logs & Directory Metadata ──
  const fetchRecentLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [logsRes, profilesRes, groupsRes] = await Promise.all([
        supabase
          .from('security_audit_logs')
          .select(`
            id,
            admin_id,
            action_description,
            target_table,
            timestamp,
            profiles:admin_id (
              full_name,
              role
            )
          `)
          .order('timestamp', { ascending: false })
          .limit(60),
        supabase.from('profiles').select('id, full_name'),
        supabase.from('chit_groups').select('id, name'),
      ]);

      if (logsRes.data) {
        setLogs(logsRes.data as unknown as RawAuditLogItem[]);
      }

      if (profilesRes.data) {
        const pMap: Record<string, string> = {};
        profilesRes.data.forEach((p: any) => {
          pMap[p.id] = p.full_name || 'Member';
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
    } catch (err) {
      console.warn('Could not load live audit widget logs:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentLogs();

    // Live PostgreSQL realtime channel
    const channelName = `live_audit_widget_stream_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_audit_logs' },
        () => {
          fetchRecentLogs(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecentLogs]);

  // ── Relative Time Helper ──
  const getRelativeTime = (isoString: string): string => {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  // ── Format & Filter Logs (Clean Mode Matching SystemAuditLogViewer) ──
  const formattedLogs = useMemo<FormattedWidgetLog[]>(() => {
    const results: FormattedWidgetLog[] = [];

    for (const log of logs) {
      const rawDesc = (log.action_description || '').trim();
      const rawDescUpper = rawDesc.toUpperCase();
      const table = (log.target_table || '').toLowerCase();

      // 1. FILTER OUT LOW-LEVEL RAW DATABASE TRIGGER ECHOES (Clean Mode)
      if (
        table === 'global_treasury' &&
        (rawDescUpper.includes('SYNCHRONIZED MULTI-VAULT') ||
          rawDescUpper.includes('UPDATE ON TREASURY WALLET') ||
          rawDescUpper.startsWith('UPDATE ACTION ON RECORD ID') ||
          rawDescUpper.startsWith('INSERT ACTION ON RECORD ID'))
      ) {
        continue;
      }

      if (
        table === 'transactions' &&
        (rawDescUpper.startsWith('INSERT ACTION ON RECORD ID') ||
          rawDescUpper.startsWith('UPDATE ACTION ON RECORD ID') ||
          rawDescUpper === 'RECORDED FINANCIAL PAYMENT TRANSACTION' ||
          rawDescUpper.includes('RECORDED FINANCIAL PAYMENT TRANSACTION'))
      ) {
        continue;
      }

      if (
        table === 'profiles' &&
        (rawDescUpper.includes('VERIFIED PIN & REFRESHED DIGITAL PASSBOOK SESSION') ||
          rawDescUpper.includes('REFRESHED SECURITY SESSION & PROFILE TOKEN') ||
          rawDescUpper.includes('REFRESHED DIGITAL PASSBOOK KEY'))
      ) {
        continue;
      }

      // 2. TRANSLATE ANY LEGACY TRIGGER ACTION IF VALID
      let title = rawDesc;
      const rawMatch = rawDesc.match(/^(INSERT|UPDATE|DELETE)\s+action on record ID:\s*([0-9a-f-]{36})/i);
      if (rawMatch) {
        const op = rawMatch[1].toUpperCase();
        const recordId = rawMatch[2].toLowerCase();
        if (table === 'profiles') {
          const name = directoryProfiles[recordId];
          title = op === 'INSERT' ? `Created member profile for ${name || 'Subscriber'}` : `Updated member profile details`;
        } else if (table === 'chit_groups') {
          const gName = directoryGroups[recordId];
          title = op === 'INSERT' ? `Created chit group "${gName || 'Group'}"` : `Updated group configuration`;
        } else if (table === 'group_members') {
          title = op === 'INSERT' ? 'Enrolled member into chit ticket' : 'Updated member ticket allocation';
        } else {
          continue; // Skip other untranslated raw triggers
        }
      }

      // 3. CLASSIFY CATEGORY & STYLING
      let categoryLabel = 'System & Audit';
      let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
      let dotColor = 'bg-slate-400';
      let icon = '🛡️';

      if (rawDescUpper.includes('REVERT') || rawDescUpper.includes('ROLLBACK')) {
        categoryLabel = 'Reversal';
        badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
        dotColor = 'bg-rose-500';
        icon = '⚠️';
      } else if (
        rawDescUpper.includes('COLLECTION') ||
        rawDescUpper.includes('RECEIVED') ||
        rawDescUpper.includes('PAYMENT') ||
        rawDescUpper.includes('FIFO CREDIT')
      ) {
        categoryLabel = 'Collection';
        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        dotColor = 'bg-emerald-500';
        icon = '💰';
      } else if (
        rawDescUpper.includes('PAYOUT') ||
        rawDescUpper.includes('DISBURSE') ||
        rawDescUpper.includes('PRIZE POT') ||
        rawDescUpper.includes('SETTLEMENT')
      ) {
        categoryLabel = 'Prize Payout';
        badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
        dotColor = 'bg-blue-500';
        icon = '🏆';
      } else if (
        rawDescUpper.includes('LAUNCH') ||
        rawDescUpper.includes('ADVANCED') ||
        rawDescUpper.includes('CYCLE') ||
        table === 'chit_groups'
      ) {
        categoryLabel = 'Chit Cycle';
        badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        dotColor = 'bg-indigo-500';
        icon = '🔄';
      } else if (
        rawDescUpper.includes('ATM') ||
        rawDescUpper.includes('TREASURY') ||
        rawDescUpper.includes('CASH BOX') ||
        rawDescUpper.includes('PERSONAL DRAW') ||
        rawDescUpper.includes('TRANSFER') ||
        table === 'global_treasury'
      ) {
        categoryLabel = 'Treasury';
        badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
        dotColor = 'bg-amber-500';
        icon = '🏛️';
      } else if (
        rawDescUpper.includes('MEMBER') ||
        rawDescUpper.includes('PROFILE') ||
        rawDescUpper.includes('TICKET') ||
        table === 'profiles' ||
        table === 'group_members'
      ) {
        categoryLabel = 'Member';
        badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
        dotColor = 'bg-purple-500';
        icon = '👤';
      } else if (rawDescUpper.includes('AUCTION') || rawDescUpper.includes('BID') || table === 'auction_logs') {
        categoryLabel = 'Live Auction';
        badgeClass = 'bg-cyan-50 text-cyan-700 border-cyan-200';
        dotColor = 'bg-cyan-500';
        icon = '🔨';
      }

      // 4. EXTRACT CONTEXT PILLS
      const amtMatch = rawDesc.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      const amount = amtMatch ? `₹${amtMatch[1]}` : undefined;

      const groupMatch = rawDesc.match(/"([^"]+)"/);
      const groupName = groupMatch ? groupMatch[1] : undefined;

      let memberName: string | undefined;
      const memMatch = rawDesc.match(/(?:for|from|to)\s+([A-Za-z0-9\s.]+?)(?=\s+(?:\(|via|\[|\-|,|at|\bTicket\b|\bin\b|$))/i);
      if (memMatch && memMatch[1]) {
        const cand = memMatch[1].trim();
        if (!['the', 'a', 'each', 'all', 'member', 'ticket', 'cash', 'bank'].includes(cand.toLowerCase())) {
          memberName = cand;
        }
      }

      let wallet: string | undefined;
      if (/cash in hand|cash_in_hand|cash box/i.test(rawDesc)) wallet = 'Cash Box';
      else if (/kishor bank|kishor_bank/i.test(rawDesc)) wallet = 'Kishor Bank';
      else if (/dad bank|dad_bank/i.test(rawDesc)) wallet = 'Dad Bank';
      else if (/mom bank|mom_bank/i.test(rawDesc)) wallet = 'Mom Bank';
      else if (/upi/i.test(rawDesc)) wallet = 'UPI';

      const dt = new Date(log.timestamp);
      const isToday = dt.toDateString() === new Date().toDateString();
      const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      const dateStr = isToday ? 'Today' : dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      const relativeTime = getRelativeTime(log.timestamp);

      const executorName = log.profiles?.full_name || 'Dr. Kishor Anbazhakan';
      const executorRole = (log.profiles?.role || 'admin').toLowerCase();

      results.push({
        id: log.id,
        rawDesc,
        title,
        categoryLabel,
        badgeClass,
        dotColor,
        icon,
        amount,
        wallet,
        memberName,
        groupName,
        executor: executorName,
        role: executorRole,
        timeStr,
        dateStr,
        relativeTime,
      });

      if (results.length >= limit) break;
    }

    return results;
  }, [logs, directoryProfiles, directoryGroups, limit]);

  return (
    <div className={`bg-white border border-slate-200/90 rounded-2xl p-4 md:p-5 shadow-xs space-y-3 ${className}`}>
      {/* ── WIDGET HEADER ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldAlert size={16} />
          </div>
          <div>
            <h3 className="font-black text-xs md:text-sm text-slate-900 leading-tight">
              Live System Activity Feed
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Realtime audit events &amp; staff actions</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Synced</span>
          </span>
          <button
            type="button"
            onClick={() => fetchRecentLogs(true)}
            disabled={isRefreshing}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh stream"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* ── STRUCTURED AUDIT FEED (CLEAN & IDENTICAL TO SYSTEMAUDITLOGVIEWER) ── */}
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5 scrollbar-thin">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1.5">
            <RefreshCw size={16} className="animate-spin text-indigo-600 mx-auto" />
            <p>Syncing live audit events...</p>
          </div>
        ) : formattedLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-600">No recent activity logged</p>
            <p className="text-[11px]">Staff actions and collections will appear here live.</p>
          </div>
        ) : (
          formattedLogs.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                triggerHapticFeedback('light');
                if (onViewFullReport) onViewFullReport();
              }}
              className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-indigo-50/40 border border-slate-200/80 hover:border-indigo-200/80 transition-all cursor-pointer group space-y-1.5"
            >
              {/* Card Header: Category Pill & Relative Time */}
              <div className="flex items-center justify-between text-[10px]">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${item.badgeClass}`}
                >
                  <span className={`w-1 h-1 rounded-full ${item.dotColor}`} />
                  <span>{item.categoryLabel}</span>
                </span>

                <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
                  <Clock size={10} />
                  <span>{item.relativeTime}</span>
                </div>
              </div>

              {/* Action Description */}
              <p className="font-bold text-slate-800 text-[11px] leading-snug group-hover:text-indigo-950 transition-colors line-clamp-2">
                {item.title}
              </p>

              {/* Context Badges (Amount, Wallet, Member, Group) */}
              <div className="flex flex-wrap items-center gap-1 text-[10px]">
                {item.amount && (
                  <span className="font-mono font-black px-1.5 py-0.2 rounded bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                    {item.amount}
                  </span>
                )}
                {item.wallet && (
                  <span className="font-bold px-1.5 py-0.2 rounded bg-amber-100/70 text-amber-800 border border-amber-200 capitalize">
                    {item.wallet}
                  </span>
                )}
                {item.memberName && (
                  <span className="font-semibold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    {item.memberName}
                  </span>
                )}
                {item.groupName && (
                  <span className="font-semibold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {item.groupName}
                  </span>
                )}
              </div>

              {/* Executor Footer */}
              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span className="truncate max-w-[180px]">
                  By <strong className="text-slate-600 font-semibold">{item.executor}</strong>
                  {item.role && (
                    <span className="uppercase text-[9px] text-slate-400 font-bold ml-1">
                      ({item.role})
                    </span>
                  )}
                </span>
                <span className="font-mono text-[9px] text-slate-400">
                  {item.dateStr}, {item.timeStr}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── WIDGET FOOTER ── */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Realtime audit ledger</span>
        </span>
        {onViewFullReport && (
          <button
            type="button"
            onClick={() => {
              triggerHapticFeedback('light');
              onViewFullReport();
            }}
            className="font-bold text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Full System Logs</span>
            <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

