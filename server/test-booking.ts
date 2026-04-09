import { db } from './src/db';
import { bookings, clients } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const result = await db
    .select({
      id: bookings.id,
      clientId: bookings.clientId,
      clientName: clients.name,
      clientEmail: clients.email,
    })
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .where(eq(bookings.id, 12));

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch(console.error);
