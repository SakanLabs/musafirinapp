import { Hono } from 'hono';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { bookings, bookingItems, clients } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateBookingCode } from '../utils/pdf';
import type { NewBooking, NewBookingItem, NewClient } from '../db/schema';

const bookingRoutes = new Hono();

// GET /api/bookings - List all bookings
bookingRoutes.get('/', requireAdmin, async (c) => {
  try {
    // Query bookings table using Drizzle
    const result = await db.select().from(bookings).orderBy(desc(bookings.createdAt));

    // Transform the data to match the expected API format
    const transformedBookings = result.map((booking) => ({
      id: booking.id,
      code: booking.code,
      clientId: booking.clientId,
      hotelName: booking.hotelName,
      city: booking.city,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      meta: booking.meta
    }));

    return c.json({
      success: true,
      data: transformedBookings,
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return c.json({ error: 'Failed to fetch bookings' }, 500);
  }
});

// GET /api/bookings/:id - Get booking by ID
bookingRoutes.get('/:id', requireAdmin, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('id'));

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    // Query bookings table with client information using Drizzle
    const result = await db
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
        meta: bookings.meta,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const bookingData = result[0];
    
    if (!bookingData) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Get booking items
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    // Transform the data to match expected API format
    const transformedBooking = {
      id: bookingData.id,
      code: bookingData.code,
      clientId: bookingData.clientId,
      clientName: bookingData.clientName,
      clientEmail: bookingData.clientEmail,
      clientPhone: bookingData.clientPhone,
      hotelName: bookingData.hotelName,
      city: bookingData.city,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      totalAmount: bookingData.totalAmount,
      paymentStatus: bookingData.paymentStatus,
      bookingStatus: bookingData.bookingStatus,
      meta: bookingData.meta,
      createdAt: bookingData.createdAt,
      updatedAt: bookingData.updatedAt,
      items: items
    };

    return c.json({
      success: true,
      data: transformedBooking,
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return c.json({ error: 'Failed to fetch booking' }, 500);
  }
});

// POST /api/bookings - Create new booking with items
bookingRoutes.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { client, booking, items } = body;

    // Validate required fields
    if (!client?.name || !client?.email || !booking?.hotelName || !booking?.city || !booking?.checkIn || !booking?.checkOut || !items?.length) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Create or find client
      let clientRecord;
      const existingClient = await tx
        .select()
        .from(clients)
        .where(eq(clients.email, client.email))
        .limit(1);

      if (existingClient.length > 0) {
        clientRecord = existingClient[0]!;
        // Update client info if provided
        if (client.name !== clientRecord.name || client.phone !== clientRecord.phone) {
          await tx
            .update(clients)
            .set({
              name: client.name,
              phone: client.phone,
            })
            .where(eq(clients.id, clientRecord.id));
          
          clientRecord = { ...clientRecord, name: client.name, phone: client.phone };
        }
      } else {
        const newClient: NewClient = {
          name: client.name,
          email: client.email,
          phone: client.phone || null,
        };
        
        const [insertedClient] = await tx
          .insert(clients)
          .values(newClient)
          .returning();
        
        clientRecord = insertedClient!;
      }

      // Calculate total amount from items
      const totalAmount = items.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.unitPrice) * item.roomCount);
      }, 0);

      // Create booking
      const newBooking: NewBooking = {
        code: generateBookingCode(),
        clientId: clientRecord!.id,
        hotelName: booking.hotelName,
        city: booking.city,
        checkIn: new Date(booking.checkIn),
        checkOut: new Date(booking.checkOut),
        totalAmount: totalAmount.toString(),
        paymentStatus: booking.paymentStatus || 'unpaid',
        bookingStatus: booking.bookingStatus || 'pending',
        meta: booking.meta || null,
      };

      const [insertedBooking] = await tx
        .insert(bookings)
        .values(newBooking)
        .returning();

      // Create booking items
      const bookingItemsData: NewBookingItem[] = items.map((item: any) => ({
        bookingId: insertedBooking!.id,
        roomType: item.roomType,
        roomCount: item.roomCount,
        unitPrice: item.unitPrice.toString(),
        hotelCostPrice: item.hotelCostPrice ? item.hotelCostPrice.toString() : '0',
      }));

      const insertedItems = await tx
        .insert(bookingItems)
        .values(bookingItemsData)
        .returning();

      return {
        booking: insertedBooking,
        client: clientRecord,
        items: insertedItems,
      };
    });

    return c.json({
      success: true,
      data: result,
      message: 'Booking created successfully',
    }, 201);
  } catch (error) {
    console.error('Error creating booking:', error);
    return c.json({ error: 'Failed to create booking' }, 500);
  }
});

