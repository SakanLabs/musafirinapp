import { Hono } from 'hono';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  transportationBookings,
  transportationRoutes as transportationRoutesTable,
  transportationInvoices,
  transportationReceipts,
  transportationVouchers,
  clients
} from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import type {
  NewTransportationBooking,
  NewTransportationRoute,
  NewTransportationInvoice,
  NewTransportationReceipt,
  NewTransportationVoucher
} from '../db/schema';
import { generateTransportationInvoicePDF, generateTransportationReceiptPDF, generateTransportationVoucherPDF, uploadToMinio } from '../utils/pdf';


const transportationApp = new Hono();

// GET /api/transportation - List all transportation bookings
transportationApp.get('/', requireAdmin, async (c) => {
  try {
    const result = await db
      .select({
        id: transportationBookings.id,
        number: transportationBookings.number,
        customerName: transportationBookings.customerName,
        customerPhone: transportationBookings.customerPhone,
        customerEmail: transportationBookings.customerEmail,
        totalAmount: transportationBookings.totalAmount,
        currency: transportationBookings.currency,
        status: transportationBookings.status,
        notes: transportationBookings.notes,
        createdAt: transportationBookings.createdAt,
        updatedAt: transportationBookings.updatedAt,
      })
      .from(transportationBookings)
      .orderBy(desc(transportationBookings.createdAt));

    // Get route count for each booking
    const bookingIds = result.map(booking => booking.id).filter(id => id !== null);

    let routeCountsByBookingId: Record<number, number> = {};
    if (bookingIds.length > 0) {
      const routeCounts = await db
        .select({
          bookingId: transportationRoutesTable.transportationBookingId,
          count: sql`count(*)`.mapWith(Number).as('count')
        })
        .from(transportationRoutesTable)
        .where(sql`${transportationRoutesTable.transportationBookingId} IN(${sql.join(bookingIds, sql`, `)})`)
        .groupBy(transportationRoutesTable.transportationBookingId);

      routeCountsByBookingId = routeCounts.reduce((acc, item) => {
        if (item.bookingId) {
          acc[item.bookingId] = Number(item.count);
        }
        return acc;
      }, {} as Record<number, number>);
    }

    const bookingsWithRouteCount = result.map(booking => ({
      ...booking,
      routeCount: booking.id ? routeCountsByBookingId[booking.id] || 0 : 0
    }));

    return c.json(bookingsWithRouteCount);
  } catch (error) {
    console.error('Error fetching transportation bookings:', error);
    return c.json({ error: 'Failed to fetch transportation bookings' }, 500);
  }
});

// GET /api/transportation/:id - Get specific transportation booking
transportationApp.get('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const booking = await db
      .select()
      .from(transportationBookings)
      .where(eq(transportationBookings.id, id))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    // Get routes for this booking
    const routes = await db
      .select()
      .from(transportationRoutesTable)
      .where(eq(transportationRoutesTable.transportationBookingId, id))
      .orderBy(transportationRoutesTable.pickupDateTime);

    return c.json({
      ...booking[0],
      routes
    });
  } catch (error) {
    console.error('Error fetching transportation booking:', error);
    return c.json({ error: 'Failed to fetch transportation booking' }, 500);
  }
});

// POST /api/transportation - Create new transportation booking
transportationApp.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { routes: routesData, ...bookingData } = body;

    // Generate booking number
    const bookingNumber = `TB - ${new Date().getFullYear()} -${String(Date.now()).slice(-6)} `;

    const result = await db.transaction(async (tx) => {
      // Find or create client
      let clientRecord: any;
      const emailToUse = bookingData.customerEmail || `no - email - ${Date.now()} @musafirin.com`;

      const existingClient = await tx
        .select()
        .from(clients)
        .where(eq(clients.email, emailToUse))
        .limit(1);

      if (existingClient.length > 0) {
        clientRecord = existingClient[0];
        // Update client info if provided
        if (bookingData.customerName !== clientRecord.name || bookingData.customerPhone !== clientRecord.phone) {
          await tx
            .update(clients)
            .set({
              name: bookingData.customerName,
              phone: bookingData.customerPhone || clientRecord.phone,
            })
            .where(eq(clients.id, clientRecord.id));
        }
      } else {
        const [insertedClient] = await tx
          .insert(clients)
          .values({
            name: bookingData.customerName,
            email: emailToUse,
            phone: bookingData.customerPhone || null,
          })
          .returning();
        clientRecord = insertedClient!;
      }

      // Create transportation booking
      const newBooking: NewTransportationBooking = {
        number: bookingNumber,
        clientId: clientRecord.id,
        customerName: bookingData.customerName,
        customerPhone: bookingData.customerPhone,
        customerEmail: bookingData.customerEmail || null,
        totalAmount: bookingData.totalAmount.toString(),
        currency: bookingData.currency || 'SAR',
        status: bookingData.status || 'pending',
        notes: bookingData.notes || null,
      };

      const [createdBooking] = await tx
        .insert(transportationBookings)
        .values(newBooking)
        .returning();

      // Create transportation routes
      if (routesData && routesData.length > 0 && createdBooking?.id) {
        const newRoutes: NewTransportationRoute[] = routesData.map((route: any) => ({
          transportationBookingId: createdBooking.id!,
          pickupDateTime: new Date(`${route.pickupDate}T${route.pickupTime} `),
          originLocation: route.origin,
          destinationLocation: route.destination,
          vehicleType: route.vehicleType,
          price: route.price.toString(),
          notes: route.notes || null,
        }));

        await tx.insert(transportationRoutesTable).values(newRoutes);
      }

      return createdBooking;
    });

    return c.json(result, 201);
  } catch (error) {
    console.error('Error creating transportation booking:', error);
    return c.json({ error: 'Failed to create transportation booking' }, 500);
  }
});

