import { Hono } from 'hono';
import { db } from '../db/index.js';
import { clients, clientDeposits, depositTransactions, bookings } from '../db/schema.js';
import { eq, desc, sql, and, or, ilike } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';

const app = new Hono();

// GET /clients - List all clients with pagination and search
app.get('/', requireAdmin, async (c) => {
  try {
    // Get query parameters
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const search = c.req.query('search');
    const activeParam = c.req.query('active');
    const active = activeParam === 'true' ? true : activeParam === 'false' ? false : undefined;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [];
    
    if (search) {
      whereConditions.push(
        or(
          ilike(clients.name, `%${search}%`),
          ilike(clients.email, `%${search}%`),
          ilike(clients.phone, `%${search}%`)
        )
      );
    }
    
    if (active !== undefined) {
      whereConditions.push(eq(clients.isActive, active));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get clients with their deposit information
    const clientsWithDeposits = await db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        phone: clients.phone,
        address: clients.address,
        notes: clients.notes,
        isActive: clients.isActive,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        currentBalance: clientDeposits.currentBalance,
        totalDeposited: clientDeposits.totalDeposited,
        totalUsed: clientDeposits.totalUsed,
        currency: clientDeposits.currency,
        lastTransactionAt: clientDeposits.lastTransactionAt,
      })
      .from(clients)
      .leftJoin(clientDeposits, eq(clients.id, clientDeposits.clientId))
      .where(whereClause)
      .orderBy(desc(clients.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(whereClause);
    
    const totalCount = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return c.json({
      clients: clientsWithDeposits,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return c.json({ error: 'Failed to fetch clients' }, 500);
  }
});

// GET /clients/:id - Get client by ID with detailed information
app.get('/:id', async (c) => {
  try {
    const clientId = parseInt(c.req.param('id'));
    
    if (isNaN(clientId)) {
      return c.json({ error: 'Invalid client ID' }, 400);
    }

    // Get client with deposit information
    const clientWithDeposit = await db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        phone: clients.phone,
        address: clients.address,
        notes: clients.notes,
        isActive: clients.isActive,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        currentBalance: clientDeposits.currentBalance,
        totalDeposited: clientDeposits.totalDeposited,
        totalUsed: clientDeposits.totalUsed,
        currency: clientDeposits.currency,
        lastTransactionAt: clientDeposits.lastTransactionAt,
      })
      .from(clients)
      .leftJoin(clientDeposits, eq(clients.id, clientDeposits.clientId))
      .where(eq(clients.id, clientId))
      .limit(1);

    if (clientWithDeposit.length === 0) {
      return c.json({ error: 'Client not found' }, 404);
    }

    // Get recent bookings for this client
    const recentBookings = await db
      .select({
        id: bookings.id,
        code: bookings.code,
        hotelName: bookings.hotelName,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        totalAmount: bookings.totalAmount,
        bookingStatus: bookings.bookingStatus,
        mealPlan: bookings.mealPlan,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .where(eq(bookings.clientId, clientId))
      .orderBy(desc(bookings.createdAt));

    // Get recent deposit transactions
    const recentTransactions = await db
      .select()
      .from(depositTransactions)
      .where(eq(depositTransactions.clientId, clientId))
      .orderBy(desc(depositTransactions.createdAt))
      .limit(10);

    return c.json({
      client: clientWithDeposit[0],
      recentBookings,
      recentTransactions,
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    return c.json({ error: 'Failed to fetch client' }, 500);
  }
});

// POST /clients - Create new client
app.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    
    // Basic validation
    if (!body.name || !body.phone) {
      return c.json({ error: 'Name and phone are required' }, 400);
    }

    // Check if client with same email or phone already exists
    if (body.email) {
      const existingClient = await db
        .select()
        .from(clients)
        .where(
          or(
            eq(clients.email, body.email),
            eq(clients.phone, body.phone)
          )
        )
        .limit(1);

      if (existingClient.length > 0) {
        return c.json({ 
          error: 'Client with this email or phone already exists' 
        }, 400);
      }
    }

    // Create new client
    const newClient = await db
      .insert(clients)
      .values({
        name: body.name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        notes: body.notes,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create initial deposit record with zero balance
    if (newClient[0]) {
      await db
        .insert(clientDeposits)
        .values({
          clientId: newClient[0].id,
          currentBalance: '0',
          totalDeposited: '0',
          totalUsed: '0',
          currency: 'SAR',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      return c.json({ 
        message: 'Client created successfully', 
        client: newClient[0] 
      }, 201);
    } else {
      return c.json({ error: 'Failed to create client' }, 500);
    }
  } catch (error) {
    console.error('Error creating client:', error);
    return c.json({ error: 'Failed to create client' }, 500);
  }
});

// PUT /clients/:id - Update client
app.put('/:id', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    if (isNaN(clientId)) {
      return c.json({ error: 'Invalid client ID' }, 400);
    }

    // Check if client exists
    const existingClient = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (existingClient.length === 0) {
      return c.json({ error: 'Client not found' }, 404);
    }

    // Check for duplicate email/phone if being updated
    if (body.email || body.phone) {
      const duplicateCheck = await db
        .select()
        .from(clients)
        .where(
          and(
            or(
              body.email ? eq(clients.email, body.email) : undefined,
              body.phone ? eq(clients.phone, body.phone) : undefined
            ),
            sql`${clients.id} != ${clientId}`
          )
        )
        .limit(1);

      if (duplicateCheck.length > 0) {
        return c.json({ 
          error: 'Another client with this email or phone already exists' 
        }, 400);
      }
    }

    // Update client
    const updatedClient = await db
      .update(clients)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning();

    return c.json({ 
      message: 'Client updated successfully', 
      client: updatedClient[0] 
    });
  } catch (error) {
    console.error('Error updating client:', error);
    return c.json({ error: 'Failed to update client' }, 500);
  }
});

// DELETE /clients/:id - Soft delete client (set isActive to false)
app.delete('/:id', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('id'));
    
    if (isNaN(clientId)) {
      return c.json({ error: 'Invalid client ID' }, 400);
    }

    // Check if client exists
    const existingClient = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (existingClient.length === 0) {
      return c.json({ error: 'Client not found' }, 404);
    }

    // Check if client has active bookings
    const activeBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.clientId, clientId),
          or(
            eq(bookings.bookingStatus, 'confirmed'),
            eq(bookings.bookingStatus, 'pending')
          )
        )
      )
      .limit(1);

    if (activeBookings.length > 0) {
      return c.json({ 
        error: 'Cannot delete client with active bookings' 
      }, 400);
    }

    // Soft delete by setting isActive to false
    await db
      .update(clients)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    return c.json({ message: 'Client deactivated successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    return c.json({ error: 'Failed to delete client' }, 500);
  }
});

