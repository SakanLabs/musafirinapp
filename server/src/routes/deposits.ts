import { Hono } from 'hono';
import { db } from '../db/index.js';
import { clients, clientDeposits, depositTransactions } from '../db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';

const app = new Hono();

// GET /deposits/clients/:clientId/balance - Get client deposit balance
app.get('/clients/:clientId/balance', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('clientId'));
    
    if (isNaN(clientId)) {
      return c.json({ error: 'Invalid client ID' }, 400);
    }

    // Check if client exists
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (client.length === 0) {
      return c.json({ error: 'Client not found' }, 404);
    }

    // Get client deposit information
    const deposit = await db
      .select()
      .from(clientDeposits)
      .where(eq(clientDeposits.clientId, clientId))
      .limit(1);

    if (deposit.length === 0) {
      // Create initial deposit record if doesn't exist
      const newDeposit = await db
        .insert(clientDeposits)
        .values({
          clientId,
          currentBalance: '0',
          totalDeposited: '0',
          totalUsed: '0',
          currency: 'SAR',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return c.json({
        success: true,
        data: {
          clientId,
          clientName: client[0]?.name || '',
          ...newDeposit[0],
        },
      });
    }

    return c.json({
      success: true,
      data: {
        clientId,
        clientName: client[0]?.name || '',
        ...deposit[0],
      },
    });
  } catch (error) {
    console.error('Error fetching client balance:', error);
    return c.json({ error: 'Failed to fetch client balance' }, 500);
  }
});

