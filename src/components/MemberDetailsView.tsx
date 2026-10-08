'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useOrganization } from '@/context/OrganizationContext';
import PassbookScannerModal from './PassbookScannerModal';
import PassbookSheetGeneratorModal, { StickerItem } from './PassbookSheetGeneratorModal';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { getPassbookScanUrl } from '@/utils/qrCodeGenerator';
import { 
  ArrowLeft,
  CheckCircle2, 
  AlertCircle,
  Clock,
  Search,
  Plus,
  Share2,
  Edit3,
  Trash2,
  Paperclip,
  Trophy,
  Coins,
  CreditCard,
  Banknote,
  Landmark,
  Calendar,
  Layers,
  ChevronRight,
  User,
  Phone,
  BookOpen,
  Check,
  X,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  QrCode,
  Printer,
  KeyRound,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface MemberDetailsViewProps {
  memberId: string;
  onBack: () => void;
  onAddAuditLog?: (desc: string) => void;
}

export default function MemberDetailsView({ memberId, onBack, onAddAuditLog }: MemberDetailsViewProps) {
  const { profile } = useAuth();
  const { organizationName, organizationInitials, organizationTagline } = useOrganization();
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printItems, setPrintItems] = useState<StickerItem[]>([]);
  const { updateBalance } = useWallet();

  const [activeSubtab, setActiveSubtab] = useState<'chits' | 'payments' | 'prizes' | 'activity'>('chits');
  const [loading, setLoading] = useState<boolean>(true);
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [memberEnrollments, setMemberEnrollments] = useState<any[]>([]);
  const [memberTransactions, setMemberTransactions] = useState<any[]>([]);
  const [allChitGroups, setAllChitGroups] = useState<any[]>([]);
  const [auctionLogs, setAuctionLogs] = useState<any[]>([]);

  // Member PIN admin visibility & reset states
  const [showMemberPin, setShowMemberPin] = useState<boolean>(false);
  const [isEditingPinModal, setIsEditingPinModal] = useState<boolean>(false);
  const [customPinInput, setCustomPinInput] = useState<string>('');
  const [isSavingPin, setIsSavingPin] = useState<boolean>(false);

  // Search and filter states for Payments subtab
  const [paymentSearch, setPaymentSearch] = useState<string>('');
  const [selectedChitFilter, setSelectedChitFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  // Modal states for recording / editing payment directly inside Member Details
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [modalTargetGroupId, setModalTargetGroupId] = useState<string>('');
  const [modalTargetMonth, setModalTargetMonth] = useState<number>(1);
  const [quickPaymentAmount, setQuickPaymentAmount] = useState<string>('');
  const [paymentWalletType, setPaymentWalletType] = useState<string>('cash_in_hand');
  const [paymentDateType, setPaymentDateType] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customPaymentDate, setCustomPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState<string>('');
  const [receiptFileToUpload, setReceiptFileToUpload] = useState<File | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [viewingReceiptTx, setViewingReceiptTx] = useState<any | null>(null);

  const fetchMemberData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Profile
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', memberId)
        .single();

      if (profErr) {
        console.warn('Error fetching member profile:', profErr.message);
      }
      if (profData) {
        setMemberProfile(profData);
      }

      // 2. Fetch Group Enrollments
      const { data: enrollData } = await supabase
        .from('group_members')
        .select(`
          id,
          profile_id,
          group_id,
          ticket_number,
          has_won_regular,
          custom_installment,
          physical_book_synced,
          chit_groups (
            id,
            name,
            total_value,
            duration_months,
            current_month,
            kai_iruppu_pool,
            status,
            start_date
          )
        `)
        .eq('profile_id', memberId);

      if (enrollData) {
        setMemberEnrollments(enrollData);
      }

      // 3. Fetch Transactions for this member
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .or(`profile_id.eq.${memberId},group_member_id.in.(${(enrollData || []).map((e: any) => e.id).join(',') || '00000000-0000-0000-0000-000000000000'})`)
        .order('created_at', { ascending: false });

      if (txData) {
        setMemberTransactions(txData);
      }

      // 4. Fetch All Groups & Auction Logs
      const { data: groupsData } = await supabase
        .from('chit_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (groupsData) {
        setAllChitGroups(groupsData);
      }

      const { data: logsData } = await supabase
        .from('auction_logs')
        .select('*')
        .order('month', { ascending: true });

      if (logsData) {
        setAuctionLogs(logsData);
      }
    } catch (err) {
      console.error('Error fetching member details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberData();

    // Realtime channel listener for live synchronization
    const channel = supabase
      .channel(`member-details-${memberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchMemberData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chit_groups' }, () => {
        fetchMemberData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
        fetchMemberData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_logs' }, () => {
        fetchMemberData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId]);

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Helper: Month label calculation
  const getMonthLabel = (startDateStr: string | null | undefined, monthNum: number) => {
    if (monthNum === 0) return 'Month 0 (Launch)';
    if (!startDateStr) return `Month ${monthNum}`;
    try {
      const base = new Date(startDateStr);
      const targetDate = new Date(base.getFullYear(), base.getMonth() + monthNum, base.getDate() || 1);
      return `${targetDate.toLocaleString('en-IN', { month: 'short' })} (M${monthNum})`;
    } catch (e) {
      return `Month ${monthNum}`;
    }
  };

  // Helper: Image Compression
  const compressImage = (file: File, maxWidth = 900, maxHeight = 900, quality = 0.72): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) resolve(blob);
            else reject(new Error('Image compression failed'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
    });
  };

  const handleReceiptPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Photo size exceeds 15MB limit.');
      return;
    }
    setReceiptFileToUpload(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPaymentReceiptUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const computeEffectivePaymentDate = (dateType: 'today' | 'yesterday' | 'custom', customDate: string) => {
    const now = new Date();
    if (dateType === 'today') return now.toISOString();
    if (dateType === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      return y.toISOString();
    }
    if (!customDate) return now.toISOString();
    const [year, month, day] = customDate.split('-').map(Number);
    const custom = new Date(year, (month || 1) - 1, day || 1, now.getHours(), now.getMinutes(), now.getSeconds());
    return custom.toISOString();
  };

  // Member Overall Financial Metrics Calculations
  const totalPaidIn = useMemo(() => {
    return memberTransactions
      .filter(t => t.type === 'collection')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [memberTransactions]);

  const totalPaidOut = useMemo(() => {
    return memberTransactions
      .filter(t => t.type === 'payout')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [memberTransactions]);



  // Detailed per-group and per-month dues breakdown matrix
  const groupDuesBreakdowns = useMemo(() => {
    return memberEnrollments.map((enroll) => {
      const g = Array.isArray(enroll.chit_groups) ? enroll.chit_groups[0] : enroll.chit_groups;
      if (!g) return null;

      const duration = Number(g.duration_months) || 20;
      const totalVal = Number(g.total_value) || 200000;
      const baseInst = Math.round(totalVal / duration);
      const memberInst = enroll.custom_installment !== null && enroll.custom_installment !== undefined 
        ? Number(enroll.custom_installment) 
        : baseInst;
      const lifetimeCommitment = memberInst * duration;

      // Group auctions
      const groupAuctions = auctionLogs.filter((a: any) => a.group_id === g.id);
      const maxAuctionMonth = groupAuctions.length > 0 
        ? Math.max(...groupAuctions.map((a: any) => a.month || 0)) 
        : 0;

      const effectiveCurrentMonth = Math.max(
        g.current_month !== undefined && g.current_month !== null ? Number(g.current_month) : 0,
        maxAuctionMonth
      );

      // Group collections
      const groupTransactions = memberTransactions.filter(
        (t: any) => (t.group_id === g.id || t.group_member_id === enroll.id) && t.type === 'collection'
      );
      const totalPaidForGroup = groupTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const monthDues: {
        month: number;
        label: string;
        expectedDue: number;
        paidAmount: number;
        remainingDue: number;
        status: 'paid' | 'partial' | 'unpaid' | 'free_laaba';
        isCurrentCycle: boolean;
      }[] = [];

      for (let m = 0; m <= effectiveCurrentMonth; m++) {
        const monthAuction = groupAuctions.find((a: any) => a.month === m);
        const isLaaba = !!monthAuction?.is_laaba_seetu || (m > 0 && (g.kai_iruppu_pool || 0) >= totalVal);
        const expectedDue = isLaaba ? 0 : memberInst;

        // Month tag pattern e.g. "Month 0", "Month 1"
        const monthPattern = new RegExp(`\\bMonth\\s+${m}\\b|\\bM${m}\\b`, 'i');
        const taggedTxs = groupTransactions.filter(t => 
          t.cycle_month !== null && t.cycle_month !== undefined
            ? Number(t.cycle_month) === Number(m)
            : (t.notes ? monthPattern.test(t.notes) : false)
        );
        const taggedPaid = taggedTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);

        monthDues.push({
          month: m,
          label: getMonthLabel(g.start_date, m),
          expectedDue,
          paidAmount: taggedPaid,
          remainingDue: Math.max(0, expectedDue - taggedPaid),
          status: isLaaba ? 'free_laaba' : taggedPaid >= expectedDue ? 'paid' : taggedPaid > 0 ? 'partial' : 'unpaid',
          isCurrentCycle: m === effectiveCurrentMonth,
        });
      }

      // Sum of tagged paid amounts
      const sumTaggedPaid = monthDues.reduce((sum, item) => sum + item.paidAmount, 0);

      // If surplus exists beyond tagged payments, allocate FIFO to unallocated months
      if (totalPaidForGroup > sumTaggedPaid) {
        let surplus = totalPaidForGroup - sumTaggedPaid;
        for (const item of monthDues) {
          if (surplus <= 0) break;
          if (item.remainingDue > 0) {
            const canTake = Math.min(surplus, item.remainingDue);
            item.paidAmount += canTake;
            item.remainingDue = Math.max(0, item.expectedDue - item.paidAmount);
            surplus -= canTake;
            if (item.paidAmount >= item.expectedDue) {
              item.status = 'paid';
            } else if (item.paidAmount > 0) {
              item.status = 'partial';
            }
          }
        }
      }

      // If no tagged payments at all, allocate totalPaidForGroup purely FIFO from M0
      if (sumTaggedPaid === 0 && totalPaidForGroup > 0) {
        let remainingPool = totalPaidForGroup;
        for (const item of monthDues) {
          if (remainingPool <= 0) {
            item.paidAmount = 0;
            item.remainingDue = item.expectedDue;
            item.status = item.expectedDue === 0 ? 'free_laaba' : 'unpaid';
            continue;
          }
          const canTake = Math.min(remainingPool, item.expectedDue);
          item.paidAmount = canTake;
          item.remainingDue = Math.max(0, item.expectedDue - canTake);
          remainingPool -= canTake;
          if (item.paidAmount >= item.expectedDue) {
            item.status = 'paid';
          } else if (item.paidAmount > 0) {
            item.status = 'partial';
          } else {
            item.status = item.expectedDue === 0 ? 'free_laaba' : 'unpaid';
          }
        }
      }

      const groupExpectedDue = monthDues.reduce((sum, item) => sum + item.expectedDue, 0);
      const outstandingBalance = monthDues.reduce((sum, item) => sum + item.remainingDue, 0);
      const isSettled = outstandingBalance === 0;
      const unpaidMonths = monthDues.filter((item) => item.remainingDue > 0);

      return {
        enrollmentId: enroll.id,
        groupId: g.id,
        groupName: g.name,
        ticketNumber: enroll.ticket_number,
        totalValue: totalVal,
        durationMonths: duration,
        memberInstallment: memberInst,
        startDate: g.start_date,
        effectiveCurrentMonth,
        totalPaidForGroup,
        lifetimeCommitment,
        lifetimeRemainingToGo: Math.max(0, lifetimeCommitment - totalPaidForGroup),
        groupExpectedDue,
        outstandingBalance,
        isSettled,
        unpaidMonths,
        monthDues,
      };
    }).filter(Boolean) as any[];
  }, [memberEnrollments, memberTransactions, auctionLogs]);

  // Aggregate expected total commitment and pending dues across all enrolled groups
  const { totalExpectedDue, totalCurrentDue, totalPendingCurrentDues, totalRemainingToGo, allSettled, groupsWithDues } = useMemo(() => {
    let expTotal = 0;
    let currTotalExpected = 0;
    let pendingCurrent = 0;

    (groupDuesBreakdowns || []).forEach((item: any) => {
      expTotal += item.lifetimeCommitment;
      currTotalExpected += item.groupExpectedDue;
      pendingCurrent += item.outstandingBalance;
    });

    const remainingToGo = Math.max(0, expTotal - totalPaidIn);
    const settled = pendingCurrent === 0;
    const groupsWithPending = (groupDuesBreakdowns || []).filter((item: any) => item.outstandingBalance > 0);

    return {
      totalExpectedDue: expTotal,
      totalCurrentDue: currTotalExpected,
      totalPendingCurrentDues: pendingCurrent,
      totalRemainingToGo: remainingToGo,
      allSettled: settled,
      groupsWithDues: groupsWithPending,
    };
  }, [groupDuesBreakdowns, totalPaidIn]);

  // WhatsApp receipt generator
  const generateWhatsAppReceiptUrl = (tx: any) => {
    const amt = Number(tx.amount || 0);
    const memberName = memberProfile?.full_name || 'Subscriber';
    const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today';
    const text = `*OFFICIAL PAYMENT RECEIPT*\n\n` +
      `Dear ${memberName},\n` +
      `We have successfully recorded your payment of *${formatCurrency(amt)}* on ${dateStr}.\n` +
      `Mode: ${!tx.wallet_type || tx.wallet_type.includes('cash') ? 'CASH IN HAND' : 'ONLINE TRANSFER'}\n` +
      `${tx.notes ? `Note: ${tx.notes}\n` : ''}` +
      `Status: COMPLETED\n\n` +
      `Thank you,\n${organizationName}`;
    return `https://web.whatsapp.com/send?phone=${memberProfile?.phone_number || ''}&text=${encodeURIComponent(text)}`;
  };

  // Handle Record New Payment for this member with prefilled group, month, and amount
  const handleOpenRecordPayment = (groupId?: string, month?: number, defaultAmt?: number) => {
    setEditingTransaction(null);
    const targetGroup = groupId || memberEnrollments[0]?.group_id || '';
    setModalTargetGroupId(targetGroup);

    // If month not specified, find first unpaid month for this group
    let targetM = month;
    let targetDueAmt = defaultAmt;

    if (targetM === undefined) {
      const grpBreakdown = (groupDuesBreakdowns || []).find((b: any) => b.groupId === targetGroup);
      const firstUnpaid = grpBreakdown?.unpaidMonths?.[0];
      if (firstUnpaid) {
        targetM = firstUnpaid.month;
        targetDueAmt = firstUnpaid.remainingDue;
      } else {
        targetM = grpBreakdown?.effectiveCurrentMonth || 0;
        targetDueAmt = grpBreakdown?.memberInstallment || 10000;
      }
    }

    setModalTargetMonth(targetM !== undefined ? targetM : 0);
    setQuickPaymentAmount(targetDueAmt !== undefined && targetDueAmt > 0 ? String(targetDueAmt) : '10000');
    setPaymentWalletType('cash_in_hand');
    setPaymentDateType('today');
    setCustomPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNote(`Month ${targetM !== undefined ? targetM : 0} installment`);
    setPaymentReceiptUrl('');
    setReceiptFileToUpload(null);
    setIsPaymentModalOpen(true);
  };

  // Handle Open Edit Payment Modal
  const handleOpenEditPayment = (tx: any) => {
    setEditingTransaction(tx);
    setModalTargetGroupId(tx.group_id || '');
    setQuickPaymentAmount(String(tx.amount || ''));
    setPaymentWalletType(tx.wallet_type || 'cash_in_hand');
    setPaymentNote(tx.notes || '');
    setPaymentReceiptUrl(tx.verification_proof_url || '');
    setReceiptFileToUpload(null);

    if (tx.created_at) {
      const txDate = new Date(tx.created_at);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      if (isSameDay(txDate, today)) {
        setPaymentDateType('today');
        setCustomPaymentDate(today.toISOString().split('T')[0]);
      } else if (isSameDay(txDate, yesterday)) {
        setPaymentDateType('yesterday');
        setCustomPaymentDate(yesterday.toISOString().split('T')[0]);
      } else {
        setPaymentDateType('custom');
        setCustomPaymentDate(txDate.toISOString().split('T')[0]);
      }
    } else {
      setPaymentDateType('today');
      setCustomPaymentDate(new Date().toISOString().split('T')[0]);
    }
    setIsPaymentModalOpen(true);
  };

  // Save Modal (Record or Edit)
  const handleSaveModalPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(quickPaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    try {
      setIsProcessingPayment(true);

      // Image upload handling with compression
      let finalReceiptUrl = paymentReceiptUrl || null;
      if (receiptFileToUpload) {
        try {
          const compressedBlob = await compressImage(receiptFileToUpload);
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
          const filePath = `${modalTargetGroupId || 'member'}/${fileName}`;

          const { error: storageErr } = await supabase.storage
            .from('receipts')
            .upload(filePath, compressedBlob, { contentType: 'image/jpeg', upsert: true });

          if (!storageErr) {
            const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
            finalReceiptUrl = publicUrl;
          }
        } catch (e) {
          console.warn('Storage upload note:', e);
        }
      }

      const effectiveDateStr = computeEffectivePaymentDate(paymentDateType, customPaymentDate);

      if (editingTransaction) {
        // Edit existing payment
        const oldAmt = Number(editingTransaction.amount || 0);
        const oldWallet = editingTransaction.wallet_type;
        const newWallet = paymentWalletType;

        const { error: updateErr } = await supabase
          .from('transactions')
          .update({
            amount: amt,
            wallet_type: newWallet,
            notes: paymentNote,
            verification_proof_url: finalReceiptUrl,
            created_at: effectiveDateStr,
          })
          .eq('id', editingTransaction.id);

        if (updateErr) {
          alert('Failed to update: ' + updateErr.message);
          return;
        }

        // Adjust balance deltas
        if (oldWallet === newWallet) {
          const delta = amt - oldAmt;
          if (delta !== 0) await updateBalance(newWallet as any, delta);
        } else {
          await updateBalance(oldWallet as any, -oldAmt);
          await updateBalance(newWallet as any, amt);
        }
      } else {
        // Record new payment
        const targetEnroll = memberEnrollments.find(e => e.group_id === modalTargetGroupId) || memberEnrollments[0];
        const targetCycleMonth = modalTargetMonth !== undefined && modalTargetMonth !== null ? Number(modalTargetMonth) : 0;
        
        // Guard against duplicate collection for the same group and month
        if (modalTargetGroupId) {
          const { data: existingColl } = await supabase
            .from('transactions')
            .select('amount')
            .eq('type', 'collection')
            .eq('profile_id', memberId)
            .eq('group_id', modalTargetGroupId)
            .eq('cycle_month', targetCycleMonth)
            .eq('status', 'completed');

          const existingTotal = (existingColl || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
          if (existingTotal > 0) {
            const proceed = window.confirm(
              `⚠️ DUPLICATE PAYMENT WARNING:\n\n${memberProfile?.full_name || 'Member'} has already paid ₹${existingTotal.toLocaleString('en-IN')} for Month ${targetCycleMonth}.\n\nRecording this will result in an additional collection of ₹${amt.toLocaleString('en-IN')}.\n\nDo you want to proceed anyway?`
            );
            if (!proceed) return;
          }
        }

        const monthTag = `Month ${targetCycleMonth}`;
        const defaultNote = `Collection payment - Ticket #${targetEnroll?.ticket_number || 1} (${memberProfile?.full_name})${monthTag ? ` - ${monthTag}` : ''}`;
        const finalNote = paymentNote.trim() 
          ? (monthTag && !paymentNote.toLowerCase().includes('month') ? `${paymentNote.trim()} (${monthTag})` : paymentNote.trim())
          : defaultNote;

        const { error: insertErr } = await supabase
          .from('transactions')
          .insert({
            group_id: modalTargetGroupId || null,
            profile_id: memberId,
            group_member_id: targetEnroll?.id || null,
            wallet_type: paymentWalletType,
            type: 'collection',
            status: 'completed',
            amount: amt,
            cycle_month: targetCycleMonth,
            notes: finalNote,
            verification_proof_url: finalReceiptUrl,
            created_at: effectiveDateStr,
            created_by: profile?.id || null,
          });

        if (insertErr) {
          alert('Failed to record: ' + insertErr.message);
          return;
        }

        await updateBalance(paymentWalletType as any, amt);
      }

      setIsPaymentModalOpen(false);
      setEditingTransaction(null);
      await fetchMemberData();
    } catch (err: any) {
      console.error('Error in payment modal:', err);
      alert('Error processing transaction.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Delete Payment Handler
  const handleDeletePayment = async (tx: any) => {
    const amt = Number(tx.amount || 0);
    if (!window.confirm(`Are you sure you want to void this payment of ₹${amt.toLocaleString('en-IN')}?`)) return;

    try {
      if (tx.verification_proof_url?.includes('/storage/v1/object/public/receipts/')) {
        try {
          const path = tx.verification_proof_url.split('/storage/v1/object/public/receipts/')[1];
          if (path) await supabase.storage.from('receipts').remove([decodeURIComponent(path)]);
        } catch (e) {
          console.warn('Storage cleanup note:', e);
        }
      }

      await supabase.from('transactions').delete().eq('id', tx.id);
      await updateBalance(tx.wallet_type as any, -amt);

      if (editingTransaction?.id === tx.id) {
        setIsPaymentModalOpen(false);
        setEditingTransaction(null);
      }

      await fetchMemberData();
    } catch (err) {
      console.error('Error deleting payment:', err);
    }
  };

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return memberTransactions.filter((tx) => {
      const matchSearch = paymentSearch.trim() === '' || 
        (tx.notes && tx.notes.toLowerCase().includes(paymentSearch.toLowerCase())) ||
        (tx.wallet_type && tx.wallet_type.toLowerCase().includes(paymentSearch.toLowerCase())) ||
        String(tx.amount).includes(paymentSearch);
      
      const matchChit = selectedChitFilter === 'all' || tx.group_id === selectedChitFilter;
      const matchType = selectedTypeFilter === 'all' || tx.type === selectedTypeFilter;

      return matchSearch && matchChit && matchType;
    });
  }, [memberTransactions, paymentSearch, selectedChitFilter, selectedTypeFilter]);

  // Prizes Won List (Member Auctions Won)
  const prizesWon = useMemo(() => {
    const wins: any[] = [];
    memberEnrollments.forEach((enroll: any) => {
      const g = Array.isArray(enroll.chit_groups) ? enroll.chit_groups[0] : enroll.chit_groups;
      if (!g) return;

      // Find auction logs for this group where winner matches this member or profile
      const groupWins = auctionLogs.filter(
        l => l.group_id === g.id && (l.winning_bidder_id === memberId || l.winner_profile_id === memberId || l.winner_member_id === enroll.id || l.winner_name === memberProfile?.full_name)
      );

      groupWins.forEach(win => {
        const totalVal = Number(g.total_value) || 200000;
        const discountBid = Number(win.winning_discount ?? win.winning_bid ?? 0);
        const netPayout = Number(win.net_payout) || (totalVal - discountBid);

        // Find associated payout transaction
        const payoutTx = memberTransactions.find(t => t.group_id === g.id && t.type === 'payout' && (t.notes?.includes(`Month ${win.month}`) || !t.notes));

        wins.push({
          groupId: g.id,
          groupName: g.name,
          month: Number(win.month),
          totalValue: totalVal,
          winningBid: discountBid,
          netPayout: netPayout,
          date: win.created_at || new Date().toISOString(),
          walletType: payoutTx?.wallet_type || 'cash_in_hand',
          isDisbursed: Boolean(payoutTx),
          payoutTx: payoutTx,
        });
      });
    });
    return wins;
  }, [memberEnrollments, auctionLogs, memberTransactions, memberId, memberProfile]);

  const memberName = memberProfile?.full_name || 'Subscriber';
  const memberInitial = memberName.charAt(0).toUpperCase();

  const handlePairScanSuccess = async (scannedToken: string) => {
    try {
      const { data, error } = await supabase.rpc('pair_passbook_qr', {
        p_token: scannedToken,
        p_profile_id: memberId,
      });

      if (error) throw error;
      if (!data || !data.success) throw new Error(data?.error || 'Failed to pair QR code.');

      alert(`Success: Passbook QR token paired to ${memberName}!`);
      setIsPairingModalOpen(false);
      setMemberProfile((prev: any) => ({ ...prev, passbook_token: scannedToken }));

      if (onAddAuditLog) {
        onAddAuditLog(`PAIRED Passbook QR [${scannedToken.slice(0, 8)}...] to ${memberName}`);
      }
    } catch (err: any) {
      throw err;
    }
  };

  const handlePrintMemberStickers = () => {
    if (!memberProfile?.passbook_token) {
      alert(`This member does not have a Passbook QR token linked yet. Tap "Pair Passbook QR" first.`);
      return;
    }

    const items: StickerItem[] = [];
    if (memberEnrollments.length > 0) {
      memberEnrollments.forEach((e: any) => {
        const g = Array.isArray(e.chit_groups) ? e.chit_groups[0] : e.chit_groups;
        items.push({
          token: memberProfile.passbook_token,
          name: memberName,
          phone: memberProfile.phone_number,
          groupName: g?.name || 'Chit Group',
          ticketNumber: e.ticket_number,
        });
      });
    } else {
      items.push({
        token: memberProfile.passbook_token,
        name: memberName,
        phone: memberProfile.phone_number,
        groupName: 'Member Passbook',
      });
    }

    setPrintItems(items);
    setIsPrintModalOpen(true);
  };

  const handleSharePassbookWhatsApp = () => {
    const cleanPhone = (memberProfile?.phone_number || '').replace(/\D/g, '').slice(-10);
    if (!cleanPhone) {
      alert('No valid mobile number found for this member.');
      return;
    }

    const scanUrl = memberProfile?.passbook_token ? getPassbookScanUrl(memberProfile.passbook_token) : 'https://chitfund.app';
    const message = `📱 *Hello ${memberName}!*
Welcome to your Chit Fund Member Portal.

Access your digital passbook, payment ledger & live auction bidding anytime:
🔗 *Passbook Direct Link*: ${scanUrl}
👤 *Mobile Number*: ${cleanPhone}
🔑 *Initial PIN*: ${memberProfile?.mpin || '1234'}

_(Point any camera at your physical pocket book QR sticker to log in instantly)_`;

    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleResetPinToDefault = async () => {
    if (!confirm(`Reset login PIN for ${memberName} back to default (1234)?`)) return;
    try {
      setIsSavingPin(true);
      const { error } = await supabase
        .from('profiles')
        .update({ mpin: '1234' })
        .eq('id', memberId);

      if (error) {
        alert('Failed to reset PIN: ' + error.message);
      } else {
        setMemberProfile((prev: any) => prev ? { ...prev, mpin: '1234' } : prev);
        if (onAddAuditLog) onAddAuditLog(`Reset login PIN to default 1234 for member ${memberName}`);
        alert(`✅ Login PIN for ${memberName} reset to default 1234.`);
      }
    } catch (err: any) {
      alert('Error resetting PIN: ' + err.message);
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleSaveCustomPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = customPinInput.trim();
    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6 || !/^\d+$/.test(cleanPin)) {
      alert('PIN must be 4 to 6 numeric digits.');
      return;
    }
    try {
      setIsSavingPin(true);
      const { error } = await supabase
        .from('profiles')
        .update({ mpin: cleanPin })
        .eq('id', memberId);

      if (error) {
        alert('Failed to update PIN: ' + error.message);
      } else {
        setMemberProfile((prev: any) => prev ? { ...prev, mpin: cleanPin } : prev);
        if (onAddAuditLog) onAddAuditLog(`Updated login PIN for member ${memberName}`);
        setIsEditingPinModal(false);
        setCustomPinInput('');
        alert(`✅ Security PIN updated successfully for ${memberName}.`);
      }
    } catch (err: any) {
      alert('Error updating PIN: ' + err.message);
    } finally {
      setIsSavingPin(false);
    }
  };

  // Revoke / Unlink physical passbook QR token
  const handleRevokePassbook = async () => {
    if (!window.confirm(`Revoke / unlink physical passbook QR token for ${memberName}? This will require re-pairing.`)) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ passbook_token: null })
        .eq('id', memberId);
      if (error) throw error;
      setMemberProfile((prev: any) => prev ? { ...prev, passbook_token: null } : prev);
      if (onAddAuditLog) onAddAuditLog(`REVOKE passbook QR token for ${memberName}`);
      alert('Physical passbook QR token unlinked.');
    } catch (err: any) {
      alert('Error unlinking QR token: ' + err.message);
    }
  };

  // Update System Privilege / Role
  const handleUpdateRole = async (newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', memberId);
      if (error) throw error;
      setMemberProfile((prev: any) => prev ? { ...prev, role: newRole } : prev);
      if (onAddAuditLog) onAddAuditLog(`UPDATED role for ${memberName} to ${newRole}`);
    } catch (err: any) {
      alert('Error updating role: ' + err.message);
    }
  };

  // Toggle Account Access Standing (Active / Suspended)
  const handleToggleStatus = async (active: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: active })
        .eq('id', memberId);
      if (error) {
        console.warn('is_active column update note:', error.message);
      }
      setMemberProfile((prev: any) => prev ? { ...prev, is_active: active } : prev);
      if (onAddAuditLog) onAddAuditLog(`${active ? 'ACTIVATED' : 'SUSPENDED'} account standing for ${memberName}`);
    } catch (err: any) {
      console.warn('Status toggle error:', err);
    }
  };

  const cleanPhone = (memberProfile?.phone_number || '').replace(/\D/g, '');
  const firstTicket = memberEnrollments[0]?.ticket_number ?? 1;
  const memberSince = memberProfile?.created_at 
    ? new Date(memberProfile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : 'Aug 2026';
  const totalChitCommitment = memberEnrollments.reduce((sum, e) => {
    const g = Array.isArray(e.chit_groups) ? e.chit_groups[0] : e.chit_groups;
    return sum + (Number(g?.total_value) || 0);
  }, 0);
  const totalInstallmentsCount = groupDuesBreakdowns.reduce((sum, g) => {
    return sum + (g?.monthDues?.filter((m: any) => m.status === 'paid').length || 0);
  }, 0);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 text-slate-800 antialiased selection:bg-brand-500 selection:text-white rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs animate-in fade-in duration-200">
      {/* ── DESKTOP VIEW (hidden md:flex) ── */}
      <div className="hidden md:flex flex-1 flex-col min-w-0">
<header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between flex-shrink-0 z-20">
        {/* Breadcrumb and Navigation back to members */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onBack} 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-600 transition-colors py-1.5 px-2.5 rounded-xl hover:bg-slate-100 group cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2"></path>
            </svg>
            <span>Members Directory</span>
          </button>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-slate-900 text-sm">{memberName}</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 font-bold">
              Ticket #{firstTicket}
            </span>
          </div>
        </div>

        {/* Quick Action Buttons on Desktop Bar */}
        <div className="flex items-center gap-3">
          {/* Outreach triggers */}
          <a 
            href={cleanPhone ? `https://wa.me/91${cleanPhone}` : '#'} 
            target="_blank" 
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-200/80 transition-colors shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.97.57 3.81 1.558 5.372L2.5 22l4.808-1.047a9.98 9.98 0 0 0 4.723 1.18c5.536 0 10.031-4.496 10.031-10.032S17.567 2 12.031 2zm5.727 14.198c-.24.673-1.393 1.285-1.922 1.343-.497.054-1.127.08-3.266-.807-2.734-1.135-4.498-3.906-4.636-4.088-.137-.182-1.1-1.464-1.1-2.793 0-1.328.694-1.982.942-2.247.248-.266.541-.332.723-.332.183 0 .365.002.525.01.17.009.398-.065.621.472.23.555.787 1.92.855 2.06.068.14.113.303.023.483-.09.18-.135.292-.27.45-.135.158-.284.354-.405.474-.136.136-.278.283-.12.553.158.271.7 1.155 1.503 1.868 1.033.918 1.905 1.203 2.176 1.339.27.135.43.113.589-.069.158-.18.677-.788.857-1.059.18-.27.36-.226.602-.136.241.09 1.536.724 1.799.855.263.131.439.196.502.304.064.108.064.629-.176 1.302z" />
            </svg>
            <span>WhatsApp Subscriber</span>
          </a>
          <a 
            href={cleanPhone ? `tel:+91${cleanPhone}` : '#'} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>Call Phone</span>
          </a>
          {/* Primary Action */}
          <button 
            type="button"
            onClick={() => handleOpenRecordPayment()} 
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold rounded-xl shadow-sm shadow-brand-500/25 transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
            </svg>
            <span>+ Record New Payment</span>
          </button>
        </div>
      </header>

      {/* ── Workspace Body ── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full max-w-[1400px] mx-auto space-y-6">

          {/* Top Row Executive Financial KPI Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Total Paid */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Paid to Date</span>
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold font-display">₹</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-display text-slate-900">{formatCurrency(totalPaidIn)}</span>
                  <span className="text-xs text-emerald-600 font-semibold">{totalInstallmentsCount || memberTransactions.length} Installments</span>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>{memberEnrollments[0]?.chit_groups?.name || 'Active Group'}</span>
                <span className="text-emerald-600 font-semibold">Verified</span>
              </div>
            </div>

            {/* Outstanding Dues */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Dues</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    allSettled ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-rose-50 text-rose-700 border-rose-200/60'
                  }`}>
                    {allSettled ? 'Cycle Settled' : `Cycle M${groupDuesBreakdowns[0]?.effectiveCurrentMonth ?? 1} Due`}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className={`text-2xl font-black font-display ${allSettled ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(totalPendingCurrentDues)}
                  </span>
                  {!allSettled && (
                    <span className="text-xs text-amber-600 font-medium">Pending Due</span>
                  )}
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Next cycle due: 15 Oct 2026</span>
                <button 
                  type="button"
                  onClick={handleSharePassbookWhatsApp} 
                  className="text-brand-600 font-semibold hover:underline cursor-pointer"
                >
                  Send Reminder
                </button>
              </div>
            </div>

            {/* Total Subscribed Chit Value */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Subscribed Chit Commitment</span>
                  <span className="w-7 h-7 rounded-lg bg-indigo-50 text-brand-600 flex items-center justify-center text-xs font-bold">
                    {memberEnrollments.length} {memberEnrollments.length === 1 ? 'Pool' : 'Pools'}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-display text-slate-900">{formatCurrency(totalChitCommitment || 100000)}</span>
                  <span className="text-xs text-slate-500 font-medium">Slot #{firstTicket} ({groupDuesBreakdowns[0]?.durationMonths || 20} Mos)</span>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span className="truncate max-w-[150px]">{groupDuesBreakdowns[0]?.groupName || 'Chit Pool'}</span>
                <span className="text-indigo-600 font-semibold">Active Cycle {groupDuesBreakdowns[0]?.effectiveCurrentMonth ?? 1}/{groupDuesBreakdowns[0]?.durationMonths ?? 20}</span>
              </div>
            </div>

            {/* Prize Pot Status */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Prize Pot Status</span>
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold">🎯</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-lg font-bold font-display text-emerald-700">
                    {prizesWon.length > 0 ? `Won Prize Pot (M${prizesWon[0].month})` : 'Eligible Contender'}
                  </span>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-emerald-600 font-medium flex items-center justify-between">
                <span>{prizesWon.length > 0 ? `Net Payout: ${formatCurrency(prizesWon[0].netPayout)}` : `Not won yet · Eligible in M${(groupDuesBreakdowns[0]?.effectiveCurrentMonth || 0) + 1}`}</span>
                <span className="text-xs font-bold text-slate-700">
                  {prizesWon.length > 0 ? 'Disbursed' : 'Max Bid: 40%'}
                </span>
              </div>
            </div>
          </section>

          {/* Main Workspace 2-Column Split: Left Rail (4 cols) + Main Content (8 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">

            {/* ── Left Rail: Member Identity, Passbook QR & Security Controls ── */}
            <div className="lg:col-span-4 space-y-6">

              {/* 1. Member Profile & Identity Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                {/* Avatar & Core Info */}
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 font-black text-xl flex items-center justify-center font-display shadow-sm">
                      {memberInitial}
                    </div>
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-slate-900 text-white font-mono text-[10px] font-bold border-2 border-white shadow">
                      #{firstTicket}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h2 className="text-lg font-bold font-display text-slate-900 truncate">{memberName}</h2>
                      <button 
                        type="button"
                        onClick={() => {
                          setCustomPinInput(memberProfile?.mpin || '1234');
                          setIsEditingPinModal(true);
                        }} 
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer" 
                        title="Edit Member PIN / Information"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {memberProfile?.phone_number ? `+91 ${memberProfile.phone_number}` : 'No phone recorded'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Member since {memberSince}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200/60 capitalize">
                        {memberProfile?.role || 'Subscriber'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> In Good Standing
                      </span>
                    </div>
                  </div>
                </div>

                {/* Administrative Controls & Role Selection */}
                <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Access &amp; Role Management</h3>
                  
                  {/* Role Assignment Select */}
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">System Privilege</span>
                      <span className="text-[10px] text-slate-400">Controls dashboard capabilities</span>
                    </div>
                    <select 
                      value={memberProfile?.role || 'subscriber'}
                      onChange={(e) => handleUpdateRole(e.target.value)}
                      className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-brand-500 focus:border-brand-500 cursor-pointer"
                    >
                      <option value="subscriber">Subscriber</option>
                      <option value="manager">Manager / Collector</option>
                      <option value="admin">System Admin</option>
                    </select>
                  </div>

                  {/* Account Status Cutoff Segmented Control */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">Account Access Standing</span>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100/70 px-1.5 py-0.5 rounded">Live Cutoff</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => handleToggleStatus(true)}
                        className={`py-1.5 px-3 font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${
                          memberProfile?.is_active !== false 
                            ? 'bg-emerald-600 text-white' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        <span>Active</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleToggleStatus(false)}
                        className={`py-1.5 px-3 font-semibold rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${
                          memberProfile?.is_active === false 
                            ? 'bg-rose-600 text-white' 
                            : 'text-slate-600 hover:text-rose-700'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span>Suspended</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Suspending instantly blocks mobile portal login and auction participation.</p>
                  </div>

                  {/* Quick Login MPIN Management */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">Quick Login MPIN</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs font-bold text-slate-900 tracking-widest">
                          {showMemberPin ? (memberProfile?.mpin || '1234') : '••••'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {(!memberProfile?.mpin || memberProfile?.mpin === '1234') ? '(default 1234)' : '(encrypted)'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={() => setShowMemberPin(!showMemberPin)}
                        className="px-2 py-1 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        {showMemberPin ? 'Hide' : 'Reveal'}
                      </button>
                      <button 
                        type="button"
                        onClick={handleResetPinToDefault}
                        className="px-2.5 py-1 text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Reset MPIN
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Physical Passbook & QR Token Management Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Physical Passbook &amp; QR Token</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Hardware &amp; booklet ledger synchronization</p>
                  </div>
                  {memberProfile?.passbook_token ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Synchronized
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Unlinked
                    </span>
                  )}
                </div>

                {/* QR Token Inspection Box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-4">
                  <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl p-1.5 flex items-center justify-center shadow-2xs flex-shrink-0">
                    <svg className="w-full h-full text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm-2 10h8v8H2v-8zm2 2v4h4v-4H4zm10-14h8v8h-8V2zm2 2v4h4V4h-4zm-1 9h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm5-3h2v4h-2v-4zm-2 5h2v2h-2v-2zm-3 0h2v2h-2v-2zm5-2h2v2h-2v-2zM5 5h2v2H5V5zm0 12h2v2H5v-2zm12-12h2v2h-2V5z"></path>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-900 truncate">
                        {memberProfile?.passbook_token || 'TOKEN-UNBOUND'}
                      </span>
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 bg-indigo-50 text-brand-700 rounded border border-brand-200/50">SHA-256</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-semibold">Booklet #{String(firstTicket).padStart(2, '0')} <span className="font-normal text-slate-400">· 24 Pages Bonded</span></p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {memberProfile?.passbook_token ? 'Paired on physical scan · Hash authenticated' : 'Awaiting physical card binding'}
                    </p>
                  </div>
                </div>

                {/* Physical Logistics Action Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <button 
                    type="button"
                    onClick={() => setIsPairingModalOpen(true)}
                    className="px-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                    <span>Re-bind QR</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleRevokePassbook}
                    className="px-2 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors flex flex-col items-center gap-1 cursor-pointer" 
                    title="Unlink for lost booklet"
                  >
                    <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                    <span>Revoke / Lost</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handlePrintMemberStickers}
                    className="px-2 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold transition-colors flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                    <span>Print Sticker</span>
                  </button>
                </div>

                {/* Passbook Verification Note */}
                <div className="p-3 bg-emerald-50/60 border border-emerald-200/50 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
                  <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                  <span>Last scanned at collection. All physical passbook stamps correspond to digital hash.</span>
                </div>
              </div>

              {/* 3. Outreach & Quick Communications Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Direct Subscriber Outreach</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <a 
                    href={cleanPhone ? `https://wa.me/91${cleanPhone}` : '#'} 
                    target="_blank" 
                    rel="noreferrer"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.97.57 3.81 1.558 5.372L2.5 22l4.808-1.047a9.98 9.98 0 0 0 4.723 1.18c5.536 0 10.031-4.496 10.031-10.032S17.567 2 12.031 2zm5.727 14.198c-.24.673-1.393 1.285-1.922 1.343-.497.054-1.127.08-3.266-.807-2.734-1.135-4.498-3.906-4.636-4.088-.137-.182-1.1-1.464-1.1-2.793 0-1.328.694-1.982.942-2.247.248-.266.541-.332.723-.332.183 0 .365.002.525.01.17.009.398-.065.621.472.23.555.787 1.92.855 2.06.068.14.113.303.023.483-.09.18-.135.292-.27.45-.135.158-.284.354-.405.474-.136.136-.278.283-.12.553.158.271.7 1.155 1.503 1.868 1.033.918 1.905 1.203 2.176 1.339.27.135.43.113.589-.069.158-.18.677-.788.857-1.059.18-.27.36-.226.602-.136.241.09 1.536.724 1.799.855.263.131.439.196.502.304.064.108.064.629-.176 1.302z" />
                    </svg>
                    <span>WhatsApp</span>
                  </a>
                  <a 
                    href={cleanPhone ? `tel:+91${cleanPhone}` : '#'} 
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                    <span>Direct Call</span>
                  </a>
                </div>
              </div>

            </div>

            {/* ── Main Content Area: Enrolled Chits, Payment Ledger & Prize Pot ── */}
            <div className="lg:col-span-8 space-y-6">

              {/* 1. Enrolled Chit Schemes & Ticket Breakdown */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900">Enrolled Chit Schemes</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Subscriptions, ticket allocation, and monthly collection commitments</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleOpenRecordPayment()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-xl border border-brand-200/60 transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                    <span>Enroll in Another Group</span>
                  </button>
                </div>

                {/* Scheme Card Items */}
                <div className="p-5 space-y-4">
                  {groupDuesBreakdowns.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                      No chit groups currently enrolled for this member.
                    </div>
                  ) : (
                    groupDuesBreakdowns.map((grpDues: any) => {
                      const groupWonPrize = prizesWon.find((p: any) => p.groupId === grpDues.groupId);
                      const firstUnpaid = grpDues.unpaidMonths?.[0];
                      const initials = grpDues.groupName
                        ? grpDues.groupName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                        : 'ST';

                      return (
                        <div key={grpDues.enrollmentId} className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 space-y-3">
                          <div className="flex items-start justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/60 text-brand-700 font-bold flex items-center justify-center font-display text-sm shrink-0">
                                {initials}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-display font-bold text-slate-900 text-sm">
                                    {grpDues.groupName} ({formatCurrency(grpDues.totalValue)} Pool)
                                  </h4>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                    Ticket #{grpDues.ticketNumber}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {grpDues.durationMonths} Months Duration · Current: Cycle {grpDues.effectiveCurrentMonth} of {grpDues.durationMonths} · {grpDues.durationMonths} Total Members
                                </p>
                              </div>
                            </div>
                            {/* Quick action on scheme */}
                            <button 
                              type="button"
                              onClick={() => handleOpenRecordPayment(grpDues.groupId, firstUnpaid?.month, firstUnpaid?.remainingDue)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                              </svg>
                              <span>Pay for This Ticket</span>
                            </button>
                          </div>

                          {/* Scheme Financial Metrics Matrix */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-slate-200/60">
                            <div>
                              <span className="text-slate-400 block text-[11px] font-medium">Monthly Installment</span>
                              <span className="font-bold text-slate-800 text-sm font-display">{formatCurrency(grpDues.memberInstallment)}</span>
                              <span className="text-[10px] text-slate-400 block">(Before Dividend)</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px] font-medium">Cycle M{grpDues.effectiveCurrentMonth} Due Override</span>
                              <span className={`text-sm font-display font-bold ${grpDues.outstandingBalance > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
                                {formatCurrency(grpDues.outstandingBalance)}
                              </span>
                              <span className="text-[10px] text-emerald-600 block">
                                {grpDues.isSettled ? 'Settled for cycle' : `${formatCurrency(grpDues.totalPaidForGroup)} Collected`}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px] font-medium">Accumulated Paid</span>
                              <span className="font-bold text-emerald-600 text-sm font-display">{formatCurrency(grpDues.totalPaidForGroup)}</span>
                              <span className="text-[10px] text-slate-400 block">
                                {grpDues.isSettled ? 'All active cycles clear' : `${grpDues.unpaidMonths.length} due cycle(s)`}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px] font-medium">Auction Status</span>
                              <span className="font-bold text-slate-800 text-sm font-display">
                                {groupWonPrize ? 'Prize Winner' : 'Non-Prized'}
                              </span>
                              <span className="text-[10px] text-indigo-600 block">
                                {groupWonPrize ? `Won in Month ${groupWonPrize.month}` : `Eligible in M${grpDues.effectiveCurrentMonth + 1} Auction`}
                              </span>
                            </div>
                          </div>

                          {/* Cycle Payment Status Matrix */}
                          <div className="pt-2 border-t border-slate-200/40">
                            <div className="flex items-center justify-between text-[11px] mb-1.5">
                              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Cycle Matrix</span>
                              <span className="font-semibold text-slate-600">{grpDues.isSettled ? 'All paid' : `${formatCurrency(grpDues.outstandingBalance)} Pending`}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {grpDues.monthDues.map((m: any) => (
                                <button
                                  key={m.month}
                                  type="button"
                                  onClick={() => {
                                    if (m.remainingDue > 0) {
                                      handleOpenRecordPayment(grpDues.groupId, m.month, m.remainingDue);
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                    m.remainingDue > 0 ? 'cursor-pointer hover:scale-105' : 'cursor-default'
                                  } ${
                                    m.status === 'paid'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : m.status === 'free_laaba'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : m.status === 'partial'
                                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {m.month === 0 ? 'M0' : `M${m.month}`}: {m.status === 'paid' ? 'Paid' : m.status === 'free_laaba' ? 'Free (Laaba)' : formatCurrency(m.remainingDue)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 2. Historical Payment Ledger & Digital Receipts (Chronological FIFO Table) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-sm text-slate-900">Historical Payment Ledger &amp; Digital Receipts</h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {memberTransactions.length} Transactions
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Itemized cash and bank collections authenticated with digital passbook</p>
                  </div>
                  {/* Filters & Receipt Export */}
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                      </svg>
                      <span>Export Ledger PDF</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleOpenRecordPayment()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
                      </svg>
                      <span>Record Payment</span>
                    </button>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 select-none">
                      <tr>
                        <th className="px-5 py-3">Receipt / Date</th>
                        <th className="px-4 py-3">Chit Scheme</th>
                        <th className="px-4 py-3">Month Cycle</th>
                        <th className="px-4 py-3">Payment Mode</th>
                        <th className="px-4 py-3">Notes &amp; Collector</th>
                        <th className="px-5 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                            No payment transactions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        memberTransactions.map((tx: any) => {
                          const txDate = tx.created_at ? new Date(tx.created_at) : new Date();
                          const dateFormatted = txDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                          const timeFormatted = txDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                          const recId = `#REC-${tx.id ? tx.id.slice(0, 8).toUpperCase() : '2026'}`;
                          const grp = allChitGroups.find((g: any) => g.id === tx.group_id);
                          const isCollection = tx.type === 'collection';

                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="font-mono font-bold text-slate-900">{recId}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{dateFormatted}, {timeFormatted}</div>
                              </td>
                              <td className="px-4 py-3.5 font-medium text-slate-800">
                                {grp?.name || 'Chit Pool'}
                                <span className="block text-[10px] text-slate-400 font-mono">Ticket #{firstTicket}</span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`px-2 py-0.5 rounded-md border font-semibold text-[11px] ${
                                  tx.cycle_month !== null && tx.cycle_month !== undefined
                                    ? 'bg-amber-50 text-amber-800 border-amber-200/60'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {tx.cycle_month !== null && tx.cycle_month !== undefined ? `Month ${tx.cycle_month}` : 'General'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    tx.wallet_type === 'kishor_bank' ? 'bg-indigo-500' : 'bg-emerald-500'
                                  }`}></span>
                                  {tx.wallet_type === 'kishor_bank' ? 'UPI / Kishor Bank' : tx.wallet_type === 'dad_bank' ? 'Dad Bank' : tx.wallet_type === 'mom_bank' ? 'Mom Bank' : 'Cash Collection'}
                                </span>
                                <span className="block text-[10px] text-slate-400">
                                  {tx.wallet_type === 'cash_in_hand' ? 'Box #1 Physical' : 'Digital Transfer'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-slate-600">
                                <div className="truncate max-w-[150px]">{tx.notes || 'Monthly chit installment'}</div>
                                <div className="text-[10px] text-slate-400">Coll by: Admin</div>
                              </td>
                              <td className={`px-5 py-3.5 text-right font-display font-bold text-sm whitespace-nowrap ${
                                isCollection ? 'text-emerald-600' : 'text-amber-600'
                              }`}>
                                {isCollection ? '+' : '-'} {formatCurrency(Number(tx.amount || 0))}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <button 
                                  type="button"
                                  onClick={() => setViewingReceiptTx(tx)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer" 
                                  title="Print Digital Receipt"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer with Aggregate Ledger Total */}
                <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-slate-500">
                    Total Recorded Collections: <span className="font-bold text-slate-800">{memberTransactions.length} receipts</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-500 font-medium">Cumulative Paid:</span>
                    <span className="font-display font-black text-slate-900 text-base">{formatCurrency(totalPaidIn)}</span>
                  </div>
                </div>
              </div>

              {/* 3. Prize Pot Disbursement & Auction History */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900">Prize Pot Disbursement &amp; Auction History</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Historical prize claims, winning discount bids, and disbursement audit</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    prizesWon.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-slate-100 text-slate-600 border-slate-200/60'
                  }`}>
                    {prizesWon.length > 0 ? 'Prize Winner' : 'Un-auctioned Contender'}
                  </span>
                </div>

                {/* Status Box for Subscriber */}
                {prizesWon.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-brand-600 flex items-center justify-center text-lg">
                        🎟️
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">No Disbursed Prize Pot on Record</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{memberName} hasn't claimed a prize pot yet. Retains full bidding rights for remaining cycles.</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-medium">Next Auction Slot</span>
                      <span className="text-xs font-bold text-indigo-700">Month {(groupDuesBreakdowns[0]?.effectiveCurrentMonth || 0) + 1} Auction</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prizesWon.map((win: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg">
                            🏆
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">{win.groupName} — Month {win.month} Winner</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Winning Discount: {formatCurrency(win.winningBid)} · Net Payout: <strong className="text-emerald-700">{formatCurrency(win.netPayout)}</strong>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {win.isDisbursed ? 'Disbursed' : 'Pending Disbursement'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reference Note: How disbursed pots are tracked */}
                <div className="p-3 rounded-xl bg-indigo-50/40 border border-brand-100 text-xs text-slate-600 flex items-start gap-2">
                  <svg className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  </svg>
                  <span>When this subscriber wins an auction, the Net Prize Disbursed (Pool Value minus Winning Discount Bid) will be recorded here alongside direct NEFT/RTGS transaction UTR numbers.</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </main>
      </div>
{/* ── MOBILE VIEW (md:hidden) ── */}
      <div className="md:hidden flex-1 flex flex-col min-w-0 bg-[#F8FAFC] relative">
        {/* App Header: Back Navigation & Profile Title */}
        <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 safe-top">
          <div className="px-4 py-3 flex items-center justify-between">
            <button 
              type="button"
              onClick={onBack} 
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-brand-600 transition-colors py-1.5 px-2 rounded-xl hover:bg-slate-100 active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
              </svg>
              <span>Members</span>
            </button>
            <div className="text-center">
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight">Member Profile</h1>
              <span className="text-[10px] font-mono text-slate-500">Ticket #{firstTicket}</span>
            </div>
            <div className="flex items-center gap-1">
              <a 
                href={cleanPhone ? `https://wa.me/91${cleanPhone}` : '#'} 
                target="_blank" 
                rel="noreferrer"
                className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors" 
                title="WhatsApp Member"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.97.57 3.81 1.558 5.372L2.5 22l4.808-1.047a9.98 9.98 0 0 0 4.723 1.18c5.536 0 10.031-4.496 10.031-10.032S17.567 2 12.031 2zm5.727 14.198c-.24.673-1.393 1.285-1.922 1.343-.497.054-1.127.08-3.266-.807-2.734-1.135-4.498-3.906-4.636-4.088-.137-.182-1.1-1.464-1.1-2.793 0-1.328.694-1.982.942-2.247.248-.266.541-.332.723-.332.183 0 .365.002.525.01.17.009.398-.065.621.472.23.555.787 1.92.855 2.06.068.14.113.303.023.483-.09.18-.135.292-.27.45-.135.158-.284.354-.405.474-.136.136-.278.283-.12.553.158.271.7 1.155 1.503 1.868 1.033.918 1.905 1.203 2.176 1.339.27.135.43.113.589-.069.158-.18.677-.788.857-1.059.18-.27.36-.226.602-.136.241.09 1.536.724 1.799.855.263.131.439.196.502.304.064.108.064.629-.176 1.302z"></path>
                </svg>
              </a>
              <a 
                href={cleanPhone ? `tel:+91${cleanPhone}` : '#'} 
                className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors" 
                title="Call"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </a>
            </div>
          </div>
        </header>

        {/* Main Scrollable Mobile Content */}
        <main className="flex-1 px-4 py-4 space-y-4 pb-28">
          {/* 1. Member Profile & Identity Mobile Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-card space-y-3.5">
            <div className="flex items-center gap-3.5">
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 font-extrabold text-lg flex items-center justify-center shadow-xs">
                  {memberInitial}
                </div>
                <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-slate-900 text-white font-mono text-[9px] font-bold border border-white shadow">
                  #{firstTicket}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 truncate">{memberName}</h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    memberProfile?.is_active !== false 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' 
                      : 'bg-rose-50 text-rose-700 border-rose-200/70'
                  }`}>
                    {memberProfile?.is_active !== false ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {memberProfile?.phone_number ? `+91 ${memberProfile.phone_number}` : 'No phone recorded'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md capitalize">
                    {memberProfile?.role || 'Subscriber'}
                  </span>
                  <span className="text-[10px] text-slate-400">Member since {memberSince}</span>
                </div>
              </div>
            </div>

            {/* Quick Outreach Callout Bar */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a 
                href={cleanPhone ? `https://wa.me/91${cleanPhone}` : '#'} 
                target="_blank" 
                rel="noreferrer"
                className="py-2 px-3 bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.97.57 3.81 1.558 5.372L2.5 22l4.808-1.047a9.98 9.98 0 0 0 4.723 1.18c5.536 0 10.031-4.496 10.031-10.032S17.567 2 12.031 2zm5.727 14.198c-.24.673-1.393 1.285-1.922 1.343-.497.054-1.127.08-3.266-.807-2.734-1.135-4.498-3.906-4.636-4.088-.137-.182-1.1-1.464-1.1-2.793 0-1.328.694-1.982.942-2.247.248-.266.541-.332.723-.332.183 0 .365.002.525.01.17.009.398-.065.621.472.23.555.787 1.92.855 2.06.068.14.113.303.023.483-.09.18-.135.292-.27.45-.135.158-.284.354-.405.474-.136.136-.278.283-.12.553.158.271.7 1.155 1.503 1.868 1.033.918 1.905 1.203 2.176 1.339.27.135.43.113.589-.069.158-.18.677-.788.857-1.059.18-.27.36-.226.602-.136.241.09 1.536.724 1.799.855.263.131.439.196.502.304.064.108.064.629-.176 1.302z"></path>
                </svg>
                <span>WhatsApp</span>
              </a>
              <a 
                href={cleanPhone ? `tel:+91${cleanPhone}` : '#'} 
                className="py-2 px-3 bg-slate-100 active:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
                <span>Phone Call</span>
              </a>
            </div>
          </div>

          {/* 2. Financial KPI Metric Highlights (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Total Paid */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Paid</span>
                <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold">₹</span>
              </div>
              <div className="mt-1.5">
                <span className="text-xl font-black text-slate-900 leading-tight">{formatCurrency(totalPaidIn)}</span>
                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                  {totalInstallmentsCount || memberTransactions.length} Installments
                </span>
              </div>
            </div>

            {/* Outstanding Dues */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Current Due</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                  allSettled 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60' 
                    : 'bg-rose-50 text-rose-600 border-rose-200/60'
                }`}>
                  {allSettled ? 'Settled' : `M${groupDuesBreakdowns[0]?.effectiveCurrentMonth ?? 1}`}
                </span>
              </div>
              <div className="mt-1.5">
                <span className={`text-xl font-black leading-tight ${allSettled ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(totalPendingCurrentDues)}
                </span>
                <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                  {allSettled ? 'Fully Clear' : 'Pending Due'}
                </span>
              </div>
            </div>

            {/* Chit Commitment */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Pool Value</span>
                <span className="text-[9px] font-bold text-brand-600 bg-brand-50 px-1 rounded">
                  {memberEnrollments.length} Pool{memberEnrollments.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="mt-1.5">
                <span className="text-base font-extrabold text-slate-900 leading-tight">
                  {formatCurrency(totalChitCommitment || 100000)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                  {groupDuesBreakdowns[0]?.groupName || 'Chit Pool'}
                </span>
              </div>
            </div>

            {/* Prize Pot Status */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Auction Status</span>
                <span className="text-xs">🎯</span>
              </div>
              <div className="mt-1.5">
                <span className="text-xs font-bold text-emerald-700 leading-tight block truncate">
                  {prizesWon.length > 0 ? `Won Prize (M${prizesWon[0].month})` : 'Eligible Bidder'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {prizesWon.length > 0 ? 'Disbursed' : `M${(groupDuesBreakdowns[0]?.effectiveCurrentMonth || 0) + 1} Auction`}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Physical Passbook QR & Token Management Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Physical Passbook &amp; QR</h3>
              {memberProfile?.passbook_token ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Synced
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Unlinked
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 p-1 flex items-center justify-center shadow-2xs flex-shrink-0">
                <svg className="w-full h-full text-slate-800" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm-2 10h8v8H2v-8zm2 2v4h4v-4H4zm10-14h8v8h-8V2zm2 2v4h4V4h-4zm-1 9h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm5-3h2v4h-2v-4zm-2 5h2v2h-2v-2zm-3 0h2v2h-2v-2zm5-2h2v2h-2v-2zM5 5h2v2H5V5zm0 12h2v2H5v-2zm12-12h2v2h-2V5z"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs font-black text-slate-900 truncate">
                  {memberProfile?.passbook_token || 'TOKEN-UNBOUND'}
                </div>
                <div className="text-[11px] text-slate-600 font-semibold mt-0.5">
                  Booklet #{String(firstTicket).padStart(2, '0')} <span className="text-slate-400 font-normal">· {memberProfile?.passbook_token ? 'Paired' : 'Pending'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
              <button 
                type="button"
                onClick={() => setIsPairingModalOpen(true)}
                className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-center transition-colors cursor-pointer"
              >
                Re-bind
              </button>
              <button 
                type="button"
                onClick={handleRevokePassbook}
                className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-center transition-colors cursor-pointer"
              >
                Revoke
              </button>
              <button 
                type="button"
                onClick={handlePrintMemberStickers}
                className="py-1.5 px-2 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-center font-bold transition-colors cursor-pointer"
              >
                Print Label
              </button>
            </div>
          </div>

          {/* 4. Administrative Security & MPIN Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Admin Controls &amp; Security</h3>
            
            {/* Access Cutoff Switch */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-900 block">Account Standing</span>
                <span className="text-[10px] text-slate-400">Portal &amp; auction bidding access</span>
              </div>
              <div className="flex bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
                <button 
                  type="button"
                  onClick={() => handleToggleStatus(true)}
                  className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    memberProfile?.is_active !== false ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Active
                </button>
                <button 
                  type="button"
                  onClick={() => handleToggleStatus(false)}
                  className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    memberProfile?.is_active === false ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-rose-600'
                  }`}
                >
                  Suspend
                </button>
              </div>
            </div>

            {/* Role Selector */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-900 block">Assigned Role</span>
                <span className="text-[10px] text-slate-400">System privilege tier</span>
              </div>
              <select 
                value={memberProfile?.role || 'subscriber'}
                onChange={(e) => handleUpdateRole(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-brand-500 cursor-pointer"
              >
                <option value="subscriber">Subscriber</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Quick Login MPIN Management */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="font-bold text-slate-900 block">Quick Login MPIN</span>
                <span className="font-mono text-xs font-bold text-slate-700 tracking-widest">
                  {showMemberPin ? (memberProfile?.mpin || '1234') : '••••'}{' '}
                  <span className="text-[9px] text-slate-400 font-sans tracking-normal font-normal">
                    {(!memberProfile?.mpin || memberProfile?.mpin === '1234') ? '(Default 1234)' : '(Encrypted)'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => setShowMemberPin(!showMemberPin)}
                  className="text-[11px] font-semibold text-slate-600 px-2 py-1 bg-white border border-slate-200 rounded-md cursor-pointer"
                >
                  {showMemberPin ? 'Hide' : 'Reveal'}
                </button>
                <button 
                  type="button"
                  onClick={handleResetPinToDefault}
                  className="text-[11px] font-bold text-brand-700 px-2 py-1 bg-brand-50 rounded-md cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* 5. Enrolled Chit Scheme Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Enrolled Chit Scheme</h3>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">Ticket #{firstTicket}</span>
            </div>

            {groupDuesBreakdowns.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                No active chit groups enrolled.
              </div>
            ) : (
              groupDuesBreakdowns.map((grpDues: any) => {
                const firstUnpaid = grpDues.unpaidMonths?.[0];
                return (
                  <div key={grpDues.enrollmentId} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{grpDues.groupName} ({formatCurrency(grpDues.totalValue)} Pool)</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">{grpDues.durationMonths} Months Duration · Cycle {grpDues.effectiveCurrentMonth}/{grpDues.durationMonths}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleOpenRecordPayment(grpDues.groupId, firstUnpaid?.month, firstUnpaid?.remainingDue)}
                        className="text-[11px] font-bold text-brand-600 bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer hover:bg-slate-50"
                      >
                        Pay Ticket
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Monthly Installment</span>
                        <span className="font-bold text-slate-800">{formatCurrency(grpDues.memberInstallment)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Cycle M{grpDues.effectiveCurrentMonth} Balance</span>
                        <span className={`font-bold ${grpDues.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {grpDues.outstandingBalance > 0 ? `${formatCurrency(grpDues.outstandingBalance)} Due` : 'Settled'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 6. Historical Payment Ledger List (Itemized) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Payment Ledger</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{memberTransactions.length} Recorded Collections</p>
              </div>
              <button 
                type="button"
                onClick={() => handleOpenRecordPayment()}
                className="text-xs font-bold text-brand-600 hover:underline cursor-pointer"
              >
                + New Payment
              </button>
            </div>

            {/* Transaction Items */}
            <div className="space-y-2.5 divide-y divide-slate-100 text-xs">
              {memberTransactions.length === 0 ? (
                <div className="py-4 text-center text-slate-400 text-xs">
                  No payment transactions recorded yet.
                </div>
              ) : (
                memberTransactions.map((tx: any) => {
                  const txDate = tx.created_at ? new Date(tx.created_at) : new Date();
                  const dateStr = txDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  const recCode = `#REC-${tx.id ? tx.id.slice(0, 4).toUpperCase() : '001'}`;
                  const isCash = !tx.wallet_type || tx.wallet_type === 'cash_in_hand';
                  const methodText = isCash ? 'Cash (Box #1)' : tx.wallet_type === 'kishor_bank' ? 'UPI / GPay' : 'Bank Transfer';

                  return (
                    <div key={tx.id} className="pt-2 first:pt-0 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">{recCode}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                            {tx.cycle_month !== null && tx.cycle_month !== undefined ? `M${tx.cycle_month}` : 'General'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{dateStr} · {methodText}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-600 text-sm block">
                          +{formatCurrency(Number(tx.amount || 0))}
                        </span>
                        <button 
                          type="button"
                          onClick={() => setViewingReceiptTx(tx)}
                          className="text-[10px] text-brand-600 font-semibold hover:underline cursor-pointer"
                        >
                          Receipt
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Ledger Total Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Cumulative Total:</span>
              <span className="font-black text-slate-900 text-sm">{formatCurrency(totalPaidIn)}</span>
            </div>
          </div>
        </main>

        {/* Floating Record Payment Action Button & Bottom Bar */}
        <div className="sticky bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 safe-bottom z-20 flex items-center gap-3">
          <button 
            type="button"
            onClick={() => handleOpenRecordPayment()}
            className="flex-1 py-3 px-4 bg-brand-600 hover:bg-brand-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-float flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
            </svg>
            <span>Record Installment Payment</span>
          </button>
          <button 
            type="button"
            onClick={() => window.print()}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer" 
            title="Export Ledger"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* ── RECORD / EDIT PAYMENT MODAL ── */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 border border-slate-200 text-slate-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingTransaction ? 'Edit Recorded Payment' : 'Record Member Payment'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {memberName} · Ticket #{firstTicket}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModalPayment} className="space-y-4">
              {/* Target Group */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Target Chit Group</label>
                <select
                  value={modalTargetGroupId}
                  onChange={(e) => setModalTargetGroupId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none"
                  required
                >
                  {allChitGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({formatCurrency(g.total_value)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount & Month */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={quickPaymentAmount}
                    onChange={(e) => setQuickPaymentAmount(e.target.value)}
                    placeholder="10000"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Cycle Month</label>
                  <input
                    type="number"
                    min="0"
                    value={modalTargetMonth}
                    onChange={(e) => setModalTargetMonth(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Vault / Wallet Selector */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Deposit Into Account / Vault</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'cash_in_hand', label: 'Cash In Hand' },
                    { id: 'kishor_bank', label: 'Kishor Bank (UPI)' },
                    { id: 'dad_bank', label: 'Dad Bank' },
                    { id: 'mom_bank', label: 'Mom Bank' },
                  ].map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setPaymentWalletType(w.id)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                        paymentWalletType === w.id
                          ? 'bg-brand-50 border-brand-500 text-brand-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Paid via GPay / Handed cash to Dad"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              {/* Receipt Photo */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Receipt Attachment</label>
                {paymentReceiptUrl ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <img src={paymentReceiptUrl} alt="Receipt" className="w-9 h-9 object-cover rounded-lg" />
                      <span className="text-xs font-bold text-emerald-700">Receipt Ready</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentReceiptUrl('')}
                      className="text-rose-600 text-xs font-bold hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id="member-receipt-upload"
                      accept="image/*"
                      onChange={handleReceiptPhotoUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="member-receipt-upload"
                      className="flex items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-brand-500 bg-slate-50 rounded-xl py-2.5 px-3 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer transition-colors"
                    >
                      <Paperclip size={14} className="text-brand-600" />
                      <span>Attach receipt photo</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                {editingTransaction ? (
                  <button
                    type="button"
                    onClick={() => handleDeletePayment(editingTransaction)}
                    className="text-rose-600 hover:bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingPayment}
                    className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingPayment ? 'Saving...' : 'Save Payment'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Camera QR Scanner Modal for Pairing ── */}
      <PassbookScannerModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        onScanSuccess={handlePairScanSuccess}
        title="Pair Physical Passbook QR"
        subtitle="Point camera at the QR code on the physical pocket book"
        targetMemberName={memberName}
      />

      {/* ── A4 PDF Sticker Sheet Exporter ── */}
      <PassbookSheetGeneratorModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        items={printItems}
        defaultTitle={`${memberName} — Passbook Sticker Sheet`}
      />

      {/* ── Rendered PNG Payment Receipt Modal ── */}
      {viewingReceiptTx && (() => {
        const matchedEnrollment = memberEnrollments.find(e => e.group_id === viewingReceiptTx.group_id) || memberEnrollments[0];
        const matchedGroup = matchedEnrollment?.chit_groups;
        const ticket = matchedEnrollment?.ticket_number ?? 1;
        const txMonth = viewingReceiptTx.month ?? matchedGroup?.current_month ?? 1;

        const grpBreakdown = (groupDuesBreakdowns || []).find((b: any) => b?.groupId === viewingReceiptTx.group_id || b?.groupId === matchedGroup?.id);
        let pastPendingDues = 0;
        const pastPendingMonths: number[] = [];

        if (grpBreakdown?.monthDues) {
          grpBreakdown.monthDues.forEach((md: any) => {
            if (md.month < txMonth && md.remainingDue > 0) {
              pastPendingDues += md.remainingDue;
              pastPendingMonths.push(md.month);
            }
          });
        }

        return (
          <PaymentReceiptModal
            isOpen={Boolean(viewingReceiptTx)}
            onClose={() => setViewingReceiptTx(null)}
            transaction={viewingReceiptTx}
            member={{
              name: memberProfile?.full_name || 'Subscriber',
              ticket: ticket,
              phone: memberProfile?.phone_number || ''
            }}
            group={matchedGroup || { name: 'Chit Group', monthly_installment: 10000 }}
            month={txMonth}
            totalDue={matchedGroup?.monthly_installment}
            organizerCompanyName={organizationName}
            organizerInitials={organizationInitials}
            formatCurrency={formatCurrency}
            pastPendingDues={pastPendingDues}
            pastPendingMonths={pastPendingMonths}
          />
        );
      })()}

      {/* ── Admin Member PIN Management Modal ── */}
      {isEditingPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <KeyRound size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Manage Member PIN</h3>
                  <p className="text-[11px] text-slate-500 font-medium">{memberName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingPinModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Current PIN Status Card */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Current MPIN:</span>
                <span className="font-mono font-bold text-brand-700 text-sm bg-brand-50 px-2 py-0.5 rounded-lg border border-brand-200">
                  {memberProfile?.mpin || '1234'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Status:</span>
                <span className={`font-bold ${(!memberProfile?.mpin || memberProfile?.mpin === '1234') ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {(!memberProfile?.mpin || memberProfile?.mpin === '1234') ? 'Default PIN (1234)' : 'Custom Subscriber PIN'}
                </span>
              </div>
            </div>

            {/* Reset to Default Button */}
            <button
              type="button"
              onClick={handleResetPinToDefault}
              disabled={isSavingPin || memberProfile?.mpin === '1234'}
              className="w-full py-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={isSavingPin ? 'animate-spin' : ''} />
              <span>Reset PIN to Default (1234)</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-bold uppercase">Or Set Custom PIN</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Custom PIN Form */}
            <form onSubmit={handleSaveCustomPin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  New 4 to 6 Digit PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={customPinInput}
                  onChange={(e) => setCustomPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 5829"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm font-bold text-slate-900 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingPinModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin || !customPinInput}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSavingPin ? 'Saving...' : 'Save PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
