import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { hotelCostTemplates, operationalCosts } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import type { NewHotelCostTemplate, NewOperationalCost } from '../db/schema';

const app = new Hono();

// ===== HOTEL COST TEMPLATES =====

/**
 * GET /costs/hotel-templates
 * Get all hotel cost templates
 */
app.get('/hotel-templates', requireAdmin, async (c) => {
  try {
    const templates = await db
      .select()
      .from(hotelCostTemplates)
      .orderBy(desc(hotelCostTemplates.createdAt));

    return c.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching hotel cost templates:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch hotel cost templates',
    }, 500);
  }
});

/**
 * GET /costs/hotel-templates/:id
 * Get hotel cost template by ID
 */
app.get('/hotel-templates/:id', requireAdmin, async (c) => {
  try {
    const templateId = parseInt(c.req.param('id'));

    if (!templateId || isNaN(templateId)) {
      return c.json({ error: 'Invalid template ID' }, 400);
    }

    const template = await db
      .select()
      .from(hotelCostTemplates)
      .where(eq(hotelCostTemplates.id, templateId))
      .limit(1);

    if (template.length === 0) {
      return c.json({ error: 'Hotel cost template not found' }, 404);
    }

    return c.json({
      success: true,
      data: template[0],
    });
  } catch (error) {
    console.error('Error fetching hotel cost template:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch hotel cost template',
    }, 500);
  }
});

/**
 * POST /costs/hotel-templates
 * Create new hotel cost template
 */
app.post('/hotel-templates', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { hotelName, city, roomType, costPrice } = body;

    // Validate required fields
    if (!hotelName || !city || !roomType || costPrice === undefined) {
      return c.json({ 
        error: 'Missing required fields: hotelName, city, roomType, costPrice' 
      }, 400);
    }

    // Validate city enum
    if (!['Makkah', 'Madinah'].includes(city)) {
      return c.json({ error: 'City must be either Makkah or Madinah' }, 400);
    }

    // Validate cost price
    if (typeof costPrice !== 'number' || costPrice < 0) {
      return c.json({ error: 'Cost price must be a positive number' }, 400);
    }

    // Check if template already exists for this combination
    const existingTemplate = await db
      .select()
      .from(hotelCostTemplates)
      .where(
        and(
          eq(hotelCostTemplates.hotelName, hotelName),
          eq(hotelCostTemplates.city, city),
          eq(hotelCostTemplates.roomType, roomType)
        )
      )
      .limit(1);

    if (existingTemplate.length > 0) {
      return c.json({ 
        error: 'Hotel cost template already exists for this hotel, city, and room type combination' 
      }, 400);
    }

    const newTemplate: NewHotelCostTemplate = {
      hotelName,
      city,
      roomType,
      costPrice: costPrice.toString(),
    };

    const [insertedTemplate] = await db
      .insert(hotelCostTemplates)
      .values(newTemplate)
      .returning();

    return c.json({
      success: true,
      data: insertedTemplate,
      message: 'Hotel cost template created successfully',
    }, 201);
  } catch (error) {
    console.error('Error creating hotel cost template:', error);
    return c.json({
      success: false,
      error: 'Failed to create hotel cost template',
    }, 500);
  }
});

/**
 * PUT /costs/hotel-templates/:id
 * Update hotel cost template
 */
app.put('/hotel-templates/:id', requireAdmin, async (c) => {
  try {
    const templateId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { hotelName, city, roomType, costPrice } = body;

    if (!templateId || isNaN(templateId)) {
      return c.json({ error: 'Invalid template ID' }, 400);
    }

    // Validate required fields
    if (!hotelName || !city || !roomType || costPrice === undefined) {
      return c.json({ 
        error: 'Missing required fields: hotelName, city, roomType, costPrice' 
      }, 400);
    }

    // Validate city enum
    if (!['Makkah', 'Madinah'].includes(city)) {
      return c.json({ error: 'City must be either Makkah or Madinah' }, 400);
    }

    // Validate cost price
    if (typeof costPrice !== 'number' || costPrice < 0) {
      return c.json({ error: 'Cost price must be a positive number' }, 400);
    }

    // Check if template exists
    const existingTemplate = await db
      .select()
      .from(hotelCostTemplates)
      .where(eq(hotelCostTemplates.id, templateId))
      .limit(1);

    if (existingTemplate.length === 0) {
      return c.json({ error: 'Hotel cost template not found' }, 404);
    }

    const [updatedTemplate] = await db
      .update(hotelCostTemplates)
      .set({
        hotelName,
        city,
        roomType,
        costPrice: costPrice.toString(),
        updatedAt: new Date(),
      })
      .where(eq(hotelCostTemplates.id, templateId))
      .returning();

    return c.json({
      success: true,
      data: updatedTemplate,
      message: 'Hotel cost template updated successfully',
    });
  } catch (error) {
    console.error('Error updating hotel cost template:', error);
    return c.json({
      success: false,
      error: 'Failed to update hotel cost template',
    }, 500);
  }
});

/**
 * DELETE /costs/hotel-templates/:id
 * Delete hotel cost template
 */
