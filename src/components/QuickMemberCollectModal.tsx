'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { 
  X, 
  Search, 
  QrCode, 
  User, 
  Coins, 
  ArrowRight, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle, 
  Link as LinkIcon,
  RefreshCw,
  Phone
} from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';
import PassbookScannerModal from '@/components/PassbookScannerModal';

export interface CollectableMember {
  id: string; // group_member id
  profileId?: string;
  name: string;
  phone: string;
  ticket: number;
  groupId: string;
  groupName: string;
  totalChitValue: number;
  durationMonths: number;
  currentMonth: number;
  customInstallment?: number | null;
  effectiveDue: number;
  paidThisMonth: number;
  remainingThisMonth: number;
  totalPendingToday: number;
  status: 'paid' | 'partial' | 'unpaid';
  passbookToken?: string;
}

interface QuickMemberCollectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember: (member: CollectableMember) => void;
  activeGroupId?: string | null;
  activeMonth?: number;
}

export default function QuickMemberCollectModal({
  isOpen,
  onClose,
  onSelectMember,
  activeGroupId,
  activeMonth,
}: QuickMemberCollectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [allMembers, setAllMembers] = useState<CollectableMember[]>([]);
  const [allGroupsList, setAllGroupsList] = useState<{ id: string; name: string }[]>([]);

  // Passbook QR Scanner states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [unlinkedTokenFound, setUnlinkedTokenFound] = useState<string | null>(null);
  const [isPairingToken, setIsPairingToken] = useState(false);

  // Load all active groups, members, and transactions to compute current dues
  const fetchAllActiveMembers = async () => {
    try {
      setLoading(true);

      // 1. Fetch active chit groups
      const { data: groupsData, error: groupsErr } = await supabase
        .from('chit_groups')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (groupsErr) throw groupsErr;

      const activeGroups = groupsData || [];
      setAllGroupsList(activeGroups.map(g => ({ id: g.id, name: g.name })));

      if (activeGroups.length === 0) {
        setAllMembers([]);
        return;
      }

      // 2. Fetch group members joined with profiles
      const { data: memberRows, error: membersErr } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          ticket_number,
          has_won_regular,
          profile_id,
          custom_installment,
          profiles:profile_id (
            id,
            full_name,
            phone_number,
            passbook_token
          )
        `)
        .in('group_id', activeGroups.map(g => g.id))
        .order('ticket_number', { ascending: true });

      if (membersErr) throw membersErr;

      // 3. Fetch collection transactions
      const { data: txsData } = await supabase
        .from('transactions')
        .select('id, group_id, profile_id, group_member_id, amount, notes, type')
        .in('group_id', activeGroups.map(g => g.id))
        .eq('type', 'collection');

      const transactions = txsData || [];

      // Helper to compute member paid amount for a given month
      const getPaidAmount = (memberProfileId: string | undefined, memberId: string, grpId: string, mNum: number) => {
        return transactions
          .filter(t => {
            if (t.group_id !== grpId) return false;
            const matchesMember = (
              (memberProfileId && t.profile_id === memberProfileId) ||
              (memberId && t.group_member_id === memberId)
            );
            if (!matchesMember) return false;
            if (!t.notes) return true;
            const match = t.notes.match(/\bMonth\s+(\d+)\b/i) || t.notes.match(/\bM(\d+)\b/i);
            if (match) {
              return Number(match[1]) === Number(mNum);
            }
            return true;
          })
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      };

      // 4. Map into CollectableMember array
      const mappedList: CollectableMember[] = (memberRows || []).map((row: any) => {
        const grp = activeGroups.find(g => g.id === row.group_id);
        const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        const totalVal = Number(grp?.total_value || 200000);
        const duration = Number(grp?.duration_months || grp?.member_count || 20);
        const currentMonth = (grp?.current_month !== undefined && grp?.current_month !== null) ? Number(grp.current_month) : 0;
        const isLaaba = Number(grp?.kai_iruppu_pool || 0) >= totalVal && currentMonth > 0;

        const baseInstallment = Math.round(totalVal / duration);
        const effectiveDue = isLaaba ? 0 : (row.custom_installment ? Number(row.custom_installment) : baseInstallment);
        
        const paidThisMonth = getPaidAmount(row.profile_id, row.id, row.group_id, currentMonth);
        const remainingThisMonth = Math.max(0, effectiveDue - paidThisMonth);
        const status: 'paid' | 'partial' | 'unpaid' = remainingThisMonth === 0 ? 'paid' : paidThisMonth > 0 ? 'partial' : 'unpaid';

        // Calculate cumulative pending up to current month
        let totalDueUpToNow = 0;
        let totalPaidUpToNow = 0;
        for (let m = 0; m <= currentMonth; m++) {
          const mDue = isLaaba && m > 0 ? 0 : (row.custom_installment ? Number(row.custom_installment) : baseInstallment);
          totalDueUpToNow += mDue;
          totalPaidUpToNow += getPaidAmount(row.profile_id, row.id, row.group_id, m);
        }
        const totalPendingToday = Math.max(0, totalDueUpToNow - totalPaidUpToNow);

        return {
          id: row.id,
          profileId: row.profile_id,
          name: prof?.full_name || `Subscriber (Ticket #${row.ticket_number})`,
          phone: prof?.phone_number || '',
          ticket: Number(row.ticket_number),
          groupId: row.group_id,
          groupName: grp?.name || 'Chit Group',
          totalChitValue: totalVal,
          durationMonths: duration,
          currentMonth,
          customInstallment: row.custom_installment ? Number(row.custom_installment) : null,
          effectiveDue,
          paidThisMonth,
          remainingThisMonth,
          totalPendingToday,
          status,
          passbookToken: prof?.passbook_token || undefined,
        };
      });

      setAllMembers(mappedList);
    } catch (err) {
      console.error('Error fetching members for Quick Collect:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAllActiveMembers();
      setSearchQuery('');
      setUnlinkedTokenFound(null);
      if (activeGroupId) {
        setSelectedGroupFilter(activeGroupId);
      } else {
        setSelectedGroupFilter('all');
      }
    }
  }, [isOpen, activeGroupId]);

  // Filtered members list based on search and group filter
  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allMembers.filter(m => {
      if (selectedGroupFilter !== 'all' && m.groupId !== selectedGroupFilter) {
        return false;
      }
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.ticket.toString() === q ||
        `#${m.ticket}`.includes(q) ||
        m.groupName.toLowerCase().includes(q)
      );
    });
  }, [allMembers, searchQuery, selectedGroupFilter]);

  // Handle Passbook QR Scan Result
  const handleScanSuccess = async (scannedText: string) => {
    try {
      setIsScannerOpen(false);

      let token = scannedText.trim();
      if (token.includes('key=')) {
        try {
          const url = new URL(token);
          token = url.searchParams.get('key') || token;
        } catch {
          const m = token.match(/[?&]key=([0-9a-fA-F-]{36})/);
          if (m && m[1]) token = m[1];
        }
      }

      // 1. Check if token belongs to an already-linked subscriber
      const matchedMember = allMembers.find(m => m.passbookToken && m.passbookToken.toLowerCase() === token.toLowerCase());

      if (matchedMember) {
        triggerHapticFeedback('success');
        onClose();
        onSelectMember(matchedMember);
        return;
      }

      // 2. Query profile directly by passbook_token in Supabase
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id, full_name, passbook_token')
        .eq('passbook_token', token)
        .maybeSingle();

      if (profileRow) {
        const memberInGroup = allMembers.find(m => m.profileId === profileRow.id);
        if (memberInGroup) {
          triggerHapticFeedback('success');
          onClose();
          onSelectMember(memberInGroup);
          return;
        }
      }

      // 3. Token is valid QR format, but unassigned to any member yet
      // Check if it exists in passbook_inventory or is an official token
      const { data: invRow } = await supabase
        .from('passbook_inventory')
        .select('id, token, batch_code')
        .eq('token', token)
        .maybeSingle();

      if (invRow || token.length === 36) {
        triggerHapticFeedback('warning');
        setUnlinkedTokenFound(token);
      } else {
        alert('Unrecognized QR code. Please scan an official Passbook QR sticker.');
      }
    } catch (err: any) {
      console.error('Error handling QR scan:', err);
      alert('Error verifying QR code: ' + err.message);
    }
  };

  // Pair unlinked scanned QR token with selected subscriber
  const handlePairAndProceed = async (targetMember: CollectableMember) => {
    if (!unlinkedTokenFound || !targetMember.profileId) return;

    try {
      setIsPairingToken(true);
      const { data, error } = await supabase.rpc('pair_passbook_qr', {
        p_token: unlinkedTokenFound,
        p_profile_id: targetMember.profileId,
      });

      if (error) throw error;
      if (!data || !data.success) throw new Error(data?.error || 'Failed to pair QR code.');

      triggerHapticFeedback('success');
      alert(`✅ Passbook QR sticker successfully paired to ${targetMember.name}! Opening payment modal...`);

      setUnlinkedTokenFound(null);
      onClose();
      onSelectMember(targetMember);
    } catch (err: any) {
      console.error('Error pairing QR:', err);
      alert('Failed to link QR code: ' + err.message);
    } finally {
      setIsPairingToken(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg max-h-[90dvh] flex flex-col shadow-2xl relative overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        
        {/* 1. Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Coins size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
                Quick Collect Payment
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Select subscriber or scan their passbook QR sticker
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 2. Search & Passbook QR Scan Bar */}
        <div className="p-3.5 sm:p-4 bg-gray-50/90 border-b border-gray-150 space-y-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {/* Live Search Input */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, phone, ticket #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors shadow-2xs"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Scan Passbook QR Camera Button */}
            <button
              type="button"
              onClick={() => {
                triggerHapticFeedback('light');
                setIsScannerOpen(true);
              }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
              title="Scan member pocket passbook QR sticker"
            >
              <QrCode size={16} />
              <span className="hidden sm:inline">Scan QR</span>
            </button>
          </div>

          {/* Group Filter Pills */}
          {allGroupsList.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedGroupFilter('all')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer ${
                  selectedGroupFilter === 'all'
                    ? 'bg-gray-900 text-white border-black shadow-2xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                All Groups ({allMembers.length})
              </button>
              {allGroupsList.map(g => {
                const count = allMembers.filter(m => m.groupId === g.id).length;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGroupFilter(g.id)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer ${
                      selectedGroupFilter === g.id
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {g.name} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Unlinked QR Pairing Alert Prompt */}
        {unlinkedTokenFound && (
          <div className="p-3.5 bg-amber-50 border-b border-amber-200 text-amber-950 text-xs space-y-2 animate-in fade-in duration-200 shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <LinkIcon size={16} className="text-amber-600 shrink-0" />
                <span>Unlinked Passbook QR Sticker Scanned!</span>
              </div>
              <button 
                type="button" 
                onClick={() => setUnlinkedTokenFound(null)} 
                className="text-amber-600 hover:text-amber-800 text-[10px] font-bold"
              >
                Dismiss
              </button>
            </div>
            <p className="text-[11px] text-amber-800">
              This physical QR sticker [<code>{unlinkedTokenFound.slice(0, 8)}...</code>] is valid but not linked to any subscriber yet.
              <strong className="block mt-0.5">👇 Tap any member below to link this QR sticker to them and record their payment:</strong>
            </p>
          </div>
        )}

        {/* 4. Scrollable Member Selection List */}
        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw size={20} className="animate-spin text-emerald-600" />
              <span>Loading subscribers &amp; live dues...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs space-y-1.5">
              <User size={28} className="mx-auto text-gray-300" />
              <p className="font-bold text-gray-600">No matching subscribers found</p>
              <p className="text-[11px] text-gray-400">Try changing the search query or group filter</p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const initial = member.name.charAt(0).toUpperCase() || 'S';
              const displayDue = member.totalPendingToday > 0 ? member.totalPendingToday : member.remainingThisMonth;

              return (
                <div
                  key={`${member.groupId}-${member.id}`}
                  onClick={() => {
                    triggerHapticFeedback('light');
                    if (unlinkedTokenFound) {
                      handlePairAndProceed(member);
                    } else {
                      onClose();
                      onSelectMember(member);
                    }
                  }}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-[0.98] ${
                    unlinkedTokenFound
                      ? 'bg-amber-50/60 hover:bg-amber-100/70 border-amber-300'
                      : member.status === 'paid'
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200/80'
                        : 'bg-white hover:bg-gray-50 border-gray-200/90 shadow-2xs hover:border-gray-300'
                  }`}
                >
                  {/* Left: Avatar & Member Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow-2xs ${
                      member.status === 'paid'
                        ? 'bg-emerald-600'
                        : member.status === 'partial'
                          ? 'bg-amber-600'
                          : 'bg-gradient-to-br from-indigo-500 to-indigo-700'
                    }`}>
                      {initial}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                          {member.name}
                        </span>
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono shrink-0">
                          #{member.ticket}
                        </span>
                        {member.passbookToken && (
                          <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5" title="Passbook QR Linked">
                            <QrCode size={9} /> QR
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
                        <span className="truncate font-medium text-gray-600 flex items-center gap-1">
                          <Briefcase size={10} className="text-gray-400" />
                          <span>{member.groupName} (M{member.currentMonth})</span>
                        </span>
                        {member.phone && (
                          <span className="text-gray-400 font-mono hidden sm:inline">
                            · {member.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Due Amount & Action */}
                  <div className="text-right shrink-0 flex items-center gap-2.5">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                        {member.status === 'paid' ? 'Paid' : 'Due Amount'}
                      </span>
                      <span className={`text-xs sm:text-sm font-black font-mono block ${
                        member.status === 'paid'
                          ? 'text-emerald-700'
                          : member.status === 'partial'
                            ? 'text-amber-700'
                            : 'text-rose-600'
                      }`}>
                        ₹{displayDue.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="w-7 h-7 rounded-xl bg-gray-100 hover:bg-emerald-100 text-gray-500 hover:text-emerald-700 flex items-center justify-center transition-colors">
                      <ArrowRight size={13} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Camera QR Scanner Modal */}
      <PassbookScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        title="Scan Member Passbook QR"
        subtitle="Point camera at the QR code on the physical pocket passbook"
      />
    </div>
  );
}
