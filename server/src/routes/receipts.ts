import { Hono } from 'hono';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { receipts, bookings, clients, invoices, transportationReceipts, transportationInvoices, transportationBookings, serviceOrderReceipts, serviceOrderInvoices, serviceOrders, customLaReceipts, customLaInvoices, customLaRequests, muthowifReceipts, muthowifInvoices, muthowifBookings, manualInvoiceReceipts, manualInvoices } from '../db/schema';
import { requireAdminOrFinance } from '../middleware/auth';
import { ReceiptService } from '../services/ReceiptService';

const receiptRoutes = new Hono();
const receiptService = new ReceiptService();

// GET /api/receipts - Get all receipts with pagination
receiptRoutes.get('/', requireAdminOrFinance, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = (page - 1) * limit;

    // 1. Regular Receipts
    const allReceipts = await db
      .select({
        id: receipts.id,
        number: receipts.number,
        invoiceId: receipts.invoiceId,
        totalAmount: receipts.totalAmount,
        paidAmount: receipts.paidAmount,
        balanceDue: receipts.balanceDue,
        currency: receipts.currency,
        issueDate: receipts.issueDate,
        payerName: receipts.payerName,
        payerEmail: receipts.payerEmail,
        hotelName: receipts.hotelName,
        pdfUrl: receipts.pdfUrl,
        createdAt: receipts.createdAt,
        bookingCode: bookings.code,
        invoiceNumber: invoices.number,
        clientName: receipts.payerName,
      })
      .from(receipts)
      .leftJoin(invoices, eq(receipts.invoiceId, invoices.id))
      .leftJoin(bookings, eq(receipts.bookingId, bookings.id));

    // 2. Transportation Receipts
    const allTransReceipts = await db
      .select({
        id: transportationReceipts.id,
        number: transportationReceipts.number,
        invoiceId: transportationReceipts.transportationInvoiceId,
        totalAmount: transportationReceipts.totalAmount,
        paidAmount: transportationReceipts.paidAmount,
        balanceDue: transportationReceipts.balanceDue,
        currency: transportationReceipts.currency,
        issueDate: transportationReceipts.issueDate,
        payerName: transportationReceipts.payerName,
        payerEmail: transportationReceipts.payerEmail,
        hotelName: transportationBookings.customerName, // fallback
        pdfUrl: transportationReceipts.pdfUrl,
        createdAt: transportationReceipts.createdAt,
        bookingCode: transportationBookings.number,
        invoiceNumber: transportationInvoices.number,
        clientName: transportationReceipts.payerName,
      })
      .from(transportationReceipts)
      .leftJoin(transportationInvoices, eq(transportationReceipts.transportationInvoiceId, transportationInvoices.id))
      .leftJoin(transportationBookings, eq(transportationReceipts.transportationBookingId, transportationBookings.id));

    // 3. Service Order Receipts
    const allSOReceipts = await db
      .select({
        id: serviceOrderReceipts.id,
        number: serviceOrderReceipts.number,
        invoiceId: serviceOrderReceipts.serviceOrderInvoiceId,
        totalAmount: serviceOrderReceipts.totalAmount,
        paidAmount: serviceOrderReceipts.paidAmount,
        balanceDue: serviceOrderReceipts.balanceDue,
        currency: serviceOrderReceipts.currency,
        issueDate: serviceOrderReceipts.issueDate,
        payerName: serviceOrderReceipts.payerName,
        payerEmail: serviceOrderReceipts.payerEmail,
        hotelName: serviceOrders.productType, // fallback
        pdfUrl: serviceOrderReceipts.pdfUrl,
        createdAt: serviceOrderReceipts.createdAt,
        bookingCode: serviceOrders.number,
        invoiceNumber: serviceOrderInvoices.number,
        clientName: serviceOrderReceipts.payerName,
      })
      .from(serviceOrderReceipts)
      .leftJoin(serviceOrderInvoices, eq(serviceOrderReceipts.serviceOrderInvoiceId, serviceOrderInvoices.id))
      .leftJoin(serviceOrders, eq(serviceOrderReceipts.serviceOrderId, serviceOrders.id));

    // 4. Custom LA Receipts
    const allLAReceipts = await db
      .select({
        id: customLaReceipts.id,
        number: customLaReceipts.number,
        invoiceId: customLaReceipts.invoiceId,
        totalAmount: customLaReceipts.totalAmount,
        paidAmount: customLaReceipts.paidAmount,
        balanceDue: customLaReceipts.balanceDue,
        currency: customLaReceipts.currency,
        issueDate: customLaReceipts.issueDate,
        payerName: customLaReceipts.payerName,
        payerEmail: customLaReceipts.payerEmail,
        hotelName: customLaRequests.travelName, // fallback
        pdfUrl: customLaReceipts.pdfUrl,
        createdAt: customLaReceipts.createdAt,
        bookingCode: customLaRequests.number,
        invoiceNumber: customLaInvoices.number,
        clientName: customLaReceipts.payerName,
      })
      .from(customLaReceipts)
      .leftJoin(customLaInvoices, eq(customLaReceipts.invoiceId, customLaInvoices.id))
      .leftJoin(customLaRequests, eq(customLaReceipts.customLaRequestId, customLaRequests.id));

    const allMuthowifReceipts = await db
      .select({
        id: muthowifReceipts.id,
        number: muthowifReceipts.number,
        invoiceId: muthowifReceipts.muthowifInvoiceId,
        totalAmount: muthowifReceipts.totalAmount,
        paidAmount: muthowifReceipts.paidAmount,
        balanceDue: muthowifReceipts.balanceDue,
        currency: muthowifReceipts.currency,
        issueDate: muthowifReceipts.issueDate,
        payerName: muthowifReceipts.payerName,
        payerEmail: sql`''`,
        hotelName: sql`${muthowifBookings.events}::text`,
        pdfUrl: muthowifReceipts.pdfUrl,
        createdAt: muthowifReceipts.createdAt,
        bookingCode: muthowifBookings.number,
        invoiceNumber: muthowifInvoices.number,
        clientName: muthowifReceipts.payerName,
      })
      .from(muthowifReceipts)
      .leftJoin(muthowifInvoices, eq(muthowifReceipts.muthowifInvoiceId, muthowifInvoices.id))
      .leftJoin(muthowifBookings, eq(muthowifReceipts.muthowifBookingId, muthowifBookings.id));

    // 6. Manual Invoice Receipts
    const allManualReceipts = await db
      .select({
        id: manualInvoiceReceipts.id,
        number: manualInvoiceReceipts.number,
        invoiceId: manualInvoiceReceipts.manualInvoiceId,
        totalAmount: manualInvoiceReceipts.totalAmount,
        paidAmount: manualInvoiceReceipts.paidAmount,
        balanceDue: manualInvoiceReceipts.balanceDue,
        currency: manualInvoiceReceipts.currency,
        issueDate: manualInvoiceReceipts.issueDate,
        payerName: manualInvoiceReceipts.payerName,
        payerEmail: manualInvoiceReceipts.payerEmail,
        hotelName: sql`COALESCE(${manualInvoices.title}, 'Invoice Manual')`.as('hotelName'),
        pdfUrl: manualInvoiceReceipts.pdfUrl,
        createdAt: manualInvoiceReceipts.createdAt,
        bookingCode: sql`'MANUAL'`.as('bookingCode'),
        invoiceNumber: manualInvoices.number,
        clientName: manualInvoiceReceipts.payerName,
      })
      .from(manualInvoiceReceipts)
      .leftJoin(manualInvoices, eq(manualInvoiceReceipts.manualInvoiceId, manualInvoices.id));

    // Combine all receipts and sort by createdAt descending
    const combinedReceipts = [
      ...allReceipts,
      ...allTransReceipts,
      ...allSOReceipts,
      ...allLAReceipts,
      ...allMuthowifReceipts,
      ...allManualReceipts,
    ].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    const totalCount = combinedReceipts.length;
    const paginatedReceipts = combinedReceipts.slice(offset, offset + limit);

    return c.json({
      success: true,
      data: paginatedReceipts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return c.json({ error: 'Failed to fetch receipts' }, 500);
  }
});

