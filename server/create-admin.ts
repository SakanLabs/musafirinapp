import { db } from './src/db/index.js';
import { user, account } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function createAdminUser() {
  const adminEmail = 'admin@musafirin.com';
  const adminPassword = 'Admin123!';
  const adminName = 'Admin';
  
  await db.delete(account).where(eq(account.providerId, 'credential'));
  await db.delete(user).where(eq(user.email, adminEmail));
  
  const adminId = crypto.randomUUID();
  const now = new Date();
  
  await db.insert(user).values({
    id: adminId,
    name: adminName,
    email: adminEmail,
    emailVerified: true,
    role: 'admin',
    userType: 'direct',
    banned: false,
    createdAt: now,
    updatedAt: now
  });
  
  console.log('User created with ID:', adminId);
}

createAdminUser().catch(console.error);
