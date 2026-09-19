'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWallet, WalletType } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase/client';
import { 
  Wallet, 
  Landmark, 
  Coins, 
  Plus, 
  Trash2,
  Banknote,
  Check,
  AlertCircle, 
  Mic, 
  History, 
  Activity, 
  Calculator, 
  CreditCard, 
  Search, 
  ChevronRight, 
  RefreshCw, 
  ArrowRightLeft, 
  PieChart,
  User,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  X,
  Layers,
  ShieldCheck,
  HandCoins,
  RotateCcw
} from 'lucide-react';

export type CashHandlingSubtab = 
  | 'overview' 
  | 'wallets' 
  | 'transfers' 
  | 'spends' 
  | 'denominations' 
  | 'ledger';

interface SubtabConfig {
  id: CashHandlingSubtab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const CASH_SUBTABS: SubtabConfig[] = [
  { id: 'overview', label: 'Overview', icon: PieChart, description: 'High-level treasury summary, vault allocations & quick actions' },
  { id: 'wallets', label: 'Wallets (GPay)', icon: CreditCard, description: 'Dedicated GPay-style statement cards for each account' },
  { id: 'transfers', label: 'Move Money', icon: ArrowRightLeft, description: 'Inter-vault transfers, ATM cash withdrawals & deposits' },
  { id: 'spends', label: 'Personal Draws', icon: Coins, description: 'Personal expense logger, petrol/maintenance & category budgets' },
  { id: 'denominations', label: 'Denominations', icon: Calculator, description: 'Physical cash box note counter & reconciliation disparity check' },
  { id: 'ledger', label: 'Audit Ledger', icon: History, description: 'Complete transaction timeline & printable treasury statement' },
];

interface Relocation {
  id: string;
  source: Exclude<WalletType, 'cash_in_hand'>;
  amount: number;
  status: 'pending_verification' | 'completed';
  createdAt: string;
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

interface TreasuryTx {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  wallet_type: WalletType;
  notes?: string;
  description?: string;
  group_id?: string;
  profile_id?: string;
  group_member_id?: string;
}

export default function CashVaultLedger() {
  const { balances, updateBalance, loading: walletLoading } = useWallet();
  const { profile } = useAuth();
  const activeAdminName = profile?.fullName || 'Admin';

  const [activeSubtab, setActiveSubtab] = useState<CashHandlingSubtab>('overview');
  const [selectedWalletDetail, setSelectedWalletDetail] = useState<WalletType>('cash_in_hand');

  // Supabase Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [recentTransactions, setRecentTransactions] = useState<TreasuryTx[]>([]);

  // Operational State
  const [relocations, setRelocations] = useState<Relocation[]>([]);
  const [personalDraws, setPersonalDraws] = useState<PersonalDraw[]>([]);

  // Form State: External Cash Deposit / Float Inflow
  const [depositDest, setDepositDest] = useState<WalletType>('cash_in_hand');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositBy, setDepositBy] = useState<string>('Dad (Anbazhakan)');
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

  // Form State: Personal Draw
  const [spendAmount, setSpendAmount] = useState<string>('');
  const [spendTag, setSpendTag] = useState<PersonalDraw['tag']>('Personal Expense');
  const [spendDesc, setSpendDesc] = useState<string>('');
  const [spendWallet, setSpendWallet] = useState<WalletType>('cash_in_hand');
  const [spendTakenBy, setSpendTakenBy] = useState<string>('Dad (Anbazhakan)');
  const [spendCustomTakenBy, setSpendCustomTakenBy] = useState<string>('');
  const [isSubmittingSpend, setIsSubmittingSpend] = useState<boolean>(false);

  // Simple Settlement State (Put Cash Back)
  const [settlingDraw, setSettlingDraw] = useState<PersonalDraw | null>(null);
  const [settleDestWallet, setSettleDestWallet] = useState<WalletType>('cash_in_hand');
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [isProcessingSettle, setIsProcessingSettle] = useState<boolean>(false);

  // Floating Capital Recovery State (Choose payout vault freely)
  const [recoveringFloat, setRecoveringFloat] = useState<FloatingDeposit | null>(null);
  const [recoverSourceWallet, setRecoverSourceWallet] = useState<WalletType>('cash_in_hand');
  const [recoverAmount, setRecoverAmount] = useState<string>('');
  const [isProcessingRecover, setIsProcessingRecover] = useState<boolean>(false);

  // Personal Draws Filter & Search
  const [personalDrawStatusFilter, setPersonalDrawStatusFilter] = useState<'all' | 'outstanding' | 'settled'>('all');
  const [personalDrawPersonFilter, setPersonalDrawPersonFilter] = useState<string>('all');
  const [personalDrawSearch, setPersonalDrawSearch] = useState<string>('');

  // Denomination Counter State
  const [denominations, setDenominations] = useState<{ [key: number]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
  });
  const [lastReconciliationNote, setLastReconciliationNote] = useState<string | null>(null);

