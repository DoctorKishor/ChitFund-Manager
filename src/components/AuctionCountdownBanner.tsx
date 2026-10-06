'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { 
  Clock, 
  Calendar, 
  CalendarClock, 
  CalendarPlus,
  Settings2, 
  Radio, 
  Check, 
  X, 
  Sparkles,
  AlertCircle,
  ChevronDown,
  Download,
  ExternalLink
} from 'lucide-react';
import { 
  computeNextAuctionDateTime, 
  calculateAuctionCountdown, 
  CountdownState,
  formatTime12h 
} from '@/utils/auctionSchedule';
import { 
  getGoogleCalendarUrl, 
  getOutlookCalendarUrl, 
  downloadIcsCalendarFile 
} from '@/utils/calendarEvent';
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
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const calendarMenuRef = useRef<HTMLDivElement>(null);

  // Close calendar menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarMenuRef.current && !calendarMenuRef.current.contains(event.target as Node)) {
        setShowCalendarMenu(false);
      }
    };
    if (showCalendarMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendarMenu]);

  const getTargetDateTime = () => {
    return computeNextAuctionDateTime({
      auction_day_of_month: activeConfig.auctionDayOfMonth,
      auction_time: activeConfig.auctionTime,
      next_auction_date: activeConfig.nextAuctionDate,
      next_auction_time: activeConfig.nextAuctionTime,
      start_date: activeConfig.startDate,
      current_month: activeConfig.currentMonth,
    });
  };

  const handleAddToGoogleCalendar = () => {
    triggerHapticFeedback('light');
    const targetDate = getTargetDateTime();
    const url = getGoogleCalendarUrl({
      title: `Live Auction: ${groupName || 'Chit Group'} (Month ${currentMonth})`,
      description: `Live Chit Auction session for ${groupName || 'Chit Group'} - Month ${currentMonth}.\n\nParticipate in live discount bidding or track auction status in the Chit Funds Manager portal.`,
      location: 'Live Auction Arena',
      startDate: targetDate,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowCalendarMenu(false);
  };

  const handleAddToOutlookCalendar = () => {
    triggerHapticFeedback('light');
    const targetDate = getTargetDateTime();
    const url = getOutlookCalendarUrl({
      title: `Live Auction: ${groupName || 'Chit Group'} (Month ${currentMonth})`,
      description: `Live Chit Auction session for ${groupName || 'Chit Group'} - Month ${currentMonth}.\n\nParticipate in live discount bidding or track auction status in the Chit Funds Manager portal.`,
      location: 'Live Auction Arena',
      startDate: targetDate,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowCalendarMenu(false);
  };

  const handleDownloadIcs = () => {
    triggerHapticFeedback('success');
    const targetDate = getTargetDateTime();
    const cleanName = (groupName || 'chit_auction').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    downloadIcsCalendarFile({
      title: `Live Auction: ${groupName || 'Chit Group'} (Month ${currentMonth})`,
      description: `Live Chit Auction session for ${groupName || 'Chit Group'} - Month ${currentMonth}.\nParticipate in live discount bidding or track auction status in the Chit Funds Manager portal.`,
      location: 'Live Auction Arena',
      startDate: targetDate,
      filename: `${cleanName}_month_${currentMonth}_auction.ics`,
    });
    setShowCalendarMenu(false);
  };

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
  }  return (
    <>
      <div className={`rounded-xl sm:rounded-2xl border transition-all shadow-xs relative z-20 ${
        compact ? 'p-2 sm:p-2.5' : 'py-2.5 px-3 sm:py-3 sm:px-4'
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
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-indigo-500/15 rounded-full blur-xl pointer-events-none overflow-hidden" />
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          
          {/* Left Column: Title & Target Date / Time info */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {countdown.isLive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse shadow-xs">
                  <Radio size={10} className="animate-spin" /> Live Bidding Active
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
                  isDark 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                  Upcoming Auction (Month {currentMonth})
                </span>
              )}

              {groupName && (
                <span className={`text-[11px] sm:text-xs font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  • {groupName}
                </span>
              )}
            </div>

            {/* Target Date & Time readout */}
            <div className={`flex items-center gap-2 text-[11px] sm:text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
              <div className={`flex items-center gap-1 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                <Calendar size={13} className={`shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
                <span>{countdown.formattedTargetDate}</span>
              </div>
              <span className="opacity-40">•</span>
              <div className={`flex items-center gap-1 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                <Clock size={13} className={`shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
                <span>{countdown.formattedTargetTime}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Timer & Actions (Responsive Layout) */}
          <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/40 dark:border-slate-800/40">
            {/* Live Digital Countdown Segments */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Days */}
              <div className={`rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[36px] sm:min-w-[44px] ${
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
              <div className={`rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[36px] sm:min-w-[44px] ${
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
              <div className={`rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[36px] sm:min-w-[44px] ${
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
              <div className={`rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[36px] sm:min-w-[44px] ${
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
            </div>

            {/* Action Buttons: Add to Calendar & Edit Schedule */}
            <div className="flex items-center gap-1.5 ml-auto sm:ml-0 relative" ref={calendarMenuRef}>
              {/* Add to Calendar Button */}
              {!countdown.isLive && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHapticFeedback('light');
                    setShowCalendarMenu((prev) => !prev);
                  }}
                  title="Add Auction Event to Personal Calendar (Google, Outlook, Apple / iCal)"
                  className={`px-2.5 py-1.5 rounded-lg active:scale-95 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isDark
                      ? 'bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/50 text-indigo-200 hover:text-white shadow-sm'
                      : 'bg-indigo-50 hover:bg-indigo-100/90 border border-indigo-300/80 text-indigo-700 hover:text-indigo-950 shadow-2xs'
                  }`}
                >
                  <CalendarPlus size={14} className={isDark ? 'text-indigo-300' : 'text-indigo-600'} />
                  <span className="inline">Add to Calendar</span>
                  <ChevronDown size={12} className={`opacity-70 transition-transform duration-200 ${showCalendarMenu ? 'rotate-180' : ''}`} />
                </button>
              )}

              {/* Admin Schedule Config Button */}
              {allowConfigure && groupId && (
                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  title="Configure Auction Date & Time"
                  className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg active:scale-95 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
                      : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs'
                  }`}
                >
                  <Settings2 size={13} className={isDark ? 'text-white' : 'text-slate-500'} />
                  <span className="hidden sm:inline">Edit Schedule</span>
                </button>
              )}

              {/* Desktop Dropdown Popover */}
              {showCalendarMenu && (
                <div
                  className={`hidden sm:block absolute right-0 top-full mt-2 w-60 rounded-2xl shadow-2xl border p-2 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                    isDark
                      ? 'bg-[#0b1120]/95 backdrop-blur-md border-slate-700/80 text-white shadow-black/80'
                      : 'bg-white border-slate-200 text-slate-800 shadow-xl'
                  }`}
                >
                  <div className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800/80 mb-1 flex items-center justify-between">
                    <span>Add to Calendar</span>
                    <span className="text-[9px] font-mono text-indigo-400">Month {currentMonth}</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleAddToGoogleCalendar}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-slate-800/90 text-slate-200' : 'hover:bg-indigo-50/80 text-slate-800'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span>Google Calendar</span>
                    <ExternalLink size={12} className="ml-auto opacity-50" />
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToOutlookCalendar}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-slate-800/90 text-slate-200' : 'hover:bg-indigo-50/80 text-slate-800'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                    <span>Microsoft Outlook</span>
                    <ExternalLink size={12} className="ml-auto opacity-50" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadIcs}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-slate-800/90 text-slate-200' : 'hover:bg-indigo-50/80 text-slate-800'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Apple / iCal File (.ics)</span>
                    <Download size={12} className="ml-auto opacity-50" />
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── MOBILE MODAL / BOTTOM SHEET (FOR PERFECT MOBILE VISIBILITY & TOUCH) ── */}
      {showCalendarMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowCalendarMenu(false)} 
          />
          <div 
            className={`relative z-10 w-full rounded-t-3xl border-t p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 ${
              isDark 
                ? 'bg-[#0d1527] border-slate-700 text-white' 
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Header / Grab Handle */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-1 rounded-full bg-slate-400/40 mb-3" />
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-500">
                    <CalendarPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">Add Auction to Calendar</h3>
                    <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                      {groupName || 'Chit Auction'} • Month {currentMonth}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalendarMenu(false)}
                  className={`p-1.5 rounded-full cursor-pointer ${
                    isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Target Date readout */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              isDark ? 'bg-slate-900/80 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-indigo-500" />
                <span>{countdown.formattedTargetDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-indigo-500" />
                <span>{countdown.formattedTargetTime}</span>
              </div>
            </div>

            {/* Calendar Options */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleAddToGoogleCalendar}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all active:scale-98 cursor-pointer ${
                  isDark 
                    ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white' 
                    : 'bg-white hover:bg-indigo-50/50 border-slate-200 text-slate-900 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                  <span>Google Calendar</span>
                </div>
                <ExternalLink size={14} className="text-slate-400" />
              </button>

              <button
                type="button"
                onClick={handleAddToOutlookCalendar}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all active:scale-98 cursor-pointer ${
                  isDark 
                    ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white' 
                    : 'bg-white hover:bg-indigo-50/50 border-slate-200 text-slate-900 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
                  <span>Microsoft Outlook / 365</span>
                </div>
                <ExternalLink size={14} className="text-slate-400" />
              </button>

              <button
                type="button"
                onClick={handleDownloadIcs}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-xs font-bold transition-all active:scale-98 cursor-pointer ${
                  isDark 
                    ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-white' 
                    : 'bg-white hover:bg-indigo-50/50 border-slate-200 text-slate-900 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span>Apple Calendar / File (.ics)</span>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCalendarMenu(false)}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
