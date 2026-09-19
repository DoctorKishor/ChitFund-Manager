'use client';

import React, { useState, useEffect } from 'react';
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
  Activity
} from 'lucide-react';

interface Relocation {
  id: string;
  source: Exclude<WalletType, 'cash_in_hand'>;
  amount: number;
  status: 'pending_verification' | 'completed';
}

interface PersonalDraw {
  id: string;
  amount: number;
  tag: 'Personal Expense' | 'Petrol' | 'Maintenance' | 'Groceries';
  description: string;
  adminName: string;
  timestamp: string;
}

interface DebtLiability {
  id: string;
  groupName: string;
  totalPayout: number;
  paidAmount: number;
  liabilityAmount: number;
}

interface TreasuryTx {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  wallet_type: WalletType;
  notes?: string;
  description?: string;
}

export default function CashVaultLedger() {
  const { balances, updateBalance } = useWallet();
  const { profile } = useAuth();
  const activeAdminName = profile?.fullName || 'Admin';

  // State
  const [relocations, setRelocations] = useState<Relocation[]>([]);
  const [personalDraws, setPersonalDraws] = useState<PersonalDraw[]>([]);
  const [liabilities, setLiabilities] = useState<DebtLiability[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TreasuryTx[]>([]);
  const [availableGroups, setAvailableGroups] = useState<{ id: string; name: string }[]>([]);

  // Fetch groups and recent treasury transactions from Supabase
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: groups } = await supabase.from('chit_groups').select('id, name');
        if (groups && groups.length > 0) {
          setAvailableGroups(groups);
          setSplitGroup(groups[0].name);
        }

        // Fetch recent treasury transactions
        const { data: txs } = await supabase
          .from('transactions')
          .select('id, created_at, type, amount, wallet_type, notes, description')
          .order('created_at', { ascending: false })
          .limit(15);

        if (txs) {
          setRecentTransactions(txs);
        }
      } catch (e) {
        console.error('Error loading cash ledger initial data:', e);
      }
    };
    fetchInitialData();
  }, []);

  // Form states
  const [relocateSource, setRelocateSource] = useState<Exclude<WalletType, 'cash_in_hand'>>('kishor_bank');
  const [relocateAmount, setRelocateAmount] = useState<string>('');
  
  const [spendAmount, setSpendAmount] = useState<string>('');
  const [spendTag, setSpendTag] = useState<PersonalDraw['tag']>('Petrol');
  const [spendDesc, setSpendDesc] = useState<string>('');
  
  const [splitGroup, setSplitGroup] = useState<string>('');
  const [splitTotal, setSplitTotal] = useState<string>('');
  const [splitPaid, setSplitPaid] = useState<string>('');
  const [splitSourceWallet, setSplitSourceWallet] = useState<WalletType>('dad_bank');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getWalletDisplayName = (w: WalletType) => {
    switch (w) {
      case 'cash_in_hand': return 'Cash Box';
      case 'kishor_bank': return 'Kishor Bank';
      case 'dad_bank': return 'Dad Bank';
      case 'mom_bank': return 'Mom Bank';
      default: return w;
    }
  };

  // Action handlers
  const handleATMRelocation = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(relocateAmount);
    if (isNaN(amount) || amount <= 0 || balances[relocateSource] < amount) {
      alert("Invalid relocation amount or insufficient bank balance.");
      return;
    }

    updateBalance(relocateSource, -amount);

    const newReloc: Relocation = {
      id: Math.random().toString(),
      source: relocateSource,
      amount,
      status: 'pending_verification'
    };
    setRelocations([newReloc, ...relocations]);
    setRelocateAmount('');
  };

  const handleVerifyRelocation = (id: string, amount: number) => {
    setRelocations(prev => prev.filter(r => r.id !== id));
    updateBalance('cash_in_hand', amount);
  };

  const handlePersonalDraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(spendAmount);
    if (isNaN(amount) || amount <= 0 || balances.cash_in_hand < amount) {
      alert("Invalid spend amount or insufficient cash box balance.");
      return;
    }

    updateBalance('cash_in_hand', -amount);

    const newDraw: PersonalDraw = {
      id: Math.random().toString(),
      amount,
      tag: spendTag,
      description: spendDesc || `Quick draw under tag: ${spendTag}`,
      adminName: activeAdminName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setPersonalDraws([newDraw, ...personalDraws]);
    setSpendAmount('');
    setSpendDesc('');
  };

  const handlePayoutSplit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(splitTotal);
    const paid = Number(splitPaid);
    const liability = total - paid;

    if (isNaN(total) || isNaN(paid) || total <= 0 || paid < 0 || liability < 0) {
      alert("Invalid split tracker metrics.");
      return;
    }
    if (balances[splitSourceWallet] < paid) {
      alert("Insufficient balance in selected payout wallet.");
      return;
    }

    updateBalance(splitSourceWallet, -paid);

    const newLiab: DebtLiability = {
      id: Math.random().toString(),
      groupName: splitGroup,
      totalPayout: total,
      paidAmount: paid,
      liabilityAmount: liability
    };
    setLiabilities([newLiab, ...liabilities]);
    setSplitTotal('');
    setSplitPaid('');
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">

      {/* Main Split Layout Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
        
        {/* Left Side forms (ATM Relocation & Spending Panel) */}
        <div className="lg:col-span-2 space-y-5 sm:space-y-6">
          
          {/* Fast Entry Spending Module */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Coins size={16} className="text-rose-600" />
                Quick Spend / Personal Draw
              </h3>
              <span className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full">
                Cash Box Debit
              </span>
            </div>

            <form onSubmit={handlePersonalDraw} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500"
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Category</label>
                  <select
                    value={spendTag}
                    onChange={(e) => setSpendTag(e.target.value as PersonalDraw['tag'])}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Personal Expense">Personal Expense</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Reason / Description</span>
                  <button 
                    type="button" 
                    onClick={() => setSpendDesc("Petrol filled for Dad's bike for collections")} 
                    className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-800"
                  >
                    <Mic size={11} /> Auto-fill
                  </button>
                </label>
                <textarea
                  placeholder="e.g. Petrol for collection visits..."
                  value={spendDesc}
                  onChange={(e) => setSpendDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none resize-none font-medium shadow-2xs leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-rose-50 hover:bg-rose-600 border border-rose-200 text-rose-700 hover:text-white active:scale-98 font-bold text-xs py-3 rounded-xl transition-all duration-150 shadow-2xs"
              >
                Log Personal Draw
              </button>
            </form>
          </div>

          {/* ATM Relocation Engine */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Scale size={16} className="text-indigo-600" />
                ATM Bank-to-Cash Relocation
              </h3>
              <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                2-Step Verify
              </span>
            </div>

            <form onSubmit={handleATMRelocation} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Source Bank</label>
                  <select
                    value={relocateSource}
                    onChange={(e) => setRelocateSource(e.target.value as Exclude<WalletType, 'cash_in_hand'>)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  >
                    <option value="kishor_bank">Kishor Bank</option>
                    <option value="dad_bank">Dad Bank</option>
                    <option value="mom_bank">Mom Bank</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Amount (₹)</label>
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
                className="w-full bg-gray-900 hover:bg-black text-white active:scale-98 font-bold text-xs py-3 rounded-xl transition-all duration-150 shadow-2xs"
              >
                Trigger ATM Withdrawal
              </button>
            </form>

            {/* Pending Inflow verification list */}
            {relocations.length > 0 && (
              <div className="space-y-2.5 pt-3.5 border-t border-gray-100">
                <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={13} />
                  Pending Physical Cash Verification
                </h4>
                
                <div className="space-y-2">
                  {relocations.map((reloc) => (
                    <div key={reloc.id} className="flex justify-between items-center bg-amber-50/70 border border-amber-200 p-3 rounded-2xl">
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block">From: {reloc.source.replace('_', ' ')}</span>
                        <span className="text-xs font-extrabold text-gray-900 mt-0.5 block">{formatCurrency(reloc.amount)}</span>
                      </div>
                      <button
                        onClick={() => handleVerifyRelocation(reloc.id, reloc.amount)}
                        className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl flex items-center gap-1 transition-all duration-150 shadow-2xs"
                      >
                        <Check size={11} /> Confirm Inflow
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payout Split Tracker Form */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Scale size={16} className="text-indigo-600" />
              Payout Split Distribution
            </h3>

            <form onSubmit={handlePayoutSplit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Chit Group</label>
                  <select
                    value={splitGroup}
                    onChange={(e) => setSplitGroup(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  >
                    {availableGroups.length === 0 ? (
                      <option value="">No Groups Found</option>
                    ) : (
                      availableGroups.map((g) => (
                        <option key={g.id} value={g.name}>
                          {g.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Payout Wallet</label>
                  <select
                    value={splitSourceWallet}
                    onChange={(e) => setSplitSourceWallet(e.target.value as WalletType)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  >
                    <option value="cash_in_hand">Cash Box</option>
                    <option value="kishor_bank">Kishor Bank</option>
                    <option value="dad_bank">Dad Bank</option>
                    <option value="mom_bank">Mom Bank</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Value (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="₹1,00,000"
                    value={splitTotal}
                    onChange={(e) => setSplitTotal(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Paid Now (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="₹70,000"
                    value={splitPaid}
                    onChange={(e) => setSplitPaid(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 border border-gray-200 text-gray-800 font-bold text-xs py-3 rounded-xl transition-all duration-150 shadow-2xs"
              >
                Record Payout Split
              </button>
            </form>
          </div>

        </div>

        {/* Right Side: Debt Liabilities, Personal Draws Ledger, and Real-Time Vault Activity */}
        <div className="lg:col-span-3 space-y-5 sm:space-y-6">
          
          {/* Outstanding Payout Liabilities ledger */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Scale size={16} className="text-rose-600" />
                Outstanding Payout Debt Liabilities
              </h3>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                {liabilities.length} active
              </span>
            </div>

            <div className="space-y-3">
              {liabilities.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  ✅ No outstanding debt liabilities across active chit groups.
                </div>
              ) : (
                liabilities.map((liab) => (
                  <div key={liab.id} className="flex justify-between items-center bg-gray-50/80 border border-gray-200 p-4 rounded-2xl">
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">{liab.groupName} Outstanding</span>
                      <span className="text-xs text-gray-500 mt-1 block font-mono">Total: {formatCurrency(liab.totalPayout)} | Paid: {formatCurrency(liab.paidAmount)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-rose-600 block font-mono">{formatCurrency(liab.liabilityAmount)}</span>
                      <button 
                        onClick={() => {
                          if (balances.cash_in_hand >= liab.liabilityAmount) {
                            updateBalance('cash_in_hand', -liab.liabilityAmount);
                            setLiabilities(prev => prev.filter(l => l.id !== liab.id));
                          } else {
                            alert("Insufficient Cash Box liquidity to clear debt liability.");
                          }
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-1 hover:underline block"
                      >
                        Clear Debt
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Personal Spends Draws Ledger */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Coins size={16} className="text-rose-600" />
                Personal Draws Ledger
              </h3>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full">
                {personalDraws.length} logged
              </span>
            </div>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {personalDraws.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
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
                      <span className="text-[11px] text-indigo-600 font-bold block">Taken by: {draw.adminName}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold text-rose-600 block font-mono">-{formatCurrency(draw.amount)}</span>
                      <button 
                        onClick={() => {
                          updateBalance('cash_in_hand', draw.amount);
                          setPersonalDraws(prev => prev.filter(d => d.id !== draw.id));
                        }}
                        className="text-gray-400 hover:text-rose-600 p-1.5 mt-1 transition-colors inline-block"
                        title="Delete spend & Refund cash box"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Real-time Vault Transaction Activity Log */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Activity size={16} className="text-indigo-600" />
                Live Treasury Activity &amp; Audit Trail
              </h3>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                Supabase Realtime
              </span>
            </div>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {recentTransactions.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  No treasury transactions recorded yet.
                </div>
              ) : (
                recentTransactions.map((tx) => {
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
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
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
                          Vault: <strong className="text-gray-700">{getWalletDisplayName(tx.wallet_type)}</strong>
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-xs sm:text-sm font-black font-mono block ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
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

      </div>

    </div>
  );
}
