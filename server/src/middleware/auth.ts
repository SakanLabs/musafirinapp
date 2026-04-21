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

export function requireRole(allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    try {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (!session) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      // Check user role from database
      const user = await db.select().from(schema.user).where(eq(schema.user.id, session.user.id)).limit(1);
      
      const userRole = user[0]?.role || 'user';
      
      // 'owner' has full access, otherwise check if role is allowed
      if (userRole !== 'owner' && !allowedRoles.includes(userRole)) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Store user info in context for use in routes
      c.set('user', session.user);
      c.set('session', session.session);
      c.set('userRole', userRole);
      
      await next();
    } catch (error) {
      console.error('Role auth middleware error:', error);
      return c.json({ error: 'Authentication failed' }, 401);
    }
  };
}

export const requireOwner = requireRole(['owner']);
export const requireAdmin = requireRole(['admin']);
export const requireFinance = requireRole(['finance']);
export const requireAdminOrFinance = requireRole(['admin', 'finance']);