import { Hono } from 'hono';
import { db } from '../db/index.js';
import { hotels, hotelPricingPeriods, transportationRoutesMaster, transportationRoutePricingPeriods } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';

const app = new Hono();

// ==========================================
// HOTELS
// ==========================================

// GET /hotels - List all hotels
app.get('/hotels', async (c) => {
  try {
    const allHotels = await db.select().from(hotels).orderBy(hotels.name);
    return c.json(allHotels);
  } catch (error) {
    console.error('Error fetching hotels:', error);
    return c.json({ error: 'Failed to fetch hotels' }, 500);
  }
});

// POST /hotels - Create new hotel
app.post('/hotels', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.city) {
      return c.json({ error: 'Name and city are required' }, 400);
    }

    const newHotel = await db.insert(hotels).values({
      name: body.name,
      city: body.city,
      address: body.address,
      starRating: body.starRating,
      contactPerson: body.contactPerson,
      contactPhone: body.contactPhone,
      supplierName: body.supplierName,
      picName: body.picName,
      picContact: body.picContact,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Hotel created', hotel: newHotel[0] }, 201);
  } catch (error) {
    console.error('Error creating hotel:', error);
    return c.json({ error: 'Failed to create hotel' }, 500);
  }
});

// PUT /hotels/:id - Update hotel
app.put('/hotels/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid hotel ID' }, 400);
    
    const body = await c.req.json();
    
    const updatedHotel = await db.update(hotels).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(hotels.id, id)).returning();

    if (updatedHotel.length === 0) return c.json({ error: 'Hotel not found' }, 404);

    return c.json({ message: 'Hotel updated', hotel: updatedHotel[0] });
  } catch (error) {
    console.error('Error updating hotel:', error);
    return c.json({ error: 'Failed to update hotel' }, 500);
  }
});

// DELETE /hotels/:id - Soft delete hotel
app.delete('/hotels/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid hotel ID' }, 400);
    
    const updatedHotel = await db.update(hotels).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(hotels.id, id)).returning();

    if (updatedHotel.length === 0) return c.json({ error: 'Hotel not found' }, 404);

    return c.json({ message: 'Hotel deactivated' });
  } catch (error) {
    console.error('Error deleting hotel:', error);
    return c.json({ error: 'Failed to delete hotel' }, 500);
  }
});

// ==========================================
// HOTEL PRICING PERIODS
// ==========================================

// GET /hotels/:id/pricing - Get pricing periods for a hotel
app.get('/hotels/:id/pricing', async (c) => {
  try {
    const hotelId = parseInt(c.req.param('id'));
    if (isNaN(hotelId)) return c.json({ error: 'Invalid hotel ID' }, 400);

    const pricing = await db.select().from(hotelPricingPeriods)
      .where(eq(hotelPricingPeriods.hotelId, hotelId))
      .orderBy(hotelPricingPeriods.startDate);
      
    return c.json(pricing);
  } catch (error) {
    console.error('Error fetching hotel pricing periods:', error);
    return c.json({ error: 'Failed to fetch pricing periods' }, 500);
  }
});

