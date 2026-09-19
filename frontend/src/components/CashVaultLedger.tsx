'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWallet, WalletType } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase/client';
import { 
  Wallet, 
  Landmark, 
  Send, 
  ShieldAlert, 
  DollarSign, 
  Check, 
  AlertCircle, 
  Mic, 
  Coins, 
  Scale, 
  Plus, 
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Banknote,
  CheckCircle2,
  X,
  History,
  Activity,
  Calculator,
  CreditCard,
  Layers,
  Search,
  Filter,
  Download,
  Share2,
  FileText,
  Printer,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  SlidersHorizontal,
  ArrowRightLeft,
  PieChart
} from 'lucide-react';

export type CashHandlingSubtab = 
  | 'overview' 
  | 'wallets' 
  | 'transfers' 
  | 'payouts' 
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
  { id: 'payouts', label: 'Payouts', icon: Scale, description: 'Auction prize pot disbursals, split accounts & liabilities' },
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
  amount: number;
  tag: 'Personal Expense' | 'Petrol' | 'Maintenance' | 'Groceries' | 'Collection Visits' | 'Tea & Refreshments' | 'Emergency Cash';
  description: string;
  adminName: string;
  timestamp: string;
}

interface DebtLiability {
  id: string;
  groupId: string;
  groupName: string;
  month: number;
  winnerName: string;
  phone?: string;
  ticketNumber?: number;
  totalPayout: number;
  paidAmount: number;
  liabilityAmount: number;
  winningDiscount?: number;
  winningBidderId?: string;
  status: 'Pending' | 'Partial' | 'Complete';
  auctionId?: string;
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
  const [chitGroups, setChitGroups] = useState<any[]>([]);
  const [auctionLogs, setAuctionLogs] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TreasuryTx[]>([]);

  // Operational State
  const [relocations, setRelocations] = useState<Relocation[]>([]);
  const [personalDraws, setPersonalDraws] = useState<PersonalDraw[]>([]);

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
  const [spendTag, setSpendTag] = useState<PersonalDraw['tag']>('Petrol');
  const [spendDesc, setSpendDesc] = useState<string>('');
  const [spendWallet, setSpendWallet] = useState<WalletType>('cash_in_hand');

  // Form State: Payout Split
  const [payoutGroupId, setPayoutGroupId] = useState<string>('');
  const [payoutSelectedAuctionId, setPayoutSelectedAuctionId] = useState<string>('');
  const [payoutWinnerId, setPayoutWinnerId] = useState<string>('');
  const [payoutWinnerName, setPayoutWinnerName] = useState<string>('');
  const [payoutMonth, setPayoutMonth] = useState<number>(1);
  const [payoutTotalPot, setPayoutTotalPot] = useState<string>('');
  const [payoutAlreadyPaid, setPayoutAlreadyPaid] = useState<number>(0);
  const [payoutRemainingLiability, setPayoutRemainingLiability] = useState<number>(0);
  const [payoutBank1Wallet, setPayoutBank1Wallet] = useState<WalletType>('dad_bank');
  const [payoutBank1Amount, setPayoutBank1Amount] = useState<string>('');
  const [payoutBank2Wallet, setPayoutBank2Wallet] = useState<WalletType>('kishor_bank');
  const [payoutBank2Amount, setPayoutBank2Amount] = useState<string>('');
  const [payoutCashAmount, setPayoutCashAmount] = useState<string>('');
  const [payoutMomAmount, setPayoutMomAmount] = useState<string>('');
  const [payoutRefNotes, setPayoutRefNotes] = useState<string>('');
  const [isProcessingPayout, setIsProcessingPayout] = useState<boolean>(false);

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

      // 1. Fetch groups
      const { data: groups } = await supabase
        .from('chit_groups')
        .select('*')
        .order('created_at', { ascending: true });

      if (groups && groups.length > 0) {
        setChitGroups(groups);
        setPayoutGroupId(prev => prev || groups[0].id);
      }

      // 2. Fetch auction logs
      const { data: auctions } = await supabase
        .from('auction_logs')
        .select(`
          id,
          group_id,
          month,
          winning_bidder_id,
          winning_discount,
          is_laaba_seetu,
          created_at,
          profiles:winning_bidder_id (
            id,
            full_name,
            phone_number
          )
        `)
        .order('month', { ascending: false });

      if (auctions) {
        setAuctionLogs(auctions);
      }

