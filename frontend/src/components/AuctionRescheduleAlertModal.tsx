'use client';

import React, { useState } from 'react';
import { 
  CalendarClock, 
  X, 
  Calendar, 
  Clock, 
  Info, 
  CheckCircle2, 
  BellRing,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { triggerHapticFeedback } from '@/utils/haptics';

export interface RescheduledGroupNotice {
  groupId: string;
  groupName: string;
  currentMonth: number;
  totalValue: number;
  newDateStr: string;
  newTimeStr: string;
  reason?: string | null;
  lastRescheduledAt: string;
}

export interface AuctionRescheduleAlertModalProps {
  isOpen: boolean;
  notices: RescheduledGroupNotice[];
  isDark?: boolean;
  onRemindLater: () => void;
  onAcknowledge: (groupId: string, lastRescheduledAt: string) => Promise<void>;
}

export default function AuctionRescheduleAlertModal({
  isOpen,
  notices,
  isDark = true,
  onRemindLater,
  onAcknowledge,
}: AuctionRescheduleAlertModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  if (!isOpen || notices.length === 0) return null;

  const currentNotice = notices[Math.min(currentIndex, notices.length - 1)];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handleAcknowledgeCurrent = async () => {
    if (!currentNotice) return;
    try {
      setIsAcknowledging(true);
      triggerHapticFeedback('success');
      await onAcknowledge(currentNotice.groupId, currentNotice.lastRescheduledAt);
      if (currentIndex < notices.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Error acknowledging reschedule notice:', err);
    } finally {
      setIsAcknowledging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto my-auto transition-all transform scale-100 ${
          isDark 
            ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-indigo-500/30 text-white shadow-indigo-950/50' 
            : 'bg-gradient-to-b from-white via-white to-slate-50 border-indigo-200 text-slate-900 shadow-slate-300'
        }`}
      >
        {/* Top Header Glow Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-indigo-500 to-emerald-400" />

        <div className="p-5 sm:p-6 space-y-4">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                <BellRing size={22} className="animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block flex items-center gap-1">
                  <span>Important Announcement</span>
                </span>
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                  Auction Rescheduled
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onRemindLater}
              className={`p-1.5 rounded-xl transition-colors ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title="Close for now"
            >
              <X size={18} />
            </button>
          </div>

          {/* Group Card Information */}
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isDark ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-black text-sm">{currentNotice.groupName}</h4>
                <p className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Chit Value: {formatCurrency(currentNotice.totalValue)}
                </p>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Month {currentNotice.currentMonth} Auction
              </span>
            </div>

            {/* Rescheduled Date & Time Box */}
            <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              isDark 
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-200' 
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}>
              <div className="flex items-center space-x-2.5">
                <Calendar className="text-amber-500 shrink-0" size={18} />
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider block opacity-75">New Auction Date</span>
                  <span className="text-xs font-black block">{currentNotice.newDateStr}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2.5 sm:border-l sm:border-amber-500/30 sm:pl-3">
                <Clock className="text-amber-500 shrink-0" size={18} />
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider block opacity-75">Time</span>
                  <span className="text-xs font-black block">{currentNotice.newTimeStr}</span>
                </div>
              </div>
            </div>

            {/* Reschedule Reason */}
            {currentNotice.reason && (
              <div className={`p-2.5 rounded-xl flex items-start space-x-2 text-xs ${
                isDark ? 'bg-slate-900/60 text-slate-300 border border-slate-700/50' : 'bg-white text-slate-700 border border-slate-200'
              }`}>
                <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 block">Reason:</span>
                  <span className="text-[11px] font-medium leading-relaxed">{currentNotice.reason}</span>
                </div>
              </div>
            )}
          </div>

          {/* Multiple Notices Navigation */}
          {notices.length > 1 && (
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Notice {currentIndex + 1} of {notices.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="p-1 rounded-lg border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={currentIndex === notices.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(notices.length - 1, prev + 1))}
                  className="p-1 rounded-lg border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onRemindLater}
              className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                isDark 
                  ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              Remind Me Later
            </button>
            <button
              type="button"
              onClick={handleAcknowledgeCurrent}
              disabled={isAcknowledging}
              className="flex-1 py-2.5 px-3.5 rounded-xl text-xs font-extrabold transition-all text-center bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-98 text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isAcknowledging ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Don&apos;t Show Again</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
