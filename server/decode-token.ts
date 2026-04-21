import { verify } from 'hono/jwt';
import { db } from './src/db/index.js';
import { user } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const token = process.argv[2];

if (!token) {
  console.log('Usage: bun run decode-token.ts <token>');
  process.exit(1);
}

try {
  const secret = process.env.SUPABASE_JWT_SECRET;
  const decoded = await verify(token, secret);
  
  console.log('Email in token:', decoded.email);
  
  if (decoded.email) {
    const found = await db.query.user.findFirst({
      where: eq(user.email, decoded.email)
    });
    
    console.log('User in DB:', found ? found.email + ' | userType: ' + found.userType : 'NOT FOUND');
  }
} catch (e) {
  console.error('Error:', e.message);
}
