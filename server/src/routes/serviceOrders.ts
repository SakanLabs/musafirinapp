import { Hono } from 'hono';
import { eq, desc, asc } from 'drizzle-orm';
import { db } from '../db';
import { clients, serviceOrders, serviceOrderChecklists, serviceOrderInvoices, serviceOrderReceipts, serviceOrderInvoicePayments, clientDeposits, depositTransactions } from '../db/schema';
import type { NewServiceOrder, NewServiceOrderInvoice, ServiceOrderInvoice, NewServiceOrderReceipt, NewDepositTransaction } from '../db/schema';
import { requireAdmin, requireAdminOrFinance, requireFinance } from '../middleware/auth';
import { generateServiceOrderNumber, generateServiceOrderInvoicePDF, generateServiceOrderInvoiceNumber, uploadToMinio, generateServiceOrderReceiptPDF } from '../utils/pdf';
import { notifyAdminNewBooking } from '../lib/notification';
import { notificationService } from '../services/NotificationService';

const serviceOrderRoutes = new Hono();

// GET /api/service-orders - List service orders with pagination
serviceOrderRoutes.get('/', requireAdmin, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = (page - 1) * limit;

    const orders = await db
      .select({
        id: serviceOrders.id,
        number: serviceOrders.number,
        productType: serviceOrders.productType,
        status: serviceOrders.status,
        clientId: serviceOrders.clientId,
        clientName: clients.name,
        groupLeaderName: serviceOrders.groupLeaderName,
        groupLeaderPhone: serviceOrders.groupLeaderPhone,
        totalPeople: serviceOrders.totalPeople,
        unitPriceUSD: serviceOrders.unitPriceUSD,
        totalPriceUSD: serviceOrders.totalPriceUSD,
        totalPriceSAR: serviceOrders.totalPriceSAR,
        departureDate: serviceOrders.departureDate,
        returnDate: serviceOrders.returnDate,
        createdAt: serviceOrders.createdAt,
      })
      .from(serviceOrders)
      .leftJoin(clients, eq(serviceOrders.clientId, clients.id))
      .orderBy(desc(serviceOrders.createdAt))
      .limit(limit)
      .offset(offset);

    // total count (simple way)
    const total = await db.select({ id: serviceOrders.id }).from(serviceOrders);

    return c.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total: total.length,
        totalPages: Math.ceil(total.length / limit),
      },
    });
  } catch (error) {
    console.error('Error listing service orders:', error);
    return c.json({ error: 'Failed to fetch service orders' }, 500);
  }
});

// POST /api/service-orders - Create a new service order
serviceOrderRoutes.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();

    const required = ['clientId', 'productType', 'groupLeaderName', 'totalPeople', 'unitPriceUSD', 'departureDate', 'returnDate'];
    for (const key of required) {
      if (body[key] === undefined || body[key] === null || body[key] === '') {
        return c.json({ error: `${key} is required` }, 400);
      }
    }

    const clientId = parseInt(String(body.clientId));
    const totalPeople = parseInt(String(body.totalPeople));
    const unitPriceUSD = parseFloat(String(body.unitPriceUSD));
    const exchangeRateToSAR = body.exchangeRateToSAR ? parseFloat(String(body.exchangeRateToSAR)) : 3.75;

    if (isNaN(clientId) || isNaN(totalPeople) || isNaN(unitPriceUSD) || isNaN(exchangeRateToSAR)) {
      return c.json({ error: 'Numeric fields must be valid numbers' }, 400);
    }

    // Compute totals
    const totalPriceUSD = +(unitPriceUSD * totalPeople).toFixed(2);
    const totalPriceSAR = +(totalPriceUSD * exchangeRateToSAR).toFixed(2);

    const number = generateServiceOrderNumber();

    const payload: NewServiceOrder = {
      number,
      clientId,
      productType: body.productType,
      status: (body.status as any) || 'submitted',
      groupLeaderName: body.groupLeaderName,
      groupLeaderPhone: body.groupLeaderPhone || null,
      totalPeople,
      unitPriceUSD: unitPriceUSD.toString(),
      totalPriceUSD: totalPriceUSD.toString(),
      currency: 'USD',
      exchangeRateToSAR: exchangeRateToSAR.toString(),
      totalPriceSAR: totalPriceSAR.toString(),
      departureDate: new Date(body.departureDate),
      returnDate: new Date(body.returnDate),
      notes: body.notes || null,
      meta: body.meta || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [inserted] = await db.insert(serviceOrders).values(payload).returning();

    // Notify admin
    notifyAdminNewBooking({
      type: 'service_order',
      bookingCode: number,
      customerName: body.groupLeaderName,
      customerPhone: body.groupLeaderPhone || null,
      title: `Service Order - ${body.productType}`,
      details: {
        'Tipe Layanan': body.productType,
        'Group Leader': body.groupLeaderName,
        'Total Jamaah': `${totalPeople} Orang`,
        'Keberangkatan': new Date(body.departureDate).toLocaleDateString('id-ID'),
        'Kepulangan': new Date(body.returnDate).toLocaleDateString('id-ID'),
      },
      totalAmount: totalPriceSAR,
      currency: 'SAR',
      source: 'Admin Service Order',
      dashboardPath: `/service-orders/${inserted!.id}`,
    }).catch((err) => console.error('Notification error in serviceOrders:', err));

    return c.json({ success: true, data: inserted });
  } catch (error) {
    console.error('Error creating service order:', error);
    return c.json({ error: 'Failed to create service order' }, 500);
  }
});

// GET /api/service-orders/:id - Get single service order (with client)
serviceOrderRoutes.get('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const data = await db
      .select({
        order: serviceOrders,
        client: clients,
      })
      .from(serviceOrders)
      .leftJoin(clients, eq(serviceOrders.clientId, clients.id))
      .where(eq(serviceOrders.id, id))
      .limit(1);

    if (!data.length) return c.json({ error: 'Service order not found' }, 404);

    return c.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error fetching service order:', error);
    return c.json({ error: 'Failed to fetch service order' }, 500);
  }
});

