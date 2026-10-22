/**
 * Non-hotel upcoming arrivals (Muthowif & Transportation) for the unified
 * operational "Upcoming Arrivals" board.
 *
 * Each loader returns rows in the same shape as hotel arrivals so the
 * /api/bookings/arrivals endpoint can merge, filter, and summarize them together.
 */
import { sql, eq, inArray, ne, and } from 'drizzle-orm';
import { db } from '../db';
import {
  clients,
  muthowifBookings,
  muthowifInvoices,
  muthowifVouchers,
  muthowifs,
  transportationBookings,
  transportationRoutes,
  transportationInvoices,
  transportationVouchers,
} from '../db/schema';
import { getDaysUntilArrival } from './date';

type PaymentStatus = 'paid' | 'partial' | 'unpaid';

function computePaymentStatus(totalAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount >= totalAmount && totalAmount > 0) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

/** Sums non-cancelled invoices per booking. Falls back to the booking total when no invoice exists. */
function sumInvoices<T extends { amount: string; paidAmount: string; status: string }>(
  invoices: T[] | undefined,
  fallbackTotal: string | number,
): { totalAmount: number; paidAmount: number } {
  const active = (invoices || []).filter((inv) => inv.status !== 'cancelled');
  if (active.length === 0) {
    return { totalAmount: parseFloat(String(fallbackTotal || '0')), paidAmount: 0 };
  }
  return {
    totalAmount: active.reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0),
    paidAmount: active.reduce((sum, inv) => sum + parseFloat(inv.paidAmount || '0'), 0),
  };
}

function groupBy<T>(rows: T[], key: (row: T) => number): Record<number, T[]> {
  return rows.reduce((acc, row) => {
    const k = key(row);
    (acc[k] ??= []).push(row);
    return acc;
  }, {} as Record<number, T[]>);
}

function computeUrgency(daysUntilArrival: number, isCritical: boolean): 'critical' | 'warning' | 'normal' {
  const isSoon = daysUntilArrival >= 0 && daysUntilArrival <= 3;
  if (isSoon && isCritical) return 'critical';
  return daysUntilArrival <= 3 ? 'warning' : 'normal';
}

// Fields that only make sense for hotel bookings, neutralized for other services
const NON_HOTEL_DEFAULTS = {
  hotelName: '',
  city: '',
  hotelConfirmationNo: null,
  source: null,
  totalRooms: 0,
  roomSummary: '',
  isHcnMissing: false,
  isHcnUrgent: false,
  voucherPdfUrl: null,
  voucherSentAt: null,
  notificationSummary: {
    paymentEmail: 'none',
    paymentWhatsApp: 'none',
    voucherEmail: 'none',
    voucherWhatsApp: 'none',
  },
};

export async function getMuthowifArrivals(from: string, to: string, todayStr: string) {
  const rows = await db
    .select({
      id: muthowifBookings.id,
      number: muthowifBookings.number,
      clientId: muthowifBookings.clientId,
      guestName: muthowifBookings.guestName,
      dateTime: muthowifBookings.dateTime,
      events: muthowifBookings.events,
      totalPax: muthowifBookings.totalPax,
      meetingPoint: muthowifBookings.meetingPoint,
      totalAmount: muthowifBookings.totalAmount,
      notes: muthowifBookings.notes,
      clientName: clients.name,
      clientEmail: clients.email,
      clientPhone: clients.phone,
      muthowifName: muthowifs.name,
      muthowifPhone: muthowifs.phone,
    })
    .from(muthowifBookings)
    .leftJoin(clients, eq(muthowifBookings.clientId, clients.id))
    .leftJoin(muthowifs, eq(muthowifBookings.assignedMuthowifId, muthowifs.id))
    .where(and(
      sql`DATE(${muthowifBookings.dateTime} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh') >= ${from}::date`,
      sql`DATE(${muthowifBookings.dateTime} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh') <= ${to}::date`,
      ne(muthowifBookings.status, 'cancelled'),
    ))
    .orderBy(muthowifBookings.dateTime, muthowifBookings.id);

  const ids = rows.map((r) => r.id);
  const [invoices, voucherList] = ids.length > 0
    ? await Promise.all([
        db.select().from(muthowifInvoices).where(inArray(muthowifInvoices.muthowifBookingId, ids)),
        db.select().from(muthowifVouchers).where(inArray(muthowifVouchers.muthowifBookingId, ids)),
      ])
    : [[], []];
  const invoicesByBooking = groupBy(invoices, (inv) => inv.muthowifBookingId);
  const vouchersByBooking = groupBy(voucherList, (v) => v.muthowifBookingId);

  return rows.map((b) => {
    const { totalAmount, paidAmount } = sumInvoices(invoicesByBooking[b.id], b.totalAmount);
    const paymentStatus = computePaymentStatus(totalAmount, paidAmount);
    const voucher = vouchersByBooking[b.id]?.[0] || null;
    const daysUntilArrival = getDaysUntilArrival(b.dateTime, todayStr);
    const isAssigneeMissing = !b.muthowifName;
    const events = Array.isArray(b.events) ? b.events : [];

    return {
      ...NON_HOTEL_DEFAULTS,
      serviceType: 'muthowif' as const,
      uid: `muthowif-${b.id}`,
      id: b.id,
      code: b.number,
      clientId: b.clientId,
      clientName: b.clientName || 'Direct Customer',
      clientEmail: b.clientEmail || '',
      clientPhone: b.clientPhone || '',
      guestName: b.guestName || b.clientName || '',
      guestEmail: b.clientEmail || '',
      guestPhone: b.clientPhone || '',
      checkIn: b.dateTime,
      checkOut: null,
      eventTime: b.dateTime,
      location: b.meetingPoint,
      serviceDetail: events.join(', ') || 'Layanan Muthowif',
      assigneeName: b.muthowifName || null,
      assigneePhone: b.muthowifPhone || null,
      isAssigneeMissing,
      totalAmount,
      paymentStatus,
      notes: b.notes || '',
      pax: b.totalPax,
      daysUntilArrival,
      urgency: computeUrgency(daysUntilArrival, paymentStatus !== 'paid' || isAssigneeMissing || !voucher),
      voucherStatus: voucher ? ('issued' as const) : ('not_ready' as const),
      voucherNumber: voucher?.number || null,
    };
  });
}