app.delete('/hotel-templates/:id', requireAdmin, async (c) => {
  try {
    const templateId = parseInt(c.req.param('id'));

    if (!templateId || isNaN(templateId)) {
      return c.json({ error: 'Invalid template ID' }, 400);
    }

    // Check if template exists
    const existingTemplate = await db
      .select()
      .from(hotelCostTemplates)
      .where(eq(hotelCostTemplates.id, templateId))
      .limit(1);

    if (existingTemplate.length === 0) {
      return c.json({ error: 'Hotel cost template not found' }, 404);
    }

    await db
      .delete(hotelCostTemplates)
      .where(eq(hotelCostTemplates.id, templateId));

    return c.json({
      success: true,
      message: 'Hotel cost template deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting hotel cost template:', error);
    return c.json({
      success: false,
      error: 'Failed to delete hotel cost template',
    }, 500);
  }
});

// ===== OPERATIONAL COSTS =====

/**
 * GET /costs/operational
 * Get operational costs with optional booking filter
 */
app.get('/operational', requireAdmin, async (c) => {
  try {
    const bookingId = c.req.query('bookingId');
    
    let costs;
    
    if (bookingId) {
      const bookingIdNum = parseInt(bookingId);
      if (!isNaN(bookingIdNum)) {
        costs = await db
          .select()
          .from(operationalCosts)
          .where(eq(operationalCosts.bookingId, bookingIdNum))
          .orderBy(desc(operationalCosts.createdAt));
      } else {
        costs = await db
          .select()
          .from(operationalCosts)
          .orderBy(desc(operationalCosts.createdAt));
      }
    } else {
      costs = await db
        .select()
        .from(operationalCosts)
        .orderBy(desc(operationalCosts.createdAt));
    }

    return c.json({
      success: true,
      data: costs,
    });
  } catch (error) {
    console.error('Error fetching operational costs:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch operational costs',
    }, 500);
  }
});

/**
 * POST /costs/operational
 * Create new operational cost
 */
app.post('/operational', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { bookingId, costType, amount, description } = body;

    // Validate required fields
    if (!bookingId || !costType || amount === undefined) {
      return c.json({ 
        error: 'Missing required fields: bookingId, costType, amount' 
      }, 400);
    }

    // Validate amount
    if (typeof amount !== 'number' || amount < 0) {
      return c.json({ error: 'Amount must be a positive number' }, 400);
    }

    const newCost: NewOperationalCost = {
      bookingId,
      costType,
      amount: amount.toString(),
      description: description || null,
    };

    const [insertedCost] = await db
      .insert(operationalCosts)
      .values(newCost)
      .returning();

    return c.json({
      success: true,
      data: insertedCost,
      message: 'Operational cost created successfully',
    }, 201);
  } catch (error) {
    console.error('Error creating operational cost:', error);
    return c.json({
      success: false,
      error: 'Failed to create operational cost',
    }, 500);
  }
});

/**
 * PUT /costs/operational/:id
 * Update operational cost
 */
app.put('/operational/:id', requireAdmin, async (c) => {
  try {
    const costId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { costType, amount, description } = body;

    if (!costId || isNaN(costId)) {
      return c.json({ error: 'Invalid cost ID' }, 400);
    }

    // Validate required fields
    if (!costType || amount === undefined) {
      return c.json({ 
        error: 'Missing required fields: costType, amount' 
      }, 400);
    }

    // Validate amount
    if (typeof amount !== 'number' || amount < 0) {
      return c.json({ error: 'Amount must be a positive number' }, 400);
    }

    // Check if cost exists
    const existingCost = await db
      .select()
      .from(operationalCosts)
      .where(eq(operationalCosts.id, costId))
      .limit(1);

    if (existingCost.length === 0) {
      return c.json({ error: 'Operational cost not found' }, 404);
    }

    const [updatedCost] = await db
      .update(operationalCosts)
      .set({
        costType,
        amount: amount.toString(),
        description: description || null,
        updatedAt: new Date(),
      })
      .where(eq(operationalCosts.id, costId))
      .returning();

    return c.json({
      success: true,
      data: updatedCost,
      message: 'Operational cost updated successfully',
    });
  } catch (error) {
    console.error('Error updating operational cost:', error);
    return c.json({
      success: false,
      error: 'Failed to update operational cost',
    }, 500);
  }
});

/**
 * DELETE /costs/operational/:id
 * Delete operational cost
 */
app.delete('/operational/:id', requireAdmin, async (c) => {
  try {
    const costId = parseInt(c.req.param('id'));

    if (!costId || isNaN(costId)) {
      return c.json({ error: 'Invalid cost ID' }, 400);
    }

    // Check if cost exists
    const existingCost = await db
      .select()
      .from(operationalCosts)
      .where(eq(operationalCosts.id, costId))
      .limit(1);

    if (existingCost.length === 0) {
      return c.json({ error: 'Operational cost not found' }, 404);
    }

    await db
      .delete(operationalCosts)
      .where(eq(operationalCosts.id, costId));

    return c.json({
      success: true,
      message: 'Operational cost deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting operational cost:', error);
    return c.json({
      success: false,
      error: 'Failed to delete operational cost',
    }, 500);
  }
});

export default app;