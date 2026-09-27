import { db } from './src/db';
import { bookings, clients } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function test() {
  const bookingId = 12;
  const result = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      clientId: bookings.clientId,
      hotelName: bookings.hotelName,
      city: bookings.city,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      totalAmount: bookings.totalAmount,
      paymentStatus: bookings.paymentStatus,
      bookingStatus: bookings.bookingStatus,
      mealPlan: bookings.mealPlan,
      meta: bookings.meta,
      createdAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
      clientName: clients.name,
      clientEmail: clients.email,
      clientPhone: clients.phone,
    })
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  const bookingData = result[0];
  console.log("Raw query result:", bookingData);

  const transformedBooking = {
    id: bookingData.id,
    code: bookingData.code,
    clientId: bookingData.clientId,
    clientName: bookingData.clientName,
    clientEmail: bookingData.clientEmail,
    clientPhone: bookingData.clientPhone,
  };
  console.log("Transformed:", transformedBooking);
  process.exit(0);
}
test().catch(console.error);