// PUT /api/transportation/:id - Update transportation booking
transportationApp.put('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { routes: routesData, ...bookingData } = body;

    // Update transportation booking
    const updatedBooking = await db
      .update(transportationBookings)
      .set({
        customerName: bookingData.customerName,
        customerPhone: bookingData.customerPhone,
        customerEmail: bookingData.customerEmail || null,
        totalAmount: bookingData.totalAmount.toString(),
        currency: bookingData.currency || 'SAR',
        status: bookingData.status,
        notes: bookingData.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(transportationBookings.id, id))
      .returning();

    if (updatedBooking.length === 0) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    // Update routes - delete existing and create new ones
    if (routesData) {
      await db.delete(transportationRoutesTable).where(eq(transportationRoutesTable.transportationBookingId, id));

      if (routesData.length > 0) {
        const newRoutes: NewTransportationRoute[] = routesData.map((route: any) => ({
          transportationBookingId: id,
          pickupDateTime: new Date(`${route.pickupDate}T${route.pickupTime} `),
          originLocation: route.origin,
          destinationLocation: route.destination,
          vehicleType: route.vehicleType,
          price: route.price.toString(),
          notes: route.notes || null,
        }));

        await db.insert(transportationRoutesTable).values(newRoutes);
      }
    }

    return c.json(updatedBooking[0]);
  } catch (error) {
    console.error('Error updating transportation booking:', error);
    return c.json({ error: 'Failed to update transportation booking' }, 500);
  }
});

// DELETE /api/transportation/:id - Delete transportation booking
transportationApp.delete('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    // Delete routes first (foreign key constraint)
    await db.delete(transportationRoutesTable).where(eq(transportationRoutesTable.transportationBookingId, id));

    // Delete invoices and receipts
    await db.delete(transportationInvoices).where(eq(transportationInvoices.transportationBookingId, id));
    await db.delete(transportationReceipts).where(eq(transportationReceipts.transportationBookingId, id));

    // Delete booking
    const deletedBooking = await db
      .delete(transportationBookings)
      .where(eq(transportationBookings.id, id))
      .returning();

    if (deletedBooking.length === 0) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    return c.json({ message: 'Transportation booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting transportation booking:', error);
    return c.json({ error: 'Failed to delete transportation booking' }, 500);
  }
});

// GET /api/transportation/:id/invoice - Get existing invoice for transportation booking
transportationApp.get('/:id/invoice', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    if (!id || isNaN(id)) {
      return c.json({ error: 'Invalid transportation booking ID' }, 400);
    }

    const existingInvoice = await db
      .select()
      .from(transportationInvoices)
      .where(eq(transportationInvoices.transportationBookingId, id))
      .limit(1);

    if (existingInvoice.length === 0) {
      return c.json({ error: 'No invoice found for this transportation booking' }, 404);
    }

    return c.json({ success: true, data: existingInvoice[0]! });
  } catch (error) {
    console.error('Error retrieving transportation invoice:', error);
    return c.json({ error: 'Failed to retrieve transportation invoice' }, 500);
  }
});

