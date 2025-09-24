import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiResponse } from "shared/dist";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import bookingRoutes from "./routes/bookings";
import invoiceRoutes from "./routes/invoices";
import voucherRoutes from "./routes/vouchers";
import reportsRoutes from "./routes/reports";

// Load environment variables
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required");
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth credentials are required");
}

// Initialize Better Auth with Drizzle adapter and Google provider
const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: BETTER_AUTH_SECRET,
  baseURL: "http://localhost:3000",
  trustedOrigins: ["http://localhost:5173", "http://localhost:5174"],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      domain: undefined,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      redirectURI: "http://localhost:3000/api/auth/callback/google",
      accessType: "offline",
      prompt: "select_account consent",
    },
  },
  plugins: [
    admin({})
  ],
});

export const app = new Hono()
  .use(cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
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