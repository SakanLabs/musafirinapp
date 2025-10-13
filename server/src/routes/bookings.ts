import { Hono } from 'hono';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../db';
import { bookings, bookingItems, bookingItemPricingPeriods, clients, clientDeposits, depositTransactions, invoices, vouchers, operationalCosts } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateBookingCode } from '../utils/pdf';
import type { NewBooking, NewBookingItem, NewBookingItemPricingPeriod, NewClient, NewDepositTransaction } from '../db/schema';
import { ReceiptService } from '../services/ReceiptService';

const bookingRoutes = new Hono();
const receiptService = new ReceiptService();

// GET /api/bookings - List all bookings
bookingRoutes.get('/', requireAdmin, async (c) => {
  try {
    // Query bookings table using Drizzle
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
        mealPlan: bookings.mealPlan,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
        meta: bookings.meta,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .orderBy(desc(bookings.createdAt));

    const bookingIds = result.map((booking) => booking.id).filter((id): id is number => id !== null && id !== undefined);

    let itemsByBookingId: Record<number, Array<{ id: number; bookingId: number; roomType: string; roomCount: number; unitPrice: string; hotelCostPrice: string; hasPricingPeriods: boolean }>> = {};

    if (bookingIds.length > 0) {
      const items = await db
        .select({
          id: bookingItems.id,
          bookingId: bookingItems.bookingId,
          roomType: bookingItems.roomType,
          roomCount: bookingItems.roomCount,
          unitPrice: bookingItems.unitPrice,
          hotelCostPrice: bookingItems.hotelCostPrice,
          hasPricingPeriods: bookingItems.hasPricingPeriods,
        })
        .from(bookingItems)
        .where(inArray(bookingItems.bookingId, bookingIds));

      itemsByBookingId = items.reduce((acc, item) => {
        const bucket = acc[item.bookingId] ?? [];
        bucket.push(item);
        acc[item.bookingId] = bucket;
        return acc;
      }, {} as Record<number, Array<{ id: number; bookingId: number; roomType: string; roomCount: number; unitPrice: string; hotelCostPrice: string; hasPricingPeriods: boolean }>>);
    }

    // Transform the data to match the expected API format
    const transformedBookings = result.map((booking) => ({
      id: booking.id,
      code: booking.code,
      clientId: booking.clientId,
      clientName: booking.clientName ?? '',
      clientEmail: booking.clientEmail ?? '',
      clientPhone: booking.clientPhone ?? '',
      hotelName: booking.hotelName,
      city: booking.city,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      mealPlan: booking.mealPlan,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      meta: booking.meta,
      items: booking.id !== undefined && booking.id !== null ? itemsByBookingId[booking.id] ?? [] : [],
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
        mealPlan: bookings.mealPlan,
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

    // Get pricing periods for items that have them
    const itemsWithPricingPeriods = await Promise.all(
      items.map(async (item) => {
        if (item.hasPricingPeriods) {
          const pricingPeriods = await db
            .select()
            .from(bookingItemPricingPeriods)
            .where(eq(bookingItemPricingPeriods.bookingItemId, item.id));
          
          return {
            ...item,
            pricingPeriods
          };
        }
        return item;
      })
    );

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
      mealPlan: bookingData.mealPlan,
      meta: bookingData.meta,
      createdAt: bookingData.createdAt,
      updatedAt: bookingData.updatedAt,
      items: itemsWithPricingPeriods
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

// POST /api/bookings - Create new booking with items and payment integration (bank transfer, deposit, cash)
bookingRoutes.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { client, booking, items, payment } = body;

    // Validate required fields
    if (!client?.name || !client?.email || !booking?.hotelName || !booking?.city || !booking?.checkIn || !booking?.checkOut || !items?.length) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate payment payload (optional but must be correct if provided)
    const allowedMethods = ['bank_transfer', 'deposit', 'cash'];
    const paymentMethod = payment?.method as 'bank_transfer' | 'deposit' | 'cash' | undefined;
    const paymentAmount = payment?.amount !== undefined ? parseFloat(payment.amount) : undefined;
    if (paymentMethod && !allowedMethods.includes(paymentMethod)) {
      return c.json({ error: 'Invalid payment method' }, 400);
    }
    if (paymentMethod && (paymentAmount === undefined || isNaN(paymentAmount) || paymentAmount <= 0)) {
      return c.json({ error: 'Invalid payment amount' }, 400);
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
              email: client.email,
            })
            .where(eq(clients.id, clientRecord.id));
          
          clientRecord = { ...clientRecord, name: client.name, phone: client.phone, email: client.email };
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

      // Calculate nights
      const checkInDate = new Date(booking.checkIn);
      const checkOutDate = new Date(booking.checkOut);
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate total amount from items
      const totalAmount = items.reduce((sum: number, item: any) => {
        if (item.hasPricingPeriods && item.pricingPeriods && Array.isArray(item.pricingPeriods)) {
          // Sum subtotals from pricing periods, multiplied by room count
          const itemTotal = item.pricingPeriods.reduce((periodSum: number, period: any) => {
            return periodSum + (parseFloat(period.subtotal) * item.roomCount);
          }, 0);
          return sum + itemTotal;
        } else {
          // Use traditional calculation with nights
          return sum + (parseFloat(item.unitPrice) * item.roomCount * nights);
        }
      }, 0);

      let paymentStatus: 'unpaid' | 'partial' | 'paid' = booking.paymentStatus || 'unpaid';
      let bookingMeta: Record<string, any> = booking.meta || {};

      // Precompute payment effects (do not mutate deposits until booking is created)
      let depositUsed = 0;
      let surplusCredit = 0;
      const paymentRecords: Array<{
        method: string;
        amount: number;
        date: string;
        status: string;
        reference?: string;
      }> = [];

      if (paymentMethod === 'deposit') {
        // Ensure deposit record exists
        let depositRows = await tx
          .select()
          .from(clientDeposits)
          .where(eq(clientDeposits.clientId, clientRecord!.id))
          .limit(1);

        if (depositRows.length === 0) {
          // Create initial deposit record
          await tx
            .insert(clientDeposits)
            .values({
              clientId: clientRecord!.id,
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
            .where(eq(clientDeposits.clientId, clientRecord!.id))
            .limit(1);
        }

        const currentBalance = parseFloat(depositRows[0]!.currentBalance);

        if (currentBalance < (paymentAmount as number)) {
          return c.json({ error: `Insufficient deposit balance. Available: ${currentBalance} SAR, Requested: ${paymentAmount} SAR` }, 400);
        }

        depositUsed = Math.min(paymentAmount as number, totalAmount);
        paymentStatus = depositUsed >= totalAmount ? 'paid' : depositUsed > 0 ? 'partial' : 'unpaid';

        paymentRecords.push({
          method: 'deposit',
          amount: depositUsed,
          date: new Date().toISOString(),
          status: 'completed',
          reference: `DEP-USAGE-${Date.now()}`
        });

        bookingMeta = {
          ...bookingMeta,
          payments: [...(Array.isArray(bookingMeta.payments) ? bookingMeta.payments : []), ...paymentRecords],
          depositUsed,
          remainingBalance: Math.max(totalAmount - depositUsed, 0),
        };
      } else if (paymentMethod === 'bank_transfer' || paymentMethod === 'cash') {
        const amt = paymentAmount as number;
        if (amt >= totalAmount) {
          paymentStatus = 'paid';
          surplusCredit = amt - totalAmount;
        } else if (amt > 0) {
          paymentStatus = 'partial';
        } else {
          paymentStatus = 'unpaid';
        }

        paymentRecords.push({
          method: paymentMethod,
          amount: amt,
          date: new Date().toISOString(),
          status: 'completed',
          reference: `PAY-${Date.now()}`
        });

        bookingMeta = {
          ...bookingMeta,
          payments: [...(Array.isArray(bookingMeta.payments) ? bookingMeta.payments : []), ...paymentRecords],
          remainingBalance: Math.max(totalAmount - amt, 0),
        };
      } else {
        // No payment provided
        bookingMeta = {
          ...bookingMeta,
          payments: [...(Array.isArray(bookingMeta.payments) ? bookingMeta.payments : [])],
          remainingBalance: totalAmount,
        };
      }

      // Create booking
      const newBooking: NewBooking = {
        code: generateBookingCode(),
        clientId: clientRecord!.id,
        hotelName: booking.hotelName,
        city: booking.city,
        mealPlan: booking.mealPlan || 'Room Only',
        checkIn: new Date(booking.checkIn),
        checkOut: new Date(booking.checkOut),
        totalAmount: totalAmount.toString(),
        paymentStatus,
        bookingStatus: booking.bookingStatus || 'pending',
        meta: bookingMeta,
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
        hasPricingPeriods: item.hasPricingPeriods || false,
      }));

      const insertedItems = await tx
        .insert(bookingItems)
        .values(bookingItemsData)
        .returning();

      // Create pricing periods if applicable
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const insertedItem = insertedItems[i];
        
        if (item.hasPricingPeriods && item.pricingPeriods && Array.isArray(item.pricingPeriods)) {
          const pricingPeriodsData: NewBookingItemPricingPeriod[] = item.pricingPeriods.map((period: any) => ({
            bookingItemId: insertedItem!.id,
            startDate: new Date(period.startDate),
            endDate: new Date(period.endDate),
            nights: period.nights,
            unitPrice: period.unitPrice.toString(),
            hotelCostPrice: period.hotelCostPrice ? period.hotelCostPrice.toString() : '0',
            subtotal: period.subtotal.toString(),
          }));

          await tx
            .insert(bookingItemPricingPeriods)
            .values(pricingPeriodsData);
        }
      }

      // Apply deposit effects after booking creation
      if (paymentMethod === 'deposit' && depositUsed > 0) {
        // Get current deposit
        const depositRows = await tx
          .select()
          .from(clientDeposits)
          .where(eq(clientDeposits.clientId, clientRecord!.id))
          .limit(1);
        const currentBalance = parseFloat(depositRows[0]!.currentBalance);
        const totalUsed = parseFloat(depositRows[0]!.totalUsed) + depositUsed;
        const newBalance = currentBalance - depositUsed;

        await tx
          .update(clientDeposits)
          .set({
            currentBalance: newBalance.toString(),
            totalUsed: totalUsed.toString(),
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clientDeposits.clientId, clientRecord!.id));

        const usageTx: NewDepositTransaction = {
          clientId: clientRecord!.id,
          type: 'usage',
          amount: depositUsed.toString(),
          balanceBefore: (currentBalance).toString(),
          balanceAfter: (newBalance).toString(),
          currency: 'SAR',
          status: 'completed',
          description: `Payment for booking ${insertedBooking!.code}`,
          bookingId: insertedBooking!.id,
          referenceNumber: `DEP-USAGE-${Date.now()}`,
          processedAt: new Date(),
        };
        await tx.insert(depositTransactions).values(usageTx);
      }

      // Credit surplus to deposit for bank transfer/cash
      if ((paymentMethod === 'bank_transfer' || paymentMethod === 'cash') && surplusCredit > 0) {
        // Ensure deposit record exists
        let depositRows = await tx
          .select()
          .from(clientDeposits)
          .where(eq(clientDeposits.clientId, clientRecord!.id))
          .limit(1);
        if (depositRows.length === 0) {
          await tx
            .insert(clientDeposits)
            .values({
              clientId: clientRecord!.id,
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
            .where(eq(clientDeposits.clientId, clientRecord!.id))
            .limit(1);
        }

        const currentBalance = parseFloat(depositRows[0]!.currentBalance);
        const totalDeposited = parseFloat(depositRows[0]!.totalDeposited) + surplusCredit;
        const newBalance = currentBalance + surplusCredit;

        await tx
          .update(clientDeposits)
          .set({
            currentBalance: newBalance.toString(),
            totalDeposited: totalDeposited.toString(),
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clientDeposits.clientId, clientRecord!.id));

        const depositTx: NewDepositTransaction = {
          clientId: clientRecord!.id,
          type: 'deposit',
          amount: surplusCredit.toString(),
          balanceBefore: (currentBalance).toString(),
          balanceAfter: (newBalance).toString(),
          currency: 'SAR',
          status: 'completed',
          description: `Surplus from booking ${insertedBooking!.code} via ${paymentMethod}`,
          bookingId: insertedBooking!.id,
          referenceNumber: `DEP-CREDIT-${Date.now()}`,
          processedAt: new Date(),
        };
        await tx.insert(depositTransactions).values(depositTx);
      }

      return {
        booking: insertedBooking,
        client: clientRecord,
        items: insertedItems,
        depositUsed,
        surplusCredit,
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
      mealPlan,
      numberOfGuests, 
      totalAmount, 
      status,
      specialRequests,
      hotelCostPerNight,
      totalHotelCost,
      rooms // New field for multiple rooms support
    } = body;

    if (!guestName || !guestEmail || !guestPhone || !checkInDate || !checkOutDate || !numberOfGuests || !totalAmount) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Support both legacy single room format and new multiple rooms format
    const roomsData = rooms || (roomType ? [{
      roomType,
      roomCount: 1,
      unitPrice: totalAmount,
      hotelCostPrice: hotelCostPerNight || 0,
      pricingPeriods: []
    }] : []);

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
        mealPlan: mealPlan || 'Room Only',
        meta: Object.keys(metaData).length > 0 ? metaData : null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    // Update booking items
    // First, get existing items to delete their pricing periods
    const existingItems = await db
      .select({ id: bookingItems.id })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    // Delete pricing periods for existing items
    if (existingItems.length > 0) {
      const itemIds = existingItems.map(item => item.id);
      await db
        .delete(bookingItemPricingPeriods)
        .where(inArray(bookingItemPricingPeriods.bookingItemId, itemIds));
    }

    // Then, delete existing items
    await db
      .delete(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    // Insert new items for each room
    for (const room of roomsData) {
      const [newItem] = await db.insert(bookingItems).values({
        bookingId: bookingId,
        roomType: room.roomType as 'DBL' | 'TPL' | 'Quad',
        roomCount: room.roomCount || 1,
        unitPrice: room.unitPrice.toString(),
        hotelCostPrice: room.hotelCostPrice ? room.hotelCostPrice.toString() : '0',
      }).returning();

      // Insert pricing periods if they exist
      if (room.pricingPeriods && room.pricingPeriods.length > 0 && newItem) {
        const pricingPeriodsData = room.pricingPeriods.map((period: any) => ({
          bookingItemId: newItem.id,
          startDate: new Date(period.startDate),
          endDate: new Date(period.endDate),
          nights: period.nights,
          unitPrice: period.unitPrice.toString(),
          hotelCostPrice: period.hotelCostPrice ? period.hotelCostPrice.toString() : '0',
          subtotal: period.subtotal.toString(),
        }));

        await db.insert(bookingItemPricingPeriods).values(pricingPeriodsData);
      }
    }

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
        mealPlan: bookings.mealPlan,
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

    // Get updated booking items with their pricing periods
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    // Get pricing periods for each item
    const itemsWithPricingPeriods = await Promise.all(
      items.map(async (item) => {
        const pricingPeriods = await db
          .select()
          .from(bookingItemPricingPeriods)
          .where(eq(bookingItemPricingPeriods.bookingItemId, item.id));

        return {
          ...item,
          pricingPeriods
        };
      })
    );

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
      mealPlan: bookingData.mealPlan,
      meta: bookingData.meta,
      createdAt: bookingData.createdAt,
      updatedAt: bookingData.updatedAt,
      items: itemsWithPricingPeriods
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

/**
 * POST /api/bookings/:id/pay
 * Record a payment against an existing booking, integrated with deposit system and status updates.
 * Supported methods: 'bank_transfer' | 'deposit' | 'cash'
 * Behavior:
 *  - deposit: deducts from client's deposit (usage transaction), up to remaining balance
 *  - bank_transfer/cash: pays booking; if amount exceeds remaining, credits surplus to client's deposit (deposit transaction)
 * Updates booking.meta.payments[], booking.meta.remainingBalance, and booking.paymentStatus accordingly.
 */
bookingRoutes.post('/:id/pay', requireAdmin, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('id'));
    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    const body = await c.req.json();
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

    // Fetch booking (needs clientId, totalAmount, paymentStatus, meta, code)
    const bookingRows = await db
      .select({
        id: bookings.id,
        clientId: bookings.clientId,
        totalAmount: bookings.totalAmount,
        paymentStatus: bookings.paymentStatus,
        bookingStatus: bookings.bookingStatus,
        meta: bookings.meta,
        code: bookings.code,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (bookingRows.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Require an existing invoice for this booking before accepting payments
    const invoiceRows = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .limit(1);

    if (invoiceRows.length === 0) {
      return c.json({ error: 'Invoice not found for this booking. Generate the invoice before recording payments.' }, 400);
    }

    const bookingRow = bookingRows[0]!;
    const clientId = bookingRow.clientId!;
    const totalAmountNum = parseFloat(bookingRow.totalAmount as any);
    const meta: any = bookingRow.meta || {};
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
      return c.json({ error: 'Booking is already fully paid' }, 400);
    }

    const nowIso = new Date().toISOString();

    const updated = await db.transaction(async (tx) => {
      let newRemaining = remainingBalance;
      let newPaymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue' = bookingRow.paymentStatus || 'unpaid';

      if (method === 'deposit') {
        // Ensure deposit record exists
        let depositRows = await tx
          .select()
          .from(clientDeposits)
          .where(eq(clientDeposits.clientId, clientId))
          .limit(1);

        if (depositRows.length === 0) {
          // Create initial deposit record
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
          description: description || `Payment for booking ${bookingRow.code}`,
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

        newPaymentStatus = newRemaining === 0 ? 'paid' : payAmt > 0 ? 'partial' : bookingRow.paymentStatus || 'unpaid';

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
            description: description || `Surplus from booking ${bookingRow.code} via ${method}`,
            bookingId: bookingId,
            referenceNumber: referenceNumber || `DEP-CREDIT-${Date.now()}`,
            processedAt: new Date(),
          };
          await tx.insert(depositTransactions).values(depositTx);
        }
      }

      // Return updated booking details (same shape as GET /api/bookings/:id)
      const result = await tx
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

      // Auto-generate receipt if booking is now fully paid
      if (newPaymentStatus === 'paid') {
        try {
          // Check if receipt already exists for this booking
          const existingReceipts = await receiptService.getReceiptsByBooking(bookingId);
          if (existingReceipts.length === 0) {
            // Generate receipt automatically
            await receiptService.generateReceiptForBooking(bookingId);
            console.log(`Auto-generated receipt for booking ${bookingId} after payment was recorded`);
          }
        } catch (receiptError) {
          console.error(`Failed to auto-generate receipt for booking ${bookingId}:`, receiptError);
          // Don't fail the payment process if receipt generation fails
        }
      }

      return result[0]!;
    });

    return c.json({
      success: true,
      data: {
        id: updated.id,
        code: updated.code,
        clientId: updated.clientId,
        clientName: updated.clientName,
        clientEmail: updated.clientEmail,
        clientPhone: updated.clientPhone,
        hotelName: updated.hotelName,
        city: updated.city,
        checkIn: updated.checkIn,
        checkOut: updated.checkOut,
        totalAmount: updated.totalAmount,
        paymentStatus: updated.paymentStatus,
        bookingStatus: updated.bookingStatus,
        mealPlan: updated.mealPlan,
        meta: updated.meta,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
      message: 'Payment recorded successfully',
    });
  } catch (error) {
    console.error('Error recording payment:', error);
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

// DELETE /api/bookings/:id - Delete booking and related records
bookingRoutes.delete('/:id', requireAdmin, async (c) => {
  try {
    const bookingId = parseInt(c.req.param('id'));

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    const deletedBooking = await db.transaction(async (tx) => {
      const existing = await tx
        .select({
          id: bookings.id,
          code: bookings.code,
          clientId: bookings.clientId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);

      if (existing.length === 0) {
        return null;
      }

      // Get booking items to delete their pricing periods
      const itemsToDelete = await tx
        .select({ id: bookingItems.id })
        .from(bookingItems)
        .where(eq(bookingItems.bookingId, bookingId));

      // Delete pricing periods first
      if (itemsToDelete.length > 0) {
        const itemIds = itemsToDelete.map(item => item.id);
        await tx
          .delete(bookingItemPricingPeriods)
          .where(inArray(bookingItemPricingPeriods.bookingItemId, itemIds));
      }

      await tx.delete(bookingItems).where(eq(bookingItems.bookingId, bookingId));
      await tx.delete(invoices).where(eq(invoices.bookingId, bookingId));
      await tx.delete(vouchers).where(eq(vouchers.bookingId, bookingId));
      await tx.delete(operationalCosts).where(eq(operationalCosts.bookingId, bookingId));

      const [deleted] = await tx
        .delete(bookings)
        .where(eq(bookings.id, bookingId))
        .returning({
          id: bookings.id,
          code: bookings.code,
          clientId: bookings.clientId,
        });

      return deleted ?? null;
    });

    if (!deletedBooking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    return c.json({
      success: true,
      data: deletedBooking,
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return c.json({ error: 'Failed to delete booking' }, 500);
  }
});

export default bookingRoutes;
