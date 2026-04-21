import { Hono } from "hono";
import { db } from "../db";
import { hotels, hotelPricingPeriods, transportationRoutesMaster, transportationRoutePricingPeriods, user } from "../db/schema";
import { eq, and, sql, gte, lte, ilike } from "drizzle-orm";
import { verify } from "hono/jwt";

const app = new Hono();

async function getUserTypeFromRequest(c: any): Promise<{ userType: string; email?: string }> {
  const authHeader = c.req.header('Authorization');
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!authHeader || !authHeader.startsWith('Bearer ') || !secret) {
    return { userType: 'direct' };
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = await verify(token, secret) as any;
    
    if (payload?.email) {
      const betterAuthUser = await db.query.user.findFirst({
        where: eq(user.email, payload.email)
      });
      return {
        userType: betterAuthUser?.userType || 'direct',
        email: payload.email
      };
    }
  } catch (error) {
    // Token invalid, treat as direct
  }
  
  return { userType: 'direct' };
}

// Helper to format pricing based on user type
function formatPricing(pricing: any, userType: string) {
  return {
    ...pricing,
    price: userType === 'agent' && Number(pricing.agentPrice) > 0 
      ? pricing.agentPrice 
      : pricing.sellingPrice,
    priceType: userType === 'agent' && Number(pricing.agentPrice) > 0 
      ? 'agent' 
      : 'direct'
  };
}

// GET /api/public/products/hotels
app.get("/hotels", async (c) => {
  try {
    const { city, name, checkIn, checkOut } = c.req.query();
    
    if (!checkIn || !checkOut) {
      return c.json({ success: false, error: "Parameter wajib: checkIn dan checkOut harus disertakan." }, 400);
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return c.json({ success: false, error: "Format tanggal checkIn atau checkOut tidak valid." }, 400);
    }

    const { userType, email } = await getUserTypeFromRequest(c);
    
    const hotelConditions = [eq(hotels.isActive, true)];
    
    if (city) {
      hotelConditions.push(eq(hotels.city, city as any));
    }
    
    if (name) {
      hotelConditions.push(ilike(hotels.name, `%${name}%`));
    }

    // Fetch active hotels matching conditions
    const allHotels = await db.query.hotels.findMany({
      where: and(...hotelConditions)
    });
    
    // Fetch hotels with valid pricing for the requested dates
    const hotelsWithPricing = await db
      .select({
        hotel: hotels,
        pricing: hotelPricingPeriods
      })
      .from(hotels)
      .leftJoin(
        hotelPricingPeriods,
        and(
          eq(hotelPricingPeriods.hotelId, hotels.id),
          eq(hotelPricingPeriods.isActive, true),
          lte(hotelPricingPeriods.startDate, checkInDate),
          gte(hotelPricingPeriods.endDate, checkOutDate)
        )
      )
      .where(and(...hotelConditions));

    // Group pricing by hotel with user-based pricing
    const formattedHotels = allHotels.map(h => {
      const pricingOptions = hotelsWithPricing
        .filter(hp => hp.hotel.id === h.id && hp.pricing !== null)
        .map(hp => formatPricing(hp.pricing, userType));
      
      return {
        ...h,
        pricing: pricingOptions,
        userType,
        userEmail: email
      };
    });

    return c.json({ success: true, data: formattedHotels, userType });
  } catch (error) {
    console.error("Failed to fetch public hotels:", error);
    return c.json({ success: false, error: "Failed to fetch hotels" }, 500);
  }
});

// GET /api/public/products/transportation
app.get("/transportation", async (c) => {
  try {
    const { userType, email } = await getUserTypeFromRequest(c);
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Fetch active transportation routes
    const routesWithPricing = await db
      .select({
        route: transportationRoutesMaster,
        pricing: transportationRoutePricingPeriods
      })
      .from(transportationRoutesMaster)
      .leftJoin(
        transportationRoutePricingPeriods,
        and(
          eq(transportationRoutePricingPeriods.transportationRouteMasterId, transportationRoutesMaster.id),
          eq(transportationRoutePricingPeriods.isActive, true),
          sql`${transportationRoutePricingPeriods.startDate} <= ${todayStr}::date`,
          sql`${transportationRoutePricingPeriods.endDate} >= ${todayStr}::date`
        )
      )
      .where(eq(transportationRoutesMaster.isActive, true));

    // Group pricing by route with user-based pricing
    const routesMap = new Map();
    
    routesWithPricing.forEach(row => {
      if (!routesMap.has(row.route.id)) {
        routesMap.set(row.route.id, {
          ...row.route,
          pricing: []
        });
      }
      
      if (row.pricing) {
        routesMap.get(row.route.id).pricing.push(formatPricing(row.pricing, userType));
      }
    });

    return c.json({ 
      success: true, 
      data: Array.from(routesMap.values()),
      userType,
      userEmail: email
    });
  } catch (error) {
    console.error("Failed to fetch public transportation:", error);
    return c.json({ success: false, error: "Failed to fetch transportation" }, 500);
  }
});

export default app;
