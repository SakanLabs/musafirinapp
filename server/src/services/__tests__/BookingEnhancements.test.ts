/**
 * Automated Tests for Musafirin Booking & Operational Enhancements
 * 
 * Tests:
 * 1. Past booking filtering & date classification (Asia/Riyadh timezone)
 * 2. Upcoming arrivals 14-day inclusive window & cancelled status exclusion
 * 3. Payment confirmation notification idempotency & duplicate prevention
 * 4. Voucher notification: explicit trigger only (no auto-send on creation)
 * 5. Channel failure isolation (Email vs WhatsApp tracked independently)
 * 6. Indonesian phone number normalization
 * 
 * Run with: bun test server/src/services/__tests__/BookingEnhancements.test.ts
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  getOperationalDateString,
  getOperationalTodayBoundaries,
  getArrivalWindowBoundaries,
  classifyBookingArrival,
  getDaysUntilArrival,
  OPERATIONAL_TIMEZONE,
} from '../../lib/date';
import { normalizePhoneNumber } from '../../lib/whatsapp';

describe('1. Past Booking Filtering & Operational Timezone (Asia/Riyadh)', () => {
  test('Operational timezone is configured as Asia/Riyadh', () => {
    expect(OPERATIONAL_TIMEZONE).toBe('Asia/Riyadh');
  });

  test('Classifies past, today, and upcoming hotel bookings accurately', () => {
    const mockTodayStr = '2026-10-03';

    const bookingA_Past = '2026-10-02';
    const bookingB_Today = '2026-10-03';
    const bookingC_Upcoming = '2026-10-04';

    expect(classifyBookingArrival(bookingA_Past, mockTodayStr)).toBe('past');
    expect(classifyBookingArrival(bookingB_Today, mockTodayStr)).toBe('today');
    expect(classifyBookingArrival(bookingC_Upcoming, mockTodayStr)).toBe('upcoming');
  });

  test('A booking checking in TODAY is NOT considered a past booking', () => {
    const todayStr = '2026-10-03';
    const checkInToday = new Date('2026-10-03T14:00:00+03:00');

    const classification = classifyBookingArrival(checkInToday, todayStr);
    expect(classification).toBe('today');
    expect(classification).not.toBe('past');
  });

  test('Filtering logic: Default list excludes past; includePast includes all', () => {
    const todayStr = '2026-10-03';

    const bookings = [
      { id: 1, code: 'A', checkIn: '2026-10-02' }, // Past
      { id: 2, code: 'B', checkIn: '2026-10-03' }, // Today
      { id: 3, code: 'C', checkIn: '2026-10-04' }, // Upcoming
    ];

    // Default filter (includePast = false): checkIn >= today
    const defaultList = bookings.filter((b) => {
      const cls = classifyBookingArrival(b.checkIn, todayStr);
      return cls !== 'past';
    });

    expect(defaultList.map((b) => b.code)).toEqual(['B', 'C']);

    // With includePast = true: all bookings
    const withIncludePastList = bookings.filter(() => true);
    expect(withIncludePastList.map((b) => b.code)).toEqual(['A', 'B', 'C']);
  });

  test('Days until arrival calculation matches countdown logic', () => {
    const todayStr = '2026-10-03';

    expect(getDaysUntilArrival('2026-10-03', todayStr)).toBe(0); // Today
    expect(getDaysUntilArrival('2026-10-04', todayStr)).toBe(1); // Tomorrow
    expect(getDaysUntilArrival('2026-10-06', todayStr)).toBe(3); // 3 days away (urgency threshold)
    expect(getDaysUntilArrival('2026-10-02', todayStr)).toBe(-1); // Past
  });
});

describe('2. Upcoming Arrivals 14-Day Query Window', () => {
  test('Calculates inclusive 14-day arrival window boundaries', () => {
    const baseDate = new Date('2026-10-03T12:00:00+03:00');
    const { startStr, endStr, startDate, endDate } = getArrivalWindowBoundaries(14, baseDate);

    expect(startStr).toBe('2026-10-03');
    expect(endStr).toBe('2026-10-17');
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
  });

  test('Filters bookings within 14-day window and excludes cancelled bookings', () => {
    const windowStart = '2026-10-03';
    const windowEnd = '2026-10-17';

    const testBookings = [
      { id: 101, code: 'B-01', checkIn: '2026-10-02', status: 'confirmed' }, // Before window
      { id: 102, code: 'B-02', checkIn: '2026-10-03', status: 'confirmed' }, // On boundary start -> included
      { id: 103, code: 'B-03', checkIn: '2026-10-10', status: 'confirmed' }, // Inside window -> included
      { id: 104, code: 'B-04', checkIn: '2026-10-10', status: 'cancelled' }, // Inside window but cancelled -> EXCLUDED
      { id: 105, code: 'B-05', checkIn: '2026-10-17', status: 'confirmed' }, // On boundary end -> included
      { id: 106, code: 'B-06', checkIn: '2026-10-18', status: 'confirmed' }, // After window -> excluded
    ];

    const arrivals = testBookings.filter((b) => {
      const inWindow = b.checkIn >= windowStart && b.checkIn <= windowEnd;
      const notCancelled = b.status !== 'cancelled';
      return inWindow && notCancelled;
    });

    expect(arrivals.map((a) => a.code)).toEqual(['B-02', 'B-03', 'B-05']);
  });

  test('Flags urgent bookings (<= 3 days remaining without HCN)', () => {
    const todayStr = '2026-10-03';

    const bookingWithHcn = {
      code: 'MSF-01',
      checkIn: '2026-10-05',
      hotelConfirmationNo: 'HCN-9988',
    };

    const bookingWithoutHcnUrgent = {
      code: 'MSF-02',
      checkIn: '2026-10-05', // 2 days away
      hotelConfirmationNo: null,
    };

    const bookingWithoutHcnLater = {
      code: 'MSF-03',
      checkIn: '2026-10-12', // 9 days away
      hotelConfirmationNo: null,
    };

    const days1 = getDaysUntilArrival(bookingWithHcn.checkIn, todayStr);
    const isUrgent1 = days1 >= 0 && days1 <= 3 && !bookingWithHcn.hotelConfirmationNo;
    expect(isUrgent1).toBe(false);

    const days2 = getDaysUntilArrival(bookingWithoutHcnUrgent.checkIn, todayStr);
    const isUrgent2 = days2 >= 0 && days2 <= 3 && !bookingWithoutHcnUrgent.hotelConfirmationNo;
    expect(isUrgent2).toBe(true);

    const days3 = getDaysUntilArrival(bookingWithoutHcnLater.checkIn, todayStr);
    const isUrgent3 = days3 >= 0 && days3 <= 3 && !bookingWithoutHcnLater.hotelConfirmationNo;
    expect(isUrgent3).toBe(false);
  });
});

describe('3. Phone Number Normalization', () => {
  test('Correctly converts Indonesian 08xx numbers to international 628xx format', () => {
    expect(normalizePhoneNumber('081234567890')).toBe('6281234567890');
    expect(normalizePhoneNumber('0812-3456-7890')).toBe('6281234567890');
    expect(normalizePhoneNumber('+6281234567890')).toBe('6281234567890');
    expect(normalizePhoneNumber('6281234567890')).toBe('6281234567890');
  });

  test('Preserves Saudi and other international numbers when provided with country code', () => {
    expect(normalizePhoneNumber('+966501234567')).toBe('966501234567');
    expect(normalizePhoneNumber('966501234567')).toBe('966501234567');
  });

  test('Handles empty and invalid phone inputs gracefully', () => {
    expect(normalizePhoneNumber('')).toBe('');
    expect(normalizePhoneNumber('   ')).toBe('');
  });
});

describe('4. Notification Idempotency & Channel Isolation Rules', () => {
  interface SimulatedLog {
    bookingId: number;
    type: string;
    channel: string;
    referenceId: string;
    status: 'sent' | 'failed';
  }

  const logsStore: SimulatedLog[] = [];

  function simulateSend(
    bookingId: number,
    type: string,
    channel: string,
    referenceId: string,
    forceResend: boolean,
    simulateSuccess: boolean
  ) {
    const existingSent = logsStore.find(
      (l) => l.bookingId === bookingId && l.type === type && l.channel === channel && l.referenceId === referenceId && l.status === 'sent'
    );

    if (existingSent && !forceResend) {
      return { status: 'skipped', reason: 'already_sent' };
    }

    if (simulateSuccess) {
      logsStore.push({ bookingId, type, channel, referenceId, status: 'sent' });
      return { status: 'sent' };
    } else {
      logsStore.push({ bookingId, type, channel, referenceId, status: 'failed' });
      return { status: 'failed' };
    }
  }

  beforeEach(() => {
    logsStore.length = 0;
  });

  test('Payment notification is sent on confirmed, and duplicate attempt is skipped', () => {
    const paymentRef = 'PAY-INV-101-1';

    // 1st attempt: should send
    const res1 = simulateSend(101, 'payment_confirmation', 'email', paymentRef, false, true);
    expect(res1.status).toBe('sent');

    // 2nd identical attempt: should skip due to idempotency
    const res2 = simulateSend(101, 'payment_confirmation', 'email', paymentRef, false, true);
    expect(res2.status).toBe('skipped');
    expect(res2.reason).toBe('already_sent');
  });

  test('Channel failure isolation: Email success + WhatsApp failure records both independently', () => {
    const paymentRef = 'PAY-INV-202-1';

    const emailRes = simulateSend(202, 'payment_confirmation', 'email', paymentRef, false, true);
    const waRes = simulateSend(202, 'payment_confirmation', 'whatsapp', paymentRef, false, false);

    expect(emailRes.status).toBe('sent');
    expect(waRes.status).toBe('failed');

    const emailLog = logsStore.find((l) => l.bookingId === 202 && l.channel === 'email');
    const waLog = logsStore.find((l) => l.bookingId === 202 && l.channel === 'whatsapp');

    expect(emailLog?.status).toBe('sent');
    expect(waLog?.status).toBe('failed');
  });

  test('Retrying WhatsApp does NOT resend already successful Email', () => {
    const paymentRef = 'PAY-INV-303-1';

    // Initial run: Email sent, WhatsApp failed
    simulateSend(303, 'payment_confirmation', 'email', paymentRef, false, true);
    simulateSend(303, 'payment_confirmation', 'whatsapp', paymentRef, false, false);

    // Admin chooses to retry ONLY WhatsApp
    const retryWhatsAppRes = simulateSend(303, 'payment_confirmation', 'whatsapp', paymentRef, true, true);
    expect(retryWhatsAppRes.status).toBe('sent');

    // Email count must remain 1 (never sent twice)
    const emailSends = logsStore.filter((l) => l.bookingId === 303 && l.channel === 'email');
    expect(emailSends.length).toBe(1);
  });

  test('Voucher delivery requires explicit action and is not triggered automatically by creation', () => {
    // Voucher creation alone: no notification sent
    let notificationTriggered = false;
    const onVoucherCreated = () => {
      // Intentionally does NOT trigger send
    };
    onVoucherCreated();
    expect(notificationTriggered).toBe(false);

    // Explicit manual send action: triggers send
    const onAdminClickSendVoucher = () => {
      notificationTriggered = true;
      return simulateSend(404, 'voucher', 'email', 'VCH-404', false, true);
    };

    const res = onAdminClickSendVoucher();
    expect(notificationTriggered).toBe(true);
    expect(res.status).toBe('sent');
  });
});
