/**
 * Operational Timezone & Date Helper for Musafirin Admin
 * Matches server/src/lib/date.ts to guarantee identical behavior
 */

export const OPERATIONAL_TIMEZONE = 'Asia/Riyadh';

export function getOperationalDateString(date: Date | string | number = new Date()): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

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

/**
 * Formats a stored timestamp as "YYYY-MM-DDTHH:mm" in Asia/Riyadh,
 * suitable for a datetime-local input that operators fill in Saudi time.
 */
export function toOperationalDateTimeInput(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
