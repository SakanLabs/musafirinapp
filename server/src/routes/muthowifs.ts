import { Hono } from 'hono';
import { db } from '../db/index.js';
import { muthowifs, muthowifAssignments } from '../db/schema.js';
import { eq, desc, sql, and, or, ilike } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';

const app = new Hono();

// GET /muthowifs - List all muthowifs with optional status filter
app.get('/', requireAdmin, async (c) => {
  try {
    const status = c.req.query('status'); // 'idle', 'assigned', 'unavailable'
    
    const conditions = [];
    conditions.push(eq(muthowifs.isActive, true));
    if (status) {
      // @ts-ignore
      conditions.push(eq(muthowifs.status, status));
    }

    const data = await db
      .select()
      .from(muthowifs)
      .where(and(...conditions))
      .orderBy(desc(muthowifs.createdAt));

    return c.json({ muthowifs: data });
  } catch (error) {
    console.error('Error fetching muthowifs:', error);
    return c.json({ error: 'Failed to fetch muthowifs' }, 500);
  }
});

// GET /muthowifs/:id - Get specific muthowif with assignments
app.get('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const data = await db.select().from(muthowifs).where(eq(muthowifs.id, id)).limit(1);
    if (data.length === 0) return c.json({ error: 'Muthowif not found' }, 404);

    const assignments = await db
      .select()
      .from(muthowifAssignments)
      .where(eq(muthowifAssignments.muthowifId, id))
      .orderBy(desc(muthowifAssignments.createdAt));

    return c.json({ muthowif: data[0], assignments });
  } catch (error) {
    console.error('Error fetching muthowif:', error);
    return c.json({ error: 'Failed to fetch muthowif' }, 500);
  }
});

// POST /muthowifs - Create new muthowif
app.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.name || !body.phone || !body.visaStatus || !body.residentType) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const newRecord = await db.insert(muthowifs).values({
      name: body.name,
      phone: body.phone,
      iqamaOrPassportNo: body.iqamaOrPassportNo,
      visaStatus: body.visaStatus,
      residentType: body.residentType,
      residenceLocation: body.residenceLocation,
      lastEducation: body.lastEducation,
      status: 'idle',
      notes: body.notes,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Muthowif created successfully', muthowif: newRecord[0] }, 201);
  } catch (error) {
    console.error('Error creating muthowif:', error);
    return c.json({ error: 'Failed to create muthowif' }, 500);
  }
});

// PUT /muthowifs/:id - Update muthowif
app.put('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const updatedRecord = await db.update(muthowifs).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(muthowifs.id, id)).returning();

    if (updatedRecord.length === 0) return c.json({ error: 'Muthowif not found' }, 404);

    return c.json({ message: 'Muthowif updated successfully', muthowif: updatedRecord[0] });
  } catch (error) {
    console.error('Error updating muthowif:', error);
    return c.json({ error: 'Failed to update muthowif' }, 500);
  }
});

// DELETE /muthowifs/:id - Soft delete
app.delete('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    await db.update(muthowifs).set({ isActive: false, updatedAt: new Date() }).where(eq(muthowifs.id, id));
    
    return c.json({ message: 'Muthowif deactivated successfully' });
  } catch (error) {
    console.error('Error deleting muthowif:', error);
    return c.json({ error: 'Failed to delete muthowif' }, 500);
  }
});

// POST /muthowifs/assign - Assign muthowif
app.post('/assign', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.muthowifId || !body.referenceType || !body.referenceId || !body.startDate || !body.endDate) {
      return c.json({ error: 'Missing required assignment fields' }, 400);
    }

    // Wrap in transaction
    const result = await db.transaction(async (tx) => {
      // 1. Insert assignment
      const newAssignment = await tx.insert(muthowifAssignments).values({
        muthowifId: body.muthowifId,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        taskDescription: body.taskDescription,
        assignedBy: 'Admin', // TODO: Get from auth context
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // 2. Update status to assigned
      await tx.update(muthowifs).set({
        status: 'assigned',
        updatedAt: new Date(),
      }).where(eq(muthowifs.id, body.muthowifId));

      return newAssignment[0];
    });

    return c.json({ message: 'Muthowif assigned successfully', assignment: result });
  } catch (error) {
    console.error('Error assigning muthowif:', error);
    return c.json({ error: 'Failed to assign muthowif' }, 500);
  }
});

// POST /muthowifs/complete-task/:assignmentId
app.post('/complete-task/:assignmentId', requireAdmin, async (c) => {
  try {
    const assignmentId = parseInt(c.req.param('assignmentId'));
    if (isNaN(assignmentId)) return c.json({ error: 'Invalid assignment ID' }, 400);

    const result = await db.transaction(async (tx) => {
      const assignment = await tx.select().from(muthowifAssignments).where(eq(muthowifAssignments.id, assignmentId)).limit(1);
      if (assignment.length === 0) throw new Error('Assignment not found');

      // Update assignment
      await tx.update(muthowifAssignments).set({ status: 'completed', updatedAt: new Date() }).where(eq(muthowifAssignments.id, assignmentId));

      // Revert muthowif to idle
      await tx.update(muthowifs).set({ status: 'idle', updatedAt: new Date() }).where(eq(muthowifs.id, assignment[0]!.muthowifId));

      return true;
    });

    return c.json({ message: 'Task completed successfully' });
  } catch (error: any) {
    console.error('Error completing task:', error);
    return c.json({ error: error.message || 'Failed to complete task' }, 500);
  }
});

// GET /muthowifs/assignments/:referenceType/:referenceId
app.get('/assignments/:referenceType/:referenceId', requireAdmin, async (c) => {
  try {
    const referenceType = c.req.param('referenceType');
    const referenceId = parseInt(c.req.param('referenceId'));
    if (isNaN(referenceId)) return c.json({ error: 'Invalid reference ID' }, 400);

    const assignments = await db
      .select({
        id: muthowifAssignments.id,
        startDate: muthowifAssignments.startDate,
        endDate: muthowifAssignments.endDate,
        status: muthowifAssignments.status,
        taskDescription: muthowifAssignments.taskDescription,
        muthowif: muthowifs
      })
      .from(muthowifAssignments)
      .leftJoin(muthowifs, eq(muthowifAssignments.muthowifId, muthowifs.id))
      .where(
        and(
          eq(muthowifAssignments.referenceType, referenceType as any),
          eq(muthowifAssignments.referenceId, referenceId)
        )
      )
      .orderBy(desc(muthowifAssignments.createdAt));

    return c.json({ assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return c.json({ error: 'Failed to fetch assignments' }, 500);
  }
});

export default app;