// PUT /api/bookings/:id - Update booking with full data
bookingRoutes.put('/:id', requireAdmin, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('id'));
    const body = await c.req.json();

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    // Validate required fields
    const { 
      guestName, 
      guestEmail, 
      guestPhone, 
      checkInDate, 
      checkOutDate, 
      roomType, 
      numberOfGuests, 
      totalAmount, 
      status,
      specialRequests,
      hotelCostPerNight,
      totalHotelCost
    } = body;

    if (!guestName || !guestEmail || !guestPhone || !checkInDate || !checkOutDate || !roomType || !numberOfGuests || !totalAmount) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Check if booking exists
    const existingBooking = await db
      .select({
        id: bookings.id,
        clientId: bookings.clientId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (existingBooking.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const clientId = existingBooking[0]?.clientId;
    
    if (!clientId) {
      return c.json({ error: 'Client not found for booking' }, 404);
    }

    // Update client information
    await db
      .update(clients)
      .set({
        name: guestName,
        email: guestEmail,
        phone: guestPhone,
      })
      .where(eq(clients.id, clientId));

    // Update booking information
    const metaData: Record<string, any> = {};
    if (specialRequests) {
      metaData.specialRequests = specialRequests;
    }
    if (numberOfGuests) {
      metaData.numberOfGuests = numberOfGuests;
    }

    const [updatedBooking] = await db
      .update(bookings)
      .set({
        checkIn: new Date(checkInDate),
        checkOut: new Date(checkOutDate),
        totalAmount: totalAmount.toString(),
        bookingStatus: status || 'pending',
        meta: Object.keys(metaData).length > 0 ? metaData : null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    // Update booking items
    // First, delete existing items
    await db
      .delete(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    // Then, insert new item
    await db.insert(bookingItems).values({
      bookingId: bookingId,
      roomType: roomType as 'DBL' | 'TPL' | 'Quad',
      roomCount: 1, // Assuming 1 room for now
      unitPrice: totalAmount.toString(),
      hotelCostPrice: hotelCostPerNight ? hotelCostPerNight.toString() : '0',
    });

    // Fetch updated booking with client info
    const result = await db
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
        meta: bookings.meta,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    const bookingData = result[0];

    if (!bookingData) {
      return c.json({ error: 'Failed to fetch updated booking' }, 500);
    }

    // Get updated booking items
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    // Transform the data to match expected API format
    const transformedBooking = {
      id: bookingData.id,
      code: bookingData.code,
      clientId: bookingData.clientId,
      clientName: bookingData.clientName,
      clientEmail: bookingData.clientEmail,
      clientPhone: bookingData.clientPhone,
      hotelName: bookingData.hotelName,
      city: bookingData.city,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      totalAmount: bookingData.totalAmount,
      paymentStatus: bookingData.paymentStatus,
      bookingStatus: bookingData.bookingStatus,
      meta: bookingData.meta,
      createdAt: bookingData.createdAt,
      updatedAt: bookingData.updatedAt,
      items: items
    };

    return c.json({
      success: true,
      data: transformedBooking,
      message: 'Booking updated successfully',
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return c.json({ error: 'Failed to update booking' }, 500);
  }
});

// PATCH /api/bookings/:id - Update booking status and hotel confirmation number
bookingRoutes.patch('/:id', requireAdmin, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { paymentStatus, bookingStatus, hotelConfirmationNo } = body;

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    // Validate status values
    const validPaymentStatuses = ['unpaid', 'partial', 'paid', 'overdue'];
    const validBookingStatuses = ['pending', 'confirmed', 'cancelled'];

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return c.json({ error: 'Invalid payment status' }, 400);
    }

    if (bookingStatus && !validBookingStatuses.includes(bookingStatus)) {
      return c.json({ error: 'Invalid booking status' }, 400);
    }

    // Validate hotel confirmation number if provided
    if (hotelConfirmationNo && typeof hotelConfirmationNo !== 'string') {
      return c.json({ error: 'Hotel confirmation number must be a string' }, 400);
    }

    if (hotelConfirmationNo && hotelConfirmationNo.length > 100) {
      return c.json({ error: 'Hotel confirmation number must be 100 characters or less' }, 400);
    }

    // Check if booking exists
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (existingBooking.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Update booking
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
    }

    if (bookingStatus) {
      updateData.bookingStatus = bookingStatus;
    }

    if (hotelConfirmationNo !== undefined) {
      updateData.hotelConfirmationNo = hotelConfirmationNo;
    }

    const [updatedBooking] = await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning();

    return c.json({
      success: true,
      data: updatedBooking,
      message: 'Booking updated successfully',
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return c.json({ error: 'Failed to update booking' }, 500);
  }
});

export default bookingRoutes;