// POST /deposits/clients/:clientId/add - Add deposit to client account
app.post('/clients/:clientId/add', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('clientId'));
    const body = await c.req.json();
    
    if (isNaN(clientId)) {
      return c.json({ error: 'Invalid client ID' }, 400);
    }

    // Validate required fields
    if (!body.amount || parseFloat(body.amount) <= 0) {
      return c.json({ error: 'Valid amount is required' }, 400);
    }

    const amount = parseFloat(body.amount);
    const description = body.description || 'Manual deposit';
    const referenceNumber = body.referenceNumber;
    const processedBy = body.processedBy || 'Admin';

    // Check if client exists
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (client.length === 0) {
      return c.json({ error: 'Client not found' }, 404);
    }

    // Get current deposit record or create if doesn't exist
    let currentDeposit = await db
      .select()
      .from(clientDeposits)
      .where(eq(clientDeposits.clientId, clientId))
      .limit(1);

    if (currentDeposit.length === 0) {
      // Create initial deposit record
      await db
        .insert(clientDeposits)
        .values({
          clientId,
          currentBalance: '0',
          totalDeposited: '0',
          totalUsed: '0',
          currency: 'SAR',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      currentDeposit = await db
        .select()
        .from(clientDeposits)
        .where(eq(clientDeposits.clientId, clientId))
        .limit(1);
    }

    const currentBalance = parseFloat(currentDeposit[0]?.currentBalance || '0');
    const totalDeposited = parseFloat(currentDeposit[0]?.totalDeposited || '0');
    const newBalance = currentBalance + amount;
    const newTotalDeposited = totalDeposited + amount;

    // Start transaction
    let createdTx: any = null;
    await db.transaction(async (tx) => {
      // Update client deposit balance
      await tx
        .update(clientDeposits)
        .set({
          currentBalance: newBalance.toString(),
          totalDeposited: newTotalDeposited.toString(),
          lastTransactionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientDeposits.clientId, clientId));

      // Record the transaction
      const inserted = await tx
        .insert(depositTransactions)
        .values({
          clientId,
          type: 'deposit',
          amount: amount.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          currency: 'SAR',
          status: 'completed',
          description,
          referenceNumber,
          processedBy,
          processedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      createdTx = inserted[0];
    });

    return c.json({ success: true, data: createdTx }, 201);
  } catch (error) {
    console.error('Error adding deposit:', error);
    return c.json({ error: 'Failed to add deposit' }, 500);
  }
});

// GET /deposits/clients/:clientId/transactions - Get client transaction history
app.get('/clients/:clientId/transactions', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('clientId'));
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const type = c.req.query('type'); // filter by transaction type
    
    if (isNaN(clientId)) {
      return c.json({ error: 'Invalid client ID' }, 400);
    }

    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [eq(depositTransactions.clientId, clientId)];
    
    if (type && ['deposit', 'usage', 'refund', 'adjustment'].includes(type)) {
      whereConditions.push(eq(depositTransactions.type, type as any));
    }

    const whereClause = and(...whereConditions);

    // Get transactions
    const transactions = await db
      .select()
      .from(depositTransactions)
      .where(whereClause)
      .orderBy(desc(depositTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(depositTransactions)
      .where(whereClause);
    
    const totalCount = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return c.json({
      success: true,
      data: transactions,
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
    console.error('Error fetching transactions:', error);
    return c.json({ error: 'Failed to fetch transactions' }, 500);
  }
});

// POST /deposits/clients/:clientId/refund - Process refund for client
app.post('/clients/:clientId/refund', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('clientId'));
    const body = await c.req.json();
    
    if (isNaN(clientId)) {
      return c.json({ error: 'Invalid client ID' }, 400);
    }

    // Validate required fields
    if (!body.amount || parseFloat(body.amount) <= 0) {
      return c.json({ error: 'Valid amount is required' }, 400);
    }

    const amount = parseFloat(body.amount);
    const description = body.description || 'Manual refund';
    const referenceNumber = body.referenceNumber;
    const processedBy = body.processedBy || 'Admin';

    // Check if client exists
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (client.length === 0) {
      return c.json({ error: 'Client not found' }, 404);
    }

    // Get current deposit record
    const currentDeposit = await db
      .select()
      .from(clientDeposits)
      .where(eq(clientDeposits.clientId, clientId))
      .limit(1);

    if (currentDeposit.length === 0) {
      return c.json({ error: 'Client has no deposit record' }, 400);
    }

    const currentBalance = parseFloat(currentDeposit[0]?.currentBalance || '0');
    
    if (currentBalance < amount) {
      return c.json({ error: 'Insufficient balance for refund' }, 400);
    }

    const totalUsed = parseFloat(currentDeposit[0]?.totalUsed || '0');
    const newBalance = currentBalance - amount;
    const newTotalUsed = totalUsed + amount;

    // Start transaction
    let createdTx: any = null;
    await db.transaction(async (tx) => {
      // Update client deposit balance
      await tx
        .update(clientDeposits)
        .set({
          currentBalance: newBalance.toString(),
          totalUsed: newTotalUsed.toString(),
          lastTransactionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientDeposits.clientId, clientId));

      // Record the transaction
      const inserted = await tx
        .insert(depositTransactions)
        .values({
          clientId,
          type: 'refund',
          amount: amount.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          currency: 'SAR',
          status: 'completed',
          description,
          referenceNumber,
          processedBy,
          processedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      createdTx = inserted[0];
    });

    return c.json({ success: true, data: createdTx });
  } catch (error) {
    console.error('Error processing refund:', error);
    return c.json({ error: 'Failed to process refund' }, 500);
  }
});

// POST /deposits/clients/:clientId/adjustment - Process balance adjustment
app.post('/clients/:clientId/adjustment', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('clientId'));
    const body = await c.req.json();
    
    if (isNaN(clientId)) {
      return c.json({ error: 'Invalid client ID' }, 400);
    }

    // Validate required fields
    if (!body.amount || parseFloat(body.amount) === 0) {
      return c.json({ error: 'Valid amount is required' }, 400);
    }

    const amount = parseFloat(body.amount);
    const description = body.description || 'Balance adjustment';
    const referenceNumber = body.referenceNumber;
    const processedBy = body.processedBy || 'Admin';

    // Check if client exists
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (client.length === 0) {
      return c.json({ error: 'Client not found' }, 404);
    }

    // Get current deposit record
    const currentDeposit = await db
      .select()
      .from(clientDeposits)
      .where(eq(clientDeposits.clientId, clientId))
      .limit(1);

    if (currentDeposit.length === 0) {
      return c.json({ error: 'Client has no deposit record' }, 400);
    }

    const currentBalance = parseFloat(currentDeposit[0]?.currentBalance || '0');
    const newBalance = currentBalance + amount;

    if (newBalance < 0) {
      return c.json({ error: 'Adjustment would result in negative balance' }, 400);
    }

    // Update totals based on adjustment direction
    let totalDeposited = parseFloat(currentDeposit[0]?.totalDeposited || '0');
    let totalUsed = parseFloat(currentDeposit[0]?.totalUsed || '0');

    if (amount > 0) {
      totalDeposited += amount;
    } else {
      totalUsed += Math.abs(amount);
    }

    // Start transaction
    let createdTx: any = null;
    await db.transaction(async (tx) => {
      // Update client deposit balance
      await tx
        .update(clientDeposits)
        .set({
          currentBalance: newBalance.toString(),
          totalDeposited: totalDeposited.toString(),
          totalUsed: totalUsed.toString(),
          lastTransactionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientDeposits.clientId, clientId));

      // Record the transaction
      const inserted = await tx
        .insert(depositTransactions)
        .values({
          clientId,
          type: 'adjustment',
          amount: amount.toString(),
          balanceBefore: currentBalance.toString(),
          balanceAfter: newBalance.toString(),
          currency: 'SAR',
          status: 'completed',
          description,
          referenceNumber,
          processedBy,
          processedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      createdTx = inserted[0];
    });

    return c.json({ success: true, data: createdTx });
  } catch (error) {
    console.error('Error processing adjustment:', error);
    return c.json({ error: 'Failed to process adjustment' }, 500);
  }
});