// POST /api/transportation/:id/invoice - Generate invoice
transportationApp.post('/:id/invoice', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const booking = await db
      .select({
        booking: transportationBookings,
        client: clients,
      })
      .from(transportationBookings)
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
      .where(eq(transportationBookings.id, id))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    const bookingData = booking[0]?.booking;
    const clientData = booking[0]?.client;
    if (!bookingData || !clientData) {
      return c.json({ error: 'Transportation booking or client data not found' }, 404);
    }

    const routes = await db
      .select()
      .from(transportationRoutesTable)
      .where(eq(transportationRoutesTable.transportationBookingId, id));

    const body = await c.req.json().catch(() => ({}));

    // Check if invoice already exists for this booking
    const existingInvoice = await db
      .select()
      .from(transportationInvoices)
      .where(eq(transportationInvoices.transportationBookingId, id))
      .limit(1);

    // If forceRegenerate or an existing invoice is found, delete the existing one first
    if (existingInvoice.length > 0 && existingInvoice[0]) {
      await db
        .delete(transportationInvoices)
        .where(eq(transportationInvoices.id, existingInvoice[0].id));
      console.log(`Replacing existing invoice for transportation booking ${id}, deleted invoice ${existingInvoice[0].number} `);
    }

    const customInvoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : new Date();
    const customDueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Generate invoice number
    const invoiceNumber = `TI - ${new Date().getFullYear()} -${String(Date.now()).slice(-6)} `;

    const newInvoice: NewTransportationInvoice = {
      transportationBookingId: id,
      number: invoiceNumber,
      amount: bookingData.totalAmount || '0',
      currency: bookingData.currency || 'SAR',
      issueDate: customInvoiceDate,
      dueDate: customDueDate,
      status: 'draft',
      pdfUrl: '', // To be filled after upload
    };

    // Generate PDF
    const pdfBuffer = await generateTransportationInvoicePDF(
      newInvoice,
      bookingData,
      clientData,
      routes
    );

    // Upload to MinIO
    const pdfUrl = await uploadToMinio(
      `transportation - invoices / ${invoiceNumber}.pdf`,
      pdfBuffer,
      'application/pdf'
    );

    newInvoice.pdfUrl = pdfUrl;

    const [createdInvoice] = await db
      .insert(transportationInvoices)
      .values(newInvoice)
      .returning();

    return c.json(createdInvoice, 201);
  } catch (error) {
    console.error('Error creating transportation invoice:', error);
    return c.json({ error: 'Failed to create transportation invoice' }, 500);
  }
});

// POST /api/transportation/:id/receipt - Generate receipt
transportationApp.post('/:id/receipt', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const booking = await db
      .select({
        booking: transportationBookings,
        client: clients,
      })
      .from(transportationBookings)
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
      .where(eq(transportationBookings.id, id))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    const bookingData = booking[0]?.booking;
    const clientData = booking[0]?.client;
    if (!bookingData || !clientData) {
      return c.json({ error: 'Transportation booking or client data not found' }, 404);
    }

    const routes = await db
      .select()
      .from(transportationRoutesTable)
      .where(eq(transportationRoutesTable.transportationBookingId, id));

    // Check if receipt already exists for this booking
    const existingReceipt = await db
      .select()
      .from(transportationReceipts)
      .where(eq(transportationReceipts.transportationBookingId, id))
      .limit(1);

    // If an existing receipt is found, delete the existing one first
    if (existingReceipt.length > 0 && existingReceipt[0]) {
      await db
        .delete(transportationReceipts)
        .where(eq(transportationReceipts.id, existingReceipt[0].id));
      console.log(`Replacing existing receipt for transportation booking ${id}, deleted receipt ${existingReceipt[0].number} `);
    }

    // Fetch invoice for this booking
    const invoiceQuery = await db
      .select()
      .from(transportationInvoices)
      .where(eq(transportationInvoices.transportationBookingId, id))
      .limit(1);

    const invoiceData = invoiceQuery.length > 0 ? invoiceQuery[0] : null;

    // Generate receipt number
    const receiptNumber = `TR - ${new Date().getFullYear()} -${String(Date.now()).slice(-6)} `;

    const newReceipt: NewTransportationReceipt = {
      transportationBookingId: id,
      number: receiptNumber,
      totalAmount: bookingData.totalAmount || '0',
      paidAmount: bookingData.totalAmount || '0',
      balanceDue: '0',
      currency: bookingData.currency || 'SAR',
      payerName: bookingData.customerName || 'Unknown',
      pdfUrl: '', // To be filled after upload
    };

    // Generate PDF
    const pdfBuffer = await generateTransportationReceiptPDF(
      newReceipt,
      bookingData,
      clientData,
      routes,
      invoiceData
    );

    // Upload to MinIO
    const pdfUrl = await uploadToMinio(
      `transportation - receipts / ${receiptNumber}.pdf`,
      pdfBuffer,
      'application/pdf'
    );

    newReceipt.pdfUrl = pdfUrl;

    const [createdReceipt] = await db
      .insert(transportationReceipts)
      .values(newReceipt)
      .returning();

    return c.json(createdReceipt, 201);
  } catch (error) {
    console.error('Error creating transportation receipt:', error);
    return c.json({ error: 'Failed to create transportation receipt' }, 500);
  }
});

