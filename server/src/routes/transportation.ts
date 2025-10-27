import { Hono } from 'hono';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { 
  transportationBookings, 
  transportationRoutes as transportationRoutesTable, 
  transportationInvoices, 
  transportationReceipts,
  clients 
} from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import type { 
  NewTransportationBooking, 
  NewTransportationRoute, 
  NewTransportationInvoice, 
  NewTransportationReceipt 
} from '../db/schema';

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
          count: sql<number>`count(*)`.as('count')
        })
        .from(transportationRoutesTable)
        .where(sql`${transportationRoutesTable.transportationBookingId} IN (${sql.join(bookingIds, sql`, `)})`)
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
    const bookingNumber = `TB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Create transportation booking
    const newBooking: NewTransportationBooking = {
      number: bookingNumber,
      clientId: 1, // Default client ID - should be updated based on requirements
      customerName: bookingData.customerName,
      customerPhone: bookingData.customerPhone,
      customerEmail: bookingData.customerEmail || null,
      totalAmount: bookingData.totalAmount.toString(),
      currency: bookingData.currency || 'SAR',
      status: bookingData.status || 'pending',
      notes: bookingData.notes || null,
    };

    const [createdBooking] = await db
      .insert(transportationBookings)
      .values(newBooking)
      .returning();

    // Create transportation routes
    if (routesData && routesData.length > 0 && createdBooking?.id) {
      const newRoutes: NewTransportationRoute[] = routesData.map((route: any) => ({
        transportationBookingId: createdBooking.id!,
        pickupDateTime: new Date(`${route.pickupDate}T${route.pickupTime}`),
        originLocation: route.origin,
        destinationLocation: route.destination,
        vehicleType: route.vehicleType,
        price: route.price.toString(),
        notes: route.notes || null,
      }));

      await db.insert(transportationRoutesTable).values(newRoutes);
    }

    return c.json(createdBooking, 201);
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
          pickupDateTime: new Date(`${route.pickupDate}T${route.pickupTime}`),
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

// POST /api/transportation/:id/invoice - Generate invoice
transportationApp.post('/:id/invoice', requireAdmin, async (c) => {
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

    const bookingData = booking[0];
    if (!bookingData) {
      return c.json({ error: 'Transportation booking data not found' }, 404);
    }

    // Generate invoice number
    const invoiceNumber = `TI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const newInvoice: NewTransportationInvoice = {
      transportationBookingId: id,
      number: invoiceNumber,
      amount: bookingData.totalAmount || '0',
      currency: bookingData.currency || 'SAR',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'draft',
    };

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
      .select()
      .from(transportationBookings)
      .where(eq(transportationBookings.id, id))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ error: 'Transportation booking not found' }, 404);
    }

    const bookingData = booking[0];
    if (!bookingData) {
      return c.json({ error: 'Transportation booking data not found' }, 404);
    }

    // Generate receipt number
    const receiptNumber = `TR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const newReceipt: NewTransportationReceipt = {
      transportationBookingId: id,
      number: receiptNumber,
      totalAmount: bookingData.totalAmount || '0',
      paidAmount: bookingData.totalAmount || '0',
      balanceDue: '0',
      currency: bookingData.currency || 'SAR',
      payerName: bookingData.customerName || 'Unknown',
    };

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

export default transportationApp;