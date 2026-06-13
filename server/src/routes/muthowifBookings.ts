import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { generateMuthowifInvoicePDF, generateMuthowifReceiptPDF, generateMuthowifVoucherPDF } from '../utils/pdf';
import { db } from '../db';
import {
  muthowifBookings,
  muthowifInvoices,
  muthowifReceipts,
  muthowifVouchers,
  clients,
  muthowifs,
} from '../db/schema';
import { requireAdmin } from '../middleware/auth';

const formatIndoDateTime = (date: Date) => {
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const muthowifBookingsApp = new Hono();

// GET /api/muthowif-bookings - List all muthowif bookings
muthowifBookingsApp.get('/', requireAdmin, async (c) => {
  try {
    const result = await db
      .select()
      .from(muthowifBookings)
      .orderBy(desc(muthowifBookings.createdAt));

    return c.json(result);
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
      dateTime: new Date(dateTime),
      events,
      totalPax,
      meetingPoint,
      totalAmount: totalAmount.toString(),
      currency: currency || 'SAR',
      notes,
    }).returning();

    return c.json(newBooking, 201);
  } catch (error) {
    console.error('Error creating muthowif booking:', error);
    return c.json({ error: 'Failed to create muthowif booking' }, 500);
  }
});

// PUT /api/muthowif-bookings/:id/assign - Assign Muthowif
muthowifBookingsApp.put('/:id/assign', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { muthowifId } = await c.req.json();

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

// POST /api/muthowif-bookings/:id/invoice - Generate Invoice
muthowifBookingsApp.post('/:id/invoice', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { amount, issueDate, dueDate } = await c.req.json();

    const booking = await db.select().from(muthowifBookings).where(eq(muthowifBookings.id, id)).limit(1);
    if (!booking.length) return c.json({ error: 'Booking not found' }, 404);

    const invoiceNumber = `MBI-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

    const client = await db.select().from(clients).where(eq(clients.id, booking[0]!.clientId)).limit(1);

    const pdfUrl = await generateMuthowifInvoicePDF({
      invoiceNo: invoiceNumber,
      invoiceDate: new Date(issueDate).toLocaleDateString('id-ID'),
      dueDate: new Date(dueDate).toLocaleDateString('id-ID'),
      client: client[0],
      guestName: booking[0]!.guestName,
      totalPax: booking[0]!.totalPax,
      dateTime: formatIndoDateTime(new Date(booking[0]!.dateTime)),
      currency: booking[0]!.currency,
      events: booking[0]!.events,
      meetingPoint: booking[0]!.meetingPoint,
      totalAmount: amount.toString(),
    });

    const [newInvoice] = await db.insert(muthowifInvoices).values({
      number: invoiceNumber,
      muthowifBookingId: id,
      amount: amount.toString(),
      currency: booking[0]!.currency,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      status: 'draft',
      pdfUrl: pdfUrl,
    }).returning();

    return c.json(newInvoice, 201);
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
      totalAmount: paidAmount.toString(),
      balanceDue: balanceDue.toString(),
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

    const pdfUrl = await generateMuthowifVoucherPDF({
      voucherNo: voucherNumber,
      issueDate: new Date().toLocaleDateString('id-ID'),
      client: client[0],
      guestName: booking[0]!.guestName,
      totalPax: booking[0]!.totalPax,
      dateTime: formatIndoDateTime(new Date(booking[0]!.dateTime)),
      currency: booking[0]!.currency,
      events: booking[0]!.events,
      meetingPoint: booking[0]!.meetingPoint,
      totalAmount: booking[0]!.totalAmount,
    });

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

export default muthowifBookingsApp;