// PATCH /deposits/clients/:clientId/transactions/:transactionId - Edit a deposit transaction (metadata and amount)
app.patch('/clients/:clientId/transactions/:transactionId', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('clientId'));
    const transactionId = parseInt(c.req.param('transactionId'));
    const body = await c.req.json();

    if (isNaN(clientId) || isNaN(transactionId)) {
      return c.json({ error: 'Invalid client or transaction ID' }, 400);
    }

    // Ensure transaction exists and belongs to client
    const existing = await db
      .select()
      .from(depositTransactions)
      .where(and(eq(depositTransactions.id, transactionId), eq(depositTransactions.clientId, clientId)))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const txRow = existing[0] as any;
    const oldAmount = parseFloat(txRow.amount || '0');
    const txType: 'deposit' | 'refund' | 'adjustment' = txRow.type;
    // Only allow editing supported types (block usage edits)
    if (!['deposit', 'refund', 'adjustment'].includes(txType)) {
      return c.json({ error: 'Editing this transaction type is not allowed' }, 400);
    }
    const balanceBefore = parseFloat(txRow.balanceBefore || '0');

    // Prepare updates for transaction row
    const updates: any = {};
    if (typeof body.description === 'string') {
      updates.description = body.description;
    }
    if (typeof body.referenceNumber === 'string') {
      updates.referenceNumber = body.referenceNumber;
    }
    if (typeof body.processedBy === 'string') {
      updates.processedBy = body.processedBy;
    }

    const hasAmountUpdate = body.amount !== undefined && body.amount !== null;
    let newAmount = oldAmount;

    if (hasAmountUpdate) {
      newAmount = parseFloat(body.amount);
      if (isNaN(newAmount)) {
        return c.json({ error: 'Amount must be a valid number' }, 400);
      }
      // Business rules
      if (txType === 'deposit' || txType === 'refund') {
        if (newAmount <= 0) {
          return c.json({ error: 'Amount must be greater than 0' }, 400);
        }
      }
      // For adjustment, allow positive or negative including zero? zero yields no change, but allow to simplify
      // We'll permit zero to set no-op adjustment; balances are handled by delta calculation.
    }

    // If only metadata changes, update transaction and return
    if (!hasAmountUpdate) {
      if (Object.keys(updates).length === 0) {
        return c.json({ error: 'No editable fields provided' }, 400);
      }
      updates.updatedAt = new Date();
      const updated = await db
        .update(depositTransactions)
        .set(updates)
        .where(eq(depositTransactions.id, transactionId))
        .returning();
      return c.json({ success: true, data: updated[0] });
    }

    // Amount update requires adjusting client deposit aggregates
    // Fetch current deposit aggregates
    const depositRows = await db
      .select()
      .from(clientDeposits)
      .where(eq(clientDeposits.clientId, clientId))
      .limit(1);

    if (depositRows.length === 0) {
      return c.json({ error: 'Client has no deposit record' }, 400);
    }

    const current = depositRows[0] as any;
    let currentBalance = parseFloat(current.currentBalance || '0');
    let totalDeposited = parseFloat(current.totalDeposited || '0');
    let totalUsed = parseFloat(current.totalUsed || '0');

    // Effects: deposit = +amount; refund = -amount; adjustment = +amount
    const oldEffect = txType === 'refund' ? -oldAmount : oldAmount;
    const newEffect = txType === 'refund' ? -newAmount : newAmount;
    const deltaEffect = newEffect - oldEffect;

    const newBalance = currentBalance + deltaEffect;
    if (newBalance < 0) {
      return c.json({ error: 'Edit would result in negative balance' }, 400);
    }

    // Totals adjustments
    if (txType === 'deposit') {
      totalDeposited = totalDeposited + (newAmount - oldAmount);
      if (totalDeposited < 0) totalDeposited = 0;
    } else if (txType === 'refund') {
      totalUsed = totalUsed + (newAmount - oldAmount);
      if (totalUsed < 0) totalUsed = 0;
    } else {
      // adjustment: remove old contribution, add new contribution
      totalDeposited = totalDeposited + Math.max(newAmount, 0) - Math.max(oldAmount, 0);
      totalUsed = totalUsed + Math.abs(Math.min(newAmount, 0)) - Math.abs(Math.min(oldAmount, 0));
      if (totalDeposited < 0) totalDeposited = 0;
      if (totalUsed < 0) totalUsed = 0;
    }

    // New transaction balanceAfter based on its own balanceBefore snapshot
    const newTxBalanceAfter =
      txType === 'refund' ? (balanceBefore - newAmount) : (balanceBefore + newAmount);

    // Apply transactional updates
    let updatedTx: any = null;
    await db.transaction(async (tx) => {
      // Update aggregates
      await tx
        .update(clientDeposits)
        .set({
          currentBalance: newBalance.toString(),
          totalDeposited: totalDeposited.toString(),
          totalUsed: totalUsed.toString(),
          lastTransactionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientDeposits.clientId, clientId));

      // Update transaction
      updatedTx = (
        await tx
          .update(depositTransactions)
          .set({
            amount: newAmount.toString(),
            balanceAfter: newTxBalanceAfter.toString(),
            ...(updates || {}),
            updatedAt: new Date(),
          })
          .where(eq(depositTransactions.id, transactionId))
          .returning()
      )[0];
    });

    return c.json({ success: true, data: updatedTx });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return c.json({ error: 'Failed to update transaction' }, 500);
  }
});

