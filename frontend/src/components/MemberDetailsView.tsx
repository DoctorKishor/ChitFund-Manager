'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useWallet, WalletType } from '@/context/WalletContext';
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
  Filter
} from 'lucide-react';

interface MemberDetailsViewProps {
  memberId: string;
  onBack: () => void;
  onAddAuditLog?: (desc: string) => void;
}

export default function MemberDetailsView({ memberId, onBack, onAddAuditLog }: MemberDetailsViewProps) {
  const { profile } = useAuth();
  const { updateBalance } = useWallet();

  const [activeSubtab, setActiveSubtab] = useState<'chits' | 'payments' | 'prizes' | 'activity'>('chits');
  const [loading, setLoading] = useState<boolean>(true);
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [memberEnrollments, setMemberEnrollments] = useState<any[]>([]);
  const [memberTransactions, setMemberTransactions] = useState<any[]>([]);
  const [allChitGroups, setAllChitGroups] = useState<any[]>([]);
  const [auctionLogs, setAuctionLogs] = useState<any[]>([]);

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
  }, [memberId]);

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
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

  // Aggregate expected total commitment and pending dues across all enrolled groups
  const { totalExpectedDue, totalCurrentDue, totalRemainingToGo, allSettled } = useMemo(() => {
    let expDue = 0;
    let currDue = 0;

    memberEnrollments.forEach((enroll: any) => {
      const g = Array.isArray(enroll.chit_groups) ? enroll.chit_groups[0] : enroll.chit_groups;
      if (!g) return;

      const duration = Number(g.duration_months) || 20;
      const totalVal = Number(g.total_value) || 200000;
      const baseInst = Math.round(totalVal / duration);
      const memberInst = enroll.custom_installment !== null ? Number(enroll.custom_installment) : baseInst;

      // Total lifetime commitment for this ticket
      expDue += memberInst * duration;

      // Current month dues up to current_month
      const currentM = (g.current_month !== undefined && g.current_month !== null) ? Number(g.current_month) : 0;
      const isLaaba = (g.kai_iruppu_pool || 0) >= totalVal;
      const monthDue = isLaaba ? 0 : memberInst;
      
      // Calculate months elapsed up to currentM
      currDue += monthDue * (currentM + 1);
    });

    const remainingToGo = Math.max(0, totalExpectedDue - totalPaidIn);
    const pendingCurrentDues = Math.max(0, currDue - totalPaidIn);
    const settled = pendingCurrentDues === 0;

    return {
      totalExpectedDue: expDue,
      totalCurrentDue: currDue,
      totalRemainingToGo: remainingToGo,
      allSettled: settled,
    };
  }, [memberEnrollments, totalPaidIn]);

  // WhatsApp receipt generator
  const generateWhatsAppReceiptUrl = (tx: any) => {
    const amt = Number(tx.amount || 0);
    const memberName = memberProfile?.full_name || 'Subscriber';
    const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today';
    const text = `*OFFICIAL PAYMENT RECEIPT*\n\n` +
      `Dear ${memberName},\n` +
      `We have successfully recorded your payment of *${formatCurrency(amt)}* on ${dateStr}.\n` +
      `Account: ${tx.wallet_type?.replace(/_/g, ' ').toUpperCase()}\n` +
      `${tx.notes ? `Note: ${tx.notes}\n` : ''}` +
      `Status: COMPLETED\n\n` +
      `Thank you,\nDr. Kishor Anbazhakan's Chit Funds`;
    return `https://web.whatsapp.com/send?phone=${memberProfile?.phone_number || ''}&text=${encodeURIComponent(text)}`;
  };

  // Handle Record New Payment for this member
  const handleOpenRecordPayment = (groupId?: string, month?: number, defaultAmt?: number) => {
    setEditingTransaction(null);
    const targetGroup = groupId || memberEnrollments[0]?.group_id || '';
    setModalTargetGroupId(targetGroup);
    setModalTargetMonth(month !== undefined ? month : 1);
    setQuickPaymentAmount(defaultAmt ? String(defaultAmt) : '10000');
    setPaymentWalletType('cash_in_hand');
    setPaymentDateType('today');
    setCustomPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNote('');
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
        const defaultNote = `Collection payment - Ticket #${targetEnroll?.ticket_number || 1} (${memberProfile?.full_name})`;
        const finalNote = paymentNote.trim() ? `${defaultNote} — Note: ${paymentNote.trim()}` : defaultNote;

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
        l => l.group_id === g.id && (l.winner_profile_id === memberId || l.winner_member_id === enroll.id || l.winner_name === memberProfile?.full_name)
      );

      groupWins.forEach(win => {
        const totalVal = Number(g.total_value) || 200000;
        const discountBid = Number(win.winning_bid || 0);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Navigation Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-xl transition-all shadow-xs"
        >
          <ArrowLeft size={16} />
          <span>Back to Members</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>{allSettled ? 'Paid' : 'Active'}</span>
          </span>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
              {memberInitial}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">{memberName}</h2>
                <span className="text-[11px] font-semibold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">
                  {memberEnrollments.length} {memberEnrollments.length === 1 ? 'active chit' : 'active chits'}
                </span>
                <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  +{formatCurrency(totalPaidIn)} paid in
                </span>
                <span className="text-[11px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  Portal · {memberProfile?.role === 'subscriber' ? 'Active' : 'Admin'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <Phone size={12} className="text-gray-400" />
                <span>{memberProfile?.phone_number || 'No phone recorded'}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleOpenRecordPayment()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>Record Payment</span>
            </button>
          </div>
        </div>

        {/* Status / Settlement Banner */}
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
          allSettled 
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
            : 'bg-amber-50/80 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-2">
            {allSettled ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-amber-600 shrink-0" />}
            <span>
              {allSettled 
                ? 'All settled for current cycle · nothing due' 
                : 'Outstanding dues pending collection for active chit cycles'}
            </span>
          </div>
          <span className="text-[11px] font-mono">
            {allSettled ? '0 DUE' : 'PAYMENT REQUIRED'}
          </span>
        </div>

        {/* 3 Metric Stat Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <ArrowDownLeft size={13} className="text-emerald-600" />
              <span>Paid In</span>
            </div>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              {formatCurrency(totalPaidIn)}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <ArrowUpRight size={13} className="text-amber-600" />
              <span>Paid Out</span>
            </div>
            <div className="text-xl font-bold text-amber-700 mt-1">
              {formatCurrency(totalPaidOut)}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <Clock size={13} className="text-slate-500" />
              <span>To Go</span>
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {formatCurrency(totalRemainingToGo)}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {totalExpectedDue > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px] font-semibold text-gray-500">
              <span>Installment Completion Progress</span>
              <span>{Math.min(100, Math.round((totalPaidIn / totalExpectedDue) * 100))}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (totalPaidIn / totalExpectedDue) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 4 Interactive Subtabs Bar (Chits | Payments | Prizes | Activity) */}
      <div className="flex items-center bg-gray-200/80 p-1 rounded-2xl border border-gray-300/60 max-w-md">
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
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-gray-100 text-gray-800' : 'bg-gray-300/70 text-gray-600'
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
          <div className="text-xs text-gray-500 font-semibold px-1">
            {memberEnrollments.length} {memberEnrollments.length === 1 ? 'chit group' : 'chit groups'} enrolled
          </div>

          {memberEnrollments.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-xs">
              No chit group enrollments found for this subscriber.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {memberEnrollments.map((enroll) => {
                const g = Array.isArray(enroll.chit_groups) ? enroll.chit_groups[0] : enroll.chit_groups;
                if (!g) return null;

                const duration = Number(g.duration_months) || 20;
                const totalVal = Number(g.total_value) || 200000;
                const baseInst = Math.round(totalVal / duration);
                const memberInst = enroll.custom_installment !== null ? Number(enroll.custom_installment) : baseInst;

                // Group transactions
                const groupTxs = memberTransactions.filter(t => t.group_id === g.id);
                const groupPaid = groupTxs.filter(t => t.type === 'collection').reduce((s, t) => s + Number(t.amount || 0), 0);
                const groupWonPrize = prizesWon.find(p => p.groupId === g.id);

                return (
                  <div key={enroll.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900">{g.name}</h3>
                          <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                            Ticket #{enroll.ticket_number}
                          </span>
                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                            On track
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatCurrency(totalVal)} total value · {duration} months duration · Monthly: {formatCurrency(memberInst)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveSubtab('payments');
                            setSelectedChitFilter(g.id);
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <span>View payments</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Group Monthly Progress */}
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">Total Paid for Group</span>
                        <span className="text-base font-bold text-emerald-900">{formatCurrency(groupPaid)}</span>
                      </div>
                      {groupWonPrize && (
                        <div className="text-right">
                          <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">Auction Winner</span>
                          <span className="font-bold text-amber-800 flex items-center gap-1">
                            <Trophy size={13} className="text-amber-600" />
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
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3.5 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search amount, chit, method, notes..."
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={selectedChitFilter}
                onChange={(e) => setSelectedChitFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none"
              >
                <option value="all">All chits</option>
                {allChitGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none"
              >
                <option value="all">All types</option>
                <option value="collection">Collections</option>
                <option value="payout">Payouts</option>
              </select>

              <button
                onClick={() => handleOpenRecordPayment()}
                className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus size={14} />
                <span>Record</span>
              </button>
            </div>
          </div>

          {/* Transactions Ledger List */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="text-xs font-bold text-gray-900">
                {filteredPayments.length} receipts found
              </span>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No payment transactions match the selected filters.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredPayments.map((tx) => {
                  const txDate = tx.created_at ? new Date(tx.created_at) : new Date();
                  const monthName = txDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                  const dayNum = txDate.getDate();
                  const groupObj = allChitGroups.find(g => g.id === tx.group_id);
                  const isCollection = tx.type === 'collection';

                  return (
                    <div key={tx.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 rounded-xl px-3 transition-colors">
                      <div className="flex items-center gap-3.5">
                        {/* Date Pill */}
                        <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-gray-500 uppercase">{monthName}</span>
                          <span className="text-sm font-extrabold text-gray-900 leading-none">{dayNum}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900">
                              {groupObj?.name || 'Chit Group'}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                              isCollection 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isCollection ? 'Collection' : 'Prize Payout'}
                            </span>
                            <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded">
                              {tx.wallet_type?.replace(/_/g, ' ').toUpperCase() || 'CASH'}
                            </span>
                            {tx.verification_proof_url && (
                              <a
                                href={tx.verification_proof_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[9px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                              >
                                <Paperclip size={9} /> Receipt
                              </a>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 max-w-md truncate">
                            {tx.notes || 'Monthly chit installment payment'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 justify-between sm:justify-end">
                        <span className={`text-sm font-extrabold mr-1 ${
                          isCollection ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {isCollection ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isCollection && (
                            <a
                              href={generateWhatsAppReceiptUrl(tx)}
                              target="_blank"
                              rel="noreferrer"
                              title="Share receipt on WhatsApp"
                              className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                            >
                              <Share2 size={13} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEditPayment(tx)}
                            title="Edit receipt"
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-lg transition-colors"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(tx)}
                            title="Delete receipt"
                            className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 rounded-lg transition-colors"
                          >
                            <Trash2 size={13} />
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
          <div className="text-xs text-gray-500 font-semibold px-1">
            {prizesWon.length} {prizesWon.length === 1 ? 'prize won' : 'prizes won'}
          </div>

          {prizesWon.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-xs">
              No auction prizes won by this subscriber yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {prizesWon.map((prize, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                        <Trophy size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">{prize.groupName}</h4>
                        <p className="text-[11px] text-gray-500">Month {prize.month} Auction</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Chit Value</span>
                      <span className="text-base font-extrabold text-gray-900">{formatCurrency(prize.totalValue)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Bid Discount</span>
                      <span className="font-bold text-gray-900">{formatCurrency(prize.winningBid)}</span>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Pool Credit</span>
                      <span className="font-bold text-indigo-700">+{formatCurrency(prize.winningBid)}</span>
                    </div>

                    <div className="bg-emerald-50 rounded-xl p-3">
                      <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">Net Member Payout</span>
                      <span className="font-extrabold text-emerald-700">{formatCurrency(prize.netPayout)}</span>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Disbursement</span>
                      <span className="font-bold text-gray-900">{prize.walletType.replace(/_/g, ' ').toUpperCase()}</span>
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
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            <ShieldAlert size={16} className="text-indigo-600" />
            <span>Subscriber Activity Feed</span>
          </h3>

          <div className="space-y-3">
            {memberTransactions.map((tx) => (
              <div key={tx.id} className="p-3 bg-gray-50/70 border border-gray-200/60 rounded-xl text-xs flex justify-between items-center">
                <div>
                  <span className="font-bold text-gray-900">
                    {tx.type === 'collection' ? 'Installment payment recorded' : 'Auction prize payout disbursed'}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">{tx.notes || 'Transaction ledger entry'}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-extrabold text-gray-900 block">{formatCurrency(Number(tx.amount || 0))}</span>
                  <span className="text-[10px] text-gray-400">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveModalPayment}
            className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-md space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Coins size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    {editingTransaction ? 'Edit payment' : 'Record Installment Payment'}
                  </h4>
                  <p className="text-[10px] text-gray-500">{memberName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Payment Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-base text-gray-400 font-bold">₹</span>
                <input
                  type="number"
                  required
                  placeholder="Amount"
                  value={quickPaymentAmount}
                  onChange={(e) => setQuickPaymentAmount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-2 text-base font-bold text-gray-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQuickPaymentAmount('10000')}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-1.5 rounded-lg border border-gray-200"
              >
                ₹10,000
              </button>
              <button
                type="button"
                onClick={() => setQuickPaymentAmount('20000')}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-1.5 rounded-lg border border-gray-200"
              >
                ₹20,000
              </button>
              <button
                type="button"
                onClick={() => setQuickPaymentAmount('')}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200"
              >
                Clear
              </button>
            </div>

            {/* 4-Wallet Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Receiving Account / Vault</label>
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
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <Icon size={14} className={isSelected ? 'text-indigo-600' : 'text-gray-500'} />
                      <span className="truncate">{w.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Date</label>
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
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                      paymentDateType === d.id
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900"
                  />
                </div>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Note (optional)</label>
              <input
                type="text"
                placeholder="e.g. Paid via GPay / Handed cash to Dad"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900"
              />
            </div>

            {/* Receipt Photo */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Receipt Attachment</label>
              {paymentReceiptUrl ? (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <img src={paymentReceiptUrl} alt="Receipt" className="w-9 h-9 object-cover rounded-lg" />
                    <span className="text-xs font-bold text-emerald-900">Receipt Ready</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaymentReceiptUrl('')}
                    className="text-rose-600 text-xs font-bold hover:underline"
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
                    className="flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 rounded-xl py-2.5 px-3 text-xs text-gray-600 font-semibold cursor-pointer"
                  >
                    <Paperclip size={14} className="text-gray-500" />
                    <span>Attach receipt photo</span>
                  </label>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-2">
              {editingTransaction ? (
                <button
                  type="button"
                  onClick={() => handleDeletePayment(editingTransaction)}
                  className="text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{isProcessingPayment ? 'Saving...' : 'Save changes'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
