import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { clients, serviceOrders, serviceOrderChecklists, serviceOrderInvoices } from '../db/schema';
import type { NewServiceOrder, NewServiceOrderInvoice } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateServiceOrderNumber, generateServiceOrderInvoicePDF, generateServiceOrderInvoiceNumber, uploadToMinio } from '../utils/pdf';

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
serviceOrderRoutes.post('/:id/generate-invoice', requireAdmin, async (c) => {
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

    // Create invoice object for PDF generation
    const invoiceForPDF = {
      number: invoiceNumber,
      amount: parseFloat(serviceOrder.totalPriceSAR),
      currency: 'SAR',
      status: 'draft' as const,
      pdfUrl: null,
    };

    // Create service order object for PDF generation
    const serviceOrderForPDF = {
      id: serviceOrder.id,
      number: serviceOrder.number,
      productType: serviceOrder.productType,
      status: serviceOrder.status,
      totalAmount: parseFloat(serviceOrder.totalPriceSAR),
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

    // Calculate dates
    const issueDate = customInvoiceDate ? new Date(customInvoiceDate) : new Date();
    const dueDate = new Date(customDueDate);

    // Save invoice to database
    const newInvoice: NewServiceOrderInvoice = {
      number: invoiceNumber,
      serviceOrderId: serviceOrderId,
      amount: serviceOrder.totalPriceSAR,
      currency: 'SAR',
      issueDate: issueDate,
      dueDate: dueDate,
      status: 'draft',
      pdfUrl: pdfUrl,
    };

    const [insertedInvoice] = await db
      .insert(serviceOrderInvoices)
      .values(newInvoice)
      .returning();

    return c.json({
      success: true,
      data: insertedInvoice,
      message: 'Service order invoice generated successfully',
      downloadUrl: pdfUrl
    }, 201);
  } catch (error) {
    console.error('Error generating service order invoice:', error);
    return c.json({ error: 'Failed to generate service order invoice' }, 500);
  }
});

// GET /api/service-orders/:id/invoice - Get existing invoice for service order
serviceOrderRoutes.get('/:id/invoice', requireAdmin, async (c) => {
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
serviceOrderRoutes.post('/:id/regenerate-invoice', requireAdmin, async (c) => {
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

    // Delete existing invoice if it exists
    await db
      .delete(serviceOrderInvoices)
      .where(eq(serviceOrderInvoices.serviceOrderId, serviceOrderId));

    // Generate new invoice number
    const invoiceNumber = generateServiceOrderInvoiceNumber();

    // Create invoice object for PDF generation
    const invoiceForPDF = {
      number: invoiceNumber,
      amount: parseFloat(serviceOrder.totalPriceSAR),
      currency: 'SAR',
      status: 'draft' as const,
      pdfUrl: null,
    };

    // Create service order object for PDF generation
    const serviceOrderForPDF = {
      id: serviceOrder.id,
      number: serviceOrder.number,
      productType: serviceOrder.productType,
      status: serviceOrder.status,
      totalAmount: parseFloat(serviceOrder.totalPriceSAR),
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

    // Calculate dates
    const issueDate = customInvoiceDate ? new Date(customInvoiceDate) : new Date();
    const dueDate = new Date(customDueDate);

    // Save new invoice to database
    const newInvoice: NewServiceOrderInvoice = {
      number: invoiceNumber,
      serviceOrderId: serviceOrderId,
      amount: serviceOrder.totalPriceSAR,
      currency: 'SAR',
      issueDate: issueDate,
      dueDate: dueDate,
      status: 'draft',
      pdfUrl: pdfUrl,
    };

    const [insertedInvoice] = await db
      .insert(serviceOrderInvoices)
      .values(newInvoice)
      .returning();

    return c.json({
      success: true,
      data: insertedInvoice,
      message: 'Service order invoice regenerated successfully',
      downloadUrl: pdfUrl
    }, 201);
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

export default serviceOrderRoutes;