// GET /api/transportation/receipt/:number - Serve receipt PDF
transportationApp.get('/receipt/:number', requireAdmin, async (c) => {
  try {
    const receiptNumber = c.req.param('number');

    if (!receiptNumber) {
      return c.json({ error: 'Receipt number is required' }, 400);
    }

    const receipt = await db
      .select()
      .from(transportationReceipts)
      .where(eq(transportationReceipts.number, receiptNumber))
      .limit(1);

    if (receipt.length === 0) {
      return c.json({ error: 'Receipt not found' }, 404);
    }

    const receiptData = receipt[0]!;

    if (!receiptData.pdfUrl) {
      return c.json({ error: 'PDF not available for this receipt' }, 404);
    }

    return c.redirect(receiptData.pdfUrl);
  } catch (error) {
    console.error('Error serving receipt PDF:', error);
    return c.json({ error: 'Failed to serve receipt PDF' }, 500);
  }
});

// POST /api/transportation/:id/voucher - Generate voucher
transportationApp.post('/:id/voucher', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const booking = await db
      .select({
        booking: transportationBookings,
        client: clients,
      })
      .from(transportationBookings)
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
      .where(eq(transportationBookings.id, id))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    const bookingData = booking[0]?.booking;
    const clientData = booking[0]?.client;
    if (!bookingData || !clientData) {
      return c.json({ error: 'Transportation booking or client data not found' }, 404);
    }

    const routes = await db
      .select()
      .from(transportationRoutesTable)
      .where(eq(transportationRoutesTable.transportationBookingId, id));

    // Check if voucher already exists for this booking
    const existingVoucher = await db
      .select()
      .from(transportationVouchers)
      .where(eq(transportationVouchers.transportationBookingId, id))
      .limit(1);

    // If an existing voucher is found, delete the existing one first
    if (existingVoucher.length > 0 && existingVoucher[0]) {
      await db
        .delete(transportationVouchers)
        .where(eq(transportationVouchers.id, existingVoucher[0].id));
      console.log(`Replacing existing voucher for transportation booking ${id}, deleted voucher ${existingVoucher[0].number} `);
    }

    // Generate voucher number
    const voucherNumber = `TV - ${new Date().getFullYear()} -${String(Date.now()).slice(-6)} `;

    const newVoucher: NewTransportationVoucher = {
      transportationBookingId: id,
      number: voucherNumber,
      pdfUrl: '', // To be filled after upload
    };

    // Generate PDF
    const pdfBuffer = await generateTransportationVoucherPDF(
      newVoucher,
      bookingData,
      clientData,
      routes
    );

    // Upload to MinIO
    const pdfUrl = await uploadToMinio(
      `transportation - vouchers / ${voucherNumber}.pdf`,
      pdfBuffer,
      'application/pdf'
    );

    newVoucher.pdfUrl = pdfUrl;

    const [createdVoucher] = await db
      .insert(transportationVouchers)
      .values(newVoucher)
      .returning();

    return c.json(createdVoucher, 201);
  } catch (error) {
    console.error('Error creating transportation voucher:', error);
    return c.json({ error: 'Failed to create transportation voucher' }, 500);
  }
});

// GET /api/transportation/voucher/:number - Serve voucher PDF
transportationApp.get('/voucher/:number', requireAdmin, async (c) => {
  try {
    const voucherNumber = c.req.param('number');

    if (!voucherNumber) {
      return c.json({ error: 'Voucher number is required' }, 400);
    }

    const voucher = await db
      .select()
      .from(transportationVouchers)
      .where(eq(transportationVouchers.number, voucherNumber))
      .limit(1);

    if (voucher.length === 0) {
      return c.json({ error: 'Voucher not found' }, 404);
    }

    const voucherData = voucher[0]!;

    if (!voucherData.pdfUrl) {
      return c.json({ error: 'PDF not available for this voucher' }, 404);
    }

    return c.redirect(voucherData.pdfUrl);
  } catch (error) {
    console.error('Error serving voucher PDF:', error);
    return c.json({ error: 'Failed to serve voucher PDF' }, 500);
  }
});

export default transportationApp;