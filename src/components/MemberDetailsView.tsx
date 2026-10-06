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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Navigation Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-[#AEABD8] hover:text-white bg-[#1D1D41] hover:bg-[#27264E] border border-[#27264E] px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Members</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#02B15A] bg-[#02B15A]/10 border border-[#02B15A]/30 px-3 py-1 rounded-xl flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-[#02B15A]" />
            <span>{allSettled ? 'Paid' : 'Active'}</span>
          </span>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xs space-y-4 sm:space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
            <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#9C2CF3] to-[#3A6FF9] text-white font-extrabold text-xl sm:text-2xl flex items-center justify-center shadow-lg shrink-0 aspect-square">
              {memberInitial}
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-bold text-white leading-snug truncate">{memberName}</h2>
                <span className="text-[10px] sm:text-xs font-semibold bg-[#141332] text-[#AEABD8] border border-[#27264E] px-2 sm:px-2.5 py-0.5 rounded-full shrink-0">
                  {memberEnrollments.length} {memberEnrollments.length === 1 ? 'active chit' : 'active chits'}
                </span>
              </div>
              <p className="text-xs text-[#AEABD8] flex items-center gap-1.5 font-medium">
                <Phone size={12} className="text-[#64CFF6] shrink-0" />
                <span>{memberProfile?.phone_number || 'No phone recorded'}</span>
              </p>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] sm:text-xs font-bold bg-[#02B15A]/15 text-[#02B15A] px-2 sm:px-2.5 py-0.5 rounded-full border border-[#02B15A]/30 shrink-0">
                  +{formatCurrency(totalPaidIn)} paid in
                </span>
                <span className="text-[10px] sm:text-xs font-semibold bg-[#141332] text-[#AEABD8] border border-[#27264E] px-2 sm:px-2.5 py-0.5 rounded-full shrink-0">
                  Portal · {memberProfile?.role === 'subscriber' ? 'Active' : 'Admin'}
                </span>
                {memberProfile?.passbook_token ? (
                  <span className="text-[10px] sm:text-xs font-bold bg-[#02B15A]/15 text-[#02B15A] border border-[#02B15A]/30 px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <CheckCircle2 size={11} /> QR Linked
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-xs font-semibold bg-[#141332] text-[#AEABD8] border border-[#27264E] px-2 sm:px-2.5 py-0.5 rounded-full shrink-0">
                    QR Unlinked
                  </span>
                )}

                {/* Security PIN Badge & Reveal Control */}
                <div className="flex items-center gap-1 bg-[#141332] hover:bg-[#141332]/80 border border-[#27264E] px-2 sm:px-2.5 py-0.5 rounded-full transition-colors">
                  <KeyRound size={11} className="text-[#64CFF6] shrink-0" />
                  <span className="text-[10px] sm:text-xs text-[#AEABD8] font-medium">PIN:</span>
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-white">
                    {showMemberPin ? (memberProfile?.mpin || '1234') : '••••'}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !showMemberPin;
                      setShowMemberPin(next);
                      if (next && profile?.id) {
                        try {
                          await supabase.from('security_audit_logs').insert({
                            admin_id: profile.id,
                            action_description: `PIN VIEWED: Admin viewed MPIN for member ${memberName} (${memberProfile?.phone_number || ''})`,
                            target_table: 'profiles',
                          });
                        } catch (e) {
                          console.warn('Audit log insert note:', e);
                        }
                      }
                    }}
                    title={showMemberPin ? 'Hide PIN' : 'Reveal PIN'}
                    className="p-0.5 text-[#AEABD8] hover:text-white transition-colors cursor-pointer"
                  >
                    {showMemberPin ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>

                  {(!memberProfile?.mpin || memberProfile?.mpin === '1234') ? (
                    <span className="text-[9px] font-bold bg-[#FFBB38]/20 text-[#FFBB38] border border-[#FFBB38]/30 px-1.5 rounded ml-0.5">
                      Default
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold bg-[#02B15A]/20 text-[#02B15A] border border-[#02B15A]/30 px-1.5 rounded ml-0.5">
                      Custom
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons: clean 2-column grid on mobile, inline row on desktop */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setCustomPinInput(memberProfile?.mpin || '1234');
                setIsEditingPinModal(true);
              }}
              className="border border-[#27264E] bg-[#141332] hover:bg-[#27264E] text-[#64CFF6] font-bold text-xs px-3 py-2.5 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 text-center cursor-pointer"
            >
              <KeyRound size={14} className="shrink-0" />
              <span>Manage PIN</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPairingModalOpen(true)}
              className="border border-[#27264E] bg-[#141332] hover:bg-[#27264E] text-white font-bold text-xs px-3 py-2.5 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 text-center cursor-pointer"
            >
              <QrCode size={14} className="text-[#64CFF6] shrink-0" />
              <span>{memberProfile?.passbook_token ? 'Re-Pair QR' : 'Pair QR'}</span>
            </button>

            {memberProfile?.passbook_token && (
              <button
                type="button"
                onClick={handlePrintMemberStickers}
                className="border border-[#27264E] bg-[#141332] hover:bg-[#27264E] text-white font-bold text-xs px-3 py-2.5 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 text-center cursor-pointer"
              >
                <Printer size={14} className="text-[#64CFF6] shrink-0" />
                <span>Print ({Math.max(1, memberEnrollments.length)})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSharePassbookWhatsApp}
              className="border border-[#02B15A]/40 bg-[#02B15A]/10 hover:bg-[#02B15A]/20 text-[#02B15A] font-bold text-xs px-3 py-2.5 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 text-center cursor-pointer"
            >
              <Share2 size={14} className="shrink-0" />
              <span>WhatsApp Card</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenRecordPayment()}
              className="col-span-2 sm:col-span-1 bg-gradient-to-r from-[#9C2CF3] to-[#3A6FF9] hover:opacity-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Plus size={15} className="shrink-0" />
              <span>Record Payment</span>
            </button>
          </div>
        </div>

        {/* Status / Settlement Banner with Detailed Breakdown */}
        <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all shadow-xs ${
          allSettled 
            ? 'bg-[#02B15A]/10 border-[#02B15A]/30 text-[#02B15A]' 
            : 'bg-[#FFBB38]/10 border-[#FFBB38]/30 text-[#FFBB38]'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                allSettled ? 'bg-[#02B15A]/20 text-[#02B15A]' : 'bg-[#FFBB38]/20 text-[#FFBB38]'
              }`}>
                {allSettled ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                    {allSettled 
                      ? 'All dues settled for current cycle · ₹0 Pending' 
                      : `Outstanding Dues: ${formatCurrency(totalPendingCurrentDues)} Pending`}
                  </h4>
                  {!allSettled && (
                    <span className="text-[10px] font-extrabold bg-[#E41414]/20 text-[#E41414] px-2.5 py-0.5 rounded-md uppercase tracking-wider border border-[#E41414]/30 shrink-0">
                      Payment Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#AEABD8] mt-1 sm:mt-0.5 leading-normal">
                  {allSettled
                    ? 'All active chit groups are completely paid up to the current active month.'
                    : `Uncollected balance across ${groupsWithDues.length} chit ${groupsWithDues.length === 1 ? 'group' : 'groups'}. Click any month below to record.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0">
              {!allSettled && (
                <button
                  type="button"
                  onClick={() => {
                    const firstUnpaidGrp = groupsWithDues[0];
                    const firstUnpaidMonth = firstUnpaidGrp?.unpaidMonths[0];
                    handleOpenRecordPayment(
                      firstUnpaidGrp?.groupId,
                      firstUnpaidMonth?.month,
                      firstUnpaidMonth?.remainingDue
                    );
                  }}
                  className="bg-[#FFBB38] hover:bg-[#FFBB38]/90 text-[#141332] font-black text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 shrink-0 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Collect Due</span>
                </button>
              )}
              <span className={`text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border shrink-0 ${
                allSettled 
                  ? 'bg-[#02B15A]/20 border-[#02B15A]/40 text-[#02B15A]' 
                  : 'bg-[#FFBB38]/20 border-[#FFBB38]/40 text-[#FFBB38]'
              }`}>
                {allSettled ? '0 DUE' : `${formatCurrency(totalPendingCurrentDues)} PENDING`}
              </span>
            </div>
          </div>

          {/* Detailed Breakdown Chips for Unpaid Months */}
          {!allSettled && groupsWithDues.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#FFBB38]/20 space-y-2">
              <div className="text-[10px] sm:text-[11px] font-bold text-[#FFBB38] uppercase tracking-wider">
                Pending Dues Breakdown:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {groupsWithDues.map((grp: any) => (
                  <div key={grp.groupId} className="bg-[#141332] border border-[#27264E] rounded-xl p-2.5 flex flex-col justify-between gap-1.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {grp.groupName} <span className="text-[#AEABD8] font-mono text-[11px]">(Ticket #{grp.ticketNumber})</span>
                      </span>
                      <span className="text-xs font-extrabold text-[#FFBB38] shrink-0">
                        {formatCurrency(grp.outstandingBalance)} due
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {grp.unpaidMonths.map((m: any) => (
                        <button
                          key={m.month}
                          type="button"
                          onClick={() => handleOpenRecordPayment(grp.groupId, m.month, m.remainingDue)}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                            m.status === 'partial'
                              ? 'bg-[#FFBB38]/20 text-[#FFBB38] border-[#FFBB38]/40 hover:bg-[#FFBB38]/30'
                              : 'bg-[#E41414]/20 text-[#E41414] border-[#E41414]/30 hover:bg-[#E41414]/30'
                          }`}
                          title={`Click to record ${m.label} payment of ${formatCurrency(m.remainingDue)}`}
                        >
                          <span>{m.month === 0 ? 'M0 (Launch)' : `M${m.month}`}:</span>
                          <span className="font-extrabold">{formatCurrency(m.remainingDue)}</span>
                          <span className="text-[9px] uppercase opacity-75">({m.status})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3 Metric Stat Boxes */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-1">
          <div className="bg-[#141332] border border-[#27264E] rounded-2xl p-3 sm:p-4.5 space-y-0.5 sm:space-y-1">
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider">
              <ArrowDownLeft size={12} className="text-[#02B15A] shrink-0" />
              <span className="truncate">Paid In</span>
            </div>
            <div className="text-sm sm:text-2xl font-extrabold text-[#02B15A] leading-none truncate">
              {formatCurrency(totalPaidIn)}
            </div>
          </div>

          <div className="bg-[#141332] border border-[#27264E] rounded-2xl p-3 sm:p-4.5 space-y-0.5 sm:space-y-1">
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider">
              <ArrowUpRight size={12} className="text-[#FFBB38] shrink-0" />
              <span className="truncate">Paid Out</span>
            </div>
            <div className="text-sm sm:text-2xl font-extrabold text-[#FFBB38] leading-none truncate">
              {formatCurrency(totalPaidOut)}
            </div>
          </div>

          <div className="bg-[#141332] border border-[#27264E] rounded-2xl p-3 sm:p-4.5 space-y-0.5 sm:space-y-1">
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider">
              <Clock size={12} className="text-[#64CFF6] shrink-0" />
              <span className="truncate">To Go</span>
            </div>
            <div className="text-sm sm:text-2xl font-extrabold text-white leading-none truncate">
              {formatCurrency(totalRemainingToGo)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {totalExpectedDue > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex justify-between text-xs font-semibold text-[#AEABD8]">
              <span>Installment Completion Progress</span>
              <span className="font-bold text-white">{Math.min(100, Math.round((totalPaidIn / totalExpectedDue) * 100))}%</span>
            </div>
            <div className="w-full bg-[#141332] rounded-full h-2.5 overflow-hidden border border-[#27264E]">
              <div
                className="bg-gradient-to-r from-[#02B15A] to-[#64CFF6] h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (totalPaidIn / totalExpectedDue) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 4 Interactive Subtabs Bar (Chits | Payments | Prizes | Activity) */}
      <div className="flex items-center bg-[#1D1D41] p-1 sm:p-1.5 rounded-2xl border border-[#27264E] w-full sm:max-w-md">
        {[
          { id: 'chits', label: 'Chits', count: memberEnrollments.length },
          { id: 'payments', label: 'Payments', count: memberTransactions.length },
          { id: 'prizes', label: 'Prizes', count: prizesWon.length },
          { id: 'activity', label: 'Activity' },
        ].map((tab) => {
          const isActive = activeSubtab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubtab(tab.id as any)}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-[#6359E9] text-white shadow-xs'
                  : 'text-[#AEABD8] hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#141332] text-[#AEABD8]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Subtab 1: Chits ──────────────────────────────────────────────────────── */}
      {activeSubtab === 'chits' && (
        <div className="space-y-4">
          <div className="text-xs text-[#AEABD8] font-semibold px-1">
            {memberEnrollments.length} {memberEnrollments.length === 1 ? 'chit group' : 'chit groups'} enrolled
          </div>

          {memberEnrollments.length === 0 ? (
            <div className="bg-[#1D1D41] border border-[#27264E] rounded-3xl p-8 text-center text-[#AEABD8] text-xs">
              No chit group enrollments found for this subscriber.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {(groupDuesBreakdowns || []).map((grpDues: any) => {
                const groupWonPrize = prizesWon.find((p: any) => p.groupId === grpDues.groupId);

                return (
                  <div key={grpDues.enrollmentId} className="bg-[#1D1D41] border border-[#27264E] rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27264E] pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white leading-snug">{grpDues.groupName}</h3>
                          <span className="text-[10px] font-mono font-bold bg-[#141332] text-[#64CFF6] px-2 py-0.5 rounded-lg border border-[#27264E]">
                            Ticket #{grpDues.ticketNumber}
                          </span>
                          {grpDues.isSettled ? (
                            <span className="text-[10px] font-semibold bg-[#02B15A]/15 text-[#02B15A] px-2 py-0.5 rounded-lg border border-[#02B15A]/30 flex items-center gap-1">
                              <Check size={11} /> Settled
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-[#FFBB38]/15 text-[#FFBB38] px-2 py-0.5 rounded-lg border border-[#FFBB38]/30 flex items-center gap-1">
                              <AlertCircle size={11} className="text-[#FFBB38]" />
                              {formatCurrency(grpDues.outstandingBalance)} Due
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#AEABD8] mt-1 leading-normal">
                          {formatCurrency(grpDues.totalValue)} total value · {grpDues.durationMonths} months duration · Monthly: {formatCurrency(grpDues.memberInstallment)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!grpDues.isSettled && (
                          <button
                            type="button"
                            onClick={() => {
                              const firstUnpaid = grpDues.unpaidMonths?.[0];
                              handleOpenRecordPayment(grpDues.groupId, firstUnpaid?.month, firstUnpaid?.remainingDue);
                            }}
                            className="text-xs font-bold bg-[#02B15A] hover:bg-[#02B15A]/90 text-white flex items-center gap-1 py-1.5 px-3 rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>Record Payment</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActiveSubtab('payments');
                            setSelectedChitFilter(grpDues.groupId);
                          }}
                          className="text-xs font-bold text-[#64CFF6] hover:text-[#6359E9] flex items-center gap-1 py-1.5 px-2.5 rounded-xl hover:bg-[#141332] transition-colors cursor-pointer"
                        >
                          <span>View ledger</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Interactive Month-by-Month Status Matrix */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider">
                          Cycle Payment Status (M0 to Active Month)
                        </span>
                        <span className={`text-[11px] font-extrabold ${grpDues.isSettled ? 'text-[#02B15A]' : 'text-[#FFBB38]'}`}>
                          {grpDues.isSettled ? 'All active cycles settled' : `${formatCurrency(grpDues.outstandingBalance)} Pending Due`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {grpDues.monthDues.map((m: any) => {
                          const isFree = m.status === 'free_laaba';
                          const isPaid = m.status === 'paid';
                          const isPartial = m.status === 'partial';
                          const isUnpaid = m.status === 'unpaid';

                          return (
                            <button
                              key={m.month}
                              type="button"
                              onClick={() => {
                                if (m.remainingDue > 0) {
                                  handleOpenRecordPayment(grpDues.groupId, m.month, m.remainingDue);
                                }
                              }}
                              className={`p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between ${
                                m.remainingDue > 0 
                                  ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-98' 
                                  : 'cursor-default'
                              } ${
                                isPaid
                                  ? 'bg-[#02B15A]/15 border-[#02B15A]/30 text-[#02B15A]'
                                  : isFree
                                  ? 'bg-[#6359E9]/20 border-[#6359E9]/40 text-[#64CFF6]'
                                  : isPartial
                                  ? 'bg-[#FFBB38]/15 border-[#FFBB38]/40 text-[#FFBB38] ring-1 ring-[#FFBB38]/40'
                                  : 'bg-[#E41414]/15 border-[#E41414]/30 text-[#E41414] ring-1 ring-[#E41414]/30'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[11px] font-extrabold">
                                  {m.month === 0 ? 'M0 (Launch)' : `Month ${m.month}`}
                                </span>
                                {m.isCurrentCycle && (
                                  <span className="text-[8px] font-extrabold bg-[#64CFF6]/20 text-[#64CFF6] px-1.5 py-0.2 rounded-sm uppercase tracking-wider">
                                    Active
                                  </span>
                                )}
                              </div>

                              <div className="mt-1.5 space-y-0.5">
                                {isPaid && (
                                  <div>
                                    <span className="text-[9px] font-bold text-[#02B15A] uppercase block">Paid Full</span>
                                    <span className="text-xs font-extrabold text-white">{formatCurrency(m.paidAmount)}</span>
                                  </div>
                                )}
                                {isFree && (
                                  <div>
                                    <span className="text-[9px] font-bold text-[#64CFF6] uppercase block">Free Month</span>
                                    <span className="text-xs font-extrabold text-white">₹0 (Laaba Seetu)</span>
                                  </div>
                                )}
                                {isPartial && (
                                  <div>
                                    <span className="text-[9px] font-bold text-[#FFBB38] uppercase block">
                                      Paid {formatCurrency(m.paidAmount)} / {formatCurrency(m.expectedDue)}
                                    </span>
                                    <span className="text-xs font-extrabold text-white">Due: {formatCurrency(m.remainingDue)}</span>
                                  </div>
                                )}
                                {isUnpaid && (
                                  <div>
                                    <span className="text-[9px] font-bold text-[#E41414] uppercase block">Unpaid</span>
                                    <span className="text-xs font-extrabold text-white">Due: {formatCurrency(m.remainingDue)}</span>
                                  </div>
                                )}
                              </div>

                              {m.remainingDue > 0 && (
                                <div className="mt-2 pt-1.5 border-t border-current/10 flex items-center justify-between text-[10px] font-bold text-[#FFBB38]">
                                  <span>Pay month</span>
                                  <ChevronRight size={12} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Group Financial Summary & Prize Strip */}
                    <div className="bg-[#141332] border border-[#27264E] rounded-2xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div>
                          <span className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Total Paid in Group</span>
                          <span className="text-sm font-extrabold text-[#02B15A] mt-0.5 block">{formatCurrency(grpDues.totalPaidForGroup)}</span>
                        </div>
                        <div className="h-7 w-[1px] bg-[#27264E] hidden sm:block" />
                        <div>
                          <span className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Active Cycles Due</span>
                          <span className={`text-sm font-extrabold mt-0.5 block ${grpDues.isSettled ? 'text-[#AEABD8]' : 'text-[#FFBB38]'}`}>
                            {formatCurrency(grpDues.outstandingBalance)}
                          </span>
                        </div>
                        <div className="h-7 w-[1px] bg-[#27264E] hidden sm:block" />
                        <div>
                          <span className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Lifetime Commitment To Go</span>
                          <span className="text-sm font-extrabold text-white mt-0.5 block">{formatCurrency(grpDues.lifetimeRemainingToGo)}</span>
                        </div>
                      </div>

                      {groupWonPrize && (
                        <div className="bg-[#FFBB38]/15 border border-[#FFBB38]/30 rounded-xl px-3 py-1.5 text-right shrink-0">
                          <span className="text-[9px] text-[#FFBB38] font-bold uppercase tracking-wider block">Auction Winner</span>
                          <span className="font-extrabold text-white flex items-center gap-1 text-xs">
                            <Trophy size={13} className="text-[#FFBB38]" />
                            Won prize ({formatCurrency(groupWonPrize.netPayout)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Subtab 2: Payments ───────────────────────────────────────────────────── */}
      {activeSubtab === 'payments' && (
        <div className="space-y-4">
          
          {/* Search and Filters Bar */}
          <div className="bg-[#1D1D41] border border-[#27264E] rounded-3xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3.5 top-3 text-[#AEABD8]" />
              <input
                type="text"
                placeholder="Search amount, chit, method, notes..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-white placeholder-[#AEABD8]/60 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={selectedChitFilter}
                onChange={(e) => setSelectedChitFilter(e.target.value)}
                className="bg-[#141332] border border-[#27264E] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#6359E9]"
              >
                <option value="all">All chits</option>
                {allChitGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="bg-[#141332] border border-[#27264E] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#6359E9]"
              >
                <option value="all">All types</option>
                <option value="collection">Collections</option>
                <option value="payout">Payouts</option>
              </select>

              <button
                onClick={() => handleOpenRecordPayment()}
                className="bg-[#6359E9] hover:bg-[#6F64FF] text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 shrink-0 active:scale-95 shadow-2xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Record</span>
              </button>
            </div>
          </div>

          {/* Transactions Ledger List */}
          <div className="bg-[#1D1D41] border border-[#27264E] rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex justify-between items-center border-b border-[#27264E] pb-3">
              <span className="text-xs font-bold text-white">
                {filteredPayments.length} receipts found
              </span>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="py-10 text-center text-[#AEABD8] text-xs">
                No payment transactions match the selected filters.
              </div>
            ) : (
              <div className="divide-y divide-[#27264E]">
                {filteredPayments.map((tx) => {
                  const txDate = tx.created_at ? new Date(tx.created_at) : new Date();
                  const monthName = txDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                  const dayNum = txDate.getDate();
                  const groupObj = allChitGroups.find(g => g.id === tx.group_id);
                  const isCollection = tx.type === 'collection';

                  return (
                    <div key={tx.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-[#141332]/60 rounded-2xl px-3.5 transition-colors">
                      <div className="flex items-center gap-3.5">
                        {/* Date Pill */}
                        <div className="w-11 h-11 rounded-2xl bg-[#141332] border border-[#27264E] flex flex-col items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-[#AEABD8] uppercase">{monthName}</span>
                          <span className="text-sm font-extrabold text-white leading-none">{dayNum}</span>
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white leading-snug">
                              {groupObj?.name || 'Chit Group'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isCollection 
                                ? 'bg-[#02B15A]/15 text-[#02B15A] border-[#02B15A]/30' 
                                : 'bg-[#FFBB38]/15 text-[#FFBB38] border-[#FFBB38]/30'
                            }`}>
                              {isCollection ? 'Collection' : 'Prize Payout'}
                            </span>
                            <span className="text-[10px] font-mono font-semibold bg-[#141332] text-[#AEABD8] border border-[#27264E] px-2 py-0.5 rounded-md">
                              {tx.wallet_type === 'kishor_bank'
                                ? 'KISHOR BANK (UPI)'
                                : tx.wallet_type === 'dad_bank'
                                ? 'DAD BANK'
                                : tx.wallet_type === 'mom_bank'
                                ? 'MOM BANK'
                                : 'CASH IN HAND'}
                            </span>
                            {tx.verification_proof_url && (
                              <a
                                href={tx.verification_proof_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] font-bold bg-[#6359E9]/20 hover:bg-[#6359E9]/30 text-[#64CFF6] border border-[#6359E9]/40 px-2 py-0.5 rounded-md flex items-center gap-1"
                              >
                                <Paperclip size={10} /> Receipt
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-[#AEABD8] max-w-md truncate leading-normal">
                            {tx.notes || 'Monthly chit installment payment'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <span className={`text-sm sm:text-base font-extrabold mr-1 ${
                          isCollection ? 'text-[#02B15A]' : 'text-[#FFBB38]'
                        }`}>
                          {isCollection ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isCollection && (
                            <button
                              type="button"
                              onClick={() => {
                                setViewingReceiptTx(tx);
                              }}
                              title="Share Rendered Receipt PNG"
                              className="p-2 text-[#02B15A] bg-[#02B15A]/10 hover:bg-[#02B15A]/20 border border-[#02B15A]/30 rounded-xl transition-colors active:scale-95 cursor-pointer shadow-2xs"
                            >
                              <Share2 size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEditPayment(tx)}
                            title="Edit receipt"
                            className="p-2 text-[#AEABD8] hover:text-[#64CFF6] hover:bg-[#141332] border border-[#27264E] rounded-xl transition-colors active:scale-95 cursor-pointer"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(tx)}
                            title="Delete receipt"
                            className="p-2 text-[#AEABD8] hover:text-[#E41414] hover:bg-[#E41414]/15 border border-[#27264E] rounded-xl transition-colors active:scale-95 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Subtab 3: Prizes (Adapted to our Chit Fund system!) ───────────────────── */}
      {activeSubtab === 'prizes' && (
        <div className="space-y-4">
          <div className="text-xs text-[#AEABD8] font-semibold px-1">
            {prizesWon.length} {prizesWon.length === 1 ? 'prize won' : 'prizes won'}
          </div>

          {prizesWon.length === 0 ? (
            <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl p-8 text-center text-[#AEABD8] text-xs">
              No auction prizes won by this subscriber yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {prizesWon.map((prize, idx) => (
                <div key={idx} className="bg-[#1D1D41] border border-[#27264E] rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27264E] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FFBB38]/20 text-[#FFBB38] flex items-center justify-center font-bold">
                        <Trophy size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{prize.groupName}</h4>
                        <p className="text-[11px] text-[#AEABD8]">Month {prize.month} Auction</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Total Chit Value</span>
                      <span className="text-base font-extrabold text-white">{formatCurrency(prize.totalValue)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-[#141332] border border-[#27264E] rounded-xl p-3">
                      <span className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Bid Discount</span>
                      <span className="font-bold text-white">{formatCurrency(prize.winningBid)}</span>
                    </div>

                    <div className="bg-[#141332] border border-[#27264E] rounded-xl p-3">
                      <span className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Pool Credit</span>
                      <span className="font-bold text-[#64CFF6]">+{formatCurrency(prize.winningBid)}</span>
                    </div>

                    <div className="bg-[#02B15A]/15 border border-[#02B15A]/30 rounded-xl p-3">
                      <span className="text-[10px] text-[#02B15A] font-bold uppercase tracking-wider block">Net Member Payout</span>
                      <span className="font-extrabold text-[#02B15A]">{formatCurrency(prize.netPayout)}</span>
                    </div>

                    <div className="bg-[#141332] border border-[#27264E] rounded-xl p-3">
                      <span className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Disbursement</span>
                      <span className="font-bold text-white">
                        {prize.walletType === 'kishor_bank'
                          ? 'KISHOR BANK (UPI)'
                          : prize.walletType === 'dad_bank'
                          ? 'DAD BANK'
                          : prize.walletType === 'mom_bank'
                          ? 'MOM BANK'
                          : 'CASH IN HAND'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Subtab 4: Activity ─────────────────────────────────────────────────── */}
      {activeSubtab === 'activity' && (
        <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#27264E] pb-3">
            <ShieldAlert size={16} className="text-[#64CFF6]" />
            <span>Subscriber Activity Feed</span>
          </h3>

          <div className="space-y-3">
            {memberTransactions.map((tx) => (
              <div key={tx.id} className="p-3 bg-[#141332] border border-[#27264E] rounded-xl text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold text-white">
                    {tx.type === 'collection' ? 'Installment payment recorded' : 'Auction prize payout disbursed'}
                  </span>
                  <p className="text-[10px] text-[#AEABD8] mt-0.5">{tx.notes || 'Transaction ledger entry'}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-extrabold text-white block">{formatCurrency(Number(tx.amount || 0))}</span>
                  <span className="text-[10px] text-[#AEABD8]">
                    {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN') : 'Today'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal: Record / Edit Payment ────────────────────────────────────────── */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveModalPayment}
            className="bg-[#1D1D41] rounded-3xl border border-[#27264E] p-4 sm:p-6 w-full max-w-md space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto my-auto text-white"
          >
            <div className="flex justify-between items-center border-b border-[#27264E] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#02B15A]/20 text-[#02B15A] flex items-center justify-center">
                  <Coins size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {editingTransaction ? 'Edit payment' : 'Record Installment Payment'}
                  </h4>
                  <p className="text-[10px] text-[#AEABD8]">{memberName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-[#AEABD8] hover:text-white p-1.5 rounded-lg hover:bg-[#141332] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Target Chit Group Selector (for new payments) */}
            {!editingTransaction && memberEnrollments.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Chit Group</label>
                {memberEnrollments.length === 1 ? (
                  <div className="p-2.5 bg-[#141332] border border-[#27264E] rounded-xl flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      {(groupDuesBreakdowns[0]?.groupName) || 'Chit Group'}
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-[#6359E9]/20 text-[#64CFF6] px-2 py-0.5 rounded-md border border-[#6359E9]/40">
                      Ticket #{groupDuesBreakdowns[0]?.ticketNumber}
                    </span>
                  </div>
                ) : (
                  <select
                    value={modalTargetGroupId}
                    onChange={(e) => {
                      const newGid = e.target.value;
                      setModalTargetGroupId(newGid);
                      const grp = (groupDuesBreakdowns || []).find((b: any) => b.groupId === newGid);
                      const firstUnpaid = grp?.unpaidMonths?.[0];
                      const targetM = firstUnpaid ? firstUnpaid.month : (grp?.effectiveCurrentMonth || 0);
                      const dueAmt = firstUnpaid ? firstUnpaid.remainingDue : (grp?.memberInstallment || 10000);
                      setModalTargetMonth(targetM);
                      setQuickPaymentAmount(dueAmt > 0 ? String(dueAmt) : '10000');
                      setPaymentNote(`Month ${targetM} installment`);
                    }}
                    className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none"
                  >
                    {memberEnrollments.map((enroll) => {
                      const g = Array.isArray(enroll.chit_groups) ? enroll.chit_groups[0] : enroll.chit_groups;
                      if (!g) return null;
                      return (
                        <option key={g.id} value={g.id}>
                          {g.name} (Ticket #{enroll.ticket_number})
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            {/* Target Month Selector */}
            {!editingTransaction && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Target Month Cycle</label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {(() => {
                    const currentGrp = (groupDuesBreakdowns || []).find((b: any) => b.groupId === (modalTargetGroupId || memberEnrollments[0]?.group_id));
                    const maxM = Math.max(currentGrp?.effectiveCurrentMonth || 0, modalTargetMonth || 0);
                    const monthButtons = [];
                    for (let m = 0; m <= maxM; m++) {
                      const mDueInfo = currentGrp?.monthDues?.find((d: any) => d.month === m);
                      const isSelected = modalTargetMonth === m;
                      const hasDue = mDueInfo && mDueInfo.remainingDue > 0;
                      monthButtons.push(
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setModalTargetMonth(m);
                            if (mDueInfo && mDueInfo.remainingDue > 0) {
                              setQuickPaymentAmount(String(mDueInfo.remainingDue));
                            } else if (currentGrp) {
                              setQuickPaymentAmount(String(currentGrp.memberInstallment));
                            }
                            setPaymentNote(`Month ${m} installment`);
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#6359E9] text-white border-[#6359E9] shadow-xs'
                              : hasDue
                              ? 'bg-[#FFBB38]/15 text-[#FFBB38] border-[#FFBB38]/40 hover:bg-[#FFBB38]/25'
                              : 'bg-[#141332] text-[#AEABD8] border-[#27264E] hover:text-white hover:bg-[#27264E]'
                          }`}
                        >
                          <span>{m === 0 ? 'M0 (Launch)' : `M${m}`}</span>
                          {hasDue && <span className="ml-1 text-[9px] text-[#E41414] font-extrabold">• Due</span>}
                        </button>
                      );
                    }
                    return monthButtons;
                  })()}
                </div>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Payment Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-base text-[#64CFF6] font-bold">₹</span>
                <input
                  type="number"
                  required
                  placeholder="Amount"
                  value={quickPaymentAmount}
                  onChange={(e) => setQuickPaymentAmount(e.target.value)}
                  className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-8 pr-3 py-2 text-base font-bold text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQuickPaymentAmount('10000')}
                className="flex-1 bg-[#141332] hover:bg-[#27264E] text-[#AEABD8] hover:text-white text-xs font-bold py-2 rounded-lg border border-[#27264E] active:scale-95 cursor-pointer"
              >
                ₹10,000
              </button>
              <button
                type="button"
                onClick={() => setQuickPaymentAmount('20000')}
                className="flex-1 bg-[#141332] hover:bg-[#27264E] text-[#AEABD8] hover:text-white text-xs font-bold py-2 rounded-lg border border-[#27264E] active:scale-95 cursor-pointer"
              >
                ₹20,000
              </button>
              <button
                type="button"
                onClick={() => setQuickPaymentAmount('')}
                className="bg-[#141332] hover:bg-[#27264E] text-[#AEABD8] hover:text-white text-xs font-bold px-3 py-2 rounded-lg border border-[#27264E] active:scale-95 cursor-pointer"
              >
                Clear
              </button>
            </div>

            {/* 4-Wallet Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Receiving Account / Vault</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cash_in_hand', label: 'Cash in Hand', icon: Banknote },
                  { id: 'kishor_bank', label: 'Kishor Bank (UPI)', icon: Landmark },
                  { id: 'dad_bank', label: 'Dad Bank', icon: Landmark },
                  { id: 'mom_bank', label: 'Mom Bank', icon: Landmark },
                ].map((w) => {
                  const Icon = w.icon;
                  const isSelected = paymentWalletType === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setPaymentWalletType(w.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'bg-[#6359E9]/20 border-[#6359E9] text-white ring-2 ring-[#6359E9]/30 shadow-xs'
                          : 'bg-[#141332] border-[#27264E] hover:bg-[#27264E] text-[#AEABD8]'
                      }`}
                    >
                      <Icon size={14} className={isSelected ? 'text-[#64CFF6]' : 'text-[#AEABD8]'} />
                      <span className="truncate">{w.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Date</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'custom', label: '📅 Custom' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setPaymentDateType(d.id as any)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      paymentDateType === d.id
                        ? 'bg-[#6359E9] border-[#6359E9] text-white shadow-xs'
                        : 'bg-[#141332] border-[#27264E] hover:bg-[#27264E] text-[#AEABD8]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {paymentDateType === 'custom' && (
                <div className="mt-1.5">
                  <input
                    type="date"
                    value={customPaymentDate}
                    onChange={(e) => setCustomPaymentDate(e.target.value)}
                    className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-3.5 py-2 text-xs font-semibold text-white"
                  />
                </div>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Note (optional)</label>
              <input
                type="text"
                placeholder="e.g. Paid via GPay / Handed cash to Dad"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl px-3.5 py-2 text-xs font-medium text-white placeholder-[#AEABD8]/60 focus:outline-none"
              />
            </div>

            {/* Receipt Photo */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#AEABD8] font-bold uppercase tracking-wider block">Receipt Attachment</label>
              {paymentReceiptUrl ? (
                <div className="flex items-center justify-between p-2.5 bg-[#02B15A]/15 border border-[#02B15A]/30 rounded-xl">
                  <div className="flex items-center gap-2">
                    <img src={paymentReceiptUrl} alt="Receipt" className="w-9 h-9 object-cover rounded-lg" />
                    <span className="text-xs font-bold text-[#02B15A]">Receipt Ready</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaymentReceiptUrl('')}
                    className="text-[#E41414] text-xs font-bold hover:underline cursor-pointer"
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
                    className="flex items-center justify-center gap-2 border border-dashed border-[#27264E] hover:border-[#6359E9] bg-[#141332] rounded-xl py-2.5 px-3 text-xs text-[#AEABD8] hover:text-white font-semibold cursor-pointer transition-colors"
                  >
                    <Paperclip size={14} className="text-[#64CFF6]" />
                    <span>Attach receipt photo</span>
                  </label>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
              {editingTransaction ? (
                <button
                  type="button"
                  onClick={() => handleDeletePayment(editingTransaction)}
                  className="w-full sm:w-auto text-[#E41414] hover:bg-[#E41414]/20 border border-[#E41414]/30 p-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              ) : <div className="hidden sm:block" />}

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 sm:flex-initial border border-[#27264E] hover:bg-[#27264E] text-[#AEABD8] hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="flex-1 sm:flex-initial bg-[#02B15A] hover:bg-[#02B15A]/90 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Check size={14} />
                  <span>{isProcessingPayment ? 'Saving...' : 'Save changes'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Camera QR Scanner Modal for Pairing */}
      <PassbookScannerModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        onScanSuccess={handlePairScanSuccess}
        title="Pair Physical Passbook QR"
        subtitle="Point camera at the QR code on the physical pocket book"
        targetMemberName={memberName}
      />

      {/* A4 PDF Sticker Sheet Exporter */}
      <PassbookSheetGeneratorModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        items={printItems}
        defaultTitle={`${memberName} — Passbook Sticker Sheet`}
      />

      {/* Rendered PNG Payment Receipt Modal */}
      {viewingReceiptTx && (() => {
        const matchedEnrollment = memberEnrollments.find(e => e.group_id === viewingReceiptTx.group_id) || memberEnrollments[0];
        const matchedGroup = matchedEnrollment?.chit_groups;
        const ticket = matchedEnrollment?.ticket_number ?? 1;
        const txMonth = viewingReceiptTx.month ?? matchedGroup?.current_month ?? 1;

        // Compute past pending dues strictly for this matched chit group
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

      {/* Admin Member PIN Management Modal */}
      {isEditingPinModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#1D1D41] rounded-3xl p-6 shadow-2xl space-y-4 border border-[#27264E] text-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#27264E]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#6359E9]/20 text-[#64CFF6] flex items-center justify-center">
                  <KeyRound size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Manage Member PIN</h3>
                  <p className="text-[11px] text-[#AEABD8] font-medium">{memberName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingPinModal(false)}
                className="p-1 text-[#AEABD8] hover:text-white rounded-lg hover:bg-[#141332] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Current PIN Status Card */}
            <div className="p-3 bg-[#141332] rounded-2xl border border-[#27264E] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#AEABD8]">Current MPIN:</span>
                <span className="font-mono font-bold text-[#64CFF6] text-sm bg-[#6359E9]/20 px-2 py-0.5 rounded-lg border border-[#6359E9]/40">
                  {memberProfile?.mpin || '1234'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#AEABD8]">Status:</span>
                <span className={`font-bold ${(!memberProfile?.mpin || memberProfile?.mpin === '1234') ? 'text-[#FFBB38]' : 'text-[#02B15A]'}`}>
                  {(!memberProfile?.mpin || memberProfile?.mpin === '1234') ? 'Default PIN (1234)' : 'Custom Subscriber PIN'}
                </span>
              </div>
            </div>

            {/* Reset to Default Button */}
            <button
              type="button"
              onClick={handleResetPinToDefault}
              disabled={isSavingPin || memberProfile?.mpin === '1234'}
              className="w-full py-2.5 px-3 rounded-xl border border-[#FFBB38]/40 bg-[#FFBB38]/15 hover:bg-[#FFBB38]/25 disabled:opacity-50 text-[#FFBB38] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={isSavingPin ? 'animate-spin' : ''} />
              <span>Reset PIN to Default (1234)</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#27264E]"></div>
              <span className="flex-shrink mx-2 text-[10px] text-[#AEABD8] font-bold uppercase">Or Set Custom PIN</span>
              <div className="flex-grow border-t border-[#27264E]"></div>
            </div>

            {/* Custom PIN Form */}
            <form onSubmit={handleSaveCustomPin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#AEABD8] mb-1">
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#27264E] bg-[#141332] font-mono text-sm font-bold text-white focus:outline-none focus:border-[#6359E9]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingPinModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-[#AEABD8] hover:text-white bg-[#141332] hover:bg-[#27264E] border border-[#27264E] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin || !customPinInput}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-[#6359E9] hover:bg-[#6F64FF] disabled:opacity-50 transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed"
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
