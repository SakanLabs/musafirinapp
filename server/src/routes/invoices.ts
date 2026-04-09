import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { invoices, bookings, clients, bookingItems, bookingItemPricingPeriods, clientDeposits, depositTransactions, bookingServiceItems, invoicePayments, transportationInvoices, transportationBookings, serviceOrderInvoices, serviceOrders } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateInvoiceNumber, generateInvoicePDF, uploadToMinio, checkFileExistsInMinio, deleteFromMinio } from '../utils/pdf';
import { TemplateHelpers } from '../utils/template';
import type { NewInvoice, NewDepositTransaction, NewInvoicePayment } from '../db/schema';
import { ReceiptService } from '../services/ReceiptService';

const invoiceRoutes = new Hono();
const receiptService = new ReceiptService();



// GET /api/invoices/booking/:bookingId - Get or create invoice for booking
invoiceRoutes.get('/booking/:bookingId', requireAdmin, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('bookingId'));
    const dueDateParam = c.req.query('dueDate');
    const forceRegenerate = c.req.query('force') === 'true';

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    // Validate required dueDate
    if (!dueDateParam) {
      return c.json({ error: 'dueDate query parameter is required' }, 400);
    }

    const customDueDate = new Date(dueDateParam);

    // Check if invoice already exists for this booking
    const existingInvoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .limit(1);

    if (existingInvoice.length > 0 && existingInvoice[0]) {
      const currentInvoice = existingInvoice[0];

      if (forceRegenerate) {
        const pdfUrl = currentInvoice.pdfUrl;
        if (pdfUrl) {
          const urlParts = pdfUrl.split('/');
          const fileName = urlParts.slice(-2).join('/');
          try {
            await deleteFromMinio(fileName);
          } catch (error) {
            console.warn(`Failed to delete invoice PDF ${fileName}:`, error);
          }
        }

        await db
          .delete(invoices)
          .where(eq(invoices.id, currentInvoice.id));
      } else {
        const pdfUrl = currentInvoice.pdfUrl;
        if (pdfUrl) {
          // Extract filename from URL (e.g., "invoices/INV-2025-885598.pdf")
          const urlParts = pdfUrl.split('/');
          const fileName = urlParts.slice(-2).join('/'); // Get "invoices/filename.pdf"

          const fileExists = await checkFileExistsInMinio(fileName);

          if (fileExists) {
            return c.json({
              success: true,
              data: currentInvoice,
              message: 'Invoice already exists.',
            });
          } else {
            // File doesn't exist, delete the database record and regenerate
            await db
              .delete(invoices)
              .where(eq(invoices.id, currentInvoice.id));

            console.log(`PDF file not found for invoice ${currentInvoice.number}, regenerating...`);
          }
        }
      }
    }

    // If not, create a new one
    // Check if booking exists
    const booking = await db
      .select({
        id: bookings.id,
        code: bookings.code,
        clientId: bookings.clientId,
        hotelName: bookings.hotelName,
        city: bookings.city,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        totalAmount: bookings.totalAmount,
        paymentStatus: bookings.paymentStatus,
        bookingStatus: bookings.bookingStatus,
        mealPlan: bookings.mealPlan,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Get booking items with pricing periods
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    // Fetch extra service items (e.g., visa umrah, transportation)
    const extraServiceItems = await db
      .select()
      .from(bookingServiceItems)
      .where(eq(bookingServiceItems.bookingId, bookingId));

    // Calculate extra service items total
    const extraTotal = (extraServiceItems || []).reduce((sum, s) => {
      const sub = Number((s as any).subtotal ?? 0);
      return sum + (isNaN(sub) ? 0 : sub);
    }, 0);

    console.log('Raw booking items from database (POST):', items.map(item => ({
      id: item.id,
      roomType: item.roomType,
      roomCount: item.roomCount,
      unitPrice: item.unitPrice,
      hasPricingPeriods: item.hasPricingPeriods,
      unitPriceType: typeof item.unitPrice
    })));

    // Get pricing periods for items that have them
    const itemsWithPricingPeriods = await Promise.all(
      items.map(async (item) => {
        if (item.hasPricingPeriods) {
          const pricingPeriods = await db
            .select()
            .from(bookingItemPricingPeriods)
            .where(eq(bookingItemPricingPeriods.bookingItemId, item.id));

          console.log(`Pricing periods for item ${item.id} (POST):`, pricingPeriods);

          return {
            ...item,
            pricingPeriods
          };
        }
        console.log(`Item ${item.id} has no pricing periods (POST), returning as-is`);
        return item;
      })
    );

    console.log('Final items with pricing periods (POST):', itemsWithPricingPeriods.map(item => ({
      id: item.id,
      roomType: item.roomType,
      unitPrice: item.unitPrice,
      hasPricingPeriods: item.hasPricingPeriods,
      pricingPeriodsCount: (item as any).pricingPeriods ? (item as any).pricingPeriods.length : 0
    })));

    const bookingData = booking[0]!;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create invoice object for PDF generation
    const invoiceForPDF = {
      id: 0, // temporary ID
      number: invoiceNumber,
      bookingId: bookingId,
      amount: (Number(bookingData.totalAmount) || 0) + extraTotal,
      currency: 'SAR',
      issueDate: new Date(), // Use current date as invoice date
      dueDate: customDueDate, // Use the provided due date
      status: 'draft' as const,
      pdfUrl: null,
    };

    // Create proper booking object for PDF generation
    const bookingForPDF = {
      id: bookingData.id,
      code: bookingData.code,
      clientId: bookingData.clientId!,
      hotelName: bookingData.hotelName,
      city: bookingData.city,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      totalAmount: bookingData.totalAmount,
      paymentStatus: bookingData.paymentStatus,
      bookingStatus: bookingData.bookingStatus,
      mealPlan: bookingData.mealPlan,
      meta: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(
      invoiceForPDF,
      bookingForPDF,
      {
        id: bookingData.clientId!,
        name: bookingData.clientName!,
        email: bookingData.clientEmail!,
        phone: bookingData.clientPhone,
        createdAt: new Date(),
      },
      itemsWithPricingPeriods,
      customDueDate,
      new Date(), // Use current date as invoice date
      extraServiceItems
    );

    // Upload to MinIO and save to database
    const pdfUrl = await uploadToMinio(
      `invoices/${invoiceNumber}.pdf`,
      pdfBuffer,
      'application/pdf'
    );

    // Calculate dates
    const issueDate = new Date();
    const dueDate = customDueDate; // Use the provided due date

    // Save invoice to database
    const newInvoice: NewInvoice = {
      number: invoiceNumber,
      bookingId: bookingId,
      amount: ((Number(bookingData.totalAmount) || 0) + extraTotal).toFixed(2),
      currency: 'SAR',
      issueDate: issueDate,
      dueDate: dueDate,
      status: 'draft',
      pdfUrl: pdfUrl,
    };

    const [insertedInvoice] = await db
      .insert(invoices)
      .values(newInvoice)
      .returning();

    return c.json({
      success: true,
      data: insertedInvoice,
      message: 'Invoice generated successfully',
    }, 201);

  } catch (error) {
    console.error('Error in get-or-create-invoice:', error);
    return c.json({ error: 'Failed to get or create invoice' }, 500);
  }
});

