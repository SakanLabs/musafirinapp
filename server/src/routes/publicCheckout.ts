import { Hono } from "hono";
import { db } from "../db";
import { clients, bookings, invoices, bookingItems, transportationBookings, transportationRoutes, transportationInvoices, user, customLaRequests, serviceOrders, hotels, serviceMaster } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
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
  const totalPax = parseInt(body.totals?.totalPax || body.jumlahJamaah || 1);

  let makkahHotelName = "Makkah Hotel";
  let madinahHotelName = "Madinah Hotel";

  if (body.makkahHotelId) {
    const mh = await db.query.hotels.findFirst({ where: eq(hotels.id, parseInt(body.makkahHotelId)) });
    if (mh) makkahHotelName = mh.name;
  }
  
  if (body.madinahHotelId) {
    const dh = await db.query.hotels.findFirst({ where: eq(hotels.id, parseInt(body.madinahHotelId)) });
    if (dh) madinahHotelName = dh.name;
  }

  let dynamicServicesTotal = 0;
  const dynamicHandlingDetails: Record<string, number> = {};
  const dynamicServicesList = [];

  if (body.selectedServiceIds && Array.isArray(body.selectedServiceIds) && body.selectedServiceIds.length > 0) {
    const services = await db.query.serviceMaster.findMany({
      where: inArray(serviceMaster.id, body.selectedServiceIds)
    });
    
    for (const service of services) {
      const priceNum = parseFloat(service.price);
      let calculatedPrice = priceNum;
      if (service.unitType === 'Per Pax') {
         calculatedPrice = priceNum * totalPax;
      }
      dynamicServicesTotal += calculatedPrice;
      
      dynamicHandlingDetails[service.name] = calculatedPrice;
      dynamicServicesList.push({
         id: service.id,
         name: service.name,
         category: service.category,
         calculatedPrice: calculatedPrice
      });
    }
  }

  // Map simplehotel payload to musafirinapp standard meta format so the UI renders it correctly
  const mappedMeta = {
    ...body,
    type: "custom_la",
    tanggalKedatangan: body.tanggalKedatangan,
    tanggalKeberangkatan: body.tanggalKeberangkatan,
    rooms: {
      makkah: {
        nights: parseInt(body.malamMakkah) || 0,
        quadQty: parseInt(body.kamarQuad) || 0, quadPrice: body.totals?.makkahRoomPrices?.quad || 0,
        tripleQty: parseInt(body.kamarTriple) || 0, triplePrice: body.totals?.makkahRoomPrices?.triple || 0,
        doubleQty: parseInt(body.kamarDouble) || 0, doublePrice: body.totals?.makkahRoomPrices?.double || 0,
        singleQty: parseInt(body.kamarSingle) || 0, singlePrice: body.totals?.makkahRoomPrices?.single || 0,
      },
      madinah: {
        nights: parseInt(body.malamMadinah) || 0,
        quadQty: parseInt(body.kamarQuad) || 0, quadPrice: body.totals?.madinahRoomPrices?.quad || 0,
        tripleQty: parseInt(body.kamarTriple) || 0, triplePrice: body.totals?.madinahRoomPrices?.triple || 0,
        doubleQty: parseInt(body.kamarDouble) || 0, doublePrice: body.totals?.madinahRoomPrices?.double || 0,
        singleQty: parseInt(body.kamarSingle) || 0, singlePrice: body.totals?.madinahRoomPrices?.single || 0,
      }
    },
    handlingDetails: {
      ...dynamicHandlingDetails,
      keretaCepat: body.tiketKeretaCepat ? (150 * totalPax) : 0,
    },
    totals: {
      ...body.totals,
      includeVisa: body.visaSiskopatuh,
      visaTotal: body.visaSiskopatuh ? (750 * totalPax) : 0,
    }
  };

  const newRequest = await db.transaction(async (tx) => {
    const laNumber = generateBookingCode("CLA");
    const [laReq] = await tx.insert(customLaRequests).values({
      number: laNumber,
      clientId: clientId,
      customerName: customerName,
      customerPhone: customerPhone,
      customerEmail: supabaseUser.email,
      travelName: body.namaTravel || null,
      status: "pending",
      totalAmountSAR: totalAmountSAR,
      totalPax: totalPax,
      meta: mappedMeta, 
    }).returning({ id: customLaRequests.id, number: customLaRequests.number });
    
    const laId = laReq!.id;
    const checkInDate = new Date(body.tanggalKedatangan || new Date());
    let checkoutMakkah = new Date(checkInDate);
    checkoutMakkah.setDate(checkoutMakkah.getDate() + (parseInt(body.malamMakkah) || 0));

    // Auto Create Makkah Booking
    if (body.makkahHotelId) {
      const bCode = generateBookingCode("BKG-MKH");
      const [mkhBkg] = await tx.insert(bookings).values({
        code: bCode,
        clientId: clientId,
        bookingStatus: "pending",
        hotelName: makkahHotelName,
        city: "Makkah",
        checkIn: checkInDate,
        checkOut: checkoutMakkah,
        customLaRequestId: laId,
        totalAmount: String(body.totals?.makkahHotelTotal || 0)
      }).returning();
      
      const kQuad = parseInt(body.kamarQuad)||0;
      const kTriple = parseInt(body.kamarTriple)||0;
      const kDouble = parseInt(body.kamarDouble)||0;
      const kSingle = parseInt(body.kamarSingle)||0;
      
      if (kQuad > 0) await tx.insert(bookingItems).values({ bookingId: mkhBkg!.id, roomType: 'Quad', roomCount: kQuad, unitPrice: String(body.totals?.makkahRoomPrices?.quad || 0) });
      if (kTriple > 0) await tx.insert(bookingItems).values({ bookingId: mkhBkg!.id, roomType: 'Triple', roomCount: kTriple, unitPrice: String(body.totals?.makkahRoomPrices?.triple || 0) });
      if (kDouble > 0) await tx.insert(bookingItems).values({ bookingId: mkhBkg!.id, roomType: 'Double', roomCount: kDouble, unitPrice: String(body.totals?.makkahRoomPrices?.double || 0) });
      if (kSingle > 0) await tx.insert(bookingItems).values({ bookingId: mkhBkg!.id, roomType: 'Single', roomCount: kSingle, unitPrice: String(body.totals?.makkahRoomPrices?.single || 0) });
    }

    // Auto Create Madinah Booking
    if (body.madinahHotelId) {
      let checkoutMadinah = new Date(checkoutMakkah);
      checkoutMadinah.setDate(checkoutMadinah.getDate() + (parseInt(body.malamMadinah) || 0));
      
      const bCode = generateBookingCode("BKG-MDN");
      const [mdnBkg] = await tx.insert(bookings).values({
        code: bCode,
        clientId: clientId,
        bookingStatus: "pending",
        hotelName: madinahHotelName,
        city: "Madinah",
        checkIn: checkoutMakkah,
        checkOut: checkoutMadinah,
        customLaRequestId: laId,
        totalAmount: String(body.totals?.madinahHotelTotal || 0)
      }).returning();
      
      const kQuad = parseInt(body.kamarQuad)||0;
      const kTriple = parseInt(body.kamarTriple)||0;
      const kDouble = parseInt(body.kamarDouble)||0;
      const kSingle = parseInt(body.kamarSingle)||0;

      if (kQuad > 0) await tx.insert(bookingItems).values({ bookingId: mdnBkg!.id, roomType: 'Quad', roomCount: kQuad, unitPrice: String(body.totals?.madinahRoomPrices?.quad || 0) });
      if (kTriple > 0) await tx.insert(bookingItems).values({ bookingId: mdnBkg!.id, roomType: 'Triple', roomCount: kTriple, unitPrice: String(body.totals?.madinahRoomPrices?.triple || 0) });
      if (kDouble > 0) await tx.insert(bookingItems).values({ bookingId: mdnBkg!.id, roomType: 'Double', roomCount: kDouble, unitPrice: String(body.totals?.madinahRoomPrices?.double || 0) });
      if (kSingle > 0) await tx.insert(bookingItems).values({ bookingId: mdnBkg!.id, roomType: 'Single', roomCount: kSingle, unitPrice: String(body.totals?.madinahRoomPrices?.single || 0) });
    }

    // Auto Create Transports
    if (body.selectedTransports && body.selectedTransports.length > 0) {
      const tCode = generateBookingCode("TRP");
        const [trBkg] = await tx.insert(transportationBookings).values({
          number: tCode,
          clientId: clientId,
          customerName: customerName,
          customerPhone: customerPhone,
          customerEmail: supabaseUser.email,
          status: "pending",
          customLaRequestId: laId,
          totalAmount: String(body.totals?.totalTransport || 0),
          currency: "SAR"
        }).returning();

        for (const route of body.selectedTransports) {
          let vehicleEnum = route.vehicle?.toLowerCase();
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

    // Auto Create Visa Service Order
    if (body.visaSiskopatuh) {
      const soCode = generateBookingCode("SO");
      await tx.insert(serviceOrders).values({
        number: soCode,
        clientId: clientId,
        status: "draft",
        productType: "visa_umrah",
        customLaRequestId: laId,
        groupLeaderName: customerName,
        totalPeople: totalPax,
        unitPriceUSD: "0",
        totalPriceUSD: "0",
        totalPriceSAR: String(body.totals?.subTotalHandling || 0),
        departureDate: checkInDate,
        returnDate: new Date(body.tanggalKeberangkatan || new Date())
      });
    }

    return laReq;
  });

  return c.json({ 
    success: true, 
    requestId: newRequest!.id,
    requestNumber: newRequest!.number,
    message: "Custom LA Request submitted successfully!"
  });
}

export default app;
