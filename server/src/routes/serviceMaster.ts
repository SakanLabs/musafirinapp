import { Hono } from 'hono';
import { db } from '../db/index.js';
import { serviceMaster } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';

const app = new Hono();

// GET /api/master/services - List all service master data
app.get('/', async (c) => {
  try {
    const services = await db.select().from(serviceMaster).orderBy(serviceMaster.category, serviceMaster.name);
    return c.json(services);
  } catch (error) {
    console.error('Error fetching service master:', error);
    return c.json({ error: 'Failed to fetch services' }, 500);
  }
});

// POST /api/master/services - Create new service
app.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    if (!body.category || !body.name || body.price === undefined) {
      return c.json({ error: 'Category, name, and price are required' }, 400);
    }

    const newService = await db.insert(serviceMaster).values({
      category: body.category,
      name: body.name,
      price: body.price.toString(),
      unitType: body.unitType || 'Per Grup',
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Service created', service: newService[0] }, 201);
  } catch (error) {
    console.error('Error creating service:', error);
    return c.json({ error: 'Failed to create service' }, 500);
  }
});

// PUT /api/master/services/:id - Update service
app.put('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid service ID' }, 400);
    
    const body = await c.req.json();
    const updateData: any = { ...body, updatedAt: new Date() };
    if (body.price !== undefined) updateData.price = body.price.toString();
    
    const updatedService = await db.update(serviceMaster).set(updateData)
      .where(eq(serviceMaster.id, id)).returning();

    if (updatedService.length === 0) return c.json({ error: 'Service not found' }, 404);

    return c.json({ message: 'Service updated', service: updatedService[0] });
  } catch (error) {
    console.error('Error updating service:', error);
    return c.json({ error: 'Failed to update service' }, 500);
  }
});

// DELETE /api/master/services/:id - Soft delete service
app.delete('/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid service ID' }, 400);
    
    const updatedService = await db.update(serviceMaster).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(serviceMaster.id, id)).returning();

    if (updatedService.length === 0) return c.json({ error: 'Service not found' }, 404);

    return c.json({ message: 'Service deactivated' });
  } catch (error) {
    console.error('Error deleting service:', error);
    return c.json({ error: 'Failed to delete service' }, 500);
  }
});

export default app;
