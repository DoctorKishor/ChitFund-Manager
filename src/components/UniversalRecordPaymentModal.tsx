'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { triggerHapticFeedback } from '@/utils/haptics';
import PassbookScannerModal from '@/components/PassbookScannerModal';
import {
  X,
  Check,
  CheckCircle2,
  Coins,
  Banknote,
  Smartphone,
  Search,
  QrCode,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  Sparkles,
  Upload,
  ShieldCheck,
  User,
  Plus,
  Minus,
  Edit2,
  FileText,
  Share2,
  RefreshCw,
} from 'lucide-react';

export interface EnrolledGroupInfo {
  groupId: string;
  groupMemberId: string;
  groupName: string;
  ticketNumber: number;
  totalValue: number;
  memberCount: number;
  durationMonths: number;
  currentMonth: number;
  customInstallment: number | null;
  baseInstallment: number;
  effectiveInstallment: number;
  status: string;
  // Computed dues
  monthsBreakdown: {
    month: number;
    expectedDue: number;
    alreadyPaid: number;
    remainingDue: number;
    isArrear: boolean;
    isCurrent: boolean;
    isAdvance: boolean;
  }[];
  totalArrearsDue: number;
  currentMonthDue: number;
}

export interface UniversalRecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMemberId?: string | null; // profile_id
  initialGroupMemberId?: string | null; // group_members.id
  initialGroupId?: string | null; // chit_groups.id
  initialMonth?: number | null;
  onPaymentSuccess?: () => void;
  onOpenReceiptModal?: (receiptPayload: any) => void;
}