// POST /hotels/:id/pricing - Add new pricing period
app.post('/hotels/:id/pricing', requireAdmin, async (c) => {
  try {
    const hotelId = parseInt(c.req.param('id'));
    if (isNaN(hotelId)) return c.json({ error: 'Invalid hotel ID' }, 400);
    
    const body = await c.req.json();
    if (!body.roomType || !body.startDate || !body.endDate || !body.costPrice || !body.sellingPrice) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const newPricing = await db.insert(hotelPricingPeriods).values({
      hotelId: hotelId,
      roomType: body.roomType,
      mealPlan: body.mealPlan || 'Room Only',
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      costPrice: body.costPrice.toString(),
      sellingPrice: body.sellingPrice.toString(),
      currency: body.currency || 'SAR',
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Pricing period added', pricing: newPricing[0] }, 201);
  } catch (error) {
    console.error('Error adding hotel pricing:', error);
    return c.json({ error: 'Failed to add pricing period' }, 500);
  }
});

// PUT /hotels/:hotelId/pricing/:id - Update pricing period
app.put('/hotels/:hotelId/pricing/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const hotelId = parseInt(c.req.param('hotelId'));
    if (isNaN(id) || isNaN(hotelId)) return c.json({ error: 'Invalid IDs' }, 400);
    
    const body = await c.req.json();
    
    const updateData: any = { ...body, updatedAt: new Date() };
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.costPrice !== undefined) updateData.costPrice = body.costPrice.toString();
    if (body.sellingPrice !== undefined) updateData.sellingPrice = body.sellingPrice.toString();

    const updatedPricing = await db.update(hotelPricingPeriods).set(updateData)
      .where(and(eq(hotelPricingPeriods.id, id), eq(hotelPricingPeriods.hotelId, hotelId)))
      .returning();

    if (updatedPricing.length === 0) return c.json({ error: 'Pricing period not found' }, 404);

    return c.json({ message: 'Pricing period updated', pricing: updatedPricing[0] });
  } catch (error) {
    console.error('Error updating pricing:', error);
    return c.json({ error: 'Failed to update pricing period' }, 500);
  }
});

// DELETE /hotels/:hotelId/pricing/:id - Soft delete pricing period
app.delete('/hotels/:hotelId/pricing/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const hotelId = parseInt(c.req.param('hotelId'));
    if (isNaN(id) || isNaN(hotelId)) return c.json({ error: 'Invalid IDs' }, 400);
    
    const updatedPricing = await db.update(hotelPricingPeriods).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(and(eq(hotelPricingPeriods.id, id), eq(hotelPricingPeriods.hotelId, hotelId)))
      .returning();

    if (updatedPricing.length === 0) return c.json({ error: 'Pricing period not found' }, 404);

    return c.json({ message: 'Pricing period deactivated' });
  } catch (error) {
    console.error('Error deleting pricing:', error);
    return c.json({ error: 'Failed to delete pricing period' }, 500);
  }
});

// ==========================================
// TRANSPORTATION ROUTES
// ==========================================

// GET /transport-routes - List all transport routes
app.get('/transport-routes', async (c) => {
  try {
    const routes = await db.select().from(transportationRoutesMaster).orderBy(transportationRoutesMaster.originLocation);
    return c.json(routes);
  } catch (error) {
    console.error('Error fetching transport routes:', error);
    return c.json({ error: 'Failed to fetch transport routes' }, 500);
  }
});

// POST /transport-routes - Create new transport route
app.post('/transport-routes', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    if (!body.originLocation || !body.destinationLocation) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const newRoute = await db.insert(transportationRoutesMaster).values({
      originLocation: body.originLocation,
      destinationLocation: body.destinationLocation,
      supplierName: body.supplierName,
      picName: body.picName,
      picContact: body.picContact,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Transport route created', route: newRoute[0] }, 201);
  } catch (error) {
    console.error('Error creating transport route:', error);
    return c.json({ error: 'Failed to create transport route' }, 500);
  }
});

// PUT /transport-routes/:id - Update transport route
app.put('/transport-routes/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid route ID' }, 400);
    
    const body = await c.req.json();
    const updateData: any = { ...body, updatedAt: new Date() };
    
    const updatedRoute = await db.update(transportationRoutesMaster).set(updateData)
      .where(eq(transportationRoutesMaster.id, id)).returning();

    if (updatedRoute.length === 0) return c.json({ error: 'Route not found' }, 404);

    return c.json({ message: 'Transport route updated', route: updatedRoute[0] });
  } catch (error) {
    console.error('Error updating transport route:', error);
    return c.json({ error: 'Failed to update transport route' }, 500);
  }
});

// DELETE /transport-routes/:id - Soft delete transport route
app.delete('/transport-routes/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid route ID' }, 400);
    
    const updatedRoute = await db.update(transportationRoutesMaster).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(transportationRoutesMaster.id, id)).returning();

    if (updatedRoute.length === 0) return c.json({ error: 'Route not found' }, 404);

    return c.json({ message: 'Transport route deactivated' });
  } catch (error) {
    console.error('Error deleting transport route:', error);
    return c.json({ error: 'Failed to delete transport route' }, 500);
  }
});

