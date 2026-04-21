import { Hono } from "hono";
import { db } from "../db";
import { bookings, invoices, vouchers, transportationBookings, transportationInvoices, transportationVouchers, transportationRoutes, serviceOrders, serviceOrderInvoices, serviceOrderReceipts, clients, bookingItems, bookingItemPricingPeriods, receipts } from "../db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { supabaseAuth } from "../middleware/supabaseAuth";

const app = new Hono();

// Apply Supabase Auth middleware to all routes in this file
app.use("/*", supabaseAuth);

// GET /api/public/bookings
app.get("/", async (c) => {
  try {
    const user = (c as any).get('supabaseUser'); // Extracted from middleware
    const clientId = user.clientId;
    
    // If clientId is undefined, the user hasn't made any bookings yet
    if (!clientId) {
      return c.json({ success: true, data: [] });
    }

    const userBookings = await db
      .select()
      .from(bookings)
      .where(eq(bookings.clientId, clientId))
      .orderBy(desc(bookings.createdAt));

    if (userBookings.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const bookingIds = userBookings.map(b => b.id);

    // Fetch related invoices and vouchers
    const relatedInvoices = await db.select().from(invoices).where(inArray(invoices.bookingId, bookingIds));
    const relatedVouchers = await db.select().from(vouchers).where(inArray(vouchers.bookingId, bookingIds));
    const relatedReceipts = await db.select().from(receipts).where(inArray(receipts.bookingId, bookingIds));
    
    const formattedBookings = userBookings.map(booking => {
      const bInvoice = relatedInvoices.find(i => i.bookingId === booking.id);
      const bVoucher = relatedVouchers.find(v => v.bookingId === booking.id);
      const bReceipts = relatedReceipts.filter(r => r.bookingId === booking.id);
      return {
        id: booking.id,
        code: booking.code,
        hotelName: booking.hotelName,
        city: booking.city,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.bookingStatus,
        mealPlan: booking.mealPlan,
        hotelConfirmationNo: booking.hotelConfirmationNo,
        createdAt: booking.createdAt,
        invoicePdfUrl: bInvoice?.pdfUrl || null,
        invoiceNumber: bInvoice?.number || null,
        invoiceStatus: bInvoice?.status || null,
        voucherPdfUrl: bVoucher?.pdfUrl || null,
        voucher: bVoucher || null,
        receipts: bReceipts,
      }
    });

    return c.json({ success: true, data: formattedBookings });
    
  } catch (error) {
    console.error("Fetch bookings failed:", error);
    return c.json({ success: false, error: "Internal Server Error during fetching bookings" }, 500);
  }
});

// GET /api/public/bookings/:code
app.get("/:code", async (c) => {
  try {
    const user = (c as any).get('supabaseUser');
    const clientId = user.clientId;
    const bookingCode = c.req.param("code");

    if (!clientId) {
      return c.json({ success: false, error: "Booking not found" }, 404);
    }

    const bookingResult = await db
      .select()
      .from(bookings)
      .where(eq(bookings.code, bookingCode));

    if (bookingResult.length === 0 || bookingResult[0].clientId !== clientId) {
      return c.json({ success: false, error: "Booking not found" }, 404);
    }

    const booking = bookingResult[0];

    // Get client info
    const clientResult = await db
      .select()
      .from(clients)
      .where(eq(clients.id, booking.clientId))
      .limit(1);

    // Get booking items with pricing periods
    const items = await db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, booking.id));

    const itemsWithPricingPeriods = await Promise.all(
      items.map(async (item) => {
        if (item.hasPricingPeriods) {
          const pricingPeriods = await db
            .select()
            .from(bookingItemPricingPeriods)
            .where(eq(bookingItemPricingPeriods.bookingItemId, item.id));
          return { ...item, pricingPeriods };
        }
        return item;
      })
    );

    // Get invoice and voucher
    const invoiceResult = await db.select().from(invoices).where(eq(invoices.bookingId, booking.id));
    const voucherResult = await db.select().from(vouchers).where(eq(vouchers.bookingId, booking.id));

    // Get receipts for this booking
    const receiptResult = await db
      .select()
      .from(receipts)
      .where(eq(receipts.bookingId, booking.id));

    return c.json({ 
      success: true, 
      data: {
        id: booking.id,
        code: booking.code,
        clientId: booking.clientId,
        hotelName: booking.hotelName,
        city: booking.city,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.bookingStatus,
        mealPlan: booking.mealPlan,
        hotelConfirmationNo: booking.hotelConfirmationNo,
        meta: booking.meta,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        client: clientResult[0] || null,
        items: itemsWithPricingPeriods,
        invoice: invoiceResult[0] || null,
        invoicePdfUrl: invoiceResult[0]?.pdfUrl || null,
        voucher: voucherResult[0] || null,
        voucherPdfUrl: voucherResult[0]?.pdfUrl || null,
        receipts: receiptResult,
      } 
    });
  } catch (error) {
    console.error("Fetch booking detail failed:", error);
    return c.json({ success: false, error: "Internal Server Error" }, 500);
  }
});

