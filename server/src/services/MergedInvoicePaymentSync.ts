/**
 * Merged Invoice Payment Sync
 *
 * A merged invoice (INV-MRG-*) bills several service invoices at once. When the client pays it,
 * the money must flow back to each source invoice so every booking (hotel, transportation,
 * muthowif, service order) shows the correct payment status in its own list and in Upcoming Arrivals.
 *
 * Allocation is sequential: the service with the nearest schedule (check-in, pickup, muthowif date,
 * departure) is settled first, because it is the one operations needs paid soonest.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  bookings,
  invoices,
  invoicePayments,
  transportationBookings,
  transportationInvoices,
  transportationInvoicePayments,
  transportationRoutes,
  muthowifBookings,
  muthowifInvoices,
  muthowifInvoicePayments,
  serviceOrders,
  serviceOrderInvoices,
  serviceOrderInvoicePayments,
} from '../db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface MergedSourceInvoice {
  invoiceId: number;
  invoiceNumber: string;
  invoiceType: string;
  originalAmount: string;
  originalCurrency: string;
  convertedAmount: string;
  exchangeRate: number;
  bookingCode?: string;
}

export interface PaymentAllocation {
  invoiceId: number;
  invoiceNumber: string;
  invoiceType: string;
  bookingCode?: string;
  /** Amount in the merged invoice currency */
  allocatedAmount: number;
  /** Same amount in the source invoice currency */
  originalAmount: number;
  originalCurrency: string;
  /** false when the source type has no payment ledger to sync (allocation tracked on the merged invoice only) */
  synced: boolean;
  isSourcePaidFull: boolean;
}

interface SourceState {
  source: MergedSourceInvoice;
  order: number;
  scheduleDate: Date | null;
  /** Remaining balance in the source invoice currency */
  remainingOriginal: number;
  synced: boolean;
  apply?: (tx: Tx, amount: number, ctx: ApplyContext) => Promise<boolean>;
}

