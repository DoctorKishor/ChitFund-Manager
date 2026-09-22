'use client';

import React, { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { X, Landmark, Check, AlertCircle, RefreshCw, ArrowRight, ShieldCheck, CreditCard } from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

interface QuickAtmWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function QuickAtmWithdrawalModal({
  isOpen,
  onClose,
  onSuccess,
}: QuickAtmWithdrawalModalProps) {
  const { balances, updateBalance } = useWallet();
  const { profile } = useAuth();

  const [amount, setAmount] = useState('');
  const [sourceWallet, setSourceWallet] = useState<WalletType>('kishor_bank');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const amountNum = parseFloat(amount) || 0;
  const availableBal = balances[sourceWallet] || 0;
  const isInsufficient = amountNum > availableBal;

  const bankOptions: { id: WalletType; label: string; icon: string; bal: number }[] = [
    { id: 'kishor_bank', label: 'Kishor UPI / Bank', icon: '📱', bal: balances.kishor_bank },
    { id: 'dad_bank', label: "Dad's Bank", icon: '🏦', bal: balances.dad_bank },
    { id: 'mom_bank', label: "Mom's Bank", icon: '🏛️', bal: balances.mom_bank },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountNum <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }
    if (isInsufficient) {
      alert(`Insufficient balance in ${sourceWallet.replace(/_/g, ' ')}. Available: ₹${availableBal.toLocaleString('en-IN')}`);
      return;
    }

    try {
      setIsSubmitting(true);
      triggerHapticFeedback('light');

      const sourceName = sourceWallet === 'kishor_bank' ? 'Kishor Bank' : sourceWallet === 'dad_bank' ? 'Dad Bank' : 'Mom Bank';
      const fullNote = notes.trim()
        ? `ATM Withdrawal (${sourceName} → Cash Box): ${notes.trim()}`
        : `ATM Cash Withdrawal (${sourceName} → Cash Box)`;

      // 1. Relocate balances: debit bank, credit Cash Box (deltas!)
      await updateBalance(sourceWallet, -amountNum);
      await updateBalance('cash_in_hand', amountNum);

      // 2. Insert into transactions table
      const { error } = await supabase.from('transactions').insert([
        {
          wallet_type: 'cash_in_hand',
          type: 'atm_withdrawal',
          status: 'completed',
          amount: amountNum,
          notes: fullNote,
          created_by: profile?.id || null,
        }
      ]);

      if (error) throw error;

      // 3. Record security audit log
      await supabase.from('security_audit_logs').insert({
        action_description: `ATM RELOCATION: ₹${amountNum.toLocaleString('en-IN')} transferred from ${sourceName} into Physical Cash Box.`,
        target_table: 'transactions',
      });

      triggerHapticFeedback('success');
      setAmount('');
      setNotes('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error recording ATM relocation:', err);
      alert('Error recording ATM withdrawal: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md max-h-[90dvh] flex flex-col shadow-2xl relative overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Landmark size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
                ATM Cash Withdrawal
              </h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Move money from Bank account into Physical Cash Box
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
              Withdrawal Amount (₹) *
            </label>
            <div className="relative max-w-[280px] mx-auto">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400 select-none">
                ₹
              </span>
              <input
                type="number"
                required
                min={100}
                step={500}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white border-2 border-gray-200 focus:border-indigo-600 rounded-2xl pl-10 pr-6 py-3 text-2xl sm:text-3xl font-black text-gray-900 tracking-tight shadow-xs text-center focus:outline-none transition-all font-mono"
                autoFocus
              />
            </div>
          </div>

          {/* Transfer Flow Visualizer Card */}
          <div className="bg-slate-50 border border-gray-200 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Source Bank (Debit)</span>
              <strong className="text-gray-900 block truncate">
                {sourceWallet === 'kishor_bank' ? 'Kishor UPI' : sourceWallet === 'dad_bank' ? "Dad's Bank" : "Mom's Bank"}
              </strong>
            </div>

            <div className="flex items-center gap-1 text-indigo-600 px-2 py-1 bg-indigo-50 rounded-xl border border-indigo-100">
              <span className="text-[10px] font-extrabold">₹{amountNum.toLocaleString('en-IN')}</span>
              <ArrowRight size={13} />
            </div>

            <div className="space-y-0.5 text-right">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Destination (Credit)</span>
              <strong className="text-emerald-700 block">Cash in Hand 💵</strong>
            </div>
          </div>

          {/* Source Bank Account Options */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Withdraw From Which Bank Account?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {bankOptions.map((w) => {
                const isSelected = sourceWallet === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSourceWallet(w.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-400/30'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{w.icon}</span>
                      <span className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded ${
                        isSelected ? 'bg-indigo-700 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        ₹{w.bal.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold truncate">{w.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Reference Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              ATM / Cheque Reference (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. SBI ATM #4920 or Dad withdraw cash"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-600 rounded-xl px-3.5 py-2 text-xs font-medium text-gray-900 focus:outline-none"
            />
          </div>

          {isInsufficient && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-900 text-xs font-bold">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>Insufficient balance in source bank! Available: ₹{availableBal.toLocaleString('en-IN')}</span>
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
              className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Confirm ATM Cash Inflow (₹{amountNum.toLocaleString('en-IN')})</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
