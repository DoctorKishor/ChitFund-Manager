/**
 * Utility functions for Chit Group Auction Scheduling & Live Countdown
 */

export interface AuctionScheduleConfig {
  auction_day_of_month?: number | null;
  auction_time?: string | null;
  next_auction_date?: string | null;
  next_auction_time?: string | null;
  start_date?: string | null;
  current_month?: number | null;
}

export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isLive: boolean;
  isPast: boolean;
  formattedTargetDate: string;
  formattedTargetTime: string;
  targetDate: Date;
}

/**
 * Format 24-hr time string ('19:00', '09:30') into 12-hr readable format ('07:00 PM', '09:30 AM')
 */
export function formatTime12h(timeStr?: string | null): string {
  if (!timeStr) return '07:00 PM';
  
  // Handle formats like "19:00" or "19:00:00"
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].slice(0, 2);
  if (isNaN(hours)) return '07:00 PM';
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  
  const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
  return `${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Core Chit Fund Scheduling Algorithm:
 * Returns the First Sunday that falls on or after the specified cutoff day (e.g. 10th) for a given year & month (0-indexed).
 */
export function getFirstSundayOnOrAfterDay(year: number, month: number, cutoffDay: number = 10): Date {
  const safeCutoff = Math.max(1, Math.min(cutoffDay, 28));
  const d = new Date(year, month, safeCutoff);
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Computes the canonical Date & Time for the next auction of a chit group.
 * Priority:
 * 1. Admin explicit override (next_auction_date & next_auction_time)
 * 2. If start_date and current_month are provided: 1st Sunday on or after auction_day_of_month for that cycle's month.
 * 3. Fallback: 1st Sunday on or after auction_day_of_month of current calendar month, or next month if already elapsed.
 */
export function computeNextAuctionDateTime(config?: AuctionScheduleConfig | null): Date {
  const defaultCutoffDay = (config?.auction_day_of_month !== undefined && config?.auction_day_of_month !== null) 
    ? Number(config.auction_day_of_month) 
    : 10;
  const rawTime = config?.next_auction_time || config?.auction_time || '19:00';
  
  const [hStr, mStr] = rawTime.split(':');
  const targetHour = parseInt(hStr || '19', 10);
  const targetMinute = parseInt(mStr || '0', 10);

  // 1. If explicit next_auction_date is configured by admin
  if (config?.next_auction_date) {
    const [yStr, moStr, dStr] = config.next_auction_date.split('-');
    if (yStr && moStr && dStr) {
      const explicitDate = new Date(
        parseInt(yStr, 10),
        parseInt(moStr, 10) - 1,
        parseInt(dStr, 10),
        targetHour,
        targetMinute,
        0,
        0
      );
      if (!isNaN(explicitDate.getTime())) {
        return explicitDate;
      }
    }
  }

  // 2. If start_date and current_month are specified for this group
  if (config?.start_date && config.current_month !== undefined && config.current_month !== null) {
    const parsedStart = new Date(config.start_date);
    if (!isNaN(parsedStart.getTime())) {
      // M0 is launch month (no auction), M1 is 1st live auction, M2 is 2nd live auction
      const monthNum = config.current_month === 0 ? 1 : Number(config.current_month);
      const targetMonthDate = new Date(parsedStart.getFullYear(), parsedStart.getMonth() + monthNum, 1);
      const canonicalSunday = getFirstSundayOnOrAfterDay(
        targetMonthDate.getFullYear(), 
        targetMonthDate.getMonth(), 
        defaultCutoffDay
      );
      return new Date(
        canonicalSunday.getFullYear(),
        canonicalSunday.getMonth(),
        canonicalSunday.getDate(),
        targetHour,
        targetMinute,
        0,
        0
      );
    }
  }

  // 3. Dynamic current/next calendar month fallback
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Check this month's first Sunday on or after cutoff day
  const thisMonthSunday = getFirstSundayOnOrAfterDay(currentYear, currentMonth, defaultCutoffDay);
  const thisMonthTarget = new Date(
    thisMonthSunday.getFullYear(),
    thisMonthSunday.getMonth(),
    thisMonthSunday.getDate(),
    targetHour,
    targetMinute,
    0,
    0
  );

  // If this month's target is in the future, use it
  if (thisMonthTarget.getTime() > now.getTime()) {
    return thisMonthTarget;
  }

  // Otherwise, use next month's first Sunday on or after cutoff day
  const nextMonthSunday = getFirstSundayOnOrAfterDay(currentYear, currentMonth + 1, defaultCutoffDay);
  return new Date(
    nextMonthSunday.getFullYear(),
    nextMonthSunday.getMonth(),
    nextMonthSunday.getDate(),
    targetHour,
    targetMinute,
    0,
    0
  );
}

/**
 * Calculates remaining countdown time in Days, Hours, Minutes, Seconds
 */
export function calculateAuctionCountdown(targetDate: Date): CountdownState {
  const now = new Date().getTime();
  const diff = targetDate.getTime() - now;

  const formattedTargetDate = targetDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const hours = targetDate.getHours();
  const minutes = targetDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const formattedTargetTime = `${h12 < 10 ? '0' + h12 : h12}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;

  // If auction is within active window (0 to -2 hours after start)
  const isLive = diff <= 0 && diff >= -2 * 60 * 60 * 1000;
  const isPast = diff < -2 * 60 * 60 * 1000;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isLive,
      isPast,
      formattedTargetDate,
      formattedTargetTime,
      targetDate,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const remainingHours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours: remainingHours,
    minutes: remainingMinutes,
    seconds,
    isLive: false,
    isPast: false,
    formattedTargetDate,
    formattedTargetTime,
    targetDate,
  };
}
