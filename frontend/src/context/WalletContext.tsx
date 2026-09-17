'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  updateBalance: (wallet: WalletType, amount: number) => void;
  triggerMockTransaction: (type: 'collection' | 'payout' | 'transfer') => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [balances, setBalances] = useState<WalletBalances>({
    cash_in_hand: 45250,
    kishor_bank: 128400,
    dad_bank: 350000,
    mom_bank: 215300,
  });

  const [lastChangedWallet, setLastChangedWallet] = useState<WalletType | null>(null);

  const updateBalance = (wallet: WalletType, amount: number) => {
    setBalances((prev) => ({
      ...prev,
      [wallet]: prev[wallet] + amount,
    }));
    setLastChangedWallet(wallet);
  };

  // Reset the last changed state after the flash duration
  useEffect(() => {
    if (lastChangedWallet) {
      const timer = setTimeout(() => {
        setLastChangedWallet(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lastChangedWallet]);

  // Simulate periodic real-time updates for demonstration
  useEffect(() => {
    const interval = setInterval(() => {
      // Pick a random wallet to update slightly
      const wallets: WalletType[] = ['cash_in_hand', 'kishor_bank', 'dad_bank', 'mom_bank'];
      const randomWallet = wallets[Math.floor(Math.random() * wallets.length)];
      // Shift by +100 to +1000 or -50 to -500
      const isPositive = Math.random() > 0.4;
      const change = isPositive 
        ? Math.floor(Math.random() * 900) + 100 
        : -(Math.floor(Math.random() * 450) + 50);

      updateBalance(randomWallet, change);
    }, 12000); // Trigger every 12 seconds

    return () => clearInterval(interval);
  }, []);

  const triggerMockTransaction = (type: 'collection' | 'payout' | 'transfer') => {
    if (type === 'collection') {
      // Add cash to cash box
      updateBalance('cash_in_hand', 5000);
    } else if (type === 'payout') {
      // Deduct from dad bank
      updateBalance('dad_bank', -25000);
    } else if (type === 'transfer') {
      // Transfer cash in hand to kishor bank
      setBalances((prev) => ({
        ...prev,
        cash_in_hand: prev.cash_in_hand - 10000,
        kishor_bank: prev.kishor_bank + 10000,
      }));
      // Flash both
      setLastChangedWallet('cash_in_hand');
      setTimeout(() => {
        setLastChangedWallet('kishor_bank');
      }, 100);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        balances,
        lastChangedWallet,
        updateBalance,
        triggerMockTransaction,
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
