import { Hono } from 'hono';
import type { Context } from 'hono';
import { and, asc, eq, desc, inArray, sql } from 'drizzle-orm';
import {
  generateMuthowifInvoicePDF,
  generateMuthowifReceiptPDF,
  generateMuthowifVoucherPDF,
  fileExistsInMinio,
  getFileStreamFromMinio,
} from '../utils/pdf';
import { db } from '../db';
import {
  muthowifBookings,
  muthowifInvoices,
  muthowifInvoicePayments,
  muthowifReceipts,
  muthowifVouchers,
  clients,
  clientDeposits,
  depositTransactions,
  muthowifs,
} from '../db/schema';
import type { MuthowifBooking, MuthowifInvoice } from '../db/schema';
import { requireAdmin, requireAdminOrFinance } from '../middleware/auth';
import { notifyAdminNewBooking } from '../lib/notification';
import { notificationService } from '../services/NotificationService';
import { OPERATIONAL_TIMEZONE, getOperationalDateString, parseOperationalDateTime } from '../lib/date';

// Muthowif schedules are always presented in Saudi (Asia/Riyadh) time
const formatIndoDateTime = (date: Date) => {
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: OPERATIONAL_TIMEZONE,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}`;
};

const formatIndoDate = (date: Date) =>
  date.toLocaleDateString('id-ID', { timeZone: OPERATIONAL_TIMEZONE });

/** Parses the admin form's datetime-local value ("YYYY-MM-DDTHH:mm") as Saudi time. */
const parseBookingDateTime = (value: string) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)$/);
  if (match) return parseOperationalDateTime(match[1]!, match[2]!) ?? new Date(raw);
  return new Date(raw);
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Transfer Bank',
  deposit: 'Saldo Deposit',
  cash: 'Tunai',
};

const getTerminLabel = (terminNumber: number, isPaidFull: boolean) => {
  if (isPaidFull && terminNumber === 1) return 'Pelunasan (Lunas Penuh)';
  if (isPaidFull) return `Termin #${terminNumber} (Pelunasan)`;
  if (terminNumber === 1) return 'Termin #1 (Uang Muka / DP)';
  return `Termin #${terminNumber}`;
};

