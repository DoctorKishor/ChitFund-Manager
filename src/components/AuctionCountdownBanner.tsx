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
      <div className="rounded-xl sm:rounded-2xl p-2 sm:p-2.5 border transition-all bg-[#141332] border-[#FFBB38]/40 text-[#FFBB38]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#FFBB38]/20 text-[#FFBB38] shrink-0">
              <CalendarClock size={14} />
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-white">Month 0 — Organizer Profit Phase</span>
              <span className="text-[8px] font-bold uppercase bg-[#FFBB38]/20 text-[#FFBB38] px-1.5 py-0.2 rounded border border-[#FFBB38]/30">
                No Auction
              </span>
              <span className="text-[10px] text-[#AEABD8] hidden md:inline">
                • 1st live auction starts Month 1 upon launch
              </span>
            </div>
          </div>

          {allowConfigure && groupId && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#1D1D41] border border-[#27264E] text-white hover:bg-[#27264E] transition-all active:scale-95 flex items-center gap-1 self-start sm:self-auto cursor-pointer shadow-xs"
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
      <div className={`rounded-xl sm:rounded-2xl border transition-all shadow-xl relative z-20 ${
        compact ? 'p-2 sm:p-2.5' : 'py-2.5 px-3 sm:py-3 sm:px-4'
      } ${
        countdown.isLive
          ? 'bg-gradient-to-r from-[#E41414]/30 via-[#9C2CF3]/30 to-[#1D1D41] border-[#E41414]/60 text-white'
          : 'bg-[#1D1D41] border-[#27264E] text-white'
      }`}>
        {/* Ambient Glow */}
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#6359E9]/15 rounded-full blur-xl pointer-events-none overflow-hidden" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          
          {/* Left Column: Title & Target Date / Time info */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {countdown.isLive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-[#E41414] text-white animate-pulse shadow-xs">
                  <Radio size={10} className="animate-spin" /> Live Bidding Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-[#02B15A]/15 text-[#02B15A] border border-[#02B15A]/30">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#02B15A]" />
                  Upcoming Auction (Month {currentMonth})
                </span>
              )}

              {groupName && (
                <span className="text-[11px] sm:text-xs font-bold truncate text-[#AEABD8]">
                  • {groupName}
                </span>
              )}
            </div>

            {/* Target Date & Time readout */}
            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-[#AEABD8]">
              <div className="flex items-center gap-1 text-[#64CFF6]">
                <Calendar size={13} className="shrink-0 text-[#64CFF6]" />
                <span>{countdown.formattedTargetDate}</span>
              </div>
              <span className="opacity-40">•</span>
              <div className="flex items-center gap-1 text-[#64CFF6]">
                <Clock size={13} className="shrink-0 text-[#64CFF6]" />
                <span>{countdown.formattedTargetTime}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Timer & Actions (Responsive Layout) */}
          <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap pt-1 sm:pt-0 border-t sm:border-t-0 border-[#27264E]">
            {/* Live Digital Countdown Segments */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Days */}
              <div className="rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[36px] sm:min-w-[44px] bg-[#141332] border border-[#27264E] shadow-inner">
                <span className="text-xs sm:text-base font-black font-mono block leading-tight tracking-tight text-white">
                  {String(countdown.days).padStart(2, '0')}
                </span>
                <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider block mt-0.2 leading-none text-[#AEABD8]">
                  Days
                </span>
              </div>

              <span className="text-xs sm:text-sm font-black font-mono text-[#6359E9]">:</span>

              {/* Hours */}
              <div className="rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[36px] sm:min-w-[44px] bg-[#141332] border border-[#27264E] shadow-inner">
                <span className="text-xs sm:text-base font-black font-mono block leading-tight tracking-tight text-white">
                  {String(countdown.hours).padStart(2, '0')}
                </span>
                <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider block mt-0.2 leading-none text-[#AEABD8]">
                  Hours
                </span>
              </div>

              <span className="text-xs sm:text-sm font-black font-mono text-[#6359E9]">:</span>

              {/* Minutes */}
              <div className="rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[36px] sm:min-w-[44px] bg-[#141332] border border-[#27264E] shadow-inner">
                <span className="text-xs sm:text-base font-black font-mono block leading-tight tracking-tight text-white">
                  {String(countdown.minutes).padStart(2, '0')}
                </span>
                <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider block mt-0.2 leading-none text-[#AEABD8]">
                  Mins
                </span>
              </div>

              <span className="text-xs sm:text-sm font-black font-mono text-[#6359E9]">:</span>

              {/* Seconds (Glowing / Animated) */}
              <div className="rounded-lg sm:rounded-xl px-1.5 sm:px-2.5 py-1 text-center min-w-[36px] sm:min-w-[44px] bg-[#141332] border border-[#02B15A]/40 shadow-inner ring-1 ring-[#02B15A]/20">
                <span className="text-xs sm:text-base font-black font-mono block leading-tight tracking-tight animate-pulse text-[#02B15A]">
                  {String(countdown.seconds).padStart(2, '0')}
                </span>
                <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider block mt-0.2 leading-none text-[#02B15A]/80">
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
                  className="px-2.5 py-1.5 rounded-lg active:scale-95 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 bg-[#141332] hover:bg-[#27264E] border border-[#27264E] text-[#64CFF6] shadow-sm"
                >
                  <CalendarPlus size={14} className="text-[#64CFF6]" />
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
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg active:scale-95 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 bg-[#141332] hover:bg-[#27264E] border border-[#27264E] text-[#AEABD8] hover:text-white"
                >
                  <Settings2 size={13} className="text-[#AEABD8]" />
                  <span className="hidden sm:inline">Edit Schedule</span>
                </button>
              )}

              {/* Desktop Dropdown Popover */}
              {showCalendarMenu && (
                <div className="hidden sm:block absolute right-0 top-full mt-2 w-60 rounded-2xl shadow-2xl border border-[#27264E] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 bg-[#1D1D41] text-white shadow-black/80">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold text-[#AEABD8] uppercase tracking-wider border-b border-[#27264E] mb-1 flex items-center justify-between">
                    <span>Add to Calendar</span>
                    <span className="text-[9px] font-mono text-[#6359E9]">Month {currentMonth}</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleAddToGoogleCalendar}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer hover:bg-[#141332] text-white"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span>Google Calendar</span>
                    <ExternalLink size={12} className="ml-auto opacity-50" />
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToOutlookCalendar}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer hover:bg-[#141332] text-white"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                    <span>Microsoft Outlook</span>
                    <ExternalLink size={12} className="ml-auto opacity-50" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadIcs}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer hover:bg-[#141332] text-white"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#02B15A] shrink-0" />
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
        <div className="sm:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowCalendarMenu(false)} 
          />
          <div className="relative z-10 w-full rounded-t-3xl border-t border-[#27264E] p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 bg-[#1D1D41] text-white">
            {/* Header / Grab Handle */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-1 rounded-full bg-[#27264E] mb-3" />
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#6359E9]/20 text-[#6359E9]">
                    <CalendarPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Add Auction to Calendar</h3>
                    <p className="text-[11px] text-[#AEABD8] truncate max-w-[220px]">
                      {groupName || 'Chit Auction'} • Month {currentMonth}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalendarMenu(false)}
                  className="p-1.5 rounded-full cursor-pointer bg-[#141332] text-[#AEABD8] hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Target Date readout */}
            <div className="p-2.5 rounded-xl border border-[#27264E] flex items-center justify-between text-xs font-semibold bg-[#141332] text-[#AEABD8]">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-[#64CFF6]" />
                <span>{countdown.formattedTargetDate}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-[#64CFF6]" />
                <span>{countdown.formattedTargetTime}</span>
              </div>
            </div>

            {/* Calendar Options */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleAddToGoogleCalendar}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-[#27264E] text-xs font-bold transition-all active:scale-98 cursor-pointer bg-[#141332] hover:bg-[#27264E] text-white"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                  <span>Google Calendar</span>
                </div>
                <ExternalLink size={14} className="text-[#AEABD8]" />
              </button>

              <button
                type="button"
                onClick={handleAddToOutlookCalendar}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-[#27264E] text-xs font-bold transition-all active:scale-98 cursor-pointer bg-[#141332] hover:bg-[#27264E] text-white"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
                  <span>Microsoft Outlook / 365</span>
                </div>
                <ExternalLink size={14} className="text-[#AEABD8]" />
              </button>

              <button
                type="button"
                onClick={handleDownloadIcs}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-[#27264E] text-xs font-bold transition-all active:scale-98 cursor-pointer bg-[#141332] hover:bg-[#27264E] text-white"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-[#02B15A] shrink-0" />
                  <span>Apple Calendar / File (.ics)</span>
                </div>
                <Download size={14} className="text-[#AEABD8]" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCalendarMenu(false)}
              className="w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer bg-[#141332] hover:bg-[#27264E] text-[#AEABD8]"
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
