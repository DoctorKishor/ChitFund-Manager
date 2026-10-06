'use client';

import React from 'react';
import { 
  X, 
  ChevronRight, 
  Flame,
  Sparkles,
  Radio
} from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

export interface LiveGroupDetails {
  groupId: string;
  groupName: string;
  currentMonth: number;
  totalValue: number;
  startedAt?: string | null;
}

export interface LiveAuctionStartedModalProps {
  isOpen: boolean;
  liveGroup: LiveGroupDetails | null;
  onViewLiveAuction: (groupId: string) => void;
  onDismiss: () => void;
}

export default function LiveAuctionStartedModal({
  isOpen,
  liveGroup,
  onViewLiveAuction,
  onDismiss,
}: LiveAuctionStartedModalProps) {
  if (!isOpen || !liveGroup) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handleJoin = () => {
    triggerHapticFeedback('success');
    onViewLiveAuction(liveGroup.groupId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      
      {/* Crisp Cyber-Fintech Card */}
      <div className="relative w-full max-w-md bg-[#1D1D41] border border-[#27264E] rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto my-auto animate-in zoom-in-95 duration-200 text-white">
        
        {/* Top Gradient Ribbon Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#E41414] via-[#FFBB38] to-[#6359E9]" />

        <div className="p-4 sm:p-6 space-y-4">
          
          {/* Top Bar: Red Pulse Live Badge & Close Button */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E41414]/15 border border-[#E41414]/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E41414] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E41414]" />
              </span>
              <span className="text-[11px] font-black text-[#E41414] uppercase tracking-wider flex items-center gap-1">
                <Flame size={12} className="text-[#E41414] fill-[#E41414]" />
                Live Auction Active
              </span>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 text-[#AEABD8] hover:text-white hover:bg-[#141332] rounded-full transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight flex items-center gap-1.5">
              <span>The Bidding Floor is Open!</span>
              <Sparkles size={18} className="text-[#FFBB38] fill-[#FFBB38] shrink-0" />
            </h3>
            <p className="text-xs text-[#AEABD8] font-medium leading-relaxed">
              Subscribers are placing live discount bids right now. Enter the auction room to watch real-time turns.
            </p>
          </div>

          {/* Group Details Card */}
          <div className="p-4 rounded-2xl bg-[#141332] border border-[#27264E] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#64CFF6] block">
                  Enrolled Chit Group
                </span>
                <h4 className="font-black text-base text-white truncate mt-0.5">
                  {liveGroup.groupName}
                </h4>
              </div>

              <span className="px-3 py-1 rounded-xl text-xs font-black uppercase bg-[#6359E9] text-white shadow-xs shrink-0">
                Month {liveGroup.currentMonth}
              </span>
            </div>

            <div className="pt-2.5 border-t border-[#27264E]">
              <span className="text-[10px] font-bold text-[#AEABD8] uppercase tracking-wider block">
                Total Chit Value
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#02B15A] font-mono tracking-tight mt-1 block">
                {formatCurrency(liveGroup.totalValue)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onDismiss}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-[#AEABD8] bg-[#141332] hover:bg-[#27264E] hover:text-white border border-[#27264E] transition-colors cursor-pointer text-center"
            >
              Later
            </button>

            <button
              type="button"
              onClick={handleJoin}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#9C2CF3] to-[#3A6FF9] hover:opacity-95 shadow-md shadow-[#9C2CF3]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Radio size={14} className="animate-pulse shrink-0" />
              <span>Enter to Watch Live Auction</span>
              <ChevronRight size={14} className="shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