/**
 * DELETE /api/invoices/:invoiceId
 * Hapus invoice beserta file PDF di MinIO.
 * Catatan:
 * - Pembayaran (invoicePayments) akan terhapus otomatis (ON DELETE CASCADE).
 * - Receipt yang terkait akan diset invoiceId = NULL (ON DELETE SET NULL).
 */
invoiceRoutes.delete('/:invoiceId', requireAdmin, async (c) => {
  try {
    const invoiceId = parseInt(c.req.param('invoiceId'));
    if (!invoiceId || isNaN(invoiceId)) {
      return c.json({ error: 'Invalid invoice ID' }, 400);
    }

    // Ambil invoice terlebih dahulu
    const existing = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    const invoice = existing[0]!;

    // Hapus file PDF dari MinIO jika ada
    if (invoice.pdfUrl) {
      const urlParts = invoice.pdfUrl.split('/');
      const fileName = urlParts.slice(-2).join('/'); // e.g. "invoices/INV-XXXX.pdf"
      try {
        await deleteFromMinio(fileName);
      } catch (err) {
        console.warn(`Failed to delete invoice PDF ${fileName}:`, err);
      }
    }

    // Hapus invoice dari database (payments akan cascade, receipts set null)
    await db.delete(invoices).where(eq(invoices.id, invoiceId));

    return c.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return c.json({ error: 'Failed to delete invoice' }, 500);
  }
});

