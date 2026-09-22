'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { X, Landmark, Check, AlertCircle, RefreshCw, ArrowRight, ShieldCheck, Banknote, Clock } from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

interface QuickAtmWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PendingInflowItem {
  id: string;
  amount: number;
  source: WalletType;
  notes: string;
  created_at: string;
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
  const [pendingInflows, setPendingInflows] = useState<PendingInflowItem[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Fetch any pending ATM withdrawals awaiting physical cash box verification
  const fetchPendingInflows = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('type', 'atm_withdrawal')
        .eq('status', 'pending_verification')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const items: PendingInflowItem[] = data.map((tx: any) => {
          let source: WalletType = 'kishor_bank';
          const n = (tx.notes || '').toLowerCase();
          if (n.includes('dad')) source = 'dad_bank';
          else if (n.includes('mom')) source = 'mom_bank';
          else if (n.includes('kishor')) source = 'kishor_bank';

          return {
            id: tx.id,
            amount: Number(tx.amount || 0),
            source,
            notes: tx.notes || '',
            created_at: tx.created_at,
          };
        });
        setPendingInflows(items);
      }
    } catch (err) {
      console.error('Error fetching pending inflows:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPendingInflows();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const amountNum = parseFloat(amount) || 0;
  const availableBal = balances[sourceWallet] || 0;
  const isInsufficient = amountNum > availableBal;

  const bankOptions: { id: WalletType; label: string; icon: string; bal: number }[] = [
    { id: 'kishor_bank', label: 'Kishor UPI / Bank', icon: '📱', bal: balances.kishor_bank },
    { id: 'dad_bank', label: "Dad's Bank", icon: '🏦', bal: balances.dad_bank },
    { id: 'mom_bank', label: "Mom's Bank", icon: '🏛️', bal: balances.mom_bank },
  ];

  // STEP 1: Trigger ATM Withdrawal (Debits Bank, creates pending record)
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
      const noteDetail = notes.trim() ? ` | Note: ${notes.trim()}` : '';
      const fullNote = `[ATM Relocation] From: ${sourceName} -> Cash Box${noteDetail} | Pending Physical Verification`;

      // 1. Debit Source Bank Account (delta is negative)
      await updateBalance(sourceWallet, -amountNum);

      // 2. Insert into transactions table as 'pending_verification'
      const { error } = await supabase.from('transactions').insert([
        {
          wallet_type: 'cash_in_hand',
          type: 'atm_withdrawal',
          status: 'pending_verification',
          amount: amountNum,
          notes: fullNote,
          created_by: profile?.id || null,
        }
      ]);

      if (error) throw error;

      // 3. Record security audit log
      await supabase.from('security_audit_logs').insert({
        action_description: `ATM RELOCATION TRIGGERED: ₹${amountNum.toLocaleString('en-IN')} debited from ${sourceName}. Pending physical cash box inflow confirmation.`,
        target_table: 'transactions',
      });

      triggerHapticFeedback('success');
      setAmount('');
      setNotes('');
      await fetchPendingInflows();
      if (onSuccess) onSuccess();
      alert(`✓ ATM Withdrawal of ₹${amountNum.toLocaleString('en-IN')} triggered from ${sourceName}!\n\n⚠️ Step 2 Pending: Please confirm inflow once currency notes are placed inside the Physical Cash Box.`);
    } catch (err: any) {
      console.error('Error triggering ATM relocation:', err);
      alert('Error triggering ATM withdrawal: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 2: Verify & Confirm Inflow to Cash Box
  const handleVerifyInflow = async (item: PendingInflowItem) => {
    try {
      setVerifyingId(item.id);
      triggerHapticFeedback('light');

      // 1. Credit Cash in Hand (delta is positive)
      await updateBalance('cash_in_hand', item.amount);

      // 2. Update transaction status in Supabase to 'completed'
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const updatedNotes = item.notes
        ? `${item.notes} | Verified & Credited to Cash Box on ${dateStr}`
        : `ATM Cash Withdrawal verified into Physical Cash Box on ${dateStr}`;

      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          notes: updatedNotes,
        })
        .eq('id', item.id);

      if (error) throw error;

      // 3. Record security audit log
      await supabase.from('security_audit_logs').insert({
        action_description: `ATM RELOCATION CONFIRMED: ₹${item.amount.toLocaleString('en-IN')} verified & credited into Physical Cash Box.`,
        target_table: 'transactions',
      });

      triggerHapticFeedback('success');
      await fetchPendingInflows();
      if (onSuccess) onSuccess();
      alert(`✓ Verified & Credited ₹${item.amount.toLocaleString('en-IN')} into Physical Cash Box!`);
    } catch (err: any) {
      console.error('Error verifying ATM inflow:', err);
      alert('Error verifying ATM inflow: ' + (err.message || 'Unknown error'));
    } finally {
      setVerifyingId(null);
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
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
                  ATM Bank-to-Cash
                </h3>
                <span className="text-[10px] text-indigo-700 font-extrabold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  2-Step Verify
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                Debit Bank → Place physical notes in Cash Box → Confirm
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
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Pending Inflow Verification List (if any exists) */}
          {pendingInflows.length > 0 && (
            <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-amber-600 animate-pulse" />
                  Pending Cash Box Verification ({pendingInflows.length})
                </h4>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full">
                  Step 2
                </span>
              </div>
              <p className="text-[11px] text-amber-800 font-medium leading-tight">
                Currency was debited from bank. Click below once notes are in the cash box:
              </p>
              <div className="space-y-2 pt-1">
                {pendingInflows.map((item) => {
                  const srcLabel = item.source === 'kishor_bank' ? 'Kishor Bank' : item.source === 'dad_bank' ? 'Dad Bank' : 'Mom Bank';
                  const isVerifying = verifyingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-amber-200 p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-gray-500 uppercase truncate">
                          From: {srcLabel}
                        </div>
                        <div className="text-base font-black text-gray-900 font-mono">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleVerifyInflow(item)}
                        disabled={isVerifying}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {isVerifying ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Check size={13} />
                        )}
                        <span>Confirm Inflow</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Relocation Trigger Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  min={1}
                  step="any"
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
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Step 1: Debit Bank</span>
                <strong className="text-gray-900 block truncate">
                  {sourceWallet === 'kishor_bank' ? 'Kishor UPI' : sourceWallet === 'dad_bank' ? "Dad's Bank" : "Mom's Bank"}
                </strong>
              </div>

              <div className="flex items-center gap-1 text-indigo-600 px-2 py-1 bg-indigo-50 rounded-xl border border-indigo-100">
                <span className="text-[10px] font-extrabold font-mono">₹{amountNum.toLocaleString('en-IN')}</span>
                <ArrowRight size={13} />
              </div>

              <div className="space-y-0.5 text-right">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Step 2: Credit Box</span>
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
                Close
              </button>
              <button
                type="submit"
                disabled={isSubmitting || amountNum <= 0 || isInsufficient}
                className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Triggering...</span>
                  </>
                ) : (
                  <>
                    <Landmark size={14} />
                    <span>Trigger ATM Withdrawal (₹{amountNum.toLocaleString('en-IN')})</span>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
}