const generateDocNumber = (prefix: string) =>
  `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

async function loadBookingWithClient(id: number) {
  const rows = await db
    .select({ booking: muthowifBookings, client: clients })
    .from(muthowifBookings)
    .leftJoin(clients, eq(muthowifBookings.clientId, clients.id))
    .where(eq(muthowifBookings.id, id))
    .limit(1);
  return rows[0] || null;
}

/** The active (latest) invoice of a booking; muthowif bookings carry a single billing invoice. */
async function getActiveInvoice(bookingId: number) {
  const rows = await db
    .select()
    .from(muthowifInvoices)
    .where(eq(muthowifInvoices.muthowifBookingId, bookingId))
    .orderBy(desc(muthowifInvoices.createdAt), desc(muthowifInvoices.id))
    .limit(1);
  return rows[0] || null;
}

async function renderInvoicePdf(invoice: MuthowifInvoice, booking: MuthowifBooking, client: any) {
  return generateMuthowifInvoicePDF({
    invoiceNo: invoice.number,
    invoiceDate: formatIndoDate(new Date(invoice.issueDate)),
    dueDate: formatIndoDate(new Date(invoice.dueDate)),
    client,
    guestName: booking.guestName,
    totalPax: booking.totalPax,
    dateTime: formatIndoDateTime(new Date(booking.dateTime)),
    currency: invoice.currency || booking.currency,
    events: booking.events,
    meetingPoint: booking.meetingPoint,
    totalAmount: invoice.amount.toString(),
  });
}

async function renderReceiptPdf(
  receipt: { number: string; issueDate: Date; paidAmount: string; balanceDue: string; meta: any },
  booking: MuthowifBooking,
  client: any,
  invoice: MuthowifInvoice | null,
) {
  const meta = receipt.meta || {};
  return generateMuthowifReceiptPDF({
    receiptNo: receipt.number,
    receiptDate: formatIndoDate(new Date(receipt.issueDate)),
    client,
    guestName: booking.guestName,
    totalPax: booking.totalPax,
    dateTime: formatIndoDateTime(new Date(booking.dateTime)),
    currency: invoice?.currency || booking.currency,
    events: booking.events,
    meetingPoint: booking.meetingPoint,
    totalAmount: (invoice?.amount || booking.totalAmount).toString(),
    paidAmount: receipt.paidAmount.toString(),
    balanceDue: receipt.balanceDue.toString(),
    termin: meta.termin,
    terminLabel: meta.terminLabel,
    paymentMethod: PAYMENT_METHOD_LABELS[meta.method] || meta.method,
    transactionId: meta.referenceNumber,
    invoice,
  });
}

async function renderVoucherPdf(voucherNumber: string, issueDate: Date, booking: MuthowifBooking, client: any) {
  return generateMuthowifVoucherPDF({
    voucherNo: voucherNumber,
    issueDate: formatIndoDate(issueDate),
    client,
    guestName: booking.guestName,
    totalPax: booking.totalPax,
    dateTime: formatIndoDateTime(new Date(booking.dateTime)),
    currency: booking.currency,
    events: booking.events,
    meetingPoint: booking.meetingPoint,
    totalAmount: booking.totalAmount,
  });
}

/** Streams a stored PDF from MinIO, regenerating it first when the object is missing. */
async function streamPdf(c: Context, objectKey: string, fileName: string, regenerate: () => Promise<unknown>) {
  if (!(await fileExistsInMinio(objectKey))) {
    await regenerate();
  }
  const stream = await getFileStreamFromMinio(objectKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const pdfBuffer = Buffer.concat(chunks);

  const isView = c.req.query('view') === 'true';
  c.header('Content-Type', 'application/pdf');
  c.header('Content-Disposition', `${isView ? 'inline' : 'attachment'}; filename="${fileName}"`);
  c.header('Content-Length', pdfBuffer.length.toString());
  return c.body(pdfBuffer as any);
}

const muthowifBookingsApp = new Hono();

// GET /api/muthowif-bookings - List all muthowif bookings
muthowifBookingsApp.get('/', requireAdmin, async (c) => {
  try {
    const result = await db
      .select()
      .from(muthowifBookings)
      .orderBy(desc(muthowifBookings.createdAt));

    const ids = result.map((b) => b.id);
    const invoiceRows = ids.length > 0
      ? await db.select().from(muthowifInvoices).where(inArray(muthowifInvoices.muthowifBookingId, ids))
      : [];

    const withPayment = result.map((booking) => {
      const active = invoiceRows.filter((inv) => inv.muthowifBookingId === booking.id && inv.status !== 'cancelled');
      const totalAmount = active.length > 0
        ? active.reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0)
        : parseFloat(booking.totalAmount || '0');
      const paidAmount = active.reduce((sum, inv) => sum + parseFloat(inv.paidAmount || '0'), 0);
      const paymentStatus = paidAmount >= totalAmount && totalAmount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
      return { ...booking, paidAmount: paidAmount.toFixed(2), paymentStatus };
    });

    return c.json(withPayment);
  } catch (error) {
    console.error('Error fetching muthowif bookings:', error);
    return c.json({ error: 'Failed to fetch muthowif bookings' }, 500);
  }
});

// GET /api/muthowif-bookings/:id - Get specific muthowif booking
muthowifBookingsApp.get('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const booking = await db
      .select()
      .from(muthowifBookings)
      .where(eq(muthowifBookings.id, id))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ error: 'Muthowif booking not found' }, 404);
    }

    // Get related documents
    const invoices = await db
      .select()
      .from(muthowifInvoices)
      .where(eq(muthowifInvoices.muthowifBookingId, id))
      .orderBy(desc(muthowifInvoices.createdAt));

    const receipts = await db
      .select()
      .from(muthowifReceipts)
      .where(eq(muthowifReceipts.muthowifBookingId, id))
      .orderBy(desc(muthowifReceipts.createdAt));

    const vouchers = await db
      .select()
      .from(muthowifVouchers)
      .where(eq(muthowifVouchers.muthowifBookingId, id))
      .orderBy(desc(muthowifVouchers.createdAt));

    let assignedMuthowif = null;
    if (booking[0]!.assignedMuthowifId) {
      const muthowifData = await db
        .select()
        .from(muthowifs)
        .where(eq(muthowifs.id, booking[0]!.assignedMuthowifId))
        .limit(1);
      if (muthowifData.length > 0) {
        assignedMuthowif = muthowifData[0];
      }
    }

    return c.json({
      ...booking[0]!,
      invoices,
      receipts,
      vouchers,
      assignedMuthowif
    });
  } catch (error) {
    console.error('Error fetching muthowif booking:', error);
    return c.json({ error: 'Failed to fetch muthowif booking' }, 500);
  }
});

// POST /api/muthowif-bookings - Create new muthowif booking
muthowifBookingsApp.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { clientId, guestName, dateTime, events, totalPax, meetingPoint, totalAmount, currency, notes } = body;

    const bookingNumber = `MB-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

    const [newBooking] = await db.insert(muthowifBookings).values({
      number: bookingNumber,
      clientId,
      guestName,
      dateTime: parseBookingDateTime(dateTime),
      events,
      totalPax,
      meetingPoint,
      totalAmount: totalAmount.toString(),
      currency: currency || 'SAR',
      notes,
    }).returning();

    // Notify admin
    notifyAdminNewBooking({
      type: 'muthowif_booking',
      bookingCode: bookingNumber,
      customerName: guestName,
      title: `Booking Muthowif - ${guestName}`,
      details: {
        'Jadwal': `${formatIndoDateTime(parseBookingDateTime(dateTime))} WAS`,
        'Agenda/Event': events || '-',
        'Jumlah Pax': `${totalPax} Orang`,
        'Meeting Point': meetingPoint || '-',
      },
      totalAmount: totalAmount,
      currency: currency || 'SAR',
      source: 'Admin Muthowif Booking',
      dashboardPath: `/dashboard/muthowifs`,
    }).catch((err) => console.error('Notification error in muthowifBookings:', err));

    return c.json(newBooking, 201);
  } catch (error) {
    console.error('Error creating muthowif booking:', error);
    return c.json({ error: 'Failed to create muthowif booking' }, 500);
  }
});

