'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useWallet, WalletType } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { Landmark, X } from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

interface QuickAtmWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const WALLET_META: Record<Exclude<WalletType, 'cash_in_hand'>, { name: string; shortName: string }> = {
  kishor_bank: {
    name: 'Dr. Kishor Account',
    shortName: 'Kishor Bank',
  },
  dad_bank: {
    name: 'Anbazhakan (Dad) Account',
    shortName: 'Dad Bank',
  },
  mom_bank: {
    name: 'Parimalam (Mom) Account',
    shortName: 'Mom Bank',
  },
};

export default function QuickAtmWithdrawalModal({
  isOpen,
  onClose,
  onSuccess,
}: QuickAtmWithdrawalModalProps) {
  const { balances, updateBalance } = useWallet();
  const { profile } = useAuth();

  const [relocateAmount, setRelocateAmount] = useState<string>('');
  const [relocateSource, setRelocateSource] = useState<Exclude<WalletType, 'cash_in_hand'>>('kishor_bank');
  const [isProcessingTransfer, setIsProcessingTransfer] = useState<boolean>(false);

  // Auto-select the bank that has money and set its balance so Dad instantly sees what to withdraw
  useEffect(() => {
    if (isOpen) {
      const bankWithFunds = (['kishor_bank', 'dad_bank', 'mom_bank'] as const).find(
        (key) => (balances[key] || 0) > 0
      );
      if (bankWithFunds) {
        setRelocateSource(bankWithFunds);
        setRelocateAmount(String(balances[bankWithFunds] || 0));
      } else {
        setRelocateSource('kishor_bank');
        setRelocateAmount('');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const currentBankBalance = balances[relocateSource] || 0;

  const handleSelectBank = (bKey: Exclude<WalletType, 'cash_in_hand'>) => {
    triggerHapticFeedback('light');
    setRelocateSource(bKey);
    const bal = balances[bKey] || 0;
    // Auto-fill bank's full balance for Dad
    setRelocateAmount(bal > 0 ? String(bal) : '');
  };

  const handleTriggerATM = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(relocateAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }
    if ((balances[relocateSource] || 0) < amount) {
      alert(`Insufficient balance in ${WALLET_META[relocateSource].name}. Available: ${formatCurrency(balances[relocateSource] || 0)}`);
      return;
    }

    try {
      setIsProcessingTransfer(true);
      triggerHapticFeedback('light');

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
        },
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
      onClose();
      if (onSuccess) onSuccess();
      alert(`✓ ATM Withdrawal of ${formatCurrency(amount)} triggered from ${sourceName}!\n\n⚠️ Step 2 Pending: Please confirm inflow once currency notes are in the Physical Cash Box.`);
    } catch (err: any) {
      console.error('Error triggering ATM relocation:', err);
      alert('Error triggering ATM: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessingTransfer(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Landmark size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900">ATM Bank to Cash Box</h3>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                2-Step Verification
              </span>
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

        {/* Form matching Treasury modal */}
        <form onSubmit={handleTriggerATM} className="space-y-4">
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-between px-1">
              <label className="text-[11px] font-extrabold uppercase text-gray-500">
                WITHDRAWAL AMOUNT (₹)
              </label>
              {currentBankBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setRelocateAmount(String(currentBankBalance))}
                  className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100 cursor-pointer"
                >
                  Withdraw All ({formatCurrency(currentBankBalance)})
                </button>
              )}
            </div>
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
            <label className="text-xs font-bold text-gray-700 uppercase">
              DEBIT FROM WHICH BANK?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['kishor_bank', 'dad_bank', 'mom_bank'] as const).map((bKey) => {
                const bal = balances[bKey] || 0;
                const isSelected = relocateSource === bKey;

                return (
                  <button
                    key={bKey}
                    type="button"
                    onClick={() => handleSelectBank(bKey)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                  >
                    <div className="text-[10px] font-bold truncate">{WALLET_META[bKey].shortName}</div>
                    <div className="text-xs font-mono font-black mt-0.5">{formatCurrency(bal)}</div>
                  </button>
                );
              })}
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
  );
}
