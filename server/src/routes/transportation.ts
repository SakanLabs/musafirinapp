import { Hono } from 'hono';
import { and, eq, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  transportationBookings,
  transportationRoutes as transportationRoutesTable,
  transportationInvoices,
  transportationReceipts,
  transportationVouchers,
  transportationInvoicePayments,
  clients,
  clientDeposits,
  depositTransactions
} from '../db/schema';
import { requireAdmin, requireAdminOrFinance, requireFinance } from '../middleware/auth';
import type {
  NewTransportationBooking,
  NewTransportationRoute,
  NewTransportationInvoice,
  NewTransportationReceipt,
  NewTransportationVoucher
} from '../db/schema';
import { generateTransportationInvoicePDF, generateTransportationReceiptPDF, generateTransportationVoucherPDF, uploadToMinio } from '../utils/pdf';
import { notificationService } from '../services/NotificationService';
import { parseOperationalDateTime } from '../lib/date';

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

    // Get routes and invoices for each booking
    const bookingIds = result.map(booking => booking.id).filter(id => id !== null);

    let routesByBookingId: Record<number, any[]> = {};
    let invoicesByBookingId: Record<number, any> = {};

    if (bookingIds.length > 0) {
      const allRoutes = await db
        .select()
        .from(transportationRoutesTable)
        .where(sql`${transportationRoutesTable.transportationBookingId} IN(${sql.join(bookingIds, sql`, `)})`)
        .orderBy(transportationRoutesTable.pickupDateTime);

      routesByBookingId = allRoutes.reduce((acc, item) => {
        const bId = item.transportationBookingId;
        if (bId !== null && bId !== undefined) {
          if (!acc[bId]) {
            acc[bId] = [];
          }
          acc[bId]!.push(item);
        }
        return acc;
      }, {} as Record<number, any[]>);

      const allInvoices = await db
        .select()
        .from(transportationInvoices)
        .where(sql`${transportationInvoices.transportationBookingId} IN(${sql.join(bookingIds, sql`, `)})`);

      invoicesByBookingId = allInvoices.reduce((acc, item) => {
        const bId = item.transportationBookingId;
        if (bId !== null && bId !== undefined) {
          acc[bId] = item;
        }
        return acc;
      }, {} as Record<number, any>);
    }

    const bookingsWithRoutes = result.map(booking => {
      const routes = booking.id ? routesByBookingId[booking.id] || [] : [];
      const invoice = booking.id ? invoicesByBookingId[booking.id] || null : null;
      const totalAmount = invoice ? parseFloat(invoice.amount) : parseFloat(booking.totalAmount || '0');
      const paidAmount = invoice ? parseFloat(invoice.paidAmount || '0') : 0;
      const remainingBalance = Math.max(0, totalAmount - paidAmount);
      const isPaid = paidAmount >= totalAmount && totalAmount > 0;
      const paymentStatus = isPaid ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

      return {
        ...booking,
        routes,
        routeCount: routes.length,
        invoice,
        paidAmount,
        remainingBalance,
        paymentStatus,
      };
    });

    return c.json(bookingsWithRoutes);
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

    // Get invoice for this booking
    const invRows = await db
      .select()
      .from(transportationInvoices)
      .where(eq(transportationInvoices.transportationBookingId, id))
      .limit(1);

    const invoice = invRows.length > 0 ? invRows[0] : null;
    const totalAmount = invoice ? parseFloat(invoice.amount) : parseFloat(booking[0]?.totalAmount || '0');
    const paidAmount = invoice ? parseFloat(invoice.paidAmount || '0') : 0;
    const remainingBalance = Math.max(0, totalAmount - paidAmount);
    const paymentStatus = (paidAmount >= totalAmount && totalAmount > 0) ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    return c.json({
      ...booking[0],
      routes,
      invoice,
      paidAmount,
      remainingBalance,
      paymentStatus,
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
    const bookingNumber = `TB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const result = await db.transaction(async (tx) => {
      // Find or create client
      let clientRecord: any;
      const emailToUse = bookingData.customerEmail?.trim() || `no-email-${Date.now()}@musafirin.com`;

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
        const newRoutes: NewTransportationRoute[] = routesData.map((route: any) => {
          // Operators enter pickup times in Saudi (Asia/Riyadh) wall-clock time
          const pickupDateTime = parseOperationalDateTime(route.pickupDate, route.pickupTime) ?? new Date();

          return {
            transportationBookingId: createdBooking.id!,
            pickupDateTime,
            originLocation: route.origin,
            destinationLocation: route.destination,
            vehicleType: route.vehicleType,
            price: (route.price || 0).toString(),
            currency: route.currency || bookingData.currency || 'SAR',
            notes: route.notes || null,
          };
        });

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
        // Only change status when explicitly sent, so editing details never resets it
        ...(bookingData.status && { status: bookingData.status }),
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
      // Routes are recreated below; keep driver/vehicle assignments of routes that still exist
      const previousRoutes = await db.select().from(transportationRoutesTable).where(eq(transportationRoutesTable.transportationBookingId, id));
      const previousById = new Map(previousRoutes.map((r) => [r.id, r]));

      await db.delete(transportationRoutesTable).where(eq(transportationRoutesTable.transportationBookingId, id));

      if (routesData.length > 0) {
        const newRoutes: NewTransportationRoute[] = routesData.map((route: any) => {
          // Operators enter pickup times in Saudi (Asia/Riyadh) wall-clock time
          const pickupDateTime = parseOperationalDateTime(route.pickupDate, route.pickupTime) ?? new Date();

          return {
            transportationBookingId: id,
            pickupDateTime,
            originLocation: route.origin,
            destinationLocation: route.destination,
            vehicleType: route.vehicleType,
            price: (route.price || 0).toString(),
            currency: route.currency || bookingData.currency || 'SAR',
            notes: route.notes || null,
            driverName: route.driverName ?? previousById.get(Number(route.id))?.driverName ?? null,
            driverPhone: route.driverPhone ?? previousById.get(Number(route.id))?.driverPhone ?? null,
            vehiclePlateNumber: route.vehiclePlateNumber ?? previousById.get(Number(route.id))?.vehiclePlateNumber ?? null,
          };
        });

        await db.insert(transportationRoutesTable).values(newRoutes);
      }
    }

    return c.json(updatedBooking[0]);
  } catch (error) {
    console.error('Error updating transportation booking:', error);
    return c.json({ error: 'Failed to update transportation booking' }, 500);
  }
});

// PATCH /api/transportation/:id/operations - Update booking status and driver/vehicle per route
// (operational fields only; prices and schedule stay untouched)
transportationApp.patch('/:id/operations', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid transportation booking ID' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const { status, routes: routeUpdates } = body as {
      status?: string;
      routes?: { id: number; driverName?: string | null; driverPhone?: string | null; vehiclePlateNumber?: string | null }[];
    };

    const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return c.json({ error: 'Status tidak valid' }, 400);
    }

    const [booking] = await db.select().from(transportationBookings).where(eq(transportationBookings.id, id)).limit(1);
    if (!booking) return c.json({ error: 'Transportation booking not found' }, 404);

    const clean = (value: string | null | undefined) => (typeof value === 'string' && value.trim() ? value.trim() : null);

    await db.transaction(async (tx) => {
      if (status) {
        await tx
          .update(transportationBookings)
          .set({ status: status as typeof booking.status, updatedAt: new Date() })
          .where(eq(transportationBookings.id, id));
      }

      for (const route of Array.isArray(routeUpdates) ? routeUpdates : []) {
        await tx
          .update(transportationRoutesTable)
          .set({
            driverName: clean(route.driverName),
            driverPhone: clean(route.driverPhone),
            vehiclePlateNumber: clean(route.vehiclePlateNumber),
            updatedAt: new Date(),
          })
          // Scoped to this booking so a route id from another booking can't be modified
          .where(and(eq(transportationRoutesTable.id, route.id), eq(transportationRoutesTable.transportationBookingId, id)));
      }
    });

    const [updated] = await db.select().from(transportationBookings).where(eq(transportationBookings.id, id)).limit(1);
    const routes = await db
      .select()
      .from(transportationRoutesTable)
      .where(eq(transportationRoutesTable.transportationBookingId, id))
      .orderBy(transportationRoutesTable.pickupDateTime);

    return c.json({ success: true, data: { ...updated!, routes } });
  } catch (error) {
    console.error('Error updating transportation operations:', error);
    return c.json({ error: 'Gagal memperbarui data operasional' }, 500);
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
transportationApp.get('/:id/invoice', requireAdminOrFinance, async (c) => {
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

// GET /api/transportation/invoice/:number - Serve transportation invoice PDF
transportationApp.get('/invoice/:number', requireAdminOrFinance, async (c) => {
  try {
    const invoiceNumber = c.req.param('number');

    if (!invoiceNumber) {
      return c.json({ error: 'Invoice number is required' }, 400);
    }

    const invoice = await db
      .select({
        invoice: transportationInvoices,
        booking: transportationBookings,
        client: clients,
      })
      .from(transportationInvoices)
      .leftJoin(transportationBookings, eq(transportationInvoices.transportationBookingId, transportationBookings.id))
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
      .where(eq(transportationInvoices.number, invoiceNumber))
      .limit(1);

    if (invoice.length === 0 || !invoice[0]) {
      return c.json({ error: 'Transportation invoice not found' }, 404);
    }

    const { invoice: invoiceData, booking: bookingData, client: clientData } = invoice[0];

    const { getFileStreamFromMinio, fileExistsInMinio, generateTransportationInvoicePDF, uploadToMinio } = await import('../utils/pdf');

    let pdfBuffer: Buffer | null = null;
    const fileName = `transportation-invoices/${invoiceNumber}.pdf`;

    if (await fileExistsInMinio(fileName)) {
      try {
        const fileStream = await getFileStreamFromMinio(fileName);
        const chunks: Buffer[] = [];
        for await (const chunk of fileStream) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        pdfBuffer = Buffer.concat(chunks);
      } catch (streamErr) {
        console.warn('Failed to stream from MinIO, will regenerate PDF:', streamErr);
      }
    }

    if (!pdfBuffer && bookingData && clientData) {
      const routes = await db
        .select()
        .from(transportationRoutesTable)
        .where(eq(transportationRoutesTable.transportationBookingId, invoiceData.transportationBookingId));

      pdfBuffer = await generateTransportationInvoicePDF(
        invoiceData,
        bookingData,
        clientData,
        routes
      );

      try {
        const pdfUrl = await uploadToMinio(fileName, pdfBuffer, 'application/pdf');
        await db.update(transportationInvoices).set({ pdfUrl }).where(eq(transportationInvoices.id, invoiceData.id));
      } catch (uploadErr) {
        console.warn('Failed to upload regenerated PDF to MinIO:', uploadErr);
      }
    }

    if (!pdfBuffer) {
      return c.json({ error: 'PDF not available for this invoice' }, 404);
    }

    const isView = c.req.query('view') === 'true';
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `${isView ? 'inline' : 'attachment'}; filename="${invoiceNumber}.pdf"`);
    c.header('Content-Length', pdfBuffer.length.toString());

    return c.body(pdfBuffer as any);
  } catch (error) {
    console.error('Error serving transportation invoice PDF:', error);
    return c.json({ error: 'Failed to serve transportation invoice PDF' }, 500);
  }
});

// POST /api/transportation/:id/invoice - Generate invoice
transportationApp.post('/:id/invoice', requireAdminOrFinance, async (c) => {
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
    const invoiceNumber = `TI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const newInvoice: NewTransportationInvoice = {
      transportationBookingId: id,
      number: invoiceNumber,
      amount: bookingData.totalAmount || '0',
      currency: bookingData.currency || 'SAR',
      issueDate: customInvoiceDate,
      dueDate: customDueDate,
      status: 'draft',
      pdfUrl: null as any, // Initially null
    };

    const [createdInvoice] = await db
      .insert(transportationInvoices)
      .values(newInvoice)
      .returning();

    // Now try to generate PDF
    try {
      // Generate PDF
      const pdfBuffer = await generateTransportationInvoicePDF(
        newInvoice,
        bookingData,
        clientData,
        routes
      );

      // Upload to MinIO
      const pdfUrl = await uploadToMinio(
        `transportation-invoices/${invoiceNumber}.pdf`,
        pdfBuffer,
        'application/pdf'
      );

      createdInvoice!.pdfUrl = pdfUrl;
      await db.update(transportationInvoices).set({ pdfUrl }).where(eq(transportationInvoices.id, createdInvoice!.id));
    } catch (pdfError) {
      console.error('Failed to generate/upload PDF, but invoice was created in DB:', pdfError);
    }

    // Optional client invoice notification
    const invoiceChannels: ('email' | 'whatsapp')[] = [];
    if (body.sendEmail) invoiceChannels.push('email');
    if (body.sendWhatsApp) invoiceChannels.push('whatsapp');

    if (invoiceChannels.length > 0) {
      notificationService.sendInvoice({
        clientId: bookingData.clientId || undefined,
        invoiceNumber,
        recipientName: clientData?.name || bookingData.customerName || 'Pelanggan Musafirin',
        recipientEmail: clientData?.email || undefined,
        recipientPhone: clientData?.phone || bookingData.customerPhone || undefined,
        totalAmount: bookingData.totalAmount || '0',
        currency: bookingData.currency || 'SAR',
        dueDate: customDueDate,
        issueDate: customInvoiceDate,
        channels: invoiceChannels,
      }).catch((err) => console.error('[NotificationService] Error sending transportation invoice notification:', err));
    }

    return c.json(createdInvoice, 201);
  } catch (error) {
    console.error('Error creating transportation invoice:', error);
    return c.json({ error: 'Failed to create transportation invoice' }, 500);
  }
});