// GET /api/muthowif-bookings/:id/assignment-options - Active muthowifs with their workload and same-day conflicts
muthowifBookingsApp.get('/:id/assignment-options', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const [booking] = await db.select().from(muthowifBookings).where(eq(muthowifBookings.id, id)).limit(1);
    if (!booking) return c.json({ error: 'Booking not found' }, 404);

    const activeMuthowifs = await db
      .select()
      .from(muthowifs)
      .where(eq(muthowifs.isActive, true))
      .orderBy(asc(muthowifs.name));

    // Other live bookings already handled by a muthowif, from today (Saudi time) onwards
    const assignedBookings = await db
      .select({
        id: muthowifBookings.id,
        number: muthowifBookings.number,
        dateTime: muthowifBookings.dateTime,
        guestName: muthowifBookings.guestName,
        assignedMuthowifId: muthowifBookings.assignedMuthowifId,
      })
      .from(muthowifBookings)
      .where(and(
        sql`${muthowifBookings.assignedMuthowifId} IS NOT NULL`,
        sql`${muthowifBookings.id} <> ${id}`,
        sql`${muthowifBookings.status} NOT IN ('cancelled', 'completed')`,
        sql`DATE(${muthowifBookings.dateTime} AT TIME ZONE 'UTC' AT TIME ZONE ${OPERATIONAL_TIMEZONE}) >= DATE(NOW() AT TIME ZONE ${OPERATIONAL_TIMEZONE})`,
      ))
      .orderBy(asc(muthowifBookings.dateTime));

    const bookingDay = getOperationalDateString(booking.dateTime);

    const options = activeMuthowifs.map((m) => {
      const own = assignedBookings.filter((b) => b.assignedMuthowifId === m.id);
      const conflicts = own
        .filter((b) => getOperationalDateString(b.dateTime) === bookingDay)
        .map((b) => ({ id: b.id, number: b.number, dateTime: b.dateTime, guestName: b.guestName }));
      return {
        id: m.id,
        name: m.name,
        phone: m.phone,
        status: m.status,
        residentType: m.residentType,
        residenceLocation: m.residenceLocation,
        visaStatus: m.visaStatus,
        upcomingCount: own.length,
        conflicts,
      };
    });

    return c.json({ assignedMuthowifId: booking.assignedMuthowifId, options });
  } catch (error) {
    console.error('Error fetching muthowif assignment options:', error);
    return c.json({ error: 'Failed to fetch assignment options' }, 500);
  }
});

// PUT /api/muthowif-bookings/:id/assign - Assign, replace, or release (muthowifId: null) the muthowif
muthowifBookingsApp.put('/:id/assign', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const muthowifId = body.muthowifId === null || body.muthowifId === undefined || body.muthowifId === ''
      ? null
      : Number(body.muthowifId);

    if (muthowifId !== null) {
      if (!Number.isInteger(muthowifId)) return c.json({ error: 'Muthowif tidak valid' }, 400);
      const [muthowif] = await db.select().from(muthowifs).where(eq(muthowifs.id, muthowifId)).limit(1);
      if (!muthowif || !muthowif.isActive) {
        return c.json({ error: 'Muthowif tidak ditemukan atau sudah tidak aktif' }, 400);
      }
    }

    const [updatedBooking] = await db
      .update(muthowifBookings)
      .set({
        assignedMuthowifId: muthowifId,
        updatedAt: new Date()
      })
      .where(eq(muthowifBookings.id, id))
      .returning();

    if (!updatedBooking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    return c.json(updatedBooking);
  } catch (error) {
    console.error('Error assigning muthowif:', error);
    return c.json({ error: 'Failed to assign muthowif' }, 500);
  }
});

// POST /api/muthowif-bookings/:id/invoice - Generate or regenerate the booking invoice
// An existing invoice is refreshed in place so its number and recorded payments are kept.
muthowifBookingsApp.post('/:id/invoice', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));

    const row = await loadBookingWithClient(id);
    if (!row) return c.json({ error: 'Booking not found' }, 404);
    const { booking, client } = row;

    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const amount = (body.amount ?? booking.totalAmount).toString();

    const existing = await getActiveInvoice(id);
    let invoice: MuthowifInvoice;

    if (existing) {
      const paid = parseFloat(existing.paidAmount || '0');
      const total = parseFloat(amount);
      const status = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partially_paid' : existing.status === 'draft' ? 'draft' : 'sent';
      const [updated] = await db
        .update(muthowifInvoices)
        .set({ amount, issueDate, dueDate, status, updatedAt: new Date() })
        .where(eq(muthowifInvoices.id, existing.id))
        .returning();
      invoice = updated!;
    } else {
      const [created] = await db.insert(muthowifInvoices).values({
        number: generateDocNumber('MBI'),
        muthowifBookingId: id,
        amount,
        currency: booking.currency,
        issueDate,
        dueDate,
        status: 'draft',
      }).returning();
      invoice = created!;
    }

    try {
      const pdfUrl = await renderInvoicePdf(invoice, booking, client);
      await db.update(muthowifInvoices).set({ pdfUrl }).where(eq(muthowifInvoices.id, invoice.id));
      invoice.pdfUrl = pdfUrl;
    } catch (pdfError) {
      console.error('Failed to generate muthowif invoice PDF, invoice saved without PDF:', pdfError);
    }

    const invoiceChannels: ('email' | 'whatsapp')[] = [];
    if (body.sendEmail) invoiceChannels.push('email');
    if (body.sendWhatsApp) invoiceChannels.push('whatsapp');

    if (invoiceChannels.length > 0) {
      notificationService.sendInvoice({
        clientId: booking.clientId || undefined,
        invoiceNumber: invoice.number,
        recipientName: client?.name || booking.guestName || 'Pelanggan Musafirin',
        recipientEmail: client?.email || undefined,
        recipientPhone: client?.phone || undefined,
        totalAmount: invoice.amount,
        currency: invoice.currency || booking.currency || 'SAR',
        dueDate,
        issueDate,
        channels: invoiceChannels,
      }).catch((err) => console.error('[NotificationService] Error sending muthowif invoice notification:', err));
    }

    return c.json(invoice, existing ? 200 : 201);
  } catch (error) {
    console.error('Error creating invoice:', error);
    return c.json({ error: 'Failed to create invoice' }, 500);
  }
});

