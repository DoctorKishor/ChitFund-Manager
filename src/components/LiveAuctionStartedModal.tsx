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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      
      {/* Crisp, Modern White Card */}
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto my-auto animate-in zoom-in-95 duration-200 text-slate-900">
        
        {/* Top Gradient Ribbon Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-400 to-indigo-600" />

        <div className="p-4 sm:p-6 space-y-4">
          
          {/* Top Bar: Clean Red Pulse Live Badge & Close Button */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
              </span>
              <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-1">
                <Flame size={12} className="text-rose-600 fill-rose-600" />
                Live Auction Active
              </span>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>

          {/* Heading with Crisp Dark Text */}
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight flex items-center gap-1.5">
              <span>The Bidding Floor is Open!</span>
              <Sparkles size={18} className="text-amber-500 fill-amber-400 shrink-0" />
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Subscribers are placing live discount bids right now. Enter the auction room to watch real-time turns.
            </p>
          </div>

          {/* Clean Group Details Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block">
                  Enrolled Chit Group
                </span>
                <h4 className="font-black text-base text-slate-900 truncate mt-0.5">
                  {liveGroup.groupName}
                </h4>
              </div>

              <span className="px-3 py-1 rounded-xl text-xs font-black uppercase bg-indigo-600 text-white shadow-xs shrink-0">
                Month {liveGroup.currentMonth}
              </span>
            </div>

            <div className="pt-2.5 border-t border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Chit Value
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono tracking-tight mt-1 block">
                {formatCurrency(liveGroup.totalValue)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onDismiss}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer text-center"
            >
              Later
            </button>

            <button
              type="button"
              onClick={handleJoin}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
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
