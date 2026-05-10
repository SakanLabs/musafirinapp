import { Hono } from "hono";
import { db } from "../db";
import { clients, bookings, invoices, bookingItems, transportationBookings, transportationRoutes, transportationInvoices, user, customLaRequests } from "../db/schema";
import { eq } from "drizzle-orm";
import { supabaseAuth } from "../middleware/supabaseAuth";

const app = new Hono();

app.use("/*", supabaseAuth);

const generateBookingCode = (prefix: string) => {
  return `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// Helper to get or create client
async function getOrCreateClient(email: string, customerName?: string, customerPhone?: string) {
  let client = await db.query.clients.findFirst({
    where: eq(clients.email, email)
  });

  if (!client) {
    const newClient = await db.insert(clients).values({
      name: customerName || email.split('@')[0] || "Unknown",
      email: email,
      phone: customerPhone || null,
      isActive: true
    }).returning({ id: clients.id });
    return newClient[0]!.id;
  }

  return client.id;
}

// POST /api/public/checkout - Universal checkout
app.post("/", async (c) => {
  try {
    const supabaseUser = (c as any).get('supabaseUser');
    const body = await c.req.json();
    const { type } = body;

    if (type === 'hotel') {
      return handleHotelCheckout(c, supabaseUser, body);
    } else if (type === 'transportation') {
      return handleTransportationCheckout(c, supabaseUser, body);
    } else if (type === 'custom_la') {
      return handleCustomLaCheckout(c, supabaseUser, body);
    }

    return c.json({ success: false, error: "Invalid checkout type." }, 400);

  } catch (error) {
    console.error("Checkout failed:", error);
    return c.json({ success: false, error: "Internal Server Error during checkout" }, 500);
  }
});

async function handleHotelCheckout(c: any, user: any, body: any) {
  const clientId = await getOrCreateClient(user.email, body.customerName, body.customerPhone);

  const checkInDate = new Date(body.hotel.checkIn);
  const checkOutDate = new Date(body.hotel.checkOut);
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const rooms = body.items || [{ roomType: "Double", roomCount: 1, unitPrice: body.totalAmount || "0.00" }];

  let calculatedTotalAmount = 0;
  for (const room of rooms) {
    const uPrice = parseFloat(room.unitPrice || body.totalAmount || 0);
    const rCount = parseInt(room.roomCount || 1, 10);
    calculatedTotalAmount += uPrice * rCount * nights;
  }

  const newBooking = await db.insert(bookings).values({
    code: generateBookingCode("BKG-WEB"),
    clientId: clientId,
    hotelName: body.hotel.hotelName || "TBD",
    city: body.hotel.city || "Makkah",
    mealPlan: body.hotel.mealPlan || "Room Only",
    checkIn: checkInDate,
    checkOut: checkOutDate,
    totalAmount: calculatedTotalAmount.toFixed(2),
    paymentStatus: "unpaid",
    bookingStatus: "pending",
    meta: { source: "B2C_WEB", items: rooms, nights: nights }
  }).returning({ id: bookings.id });

  const bookingId = newBooking[0]!.id;

  for (const room of rooms) {
    await db.insert(bookingItems).values({
      bookingId: bookingId,
      roomType: room.roomType || "Double",
      roomCount: room.roomCount || 1,
      unitPrice: room.unitPrice?.toString() || body.totalAmount?.toString() || "0.00",
      hotelCostPrice: "0.00",
      hasPricingPeriods: false,
    });
  }

  await db.insert(invoices).values({
    number: generateBookingCode("INV-WEB"),
    bookingId: bookingId,
    amount: calculatedTotalAmount.toFixed(2),
    currency: "SAR",
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: "draft"
  });

  return c.json({ 
    success: true, 
    bookingId: bookingId, 
    code: `BKG-WEB-${new Date().getFullYear()}-${bookingId}`,
    message: "Hotel booking created successfully!" 
  });
}

async function handleTransportationCheckout(c: any, supabaseUser: any, body: any) {
  const clientId = await getOrCreateClient(supabaseUser.email, body.customerName, body.customerPhone);

  // Get user type for pricing
  const betterAuthUser = await db.query.user.findFirst({
    where: eq(user.email, supabaseUser.email)
  });
  const userType = betterAuthUser?.userType || 'direct';

  // Calculate total from routes
  const routes = body.routes || [];
  let totalAmount = 0;

  for (const route of routes) {
    const price = parseFloat(route.price || 0);
    totalAmount += price;
  }

  // Create transportation booking
  const newBooking = await db.insert(transportationBookings).values({
    number: generateBookingCode("TB-WEB"),
    clientId: clientId,
    customerName: body.customerName || supabaseUser.email.split('@')[0] || "Unknown",
    customerPhone: body.customerPhone || null,
    customerEmail: supabaseUser.email,
    status: "pending",
    totalAmount: totalAmount.toFixed(2),
    currency: body.currency || "SAR",
    notes: JSON.stringify({ source: "B2C_WEB", userType: userType, routes: routes })
  }).returning({ id: transportationBookings.id, number: transportationBookings.number });

  const bookingId = newBooking[0]!.id;
  const bookingNumber = newBooking[0]!.number;

  // Create route entries
  for (const route of routes) {
    await db.insert(transportationRoutes).values({
      transportationBookingId: bookingId,
      pickupDateTime: new Date(route.pickupDateTime),
      originLocation: route.originLocation,
      destinationLocation: route.destinationLocation,
      vehicleType: route.vehicleType,
      price: route.price,
      currency: body.currency || "SAR",
      notes: route.notes || null
    });
  }

  // Create invoice
  await db.insert(transportationInvoices).values({
    number: generateBookingCode("TINV-WEB"),
    transportationBookingId: bookingId,
    amount: totalAmount.toFixed(2),
    currency: body.currency || "SAR",
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: "draft"
  });

  return c.json({ 
    success: true, 
    bookingId: bookingId,
    bookingNumber: bookingNumber,
    message: "Transportation booking created successfully!",
    userType: userType
  });
}

async function handleCustomLaCheckout(c: any, supabaseUser: any, body: any) {
  const customerName = body.namaPemesan || supabaseUser.email.split('@')[0] || "Unknown";
  const customerPhone = body.nomorPemesan || null;
  const clientId = await getOrCreateClient(supabaseUser.email, customerName, customerPhone);

  const totalAmountSAR = parseFloat(body.totals?.grandTotal || 0).toFixed(2);
  const totalPax = parseInt(body.totals?.totalPax || 1);

  const newRequest = await db.insert(customLaRequests).values({
    number: generateBookingCode("CLA"),
    clientId: clientId,
    customerName: customerName,
    customerPhone: customerPhone,
    customerEmail: supabaseUser.email,
    travelName: body.namaTravel || null,
    status: "pending",
    totalAmountSAR: totalAmountSAR,
    totalPax: totalPax,
    meta: body, // store full form data
  }).returning({ id: customLaRequests.id, number: customLaRequests.number });

  return c.json({ 
    success: true, 
    requestId: newRequest[0]!.id,
    requestNumber: newRequest[0]!.number,
    message: "Custom LA Request submitted successfully!"
  });
}

export default app;
