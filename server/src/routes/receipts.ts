import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { receipts, bookings, clients, invoices, transportationReceipts, transportationInvoices, transportationBookings, serviceOrderReceipts, serviceOrderInvoices, serviceOrders, customLaReceipts, customLaInvoices, customLaRequests } from '../db/schema';
import { requireFinance } from '../middleware/auth';
import { ReceiptService } from '../services/ReceiptService';

const receiptRoutes = new Hono();
const receiptService = new ReceiptService();

// GET /api/receipts - Get all receipts with pagination
receiptRoutes.get('/', requireFinance, async (c) => {
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

    // Combine all receipts and sort by createdAt descending
    const combinedReceipts = [
      ...allReceipts,
      ...allTransReceipts,
      ...allSOReceipts,
      ...allLAReceipts
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
receiptRoutes.get('/booking/:bookingId', requireFinance, async (c) => {
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
receiptRoutes.post('/generate/:bookingId', requireFinance, async (c) => {
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
receiptRoutes.get('/:id', requireFinance, async (c) => {
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
receiptRoutes.get('/number/:number', requireFinance, async (c) => {
  try {
    const receiptNumber = c.req.param('number');

    if (!receiptNumber) {
      return c.json({ error: 'Receipt number is required' }, 400);
    }

    const receipt = await db
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
        payerPhone: receipts.payerPhone,
        payerAddress: receipts.payerAddress,
        hotelName: receipts.hotelName,
        hotelAddress: receipts.hotelAddress,
        bankName: receipts.bankName,
        accountNumberOrIBAN: receipts.accountNumberOrIBAN,
        bankCountry: receipts.bankCountry,
        notes: receipts.notes,
        amountInWords: receipts.amountInWords,
        pdfUrl: receipts.pdfUrl,
        meta: receipts.meta,
        createdAt: receipts.createdAt,
        updatedAt: receipts.updatedAt,
        // Join with related data
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

    if (receipt.length === 0) {
      return c.json({ error: 'Receipt not found' }, 404);
    }

    return c.json({
      success: true,
      data: receipt[0],
    });
  } catch (error) {
    console.error('Error fetching receipt by number:', error);
    return c.json({ error: 'Failed to fetch receipt' }, 500);
  }
});

// GET /api/receipts/:id/download - Download receipt PDF
receiptRoutes.get('/:id/download', requireFinance, async (c) => {
  try {
    const receiptId = parseInt(c.req.param('id'));

    if (!receiptId || isNaN(receiptId)) {
      return c.json({ error: 'Invalid receipt ID' }, 400);
    }

    const receipt = await receiptService.getReceiptById(receiptId);

    if (!receipt) {
      return c.json({ error: 'Receipt not found' }, 404);
    }

    if (!receipt.pdfUrl) {
      // Try to regenerate it
      const receiptData = await receiptService.prepareReceiptData(receipt.id);
      if (receiptData) {
        try {
          const { generateReceiptPDF } = await import('../utils/pdf');
          const pdfUrl = await generateReceiptPDF(receiptData);
          await db.update(receipts).set({ pdfUrl }).where(eq(receipts.id, receipt.id));
          receipt.pdfUrl = pdfUrl;
        } catch (e) {
          console.error('Failed to regenerate receipt PDF:', e);
        }
      }

      if (!receipt.pdfUrl) {
        return c.json({ error: 'PDF not available for this receipt' }, 404);
      }
    }

    const urlParts = receipt.pdfUrl.split('/');
    const fileName = urlParts.slice(-2).join('/');

    const { getFileStreamFromMinio } = await import('../utils/pdf');
    const fileStream = await getFileStreamFromMinio(fileName);

    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="${receipt.number}.pdf"`);

    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk: any) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err: any) => controller.error(err));
      }
    });

    return c.body(webStream as any);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    return c.json({ error: 'Failed to download receipt' }, 500);
  }
});



export default receiptRoutes;