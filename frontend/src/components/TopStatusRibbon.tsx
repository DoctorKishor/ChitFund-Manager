'use client';

import React from 'react';
import { useWallet, WalletType } from '../context/WalletContext';
import { Wallet, Landmark, TrendingUp } from 'lucide-react';

interface WalletMetadata {
  key: WalletType;
  label: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
}

const WALLET_LIST: WalletMetadata[] = [
  { key: 'cash_in_hand', label: 'Physical Cash Box', icon: Wallet },
  { key: 'kishor_bank', label: 'Kishor Bank', icon: Landmark },
  { key: 'dad_bank', label: 'Dad Bank', icon: Landmark },
  { key: 'mom_bank', label: 'Mom Bank', icon: Landmark },
];

export default function TopStatusRibbon() {
  const { balances, lastChangedWallet } = useWallet();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {WALLET_LIST.map((wallet) => {
        const Icon = wallet.icon;
        const balance = balances[wallet.key];
        const isFlashing = lastChangedWallet === wallet.key;

        return (
          <div
            key={wallet.key}
            className={`relative overflow-hidden bg-white border rounded-xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 ${
              isFlashing
                ? 'border-green-500 bg-green-50 scale-[1.02] shadow-md ring-2 ring-green-500/10'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Real-time Indicator Dot */}
            <div className="absolute top-2 right-2 flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFlashing ? 'bg-green-400' : 'bg-indigo-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isFlashing ? 'bg-green-500' : 'bg-indigo-600'}`}></span>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`p-2.5 rounded-lg border ${
                isFlashing 
                  ? 'bg-green-100 border-green-200 text-green-700' 
                  : 'bg-gray-50 border-gray-150 text-gray-700'
              }`}>
                <Icon size={20} />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                  {wallet.label}
                </span>
                <span className={`text-lg font-bold tracking-tight transition-colors duration-300 ${
                  isFlashing ? 'text-green-600 font-extrabold' : 'text-gray-900'
                }`}>
                  {formatCurrency(balance)}
                </span>
              </div>
            </div>

            {/* Quick Micro Sparkline Indicator */}
            <div className="flex items-center text-xs text-gray-400 space-x-1 shrink-0">
              <TrendingUp size={12} className={isFlashing ? 'text-green-500' : 'text-indigo-600'} />
              <span className="font-medium text-[10px] text-gray-500">Realtime</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