// GET /api/public/bookings/transportation/list
app.get("/transportation/list", async (c) => {
  try {
    const user = (c as any).get('supabaseUser');
    const clientId = user.clientId;
    
    if (!clientId) {
      return c.json({ success: true, data: [] });
    }

    const tBookings = await db
      .select()
      .from(transportationBookings)
      .where(eq(transportationBookings.clientId, clientId))
      .orderBy(desc(transportationBookings.createdAt));

    if (tBookings.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const bookingIds = tBookings.map(b => b.id);

    const relatedInvoices = await db.select().from(transportationInvoices).where(inArray(transportationInvoices.transportationBookingId, bookingIds));
    const relatedVouchers = await db.select().from(transportationVouchers).where(inArray(transportationVouchers.transportationBookingId, bookingIds));
    const allRoutes = await db.select().from(transportationRoutes).where(inArray(transportationRoutes.transportationBookingId, bookingIds));
    
    const formattedBookings = tBookings.map(booking => {
      const bInvoice = relatedInvoices.find(i => i.transportationBookingId === booking.id);
      const bVoucher = relatedVouchers.find(v => v.transportationBookingId === booking.id);
      const bookingRoutes = allRoutes.filter(r => r.transportationBookingId === booking.id).sort((a, b) => 
        new Date(a.pickupDateTime).getTime() - new Date(b.pickupDateTime).getTime()
      );
      
      // Parse notes if it's JSON, otherwise use as-is
      let cleanNotes = booking.notes;
      if (booking.notes) {
        try {
          const parsedNotes = JSON.parse(booking.notes);
          // If it's our meta object, extract only the notes field
          if (parsedNotes.notes) {
            cleanNotes = parsedNotes.notes;
          } else if (parsedNotes.source === 'B2C_WEB') {
            // It's our booking meta, not a user note
            cleanNotes = null;
          }
        } catch {
          // Not JSON, use as-is
        }
      }

      // Get first route for summary
      const firstRoute = bookingRoutes[0];

      return {
        id: booking.id,
        number: booking.number,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customerEmail,
        status: booking.status,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        notes: cleanNotes,
        createdAt: booking.createdAt,
        invoice: bInvoice ? {
          number: bInvoice.number,
          amount: bInvoice.amount,
          status: bInvoice.status
        } : null,
        voucher: bVoucher ? {
          number: bVoucher.number
        } : null,
        // First route summary
        pickupDateTime: firstRoute?.pickupDateTime || null,
        originLocation: firstRoute?.originLocation || null,
        destinationLocation: firstRoute?.destinationLocation || null,
        vehicleType: firstRoute?.vehicleType || null,
        totalRoutes: bookingRoutes.length
      }
    });

    return c.json({ success: true, data: formattedBookings });
    
  } catch (error) {
    console.error("Fetch transportation bookings failed:", error);
    return c.json({ success: false, error: "Internal Server Error" }, 500);
  }
});

// GET /api/public/bookings/transportation/:id - Get transportation booking detail
app.get("/transportation/:id", async (c) => {
  try {
    const user = (c as any).get('supabaseUser');
    const bookingId = parseInt(c.req.param('id'));
    const clientId = user.clientId;
    
    if (!clientId) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    if (isNaN(bookingId)) {
      return c.json({ success: false, error: "Invalid booking ID" }, 400);
    }

    const booking = await db
      .select()
      .from(transportationBookings)
      .where(eq(transportationBookings.id, bookingId))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ success: false, error: "Booking not found" }, 404);
    }

    // Verify ownership
    if (booking[0]!.clientId !== clientId) {
      return c.json({ success: false, error: "Booking not found" }, 404);
    }

    // Get routes
    const routes = await db
      .select()
      .from(transportationRoutes)
      .where(eq(transportationRoutes.transportationBookingId, bookingId))
      .orderBy(transportationRoutes.pickupDateTime);

    // Get invoice
    const invoice = await db
      .select()
      .from(transportationInvoices)
      .where(eq(transportationInvoices.transportationBookingId, bookingId))
      .limit(1);

    // Get voucher
    const voucher = await db
      .select()
      .from(transportationVouchers)
      .where(eq(transportationVouchers.transportationBookingId, bookingId))
      .limit(1);

    return c.json({
      success: true,
      data: {
        ...booking[0],
        routes: routes,
        invoice: invoice[0] || null,
        voucher: voucher[0] || null
      }
    });
    
  } catch (error) {
    console.error("Fetch transportation booking detail failed:", error);
    return c.json({ success: false, error: "Internal Server Error" }, 500);
  }
});

// GET /api/public/bookings/service-orders/list
app.get("/service-orders/list", async (c) => {
  try {
    const user = (c as any).get('supabaseUser');
    const clientId = user.clientId;
    
    if (!clientId) {
      return c.json({ success: true, data: [] });
    }

    const sOrders = await db
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.clientId, clientId))
      .orderBy(desc(serviceOrders.createdAt));

    if (sOrders.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const orderIds = sOrders.map(b => b.id);

    const relatedInvoices = await db.select().from(serviceOrderInvoices).where(inArray(serviceOrderInvoices.serviceOrderId, orderIds));
    const relatedReceipts = await db.select().from(serviceOrderReceipts).where(inArray(serviceOrderReceipts.serviceOrderId, orderIds));
    
    const formattedOrders = sOrders.map(order => {
      const bInvoice = relatedInvoices.find(i => i.serviceOrderId === order.id);
      const bReceipt = relatedReceipts.find(r => r.serviceOrderId === order.id);
      return {
        ...order,
        invoice: bInvoice || null,
        receipt: bReceipt || null
      }
    });

    return c.json({ success: true, data: formattedOrders });
    
  } catch (error) {
    console.error("Fetch service orders failed:", error);
    return c.json({ success: false, error: "Internal Server Error" }, 500);
  }
});

export default app;
