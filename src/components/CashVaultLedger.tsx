'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWallet, WalletType } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase/client';
import { triggerHapticFeedback } from '@/utils/haptics';
import { 
  Wallet, 
  Landmark, 
  Coins, 
  Banknote, 
  Check, 
  AlertCircle, 
  History, 
  Calculator, 
  CreditCard, 
  Search, 
  RefreshCw, 
  ArrowRightLeft, 
  Clock, 
  X, 
  ShieldCheck, 
  Printer,
  ChevronDown,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Plus,
  Share2,
  MessageSquare,
  BookOpen,
  Users,
  CheckCircle2,
  ExternalLink,
  Send,
  FileText,
  ChevronRight
} from 'lucide-react';

export type CashHandlingSubtab = 
  | 'overview' 
  | 'wallets' 
  | 'transfers' 
  | 'spends' 
  | 'denominations' 
  | 'ledger';

interface TreasuryTx {
  id: string;
  created_at: string;
  type: string;
  status?: 'completed' | 'pending_verification' | string;
  amount: number;
  wallet_type: WalletType;
  from_wallet?: string | null;
  to_wallet?: string | null;
  transfer_pair_id?: string | null;
  notes?: string;
  description?: string;
  group_id?: string;
  profile_id?: string;
  group_member_id?: string;
}

interface PersonalDraw {
  id: string;
  txId?: string;
  amount: number;
  tag: 'Personal Expense' | 'Money Lending / Rotation' | 'Petrol' | 'Maintenance' | 'Groceries' | 'Collection Visits' | 'Tea & Refreshments' | 'Emergency Cash';
  description: string;
  adminName: string;
  takenBy: string;
  walletType: WalletType;
  timestamp: string;
  created_at: string;
  status: 'outstanding' | 'settled';
  settlementDetails?: {
    settledAt: string;
    settlementMode: 'vault_repay' | 'member_offset';
    destWallet?: WalletType;
    notes?: string;
  };
}

interface FloatingDeposit {
  id: string;
  amount: number;
  depositedBy: string;
  walletType: WalletType;
  tag: string;
  notes: string;
  timestamp: string;
  created_at: string;
  status: 'active' | 'recovered';
}

