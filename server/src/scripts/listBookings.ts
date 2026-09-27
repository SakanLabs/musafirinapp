import { db } from '../db';
import { bookings, clients, invoices } from '../db/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      clientId: bookings.clientId,
      hotelName: bookings.hotelName,
      city: bookings.city,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      totalAmount: bookings.totalAmount,
      clientName: clients.name,
      invoiceId: invoices.id,
      invoiceNumber: invoices.number,
      invoiceStatus: invoices.status,
    })
    .from(bookings)
    .leftJoin(invoices, eq(invoices.bookingId, bookings.id))
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .orderBy(desc(bookings.createdAt))
    .limit(10);

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });