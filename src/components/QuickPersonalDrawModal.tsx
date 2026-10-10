'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { Coins, X } from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

interface QuickPersonalDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const WALLET_NAMES: Record<WalletType, string> = {
  cash_in_hand: 'Cash Box',
  kishor_bank: 'Kishor Bank',
  dad_bank: "Anbazhakan's Bank",
  mom_bank: "Parimalam's Bank",
};

export default function QuickPersonalDrawModal({
  isOpen,
  onClose,
  onSuccess,
}: QuickPersonalDrawModalProps) {
  const { balances, updateBalance } = useWallet();
  const { profile } = useAuth();
  const activeAdminName = profile?.fullName || 'Admin';

  const [spendAmount, setSpendAmount] = useState<string>('');
  const [spendTag, setSpendTag] = useState<string>('Personal Expense');
  const [spendDesc, setSpendDesc] = useState<string>('');
  const [spendWallet, setSpendWallet] = useState<WalletType>('cash_in_hand');
  const [spendTakenBy, setSpendTakenBy] = useState<string>('Anbazhakan');
  const [spendCustomTakenBy, setSpendCustomTakenBy] = useState<string>('');
  const [isSubmittingSpend, setIsSubmittingSpend] = useState<boolean>(false);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handleLogSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(spendAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if ((balances[spendWallet] || 0) < amount) {
      alert(`Insufficient balance in ${WALLET_NAMES[spendWallet]}. Available: ${formatCurrency(balances[spendWallet] || 0)}`);
      return;
    }

    const effectiveTakenBy = spendTakenBy === 'Other' ? (spendCustomTakenBy.trim() || 'Other') : spendTakenBy;

    try {
      setIsSubmittingSpend(true);
      triggerHapticFeedback('light');

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
        },
      ]);

      if (error) throw error;

      await supabase.from('security_audit_logs').insert({
        action_description: `PERSONAL DRAW: ₹${amount.toLocaleString('en-IN')} taken by ${effectiveTakenBy} for ${spendTag} from ${WALLET_NAMES[spendWallet]}.`,
        target_table: 'transactions',
      });

      setSpendAmount('');
      setSpendDesc('');
      if (spendTakenBy === 'Other') setSpendCustomTakenBy('');
      onClose();
      if (onSuccess) onSuccess();
      alert(`✓ Recorded ${formatCurrency(amount)} draw for ${effectiveTakenBy}!`);
    } catch (err: any) {
      console.error('Error logging spend:', err);
      alert('Error logging spend: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingSpend(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
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
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form matching Treasury exactly */}
        <form onSubmit={handleLogSpend} className="space-y-3.5">
          <div className="space-y-1 text-center">
            <label className="text-[11px] font-extrabold uppercase text-gray-500">
              SPEND AMOUNT (₹)
            </label>
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
            <label className="text-xs font-bold text-gray-700 uppercase">
              WHO IS TAKING THE CASH?
            </label>
            {/* 2 cols on mobile, 4 on desktop so names like Anbazhakan and Parimalam never truncate */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {['Anbazhakan', 'Parimalam', 'Kishor', 'Other'].map((person) => (
                <button
                  key={person}
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setSpendTakenBy(person);
                  }}
                  className={`p-2 rounded-xl text-center text-[11px] font-bold border transition-all cursor-pointer ${
                    spendTakenBy === person 
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs' 
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">CATEGORY</label>
              <select
                value={spendTag}
                onChange={(e) => setSpendTag(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-bold text-gray-900 focus:outline-none"
              >
                <option value="Personal Expense">💸 Personal Expense</option>
                <option value="Petrol">⛽ Petrol</option>
                <option value="Groceries">🛒 Groceries</option>
                <option value="Tea & Refreshments">☕ Tea / Snacks</option>
                <option value="Maintenance">🔧 Maintenance</option>
                <option value="Emergency Cash">🚨 Emergency</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">DEDUCT FROM</label>
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
            <label className="text-[10px] font-bold text-gray-500 uppercase">REASON / NOTE (OPTIONAL)</label>
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
  );
}