// PATCH /api/service-orders/:id - Update service order
serviceOrderRoutes.patch('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const body = await c.req.json();

    // Recompute totals if relevant fields provided
    const updates: any = { ...body };
    let shouldRecalc = false;

    if (body.totalPeople !== undefined || body.unitPriceUSD !== undefined || body.exchangeRateToSAR !== undefined) {
      shouldRecalc = true;
    }

    if (shouldRecalc) {
      // Fetch current order
      const existing = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
      if (!existing.length) return c.json({ error: 'Service order not found' }, 404);
      const current = existing[0]!;

      const totalPeople = body.totalPeople !== undefined ? parseInt(String(body.totalPeople)) : Number(current.totalPeople);
      const unitPriceUSD = body.unitPriceUSD !== undefined ? parseFloat(String(body.unitPriceUSD)) : Number(current.unitPriceUSD);
      const exchangeRateToSAR = body.exchangeRateToSAR !== undefined ? parseFloat(String(body.exchangeRateToSAR)) : Number(current.exchangeRateToSAR);

      if (isNaN(totalPeople) || isNaN(unitPriceUSD) || isNaN(exchangeRateToSAR)) {
        return c.json({ error: 'Numeric fields must be valid numbers' }, 400);
      }

      const totalPriceUSD = +(unitPriceUSD * totalPeople).toFixed(2);
      const totalPriceSAR = +(totalPriceUSD * exchangeRateToSAR).toFixed(2);

      updates.totalPeople = totalPeople;
      updates.unitPriceUSD = unitPriceUSD;
      updates.exchangeRateToSAR = exchangeRateToSAR;
      updates.totalPriceUSD = totalPriceUSD;
      updates.totalPriceSAR = totalPriceSAR;
    }

    if (updates.departureDate) updates.departureDate = new Date(updates.departureDate);
    if (updates.returnDate) updates.returnDate = new Date(updates.returnDate);

    const [updated] = await db.update(serviceOrders).set(updates).where(eq(serviceOrders.id, id)).returning();
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating service order:', error);
    return c.json({ error: 'Failed to update service order' }, 500);
  }
});

// DELETE /api/service-orders/:id - Delete service order
serviceOrderRoutes.delete('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    // Check if service order exists
    const existing = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
    if (!existing.length) return c.json({ error: 'Service order not found' }, 404);

    // Delete associated checklist first (if exists)
    await db.delete(serviceOrderChecklists).where(eq(serviceOrderChecklists.serviceOrderId, id));

    // Delete the service order
    await db.delete(serviceOrders).where(eq(serviceOrders.id, id));

    return c.json({ success: true, message: 'Service order deleted successfully' });
  } catch (error) {
    console.error('Error deleting service order:', error);
    return c.json({ error: 'Failed to delete service order' }, 500);
  }
});

// Checklist endpoints
// GET /api/service-orders/:id/checklist
serviceOrderRoutes.get('/:id/checklist', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const data = await db.select().from(serviceOrderChecklists).where(eq(serviceOrderChecklists.serviceOrderId, id)).limit(1);
    if (!data.length) return c.json({ success: true, data: null });
    return c.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Error fetching checklist:', error);
    return c.json({ error: 'Failed to fetch checklist' }, 500);
  }
});

// POST /api/service-orders/:id/checklist - create or update checklist
serviceOrderRoutes.post('/:id/checklist', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const body = await c.req.json();
    if (!body.items) return c.json({ error: 'items JSON is required' }, 400);

    // Upsert behavior: if exists, update; else create
    const existing = await db.select().from(serviceOrderChecklists).where(eq(serviceOrderChecklists.serviceOrderId, id)).limit(1);
    if (existing.length) {
      const [updated] = await db.update(serviceOrderChecklists).set({ items: body.items, remarks: body.remarks || null, updatedAt: new Date() }).where(eq(serviceOrderChecklists.serviceOrderId, id)).returning();
      return c.json({ success: true, data: updated });
    } else {
      const [inserted] = await db.insert(serviceOrderChecklists).values({ serviceOrderId: id, items: body.items, remarks: body.remarks || null }).returning();
      return c.json({ success: true, data: inserted });
    }
  } catch (error) {
    console.error('Error upserting checklist:', error);
    return c.json({ error: 'Failed to save checklist' }, 500);
  }
});