      // 3. Fetch group members
      const { data: members } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          ticket_number,
          profile_id,
          has_won_regular,
          custom_installment,
          profiles:profile_id (
            id,
            full_name,
            phone_number
          )
        `);

      if (members) {
        setGroupMembers(members);
      }

      // 4. Fetch treasury transactions
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
      accountNumber: '•••• 3108 · Auction Disbursements',
      typeLabel: 'Disbursement Vault · Primary Banking',
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
      typeLabel: 'Reserve Vault · Secondary Banking',
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

  const walletStats = useMemo(() => {
    const txs = walletSpecificTxs;
    const totalInflow = txs
      .filter(t => t.type === 'collection' || (t.type === 'transfer' && t.notes?.includes(`to ${selectedWalletDetail}`)))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const totalOutflow = txs
      .filter(t => t.type === 'payout' || t.type === 'personal_draw' || t.type === 'atm_withdrawal' || (t.type === 'transfer' && t.notes?.includes(`from ${selectedWalletDetail}`)))
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

    await updateBalance(spendWallet, -amount);

    const desc = spendDesc.trim() || `${spendTag} spend recorded by ${activeAdminName}`;
    const newDraw: PersonalDraw = {
      id: Math.random().toString(),
      amount,
      tag: spendTag,
      description: desc,
      adminName: activeAdminName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setPersonalDraws([newDraw, ...personalDraws]);

    await supabase.from('transactions').insert([
      {
        wallet_type: spendWallet,
        type: 'personal_draw',
        status: 'completed',
        amount: amount,
        notes: `[${spendTag}] ${desc}`,
        created_by: profile?.id || null,
      }
    ]);

    setSpendAmount('');
    setSpendDesc('');
    await fetchData();
  };

  // Action: Delete Spend & Refund
  const handleDeletePersonalDraw = async (drawId: string, amount: number) => {
    await updateBalance(spendWallet, amount);
    setPersonalDraws(prev => prev.filter(d => d.id !== drawId));
    alert(`Refunded ${formatCurrency(amount)} back to ${WALLET_META[spendWallet].name}.`);
  };

  // ── Derived Live Outstanding Payout Debt Liabilities (from Supabase) ──
  const liveLiabilities = useMemo(() => {
    const list: DebtLiability[] = [];

    // 1. Compute from auction_logs
    auctionLogs.forEach((a) => {
      const group = chitGroups.find((g) => g.id === a.group_id);
      const totalVal = Number(group?.total_value) || 200000;
      const discount = Number(a.winning_discount || 0);
      const netPayout = Number(a.net_payout) || (totalVal - discount);

      const member = groupMembers.find(
        (m) => m.group_id === a.group_id && (m.profile_id === a.winning_bidder_id || m.id === a.winning_bidder_id)
      );
      const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      const winnerName = member?.profiles?.full_name || prof?.full_name || (a as any).winner_name || 'Subscriber';
      const winnerPhone = member?.profiles?.phone_number || prof?.phone_number || '';
      const ticketNum = member?.ticket_number;

      // Find all payout transactions recorded for this group & month / winner
      const monthPattern = new RegExp(`\\bMonth\\s+${a.month}\\b|\\bM${a.month}\\b`, 'i');
      const matchingTxs = recentTransactions.filter((t) =>
        t.type === 'payout' &&
        t.group_id === a.group_id &&
        (
          (t.notes && monthPattern.test(t.notes)) ||
          t.profile_id === a.winning_bidder_id ||
          (member && (t.group_member_id === member.id || t.profile_id === member.profile_id))
        )
      );

      const amountPaid = matchingTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const remainingLiability = Math.max(0, netPayout - amountPaid);
      const status: 'Pending' | 'Partial' | 'Complete' =
        amountPaid >= netPayout && netPayout > 0 ? 'Complete' : amountPaid > 0 ? 'Partial' : 'Pending';

      list.push({
        id: a.id,
        auctionId: a.id,
        groupId: a.group_id,
        groupName: group?.name || 'Group',
        month: Number(a.month),
        winnerName,
        phone: winnerPhone,
        ticketNumber: ticketNum,
        totalPayout: netPayout,
        paidAmount: amountPaid,
        liabilityAmount: remainingLiability,
        winningDiscount: discount,
        winningBidderId: a.winning_bidder_id,
        status,
      });
    });

    // 2. Check won members in group_members without an auction_logs row
    groupMembers.filter((m) => m.has_won_regular).forEach((wm) => {
      const alreadyIncluded = list.some(
        (l) => l.groupId === wm.group_id && (l.winningBidderId === wm.profile_id || l.ticketNumber === wm.ticket_number)
      );
      if (!alreadyIncluded) {
        const group = chitGroups.find((g) => g.id === wm.group_id);
        const totalVal = Number(group?.total_value) || 200000;
        const netPayout = totalVal - 5000;
        const matchingTxs = recentTransactions.filter(
          (t) =>
            t.type === 'payout' &&
            t.group_id === wm.group_id &&
            (t.profile_id === wm.profile_id || t.group_member_id === wm.id)
        );
        const amountPaid = matchingTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const remainingLiability = Math.max(0, netPayout - amountPaid);
        const status: 'Pending' | 'Partial' | 'Complete' =
          amountPaid >= netPayout && netPayout > 0 ? 'Complete' : amountPaid > 0 ? 'Partial' : 'Pending';

        list.push({
          id: wm.id,
          groupId: wm.group_id,
          groupName: group?.name || 'Group',
          month: 1,
          winnerName: wm.profiles?.full_name || `Member (Ticket #${wm.ticket_number})`,
          phone: wm.profiles?.phone_number || '',
          ticketNumber: wm.ticket_number,
          totalPayout: netPayout,
          paidAmount: amountPaid,
          liabilityAmount: remainingLiability,
          winningDiscount: 5000,
          winningBidderId: wm.profile_id,
          status,
        });
      }
    });

    return list;
  }, [auctionLogs, chitGroups, groupMembers, recentTransactions]);

  // Only unsettled / pending debt liabilities
  const pendingLiabilities = useMemo(() => {
    return liveLiabilities.filter((l) => l.liabilityAmount > 0);
  }, [liveLiabilities]);

  const totalOutstandingLiability = useMemo(() => {
    return pendingLiabilities.reduce((sum, l) => sum + l.liabilityAmount, 0);
  }, [pendingLiabilities]);

  // Auctions for currently selected group in Payout form
  const selectedGroupAuctions = useMemo(() => {
    if (!payoutGroupId) return [];
    return liveLiabilities.filter((l) => l.groupId === payoutGroupId);
  }, [liveLiabilities, payoutGroupId]);

  // Synchronize payout form when group or auctions change
  useEffect(() => {
    if (selectedGroupAuctions.length > 0) {
      const activeAuction = selectedGroupAuctions.find((a) => a.id === payoutSelectedAuctionId) || selectedGroupAuctions[0];
      setPayoutSelectedAuctionId(activeAuction.id);
      setPayoutMonth(activeAuction.month);
      setPayoutWinnerId(activeAuction.winningBidderId || '');
      setPayoutWinnerName(activeAuction.winnerName);
      setPayoutTotalPot(String(activeAuction.totalPayout));
      setPayoutAlreadyPaid(activeAuction.paidAmount);
      setPayoutRemainingLiability(activeAuction.liabilityAmount);
    } else {
      const grp = chitGroups.find((g) => g.id === payoutGroupId);
      const val = Number(grp?.total_value) || 200000;
      setPayoutSelectedAuctionId('');
      setPayoutMonth(grp?.current_month || 1);
      setPayoutWinnerId('');
      setPayoutWinnerName('');
      setPayoutTotalPot(String(val));
      setPayoutAlreadyPaid(0);
      setPayoutRemainingLiability(val);
    }
  }, [payoutGroupId, selectedGroupAuctions, payoutSelectedAuctionId]);

  // Select auction in form
  const handleSelectAuction = (auctionId: string) => {
    const target = selectedGroupAuctions.find((a) => a.id === auctionId);
    if (target) {
      setPayoutSelectedAuctionId(target.id);
      setPayoutMonth(target.month);
      setPayoutWinnerId(target.winningBidderId || '');
      setPayoutWinnerName(target.winnerName);
      setPayoutTotalPot(String(target.totalPayout));
      setPayoutAlreadyPaid(target.paidAmount);
      setPayoutRemainingLiability(target.liabilityAmount);
    }
  };

  // Pre-fill form from liability list
  const handlePreFillDisbursement = (liab: DebtLiability) => {
    setPayoutGroupId(liab.groupId);
    setPayoutSelectedAuctionId(liab.id);
    setPayoutMonth(liab.month);
    setPayoutWinnerId(liab.winningBidderId || '');
    setPayoutWinnerName(liab.winnerName);
    setPayoutTotalPot(String(liab.totalPayout));
    setPayoutAlreadyPaid(liab.paidAmount);
    setPayoutRemainingLiability(liab.liabilityAmount);

    // Smart vault split suggestion based on available balances:
    const rem = liab.liabilityAmount;
    if (balances.dad_bank >= rem) {
      setPayoutBank1Amount(String(rem));
      setPayoutBank2Amount('');
      setPayoutCashAmount('');
      setPayoutMomAmount('');
    } else if (balances.kishor_bank >= rem) {
      setPayoutBank1Amount('');
      setPayoutBank2Amount(String(rem));
      setPayoutCashAmount('');
      setPayoutMomAmount('');
    } else if (balances.cash_in_hand >= rem) {
      setPayoutBank1Amount('');
      setPayoutBank2Amount('');
      setPayoutCashAmount(String(rem));
      setPayoutMomAmount('');
    } else {
      const dadUse = Math.min(balances.dad_bank, rem);
      const remAfterDad = rem - dadUse;
      const kishorUse = Math.min(balances.kishor_bank, remAfterDad);
      const cashUse = Math.min(balances.cash_in_hand, rem - dadUse - kishorUse);

      setPayoutBank1Amount(dadUse > 0 ? String(dadUse) : '');
      setPayoutBank2Amount(kishorUse > 0 ? String(kishorUse) : '');
      setPayoutCashAmount(cashUse > 0 ? String(cashUse) : '');
      setPayoutMomAmount('');
    }
  };

  // Action: Disburse Prize Payout
  const handleDisbursePrizePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const b1Amt = Number(payoutBank1Amount) || 0;
    const b2Amt = Number(payoutBank2Amount) || 0;
    const cashAmt = Number(payoutCashAmount) || 0;
    const momAmt = Number(payoutMomAmount) || 0;
    const totalDisbursing = b1Amt + b2Amt + cashAmt + momAmt;

    if (totalDisbursing <= 0) {
      alert('Please enter a valid disbursement amount from at least one vault.');
      return;
    }

    // Liquidity Checks
    if (b1Amt > 0 && balances[payoutBank1Wallet] < b1Amt) {
      alert(`Insufficient funds in ${WALLET_META[payoutBank1Wallet].name}. Available: ${formatCurrency(balances[payoutBank1Wallet])}`);
      return;
    }
    if (b2Amt > 0 && balances[payoutBank2Wallet] < b2Amt) {
      alert(`Insufficient funds in ${WALLET_META[payoutBank2Wallet].name}. Available: ${formatCurrency(balances[payoutBank2Wallet])}`);
      return;
    }
    if (cashAmt > 0 && balances.cash_in_hand < cashAmt) {
      alert(`Insufficient funds in Physical Cash Box. Available: ${formatCurrency(balances.cash_in_hand)}`);
      return;
    }
    if (momAmt > 0 && balances.mom_bank < momAmt) {
      alert(`Insufficient funds in Mom Bank. Available: ${formatCurrency(balances.mom_bank)}`);
      return;
    }

    const group = chitGroups.find((g) => g.id === payoutGroupId);
    const targetAuction = auctionLogs.find((a) => a.group_id === payoutGroupId && Number(a.month) === Number(payoutMonth));
    const targetMember = groupMembers.find(
      (m) => m.group_id === payoutGroupId && (m.profile_id === payoutWinnerId || m.id === payoutWinnerId)
    );
    const winnerProfileId = targetAuction?.winning_bidder_id || targetMember?.profile_id || payoutWinnerId || null;
    const winnerName = payoutWinnerName || targetMember?.profiles?.full_name || targetAuction?.profiles?.full_name || 'Prize Winner';

    setIsProcessingPayout(true);
    try {
      // Execute wallet debits
      if (b1Amt > 0) await updateBalance(payoutBank1Wallet, -b1Amt);
      if (b2Amt > 0) await updateBalance(payoutBank2Wallet, -b2Amt);
      if (cashAmt > 0) await updateBalance('cash_in_hand', -cashAmt);
      if (momAmt > 0) await updateBalance('mom_bank', -momAmt);

      // Insert payout transactions
      const txInserts: any[] = [];
      const baseNote = `Auction Prize Pot Payout · ${group?.name || 'Group'} (M${payoutMonth}) to ${winnerName}${payoutRefNotes ? ` · Ref: ${payoutRefNotes}` : ''}`;

      if (b1Amt > 0) {
        txInserts.push({
          group_id: payoutGroupId,
          profile_id: winnerProfileId,
          group_member_id: targetMember?.id || null,
          wallet_type: payoutBank1Wallet,
          type: 'payout',
          status: 'completed',
          amount: b1Amt,
          notes: `${baseNote} (via ${WALLET_META[payoutBank1Wallet].name})`,
          created_by: profile?.id || null,
        });
      }
      if (b2Amt > 0) {
        txInserts.push({
          group_id: payoutGroupId,
          profile_id: winnerProfileId,
          group_member_id: targetMember?.id || null,
          wallet_type: payoutBank2Wallet,
          type: 'payout',
          status: 'completed',
          amount: b2Amt,
          notes: `${baseNote} (via ${WALLET_META[payoutBank2Wallet].name})`,
          created_by: profile?.id || null,
        });
      }
      if (cashAmt > 0) {
        txInserts.push({
          group_id: payoutGroupId,
          profile_id: winnerProfileId,
          group_member_id: targetMember?.id || null,
          wallet_type: 'cash_in_hand',
          type: 'payout',
          status: 'completed',
          amount: cashAmt,
          notes: `${baseNote} (via Physical Cash Box)`,
          created_by: profile?.id || null,
        });
      }
      if (momAmt > 0) {
        txInserts.push({
          group_id: payoutGroupId,
          profile_id: winnerProfileId,
          group_member_id: targetMember?.id || null,
          wallet_type: 'mom_bank',
          type: 'payout',
          status: 'completed',
          amount: momAmt,
          notes: `${baseNote} (via Mom Bank)`,
          created_by: profile?.id || null,
        });
      }

      if (txInserts.length > 0) {
        await supabase.from('transactions').insert(txInserts);
      }

      // Record audit log
      await supabase.from('security_audit_logs').insert({
        action_description: `PRIZE POT DISBURSEMENT: Disbursed ${formatCurrency(totalDisbursing)} for "${group?.name || 'Group'}" (Month ${payoutMonth}) to ${winnerName} across treasury vaults.`,
        target_table: 'transactions',
      });

      setPayoutBank1Amount('');
      setPayoutBank2Amount('');
      setPayoutCashAmount('');
      setPayoutMomAmount('');
      setPayoutRefNotes('');
      await fetchData();

      alert(`✅ Successfully disbursed ${formatCurrency(totalDisbursing)} to ${winnerName}!`);
    } catch (err) {
      console.error('Error disbursing payout:', err);
      alert('Failed to disburse prize payout. Please try again.');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  // Action: Quick Clear Liability from a specific vault
  const handleQuickClearLiability = async (liab: DebtLiability, wallet: WalletType) => {
    if (balances[wallet] < liab.liabilityAmount) {
      alert(`Insufficient funds in ${WALLET_META[wallet].name}. Available: ${formatCurrency(balances[wallet])}, Required: ${formatCurrency(liab.liabilityAmount)}`);
      return;
    }

    const confirm = window.confirm(
      `Disburse remaining liability ${formatCurrency(liab.liabilityAmount)} to ${liab.winnerName} from ${WALLET_META[wallet].name}?`
    );
    if (!confirm) return;

    try {
      // 1. Debit wallet
      await updateBalance(wallet, -liab.liabilityAmount);

      // 2. Insert transaction
      const baseNote = `Auction Prize Pot Payout · ${liab.groupName} (M${liab.month}) to ${liab.winnerName} (via ${WALLET_META[wallet].name})`;
      await supabase.from('transactions').insert([
        {
          group_id: liab.groupId,
          profile_id: liab.winningBidderId || null,
          wallet_type: wallet,
          type: 'payout',
          status: 'completed',
          amount: liab.liabilityAmount,
          notes: baseNote,
          created_by: profile?.id || null,
        },
      ]);

      // 3. Insert audit log
      await supabase.from('security_audit_logs').insert({
        action_description: `PRIZE POT LIABILITY SETTLED: Fully cleared ${formatCurrency(liab.liabilityAmount)} for "${liab.groupName}" (Month ${liab.month}) to ${liab.winnerName} from ${WALLET_META[wallet].name}.`,
        target_table: 'transactions',
      });

      await fetchData();
      alert(`✅ Successfully cleared ${formatCurrency(liab.liabilityAmount)} liability for ${liab.winnerName}!`);
    } catch (err) {
      console.error('Error clearing liability:', err);
      alert('Failed to clear debt liability. Please try again.');
    }
  };

  // Action: Save Denomination Count
  const handleSaveDenominations = async () => {
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <ArrowRightLeft size={14} className="text-emerald-400" /> Move Money
              </button>
              <button
                onClick={() => setActiveSubtab('payouts')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Scale size={14} className="text-purple-400" /> Disburse Pot
              </button>
              <button
                onClick={() => setActiveSubtab('spends')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Coins size={14} className="text-rose-400" /> Log Spend
              </button>
              <button
                onClick={() => setActiveSubtab('denominations')}
                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Calculator size={14} className="text-amber-400" /> Count Cash
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
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                View Complete Ledger →
              </button>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {recentTransactions.slice(0, 8).map((tx) => {
                const isCredit = tx.type === 'collection';
                const dateLabel = tx.created_at 
                  ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Recent';

                return (
                  <div key={tx.id} className="p-3.5 bg-gray-50/80 border border-gray-100 rounded-2xl flex items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                          isCredit 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : tx.type === 'payout' 
                            ? 'bg-purple-50 text-purple-700 border-purple-200' 
                            : tx.type === 'transfer'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {tx.type.replace(/_/g, ' ')}
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
                    className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Plus size={15} className="text-emerald-400" /> Add / Inflow
                  </button>
                  <button
                    onClick={() => {
                      setTransferSource(selectedWalletDetail);
                      setActiveSubtab('transfers');
                    }}
                    className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <ArrowRightLeft size={15} className="text-blue-400" /> Transfer
                  </button>
                  <button
                    onClick={() => {
                      setSpendWallet(selectedWalletDetail);
                      setActiveSubtab('spends');
                    }}
                    className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Coins size={15} className="text-rose-400" /> Spend / Draw
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 3 Monthly Flow Metric Cards */}
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
                  const isCredit = tx.type === 'collection' || (tx.type === 'transfer' && tx.notes?.includes(`to ${selectedWalletDetail}`));
                  const dateLabel = tx.created_at 
                    ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Recent';

                  return (
                    <div key={tx.id} className="p-4 bg-gray-50/70 border border-gray-100 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                            isCredit 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {tx.type.replace(/_/g, ' ')}
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

      {/* ── SUBTAB 3: MOVE MONEY & TRANSFERS ── */}
      {activeSubtab === 'transfers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Inter-Vault Transfer Box */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-blue-600" />
                Inter-Vault Cash / Bank Transfer
              </h3>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
                Instant Transfer
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
                    <option value="cash_in_hand">Cash Box</option>
                    <option value="kishor_bank">Kishor Bank</option>
                    <option value="dad_bank">Dad Bank</option>
                    <option value="mom_bank">Mom Bank</option>
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
                <Scale size={16} className="text-indigo-600" />
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
      )}

      {/* ── SUBTAB 4: PRIZE POT DISBURSEMENTS ── */}
      {activeSubtab === 'payouts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Winner Prize Pot Payout Form */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                  <Scale size={16} className="text-purple-600" />
                  Winner Prize Pot Disbursement Desk
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Multi-vault prize pot distribution synchronized with live auctions
                </p>
              </div>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-full">
                Split Accounts
              </span>
            </div>

            <form onSubmit={handleDisbursePrizePayout} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Chit Group</label>
                  <select
                    value={payoutGroupId}
                    onChange={(e) => {
                      setPayoutGroupId(e.target.value);
                      setPayoutSelectedAuctionId('');
                    }}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  >
                    {chitGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({formatCurrency(g.total_value)})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Auction &amp; Winner</label>
                  <select
                    value={payoutSelectedAuctionId}
                    onChange={(e) => handleSelectAuction(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  >
                    {selectedGroupAuctions.length === 0 ? (
                      <option value="">No recorded auctions for this group</option>
                    ) : (
                      selectedGroupAuctions.map((a) => (
                        <option key={a.id} value={a.id}>
                          M{a.month}: {a.winnerName} {a.ticketNumber ? `(#${a.ticketNumber})` : ''} · {a.status === 'Complete' ? '✅ Settled' : `Pending ${formatCurrency(a.liabilityAmount)}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Selected Winner Status Overview Banner */}
              <div className="bg-purple-50/60 border border-purple-200/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-purple-900">
                      {payoutWinnerName || 'Select an Auction Winner'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">
                      Month {payoutMonth}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    payoutRemainingLiability <= 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : payoutAlreadyPaid > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {payoutRemainingLiability <= 0 ? 'Fully Disbursed' : payoutAlreadyPaid > 0 ? 'Partial Payout' : 'Pending Payout'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-purple-100/80 text-center">
                  <div className="bg-white/80 rounded-xl p-2 border border-purple-100/60">
                    <span className="text-[9px] font-bold text-gray-500 uppercase block">Net Prize Pot</span>
                    <span className="text-xs font-black font-mono text-gray-900 block mt-0.5">
                      {formatCurrency(Number(payoutTotalPot) || 0)}
                    </span>
                  </div>
                  <div className="bg-white/80 rounded-xl p-2 border border-purple-100/60">
                    <span className="text-[9px] font-bold text-gray-500 uppercase block">Paid So Far</span>
                    <span className="text-xs font-black font-mono text-emerald-700 block mt-0.5">
                      {formatCurrency(payoutAlreadyPaid)}
                    </span>
                  </div>
                  <div className="bg-white/80 rounded-xl p-2 border border-purple-100/60">
                    <span className="text-[9px] font-bold text-rose-600 uppercase block">Remaining Due</span>
                    <span className="text-xs font-black font-mono text-rose-600 block mt-0.5">
                      {formatCurrency(payoutRemainingLiability)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Wallet Split Allocation */}
              <div className="p-4 bg-slate-50 border border-gray-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">Disbursement Split Across 4 Vaults</span>
                  {payoutRemainingLiability > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const rem = payoutRemainingLiability;
                        if (balances.dad_bank >= rem) {
                          setPayoutBank1Amount(String(rem));
                          setPayoutBank2Amount('');
                          setPayoutCashAmount('');
                          setPayoutMomAmount('');
                        } else if (balances.cash_in_hand >= rem) {
                          setPayoutBank1Amount('');
                          setPayoutBank2Amount('');
                          setPayoutCashAmount(String(rem));
                          setPayoutMomAmount('');
                        } else {
                          const dadUse = Math.min(balances.dad_bank, rem);
                          const remAfterDad = rem - dadUse;
                          const kishorUse = Math.min(balances.kishor_bank, remAfterDad);
                          const cashUse = Math.min(balances.cash_in_hand, rem - dadUse - kishorUse);

                          setPayoutBank1Amount(dadUse > 0 ? String(dadUse) : '');
                          setPayoutBank2Amount(kishorUse > 0 ? String(kishorUse) : '');
                          setPayoutCashAmount(cashUse > 0 ? String(cashUse) : '');
                          setPayoutMomAmount('');
                        }
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      ⚡ Auto-Fill Balance
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Dad Bank */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-500 font-bold uppercase">Dad Bank</span>
                      <span className="text-gray-400 font-mono">Avail: {formatCurrency(balances.dad_bank)}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={payoutBank1Amount}
                        onChange={(e) => setPayoutBank1Amount(e.target.value)}
                        className="w-full bg-white border border-gray-200 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold font-mono"
                      />
                      {payoutRemainingLiability > 0 && balances.dad_bank > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayoutBank1Amount(String(Math.min(balances.dad_bank, payoutRemainingLiability)))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-purple-600 hover:text-purple-800 px-1.5 py-0.5 bg-purple-50 rounded"
                        >
                          Max
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Kishor Bank */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-500 font-bold uppercase">Kishor Bank</span>
                      <span className="text-gray-400 font-mono">Avail: {formatCurrency(balances.kishor_bank)}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={payoutBank2Amount}
                        onChange={(e) => setPayoutBank2Amount(e.target.value)}
                        className="w-full bg-white border border-gray-200 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold font-mono"
                      />
                      {payoutRemainingLiability > 0 && balances.kishor_bank > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayoutBank2Amount(String(Math.min(balances.kishor_bank, payoutRemainingLiability)))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-purple-600 hover:text-purple-800 px-1.5 py-0.5 bg-purple-50 rounded"
                        >
                          Max
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cash Box */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-500 font-bold uppercase">Physical Cash Box</span>
                      <span className="text-gray-400 font-mono">Avail: {formatCurrency(balances.cash_in_hand)}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={payoutCashAmount}
                        onChange={(e) => setPayoutCashAmount(e.target.value)}
                        className="w-full bg-white border border-gray-200 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold font-mono"
                      />
                      {payoutRemainingLiability > 0 && balances.cash_in_hand > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayoutCashAmount(String(Math.min(balances.cash_in_hand, payoutRemainingLiability)))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-purple-600 hover:text-purple-800 px-1.5 py-0.5 bg-purple-50 rounded"
                        >
                          Max
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mom Bank */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-500 font-bold uppercase">Mom Bank</span>
                      <span className="text-gray-400 font-mono">Avail: {formatCurrency(balances.mom_bank)}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0"
                        value={payoutMomAmount}
                        onChange={(e) => setPayoutMomAmount(e.target.value)}
                        className="w-full bg-white border border-gray-200 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold font-mono"
                      />
                      {payoutRemainingLiability > 0 && balances.mom_bank > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayoutMomAmount(String(Math.min(balances.mom_bank, payoutRemainingLiability)))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-purple-600 hover:text-purple-800 px-1.5 py-0.5 bg-purple-50 rounded"
                        >
                          Max
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Total Disbursing Meter */}
                {(() => {
                  const b1 = Number(payoutBank1Amount) || 0;
                  const b2 = Number(payoutBank2Amount) || 0;
                  const c = Number(payoutCashAmount) || 0;
                  const m = Number(payoutMomAmount) || 0;
                  const sum = b1 + b2 + c + m;

                  return (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-xs font-bold">
                      <span className="text-gray-600">Total To Disburse Now:</span>
                      <span className={`font-mono text-sm ${sum > 0 ? 'text-purple-700' : 'text-gray-400'}`}>
                        {formatCurrency(sum)}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Cheque / UTR / Reference #</label>
                <input
                  type="text"
                  placeholder="e.g. IMPS Ref #849204812 / Cheque #492819"
                  value={payoutRefNotes}
                  onChange={(e) => setPayoutRefNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs font-medium text-gray-900 focus:outline-none shadow-2xs"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingPayout}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs py-3.5 rounded-xl shadow-2xs active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isProcessingPayout ? 'Disbursing...' : 'Disburse Winner Prize Pot'}
              </button>
            </form>
          </div>

          {/* Outstanding Payout Debt Liabilities */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">Outstanding Payout Debt Liabilities</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Live prize pot balances owed to auction winners
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full block">
                    {pendingLiabilities.length} pending
                  </span>
                </div>
              </div>

              {/* Total Debt Banner if > 0 */}
              {totalOutstandingLiability > 0 && (
                <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Total Unsettled Prize Debt</span>
                    <span className="text-xs text-gray-600">Across {pendingLiabilities.length} recorded auctions</span>
                  </div>
                  <span className="text-xl font-black font-mono text-rose-600">
                    {formatCurrency(totalOutstandingLiability)}
                  </span>
                </div>
              )}

              {/* Liabilities Feed */}
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {pendingLiabilities.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                    <p className="text-xs font-bold text-gray-800">All Prize Pots Completely Settled</p>
                    <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                      All winners across all active chit groups have received 100% of their awarded prize pots.
                    </p>
                  </div>
                ) : (
                  pendingLiabilities.map((liab) => (
                    <div
                      key={liab.id}
                      className="bg-gray-50/90 border border-gray-200 p-4 rounded-2xl space-y-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900">
                              {liab.groupName} · Month {liab.month}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md border ${
                              liab.status === 'Partial' 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {liab.status}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-gray-700 block truncate">
                            {liab.winnerName} {liab.ticketNumber ? `(Ticket #${liab.ticketNumber})` : ''}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono block">
                            Net Pot: {formatCurrency(liab.totalPayout)} | Paid: {formatCurrency(liab.paidAmount)}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">Pending Due</span>
                          <span className="text-base font-black text-rose-600 block font-mono">
                            {formatCurrency(liab.liabilityAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-200/80">
                        <button
                          onClick={() => handlePreFillDisbursement(liab)}
                          className="flex-1 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all text-center cursor-pointer active:scale-95"
                        >
                          ⚡ Pre-fill Split Desk
                        </button>
                        
                        {/* Quick Direct Clearance Options */}
                        {balances.dad_bank >= liab.liabilityAmount && (
                          <button
                            onClick={() => handleQuickClearLiability(liab, 'dad_bank')}
                            className="py-2 px-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                            title="Clear fully from Dad Bank"
                          >
                            Pay via Dad Bank
                          </button>
                        )}
                        {balances.cash_in_hand >= liab.liabilityAmount && (
                          <button
                            onClick={() => handleQuickClearLiability(liab, 'cash_in_hand')}
                            className="py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                            title="Clear fully from Cash Box"
                          >
                            Pay via Cash Box
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 font-medium">
              💡 <strong>System Rule:</strong> Whenever an auction ends, the net pot (`Total Value - Winning Discount`) automatically enters as an active liability until 100% disbursed across treasury vaults.
            </div>
          </div>

        </div>
      )}

      {/* ── SUBTAB 5: PERSONAL DRAWS & EXPENSES ── */}
      {activeSubtab === 'spends' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Fast Expense Entry Card */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
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

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Category Tag</label>
                <select
                  value={spendTag}
                  onChange={(e) => setSpendTag(e.target.value as PersonalDraw['tag'])}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Bike Maintenance">Bike Maintenance</option>
                  <option value="Tea & Refreshments">Tea &amp; Refreshments</option>
                  <option value="Collection Visits">Collection Visits</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Emergency Cash">Emergency Cash</option>
                  <option value="Personal Expense">Personal Expense</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Reason / Description</span>
                  <button 
                    type="button" 
                    onClick={() => setSpendDesc("Petrol filled for Dad's bike for collection visit")} 
                    className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-800"
                  >
                    <Mic size={11} /> Auto-fill
                  </button>
                </label>
                <textarea
                  placeholder="e.g. Petrol for collection visits, tea for subscribers..."
                  value={spendDesc}
                  onChange={(e) => setSpendDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none resize-none font-medium shadow-2xs leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-3.5 rounded-xl transition-all duration-150 shadow-2xs cursor-pointer"
              >
                Log Personal Draw / Expense
              </button>
            </form>
          </div>

          {/* Personal Draws Audit Ledger */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-gray-900">Personal Draws &amp; Spends Ledger</h3>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full">
                {personalDraws.length} logged
              </span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {personalDraws.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  No personal draws logged in this session.
                </div>
              ) : (
                personalDraws.map((draw) => (
                  <div key={draw.id} className="bg-gray-50/80 border border-gray-200 p-4 rounded-2xl flex justify-between items-start">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full">
                          {draw.tag}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{draw.timestamp}</span>
                      </div>
                      <p className="text-xs text-gray-800 font-semibold leading-relaxed">{draw.description}</p>
                      <span className="text-[11px] text-indigo-600 font-bold block">Logged by: {draw.adminName}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold text-rose-600 block font-mono">-{formatCurrency(draw.amount)}</span>
                      <button 
                        onClick={() => handleDeletePersonalDraw(draw.id, draw.amount)}
                        className="text-gray-400 hover:text-rose-600 p-1.5 mt-1 transition-colors inline-block cursor-pointer"
                        title="Delete spend & Refund vault"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── SUBTAB 6: DENOMINATION COUNTER & RECONCILIATION ── */}
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
                className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1"
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

              {/* Disparity Badge */}
              <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                cashDisparity === 0 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : cashDisparity > 0 
                  ? 'bg-amber-50 border-amber-200 text-amber-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>
                    {cashDisparity === 0 
                      ? 'Perfect Match (₹0 Disparity)' 
                      : cashDisparity > 0 
                      ? `Excess Physical Cash (+${formatCurrency(cashDisparity)})` 
                      : `Cash Shortage (-${formatCurrency(Math.abs(cashDisparity))})`}
                  </span>
                </div>
                <span className="font-mono">{formatCurrency(cashDisparity)}</span>
              </div>

              {lastReconciliationNote && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 font-medium">
                  {lastReconciliationNote}
                </div>
              )}
            </div>

            <button
              onClick={handleSaveDenominations}
              className="w-full bg-slate-900 hover:bg-black text-white font-bold text-xs py-3.5 rounded-xl shadow-2xs active:scale-98 transition-all cursor-pointer"
            >
              Save Count &amp; Sync Reconciliation
            </button>
          </div>

        </div>
      )}

      {/* ── SUBTAB 7: MASTER AUDIT LEDGER ── */}
      {activeSubtab === 'ledger' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
          
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Master Treasury Audit Ledger</h3>
              <p className="text-xs text-gray-500 mt-0.5">Search and filter every transaction across all 4 treasury vaults</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
                {filteredMasterLedger.length} records
              </span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notes, amounts, tags..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none"
              />
            </div>

            <select
              value={ledgerWalletFilter}
              onChange={(e) => setLedgerWalletFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
            >
              <option value="all">All Accounts / Vaults</option>
              <option value="cash_in_hand">Physical Cash Box</option>
              <option value="kishor_bank">Kishor Bank</option>
              <option value="dad_bank">Dad Bank</option>
              <option value="mom_bank">Mom Bank</option>
            </select>

            <select
              value={ledgerTypeFilter}
              onChange={(e) => setLedgerTypeFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none"
            >
              <option value="all">All Transaction Types</option>
              <option value="collection">Collections (Inflow)</option>
              <option value="payout">Payouts (Outflow)</option>
              <option value="transfer">Inter-Vault Transfers</option>
              <option value="personal_draw">Personal Draws</option>
              <option value="atm_withdrawal">ATM Withdrawals</option>
            </select>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-xs text-left text-gray-600">
              <thead className="text-[10px] text-gray-400 uppercase bg-gray-50/80 font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Vault Account</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Notes &amp; Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMasterLedger.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-gray-400">
                      No matching treasury transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredMasterLedger.map((tx) => {
                    const isCredit = tx.type === 'collection';
                    const dateStr = tx.created_at 
                      ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Recent';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900 whitespace-nowrap">
                          {WALLET_META[tx.wallet_type]?.name || tx.wallet_type}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
                            isCredit 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : tx.type === 'payout' 
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : tx.type === 'transfer'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {tx.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-gray-800 max-w-xs truncate">
                          {tx.notes || tx.description || 'Treasury Transaction'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black font-mono whitespace-nowrap">
                          <span className={isCredit ? 'text-emerald-600' : 'text-rose-600'}>
                            {isCredit ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}
