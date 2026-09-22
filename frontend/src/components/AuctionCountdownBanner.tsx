'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { 
  Clock, 
  Calendar, 
  CalendarClock, 
  Settings2, 
  Radio, 
  Check, 
  X, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { 
  computeNextAuctionDateTime, 
  calculateAuctionCountdown, 
  CountdownState,
  formatTime12h 
} from '@/utils/auctionSchedule';
import { triggerHapticFeedback } from '@/utils/haptics';
import AuctionScheduleModal from './AuctionScheduleModal';

interface AuctionCountdownBannerProps {
  groupId?: string;
  groupName?: string;
  currentMonth?: number;
  durationMonths?: number;
  auctionDayOfMonth?: number | null;
  auctionTime?: string | null;
  nextAuctionDate?: string | null;
  nextAuctionTime?: string | null;
  startDate?: string | null;
  allowConfigure?: boolean;
  onScheduleUpdated?: () => void;
  theme?: 'light' | 'dark';
  compact?: boolean;
}

export default function AuctionCountdownBanner({
  groupId,
  groupName,
  currentMonth = 1,
  durationMonths = 20,
  auctionDayOfMonth = 10,
  auctionTime = '19:00',
  nextAuctionDate,
  nextAuctionTime = '19:00',
  startDate,
  allowConfigure = false,
  onScheduleUpdated,
  theme = 'light',
  compact = false,
}: AuctionCountdownBannerProps) {
  // Active local configuration to guarantee instantaneous zero-lag UI updates
  const [activeConfig, setActiveConfig] = useState({
    auctionDayOfMonth: auctionDayOfMonth !== undefined && auctionDayOfMonth !== null ? Number(auctionDayOfMonth) : 10,
    auctionTime: auctionTime || '19:00',
    nextAuctionDate: nextAuctionDate || null,
    nextAuctionTime: nextAuctionTime || auctionTime || '19:00',
    startDate: startDate || null,
    currentMonth,
  });

  const [countdown, setCountdown] = useState<CountdownState>(() => {
    const target = computeNextAuctionDateTime({
      auction_day_of_month: activeConfig.auctionDayOfMonth,
      auction_time: activeConfig.auctionTime,
      next_auction_date: activeConfig.nextAuctionDate,
      next_auction_time: activeConfig.nextAuctionTime,
      start_date: activeConfig.startDate,
      current_month: activeConfig.currentMonth,
    });
    return calculateAuctionCountdown(target);
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal form states
  const [editNextDate, setEditNextDate] = useState<string>(nextAuctionDate || '');
  const [editNextTime, setEditNextTime] = useState<string>(nextAuctionTime || auctionTime || '19:00');
  const [editDayOfMonth, setEditDayOfMonth] = useState<number>(auctionDayOfMonth || 10);
  const [editDefaultTime, setEditDefaultTime] = useState<string>(auctionTime || '19:00');

  // Sync modal form and active config when parent props change
  useEffect(() => {
    const updated = {
      auctionDayOfMonth: auctionDayOfMonth !== undefined && auctionDayOfMonth !== null ? Number(auctionDayOfMonth) : 10,
      auctionTime: auctionTime || '19:00',
      nextAuctionDate: nextAuctionDate || null,
      nextAuctionTime: nextAuctionTime || auctionTime || '19:00',
      startDate: startDate || null,
      currentMonth,
    };
    setActiveConfig(updated);
    setEditNextDate(nextAuctionDate || '');
    setEditNextTime(nextAuctionTime || auctionTime || '19:00');
    setEditDayOfMonth(auctionDayOfMonth || 10);
    setEditDefaultTime(auctionTime || '19:00');

    const target = computeNextAuctionDateTime({
      auction_day_of_month: updated.auctionDayOfMonth,
      auction_time: updated.auctionTime,
      next_auction_date: updated.nextAuctionDate,
      next_auction_time: updated.nextAuctionTime,
      start_date: updated.startDate,
      current_month: updated.currentMonth,
    });
    setCountdown(calculateAuctionCountdown(target));
  }, [nextAuctionDate, nextAuctionTime, auctionDayOfMonth, auctionTime, startDate, currentMonth]);

  // Live 1-second countdown interval
  useEffect(() => {
    const updateCountdown = () => {
      const target = computeNextAuctionDateTime({
        auction_day_of_month: activeConfig.auctionDayOfMonth,
        auction_time: activeConfig.auctionTime,
        next_auction_date: activeConfig.nextAuctionDate,
        next_auction_time: activeConfig.nextAuctionTime,
        start_date: activeConfig.startDate,
        current_month: activeConfig.currentMonth,
      });
      setCountdown(calculateAuctionCountdown(target));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeConfig]);

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
      };

      const { error } = await supabase
        .from('chit_groups')
        .update(updatePayload)
        .eq('id', groupId);

      if (error) {
        alert('Failed to update auction schedule: ' + error.message);
        return;
      }

      // Optimistically update local active config and countdown immediately
      const newConfig = {
        auctionDayOfMonth: editDayOfMonth,
        auctionTime: editDefaultTime || finalTime,
        nextAuctionDate: finalDate,
        nextAuctionTime: finalTime,
        startDate: startDate || null,
        currentMonth,
      };
      setActiveConfig(newConfig);

      const newTarget = computeNextAuctionDateTime({
        auction_day_of_month: newConfig.auctionDayOfMonth,
        auction_time: newConfig.auctionTime,
        next_auction_date: newConfig.nextAuctionDate,
        next_auction_time: newConfig.nextAuctionTime,
        start_date: newConfig.startDate,
        current_month: newConfig.currentMonth,
      });
      setCountdown(calculateAuctionCountdown(newTarget));

      triggerHapticFeedback('success');
      setShowConfigModal(false);
      if (onScheduleUpdated) {
        onScheduleUpdated();
      }
    } catch (err: any) {
      console.error('Error saving auction schedule:', err);
      alert('Error updating schedule: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const isDark = theme === 'dark';

  // If in Month 0 (Launch Month / Organizer Profit phase)
  if (currentMonth === 0) {
    return (
      <div className={`rounded-xl sm:rounded-2xl p-2 sm:p-2.5 border transition-all ${
        isDark 
          ? 'bg-amber-950/40 border-amber-500/30 text-amber-200' 
          : 'bg-amber-50/80 border-amber-200 text-amber-900'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500 text-white shrink-0">
              <CalendarClock size={14} />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black">Month 0 — Organizer Profit Phase</span>
              <span className="text-[8px] font-bold uppercase bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded">
                No Auction
              </span>
              <span className="text-[10px] opacity-75 hidden md:inline">
                • 1st live auction starts Month 1 upon launch
              </span>
            </div>
          </div>

          {allowConfigure && groupId && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-all active:scale-95 flex items-center gap-1 self-start sm:self-auto cursor-pointer shadow-2xs"
            >
              <Settings2 size={12} />
              <span>Configure Schedule</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`rounded-xl sm:rounded-2xl border transition-all shadow-xs relative overflow-hidden ${
        compact ? 'p-2 sm:p-2.5' : 'py-2 sm:py-2.5 px-3 sm:px-4'
      } ${
        countdown.isLive
          ? isDark 
            ? 'bg-gradient-to-r from-rose-950/80 via-purple-950/60 to-slate-900 border-rose-500/50' 
            : 'bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 border-rose-300 text-rose-950'
          : isDark
            ? 'bg-gradient-to-br from-[#0e1629] via-slate-900 to-slate-900 border-indigo-500/30 text-white'
            : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Ambient Glow for Dark Mode */}
        {isDark && (
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-indigo-500/15 rounded-full blur-xl pointer-events-none" />
        )}

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          
          {/* Left Column: Title & Target Date / Time info */}
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {countdown.isLive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse shadow-xs">
                  <Radio size={9} className="animate-spin" /> Live Bidding Active
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  isDark 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                  Upcoming Auction (Month {currentMonth})
                </span>
              )}

              {groupName && (
                <span className={`text-[10px] font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  • {groupName}
                </span>
              )}
            </div>

            {/* Target Date & Time readout */}
            <div className={`flex items-center gap-2 text-[11px] sm:text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
              <div className={`flex items-center gap-1 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                <Calendar size={12} className={`shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
                <span>{countdown.formattedTargetDate}</span>
              </div>
              <span className="opacity-40">•</span>
              <div className={`flex items-center gap-1 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                <Clock size={12} className={`shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
                <span>{countdown.formattedTargetTime}</span>
              </div>
            </div>
          </div>

          {/* Center / Right: Compact Live Digital Countdown Segments */}
          <div className="flex items-center gap-1 sm:gap-1.5 self-start sm:self-auto">
            {/* Days */}
            <div className={`rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[38px] sm:min-w-[46px] ${
              isDark 
                ? 'bg-[#080d19]/90 backdrop-blur-md border border-indigo-500/30 shadow-inner' 
                : 'bg-slate-50 border border-slate-200 shadow-2xs'
            }`}>
              <span className={`text-xs sm:text-base font-black font-mono block leading-tight tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {String(countdown.days).padStart(2, '0')}
              </span>
              <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider block mt-0.2 leading-none ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Days
              </span>
            </div>

            <span className={`text-xs sm:text-sm font-black font-mono ${isDark ? 'text-indigo-400' : 'text-slate-300'}`}>:</span>

            {/* Hours */}
            <div className={`rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[38px] sm:min-w-[46px] ${
              isDark 
                ? 'bg-[#080d19]/90 backdrop-blur-md border border-indigo-500/30 shadow-inner' 
                : 'bg-slate-50 border border-slate-200 shadow-2xs'
            }`}>
              <span className={`text-xs sm:text-base font-black font-mono block leading-tight tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {String(countdown.hours).padStart(2, '0')}
              </span>
              <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider block mt-0.2 leading-none ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Hours
              </span>
            </div>

            <span className={`text-xs sm:text-sm font-black font-mono ${isDark ? 'text-indigo-400' : 'text-slate-300'}`}>:</span>

            {/* Minutes */}
            <div className={`rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[38px] sm:min-w-[46px] ${
              isDark 
                ? 'bg-[#080d19]/90 backdrop-blur-md border border-indigo-500/30 shadow-inner' 
                : 'bg-slate-50 border border-slate-200 shadow-2xs'
            }`}>
              <span className={`text-xs sm:text-base font-black font-mono block leading-tight tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {String(countdown.minutes).padStart(2, '0')}
              </span>
              <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider block mt-0.2 leading-none ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Mins
              </span>
            </div>

            <span className={`text-xs sm:text-sm font-black font-mono ${isDark ? 'text-indigo-400' : 'text-slate-300'}`}>:</span>

            {/* Seconds (Glowing / Animated) */}
            <div className={`rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[38px] sm:min-w-[46px] ${
              isDark 
                ? 'bg-[#080d19]/90 backdrop-blur-md border border-indigo-400/50 shadow-inner ring-1 ring-indigo-500/30' 
                : 'bg-emerald-50 border border-emerald-200 ring-1 ring-emerald-500/20 shadow-2xs'
            }`}>
              <span className={`text-xs sm:text-base font-black font-mono block leading-tight tracking-tight animate-pulse ${
                isDark ? 'text-emerald-400' : 'text-emerald-700'
              }`}>
                {String(countdown.seconds).padStart(2, '0')}
              </span>
              <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider block mt-0.2 leading-none ${
                isDark ? 'text-emerald-400/80' : 'text-emerald-600'
              }`}>
                Secs
              </span>
            </div>

            {/* Admin Schedule Config Button */}
            {allowConfigure && groupId && (
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                title="Configure Auction Date & Time"
                className={`ml-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg active:scale-95 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  isDark
                    ? 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                    : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs'
                }`}
              >
                <Settings2 size={13} className={isDark ? 'text-white' : 'text-slate-500'} />
                <span className="hidden sm:inline">Edit Schedule</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── ADMIN CONFIGURATION MODAL (SHARED REUSABLE COMPONENT) ──────── */}
      {allowConfigure && groupId && (
        <AuctionScheduleModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          groupId={groupId}
          groupName={groupName}
          currentMonth={currentMonth}
          startDate={activeConfig.startDate}
          auctionDayOfMonth={activeConfig.auctionDayOfMonth}
          auctionTime={activeConfig.auctionTime}
          nextAuctionDate={activeConfig.nextAuctionDate}
          nextAuctionTime={activeConfig.nextAuctionTime}
          onScheduleUpdated={(updated) => {
            const newConfig = {
              auctionDayOfMonth: updated.auctionDayOfMonth,
              auctionTime: updated.auctionTime,
              nextAuctionDate: updated.nextAuctionDate,
              nextAuctionTime: updated.nextAuctionTime,
              startDate: activeConfig.startDate,
              currentMonth,
            };
            setActiveConfig(newConfig);
            const newTarget = computeNextAuctionDateTime({
              auction_day_of_month: newConfig.auctionDayOfMonth,
              auction_time: newConfig.auctionTime,
              next_auction_date: newConfig.nextAuctionDate,
              next_auction_time: newConfig.nextAuctionTime,
              start_date: newConfig.startDate,
              current_month: newConfig.currentMonth,
            });
            setCountdown(calculateAuctionCountdown(newTarget));
            if (onScheduleUpdated) {
              onScheduleUpdated();
            }
          }}
        />
      )}
    </>
  );
}