// POST /api/service-orders/:id/generate-invoice - Generate invoice for service order
serviceOrderRoutes.post('/:id/generate-invoice', requireAdminOrFinance, async (c) => {
  try {
    const serviceOrderId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { customDueDate, customInvoiceDate } = body;

    if (!serviceOrderId || isNaN(serviceOrderId)) {
      return c.json({ error: 'Invalid service order ID' }, 400);
    }

    if (!customDueDate) {
      return c.json({ error: 'Due date is required' }, 400);
    }

    // Check if service order exists and get details with client info
    const serviceOrderData = await db
      .select({
        id: serviceOrders.id,
        number: serviceOrders.number,
        clientId: serviceOrders.clientId,
        productType: serviceOrders.productType,
        status: serviceOrders.status,
        groupLeaderName: serviceOrders.groupLeaderName,
        groupLeaderPhone: serviceOrders.groupLeaderPhone,
        totalPeople: serviceOrders.totalPeople,
        unitPriceUSD: serviceOrders.unitPriceUSD,
        totalPriceUSD: serviceOrders.totalPriceUSD,
        currency: serviceOrders.currency,
        exchangeRateToSAR: serviceOrders.exchangeRateToSAR,
        totalPriceSAR: serviceOrders.totalPriceSAR,
        departureDate: serviceOrders.departureDate,
        returnDate: serviceOrders.returnDate,
        notes: serviceOrders.notes,
        createdAt: serviceOrders.createdAt,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(serviceOrders)
      .leftJoin(clients, eq(serviceOrders.clientId, clients.id))
      .where(eq(serviceOrders.id, serviceOrderId))
      .limit(1);

    if (serviceOrderData.length === 0) {
      return c.json({ error: 'Service order not found' }, 404);
    }

    const serviceOrder = serviceOrderData[0]!;

    // Check if invoice already exists for this service order
    const existingInvoice = await db
      .select()
      .from(serviceOrderInvoices)
      .where(eq(serviceOrderInvoices.serviceOrderId, serviceOrderId))
      .limit(1);

    if (existingInvoice.length > 0) {
      return c.json({ error: 'Invoice already exists for this service order' }, 400);
    }

    // Generate invoice number
    const invoiceNumber = generateServiceOrderInvoiceNumber();

    // Calculate dates
    const issueDate = customInvoiceDate ? new Date(customInvoiceDate) : new Date();
    const dueDate = new Date(customDueDate);

    // Save invoice to database FIRST with null pdfUrl
    const newInvoice: NewServiceOrderInvoice = {
      number: invoiceNumber,
      serviceOrderId: serviceOrderId,
      amount: (serviceOrder.totalPriceUSD || serviceOrder.totalPriceSAR).toString(),
      currency: serviceOrder.currency || 'USD',
      issueDate: issueDate,
      dueDate: dueDate,
      status: 'draft',
      pdfUrl: null,
    };

    const [insertedInvoice] = await db
      .insert(serviceOrderInvoices)
      .values(newInvoice)
      .returning();

    // Now attempt to generate PDF
    try {
      // Create invoice object for PDF generation
      const invoiceForPDF = {
        id: insertedInvoice!.id,
        number: invoiceNumber,
        amount: parseFloat(serviceOrder.totalPriceUSD || serviceOrder.totalPriceSAR),
        paidAmount: 0,
        currency: serviceOrder.currency || 'USD',
        status: 'draft' as const,
        pdfUrl: null,
      };

      // Create service order object for PDF generation
      const serviceOrderForPDF = {
        id: serviceOrder.id,
        number: serviceOrder.number,
        productType: serviceOrder.productType,
        status: serviceOrder.status,
        totalAmount: parseFloat(serviceOrder.totalPriceUSD || serviceOrder.totalPriceSAR),
        totalPeople: serviceOrder.totalPeople,
        createdAt: serviceOrder.createdAt,
      };

      // Generate PDF
      const pdfBuffer = await generateServiceOrderInvoicePDF(
        invoiceForPDF,
        serviceOrderForPDF,
        {
          id: serviceOrder.clientId!,
          name: serviceOrder.clientName!,
          email: serviceOrder.clientEmail!,
          phone: serviceOrder.clientPhone,
        },
        customDueDate,
        customInvoiceDate || new Date()
      );

      // Upload to MinIO
      const pdfUrl = await uploadToMinio(
        `service-order-invoices/${invoiceNumber}.pdf`,
        pdfBuffer,
        'application/pdf'
      );

      // Update the invoice in database with PDF URL
      await db.update(serviceOrderInvoices).set({ pdfUrl }).where(eq(serviceOrderInvoices.id, insertedInvoice!.id));
      insertedInvoice!.pdfUrl = pdfUrl;
    } catch (pdfError) {
      console.error('Failed to generate/upload PDF, but invoice was created in DB:', pdfError);
      // Proceed returning the insertedInvoice with null pdfUrl
    }

    // Optional client invoice notification
    const invoiceChannels: ('email' | 'whatsapp')[] = [];
    if (body.sendEmail) invoiceChannels.push('email');
    if (body.sendWhatsApp) invoiceChannels.push('whatsapp');

    if (invoiceChannels.length > 0) {
      const recipientName = serviceOrder.clientName || serviceOrder.groupLeaderName || 'Pelanggan Musafirin';
      const recipientPhone = serviceOrder.clientPhone || serviceOrder.groupLeaderPhone || undefined;
      const recipientEmail = serviceOrder.clientEmail || undefined;

      notificationService.sendInvoice({
        clientId: serviceOrder.clientId || undefined,
        invoiceNumber: insertedInvoice!.number,
        recipientName,
        recipientEmail,
        recipientPhone,
        totalAmount: insertedInvoice!.amount || serviceOrder.totalPriceUSD || serviceOrder.totalPriceSAR,
        currency: insertedInvoice!.currency || serviceOrder.currency || 'USD',
        dueDate,
        issueDate,
        channels: invoiceChannels,
      }).catch((err) => console.error('[NotificationService] Error sending service order invoice notification:', err));
    }

    return c.json({
      success: true,
      data: insertedInvoice,
      message: 'Service order invoice generated successfully',
      downloadUrl: `/api/invoices/by-number/${insertedInvoice!.number}`
    }, 201);
  } catch (error) {
    console.error('Error generating service order invoice:', error);
    return c.json({ error: 'Failed to generate service order invoice' }, 500);
  }
});

// GET /api/service-orders/:id/invoice - Get existing invoice for service order
serviceOrderRoutes.get('/:id/invoice', requireAdminOrFinance, async (c) => {
  try {
    const serviceOrderId = parseInt(c.req.param('id'));

    if (!serviceOrderId || isNaN(serviceOrderId)) {
      return c.json({ error: 'Invalid service order ID' }, 400);
    }

    // Check if invoice exists for this service order
    const existingInvoice = await db
      .select()
      .from(serviceOrderInvoices)
      .where(eq(serviceOrderInvoices.serviceOrderId, serviceOrderId))
      .limit(1);

    if (existingInvoice.length === 0) {
      return c.json({ error: 'No invoice found for this service order' }, 404);
    }

    const invoice = existingInvoice[0]!;

    return c.json({
      success: true,
      data: invoice,
      message: 'Service order invoice retrieved successfully'
    });
  } catch (error) {
    console.error('Error retrieving service order invoice:', error);
    return c.json({ error: 'Failed to retrieve service order invoice' }, 500);
  }
});

// POST /api/service-orders/:id/regenerate-invoice - Regenerate invoice for service order (replace existing)
serviceOrderRoutes.post('/:id/regenerate-invoice', requireAdminOrFinance, async (c) => {
  try {
    const serviceOrderId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { customDueDate, customInvoiceDate } = body;

    if (!serviceOrderId || isNaN(serviceOrderId)) {
      return c.json({ error: 'Invalid service order ID' }, 400);
    }

    if (!customDueDate) {
      return c.json({ error: 'Due date is required' }, 400);
    }

    // Check if service order exists and get details with client info
    const serviceOrderData = await db
      .select({
        id: serviceOrders.id,
        number: serviceOrders.number,
        clientId: serviceOrders.clientId,
        productType: serviceOrders.productType,
        status: serviceOrders.status,
        groupLeaderName: serviceOrders.groupLeaderName,
        groupLeaderPhone: serviceOrders.groupLeaderPhone,
        totalPeople: serviceOrders.totalPeople,
        unitPriceUSD: serviceOrders.unitPriceUSD,
        totalPriceUSD: serviceOrders.totalPriceUSD,
        currency: serviceOrders.currency,
        exchangeRateToSAR: serviceOrders.exchangeRateToSAR,
        totalPriceSAR: serviceOrders.totalPriceSAR,
        departureDate: serviceOrders.departureDate,
        returnDate: serviceOrders.returnDate,
        notes: serviceOrders.notes,
        createdAt: serviceOrders.createdAt,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(serviceOrders)
      .leftJoin(clients, eq(serviceOrders.clientId, clients.id))
      .where(eq(serviceOrders.id, serviceOrderId))
      .limit(1);

    if (serviceOrderData.length === 0) {
      return c.json({ error: 'Service order not found' }, 404);
    }

    const serviceOrder = serviceOrderData[0]!;

    // Check if invoice already exists
    const existingInvoices = await db
      .select()
      .from(serviceOrderInvoices)
      .where(eq(serviceOrderInvoices.serviceOrderId, serviceOrderId))
      .limit(1);

    const existingInvoice = existingInvoices.length > 0 ? existingInvoices[0] : null;

    let targetInvoice: ServiceOrderInvoice;
    let totalPaid = 0;

    if (existingInvoice) {
      // Calculate total paid from existing payments to keep calculations intact
      const payments = await db
        .select()
        .from(serviceOrderInvoicePayments)
        .where(eq(serviceOrderInvoicePayments.invoiceId, existingInvoice.id));

      totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.amount || '0'), 0);
      const totalAmount = parseFloat(serviceOrder.totalPriceUSD || serviceOrder.totalPriceSAR || '0');

      let invoiceStatus: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' = existingInvoice.status;
      if (totalPaid >= totalAmount && totalAmount > 0) {
        invoiceStatus = 'paid';
      } else if (totalPaid > 0) {
        invoiceStatus = 'partially_paid';
      }

      const issueDate = customInvoiceDate ? new Date(customInvoiceDate) : (existingInvoice.issueDate || new Date());
      const dueDate = new Date(customDueDate);

      const [updatedInvoice] = await db
        .update(serviceOrderInvoices)
        .set({
          amount: (serviceOrder.totalPriceUSD || serviceOrder.totalPriceSAR).toString(),
          paidAmount: totalPaid.toFixed(2),
          status: invoiceStatus,
          currency: serviceOrder.currency || existingInvoice.currency || 'USD',
          issueDate,
          dueDate,
          updatedAt: new Date(),
        })
        .where(eq(serviceOrderInvoices.id, existingInvoice.id))
        .returning();

      targetInvoice = updatedInvoice!;
    } else {
      // Generate new invoice if it didn't exist
      const invoiceNumber = generateServiceOrderInvoiceNumber();
      const issueDate = customInvoiceDate ? new Date(customInvoiceDate) : new Date();
      const dueDate = new Date(customDueDate);

      const newInvoice: NewServiceOrderInvoice = {
        number: invoiceNumber,
        serviceOrderId: serviceOrderId,
        amount: (serviceOrder.totalPriceUSD || serviceOrder.totalPriceSAR).toString(),
        paidAmount: '0.00',
        currency: serviceOrder.currency || 'USD',
        issueDate: issueDate,
        dueDate: dueDate,
        status: 'draft',
        pdfUrl: null,
      };

      const [insertedInvoice] = await db
        .insert(serviceOrderInvoices)
        .values(newInvoice)
        .returning();

      targetInvoice = insertedInvoice!;
    }

    // Now attempt to generate PDF
    try {
      // Create invoice object for PDF generation
      const invoiceForPDF = {
        id: targetInvoice.id,
        number: targetInvoice.number,
        amount: parseFloat(targetInvoice.amount),
        paidAmount: targetInvoice.paidAmount,
        currency: targetInvoice.currency || serviceOrder.currency || 'USD',
        status: targetInvoice.status,
        pdfUrl: null,
      };

      // Create service order object for PDF generation
      const serviceOrderForPDF = {
        id: serviceOrder.id,
        number: serviceOrder.number,
        productType: serviceOrder.productType,
        status: serviceOrder.status,
        totalAmount: parseFloat(serviceOrder.totalPriceUSD || serviceOrder.totalPriceSAR),
        totalPeople: serviceOrder.totalPeople,
        createdAt: serviceOrder.createdAt,
      };

      // Generate PDF
      const pdfBuffer = await generateServiceOrderInvoicePDF(
        invoiceForPDF,
        serviceOrderForPDF,
        {
          id: serviceOrder.clientId!,
          name: serviceOrder.clientName!,
          email: serviceOrder.clientEmail!,
          phone: serviceOrder.clientPhone,
        },
        targetInvoice.dueDate,
        targetInvoice.issueDate
      );

      // Upload to MinIO
      const pdfUrl = await uploadToMinio(
        `service-order-invoices/${targetInvoice.number}.pdf`,
        pdfBuffer,
        'application/pdf'
      );

      // Update the invoice in database with PDF URL
      await db.update(serviceOrderInvoices).set({ pdfUrl, updatedAt: new Date() }).where(eq(serviceOrderInvoices.id, targetInvoice.id));
      targetInvoice.pdfUrl = pdfUrl;
    } catch (pdfError) {
      console.error('Failed to regenerate/upload PDF, but invoice was updated in DB:', pdfError);
    }

    // Optional client invoice notification
    const bodyObj = await c.req.json().catch(() => ({}));
    const invoiceChannels: ('email' | 'whatsapp')[] = [];
    if (bodyObj.sendEmail) invoiceChannels.push('email');
    if (bodyObj.sendWhatsApp) invoiceChannels.push('whatsapp');

    if (invoiceChannels.length > 0) {
      const recipientName = serviceOrder.clientName || serviceOrder.groupLeaderName || 'Pelanggan Musafirin';
      const recipientPhone = serviceOrder.clientPhone || serviceOrder.groupLeaderPhone || undefined;
      const recipientEmail = serviceOrder.clientEmail || undefined;

      notificationService.sendInvoice({
        clientId: serviceOrder.clientId || undefined,
        invoiceNumber: targetInvoice.number,
        recipientName,
        recipientEmail,
        recipientPhone,
        totalAmount: targetInvoice.amount || serviceOrder.totalPriceUSD || serviceOrder.totalPriceSAR,
        currency: targetInvoice.currency || serviceOrder.currency || 'USD',
        dueDate: targetInvoice.dueDate,
        issueDate: targetInvoice.issueDate,
        channels: invoiceChannels,
      }).catch((err) => console.error('[NotificationService] Error sending service order invoice notification:', err));
    }

    return c.json({
      success: true,
      data: targetInvoice,
      message: 'Service order invoice regenerated successfully',
      downloadUrl: `/api/invoices/by-number/${targetInvoice.number}`
    }, 200);
  } catch (error) {
    console.error('Error regenerating service order invoice:', error);
    return c.json({ error: 'Failed to regenerate service order invoice' }, 500);
  }
});

// PATCH /api/service-orders/:id/status - Update service order status
serviceOrderRoutes.patch('/:id/status', requireAdmin, async (c) => {
  try {
    const serviceOrderId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { status } = body;

    if (!serviceOrderId || isNaN(serviceOrderId)) {
      return c.json({ error: 'Invalid service order ID' }, 400);
    }

    if (!status) {
      return c.json({ error: 'Status is required' }, 400);
    }

    // Validate status
    const validStatuses = ['draft', 'submitted', 'paid', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    // Check if service order exists
    const existingServiceOrder = await db
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.id, serviceOrderId))
      .limit(1);

    if (existingServiceOrder.length === 0) {
      return c.json({ error: 'Service order not found' }, 404);
    }

    // Update status
    const [updatedServiceOrder] = await db
      .update(serviceOrders)
      .set({
        status: status as any,
        updatedAt: new Date()
      })
      .where(eq(serviceOrders.id, serviceOrderId))
      .returning();

    return c.json({
      success: true,
      data: updatedServiceOrder,
      message: 'Service order status updated successfully'
    });
  } catch (error) {
    console.error('Error updating service order status:', error);
    return c.json({ error: 'Failed to update service order status' }, 500);
  }
});

// POST /api/service-orders/:id/receipt - Generate receipt and handle payment
serviceOrderRoutes.post('/:id/receipt', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));

    // For payments, body should contain: amount, method, referenceNumber, description

    const serviceOrderData = await db
      .select({
        order: serviceOrders,
        client: clients,
      })
      .from(serviceOrders)
      .leftJoin(clients, eq(serviceOrders.clientId, clients.id))
      .where(eq(serviceOrders.id, id))
      .limit(1);

    if (serviceOrderData.length === 0) {
      return c.json({ error: 'Service order not found' }, 404);
    }

    const orderReq = serviceOrderData[0]?.order;
    const clientReq = serviceOrderData[0]?.client;

    if (!orderReq || !clientReq) {
      return c.json({ error: 'Service order or client data not found' }, 404);
    }

    // Check if receipt already exists for this service order
    const existingReceipt = await db
      .select()
      .from(serviceOrderReceipts)
      .where(eq(serviceOrderReceipts.serviceOrderId, id))
      .limit(1);

    // If an existing receipt is found, delete it first
    if (existingReceipt.length > 0 && existingReceipt[0]) {
      await db
        .delete(serviceOrderReceipts)
        .where(eq(serviceOrderReceipts.id, existingReceipt[0].id));
    }

    // Fetch invoice for this service order
    const invoiceQuery = await db
      .select()
      .from(serviceOrderInvoices)
      .where(eq(serviceOrderInvoices.serviceOrderId, id))
      .limit(1);

    const invoiceData = invoiceQuery.length > 0 ? invoiceQuery[0] : null;
    
    // Parse the requested payment amount
    let paymentAmount = Number(orderReq.totalPriceSAR || 0);
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
      
      await db.update(serviceOrderInvoices)
        .set({
          paidAmount: newPaidAmount.toString(),
          status: newStatus,
          updatedAt: new Date()
        })
        .where(eq(serviceOrderInvoices.id, invoiceData.id));
        
      // Record the payment
      await db.insert(serviceOrderInvoicePayments).values({
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
    const receiptNumber = `SOR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Total should be from invoice if exists, else order
    const totalDue = invoiceData ? Number(invoiceData.amount) : Number(orderReq.totalPriceUSD || orderReq.totalPriceSAR || 0);
    const prevPaid = invoiceData ? Number(invoiceData.paidAmount || 0) : 0;
    // For this specific receipt, it prints the current payment amount
    const balanceDue = Math.max(0, totalDue - (prevPaid + paymentAmount));

    const newReceipt: NewServiceOrderReceipt = {
      serviceOrderId: id,
      number: receiptNumber,
      totalAmount: totalDue.toString(),
      paidAmount: paymentAmount.toString(), // The receipt reflects THIS payment
      balanceDue: balanceDue.toString(),
      currency: invoiceData?.currency || orderReq.currency || 'USD',
      payerName: clientReq.name || 'Unknown',
      pdfUrl: '', // To be filled after upload
    };

    // Generate PDF
    const pdfBuffer = await generateServiceOrderReceiptPDF(
      newReceipt,
      orderReq,
      clientReq,
      invoiceData
    );

    // Upload to MinIO
    const pdfUrl = await uploadToMinio(
      `service-order-receipts/${receiptNumber}.pdf`,
      pdfBuffer,
      'application/pdf'
    );

    newReceipt.pdfUrl = pdfUrl;

    const [createdReceipt] = await db
      .insert(serviceOrderReceipts)
      .values(newReceipt)
      .returning();

    return c.json(createdReceipt, 201);
  } catch (error) {
    console.error('Error creating service order receipt:', error);
    return c.json({ error: 'Failed to create service order receipt' }, 500);
  }
});

// GET /api/service-orders/:id/billing - Get full billing, payments, and receipts data
serviceOrderRoutes.get('/:id/billing', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const orderRows = await db
      .select({
        order: serviceOrders,
        client: clients,
      })
      .from(serviceOrders)
      .leftJoin(clients, eq(serviceOrders.clientId, clients.id))
      .where(eq(serviceOrders.id, id))
      .limit(1);

    if (!orderRows.length) return c.json({ error: 'Service order not found' }, 404);

    const { order, client } = orderRows[0]!;

    // Fetch client deposit balance if client exists
    let clientDepositBalance = '0.00';
    if (order.clientId) {
      const dep = await db
        .select({ currentBalance: clientDeposits.currentBalance })
        .from(clientDeposits)
        .where(eq(clientDeposits.clientId, order.clientId))
        .limit(1);
      if (dep.length > 0) {
        clientDepositBalance = dep[0]!.currentBalance;
      }
    }

    // Fetch invoice
    const invRows = await db
      .select()
      .from(serviceOrderInvoices)
      .where(eq(serviceOrderInvoices.serviceOrderId, id))
      .limit(1);

    const invoice = invRows.length > 0 ? invRows[0] : null;

    // Fetch receipts
    const receiptsList = await db
      .select()
      .from(serviceOrderReceipts)
      .where(eq(serviceOrderReceipts.serviceOrderId, id))
      .orderBy(desc(serviceOrderReceipts.createdAt));

    // Summary calculations
    const totalAmount = invoice ? parseFloat(invoice.amount) : parseFloat(order.totalPriceUSD || order.totalPriceSAR || '0');
    const paidAmount = invoice ? parseFloat(invoice.paidAmount || '0') : 0;
    const remainingBalance = Math.max(0, totalAmount - paidAmount);
    const isOrderPaidFull = paidAmount >= totalAmount && totalAmount > 0;
    const paymentStatus = isOrderPaidFull
      ? 'paid' 
      : paidAmount > 0 
        ? 'partial' 
        : 'unpaid';

    // Fetch payments chronologically to establish accurate termin sequence
    let payments: any[] = [];
    if (invoice) {
      const rawPayments = await db
        .select()
        .from(serviceOrderInvoicePayments)
        .where(eq(serviceOrderInvoicePayments.invoiceId, invoice.id))
        .orderBy(asc(serviceOrderInvoicePayments.paidAt), asc(serviceOrderInvoicePayments.id));

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
        order,
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
          currency: invoice?.currency || order.currency || 'USD',
          clientDepositBalance: parseFloat(clientDepositBalance) || 0,
        },
      }
    });
  } catch (error) {
    console.error('Error fetching service order billing:', error);
    return c.json({ error: 'Failed to fetch service order billing' }, 500);
  }
});

// POST /api/service-orders/:id/pay - Record payment for service order
serviceOrderRoutes.post('/:id/pay', requireAdminOrFinance, async (c) => {
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

    const orderRows = await db
      .select({
        order: serviceOrders,
        client: clients,
      })
      .from(serviceOrders)
      .leftJoin(clients, eq(serviceOrders.clientId, clients.id))
      .where(eq(serviceOrders.id, id))
      .limit(1);

    if (!orderRows.length) return c.json({ error: 'Service order not found' }, 404);

    const { order, client } = orderRows[0]!;

    // Find or auto-generate invoice
    let invoiceRows = await db
      .select()
      .from(serviceOrderInvoices)
      .where(eq(serviceOrderInvoices.serviceOrderId, id))
      .limit(1);

    let invoice = invoiceRows.length > 0 ? invoiceRows[0] : null;

    if (!invoice) {
      // Auto-create invoice so payment can be bound
      const invoiceNumber = generateServiceOrderInvoiceNumber();
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      const [newInv] = await db
        .insert(serviceOrderInvoices)
        .values({
          number: invoiceNumber,
          serviceOrderId: id,
          amount: (order.totalPriceUSD || order.totalPriceSAR).toString(),
          paidAmount: '0.00',
          currency: order.currency || 'USD',
          issueDate,
          dueDate,
          status: 'draft',
          pdfUrl: null,
        })
        .returning();
      invoice = newInv!;

      // Background attempt to generate invoice PDF
      try {
        const invoiceForPDF = {
          id: invoice.id,
          number: invoiceNumber,
          amount: parseFloat(order.totalPriceUSD || order.totalPriceSAR),
          paidAmount: invoice.paidAmount,
          currency: invoice.currency || order.currency || 'USD',
          status: 'draft' as const,
          pdfUrl: null,
        };
        const pdfBuf = await generateServiceOrderInvoicePDF(
          invoiceForPDF,
          order,
          client || {},
          dueDate,
          issueDate
        );
        const pdfUrl = await uploadToMinio(`service-order-invoices/${invoiceNumber}.pdf`, pdfBuf, 'application/pdf');
        await db.update(serviceOrderInvoices).set({ pdfUrl }).where(eq(serviceOrderInvoices.id, invoice.id));
        invoice.pdfUrl = pdfUrl;
      } catch (e) {
        console.warn('Auto invoice PDF generation deferred:', e);
      }
    }

    const totalInvoiceAmount = parseFloat(invoice.amount);
    const currentPaidAmount = parseFloat(invoice.paidAmount || '0');
    const remainingBalance = Math.max(0, totalInvoiceAmount - currentPaidAmount);

    if (remainingBalance <= 0) {
      return c.json({ error: 'Order ini sudah lunas. Tidak ada sisa tagihan.' }, 400);
    }

    // Process payment within transaction
    const paymentResult = await db.transaction(async (tx) => {
      let depositUsed = 0;

      if (method === 'deposit') {
        if (!order.clientId) {
          throw new Error('Klien tidak ditemukan untuk pemotongan deposit');
        }

        // Fetch client deposit
        const depRows = await tx
          .select()
          .from(clientDeposits)
          .where(eq(clientDeposits.clientId, order.clientId))
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
          .where(eq(clientDeposits.clientId, order.clientId));

        // Insert deposit transaction
        await tx.insert(depositTransactions).values({
          clientId: order.clientId,
          type: 'usage',
          amount: depositUsed.toString(),
          balanceBefore: currentDepositBalance.toString(),
          balanceAfter: newDepositBalance.toString(),
          currency: 'SAR',
          status: 'completed',
          description: description || `Pembayaran Service Order ${order.number}`,
          referenceNumber: referenceNumber || `DEP-SO-${Date.now()}`,
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
        .from(serviceOrderInvoicePayments)
        .where(eq(serviceOrderInvoicePayments.invoiceId, invoice!.id));
      const terminNumber = existingPayments.length + 1;
      let terminLabel = `Termin #${terminNumber}`;
      if (isPaidFull && terminNumber === 1) {
        terminLabel = 'Pelunasan (Lunas Penuh)';
      } else if (isPaidFull) {
        terminLabel = `Termin #${terminNumber} (Pelunasan)`;
      } else if (terminNumber === 1) {
        terminLabel = 'Termin #1 (Uang Muka / DP)';
      }
      const receiptNumber = `SOR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // 1. Record payment in serviceOrderInvoicePayments
      const [paymentRecord] = await tx
        .insert(serviceOrderInvoicePayments)
        .values({
          invoiceId: invoice!.id,
          amount: effectivePayAmount.toString(),
          currency: invoice!.currency || order.currency || 'USD',
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

      // 2. Update serviceOrderInvoices
      await tx
        .update(serviceOrderInvoices)
        .set({
          paidAmount: newPaidTotal.toString(),
          status: newInvoiceStatus,
          updatedAt: new Date(),
        })
        .where(eq(serviceOrderInvoices.id, invoice!.id));

      // 3. Update serviceOrders
      const meta = (order.meta as any) || {};
      const paymentsArr = Array.isArray(meta.payments) ? meta.payments : [];
      paymentsArr.push({
        id: paymentRecord.id,
        method,
        amount: effectivePayAmount,
        date: new Date().toISOString(),
        status: 'completed',
        reference: paymentRecord.referenceNumber,
        description: description || null,
        termin: terminNumber,
        terminLabel,
        receiptNumber,
      });
      meta.payments = paymentsArr;
      meta.remainingBalance = newRemaining;
      if (method === 'deposit') {
        meta.depositUsed = (meta.depositUsed || 0) + effectivePayAmount;
      }

      await tx
        .update(serviceOrders)
        .set({
          status: isPaidFull ? 'paid' : order.status,
          meta,
          updatedAt: new Date(),
        })
        .where(eq(serviceOrders.id, id));

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
    let createdReceipt = null;
    if (autoGenerateReceipt) {
      try {
        const receiptNumber = paymentResult.receiptNumber;
        const newReceipt: NewServiceOrderReceipt = {
          serviceOrderId: id,
          serviceOrderInvoiceId: invoice.id,
          number: receiptNumber,
          totalAmount: totalInvoiceAmount.toString(),
          paidAmount: paymentResult.effectivePayAmount.toString(),
          balanceDue: paymentResult.newRemaining.toString(),
          currency: invoice.currency || order.currency || 'USD',
          payerName: client?.name || order.groupLeaderName || 'Unknown',
          pdfUrl: '',
          meta: {
            paymentId: paymentResult.payment.id,
            termin: paymentResult.terminNumber,
            terminLabel: paymentResult.terminLabel,
            referenceNumber: paymentResult.payment.referenceNumber,
            paymentMethod: method,
            description: description || null,
          },
        };

        const pdfBuffer = await generateServiceOrderReceiptPDF(
          newReceipt,
          order,
          client || {},
          invoice
        );

        const pdfUrl = await uploadToMinio(
          `service-order-receipts/${receiptNumber}.pdf`,
          pdfBuffer,
          'application/pdf'
        );

        newReceipt.pdfUrl = pdfUrl;

        const [receiptRow] = await db
          .insert(serviceOrderReceipts)
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
      const recipientName = client?.name || order.groupLeaderName || 'Pelanggan Musafirin';
      const recipientPhone = client?.phone || order.groupLeaderPhone || undefined;
      const recipientEmail = client?.email || undefined;

      notificationService.sendPaymentConfirmation({
        orderCode: order.number,
        orderTitle: `Visa Umrah (${order.productType || 'Layanan'})`,
        paymentId: paymentResult.payment.referenceNumber ?? undefined,
        amount: paymentResult.effectivePayAmount,
        currency: invoice.currency || order.currency || 'USD',
        method,
        terminLabel: paymentResult.terminLabel,
        remainingBalance: paymentResult.newRemaining,
        recipientName,
        recipientEmail,
        recipientPhone,
        paymentStatus: paymentResult.isPaidFull ? 'paid' : 'partial',
        channels: payChannels,
      }).catch((err) => console.error('[NotificationService] Error sending SO payment confirmation:', err));
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
    console.error('Error recording service order payment:', error);
    return c.json({ error: error.message || 'Gagal mencatat pembayaran' }, 500);
  }
});

// DELETE /api/service-orders/:id/payments/:paymentId - Cancel/delete a payment record
serviceOrderRoutes.delete('/:id/payments/:paymentId', requireAdminOrFinance, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const paymentId = parseInt(c.req.param('paymentId'));

    if (!id || isNaN(id) || !paymentId || isNaN(paymentId)) {
      return c.json({ error: 'Parameter tidak valid' }, 400);
    }

    const [payment] = await db
      .select()
      .from(serviceOrderInvoicePayments)
      .where(eq(serviceOrderInvoicePayments.id, paymentId))
      .limit(1);

    if (!payment) {
      return c.json({ error: 'Catatan pembayaran tidak ditemukan' }, 404);
    }

    const [invoice] = await db
      .select()
      .from(serviceOrderInvoices)
      .where(eq(serviceOrderInvoices.id, payment.invoiceId))
      .limit(1);

    if (!invoice || invoice.serviceOrderId !== id) {
      return c.json({ error: 'Invoice tidak cocok dengan service order' }, 400);
    }

    const [order] = await db
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.id, id))
      .limit(1);

    await db.transaction(async (tx) => {
      // 1. If method was deposit, refund client deposit
      if (payment.method === 'deposit' && order?.clientId) {
        const depRows = await tx
          .select()
          .from(clientDeposits)
          .where(eq(clientDeposits.clientId, order.clientId))
          .limit(1);

        if (depRows.length > 0) {
          const refundAmount = parseFloat(payment.amount);
          const currentDepBal = parseFloat(depRows[0]!.currentBalance);
          const newDepBal = currentDepBal + refundAmount;
          const newTotalUsed = Math.max(0, parseFloat(depRows[0]!.totalUsed) - refundAmount);

          await tx
            .update(clientDeposits)
            .set({
              currentBalance: newDepBal.toString(),
              totalUsed: newTotalUsed.toString(),
              updatedAt: new Date(),
            })
            .where(eq(clientDeposits.clientId, order.clientId));

          await tx.insert(depositTransactions).values({
            clientId: order.clientId,
            type: 'refund',
            amount: refundAmount.toString(),
            balanceBefore: currentDepBal.toString(),
            balanceAfter: newDepBal.toString(),
            currency: 'SAR',
            status: 'completed',
            description: `Pengembalian pembatalan pembayaran visa ${order.number}`,
            referenceNumber: `REF-DEP-${Date.now()}`,
            processedAt: new Date(),
          });
        }
      }

      // 2. Delete payment record
      await tx
        .delete(serviceOrderInvoicePayments)
        .where(eq(serviceOrderInvoicePayments.id, paymentId));

      // 3. Recalculate remaining payments
      const remainingPayments = await tx
        .select()
        .from(serviceOrderInvoicePayments)
        .where(eq(serviceOrderInvoicePayments.invoiceId, invoice.id));

      const newPaidTotal = remainingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const totalInvoiceAmount = parseFloat(invoice.amount);
      const newInvoiceStatus = newPaidTotal >= totalInvoiceAmount ? 'paid' : newPaidTotal > 0 ? 'partially_paid' : 'draft';

      await tx
        .update(serviceOrderInvoices)
        .set({
          paidAmount: newPaidTotal.toFixed(2),
          status: newInvoiceStatus,
          updatedAt: new Date(),
        })
        .where(eq(serviceOrderInvoices.id, invoice.id));

      // 4. Update order meta and status
      if (order) {
        const meta = (order.meta as any) || {};
        meta.payments = remainingPayments.map(p => ({
          method: p.method,
          amount: parseFloat(p.amount),
          date: p.paidAt ? new Date(p.paidAt).toISOString() : new Date().toISOString(),
          status: p.status,
          reference: p.referenceNumber,
          description: (p.meta as any)?.description || null,
        }));
        meta.remainingBalance = Math.max(0, totalInvoiceAmount - newPaidTotal);

        await tx
          .update(serviceOrders)
          .set({
            status: newPaidTotal >= totalInvoiceAmount ? 'paid' : 'submitted',
            meta,
            updatedAt: new Date(),
          })
          .where(eq(serviceOrders.id, id));
      }
    });

    return c.json({
      success: true,
      message: 'Pembayaran berhasil dihapus/dibatalkan',
    });
  } catch (error: any) {
    console.error('Error deleting payment:', error);
    return c.json({ error: error.message || 'Gagal membatalkan pembayaran' }, 500);
  }
});

export default serviceOrderRoutes;