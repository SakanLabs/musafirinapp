import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { bookingServiceItems, bookings } from '../db/schema';
import { requireAdmin } from '../middleware/auth';

const bookingServiceItemsRoutes = new Hono();

// GET /api/booking-service-items/booking/:bookingId - list service items for a booking
bookingServiceItemsRoutes.get('/booking/:bookingId', requireAdmin, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('bookingId'));
    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    // Ensure booking exists
    const bookingRows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (bookingRows.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const items = await db
      .select()
      .from(bookingServiceItems)
      .where(eq(bookingServiceItems.bookingId, bookingId))
      .orderBy(desc(bookingServiceItems.createdAt));

    return c.json({ success: true, data: items });
  } catch (error) {
    console.error('Error listing booking service items:', error);
    return c.json({ error: 'Failed to list booking service items' }, 500);
  }
});

// POST /api/booking-service-items - create a new service item for a booking
bookingServiceItemsRoutes.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { bookingId, serviceType, description, quantity, unitPrice, notes, meta } = body || {};

    // Validate
    if (!bookingId || !serviceType || !description || quantity === undefined || unitPrice === undefined) {
      return c.json({ error: 'Missing required fields: bookingId, serviceType, description, quantity, unitPrice' }, 400);
    }
    const bookingIdNum = parseInt(bookingId);
    if (!bookingIdNum || isNaN(bookingIdNum)) {
      return c.json({ error: 'Invalid bookingId' }, 400);
    }
    const qtyNum = parseInt(quantity);
    const unitPriceNum = typeof unitPrice === 'string' ? parseFloat(unitPrice) : Number(unitPrice);
    if (isNaN(qtyNum) || qtyNum <= 0 || isNaN(unitPriceNum) || unitPriceNum < 0) {
      return c.json({ error: 'Invalid quantity or unitPrice' }, 400);
    }

    // Ensure booking exists
    const bookingRows = await db.select().from(bookings).where(eq(bookings.id, bookingIdNum)).limit(1);
    if (bookingRows.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const subtotal = (qtyNum * unitPriceNum).toFixed(2);

    const [inserted] = await db
      .insert(bookingServiceItems)
      .values({
        bookingId: bookingIdNum,
        serviceType,
        description,
        quantity: qtyNum,
        unitPrice: unitPriceNum.toFixed(2),
        subtotal,
        notes: notes || null,
        meta: meta || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return c.json({ success: true, data: inserted, message: 'Service item created' }, 201);
  } catch (error) {
    console.error('Error creating booking service item:', error);
    return c.json({ error: 'Failed to create booking service item' }, 500);
  }
});

// DELETE /api/booking-service-items/:id - delete a service item
bookingServiceItemsRoutes.delete('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!id || isNaN(id)) {
      return c.json({ error: 'Invalid item ID' }, 400);
    }

    const [deleted] = await db
      .delete(bookingServiceItems)
      .where(eq(bookingServiceItems.id, id))
      .returning();

    if (!deleted) {
      return c.json({ error: 'Service item not found' }, 404);
    }

    return c.json({ success: true, data: deleted, message: 'Service item deleted' });
  } catch (error) {
    console.error('Error deleting booking service item:', error);
    return c.json({ error: 'Failed to delete booking service item' }, 500);
  }
});

export default bookingServiceItemsRoutes;