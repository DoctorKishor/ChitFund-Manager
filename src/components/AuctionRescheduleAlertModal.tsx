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
        className="w-full max-w-md rounded-3xl border border-[#27264E] bg-[#1D1D41] text-white shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto my-auto transition-all transform scale-100"
      >
        {/* Top Header Glow Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FFBB38] via-[#6359E9] to-[#02B15A]" />

        <div className="p-5 sm:p-6 space-y-4">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FFBB38]/15 border border-[#FFBB38]/30 text-[#FFBB38] flex items-center justify-center shrink-0 shadow-inner">
                <BellRing size={22} className="animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FFBB38] block flex items-center gap-1">
                  <span>Important Announcement</span>
                </span>
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug text-white">
                  Auction Rescheduled
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onRemindLater}
              className="p-1.5 rounded-xl transition-colors text-[#AEABD8] hover:text-white hover:bg-[#141332]"
              title="Close for now"
            >
              <X size={18} />
            </button>
          </div>

          {/* Group Card Information */}
          <div className="p-4 rounded-2xl border border-[#27264E] bg-[#141332] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="font-black text-sm text-white">{currentNotice.groupName}</h4>
                <p className="text-[11px] font-medium text-[#AEABD8]">
                  Chit Value: {formatCurrency(currentNotice.totalValue)}
                </p>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-[#6359E9]/20 text-[#64CFF6] border border-[#6359E9]/30">
                Month {currentNotice.currentMonth} Auction
              </span>
            </div>

            {/* Rescheduled Date & Time Box */}
            <div className="p-3.5 rounded-xl border border-[#FFBB38]/40 bg-[#FFBB38]/10 text-[#FFBB38] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2.5">
                <Calendar className="text-[#FFBB38] shrink-0" size={18} />
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider block opacity-75">New Auction Date</span>
                  <span className="text-xs font-black block text-white">{currentNotice.newDateStr}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2.5 sm:border-l sm:border-[#FFBB38]/30 sm:pl-3">
                <Clock className="text-[#FFBB38] shrink-0" size={18} />
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider block opacity-75">Time</span>
                  <span className="text-xs font-black block text-white">{currentNotice.newTimeStr}</span>
                </div>
              </div>
            </div>

            {/* Reschedule Reason */}
            {currentNotice.reason && (
              <div className="p-2.5 rounded-xl flex items-start space-x-2 text-xs bg-[#1D1D41] text-[#AEABD8] border border-[#27264E]">
                <Info size={14} className="text-[#64CFF6] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#64CFF6] block">Reason:</span>
                  <span className="text-[11px] font-medium leading-relaxed">{currentNotice.reason}</span>
                </div>
              </div>
            )}
          </div>

          {/* Multiple Notices Navigation */}
          {notices.length > 1 && (
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <span className="text-[11px] font-bold text-[#AEABD8]">
                Notice {currentIndex + 1} of {notices.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="p-1 rounded-lg border border-[#27264E] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#141332] text-white"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={currentIndex === notices.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(notices.length - 1, prev + 1))}
                  className="p-1 rounded-lg border border-[#27264E] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#141332] text-white"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-[#27264E]">
            <button
              type="button"
              onClick={onRemindLater}
              className="flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer bg-[#141332] hover:bg-[#27264E] border-[#27264E] text-[#AEABD8] hover:text-white"
            >
              Remind Me Later
            </button>
            <button
              type="button"
              onClick={handleAcknowledgeCurrent}
              disabled={isAcknowledging}
              className="flex-1 py-2.5 px-3.5 rounded-xl text-xs font-extrabold transition-all text-center bg-[#6359E9] hover:bg-[#6F64FF] active:scale-98 text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