export default function CashVaultLedger() {
  const { balances, updateBalance, loading: walletLoading } = useWallet();
  const { profile } = useAuth();
  const activeAdminName = profile?.fullName || 'Admin';

  // Active filter for account cards & statement
  const [selectedWalletFilter, setSelectedWalletFilter] = useState<'all' | WalletType>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'month' | '30days' | 'all'>('month');
  const [activeExpandedCard, setActiveExpandedCard] = useState<WalletType | null>(null);

  // Supabase Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [recentTransactions, setRecentTransactions] = useState<TreasuryTx[]>([]);

  // Active Modal Dialog States
  const [activeModal, setActiveModal] = useState<'none' | 'atm' | 'spend' | 'deposit' | 'transfer' | 'denominations' | 'settle' | 'recover'>('none');

  // Form State: External Cash Deposit / Float Inflow
  const [depositDest, setDepositDest] = useState<WalletType>('cash_in_hand');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositBy, setDepositBy] = useState<string>('Anbazhakan');
  const [depositCustomBy, setDepositCustomBy] = useState<string>('');
  const [depositTag, setDepositTag] = useState<string>('Temporary Auction Float');
  const [depositNotes, setDepositNotes] = useState<string>('');
  const [isProcessingDeposit, setIsProcessingDeposit] = useState<boolean>(false);

  // Form State: Inter-Vault Transfer
  const [transferSource, setTransferSource] = useState<WalletType>('kishor_bank');
  const [transferDest, setTransferDest] = useState<WalletType>('cash_in_hand');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isProcessingTransfer, setIsProcessingTransfer] = useState<boolean>(false);

  // Form State: ATM Relocation
  const [relocateSource, setRelocateSource] = useState<Exclude<WalletType, 'cash_in_hand'>>('kishor_bank');
  const [relocateAmount, setRelocateAmount] = useState<string>('');
  const [isVerifyingAtmId, setIsVerifyingAtmId] = useState<string | null>(null);

  // Form State: Personal Draw
  const [spendAmount, setSpendAmount] = useState<string>('');
  const [spendTag, setSpendTag] = useState<PersonalDraw['tag']>('Personal Expense');
  const [spendDesc, setSpendDesc] = useState<string>('');
  const [spendWallet, setSpendWallet] = useState<WalletType>('cash_in_hand');
  const [spendTakenBy, setSpendTakenBy] = useState<string>('Anbazhakan');
  const [spendCustomTakenBy, setSpendCustomTakenBy] = useState<string>('');
  const [isSubmittingSpend, setIsSubmittingSpend] = useState<boolean>(false);

  // Simple Settlement State (Put Cash Back)
  const [settlingDraw, setSettlingDraw] = useState<PersonalDraw | null>(null);
  const [settleDestWallet, setSettleDestWallet] = useState<WalletType>('cash_in_hand');
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [isProcessingSettle, setIsProcessingSettle] = useState<boolean>(false);

  // Floating Capital Recovery State
  const [recoveringFloat, setRecoveringFloat] = useState<FloatingDeposit | null>(null);
  const [recoverSourceWallet, setRecoverSourceWallet] = useState<WalletType>('cash_in_hand');
  const [recoverAmount, setRecoverAmount] = useState<string>('');
  const [isProcessingRecover, setIsProcessingRecover] = useState<boolean>(false);

  // Denomination Counter State
  const [denominations, setDenominations] = useState<{ [key: number]: number }>({
    500: 100,
    200: 40,
    100: 50,
    50: 20,
    20: 20,
    10: 10,
  });

  // Ledger Filter & Search
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('all');

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (txs) {
        setRecentTransactions(txs);
      }
    } catch (e) {
      console.error('Error loading cash ledger data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('realtime_treasury_ledger_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Format INR Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const formatShortCurrency = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    }
    if (val >= 1000) {
      return `₹${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    }
    return `₹${val}`;
  };

  const WALLET_META: Record<WalletType, {
    name: string;
    shortName: string;
    owner: string;
    accountNumber: string;
    typeLabel: string;
    bankName: string;
    lastFour: string;
    iconSymbol: string;
  }> = {
    cash_in_hand: {
      name: 'Physical Cash Box',
      shortName: 'Cash Box',
      owner: 'On-Premises Safe',
      accountNumber: 'VAULT-01 •••• SAFE',
      typeLabel: 'Physical Liquid Safe',
      bankName: 'Safe #01',
      lastFour: 'SAFE',
      iconSymbol: '🗄️',
    },
    kishor_bank: {
      name: 'Dr. Kishor Account',
      shortName: 'Kishor Bank',
      owner: 'Dr. Kishor Anbazhakan',
      accountNumber: '•••• •••• •••• 4192',
      typeLabel: 'Primary UPI / Collections',
      bankName: 'HDFC Bank',
      lastFour: '4192',
      iconSymbol: '🏦',
    },
    dad_bank: {
      name: 'Anbazhakan (Dad) Account',
      shortName: 'Dad Bank',
      owner: 'Anbazhakan',
      accountNumber: '•••• •••• •••• 8821',
      typeLabel: 'Prize Disbursal',
      bankName: 'CSB Bank',
      lastFour: '8821',
      iconSymbol: '💳',
    },
    mom_bank: {
      name: 'Parimalam (Mom) Account',
      shortName: 'Mom Bank',
      owner: 'Parimalam',
      accountNumber: '•••• •••• •••• 3094',
      typeLabel: 'Emergency Reserve',
      bankName: 'SBI Bank',
      lastFour: '3094',
      iconSymbol: '🪙',
    },
  };

  // Liquidity Analytics
  const totalTreasuryBalance = useMemo(() => {
    return (balances.cash_in_hand || 0) + (balances.kishor_bank || 0) + (balances.dad_bank || 0) + (balances.mom_bank || 0);
  }, [balances]);

  const bankCapital = useMemo(() => {
    return (balances.kishor_bank || 0) + (balances.dad_bank || 0) + (balances.mom_bank || 0);
  }, [balances]);

  // Helper to accurately classify if a treasury movement is an Inflow/Credit (+) or Outflow/Debit (-)
  const getTxDirection = (tx: TreasuryTx, perspectiveWallet?: WalletType | 'all'): { isCredit: boolean; badgeLabel: string; badgeColor: string } => {
    const type = tx.type;
    const notes = (tx.notes || tx.description || '').toLowerCase();
    const targetWallet = perspectiveWallet && perspectiveWallet !== 'all' ? perspectiveWallet : tx.wallet_type;

    if (type === 'collection') {
      return { isCredit: true, badgeLabel: '💰 Collection (+)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };
    }

    if (type === 'payout') {
      return { isCredit: false, badgeLabel: '🏆 Prize Disbursal (-)', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/60' };
    }

    if (type === 'personal_draw') {
      if (notes.includes('float recovery')) {
        return { isCredit: false, badgeLabel: '🌊 Float Return (-)', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200/60' };
      }
      return { isCredit: false, badgeLabel: '💼 Personal Draw (-)', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200/60' };
    }

    if (notes.includes('[floating deposit') || notes.includes('deposit into') || notes.includes('reserve cash deposit') || notes.includes('deposited by')) {
      return { isCredit: true, badgeLabel: '🌊 Float Inflow (+)', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }

    if (notes.includes('repaid by') || notes.includes('put cash back') || notes.includes('put back')) {
      return { isCredit: true, badgeLabel: '💰 Draw Repayment (+)', badgeColor: 'bg-teal-50 text-teal-700 border-teal-200/60' };
    }

    if (type === 'atm_withdrawal') {
      if (targetWallet === 'cash_in_hand') {
        return { isCredit: true, badgeLabel: '🏧 ATM Relocation (+)', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' };
      }
      return { isCredit: false, badgeLabel: '🏧 ATM Relocation', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' };
    }

    if (type === 'transfer_in') {
      return { isCredit: true, badgeLabel: '🔄 Vault Transfer (+)', badgeColor: 'bg-indigo-50 text-brand-700 border-brand-200/60' };
    }

    if (type === 'transfer') {
      return { isCredit: true, badgeLabel: '🔄 Vault Transfer', badgeColor: 'bg-indigo-50 text-brand-700 border-brand-200/60' };
    }

    return { isCredit: false, badgeLabel: '💸 Outflow (-)', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200/60' };
  };

  // ATM Relocations awaiting Physical Cash Box Verification
  const pendingRelocations = useMemo(() => {
    return recentTransactions
      .filter(tx => tx.type === 'atm_withdrawal' && tx.status === 'pending_verification')
      .map(tx => {
        let source: Exclude<WalletType, 'cash_in_hand'> = (tx.from_wallet as any) || (tx.wallet_type !== 'cash_in_hand' ? tx.wallet_type : 'kishor_bank');
        if (!tx.from_wallet && tx.wallet_type === 'cash_in_hand') {
          const n = (tx.notes || '').toLowerCase();
          if (n.includes('dad')) source = 'dad_bank';
          else if (n.includes('mom')) source = 'mom_bank';
          else if (n.includes('kishor')) source = 'kishor_bank';
        }

        return {
          id: tx.id,
          source,
          amount: Number(tx.amount || 0),
          status: 'pending_verification' as const,
          createdAt: new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          notes: tx.notes || '',
        };
      });
  }, [recentTransactions]);

  // Computed Personal Draws
  const computedPersonalDraws = useMemo<PersonalDraw[]>(() => {
    return recentTransactions
      .filter((t) => t.type === 'personal_draw')
      .map((tx) => {
        const notes = tx.notes || '';
        
        let tag: PersonalDraw['tag'] = 'Personal Expense';
        const tagMatch = notes.match(/^\[(.*?)\]/);
        if (tagMatch) {
          const rawTag = tagMatch[1];
          if (['Personal Expense', 'Money Lending / Rotation', 'Petrol', 'Maintenance', 'Groceries', 'Collection Visits', 'Tea & Refreshments', 'Emergency Cash'].includes(rawTag)) {
            tag = rawTag as PersonalDraw['tag'];
          }
        }

        const isSettled = notes.toLowerCase().includes('status: settled') || notes.toLowerCase().includes('status: repaid');
        const status: 'outstanding' | 'settled' = isSettled ? 'settled' : 'outstanding';

        let takenBy = 'Anbazhakan';
        const takenByMatch = notes.match(/Taken By:\s*([^|]+)/i);
        if (takenByMatch) {
          takenBy = takenByMatch[1].trim();
        }

        const desc = notes
          .replace(/\[.*?\]\s*/, '')
          .replace(/\|\s*Admin Logged:[^|]+/i, '')
          .replace(/\|\s*Taken By:[^|]+/i, '')
          .replace(/\|\s*Status:[^|]+/i, '')
          .trim() || 'Personal Draw';

        return {
          id: tx.id,
          txId: tx.id,
          amount: Number(tx.amount || 0),
          tag,
          description: desc,
          adminName: 'Admin',
          takenBy,
          walletType: tx.wallet_type,
          timestamp: new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          created_at: tx.created_at,
          status,
        };
      });
  }, [recentTransactions]);

  const outstandingPersonalDraws = useMemo(() => {
    return computedPersonalDraws.filter(d => d.status === 'outstanding');
  }, [computedPersonalDraws]);

  const totalOutstandingDebt = useMemo(() => {
    return outstandingPersonalDraws.reduce((sum, d) => sum + d.amount, 0);
  }, [outstandingPersonalDraws]);

  // Computed Floating Deposits
  const computedFloatingDeposits = useMemo<FloatingDeposit[]>(() => {
    return recentTransactions
      .filter((t) => t.type === 'transfer' && (t.notes || '').toLowerCase().includes('[floating deposit'))
      .map((tx) => {
        const notes = tx.notes || '';
        let depositedBy = 'Anbazhakan';
        const byMatch = notes.match(/Deposited By:\s*([^|]+)/i);
        if (byMatch) {
          depositedBy = byMatch[1].trim();
        }

        const isRecovered = notes.toLowerCase().includes('status: recovered') || notes.toLowerCase().includes('status: settled');
        const status: 'active' | 'recovered' = isRecovered ? 'recovered' : 'active';

        let tag = 'Temporary Float';
        const tagMatch = notes.match(/\[Floating Deposit\s*-\s*([^\]]+)\]/i);
        if (tagMatch) {
          tag = tagMatch[1].trim();
        }

        const desc = notes
          .replace(/\[Floating Deposit.*?\]\s*/i, '')
          .replace(/\|\s*Deposited By:[^|]+/i, '')
          .replace(/\|\s*Status:[^|]+/i, '')
          .trim() || 'Floating Deposit';

        return {
          id: tx.id,
          amount: Number(tx.amount || 0),
          depositedBy,
          walletType: tx.wallet_type,
          tag,
          notes: desc,
          timestamp: new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          created_at: tx.created_at,
          status,
        };
      });
  }, [recentTransactions]);

  const activeFloatingDeposits = useMemo(() => {
    return computedFloatingDeposits.filter(f => f.status === 'active');
  }, [computedFloatingDeposits]);

  const floatStats = useMemo(() => {
    const active = computedFloatingDeposits.filter(f => f.status === 'active');
    const total = active.reduce((sum, f) => sum + f.amount, 0);
    return { total, activeCount: active.length };
  }, [computedFloatingDeposits]);

  // Master Transaction Feed filtered by active wallet and type
  const filteredTransactions = useMemo(() => {
    return recentTransactions.filter((tx) => {
      const notes = (tx.notes || tx.description || '').toLowerCase();
      
      let matchesWallet = true;
      if (selectedWalletFilter !== 'all') {
        matchesWallet = tx.wallet_type === selectedWalletFilter ||
          (tx.type === 'atm_withdrawal' && (
            (selectedWalletFilter === 'kishor_bank' && (notes.includes('kishor') || (!notes.includes('dad') && !notes.includes('mom')))) ||
            (selectedWalletFilter === 'dad_bank' && notes.includes('dad')) ||
            (selectedWalletFilter === 'mom_bank' && notes.includes('mom'))
          )) ||
          (tx.type === 'transfer' && (
            (selectedWalletFilter === 'kishor_bank' && (notes.includes('kishor') || tx.wallet_type === 'kishor_bank')) ||
            (selectedWalletFilter === 'dad_bank' && (notes.includes('dad') || notes.includes('anbazhakan') || tx.wallet_type === 'dad_bank')) ||
            (selectedWalletFilter === 'mom_bank' && (notes.includes('mom') || notes.includes('parimalam') || tx.wallet_type === 'mom_bank')) ||
            (selectedWalletFilter === 'cash_in_hand' && (notes.includes('cash') || tx.wallet_type === 'cash_in_hand'))
          ));
      }

      let matchesType = true;
      if (ledgerTypeFilter !== 'all') {
        if (ledgerTypeFilter === 'collection') matchesType = tx.type === 'collection';
        else if (ledgerTypeFilter === 'payout') matchesType = tx.type === 'payout';
        else if (ledgerTypeFilter === 'transfer') matchesType = tx.type === 'transfer' || tx.type === 'transfer_in';
        else if (ledgerTypeFilter === 'atm') matchesType = tx.type === 'atm_withdrawal';
        else if (ledgerTypeFilter === 'draw') matchesType = tx.type === 'personal_draw' && !notes.includes('float recovery');
        else if (ledgerTypeFilter === 'float') matchesType = notes.includes('[floating deposit') || notes.includes('float recovery');
      }

      const q = ledgerSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        (tx.description && tx.description.toLowerCase().includes(q)) ||
        String(tx.amount).includes(q) ||
        tx.type.toLowerCase().includes(q);

      return matchesWallet && matchesType && matchesSearch;
    });
  }, [recentTransactions, selectedWalletFilter, ledgerTypeFilter, ledgerSearch]);

  // Denomination Calculations
  const calculatedPhysicalCash = useMemo(() => {
    return (
      (denominations[500] || 0) * 500 +
      (denominations[200] || 0) * 200 +
      (denominations[100] || 0) * 100 +
      (denominations[50] || 0) * 50 +
      (denominations[20] || 0) * 20 +
      (denominations[10] || 0) * 10
    );
  }, [denominations]);

  const cashDisparity = calculatedPhysicalCash - (balances.cash_in_hand || 0);

  // ── ACTION HANDLERS ──────────────────────────────────────────────────────────

  // 1. ATM Trigger (Step 1)
  const handleTriggerATM = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(relocateAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid withdrawal amount.");
      return;
    }
    if (balances[relocateSource] < amount) {
      alert(`Insufficient balance in ${WALLET_META[relocateSource].name}. Available: ${formatCurrency(balances[relocateSource])}`);
      return;
    }

    try {
      setIsProcessingTransfer(true);
      
      const { data: rpcData, error: rpcErr } = await supabase.rpc('mutate_wallet_balance', {
        p_wallet: relocateSource,
        p_delta: -amount,
        p_user_id: profile?.id || null,
      });

      if (rpcErr || !rpcData?.success) {
        alert('Failed to debit bank account: ' + (rpcData?.error || rpcErr?.message));
        return;
      }

      const sourceName = WALLET_META[relocateSource].name;

      const { error } = await supabase.from('transactions').insert([
        {
          wallet_type: relocateSource,
          from_wallet: relocateSource,
          to_wallet: 'cash_in_hand',
          type: 'atm_withdrawal',
          status: 'pending_verification',
          amount: amount,
          notes: `[ATM Relocation] From: ${sourceName} -> Cash Box | Pending Physical Verification`,
          created_by: profile?.id || null,
        }
      ]);

      if (error) {
        await supabase.from('security_audit_logs').insert({
          action_description: `ATM TX RECORD FAILURE: ₹${amount} debited from ${sourceName} but transaction record failed: ${error.message}. MANUAL RECONCILIATION REQUIRED.`,
          target_table: 'transactions',
        });
        throw error;
      }

      await supabase.from('security_audit_logs').insert({
        action_description: `ATM RELOCATION TRIGGERED: ₹${amount.toLocaleString('en-IN')} debited from ${sourceName}. Pending physical cash box confirmation.`,
        target_table: 'transactions',
      });

      setRelocateAmount('');
      setActiveModal('none');
      await fetchData();
      alert(`✓ ATM Withdrawal of ${formatCurrency(amount)} triggered from ${sourceName}!\n\n⚠️ Step 2 Pending: Please confirm inflow once currency notes are in the Physical Cash Box.`);
    } catch (err: any) {
      console.error('Error triggering ATM relocation:', err);
      alert('Error triggering ATM: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // 2. ATM Verify Inflow (Step 2)
  const handleVerifyATM = async (txId: string, amount: number, source: WalletType, existingNotes?: string) => {
    try {
      setIsVerifyingAtmId(txId);
      triggerHapticFeedback('light');

      const { data: rpcData, error: rpcErr } = await supabase.rpc('mutate_wallet_balance', {
        p_wallet: 'cash_in_hand',
        p_delta: amount,
        p_user_id: profile?.id || null,
      });

      if (rpcErr || !rpcData?.success) {
        alert('Failed to credit Cash Box: ' + (rpcData?.error || rpcErr?.message));
        return;
      }

      const sourceName = WALLET_META[source]?.name || source;
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const updatedNotes = existingNotes
        ? `${existingNotes} | Verified & Credited to Cash Box on ${dateStr}`
        : `ATM Cash Withdrawal verified from ${sourceName} into Physical Cash Box on ${dateStr}`;

      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          notes: updatedNotes,
        })
        .eq('id', txId);

      if (error) throw error;

      await supabase.from('security_audit_logs').insert({
        action_description: `ATM RELOCATION CONFIRMED: ₹${amount.toLocaleString('en-IN')} verified & credited into Physical Cash Box (Source: ${sourceName}).`,
        target_table: 'transactions',
      });

      triggerHapticFeedback('success');
      await fetchData();
      alert(`✓ Verified & Credited ${formatCurrency(amount)} into Physical Cash Box!`);
    } catch (err: any) {
      console.error('Error verifying ATM inflow:', err);
      alert('Error verifying ATM inflow: ' + (err.message || 'Unknown error'));
    } finally {
      setIsVerifyingAtmId(null);
    }
  };

  // 3. Log Personal Spend
  const handleLogSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(spendAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (balances[spendWallet] < amount) {
      alert(`Insufficient balance in ${WALLET_META[spendWallet].name}. Available: ${formatCurrency(balances[spendWallet])}`);
      return;
    }

    const effectiveTakenBy = spendTakenBy === 'Other' ? (spendCustomTakenBy.trim() || 'Other') : spendTakenBy;

    try {
      setIsSubmittingSpend(true);
      await updateBalance(spendWallet, -amount);

      const desc = spendDesc.trim() || `${spendTag} by ${effectiveTakenBy}`;
      const fullNote = `[${spendTag}] ${desc} | Admin Logged: ${activeAdminName} | Taken By: ${effectiveTakenBy} | Status: Outstanding`;

      const { error } = await supabase.from('transactions').insert([
        {
          wallet_type: spendWallet,
          type: 'personal_draw',
          status: 'completed',
          amount: amount,
          notes: fullNote,
          created_by: profile?.id || null,
        }
      ]);

      if (error) throw error;

      await supabase.from('security_audit_logs').insert({
        action_description: `PERSONAL DRAW: ₹${amount.toLocaleString('en-IN')} taken by ${effectiveTakenBy} for ${spendTag} from ${WALLET_META[spendWallet].name}.`,
        target_table: 'transactions',
      });

      setSpendAmount('');
      setSpendDesc('');
      if (spendTakenBy === 'Other') setSpendCustomTakenBy('');
      setActiveModal('none');
      await fetchData();
      alert(`✓ Recorded ${formatCurrency(amount)} draw for ${effectiveTakenBy}!`);
    } catch (err: any) {
      console.error('Error logging spend:', err);
      alert('Error logging spend: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingSpend(false);
    }
  };

  // 4. Settle Personal Debt (Put Cash Back)
  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingDraw) return;
    const amount = Number(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid repayment amount.");
      return;
    }
    if (amount > settlingDraw.amount) {
      alert(`Repayment cannot exceed the debt of ${formatCurrency(settlingDraw.amount)}.`);
      return;
    }

    try {
      setIsProcessingSettle(true);
      await updateBalance(settleDestWallet, amount);

      await supabase.from('transactions').insert([
        {
          wallet_type: settleDestWallet,
          type: 'transfer',
          status: 'completed',
          amount: amount,
          notes: `Personal Draw Repayment of ${formatCurrency(amount)} by ${settlingDraw.takenBy} returned to ${WALLET_META[settleDestWallet].name} (Original: ${settlingDraw.tag})`,
          created_by: profile?.id || null,
        }
      ]);

      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const isFull = amount >= settlingDraw.amount;
      const updatedNotes = isFull
        ? `[${settlingDraw.tag}] ${settlingDraw.description} | Taken By: ${settlingDraw.takenBy} | Status: Settled (Repaid ${formatCurrency(amount)} into ${WALLET_META[settleDestWallet].name} on ${dateStr})`
        : `[${settlingDraw.tag}] ${settlingDraw.description} | Taken By: ${settlingDraw.takenBy} | Status: Outstanding (Partially Repaid ${formatCurrency(amount)}, Remaining: ${formatCurrency(settlingDraw.amount - amount)})`;

      await supabase
        .from('transactions')
        .update({ notes: updatedNotes })
        .eq('id', settlingDraw.id);

      setSettlingDraw(null);
      setActiveModal('none');
      await fetchData();
      alert(`✓ Successfully repaid ${formatCurrency(amount)} back to ${WALLET_META[settleDestWallet].name}!`);
    } catch (err: any) {
      console.error('Error settling debt:', err);
      alert('Error settling debt: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingSettle(false);
    }
  };

  // 5. Deposit Money / Float Inflow
  const handleExecuteDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }

    const effectiveDepositor = depositBy === 'Other' ? (depositCustomBy.trim() || 'Other') : depositBy;

    try {
      setIsProcessingDeposit(true);
      await updateBalance(depositDest, amount);

      const desc = depositNotes.trim() || `${depositTag} deposited by ${effectiveDepositor}`;
      const fullNote = `[Floating Deposit - ${depositTag}] ${desc} | Deposited By: ${effectiveDepositor} | Status: Active Float`;

      await supabase.from('transactions').insert([
        {
          wallet_type: depositDest,
          type: 'transfer',
          status: 'completed',
          amount: amount,
          notes: fullNote,
          created_by: profile?.id || null,
        }
      ]);

      setDepositAmount('');
      setDepositNotes('');
      if (depositBy === 'Other') setDepositCustomBy('');
      setActiveModal('none');
      await fetchData();
      alert(`✓ Successfully deposited ${formatCurrency(amount)} into ${WALLET_META[depositDest].name}!`);
    } catch (err: any) {
      console.error('Error depositing funds:', err);
      alert('Error depositing funds: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingDeposit(false);
    }
  };

  // 6. Inter-Vault Transfer
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid transfer amount.");
      return;
    }
    if (transferSource === transferDest) {
      alert("Source and destination accounts must be different.");
      return;
    }
    if (balances[transferSource] < amount) {
      alert(`Insufficient funds in ${WALLET_META[transferSource].name}. Available: ${formatCurrency(balances[transferSource])}`);
      return;
    }

    try {
      setIsProcessingTransfer(true);

      const { data: debitData, error: debitErr } = await supabase.rpc('mutate_wallet_balance', {
        p_wallet: transferSource,
        p_delta: -amount,
        p_user_id: profile?.id || null,
      });

      if (debitErr || !debitData?.success) {
        alert('Failed to debit source account: ' + (debitData?.error || debitErr?.message));
        return;
      }

      const { data: creditData, error: creditErr } = await supabase.rpc('mutate_wallet_balance', {
        p_wallet: transferDest,
        p_delta: amount,
        p_user_id: profile?.id || null,
      });

      if (creditErr || !creditData?.success) {
        await supabase.rpc('mutate_wallet_balance', {
          p_wallet: transferSource,
          p_delta: amount,
          p_user_id: profile?.id || null,
        });
        alert('Failed to credit destination account: ' + (creditData?.error || creditErr?.message));
        return;
      }

      const pairId = crypto.randomUUID();
      const userNotes = transferNotes.trim();
      const debitNote = `[Transfer] ₹${amount.toLocaleString('en-IN')} sent to ${WALLET_META[transferDest].name}${userNotes ? ' | ' + userNotes : ''}`;
      const creditNote = `[Transfer In] ₹${amount.toLocaleString('en-IN')} received from ${WALLET_META[transferSource].name}${userNotes ? ' | ' + userNotes : ''}`;

      const { error: txErr } = await supabase.from('transactions').insert([
        {
          wallet_type: transferSource,
          from_wallet: transferSource,
          to_wallet: transferDest,
          type: 'transfer',
          status: 'completed',
          amount: amount,
          notes: debitNote,
          transfer_pair_id: pairId,
          created_by: profile?.id || null,
        },
        {
          wallet_type: transferDest,
          from_wallet: transferSource,
          to_wallet: transferDest,
          type: 'transfer_in',
          status: 'completed',
          amount: amount,
          notes: creditNote,
          transfer_pair_id: pairId,
          created_by: profile?.id || null,
        },
      ]);

      if (txErr) console.warn('Transfer transaction recording note:', txErr);

      await supabase.from('security_audit_logs').insert({
        action_description: `INTER-VAULT TRANSFER: ₹${amount.toLocaleString('en-IN')} moved from ${WALLET_META[transferSource].name} to ${WALLET_META[transferDest].name}.`,
        target_table: 'transactions',
      });

      setTransferAmount('');
      setTransferNotes('');
      setActiveModal('none');
      await fetchData();
      alert(`✓ Transferred ${formatCurrency(amount)} from ${WALLET_META[transferSource].name} to ${WALLET_META[transferDest].name}!`);
    } catch (err: any) {
      console.error('Error executing transfer:', err);
      alert('Failed to complete transfer: ' + (err.message || 'Please try again.'));
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // 7. Recover Floating Deposit
  const handleConfirmRecoverFloat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveringFloat) return;
    const amount = Number(recoverAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid recovery amount.");
      return;
    }
    if (amount > recoveringFloat.amount) {
      alert(`Recovery cannot exceed ${formatCurrency(recoveringFloat.amount)}.`);
      return;
    }
    if (balances[recoverSourceWallet] < amount) {
      alert(`Insufficient balance in ${WALLET_META[recoverSourceWallet].name}. Available: ${formatCurrency(balances[recoverSourceWallet])}`);
      return;
    }

    try {
      setIsProcessingRecover(true);

      const { data: rpcData, error: rpcErr } = await supabase.rpc('mutate_wallet_balance', {
        p_wallet: recoverSourceWallet,
        p_delta: -amount,
        p_user_id: profile?.id || null,
      });

      if (rpcErr || !rpcData?.success) {
        alert('Failed to debit float source: ' + (rpcData?.error || rpcErr?.message));
        return;
      }

      await supabase.from('transactions').insert([
        {
          wallet_type: recoverSourceWallet,
          from_wallet: recoverSourceWallet,
          type: 'personal_draw',
          status: 'completed',
          amount: amount,
          notes: `[Float Recovery] ₹${amount.toLocaleString('en-IN')} returned to ${recoveringFloat.depositedBy} from ${WALLET_META[recoverSourceWallet].name} | Original deposit on ${new Date(recoveringFloat.created_at).toLocaleDateString('en-IN')}`,
          created_by: profile?.id || null,
        }
      ]);

      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const isFull = amount >= recoveringFloat.amount;
      const updatedNotes = isFull
        ? `[Floating Deposit - ${recoveringFloat.tag}] ${recoveringFloat.notes} | Deposited By: ${recoveringFloat.depositedBy} | Status: Recovered (Withdrawn ${formatCurrency(amount)} from ${WALLET_META[recoverSourceWallet].name} on ${dateStr})`
        : `[Floating Deposit - ${recoveringFloat.tag}] ${recoveringFloat.notes} | Deposited By: ${recoveringFloat.depositedBy} | Status: Partially Recovered (Remaining: ${formatCurrency(recoveringFloat.amount - amount)})`;

      await supabase
        .from('transactions')
        .update({ notes: updatedNotes })
        .eq('id', recoveringFloat.id);

      setRecoveringFloat(null);
      setActiveModal('none');
      await fetchData();
      alert(`✓ Successfully recovered ${formatCurrency(amount)} for ${recoveringFloat.depositedBy}!`);
    } catch (err: any) {
      console.error('Error recovering float:', err);
      alert('Error recovering float: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingRecover(false);
    }
  };

  const handleCardStackTap = (wKey: WalletType) => {
    triggerHapticFeedback('light');
    if (activeExpandedCard === wKey) {
      setActiveExpandedCard(null);
    } else {
      setActiveExpandedCard(wKey);
      setSelectedWalletFilter(wKey);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* ══════════════════════════════════════════════════════════════════════════
          MOBILE VIEW (max-w-[420px] / block lg:hidden)
          Includes Apple Wallet Sticky Card Stack Animation & Quick Operations
          ══════════════════════════════════════════════════════════════════════════ */}
      <div className="block lg:hidden space-y-3 pb-8">
        
        {/* Mobile Filter Chips */}
        <div className="overflow-x-auto no-scrollbar flex items-center space-x-1.5 text-xs py-1">
          <button 
            onClick={() => { setSelectedWalletFilter('all'); setActiveExpandedCard(null); triggerHapticFeedback('light'); }}
            className={`flex-shrink-0 px-3 py-1 font-bold rounded-full shadow-xs transition-all cursor-pointer ${
              selectedWalletFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All ({formatShortCurrency(totalTreasuryBalance)})
          </button>
          <button 
            onClick={() => { setSelectedWalletFilter('cash_in_hand'); setActiveExpandedCard('cash_in_hand'); triggerHapticFeedback('light'); }}
            className={`flex-shrink-0 px-3 py-1 font-medium rounded-full border transition-all flex items-center gap-1 cursor-pointer ${
              selectedWalletFilter === 'cash_in_hand' ? 'bg-emerald-900 text-white border-emerald-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>🗄️</span> Physical Cash ({formatShortCurrency(balances.cash_in_hand || 0)})
          </button>
          <button 
            onClick={() => { setSelectedWalletFilter('kishor_bank'); setActiveExpandedCard('kishor_bank'); triggerHapticFeedback('light'); }}
            className={`flex-shrink-0 px-3 py-1 font-medium rounded-full border transition-all flex items-center gap-1 cursor-pointer ${
              selectedWalletFilter === 'kishor_bank' ? 'bg-indigo-900 text-white border-indigo-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>🏦</span> Dr. Kishor ({formatShortCurrency(balances.kishor_bank || 0)})
          </button>
          <button 
            onClick={() => { setSelectedWalletFilter('dad_bank'); setActiveExpandedCard('dad_bank'); triggerHapticFeedback('light'); }}
            className={`flex-shrink-0 px-3 py-1 font-medium rounded-full border transition-all flex items-center gap-1 cursor-pointer ${
              selectedWalletFilter === 'dad_bank' ? 'bg-cyan-900 text-white border-cyan-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>💳</span> Dad Bank ({formatShortCurrency(balances.dad_bank || 0)})
          </button>
          <button 
            onClick={() => { setSelectedWalletFilter('mom_bank'); setActiveExpandedCard('mom_bank'); triggerHapticFeedback('light'); }}
            className={`flex-shrink-0 px-3 py-1 font-medium rounded-full border transition-all flex items-center gap-1 cursor-pointer ${
              selectedWalletFilter === 'mom_bank' ? 'bg-rose-900 text-white border-rose-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>🪙</span> Mom Bank ({formatShortCurrency(balances.mom_bank || 0)})
          </button>
        </div>

        {/* 1. Mobile Hero Card */}
        <section className="rounded-2xl p-4 text-white shadow-xl relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20">
          <div className="absolute -right-10 -top-10 w-36 h-36 bg-brand-500/25 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between text-[11px] text-indigo-200">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold text-white">Consolidated Total</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">
              Active Sync
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-3xl font-extrabold tracking-tight text-white tabular-nums">
              {formatCurrency(totalTreasuryBalance)}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-indigo-200/90">
              <span>Physical: <strong className="text-white font-mono">{formatShortCurrency(balances.cash_in_hand || 0)}</strong></span>
              <span>•</span>
              <span>Banks: <strong className="text-white font-mono">{formatShortCurrency(bankCapital)}</strong></span>
            </div>
          </div>
        </section>

        {/* Mobile Quick Action Buttons Grid */}
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={() => setActiveModal('transfer')}
            className="h-12 px-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-0.5 text-slate-800 hover:bg-slate-50 active:scale-95 transition-all text-center group cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-brand-600" />
            <span className="text-[10px] font-bold text-slate-800 tracking-tight leading-none">Inter-Vault</span>
          </button>
          <button 
            onClick={() => setActiveModal('spend')}
            className="h-12 px-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-0.5 text-slate-800 hover:bg-slate-50 active:scale-95 transition-all text-center group cursor-pointer"
          >
            <Coins className="w-4 h-4 text-amber-600" />
            <span className="text-[10px] font-bold text-slate-800 tracking-tight leading-none">Personal Draw</span>
          </button>
          <button 
            onClick={() => setActiveModal('atm')}
            className="h-12 px-2 bg-brand-500 rounded-2xl shadow-xs flex flex-col items-center justify-center gap-0.5 text-white hover:bg-brand-600 active:scale-95 transition-all text-center group cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="text-[10px] font-bold text-white tracking-tight leading-none">ATM Relocate</span>
          </button>
        </div>

        {/* 2. Mobile Pending ATM Relocation Card (if any) */}
        {pendingRelocations.length > 0 && (
          <section className="p-3 bg-amber-50 rounded-2xl border border-amber-200/90 shadow-card flex flex-col gap-2.5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-base shadow-xs">
                  🏧
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">ATM Relocation</span>
                  </div>
                  <p className="text-[11px] text-amber-800 font-mono font-bold mt-0.5">
                    {formatCurrency(pendingRelocations[0].amount)} Withdrawn
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-amber-700 font-semibold bg-amber-100/70 px-2 py-0.5 rounded-full">
                In-Transit
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Withdrawn from {WALLET_META[pendingRelocations[0].source]?.name}. Needs physical counting before adding to Cash Box balance.
            </p>
            <button 
              onClick={() => handleVerifyATM(pendingRelocations[0].id, pendingRelocations[0].amount, pendingRelocations[0].source, pendingRelocations[0].notes)}
              disabled={isVerifyingAtmId === pendingRelocations[0].id}
              className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Verify &amp; Confirm Notes in Safe</span>
            </button>
          </section>
        )}

        {/* 3. APPLE WALLET STYLE STACKED CARDS CONTAINER WITH BUTTERY SMOOTH SCROLL & TAP EXPANSION */}
        <section className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>Vaults</span>
              <span className="text-[10px] lowercase font-normal text-slate-400">(Tap or scroll stack)</span>
            </h3>
            {activeExpandedCard && (
              <button 
                onClick={() => setActiveExpandedCard(null)}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700"
              >
                Reset Stack
              </button>
            )}
          </div>

          <div className="relative flex flex-col space-y-[-78px] pt-1 pb-16">
            
            {/* CARD 1: Physical Cash Box */}
            <div 
              onClick={() => handleCardStackTap('cash_in_hand')}
              className={`sticky top-20 rounded-2xl p-3.5 text-white shadow-xl transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) relative overflow-hidden border border-emerald-400/30 cursor-pointer ${
                activeExpandedCard === 'cash_in_hand' 
                  ? 'scale-[1.02] z-30 shadow-2xl translate-y-[-8px]' 
                  : 'hover:translate-y-[-4px]'
              }`}
              style={{
                background: 'linear-gradient(135deg, #062b1e 0%, #0d3d2c 50%, #041f15 100%)',
                boxShadow: '0 10px 25px -5px rgba(6, 43, 30, 0.45), inset 0 1px 1px rgba(255,255,255,0.3)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none"></div>
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col justify-between h-[154px]">
                {/* Top strip */}
                <div className="flex items-start justify-between pb-1">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black tracking-wider text-emerald-200 font-mono">Physical Cash Box</span>
                      <span className="text-[8px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold">Safe #01</span>
                    </div>
                    <p className="text-[9px] text-emerald-200/70 font-medium mt-0.5">cash_in_hand</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold font-mono text-white tabular-nums">
                      {formatCurrency(balances.cash_in_hand || 0)}
                    </span>
                    <div className="w-6 h-6 rounded-lg border border-amber-300/60 flex items-center justify-center text-[10px] shadow-xs" style={{ background: 'linear-gradient(135deg, #fef08a 0%, #d97706 70%, #b45309 100%)', color: '#451a03' }}>
                      🔒
                    </div>
                  </div>
                </div>

                {/* Middle row */}
                <div className="flex items-center justify-between my-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-6 rounded-md border border-amber-200/60 relative overflow-hidden flex items-center justify-center shadow-xs" style={{ background: 'linear-gradient(135deg, #fef9c3 0%, #fde047 40%, #ca8a04 100%)' }}>
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px] opacity-40">
                        <div className="border-b border-r border-amber-950/40 rounded-2xs"></div>
                        <div className="border-b border-l border-amber-950/40 rounded-2xs"></div>
                        <div className="border-t border-r border-amber-950/40 rounded-2xs"></div>
                        <div className="border-t border-l border-amber-950/40 rounded-2xs"></div>
                      </div>
                      <div className="w-2.5 h-2 rounded-xs border border-amber-950/30 bg-amber-200/50"></div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {cashDisparity === 0 ? 'Tally Matched' : `${formatCurrency(cashDisparity)}`}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-wider text-emerald-200/70 font-semibold">Vault Balance</p>
                    <span className="text-lg font-extrabold font-mono tracking-tight text-white tabular-nums">
                      {formatCurrency(balances.cash_in_hand || 0)}
                    </span>
                  </div>
                </div>

                {/* Bottom row */}
                <div className="flex items-end justify-between pt-1 border-t border-emerald-500/20 text-[10px]">
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-emerald-300/80 font-bold">Custodian</p>
                    <p className="font-bold font-mono tracking-wider text-white text-[10px]">PHYSICAL CASH DRAWER</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono tracking-widest text-emerald-200 font-semibold text-[10px]">SAFE •••• 01</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: Dr. Kishor Account */}
            <div 
              onClick={() => handleCardStackTap('kishor_bank')}
              className={`sticky top-24 rounded-2xl p-3.5 text-white shadow-xl transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) relative overflow-hidden border border-blue-400/30 cursor-pointer ${
                activeExpandedCard === 'kishor_bank' 
                  ? 'scale-[1.02] z-30 shadow-2xl translate-y-[-8px]' 
                  : 'hover:translate-y-[-4px]'
              }`}
              style={{
                background: 'linear-gradient(135deg, #031b4e 0%, #002b80 50%, #011b54 100%)',
                boxShadow: '0 10px 25px -5px rgba(0, 43, 128, 0.45), inset 0 1px 1px rgba(255,255,255,0.3)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-blue-400/10 to-white/10 pointer-events-none"></div>
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col justify-between h-[154px]">
                <div className="flex items-start justify-between pb-1">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black tracking-wider text-blue-200 font-mono">Dr. Kishor Account</span>
                      <span className="text-[8px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30 font-semibold">Collections</span>
                    </div>
                    <p className="text-[9px] text-blue-200/70 font-medium mt-0.5">Primary UPI / kishor_bank</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold font-mono text-white tabular-nums">
                      {formatCurrency(balances.kishor_bank || 0)}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center p-0.5 shadow-xs">
                      <div className="w-full h-full bg-[#004c8f] rounded flex items-center justify-center text-[8px] font-black text-white">H</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between my-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-6 rounded-md border border-amber-200/60 relative overflow-hidden flex items-center justify-center shadow-xs" style={{ background: 'linear-gradient(135deg, #fef9c3 0%, #fde047 40%, #ca8a04 100%)' }}>
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px] opacity-40">
                        <div className="border-b border-r border-amber-950/40 rounded-2xs"></div>
                        <div className="border-b border-l border-amber-950/40 rounded-2xs"></div>
                        <div className="border-t border-r border-amber-950/40 rounded-2xs"></div>
                        <div className="border-t border-l border-amber-950/40 rounded-2xs"></div>
                      </div>
                      <div className="w-2.5 h-2 rounded-xs border border-amber-950/30 bg-amber-200/50"></div>
                    </div>
                    <svg className="w-4 h-4 text-blue-200/80 transform rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4"></path><path d="M6 12c0-3.31 2.69-6 6-6s6 2.69 6 6"></path></svg>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-wider text-blue-200/70 font-semibold">Available Balance</p>
                    <span className="text-lg font-extrabold font-mono tracking-tight text-white tabular-nums">
                      {formatCurrency(balances.kishor_bank || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-1 border-t border-blue-400/20 text-[10px]">
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-blue-300/80 font-bold">Cardholder</p>
                    <p className="font-bold font-mono tracking-wider text-white text-[10px]">DR. KISHOR ANBAZHAKAN</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono tracking-widest text-blue-200 font-semibold text-[10px]">•••• 4192</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: Anbazhakan (Dad) Account */}
            <div 
              onClick={() => handleCardStackTap('dad_bank')}
              className={`sticky top-28 rounded-2xl p-3.5 text-white shadow-xl transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) relative overflow-hidden border border-teal-400/30 cursor-pointer ${
                activeExpandedCard === 'dad_bank' 
                  ? 'scale-[1.02] z-30 shadow-2xl translate-y-[-8px]' 
                  : 'hover:translate-y-[-4px]'
              }`}
              style={{
                background: 'linear-gradient(135deg, #072a31 0%, #0d4653 50%, #051f24 100%)',
                boxShadow: '0 10px 25px -5px rgba(7, 42, 49, 0.45), inset 0 1px 1px rgba(255,255,255,0.25)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-300/10 to-white/10 pointer-events-none"></div>
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-cyan-400/15 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col justify-between h-[154px]">
                <div className="flex items-start justify-between pb-1">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black tracking-wider text-teal-200 font-mono">Anbazhakan (Dad) Account</span>
                      <span className="text-[8px] px-1.5 py-0.2 rounded bg-cyan-400/15 text-teal-200 border border-teal-400/30 font-semibold">Disbursal</span>
                    </div>
                    <p className="text-[9px] text-teal-200/70 font-medium mt-0.5">Prize Disbursal Pool / dad_bank</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold font-mono text-white tabular-nums">
                      {formatCurrency(balances.dad_bank || 0)}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-[#00b5e2] flex items-center justify-center shadow-xs">
                      <div className="w-3 h-3 rounded-full bg-[#072a31] relative flex items-center justify-center">
                        <div className="w-1 h-1.5 bg-[#00b5e2] rounded-xs -mt-0.5"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between my-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-6 rounded-md border border-amber-200/60 relative overflow-hidden flex items-center justify-center shadow-xs" style={{ background: 'linear-gradient(135deg, #fef9c3 0%, #fde047 40%, #ca8a04 100%)' }}>
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px] opacity-40">
                        <div className="border-b border-r border-amber-950/40 rounded-2xs"></div>
                        <div className="border-b border-l border-amber-950/40 rounded-2xs"></div>
                        <div className="border-t border-r border-amber-950/40 rounded-2xs"></div>
                        <div className="border-t border-l border-amber-950/40 rounded-2xs"></div>
                      </div>
                      <div className="w-2.5 h-2 rounded-xs border border-amber-950/30 bg-amber-200/50"></div>
                    </div>
                    <svg className="w-4 h-4 text-teal-200/80 transform rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4"></path><path d="M6 12c0-3.31 2.69-6 6-6s6 2.69 6 6"></path></svg>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-wider text-teal-200/70 font-semibold">Available Balance</p>
                    <span className="text-lg font-extrabold font-mono tracking-tight text-white tabular-nums">
                      {formatCurrency(balances.dad_bank || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-1 border-t border-teal-400/20 text-[10px]">
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-teal-300/80 font-bold">Cardholder</p>
                    <p className="font-bold font-mono tracking-wider text-white text-[10px]">ANBAZHAKAN (DAD)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono tracking-widest text-teal-200 font-semibold text-[10px]">•••• 8821</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 4: Parimalam (Mom) Account */}
            <div 
              onClick={() => handleCardStackTap('mom_bank')}
              className={`sticky top-32 rounded-2xl p-3.5 text-white shadow-xl transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) relative overflow-hidden border border-rose-400/30 cursor-pointer ${
                activeExpandedCard === 'mom_bank' 
                  ? 'scale-[1.02] z-30 shadow-2xl translate-y-[-8px]' 
                  : 'hover:translate-y-[-4px]'
              }`}
              style={{
                background: 'linear-gradient(135deg, #420a15 0%, #721424 50%, #30060e 100%)',
                boxShadow: '0 10px 25px -5px rgba(66, 10, 21, 0.45), inset 0 1px 1px rgba(255,255,255,0.25)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-200/10 to-white/10 pointer-events-none"></div>
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-rose-500/15 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col justify-between h-[154px]">
                <div className="flex items-start justify-between pb-1">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black tracking-wider text-rose-200 font-mono">Parimalam (Mom) Account</span>
                      <span className="text-[8px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-200 border border-rose-400/30 font-semibold">Reserve</span>
                    </div>
                    <p className="text-[9px] text-rose-200/70 font-medium mt-0.5">Emergency Reserve / mom_bank</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold font-mono text-white tabular-nums">
                      {formatCurrency(balances.mom_bank || 0)}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-[#b02a30] border border-amber-400/40 flex items-center justify-center shadow-xs">
                      <span className="text-[9px] font-black text-amber-200 font-mono">i</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between my-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-6 rounded-md border border-amber-200/60 relative overflow-hidden flex items-center justify-center shadow-xs" style={{ background: 'linear-gradient(135deg, #fef9c3 0%, #fde047 40%, #ca8a04 100%)' }}>
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px] p-[2px] opacity-40">
                        <div className="border-b border-r border-amber-950/40 rounded-2xs"></div>
                        <div className="border-b border-l border-amber-950/40 rounded-2xs"></div>
                        <div className="border-t border-r border-amber-950/40 rounded-2xs"></div>
                        <div className="border-t border-l border-amber-950/40 rounded-2xs"></div>
                      </div>
                      <div className="w-2.5 h-2 rounded-xs border border-amber-950/30 bg-amber-200/50"></div>
                    </div>
                    <svg className="w-4 h-4 text-rose-200/80 transform rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4"></path><path d="M6 12c0-3.31 2.69-6 6-6s6 2.69 6 6"></path></svg>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-wider text-rose-200/70 font-semibold">Available Balance</p>
                    <span className="text-lg font-extrabold font-mono tracking-tight text-white tabular-nums">
                      {formatCurrency(balances.mom_bank || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-1 border-t border-rose-400/20 text-[10px]">
                  <div>
                    <p className="text-[8px] uppercase tracking-wider text-rose-300/80 font-bold">Cardholder</p>
                    <p className="font-bold font-mono tracking-wider text-white text-[10px]">PARIMALAM (MOM)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono tracking-widest text-rose-200 font-semibold text-[10px]">•••• 3094</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 4. Mobile Physical Note Denomination Counter Card */}
        <section className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-card space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">🧮</span>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Physical Cash Counter</h3>
                <p className="text-[10px] text-slate-500">Live note counter vs Cash Box</p>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              cashDisparity === 0 
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                : 'text-rose-700 bg-rose-50 border-rose-200'
            }`}>
              {cashDisparity === 0 ? '₹0 Variance' : `${formatCurrency(cashDisparity)}`}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span>Total Count: <strong className="font-mono text-slate-900">{formatCurrency(calculatedPhysicalCash)}</strong></span>
            <button 
              onClick={() => setActiveModal('denominations')}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 cursor-pointer"
            >
              Open Full Tally Keypad →
            </button>
          </div>
        </section>

        {/* 5. Mobile Personal Expenses & Float Tracker */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Personal Expenses &amp; Float</h3>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              {formatCurrency(totalOutstandingDebt)} Outstanding
            </span>
          </div>

          {outstandingPersonalDraws.length > 0 ? (
            outstandingPersonalDraws.slice(0, 2).map((draw) => (
              <div key={draw.id} className="p-3 bg-white rounded-2xl border border-slate-200 shadow-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800">{draw.tag}</span>
                    <span className="text-xs font-bold text-slate-900">{draw.takenBy}</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900 font-mono">{formatCurrency(draw.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>{WALLET_META[draw.walletType]?.shortName}</span>
                  <button 
                    onClick={() => {
                      setSettlingDraw(draw);
                      setSettleAmount(String(draw.amount));
                      setSettleDestWallet(draw.walletType);
                      setActiveModal('settle');
                    }}
                    className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                  >
                    Settle
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No outstanding personal draws
            </div>
          )}

          {activeFloatingDeposits.length > 0 && (
            <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-card flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">Float Injected</span>
                  <span className="text-xs font-bold text-slate-900">{activeFloatingDeposits[0].depositedBy}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{activeFloatingDeposits[0].tag}</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-extrabold text-emerald-700 font-mono">
                  {formatCurrency(activeFloatingDeposits[0].amount)}
                </div>
                <button 
                  onClick={() => {
                    const f = activeFloatingDeposits[0];
                    setRecoveringFloat(f);
                    setRecoverAmount(String(f.amount));
                    setRecoverSourceWallet(f.walletType);
                    setActiveModal('recover');
                  }}
                  className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Recover Float →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 6. Mobile Audit Statement & Recent Transactions Stream */}
        <section className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-card space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 text-brand-600 flex items-center justify-center font-bold text-xs">📝</span>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Recent Treasury Ledger</h3>
                <p className="text-[10px] text-slate-500">Live credit &amp; debit movements</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">{filteredTransactions.length} txs</span>
          </div>

          <div className="space-y-2">
            {filteredTransactions.slice(0, 5).map((tx) => {
              const { isCredit, badgeLabel } = getTxDirection(tx, selectedWalletFilter);
              return (
                <div key={tx.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <span className="w-7 h-7 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-xs flex-shrink-0">
                      {tx.type === 'atm_withdrawal' ? '🏧' : tx.type === 'collection' ? '💰' : tx.type === 'personal_draw' ? '💼' : '🔄'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {tx.notes || tx.description || 'Treasury Movement'}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">
                        {WALLET_META[tx.wallet_type]?.shortName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono flex-shrink-0">
                    <span className={`text-xs font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isCredit ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                    </span>
                    <div className="text-[9px] text-slate-400">
                      {new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          DESKTOP WORKSPACE VIEW (hidden lg:block / 1440px Viewport)
          ══════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block space-y-6">
        
        {/* Top Desktop Action Header */}
        <div className="bg-white border border-slate-200/80 rounded-2xl px-6 py-4 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold font-display text-slate-900 tracking-tight whitespace-nowrap">
                Treasury &amp; Cash Vaults
              </h1>
            </div>
            <div className="h-5 w-px bg-slate-200"></div>
            
            {/* Standardized Vault Filter Dropdown */}
            <div className="relative inline-flex items-center">
              <Wallet className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
              <select 
                value={selectedWalletFilter}
                onChange={(e) => setSelectedWalletFilter(e.target.value as any)}
                className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold pl-8 pr-7 py-1.5 rounded-xl border border-slate-200/70 transition-all focus:bg-white focus:border-brand-500 cursor-pointer"
              >
                <option value="all">All 4 Vaults ({formatCurrency(totalTreasuryBalance)})</option>
                <option value="cash_in_hand">Physical Cash Box — Safe #01 ({formatCurrency(balances.cash_in_hand || 0)})</option>
                <option value="kishor_bank">Dr. Kishor Account — HDFC ({formatCurrency(balances.kishor_bank || 0)})</option>
                <option value="dad_bank">Anbazhakan (Dad) Account — CSB ({formatCurrency(balances.dad_bank || 0)})</option>
                <option value="mom_bank">Parimalam (Mom) Account — SBI ({formatCurrency(balances.mom_bank || 0)})</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveModal('transfer')}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/80 transition-all shadow-2xs whitespace-nowrap cursor-pointer active:scale-95"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>Inter-vault Transfer</span>
            </button>
            <button 
              onClick={() => setActiveModal('spend')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-all cursor-pointer active:scale-95"
            >
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>Log Personal Draw</span>
            </button>
            <button 
              onClick={() => setActiveModal('atm')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-semibold rounded-xl shadow-sm shadow-brand-500/25 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ATM Cash Relocation</span>
            </button>
          </div>
        </div>

        {/* 1. Desktop Consolidated Treasury Summary Strip */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-brand-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-indigo-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-semibold text-white">Consolidated Liquid Treasury</span>
              </div>
              <div className="mt-3 flex items-baseline gap-4 flex-wrap">
                <h2 className="text-4xl font-black font-display tracking-tight text-white tabular-nums">
                  {formatCurrency(totalTreasuryBalance)}
                </h2>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Live Multi-Account Balance
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 flex items-center gap-3 flex-wrap">
                <span>Physical Cash: <strong className="text-white font-mono">{formatCurrency(balances.cash_in_hand || 0)}</strong></span>
                <span className="text-slate-500">•</span>
                <span>Bank Capital: <strong className="text-white font-mono">{formatCurrency(bankCapital)}</strong></span>
                <span className="text-slate-500">•</span>
                <span>Active Floating Capital Injected: <strong className="text-amber-300 font-mono">{formatCurrency(floatStats.total)}</strong></span>
              </p>
            </div>

            {/* In-Transit ATM Cash Banner & Quick Actions */}
            <div className="flex items-center gap-3">
              {pendingRelocations.length > 0 ? (
                <div className="p-3.5 bg-amber-500/20 border border-amber-400/40 rounded-2xl backdrop-blur-md flex items-center gap-3.5 shadow-lg shadow-amber-950/20">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/25 border border-amber-400/50 text-amber-300 flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-inner">
                    🏧
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-amber-400 text-slate-950">IN-TRANSIT</span>
                      <span className="text-xs font-bold text-white tabular-nums">{formatCurrency(pendingRelocations[0].amount)} ATM Relocation</span>
                    </div>
                    <p className="text-[11px] text-amber-200 mt-0.5 font-medium">
                      Withdrawn from <strong className="text-white font-semibold">{WALLET_META[pendingRelocations[0].source]?.name}</strong> ➔ Pending count in <strong className="text-white font-semibold">Physical Cash Box</strong>
                    </p>
                  </div>
                  <button 
                    onClick={() => handleVerifyATM(pendingRelocations[0].id, pendingRelocations[0].amount, pendingRelocations[0].source, pendingRelocations[0].notes)}
                    disabled={isVerifyingAtmId === pendingRelocations[0].id}
                    className="ml-2 px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5 text-slate-950" />
                    <span>Confirm Cash Count &amp; Deposit into Cash Box</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center font-bold text-lg flex-shrink-0">
                    🛡️
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200">SEALED</span>
                      <span className="text-xs font-bold text-white">All 4 Vaults Synchronized</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 font-medium">Zero pending ATM movements in flight</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setActiveModal('deposit')}
                  className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Inject Float</span>
                </button>
                <button 
                  onClick={() => setActiveModal('denominations')}
                  className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Denomination Match</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Desktop Four Financial Vault Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* VAULT 1 */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-950 p-5 text-white shadow-xl border border-emerald-500/25 flex flex-col justify-between transition-all group min-h-[224px]">
            <div className="absolute -right-12 -top-12 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -left-10 -bottom-10 w-28 h-28 bg-brand-500/10 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-sm border border-amber-300/60 flex flex-col justify-between overflow-hidden flex-shrink-0">
                  <div className="flex justify-between items-center h-full">
                    <div className="w-2.5 h-full border-r border-amber-700/40"></div>
                    <div className="flex-1 h-2 border-y border-amber-700/40 mx-0.5"></div>
                    <div className="w-2.5 h-full border-l border-amber-700/40"></div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-emerald-400/80 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8.5 14.5A2.5 2.5 0 0011 12a2.5 2.5 0 00-2.5-2.5M5.5 17.5A6.5 6.5 0 0012 11a6.5 6.5 0 00-6.5-6.5" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
                </svg>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold tracking-wide backdrop-blur-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Safe #01 · cash_in_hand
                </span>
                <span className="text-[9px] text-emerald-200/80 font-medium block mt-0.5">Physical Liquid Safe</span>
              </div>
            </div>

            <div className="relative z-10 my-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Available Balance</p>
                  <p className="text-2xl font-black font-display tracking-tight text-white tabular-nums mt-0.5">
                    {formatCurrency(balances.cash_in_hand || 0)}
                  </p>
                </div>
                {pendingRelocations.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold tabular-nums">
                    +{formatCurrency(pendingRelocations.reduce((s, r) => s + r.amount, 0))} in-transit
                  </span>
                )}
              </div>
            </div>

            <div className="relative z-10 pt-2.5 border-t border-white/10 flex items-end justify-between">
              <div>
                <p className="font-mono text-xs tracking-wider text-slate-300 font-semibold">VAULT-01 •••• SAFE</p>
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300 mt-0.5">PHYSICAL CASH BOX</p>
              </div>
              <button 
                onClick={() => setActiveModal('denominations')}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs border border-white/15 backdrop-blur-md transition-all shadow-sm cursor-pointer"
              >
                Count Notes
              </button>
            </div>
          </div>

          {/* VAULT 2 */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-brand-900 p-5 text-white shadow-xl border border-indigo-500/30 flex flex-col justify-between transition-all group min-h-[224px]">
            <div className="absolute -right-12 -top-12 w-36 h-36 bg-brand-500/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -left-10 -bottom-10 w-28 h-28 bg-indigo-500/15 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-7 rounded-md bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 p-0.5 shadow-sm border border-slate-200/80 flex flex-col justify-between overflow-hidden flex-shrink-0">
                  <div className="flex justify-between items-center h-full">
                    <div className="w-2.5 h-full border-r border-slate-500/40"></div>
                    <div className="flex-1 h-2 border-y border-slate-500/40 mx-0.5"></div>
                    <div className="w-2.5 h-full border-l border-slate-500/40"></div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-indigo-300/80 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8.5 14.5A2.5 2.5 0 0011 12a2.5 2.5 0 00-2.5-2.5M5.5 17.5A6.5 6.5 0 0012 11a6.5 6.5 0 00-6.5-6.5" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
                </svg>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-500/30 border border-brand-400/40 text-brand-200 text-[9px] font-bold">
                  Primary UPI / Collections
                </span>
                <span className="text-[9px] text-indigo-200/80 font-mono block mt-0.5">kishor_bank</span>
              </div>
            </div>

            <div className="relative z-10 my-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-200/70">Available Balance</p>
                  <p className="text-2xl font-black font-display tracking-tight text-white tabular-nums mt-0.5">
                    {formatCurrency(balances.kishor_bank || 0)}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Auto-recon Active
                </span>
              </div>
            </div>

            <div className="relative z-10 pt-2.5 border-t border-white/10 flex items-end justify-between">
              <div>
                <p className="font-mono text-xs tracking-wider text-slate-200 font-semibold">•••• •••• •••• 4192</p>
                <p className="text-[11px] font-black uppercase tracking-wider text-indigo-200 mt-0.5">DR. KISHOR ACCOUNT</p>
              </div>
              <button 
                onClick={() => setSelectedWalletFilter(selectedWalletFilter === 'kishor_bank' ? 'all' : 'kishor_bank')}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs border border-white/15 backdrop-blur-md transition-all shadow-sm cursor-pointer"
              >
                Statement
              </button>
            </div>
          </div>

          {/* VAULT 3 */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 p-5 text-white shadow-xl border border-indigo-400/25 flex flex-col justify-between transition-all group min-h-[224px]">
            <div className="absolute -right-12 -top-12 w-36 h-36 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -left-10 -bottom-10 w-28 h-28 bg-brand-600/15 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-7 rounded-md bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 p-0.5 shadow-sm border border-slate-200/80 flex flex-col justify-between overflow-hidden flex-shrink-0">
                  <div className="flex justify-between items-center h-full">
                    <div className="w-2.5 h-full border-r border-slate-500/40"></div>
                    <div className="flex-1 h-2 border-y border-slate-500/40 mx-0.5"></div>
                    <div className="w-2.5 h-full border-l border-slate-500/40"></div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-emerald-300/80 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8.5 14.5A2.5 2.5 0 0011 12a2.5 2.5 0 00-2.5-2.5M5.5 17.5A6.5 6.5 0 0012 11a6.5 6.5 0 00-6.5-6.5" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
                </svg>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-[9px] font-bold">
                  Prize Disbursal
                </span>
                <span className="text-[9px] text-slate-300 font-mono block mt-0.5">dad_bank</span>
              </div>
            </div>

            <div className="relative z-10 my-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Available Balance</p>
                  <p className="text-2xl font-black font-display tracking-tight text-white tabular-nums mt-0.5">
                    {formatCurrency(balances.dad_bank || 0)}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-medium">
                  Prize Disbursal Vault
                </span>
              </div>
            </div>

            <div className="relative z-10 pt-2.5 border-t border-white/10 flex items-end justify-between">
              <div>
                <p className="font-mono text-xs tracking-wider text-slate-200 font-semibold">•••• •••• •••• 8821</p>
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300 mt-0.5">ANBAZHAKAN (DAD) ACCOUNT</p>
              </div>
              <button 
                onClick={() => setSelectedWalletFilter(selectedWalletFilter === 'dad_bank' ? 'all' : 'dad_bank')}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs border border-white/15 backdrop-blur-md transition-all shadow-sm cursor-pointer"
              >
                Statement
              </button>
            </div>
          </div>

          {/* VAULT 4 */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-slate-900 via-rose-950 to-slate-900 p-5 text-white shadow-xl border border-rose-500/30 flex flex-col justify-between transition-all group min-h-[224px]">
            <div className="absolute -right-12 -top-12 w-36 h-36 bg-amber-400/15 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -left-10 -bottom-10 w-28 h-28 bg-rose-500/15 rounded-full blur-xl pointer-events-none"></div>
            
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-sm border border-amber-300/60 flex flex-col justify-between overflow-hidden flex-shrink-0">
                  <div className="flex justify-between items-center h-full">
                    <div className="w-2.5 h-full border-r border-amber-700/40"></div>
                    <div className="flex-1 h-2 border-y border-amber-700/40 mx-0.5"></div>
                    <div className="w-2.5 h-full border-l border-amber-700/40"></div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-amber-300/80 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M8.5 14.5A2.5 2.5 0 0011 12a2.5 2.5 0 00-2.5-2.5M5.5 17.5A6.5 6.5 0 0012 11a6.5 6.5 0 00-6.5-6.5" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
                </svg>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[9px] font-bold">
                  Emergency Reserve
                </span>
                <span className="text-[9px] text-amber-200/90 font-mono block mt-0.5">mom_bank</span>
              </div>
            </div>

            <div className="relative z-10 my-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Available Balance</p>
                  <p className="text-2xl font-black font-display tracking-tight text-white tabular-nums mt-0.5">
                    {formatCurrency(balances.mom_bank || 0)}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-[10px] font-semibold">
                  Kai Iruppu Reserve
                </span>
              </div>
            </div>

            <div className="relative z-10 pt-2.5 border-t border-white/10 flex items-end justify-between">
              <div>
                <p className="font-mono text-xs tracking-wider text-slate-200 font-semibold">•••• •••• •••• 3094</p>
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-300 mt-0.5">PARIMALAM (MOM) ACCOUNT</p>
              </div>
              <button 
                onClick={() => setSelectedWalletFilter(selectedWalletFilter === 'mom_bank' ? 'all' : 'mom_bank')}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs border border-white/15 backdrop-blur-md transition-all shadow-sm cursor-pointer"
              >
                Statement
              </button>
            </div>
          </div>
        </section>

        {/* 3. Desktop Split Section: Denominations & Personal Draws */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Denominations (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  🧮
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-slate-900">Physical Cash Denomination Reconciler</h3>
                  <p className="text-[11px] text-slate-500">Live note tallying against Physical Cash Box registered balance ({formatCurrency(balances.cash_in_hand || 0)})</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                cashDisparity === 0 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : cashDisparity > 0 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${cashDisparity === 0 ? 'bg-emerald-500' : cashDisparity > 0 ? 'bg-blue-500' : 'bg-rose-500'}`}></span>
                {cashDisparity === 0 ? 'Perfect Match (₹0 Variance)' : `${cashDisparity > 0 ? '+' : ''}${formatCurrency(cashDisparity)} Variance`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              {[500, 200, 100, 50, 20, 10].map((note) => (
                <div key={note} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">₹{note} Note</span>
                    <span className="text-[10px] font-mono text-slate-500">x {denominations[note] || 0}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input 
                      type="number"
                      min={0}
                      value={denominations[note] || ''}
                      onChange={(e) => setDenominations(prev => ({ ...prev, [note]: parseInt(e.target.value) || 0 }))}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg py-1 px-2 font-mono font-bold text-slate-800 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div className="mt-1.5 text-right font-mono text-xs font-bold text-slate-900">
                    {formatCurrency((denominations[note] || 0) * note)}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <span>Total Counted Notes: <strong className="text-slate-900 font-mono">{formatCurrency(calculatedPhysicalCash)}</strong></span>
                <span className="text-slate-300">|</span>
                <span>Physical Cash Box: <strong className="text-slate-900 font-mono">{formatCurrency(balances.cash_in_hand || 0)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setDenominations({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 })}
                  className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs shadow-2xs cursor-pointer"
                >
                  Reset
                </button>
                <button 
                  onClick={() => {
                    triggerHapticFeedback('success');
                    alert(`✓ Physical cash tally of ${formatCurrency(calculatedPhysicalCash)} stamped successfully! Variance: ${formatCurrency(cashDisparity)}`);
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer"
                >
                  Save Physical Tally Stamp
                </button>
              </div>
            </div>
          </div>

          {/* Right: Personal Draws & Float (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center">💼</span>
                  <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-wider">Outstanding Personal Draws</h4>
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                  {formatCurrency(totalOutstandingDebt)} Due
                </span>
              </div>

              {outstandingPersonalDraws.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 font-medium">
                  No outstanding personal cash draws recorded.
                </div>
              ) : (
                <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                  {outstandingPersonalDraws.slice(0, 3).map((draw) => (
                    <div key={draw.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/60 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800">{draw.tag}</span>
                          <span className="text-xs font-bold text-slate-900">{draw.takenBy}</span>
                        </div>
                        <span className="text-xs font-extrabold text-slate-900 font-mono">{formatCurrency(draw.amount)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span>From {WALLET_META[draw.walletType]?.name || draw.walletType}</span>
                        <button 
                          onClick={() => {
                            setSettlingDraw(draw);
                            setSettleAmount(String(draw.amount));
                            setSettleDestWallet(draw.walletType);
                            setActiveModal('settle');
                          }}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Settle to {draw.walletType === 'cash_in_hand' ? 'Cash Box' : 'Bank'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">🌊</span>
                  <h4 className="font-display font-bold text-xs text-slate-900 uppercase tracking-wider">Active Floating Capital Float</h4>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {formatCurrency(floatStats.total)} Injected
                </span>
              </div>

              {activeFloatingDeposits.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 font-medium">
                  No active floating capital injections.
                </div>
              ) : (
                <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                  {activeFloatingDeposits.slice(0, 3).map((f) => (
                    <div key={f.id} className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-200/70 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{f.depositedBy}</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">{f.tag}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{f.notes || `Credited into ${WALLET_META[f.walletType]?.name}`}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-extrabold text-slate-900">{formatCurrency(f.amount)}</div>
                        <button 
                          onClick={() => {
                            setRecoveringFloat(f);
                            setRecoverAmount(String(f.amount));
                            setRecoverSourceWallet(f.walletType);
                            setActiveModal('recover');
                          }}
                          className="mt-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Recover / Return
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 4. Desktop Audit Statement & Ledger Table */}
        <section className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <h3 className="font-display font-bold text-base text-slate-900">Treasury Audit Statement &amp; Ledger</h3>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                {filteredTransactions.length} Movements Recorded
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-60">
                <input 
                  type="text"
                  placeholder="Search reference, memo, ID..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="w-full text-xs bg-slate-50 border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-brand-500 focus:border-brand-500 transition-all"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <div className="relative">
                <select 
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value as any)}
                  className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:ring-brand-500 focus:border-brand-500 pr-7 appearance-none cursor-pointer"
                >
                  <option value="month">Date: This Month / M2 Cycle</option>
                  <option value="30days">Date: Last 30 Days</option>
                  <option value="all">Date: All Time</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
              </div>

              <div className="relative">
                <select 
                  value={selectedWalletFilter}
                  onChange={(e) => setSelectedWalletFilter(e.target.value as any)}
                  className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:ring-brand-500 focus:border-brand-500 pr-7 appearance-none cursor-pointer"
                >
                  <option value="all">All 4 Vaults</option>
                  <option value="cash_in_hand">Physical Cash Box</option>
                  <option value="kishor_bank">Dr. Kishor Account</option>
                  <option value="dad_bank">Anbazhakan (Dad) Account</option>
                  <option value="mom_bank">Parimalam (Mom) Account</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
              </div>

              <div className="relative">
                <select 
                  value={ledgerTypeFilter}
                  onChange={(e) => setLedgerTypeFilter(e.target.value)}
                  className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:ring-brand-500 focus:border-brand-500 pr-7 appearance-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="collection">Collection (+)</option>
                  <option value="payout">Prize Disbursal (-)</option>
                  <option value="transfer">Vault Transfer</option>
                  <option value="atm">ATM Relocation</option>
                  <option value="draw">Personal Draw (-)</option>
                  <option value="float">Float Inflow (+)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
              </div>

              <button 
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200/80 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 px-6 py-2.5 bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-2">Date &amp; Time</div>
            <div className="col-span-3">Transaction Description &amp; Memo</div>
            <div className="col-span-2">Source / Destination Vault</div>
            <div className="col-span-2">Category Tag</div>
            <div className="col-span-2 text-right">Amount (₹)</div>
            <div className="col-span-1 text-center">Status</div>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No transactions match your current search and filter criteria.
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const { isCredit, badgeLabel, badgeColor } = getTxDirection(tx, selectedWalletFilter);
                const dateObj = new Date(tx.created_at);
                const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                const txIdShort = `TXN #${tx.id.slice(0, 6).toUpperCase()}`;

                return (
                  <div 
                    key={tx.id} 
                    className={`grid grid-cols-12 px-6 py-2.5 items-center hover:bg-slate-50/80 transition-colors ${
                      tx.type === 'atm_withdrawal' && tx.status === 'pending_verification' ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <div className="col-span-2 font-mono text-slate-600">
                      <div className="font-bold text-slate-900 leading-tight">{dateStr}, {timeStr}</div>
                      <span className="text-[10px] text-slate-400">{txIdShort}</span>
                    </div>

                    <div className="col-span-3 pr-2">
                      <div className="font-bold text-slate-900 leading-tight">
                        {tx.type === 'collection' ? 'Member Installment Collection' : 
                         tx.type === 'payout' ? 'Month Winner Prize Pot Payout' :
                         tx.type === 'atm_withdrawal' ? 'ATM Withdrawal for Safe Cash' :
                         tx.type === 'personal_draw' ? 'Personal Draw Expense' :
                         'Inter-Vault Liquidity Balancing'}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {tx.notes || tx.description || 'Treasury Movement'}
                      </p>
                    </div>

                    <div className="col-span-2 pr-2">
                      <div className="flex items-center gap-1 font-semibold text-slate-700 text-[11px]">
                        <span className="truncate">{WALLET_META[tx.wallet_type]?.name || tx.wallet_type}</span>
                        {tx.to_wallet && tx.to_wallet !== tx.wallet_type && (
                          <>
                            <span className="text-brand-600 font-bold">➔</span>
                            <span className="truncate">{WALLET_META[tx.to_wallet as WalletType]?.name || tx.to_wallet}</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {WALLET_META[tx.wallet_type]?.bankName || 'Verified Vault'}
                      </span>
                    </div>

                    <div className="col-span-2 pr-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badgeColor}`}>
                        {badgeLabel}
                      </span>
                    </div>

                    <div className="col-span-2 text-right font-mono pr-2">
                      <div className={`font-extrabold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {tx.status === 'pending_verification' ? 'Awaiting Count' : 'Direct Vault Delta'}
                      </span>
                    </div>

                    <div className="col-span-1 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap ${
                        tx.status === 'pending_verification'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {tx.status === 'pending_verification' ? 'In-Transit' : 'Verified'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Showing {filteredTransactions.length} treasury movements</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">Cryptographically sealed into PostgreSQL Local-First Node</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                <button className="px-2.5 py-1 text-slate-400 font-semibold cursor-default">1</button>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SHARED INTERACTIVE MODALS (ATM, Spend, Deposit, Transfer, etc.)
          ══════════════════════════════════════════════════════════════════════════ */}

      {/* MODAL 1: ATM WITHDRAWAL */}
      {activeModal === 'atm' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">ATM Bank to Cash Box</h3>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">2-Step Verification</span>
                </div>
              </div>
              <button onClick={() => setActiveModal('none')} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleTriggerATM} className="space-y-4">
              <div className="space-y-1 text-center">
                <label className="text-[11px] font-extrabold uppercase text-gray-500">Withdrawal Amount (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="0"
                  value={relocateAmount}
                  onChange={(e) => setRelocateAmount(e.target.value)}
                  className="w-full text-center text-3xl font-black font-mono py-2.5 border-2 border-gray-200 focus:border-indigo-600 rounded-2xl focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Debit from which bank?</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['kishor_bank', 'dad_bank', 'mom_bank'] as const).map((bKey) => (
                    <button
                      key={bKey}
                      type="button"
                      onClick={() => setRelocateSource(bKey)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        relocateSource === bKey ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                      }`}
                    >
                      <div className="text-[10px] font-bold truncate">{WALLET_META[bKey].shortName}</div>
                      <div className="text-xs font-mono font-black mt-0.5">{formatCurrency(balances[bKey] || 0)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessingTransfer || Number(relocateAmount) <= 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isProcessingTransfer ? 'Triggering...' : `Trigger ATM Withdrawal (${formatCurrency(Number(relocateAmount) || 0)})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PERSONAL SPEND / DRAW */}
      {activeModal === 'spend' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Log Personal Spend / Draw</h3>
                  <p className="text-[11px] text-gray-500">Record cash taken for personal expense or rotation</p>
                </div>
              </div>
              <button onClick={() => setActiveModal('none')} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLogSpend} className="space-y-3.5">
              <div className="space-y-1 text-center">
                <label className="text-[11px] font-extrabold uppercase text-gray-500">Spend Amount (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="0"
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                  className="w-full text-center text-3xl font-black font-mono py-2.5 border-2 border-gray-200 focus:border-rose-600 rounded-2xl focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Who is taking the cash?</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['Anbazhakan', 'Parimalam', 'Kishor', 'Other'].map((person) => (
                    <button
                      key={person}
                      type="button"
                      onClick={() => setSpendTakenBy(person)}
                      className={`p-2 rounded-xl text-center text-[11px] font-bold border transition-all cursor-pointer truncate ${
                        spendTakenBy === person ? 'bg-rose-600 text-white border-rose-700 shadow-xs' : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                      }`}
                    >
                      {person}
                    </button>
                  ))}
                </div>
                {spendTakenBy === 'Other' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter name of person..."
                    value={spendCustomTakenBy}
                    onChange={(e) => setSpendCustomTakenBy(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-rose-600 rounded-xl px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none animate-in fade-in"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Category</label>
                  <select
                    value={spendTag}
                    onChange={(e) => setSpendTag(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="Petrol">⛽ Petrol</option>
                    <option value="Groceries">🛒 Groceries</option>
                    <option value="Tea & Refreshments">☕ Tea / Snacks</option>
                    <option value="Personal Expense">💸 Personal Expense</option>
                    <option value="Maintenance">🔧 Maintenance</option>
                    <option value="Emergency Cash">🚨 Emergency</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Deduct From</label>
                  <select
                    value={spendWallet}
                    onChange={(e) => setSpendWallet(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="cash_in_hand">Cash Box ({formatCurrency(balances.cash_in_hand || 0)})</option>
                    <option value="kishor_bank">Kishor Bank ({formatCurrency(balances.kishor_bank || 0)})</option>
                    <option value="dad_bank">Anbazhakan's Bank ({formatCurrency(balances.dad_bank || 0)})</option>
                    <option value="mom_bank">Parimalam's Bank ({formatCurrency(balances.mom_bank || 0)})</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Reason / Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Scooter petrol or vegetables"
                  value={spendDesc}
                  onChange={(e) => setSpendDesc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingSpend || Number(spendAmount) <= 0}
                className="w-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmittingSpend ? 'Logging...' : `Record Spend (${formatCurrency(Number(spendAmount) || 0)})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DEPOSIT FLOAT / INFLOW */}
      {activeModal === 'deposit' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Deposit Money / Float</h3>
                  <p className="text-[11px] text-gray-500">Add emergency funds or capital injection into vault</p>
                </div>
              </div>
              <button onClick={() => setActiveModal('none')} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteDeposit} className="space-y-3.5">
              <div className="space-y-1 text-center">
                <label className="text-[11px] font-extrabold uppercase text-gray-500">Deposit Amount (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full text-center text-3xl font-black font-mono py-2.5 border-2 border-gray-200 focus:border-emerald-600 rounded-2xl focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Deposited By</label>
                  <select
                    value={depositBy}
                    onChange={(e) => setDepositBy(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="Anbazhakan">Anbazhakan</option>
                    <option value="Parimalam">Parimalam</option>
                    <option value="Kishor">Kishor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Destination Vault</label>
                  <select
                    value={depositDest}
                    onChange={(e) => setDepositDest(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="cash_in_hand">Physical Cash Box</option>
                    <option value="kishor_bank">Kishor Bank (UPI)</option>
                    <option value="dad_bank">Dad's Bank</option>
                    <option value="mom_bank">Mom's Bank</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Floating reserve for auction prize pot"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingDeposit || Number(depositAmount) <= 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isProcessingDeposit ? 'Depositing...' : `Deposit ${formatCurrency(Number(depositAmount) || 0)}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: INTER-BANK TRANSFER */}
      {activeModal === 'transfer' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Inter-Vault Transfer</h3>
                  <p className="text-[11px] text-gray-500">Move money from one account to another</p>
                </div>
              </div>
              <button onClick={() => setActiveModal('none')} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-3.5">
              <div className="space-y-1 text-center">
                <label className="text-[11px] font-extrabold uppercase text-gray-500">Transfer Amount (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="0"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full text-center text-3xl font-black font-mono py-2.5 border-2 border-gray-200 focus:border-blue-600 rounded-2xl focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">From Account</label>
                  <select
                    value={transferSource}
                    onChange={(e) => setTransferSource(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="kishor_bank">Kishor Bank</option>
                    <option value="dad_bank">Dad Bank</option>
                    <option value="mom_bank">Mom Bank</option>
                    <option value="cash_in_hand">Cash Box</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">To Account</label>
                  <select
                    value={transferDest}
                    onChange={(e) => setTransferDest(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="cash_in_hand">Cash Box</option>
                    <option value="kishor_bank">Kishor Bank</option>
                    <option value="dad_bank">Dad Bank</option>
                    <option value="mom_bank">Mom Bank</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Bank rebalancing"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingTransfer || Number(transferAmount) <= 0}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isProcessingTransfer ? 'Transferring...' : `Execute Transfer (${formatCurrency(Number(transferAmount) || 0)})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: SETTLE PERSONAL DEBT */}
      {activeModal === 'settle' && settlingDraw && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  <Check size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Settle / Put Cash Back</h3>
                  <p className="text-[11px] text-gray-500">{settlingDraw.takenBy} · {settlingDraw.tag}</p>
                </div>
              </div>
              <button onClick={() => { setSettlingDraw(null); setActiveModal('none'); }} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-3.5">
              <div className="space-y-1 text-center">
                <label className="text-[11px] font-extrabold uppercase text-gray-500">Repayment Amount (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={settlingDraw.amount}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full text-center text-3xl font-black font-mono py-2.5 border-2 border-gray-200 focus:border-teal-600 rounded-2xl focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Put back into which account?</label>
                <select
                  value={settleDestWallet}
                  onChange={(e) => setSettleDestWallet(e.target.value as any)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                >
                  <option value="cash_in_hand">Physical Cash Box</option>
                  <option value="kishor_bank">Kishor Bank (UPI)</option>
                  <option value="dad_bank">Dad's Bank</option>
                  <option value="mom_bank">Mom's Bank</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isProcessingSettle || Number(settleAmount) <= 0}
                className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isProcessingSettle ? 'Settling...' : `Confirm Repayment (${formatCurrency(Number(settleAmount) || 0)})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: DENOMINATIONS / NOTE COUNTER */}
      {activeModal === 'denominations' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg p-4 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Physical Cash Box Note Counter</h3>
                  <p className="text-[11px] text-gray-500">Count 500, 200, 100 notes &amp; check against system cash</p>
                </div>
              </div>
              <button onClick={() => setActiveModal('none')} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {[500, 200, 100, 50, 20, 10].map((note) => (
                <div key={note} className="flex items-center justify-between bg-gray-50 border border-gray-200 p-2.5 rounded-xl gap-2">
                  <span className="w-16 font-black font-mono text-sm text-gray-800">₹{note}</span>
                  <div className="flex items-center gap-2 flex-1 max-w-[120px]">
                    <span className="text-xs font-bold text-gray-400">×</span>
                    <input
                      type="number"
                      min={0}
                      value={denominations[note] || ''}
                      onChange={(e) => setDenominations(prev => ({ ...prev, [note]: parseInt(e.target.value) || 0 }))}
                      className="w-full text-center font-black font-mono bg-white border border-gray-300 rounded-lg py-1 text-sm focus:outline-none"
                    />
                  </div>
                  <span className="w-24 text-right font-black font-mono text-sm text-indigo-700">
                    {formatCurrency((denominations[note] || 0) * note)}
                  </span>
                </div>
              ))}

              <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-2 mt-3">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">Physical Notes Counted:</span>
                  <span className="font-mono text-emerald-400 text-sm font-black">{formatCurrency(calculatedPhysicalCash)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">System Cash in Hand:</span>
                  <span className="font-mono text-white">{formatCurrency(balances.cash_in_hand || 0)}</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs font-black uppercase">Disparity (Difference):</span>
                  <span className={`font-mono text-sm font-black px-2 py-0.5 rounded-md ${
                    cashDisparity === 0 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : cashDisparity > 0 
                      ? 'bg-blue-500/20 text-blue-400' 
                      : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {cashDisparity === 0 ? '✓ Perfect Tally (₹0)' : `${cashDisparity > 0 ? '+' : ''}${formatCurrency(cashDisparity)}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => {
                  triggerHapticFeedback('success');
                  setActiveModal('none');
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer"
              >
                Done Counting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: RECOVER FLOATING CAPITAL */}
      {activeModal === 'recover' && recoveringFloat && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Take Back / Recover Float</h3>
                  <p className="text-[11px] text-gray-500">{recoveringFloat.depositedBy} · {recoveringFloat.tag}</p>
                </div>
              </div>
              <button 
                onClick={() => { setRecoveringFloat(null); setActiveModal('none'); }} 
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmRecoverFloat} className="space-y-3.5">
              <div className="space-y-1 text-center">
                <label className="text-[11px] font-extrabold uppercase text-gray-500">Recovery Amount (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={recoveringFloat.amount}
                  value={recoverAmount}
                  onChange={(e) => setRecoverAmount(e.target.value)}
                  className="w-full text-center text-3xl font-black font-mono py-2.5 border-2 border-gray-200 focus:border-indigo-600 rounded-2xl focus:outline-none"
                  autoFocus
                />
                <span className="text-[10px] text-gray-400 font-medium">
                  Total float available to take back: {formatCurrency(recoveringFloat.amount)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Withdraw money from which account?</label>
                <select
                  value={recoverSourceWallet}
                  onChange={(e) => setRecoverSourceWallet(e.target.value as any)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 focus:outline-none"
                >
                  <option value="cash_in_hand">Physical Cash Box ({formatCurrency(balances.cash_in_hand || 0)})</option>
                  <option value="kishor_bank">Kishor Bank (UPI) ({formatCurrency(balances.kishor_bank || 0)})</option>
                  <option value="dad_bank">Dad's Bank ({formatCurrency(balances.dad_bank || 0)})</option>
                  <option value="mom_bank">Mom's Bank ({formatCurrency(balances.mom_bank || 0)})</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isProcessingRecover || Number(recoverAmount) <= 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isProcessingRecover ? 'Recovering...' : `Confirm Float Recovery (${formatCurrency(Number(recoverAmount) || 0)})`}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
