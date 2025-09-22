import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { invoices, bookings, clients, bookingItems } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateInvoiceNumber, generateInvoicePDF, uploadToMinio, checkFileExistsInMinio } from '../utils/pdf';
import type { NewInvoice } from '../db/schema';

const invoiceRoutes = new Hono();

// TEST ROUTE - POST /api/invoices/test/:bookingId/generate - Generate invoice for booking without auth (for testing)
invoiceRoutes.post('/test/:bookingId/generate', async (c) => {
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

    // For test endpoint, always generate new PDF (skip existing invoice check)

    // Get booking items
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    const bookingData = booking[0]!;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create invoice object for PDF generation
    const invoiceForPDF = {
      id: 0, // temporary ID
      number: invoiceNumber,
      bookingId: bookingId,
      amount: bookingData.totalAmount,
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
      items,
      customDueDate,
      customInvoiceDate
    );

    // Set headers for PDF download
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
    c.header('Content-Length', pdfBuffer.length.toString());

    // Return PDF buffer directly
    return c.body(pdfBuffer);
  } catch (error) {
    console.error('Error generating invoice (test):', error);
    return c.json({ error: 'Failed to generate invoice' }, 500);
  }
});

// POST /api/invoices/test-download/:bookingId/generate - Test endpoint for download functionality
invoiceRoutes.post('/test-download/:bookingId/generate', async (c) => {
  try {
    const bookingId = parseInt(c.req.param('bookingId'));
    const download = c.req.query('download') === 'true'; // Check if direct download is requested

    if (isNaN(bookingId)) {
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

    // Get booking with client info
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

    // Get booking items
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    const bookingData = booking[0]!;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create invoice object for PDF generation
    const invoiceForPDF = {
      id: 0, // temporary ID
      number: invoiceNumber,
      bookingId: bookingId,
      amount: bookingData.totalAmount,
      currency: 'SAR',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
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
      items,
      customDueDate,
      customInvoiceDate
    );

    // If direct download is requested, return PDF directly
    if (download) {
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
      c.header('Content-Length', pdfBuffer.length.toString());
      return c.body(pdfBuffer);
    }

    // Otherwise return success message (for testing without download)
    return c.json({
      success: true,
      message: 'PDF generated successfully (test download endpoint)',
      invoiceNumber: invoiceNumber,
      downloadUrl: `/api/invoices/test-download/${bookingId}/generate?download=true`
    }, 200);

  } catch (error) {
    console.error('Error generating invoice (test download):', error);
    return c.json({ error: 'Failed to generate invoice' }, 500);
  }
});

// TEST ROUTE - GET /api/invoices/test/booking/:bookingId - Get or create invoice for booking without auth (for testing)
invoiceRoutes.get('/test/booking/:bookingId', async (c) => {
  try {
    const bookingId = parseInt(c.req.param('bookingId'));
    const dueDateParam = c.req.query('dueDate');

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
      // Check if PDF file still exists in MinIO
      const pdfUrl = existingInvoice[0].pdfUrl;
      if (pdfUrl) {
        // Extract filename from URL (e.g., "invoices/INV-2025-885598.pdf")
        const urlParts = pdfUrl.split('/');
        const fileName = urlParts.slice(-2).join('/'); // Get "invoices/filename.pdf"
        
        const fileExists = await checkFileExistsInMinio(fileName);
        
        if (fileExists) {
          return c.json({
            success: true,
            data: existingInvoice[0],
            message: 'Invoice already exists.',
          });
        } else {
          // File doesn't exist, delete the database record and regenerate
          await db
            .delete(invoices)
            .where(eq(invoices.id, existingInvoice[0].id));
          
          console.log(`PDF file not found for invoice ${existingInvoice[0].number}, regenerating...`);
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

    // Get booking items
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    const bookingData = booking[0]!;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create invoice object for PDF generation
    const invoiceForPDF = {
      id: 0, // temporary ID
      number: invoiceNumber,
      bookingId: bookingId,
      amount: bookingData.totalAmount,
      currency: 'SAR',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
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
      items,
      customDueDate,
      new Date() // Use current date as invoice date
    );

    // Upload to MinIO and save to database
    const pdfUrl = await uploadToMinio(
      `invoices/${invoiceNumber}.pdf`,
      pdfBuffer,
      'application/pdf'
    );

    // Calculate dates using current date as invoice date
    const issueDate = new Date();
    const dueDate = customDueDate; // Use the provided due date

    // Save invoice to database
    const newInvoice: NewInvoice = {
      number: invoiceNumber,
      bookingId: bookingId,
      amount: bookingData.totalAmount,
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
    console.error('Error in test get-or-create-invoice:', error);
    return c.json({ error: 'Failed to get or create invoice' }, 500);
  }
});

// GET /api/invoices/booking/:bookingId - Get or create invoice for booking
invoiceRoutes.get('/booking/:bookingId', requireAdmin, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('bookingId'));
    const dueDateParam = c.req.query('dueDate');

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
      // Check if PDF file still exists in MinIO
      const pdfUrl = existingInvoice[0].pdfUrl;
      if (pdfUrl) {
        // Extract filename from URL (e.g., "invoices/INV-2025-885598.pdf")
        const urlParts = pdfUrl.split('/');
        const fileName = urlParts.slice(-2).join('/'); // Get "invoices/filename.pdf"
        
        const fileExists = await checkFileExistsInMinio(fileName);
        
        if (fileExists) {
          return c.json({
            success: true,
            data: existingInvoice[0],
            message: 'Invoice already exists.',
          });
        } else {
          // File doesn't exist, delete the database record and regenerate
          await db
            .delete(invoices)
            .where(eq(invoices.id, existingInvoice[0].id));
          
          console.log(`PDF file not found for invoice ${existingInvoice[0].number}, regenerating...`);
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

    // Get booking items
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    const bookingData = booking[0]!;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create invoice object for PDF generation
    const invoiceForPDF = {
      id: 0, // temporary ID
      number: invoiceNumber,
      bookingId: bookingId,
      amount: bookingData.totalAmount,
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
      items,
      customDueDate,
      new Date() // Use current date as invoice date
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
      amount: bookingData.totalAmount,
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
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .orderBy(desc(invoices.issueDate));

    return c.json({
      success: true,
      data: allInvoices,
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

    if (existingInvoice.length > 0) {
      return c.json({ 
        message: 'Invoice already exists for this booking',
        invoice: existingInvoice[0],
        downloadUrl: existingInvoice[0].pdfUrl
      });
    }

    // Get booking items
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    const bookingData = booking[0]!;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create invoice object for PDF generation
    const invoiceForPDF = {
      id: 0, // temporary ID
      number: invoiceNumber,
      bookingId: bookingId,
      amount: bookingData.totalAmount,
      currency: 'SAR',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
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
      items,
      customDueDate,
      customInvoiceDate
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
      amount: bookingData.totalAmount,
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

    // Find invoice by number
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.number, invoiceNumber))
      .limit(1);

    if (invoice.length === 0) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    const invoiceData = invoice[0]!;

    if (!invoiceData.pdfUrl) {
      return c.json({ error: 'PDF not available for this invoice' }, 404);
    }

    // Redirect to MinIO URL or serve the PDF directly
    // For now, we'll redirect to the MinIO URL
    return c.redirect(invoiceData.pdfUrl);
  } catch (error) {
    console.error('Error serving invoice PDF:', error);
    return c.json({ error: 'Failed to serve invoice PDF' }, 500);
  }
});

export default invoiceRoutes;