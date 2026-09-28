'use client';

import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AuctionCountdownBanner from './AuctionCountdownBanner';
import { triggerHapticFeedback } from '@/utils/haptics';

export interface CountdownGroupData {
  groupId: string;
  groupName: string;
  currentMonth: number;
  durationMonths: number;
  auctionDayOfMonth?: number | null;
  auctionTime?: string | null;
  nextAuctionDate?: string | null;
  nextAuctionTime?: string | null;
  startDate?: string | null;
  ticketNumber?: number;
  status?: string;
}

interface AuctionCountdownStackProps {
  groups: CountdownGroupData[];
  theme?: 'light' | 'dark';
  allowConfigure?: boolean;
  onScheduleUpdated?: () => void;
}

export default function AuctionCountdownStack({
  groups,
  theme = 'light',
  allowConfigure = false,
  onScheduleUpdated,
}: AuctionCountdownStackProps) {
  const isDark = theme === 'dark';
  const activeGroups = groups.filter((g) => g.status === 'active');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (activeGroups.length === 0) {
    const monthZeroGroup = groups.find((g) => g.currentMonth === 0);
    if (monthZeroGroup) {
      return (
        <AuctionCountdownBanner
          groupId={monthZeroGroup.groupId}
          groupName={monthZeroGroup.groupName}
          currentMonth={0}
          durationMonths={monthZeroGroup.durationMonths}
          auctionDayOfMonth={monthZeroGroup.auctionDayOfMonth}
          auctionTime={monthZeroGroup.auctionTime}
          nextAuctionDate={monthZeroGroup.nextAuctionDate}
          nextAuctionTime={monthZeroGroup.nextAuctionTime}
          startDate={monthZeroGroup.startDate}
          allowConfigure={allowConfigure}
          onScheduleUpdated={onScheduleUpdated}
          theme={theme}
        />
      );
    }
    return null;
  }

  // If only 1 active group, render single countdown banner directly without any side navigation
  if (activeGroups.length === 1) {
    const grp = activeGroups[0];
    return (
      <AuctionCountdownBanner
        groupId={grp.groupId}
        groupName={grp.groupName}
        currentMonth={grp.currentMonth}
        durationMonths={grp.durationMonths}
        auctionDayOfMonth={grp.auctionDayOfMonth}
        auctionTime={grp.auctionTime}
        nextAuctionDate={grp.nextAuctionDate}
        nextAuctionTime={grp.nextAuctionTime}
        startDate={grp.startDate}
        allowConfigure={allowConfigure}
        onScheduleUpdated={onScheduleUpdated}
        theme={theme}
      />
    );
  }

  // Multiple active groups: render single card flanked by left and right arrow buttons (< and >)
  const safeIndex = selectedIndex >= activeGroups.length ? 0 : selectedIndex;
  const currentGroup = activeGroups[safeIndex];

  const handlePrev = () => {
    triggerHapticFeedback('light');
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : activeGroups.length - 1));
  };

  const handleNext = () => {
    triggerHapticFeedback('light');
    setSelectedIndex((prev) => (prev < activeGroups.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
  };

  return (
    <div className="relative flex items-center gap-1 sm:gap-2">
      {/* Left Navigation Chevron (<) */}
      <button
        onClick={handlePrev}
        title="Previous Auction"
        aria-label="Previous Auction"
        className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-90 cursor-pointer shrink-0 shadow-2xs ${
          isDark
            ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300'
        }`}
      >
        <ChevronLeft size={16} className="stroke-[2.5]" />
      </button>

      {/* Main Countdown Card Container */}
      <div 
        className="flex-1 min-w-0 relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AuctionCountdownBanner
          key={`stacked-countdown-${currentGroup.groupId}`}
          groupId={currentGroup.groupId}
          groupName={`${currentGroup.groupName}${currentGroup.ticketNumber ? ` (#${currentGroup.ticketNumber})` : ''} • [${safeIndex + 1}/${activeGroups.length}]`}
          currentMonth={currentGroup.currentMonth}
          durationMonths={currentGroup.durationMonths}
          auctionDayOfMonth={currentGroup.auctionDayOfMonth}
          auctionTime={currentGroup.auctionTime}
          nextAuctionDate={currentGroup.nextAuctionDate}
          nextAuctionTime={currentGroup.nextAuctionTime}
          startDate={currentGroup.startDate}
          allowConfigure={allowConfigure}
          onScheduleUpdated={onScheduleUpdated}
          theme={theme}
          compact={false}
        />
      </div>

      {/* Right Navigation Chevron (>) */}
      <button
        onClick={handleNext}
        title="Next Auction"
        aria-label="Next Auction"
        className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-90 cursor-pointer shrink-0 shadow-2xs ${
          isDark
            ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900 hover:border-slate-300'
        }`}
      >
        <ChevronRight size={16} className="stroke-[2.5]" />
      </button>
    </div>
  );
}