// GET /api/receipts/booking/:bookingId - Get receipts for a specific booking
receiptRoutes.get('/booking/:bookingId', requireAdminOrFinance, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('bookingId'));

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    const bookingReceipts = await receiptService.getReceiptsByBooking(bookingId);

    return c.json({
      success: true,
      data: bookingReceipts,
    });
  } catch (error) {
    console.error('Error fetching receipts for booking:', error);
    return c.json({ error: 'Failed to fetch receipts for booking' }, 500);
  }
});

// POST /api/receipts/generate/:bookingId - Generate receipt for a booking
receiptRoutes.post('/generate/:bookingId', requireAdminOrFinance, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('bookingId'));

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    // Check if booking exists and has a paid invoice
    const bookingData = await db
      .select({
        booking: bookings,
        client: clients,
        invoice: invoices,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .leftJoin(invoices, eq(invoices.bookingId, bookings.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (bookingData.length === 0 || !bookingData[0]?.booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const { booking, client, invoice } = bookingData[0];

    if (!invoice) {
      return c.json({ error: 'No invoice found for this booking' }, 400);
    }

    if (invoice.status !== 'paid') {
      return c.json({ error: 'Invoice must be paid before generating receipt' }, 400);
    }

    // Check if receipt already exists for this booking
    const existingReceipts = await receiptService.getReceiptsByBooking(bookingId);
    if (existingReceipts.length > 0) {
      return c.json({
        success: true,
        data: existingReceipts[0],
        message: 'Receipt already exists for this booking',
      });
    }

    // Generate new receipt
    const receipt = await receiptService.generateReceiptForBooking(bookingId);

    if (!receipt) {
      return c.json({ error: 'Failed to generate receipt' }, 500);
    }

    return c.json({
      success: true,
      data: receipt,
      message: 'Receipt generated successfully',
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    return c.json({ error: 'Failed to generate receipt' }, 500);
  }
});

// GET /api/receipts/:id - Get receipt by ID
receiptRoutes.get('/:id', requireAdminOrFinance, async (c) => {
  try {
    const receiptId = parseInt(c.req.param('id'));

    if (!receiptId || isNaN(receiptId)) {
      return c.json({ error: 'Invalid receipt ID' }, 400);
    }

    const receipt = await receiptService.getReceiptById(receiptId);

    if (!receipt) {
      return c.json({ error: 'Receipt not found' }, 404);
    }

    return c.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    return c.json({ error: 'Failed to fetch receipt' }, 500);
  }
});

// GET /api/receipts/number/:number - Get receipt by number
receiptRoutes.get('/number/:number', requireAdminOrFinance, async (c) => {
  try {
    const receiptNumber = c.req.param('number');

    if (!receiptNumber) {
      return c.json({ error: 'Receipt number is required' }, 400);
    }

    // 1. Search in receipts (Hotels)
    const receipt = await db
      .select({
        id: receipts.id,
        number: receipts.number,
        totalAmount: receipts.totalAmount,
        paidAmount: receipts.paidAmount,
        balanceDue: receipts.balanceDue,
        currency: receipts.currency,
        issueDate: receipts.issueDate,
        payerName: receipts.payerName,
        payerEmail: receipts.payerEmail,
        payerPhone: receipts.payerPhone,
        hotelName: receipts.hotelName,
        notes: receipts.notes,
        pdfUrl: receipts.pdfUrl,
        meta: receipts.meta,
        bookingCode: bookings.code,
        invoiceNumber: invoices.number,
        clientName: clients.name,
      })
      .from(receipts)
      .leftJoin(invoices, eq(receipts.invoiceId, invoices.id))
      .leftJoin(bookings, eq(invoices.bookingId, bookings.id))
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(eq(receipts.number, receiptNumber))
      .limit(1);

    if (receipt.length > 0) return c.json({ success: true, data: receipt[0] });

    // 2. Search in transportationReceipts
    const trReceipt = await db
      .select({
        id: transportationReceipts.id,
        number: transportationReceipts.number,
        totalAmount: transportationReceipts.totalAmount,
        paidAmount: transportationReceipts.paidAmount,
        balanceDue: transportationReceipts.balanceDue,
        currency: transportationReceipts.currency,
        issueDate: transportationReceipts.issueDate,
        payerName: transportationReceipts.payerName,
        payerEmail: transportationReceipts.payerEmail,
        hotelName: transportationBookings.customerName, // fallback
        pdfUrl: transportationReceipts.pdfUrl,
        bookingCode: transportationBookings.number,
        invoiceNumber: transportationInvoices.number,
        clientName: clients.name,
      })
      .from(transportationReceipts)
      .leftJoin(transportationInvoices, eq(transportationReceipts.transportationInvoiceId, transportationInvoices.id))
      .leftJoin(transportationBookings, eq(transportationReceipts.transportationBookingId, transportationBookings.id))
      .leftJoin(clients, eq(transportationBookings.clientId, clients.id))
      .where(eq(transportationReceipts.number, receiptNumber))
      .limit(1);

    if (trReceipt.length > 0) {
      const data = trReceipt[0]!;
      return c.json({ success: true, data: { ...data, hotelName: data.hotelName || 'Transportation' } });
    }

    // 3. Search in serviceOrderReceipts
    const soReceipt = await db
      .select({
        id: serviceOrderReceipts.id,
        number: serviceOrderReceipts.number,
        totalAmount: serviceOrderReceipts.totalAmount,
        paidAmount: serviceOrderReceipts.paidAmount,
        balanceDue: serviceOrderReceipts.balanceDue,
        currency: serviceOrderReceipts.currency,
        issueDate: serviceOrderReceipts.issueDate,
        payerName: serviceOrderReceipts.payerName,
        payerEmail: serviceOrderReceipts.payerEmail,
        hotelName: serviceOrders.productType, // fallback
        pdfUrl: serviceOrderReceipts.pdfUrl,
        bookingCode: serviceOrders.number,
        invoiceNumber: serviceOrderInvoices.number,
        clientName: clients.name,
      })
      .from(serviceOrderReceipts)
      .leftJoin(serviceOrderInvoices, eq(serviceOrderReceipts.serviceOrderInvoiceId, serviceOrderInvoices.id))
      .leftJoin(serviceOrders, eq(serviceOrderReceipts.serviceOrderId, serviceOrders.id))
      .leftJoin(clients, eq(serviceOrders.clientId, clients.id))
      .where(eq(serviceOrderReceipts.number, receiptNumber))
      .limit(1);

    if (soReceipt.length > 0) {
      const data = soReceipt[0]!;
      return c.json({ success: true, data: { ...data, hotelName: data.hotelName ? `Service Order (${data.hotelName})` : 'Service Order' } });
    }

    // 4. Search in customLaReceipts
    const laReceipt = await db
      .select({
        id: customLaReceipts.id,
        number: customLaReceipts.number,
        totalAmount: customLaReceipts.totalAmount,
        paidAmount: customLaReceipts.paidAmount,
        balanceDue: customLaReceipts.balanceDue,
        currency: customLaReceipts.currency,
        issueDate: customLaReceipts.issueDate,
        payerName: customLaReceipts.payerName,
        payerEmail: customLaReceipts.payerEmail,
        hotelName: customLaRequests.travelName,
        pdfUrl: customLaReceipts.pdfUrl,
        bookingCode: customLaRequests.number,
        invoiceNumber: customLaInvoices.number,
        clientName: clients.name,
      })
      .from(customLaReceipts)
      .leftJoin(customLaInvoices, eq(customLaReceipts.invoiceId, customLaInvoices.id))
      .leftJoin(customLaRequests, eq(customLaInvoices.customLaRequestId, customLaRequests.id))
      .leftJoin(clients, eq(customLaRequests.clientId, clients.id))
      .where(eq(customLaReceipts.number, receiptNumber))
      .limit(1);

    if (laReceipt.length > 0) {
      const data = laReceipt[0]!;
      return c.json({ success: true, data: { ...data, hotelName: data.hotelName ? `Custom LA (${data.hotelName})` : 'Custom LA' } });
    }

    // 5. Search in manualInvoiceReceipts
    const manReceipt = await db
      .select({
        id: manualInvoiceReceipts.id,
        number: manualInvoiceReceipts.number,
        totalAmount: manualInvoiceReceipts.totalAmount,
        paidAmount: manualInvoiceReceipts.paidAmount,
        balanceDue: manualInvoiceReceipts.balanceDue,
        currency: manualInvoiceReceipts.currency,
        issueDate: manualInvoiceReceipts.issueDate,
        payerName: manualInvoiceReceipts.payerName,
        payerEmail: manualInvoiceReceipts.payerEmail,
        hotelName: sql`COALESCE(${manualInvoices.title}, 'Invoice Manual')`.as('hotelName'),
        pdfUrl: manualInvoiceReceipts.pdfUrl,
        bookingCode: sql`'MANUAL'`.as('bookingCode'),
        invoiceNumber: manualInvoices.number,
        clientName: manualInvoiceReceipts.payerName,
      })
      .from(manualInvoiceReceipts)
      .leftJoin(manualInvoices, eq(manualInvoiceReceipts.manualInvoiceId, manualInvoices.id))
      .where(eq(manualInvoiceReceipts.number, receiptNumber))
      .limit(1);

    if (manReceipt.length > 0) {
      const data = manReceipt[0]!;
      return c.json({ success: true, data: { ...data, hotelName: data.hotelName || 'Invoice Manual' } });
    }

    return c.json({ error: 'Receipt not found' }, 404);
  } catch (error) {
    console.error('Error fetching receipt by number:', error);
    return c.json({ error: 'Failed to fetch receipt' }, 500);
  }
});

// GET /api/receipts/:id/download - Download receipt PDF
receiptRoutes.get('/:id/download', requireAdminOrFinance, async (c) => {
  try {
    const receiptId = parseInt(c.req.param('id'));

    if (!receiptId || isNaN(receiptId)) {
      return c.json({ error: 'Invalid receipt ID' }, 400);
    }

    const receipt = await receiptService.getReceiptById(receiptId);

    if (!receipt) {
      return c.json({ error: 'Receipt not found' }, 404);
    }

    const { getFileStreamFromMinio, fileExistsInMinio, generateReceiptPDF } = await import('../utils/pdf');

    let fileName = receipt.pdfUrl ? receipt.pdfUrl.split('/').slice(-2).join('/') : '';
    const exists = fileName ? await fileExistsInMinio(fileName) : false;

    if (!exists) {
      const receiptData = await receiptService.prepareReceiptData(receipt.id);
      if (receiptData) {
        try {
          const pdfUrl = await generateReceiptPDF(receiptData);
          await db.update(receipts).set({ pdfUrl }).where(eq(receipts.id, receipt.id));
          receipt.pdfUrl = pdfUrl;
          fileName = pdfUrl.split('/').slice(-2).join('/');
        } catch (e) {
          console.error('Failed to regenerate receipt PDF:', e);
        }
      }
    }

    if (!fileName || !(await fileExistsInMinio(fileName))) {
      return c.json({ error: 'PDF not available for this receipt' }, 404);
    }

    const fileStream = await getFileStreamFromMinio(fileName);
    const chunks: Buffer[] = [];
    for await (const chunk of fileStream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    const isView = c.req.query('view') === 'true';
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `${isView ? 'inline' : 'attachment'}; filename="${receipt.number}.pdf"`);
    c.header('Content-Length', pdfBuffer.length.toString());

    return c.body(pdfBuffer);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    return c.json({ error: 'Failed to download receipt' }, 500);
  }
});

// Serve receipt PDF by receipt number (Public for client downloads & viewing)
const serveReceiptPdfByNumber = async (c: any) => {
  try {
    const receiptNumber = c.req.param('number');

    if (!receiptNumber) {
      return c.json({ error: 'Receipt number is required' }, 400);
    }

    const { getFileStreamFromMinio, fileExistsInMinio } = await import('../utils/pdf');
    let pdfUrl: string | null = null;

    // Search in receipts
    if (!pdfUrl) {
      const r = await db.select({ id: receipts.id, pdfUrl: receipts.pdfUrl }).from(receipts).where(eq(receipts.number, receiptNumber)).limit(1);
      if (r.length > 0) {
        pdfUrl = r[0]!.pdfUrl;
        const fn = pdfUrl ? pdfUrl.split('/').slice(-2).join('/') : '';
        const exists = fn ? await fileExistsInMinio(fn) : false;
        if (!exists) {
          // Regenerate
          const receiptData = await receiptService.prepareReceiptData(r[0]!.id);
          if (receiptData) {
            const { generateReceiptPDF } = await import('../utils/pdf');
            pdfUrl = await generateReceiptPDF(receiptData);
            await db.update(receipts).set({ pdfUrl }).where(eq(receipts.id, r[0]!.id));
          }
        }
      }
    }
    // Search in serviceOrderReceipts
    if (!pdfUrl) {
      const r = await db.select().from(serviceOrderReceipts).where(eq(serviceOrderReceipts.number, receiptNumber)).limit(1);
      if (r.length > 0) {
        pdfUrl = r[0]!.pdfUrl;
        const fn = pdfUrl ? pdfUrl.split('/').slice(-2).join('/') : '';
        const exists = fn ? await fileExistsInMinio(fn) : false;
        if (!exists) {
          const soReceipt = r[0]!;
          const [order] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, soReceipt.serviceOrderId)).limit(1);
          const [client] = order?.clientId ? await db.select().from(clients).where(eq(clients.id, order.clientId)).limit(1) : [null];
          const [invoice] = soReceipt.serviceOrderInvoiceId ? await db.select().from(serviceOrderInvoices).where(eq(serviceOrderInvoices.id, soReceipt.serviceOrderInvoiceId)).limit(1) : [null];
          if (order) {
            const { generateServiceOrderReceiptPDF, uploadToMinio } = await import('../utils/pdf');
            const pdfBuffer = await generateServiceOrderReceiptPDF(soReceipt, order, client || {}, invoice || null);
            pdfUrl = await uploadToMinio(`service-order-receipts/${receiptNumber}.pdf`, pdfBuffer, 'application/pdf');
            await db.update(serviceOrderReceipts).set({ pdfUrl }).where(eq(serviceOrderReceipts.id, soReceipt.id));
          }
        }
      }
    }
    // Search in transportationReceipts
    if (!pdfUrl) {
      const r = await db.select({ pdfUrl: transportationReceipts.pdfUrl }).from(transportationReceipts).where(eq(transportationReceipts.number, receiptNumber)).limit(1);
      if (r.length > 0) pdfUrl = r[0]!.pdfUrl;
    }
    // Search in customLaReceipts
    if (!pdfUrl) {
      const r = await db.select({ pdfUrl: customLaReceipts.pdfUrl }).from(customLaReceipts).where(eq(customLaReceipts.number, receiptNumber)).limit(1);
      if (r.length > 0) pdfUrl = r[0]!.pdfUrl;
    }
    // Search in muthowifReceipts
    if (!pdfUrl && receiptNumber.startsWith('MBR-')) {
      const r = await db.select({ pdfUrl: muthowifReceipts.pdfUrl }).from(muthowifReceipts).where(eq(muthowifReceipts.number, receiptNumber)).limit(1);
      if (r.length > 0) pdfUrl = r[0]!.pdfUrl;
    }
    // Search in manualInvoiceReceipts
    if (!pdfUrl) {
      const r = await db.select().from(manualInvoiceReceipts).where(eq(manualInvoiceReceipts.number, receiptNumber)).limit(1);
      if (r.length > 0) {
        pdfUrl = r[0]!.pdfUrl;
        const fn = pdfUrl ? pdfUrl.split('/').slice(-2).join('/') : '';
        const exists = fn ? await fileExistsInMinio(fn) : false;
        if (!exists) {
          const manRec = r[0]!;
          const [manInv] = await db.select().from(manualInvoices).where(eq(manualInvoices.id, manRec.manualInvoiceId)).limit(1);
          if (manInv) {
            const { generateManualInvoiceReceiptPDF, uploadToMinio } = await import('../utils/pdf');
            const pdfBuffer = await generateManualInvoiceReceiptPDF(manRec, manInv);
            pdfUrl = await uploadToMinio(`receipts/${receiptNumber}.pdf`, pdfBuffer, 'application/pdf');
            await db.update(manualInvoiceReceipts).set({ pdfUrl }).where(eq(manualInvoiceReceipts.id, manRec.id));
          }
        }
      }
    }

    if (!pdfUrl) {
      return c.json({ error: 'Receipt not found or PDF not available' }, 404);
    }

    const urlParts = pdfUrl.split('/');
    const fileName = urlParts.slice(-2).join('/');

    const fileStream = await getFileStreamFromMinio(fileName);
    const chunks: Buffer[] = [];
    for await (const chunk of fileStream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    const isView = c.req.query('view') === 'true' || (!c.req.path.endsWith('/download') && c.req.query('download') !== 'true');
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `${isView ? 'inline' : 'attachment'}; filename="${receiptNumber}.pdf"`);
    c.header('Content-Length', pdfBuffer.length.toString());

    return c.body(pdfBuffer);
  } catch (error) {
    console.error('Error downloading receipt by number:', error);
    return c.json({ error: 'Failed to download receipt' }, 500);
  }
};

receiptRoutes.get('/by-number/:number', serveReceiptPdfByNumber);
receiptRoutes.get('/by-number/:number/download', serveReceiptPdfByNumber);
receiptRoutes.get('/number/:number/download', serveReceiptPdfByNumber);

export default receiptRoutes;