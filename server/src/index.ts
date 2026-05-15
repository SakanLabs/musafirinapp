import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ApiResponse } from "shared/dist";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { auth } from "./lib/auth";
import bookingRoutes from "./routes/bookings";
import invoiceRoutes from "./routes/invoices";
import voucherRoutes from "./routes/vouchers";
import reportsRoutes from "./routes/reports";
import analyticsRoutes from "./routes/analytics";
import costsRoutes from "./routes/costs";
import clientRoutes from "./routes/clients";
import depositRoutes from "./routes/deposits";
import receiptRoutes from "./routes/receipts";
import serviceOrderRoutes from "./routes/serviceOrders";
import transportationRoutes from "./routes/transportation";
import bookingServiceItemsRoutes from "./routes/bookingServiceItems";
import masterRoutes from "./routes/master";
import publicProductsRoutes from "./routes/publicProducts";
import publicCheckoutRoutes from "./routes/publicCheckout";
import publicBookingsRoutes from "./routes/publicBookings";
import userRoutes from "./routes/users";
import customLaRoutes from "./routes/customLa";

// Auth instance is now imported from ./lib/auth.ts

export const app = new Hono()
  .use(logger())
  .use(cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : ["http://localhost:5173", "http://localhost:5174", "http://localhost:3001"],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }))
  // Better Auth handler
  .on(["POST", "GET"], "/api/auth/*", async (c) => {
    try {
      const response = await auth.handler(c.req.raw);
      return response;
    } catch (error) {
      console.error('Auth handler error:', error);
      return c.json({ error: 'Authentication failed' }, 500);
    }
  })
  // API Routes
  .route("/api/bookings", bookingRoutes)
  .route("/api/invoices", invoiceRoutes)
  .route("/api/vouchers", voucherRoutes)
  .route("/api/reports", reportsRoutes)
  .route("/api/analytics", analyticsRoutes)
  .route("/api/costs", costsRoutes)
  .route("/api/clients", clientRoutes)
  .route("/api/deposits", depositRoutes)
  .route("/api/receipts", receiptRoutes)
  .route("/api/service-orders", serviceOrderRoutes)
  .route("/api/transportation", transportationRoutes)
  .route("/api/booking-service-items", bookingServiceItemsRoutes)
  .route("/api/master", masterRoutes)
  .route("/api/public/products", publicProductsRoutes)
  .route("/api/public/checkout", publicCheckoutRoutes)
  .route("/api/public/bookings", publicBookingsRoutes)
  .route("/api/users", userRoutes)
  .route("/api/custom-la", customLaRoutes)
  .get("/", (c) => {
    return c.text("Hello Hono!");
  })
  .get("/hello", async (c) => {
    const data: ApiResponse = {
      message: "Hello BHVR!",
      success: true,
    };
    return c.json(data, { status: 200 });
  });

export default app;