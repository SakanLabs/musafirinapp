import type { Context, Next } from 'hono';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

// Initialize Better Auth instance for middleware
const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  plugins: [
    admin({})
  ]
});

export async function requireAuth(c: Context, next: Next) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Store user info in context for use in routes
    c.set('user', session.user);
    c.set('session', session.session);
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

export async function requireAdmin(c: Context, next: Next) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check user role from database
    const user = await db.select().from(schema.user).where(eq(schema.user.id, session.user.id)).limit(1);
    
    if (!user[0]?.role || user[0].role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    // Store user info in context for use in routes
    c.set('user', session.user);
    c.set('session', session.session);
    
    await next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}