// POST /api/transportation/:id/receipt - Generate receipt and handle payment
transportationApp.post('/:id/receipt', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));

    // For payments, body should contain: amount, method, referenceNumber, description

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

    // Parse the requested payment amount
    let paymentAmount = Number(bookingData.totalAmount || 0);
    if (body.amount) {
      paymentAmount = Number(body.amount);
    }
    
    // Update invoice status if an invoice exists
    let invoiceId = null;
    if (invoiceData) {
      invoiceId = invoiceData.id;
      
      const newPaidAmount = Number(invoiceData.paidAmount || 0) + paymentAmount;
      const totalAmount = Number(invoiceData.amount || 0);
      
      let newStatus: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' = invoiceData.status;
      if (newPaidAmount >= totalAmount) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partially_paid';
      }
      
      await db.update(transportationInvoices)
        .set({
          paidAmount: newPaidAmount.toString(),
          status: newStatus,
          updatedAt: new Date()
        })
        .where(eq(transportationInvoices.id, invoiceData.id));
        
      // Record the payment
      await db.insert(transportationInvoicePayments).values({
        invoiceId: invoiceData.id,
        amount: paymentAmount.toString(),
        currency: 'SAR',
        method: body.method || 'cash',
        referenceNumber: body.referenceNumber || null,
        paidAt: new Date(),
        status: 'completed',
        meta: body.description ? { description: body.description } : null
      });
    }

    // Generate receipt number
    const receiptNumber = `TR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Total should be from invoice if exists, else order
    const totalDue = invoiceData ? Number(invoiceData.amount) : Number(bookingData.totalAmount || 0);
    const prevPaid = invoiceData ? Number(invoiceData.paidAmount || 0) : 0;
    // For this specific receipt, it prints the current payment amount
    const balanceDue = Math.max(0, totalDue - (prevPaid + paymentAmount));

    const existingReceipts = await db
      .select()
      .from(transportationReceipts)
      .where(eq(transportationReceipts.transportationBookingId, id));
    const terminNumber = existingReceipts.length + 1;
    const isPaidFull = balanceDue <= 0;
    let terminLabel = `Termin #${terminNumber}`;
    if (isPaidFull && terminNumber === 1) {
      terminLabel = 'Pelunasan (Lunas Penuh)';
    } else if (isPaidFull) {
      terminLabel = `Termin #${terminNumber} (Pelunasan)`;
    } else if (terminNumber === 1) {
      terminLabel = 'Termin #1 (Uang Muka / DP)';
    }

    const newReceipt: any = {
      transportationBookingId: id,
      number: receiptNumber,
      totalAmount: totalDue.toString(),
      paidAmount: paymentAmount.toString(), // The receipt reflects THIS payment
      balanceDue: balanceDue.toString(),
      currency: bookingData.currency || 'SAR',
      payerName: bookingData.customerName || 'Unknown',
      pdfUrl: '', // To be filled after upload
      meta: {
        termin: terminNumber,
        terminLabel,
      },
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
      `transportation-receipts/${receiptNumber}.pdf`,
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
transportationApp.get('/receipt/:number', requireAdminOrFinance, async (c) => {
  try {
    const receiptNumber = c.req.param('number');

    if (!receiptNumber) {
      return c.json({ error: 'Receipt number is required' }, 400);
    }

    const receipt = await db
      .select({
        receipt: transportationReceipts,
        booking: transportationBookings,
        client: clients,
      })
      .from(transportationReceipts)
      .leftJoin(transportationBookings, eq(transportationReceipts.transportationBookingId, transportationBookings.id))
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
      .where(eq(transportationReceipts.number, receiptNumber))
      .limit(1);

    if (receipt.length === 0 || !receipt[0]) {
      return c.json({ error: 'Receipt not found' }, 404);
    }

    const { receipt: receiptData, booking: bookingData, client: clientData } = receipt[0];

    const { getFileStreamFromMinio, fileExistsInMinio, generateTransportationReceiptPDF, uploadToMinio } = await import('../utils/pdf');

    let pdfBuffer: Buffer | null = null;
    const fileName = `transportation-receipts/${receiptNumber}.pdf`;

    if (await fileExistsInMinio(fileName)) {
      try {
        const fileStream = await getFileStreamFromMinio(fileName);
        const chunks: Buffer[] = [];
        for await (const chunk of fileStream) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        pdfBuffer = Buffer.concat(chunks);
      } catch (streamErr) {
        console.warn('Failed to stream receipt from MinIO, will regenerate PDF:', streamErr);
      }
    }

    if (!pdfBuffer && bookingData && clientData) {
      const routes = await db
        .select()
        .from(transportationRoutesTable)
        .where(eq(transportationRoutesTable.transportationBookingId, receiptData.transportationBookingId));

      const invoice = await db
        .select()
        .from(transportationInvoices)
        .where(eq(transportationInvoices.transportationBookingId, receiptData.transportationBookingId))
        .limit(1);

      pdfBuffer = await generateTransportationReceiptPDF(
        receiptData,
        bookingData,
        clientData,
        routes,
        invoice[0] || null
      );

      try {
        const pdfUrl = await uploadToMinio(fileName, pdfBuffer, 'application/pdf');
        await db.update(transportationReceipts).set({ pdfUrl }).where(eq(transportationReceipts.id, receiptData.id));
      } catch (uploadErr) {
        console.warn('Failed to upload regenerated receipt PDF to MinIO:', uploadErr);
      }
    }

    if (!pdfBuffer) {
      return c.json({ error: 'PDF not available for this receipt' }, 404);
    }

    const isView = c.req.query('view') === 'true';
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `${isView ? 'inline' : 'attachment'}; filename="${receiptNumber}.pdf"`);
    c.header('Content-Length', pdfBuffer.length.toString());

    return c.body(pdfBuffer as any);
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
    const voucherNumber = `TV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

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
      `transportation-vouchers/${voucherNumber}.pdf`,
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
      .select({
        voucher: transportationVouchers,
        booking: transportationBookings,
        client: clients,
      })
      .from(transportationVouchers)
      .leftJoin(transportationBookings, eq(transportationVouchers.transportationBookingId, transportationBookings.id))
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
      .where(eq(transportationVouchers.number, voucherNumber))
      .limit(1);

    if (voucher.length === 0 || !voucher[0]) {
      return c.json({ error: 'Voucher not found' }, 404);
    }

    const { voucher: voucherData, booking: bookingData, client: clientData } = voucher[0];

    const { getFileStreamFromMinio, fileExistsInMinio, generateTransportationVoucherPDF, uploadToMinio } = await import('../utils/pdf');

    let pdfBuffer: Buffer | null = null;
    const fileName = `transportation-vouchers/${voucherNumber}.pdf`;

    if (await fileExistsInMinio(fileName)) {
      try {
        const fileStream = await getFileStreamFromMinio(fileName);
        const chunks: Buffer[] = [];
        for await (const chunk of fileStream) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        pdfBuffer = Buffer.concat(chunks);
      } catch (streamErr) {
        console.warn('Failed to stream voucher from MinIO, will regenerate PDF:', streamErr);
      }
    }

    if (!pdfBuffer && bookingData && clientData) {
      const routes = await db
        .select()
        .from(transportationRoutesTable)
        .where(eq(transportationRoutesTable.transportationBookingId, voucherData.transportationBookingId));

      pdfBuffer = await generateTransportationVoucherPDF(
        voucherData,
        bookingData,
        clientData,
        routes
      );

      try {
        const pdfUrl = await uploadToMinio(fileName, pdfBuffer, 'application/pdf');
        await db.update(transportationVouchers).set({ pdfUrl }).where(eq(transportationVouchers.id, voucherData.id));
      } catch (uploadErr) {
        console.warn('Failed to upload regenerated voucher PDF to MinIO:', uploadErr);
      }
    }

    if (!pdfBuffer) {
      return c.json({ error: 'PDF not available for this voucher' }, 404);
    }

    const isView = c.req.query('view') === 'true';
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `${isView ? 'inline' : 'attachment'}; filename="${voucherNumber}.pdf"`);
    c.header('Content-Length', pdfBuffer.length.toString());

    return c.body(pdfBuffer as any);
  } catch (error) {
    console.error('Error serving voucher PDF:', error);
    return c.json({ error: 'Failed to serve voucher PDF' }, 500);
  }
});

// GET /api/transportation/:id/billing - Get full billing, payments, and receipts data
transportationApp.get('/:id/billing', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const bookingRows = await db
      .select({
        booking: transportationBookings,
        client: clients,
      })
      .from(transportationBookings)
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
      .where(eq(transportationBookings.id, id))
      .limit(1);

    if (!bookingRows.length || !bookingRows[0]) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    const { booking, client } = bookingRows[0];

    // Fetch client deposit balance if client exists
    let clientDepositBalance = '0.00';
    if (booking.clientId) {
      const dep = await db
        .select({ currentBalance: clientDeposits.currentBalance })
        .from(clientDeposits)
        .where(eq(clientDeposits.clientId, booking.clientId))
        .limit(1);
      if (dep.length > 0 && dep[0]?.currentBalance) {
        clientDepositBalance = dep[0].currentBalance;
      }
    }

    // Fetch invoice
    const invRows = await db
      .select()
      .from(transportationInvoices)
      .where(eq(transportationInvoices.transportationBookingId, id))
      .limit(1);

    const invoice = invRows.length > 0 ? invRows[0] : null;

    // Fetch receipts
    const receiptsList = await db
      .select()
      .from(transportationReceipts)
      .where(eq(transportationReceipts.transportationBookingId, id))
      .orderBy(desc(transportationReceipts.createdAt));

    // Summary calculations
    const totalAmount = invoice ? parseFloat(invoice.amount) : parseFloat(booking.totalAmount || '0');
    const paidAmount = invoice ? parseFloat(invoice.paidAmount || '0') : 0;
    const remainingBalance = Math.max(0, totalAmount - paidAmount);
    const isOrderPaidFull = paidAmount >= totalAmount && totalAmount > 0;
    const paymentStatus = isOrderPaidFull
      ? 'paid' 
      : paidAmount > 0 
        ? 'partial' 
        : 'unpaid';

    // Fetch payments chronologically
    let payments: any[] = [];
    if (invoice) {
      const rawPayments = await db
        .select()
        .from(transportationInvoicePayments)
        .where(eq(transportationInvoicePayments.invoiceId, invoice.id))
        .orderBy(asc(transportationInvoicePayments.paidAt), asc(transportationInvoicePayments.id));

      const totalPaymentsCount = rawPayments.length;
      payments = rawPayments.map((p, index) => {
        const meta = (p.meta as any) || {};
        const terminNumber = meta.termin || (index + 1);
        const isLastPayment = index === totalPaymentsCount - 1;
        let terminLabel = meta.terminLabel;
        if (!terminLabel) {
          if (isOrderPaidFull && isLastPayment) {
            terminLabel = terminNumber === 1 ? 'Pelunasan (Lunas Penuh)' : `Termin #${terminNumber} (Pelunasan)`;
          } else if (terminNumber === 1) {
            terminLabel = 'Termin #1 (Uang Muka / DP)';
          } else {
            terminLabel = `Termin #${terminNumber}`;
          }
        }

        // Match receipt specifically for this payment
        const matchedReceipt = receiptsList.find(r => {
          const rMeta = (r.meta as any) || {};
          if (rMeta.paymentId && rMeta.paymentId === p.id) return true;
          if (meta.receiptNumber && r.number === meta.receiptNumber) return true;
          if (rMeta.referenceNumber && rMeta.referenceNumber === p.referenceNumber) return true;
          if (rMeta.termin && rMeta.termin === terminNumber) return true;
          return false;
        }) || receiptsList.find(r => parseFloat(r.paidAmount) === parseFloat(p.amount))
          || (receiptsList.length === 1 && totalPaymentsCount === 1 ? receiptsList[0] : null);

        return {
          ...p,
          termin: terminNumber,
          terminLabel,
          receiptNumber: matchedReceipt?.number || meta.receiptNumber || null,
          receiptUrl: matchedReceipt?.pdfUrl || null,
        };
      });

      // Display newest payment on top for user view
      payments.reverse();
    }

    return c.json({
      success: true,
      data: {
        booking,
        client: client ? {
          ...client,
          depositBalance: clientDepositBalance,
        } : null,
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
      }
    });
  } catch (error) {
    console.error('Error fetching transportation billing:', error);
    return c.json({ error: 'Failed to fetch transportation billing' }, 500);
  }
});

