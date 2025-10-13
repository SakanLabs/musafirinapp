import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { invoices, bookings, clients, bookingItems, bookingItemPricingPeriods, clientDeposits, depositTransactions } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateInvoiceNumber, generateInvoicePDF, uploadToMinio, checkFileExistsInMinio, deleteFromMinio } from '../utils/pdf';
import { TemplateHelpers } from '../utils/template';
import type { NewInvoice, NewDepositTransaction } from '../db/schema';
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

    console.log('Raw booking items from database:', items.map(item => ({
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
          
          console.log(`Pricing periods for item ${item.id}:`, pricingPeriods);
          
          return {
            ...item,
            pricingPeriods
          };
        }
        console.log(`Item ${item.id} has no pricing periods, returning as-is`);
        return item;
      })
    );

    console.log('Final items with pricing periods:', itemsWithPricingPeriods.map(item => ({
      id: item.id,
      roomType: item.roomType,
      unitPrice: item.unitPrice,
      hasPricingPeriods: item.hasPricingPeriods,
      pricingPeriodsCount: item.pricingPeriods ? item.pricingPeriods.length : 0
    })));

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
      pricingPeriodsCount: item.pricingPeriods ? item.pricingPeriods.length : 0
    })));

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
      return c.json({ error: 'Invalid or missing payment method' }, 400);
    }
    if (amountNum === undefined || isNaN(amountNum) || amountNum <= 0) {
      return c.json({ error: 'Invalid payment amount' }, 400);
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
      return c.json({ error: 'Invoice/booking is already fully paid' }, 400);
    }

    const nowIso = new Date().toISOString();

    const updated = await db.transaction(async (tx) => {
      let newRemaining = remainingBalance;
      let newPaymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue' = invoiceRow.bookingPaymentStatus || 'unpaid';

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

      // Update invoice status based on booking payment status and due date
      const now = new Date();
      const isOverdue = (newRemaining > 0) && (invoiceRow.dueDate ? new Date(invoiceRow.dueDate as any) < now : false);
      const newInvoiceStatus: 'draft' | 'sent' | 'paid' | 'pending' | 'overdue' | 'cancelled' =
        newPaymentStatus === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'pending';

      await tx
        .update(invoices)
        .set({ status: newInvoiceStatus })
        .where(eq(invoices.id, invoiceId));

      // Auto-generate receipt if invoice is now fully paid
      if (newInvoiceStatus === 'paid') {
        try {
          // Check if receipt already exists for this booking
          const existingReceipts = await receiptService.getReceiptsByBooking(bookingId);
          if (existingReceipts.length === 0) {
            // Generate receipt automatically
            await receiptService.generateReceiptForBooking(bookingId);
            console.log(`Auto-generated receipt for booking ${bookingId} after invoice ${invoiceId} was marked as paid`);
          }
        } catch (receiptError) {
          console.error(`Failed to auto-generate receipt for booking ${bookingId}:`, receiptError);
          // Don't fail the payment process if receipt generation fails
        }
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
    return c.json({ error: 'Failed to record payment' }, 500);
  }
});



export default invoiceRoutes;
