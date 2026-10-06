/**
 * Calendar Event Utilities
 * Generates direct URL links and .ics file downloads for Google Calendar,
 * Microsoft Outlook, Office 365, and Apple / standard iCal calendars.
 */

export interface CalendarEventDetails {
  title: string;
  description: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  filename?: string;
}

function pad(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

/**
 * Format a Date object into UTC iCal format: YYYYMMDDTHHmmssZ
 */
export function formatUtcDateTime(date: Date): string {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Generate Google Calendar URL
 */
export function getGoogleCalendarUrl(event: CalendarEventDetails): string {
  const start = event.startDate;
  const end = event.endDate || new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour duration
  
  const dates = `${formatUtcDateTime(start)}/${formatUtcDateTime(end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: dates,
    details: event.description,
    location: event.location || 'Live Auction Arena',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook Live / Web Calendar URL
 */
export function getOutlookCalendarUrl(event: CalendarEventDetails): string {
  const start = event.startDate;
  const end = event.endDate || new Date(start.getTime() + 60 * 60 * 1000);

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: event.description,
    location: event.location || 'Live Auction Arena',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * Download standard RFC 5545 .ics file for Apple Calendar, Windows Calendar, & Desktop Outlook
 */
export function downloadIcsCalendarFile(event: CalendarEventDetails): void {
  const start = event.startDate;
  const end = event.endDate || new Date(start.getTime() + 60 * 60 * 1000);
  const uid = `auction-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@chitfundsmanager.app`;
  const sanitizedDescription = (event.description || '').replace(/\n/g, '\\n').replace(/,/g, '\\,');
  const sanitizedTitle = (event.title || 'Live Chit Auction').replace(/,/g, '\\,');
  const sanitizedLocation = (event.location || 'Live Auction Arena').replace(/,/g, '\\,');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chit Funds Manager//Auction Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `DTSTART:${formatUtcDateTime(start)}`,
    `DTEND:${formatUtcDateTime(end)}`,
    `SUMMARY:${sanitizedTitle}`,
    `DESCRIPTION:${sanitizedDescription}`,
    `LOCATION:${sanitizedLocation}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Live Chit Auction starts in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', event.filename || 'chit-auction-event.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
