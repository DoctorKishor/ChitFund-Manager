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
  Send
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

  // Floating Capital Recovery State (Choose payout vault freely)
  const [recoveringFloat, setRecoveringFloat] = useState<FloatingDeposit | null>(null);
  const [recoverSourceWallet, setRecoverSourceWallet] = useState<WalletType>('cash_in_hand');
  const [recoverAmount, setRecoverAmount] = useState<string>('');
  const [isProcessingRecover, setIsProcessingRecover] = useState<boolean>(false);

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

    // Subscribe to realtime transaction ledger updates
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

  const WALLET_META: Record<WalletType, {
    name: string;
    owner: string;
    accountNumber: string;
    typeLabel: string;
    bgGradient: string;
    borderClass: string;
    textAccent: string;
    dotColor: string;
    badgeBg: string;
    iconBg: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }> = {
    cash_in_hand: {
      name: 'Physical Cash Box',
      owner: 'On-Premises Locker',
      accountNumber: 'Vault #01',
      typeLabel: 'Cash Vault · Physical Box',
      bgGradient: 'bg-[#1D1D41]',
      borderClass: 'border-[#27264E]',
      textAccent: 'text-[#02B15A]',
      dotColor: 'bg-[#02B15A]',
      badgeBg: 'bg-[#02B15A]/15 text-[#02B15A] border-[#02B15A]/30',
      iconBg: 'bg-[#02B15A]/20 text-[#02B15A]',
      icon: Banknote,
    },
    kishor_bank: {
      name: 'Kishor Bank (UPI)',
      owner: 'Kishor',
      accountNumber: '•••• 8492 · Primary Digital',
      typeLabel: 'Digital Vault · Primary Inflow',
      bgGradient: 'bg-gradient-to-br from-[#9C2CF3] to-[#3A6FF9]',
      borderClass: 'border-transparent shadow-[0_8px_30px_rgba(156,44,243,0.35)]',
      textAccent: 'text-white',
      dotColor: 'bg-[#64CFF6]',
      badgeBg: 'bg-white/20 text-white border-white/30',
      iconBg: 'bg-white/20 text-white',
      icon: Landmark,
    },
    dad_bank: {
      name: "Anbazhakan's Bank",
      owner: 'Anbazhakan',
      accountNumber: '•••• 3108 · Primary Banking',
      typeLabel: 'Disbursement Vault · Primary Banking',
      bgGradient: 'bg-[#1D1D41]',
      borderClass: 'border-[#27264E]',
      textAccent: 'text-[#64CFF6]',
      dotColor: 'bg-[#64CFF6]',
      badgeBg: 'bg-[#64CFF6]/15 text-[#64CFF6] border-[#64CFF6]/30',
      iconBg: 'bg-[#64CFF6]/20 text-[#64CFF6]',
      icon: CreditCard,
    },
    mom_bank: {
      name: "Parimalam's Bank",
      owner: 'Parimalam',
      accountNumber: '•••• 5521 · Reserve Account',
      typeLabel: 'Reserve Vault · Secondary Channel',
      bgGradient: 'bg-[#1D1D41]',
      borderClass: 'border-[#27264E]',
      textAccent: 'text-[#FFBB38]',
      dotColor: 'bg-[#FFBB38]',
      badgeBg: 'bg-[#FFBB38]/15 text-[#FFBB38] border-[#FFBB38]/30',
      iconBg: 'bg-[#FFBB38]/20 text-[#FFBB38]',
      icon: Wallet,
    },
  };

  // Liquidity Analytics
  const totalTreasuryBalance = useMemo(() => {
    return (balances.cash_in_hand || 0) + (balances.kishor_bank || 0) + (balances.dad_bank || 0) + (balances.mom_bank || 0);
  }, [balances]);

  // Helper to accurately classify if a treasury movement is an Inflow/Credit (+) or Outflow/Debit (-)
  const getTxDirection = (tx: TreasuryTx, perspectiveWallet?: WalletType | 'all'): { isCredit: boolean; badgeLabel: string; badgeColor: string } => {
    const type = tx.type;
    const notes = (tx.notes || tx.description || '').toLowerCase();
    const targetWallet = perspectiveWallet && perspectiveWallet !== 'all' ? perspectiveWallet : tx.wallet_type;

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

    // 7. ATM Relocations (Bank debit vs Cash Box credit)
    if (type === 'atm_withdrawal') {
      if (targetWallet === 'cash_in_hand') {
        return { isCredit: true, badgeLabel: 'ATM CASH INFLOW (+)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
      return { isCredit: false, badgeLabel: 'ATM WITHDRAWAL (-)', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' };
    }

    // 8. Explicit Transfer Leg Types
    if (type === 'transfer_in') {
      return { isCredit: true, badgeLabel: 'TRANSFER IN (+)', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' };
    }

    if (type === 'organizer_profit') {
      return { isCredit: false, badgeLabel: 'ORGANIZER PROFIT (-)', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' };
    }

    // 9. Inter-Vault Transfers
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

  // Computed Personal Draws from Supabase transactions ledger
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

  // Khatabook Navigation & Filter State
  const [khatabookTab, setKhatabookTab] = useState<'floats' | 'draws'>('floats');
  const [khatabookPersonFilter, setKhatabookPersonFilter] = useState<string>('all');
  const [showSettledDraws, setShowSettledDraws] = useState<boolean>(false);
  const [showRecoveredFloats, setShowRecoveredFloats] = useState<boolean>(false);

  // Outstanding Personal Draws
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

  // Float Stats Per Person
  const floatStats = useMemo(() => {
    const active = computedFloatingDeposits.filter(f => f.status === 'active');
    const total = active.reduce((sum, f) => sum + f.amount, 0);

    const anbazhakan = active
      .filter(f => f.depositedBy.toLowerCase().includes('anbazhakan') || f.depositedBy.toLowerCase().includes('dad'))
      .reduce((sum, f) => sum + f.amount, 0);

    const parimalam = active
      .filter(f => f.depositedBy.toLowerCase().includes('parimalam') || f.depositedBy.toLowerCase().includes('mom'))
      .reduce((sum, f) => sum + f.amount, 0);

    const kishor = active
      .filter(f => f.depositedBy.toLowerCase().includes('kishor'))
      .reduce((sum, f) => sum + f.amount, 0);

    const other = active
      .filter(f => !f.depositedBy.toLowerCase().includes('dad') && !f.depositedBy.toLowerCase().includes('anbazhakan') && !f.depositedBy.toLowerCase().includes('mom') && !f.depositedBy.toLowerCase().includes('parimalam') && !f.depositedBy.toLowerCase().includes('kishor'))
      .reduce((sum, f) => sum + f.amount, 0);

    return { total, anbazhakan, parimalam, kishor, other, activeCount: active.length };
  }, [computedFloatingDeposits]);

  // Personal Draws Stats Per Person
  const personalDrawStats = useMemo(() => {
    const active = computedPersonalDraws.filter(d => d.status === 'outstanding');
    const total = active.reduce((sum, d) => sum + d.amount, 0);

    const anbazhakan = active
      .filter(d => d.takenBy.toLowerCase().includes('anbazhakan') || d.takenBy.toLowerCase().includes('dad'))
      .reduce((sum, d) => sum + d.amount, 0);

    const parimalam = active
      .filter(d => d.takenBy.toLowerCase().includes('parimalam') || d.takenBy.toLowerCase().includes('mom'))
      .reduce((sum, d) => sum + d.amount, 0);

    const kishor = active
      .filter(d => d.takenBy.toLowerCase().includes('kishor'))
      .reduce((sum, d) => sum + d.amount, 0);

    const other = active
      .filter(d => !d.takenBy.toLowerCase().includes('dad') && !d.takenBy.toLowerCase().includes('anbazhakan') && !d.takenBy.toLowerCase().includes('mom') && !d.takenBy.toLowerCase().includes('parimalam') && !d.takenBy.toLowerCase().includes('kishor'))
      .reduce((sum, d) => sum + d.amount, 0);

    return { total, anbazhakan, parimalam, kishor, other, activeCount: active.length };
  }, [computedPersonalDraws]);

  // WhatsApp Reminder Link Generator for Personal Draws
  const generateDrawWhatsAppReminder = (personFilter: string) => {
    const draws = personFilter === 'all'
      ? outstandingPersonalDraws
      : outstandingPersonalDraws.filter(d => d.takenBy.toLowerCase().includes(personFilter.toLowerCase()));
    const total = draws.reduce((sum, d) => sum + d.amount, 0);
    const itemsList = draws.map(d => `• ₹${d.amount.toLocaleString('en-IN')} — ${d.tag} (${d.description || 'Cash Draw'}) taken on ${new Date(d.created_at).toLocaleDateString('en-IN')}`).join('\n');
    
    const personLabel = personFilter === 'anbazhakan' || personFilter === 'dad' ? 'Anbazhakan' : personFilter === 'parimalam' || personFilter === 'mom' ? 'Parimalam' : personFilter === 'kishor' ? 'Kishor' : 'Family Member';

    const msg = `*CHIT FUND — PERSONAL CASH DRAW REMINDER*\n\n` +
      `Hello ${personLabel},\n` +
      `Here is the record of pending personal cash draws from the Chit Fund Box:\n\n` +
      `${itemsList}\n\n` +
      `*Total to Settle / Put Back: ₹${total.toLocaleString('en-IN')}*\n\n` +
      `Please deposit into the Cash Box or Bank when convenient. Thank you!`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

  // WhatsApp Summary Link Generator for Floating Capital
  const generateFloatWhatsAppSummary = (personFilter: string) => {
    const floats = personFilter === 'all'
      ? activeFloatingDeposits
      : activeFloatingDeposits.filter(f => f.depositedBy.toLowerCase().includes(personFilter.toLowerCase()));
    const total = floats.reduce((sum, f) => sum + f.amount, 0);
    const itemsList = floats.map(f => `• ₹${f.amount.toLocaleString('en-IN')} — ${f.tag} (${f.notes || 'Float Inflow'}) deposited on ${new Date(f.created_at).toLocaleDateString('en-IN')}`).join('\n');
    
    const personLabel = personFilter === 'anbazhakan' || personFilter === 'dad' ? 'Anbazhakan' : personFilter === 'parimalam' || personFilter === 'mom' ? 'Parimalam' : personFilter === 'kishor' ? 'Kishor' : 'Family Member';

    const msg = `*CHIT FUND — FLOATING CAPITAL RESERVE RECORD*\n\n` +
      `Hello ${personLabel},\n` +
      `Here is your floating capital deposit record for Chit Fund payouts:\n\n` +
      `${itemsList}\n\n` +
      `*Total Float Available to Take Back / Recover: ₹${total.toLocaleString('en-IN')}*\n\n` +
      `You can recover this amount back into your bank account or cash box anytime.`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

  // Master Transaction Feed filtered by active wallet and type
  const filteredTransactions = useMemo(() => {
    return recentTransactions.filter((tx) => {
      const notes = (tx.notes || tx.description || '').toLowerCase();
      
      // Wallet account match
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

      // Type match
      let matchesType = true;
      if (ledgerTypeFilter !== 'all') {
        matchesType = tx.type === ledgerTypeFilter;
      }

      // Search match
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
      
      // Step 1: Debit the SOURCE bank via atomic RPC
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

      // Step 2: Record a PENDING transaction on the SOURCE wallet (not cash_in_hand)
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

      // Atomic credit to cash_in_hand
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
      // 1. Credit destination account
      await updateBalance(settleDestWallet, amount);

      // 2. Insert repayment transaction
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

      // 3. Update original spend note
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

  // 6. Inter-Vault Transfer (Full Double-Entry Accounting)
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

      // Step 1: Atomic debit from source
      const { data: debitData, error: debitErr } = await supabase.rpc('mutate_wallet_balance', {
        p_wallet: transferSource,
        p_delta: -amount,
        p_user_id: profile?.id || null,
      });

      if (debitErr || !debitData?.success) {
        alert('Failed to debit source account: ' + (debitData?.error || debitErr?.message));
        return;
      }

      // Step 2: Atomic credit to destination
      const { data: creditData, error: creditErr } = await supabase.rpc('mutate_wallet_balance', {
        p_wallet: transferDest,
        p_delta: amount,
        p_user_id: profile?.id || null,
      });

      if (creditErr || !creditData?.success) {
        // Rollback source debit
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
        action_description: `INTER-VAULT TRANSFER: ₹${amount.toLocaleString('en-IN')} moved from ${WALLET_META[transferSource].name} to ${WALLET_META[transferDest].name} (Double-entry logged).`,
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

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* ── 1. UNIFIED TREASURY HERO HEADER ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle background glow circle */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-indigo-300">
                Treasury &amp; Multi-Vault Liquidity
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <h2 className="text-2xl sm:text-4xl font-black font-mono tracking-tight text-white mt-1">
              {formatCurrency(totalTreasuryBalance)}
            </h2>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Physical cash box + 3 digital banking accounts synchronized
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => setActiveModal('denominations')}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all border border-white/15 active:scale-95 cursor-pointer shadow-sm"
            >
              <Calculator size={14} className="text-indigo-300" />
              <span>Count Cash (Tally)</span>
            </button>

            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/15 active:scale-95 cursor-pointer disabled:opacity-50"
              title="Refresh Ledger"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. FOUR CORE VAULT CARDS (Interactive GPay / Account Feed Selector) ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-[#AEABD8]">
            Accounts &amp; Vault Balances
          </span>
          {selectedWalletFilter !== 'all' && (
            <button
              onClick={() => setSelectedWalletFilter('all')}
              className="text-xs font-extrabold text-[#64CFF6] hover:underline transition-colors cursor-pointer"
            >
              Show All Accounts
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {(['cash_in_hand', 'kishor_bank', 'dad_bank', 'mom_bank'] as WalletType[]).map((wKey) => {
            const meta = WALLET_META[wKey];
            const Icon = meta.icon;
            const bal = balances[wKey] || 0;
            const isSelected = selectedWalletFilter === wKey;
            const isKishor = wKey === 'kishor_bank';

            return (
              <div
                key={wKey}
                onClick={() => setSelectedWalletFilter(prev => prev === wKey ? 'all' : wKey)}
                className={`${meta.bgGradient} border-2 rounded-2xl sm:rounded-3xl p-3 sm:p-4.5 cursor-pointer transition-all shadow-xs hover:shadow-lg active:scale-98 ${
                  isSelected 
                    ? 'border-[#6359E9] ring-4 ring-[#6359E9]/30 shadow-md scale-[1.02]' 
                    : meta.borderClass
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`w-8 h-8 rounded-xl ${meta.iconBg} flex items-center justify-center font-bold shadow-2xs`}>
                    <Icon size={16} />
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
                </div>

                <div className="min-w-0">
                  <div className={`text-xs sm:text-sm font-black truncate ${isKishor ? 'text-white' : 'text-white'}`}>
                    {meta.name}
                  </div>
                  <div className={`text-[10px] font-medium truncate ${isKishor ? 'text-white/80' : 'text-[#AEABD8]'}`}>
                    {meta.owner}
                  </div>
                  <div className={`text-base sm:text-2xl font-black font-mono tracking-tight mt-1 truncate ${isKishor ? 'text-white' : meta.textAccent}`}>
                    {formatCurrency(bal)}
                  </div>
                </div>

                <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[9px] sm:text-[10px] font-bold uppercase ${
                  isKishor ? 'border-white/20 text-white/70' : 'border-[#27264E] text-[#AEABD8]'
                }`}>
                  <span>{isSelected ? 'Viewing Feed' : 'Tap for Feed'}</span>
                  <ArrowRight size={10} className={isSelected ? 'text-[#64CFF6] font-bold' : ''} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. PARENT-FRIENDLY QUICK ACTION BUTTONS ─────────────────────────── */}
      <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm space-y-3">
        <span className="text-xs font-black uppercase tracking-wider text-[#AEABD8] block px-0.5">
          Quick Cash Actions
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Action 1: ATM to Cash Box */}
          <button
            onClick={() => setActiveModal('atm')}
            className="bg-[#141332] hover:bg-[#27264E] border border-[#27264E] text-white p-3 sm:p-3.5 rounded-2xl flex flex-col items-start gap-1.5 text-left transition-all active:scale-95 cursor-pointer group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-[#6359E9] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
              <Landmark size={16} />
            </div>
            <div className="min-w-0">
              <strong className="text-xs sm:text-sm font-black block text-white leading-tight">
                🏧 ATM to Cash Box
              </strong>
              <span className="text-[10px] text-[#AEABD8] font-medium block mt-0.5">
                Bank → Cash Box
              </span>
            </div>
          </button>

          {/* Action 2: Personal Spend / Draw */}
          <button
            onClick={() => setActiveModal('spend')}
            className="bg-[#141332] hover:bg-[#27264E] border border-[#27264E] text-white p-3 sm:p-3.5 rounded-2xl flex flex-col items-start gap-1.5 text-left transition-all active:scale-95 cursor-pointer group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-[#E41414] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
              <Coins size={16} />
            </div>
            <div className="min-w-0">
              <strong className="text-xs sm:text-sm font-black block text-white leading-tight">
                💸 Log Spend / Draw
              </strong>
              <span className="text-[10px] text-[#AEABD8] font-medium block mt-0.5">
                Petrol, Groceries, Dad
              </span>
            </div>
          </button>

          {/* Action 3: Deposit Float / Inflow */}
          <button
            onClick={() => setActiveModal('deposit')}
            className="bg-[#141332] hover:bg-[#27264E] border border-[#27264E] text-white p-3 sm:p-3.5 rounded-2xl flex flex-col items-start gap-1.5 text-left transition-all active:scale-95 cursor-pointer group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-[#02B15A] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
              <Plus size={16} />
            </div>
            <div className="min-w-0">
              <strong className="text-xs sm:text-sm font-black block text-white leading-tight">
                📥 Deposit Money
              </strong>
              <span className="text-[10px] text-[#AEABD8] font-medium block mt-0.5">
                Add Float / Inflow
              </span>
            </div>
          </button>

          {/* Action 4: Transfer between Accounts */}
          <button
            onClick={() => setActiveModal('transfer')}
            className="bg-[#141332] hover:bg-[#27264E] border border-[#27264E] text-white p-3 sm:p-3.5 rounded-2xl flex flex-col items-start gap-1.5 text-left transition-all active:scale-95 cursor-pointer group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-[#64CFF6] text-[#141332] flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
              <ArrowRightLeft size={16} />
            </div>
            <div className="min-w-0">
              <strong className="text-xs sm:text-sm font-black block text-white leading-tight">
                ⇄ Inter-Bank Transfer
              </strong>
              <span className="text-[10px] text-[#AEABD8] font-medium block mt-0.5">
                Move between Vaults
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ── 4. ATTENTION REQUIRED & FAMILY KHATABOOK ───────────────────────── */}
      <div className="space-y-4">
        {/* Pending ATM Relocation Banner */}
        {pendingRelocations.length > 0 && (
          <div className="bg-[#1D1D41] border border-[#FFBB38]/40 rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-sm animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-black text-[#FFBB38] uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle size={15} className="text-[#FFBB38] animate-pulse" />
                Pending Physical Cash Box Verification ({pendingRelocations.length})
              </h4>
              <span className="text-[10px] font-bold text-[#FFBB38] bg-[#FFBB38]/15 border border-[#FFBB38]/30 px-2 py-0.5 rounded-full">
                Step 2 Pending
              </span>
            </div>
            <p className="text-[11px] text-[#AEABD8] font-medium">
              Currency was debited from bank. Click below once notes are physically placed inside the Cash Box:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {pendingRelocations.map((reloc) => {
                const isVerifying = isVerifyingAtmId === reloc.id;
                return (
                  <div key={reloc.id} className="bg-[#141332] border border-[#27264E] p-3 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-[#AEABD8] uppercase block truncate">From: {WALLET_META[reloc.source]?.name}</span>
                      <span className="text-sm sm:text-base font-black text-white font-mono mt-0.5 block">{formatCurrency(reloc.amount)}</span>
                      <span className="text-[9px] text-[#AEABD8]/70 font-mono">{reloc.createdAt}</span>
                    </div>
                    <button
                      onClick={() => handleVerifyATM(reloc.id, reloc.amount, reloc.source, reloc.notes)}
                      disabled={isVerifying}
                      className="bg-[#02B15A] hover:bg-[#02B15A]/85 active:scale-95 text-white font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isVerifying ? <RefreshCw size={12} className="animate-spin" /> : <Check size={13} />}
                      <span>Confirm Inflow</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FAMILY KHATABOOK (FLOATS & PERSONAL DRAWS) ── */}
        <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
          {/* Khatabook Header & Tab Selector */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#27264E] pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#6359E9]/20 text-[#64CFF6] flex items-center justify-center font-bold">
                  <BookOpen size={16} />
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Family Khatabook · Capital &amp; Spends
                </h3>
                <span className="text-[10px] font-bold text-[#64CFF6] bg-[#6359E9]/20 border border-[#6359E9]/30 px-2 py-0.5 rounded-full hidden sm:inline-block">
                  குடும்ப கணக்கு
                </span>
              </div>
              <p className="text-xs text-[#AEABD8] mt-0.5">
                Track float capital provided by Dad, Mom, or Kishor to recover, &amp; personal cash draws to be repaid
              </p>
            </div>

            {/* Tab Switcher: Floating Capital vs Personal Draws */}
            <div className="flex items-center bg-[#141332] border border-[#27264E] p-1 rounded-2xl gap-1 shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={() => { setKhatabookTab('floats'); triggerHapticFeedback('light'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  khatabookTab === 'floats'
                    ? 'bg-[#02B15A] text-white shadow-xs'
                    : 'text-[#AEABD8] hover:text-white hover:bg-[#27264E]'
                }`}
              >
                <Plus size={13} />
                <span>Floating Capital</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  khatabookTab === 'floats' ? 'bg-[#02B15A]/80 text-white' : 'bg-[#27264E] text-[#AEABD8]'
                }`}>
                  {floatStats.activeCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { setKhatabookTab('draws'); triggerHapticFeedback('light'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  khatabookTab === 'draws'
                    ? 'bg-[#E41414] text-white shadow-xs'
                    : 'text-[#AEABD8] hover:text-white hover:bg-[#27264E]'
                }`}
              >
                <Coins size={13} />
                <span>Personal Draws</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  khatabookTab === 'draws' ? 'bg-[#E41414]/80 text-white' : 'bg-[#27264E] text-[#AEABD8]'
                }`}>
                  {personalDrawStats.activeCount}
                </span>
              </button>
            </div>
          </div>

          {/* Per-Person Stat Cards (Anbazhakan, Parimalam, Kishor, Total) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Anbazhakan */}
            <div 
              onClick={() => setKhatabookPersonFilter(prev => prev === 'anbazhakan' ? 'all' : 'anbazhakan')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                khatabookPersonFilter === 'anbazhakan' ? 'ring-2 ring-[#6359E9] bg-[#141332] border-[#6359E9]' : 'bg-[#141332] border-[#27264E] hover:border-[#6359E9]/40'
              }`}
            >
              <span className="text-[10px] font-bold text-[#AEABD8] uppercase block">Anbazhakan</span>
              <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
                khatabookTab === 'floats' ? 'text-[#02B15A]' : 'text-[#E41414]'
              }`}>
                {formatCurrency(khatabookTab === 'floats' ? floatStats.anbazhakan : personalDrawStats.anbazhakan)}
              </span>
              <span className="text-[9px] text-[#AEABD8]/70 font-medium block mt-0.5">
                {khatabookTab === 'floats' ? 'Float to take back' : 'Cash drawn to settle'}
              </span>
            </div>

            {/* Parimalam */}
            <div 
              onClick={() => setKhatabookPersonFilter(prev => prev === 'parimalam' ? 'all' : 'parimalam')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                khatabookPersonFilter === 'parimalam' ? 'ring-2 ring-[#6359E9] bg-[#141332] border-[#6359E9]' : 'bg-[#141332] border-[#27264E] hover:border-[#6359E9]/40'
              }`}
            >
              <span className="text-[10px] font-bold text-[#AEABD8] uppercase block">Parimalam</span>
              <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
                khatabookTab === 'floats' ? 'text-[#02B15A]' : 'text-[#E41414]'
              }`}>
                {formatCurrency(khatabookTab === 'floats' ? floatStats.parimalam : personalDrawStats.parimalam)}
              </span>
              <span className="text-[9px] text-[#AEABD8]/70 font-medium block mt-0.5">
                {khatabookTab === 'floats' ? 'Float to take back' : 'Cash drawn to settle'}
              </span>
            </div>

            {/* Kishor */}
            <div 
              onClick={() => setKhatabookPersonFilter(prev => prev === 'kishor' ? 'all' : 'kishor')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                khatabookPersonFilter === 'kishor' ? 'ring-2 ring-[#6359E9] bg-[#141332] border-[#6359E9]' : 'bg-[#141332] border-[#27264E] hover:border-[#6359E9]/40'
              }`}
            >
              <span className="text-[10px] font-bold text-[#AEABD8] uppercase block">Kishor</span>
              <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
                khatabookTab === 'floats' ? 'text-[#02B15A]' : 'text-[#E41414]'
              }`}>
                {formatCurrency(khatabookTab === 'floats' ? floatStats.kishor : personalDrawStats.kishor)}
              </span>
              <span className="text-[9px] text-[#AEABD8]/70 font-medium block mt-0.5">
                {khatabookTab === 'floats' ? 'Float to take back' : 'Cash drawn to settle'}
              </span>
            </div>

            {/* Total Pool */}
            <div 
              onClick={() => setKhatabookPersonFilter('all')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                khatabookTab === 'floats' ? 'bg-[#02B15A]/10 border-[#02B15A]/30' : 'bg-[#E41414]/10 border-[#E41414]/30'
              } ${khatabookPersonFilter === 'all' ? 'ring-2 ring-white/30' : ''}`}
            >
              <span className={`text-[10px] font-black uppercase block ${
                khatabookTab === 'floats' ? 'text-[#02B15A]' : 'text-[#E41414]'
              }`}>
                {khatabookTab === 'floats' ? 'Total Active Float' : 'Total Debt to Settle'}
              </span>
              <span className="text-base sm:text-lg font-black font-mono mt-0.5 block text-white">
                {formatCurrency(khatabookTab === 'floats' ? floatStats.total : personalDrawStats.total)}
              </span>
              <span className="text-[9px] text-[#AEABD8] font-medium block mt-0.5">
                {khatabookTab === 'floats' ? `${floatStats.activeCount} active items` : `${personalDrawStats.activeCount} active items`}
              </span>
            </div>
          </div>

          {/* Filter Row & WhatsApp Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
              {[
                { id: 'all', label: 'All Members' },
                { id: 'anbazhakan', label: 'Anbazhakan' },
                { id: 'parimalam', label: 'Parimalam' },
                { id: 'kishor', label: 'Kishor' },
              ].map((p) => {
                const isSelected = khatabookPersonFilter === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setKhatabookPersonFilter(p.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Direct WhatsApp Share / Reminder Button */}
            {khatabookTab === 'floats' ? (
              <a
                href={generateFloatWhatsAppSummary(khatabookPersonFilter)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <Share2 size={13} />
                <span>Share Float Record (WhatsApp)</span>
              </a>
            ) : (
              <a
                href={generateDrawWhatsAppReminder(khatabookPersonFilter)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <Send size={13} />
                <span>Send WhatsApp Reminder</span>
              </a>
            )}
          </div>

          {/* Tab 1: Floating Capital Items */}
          {khatabookTab === 'floats' && (
            <div className="space-y-3 pt-1">
              {(() => {
                const filteredFloats = computedFloatingDeposits
                  .filter(f => showRecoveredFloats ? true : f.status === 'active')
                  .filter(f => khatabookPersonFilter === 'all' ? true : f.depositedBy.toLowerCase().includes(khatabookPersonFilter.toLowerCase()));

                const recoveredCount = computedFloatingDeposits.filter(f => f.status === 'recovered').length;

                if (filteredFloats.length === 0) {
                  return (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center space-y-2">
                      <p className="text-xs font-bold text-gray-500">
                        No {khatabookPersonFilter !== 'all' ? `${khatabookPersonFilter} ` : ''}active floating capital deposits found.
                      </p>
                      <button
                        onClick={() => setActiveModal('deposit')}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
                      >
                        <Plus size={14} />
                        <span>Deposit New Float</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {filteredFloats.map((f) => {
                        const isRecovered = f.status === 'recovered';
                        const singleWhatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `*CHIT FUND — FLOATING CAPITAL RECORD*\n\n` +
                          `• Depositor: ${f.depositedBy}\n` +
                          `• Amount: ₹${f.amount.toLocaleString('en-IN')}\n` +
                          `• Purpose: ${f.tag} (${f.notes})\n` +
                          `• Vault: ${WALLET_META[f.walletType]?.name || f.walletType}\n` +
                          `• Date: ${new Date(f.created_at).toLocaleDateString('en-IN')}\n` +
                          `• Status: ${isRecovered ? 'Recovered' : 'Available to Take Back'}\n\n` +
                          `Recorded in Chit Fund Manager.`
                        )}`;

                        return (
                          <div 
                            key={f.id} 
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                              isRecovered 
                                ? 'bg-gray-50/60 border-gray-200 opacity-60' 
                                : 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black uppercase text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                                    {f.depositedBy}
                                  </span>
                                  <span className="text-[9px] font-mono text-gray-400">
                                    {new Date(f.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </span>
                                  {isRecovered && (
                                    <span className="text-[9px] font-black text-gray-500 bg-gray-200 px-1.5 py-0.2 rounded">
                                      Recovered
                                    </span>
                                  )}
                                </div>
                                <div className="text-base sm:text-lg font-black text-emerald-900 font-mono mt-1">
                                  {formatCurrency(f.amount)}
                                </div>
                                <p className="text-xs font-semibold text-gray-700 leading-snug mt-0.5">
                                  {f.notes || f.tag}
                                </p>
                                <span className="text-[10px] text-gray-400 font-medium block mt-1">
                                  Deposited into: {WALLET_META[f.walletType]?.name || f.walletType}
                                </span>
                              </div>

                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {!isRecovered ? (
                                  <button
                                    onClick={() => {
                                      setRecoveringFloat(f);
                                      setRecoverAmount(String(f.amount));
                                      setRecoverSourceWallet(f.walletType);
                                      setActiveModal('recover');
                                    }}
                                    className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black text-xs px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                                  >
                                    Take Back Float
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-2 py-1 rounded-lg">
                                    ✓ Settled
                                  </span>
                                )}

                                <a
                                  href={singleWhatsAppUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                                >
                                  <Share2 size={11} />
                                  <span>WhatsApp</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {recoveredCount > 0 && (
                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => setShowRecoveredFloats(!showRecoveredFloats)}
                          className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                        >
                          {showRecoveredFloats ? 'Hide Recovered Floats' : `Show ${recoveredCount} Recovered Floats`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab 2: Personal Draws Items */}
          {khatabookTab === 'draws' && (
            <div className="space-y-3 pt-1">
              {(() => {
                const filteredDraws = computedPersonalDraws
                  .filter(d => showSettledDraws ? true : d.status === 'outstanding')
                  .filter(d => khatabookPersonFilter === 'all' ? true : d.takenBy.toLowerCase().includes(khatabookPersonFilter.toLowerCase()));

                const settledCount = computedPersonalDraws.filter(d => d.status === 'settled').length;

                if (filteredDraws.length === 0) {
                  return (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center space-y-2">
                      <p className="text-xs font-bold text-gray-500">
                        No {khatabookPersonFilter !== 'all' ? `${khatabookPersonFilter} ` : ''}outstanding personal draws recorded.
                      </p>
                      <button
                        onClick={() => setActiveModal('spend')}
                        className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
                      >
                        <Plus size={14} />
                        <span>Log Personal Spend</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {filteredDraws.map((d) => {
                        const isSettled = d.status === 'settled';
                        const singleWhatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `*CHIT FUND — PERSONAL DRAW REMINDER*\n\n` +
                          `• Taken By: ${d.takenBy}\n` +
                          `• Amount: ₹${d.amount.toLocaleString('en-IN')}\n` +
                          `• Category: ${d.tag}\n` +
                          `• Description: ${d.description}\n` +
                          `• Taken From: ${WALLET_META[d.walletType]?.name || d.walletType}\n` +
                          `• Date: ${new Date(d.created_at).toLocaleDateString('en-IN')}\n` +
                          `• Status: ${isSettled ? 'Settled' : 'To Settle / Put Back'}\n\n` +
                          `Please put back the cash into the Chit Fund Box or Bank when convenient.`
                        )}`;

                        return (
                          <div 
                            key={d.id} 
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                              isSettled 
                                ? 'bg-gray-50/60 border-gray-200 opacity-60' 
                                : 'bg-rose-50/40 border-rose-200 hover:border-rose-300 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black uppercase text-rose-900 bg-rose-100/90 px-2 py-0.5 rounded-md">
                                    {d.takenBy}
                                  </span>
                                  <span className="text-[9px] font-bold text-gray-500 bg-gray-200/80 px-1.5 py-0.2 rounded">
                                    {d.tag}
                                  </span>
                                  <span className="text-[9px] font-mono text-gray-400">
                                    {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </span>
                                  {isSettled && (
                                    <span className="text-[9px] font-black text-gray-500 bg-gray-200 px-1.5 py-0.2 rounded">
                                      Settled
                                    </span>
                                  )}
                                </div>
                                <div className="text-base sm:text-lg font-black text-rose-900 font-mono mt-1">
                                  {formatCurrency(d.amount)}
                                </div>
                                <p className="text-xs font-semibold text-gray-700 leading-snug mt-0.5">
                                  {d.description || d.tag}
                                </p>
                                <span className="text-[10px] text-gray-400 font-medium block mt-1">
                                  Taken from: {WALLET_META[d.walletType]?.name || d.walletType}
                                </span>
                              </div>

                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {!isSettled ? (
                                  <button
                                    onClick={() => {
                                      setSettlingDraw(d);
                                      setSettleAmount(String(d.amount));
                                      setSettleDestWallet(d.walletType);
                                      setActiveModal('settle');
                                    }}
                                    className="bg-rose-700 hover:bg-rose-800 active:scale-95 text-white font-black text-xs px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                                  >
                                    Put Back Cash
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-2 py-1 rounded-lg">
                                    ✓ Settled
                                  </span>
                                )}

                                <a
                                  href={singleWhatsAppUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer"
                                >
                                  <Send size={11} />
                                  <span>WhatsApp</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {settledCount > 0 && (
                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => setShowSettledDraws(!showSettledDraws)}
                          className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                        >
                          {showSettledDraws ? 'Hide Settled Draws' : `Show ${settledCount} Settled Draws`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. UNIFIED STATEMENT & ACTIVITY TIMELINE ────────────────────────── */}
      <div className="bg-[#1D1D41] border border-[#27264E] rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm">
        {/* Header & Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27264E] pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <History size={18} className="text-[#64CFF6]" />
              <span>
                {selectedWalletFilter === 'all' 
                  ? 'Unified Treasury Statement' 
                  : `${WALLET_META[selectedWalletFilter].name} Statement`}
              </span>
            </h3>
            <p className="text-xs text-[#AEABD8] mt-0.5">
              Chronological feed of collections, ATM withdrawals, spends and transfers
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AEABD8]" />
              <input
                type="text"
                placeholder="Search statements..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="w-full bg-[#141332] border border-[#27264E] focus:border-[#6359E9] rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-white placeholder-[#AEABD8]/60 focus:outline-none"
              />
            </div>

            <button
              onClick={() => window.print()}
              className="p-2 bg-[#141332] hover:bg-[#27264E] border border-[#27264E] text-[#AEABD8] hover:text-white rounded-xl transition-colors cursor-pointer"
              title="Print Statement"
            >
              <Printer size={15} />
            </button>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
          {[
            { id: 'all', label: 'All Transactions' },
            { id: 'collection', label: '📥 Collections' },
            { id: 'atm_withdrawal', label: '🏧 ATM Cash' },
            { id: 'personal_draw', label: '💸 Spends / Draws' },
            { id: 'transfer', label: '⇄ Transfers & Floats' },
            { id: 'payout', label: '🏆 Auction Payouts' },
          ].map((pill) => {
            const isSelected = ledgerTypeFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setLedgerTypeFilter(pill.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected 
                    ? 'bg-[#6359E9] text-white border-[#6359E9] shadow-sm' 
                    : 'bg-[#141332] hover:bg-[#27264E] text-[#AEABD8] hover:text-white border-[#27264E]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Statement Timeline Feed List */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#AEABD8]">
              No transactions match your search filter.
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const { isCredit, badgeLabel, badgeColor } = getTxDirection(tx, selectedWalletFilter);
              const dateLabel = tx.created_at 
                ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Recent';

              return (
                <div 
                  key={tx.id} 
                  className="p-3 sm:p-4 bg-[#141332] border border-[#27264E] rounded-xl sm:rounded-2xl flex items-center justify-between gap-2.5 sm:gap-3 hover:border-[#6359E9]/40 transition-colors"
                >
                  <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className={`text-[9px] sm:text-[10px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-md border ${badgeColor}`}>
                        {badgeLabel}
                      </span>
                      <span className="text-[10px] text-[#AEABD8] font-mono">{dateLabel}</span>
                      <span className="text-[10px] text-[#AEABD8] font-bold bg-[#27264E] px-1.5 py-0.2 rounded">
                        {WALLET_META[tx.wallet_type]?.name || tx.wallet_type}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white leading-snug truncate mt-0.5">
                      {tx.notes || tx.description || 'Treasury Ledger Movement'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-sm sm:text-base font-black font-mono block ${isCredit ? 'text-[#02B15A]' : 'text-[#E41414]'}`}>
                      {isCredit ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── MODAL 1: ATM WITHDRAWAL MODAL ───────────────────────────────────── */}
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
                      <div className="text-[10px] font-bold truncate">{WALLET_META[bKey].name}</div>
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

      {/* ── MODAL 2: PERSONAL SPEND / DRAW MODAL ─────────────────────────────── */}
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
                    <option value="cash_in_hand">Cash Box ({formatCurrency(balances.cash_in_hand)})</option>
                    <option value="kishor_bank">Kishor Bank ({formatCurrency(balances.kishor_bank)})</option>
                    <option value="dad_bank">Anbazhakan's Bank ({formatCurrency(balances.dad_bank)})</option>
                    <option value="mom_bank">Parimalam's Bank ({formatCurrency(balances.mom_bank)})</option>
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

      {/* ── MODAL 3: DEPOSIT FLOAT / INFLOW MODAL ────────────────────────────── */}
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

      {/* ── MODAL 4: INTER-BANK TRANSFER MODAL ──────────────────────────────── */}
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

      {/* ── MODAL 5: SETTLE PERSONAL DEBT (PUT BACK) ────────────────────────── */}
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

      {/* ── MODAL 6: DENOMINATIONS / NOTE COUNTER MODAL ─────────────────────── */}
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
              {/* Note Row Inputs */}
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

              {/* Tally Summary Card */}
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-2 mt-3">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">Physical Notes Counted:</span>
                  <span className="font-mono text-emerald-400 text-sm font-black">{formatCurrency(calculatedPhysicalCash)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-400">System Cash in Hand:</span>
                  <span className="font-mono text-white">{formatCurrency(balances.cash_in_hand)}</span>
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

      {/* ── MODAL 7: RECOVER FLOATING CAPITAL MODAL ────────────────────────── */}
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
                  <option value="cash_in_hand">Physical Cash Box ({formatCurrency(balances.cash_in_hand)})</option>
                  <option value="kishor_bank">Kishor Bank (UPI) ({formatCurrency(balances.kishor_bank)})</option>
                  <option value="dad_bank">Dad's Bank ({formatCurrency(balances.dad_bank)})</option>
                  <option value="mom_bank">Mom's Bank ({formatCurrency(balances.mom_bank)})</option>
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