// DELETE /deposits/clients/:clientId/transactions/:transactionId - Delete a transaction and reverse its effect
app.delete('/clients/:clientId/transactions/:transactionId', requireAdmin, async (c) => {
  try {
    const clientId = parseInt(c.req.param('clientId'));
    const transactionId = parseInt(c.req.param('transactionId'));

    if (isNaN(clientId) || isNaN(transactionId)) {
      return c.json({ error: 'Invalid client or transaction ID' }, 400);
    }

    // Fetch transaction
    const existing = await db
      .select()
      .from(depositTransactions)
      .where(and(eq(depositTransactions.id, transactionId), eq(depositTransactions.clientId, clientId)))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const txRow = existing[0] as any;
    const txType: 'deposit' | 'refund' | 'adjustment' = txRow.type;
    // Only allow deleting supported types (block usage deletions)
    if (!['deposit', 'refund', 'adjustment'].includes(txType)) {
      return c.json({ error: 'Deleting this transaction type is not allowed' }, 400);
    }
    const amount = parseFloat(txRow.amount || '0');

    // Fetch current deposit aggregates
    const depositRows = await db
      .select()
      .from(clientDeposits)
      .where(eq(clientDeposits.clientId, clientId))
      .limit(1);

    if (depositRows.length === 0) {
      return c.json({ error: 'Client has no deposit record' }, 400);
    }

    const current = depositRows[0] as any;
    let currentBalance = parseFloat(current.currentBalance || '0');
    let totalDeposited = parseFloat(current.totalDeposited || '0');
    let totalUsed = parseFloat(current.totalUsed || '0');

    // Reverse effect
    let newBalance = currentBalance;
    if (txType === 'deposit') {
      newBalance = currentBalance - amount;
      totalDeposited = totalDeposited - amount;
    } else if (txType === 'refund') {
      newBalance = currentBalance + amount;
      totalUsed = totalUsed - amount;
    } else {
      // adjustment
      newBalance = currentBalance - amount;
      if (amount > 0) {
        totalDeposited = totalDeposited - amount;
      } else {
        totalUsed = totalUsed - Math.abs(amount);
      }
    }

    if (newBalance < 0) {
      return c.json({ error: 'Delete would result in negative balance' }, 400);
    }
    if (totalDeposited < 0) totalDeposited = 0;
    if (totalUsed < 0) totalUsed = 0;

    await db.transaction(async (tx) => {
      await tx
        .update(clientDeposits)
        .set({
          currentBalance: newBalance.toString(),
          totalDeposited: totalDeposited.toString(),
          totalUsed: totalUsed.toString(),
          lastTransactionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientDeposits.clientId, clientId));

      await tx
        .delete(depositTransactions)
        .where(eq(depositTransactions.id, transactionId));
    });

    return c.json({ success: true, data: { deletedId: transactionId } });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return c.json({ error: 'Failed to delete transaction' }, 500);
  }
});

