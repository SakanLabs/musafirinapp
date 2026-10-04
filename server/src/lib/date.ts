/**
 * Centralized Date & Operational Timezone Utilities for Musafirin
 * 
 * Musafirin operates hotels in Saudi Arabia (Makkah & Madinah).
 * All operational dates, arrival windows, and past booking calculations
 * MUST be evaluated consistently against Asia/Riyadh (UTC+3).
 */

export const OPERATIONAL_TIMEZONE = 'Asia/Riyadh';

/**
 * Returns the date formatted as YYYY-MM-DD in Asia/Riyadh timezone.
 */
export function getOperationalDateString(date: Date | string | number = new Date()): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Returns today's boundaries (start of day 00:00:00 and end of day 23:59:59.999) in Asia/Riyadh.
 */
export function getOperationalTodayBoundaries(baseDate: Date = new Date()): {
  todayStr: string;
  startOfDay: Date;
  endOfDay: Date;
} {
  const todayStr = getOperationalDateString(baseDate);
  const startOfDay = new Date(`${todayStr}T00:00:00.000+03:00`);
  const endOfDay = new Date(`${todayStr}T23:59:59.999+03:00`);
  return { todayStr, startOfDay, endOfDay };
}

/**
 * Returns the arrival window boundaries for a given number of days (default 14 days)
 * inclusive of today in Asia/Riyadh timezone.
 */
export function getArrivalWindowBoundaries(days: number = 14, baseDate: Date = new Date()): {
  startStr: string;
  endStr: string;
  startDate: Date;
  endDate: Date;
} {
  const startStr = getOperationalDateString(baseDate);
  const startDate = new Date(`${startStr}T00:00:00.000+03:00`);

  // Target date: exactly `days` days ahead
  const endTarget = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
  const endStr = getOperationalDateString(endTarget);
  const endDate = new Date(`${endStr}T23:59:59.999+03:00`);

  return { startStr, endStr, startDate, endDate };
}

/**
 * Classifies a booking's check-in date:
 * - 'past': checkInDate < today
 * - 'today': checkInDate == today
 * - 'upcoming': checkInDate > today
 * 
 * A booking checking in TODAY is NOT considered past.
 */
export function classifyBookingArrival(
  checkIn: Date | string | number,
  todayStr: string = getOperationalDateString()
): 'past' | 'today' | 'upcoming' {
  const checkInStr = getOperationalDateString(checkIn);
  if (!checkInStr) return 'past';
  if (checkInStr < todayStr) return 'past';
  if (checkInStr === todayStr) return 'today';
  return 'upcoming';
}

/**
 * Calculates days remaining until arrival in Asia/Riyadh timezone.
 * 0 = Today
 * 1 = Tomorrow
 * 2 = 2 days away
 * negative = past arrival
 */
export function getDaysUntilArrival(
  checkIn: Date | string | number,
  todayStr: string = getOperationalDateString()
): number {
  const checkInStr = getOperationalDateString(checkIn);
  if (!checkInStr) return -999;
  const d1 = new Date(`${todayStr}T00:00:00.000Z`).getTime();
  const d2 = new Date(`${checkInStr}T00:00:00.000Z`).getTime();
  return Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
}

/**
 * Formats a date in Indonesian locale within Asia/Riyadh timezone.
 */
export function formatOperationalDate(
  date: Date | string | number,
  format: 'short' | 'medium' | 'long' | 'datetime' = 'medium'
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  if (format === 'short') {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: OPERATIONAL_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  }

  if (format === 'datetime') {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: OPERATIONAL_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: OPERATIONAL_TIMEZONE,
    day: 'numeric',
    month: format === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(d);
}