// ==========================================
// TRANSPORTATION ROUTE PRICING PERIODS
// ==========================================

// GET /transport-routes/:id/pricing - Get pricing periods for a route
app.get('/transport-routes/:id/pricing', async (c) => {
  try {
    const routeId = parseInt(c.req.param('id'));
    if (isNaN(routeId)) return c.json({ error: 'Invalid route ID' }, 400);

    const pricing = await db.select().from(transportationRoutePricingPeriods)
      .where(eq(transportationRoutePricingPeriods.transportationRouteMasterId, routeId))
      .orderBy(transportationRoutePricingPeriods.startDate);
      
    return c.json(pricing);
  } catch (error) {
    console.error('Error fetching transport pricing periods:', error);
    return c.json({ error: 'Failed to fetch pricing periods' }, 500);
  }
});

// POST /transport-routes/:id/pricing - Add new pricing period
app.post('/transport-routes/:id/pricing', requireAdmin, async (c) => {
  try {
    const routeId = parseInt(c.req.param('id'));
    if (isNaN(routeId)) return c.json({ error: 'Invalid route ID' }, 400);
    
    const body = await c.req.json();
    if (!body.vehicleType || !body.startDate || !body.endDate || !body.costPrice || !body.sellingPrice) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const newPricing = await db.insert(transportationRoutePricingPeriods).values({
      transportationRouteMasterId: routeId,
      vehicleType: body.vehicleType,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      costPrice: body.costPrice.toString(),
      sellingPrice: body.sellingPrice.toString(),
      currency: body.currency || 'SAR',
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Pricing period added', pricing: newPricing[0] }, 201);
  } catch (error) {
    console.error('Error adding transport pricing:', error);
    return c.json({ error: 'Failed to add pricing period' }, 500);
  }
});

// PUT /transport-routes/:routeId/pricing/:id - Update pricing period
app.put('/transport-routes/:routeId/pricing/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const routeId = parseInt(c.req.param('routeId'));
    if (isNaN(id) || isNaN(routeId)) return c.json({ error: 'Invalid IDs' }, 400);
    
    const body = await c.req.json();
    
    const updateData: any = { ...body, updatedAt: new Date() };
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.costPrice !== undefined) updateData.costPrice = body.costPrice.toString();
    if (body.sellingPrice !== undefined) updateData.sellingPrice = body.sellingPrice.toString();

    const updatedPricing = await db.update(transportationRoutePricingPeriods).set(updateData)
      .where(and(eq(transportationRoutePricingPeriods.id, id), eq(transportationRoutePricingPeriods.transportationRouteMasterId, routeId)))
      .returning();

    if (updatedPricing.length === 0) return c.json({ error: 'Pricing period not found' }, 404);

    return c.json({ message: 'Pricing period updated', pricing: updatedPricing[0] });
  } catch (error) {
    console.error('Error updating pricing:', error);
    return c.json({ error: 'Failed to update pricing period' }, 500);
  }
});

// DELETE /transport-routes/:routeId/pricing/:id - Soft delete pricing period
app.delete('/transport-routes/:routeId/pricing/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const routeId = parseInt(c.req.param('routeId'));
    if (isNaN(id) || isNaN(routeId)) return c.json({ error: 'Invalid IDs' }, 400);
    
    const updatedPricing = await db.update(transportationRoutePricingPeriods).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(and(eq(transportationRoutePricingPeriods.id, id), eq(transportationRoutePricingPeriods.transportationRouteMasterId, routeId)))
      .returning();

    if (updatedPricing.length === 0) return c.json({ error: 'Pricing period not found' }, 404);

    return c.json({ message: 'Pricing period deactivated' });
  } catch (error) {
    console.error('Error deleting pricing:', error);
    return c.json({ error: 'Failed to delete pricing period' }, 500);
  }
});

export default app;
