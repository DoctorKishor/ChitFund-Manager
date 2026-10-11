'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { 
  CalendarClock, 
  X, 
  Check, 
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  ChevronDown,
  RotateCcw,
  CalendarDays
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
  auctionTime = '10:30',
  nextAuctionDate,
  nextAuctionTime = '10:30',
  onScheduleUpdated,
}: AuctionScheduleModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState<string>('');

  // Mode: 'standard' (First Sunday after 10th) vs 'custom' (Specific Date Override)
  const [scheduleMode, setScheduleMode] = useState<'standard' | 'custom'>('standard');

  // Form states
  const [editNextDate, setEditNextDate] = useState<string>('');
  const [editNextTime, setEditNextTime] = useState<string>('10:30');
  const [editDayOfMonth, setEditDayOfMonth] = useState<number>(10);
  const [editDefaultTime, setEditDefaultTime] = useState<string>('10:30');
  const [showAdvancedDay, setShowAdvancedDay] = useState<boolean>(false);

  // Initialize and sync modal form states whenever it opens
  useEffect(() => {
    if (isOpen) {
      const dayVal = auctionDayOfMonth !== undefined && auctionDayOfMonth !== null ? Number(auctionDayOfMonth) : 10;
      const defaultTimeVal = auctionTime || '10:30';
      const hasCustomOverride = Boolean(nextAuctionDate && nextAuctionDate.trim().length > 0);

      setEditDayOfMonth(dayVal);
      setEditDefaultTime(defaultTimeVal);
      setEditNextDate(nextAuctionDate || '');
      setEditNextTime(nextAuctionTime || defaultTimeVal);
      setScheduleMode(hasCustomOverride ? 'custom' : 'standard');
      setRescheduleReason('');
      setShowAdvancedDay(dayVal !== 10);
    }
  }, [isOpen, nextAuctionDate, nextAuctionTime, auctionDayOfMonth, auctionTime]);

  // Compute live preview date & countdown dynamically
  const preview = useMemo(() => {
    const isCustom = scheduleMode === 'custom' && Boolean(editNextDate);
    const targetDate = computeNextAuctionDateTime({
      auction_day_of_month: editDayOfMonth,
      auction_time: editDefaultTime,
      next_auction_date: isCustom ? editNextDate : null,
      next_auction_time: isCustom ? (editNextTime || editDefaultTime) : editDefaultTime,
      start_date: startDate,
      current_month: currentMonth,
    });
    const countdown = calculateAuctionCountdown(targetDate);
    return { targetDate, countdown, isCustom };
  }, [scheduleMode, editDayOfMonth, editDefaultTime, editNextDate, editNextTime, startDate, currentMonth]);

  if (!isOpen) return null;

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;

    try {
      setIsSaving(true);
      triggerHapticFeedback('light');

      const isCustom = scheduleMode === 'custom' && Boolean(editNextDate);
      const finalTime = isCustom ? (editNextTime || editDefaultTime || '10:30') : (editDefaultTime || '10:30');
      const finalDate = isCustom ? editNextDate : null;

      const updatePayload: any = {
        auction_day_of_month: editDayOfMonth,
        auction_time: editDefaultTime || finalTime,
        next_auction_date: finalDate,
        next_auction_time: finalTime,
        last_rescheduled_at: new Date().toISOString(),
        reschedule_reason: rescheduleReason.trim() || (isCustom ? 'Custom date set by Admin' : 'Standard schedule (1st Sun on/after 10th)'),
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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto no-scrollbar">
      {/* Background click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 text-slate-900 max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto no-scrollbar my-0 sm:my-auto flex flex-col">
        
        {/* Mobile Pull Handle Indicator */}
        <div className="sm:hidden flex justify-center -mt-1 pb-1">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
              <CalendarClock size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                Auction Schedule
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {groupName || 'Chit Group'} <span className="text-slate-300">•</span> Month {currentMonth}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Main Configuration Form */}
        <form onSubmit={handleSaveSchedule} className="space-y-4 flex-1 overflow-y-auto no-scrollbar">

          {/* ── OPTION 1: STANDARD RECURRING RULE (DEFAULT) ── */}
          <div
            onClick={() => {
              triggerHapticFeedback('light');
              setScheduleMode('standard');
            }}
            className={`cursor-pointer rounded-2xl p-4 border transition-all duration-150 ${
              scheduleMode === 'standard'
                ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  scheduleMode === 'standard' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                }`}>
                  {scheduleMode === 'standard' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">
                      First Sunday on or after 10th
                    </span>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      Default &amp; Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Standard community rule. Auctions run automatically on the first Sunday after the 10th of every month.
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-controls when Standard is active */}
            {scheduleMode === 'standard' && (
              <div className="mt-3 pt-3 border-t border-indigo-100/80 space-y-3 animate-in fade-in duration-150" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock size={14} className="text-indigo-600" />
                    Auction Time
                  </label>
                  <input
                    type="time"
                    value={editDefaultTime}
                    onChange={(e) => setEditDefaultTime(e.target.value)}
                    className="bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none shadow-2xs font-mono w-full sm:w-36"
                  />
                </div>

                {/* Optional Cutoff Day Customization (collapsed by default to keep it clean) */}
                <div className="pt-1">
                  {!showAdvancedDay ? (
                    <button
                      type="button"
                      onClick={() => setShowAdvancedDay(true)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-1"
                    >
                      <ChevronDown size={12} />
                      Customize cutoff day (currently {editDayOfMonth}th)
                    </button>
                  ) : (
                    <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-slate-600">Cutoff Day:</span>
                      <select
                        value={editDayOfMonth}
                        onChange={(e) => setEditDayOfMonth(Number(e.target.value))}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {d}th of the month {d === 10 ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── OPTION 2: SPECIFIC CUSTOM DATE & TIME OVERRIDE ── */}
          <div
            onClick={() => {
              triggerHapticFeedback('light');
              setScheduleMode('custom');
            }}
            className={`cursor-pointer rounded-2xl p-4 border transition-all duration-150 ${
              scheduleMode === 'custom'
                ? 'bg-amber-50/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  scheduleMode === 'custom' ? 'border-amber-600 bg-amber-600' : 'border-slate-300 bg-white'
                }`}>
                  {scheduleMode === 'custom' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">
                      Specific Custom Date &amp; Time
                    </span>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Month {currentMonth} Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Override this month&apos;s session for holidays, festivals, or rescheduled member meetings.
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-controls when Custom is active */}
            {scheduleMode === 'custom' && (
              <div className="mt-3 pt-3 border-t border-amber-100 space-y-3 animate-in fade-in duration-150" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Date</label>
                    <input
                      type="date"
                      required={scheduleMode === 'custom'}
                      value={editNextDate}
                      onChange={(e) => setEditNextDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none shadow-2xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Time</label>
                    <input
                      type="time"
                      value={editNextTime}
                      onChange={(e) => setEditNextTime(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none shadow-2xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Reason for Reschedule</span>
                    <span className="text-[9px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Postponed due to festival / member request"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none shadow-2xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── LIVE CALCULATED PREVIEW CARD ── */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CalendarDays size={12} className="text-indigo-400" />
                Calculated Upcoming Auction
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                preview.isCustom 
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' 
                  : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
              }`}>
                {preview.isCustom ? 'Custom Override' : '1st Sunday on/after 10th'}
              </span>
            </div>

            <div className="text-base sm:text-lg font-bold font-mono text-white tracking-tight pt-0.5">
              {preview.countdown.formattedTargetDate} <span className="text-indigo-400">·</span> {preview.countdown.formattedTargetTime}
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              {preview.countdown.isPast 
                ? 'Scheduled time has passed' 
                : `In approximately ${preview.countdown.days}d ${preview.countdown.hours}h ${preview.countdown.minutes}m`}
            </p>
          </div>

          {/* ── ACTION BUTTONS (MOBILE OPTIMIZED TOUCH TARGETS) ── */}
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || (scheduleMode === 'custom' && !editNextDate)}
              className="w-full sm:flex-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Check size={16} />
              <span>{isSaving ? 'Saving Schedule...' : 'Save Auction Schedule'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