// POST /api/muthowif-bookings/:id/receipt - Generate Receipt
muthowifBookingsApp.post('/:id/receipt', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { invoiceId, paidAmount, balanceDue, payerName } = body;

    const booking = await db.select().from(muthowifBookings).where(eq(muthowifBookings.id, id)).limit(1);
    if (!booking.length) return c.json({ error: 'Booking not found' }, 404);

    const receiptNumber = `MBR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

    const client = await db.select().from(clients).where(eq(clients.id, booking[0]!.clientId)).limit(1);


    let invoice = null;
    if (invoiceId) {
      const inv = await db.select().from(muthowifInvoices).where(eq(muthowifInvoices.id, invoiceId)).limit(1);
      if (inv.length > 0) invoice = inv[0];
    }

    const existingReceipts = await db
      .select()
      .from(muthowifReceipts)
      .where(eq(muthowifReceipts.muthowifBookingId, id));
    const terminNumber = existingReceipts.length + 1;
    const isPaidFull = Number(balanceDue) <= 0;
    let terminLabel = `Termin #${terminNumber}`;
    if (isPaidFull && terminNumber === 1) {
      terminLabel = 'Pelunasan (Lunas Penuh)';
    } else if (isPaidFull) {
      terminLabel = `Termin #${terminNumber} (Pelunasan)`;
    } else if (terminNumber === 1) {
      terminLabel = 'Termin #1 (Uang Muka / DP)';
    }

    const totalInvoiceAmount = invoice?.amount || booking[0]!.totalAmount;

    const pdfUrl = await generateMuthowifReceiptPDF({
      receiptNo: receiptNumber,
      receiptDate: new Date().toLocaleDateString('id-ID'),
      client: client[0],
      guestName: booking[0]!.guestName,
      totalPax: booking[0]!.totalPax,
      dateTime: formatIndoDateTime(new Date(booking[0]!.dateTime)),
      currency: booking[0]!.currency,
      events: booking[0]!.events,
      meetingPoint: booking[0]!.meetingPoint,
      totalAmount: totalInvoiceAmount.toString(),
      paidAmount: paidAmount.toString(),
      balanceDue: balanceDue.toString(),
      termin: terminNumber,
      terminLabel,
      invoice: invoice
    });

    const [newReceipt] = await db.insert(muthowifReceipts).values({
      number: receiptNumber,
      muthowifBookingId: id,
      muthowifInvoiceId: invoiceId,
      totalAmount: booking[0]!.totalAmount,
      paidAmount: paidAmount.toString(),
      balanceDue: balanceDue.toString(),
      currency: booking[0]!.currency,
      payerName: payerName || booking[0]!.guestName,
      issueDate: new Date(),
      pdfUrl: pdfUrl,
    }).returning();

    // If an invoice is provided, update its paid amount
    if (invoiceId) {
      const invoice = await db.select().from(muthowifInvoices).where(eq(muthowifInvoices.id, invoiceId)).limit(1);
      if (invoice.length) {
        const currentPaid = parseFloat(invoice[0]!.paidAmount) || 0;
        const newPaid = currentPaid + parseFloat(paidAmount);
        await db.update(muthowifInvoices)
          .set({ 
            paidAmount: newPaid.toString(),
            status: newPaid >= parseFloat(invoice[0]!.amount) ? 'paid' : 'partially_paid'
          })
          .where(eq(muthowifInvoices.id, invoiceId));
      }
    }

    return c.json(newReceipt, 201);
  } catch (error) {
    console.error('Error creating receipt:', error);
    return c.json({ error: 'Failed to create receipt' }, 500);
  }
});

