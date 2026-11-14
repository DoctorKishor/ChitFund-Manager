'use client';

import React, { useState, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { Crown, X, Check, AlertCircle, ShieldCheck, Banknote, Landmark } from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

interface ChitGroupItem {
  id: string;
  name: string;
  totalValue: number;
  duration: number;
  currentMonth?: number;
}

interface WithdrawOrganizerProfitModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ChitGroupItem[];
  preselectedGroupId?: string | null;
  onSuccess?: () => void;
}

const VAULT_DETAILS: Record<WalletType, { label: string; sub: string; icon: any }> = {
  cash_in_hand: { label: 'Physical Cash Box', sub: 'Physical drawer currency', icon: Banknote },
  kishor_bank: { label: 'Kishor Bank Account', sub: 'Primary digital bank', icon: Landmark },
  dad_bank: { label: "Dad's Bank (Anbazhakan)", sub: 'Disbursement channel', icon: Landmark },
  mom_bank: { label: "Mom's Bank (Parimalam)", sub: 'Cheques & reserve account', icon: Landmark },
};

export default function WithdrawOrganizerProfitModal({
  isOpen,
  onClose,
  groups,
  preselectedGroupId,
  onSuccess,
}: WithdrawOrganizerProfitModalProps) {
  const { balances, updateBalance } = useWallet();
  const { profile } = useAuth();

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    preselectedGroupId || (groups[0]?.id || '')
  );
  const [sourceVault, setSourceVault] = useState<WalletType>('cash_in_hand');
  const [amountStr, setAmountStr] = useState<string>('');
  const [takenBy, setTakenBy] = useState<string>('Dr. Kishor');
  const [customTakenBy, setCustomTakenBy] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync preselected group
  React.useEffect(() => {
    if (preselectedGroupId) {
      setSelectedGroupId(preselectedGroupId);
    } else if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
  }, [preselectedGroupId, groups, selectedGroupId]);

  if (!isOpen) return null;

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || groups[0];
  const currentVaultBalance = balances[sourceVault] || 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handleQuickAmount = (val: number) => {
    triggerHapticFeedback('light');
    setAmountStr(String(val));
    setErrorMsg(null);
  };

  const handleWithdrawAllInVault = () => {
    triggerHapticFeedback('light');
    setAmountStr(String(currentVaultBalance));
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Please enter a valid withdrawal amount.');
      return;
    }

    if (amount > currentVaultBalance) {
      setErrorMsg(
        `Insufficient balance in ${VAULT_DETAILS[sourceVault].label}. Available: ${formatCurrency(currentVaultBalance)}`
      );
      return;
    }

    const recipient = takenBy === 'Other' ? (customTakenBy.trim() || 'Organizer') : takenBy;
    const groupName = selectedGroup ? selectedGroup.name : 'Chit Group';

    try {
      setIsSubmitting(true);
      triggerHapticFeedback('light');

      // 1. Atomically deduct delta from the chosen vault
      await updateBalance(sourceVault, -amount);

      // 2. Insert transaction with explicit 'organizer_profit' type (distinct from personal_draw and atm_withdrawal)
      const fullNote = `[Organizer Profit Payout] ${formatCurrency(amount)} taken by ${recipient} from ${VAULT_DETAILS[sourceVault].label} for "${groupName}". ${notes.trim() ? `Notes: ${notes.trim()}` : ''}`.trim();

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert({
          group_id: selectedGroup?.id || null,
          wallet_type: sourceVault,
          type: 'organizer_profit',
          status: 'completed',
          amount: amount,
          notes: fullNote,
          created_by: profile?.id || null,
          cycle_month: 0,
        })
        .select('id')
        .single();

      if (txError) {
        console.error('Failed to insert organizer profit transaction:', txError);
        // Rollback balance on failure
        await updateBalance(sourceVault, amount);
        setErrorMsg('Failed to record transaction: ' + txError.message);
        return;
      }

      // 3. Security Audit Log
      await supabase.from('security_audit_logs').insert({
        admin_id: profile?.id || null,
        action_description: `ORGANIZER PROFIT PAYOUT: ${formatCurrency(amount)} withdrawn by ${recipient} from ${VAULT_DETAILS[sourceVault].label} for group "${groupName}". (TxID: ${txData?.id || 'N/A'})`,
        target_table: 'transactions',
        timestamp: new Date().toISOString(),
      });

      triggerHapticFeedback('success');
      alert(`✓ Successfully recorded Organizer Profit Payout of ${formatCurrency(amount)} for ${recipient}!`);

      setAmountStr('');
      setNotes('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error withdrawing organizer profit:', err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150 text-slate-900 my-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl shadow-2xs">
              <Crown className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Take Organizer Profit
                </h3>
                <span className="text-[10px] font-extrabold bg-amber-100/70 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  Month 0 Realized Profit
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Withdraw launch earnings from rotational cash into personal ownership
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Distinct Explanatory Note (To distinguish from personal spends and ATM relocations) */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold text-amber-950">Distinct from Personal Draws &amp; ATM Moves:</strong>
            <p className="text-[11px] text-amber-800/90 mt-0.5">
              This action claims your <strong>earned business profit</strong> from Month 0 launch collections. It deducts physical notes from rotation and registers directly under Organizer Earnings.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Chit Group Selector */}
          {groups.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Source Chit Group
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none transition-colors"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} — Full Pot: {formatCurrency(g.totalValue)} ({g.duration}M)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Source Vault Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Withdraw From Vault
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(VAULT_DETAILS) as WalletType[]).map((wKey) => {
                const isSelected = sourceVault === wKey;
                const bal = balances[wKey] || 0;
                const Icon = VAULT_DETAILS[wKey].icon;

                return (
                  <button
                    key={wKey}
                    type="button"
                    onClick={() => {
                      triggerHapticFeedback('light');
                      setSourceVault(wKey);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400 text-amber-950 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold leading-tight">{VAULT_DETAILS[wKey].label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-600" />}
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-900 mt-1">
                      Avail: {formatCurrency(bal)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input & Quick Chips */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Withdrawal Amount (₹)
              </label>
              <button
                type="button"
                onClick={handleWithdrawAllInVault}
                className="text-[10px] font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
              >
                Withdraw All ({formatCurrency(currentVaultBalance)})
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                ₹
              </span>
              <input
                type="number"
                min="1"
                max={currentVaultBalance}
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="0"
                required
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl text-base font-bold font-mono text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {[25000, 50000, 100000, 200000].map((chipVal) => (
                <button
                  key={chipVal}
                  type="button"
                  onClick={() => handleQuickAmount(chipVal)}
                  className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                >
                  +{formatCurrency(chipVal)}
                </button>
              ))}
            </div>
          </div>

          {/* Taken By Recipient */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Profit Taken By
              </label>
              <select
                value={takenBy}
                onChange={(e) => setTakenBy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none transition-colors"
              >
                <option value="Dr. Kishor">Dr. Kishor</option>
                <option value="Anbazhakan">Anbazhakan (Dad)</option>
                <option value="Parimalam">Parimalam (Mom)</option>
                <option value="Other">Other (Custom)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Reference / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Home cash withdrawal"
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {takenBy === 'Other' && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Custom Recipient Name
              </label>
              <input
                type="text"
                value={customTakenBy}
                onChange={(e) => setCustomTakenBy(e.target.value)}
                placeholder="Enter person's name"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amountStr || Number(amountStr) <= 0}
              className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs shadow-amber-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Crown size={14} className="shrink-0" />
              <span>{isSubmitting ? 'Recording...' : 'Confirm Profit Payout'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