interface ApplyContext {
  mergedInvoiceNumber: string;
  mergedPaymentId: number;
  method: string;
  referenceNumber: string;
  paidAt: Date;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function viaMergedMeta(ctx: ApplyContext) {
  return {
    description: `Dibayar via tagihan gabungan ${ctx.mergedInvoiceNumber}`,
    mergedInvoiceNumber: ctx.mergedInvoiceNumber,
    mergedPaymentId: ctx.mergedPaymentId,
    terminLabel: `Via ${ctx.mergedInvoiceNumber}`,
  };
}

async function loadHotelState(tx: Tx, source: MergedSourceInvoice): Promise<Partial<SourceState> | null> {
  const [row] = await tx
    .select({
      invoiceId: invoices.id,
      invoicePaid: invoices.paidAmount,
      bookingId: bookings.id,
      bookingCode: bookings.code,
      checkIn: bookings.checkIn,
      totalAmount: bookings.totalAmount,
      paymentStatus: bookings.paymentStatus,
      meta: bookings.meta,
    })
    .from(invoices)
    .innerJoin(bookings, eq(invoices.bookingId, bookings.id))
    .where(eq(invoices.id, source.invoiceId))
    .limit(1);
  if (!row) return null;

  // Same balance rules as POST /api/bookings/:id/pay
  const meta: any = row.meta || {};
  const payments: any[] = Array.isArray(meta.payments) ? meta.payments : [];
  const paidSoFar = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const total = parseFloat(String(row.totalAmount)) || 0;
  const remaining = meta.remainingBalance !== undefined && meta.remainingBalance !== null
    ? parseFloat(String(meta.remainingBalance)) || 0
    : Math.max(total - paidSoFar, 0);

  return {
    scheduleDate: row.checkIn,
    remainingOriginal: remaining,
    apply: async (tx, amount, ctx) => {
      const newRemaining = round2(Math.max(remaining - amount, 0));
      const isPaidFull = newRemaining <= 0;
      const terminNumber = payments.length + 1;
      const viaMeta = viaMergedMeta(ctx);

      payments.push({
        method: ctx.method,
        amount,
        date: ctx.paidAt.toISOString(),
        status: 'completed',
        reference: ctx.referenceNumber,
        termin: terminNumber,
        terminLabel: viaMeta.terminLabel,
        description: viaMeta.description,
        mergedInvoiceNumber: ctx.mergedInvoiceNumber,
        mergedPaymentId: ctx.mergedPaymentId,
      });
      meta.payments = payments;
      meta.remainingBalance = newRemaining;

      await tx
        .update(bookings)
        .set({ paymentStatus: isPaidFull ? 'paid' : 'partial', meta, updatedAt: new Date() })
        .where(eq(bookings.id, row.bookingId));

      await tx.insert(invoicePayments).values({
        invoiceId: row.invoiceId,
        amount: amount.toString(),
        currency: source.originalCurrency || 'SAR',
        method: ctx.method,
        referenceNumber: ctx.referenceNumber,
        paidAt: ctx.paidAt,
        status: 'completed',
        meta: { ...viaMeta, bookingCode: row.bookingCode, termin: terminNumber },
      });

      await tx
        .update(invoices)
        .set({
          paidAmount: round2((parseFloat(row.invoicePaid || '0') || 0) + amount).toString(),
          status: isPaidFull ? 'paid' : 'sent',
        })
        .where(eq(invoices.id, row.invoiceId));

      return isPaidFull;
    },
  };
}

async function loadTransportationState(tx: Tx, source: MergedSourceInvoice): Promise<Partial<SourceState> | null> {
  const [row] = await tx
    .select({
      invoiceId: transportationInvoices.id,
      amount: transportationInvoices.amount,
      paidAmount: transportationInvoices.paidAmount,
      currency: transportationInvoices.currency,
      bookingId: transportationInvoices.transportationBookingId,
      bookingStatus: transportationBookings.status,
      firstPickup: sql<Date | null>`(SELECT MIN(${transportationRoutes.pickupDateTime}) FROM ${transportationRoutes} WHERE ${transportationRoutes.transportationBookingId} = ${transportationInvoices.transportationBookingId})`,
    })
    .from(transportationInvoices)
    .innerJoin(transportationBookings, eq(transportationInvoices.transportationBookingId, transportationBookings.id))
    .where(eq(transportationInvoices.id, source.invoiceId))
    .limit(1);
  if (!row) return null;

  const total = parseFloat(row.amount) || 0;
  const paid = parseFloat(row.paidAmount || '0') || 0;

  return {
    scheduleDate: row.firstPickup ? new Date(row.firstPickup) : null,
    remainingOriginal: Math.max(total - paid, 0),
    apply: async (tx, amount, ctx) => {
      const newPaid = round2(paid + amount);
      const isPaidFull = newPaid >= total;

      await tx.insert(transportationInvoicePayments).values({
        invoiceId: row.invoiceId,
        amount: amount.toString(),
        currency: row.currency || 'SAR',
        method: ctx.method,
        referenceNumber: ctx.referenceNumber,
        paidAt: ctx.paidAt,
        status: 'completed',
        meta: viaMergedMeta(ctx),
      });

      await tx
        .update(transportationInvoices)
        .set({ paidAmount: newPaid.toString(), status: isPaidFull ? 'paid' : 'partially_paid', updatedAt: new Date() })
        .where(eq(transportationInvoices.id, row.invoiceId));

      // Mirror POST /api/transportation/:id/pay: a fully paid pending booking becomes confirmed
      if (isPaidFull && row.bookingStatus === 'pending') {
        await tx
          .update(transportationBookings)
          .set({ status: 'confirmed', updatedAt: new Date() })
          .where(eq(transportationBookings.id, row.bookingId));
      }

      return isPaidFull;
    },
  };
}

async function loadMuthowifState(tx: Tx, source: MergedSourceInvoice): Promise<Partial<SourceState> | null> {
  const [row] = await tx
    .select({
      invoiceId: muthowifInvoices.id,
      amount: muthowifInvoices.amount,
      paidAmount: muthowifInvoices.paidAmount,
      currency: muthowifInvoices.currency,
      dateTime: muthowifBookings.dateTime,
    })
    .from(muthowifInvoices)
    .innerJoin(muthowifBookings, eq(muthowifInvoices.muthowifBookingId, muthowifBookings.id))
    .where(eq(muthowifInvoices.id, source.invoiceId))
    .limit(1);
  if (!row) return null;

  const total = parseFloat(row.amount) || 0;
  const paid = parseFloat(row.paidAmount || '0') || 0;

  return {
    scheduleDate: row.dateTime,
    remainingOriginal: Math.max(total - paid, 0),
    apply: async (tx, amount, ctx) => {
      const newPaid = round2(paid + amount);
      const isPaidFull = newPaid >= total;

      await tx.insert(muthowifInvoicePayments).values({
        invoiceId: row.invoiceId,
        amount: amount.toString(),
        currency: row.currency || 'SAR',
        method: ctx.method,
        referenceNumber: ctx.referenceNumber,
        paidAt: ctx.paidAt,
        status: 'completed',
        meta: viaMergedMeta(ctx),
      });

      await tx
        .update(muthowifInvoices)
        .set({ paidAmount: newPaid.toString(), status: isPaidFull ? 'paid' : 'partially_paid', updatedAt: new Date() })
        .where(eq(muthowifInvoices.id, row.invoiceId));

      return isPaidFull;
    },
  };
}

async function loadServiceOrderState(tx: Tx, source: MergedSourceInvoice): Promise<Partial<SourceState> | null> {
  const [row] = await tx
    .select({
      invoiceId: serviceOrderInvoices.id,
      amount: serviceOrderInvoices.amount,
      paidAmount: serviceOrderInvoices.paidAmount,
      currency: serviceOrderInvoices.currency,
      departureDate: serviceOrders.departureDate,
    })
    .from(serviceOrderInvoices)
    .innerJoin(serviceOrders, eq(serviceOrderInvoices.serviceOrderId, serviceOrders.id))
    .where(eq(serviceOrderInvoices.id, source.invoiceId))
    .limit(1);
  if (!row) return null;

  const total = parseFloat(row.amount) || 0;
  const paid = parseFloat(row.paidAmount || '0') || 0;

  return {
    scheduleDate: row.departureDate,
    remainingOriginal: Math.max(total - paid, 0),
    apply: async (tx, amount, ctx) => {
      const newPaid = round2(paid + amount);
      const isPaidFull = newPaid >= total;

      await tx.insert(serviceOrderInvoicePayments).values({
        invoiceId: row.invoiceId,
        amount: amount.toString(),
        currency: row.currency || 'SAR',
        method: ctx.method,
        referenceNumber: ctx.referenceNumber,
        paidAt: ctx.paidAt,
        status: 'completed',
        meta: viaMergedMeta(ctx),
      });

      await tx
        .update(serviceOrderInvoices)
        .set({ paidAmount: newPaid.toString(), status: isPaidFull ? 'paid' : 'partially_paid', updatedAt: new Date() })
        .where(eq(serviceOrderInvoices.id, row.invoiceId));

      return isPaidFull;
    },
  };
}

const LOADERS: Record<string, (tx: Tx, source: MergedSourceInvoice) => Promise<Partial<SourceState> | null>> = {
  hotel: loadHotelState,
  transportation: loadTransportationState,
  muthowif: loadMuthowifState,
  service_order: loadServiceOrderState,
};

/**
 * Splits a payment made on a merged invoice across its source invoices and records it
 * in each source's own payment ledger. Must run inside the same transaction as the merged payment.
 *
 * @param amount Payment amount in the merged invoice currency
 * @param priorAllocations Allocations already recorded on the merged invoice (meta.paymentAllocations),
 *   used as the balance for source types that have no ledger of their own (Custom LA, Agent Request, Manual)
 */
export async function allocateMergedInvoicePayment(
  tx: Tx,
  params: {
    mergedInvoiceNumber: string;
    /** manual_invoice_payments.id, stamped on every source payment so it can be reversed later */
    mergedPaymentId: number;
    sourceInvoices: MergedSourceInvoice[];
    priorAllocations: PaymentAllocation[];
    amount: number;
    method: string;
    referenceNumber: string;
    paidAt: Date;
  },
): Promise<PaymentAllocation[]> {
  const states: SourceState[] = [];

  for (const [order, source] of params.sourceInvoices.entries()) {
    const loader = LOADERS[source.invoiceType];
    const loaded = loader ? await loader(tx, source) : null;

    if (loaded && loaded.apply) {
      states.push({ source, order, scheduleDate: loaded.scheduleDate ?? null, remainingOriginal: loaded.remainingOriginal ?? 0, synced: true, apply: loaded.apply });
    } else {
      // No ledger to sync: track the balance on the merged invoice itself
      const alreadyAllocated = params.priorAllocations
        .filter((a) => a.invoiceId === source.invoiceId && a.invoiceType === source.invoiceType)
        .reduce((sum, a) => sum + a.originalAmount, 0);
      states.push({
        source,
        order,
        scheduleDate: null,
        remainingOriginal: Math.max((parseFloat(source.originalAmount) || 0) - alreadyAllocated, 0),
        synced: false,
      });
    }
  }

  // Nearest schedule first; services without a schedule keep their merge order at the end
  states.sort((a, b) => {
    if (a.scheduleDate && b.scheduleDate) return a.scheduleDate.getTime() - b.scheduleDate.getTime() || a.order - b.order;
    if (a.scheduleDate) return -1;
    if (b.scheduleDate) return 1;
    return a.order - b.order;
  });

  const ctx: ApplyContext = {
    mergedInvoiceNumber: params.mergedInvoiceNumber,
    mergedPaymentId: params.mergedPaymentId,
    method: params.method,
    referenceNumber: params.referenceNumber,
    paidAt: params.paidAt,
  };

  const allocations: PaymentAllocation[] = [];
  let left = round2(params.amount);

  for (const state of states) {
    if (left <= 0) break;
    if (state.remainingOriginal <= 0) continue;

    const rate = Number(state.source.exchangeRate) || 1;
    const remainingConverted = round2(state.remainingOriginal * rate);
    const allocated = round2(Math.min(left, remainingConverted));
    if (allocated <= 0) continue;

    // Settle the exact original balance when fully covered, to avoid currency rounding leftovers
    const originalAmount = allocated >= remainingConverted ? state.remainingOriginal : round2(allocated / rate);

    const isSourcePaidFull = state.apply
      ? await state.apply(tx, originalAmount, ctx)
      : originalAmount >= state.remainingOriginal;

    allocations.push({
      invoiceId: state.source.invoiceId,
      invoiceNumber: state.source.invoiceNumber,
      invoiceType: state.source.invoiceType,
      bookingCode: state.source.bookingCode,
      allocatedAmount: allocated,
      originalAmount,
      originalCurrency: state.source.originalCurrency,
      synced: state.synced,
      isSourcePaidFull,
    });

    left = round2(left - allocated);
  }

  return allocations;
}

const byMergedPayment = (metaColumn: any, mergedPaymentId: number) =>
  sql`(${metaColumn} ->> 'mergedPaymentId')::int = ${mergedPaymentId}`;

/**
 * Undoes what allocateMergedInvoicePayment recorded for one merged payment:
 * removes the forwarded source payments and restores each source invoice/booking balance.
 */
export async function reverseMergedInvoicePayment(
  tx: Tx,
  params: { mergedPaymentId: number; allocations: PaymentAllocation[] },
): Promise<void> {
  for (const allocation of params.allocations) {
    if (!allocation.synced) continue;
    const amount = allocation.originalAmount;

    if (allocation.invoiceType === 'hotel') {
      const [row] = await tx
        .select({ invoicePaid: invoices.paidAmount, bookingId: bookings.id, totalAmount: bookings.totalAmount, meta: bookings.meta })
        .from(invoices)
        .innerJoin(bookings, eq(invoices.bookingId, bookings.id))
        .where(eq(invoices.id, allocation.invoiceId))
        .limit(1);
      if (!row) continue;

      const meta: any = row.meta || {};
      const payments: any[] = Array.isArray(meta.payments) ? meta.payments : [];
      meta.payments = payments.filter((p) => Number(p.mergedPaymentId) !== params.mergedPaymentId);
      const total = parseFloat(String(row.totalAmount)) || 0;
      const newRemaining = round2(Math.min((parseFloat(String(meta.remainingBalance ?? 0)) || 0) + amount, total));
      meta.remainingBalance = newRemaining;

      await tx
        .update(bookings)
        .set({ paymentStatus: newRemaining <= 0 ? 'paid' : newRemaining >= total ? 'unpaid' : 'partial', meta, updatedAt: new Date() })
        .where(eq(bookings.id, row.bookingId));
      await tx
        .delete(invoicePayments)
        .where(and(eq(invoicePayments.invoiceId, allocation.invoiceId), byMergedPayment(invoicePayments.meta, params.mergedPaymentId)));
      await tx
        .update(invoices)
        .set({
          paidAmount: round2(Math.max((parseFloat(row.invoicePaid || '0') || 0) - amount, 0)).toString(),
          status: newRemaining <= 0 ? 'paid' : 'sent',
        })
        .where(eq(invoices.id, allocation.invoiceId));
      continue;
    }

    const ledgers = {
      transportation: { invoiceTable: transportationInvoices, paymentTable: transportationInvoicePayments },
      muthowif: { invoiceTable: muthowifInvoices, paymentTable: muthowifInvoicePayments },
      service_order: { invoiceTable: serviceOrderInvoices, paymentTable: serviceOrderInvoicePayments },
    } as const;
    const ledger = ledgers[allocation.invoiceType as keyof typeof ledgers];
    if (!ledger) continue;
    const { invoiceTable, paymentTable } = ledger;

    const [inv] = await tx
      .select({ paidAmount: invoiceTable.paidAmount })
      .from(invoiceTable)
      .where(eq(invoiceTable.id, allocation.invoiceId))
      .limit(1);
    if (!inv) continue;

    const newPaid = round2(Math.max((parseFloat(inv.paidAmount || '0') || 0) - amount, 0));
    await tx
      .delete(paymentTable)
      .where(and(eq(paymentTable.invoiceId, allocation.invoiceId), byMergedPayment(paymentTable.meta, params.mergedPaymentId)));
    await tx
      .update(invoiceTable)
      .set({ paidAmount: newPaid.toString(), status: newPaid > 0 ? 'partially_paid' : 'sent', updatedAt: new Date() })
      .where(eq(invoiceTable.id, allocation.invoiceId));
  }
}
