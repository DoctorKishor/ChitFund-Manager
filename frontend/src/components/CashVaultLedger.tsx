'use client';

import React, { useState } from 'react';
import { useWallet, WalletType } from '../context/WalletContext';
import { useSimulation } from '../context/SimulationContext';
import { useAuth } from '../context/AuthContext';
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
  Trash2 
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

interface MemberCollection {
  id: string;
  memberName: string;
  totalDue: number;
  amountLogged: number;
  targetVault: WalletType;
  status: 'completed' | 'pending_verification';
}

export default function CashVaultLedger() {
  const { balances, updateBalance } = useWallet();
  const { simulatedUser } = useSimulation();
  const { profile } = useAuth();
  const activeAdminName = profile?.fullName || simulatedUser.fullName;

  // 1. Core State Hooks
  const [relocations, setRelocations] = useState<Relocation[]>([
    { id: 'rel-1', source: 'kishor_bank', amount: 15000, status: 'pending_verification' }
  ]);

  const [personalDraws, setPersonalDraws] = useState<PersonalDraw[]>([
    { id: 'pd-1', amount: 500, tag: 'Petrol', description: 'Fuel for weekly cash collection trip', adminName: 'Kishor (Admin)', timestamp: '01:30 PM' }
  ]);

  const [liabilities, setLiabilities] = useState<DebtLiability[]>([
    { id: 'liab-1', groupName: 'G-Elite-Weekly-301', totalPayout: 100000, paidAmount: 70000, liabilityAmount: 30000 }
  ]);

  const [collections, setCollections] = useState<MemberCollection[]>([
    { id: 'col-1', memberName: 'Priya Subramanian', totalDue: 5000, amountLogged: 3000, targetVault: 'cash_in_hand', status: 'completed' },
    { id: 'col-2', memberName: 'Balaji Srinivasan', totalDue: 5000, amountLogged: 2000, targetVault: 'kishor_bank', status: 'pending_verification' },
    { id: 'col-3', memberName: 'Ananya Sen', totalDue: 5000, amountLogged: 5000, targetVault: 'cash_in_hand', status: 'completed' },
    { id: 'col-4', memberName: 'Suresh Babu', totalDue: 5000, amountLogged: 1000, targetVault: 'dad_bank', status: 'pending_verification' }
  ]);

  // Form states
  const [relocateSource, setRelocateSource] = useState<Exclude<WalletType, 'cash_in_hand'>>('kishor_bank');
  const [relocateAmount, setRelocateAmount] = useState<string>('');
  
  const [spendAmount, setSpendAmount] = useState<string>('');
  const [spendTag, setSpendTag] = useState<PersonalDraw['tag']>('Petrol');
  const [spendDesc, setSpendDesc] = useState<string>('');
  
  const [splitGroup, setSplitGroup] = useState<string>('G-Weekly-202');
  const [splitTotal, setSplitTotal] = useState<string>('');
  const [splitPaid, setSplitPaid] = useState<string>('');
  const [splitSourceWallet, setSplitSourceWallet] = useState<WalletType>('dad_bank');

  const [activePaymentMemberId, setActivePaymentMemberId] = useState<string | null>(null);
  const [partialPaymentVal, setPartialPaymentVal] = useState<string>('');
  const [partialPaymentWallet, setPartialPaymentWallet] = useState<WalletType>('cash_in_hand');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // 2. Action handlers
  
  // ATM Relocation: Debit bank instantly, place in pending inflow queue
  const handleATMRelocation = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(relocateAmount);
    if (isNaN(amount) || amount <= 0 || balances[relocateSource] < amount) {
      alert("Invalid relocation amount or insufficient bank balance.");
      return;
    }

    // Debit bank instantly
    updateBalance(relocateSource, -amount);

    // Queue inflow relocation
    const newReloc: Relocation = {
      id: Math.random().toString(),
      source: relocateSource,
      amount,
      status: 'pending_verification'
    };
    setRelocations([newReloc, ...relocations]);
    setRelocateAmount('');
  };

  // Verify ATM delivery: Remove pending inflow, credit physical cash box
  const handleVerifyRelocation = (id: string, amount: number) => {
    setRelocations(prev => prev.filter(r => r.id !== id));
    updateBalance('cash_in_hand', amount); // Credit cash box
  };

  // Fast Spend / Personal Draw: Debit Cash Box instantly
  const handlePersonalDraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(spendAmount);
    if (isNaN(amount) || amount <= 0 || balances.cash_in_hand < amount) {
      alert("Invalid spend amount or insufficient cash box balance.");
      return;
    }

    // Debit Cash Box instantly
    updateBalance('cash_in_hand', -amount);

    // Add to personal draws list
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

  // Payout Split: debit chosen wallet by paid amount, log outstanding debt liability
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

    // Debit paid amount from chosen wallet
    updateBalance(splitSourceWallet, -paid);

    // Record liability
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

  // Log Partial Payment collection
  const handleLogPartialPayment = (e: React.FormEvent, memberId: string) => {
    e.preventDefault();
    const pay = Number(partialPaymentVal);
    const member = collections.find(c => c.id === memberId);
    if (isNaN(pay) || pay <= 0 || !member) return;

    // Check if the payment target is Cash Box (Cash in Hand)
    // If it's bank (other than admin's physical cash control), flag it as pending verification
    const needsVerification = partialPaymentWallet !== 'cash_in_hand';

    setCollections(prev => prev.map(c => {
      if (c.id === memberId) {
        const newLogged = c.amountLogged + pay;
        return {
          ...c,
          amountLogged: newLogged > c.totalDue ? c.totalDue : newLogged,
          targetVault: partialPaymentWallet,
          status: needsVerification ? 'pending_verification' : 'completed'
        };
      }
      return c;
    }));

    // If it's Cash box, credit instantly
    if (!needsVerification) {
      updateBalance('cash_in_hand', pay);
    } else {
      // Add bank balance, but flag it or hold
      // For simplicity, we credit the bank instantly but show the RLS audit/verification state
      updateBalance(partialPaymentWallet, pay);
    }

    setActivePaymentMemberId(null);
    setPartialPaymentVal('');
  };

  const handleVerifyCollection = (id: string) => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, status: 'completed' } : c));
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Unified Multi-Wallet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Cash Box */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Wallet size={20} />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Physical Cash Box</span>
              <span className="text-base font-bold text-gray-900 mt-0.5 block">{formatCurrency(balances.cash_in_hand)}</span>
              {relocations.length > 0 && (
                <span className="text-[9px] text-amber-600 mt-1 block flex items-center gap-1">
                  <AlertCircle size={10} />
                  +{formatCurrency(relocations.reduce((sum, r) => sum + r.amount, 0))} pending ATM inflow
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Kishor Bank */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-150">
              <Landmark size={20} />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Kishor Bank</span>
              <span className="text-base font-bold text-gray-900 mt-0.5 block">{formatCurrency(balances.kishor_bank)}</span>
            </div>
          </div>
        </div>

        {/* Dad Bank */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-150">
              <Landmark size={20} />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Dad Bank</span>
              <span className="text-base font-bold text-gray-900 mt-0.5 block">{formatCurrency(balances.dad_bank)}</span>
            </div>
          </div>
        </div>

        {/* Mom Bank */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-150">
              <Landmark size={20} />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Mom Bank</span>
              <span className="text-base font-bold text-gray-900 mt-0.5 block">{formatCurrency(balances.mom_bank)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Side forms (ATM Relocation & Spending Panel) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Fast Entry Spending Module */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Coins size={14} className="text-indigo-600" />
                Quick Spend / Personal Draw
              </h3>
              <span className="text-[9px] text-red-700 font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                Deducted from Cash Box
              </span>
            </div>

            <form onSubmit={handlePersonalDraw} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="Enter amount"
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold">Tag Category</label>
                  <select
                    value={spendTag}
                    onChange={(e) => setSpendTag(e.target.value as PersonalDraw['tag'])}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none"
                  >
                    <option value="Petrol">Petrol</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Personal Expense">Personal Expense</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold flex items-center justify-between">
                  <span>Dictation / Log Description</span>
                  <button type="button" onClick={() => setSpendDesc("Petrol filled for Dad's bike to collect chit amount from Balaji")} className="text-[9px] text-indigo-600 flex items-center gap-1 hover:text-indigo-800">
                    <Mic size={10} /> Simulate Dictation
                  </button>
                </label>
                <textarea
                  placeholder="Type or dictate reason..."
                  value={spendDesc}
                  onChange={(e) => setSpendDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-red-50 hover:bg-red-600 border border-red-200 text-red-700 hover:text-white font-bold text-xs py-2 rounded-lg transition-all duration-150 shadow-sm"
              >
                Log Personal Draw
              </button>
            </form>
          </div>

          {/* ATM Relocation Engine */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Scale size={14} className="text-indigo-600" />
                ATM Bank-to-Cash Relocation
              </h3>
              <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                Debit Bank → Verify Cash Box
              </span>
            </div>

            <form onSubmit={handleATMRelocation} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold">Source Bank</label>
                  <select
                    value={relocateSource}
                    onChange={(e) => setRelocateSource(e.target.value as Exclude<WalletType, 'cash_in_hand'>)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none"
                  >
                    <option value="kishor_bank">Kishor Bank</option>
                    <option value="dad_bank">Dad Bank</option>
                    <option value="mom_bank">Mom Bank</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="Enter amount"
                    value={relocateAmount}
                    onChange={(e) => setRelocateAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gray-900 hover:bg-black text-white font-bold text-xs py-2 rounded-lg transition-all duration-150 shadow-sm"
              >
                Trigger ATM Withdrawal
              </button>
            </form>

            {/* Pending Inflow verification list */}
            {relocations.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  Pending Physical Verification
                </h4>
                
                <div className="space-y-2">
                  {relocations.map((reloc) => (
                    <div key={reloc.id} className="flex justify-between items-center bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
                      <div>
                        <span className="text-[10px] font-semibold text-gray-500 block">From: {reloc.source.replace('_', ' ')}</span>
                        <span className="text-xs font-bold text-gray-900 mt-0.5 block">{formatCurrency(reloc.amount)}</span>
                      </div>
                      <button
                        onClick={() => handleVerifyRelocation(reloc.id, reloc.amount)}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold text-[9px] px-2.5 py-1.5 rounded flex items-center gap-1 transition-all duration-150"
                      >
                        <Check size={10} /> Verify Delivery
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payout Split Tracker Form */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2.5">
              <Scale size={14} className="text-indigo-600" />
              Payout Split Distribution
            </h3>

            <form onSubmit={handlePayoutSplit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold">Chit Group</label>
                  <select
                    value={splitGroup}
                    onChange={(e) => setSplitGroup(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none"
                  >
                    <option value="G-Weekly-202">G-Weekly-202</option>
                    <option value="G-Elite-Weekly-301">G-Elite-Weekly-301</option>
                    <option value="G-Gold-Monthly-102">G-Gold-Monthly-102</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold">Target Payout Wallet</label>
                  <select
                    value={splitSourceWallet}
                    onChange={(e) => setSplitSourceWallet(e.target.value as WalletType)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none"
                  >
                    <option value="cash_in_hand">Physical Cash Box</option>
                    <option value="kishor_bank">Kishor Bank</option>
                    <option value="dad_bank">Dad Bank</option>
                    <option value="mom_bank">Mom Bank</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold">Total Chit Value</label>
                  <input
                    type="number"
                    required
                    placeholder="₹1,00,000"
                    value={splitTotal}
                    onChange={(e) => setSplitTotal(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold">Paid Now</label>
                  <input
                    type="number"
                    required
                    placeholder="₹70,000"
                    value={splitPaid}
                    onChange={(e) => setSplitPaid(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold text-xs py-2 rounded-lg transition-all duration-150 shadow-sm"
              >
                Record Payout Split
              </button>
            </form>
          </div>

        </div>

        {/* Right Side Ledgers / Partial Payment Matrix (Collections & Liabilities) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Collection Balance Ledger */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Monthly Collection Balance Ledger</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Rolling monthly payments tracked in bits and pieces</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-600">
                <thead className="text-[10px] text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="py-2.5 px-3">Member</th>
                    <th className="py-2.5 px-3">Due / Logged</th>
                    <th className="py-2.5 px-3">Remaining</th>
                    <th className="py-2.5 px-3">Target Vault</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {collections.map((col) => {
                    const isPaying = activePaymentMemberId === col.id;
                    const remaining = col.totalDue - col.amountLogged;

                    return (
                      <tr key={col.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-3">
                          <span className="font-semibold text-gray-800 block">{col.memberName}</span>
                          <span className={`text-[9px] mt-0.5 inline-block ${
                            col.status === 'completed' 
                              ? 'text-green-700 bg-green-50 px-1.5 py-0.2 rounded border border-green-200' 
                              : 'text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200'
                          }`}>
                            {col.status.toUpperCase().replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-500">
                          {formatCurrency(col.totalDue)} / <span className="text-gray-900 font-bold">{formatCurrency(col.amountLogged)}</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-gray-700">
                          {remaining === 0 ? (
                            <span className="text-green-600">Paid</span>
                          ) : (
                            formatCurrency(remaining)
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-gray-500">
                          {col.targetVault.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!isPaying ? (
                            <div className="flex justify-end gap-1.5">
                              {col.status === 'pending_verification' && (
                                <button
                                  onClick={() => handleVerifyCollection(col.id)}
                                  className="bg-green-50 hover:bg-green-600 border border-green-200 hover:border-green-600 text-green-700 hover:text-white text-[9px] font-bold px-2 py-1 rounded transition-all duration-150"
                                >
                                  Verify
                                </button>
                              )}
                              {remaining > 0 && (
                                <button
                                  onClick={() => {
                                    setActivePaymentMemberId(col.id);
                                    setPartialPaymentVal(remaining.toString());
                                  }}
                                  className="bg-gray-900 hover:bg-black text-white text-[9px] font-bold px-2.5 py-1 rounded transition-colors duration-150"
                                >
                                  Pay
                                </button>
                              )}
                            </div>
                          ) : (
                            /* mini collection form */
                            <form 
                              onSubmit={(e) => handleLogPartialPayment(e, col.id)}
                              className="flex flex-col gap-1.5 max-w-[140px] ml-auto text-left"
                            >
                              <div className="flex gap-1">
                                <input
                                  type="number"
                                  placeholder="Amount"
                                  required
                                  value={partialPaymentVal}
                                  onChange={(e) => setPartialPaymentVal(e.target.value)}
                                  className="w-16 bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] text-gray-900 focus:outline-none"
                                />
                                <select
                                  value={partialPaymentWallet}
                                  onChange={(e) => setPartialPaymentWallet(e.target.value as WalletType)}
                                  className="w-16 bg-gray-50 border border-gray-200 rounded px-0.5 py-0.5 text-[9px] text-gray-900 focus:outline-none"
                                >
                                  <option value="cash_in_hand">Cash</option>
                                  <option value="kishor_bank">Kishor</option>
                                  <option value="dad_bank">Dad</option>
                                  <option value="mom_bank">Mom</option>
                                </select>
                              </div>
                              <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => setActivePaymentMemberId(null)} className="text-[9px] text-gray-500 hover:text-gray-700">Cancel</button>
                                <button type="submit" className="bg-gray-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Log</button>
                              </div>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Outstanding Payout Liabilities ledger */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900">Outstanding Payout Debt Liabilities</h3>
            <div className="space-y-2.5">
              {liabilities.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No outstanding debt liabilities.</p>
              ) : (
                liabilities.map((liab) => (
                  <div key={liab.id} className="flex justify-between items-center bg-gray-50 border border-gray-200 p-3 rounded-lg">
                    <div>
                      <span className="text-xs font-semibold text-gray-800 block">{liab.groupName} Outstanding Payout</span>
                      <span className="text-[10px] text-gray-500 mt-1 block">Total Due: {formatCurrency(liab.totalPayout)} | Paid: {formatCurrency(liab.paidAmount)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-red-600 block">{formatCurrency(liab.liabilityAmount)}</span>
                      <button 
                        onClick={() => {
                          if (balances.cash_in_hand >= liab.liabilityAmount) {
                            updateBalance('cash_in_hand', -liab.liabilityAmount);
                            setLiabilities(prev => prev.filter(l => l.id !== liab.id));
                          } else {
                            alert("Insufficient Cash Box liquidity to clear debt liability.");
                          }
                        }}
                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 mt-1 hover:underline block"
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
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900">Quick Spend / Personal Draws Ledger</h3>
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {personalDraws.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No spends logged today.</p>
              ) : (
                personalDraws.map((draw) => (
                  <div key={draw.id} className="bg-gray-50 border border-gray-200 p-3 rounded-lg flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-red-50 text-red-700 border border-red-150 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">
                          {draw.tag}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono">{draw.timestamp}</span>
                      </div>
                      <p className="text-xs text-gray-700 font-medium">{draw.description}</p>
                      <span className="text-[9px] text-indigo-600 font-bold block">Taken by: {draw.adminName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-red-600 block">-{formatCurrency(draw.amount)}</span>
                      <button 
                        onClick={() => {
                          updateBalance('cash_in_hand', draw.amount); // Revert / Refund cash box
                          setPersonalDraws(prev => prev.filter(d => d.id !== draw.id));
                        }}
                        className="text-gray-400 hover:text-red-600 mt-1 transition-colors"
                        title="Delete spend & Refund cash box"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