// POST /api/transportation/:id/pay - Record payment for transportation booking
transportationApp.post('/:id/pay', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const method = body?.method as 'bank_transfer' | 'deposit' | 'cash' | undefined;
    const amountNum = body?.amount !== undefined ? parseFloat(body.amount) : undefined;
    const referenceNumber: string | undefined = body?.referenceNumber;
    const description: string | undefined = body?.description;
    const autoGenerateReceipt: boolean = body?.autoGenerateReceipt !== false;

    const allowedMethods = ['bank_transfer', 'deposit', 'cash'];
    if (!method || !allowedMethods.includes(method)) {
      return c.json({ error: 'Metode pembayaran tidak valid. Pilih: Transfer Bank, Saldo Deposit, atau Tunai' }, 400);
    }
    if (amountNum === undefined || isNaN(amountNum) || amountNum <= 0) {
      return c.json({ error: 'Nominal pembayaran harus lebih besar dari 0' }, 400);
    }

    const bookingRows = await db
      .select({
        booking: transportationBookings,
        client: clients,
      })
      .from(transportationBookings)
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
      .where(eq(transportationBookings.id, id))
      .limit(1);

    if (!bookingRows.length || !bookingRows[0]) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    const { booking, client } = bookingRows[0];

    // Find or auto-generate invoice
    let invoiceRows = await db
      .select()
      .from(transportationInvoices)
      .where(eq(transportationInvoices.transportationBookingId, id))
      .limit(1);

    let invoice = invoiceRows.length > 0 ? invoiceRows[0] : null;

    if (!invoice) {
      const invoiceNumber = `TI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const issueDate = new Date();
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const [newInv] = await db
        .insert(transportationInvoices)
        .values({
          number: invoiceNumber,
          transportationBookingId: id,
          amount: booking.totalAmount.toString(),
          paidAmount: '0.00',
          currency: booking.currency || 'SAR',
          issueDate,
          dueDate,
          status: 'draft',
          pdfUrl: null as any,
        })
        .returning();
      invoice = newInv!;

      // Background attempt to generate invoice PDF
      try {
        const routes = await db
          .select()
          .from(transportationRoutesTable)
          .where(eq(transportationRoutesTable.transportationBookingId, id));

        const pdfBuf = await generateTransportationInvoicePDF(
          invoice,
          booking,
          client || {},
          routes
        );
        const pdfUrl = await uploadToMinio(`transportation-invoices/${invoiceNumber}.pdf`, pdfBuf, 'application/pdf');
        await db.update(transportationInvoices).set({ pdfUrl }).where(eq(transportationInvoices.id, invoice.id));
        invoice.pdfUrl = pdfUrl;
      } catch (e) {
        console.warn('Auto invoice PDF generation deferred:', e);
      }
    }

    const totalInvoiceAmount = parseFloat(invoice.amount);
    const currentPaidAmount = parseFloat(invoice.paidAmount || '0');
    const remainingBalance = Math.max(0, totalInvoiceAmount - currentPaidAmount);

    if (remainingBalance <= 0) {
      return c.json({ error: 'Booking transportasi ini sudah lunas. Tidak ada sisa tagihan.' }, 400);
    }

    // Process payment within transaction
    const paymentResult = await db.transaction(async (tx) => {
      let depositUsed = 0;

      if (method === 'deposit') {
        if (!booking.clientId) {
          throw new Error('Klien tidak ditemukan untuk pemotongan deposit');
        }

        const depRows = await tx
          .select()
          .from(clientDeposits)
          .where(eq(clientDeposits.clientId, booking.clientId))
          .limit(1);

        const currentDepositBalance = depRows.length > 0 ? parseFloat(depRows[0]!.currentBalance) : 0;
        depositUsed = Math.min(amountNum, remainingBalance);

        if (currentDepositBalance < depositUsed) {
          throw new Error(`Saldo deposit tidak mencukupi. Saldo saat ini: SAR ${currentDepositBalance.toLocaleString()}, diperlukan: SAR ${depositUsed.toLocaleString()}`);
        }

        const newDepositBalance = currentDepositBalance - depositUsed;
        const newTotalUsed = (depRows.length > 0 ? parseFloat(depRows[0]!.totalUsed) : 0) + depositUsed;

        await tx
          .update(clientDeposits)
          .set({
            currentBalance: newDepositBalance.toString(),
            totalUsed: newTotalUsed.toString(),
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clientDeposits.clientId, booking.clientId));

        // Insert deposit transaction
        await tx.insert(depositTransactions).values({
          clientId: booking.clientId,
          type: 'usage',
          amount: depositUsed.toString(),
          balanceBefore: currentDepositBalance.toString(),
          balanceAfter: newDepositBalance.toString(),
          currency: 'SAR',
          status: 'completed',
          description: description || `Pembayaran Booking Transportasi ${booking.number}`,
          referenceNumber: referenceNumber || `DEP-TB-${Date.now()}`,
          processedAt: new Date(),
        });
      }

      const effectivePayAmount = method === 'deposit' ? depositUsed : Math.min(amountNum, remainingBalance);
      const newPaidTotal = currentPaidAmount + effectivePayAmount;
      const newRemaining = Math.max(0, totalInvoiceAmount - newPaidTotal);
      const isPaidFull = newPaidTotal >= totalInvoiceAmount;
      const newInvoiceStatus = isPaidFull ? 'paid' : 'partially_paid';

      const existingPayments = await tx
        .select()
        .from(transportationInvoicePayments)
        .where(eq(transportationInvoicePayments.invoiceId, invoice!.id));
      const terminNumber = existingPayments.length + 1;
      let terminLabel = `Termin #${terminNumber}`;
      if (isPaidFull && terminNumber === 1) {
        terminLabel = 'Pelunasan (Lunas Penuh)';
      } else if (isPaidFull) {
        terminLabel = `Termin #${terminNumber} (Pelunasan)`;
      } else if (terminNumber === 1) {
        terminLabel = 'Termin #1 (Uang Muka / DP)';
      }
      const receiptNumber = `TR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // 1. Record payment in transportationInvoicePayments
      const [paymentRecord] = await tx
        .insert(transportationInvoicePayments)
        .values({
          invoiceId: invoice!.id,
          amount: effectivePayAmount.toString(),
          currency: invoice!.currency || booking.currency || 'SAR',
          method,
          referenceNumber: referenceNumber || (method === 'deposit' ? `DEP-${Date.now()}` : `PAY-${Date.now()}`),
          paidAt: new Date(),
          status: 'completed',
          meta: {
            description: description || null,
            termin: terminNumber,
            terminLabel,
            receiptNumber,
          },
        })
        .returning();

      if (!paymentRecord) {
        throw new Error('Gagal menyimpan transaksi pembayaran');
      }

      // 2. Update transportationInvoices
      await tx
        .update(transportationInvoices)
        .set({
          paidAmount: newPaidTotal.toString(),
          status: newInvoiceStatus,
          updatedAt: new Date(),
        })
        .where(eq(transportationInvoices.id, invoice!.id));

      // 3. Update transportationBookings status if paid full
      if (isPaidFull) {
        await tx
          .update(transportationBookings)
          .set({
            status: 'confirmed',
            updatedAt: new Date(),
          })
          .where(eq(transportationBookings.id, id));
      }

      return {
        payment: paymentRecord,
        newPaidTotal,
        newRemaining,
        isPaidFull,
        effectivePayAmount,
        terminNumber,
        terminLabel,
        receiptNumber,
      };
    });

    // Generate receipt if requested
    let createdReceipt: any = null;
    if (autoGenerateReceipt) {
      try {
        const receiptNumber = paymentResult.receiptNumber;
        const newReceipt: NewTransportationReceipt = {
          transportationBookingId: id,
          transportationInvoiceId: invoice.id,
          number: receiptNumber,
          totalAmount: totalInvoiceAmount.toString(),
          paidAmount: paymentResult.effectivePayAmount.toString(),
          balanceDue: paymentResult.newRemaining.toString(),
          currency: invoice.currency || booking.currency || 'SAR',
          payerName: client?.name || booking.customerName || 'Pelanggan Musafirin',
          payerEmail: client?.email || booking.customerEmail || null,
          payerPhone: client?.phone || booking.customerPhone || null,
          notes: description || null,
          pdfUrl: '',
          meta: {
            paymentId: paymentResult.payment.id,
            termin: paymentResult.terminNumber,
            terminLabel: paymentResult.terminLabel,
            referenceNumber: paymentResult.payment.referenceNumber,
            method,
            description: description || null,
          },
        };

        const routes = await db
          .select()
          .from(transportationRoutesTable)
          .where(eq(transportationRoutesTable.transportationBookingId, id));

        const pdfBuffer = await generateTransportationReceiptPDF(
          newReceipt,
          booking,
          client || {},
          routes,
          invoice
        );

        const pdfUrl = await uploadToMinio(
          `transportation-receipts/${receiptNumber}.pdf`,
          pdfBuffer,
          'application/pdf'
        );

        newReceipt.pdfUrl = pdfUrl;

        const [receiptRow] = await db
          .insert(transportationReceipts)
          .values(newReceipt)
          .returning();

        createdReceipt = receiptRow;
      } catch (receiptErr) {
        console.error('Error auto-generating receipt PDF:', receiptErr);
      }
    }

    // Optional client payment confirmation notification
    const payChannels: ('email' | 'whatsapp')[] = [];
    if (body?.sendEmail) payChannels.push('email');
    if (body?.sendWhatsApp) payChannels.push('whatsapp');

    if (payChannels.length > 0) {
      const recipientName = client?.name || booking.customerName || 'Pelanggan Musafirin';
      const recipientPhone = client?.phone || booking.customerPhone || undefined;
      const recipientEmail = client?.email || undefined;

      notificationService.sendPaymentConfirmation({
        orderCode: booking.number,
        orderTitle: `Pemesanan Transportasi (${booking.number})`,
        paymentId: paymentResult.payment.referenceNumber ?? undefined,
        amount: paymentResult.effectivePayAmount,
        currency: invoice.currency || booking.currency || 'SAR',
        method,
        terminLabel: paymentResult.terminLabel,
        remainingBalance: paymentResult.newRemaining,
        recipientName,
        recipientEmail,
        recipientPhone,
        paymentStatus: paymentResult.isPaidFull ? 'paid' : 'partial',
        channels: payChannels,
      }).catch((err) => console.error('[NotificationService] Error sending transportation payment confirmation:', err));
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
      }
    }, 201);
  } catch (error: any) {
    console.error('Error recording transportation payment:', error);
    return c.json({ error: error.message || 'Gagal mencatat pembayaran' }, 500);
  }
});

// DELETE /api/transportation/:id/payments/:paymentId - Cancel/delete a payment record
transportationApp.delete('/:id/payments/:paymentId', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const paymentId = parseInt(c.req.param('paymentId'));

    if (!id || isNaN(id) || !paymentId || isNaN(paymentId)) {
      return c.json({ error: 'Invalid parameters' }, 400);
    }

    const booking = await db
      .select()
      .from(transportationBookings)
      .where(eq(transportationBookings.id, id))
      .limit(1);

    if (booking.length === 0 || !booking[0]) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    const bookingData = booking[0];

    const invoice = await db
      .select()
      .from(transportationInvoices)
      .where(eq(transportationInvoices.transportationBookingId, id))
      .limit(1);

    if (invoice.length === 0 || !invoice[0]) {
      return c.json({ error: 'Invoice not found for this transportation booking' }, 404);
    }

    const invoiceData = invoice[0];

    // Find the payment record
    const paymentRows = await db
      .select()
      .from(transportationInvoicePayments)
      .where(
        sql`${transportationInvoicePayments.id} = ${paymentId} AND ${transportationInvoicePayments.invoiceId} = ${invoiceData.id}`
      )
      .limit(1);

    if (paymentRows.length === 0 || !paymentRows[0]) {
      return c.json({ error: 'Payment record not found' }, 404);
    }

    const payment = paymentRows[0];
    const amountToRevert = parseFloat(payment.amount);

    await db.transaction(async (tx) => {
      // 1. If method was deposit, refund client deposit balance
      if (payment.method === 'deposit' && bookingData.clientId) {
        const depRows = await tx
          .select()
          .from(clientDeposits)
          .where(eq(clientDeposits.clientId, bookingData.clientId))
          .limit(1);

        if (depRows.length > 0 && depRows[0]) {
          const curBal = parseFloat(depRows[0].currentBalance);
          const curUsed = parseFloat(depRows[0].totalUsed);
          const newBal = curBal + amountToRevert;
          const newUsed = Math.max(0, curUsed - amountToRevert);

          await tx
            .update(clientDeposits)
            .set({
              currentBalance: newBal.toString(),
              totalUsed: newUsed.toString(),
              lastTransactionAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(clientDeposits.clientId, bookingData.clientId));

          // Log refund deposit transaction
          await tx.insert(depositTransactions).values({
            clientId: bookingData.clientId,
            type: 'refund',
            amount: amountToRevert.toString(),
            balanceBefore: curBal.toString(),
            balanceAfter: newBal.toString(),
            currency: 'SAR',
            status: 'completed',
            description: `Pembatalan pembayaran Booking Transportasi ${bookingData.number}`,
            referenceNumber: `REF-TB-${Date.now()}`,
            processedAt: new Date(),
          });
        }
      }

      // 2. Delete the payment
      await tx
        .delete(transportationInvoicePayments)
        .where(eq(transportationInvoicePayments.id, paymentId));

      // Also clean up any receipt generated for this payment
      await tx
        .delete(transportationReceipts)
        .where(
          sql`${transportationReceipts.transportationBookingId} = ${id} AND ${transportationReceipts.meta}->>'paymentId' = ${paymentId.toString()}`
        );

      // 3. Recalculate remaining payments for this invoice
      const remainingPayments = await tx
        .select()
        .from(transportationInvoicePayments)
        .where(eq(transportationInvoicePayments.invoiceId, invoiceData.id));

      const newPaidTotal = remainingPayments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
      const totalInvoiceAmount = parseFloat(invoiceData.amount);
      const isPaidFull = newPaidTotal >= totalInvoiceAmount && totalInvoiceAmount > 0;
      const newInvoiceStatus = isPaidFull 
        ? 'paid' 
        : newPaidTotal > 0 
          ? 'partially_paid' 
          : 'draft';

      await tx
        .update(transportationInvoices)
        .set({
          paidAmount: newPaidTotal.toString(),
          status: newInvoiceStatus,
          updatedAt: new Date(),
        })
        .where(eq(transportationInvoices.id, invoiceData.id));

      // 4. Update transportation booking status
      await tx
        .update(transportationBookings)
        .set({
          status: isPaidFull ? 'confirmed' : 'pending',
          updatedAt: new Date(),
        })
        .where(eq(transportationBookings.id, id));
    });

    return c.json({
      success: true,
      message: 'Pembayaran berhasil dibatalkan/dihapus'
    });
  } catch (error) {
    console.error('Error deleting transportation payment:', error);
    return c.json({ error: 'Failed to delete payment' }, 500);
  }
});

export default transportationApp;