// POST /api/muthowif-bookings/:id/voucher - Generate Voucher
muthowifBookingsApp.post('/:id/voucher', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const booking = await db.select().from(muthowifBookings).where(eq(muthowifBookings.id, id)).limit(1);
    if (!booking.length) return c.json({ error: 'Booking not found' }, 404);

    const voucherNumber = `MBV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

    const client = await db.select().from(clients).where(eq(clients.id, booking[0]!.clientId)).limit(1);

    const pdfUrl = await renderVoucherPdf(voucherNumber, new Date(), booking[0]!, client[0]);

    const [newVoucher] = await db.insert(muthowifVouchers).values({
      number: voucherNumber,
      muthowifBookingId: id,
      issueDate: new Date(),
      pdfUrl: pdfUrl,
    }).returning();

    // Also update booking status to confirmed if not already
    if (booking[0]!.status === 'pending') {
      await db.update(muthowifBookings).set({ status: 'confirmed' }).where(eq(muthowifBookings.id, id));
    }

    return c.json(newVoucher, 201);
  } catch (error) {
    console.error('Error creating voucher:', error);
    return c.json({ error: 'Failed to create voucher' }, 500);
  }
});

// PATCH /api/muthowif-bookings/:id/status - Update booking status from the detail page
muthowifBookingsApp.patch('/:id/status', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { status } = await c.req.json().catch(() => ({}));
    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return c.json({ error: 'Status tidak valid' }, 400);
    }

    const [updated] = await db
      .update(muthowifBookings)
      .set({ status, updatedAt: new Date() })
      .where(eq(muthowifBookings.id, id))
      .returning();

    if (!updated) return c.json({ error: 'Booking not found' }, 404);
    return c.json(updated);
  } catch (error) {
    console.error('Error updating muthowif booking status:', error);
    return c.json({ error: 'Failed to update status' }, 500);
  }
});

// DELETE /api/muthowif-bookings/:id - Delete a booking that has no recorded payments
muthowifBookingsApp.delete('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const invoices = await db.select().from(muthowifInvoices).where(eq(muthowifInvoices.muthowifBookingId, id));
    const invoiceIds = invoices.map((inv) => inv.id);
    if (invoiceIds.length > 0) {
      const payments = await db
        .select({ id: muthowifInvoicePayments.id })
        .from(muthowifInvoicePayments)
        .where(inArray(muthowifInvoicePayments.invoiceId, invoiceIds))
        .limit(1);
      if (payments.length > 0) {
        return c.json({ error: 'Booking sudah memiliki pembayaran. Hapus pembayaran terlebih dahulu atau ubah status menjadi Cancelled.' }, 400);
      }
    }

    const [deleted] = await db.delete(muthowifBookings).where(eq(muthowifBookings.id, id)).returning();
    if (!deleted) return c.json({ error: 'Booking not found' }, 404);
    return c.json({ success: true, message: 'Booking muthowif berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting muthowif booking:', error);
    return c.json({ error: 'Failed to delete muthowif booking' }, 500);
  }
});

// GET /api/muthowif-bookings/:id/billing - Billing summary, payment history, and receipts
muthowifBookingsApp.get('/:id/billing', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const row = await loadBookingWithClient(id);
    if (!row) return c.json({ error: 'Muthowif booking not found' }, 404);
    const { booking, client } = row;

    let clientDepositBalance = '0.00';
    if (booking.clientId) {
      const dep = await db
        .select({ currentBalance: clientDeposits.currentBalance })
        .from(clientDeposits)
        .where(eq(clientDeposits.clientId, booking.clientId))
        .limit(1);
      if (dep[0]?.currentBalance) clientDepositBalance = dep[0].currentBalance;
    }

    const invoice = await getActiveInvoice(id);
    const receiptsList = await db
      .select()
      .from(muthowifReceipts)
      .where(eq(muthowifReceipts.muthowifBookingId, id))
      .orderBy(desc(muthowifReceipts.createdAt));

    const totalAmount = invoice ? parseFloat(invoice.amount) : parseFloat(booking.totalAmount || '0');
    const paidAmount = invoice ? parseFloat(invoice.paidAmount || '0') : 0;
    const remainingBalance = Math.max(0, totalAmount - paidAmount);
    const isOrderPaidFull = paidAmount >= totalAmount && totalAmount > 0;
    const paymentStatus = isOrderPaidFull ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    let payments: any[] = [];
    if (invoice) {
      const rawPayments = await db
        .select()
        .from(muthowifInvoicePayments)
        .where(eq(muthowifInvoicePayments.invoiceId, invoice.id))
        .orderBy(asc(muthowifInvoicePayments.paidAt), asc(muthowifInvoicePayments.id));

      payments = rawPayments.map((p, index) => {
        const meta = (p.meta as any) || {};
        const terminNumber = meta.termin || index + 1;
        const isLastPayment = index === rawPayments.length - 1;
        const terminLabel = meta.terminLabel || getTerminLabel(terminNumber, isOrderPaidFull && isLastPayment);
        const matchedReceipt = receiptsList.find((r) => {
          const rMeta = (r.meta as any) || {};
          return (rMeta.paymentId && rMeta.paymentId === p.id) || (meta.receiptNumber && r.number === meta.receiptNumber);
        });

        return {
          ...p,
          termin: terminNumber,
          terminLabel,
          isFromMergedInvoice: !!meta.mergedPaymentId,
          receiptNumber: matchedReceipt?.number || null,
          receiptUrl: matchedReceipt?.pdfUrl || null,
        };
      });

      // Newest payment on top
      payments.reverse();
    }

    return c.json({
      success: true,
      data: {
        booking,
        client: client ? { ...client, depositBalance: clientDepositBalance } : null,
        invoice,
        payments,
        receipts: receiptsList,
        summary: {
          totalAmount,
          paidAmount,
          remainingBalance,
          paymentStatus,
          currency: invoice?.currency || booking.currency || 'SAR',
          clientDepositBalance: parseFloat(clientDepositBalance) || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching muthowif billing:', error);
    return c.json({ error: 'Failed to fetch muthowif billing' }, 500);
  }
});

// POST /api/muthowif-bookings/:id/pay - Record a (partial) payment and auto-issue a receipt
muthowifBookingsApp.post('/:id/pay', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const method = body?.method as 'bank_transfer' | 'deposit' | 'cash' | undefined;
    const amountNum = body?.amount !== undefined ? parseFloat(body.amount) : undefined;
    const referenceNumber: string | undefined = body?.referenceNumber;
    const description: string | undefined = body?.description;
    const autoGenerateReceipt: boolean = body?.autoGenerateReceipt !== false;

    if (!method || !['bank_transfer', 'deposit', 'cash'].includes(method)) {
      return c.json({ error: 'Metode pembayaran tidak valid. Pilih: Transfer Bank, Saldo Deposit, atau Tunai' }, 400);
    }
    if (amountNum === undefined || isNaN(amountNum) || amountNum <= 0) {
      return c.json({ error: 'Nominal pembayaran harus lebih besar dari 0' }, 400);
    }

    const row = await loadBookingWithClient(id);
    if (!row) return c.json({ error: 'Muthowif booking not found' }, 404);
    const { booking, client } = row;

    // Find or auto-create the invoice so every payment is tied to one
    let invoice = await getActiveInvoice(id);
    if (!invoice) {
      const [created] = await db.insert(muthowifInvoices).values({
        number: generateDocNumber('MBI'),
        muthowifBookingId: id,
        amount: booking.totalAmount.toString(),
        paidAmount: '0.00',
        currency: booking.currency || 'SAR',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'draft',
      }).returning();
      invoice = created!;

      try {
        const pdfUrl = await renderInvoicePdf(invoice, booking, client);
        await db.update(muthowifInvoices).set({ pdfUrl }).where(eq(muthowifInvoices.id, invoice.id));
        invoice.pdfUrl = pdfUrl;
      } catch (e) {
        console.warn('Auto muthowif invoice PDF generation deferred:', e);
      }
    }

    const activeInvoice = invoice;
    const totalInvoiceAmount = parseFloat(activeInvoice.amount);
    const currentPaidAmount = parseFloat(activeInvoice.paidAmount || '0');
    const remainingBalance = Math.max(0, totalInvoiceAmount - currentPaidAmount);
    const currency = activeInvoice.currency || booking.currency || 'SAR';

    if (remainingBalance <= 0) {
      return c.json({ error: 'Booking muthowif ini sudah lunas. Tidak ada sisa tagihan.' }, 400);
    }

    const paymentResult = await db.transaction(async (tx) => {
      const effectivePayAmount = Math.min(amountNum, remainingBalance);

      if (method === 'deposit') {
        if (!booking.clientId) throw new Error('Klien tidak ditemukan untuk pemotongan deposit');

        const depRows = await tx.select().from(clientDeposits).where(eq(clientDeposits.clientId, booking.clientId)).limit(1);
        const currentDepositBalance = depRows.length > 0 ? parseFloat(depRows[0]!.currentBalance) : 0;
        if (currentDepositBalance < effectivePayAmount) {
          throw new Error(`Saldo deposit tidak mencukupi. Saldo saat ini: SAR ${currentDepositBalance.toLocaleString()}, diperlukan: SAR ${effectivePayAmount.toLocaleString()}`);
        }

        const newDepositBalance = currentDepositBalance - effectivePayAmount;
        const newTotalUsed = (depRows.length > 0 ? parseFloat(depRows[0]!.totalUsed) : 0) + effectivePayAmount;

        await tx.update(clientDeposits).set({
          currentBalance: newDepositBalance.toString(),
          totalUsed: newTotalUsed.toString(),
          lastTransactionAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(clientDeposits.clientId, booking.clientId));

        await tx.insert(depositTransactions).values({
          clientId: booking.clientId,
          type: 'usage',
          amount: effectivePayAmount.toString(),
          balanceBefore: currentDepositBalance.toString(),
          balanceAfter: newDepositBalance.toString(),
          currency: 'SAR',
          status: 'completed',
          description: description || `Pembayaran Booking Muthowif ${booking.number}`,
          referenceNumber: referenceNumber || `DEP-MB-${Date.now()}`,
          processedAt: new Date(),
        });
      }

      const newPaidTotal = currentPaidAmount + effectivePayAmount;
      const newRemaining = Math.max(0, totalInvoiceAmount - newPaidTotal);
      const isPaidFull = newPaidTotal >= totalInvoiceAmount;

      const existingPayments = await tx
        .select({ id: muthowifInvoicePayments.id })
        .from(muthowifInvoicePayments)
        .where(eq(muthowifInvoicePayments.invoiceId, activeInvoice.id));
      const terminNumber = existingPayments.length + 1;
      const terminLabel = getTerminLabel(terminNumber, isPaidFull);
      const receiptNumber = generateDocNumber('MBR');

      const [paymentRecord] = await tx.insert(muthowifInvoicePayments).values({
        invoiceId: activeInvoice.id,
        amount: effectivePayAmount.toString(),
        currency,
        method,
        referenceNumber: referenceNumber || (method === 'deposit' ? `DEP-${Date.now()}` : `PAY-${Date.now()}`),
        paidAt: new Date(),
        status: 'completed',
        meta: {
          description: description || null,
          termin: terminNumber,
          terminLabel,
          receiptNumber: autoGenerateReceipt ? receiptNumber : null,
        },
      }).returning();

      if (!paymentRecord) throw new Error('Gagal menyimpan transaksi pembayaran');

      await tx.update(muthowifInvoices).set({
        paidAmount: newPaidTotal.toString(),
        status: isPaidFull ? 'paid' : 'partially_paid',
        updatedAt: new Date(),
      }).where(eq(muthowifInvoices.id, activeInvoice.id));

      if (isPaidFull && booking.status === 'pending') {
        await tx.update(muthowifBookings).set({ status: 'confirmed', updatedAt: new Date() }).where(eq(muthowifBookings.id, id));
      }

      return { payment: paymentRecord, newPaidTotal, newRemaining, isPaidFull, effectivePayAmount, terminNumber, terminLabel, receiptNumber };
    });

    let createdReceipt: any = null;
    if (autoGenerateReceipt) {
      try {
        const receiptMeta = {
          paymentId: paymentResult.payment.id,
          termin: paymentResult.terminNumber,
          terminLabel: paymentResult.terminLabel,
          referenceNumber: paymentResult.payment.referenceNumber,
          method,
          description: description || null,
        };
        const issueDate = new Date();
        // The receipt is recorded even if PDF rendering fails; the PDF endpoint regenerates it on demand
        let pdfUrl: string | null = null;
        try {
          pdfUrl = await renderReceiptPdf(
            {
              number: paymentResult.receiptNumber,
              issueDate,
              paidAmount: paymentResult.effectivePayAmount.toString(),
              balanceDue: paymentResult.newRemaining.toString(),
              meta: receiptMeta,
            },
            booking,
            client,
            activeInvoice,
          );
        } catch (pdfErr) {
          console.error('Muthowif receipt PDF generation deferred:', pdfErr);
        }

        const [receiptRow] = await db.insert(muthowifReceipts).values({
          number: paymentResult.receiptNumber,
          muthowifBookingId: id,
          muthowifInvoiceId: activeInvoice.id,
          totalAmount: totalInvoiceAmount.toString(),
          paidAmount: paymentResult.effectivePayAmount.toString(),
          balanceDue: paymentResult.newRemaining.toString(),
          currency,
          payerName: client?.name || booking.guestName,
          payerEmail: client?.email || null,
          payerPhone: client?.phone || null,
          notes: description || null,
          issueDate,
          pdfUrl,
          meta: receiptMeta,
        }).returning();
        createdReceipt = receiptRow;
      } catch (receiptErr) {
        console.error('Error auto-generating muthowif receipt:', receiptErr);
      }
    }

    const payChannels: ('email' | 'whatsapp')[] = [];
    if (body?.sendEmail) payChannels.push('email');
    if (body?.sendWhatsApp) payChannels.push('whatsapp');

    if (payChannels.length > 0) {
      notificationService.sendPaymentConfirmation({
        orderCode: booking.number,
        orderTitle: `Pemesanan Muthowif (${booking.number})`,
        paymentId: paymentResult.payment.referenceNumber ?? undefined,
        amount: paymentResult.effectivePayAmount,
        currency,
        method,
        terminLabel: paymentResult.terminLabel,
        remainingBalance: paymentResult.newRemaining,
        recipientName: client?.name || booking.guestName || 'Pelanggan Musafirin',
        recipientEmail: client?.email || undefined,
        recipientPhone: client?.phone || undefined,
        paymentStatus: paymentResult.isPaidFull ? 'paid' : 'partial',
        channels: payChannels,
      }).catch((err) => console.error('[NotificationService] Error sending muthowif payment confirmation:', err));
    }

    return c.json({
      success: true,
      message: 'Pembayaran berhasil dicatat',
      data: {
        payment: paymentResult.payment,
        receipt: createdReceipt,
        paidAmount: paymentResult.newPaidTotal,
        remainingBalance: paymentResult.newRemaining,
        isPaidFull: paymentResult.isPaidFull,
      },
    }, 201);
  } catch (error: any) {
    console.error('Error recording muthowif payment:', error);
    return c.json({ error: error.message || 'Gagal mencatat pembayaran' }, 500);
  }
});

// DELETE /api/muthowif-bookings/:id/payments/:paymentId - Cancel a recorded payment
muthowifBookingsApp.delete('/:id/payments/:paymentId', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const paymentId = parseInt(c.req.param('paymentId'));
    if (!id || isNaN(id) || !paymentId || isNaN(paymentId)) {
      return c.json({ error: 'Invalid parameters' }, 400);
    }

    const row = await loadBookingWithClient(id);
    if (!row) return c.json({ error: 'Muthowif booking not found' }, 404);
    const { booking } = row;

    const invoiceIds = (await db
      .select({ id: muthowifInvoices.id })
      .from(muthowifInvoices)
      .where(eq(muthowifInvoices.muthowifBookingId, id))).map((inv) => inv.id);
    if (invoiceIds.length === 0) return c.json({ error: 'Invoice not found for this booking' }, 404);

    const [payment] = await db
      .select()
      .from(muthowifInvoicePayments)
      .where(and(eq(muthowifInvoicePayments.id, paymentId), inArray(muthowifInvoicePayments.invoiceId, invoiceIds)))
      .limit(1);
    if (!payment) return c.json({ error: 'Payment record not found' }, 404);

    const paymentMeta = (payment.meta as any) || {};
    if (paymentMeta.mergedPaymentId) {
      return c.json({
        error: `Pembayaran ini berasal dari tagihan gabungan ${paymentMeta.mergedInvoiceNumber || ''}. Batalkan dari halaman tagihan gabungan tersebut.`.replace(/\s+\./, '.'),
      }, 400);
    }

    const amountToRevert = parseFloat(payment.amount);

    await db.transaction(async (tx) => {
      if (payment.method === 'deposit' && booking.clientId) {
        const [dep] = await tx.select().from(clientDeposits).where(eq(clientDeposits.clientId, booking.clientId)).limit(1);
        if (dep) {
          const curBal = parseFloat(dep.currentBalance);
          const newBal = curBal + amountToRevert;
          await tx.update(clientDeposits).set({
            currentBalance: newBal.toString(),
            totalUsed: Math.max(0, parseFloat(dep.totalUsed) - amountToRevert).toString(),
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(clientDeposits.clientId, booking.clientId));

          await tx.insert(depositTransactions).values({
            clientId: booking.clientId,
            type: 'refund',
            amount: amountToRevert.toString(),
            balanceBefore: curBal.toString(),
            balanceAfter: newBal.toString(),
            currency: 'SAR',
            status: 'completed',
            description: `Pembatalan pembayaran Booking Muthowif ${booking.number}`,
            referenceNumber: `REF-MB-${Date.now()}`,
            processedAt: new Date(),
          });
        }
      }

      await tx.delete(muthowifInvoicePayments).where(eq(muthowifInvoicePayments.id, paymentId));
      await tx.delete(muthowifReceipts).where(
        sql`${muthowifReceipts.muthowifBookingId} = ${id} AND ${muthowifReceipts.meta}->>'paymentId' = ${paymentId.toString()}`
      );

      const [invoice] = await tx.select().from(muthowifInvoices).where(eq(muthowifInvoices.id, payment.invoiceId)).limit(1);
      const remaining = await tx.select().from(muthowifInvoicePayments).where(eq(muthowifInvoicePayments.invoiceId, payment.invoiceId));
      const newPaidTotal = remaining.reduce((acc, p) => acc + parseFloat(p.amount), 0);
      const totalInvoiceAmount = parseFloat(invoice?.amount || '0');
      const isPaidFull = newPaidTotal >= totalInvoiceAmount && totalInvoiceAmount > 0;

      await tx.update(muthowifInvoices).set({
        paidAmount: newPaidTotal.toString(),
        status: isPaidFull ? 'paid' : newPaidTotal > 0 ? 'partially_paid' : 'sent',
        updatedAt: new Date(),
      }).where(eq(muthowifInvoices.id, payment.invoiceId));
    });

    return c.json({ success: true, message: 'Pembayaran berhasil dibatalkan/dihapus' });
  } catch (error) {
    console.error('Error deleting muthowif payment:', error);
    return c.json({ error: 'Failed to delete payment' }, 500);
  }
});

// GET /api/muthowif-bookings/invoice/:number - Serve invoice PDF
muthowifBookingsApp.get('/invoice/:number', requireAdminOrFinance, async (c) => {
  try {
    const number = c.req.param('number');
    const [invoice] = await db.select().from(muthowifInvoices).where(eq(muthowifInvoices.number, number)).limit(1);
    if (!invoice) return c.json({ error: 'Invoice not found' }, 404);

    return await streamPdf(c, `invoices/${number}.pdf`, `${number}.pdf`, async () => {
      const row = await loadBookingWithClient(invoice.muthowifBookingId);
      if (!row) throw new Error('Booking not found');
      const pdfUrl = await renderInvoicePdf(invoice, row.booking, row.client);
      await db.update(muthowifInvoices).set({ pdfUrl }).where(eq(muthowifInvoices.id, invoice.id));
    });
  } catch (error) {
    console.error('Error serving muthowif invoice PDF:', error);
    return c.json({ error: 'Failed to serve invoice PDF' }, 500);
  }
});

// GET /api/muthowif-bookings/receipt/:number - Serve receipt (kwitansi) PDF
muthowifBookingsApp.get('/receipt/:number', requireAdminOrFinance, async (c) => {
  try {
    const number = c.req.param('number');
    const [receipt] = await db.select().from(muthowifReceipts).where(eq(muthowifReceipts.number, number)).limit(1);
    if (!receipt) return c.json({ error: 'Receipt not found' }, 404);

    return await streamPdf(c, `receipts/${number}.pdf`, `${number}.pdf`, async () => {
      const row = await loadBookingWithClient(receipt.muthowifBookingId);
      if (!row) throw new Error('Booking not found');
      const invoice = receipt.muthowifInvoiceId
        ? (await db.select().from(muthowifInvoices).where(eq(muthowifInvoices.id, receipt.muthowifInvoiceId)).limit(1))[0] || null
        : null;
      const pdfUrl = await renderReceiptPdf(receipt, row.booking, row.client, invoice);
      await db.update(muthowifReceipts).set({ pdfUrl }).where(eq(muthowifReceipts.id, receipt.id));
    });
  } catch (error) {
    console.error('Error serving muthowif receipt PDF:', error);
    return c.json({ error: 'Failed to serve receipt PDF' }, 500);
  }
});

// GET /api/muthowif-bookings/voucher/:number - Serve voucher PDF
muthowifBookingsApp.get('/voucher/:number', requireAdmin, async (c) => {
  try {
    const number = c.req.param('number');
    const [voucher] = await db.select().from(muthowifVouchers).where(eq(muthowifVouchers.number, number)).limit(1);
    if (!voucher) return c.json({ error: 'Voucher not found' }, 404);

    return await streamPdf(c, `vouchers/${number}.pdf`, `${number}.pdf`, async () => {
      const row = await loadBookingWithClient(voucher.muthowifBookingId);
      if (!row) throw new Error('Booking not found');
      const pdfUrl = await renderVoucherPdf(number, new Date(voucher.issueDate), row.booking, row.client);
      await db.update(muthowifVouchers).set({ pdfUrl }).where(eq(muthowifVouchers.id, voucher.id));
    });
  } catch (error) {
    console.error('Error serving muthowif voucher PDF:', error);
    return c.json({ error: 'Failed to serve voucher PDF' }, 500);
  }
});

export default muthowifBookingsApp;