// GET /clients/:id/stats - Get client statistics
app.get('/:id/stats', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('id'));
    
    if (isNaN(clientId)) {
      return c.json({ error: 'Invalid client ID' }, 400);
    }

    // Get booking statistics
    const bookingStats = await db
      .select({
        totalBookings: sql<number>`count(*)`,
        totalSpent: sql<number>`sum(${bookings.totalAmount})`,
        confirmedBookings: sql<number>`sum(case when ${bookings.bookingStatus} = 'confirmed' then 1 else 0 end)`,
        cancelledBookings: sql<number>`sum(case when ${bookings.bookingStatus} = 'cancelled' then 1 else 0 end)`,
      })
      .from(bookings)
      .where(eq(bookings.clientId, clientId));

    // Get deposit statistics
    const depositStats = await db
      .select({
        totalDeposits: sql<number>`sum(case when ${depositTransactions.type} = 'deposit' then ${depositTransactions.amount} else 0 end)`,
        totalUsage: sql<number>`sum(case when ${depositTransactions.type} = 'usage' then ${depositTransactions.amount} else 0 end)`,
        totalRefunds: sql<number>`sum(case when ${depositTransactions.type} = 'refund' then ${depositTransactions.amount} else 0 end)`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(depositTransactions)
      .where(eq(depositTransactions.clientId, clientId));

    return c.json({
      bookingStats: bookingStats[0] || {
        totalBookings: 0,
        totalSpent: 0,
        confirmedBookings: 0,
        cancelledBookings: 0,
      },
      depositStats: depositStats[0] || {
        totalDeposits: 0,
        totalUsage: 0,
        totalRefunds: 0,
        transactionCount: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching client stats:', error);
    return c.json({ error: 'Failed to fetch client statistics' }, 500);
  }
});

export default app;
