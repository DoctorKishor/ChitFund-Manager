'use client';

import React from 'react';
import { useWallet, WalletType } from '../context/WalletContext';
import { Wallet, Landmark, TrendingUp, Sparkles, CreditCard } from 'lucide-react';

interface WalletMetadata {
  key: WalletType;
  label: string;
  subLabel: string;
  mask: string;
  isPrimary?: boolean;
  accentBg: string;
  accentText: string;
  icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>;
}

const WALLET_LIST: WalletMetadata[] = [
  { 
    key: 'kishor_bank', 
    label: 'Kishor Bank', 
    subLabel: 'Primary Digital UPI', 
    mask: '3778 **** 1289', 
    isPrimary: true,
    accentBg: 'bg-[#1814F3]',
    accentText: 'text-[#1814F3]',
    icon: Landmark 
  },
  { 
    key: 'cash_in_hand', 
    label: 'Physical Cash Box', 
    subLabel: 'On-Site Vault', 
    mask: 'VAULT-001-CASH', 
    accentBg: 'bg-[#16DBCC]',
    accentText: 'text-[#10A89C]',
    icon: Wallet 
  },
  { 
    key: 'dad_bank', 
    label: 'Dad Bank', 
    subLabel: 'Secondary Reserve', 
    mask: '5282 **** 4012', 
    accentBg: 'bg-[#FFBB38]',
    accentText: 'text-[#D99A1C]',
    icon: Landmark 
  },
  { 
    key: 'mom_bank', 
    label: 'Mom Bank', 
    subLabel: 'Tertiary Account', 
    mask: '4921 **** 9832', 
    accentBg: 'bg-[#FF82AC]',
    accentText: 'text-[#E04F7E]',
    icon: Landmark 
  },
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
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
          My Cards &amp; Multi-Vault Treasury
        </h2>
        <span className="text-xs font-bold text-[#64CFF6] hover:underline cursor-pointer">
          4 Real-Time Vaults
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full">
        {WALLET_LIST.map((wallet) => {
          const Icon = wallet.icon;
          const balance = balances[wallet.key] || 0;
          const isFlashing = lastChangedWallet === wallet.key;

          if (wallet.isPrimary) {
            // Figma Template Signature Gradient Card: linear-gradient(175deg, #9C2CF3 0%, #3A6FF9 100%)
            return (
              <div
                key={wallet.key}
                className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 text-white bg-gradient-to-br from-[#9C2CF3] to-[#3A6FF9] shadow-xl shadow-[#9C2CF3]/20 transition-all duration-300 hover:-translate-y-0.5 ${
                  isFlashing ? 'ring-4 ring-[#02B15A] scale-[1.02]' : ''
                }`}
              >
                {/* Micro Chip & Master badge */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[11px] font-semibold text-white/80 block uppercase tracking-wider">
                      Current Balance
                    </span>
                    <span className="text-xl sm:text-2xl font-black tracking-tight text-white block mt-0.5">
                      {formatCurrency(balance)}
                    </span>
                  </div>
                  <div className="flex items-center -space-x-2 opacity-90">
                    <div className="w-6 h-6 rounded-full bg-white/40 backdrop-blur-xs" />
                    <div className="w-6 h-6 rounded-full bg-white/25 backdrop-blur-xs" />
                  </div>
                </div>

                <div className="flex items-end justify-between pt-2 border-t border-white/20">
                  <div>
                    <span className="text-[10px] text-white/70 block uppercase font-medium">VAULT</span>
                    <span className="text-xs font-bold text-white block truncate">{wallet.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-white/70 block uppercase font-medium">TYPE</span>
                    <span className="text-xs font-bold text-white block font-mono">{wallet.mask}</span>
                  </div>
                </div>
              </div>
            );
          }

          // Figma Template Elevated Dark Surface Card (#1D1D41)
          return (
            <div
              key={wallet.key}
              className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 bg-[#1D1D41] border border-[#27264E] text-white shadow-xl transition-all duration-300 hover:border-[#6359E9]/50 hover:-translate-y-0.5 ${
                isFlashing ? 'border-[#02B15A] ring-4 ring-[#02B15A]/30 bg-[#02B15A]/10 scale-[1.02]' : ''
              }`}
            >
              {/* Top row: Label & Icon */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[11px] font-semibold text-[#AEABD8] block uppercase tracking-wider">
                    Current Balance
                  </span>
                  <span className={`text-xl sm:text-2xl font-black tracking-tight block mt-0.5 ${
                    isFlashing ? 'text-[#02B15A]' : 'text-white'
                  }`}>
                    {formatCurrency(balance)}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#27264E] text-[#64CFF6] shadow-sm">
                  <Icon size={18} strokeWidth={2.2} />
                </div>
              </div>

              <div className="flex items-end justify-between pt-2 border-t border-[#27264E]">
                <div>
                  <span className="text-[10px] text-[#AEABD8] block uppercase font-medium">VAULT</span>
                  <span className="text-xs font-bold text-white block truncate">{wallet.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#AEABD8] block uppercase font-medium">STATUS</span>
                  <span className="text-xs font-bold text-[#64CFF6] block font-mono truncate max-w-[100px]">{wallet.subLabel}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