  // Ledger Filter State
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerWalletFilter, setLedgerWalletFilter] = useState<string>('all');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('all');

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch treasury transactions
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
  }, []);

  // Format INR Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Wallet Metadata (Names, Roles, Colors)
  const WALLET_META: Record<WalletType, {
    name: string;
    owner: string;
    accountNumber: string;
    typeLabel: string;
    bgGradient: string;
    borderClass: string;
    textAccent: string;
    dotColor: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }> = {
    cash_in_hand: {
      name: 'Physical Cash Box',
      owner: 'On-Premises Locker',
      accountNumber: 'Vault #01',
      typeLabel: 'Cash Vault · Physical Liquidity',
      bgGradient: 'from-emerald-900 via-teal-900 to-slate-950',
      borderClass: 'border-emerald-500/30',
      textAccent: 'text-emerald-400',
      dotColor: 'bg-emerald-400',
      icon: Banknote,
    },
    kishor_bank: {
      name: 'Kishor Bank',
      owner: 'Dr. Kishor Anbazhakan',
      accountNumber: '•••• 8492 · UPI / NetBanking',
      typeLabel: 'Digital Vault · Primary Inflow',
      bgGradient: 'from-blue-900 via-indigo-950 to-slate-950',
      borderClass: 'border-blue-500/30',
      textAccent: 'text-blue-400',
      dotColor: 'bg-blue-400',
      icon: Landmark,
    },
    dad_bank: {
      name: 'Anbazhakan Bank',
      owner: 'Anbazhakan (Dad)',
      accountNumber: '•••• 3108 · Primary Banking',
      typeLabel: 'Disbursement Vault · Primary Channel',
      bgGradient: 'from-purple-950 via-slate-900 to-slate-950',
      borderClass: 'border-purple-500/30',
      textAccent: 'text-purple-400',
      dotColor: 'bg-purple-400',
      icon: CreditCard,
    },
    mom_bank: {
      name: 'Parimalam Bank',
      owner: 'Parimalam (Mom)',
      accountNumber: '•••• 5521 · Reserve Channel',
      typeLabel: 'Reserve Vault · Secondary Channel',
      bgGradient: 'from-amber-950 via-stone-900 to-slate-950',
      borderClass: 'border-amber-500/30',
      textAccent: 'text-amber-400',
      dotColor: 'bg-amber-400',
      icon: Wallet,
    },
  };

  // Liquidity Analytics
  const totalTreasuryBalance = useMemo(() => {
    return (balances.cash_in_hand || 0) + (balances.kishor_bank || 0) + (balances.dad_bank || 0) + (balances.mom_bank || 0);
  }, [balances]);

  const physicalCashPercent = totalTreasuryBalance > 0 
    ? Math.round(((balances.cash_in_hand || 0) / totalTreasuryBalance) * 100) 
    : 0;

  const digitalBanksPercent = 100 - physicalCashPercent;

  // Filtered transactions for active wallet in Subtab 2 (GPay Wallet Page)
  const walletSpecificTxs = useMemo(() => {
    return recentTransactions.filter(t => t.wallet_type === selectedWalletDetail);
  }, [recentTransactions, selectedWalletDetail]);

  // Helper to accurately classify if a treasury movement is an Inflow/Credit (+) or Outflow/Debit (-)
  const getTxDirection = (tx: TreasuryTx, perspectiveWallet?: WalletType): { isCredit: boolean; badgeLabel: string; badgeColor: string } => {
    const type = tx.type;
    const notes = (tx.notes || tx.description || '').toLowerCase();
    const targetWallet = perspectiveWallet || tx.wallet_type;

    // 1. Collections are ALWAYS Inflow/Credit
    if (type === 'collection') {
      return { isCredit: true, badgeLabel: 'COLLECTION (+)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }

    // 2. Payouts
    if (type === 'payout') {
      return { isCredit: false, badgeLabel: 'PRIZE PAYOUT (-)', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' };
    }

    // 3. Personal Draws
    if (type === 'personal_draw') {
      return { isCredit: false, badgeLabel: 'PERSONAL DRAW (-)', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' };
    }

    // 4. External Deposits / Floating Capital Injections
    if (notes.includes('[floating deposit') || notes.includes('deposit into') || notes.includes('reserve cash deposit') || notes.includes('external cash deposit') || notes.includes('deposited by')) {
      return { isCredit: true, badgeLabel: 'FLOAT DEPOSIT (+)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }

    // 5. Float Recoveries
    if (notes.includes('float recovery') || notes.includes('recovered (withdrawn')) {
      return { isCredit: false, badgeLabel: 'FLOAT RECOVERY (-)', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }

    // 6. Personal Draw Repayments / Put Cash Back
    if (notes.includes('repaid by') || notes.includes('put cash back') || notes.includes('put back')) {
      return { isCredit: true, badgeLabel: 'DRAW REPAYMENT (+)', badgeColor: 'bg-teal-50 text-teal-700 border-teal-200' };
    }

    // 7. ATM Relocations
    if (type === 'atm_withdrawal') {
      if (tx.wallet_type === 'cash_in_hand' || notes.includes('into cash box') || notes.includes('into physical cash box')) {
        return { isCredit: true, badgeLabel: 'ATM INFLOW (+)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
      return { isCredit: false, badgeLabel: 'ATM DEBIT (-)', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' };
    }

    // 8. Inter-Vault Transfers
    if (type === 'transfer') {
      const walletName = (WALLET_META[targetWallet]?.name || targetWallet).toLowerCase();
      
      // Check destination
      if (notes.includes(`-> ${walletName}`) || notes.includes(`to ${walletName}`) || notes.includes(`into ${walletName}`) || notes.includes(`into ${targetWallet}`) || notes.includes(`to ${targetWallet}`)) {
        return { isCredit: true, badgeLabel: 'TRANSFER IN (+)', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' };
      }
      // Check source
      if (notes.includes(`${walletName} ->`) || notes.includes(`from ${walletName}`) || notes.includes(`from ${targetWallet}`)) {
        return { isCredit: false, badgeLabel: 'TRANSFER OUT (-)', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' };
      }

      if (notes.includes('into') || notes.includes('deposit') || notes.includes('credit')) {
        return { isCredit: true, badgeLabel: 'INFLOW (+)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
    }

    return { isCredit: false, badgeLabel: 'OUTFLOW (-)', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const walletStats = useMemo(() => {
    const txs = walletSpecificTxs;
    const totalInflow = txs
      .filter(t => getTxDirection(t, selectedWalletDetail).isCredit)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalOutflow = txs
      .filter(t => !getTxDirection(t, selectedWalletDetail).isCredit)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const netFlow = totalInflow - totalOutflow;

    return {
      totalInflow,
      totalOutflow,
      netFlow,
      count: txs.length,
    };
  }, [walletSpecificTxs, selectedWalletDetail]);

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

  // Filtered master ledger
  const filteredMasterLedger = useMemo(() => {
    return recentTransactions.filter((tx) => {
      const matchesWallet = ledgerWalletFilter === 'all' || tx.wallet_type === ledgerWalletFilter;
      const matchesType = ledgerTypeFilter === 'all' || tx.type === ledgerTypeFilter;
      const q = ledgerSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        (tx.description && tx.description.toLowerCase().includes(q)) ||
        String(tx.amount).includes(q) ||
        tx.type.toLowerCase().includes(q);

      return matchesWallet && matchesType && matchesSearch;
    });
  }, [recentTransactions, ledgerWalletFilter, ledgerTypeFilter, ledgerSearch]);

  // Computed Personal Draws from Supabase transactions ledger
  const computedPersonalDraws = useMemo<PersonalDraw[]>(() => {
    return recentTransactions
      .filter((t) => t.type === 'personal_draw')
      .map((tx) => {
        const notes = tx.notes || '';
        
        // Extract Tag
        let tag: PersonalDraw['tag'] = 'Personal Expense';
        const tagMatch = notes.match(/^\[(.*?)\]/);
        if (tagMatch) {
          const rawTag = tagMatch[1];
          if (['Personal Expense', 'Money Lending / Rotation', 'Petrol', 'Maintenance', 'Groceries', 'Collection Visits', 'Tea & Refreshments', 'Emergency Cash'].includes(rawTag)) {
            tag = rawTag as PersonalDraw['tag'];
          }
        }

        // Extract Taken By
        let takenBy = 'Dad (Anbazhakan)';
        const takenByMatch = notes.match(/Taken By:\s*([^|]+)/i);
        if (takenByMatch) {
          takenBy = takenByMatch[1].trim();
        }

        // Extract Status & Settlement metadata
        let status: 'outstanding' | 'settled' = 'outstanding';
        let settlementDetails: PersonalDraw['settlementDetails'] = undefined;
        
        if (notes.toLowerCase().includes('status: settled') || notes.toLowerCase().includes('status: repaid')) {
          status = 'settled';
          const settledMatch = notes.match(/Status:\s*Settled\s*\(([^)]+)\)/i);
          const detailStr = settledMatch ? settledMatch[1] : 'Settled';
          const isVaultRepay = detailStr.toLowerCase().includes('repaid') || detailStr.toLowerCase().includes('cash box') || detailStr.toLowerCase().includes('bank');
          settlementDetails = {
            settledAt: new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            settlementMode: isVaultRepay ? 'vault_repay' : 'member_offset',
            notes: detailStr
          };
        }

        // Clean Description
        const desc = notes
          .replace(/^\[.*?\]\s*/, '')
          .replace(/\|\s*Taken By:[^|]+/i, '')
          .replace(/\|\s*Status:[^|]+/i, '')
          .trim() || `${tag} draw`;

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
          settlementDetails
        };
      });
  }, [recentTransactions]);

  // Outstanding Debt Summary per person
  const personalDrawStats = useMemo(() => {
    const outstanding = computedPersonalDraws.filter(d => d.status === 'outstanding');
    const totalOutstanding = outstanding.reduce((sum, d) => sum + d.amount, 0);

    const dadOutstanding = outstanding
      .filter(d => d.takenBy.toLowerCase().includes('dad') || d.takenBy.toLowerCase().includes('anbazhakan'))
      .reduce((sum, d) => sum + d.amount, 0);

    const momOutstanding = outstanding
      .filter(d => d.takenBy.toLowerCase().includes('mom') || d.takenBy.toLowerCase().includes('parimalam'))
      .reduce((sum, d) => sum + d.amount, 0);

    const kishorOutstanding = outstanding
      .filter(d => d.takenBy.toLowerCase().includes('kishor'))
      .reduce((sum, d) => sum + d.amount, 0);

    const othersOutstanding = outstanding
      .filter(d => !d.takenBy.toLowerCase().includes('dad') && !d.takenBy.toLowerCase().includes('anbazhakan') && !d.takenBy.toLowerCase().includes('mom') && !d.takenBy.toLowerCase().includes('parimalam') && !d.takenBy.toLowerCase().includes('kishor'))
      .reduce((sum, d) => sum + d.amount, 0);

    const totalSettled = computedPersonalDraws.filter(d => d.status === 'settled').reduce((sum, d) => sum + d.amount, 0);

    return {
      totalOutstanding,
      dadOutstanding,
      momOutstanding,
      kishorOutstanding,
      othersOutstanding,
      totalSettled,
      outstandingCount: outstanding.length,
      settledCount: computedPersonalDraws.length - outstanding.length,
    };
  }, [computedPersonalDraws]);

  // Filtered personal draws for UI
  const filteredPersonalDraws = useMemo(() => {
    return computedPersonalDraws.filter((draw) => {
      if (personalDrawStatusFilter !== 'all' && draw.status !== personalDrawStatusFilter) return false;
      if (personalDrawPersonFilter === 'dad' && !(draw.takenBy.toLowerCase().includes('dad') || draw.takenBy.toLowerCase().includes('anbazhakan'))) return false;
      if (personalDrawPersonFilter === 'mom' && !(draw.takenBy.toLowerCase().includes('mom') || draw.takenBy.toLowerCase().includes('parimalam'))) return false;
      if (personalDrawPersonFilter === 'kishor' && !draw.takenBy.toLowerCase().includes('kishor')) return false;
      if (personalDrawPersonFilter === 'other' && (draw.takenBy.toLowerCase().includes('dad') || draw.takenBy.toLowerCase().includes('anbazhakan') || draw.takenBy.toLowerCase().includes('mom') || draw.takenBy.toLowerCase().includes('parimalam') || draw.takenBy.toLowerCase().includes('kishor'))) return false;

      const q = personalDrawSearch.toLowerCase().trim();
      if (q) {
        return (
          draw.description.toLowerCase().includes(q) ||
          draw.takenBy.toLowerCase().includes(q) ||
          draw.tag.toLowerCase().includes(q) ||
          String(draw.amount).includes(q)
        );
      }
      return true;
    });
  }, [computedPersonalDraws, personalDrawStatusFilter, personalDrawPersonFilter, personalDrawSearch]);

  // Computed Floating Deposits from Supabase transactions ledger
  const computedFloatingDeposits = useMemo<FloatingDeposit[]>(() => {
    return recentTransactions
      .filter((t) => t.notes && t.notes.includes('[Floating Deposit'))
      .map((tx) => {
        const notes = tx.notes || '';
        
        let depositedBy = 'Dad (Anbazhakan)';
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

  // Floating Capital Stats (Active Floating Deposits per person)
  const floatStats = useMemo(() => {
    const active = computedFloatingDeposits.filter(f => f.status === 'active');
    const totalActiveFloat = active.reduce((sum, f) => sum + f.amount, 0);

    const dadFloat = active
      .filter(f => f.depositedBy.toLowerCase().includes('dad') || f.depositedBy.toLowerCase().includes('anbazhakan'))
      .reduce((sum, f) => sum + f.amount, 0);

    const momFloat = active
      .filter(f => f.depositedBy.toLowerCase().includes('mom') || f.depositedBy.toLowerCase().includes('parimalam'))
      .reduce((sum, f) => sum + f.amount, 0);

    const kishorFloat = active
      .filter(f => f.depositedBy.toLowerCase().includes('kishor'))
      .reduce((sum, f) => sum + f.amount, 0);

    return {
      totalActiveFloat,
      dadFloat,
      momFloat,
      kishorFloat,
      activeCount: active.length,
    };
  }, [computedFloatingDeposits]);

  // Action: External Deposit / Float Injection
  const handleExecuteDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(depositAmount);

    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }

    const effectiveDepositor = depositBy === 'Other' 
      ? (depositCustomBy.trim() || 'Other') 
      : depositBy;

    setIsProcessingDeposit(true);
    try {
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
      await fetchData();
      alert(`✓ Successfully deposited ${formatCurrency(amount)} into ${WALLET_META[depositDest].name} by ${effectiveDepositor}! (Floating capital active: ${formatCurrency(amount)})`);
    } catch (err: any) {
      console.error('Error depositing funds:', err);
      alert('Error depositing funds: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingDeposit(false);
    }
  };

  // Action: Open Float Recovery Modal (Choose payout account freely)
  const handleOpenRecoverModal = (float: FloatingDeposit) => {
    setRecoveringFloat(float);
    setRecoverAmount(String(float.amount));
    // Default to original wallet if it has sufficient funds; otherwise choose the wallet with the largest balance
    if (balances[float.walletType] >= float.amount) {
      setRecoverSourceWallet(float.walletType);
    } else if (balances.cash_in_hand >= float.amount) {
      setRecoverSourceWallet('cash_in_hand');
    } else {
      const sorted = (['cash_in_hand', 'kishor_bank', 'dad_bank', 'mom_bank'] as WalletType[])
        .sort((a, b) => (balances[b] || 0) - (balances[a] || 0));
      setRecoverSourceWallet(sorted[0]);
    }
  };

  // Action: Confirm Float Recovery from Selected Vault
  const handleConfirmRecoverFloat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveringFloat) return;

    const amount = Number(recoverAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid recovery amount.");
      return;
    }

    if (amount > recoveringFloat.amount) {
      alert(`Recovery amount cannot exceed the floating deposit amount of ${formatCurrency(recoveringFloat.amount)}.`);
      return;
    }

    if (balances[recoverSourceWallet] < amount) {
      alert(`Insufficient balance in ${WALLET_META[recoverSourceWallet].name} to pay out ${formatCurrency(amount)}. Available: ${formatCurrency(balances[recoverSourceWallet])}`);
      return;
    }

    setIsProcessingRecover(true);
    try {
      // 1. Deduct from selected payout account
      await updateBalance(recoverSourceWallet, -amount);

      // 2. Insert withdrawal transaction
      await supabase.from('transactions').insert([
        {
          wallet_type: recoverSourceWallet,
          type: 'transfer',
          status: 'completed',
          amount: amount,
          notes: `Float Recovery of ${formatCurrency(amount)} by ${recoveringFloat.depositedBy} paid from ${WALLET_META[recoverSourceWallet].name} (Original Inflow: ${WALLET_META[recoveringFloat.walletType].name})`,
          created_by: profile?.id || null,
        }
      ]);

      // 3. Update original floating deposit note
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const isFull = amount >= recoveringFloat.amount;
      const updatedNotes = isFull
        ? `[Floating Deposit - ${recoveringFloat.tag}] ${recoveringFloat.notes} | Deposited By: ${recoveringFloat.depositedBy} | Status: Recovered (Withdrawn ${formatCurrency(amount)} from ${WALLET_META[recoverSourceWallet].name} on ${dateStr})`
        : `[Floating Deposit - ${recoveringFloat.tag}] ${recoveringFloat.notes} | Deposited By: ${recoveringFloat.depositedBy} | Status: Partially Recovered (Withdrawn ${formatCurrency(amount)} from ${WALLET_META[recoverSourceWallet].name} on ${dateStr}, Remaining Float: ${formatCurrency(recoveringFloat.amount - amount)})`;

      await supabase
        .from('transactions')
        .update({ notes: updatedNotes })
        .eq('id', recoveringFloat.id);

      setRecoveringFloat(null);
      await fetchData();
      alert(`✓ Successfully recovered ${formatCurrency(amount)} back for ${recoveringFloat.depositedBy} from ${WALLET_META[recoverSourceWallet].name}!`);
    } catch (err: any) {
      console.error('Error recovering float:', err);
      alert('Error recovering float: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingRecover(false);
    }
  };

  // Action: Inter-Vault Transfer
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

    setIsProcessingTransfer(true);
    try {
      // 1. Debit Source & Credit Dest
      await updateBalance(transferSource, -amount);
      await updateBalance(transferDest, amount);

      // 2. Record transaction ledger in Supabase
      const notes = transferNotes.trim() 
        ? `Transfer: ${transferNotes.trim()} (${WALLET_META[transferSource].name} -> ${WALLET_META[transferDest].name})`
        : `Inter-Vault Transfer from ${WALLET_META[transferSource].name} to ${WALLET_META[transferDest].name}`;

      await supabase.from('transactions').insert([
        {
          wallet_type: transferSource,
          type: 'transfer',
          status: 'completed',
          amount: amount,
          notes: notes,
          created_by: profile?.id || null,
        },
        {
          wallet_type: transferDest,
          type: 'transfer',
          status: 'completed',
          amount: amount,
          notes: notes,
          created_by: profile?.id || null,
        }
      ]);

      setTransferAmount('');
      setTransferNotes('');
      await fetchData();
      alert(`Successfully transferred ${formatCurrency(amount)} from ${WALLET_META[transferSource].name} to ${WALLET_META[transferDest].name}!`);
    } catch (err) {
      console.error('Error executing transfer:', err);
      alert('Failed to complete transfer. Please try again.');
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  // Action: ATM 2-Step Relocation Trigger
  const handleTriggerATMRelocation = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(relocateAmount);

    if (isNaN(amount) || amount <= 0 || balances[relocateSource] < amount) {
      alert(`Insufficient bank balance in ${WALLET_META[relocateSource].name}.`);
      return;
    }

    updateBalance(relocateSource, -amount);

    const newReloc: Relocation = {
      id: Math.random().toString(),
      source: relocateSource,
      amount,
      status: 'pending_verification',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setRelocations([newReloc, ...relocations]);
    setRelocateAmount('');
  };

  // Action: ATM 2-Step Verify & Inflow to Cash Box
  const handleVerifyATMRelocation = async (id: string, amount: number, source: WalletType) => {
    setRelocations(prev => prev.filter(r => r.id !== id));
    await updateBalance('cash_in_hand', amount);

    await supabase.from('transactions').insert([
      {
        wallet_type: 'cash_in_hand',
        type: 'atm_withdrawal',
        status: 'completed',
        amount: amount,
        notes: `ATM Cash Withdrawal verified from ${WALLET_META[source as WalletType].name} into Cash Box`,
        created_by: profile?.id || null,
      }
    ]);

    await fetchData();
    alert(`Verified & Credited ${formatCurrency(amount)} into Physical Cash Box!`);
  };

  // Action: Personal Draw Logger
  const handleLogPersonalDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(spendAmount);

    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid expense amount.");
      return;
    }
    if (balances[spendWallet] < amount) {
      alert(`Insufficient balance in ${WALLET_META[spendWallet].name}. Available: ${formatCurrency(balances[spendWallet])}`);
      return;
    }

    const effectiveTakenBy = spendTakenBy === 'Other' 
      ? (spendCustomTakenBy.trim() || 'Other') 
      : spendTakenBy;

    setIsSubmittingSpend(true);
    try {
      await updateBalance(spendWallet, -amount);

      const desc = spendDesc.trim() || `${spendTag} taken by ${effectiveTakenBy}`;
      const fullNote = `[${spendTag}] ${desc} | Taken By: ${effectiveTakenBy} | Status: Outstanding`;

      await supabase.from('transactions').insert([
        {
          wallet_type: spendWallet,
          type: 'personal_draw',
          status: 'completed',
          amount: amount,
          notes: fullNote,
          created_by: profile?.id || null,
        }
      ]);

      setSpendAmount('');
      setSpendDesc('');
      if (spendTakenBy === 'Other') setSpendCustomTakenBy('');
      await fetchData();
      alert(`✓ Successfully recorded ₹${amount.toLocaleString('en-IN')} personal draw for ${effectiveTakenBy}.`);
    } catch (err: any) {
      console.error('Error recording personal draw:', err);
      alert('Error recording personal draw: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingSpend(false);
    }
  };

  // Action: Open Settlement Modal
  const handleOpenSettleModal = (draw: PersonalDraw) => {
    setSettlingDraw(draw);
    setSettleDestWallet(draw.walletType);
    setSettleAmount(draw.amount.toString());
  };

  // Action: Confirm Settlement & Put Cash Back
  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingDraw) return;

    const repayAmt = Number(settleAmount);
    if (isNaN(repayAmt) || repayAmt <= 0) {
      alert("Please enter a valid amount to put back.");
      return;
    }

    if (repayAmt > settlingDraw.amount) {
      alert(`The amount to put back (${formatCurrency(repayAmt)}) cannot exceed the draw amount of ${formatCurrency(settlingDraw.amount)}. If you wish to deposit additional cash into the treasury, please use the Move Money / Deposit tab.`);
      return;
    }

    setIsProcessingSettle(true);
    try {
      // Put cash / money back into the selected vault
      await updateBalance(settleDestWallet, repayAmt);

      // Record a transaction for the vault deposit
      await supabase.from('transactions').insert([
        {
          wallet_type: settleDestWallet,
          type: 'transfer',
          status: 'completed',
          amount: repayAmt,
          notes: `Personal Draw Repaid by ${settlingDraw.takenBy} into ${WALLET_META[settleDestWallet].name}`,
          created_by: profile?.id || null,
        }
      ]);

      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      if (repayAmt < settlingDraw.amount) {
        // Partial settlement: reduce draw amount and keep outstanding
        const remainingAmt = settlingDraw.amount - repayAmt;
        const updatedNotes = `[${settlingDraw.tag}] ${settlingDraw.description} | Taken By: ${settlingDraw.takenBy} | Status: Outstanding (Partial repayment of ${formatCurrency(repayAmt)} made on ${dateStr}; Remaining: ${formatCurrency(remainingAmt)})`;

        await supabase
          .from('transactions')
          .update({ 
            amount: remainingAmt,
            notes: updatedNotes 
          })
          .eq('id', settlingDraw.id);

        alert(`✓ Put ${formatCurrency(repayAmt)} back into ${WALLET_META[settleDestWallet].name}! Remaining balance owed: ${formatCurrency(remainingAmt)}.`);
      } else {
        // Full settlement: mark as settled
        const updatedNotes = `[${settlingDraw.tag}] ${settlingDraw.description} | Taken By: ${settlingDraw.takenBy} | Status: Settled (Put back ${formatCurrency(repayAmt)} into ${WALLET_META[settleDestWallet].name} on ${dateStr})`;
        
        await supabase
          .from('transactions')
          .update({ notes: updatedNotes })
          .eq('id', settlingDraw.id);

        alert(`✓ Successfully put ${formatCurrency(repayAmt)} back into ${WALLET_META[settleDestWallet].name}! Draw is fully settled.`);
      }

      setSettlingDraw(null);
      await fetchData();
    } catch (err: any) {
      console.error('Error settling personal draw:', err);
      alert('Error settling personal draw: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingSettle(false);
    }
  };

  // Action: Delete Spend Record
  const handleDeletePersonalDraw = async (draw: PersonalDraw) => {
    const isSettled = draw.status === 'settled';

    if (isSettled) {
      // Draw was ALREADY settled (funds were already put back into the vault).
      // Deleting this record must NOT refund or alter vault balance!
      if (!confirm(`Are you sure you want to delete this settled draw record (${formatCurrency(draw.amount)} by ${draw.takenBy}) from history?\n\n(Note: Vault balance will NOT change because the funds were already put back when settled).`)) {
        return;
      }

      try {
        await supabase.from('transactions').delete().eq('id', draw.id);
        await fetchData();
        alert(`✓ Removed settled draw record from history.`);
      } catch (err: any) {
        console.error('Error deleting personal draw record:', err);
        alert('Error deleting personal draw record: ' + (err.message || 'Unknown error'));
      }
    } else {
      // Draw is OUTSTANDING. Canceling/deleting it refunds the money back to the vault.
      if (!confirm(`Are you sure you want to cancel this active draw and refund ${formatCurrency(draw.amount)} back to ${WALLET_META[draw.walletType].name}?`)) {
        return;
      }

      try {
        await updateBalance(draw.walletType, draw.amount);
        await supabase.from('transactions').delete().eq('id', draw.id);
        await fetchData();
        alert(`✓ Refunded ${formatCurrency(draw.amount)} back to ${WALLET_META[draw.walletType].name} and removed draw record.`);
      } catch (err: any) {
        console.error('Error deleting personal draw:', err);
        alert('Error deleting personal draw: ' + (err.message || 'Unknown error'));
      }
    }
  };

  // Action: Save Denomination Count
  const handleSaveDenominations = async () => {
    const note = `Denomination reconciliation by ${activeAdminName}: Counted ${formatCurrency(calculatedPhysicalCash)} vs System ${formatCurrency(balances.cash_in_hand || 0)} (Disparity: ${formatCurrency(cashDisparity)})`;

    setLastReconciliationNote(note);

    await supabase.from('transactions').insert([
      {
        wallet_type: 'cash_in_hand',
        type: 'transfer',
        status: 'completed',
        amount: Math.max(1, calculatedPhysicalCash),
        notes: note,
        denomination_log: denominations,
        created_by: profile?.id || null,
      }
    ]);

    await fetchData();
    alert(`Denomination count recorded successfully! Disparity: ${formatCurrency(cashDisparity)}`);
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* ── 1. TOP SUBTAB NAVIGATION ── */}
      <div className="bg-slate-100/80 border border-gray-200/80 rounded-3xl p-2 sm:p-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          {CASH_SUBTABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubtab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubtab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs shrink-0 transition-all duration-150 active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-white/60'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-emerald-400' : 'text-gray-400'} />
                <span className="leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SUBTAB 1: OVERVIEW & VAULTS ── */}
      {activeSubtab === 'overview' && (
        <div className="space-y-6">
          
          {/* Top Liquidity Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white rounded-3xl p-5 sm:p-7 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity size={14} className="text-emerald-400" /> Total Treasury Liquidity
                </span>
                <span className="text-3xl sm:text-4xl font-black block font-mono text-white tracking-tight mt-1">
                  {formatCurrency(totalTreasuryBalance)}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> 4 Vaults Synchronized
              </span>
            </div>

            {/* Split Progress Track */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Physical Cash: <strong className="text-emerald-400">{formatCurrency(balances.cash_in_hand)}</strong> ({physicalCashPercent}%)</span>
                <span>Digital Banks: <strong className="text-blue-400">{formatCurrency(totalTreasuryBalance - balances.cash_in_hand)}</strong> ({digitalBanksPercent}%)</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${physicalCashPercent}%` }} />
                <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${digitalBanksPercent}%` }} />
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <button
                onClick={() => setActiveSubtab('transfers')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <ArrowRightLeft size={14} className="text-emerald-400" /> Move Money
              </button>
              <button
                onClick={() => setActiveSubtab('spends')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Coins size={14} className="text-rose-400" /> Log Spend
              </button>
              <button
                onClick={() => setActiveSubtab('denominations')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Calculator size={14} className="text-amber-400" /> Count Cash
              </button>
              <button
                onClick={() => setActiveSubtab('ledger')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <History size={14} className="text-blue-400" /> View Ledger
              </button>
            </div>
          </div>

          {/* 4 Dedicated GPay-Style Vault Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {(['cash_in_hand', 'kishor_bank', 'dad_bank', 'mom_bank'] as WalletType[]).map((wKey) => {
              const meta = WALLET_META[wKey];
              const Icon = meta.icon;
              const bal = balances[wKey] || 0;

              return (
                <div
                  key={wKey}
                  onClick={() => {
                    setSelectedWalletDetail(wKey);
                    setActiveSubtab('wallets');
                  }}
                  className={`bg-gradient-to-br ${meta.bgGradient} text-white p-5 rounded-3xl border ${meta.borderClass} shadow-lg hover:shadow-2xl transition-all duration-200 cursor-pointer group space-y-4 hover:-translate-y-1 relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
                      <Icon size={20} className={meta.textAccent} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-xs flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} /> Live
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 font-semibold block">{meta.name}</span>
                    <span className="text-2xl font-black font-mono block mt-0.5 text-white tracking-tight">
                      {formatCurrency(bal)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono mt-1 block truncate">
                      {meta.accountNumber}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                    <span>View Dedicated Statement</span>
                    <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Recent Activity Stream */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <History size={16} className="text-indigo-600" />
                Live Treasury Audit Activity
              </h3>
              <button
                onClick={() => setActiveSubtab('ledger')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                View Complete Ledger →
              </button>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {recentTransactions.slice(0, 8).map((tx) => {
                const { isCredit, badgeLabel, badgeColor } = getTxDirection(tx);
                const dateLabel = tx.created_at 
                  ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Recent';

                return (
                  <div key={tx.id} className="p-3.5 bg-gray-50/80 border border-gray-100 rounded-2xl flex items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{dateLabel}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {tx.notes || tx.description || 'Treasury Movement'}
                      </p>
                      <span className="text-[10px] text-gray-500 font-medium block">
                        Account: <strong className="text-gray-700">{WALLET_META[tx.wallet_type]?.name || tx.wallet_type}</strong>
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-xs sm:text-sm font-black font-mono block ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ── SUBTAB 2: DEDICATED GPAY-STYLE WALLET PAGES ── */}
      {activeSubtab === 'wallets' && (
        <div className="space-y-6">
          
          {/* Wallet Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {(['cash_in_hand', 'kishor_bank', 'dad_bank', 'mom_bank'] as WalletType[]).map((wKey) => {
              const meta = WALLET_META[wKey];
              const isSelected = selectedWalletDetail === wKey;

              return (
                <button
                  key={wKey}
                  onClick={() => setSelectedWalletDetail(wKey)}
                  className={`px-4 py-2.5 rounded-2xl font-bold text-xs shrink-0 transition-all flex items-center gap-2 shadow-2xs cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
                  <span>{meta.name}</span>
                </button>
              );
            })}
          </div>

          {/* GPay Hero Card */}
          {(() => {
            const meta = WALLET_META[selectedWalletDetail];
            const Icon = meta.icon;
            const bal = balances[selectedWalletDetail] || 0;

            return (
              <div className={`bg-gradient-to-br ${meta.bgGradient} text-white rounded-3xl p-6 sm:p-8 border ${meta.borderClass} shadow-xl space-y-6`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center">
                      <Icon size={24} className={meta.textAccent} />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white leading-tight">{meta.name}</h3>
                      <span className="text-xs text-slate-400 font-medium block">{meta.owner} · {meta.accountNumber}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 bg-white/10 text-white rounded-full border border-white/10">
                    {meta.typeLabel}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Available Balance</span>
                  <span className="text-4xl sm:text-5xl font-black font-mono text-white block mt-1 tracking-tight">
                    {formatCurrency(bal)}
                  </span>
                </div>

                {/* GPay Fast Action Buttons */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10">
                  <button
                    onClick={() => {
                      setTransferDest(selectedWalletDetail);
                      setActiveSubtab('transfers');
                    }}
                    className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus size={15} className="text-emerald-400" /> Add / Inflow
                  </button>
                  <button
                    onClick={() => {
                      setTransferSource(selectedWalletDetail);
                      setActiveSubtab('transfers');
                    }}
                    className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <ArrowRightLeft size={15} className="text-blue-400" /> Transfer
                  </button>
                  <button
                    onClick={() => {
                      setSpendWallet(selectedWalletDetail);
                      setActiveSubtab('spends');
                    }}
                    className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Coins size={15} className="text-rose-400" /> Spend / Draw
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 3 Flow Metric Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-emerald-200/90 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">TOTAL INFLOW</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600 block">
                +{formatCurrency(walletStats.totalInflow)}
              </span>
            </div>

            <div className="bg-white border border-rose-200/90 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">TOTAL OUTFLOW</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-rose-600 block">
                -{formatCurrency(walletStats.totalOutflow)}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">NET FLOW</span>
              <span className={`text-xl sm:text-2xl font-black font-mono block ${walletStats.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {walletStats.netFlow >= 0 ? '+' : ''}{formatCurrency(walletStats.netFlow)}
              </span>
            </div>
          </div>

          {/* Wallet Statement Feed */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-sm font-bold text-gray-900">
                {WALLET_META[selectedWalletDetail].name} Statement Feed
              </h4>
              <span className="text-xs text-gray-400 font-mono">
                {walletSpecificTxs.length} transactions
              </span>
            </div>

            <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
              {walletSpecificTxs.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  No transaction history recorded for this account yet.
                </div>
              ) : (
                walletSpecificTxs.map((tx) => {
                  const { isCredit, badgeLabel, badgeColor } = getTxDirection(tx, selectedWalletDetail);
                  const dateLabel = tx.created_at 
                    ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Recent';

                  return (
                    <div key={tx.id} className="p-4 bg-gray-50/70 border border-gray-100 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">{dateLabel}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 leading-snug">
                          {tx.notes || tx.description || 'Treasury Transaction'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-sm sm:text-base font-black font-mono block ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isCredit ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── SUBTAB 3: MOVE MONEY, TRANSFERS & DEPOSITS ── */}
      {activeSubtab === 'transfers' && (
        <div className="space-y-6">
          
          {/* Top Banner: External Cash Deposit / Organizer Float Injection */}
          <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-indigo-950 border border-emerald-500/30 rounded-3xl p-5 sm:p-7 text-white shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <HandCoins size={20} />
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                      External Cash Deposit &amp; Organizer Float
                    </h3>
                    <p className="text-xs text-slate-300 font-medium">
                      Inject outside personal capital (e.g. Dad/Mom bridging auction pot deficit) into the Cash Box or Bank
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Sparkles size={12} /> Auto-Tracked as Floating Capital
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteDeposit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Deposited By */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">
                    Who Is Depositing? (Deposited By)
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'Dad (Anbazhakan)', label: '👨 Dad' },
                      { id: 'Mom (Parimalam)', label: '👩 Mom' },
                      { id: 'Dr. Kishor', label: '🧑‍⚕️ Dr. Kishor' },
                      { id: 'Other', label: '✍️ Other' },
                    ].map((person) => {
                      const isSelected = depositBy === person.id;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => {
                            setDepositBy(person.id);
                            if (person.id === 'Dad (Anbazhakan)') {
                              setDepositNotes("Temporary float injected by Dad to bridge auction pot");
                            } else if (person.id === 'Mom (Parimalam)') {
                              setDepositNotes("Reserve cash deposit by Mom");
                            } else if (person.id === 'Dr. Kishor') {
                              setDepositNotes("Emergency capital injected by Dr. Kishor");
                            }
                          }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md'
                              : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/15'
                          }`}
                        >
                          {person.label}
                        </button>
                      );
                    })}
                  </div>

                  {depositBy === 'Other' && (
                    <input
                      type="text"
                      required
                      placeholder="Enter depositor name..."
                      value={depositCustomBy}
                      onChange={(e) => setDepositCustomBy(e.target.value)}
                      className="w-full mt-2 bg-slate-800/80 border border-slate-700 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                    />
                  )}
                </div>

                {/* Destination Account */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">
                    Deposit Into Vault (Destination)
                  </label>
                  <select
                    value={depositDest}
                    onChange={(e) => setDepositDest(e.target.value as WalletType)}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-400 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="cash_in_hand">💵 Physical Cash Box ({formatCurrency(balances.cash_in_hand)})</option>
                    <option value="kishor_bank">🏦 Kishor Bank ({formatCurrency(balances.kishor_bank)})</option>
                    <option value="dad_bank">🏦 Dad Bank ({formatCurrency(balances.dad_bank)})</option>
                    <option value="mom_bank">🏦 Mom Bank ({formatCurrency(balances.mom_bank)})</option>
                  </select>

                  <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block pt-1">
                    Category Tag
                  </label>
                  <select
                    value={depositTag}
                    onChange={(e) => setDepositTag(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="Auction Payout Float">Auction Payout Float (Temporary Bridge)</option>
                    <option value="General Capital Inflow">General Capital Inflow</option>
                    <option value="Emergency Reserve">Emergency Reserve Injection</option>
                    <option value="Personal Float">Personal Float Rotation</option>
                  </select>
                </div>

                {/* Deposit Amount & Quick Presets */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">
                    Deposit Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 20000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-sm font-black text-emerald-300 focus:outline-none placeholder-slate-500 font-mono"
                  />

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[5000, 10000, 20000, 30000, 50000, 100000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepositAmount(String(amt))}
                        className="text-[10px] font-bold bg-white/10 hover:bg-emerald-500 hover:text-slate-950 border border-white/15 text-slate-200 px-2 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        ₹{amt >= 100000 ? `${amt / 100000}L` : `${amt / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Purpose Notes & Submit */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2 border-t border-white/10">
                <div className="md:col-span-8">
                  <input
                    type="text"
                    placeholder="Optional notes (e.g. ₹20k put in Cash Box for auction winner payout while awaiting member dues)..."
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
                  />
                </div>
                <div className="md:col-span-4">
                  <button
                    type="submit"
                    disabled={isProcessingDeposit}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs py-3 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Plus size={15} />
                    {isProcessingDeposit ? 'Depositing...' : 'Deposit Cash into Vault'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            
            {/* Inter-Vault Transfer Box */}
            <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-blue-600" />
                  Inter-Vault Cash / Bank Transfer
                </h3>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
                  Internal Rebalance
                </span>
              </div>

              <form onSubmit={handleExecuteTransfer} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Source Account</label>
                    <select
                      value={transferSource}
                      onChange={(e) => setTransferSource(e.target.value as WalletType)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    >
                      <option value="cash_in_hand">Cash Box ({formatCurrency(balances.cash_in_hand)})</option>
                      <option value="kishor_bank">Kishor Bank ({formatCurrency(balances.kishor_bank)})</option>
                      <option value="dad_bank">Dad Bank ({formatCurrency(balances.dad_bank)})</option>
                      <option value="mom_bank">Mom Bank ({formatCurrency(balances.mom_bank)})</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Destination Account</label>
                    <select
                      value={transferDest}
                      onChange={(e) => setTransferDest(e.target.value as WalletType)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    >
                      <option value="cash_in_hand">Cash Box ({formatCurrency(balances.cash_in_hand)})</option>
                      <option value="kishor_bank">Kishor Bank ({formatCurrency(balances.kishor_bank)})</option>
                      <option value="dad_bank">Dad Bank ({formatCurrency(balances.dad_bank)})</option>
                      <option value="mom_bank">Mom Bank ({formatCurrency(balances.mom_bank)})</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Transfer Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 50000"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Reason / Purpose Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Funds for auction payout, bank rebalancing..."
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-900 focus:outline-none shadow-2xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isProcessingTransfer}
                  className="w-full bg-slate-900 hover:bg-black text-white font-bold text-xs py-3.5 rounded-xl shadow-2xs active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingTransfer ? 'Transferring...' : 'Execute Inter-Vault Transfer'}
                </button>
              </form>
            </div>

            {/* ATM Bank-to-Cash Relocation (2-Step Verification) */}
            <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                  <Banknote size={16} className="text-indigo-600" />
                  ATM Bank-to-Cash Relocation
                </h3>
                <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                  2-Step Verify
                </span>
              </div>

              <form onSubmit={handleTriggerATMRelocation} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Source Bank Account</label>
                    <select
                      value={relocateSource}
                      onChange={(e) => setRelocateSource(e.target.value as Exclude<WalletType, 'cash_in_hand'>)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    >
                      <option value="kishor_bank">Kishor Bank ({formatCurrency(balances.kishor_bank)})</option>
                      <option value="dad_bank">Dad Bank ({formatCurrency(balances.dad_bank)})</option>
                      <option value="mom_bank">Mom Bank ({formatCurrency(balances.mom_bank)})</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Withdrawal Amount (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 20000"
                      value={relocateAmount}
                      onChange={(e) => setRelocateAmount(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3.5 rounded-xl shadow-2xs active:scale-98 transition-all cursor-pointer"
                >
                  Trigger ATM Withdrawal
                </button>
              </form>

              {/* Pending Physical Inflow Verification Queue */}
              {relocations.length > 0 && (
                <div className="space-y-2.5 pt-3.5 border-t border-gray-100">
                  <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={13} />
                    Pending Physical Cash Box Verification
                  </h4>
                  
                  <div className="space-y-2">
                    {relocations.map((reloc) => (
                      <div key={reloc.id} className="flex justify-between items-center bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl">
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase block">From: {WALLET_META[reloc.source]?.name}</span>
                          <span className="text-sm font-extrabold text-gray-900 font-mono mt-0.5 block">{formatCurrency(reloc.amount)}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{reloc.createdAt}</span>
                        </div>
                        <button
                          onClick={() => handleVerifyATMRelocation(reloc.id, reloc.amount, reloc.source)}
                          className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                        >
                          <Check size={13} /> Confirm Inflow
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── SUBTAB 4: PERSONAL DRAWS, EXPENSES & FLOATING CAPITAL ── */}
      {activeSubtab === 'spends' && (
        <div className="space-y-6">
          
          {/* Outstanding Personal Debt Overview Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-rose-50 to-red-100/60 border border-rose-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                  <Coins size={12} className="text-rose-600" /> Total Owed
                </span>
                {personalDrawStats.outstandingCount > 0 && (
                  <span className="text-[9px] font-extrabold bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                    {personalDrawStats.outstandingCount} Active
                  </span>
                )}
              </div>
              <p className="text-base sm:text-xl font-black text-rose-900 font-mono mt-1">
                {formatCurrency(personalDrawStats.totalOutstanding)}
              </p>
              <span className="text-[10px] text-rose-600 font-medium">Outstanding personal debt to be put back</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  👨 Dad (Anbazhakan)
                </span>
                {floatStats.dadFloat > 0 && (
                  <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                    +{formatCurrency(floatStats.dadFloat)} Float
                  </span>
                )}
              </div>
              <p className={`text-base sm:text-lg font-black font-mono ${personalDrawStats.dadOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(personalDrawStats.dadOutstanding)}
              </p>
              <span className="text-[10px] text-gray-400 font-medium block">
                {personalDrawStats.dadOutstanding > 0 ? 'Owed to treasury' : '✓ ₹0 Debt Owed'}
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  👩 Mom (Parimalam)
                </span>
                {floatStats.momFloat > 0 && (
                  <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                    +{formatCurrency(floatStats.momFloat)} Float
                  </span>
                )}
              </div>
              <p className={`text-base sm:text-lg font-black font-mono ${personalDrawStats.momOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(personalDrawStats.momOutstanding)}
              </p>
              <span className="text-[10px] text-gray-400 font-medium block">
                {personalDrawStats.momOutstanding > 0 ? 'Owed to treasury' : '✓ ₹0 Debt Owed'}
              </span>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  🧑‍⚕️ Dr. Kishor
                </span>
                {floatStats.kishorFloat > 0 && (
                  <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-md">
                    +{formatCurrency(floatStats.kishorFloat)} Float
                  </span>
                )}
              </div>
              <p className={`text-base sm:text-lg font-black font-mono ${personalDrawStats.kishorOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(personalDrawStats.kishorOutstanding)}
              </p>
              <span className="text-[10px] text-gray-400 font-medium block">
                {personalDrawStats.kishorOutstanding > 0 ? 'Owed to treasury' : '✓ ₹0 Debt Owed'}
              </span>
            </div>
          </div>

          {/* 🌊 Active Floating Capital Available for 1-Tap Recovery */}
          {floatStats.totalActiveFloat > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border border-emerald-300 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-emerald-600 text-white">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                      Active Floating Capital Injected by Organizers ({formatCurrency(floatStats.totalActiveFloat)})
                    </h4>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Temporary funds put in to bridge payouts. Take your cash back anytime without creating personal debt.
                    </p>
                  </div>
                </div>

                <span className="text-xs font-black text-emerald-900 bg-emerald-200 border border-emerald-300 px-3 py-1 rounded-full self-start sm:self-auto font-mono">
                  {floatStats.activeCount} Active Injections
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {computedFloatingDeposits.filter(f => f.status === 'active').map((float) => (
                  <div key={float.id} className="bg-white/90 border border-emerald-200 rounded-2xl p-3.5 flex flex-col justify-between gap-3 shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                          {float.depositedBy}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{float.timestamp}</span>
                      </div>

                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-base sm:text-lg font-black font-mono text-emerald-700">
                          +{formatCurrency(float.amount)}
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          in {WALLET_META[float.walletType]?.name}
                        </span>
                      </div>

                      <p className="text-xs text-gray-700 font-semibold mt-1 line-clamp-2">
                        {float.notes}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenRecoverModal(float)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      ⚡ Take Back / Recover ₹{float.amount.toLocaleString('en-IN')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            
            {/* Fast Expense Entry Card (5 Cols) */}
            <div className="lg:col-span-5 bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                  <Coins size={16} className="text-rose-600" />
                  Fast Expense &amp; Personal Draw Logger
                </h3>
                <span className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full">
                  Vault Debit
                </span>
              </div>

              <form onSubmit={handleLogPersonalDraw} className="space-y-4">
                
                {/* Who Took It Selector (Large intuitive buttons for family) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Who Took This Money? (Taken By)</span>
                    <span className="text-[9px] text-indigo-600 font-bold">1-Tap Select</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Dad (Anbazhakan)', label: '👨 Dad (Anbazhakan)' },
                      { id: 'Mom (Parimalam)', label: '👩 Mom (Parimalam)' },
                      { id: 'Dr. Kishor', label: '🧑‍⚕️ Dr. Kishor' },
                      { id: 'Other', label: '✍️ Other / Custom' },
                    ].map((person) => {
                      const isSelected = spendTakenBy === person.id;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => {
                            setSpendTakenBy(person.id);
                            if (person.id === 'Dad (Anbazhakan)') {
                              setSpendDesc("Cash taken by Dad for personal use / rotation");
                            } else if (person.id === 'Mom (Parimalam)') {
                              setSpendDesc("Household expense / groceries taken by Mom");
                            } else if (person.id === 'Dr. Kishor') {
                              setSpendDesc("Collection travel expense by Dr. Kishor");
                            }
                          }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                          }`}
                        >
                          <span className="truncate">{person.label}</span>
                          {isSelected && <Check size={12} className="shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>

                  {spendTakenBy === 'Other' && (
                    <input
                      type="text"
                      required
                      placeholder="Enter person name (e.g. Relative, Assistant)..."
                      value={spendCustomTakenBy}
                      onChange={(e) => setSpendCustomTakenBy(e.target.value)}
                      className="w-full mt-2 bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Debit From Account</label>
                    <select
                      value={spendWallet}
                      onChange={(e) => setSpendWallet(e.target.value as WalletType)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    >
                      <option value="cash_in_hand">Cash Box ({formatCurrency(balances.cash_in_hand)})</option>
                      <option value="kishor_bank">Kishor Bank ({formatCurrency(balances.kishor_bank)})</option>
                      <option value="dad_bank">Dad Bank ({formatCurrency(balances.dad_bank)})</option>
                      <option value="mom_bank">Mom Bank ({formatCurrency(balances.mom_bank)})</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Spend Amount (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 500"
                      value={spendAmount}
                      onChange={(e) => setSpendAmount(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    />
                  </div>
                </div>

                {/* Quick amount presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[500, 1000, 2000, 5000, 7000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSpendAmount(String(amt))}
                      className="text-[10px] font-bold bg-gray-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Category Tag</label>
                  <select
                    value={spendTag}
                    onChange={(e) => setSpendTag(e.target.value as PersonalDraw['tag'])}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  >
                    <option value="Personal Expense">Personal Expense / Use</option>
                    <option value="Money Lending / Rotation">Money Lending / Temporary Rotation</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Maintenance">Bike / Vehicle Maintenance</option>
                    <option value="Tea & Refreshments">Tea &amp; Refreshments</option>
                    <option value="Collection Visits">Collection Visits</option>
                    <option value="Groceries">Groceries / Household</option>
                    <option value="Emergency Cash">Emergency Cash</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Reason / Description</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (spendTakenBy.includes('Dad')) {
                          setSpendDesc("Cash taken by Dad for personal rotation / lending");
                        } else if (spendTakenBy.includes('Mom')) {
                          setSpendDesc("Household / personal expense taken by Mom");
                        } else {
                          setSpendDesc("Collection travel & refreshments expense");
                        }
                      }} 
                      className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-800 cursor-pointer"
                    >
                      <Mic size={11} /> Auto-fill
                    </button>
                  </label>
                  <textarea
                    placeholder="e.g. Petrol for collection visits, personal loan rotation, cash taken by Dad..."
                    value={spendDesc}
                    onChange={(e) => setSpendDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none resize-none font-medium shadow-2xs leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSpend}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-3.5 rounded-xl transition-all duration-150 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSpend ? 'Logging Draw...' : 'Log Personal Draw / Expense'}
                </button>
              </form>
            </div>

            {/* Personal Draws & Spends Ledger (7 Cols) */}
            <div className="lg:col-span-7 bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">Personal Draws &amp; Spends Ledger</h3>
                  <span className="text-[11px] text-gray-500">Track who took cash &amp; settle outstanding amounts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full">
                    {personalDrawStats.outstandingCount} Owed
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                    {personalDrawStats.settledCount} Settled
                  </span>
                </div>
              </div>

              {/* Filter Tabs & Search */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Status Filters */}
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                    {[
                      { id: 'all', label: `All (${computedPersonalDraws.length})` },
                      { id: 'outstanding', label: `⚡ Outstanding (${personalDrawStats.outstandingCount})` },
                      { id: 'settled', label: `✓ Settled (${personalDrawStats.settledCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setPersonalDrawStatusFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          personalDrawStatusFilter === tab.id
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Person Filter */}
                  <select
                    value={personalDrawPersonFilter}
                    onChange={(e) => setPersonalDrawPersonFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All People</option>
                    <option value="dad">👨 Dad (Anbazhakan)</option>
                    <option value="mom">👩 Mom (Parimalam)</option>
                    <option value="kishor">🧑‍⚕️ Dr. Kishor</option>
                    <option value="other">✍️ Others</option>
                  </select>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by reason, name, category, or amount..."
                    value={personalDrawSearch}
                    onChange={(e) => setPersonalDrawSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Draws List */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {filteredPersonalDraws.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    No personal draws matching the selected filter.
                  </div>
                ) : (
                  filteredPersonalDraws.map((draw) => {
                    const isOutstanding = draw.status === 'outstanding';
                    return (
                      <div 
                        key={draw.id} 
                        className={`p-4 rounded-2xl border transition-all ${
                          isOutstanding 
                            ? 'bg-rose-50/30 border-rose-200/70 hover:border-rose-300' 
                            : 'bg-gray-50/80 border-gray-200/80'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Status Badge */}
                              {isOutstanding ? (
                                <span className="bg-rose-600 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                  <Clock size={10} /> Outstanding Owed
                                </span>
                              ) : (
                                <span className="bg-emerald-600 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                  <CheckCircle2 size={10} /> Settled / Repaid
                                </span>
                              )}

                              {/* Taken By Badge */}
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <User size={10} /> Taken By: {draw.takenBy}
                              </span>

                              {/* Category Tag */}
                              <span className="bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                                {draw.tag}
                              </span>

                              {/* Source Wallet Tag */}
                              <span className="text-[10px] text-gray-500 font-mono">
                                from {WALLET_META[draw.walletType]?.name}
                              </span>
                            </div>

                            <p className="text-xs text-gray-900 font-semibold leading-relaxed">
                              {draw.description}
                            </p>

                            {/* Settlement Details Banner if Settled */}
                            {!isOutstanding && draw.settlementDetails && (
                              <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                <span>{draw.settlementDetails.notes || `Settled on ${draw.settlementDetails.settledAt}`}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                              <span>Recorded: {draw.timestamp}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            <span className={`text-base font-black font-mono ${isOutstanding ? 'text-rose-600' : 'text-gray-500'}`}>
                              -{formatCurrency(draw.amount)}
                            </span>

                            {isOutstanding ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSettleModal(draw)}
                                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                >
                                  <Banknote size={13} /> Put Cash Back
                                </button>
                                <button 
                                  onClick={() => handleDeletePersonalDraw(draw)}
                                  className="text-gray-400 hover:text-rose-600 p-1.5 transition-colors cursor-pointer"
                                  title="Delete draw & Refund vault"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleDeletePersonalDraw(draw)}
                                className="text-gray-300 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                                title="Delete log record"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            
            {/* Fast Expense Entry Card (5 Cols) */}
            <div className="lg:col-span-5 bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                  <Coins size={16} className="text-rose-600" />
                  Fast Expense &amp; Personal Draw Logger
                </h3>
                <span className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full">
                  Vault Debit
                </span>
              </div>

              <form onSubmit={handleLogPersonalDraw} className="space-y-4">
                
                {/* Who Took It Selector (Large intuitive buttons for family) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Who Took This Money? (Taken By)</span>
                    <span className="text-[9px] text-indigo-600 font-bold">1-Tap Select</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Dad (Anbazhakan)', label: '👨 Dad (Anbazhakan)' },
                      { id: 'Mom (Parimalam)', label: '👩 Mom (Parimalam)' },
                      { id: 'Dr. Kishor', label: '🧑‍⚕️ Dr. Kishor' },
                      { id: 'Other', label: '✍️ Other / Custom' },
                    ].map((person) => {
                      const isSelected = spendTakenBy === person.id;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => {
                            setSpendTakenBy(person.id);
                            if (person.id === 'Dad (Anbazhakan)') {
                              setSpendDesc("Cash taken by Dad for personal use / rotation");
                            } else if (person.id === 'Mom (Parimalam)') {
                              setSpendDesc("Household expense / groceries taken by Mom");
                            } else if (person.id === 'Dr. Kishor') {
                              setSpendDesc("Collection travel expense by Dr. Kishor");
                            }
                          }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                          }`}
                        >
                          <span className="truncate">{person.label}</span>
                          {isSelected && <Check size={12} className="shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>

                  {spendTakenBy === 'Other' && (
                    <input
                      type="text"
                      required
                      placeholder="Enter person name (e.g. Relative, Assistant)..."
                      value={spendCustomTakenBy}
                      onChange={(e) => setSpendCustomTakenBy(e.target.value)}
                      className="w-full mt-2 bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Debit From Account</label>
                    <select
                      value={spendWallet}
                      onChange={(e) => setSpendWallet(e.target.value as WalletType)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    >
                      <option value="cash_in_hand">Cash Box ({formatCurrency(balances.cash_in_hand)})</option>
                      <option value="kishor_bank">Kishor Bank ({formatCurrency(balances.kishor_bank)})</option>
                      <option value="dad_bank">Dad Bank ({formatCurrency(balances.dad_bank)})</option>
                      <option value="mom_bank">Mom Bank ({formatCurrency(balances.mom_bank)})</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Spend Amount (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 500"
                      value={spendAmount}
                      onChange={(e) => setSpendAmount(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                    />
                  </div>
                </div>

                {/* Quick amount presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[500, 1000, 2000, 5000, 7000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSpendAmount(String(amt))}
                      className="text-[10px] font-bold bg-gray-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Category Tag</label>
                  <select
                    value={spendTag}
                    onChange={(e) => setSpendTag(e.target.value as PersonalDraw['tag'])}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  >
                    <option value="Personal Expense">Personal Expense / Use</option>
                    <option value="Money Lending / Rotation">Money Lending / Temporary Rotation</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Maintenance">Bike / Vehicle Maintenance</option>
                    <option value="Tea & Refreshments">Tea &amp; Refreshments</option>
                    <option value="Collection Visits">Collection Visits</option>
                    <option value="Groceries">Groceries / Household</option>
                    <option value="Emergency Cash">Emergency Cash</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Reason / Description</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (spendTakenBy.includes('Dad')) {
                          setSpendDesc("Cash taken by Dad for personal rotation / lending");
                        } else if (spendTakenBy.includes('Mom')) {
                          setSpendDesc("Household / personal expense taken by Mom");
                        } else {
                          setSpendDesc("Collection travel & refreshments expense");
                        }
                      }} 
                      className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-800 cursor-pointer"
                    >
                      <Mic size={11} /> Auto-fill
                    </button>
                  </label>
                  <textarea
                    placeholder="e.g. Petrol for collection visits, personal loan rotation, cash taken by Dad..."
                    value={spendDesc}
                    onChange={(e) => setSpendDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none resize-none font-medium shadow-2xs leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSpend}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-3.5 rounded-xl transition-all duration-150 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSpend ? 'Logging Draw...' : 'Log Personal Draw / Expense'}
                </button>
              </form>
            </div>

            {/* Personal Draws & Spends Ledger (7 Cols) */}
            <div className="lg:col-span-7 bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">Personal Draws &amp; Spends Ledger</h3>
                  <span className="text-[11px] text-gray-500">Track who took cash &amp; settle outstanding amounts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full">
                    {personalDrawStats.outstandingCount} Owed
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
                    {personalDrawStats.settledCount} Settled
                  </span>
                </div>
              </div>

              {/* Filter Tabs & Search */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Status Filters */}
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                    {[
                      { id: 'all', label: `All (${computedPersonalDraws.length})` },
                      { id: 'outstanding', label: `⚡ Outstanding (${personalDrawStats.outstandingCount})` },
                      { id: 'settled', label: `✓ Settled (${personalDrawStats.settledCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setPersonalDrawStatusFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          personalDrawStatusFilter === tab.id
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Person Filter */}
                  <select
                    value={personalDrawPersonFilter}
                    onChange={(e) => setPersonalDrawPersonFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All People</option>
                    <option value="dad">👨 Dad (Anbazhakan)</option>
                    <option value="mom">👩 Mom (Parimalam)</option>
                    <option value="kishor">🧑‍⚕️ Dr. Kishor</option>
                    <option value="other">✍️ Others</option>
                  </select>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by reason, name, category, or amount..."
                    value={personalDrawSearch}
                    onChange={(e) => setPersonalDrawSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Draws List */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {filteredPersonalDraws.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    No personal draws matching the selected filter.
                  </div>
                ) : (
                  filteredPersonalDraws.map((draw) => {
                    const isOutstanding = draw.status === 'outstanding';
                    return (
                      <div 
                        key={draw.id} 
                        className={`p-4 rounded-2xl border transition-all ${
                          isOutstanding 
                            ? 'bg-rose-50/30 border-rose-200/70 hover:border-rose-300' 
                            : 'bg-gray-50/80 border-gray-200/80'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Status Badge */}
                              {isOutstanding ? (
                                <span className="bg-rose-600 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                  <Clock size={10} /> Outstanding Owed
                                </span>
                              ) : (
                                <span className="bg-emerald-600 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                  <CheckCircle2 size={10} /> Settled / Repaid
                                </span>
                              )}

                              {/* Taken By Badge */}
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <User size={10} /> Taken By: {draw.takenBy}
                              </span>

                              {/* Category Tag */}
                              <span className="bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                                {draw.tag}
                              </span>

                              {/* Source Wallet Tag */}
                              <span className="text-[10px] text-gray-500 font-mono">
                                from {WALLET_META[draw.walletType]?.name}
                              </span>
                            </div>

                            <p className="text-xs text-gray-900 font-semibold leading-relaxed">
                              {draw.description}
                            </p>

                            {/* Settlement Details Banner if Settled */}
                            {!isOutstanding && draw.settlementDetails && (
                              <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                <span>{draw.settlementDetails.notes || `Settled on ${draw.settlementDetails.settledAt}`}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                              <span>Recorded: {draw.timestamp}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            <span className={`text-base font-black font-mono ${isOutstanding ? 'text-rose-600' : 'text-gray-500'}`}>
                              -{formatCurrency(draw.amount)}
                            </span>

                            {isOutstanding ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSettleModal(draw)}
                                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                >
                                  <Banknote size={13} /> Put Cash Back
                                </button>
                                <button 
                                  onClick={() => handleDeletePersonalDraw(draw)}
                                  className="text-gray-400 hover:text-rose-600 p-1.5 transition-colors cursor-pointer"
                                  title="Delete draw & Refund vault"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleDeletePersonalDraw(draw)}
                                className="text-gray-300 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                                title="Delete log record"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* ── SIMPLE MODAL: PUT CASH BACK INTO VAULT ── */}
          {settlingDraw && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                      <Banknote size={20} className="text-emerald-600" />
                      Put Cash Back into Vault
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Settle {settlingDraw.takenBy}&apos;s draw of {formatCurrency(settlingDraw.amount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettlingDraw(null)}
                    className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleConfirmSettlement} className="space-y-4">
                  <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-emerald-900 font-bold uppercase tracking-wider">
                        Put Back Into Account
                      </label>
                      <select
                        value={settleDestWallet}
                        onChange={(e) => setSettleDestWallet(e.target.value as WalletType)}
                        className="w-full bg-white border border-emerald-300 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                      >
                        <option value="cash_in_hand">Physical Cash Box ({formatCurrency(balances.cash_in_hand)})</option>
                        <option value="kishor_bank">Kishor Bank ({formatCurrency(balances.kishor_bank)})</option>
                        <option value="dad_bank">Dad Bank ({formatCurrency(balances.dad_bank)})</option>
                        <option value="mom_bank">Mom Bank ({formatCurrency(balances.mom_bank)})</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-emerald-900 font-bold uppercase tracking-wider">
                          Amount to Put Back (₹)
                        </label>
                        <button
                          type="button"
                          onClick={() => setSettleAmount(String(settlingDraw.amount))}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                        >
                          Full: {formatCurrency(settlingDraw.amount)}
                        </button>
                      </div>
                      <input
                        type="number"
                        required
                        min={1}
                        max={settlingDraw.amount}
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                        className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm font-black text-gray-900 focus:outline-none font-mono shadow-2xs ${
                          Number(settleAmount) > settlingDraw.amount 
                            ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30 text-rose-900' 
                            : 'border-emerald-300 focus:border-emerald-500'
                        }`}
                      />
                    </div>

                    {/* Exceeded Warning */}
                    {Number(settleAmount) > settlingDraw.amount && (
                      <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-[11px] text-rose-800 font-medium leading-relaxed">
                        ⚠️ <strong>Cannot exceed draw amount:</strong> This draw is for {formatCurrency(settlingDraw.amount)}. You cannot put back more than {formatCurrency(settlingDraw.amount)} for this specific draw. To deposit extra cash, use the <strong>Move Money</strong> tab.
                      </div>
                    )}

                    {/* Partial Settlement Info */}
                    {Number(settleAmount) > 0 && Number(settleAmount) < settlingDraw.amount && (
                      <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl text-[11px] text-amber-900 font-medium">
                        ℹ️ <strong>Partial Settlement:</strong> Remaining <span className="font-bold font-mono">{formatCurrency(settlingDraw.amount - Number(settleAmount))}</span> will remain as active debt for {settlingDraw.takenBy}.
                      </div>
                    )}

                    {/* Normal Full Settlement Info */}
                    {Number(settleAmount) === settlingDraw.amount && (
                      <p className="text-[11px] text-emerald-800 font-medium">
                        ✓ Will credit <span className="font-bold">{formatCurrency(Number(settleAmount))}</span> back into {WALLET_META[settleDestWallet]?.name} and mark this draw as fully Settled.
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSettlingDraw(null)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingSettle || Number(settleAmount) <= 0 || Number(settleAmount) > settlingDraw.amount}
                      className="flex-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessingSettle 
                        ? 'Putting Cash Back...' 
                        : Number(settleAmount) > settlingDraw.amount
                        ? `Cannot Exceed ${formatCurrency(settlingDraw.amount)}`
                        : `✓ Put ${formatCurrency(Number(settleAmount) || settlingDraw.amount)} Back`
                      }
                    </button>
                  </div>
                </form>

              </div>
            </div>
          )}

          {/* ── INTERACTIVE MODAL: RECOVER ORGANIZER FLOAT (CHOOSE ANY SOURCE ACCOUNT) ── */}
          {recoveringFloat && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
                
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                      <RotateCcw size={20} className="text-emerald-600" />
                      Recover Organizer Float
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Refund {recoveringFloat.depositedBy} from any vault account with sufficient funds
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecoveringFloat(null)}
                    className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleConfirmRecoverFloat} className="space-y-4">
                  
                  {/* Injected Float Summary Card */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Deposited Float</span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {recoveringFloat.depositedBy}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-black font-mono text-emerald-600">
                        +{formatCurrency(recoveringFloat.amount)}
                      </span>
                      <span className="text-[11px] text-gray-500 font-medium">
                        Original Inflow: {WALLET_META[recoveringFloat.walletType]?.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 italic">
                      &quot;{recoveringFloat.notes}&quot;
                    </p>
                  </div>

                  {/* Vault Source Selection (Freely choose any account) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-700 font-bold uppercase tracking-wider block">
                      Pay Out / Withdraw Cash From Account:
                    </label>
                    <div className="space-y-2">
                      {[
                        { type: 'cash_in_hand' as WalletType, label: '💵 Physical Cash Box', bal: balances.cash_in_hand },
                        { type: 'kishor_bank' as WalletType, label: '🏦 Kishor Bank', bal: balances.kishor_bank },
                        { type: 'dad_bank' as WalletType, label: '🏦 Dad Bank', bal: balances.dad_bank },
                        { type: 'mom_bank' as WalletType, label: '🏦 Mom Bank', bal: balances.mom_bank },
                      ].map((acc) => {
                        const isSelected = recoverSourceWallet === acc.type;
                        const hasEnough = (acc.bal || 0) >= (Number(recoverAmount) || recoveringFloat.amount);
                        return (
                          <button
                            key={acc.type}
                            type="button"
                            onClick={() => setRecoverSourceWallet(acc.type)}
                            className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-gray-900 block">{acc.label}</span>
                              <span className={`text-[11px] font-mono font-bold block ${acc.bal > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                                Available: {formatCurrency(acc.bal || 0)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {!hasEnough && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                  Low Bal
                                </span>
                              )}
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white'
                              }`}>
                                {isSelected && <Check size={10} />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Amount to Recover */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-gray-700 font-bold uppercase tracking-wider">
                        Amount to Recover (₹)
                      </label>
                      <button
                        type="button"
                        onClick={() => setRecoverAmount(String(recoveringFloat.amount))}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                      >
                        Full Float: {formatCurrency(recoveringFloat.amount)}
                      </button>
                    </div>
                    <input
                      type="number"
                      required
                      min={1}
                      max={recoveringFloat.amount}
                      value={recoverAmount}
                      onChange={(e) => setRecoverAmount(e.target.value)}
                      className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm font-black text-gray-900 focus:outline-none font-mono shadow-2xs ${
                        balances[recoverSourceWallet] < Number(recoverAmount) || Number(recoverAmount) > recoveringFloat.amount
                          ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                          : 'border-emerald-300 focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Validation alerts */}
                  {balances[recoverSourceWallet] < Number(recoverAmount) && (
                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-[11px] text-rose-800 font-medium leading-relaxed">
                      ⚠️ <strong>Insufficient balance in {WALLET_META[recoverSourceWallet].name}:</strong> Only {formatCurrency(balances[recoverSourceWallet])} available. Please select another account (e.g. Physical Cash Box) above.
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setRecoveringFloat(null)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingRecover || Number(recoverAmount) <= 0 || Number(recoverAmount) > recoveringFloat.amount || balances[recoverSourceWallet] < Number(recoverAmount)}
                      className="flex-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw size={13} />
                      {isProcessingRecover 
                        ? 'Processing Recovery...' 
                        : balances[recoverSourceWallet] < Number(recoverAmount)
                        ? 'Insufficient Balance'
                        : `Withdraw ${formatCurrency(Number(recoverAmount) || recoveringFloat.amount)} from ${WALLET_META[recoverSourceWallet].name}`
                      }
                    </button>
                  </div>
                </form>

              </div>
            </div>
          )}

        </div>
      )}

      {/* ── SUBTAB 5: DENOMINATION COUNTER & RECONCILIATION ── */}
      {activeSubtab === 'denominations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Note Counter Input Matrix */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                <Calculator size={16} className="text-emerald-600" />
                Physical Note Counter Matrix
              </h3>
              <button
                type="button"
                onClick={() => setDenominations({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 })}
                className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} /> Reset
              </button>
            </div>

            <div className="space-y-3">
              {[500, 200, 100, 50, 20, 10].map((noteVal) => {
                const count = denominations[noteVal] || 0;
                const totalForNote = count * noteVal;

                return (
                  <div key={noteVal} className="flex items-center justify-between p-3 bg-gray-50/80 border border-gray-100 rounded-2xl gap-3">
                    <div className="w-20">
                      <span className="text-sm font-black font-mono text-gray-900">₹{noteVal}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-bold">×</span>
                      <input
                        type="number"
                        min={0}
                        value={count === 0 ? '' : count}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setDenominations(prev => ({ ...prev, [noteVal]: val }));
                        }}
                        className="w-24 bg-white border border-gray-200 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs font-bold font-mono text-center text-gray-900 focus:outline-none"
                      />
                    </div>

                    <div className="w-28 text-right">
                      <span className="text-xs sm:text-sm font-black font-mono text-emerald-700 block">
                        {formatCurrency(totalForNote)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Physical Cash vs App Disparity Card */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-sm sm:text-base font-bold text-gray-900">
                  Cash Box Reconciliation Audit
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Live comparison between physical currency count and app records
                </p>
              </div>

              {/* 2 Big Comparison Metric Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">PHYSICAL COUNTED</span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 block">
                    {formatCurrency(calculatedPhysicalCash)}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">APP CASH BOX</span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 block">
                    {formatCurrency(balances.cash_in_hand || 0)}
                  </span>
                </div>
              </div>

              {/* Disparity Status Callout */}
              <div className={`p-4 rounded-2xl border ${
                cashDisparity === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : cashDisparity > 0
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">
                      {cashDisparity === 0 
                        ? '✅ Perfect Match — Zero Disparity' 
                        : cashDisparity > 0 
                        ? 'ℹ️ Physical Surplus Detected' 
                        : '⚠️ Physical Shortage Detected'}
                    </span>
                  </div>
                  <span className="text-sm font-black font-mono">
                    {cashDisparity > 0 ? '+' : ''}{formatCurrency(cashDisparity)}
                  </span>
                </div>
                <p className="text-[11px] opacity-80 mt-1">
                  {cashDisparity === 0
                    ? 'Physical banknotes in locker match the system balance exactly.'
                    : cashDisparity > 0
                    ? 'You counted more physical currency than recorded in the app.'
                    : 'Counted cash is lower than system balance. Check for unrecorded spends or payouts.'}
                </p>
              </div>

              {lastReconciliationNote && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-600">
                  <span className="font-bold text-gray-800 block mb-0.5">Last Record:</span>
                  {lastReconciliationNote}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveDenominations}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 rounded-xl shadow-2xs active:scale-98 transition-all cursor-pointer mt-4"
            >
              Record Reconciliation Snapshot
            </button>
          </div>

        </div>
      )}

      {/* ── SUBTAB 6: MASTER AUDIT LEDGER ── */}
      {activeSubtab === 'ledger' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xs">
          
          {/* Header & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <History size={18} className="text-indigo-600" />
                Treasury Audit &amp; Movements Timeline
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Complete verifiable history of collections, transfers, spends, and ATM cash movements
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none w-36 sm:w-48"
                />
              </div>

              <select
                value={ledgerWalletFilter}
                onChange={(e) => setLedgerWalletFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-700 focus:outline-none"
              >
                <option value="all">All Accounts</option>
                <option value="cash_in_hand">Cash Box</option>
                <option value="kishor_bank">Kishor Bank</option>
                <option value="dad_bank">Dad Bank</option>
                <option value="mom_bank">Mom Bank</option>
              </select>

              <select
                value={ledgerTypeFilter}
                onChange={(e) => setLedgerTypeFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-700 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="collection">Collections (+)</option>
                <option value="payout">Prize Payouts (-)</option>
                <option value="transfer">Transfers</option>
                <option value="personal_draw">Personal Draws (-)</option>
                <option value="atm_withdrawal">ATM Withdrawals</option>
              </select>
            </div>
          </div>

          {/* Master Timeline Stream */}
          <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
            {filteredMasterLedger.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">
                No matching transactions found in the treasury ledger.
              </div>
            ) : (
              filteredMasterLedger.map((tx) => {
                const { isCredit, badgeLabel, badgeColor } = getTxDirection(tx);
                const dateLabel = tx.created_at 
                  ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Recent';

                return (
                  <div key={tx.id} className="p-4 bg-gray-50/70 border border-gray-100 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{dateLabel}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-800 leading-snug">
                        {tx.notes || tx.description || 'Treasury Movement'}
                      </p>
                      <span className="text-[10px] text-gray-500 font-medium block">
                        Account: <strong className="text-gray-700">{WALLET_META[tx.wallet_type]?.name || tx.wallet_type}</strong>
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-sm sm:text-base font-black font-mono block ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

    </div>
  );
}