/** One row per transportation route (each pickup is a separate operational event). */
export async function getTransportationArrivals(from: string, to: string, todayStr: string) {
  const rows = await db
    .select({
      routeId: transportationRoutes.id,
      pickupDateTime: transportationRoutes.pickupDateTime,
      originLocation: transportationRoutes.originLocation,
      destinationLocation: transportationRoutes.destinationLocation,
      vehicleType: transportationRoutes.vehicleType,
      driverName: transportationRoutes.driverName,
      driverPhone: transportationRoutes.driverPhone,
      vehiclePlateNumber: transportationRoutes.vehiclePlateNumber,
      routeNotes: transportationRoutes.notes,
      id: transportationBookings.id,
      number: transportationBookings.number,
      clientId: transportationBookings.clientId,
      customerName: transportationBookings.customerName,
      customerPhone: transportationBookings.customerPhone,
      customerEmail: transportationBookings.customerEmail,
      totalAmount: transportationBookings.totalAmount,
      bookingNotes: transportationBookings.notes,
      clientName: clients.name,
      clientEmail: clients.email,
      clientPhone: clients.phone,
    })
    .from(transportationRoutes)
    .innerJoin(transportationBookings, eq(transportationRoutes.transportationBookingId, transportationBookings.id))
    .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
    .where(and(
      sql`DATE(${transportationRoutes.pickupDateTime} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh') >= ${from}::date`,
      sql`DATE(${transportationRoutes.pickupDateTime} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh') <= ${to}::date`,
      ne(transportationBookings.status, 'cancelled'),
    ))
    .orderBy(transportationRoutes.pickupDateTime, transportationRoutes.id);

  const ids = [...new Set(rows.map((r) => r.id))];
  const [invoices, voucherList] = ids.length > 0
    ? await Promise.all([
        db.select().from(transportationInvoices).where(inArray(transportationInvoices.transportationBookingId, ids)),
        db.select().from(transportationVouchers).where(inArray(transportationVouchers.transportationBookingId, ids)),
      ])
    : [[], []];
  const invoicesByBooking = groupBy(invoices, (inv) => inv.transportationBookingId);
  const vouchersByBooking = groupBy(voucherList, (v) => v.transportationBookingId);

  return rows.map((r) => {
    const { totalAmount, paidAmount } = sumInvoices(invoicesByBooking[r.id], r.totalAmount);
    const paymentStatus = computePaymentStatus(totalAmount, paidAmount);
    const voucher = vouchersByBooking[r.id]?.[0] || null;
    const daysUntilArrival = getDaysUntilArrival(r.pickupDateTime, todayStr);
    const isAssigneeMissing = !r.driverName || r.driverName.trim() === '';
    const vehicle = [r.vehicleType?.toUpperCase(), r.vehiclePlateNumber].filter(Boolean).join(' • ');

    return {
      ...NON_HOTEL_DEFAULTS,
      serviceType: 'transportation' as const,
      uid: `transportation-${r.id}-${r.routeId}`,
      id: r.id,
      code: r.number,
      clientId: r.clientId,
      clientName: r.clientName || 'Direct Customer',
      clientEmail: r.clientEmail || '',
      clientPhone: r.clientPhone || '',
      guestName: r.customerName || r.clientName || '',
      guestEmail: r.customerEmail || r.clientEmail || '',
      guestPhone: r.customerPhone || r.clientPhone || '',
      checkIn: r.pickupDateTime,
      checkOut: null,
      eventTime: r.pickupDateTime,
      location: `${r.originLocation} → ${r.destinationLocation}`,
      serviceDetail: vehicle,
      assigneeName: r.driverName || null,
      assigneePhone: r.driverPhone || null,
      isAssigneeMissing,
      totalAmount,
      paymentStatus,
      notes: r.routeNotes || r.bookingNotes || '',
      pax: 0,
      daysUntilArrival,
      urgency: computeUrgency(daysUntilArrival, paymentStatus !== 'paid' || isAssigneeMissing || !voucher),
      voucherStatus: voucher ? ('issued' as const) : ('not_ready' as const),
      voucherNumber: voucher?.number || null,
    };
  });
}
