'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { X, MinusCircle, Check, AlertCircle, RefreshCw, Fuel, Coffee, Wrench, Car, ShoppingBag, Receipt } from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

interface QuickPersonalDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SPEND_CATEGORIES = [
  { id: 'petrol', label: 'Petrol / Fuel', icon: Fuel, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'tea', label: 'Tea & Snacks', icon: Coffee, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'travel', label: 'Auto / Travel Fare', icon: Car, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'household', label: 'Household', icon: ShoppingBag, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'misc', label: 'Other Expense', icon: Receipt, color: 'text-gray-600 bg-gray-50 border-gray-200' },
];

export default function QuickPersonalDrawModal({
  isOpen,
  onClose,
  onSuccess,
}: QuickPersonalDrawModalProps) {
  const { balances, updateBalance } = useWallet();
  const { profile } = useAuth();

  const [amount, setAmount] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<WalletType>('cash_in_hand');
  const [category, setCategory] = useState('petrol');
  const [customCategory, setCustomCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const amountNum = parseFloat(amount) || 0;
  const availableBal = balances[selectedWallet] || 0;
  const isInsufficient = amountNum > availableBal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountNum <= 0) {
      alert('Please enter a valid expense amount.');
      return;
    }
    if (isInsufficient) {
      alert(`Insufficient balance in ${selectedWallet.replace(/_/g, ' ')}. Available: ₹${availableBal.toLocaleString('en-IN')}`);
      return;
    }

    try {
      setIsSubmitting(true);
      triggerHapticFeedback('light');

      const resolvedCategory = category === 'misc' && customCategory.trim() 
        ? customCategory.trim() 
        : SPEND_CATEGORIES.find(c => c.id === category)?.label || 'General Draw';

      const fullNote = notes.trim()
        ? `Personal Draw (${resolvedCategory}): ${notes.trim()}`
        : `Personal Draw (${resolvedCategory})`;

      // 1. Deduct from treasury balance (updateBalance receives delta: -amountNum)
      await updateBalance(selectedWallet, -amountNum);

      // 2. Insert into transactions table
      const { error } = await supabase.from('transactions').insert([
        {
          wallet_type: selectedWallet,
          type: 'personal_draw',
          status: 'completed',
          amount: amountNum,
          notes: fullNote,
          created_by: profile?.id || null,
        }
      ]);

      if (error) throw error;

      // 3. Record security audit log
      await supabase.from('security_audit_logs').insert({
        action_description: `PERSONAL DRAW: ₹${amountNum.toLocaleString('en-IN')} withdrawn from ${selectedWallet.replace(/_/g, ' ')} (${resolvedCategory}).`,
        target_table: 'transactions',
      });

      triggerHapticFeedback('success');
      setAmount('');
      setNotes('');
      setCustomCategory('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error recording personal draw:', err);
      alert('Error recording expense: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const walletOptions: { id: WalletType; label: string; icon: string; bal: number }[] = [
    { id: 'cash_in_hand', label: 'Cash in Hand (Box)', icon: '💵', bal: balances.cash_in_hand },
    { id: 'kishor_bank', label: 'Kishor UPI / Bank', icon: '📱', bal: balances.kishor_bank },
    { id: 'dad_bank', label: "Dad's Bank", icon: '🏦', bal: balances.dad_bank },
    { id: 'mom_bank', label: "Mom's Bank", icon: '🏛️', bal: balances.mom_bank },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md max-h-[90dvh] flex flex-col shadow-2xl relative overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <MinusCircle size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
                Log Personal Draw / Spend
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Record cash/bank expense taken for personal or daily needs
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Amount Input */}
          <div className="space-y-1.5 text-center">
            <label className="text-[11px] text-gray-500 font-extrabold uppercase tracking-wider block">
              Expense Amount (₹) *
            </label>
            <div className="relative max-w-[280px] mx-auto">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400 select-none">
                ₹
              </span>
              <input
                type="number"
                required
                min={1}
                step={10}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white border-2 border-gray-200 focus:border-rose-600 rounded-2xl pl-10 pr-6 py-3 text-2xl sm:text-3xl font-black text-gray-900 tracking-tight shadow-xs text-center focus:outline-none transition-all font-mono"
                autoFocus
              />
            </div>
          </div>

          {/* Spend Category Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Expense Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SPEND_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-500/20'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    <IconComponent size={15} className={isSelected ? 'text-white' : 'text-gray-500'} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {category === 'misc' && (
              <input
                type="text"
                placeholder="Specify expense reason..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-rose-600 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
              />
            )}
          </div>

          {/* Source Wallet Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Taken From Which Account?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {walletOptions.map((w) => {
                const isSelected = selectedWallet === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedWallet(w.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{w.icon}</span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-slate-800 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        ₹{w.bal.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-xs font-bold truncate">{w.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Reference / Extra Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Scooter fuel or grocery bill"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-rose-600 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900 focus:outline-none"
            />
          </div>

          {isInsufficient && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-900 text-xs font-bold">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>Insufficient balance! Available in {selectedWallet.replace(/_/g, ' ')}: ₹{availableBal.toLocaleString('en-IN')}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-gray-150">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors text-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amountNum <= 0 || isInsufficient}
              className="w-full sm:flex-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Logging Spend...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Log Spend (₹{amountNum.toLocaleString('en-IN')})</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
