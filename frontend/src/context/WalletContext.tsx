'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from './AuthContext';

export type WalletType = 'cash_in_hand' | 'kishor_bank' | 'dad_bank' | 'mom_bank';

interface WalletBalances {
  cash_in_hand: number;
  kishor_bank: number;
  dad_bank: number;
  mom_bank: number;
}

interface WalletContextType {
  balances: WalletBalances;
  lastChangedWallet: WalletType | null;
  loading: boolean;
  updateBalance: (wallet: WalletType, amount: number) => Promise<void>;
  resetTreasuryToZero: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const DEFAULT_BALANCES: WalletBalances = {
  cash_in_hand: 0,
  kishor_bank: 0,
  dad_bank: 0,
  mom_bank: 0,
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth();
  const [balances, setBalances] = useState<WalletBalances>(DEFAULT_BALANCES);
  const [lastChangedWallet, setLastChangedWallet] = useState<WalletType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const isPrivileged = profile?.role === 'admin' || profile?.role === 'manager';

  // Fetch balances from Supabase & seed if empty (Admin/Manager only)
  const fetchTreasury = async () => {
    if (!isPrivileged) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('global_treasury')
        .select('*');

      if (error) {
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        // Seed initial wallets with 0 if empty
        const initialRows = [
          { wallet_type: 'cash_in_hand', current_balance: 0 },
          { wallet_type: 'kishor_bank', current_balance: 0 },
          { wallet_type: 'dad_bank', current_balance: 0 },
          { wallet_type: 'mom_bank', current_balance: 0 },
        ];
        await supabase.from('global_treasury').upsert(initialRows, { onConflict: 'wallet_type' });
        setBalances(DEFAULT_BALANCES);
      } else {
        const loaded: WalletBalances = { ...DEFAULT_BALANCES };
        data.forEach((row: any) => {
          if (row.wallet_type in loaded) {
            loaded[row.wallet_type as WalletType] = Number(row.current_balance) || 0;
          }
        });
        setBalances(loaded);
      }
    } catch (err) {
      console.warn('Treasury load note:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to reset all balances in Supabase to 0
  const resetTreasuryToZero = async () => {
    if (!isPrivileged) return;
    const zeroRows = [
      { wallet_type: 'cash_in_hand', current_balance: 0 },
      { wallet_type: 'kishor_bank', current_balance: 0 },
      { wallet_type: 'dad_bank', current_balance: 0 },
      { wallet_type: 'mom_bank', current_balance: 0 },
    ];
    await supabase.from('global_treasury').upsert(zeroRows, { onConflict: 'wallet_type' });
    setBalances(DEFAULT_BALANCES);
  };

  useEffect(() => {
    fetchTreasury();

    if (!isPrivileged) return;

    // Subscribe to Supabase Realtime changes
    const channel = supabase
      .channel('realtime_treasury')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'global_treasury' },
        (payload: any) => {
          if (payload.new && payload.new.wallet_type) {
            const w = payload.new.wallet_type as WalletType;
            const newBal = Number(payload.new.current_balance) || 0;
            setBalances((prev) => ({ ...prev, [w]: newBal }));
            setLastChangedWallet(w);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile?.role]);

  // Flash indicator reset
  useEffect(() => {
    if (lastChangedWallet) {
      const timer = setTimeout(() => {
        setLastChangedWallet(null);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [lastChangedWallet]);

  const updateBalance = async (wallet: WalletType, amount: number) => {
    const newBal = (balances[wallet] || 0) + amount;
    setBalances((prev) => ({
      ...prev,
      [wallet]: newBal,
    }));
    setLastChangedWallet(wallet);

    try {
      await supabase
        .from('global_treasury')
        .upsert({
          wallet_type: wallet,
          current_balance: newBal,
          last_updated_by: user?.id || null,
        }, { onConflict: 'wallet_type' });
    } catch (err) {
      console.error('Error updating treasury balance in Supabase:', err);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        balances,
        lastChangedWallet,
        loading,
        updateBalance,
        resetTreasuryToZero,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