// GET /deposits/summary - Get overall deposit summary statistics
app.get('/summary', requireAdmin, async (c) => {
  try {
    // Get overall statistics
    const summary = await db
      .select({
        totalClients: sql<number>`count(distinct ${clientDeposits.clientId})`,
        totalBalance: sql<number>`sum(${clientDeposits.currentBalance})`,
        totalDeposited: sql<number>`sum(${clientDeposits.totalDeposited})`,
        totalUsed: sql<number>`sum(${clientDeposits.totalUsed})`,
      })
      .from(clientDeposits);

    // Get transaction statistics
    const transactionStats = await db
      .select({
        totalTransactions: sql<number>`count(*)`,
        depositCount: sql<number>`sum(case when ${depositTransactions.type} = 'deposit' then 1 else 0 end)`,
        usageCount: sql<number>`sum(case when ${depositTransactions.type} = 'usage' then 1 else 0 end)`,
        refundCount: sql<number>`sum(case when ${depositTransactions.type} = 'refund' then 1 else 0 end)`,
        adjustmentCount: sql<number>`sum(case when ${depositTransactions.type} = 'adjustment' then 1 else 0 end)`,
      })
      .from(depositTransactions);

    return c.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalClients: 0,
          totalBalance: 0,
          totalDeposited: 0,
          totalUsed: 0,
        },
        transactionStats: transactionStats[0] || {
          totalTransactions: 0,
          depositCount: 0,
          usageCount: 0,
          refundCount: 0,
          adjustmentCount: 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching deposit summary:', error);
    return c.json({ error: 'Failed to fetch deposit summary' }, 500);
  }
});

export default app;