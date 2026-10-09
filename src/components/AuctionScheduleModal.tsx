'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { 
  CalendarClock, 
  X, 
  Sparkles, 
  Check, 
  Calendar,
  Clock,
  RotateCcw
} from 'lucide-react';
import { 
  computeNextAuctionDateTime, 
  calculateAuctionCountdown, 
  formatTime12h 
} from '@/utils/auctionSchedule';
import { triggerHapticFeedback } from '@/utils/haptics';

export interface AuctionScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName?: string;
  currentMonth?: number;
  startDate?: string | null;
  auctionDayOfMonth?: number | null;
  auctionTime?: string | null;
  nextAuctionDate?: string | null;
  nextAuctionTime?: string | null;
  onScheduleUpdated?: (updated: {
    auctionDayOfMonth: number;
    auctionTime: string;
    nextAuctionDate: string | null;
    nextAuctionTime: string;
  }) => void;
}

export default function AuctionScheduleModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  currentMonth = 1,
  startDate,
  auctionDayOfMonth = 10,
  auctionTime = '19:00',
  nextAuctionDate,
  nextAuctionTime = '19:00',
  onScheduleUpdated,
}: AuctionScheduleModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState<string>('');

  // Form states
  const [editNextDate, setEditNextDate] = useState<string>(nextAuctionDate || '');
  const [editNextTime, setEditNextTime] = useState<string>(nextAuctionTime || auctionTime || '19:00');
  const [editDayOfMonth, setEditDayOfMonth] = useState<number>(auctionDayOfMonth !== undefined && auctionDayOfMonth !== null ? Number(auctionDayOfMonth) : 10);
  const [editDefaultTime, setEditDefaultTime] = useState<string>(auctionTime || '19:00');

  // Sync modal form when props change or modal opens
  useEffect(() => {
    if (isOpen) {
      setEditNextDate(nextAuctionDate || '');
      setEditNextTime(nextAuctionTime || auctionTime || '19:00');
      setEditDayOfMonth(auctionDayOfMonth !== undefined && auctionDayOfMonth !== null ? Number(auctionDayOfMonth) : 10);
      setEditDefaultTime(auctionTime || '19:00');
      setRescheduleReason('');
    }
  }, [isOpen, nextAuctionDate, nextAuctionTime, auctionDayOfMonth, auctionTime]);

  if (!isOpen) return null;

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;

    try {
      setIsSaving(true);
      triggerHapticFeedback('light');

      const finalTime = editNextTime || editDefaultTime || '19:00';
      const finalDate = editNextDate ? editNextDate : null;

      const updatePayload: any = {
        auction_day_of_month: editDayOfMonth,
        auction_time: editDefaultTime || finalTime,
        next_auction_date: finalDate,
        next_auction_time: finalTime,
        last_rescheduled_at: new Date().toISOString(),
        reschedule_reason: rescheduleReason.trim() || 'Schedule updated by Admin',
      };

      const { error } = await supabase
        .from('chit_groups')
        .update(updatePayload)
        .eq('id', groupId);

      if (error) {
        alert('Failed to update auction schedule: ' + error.message);
        return;
      }

      triggerHapticFeedback('success');
      onClose();

      if (onScheduleUpdated) {
        onScheduleUpdated({
          auctionDayOfMonth: editDayOfMonth,
          auctionTime: editDefaultTime || finalTime,
          nextAuctionDate: finalDate,
          nextAuctionTime: finalTime,
        });
      }
    } catch (err: any) {
      console.error('Error saving auction schedule:', err);
      alert('Error updating schedule: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto no-scrollbar">
      <div className="bg-white border-t sm:border border-slate-200/90 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 text-slate-900 max-h-[88dvh] sm:max-h-[85vh] overflow-y-auto no-scrollbar my-0 sm:my-auto flex flex-col">
        
        {/* Mobile Pull Handle */}
        <div className="pt-1 pb-1 sm:hidden flex justify-center">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 flex items-center justify-center shrink-0">
              <CalendarClock size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold font-display text-slate-900 leading-tight truncate">
                Configure Auction Schedule
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium truncate">
                {groupName || 'Chit Group'} • Month {currentMonth}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSaveSchedule} className="space-y-3.5 flex-1 overflow-y-auto no-scrollbar pr-0.5">
          
          {/* SECTION 1: SPECIFIC NEXT AUCTION DATE & TIME */}
          <div className="bg-brand-50/40 border border-brand-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-700 flex items-center gap-1.5">
                <Sparkles size={12} className="text-brand-600" />
                Next Auction (Month {currentMonth}) Date &amp; Time
              </label>
              <span className="text-[10px] font-bold text-brand-700 bg-white border border-brand-200 px-2 py-0.5 rounded-md shadow-2xs">
                Custom Override
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Date</label>
                <input
                  type="date"
                  value={editNextDate}
                  onChange={(e) => setEditNextDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none shadow-2xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Time</label>
                <input
                  type="time"
                  value={editNextTime}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    setEditNextTime(rawVal);
                  }}
                  className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none shadow-2xs font-mono"
                />
              </div>
            </div>

            {editNextDate && (
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditNextDate('');
                    setEditNextTime(editDefaultTime || '19:00');
                  }}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw size={10} />
                  Clear Custom Override (Use Standard Rule)
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: STANDING RECURRING PATTERN (Default rule for all subsequent months) */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar size={12} className="text-slate-500" />
                Standing Recurring Rule (All Months)
              </label>
              <span className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                Standard Rule
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Earliest Day (e.g. 10th)</label>
                <select
                  value={editDayOfMonth}
                  onChange={(e) => setEditDayOfMonth(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none shadow-2xs"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d} className="bg-white text-slate-900">
                      {d}th of the month
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Standard Default Time</label>
                <input
                  type="time"
                  value={editDefaultTime}
                  onChange={(e) => setEditDefaultTime(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none shadow-2xs font-mono"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              Standard logic: Regular auctions are held on the <strong className="text-slate-800">first Sunday on or after the {editDayOfMonth}th</strong> of every calendar month.
            </p>
          </div>

          {/* LIVE COMPUTATION PREVIEW BOX */}
          {(() => {
            const previewTarget = computeNextAuctionDateTime({
              auction_day_of_month: editDayOfMonth,
              auction_time: editDefaultTime,
              next_auction_date: editNextDate ? editNextDate : null,
              next_auction_time: editNextTime || editDefaultTime,
              start_date: startDate,
              current_month: currentMonth,
            });
            const previewCountdown = calculateAuctionCountdown(previewTarget);
            return (
              <div className="bg-gradient-to-r from-brand-50/70 via-indigo-50/50 to-brand-50/70 border border-brand-200 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CalendarClock size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Calculated Upcoming Auction</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 truncate block">
                      {previewCountdown.formattedTargetDate} · {previewCountdown.formattedTargetTime}
                    </span>
                  </div>
                </div>
                {editNextDate ? (
                  <span className="text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md shrink-0">
                    Custom Override
                  </span>
                ) : (
                  <span className="text-[9px] font-bold uppercase bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md shrink-0 font-mono">
                    1st Sun on/after {editDayOfMonth}th
                  </span>
                )}
              </div>
            );
          })()}

          {/* SECTION 3: RESCHEDULE REASON / MEMBER NOTIFICATION NOTE */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase flex items-center justify-between">
              <span>Reschedule Reason (Notified to Members)</span>
              <span className="text-[9px] text-slate-400 font-normal">Optional</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Postponed due to festival / Sunday timing update"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-brand-500 focus:bg-white rounded-xl px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none shadow-2xs transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer text-center border border-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:flex-2 bg-brand-600 hover:bg-brand-700 active:scale-98 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 text-center"
            >
              <Check size={14} />
              <span>{isSaving ? 'Saving Schedule...' : 'Save Auction Schedule'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
