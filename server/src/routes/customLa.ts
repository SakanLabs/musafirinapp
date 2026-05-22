import { Hono } from "hono";
import { db } from "../db";
import { customLaRequests, bookings, transportationBookings, serviceOrders, hotels, user, bookingItems, transportationRoutes } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const app = new Hono();

app.use("/*", requireAdmin);

// GET /api/custom-la
app.get("/", async (c) => {
  try {
    const requests = await db.query.customLaRequests.findMany({
      orderBy: [desc(customLaRequests.createdAt)],
    });
    return c.json({ success: true, data: requests });
  } catch (error) {
    console.error("Failed to fetch custom LA requests:", error);
    return c.json({ success: false, error: "Failed to fetch custom LA requests" }, 500);
  }
});

const generateBookingCode = (prefix: string) => {
  return `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// POST /api/custom-la
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    
    const newRequest = await db.transaction(async (tx) => {
      const laNumber = generateBookingCode("CLA");
      
      const newLa = await tx.insert(customLaRequests).values({
        number: laNumber,
        clientId: body.clientId,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail,
        travelName: body.travelName,
        status: "pending",
        totalAmountSAR: body.totalAmountSAR,
        totalPax: body.totalPax,
        meta: body.meta || {}, 
      }).returning();
      
      const laId = newLa[0]!.id;
      
      // Link existing bookings
      if (body.linkedBookingIds && body.linkedBookingIds.length > 0) {
        for (const bookingId of body.linkedBookingIds) {
          await tx.update(bookings)
            .set({ customLaRequestId: laId })
            .where(eq(bookings.id, bookingId));
        }
      }
      
      // Link existing transports
      if (body.linkedTransportIds && body.linkedTransportIds.length > 0) {
        for (const transportId of body.linkedTransportIds) {
          await tx.update(transportationBookings)
            .set({ customLaRequestId: laId })
            .where(eq(transportationBookings.id, transportId));
        }
      }
      
      // Link existing service orders
      if (body.linkedServiceOrderIds && body.linkedServiceOrderIds.length > 0) {
        for (const soId of body.linkedServiceOrderIds) {
          await tx.update(serviceOrders)
            .set({ customLaRequestId: laId })
            .where(eq(serviceOrders.id, soId));
        }
      }

      // Auto-create components if payload is from simplehotel (B2B portal)
      if (body.meta && body.meta.type === 'custom_la') {
        const meta = body.meta;
        const checkInDate = new Date(meta.tanggalKedatangan || new Date());
        let checkoutMakkah = new Date(checkInDate);
        checkoutMakkah.setDate(checkoutMakkah.getDate() + (parseInt(meta.malamMakkah) || 0));

        // Create Makkah Booking
        if (meta.makkahHotelId) {
          const bCode = generateBookingCode("BKG-MKH");
          const [mkhBkg] = await tx.insert(bookings).values({
            code: bCode,
            clientId: body.clientId,
            bookingStatus: "pending",
            hotelName: "Makkah Hotel",
            city: "Makkah",
            checkIn: checkInDate,
            checkOut: checkoutMakkah,
            customLaRequestId: laId,
            totalAmount: String(meta.totals?.makkahHotelTotal || 0)
          }).returning();

          if (meta.kamarQuad > 0) await tx.insert(bookingItems).values({ bookingId: mkhBkg!.id, roomType: 'Quad', roomCount: meta.kamarQuad, unitPrice: '0' });
          if (meta.kamarTriple > 0) await tx.insert(bookingItems).values({ bookingId: mkhBkg!.id, roomType: 'Triple', roomCount: meta.kamarTriple, unitPrice: '0' });
          if (meta.kamarDouble > 0) await tx.insert(bookingItems).values({ bookingId: mkhBkg!.id, roomType: 'Double', roomCount: meta.kamarDouble, unitPrice: '0' });
          if (meta.kamarSingle > 0) await tx.insert(bookingItems).values({ bookingId: mkhBkg!.id, roomType: 'Single', roomCount: meta.kamarSingle, unitPrice: '0' });
        }

        // Create Madinah Booking
        if (meta.madinahHotelId) {
          let checkoutMadinah = new Date(checkoutMakkah);
          checkoutMadinah.setDate(checkoutMadinah.getDate() + (parseInt(meta.malamMadinah) || 0));
          
          const bCode = generateBookingCode("BKG-MDN");
          const [mdnBkg] = await tx.insert(bookings).values({
            code: bCode,
            clientId: body.clientId,
            bookingStatus: "pending",
            hotelName: "Madinah Hotel",
            city: "Madinah",
            checkIn: checkoutMakkah,
            checkOut: checkoutMadinah,
            customLaRequestId: laId,
            totalAmount: String(meta.totals?.madinahHotelTotal || 0)
          }).returning();

          if (meta.kamarQuad > 0) await tx.insert(bookingItems).values({ bookingId: mdnBkg!.id, roomType: 'Quad', roomCount: meta.kamarQuad, unitPrice: '0' });
          if (meta.kamarTriple > 0) await tx.insert(bookingItems).values({ bookingId: mdnBkg!.id, roomType: 'Triple', roomCount: meta.kamarTriple, unitPrice: '0' });
          if (meta.kamarDouble > 0) await tx.insert(bookingItems).values({ bookingId: mdnBkg!.id, roomType: 'Double', roomCount: meta.kamarDouble, unitPrice: '0' });
          if (meta.kamarSingle > 0) await tx.insert(bookingItems).values({ bookingId: mdnBkg!.id, roomType: 'Single', roomCount: meta.kamarSingle, unitPrice: '0' });
        }

        // Create Transportation Booking
        if (meta.selectedTransports && meta.selectedTransports.length > 0) {
          const tCode = generateBookingCode("TRP");
          const [trBkg] = await tx.insert(transportationBookings).values({
            number: tCode,
            clientId: body.clientId,
            customerName: body.customerName || "Group Leader",
            customerPhone: null,
            customerEmail: null,
            status: "pending",
            customLaRequestId: laId,
            totalAmount: String(meta.totals?.totalTransport || 0),
            currency: "SAR"
          }).returning();

          for (const route of meta.selectedTransports) {
            let vehicleEnum = route.vehicle?.toLowerCase();
            // Validate enum values for vehicle_type ('sedan', 'staria', 'hiace', 'gmc', 'coaster', 'bus')
            if (!['sedan', 'staria', 'hiace', 'gmc', 'coaster', 'bus'].includes(vehicleEnum)) {
              vehicleEnum = 'bus'; 
            }
            await tx.insert(transportationRoutes).values({
              transportationBookingId: trBkg!.id,
              pickupDateTime: checkInDate,
              originLocation: route.origin || "TBD",
              destinationLocation: route.destination || "TBD",
              vehicleType: vehicleEnum as any,
              price: String(route.price || 0),
              currency: "SAR"
            });
          }
        }

        // Create Service Order for Visa/Siskopatuh
        if (meta.visaSiskopatuh) {
          const soCode = generateBookingCode("SO");
          await tx.insert(serviceOrders).values({
            number: soCode,
            clientId: body.clientId,
            status: "draft",
            productType: "visa_umrah",
            customLaRequestId: laId,
            groupLeaderName: body.customerName || meta.namaPemesan || "Group Leader",
            totalPeople: body.totalPax || parseInt(meta.jumlahJamaah) || 1,
            unitPriceUSD: "0",
            totalPriceUSD: "0",
            totalPriceSAR: String(meta.totals?.subTotalHandling || 0), // Default to handling total
            departureDate: checkInDate,
            returnDate: new Date(meta.tanggalKeberangkatan || new Date())
          });
        }
      }

      return newLa;
    });
    
    return c.json({ success: true, data: newRequest[0] });
  } catch (error) {
    console.error("Failed to create custom LA request:", error);
    return c.json({ success: false, error: "Failed to create custom LA request" }, 500);
  }
});

// GET /api/custom-la/:id
app.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const requestRows = await db.query.customLaRequests.findMany({
      where: eq(customLaRequests.id, id),
    });
    
    if (requestRows.length === 0) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }
    
    const request = requestRows[0];
    
    // Fetch linked components
    const linkedBookings = await db.query.bookings.findMany({
      where: eq(bookings.customLaRequestId, id)
    });
    
    const linkedTransport = await db.query.transportationBookings.findMany({
      where: eq(transportationBookings.customLaRequestId, id)
    });
    
    const linkedServiceOrders = await db.query.serviceOrders.findMany({
      where: eq(serviceOrders.customLaRequestId, id)
    });
    
    return c.json({ 
      success: true, 
      data: {
        ...request,
        linkedBookings,
        linkedTransport,
        linkedServiceOrders
      } 
    });
  } catch (error) {
    console.error("Failed to fetch custom LA request:", error);
    return c.json({ success: false, error: "Failed to fetch custom LA request" }, 500);
  }
});

// PUT /api/custom-la/:id/status
app.put("/:id/status", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const { status } = await c.req.json();
    
    const updated = await db.update(customLaRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(customLaRequests.id, id))
      .returning();
      
    if (updated.length === 0) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }
    
    return c.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error("Failed to update status:", error);
    return c.json({ success: false, error: "Failed to update status" }, 500);
  }
});

export default app;