// GET /api/invoices - List all invoices
invoiceRoutes.get('/', requireAdmin, async (c) => {
  try {
    const allInvoices = await db
      .select({
        id: invoices.id,
        number: invoices.number,
        bookingId: invoices.bookingId,
        amount: invoices.amount,
        currency: invoices.currency,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        pdfUrl: invoices.pdfUrl,
        bookingCode: bookings.code,
        clientName: clients.name,
        clientEmail: clients.email,
        hotelName: bookings.hotelName,
        city: bookings.city,
      })
      .from(invoices)
      .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
      .leftJoin(clients, eq(bookings.clientId, clients.id));

    const allTransportationInvoices = await db
      .select({
        id: transportationInvoices.id,
        number: transportationInvoices.number,
        bookingId: transportationInvoices.transportationBookingId,
        amount: transportationInvoices.amount,
        currency: transportationInvoices.currency,
        issueDate: transportationInvoices.issueDate,
        dueDate: transportationInvoices.dueDate,
        status: transportationInvoices.status,
        pdfUrl: transportationInvoices.pdfUrl,
        bookingCode: transportationBookings.number,
        clientName: clients.name,
        clientEmail: clients.email,
        hotelName: transportationBookings.customerName, // Use as a placeholder or 'Transportation'
        city: transportationBookings.status, // Use as a placeholder or 'N/A'
      })
      .from(transportationInvoices)
      .leftJoin(transportationBookings, eq(transportationInvoices.transportationBookingId, transportationBookings.id))
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id));

    const allServiceOrderInvoices = await db
      .select({
        id: serviceOrderInvoices.id,
        number: serviceOrderInvoices.number,
        bookingId: serviceOrderInvoices.serviceOrderId,
        amount: serviceOrderInvoices.amount,
        currency: serviceOrderInvoices.currency,
        issueDate: serviceOrderInvoices.issueDate,
        dueDate: serviceOrderInvoices.dueDate,
        status: serviceOrderInvoices.status,
        pdfUrl: serviceOrderInvoices.pdfUrl,
        bookingCode: serviceOrders.number,
        clientName: clients.name,
        clientEmail: clients.email,
        hotelName: serviceOrders.productType, // Use as a placeholder
        city: serviceOrders.status, // Use as a placeholder
      })
      .from(serviceOrderInvoices)
      .leftJoin(serviceOrders, eq(serviceOrderInvoices.serviceOrderId, serviceOrders.id))
      .leftJoin(clients, eq(serviceOrders.clientId, clients.id));

    // Combine and sort by issueDate descending
    const combinedInvoices = [
      ...allInvoices,
      ...allTransportationInvoices.map(inv => ({ ...inv, hotelName: 'Transportation' })),
      ...allServiceOrderInvoices.map(inv => ({ ...inv, hotelName: 'Service Order' }))
    ].sort((a, b) => {
      const dateA = a.issueDate ? new Date(a.issueDate).getTime() : 0;
      const dateB = b.issueDate ? new Date(b.issueDate).getTime() : 0;
      return dateB - dateA;
    });

    return c.json({
      success: true,
      data: combinedInvoices,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return c.json({ error: 'Failed to fetch invoices' }, 500);
  }
});

