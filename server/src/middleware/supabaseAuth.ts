import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { db } from '../db';
import { clients, user } from '../db/schema';
import { eq } from 'drizzle-orm';

interface SupabaseJwtPayload {
  aud: string;
  exp: number;
  sub: string;
  email: string;
  phone?: string;
  app_metadata: {
    provider: string;
    providers: string[];
  };
  user_metadata: any;
  role: string;
  aal: string;
  amr: any[];
  session_id: string;
}

export const supabaseAuth = async (c: Context<{ Variables: { supabaseUser: any } }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    console.error('SUPABASE_JWT_SECRET is missing from environment variables');
    return c.json({ error: 'Server configuration error' }, 500);
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return c.json({ error: 'Malformed Authorization header' }, 401);
  }

  try {
    // Verify the JWT signature using the Supabase JWT secret
    const payload = await verify(token, secret) as unknown as SupabaseJwtPayload;
    
    if (payload.aud !== 'authenticated') {
      return c.json({ error: 'Token is not properly authenticated' }, 401);
    }

    if (!payload.email) {
      return c.json({ error: 'Token does not contain an email address' }, 400);
    }

    // Attempt to find the client in our database by email
    const existingClient = await db.query.clients.findFirst({
      where: eq(clients.email, payload.email)
    });

    // Get user type from Better Auth user table
    const betterAuthUser = await db.query.user.findFirst({
      where: eq(user.email, payload.email)
    });

    // We store the decoded email (and client ID if found) in the context
    c.set('supabaseUser', {
      email: payload.email,
      sub: payload.sub,
      clientId: existingClient?.id, // undefined if not yet created
      userType: betterAuthUser?.userType || 'direct', // default to direct if not found
    });

    await next();
  } catch (error) {
    console.error('Supabase JWT verification failed:', error);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};
