import { Hono } from "hono";
import { db } from "../db";
import { hotels, hotelPricingPeriods, transportationRoutesMaster, transportationRoutePricingPeriods, user, serviceMaster } from "../db/schema";
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

// Helper to map number of guests (tamu) to expected room types
function getTargetRoomTypes(guestsParam?: string, roomTypeParam?: string): string[] | null {
  if (roomTypeParam && roomTypeParam.trim()) {
    return [roomTypeParam.trim().toLowerCase()];
  }
  if (!guestsParam) return null;
  const count = parseInt(String(guestsParam), 10);
  if (isNaN(count) || count <= 0) return null;

  if (count === 1) return ['single', 'double'];
  if (count === 2) return ['double'];
  if (count === 3) return ['triple'];
  if (count === 4) return ['quad'];
  if (count >= 5) return ['quint', 'quad'];
  return null;
}

// GET /api/public/products/hotels
app.get("/hotels", async (c) => {
  try {
    const { 
      city, 
      name, 
      hotelName, 
      q, 
      checkIn, 
      checkInDate: checkInDateParam, 
      checkOut, 
      checkOutDate: checkOutDateParam, 
      guests, 
      pax, 
      numberOfGuests, 
      roomType, 
      mealPlan,
      meals
    } = c.req.query();

    const searchName = name || hotelName || q;
    const checkInStr = checkIn || checkInDateParam;
    const checkOutStr = checkOut || checkOutDateParam;
    const guestsCount = guests || pax || numberOfGuests;
    const selectedMealPlan = mealPlan || meals;
    
    if (!checkInStr || !checkOutStr) {
      return c.json({ success: false, error: "Parameter wajib: checkIn dan checkOut harus disertakan." }, 400);
    }

    const checkInDate = new Date(checkInStr);
    const checkOutDate = new Date(checkOutStr);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return c.json({ success: false, error: "Format tanggal checkIn atau checkOut tidak valid." }, 400);
    }

    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const { userType, email } = await getUserTypeFromRequest(c);
    
    const hotelConditions = [eq(hotels.isActive, true)];
    
    if (city) {
      const cityFormatted = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
      if (cityFormatted === 'Makkah' || cityFormatted === 'Madinah') {
        hotelConditions.push(eq(hotels.city, cityFormatted as any));
      }
    }
    
    if (searchName) {
      hotelConditions.push(ilike(hotels.name, `%${searchName.trim()}%`));
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

    const targetRoomTypes = getTargetRoomTypes(guestsCount, roomType);

    // Group pricing by hotel with user-based pricing & filter by specifications
    const formattedHotels = allHotels
      .map(h => {
        let pricingOptions = hotelsWithPricing
          .filter(hp => hp.hotel.id === h.id && hp.pricing !== null)
          .map(hp => {
            const formatted = formatPricing(hp.pricing, userType);
            const unitPrice = parseFloat(formatted.price || "0");
            return {
              ...formatted,
              nights,
              totalPrice: (unitPrice * nights).toFixed(2)
            };
          });
        
        // Filter by room type / number of guests if specified
        if (targetRoomTypes && targetRoomTypes.length > 0) {
          pricingOptions = pricingOptions.filter(p => 
            targetRoomTypes.some(target => p.roomType.toLowerCase().includes(target) || target.includes(p.roomType.toLowerCase()))
          );
        }

        // Filter by meal plan if specified
        if (selectedMealPlan && selectedMealPlan.trim()) {
          const mpLower = selectedMealPlan.trim().toLowerCase();
          pricingOptions = pricingOptions.filter(p => 
            p.mealPlan && p.mealPlan.toLowerCase().includes(mpLower)
          );
        }
        
        return {
          ...h,
          pricing: pricingOptions,
          userType,
          userEmail: email
        };
      })
      .filter(h => h.pricing.length > 0); // Only return hotels that have matching pricing for the filtered criteria

    return c.json({ 
      success: true, 
      data: formattedHotels, 
      meta: {
        totalHotels: formattedHotels.length,
        city: city || null,
        name: searchName || null,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        nights,
        guests: guestsCount ? parseInt(String(guestsCount), 10) : null,
        targetRoomTypes: targetRoomTypes || 'all',
        mealPlan: selectedMealPlan || null
      },
      userType 
    });
  } catch (error) {
    console.error("Failed to fetch public hotels:", error);
    return c.json({ success: false, error: "Failed to fetch hotels" }, 500);
  }
});

// GET /api/public/products/transportation
app.get("/transportation", async (c) => {
  try {
    const { userType, email } = await getUserTypeFromRequest(c);
    const dateQuery = c.req.query('date');
    
    let targetDateStr = '';
    if (dateQuery) {
      const parsedDate = new Date(dateQuery);
      if (!isNaN(parsedDate.getTime())) {
        targetDateStr = parsedDate.toISOString().substring(0, 10);
      }
    }
    
    if (!targetDateStr) {
      const today = new Date();
      targetDateStr = today.toISOString().substring(0, 10);
    }

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
          sql`${transportationRoutePricingPeriods.startDate} <= ${targetDateStr}::date`,
          sql`${transportationRoutePricingPeriods.endDate} >= ${targetDateStr}::date`
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

// GET /api/public/products/services
app.get("/services", async (c) => {
  try {
    const services = await db.query.serviceMaster.findMany({
      where: eq(serviceMaster.isActive, true),
      orderBy: (serviceMaster, { asc }) => [asc(serviceMaster.category), asc(serviceMaster.name)]
    });

    return c.json({ 
      success: true, 
      data: services
    });
  } catch (error) {
    console.error("Failed to fetch public services:", error);
    return c.json({ success: false, error: "Failed to fetch services" }, 500);
  }
});

export default app;