// POST /api/invoices/:bookingId/generate - Generate invoice for booking
invoiceRoutes.post('/:bookingId/generate', requireAdmin, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('bookingId'));

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    // Get invoiceDate and required dueDate from request body
    const body = await c.req.json().catch(() => ({}));

    // Validate required dueDate
    if (!body.dueDate) {
      return c.json({ error: 'dueDate is required' }, 400);
    }

    const customInvoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : new Date();
    const customDueDate = new Date(body.dueDate);
    const forceRegenerate = body.forceRegenerate === true;

    // Check if booking exists
    const booking = await db
      .select({
        id: bookings.id,
        code: bookings.code,
        clientId: bookings.clientId,
        hotelName: bookings.hotelName,
        city: bookings.city,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        mealPlan: bookings.mealPlan,
        totalAmount: bookings.totalAmount,
        paymentStatus: bookings.paymentStatus,
        bookingStatus: bookings.bookingStatus,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Check if invoice already exists for this booking
    const existingInvoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .limit(1);

    // Always delete existing invoice if it exists (auto-replace behavior)
    if (existingInvoice.length > 0 && existingInvoice[0]) {
      await db
        .delete(invoices)
        .where(eq(invoices.id, existingInvoice[0].id));

      console.log(`Replacing existing invoice for booking ${bookingId}, deleted invoice ${existingInvoice[0].number}`);
    }

    // Get booking items with pricing periods
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    console.log('Raw booking items from database (POST):', items.map(item => ({
      id: item.id,
      roomType: item.roomType,
      roomCount: item.roomCount,
      unitPrice: item.unitPrice,
      hasPricingPeriods: item.hasPricingPeriods,
      unitPriceType: typeof item.unitPrice
    })));

    // Fetch extra service items (e.g., visa umrah, transportation)
    const extraServiceItems = await db
      .select()
      .from(bookingServiceItems)
      .where(eq(bookingServiceItems.bookingId, bookingId));

    // Calculate extra service items total
    const extraTotal = (extraServiceItems || []).reduce((sum, s) => {
      const sub = Number((s as any).subtotal ?? 0);
      return sum + (isNaN(sub) ? 0 : sub);
    }, 0);

    // Get pricing periods for items that have them
    const itemsWithPricingPeriods = await Promise.all(
      items.map(async (item) => {
        if (item.hasPricingPeriods) {
          const pricingPeriods = await db
            .select()
            .from(bookingItemPricingPeriods)
            .where(eq(bookingItemPricingPeriods.bookingItemId, item.id));

          console.log(`Pricing periods for item ${item.id} (POST):`, pricingPeriods);

          return {
            ...item,
            pricingPeriods
          };
        }
        console.log(`Item ${item.id} has no pricing periods (POST), returning as-is`);
        return item;
      })
    );

    console.log('Final items with pricing periods (POST):', itemsWithPricingPeriods.map(item => ({
      id: item.id,
      roomType: item.roomType,
      unitPrice: item.unitPrice,
      hasPricingPeriods: item.hasPricingPeriods,
      pricingPeriodsCount: (item as any).pricingPeriods ? (item as any).pricingPeriods.length : 0
    })));

    const bookingData = booking[0]!;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create invoice object for PDF generation
    const invoiceForPDF = {
      id: 0, // temporary ID
      number: invoiceNumber,
      bookingId: bookingId,
      amount: (Number(bookingData.totalAmount) || 0) + extraTotal,
      currency: 'SAR',
      issueDate: customInvoiceDate,
      dueDate: customDueDate,
      status: 'draft' as const,
      pdfUrl: null,
    };

    // Create proper booking object for PDF generation
    const bookingForPDF = {
      id: bookingData.id,
      code: bookingData.code,
      clientId: bookingData.clientId!,
      hotelName: bookingData.hotelName,
      city: bookingData.city,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      totalAmount: bookingData.totalAmount,
      paymentStatus: bookingData.paymentStatus,
      bookingStatus: bookingData.bookingStatus,
      mealPlan: bookingData.mealPlan,
      meta: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(
      invoiceForPDF,
      bookingForPDF,
      {
        id: bookingData.clientId!,
        name: bookingData.clientName!,
        email: bookingData.clientEmail!,
        phone: bookingData.clientPhone,
        createdAt: new Date(),
      },
      itemsWithPricingPeriods,
      customDueDate,
      customInvoiceDate,
      extraServiceItems
    );

    // Upload to MinIO and save to database
    const pdfUrl = await uploadToMinio(
      `invoices/${invoiceNumber}.pdf`,
      pdfBuffer,
      'application/pdf'
    );

    // Calculate dates
    const issueDate = customInvoiceDate;
    const dueDate = customDueDate; // Use the provided due date from request body

    // Save invoice to database
    const newInvoice: NewInvoice = {
      number: invoiceNumber,
      bookingId: bookingId,
      amount: ((Number(bookingData.totalAmount) || 0) + extraTotal).toFixed(2),
      currency: 'SAR',
      issueDate: issueDate,
      dueDate: dueDate,
      status: 'draft',
      pdfUrl: pdfUrl,
    };

    const [insertedInvoice] = await db
      .insert(invoices)
      .values(newInvoice)
      .returning();

    return c.json({
      success: true,
      data: insertedInvoice,
      message: 'Invoice generated successfully',
      downloadUrl: pdfUrl
    }, 201);
  } catch (error) {
    console.error('Error generating invoice:', error);
    return c.json({ error: 'Failed to generate invoice' }, 500);
  }
});

