'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { 
  CalendarClock, 
  X, 
  Sparkles, 
  Check, 
  Calendar 
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-gray-900 max-h-[90dvh] overflow-y-auto my-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 shrink-0">
              <CalendarClock size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-gray-900 leading-tight truncate">
                Configure Auction Schedule
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 font-medium truncate">
                {groupName || 'Chit Group'} • Month {currentMonth}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSaveSchedule} className="space-y-4">
          
          {/* SECTION 1: SPECIFIC NEXT AUCTION DATE & TIME */}
          <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Sparkles size={12} className="text-indigo-600" />
                Next Auction (Month {currentMonth}) Date &amp; Time
              </label>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                Custom Override
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">Date</label>
                <input
                  type="date"
                  value={editNextDate}
                  onChange={(e) => setEditNextDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">Time</label>
                <input
                  type="time"
                  value={editNextTime}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    setEditNextTime(rawVal);
                  }}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs font-mono"
                />
              </div>
            </div>

            {editNextDate && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditNextDate('');
                    setEditNextTime(editDefaultTime || '19:00');
                  }}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Clear Custom Override (Use Standard Rule)
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: STANDING RECURRING PATTERN (Default rule for all subsequent months) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar size={12} className="text-slate-500" />
                Standing Recurring Rule (All Months)
              </label>
              <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
                Standard Rule
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">Earliest Day (e.g. 10th)</label>
                <select
                  value={editDayOfMonth}
                  onChange={(e) => setEditDayOfMonth(Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}th of the month
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">Standard Default Time</label>
                <input
                  type="time"
                  value={editDefaultTime}
                  onChange={(e) => setEditDefaultTime(e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs font-mono"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              Standard logic: Regular auctions are held on the <strong>first Sunday on or after the {editDayOfMonth}th</strong> of every calendar month.
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
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/60 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <CalendarClock size={16} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-indigo-900/70 uppercase tracking-wider block">Calculated Upcoming Auction</span>
                    <span className="text-xs sm:text-sm font-black text-indigo-950">
                      {previewCountdown.formattedTargetDate} · {previewCountdown.formattedTargetTime}
                    </span>
                  </div>
                </div>
                {editNextDate ? (
                  <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                    Custom Override
                  </span>
                ) : (
                  <span className="text-[9px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md">
                    1st Sun on/after {editDayOfMonth}th
                  </span>
                )}
              </div>
            );
          })()}

          {/* SECTION 3: RESCHEDULE REASON / MEMBER NOTIFICATION NOTE */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 font-bold uppercase flex items-center justify-between">
              <span>Reschedule Reason (Notified to Members)</span>
              <span className="text-[9px] text-gray-400 font-normal">Optional</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Postponed due to festival / Sunday timing update"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none shadow-2xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:flex-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 text-center"
            >
              <Check size={14} />
              {isSaving ? 'Saving Schedule...' : 'Save Auction Schedule'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