export default function UniversalRecordPaymentModal({
  isOpen,
  onClose,
  initialMemberId,
  initialGroupMemberId,
  initialGroupId,
  initialMonth,
  onPaymentSuccess,
  onOpenReceiptModal,
}: UniversalRecordPaymentModalProps) {
  const { balances, updateBalance } = useWallet();
  const { profile: currentAdminProfile } = useAuth();

  // ── 1. Search / Member Selection State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Selected Subscriber Identity
  const [selectedMember, setSelectedMember] = useState<{
    id: string; // profile_id
    fullName: string;
    phoneNumber: string;
    passbookToken?: string | null;
  } | null>(null);

  // Enrolled Chits Data
  const [enrolledGroups, setEnrolledGroups] = useState<EnrolledGroupInfo[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  // ── 2. Checklist Selections State (Keyed uniquely by groupMemberId / ticket enrollment) ──
  // Which enrollments are enabled for this payment { [groupMemberId]: boolean }
  const [enabledEnrollments, setEnabledEnrollments] = useState<Record<string, boolean>>({});
  // Which months are selected for each enrollment { [groupMemberId]: number[] }
  const [selectedMonthsMap, setSelectedMonthsMap] = useState<Record<string, number[]>>({});
  // Custom manual amount overrides if any { [groupMemberId]: { [month]: string | number } }
  const [customAmountsMap, setCustomAmountsMap] = useState<Record<string, Record<number, string | number>>>({});

  // ── 3. Payment Mode State ──
  // Primary mode: 'cash' | 'online'
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online'>('cash');
  // If online, which specific bank vault:
  const [onlineBank, setOnlineBank] = useState<WalletType>('kishor_bank');

  // ── 4. Advanced Options Accordion ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [paymentDateType, setPaymentDateType] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customPaymentDate, setCustomPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  // ── 5. Submission & Success State ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedPaymentSummary, setCompletedPaymentSummary] = useState<{
    totalAmount: number;
    walletType: WalletType;
    walletLabel: string;
    memberName: string;
    memberPhone: string;
    receiptPayload: any;
    allocationsSummary: string;
  } | null>(null);

  // ─────────────────────────────────────────────────────────────
  // RESET / INITIAL LOAD
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setSelectedMember(null);
      setEnrolledGroups([]);
      setEnabledEnrollments({});
      setSelectedMonthsMap({});
      setCustomAmountsMap({});
      setSearchQuery('');
      setSearchResults([]);
      setCompletedPaymentSummary(null);
      setPaymentMode('cash');
      setOnlineBank('kishor_bank');
      setShowAdvanced(false);
      setPaymentNote('');
      setReceiptFile(null);
      return;
    }

    // If modal opened with an initial member profile ID
    if (initialMemberId) {
      loadMemberById(initialMemberId);
    } else if (initialGroupMemberId) {
      loadMemberByGroupMemberId(initialGroupMemberId);
    }
  }, [isOpen, initialMemberId, initialGroupMemberId]);

  // Load member by Profile ID
  const loadMemberById = async (profileId: string) => {
    setIsLoadingGroups(true);
    try {
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, passbook_token')
        .eq('id', profileId)
        .single();

      if (!error && prof) {
        setSelectedMember({
          id: prof.id,
          fullName: prof.full_name || 'Subscriber',
          phoneNumber: prof.phone_number || '',
          passbookToken: prof.passbook_token || null,
        });
        await fetchMemberGroupsAndDues(prof.id);
      }
    } catch (err) {
      console.error('Error loading member profile:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // Load member by Group Member Ticket ID
  const loadMemberByGroupMemberId = async (gmId: string) => {
    setIsLoadingGroups(true);
    try {
      const { data: gm, error } = await supabase
        .from('group_members')
        .select('profile_id, group_id')
        .eq('id', gmId)
        .single();

      if (!error && gm && gm.profile_id) {
        await loadMemberById(gm.profile_id);
      }
    } catch (err) {
      console.error('Error loading group member:', err);
      setIsLoadingGroups(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SUBSCRIBER SEARCH (Name, Phone, or QR)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || selectedMember) return;
    const cleanQuery = searchQuery.trim().toLowerCase();
    if (cleanQuery.length === 0) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number, passbook_token')
          .eq('is_deleted', false)
          .or(`full_name.ilike.%${cleanQuery}%,phone_number.ilike.%${cleanQuery}%`)
          .limit(8);

        if (!error && data) {
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, selectedMember]);

  // Handle QR Passbook Scanner Result
  const handleScanPassbook = async (token: string) => {
    setIsScannerOpen(false);
    setIsLoadingGroups(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, passbook_token')
        .eq('passbook_token', token)
        .single();

      if (!error && data) {
        triggerHapticFeedback('success');
        setSelectedMember({
          id: data.id,
          fullName: data.full_name || 'Subscriber',
          phoneNumber: data.phone_number || '',
          passbookToken: data.passbook_token || null,
        });
        await fetchMemberGroupsAndDues(data.id);
      } else {
        triggerHapticFeedback('error');
        alert('Passbook QR token not registered to any subscriber.');
      }
    } catch (err) {
      console.error('QR scan error:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // FETCH ENROLLED GROUPS & DUES FOR MEMBER
  // ─────────────────────────────────────────────────────────────
  const fetchMemberGroupsAndDues = async (profileId: string) => {
    setIsLoadingGroups(true);
    try {
      // 1. Fetch group memberships
      const { data: memberships, error: gmErr } = await supabase
        .from('group_members')
        .select(`
          id,
          ticket_number,
          custom_installment,
          group_id,
          chit_groups:group_id (
            id,
            name,
            total_value,
            member_count,
            duration_months,
            current_month,
            status,
            kai_iruppu_pool
          )
        `)
        .eq('profile_id', profileId);

      if (gmErr || !memberships) {
        console.warn('Error fetching group memberships:', gmErr);
        setIsLoadingGroups(false);
        return;
      }

      // 2. Fetch past collection transactions for this member
      const groupIds = memberships.map((m: any) => m.group_id).filter(Boolean);
      const memberIds = memberships.map((m: any) => m.id).filter(Boolean);
      const { data: txs } = await supabase
        .from('transactions')
        .select('group_id, group_member_id, cycle_month, amount, status, notes')
        .eq('type', 'collection')
        .eq('status', 'completed')
        .in('group_id', groupIds.length > 0 ? groupIds : ['00000000-0000-0000-0000-000000000000'])
        .or(`profile_id.eq.${profileId},group_member_id.in.(${memberIds.join(',') || '00000000-0000-0000-0000-000000000000'})`);

      // 3. Build group info and dues breakdown
      const initialEnabled: Record<string, boolean> = {};
      const initialSelectedMonths: Record<string, number[]> = {};

      const builtGroups: EnrolledGroupInfo[] = memberships.map((m: any) => {
        const cg = m.chit_groups;
        const totalVal = Number(cg.total_value) || 200000;
        const memCount = Number(cg.member_count) || 20;
        const durMonths = Number(cg.duration_months) || 20;
        const currMonth = Number(cg.current_month) || 0;
        const baseInst = Math.round(totalVal / (memCount || 1));
        const effectiveInst = m.custom_installment !== null && m.custom_installment !== undefined
          ? Number(m.custom_installment)
          : baseInst;

        // Group's collection transactions specifically for this ticket
        const grpTxs = (txs || []).filter((t: any) => {
          if (t.group_id !== cg.id) return false;
          // If transaction has group_member_id, match it explicitly
          if (t.group_member_id) {
            return t.group_member_id === m.id;
          }
          // If notes contain Ticket #X, match by ticket number
          if (t.notes && (t.notes.includes(`Ticket #${m.ticket_number}`) || t.notes.includes(`Ticket #${m.ticket_number} `))) {
            return true;
          }
          // If member only has 1 ticket in this group and transaction doesn't specify ticket
          const memberTicketsInThisGroup = memberships.filter((x: any) => x.group_id === cg.id);
          if (memberTicketsInThisGroup.length === 1) {
            return true;
          }
          return false;
        });

        let totalArrearsDue = 0;
        let currentMonthDue = 0;

        // Build cycle-by-cycle breakdown from Month 0 to duration
        const monthsBreakdown = [];
        for (let cycle = 0; cycle <= durMonths; cycle++) {
          const alreadyPaid = grpTxs
            .filter((t: any) => Number(t.cycle_month) === cycle)
            .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

          const expectedDue = effectiveInst;
          const remainingDue = Math.max(0, expectedDue - alreadyPaid);
          const isArrear = cycle < currMonth && remainingDue > 0;
          const isCurrent = cycle === currMonth;
          const isAdvance = cycle > currMonth;

          if (isArrear) {
            totalArrearsDue += remainingDue;
          }
          if (isCurrent) {
            currentMonthDue = remainingDue;
          }

          monthsBreakdown.push({
            month: cycle,
            expectedDue,
            alreadyPaid,
            remainingDue,
            isArrear,
            isCurrent,
            isAdvance,
          });
        }

        // Default selection logic:
        // If initialGroupMemberId provided, enable ONLY that specific ticket.
        // Otherwise, if initialGroupId provided, enable tickets belonging to initialGroupId.
        // Otherwise, enable tickets that have current or arrear dues > 0.
        let shouldEnable = false;
        if (initialGroupMemberId) {
          shouldEnable = m.id === initialGroupMemberId;
        } else if (initialGroupId) {
          shouldEnable = cg.id === initialGroupId;
        } else {
          shouldEnable = (currentMonthDue > 0 || totalArrearsDue > 0);
        }
        initialEnabled[m.id] = shouldEnable;

        // Which months to pre-select for this ticket:
        let defaultMonths: number[] = [];
        if ((initialGroupMemberId === m.id || (!initialGroupMemberId && initialGroupId === cg.id)) && initialMonth !== undefined && initialMonth !== null) {
          defaultMonths = [Number(initialMonth)];
        } else if (currentMonthDue > 0) {
          defaultMonths = [currMonth];
        } else {
          const firstUnpaid = monthsBreakdown.find(mb => mb.remainingDue > 0);
          if (firstUnpaid) defaultMonths = [firstUnpaid.month];
        }
        initialSelectedMonths[m.id] = defaultMonths;

        return {
          groupId: cg.id,
          groupMemberId: m.id,
          groupName: cg.name,
          ticketNumber: m.ticket_number,
          totalValue: totalVal,
          memberCount: memCount,
          durationMonths: durMonths,
          currentMonth: currMonth,
          customInstallment: m.custom_installment,
          baseInstallment: baseInst,
          effectiveInstallment: effectiveInst,
          status: cg.status,
          monthsBreakdown,
          totalArrearsDue,
          currentMonthDue,
        };
      });

      setEnrolledGroups(builtGroups);
      setEnabledEnrollments(initialEnabled);
      setSelectedMonthsMap(initialSelectedMonths);
    } catch (err) {
      console.error('Error fetching member groups:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // INTERACTIVE CHECKLIST LOGIC
  // ─────────────────────────────────────────────────────────────
  // Toggle specific ticket enrollment enabled/disabled
  const handleToggleTicket = (groupMemberId: string) => {
    triggerHapticFeedback('light');
    setEnabledEnrollments(prev => ({
      ...prev,
      [groupMemberId]: !prev[groupMemberId],
    }));
  };

  // Toggle specific month for a ticket
  const handleToggleMonth = (groupMemberId: string, month: number) => {
    triggerHapticFeedback('light');
    setSelectedMonthsMap(prev => {
      const currentSelected = prev[groupMemberId] || [];
      const isAlreadySelected = currentSelected.includes(month);
      const updated = isAlreadySelected
        ? currentSelected.filter(m => m !== month)
        : [...currentSelected, month].sort((a, b) => a - b);
      return {
        ...prev,
        [groupMemberId]: updated,
      };
    });
  };

  // Add next advance month chip
  const handleAddAdvanceMonth = (group: EnrolledGroupInfo) => {
    triggerHapticFeedback('light');
    const currentSelected = selectedMonthsMap[group.groupMemberId] || [];
    const maxSelected = currentSelected.length > 0 ? Math.max(...currentSelected) : group.currentMonth;
    const nextMonth = Math.min(group.durationMonths, maxSelected + 1);

    if (!currentSelected.includes(nextMonth)) {
      setSelectedMonthsMap(prev => ({
        ...prev,
        [group.groupMemberId]: [...(prev[group.groupMemberId] || []), nextMonth].sort((a, b) => a - b),
      }));
    }
  };

  // Handle custom amount change for a ticket and month
  const handleCustomAmountChange = (groupMemberId: string, month: number, value: string) => {
    setCustomAmountsMap(prev => ({
      ...prev,
      [groupMemberId]: {
        ...(prev[groupMemberId] || {}),
        [month]: value,
      },
    }));
  };

  // Reset custom amount override for a ticket and month
  const handleResetCustomAmount = (groupMemberId: string, month: number) => {
    triggerHapticFeedback('light');
    setCustomAmountsMap(prev => {
      const groupMap = { ...(prev[groupMemberId] || {}) };
      delete groupMap[month];
      return {
        ...prev,
        [groupMemberId]: groupMap,
      };
    });
  };

  // ─────────────────────────────────────────────────────────────
  // CALCULATE LIVE TOTALS
  // ─────────────────────────────────────────────────────────────
  const { totalCollectionAmount, activeSelectionsSummary, calculatedItemsList } = useMemo(() => {
    let total = 0;
    const itemsList: {
      group: EnrolledGroupInfo;
      month: number;
      amount: number;
      isArrear: boolean;
      isCurrent: boolean;
      isAdvance: boolean;
    }[] = [];

    const summaries: string[] = [];

    enrolledGroups.forEach(grp => {
      if (!enabledEnrollments[grp.groupMemberId]) return;
      const months = selectedMonthsMap[grp.groupMemberId] || [];
      if (months.length === 0) return;

      let grpTotal = 0;
      months.forEach(m => {
        const mb = grp.monthsBreakdown.find(x => x.month === m);
        const defaultDue = mb ? (mb.remainingDue > 0 ? mb.remainingDue : grp.effectiveInstallment) : grp.effectiveInstallment;
        const customAmt = customAmountsMap[grp.groupMemberId]?.[m];
        
        let amt = defaultDue;
        if (customAmt !== undefined && customAmt !== '') {
          amt = Math.max(0, parseFloat(String(customAmt)) || 0);
        } else if (customAmt === '') {
          amt = 0;
        }

        grpTotal += amt;
        total += amt;

        itemsList.push({
          group: grp,
          month: m,
          amount: amt,
          isArrear: m < grp.currentMonth,
          isCurrent: m === grp.currentMonth,
          isAdvance: m > grp.currentMonth,
        });
      });

      summaries.push(`${grp.groupName} (#${grp.ticketNumber}): ₹${grpTotal.toLocaleString('en-IN')}`);
    });

    return {
      totalCollectionAmount: total,
      activeSelectionsSummary: summaries.join(' + '),
      calculatedItemsList: itemsList,
    };
  }, [enrolledGroups, enabledEnrollments, selectedMonthsMap, customAmountsMap]);

  // Active receiving vault
  const effectiveWallet: WalletType = paymentMode === 'cash' ? 'cash_in_hand' : onlineBank;
  const effectiveWalletLabel = paymentMode === 'cash' 
    ? 'Cash Box' 
    : onlineBank === 'kishor_bank' ? 'Kishor Bank (UPI)' : onlineBank === 'dad_bank' ? 'Dad Bank' : 'Mom Bank';

  // ─────────────────────────────────────────────────────────────
  // CONFIRM & EXECUTE PAYMENT
  // ─────────────────────────────────────────────────────────────
  const handleConfirmPayment = async () => {
    if (!selectedMember) {
      alert('Please select a subscriber.');
      return;
    }
    if (calculatedItemsList.length === 0 || totalCollectionAmount <= 0) {
      alert('Please select at least one chit group month to collect.');
      return;
    }

    try {
      setIsSubmitting(true);
      triggerHapticFeedback('light');

      // 1. Upload proof slip if attached
      let proofUrl: string | null = null;
      if (receiptFile) {
        setIsUploadingReceipt(true);
        const ext = receiptFile.name.split('.').pop();
        const fileName = `receipts/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('receipts').upload(fileName, receiptFile);
        if (!upErr) {
          const { data: pubData } = supabase.storage.from('receipts').getPublicUrl(fileName);
          proofUrl = pubData?.publicUrl || null;
        }
        setIsUploadingReceipt(false);
      }

      // 2. Date calculation
      let effectiveDateStr = new Date().toISOString();
      if (paymentDateType === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        effectiveDateStr = y.toISOString();
      } else if (paymentDateType === 'custom' && customPaymentDate) {
        effectiveDateStr = new Date(customPaymentDate + 'T12:00:00Z').toISOString();
      }

      // 3. Build Batch Collection Rows
      const batchId = `RCP-${Date.now().toString(36).toUpperCase()}`;
      const batchTag = `[Batch:${batchId}]`;

      const rowsToInsert = calculatedItemsList.map(item => {
        const typeLabel = item.isArrear ? ' (Arrear Cleared)' : item.isAdvance ? ' (Advance Pre-paid)' : '';
        const userNotePart = paymentNote.trim() ? ` — Note: ${paymentNote.trim()}` : '';
        const noteText = `Month ${item.month}${typeLabel} collection payment - Ticket #${item.group.ticketNumber} (${selectedMember.fullName})${userNotePart} ${batchTag}`;

        return {
          group_id: item.group.groupId,
          profile_id: selectedMember.id,
          group_member_id: item.group.groupMemberId,
          wallet_type: effectiveWallet,
          type: 'collection',
          status: 'completed',
          amount: item.amount,
          cycle_month: item.month,
          notes: noteText,
          verification_proof_url: proofUrl,
          created_at: effectiveDateStr,
          created_by: currentAdminProfile?.id || null,
        };
      });

      // 4. Atomic Insert into Supabase
      const { data: insertedTxs, error: txErr } = await supabase
        .from('transactions')
        .insert(rowsToInsert)
        .select('*');

      if (txErr) {
        console.error('Error inserting payment transactions:', txErr);
        alert('Failed to record payment in database: ' + txErr.message);
        return;
      }

      // 5. Update Treasury Wallet Balance
      await updateBalance(effectiveWallet, totalCollectionAmount);

      // 6. Security Audit Log
      await supabase.from('security_audit_logs').insert({
        action_description: `COLLECTION CONFIRMED: Received ₹${totalCollectionAmount.toLocaleString('en-IN')} via ${effectiveWalletLabel} from ${selectedMember.fullName} for ${calculatedItemsList.length} chit item(s) [${batchId}]`,
        target_table: 'transactions',
      });

      triggerHapticFeedback('success');

      // 7. Prepare Receipt Payload for Optional Viewing
      const firstGroup = calculatedItemsList[0].group;
      const receiptPayload = {
        transaction: insertedTxs?.[0] || {
          id: batchId,
          amount: totalCollectionAmount,
          wallet_type: effectiveWallet,
          created_at: effectiveDateStr,
          notes: `Batch Payment: ${activeSelectionsSummary}`,
        },
        member: {
          id: selectedMember.id,
          name: selectedMember.fullName,
          phone: selectedMember.phoneNumber,
          ticket: firstGroup.ticketNumber,
        },
        group: {
          id: firstGroup.groupId,
          name: calculatedItemsList.length === 1 ? firstGroup.groupName : `${firstGroup.groupName} + ${calculatedItemsList.length - 1} more`,
          totalValue: firstGroup.totalValue,
        },
        month: calculatedItemsList[0].month,
        totalCollectedAmount: totalCollectionAmount,
        allocations: calculatedItemsList.map(item => ({
          month: item.month,
          amount: item.amount,
          type: item.isArrear ? 'arrear' : item.isAdvance ? 'advance' : 'current',
          groupName: item.group.groupName,
        })),
      };

      // 8. Set Completed Summary (Smooth inline success screen, NO auto-popup receipt!)
      setCompletedPaymentSummary({
        totalAmount: totalCollectionAmount,
        walletType: effectiveWallet,
        walletLabel: effectiveWalletLabel,
        memberName: selectedMember.fullName,
        memberPhone: selectedMember.phoneNumber,
        receiptPayload,
        allocationsSummary: activeSelectionsSummary,
      });

      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      console.error('Error executing collection payment:', err);
      alert('Error recording payment: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div className="bg-white border-t sm:border border-slate-200 text-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[92dvh] sm:max-h-[88vh] overflow-hidden my-0 sm:my-auto animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-150">
          
          {/* ── TOP HEADER BAR ── */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center font-bold shadow-xs">
                <Coins size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight font-display">
                  {completedPaymentSummary ? 'Payment Recorded' : 'Record Collection'}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {completedPaymentSummary ? 'Treasury balance credited' : 'Quick multi-chit installment recorder'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── MAIN BODY CONTENT ── */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
            
            {/* ─────────────────────────────────────────────────────────────
                STATE A: SUCCESS SCREEN (NO AUTO POPUP RECEIPT!)
            ───────────────────────────────────────────────────────────── */}
            {completedPaymentSummary ? (
              <div className="py-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-600/10">
                  <CheckCircle2 size={36} />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Received in {completedPaymentSummary.walletLabel}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight pt-1">
                    ₹{completedPaymentSummary.totalAmount.toLocaleString('en-IN')}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Collected from <strong className="text-slate-800">{completedPaymentSummary.memberName}</strong>
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-left space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Payment Summary</span>
                  <p className="font-semibold text-slate-800">{completedPaymentSummary.allocationsSummary}</p>
                  <p className="text-[11px] text-slate-500">
                    Batch: #{completedPaymentSummary.receiptPayload.transaction.id?.slice(0, 12)} · Real-time ledger updated
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  {/* OPTIONAL RECEIPT BUTTON (Only opens if clicked!) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenReceiptModal) {
                        onOpenReceiptModal(completedPaymentSummary.receiptPayload);
                      }
                      onClose();
                    }}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <FileText size={16} />
                    <span>View &amp; Share WhatsApp Receipt</span>
                  </button>

                  {/* DONE / CLOSE BUTTON */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                  >
                    Done / Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ─────────────────────────────────────────────────────────────
                    STEP 1: SELECT / CONFIRM SUBSCRIBER
                ───────────────────────────────────────────────────────────── */}
                {!selectedMember ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Search subscriber by name or phone..."
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl text-xs sm:text-sm font-semibold transition-all outline-hidden text-slate-900 placeholder:text-slate-400"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="px-3.5 py-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-2xl border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
                        title="Scan Passbook QR"
                      >
                        <QrCode size={18} className="text-emerald-600" />
                        <span className="text-xs font-bold hidden sm:inline">Scan QR</span>
                      </button>
                    </div>

                    {/* Search Results Dropdown */}
                    {isSearching ? (
                      <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw size={14} className="animate-spin text-emerald-500" />
                        <span>Searching members...</span>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto border border-slate-200 rounded-2xl p-1.5 bg-slate-50">
                        {searchResults.map(member => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              triggerHapticFeedback('light');
                              setSelectedMember({
                                id: member.id,
                                fullName: member.full_name || member.fullName || 'Subscriber',
                                phoneNumber: member.phone_number || member.phoneNumber || '',
                                passbookToken: member.passbook_token || member.passbookToken || null,
                              });
                              fetchMemberGroupsAndDues(member.id);
                            }}
                            className="w-full p-2.5 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 text-left flex items-center justify-between transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                                {(member.full_name || member.fullName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-900 block">{member.full_name || member.fullName || 'Subscriber'}</span>
                                <span className="text-[11px] text-slate-500 font-mono">{member.phone_number || member.phoneNumber || 'No phone'}</span>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              Select
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : searchQuery.trim().length > 1 ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                        No subscriber found matching &quot;{searchQuery}&quot;
                      </div>
                    ) : null}
                  </div>
                ) : (
                  /* ── Selected Member Card ── */
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {(selectedMember?.fullName || 'Subscriber').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900 truncate">
                            {selectedMember?.fullName || 'Subscriber'}
                          </h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
                            {enrolledGroups.length} Ticket{enrolledGroups.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          📱 {selectedMember?.phoneNumber || 'No phone registered'}
                        </p>
                      </div>
                    </div>

                    {!initialMemberId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMember(null);
                          setEnrolledGroups([]);
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                      >
                        Change
                      </button>
                    )}
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    STEP 2: ENROLLED CHIT GROUPS SMART CHECKLIST
                ───────────────────────────────────────────────────────────── */}
                {selectedMember && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Chit Dues &amp; Months Checklist
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Tap chips to include or exclude
                      </span>
                    </div>

                    {isLoadingGroups ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center gap-2">
                        <RefreshCw size={15} className="animate-spin text-emerald-500" />
                        <span>Calculating subscriber dues across all chits...</span>
                      </div>
                    ) : enrolledGroups.length === 0 ? (
                      <div className="p-4 text-center text-xs text-amber-700 bg-amber-50 rounded-2xl border border-amber-200">
                        Subscriber is not currently enrolled in any active chit groups.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {enrolledGroups.map(grp => {
                          const isTicketEnabled = Boolean(enabledEnrollments[grp.groupMemberId]);
                          const selectedMonths = selectedMonthsMap[grp.groupMemberId] || [];

                          // Calculate ticket subtotal
                          const ticketSubtotal = selectedMonths.reduce((sum, m) => {
                            const mb = grp.monthsBreakdown.find(x => x.month === m);
                            const defaultDue = mb ? (mb.remainingDue > 0 ? mb.remainingDue : grp.effectiveInstallment) : grp.effectiveInstallment;
                            const customAmt = customAmountsMap[grp.groupMemberId]?.[m];
                            if (customAmt !== undefined && customAmt !== '') return sum + Math.max(0, parseFloat(String(customAmt)) || 0);
                            if (customAmt === '') return sum;
                            return sum + defaultDue;
                          }, 0);

                          const hasCustomInTicket = selectedMonths.some(m => {
                            const c = customAmountsMap[grp.groupMemberId]?.[m];
                            const mb = grp.monthsBreakdown.find(x => x.month === m);
                            const def = mb ? (mb.remainingDue > 0 ? mb.remainingDue : grp.effectiveInstallment) : grp.effectiveInstallment;
                            return c !== undefined && c !== '' && Number(c) !== def;
                          });

                          return (
                            <div
                              key={grp.groupMemberId}
                              className={`rounded-2xl border transition-all overflow-hidden ${
                                isTicketEnabled
                                  ? 'bg-white border-slate-300 shadow-sm ring-1 ring-emerald-500/20'
                                  : 'bg-slate-50/70 border-slate-200 opacity-75'
                              }`}
                            >
                              {/* Ticket Card Header */}
                              <div
                                onClick={() => handleToggleTicket(grp.groupMemberId)}
                                className="p-3 sm:p-3.5 flex items-center justify-between cursor-pointer border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                      isTicketEnabled
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                        : 'bg-white border-slate-300'
                                    }`}
                                  >
                                    {isTicketEnabled && <Check size={13} className="stroke-[3]" />}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h5 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                                        {grp.groupName}
                                      </h5>
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700">
                                        Ticket #{grp.ticketNumber}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      Due: ₹{grp.effectiveInstallment.toLocaleString('en-IN')}/mo · Current: M{grp.currentMonth}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {hasCustomInTicket && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                        Custom
                                      </span>
                                    )}
                                    <span className="text-xs sm:text-sm font-black font-mono text-emerald-700 block">
                                      ₹{ticketSubtotal.toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-medium">
                                    {selectedMonths.length} month{selectedMonths.length === 1 ? '' : 's'}
                                  </span>
                                </div>
                              </div>

                              {/* Month Selection Chips (Only visible if ticket is enabled) */}
                              {isTicketEnabled && (
                                <div className="p-3 bg-slate-50/60 space-y-2.5">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <span>Select Months to Pay:</span>
                                    {grp.totalArrearsDue > 0 && (
                                      <span className="text-rose-600">
                                        ⚠️ Has ₹{grp.totalArrearsDue.toLocaleString('en-IN')} past arrears
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {/* 1. Arrear Months (if unpaid) */}
                                    {grp.monthsBreakdown
                                      .filter(mb => mb.isArrear)
                                      .map(mb => {
                                        const isSelected = selectedMonths.includes(mb.month);
                                        return (
                                          <button
                                            key={mb.month}
                                            type="button"
                                            onClick={() => handleToggleMonth(grp.groupMemberId, mb.month)}
                                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                                              isSelected
                                                ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                            }`}
                                          >
                                            <span>M{mb.month} Arrear</span>
                                            <span className="font-mono text-[10px] opacity-90">
                                              (₹{mb.remainingDue.toLocaleString('en-IN')})
                                            </span>
                                          </button>
                                        );
                                      })}

                                    {/* 2. Current Month */}
                                    {(() => {
                                      const currentMb = grp.monthsBreakdown.find(mb => mb.isCurrent);
                                      const isSelected = selectedMonths.includes(grp.currentMonth);
                                      const remaining = currentMb?.remainingDue ?? grp.effectiveInstallment;

                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleMonth(grp.groupMemberId, grp.currentMonth)}
                                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                            isSelected
                                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20'
                                              : 'bg-white text-slate-800 border-slate-300 hover:border-emerald-500'
                                          }`}
                                        >
                                          <span>M{grp.currentMonth} Current</span>
                                          <span className="font-mono text-[10px] opacity-90">
                                            (₹{remaining.toLocaleString('en-IN')})
                                          </span>
                                        </button>
                                      );
                                    })()}

                                    {/* 3. Selected Advance Months */}
                                    {grp.monthsBreakdown
                                      .filter(mb => mb.isAdvance && selectedMonths.includes(mb.month))
                                      .map(mb => (
                                        <button
                                          key={mb.month}
                                          type="button"
                                          onClick={() => handleToggleMonth(grp.groupMemberId, mb.month)}
                                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border bg-blue-600 text-white border-blue-600 shadow-xs cursor-pointer"
                                        >
                                          <span>M{mb.month} Advance</span>
                                          <span className="font-mono text-[10px] opacity-90">
                                            (₹{grp.effectiveInstallment.toLocaleString('en-IN')})
                                          </span>
                                        </button>
                                      ))}

                                    {/* 4. Add Next Advance Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleAddAdvanceMonth(grp)}
                                      className="px-2 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-dashed border-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                                      title="Add advance installment"
                                    >
                                      <Plus size={12} />
                                      <span>Advance</span>
                                    </button>
                                  </div>

                                  {/* ── Custom Amount Collector (Simple, Uncluttered, Dad-Friendly) ── */}
                                  {selectedMonths.length === 1 && (() => {
                                    const sm = selectedMonths[0];
                                    const mb = grp.monthsBreakdown.find(x => x.month === sm);
                                    const defaultDue = mb ? (mb.remainingDue > 0 ? mb.remainingDue : grp.effectiveInstallment) : grp.effectiveInstallment;
                                    const customVal = customAmountsMap[grp.groupMemberId]?.[sm];
                                    const isCustom = customVal !== undefined && customVal !== '' && Number(customVal) !== defaultDue;

                                    return (
                                      <div className="pt-2.5 mt-1 border-t border-slate-200/80 flex items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <Edit2 size={12} className="text-slate-500 shrink-0" />
                                            <span className="text-xs font-bold text-slate-800">
                                              Amount for M{sm}:
                                            </span>
                                            {isCustom && (
                                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                Custom
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-slate-400 font-medium block">
                                            Standard due: ₹{defaultDue.toLocaleString('en-IN')}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <div className="relative flex items-center">
                                            <span className="absolute left-2.5 text-xs font-bold text-slate-400 select-none">₹</span>
                                            <input
                                              type="number"
                                              inputMode="numeric"
                                              value={customVal !== undefined ? customVal : defaultDue}
                                              onChange={(e) => handleCustomAmountChange(grp.groupMemberId, sm, e.target.value)}
                                              className="w-28 sm:w-32 pl-6 pr-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs sm:text-sm font-black font-mono text-slate-900 text-right outline-hidden"
                                              placeholder={String(defaultDue)}
                                            />
                                          </div>

                                          {isCustom && (
                                            <button
                                              type="button"
                                              onClick={() => handleResetCustomAmount(grp.groupMemberId, sm)}
                                              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                                              title="Reset to standard due"
                                            >
                                              Reset
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {selectedMonths.length > 1 && (
                                    <div className="pt-2.5 mt-1 border-t border-slate-200/80 space-y-2 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <Edit2 size={12} className="text-slate-500 shrink-0" />
                                          <span className="text-xs font-bold text-slate-800">
                                            Adjust Amounts per Month:
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400">
                                          Edit if paying partial
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {selectedMonths.map(m => {
                                          const mb = grp.monthsBreakdown.find(x => x.month === m);
                                          const defaultM = mb ? (mb.remainingDue > 0 ? mb.remainingDue : grp.effectiveInstallment) : grp.effectiveInstallment;
                                          const customM = customAmountsMap[grp.groupMemberId]?.[m];
                                          const isMcustom = customM !== undefined && customM !== '' && Number(customM) !== defaultM;

                                          return (
                                            <div key={m} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 border border-slate-200 gap-2">
                                              <div className="min-w-0">
                                                <span className="text-xs font-bold text-slate-900 block truncate">
                                                  {m < grp.currentMonth ? `M${m} Arrear` : m === grp.currentMonth ? `M${m} Current` : `M${m} Advance`}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono block">
                                                  Due: ₹{defaultM.toLocaleString('en-IN')}
                                                </span>
                                              </div>

                                              <div className="flex items-center gap-1 shrink-0">
                                                <div className="relative flex items-center">
                                                  <span className="absolute left-2 text-[11px] font-bold text-slate-400 select-none">₹</span>
                                                  <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    value={customM !== undefined ? customM : defaultM}
                                                    onChange={(e) => handleCustomAmountChange(grp.groupMemberId, m, e.target.value)}
                                                    className="w-24 pl-5 pr-2 py-1 bg-white border border-slate-300 focus:border-emerald-500 rounded-lg text-xs font-black font-mono text-slate-900 text-right outline-hidden"
                                                    placeholder={String(defaultM)}
                                                  />
                                                </div>

                                                {isMcustom && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleResetCustomAmount(grp.groupMemberId, m)}
                                                    className="text-[10px] font-bold text-slate-400 hover:text-slate-700 px-1 py-1"
                                                    title="Reset to standard due"
                                                  >
                                                    ↺
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    STEP 3: PAYMENT METHOD (Cash Default + GPay 3-Bank Submenu)
                ───────────────────────────────────────────────────────────── */}
                {selectedMember && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Payment Receiving Method
                    </span>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* CARD A: Cash in Hand (Default) */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light');
                          setPaymentMode('cash');
                        }}
                        className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          paymentMode === 'cash'
                            ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            paymentMode === 'cash' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            <Banknote size={17} />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 block">Cash</span>
                            <span className="text-[10px] text-slate-500">Physical Box</span>
                          </div>
                        </div>
                        {paymentMode === 'cash' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
                      </button>

                      {/* CARD B: GPay / Online */}
                      <button
                        type="button"
                        onClick={() => {
                          triggerHapticFeedback('light');
                          setPaymentMode('online');
                        }}
                        className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          paymentMode === 'online'
                            ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            paymentMode === 'online' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            <Smartphone size={17} />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 block">GPay / Online</span>
                            <span className="text-[10px] text-slate-500">UPI &amp; Bank</span>
                          </div>
                        </div>
                        {paymentMode === 'online' && <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />}
                      </button>
                    </div>

                    {/* SUB-MENU: 3 Bank Accounts (Only shown when GPay/Online is active) */}
                    {paymentMode === 'online' && (
                      <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-200/80 space-y-2 animate-in fade-in duration-150">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 block">
                          Select Destination Bank Account:
                        </span>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'kishor_bank' as WalletType, name: 'Kishor Bank', desc: 'Primary UPI' },
                            { id: 'dad_bank' as WalletType, name: 'Dad Bank', desc: 'Disbursements' },
                            { id: 'mom_bank' as WalletType, name: 'Mom Bank', desc: 'Reserves' },
                          ].map(b => {
                            const isBankSelected = onlineBank === b.id;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => {
                                  triggerHapticFeedback('light');
                                  setOnlineBank(b.id);
                                }}
                                className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                                  isBankSelected
                                    ? 'bg-white border-indigo-600 text-indigo-950 font-black shadow-xs ring-1 ring-indigo-500/30'
                                    : 'bg-white/60 hover:bg-white border-indigo-200 text-slate-700 font-semibold'
                                }`}
                              >
                                <span className="text-[11px] block truncate">{b.name}</span>
                                <span className="text-[9px] text-slate-400 block truncate">{b.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    STEP 4: ADVANCED OPTIONS (TUCKED ACCORDION)
                ───────────────────────────────────────────────────────────── */}
                {selectedMember && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer py-1"
                    >
                      <span>More options (date, note, slip upload)</span>
                      {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showAdvanced && (
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 mt-1.5 animate-in fade-in duration-150 text-xs">
                        {/* Date selection */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-600 block">Payment Date:</label>
                          <div className="flex gap-2">
                            {(['today', 'yesterday', 'custom'] as const).map(dt => (
                              <button
                                key={dt}
                                type="button"
                                onClick={() => setPaymentDateType(dt)}
                                className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold border capitalize transition-all cursor-pointer ${
                                  paymentDateType === dt
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200'
                                }`}
                              >
                                {dt}
                              </button>
                            ))}
                          </div>
                          {paymentDateType === 'custom' && (
                            <input
                              type="date"
                              value={customPaymentDate}
                              onChange={e => setCustomPaymentDate(e.target.value)}
                              className="w-full mt-1.5 p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-hidden"
                            />
                          )}
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 block">Note / Reference:</label>
                          <input
                            type="text"
                            value={paymentNote}
                            onChange={e => setPaymentNote(e.target.value)}
                            placeholder="Optional notes or transaction UTR..."
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-hidden placeholder:text-slate-400"
                          />
                        </div>

                        {/* Slip upload */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 block">Attach Slip / Screenshot:</label>
                          <label className="border border-dashed border-slate-300 hover:border-slate-400 bg-white p-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors text-slate-500">
                            <Upload size={14} />
                            <span className="text-[11px] font-semibold">
                              {receiptFile ? receiptFile.name : 'Upload image proof'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => {
                                if (e.target.files?.[0]) setReceiptFile(e.target.files[0]);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              STICKY BOTTOM CONFIRMATION BAR
          ───────────────────────────────────────────────────────────── */}
          {!completedPaymentSummary && selectedMember && (
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-white shrink-0 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">
                  Total Collection:
                </span>
                <span className="text-lg sm:text-xl font-black font-mono text-slate-900">
                  ₹{totalCollectionAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isSubmitting || totalCollectionAmount <= 0}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.98] ${
                  isSubmitting || totalCollectionAmount <= 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : paymentMode === 'cash'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Recording Collection...</span>
                  </>
                ) : (
                  <>
                    <Check size={18} className="stroke-[3]" />
                    <span>
                      Confirm ₹{totalCollectionAmount.toLocaleString('en-IN')} ({paymentMode === 'cash' ? 'Cash' : effectiveWalletLabel})
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Camera QR Passbook Scanner Modal ── */}
      <PassbookScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanPassbook}
        title="Scan Member Passbook QR"
        subtitle="Instantly loads subscriber details and all enrolled chits"
      />
    </>
  );
}