// GET /api/invoices/by-number/:number - Serve invoice PDF
invoiceRoutes.get('/by-number/:number', requireAdmin, async (c) => {
  try {
    const invoiceNumber = c.req.param('number');

    if (!invoiceNumber) {
      return c.json({ error: 'Invoice number is required' }, 400);
    }

    let pdfUrl: string | null = null;

    if (invoiceNumber.startsWith('TI-')) {
      const invoice = await db.select().from(transportationInvoices).where(eq(transportationInvoices.number, invoiceNumber)).limit(1);
      if (invoice.length === 0) return c.json({ error: 'Invoice not found' }, 404);
      pdfUrl = invoice[0]!.pdfUrl;
    } else if (invoiceNumber.startsWith('SOI-')) {
      const invoice = await db.select().from(serviceOrderInvoices).where(eq(serviceOrderInvoices.number, invoiceNumber)).limit(1);
      if (invoice.length === 0) return c.json({ error: 'Invoice not found' }, 404);
      pdfUrl = invoice[0]!.pdfUrl;
    } else {
      const invoice = await db.select().from(invoices).where(eq(invoices.number, invoiceNumber)).limit(1);
      if (invoice.length === 0) return c.json({ error: 'Invoice not found' }, 404);
      pdfUrl = invoice[0]!.pdfUrl;
    }

    if (!pdfUrl) {
      return c.json({ error: 'PDF not available for this invoice' }, 404);
    }

    // Redirect to MinIO URL or serve the PDF directly
    // For now, we'll redirect to the MinIO URL
    return c.redirect(pdfUrl);
  } catch (error) {
    console.error('Error serving invoice PDF:', error);
    return c.json({ error: 'Failed to serve invoice PDF' }, 500);
  }
});

/**
 * GET /api/invoices/:id - Get invoice by ID with booking/client details
 */
invoiceRoutes.get('/:id', requireAdmin, async (c) => {
  try {
    const invoiceId = parseInt(c.req.param('id'));
    if (!invoiceId || isNaN(invoiceId)) {
      return c.json({ error: 'Invalid invoice ID' }, 400);
    }

    const result = await db
      .select({
        id: invoices.id,
        number: invoices.number,
        bookingId: invoices.bookingId,
        amount: invoices.amount,
        currency: invoices.currency,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        pdfUrl: invoices.pdfUrl,
        bookingCode: bookings.code,
        clientName: clients.name,
        clientEmail: clients.email,
        hotelName: bookings.hotelName,
        city: bookings.city,
        bookingPaymentStatus: bookings.paymentStatus,
        bookingMeta: bookings.meta,
      })
      .from(invoices)
      .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    return c.json({
      success: true,
      data: result[0]!,
    });
  } catch (error) {
    console.error('Error fetching invoice by ID:', error);
    return c.json({ error: 'Failed to fetch invoice' }, 500);
  }
});

/**
 * POST /api/invoices/:invoiceId/pay
 * Record a payment against the invoice's booking and update invoice status.
 * Supported methods: 'bank_transfer' | 'deposit' | 'cash'
 * Behavior mirrors booking payment with invoice existence enforcement.
 */
