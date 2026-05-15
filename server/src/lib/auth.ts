import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required");
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth credentials are required");
}

const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const trustedOrigins = process.env.TRUSTED_ORIGINS
  ? process.env.TRUSTED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:5174", "http://localhost:3001"];
const useSecureCookies = process.env.USE_SECURE_COOKIES === "true";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins,
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7,
    },
  },
  advanced: {
    useSecureCookies,
    defaultCookieAttributes: {
      httpOnly: false,
      secure: useSecureCookies,
      sameSite: useSecureCookies ? "none" : "lax",
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
      redirectURI: `${baseURL}/api/auth/callback/google`,
      accessType: "offline",
      prompt: "select_account consent",
    },
  },
  plugins: [
    admin({})
  ],
});
