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
    sendResetPassword: async ({ user, url, token }) => {
      const { sendEmail } = await import("./email");
      const resetLink = url;
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2563eb; font-weight: bold; margin-bottom: 16px;">Atur Ulang Kata Sandi Musafirin</h2>
          <p>Halo ${user.name || user.email},</p>
          <p>Anda menerima email ini karena ada permintaan untuk mengatur ulang kata sandi akun Musafirin Anda.</p>
          <div style="margin: 24px 0;">
            <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">Atur Ulang Kata Sandi</a>
          </div>
          <p style="color: #64748b; font-size: 14px;">Jika tombol di atas tidak berfungsi, salin dan tempel tautan berikut ke browser Anda:</p>
          <p style="color: #64748b; font-size: 14px; word-break: break-all;">${resetLink}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini.</p>
        </div>
      `;
      const emailText = `Halo ${user.name || user.email},\n\nAnda menerima email ini karena ada permintaan untuk mengatur ulang kata sandi akun Musafirin Anda.\n\nSilakan klik tautan berikut untuk mengatur ulang kata sandi:\n${resetLink}\n\nJika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini.`;
      
      await sendEmail({
        to: user.email,
        subject: "Atur Ulang Kata Sandi Musafirin",
        text: emailText,
        html: emailHtml,
      });
    },
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