invoiceRoutes.post('/:invoiceId/pay', requireAdmin, async (c) => {
  try {
    const invoiceId = parseInt(c.req.param('invoiceId'));
    if (!invoiceId || isNaN(invoiceId)) {
      return c.json({ error: 'Invalid invoice ID' }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const method = body?.method as 'bank_transfer' | 'deposit' | 'cash' | undefined;
    const amountNum = body?.amount !== undefined ? parseFloat(body.amount) : undefined;
    const referenceNumber: string | undefined = body?.referenceNumber;
    const description: string | undefined = body?.description;

    const allowedMethods = ['bank_transfer', 'deposit', 'cash'];
    if (!method || !allowedMethods.includes(method)) {
      return c.json({ error: 'Invalid or missing payment method. Allowed: bank_transfer, deposit, cash' }, 400);
    }
    if (amountNum === undefined || isNaN(amountNum) || amountNum <= 0) {
      return c.json({ error: 'Payment amount must be a positive number' }, 400);
    }

    // Fetch invoice with linked booking/client details
    const invRows = await db
      .select({
        id: invoices.id,
        number: invoices.number,
        bookingId: invoices.bookingId,
        amount: invoices.amount,
        currency: invoices.currency,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        pdfUrl: invoices.pdfUrl,
        bookingCode: bookings.code,
        clientId: bookings.clientId,
        bookingPaymentStatus: bookings.paymentStatus,
        bookingMeta: bookings.meta,
      })
      .from(invoices)
      .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (invRows.length === 0 || !invRows[0]?.bookingId) {
      return c.json({ error: 'Invoice not found or not linked to a booking' }, 404);
    }

    const invoiceRow = invRows[0]!;
    const bookingId = invoiceRow.bookingId!;
    const clientId = invoiceRow.clientId!;
    const totalAmountNum = parseFloat(invoiceRow.amount as any);
    const meta: any = invoiceRow.bookingMeta || {};
    const payments: Array<{ method: string; amount: number; date: string; status: string; reference?: string }> =
      Array.isArray(meta.payments) ? meta.payments : [];

    const paidSoFar = payments.reduce((sum, p) => {
      const amt = typeof p.amount === 'string' ? parseFloat(p.amount as any) : (p.amount || 0);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);

    let remainingBalance =
      typeof meta.remainingBalance === 'number'
        ? meta.remainingBalance
        : typeof meta.remainingBalance === 'string'
          ? parseFloat(meta.remainingBalance)
          : Math.max(totalAmountNum - paidSoFar, 0);

    if (remainingBalance <= 0) {
      return c.json({ error: 'Invoice is already fully paid. No remaining balance.' }, 400);
    }

    const nowIso = new Date().toISOString();

    const updated = await db.transaction(async (tx) => {
      let newRemaining = remainingBalance;
      let newPaymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue' = invoiceRow.bookingPaymentStatus || 'unpaid';
      let paidThisTxn = 0;

      if (method === 'deposit') {
        // Ensure deposit record exists
        let depositRows = await tx
          .select()
          .from(clientDeposits)
          .where(eq(clientDeposits.clientId, clientId))
          .limit(1);

        if (depositRows.length === 0) {
          await tx.insert(clientDeposits).values({
            clientId,
            currentBalance: '0',
            totalDeposited: '0',
            totalUsed: '0',
            currency: 'SAR',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          depositRows = await tx
            .select()
            .from(clientDeposits)
            .where(eq(clientDeposits.clientId, clientId))
            .limit(1);
        }

        const currentBalance = parseFloat(depositRows[0]!.currentBalance);
        const depositUsed = Math.min(amountNum as number, remainingBalance);
        paidThisTxn = depositUsed;

        if (currentBalance < depositUsed) {
          throw new Error(`INSUFFICIENT_DEPOSIT:${currentBalance}:${depositUsed}`);
        }

        const newClientBalance = currentBalance - depositUsed;
        const newTotalUsed = parseFloat(depositRows[0]!.totalUsed) + depositUsed;

        // Update client deposit aggregates
        await tx
          .update(clientDeposits)
          .set({
            currentBalance: newClientBalance.toString(),
            totalUsed: newTotalUsed.toString(),
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clientDeposits.clientId, clientId));

        // Record usage transaction
        const usageTx: NewDepositTransaction = {
          clientId,
          type: 'usage',
          amount: depositUsed.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newClientBalance.toString(),
          currency: 'SAR',
          status: 'completed',
          description: description || `Payment for booking ${invoiceRow.bookingCode}`,
          bookingId: bookingId,
          referenceNumber: referenceNumber || `DEP-USAGE-${Date.now()}`,
          processedAt: new Date(),
        };
        await tx.insert(depositTransactions).values(usageTx);

        // Update booking meta
        newRemaining = Math.max(remainingBalance - depositUsed, 0);
        payments.push({
          method: 'deposit',
          amount: depositUsed,
          date: nowIso,
          status: 'completed',
          reference: usageTx.referenceNumber!,
        });
        meta.depositUsed = (typeof meta.depositUsed === 'number' ? meta.depositUsed : parseFloat(meta.depositUsed || '0') || 0) + depositUsed;
        meta.payments = payments;
        meta.remainingBalance = newRemaining;

        newPaymentStatus = newRemaining === 0 ? 'paid' : 'partial';

        await tx
          .update(bookings)
          .set({
            paymentStatus: newPaymentStatus,
            meta: meta,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, bookingId));
      } else if (method === 'bank_transfer' || method === 'cash') {
        const payAmt = Math.min(amountNum as number, remainingBalance);
        const surplusCredit = Math.max((amountNum as number) - remainingBalance, 0);
        paidThisTxn = payAmt;

        // Update booking meta payments for the payment part
        newRemaining = Math.max(remainingBalance - payAmt, 0);
        payments.push({
          method,
          amount: payAmt,
          date: nowIso,
          status: 'completed',
          reference: referenceNumber || `PAY-${Date.now()}`,
        });
        meta.payments = payments;
        meta.remainingBalance = newRemaining;

        newPaymentStatus = newRemaining === 0 ? 'paid' : payAmt > 0 ? 'partial' : (invoiceRow.bookingPaymentStatus || 'unpaid');

        await tx
          .update(bookings)
          .set({
            paymentStatus: newPaymentStatus,
            meta: meta,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, bookingId));

        // If there is surplus, credit it to client deposit
        if (surplusCredit > 0) {
          // Ensure deposit record exists
          let depositRows = await tx
            .select()
            .from(clientDeposits)
            .where(eq(clientDeposits.clientId, clientId))
            .limit(1);

          if (depositRows.length === 0) {
            await tx.insert(clientDeposits).values({
              clientId,
              currentBalance: '0',
              totalDeposited: '0',
              totalUsed: '0',
              currency: 'SAR',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            depositRows = await tx
              .select()
              .from(clientDeposits)
              .where(eq(clientDeposits.clientId, clientId))
              .limit(1);
          }

          const currentBalance = parseFloat(depositRows[0]!.currentBalance);
          const totalDeposited = parseFloat(depositRows[0]!.totalDeposited) + surplusCredit;
          const newClientBalance = currentBalance + surplusCredit;

          await tx
            .update(clientDeposits)
            .set({
              currentBalance: newClientBalance.toString(),
              totalDeposited: totalDeposited.toString(),
              lastTransactionAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(clientDeposits.clientId, clientId));

          const depositTx: NewDepositTransaction = {
            clientId,
            type: 'deposit',
            amount: surplusCredit.toString(),
            balanceBefore: currentBalance.toString(),
            balanceAfter: newClientBalance.toString(),
            currency: 'SAR',
            status: 'completed',
            description: description || `Surplus from booking ${invoiceRow.bookingCode} via ${method}`,
            bookingId: bookingId,
            referenceNumber: referenceNumber || `DEP-CREDIT-${Date.now()}`,
            processedAt: new Date(),
          };
          await tx.insert(depositTransactions).values(depositTx);
        }
      }

      // Record payment in invoice_payments
      const paymentRecord: NewInvoicePayment = {
        invoiceId,
        amount: paidThisTxn.toString(),
        currency: String(invoiceRow.currency || 'SAR'),
        method,
        referenceNumber: referenceNumber || undefined,
        paidAt: new Date(nowIso),
        status: 'completed',
        meta: { description: description || null, bookingCode: invoiceRow.bookingCode } as any,
      };
      await tx.insert(invoicePayments).values(paymentRecord);

      // Update invoice status based on booking payment status and due date
      const now = new Date();
      const isOverdue = (newRemaining > 0) && (invoiceRow.dueDate ? new Date(invoiceRow.dueDate as any) < now : false);
      const newInvoiceStatus: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' =
        newPaymentStatus === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'sent';

      await tx
        .update(invoices)
        .set({ status: newInvoiceStatus })
        .where(eq(invoices.id, invoiceId));

      // Auto-generate receipt for this payment
      try {
        await new ReceiptService().generateReceiptForInvoicePayment(invoiceId, {
          amount: paidThisTxn,
          method,
          referenceNumber,
          paidAt: new Date(nowIso),
          description,
        });
      } catch (receiptError) {
        console.error(`Failed to generate receipt for payment of invoice ${invoiceId}:`, receiptError);
      }

      // Return updated invoice detail (same shape as GET /api/invoices/:id)
      const detail = await tx
        .select({
          id: invoices.id,
          number: invoices.number,
          bookingId: invoices.bookingId,
          amount: invoices.amount,
          currency: invoices.currency,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          status: invoices.status,
          pdfUrl: invoices.pdfUrl,
          bookingCode: bookings.code,
          clientName: clients.name,
          clientEmail: clients.email,
          hotelName: bookings.hotelName,
          city: bookings.city,
          bookingPaymentStatus: bookings.paymentStatus,
          bookingMeta: bookings.meta,
        })
        .from(invoices)
        .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
        .leftJoin(clients, eq(bookings.clientId, clients.id))
        .where(eq(invoices.id, invoiceId))
        .limit(1);

      return detail[0]!;
    });

    return c.json({
      success: true,
      data: updated,
      message: 'Payment recorded successfully',
    });
  } catch (error) {
    console.error('Error recording payment for invoice:', error);
    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_DEPOSIT:')) {
      const parts = error.message.split(':');
      const available = parts[1];
      const requested = parts[2];
      return c.json(
        { error: `Insufficient deposit balance. Available: ${available} SAR, Requested: ${requested} SAR` },
        400
      );
    }
    return c.json({ error: 'Failed to record payment. Please try again or contact support.' }, 500);
  }
});

// POST /api/invoices/backfill-status - Sync historical invoice.status with related booking payment status
invoiceRoutes.post('/backfill-status', requireAdmin, async (c) => {
  try {
    const now = new Date();

    const rows = await db
      .select({
        id: invoices.id,
        status: invoices.status,
        dueDate: invoices.dueDate,
        bookingId: invoices.bookingId,
        bookingPaymentStatus: bookings.paymentStatus,
        totalAmount: bookings.totalAmount,
        bookingMeta: bookings.meta,
      })
      .from(invoices)
      .leftJoin(bookings, eq(invoices.bookingId, bookings.id));

    let updatedCount = 0;
    const changes: Array<{ id: number; from: string; to: string }> = [];

    for (const row of rows) {
      if (!row.bookingId) continue; // skip invoices not linked to bookings

      // Derive remaining balance from booking meta
      const meta: any = row.bookingMeta || {};
      const payments: Array<{ amount: number | string }> = Array.isArray(meta.payments) ? meta.payments : [];
      const paidSoFar = payments.reduce((sum, p) => {
        const amt = typeof p.amount === 'string' ? parseFloat(p.amount as any) : (p.amount || 0);
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0);
      const totalAmountNum = typeof row.totalAmount === 'string' ? parseFloat(row.totalAmount as any) : (row.totalAmount as any);
      let remainingBalance =
        typeof meta.remainingBalance === 'number'
          ? meta.remainingBalance
          : typeof meta.remainingBalance === 'string'
            ? parseFloat(meta.remainingBalance)
            : Math.max((totalAmountNum || 0) - paidSoFar, 0);

      const isOverdue = (remainingBalance > 0) && (row.dueDate ? new Date(row.dueDate as any) < now : false);
      const newInvoiceStatus: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' =
        row.bookingPaymentStatus === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'sent';

      if (newInvoiceStatus !== row.status) {
        await db
          .update(invoices)
          .set({ status: newInvoiceStatus })
          .where(eq(invoices.id, row.id));
        updatedCount++;
        changes.push({ id: row.id, from: String(row.status), to: newInvoiceStatus });
      }
    }

    return c.json({
      success: true,
      data: {
        totalProcessed: rows.length,
        updatedCount,
        changes,
      },
      message: 'Historical invoice statuses have been synced with booking payment statuses',
    });
  } catch (error) {
    console.error('Error backfilling invoice statuses:', error);
    return c.json({ error: 'Failed to backfill invoice statuses' }, 500);
  }
});

export default invoiceRoutes;
