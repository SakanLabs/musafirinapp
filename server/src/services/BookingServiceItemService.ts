import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { bookingServiceItems, bookings } from '../db/schema';

type ServiceItemTypeDB = typeof bookingServiceItems.$inferInsert['serviceType'];

export type NewBookingServiceItemInput = {
  bookingId: number;
  serviceType: ServiceItemTypeDB; // must match serviceItemTypeEnum values
  description: string;
  quantity: number;
  unitPrice: number; // decimal
  notes?: string | null;
  meta?: Record<string, any> | null;
};

export class BookingServiceItemService {
  static async listByBookingId(bookingId: number) {
    const items = await db
      .select()
      .from(bookingServiceItems)
      .where(eq(bookingServiceItems.bookingId, bookingId))
      .orderBy(desc(bookingServiceItems.createdAt));
    return items;
  }

  static async createItem(input: NewBookingServiceItemInput) {
    // Basic validation
    if (!input.bookingId || !input.serviceType || !input.description) {
      throw new Error('Missing required fields');
    }
    if (input.quantity <= 0) {
      throw new Error('Quantity must be > 0');
    }
    if (input.unitPrice < 0) {
      throw new Error('Unit price must be >= 0');
    }

    // Ensure booking exists
    const bookingRows = await db.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
    if (bookingRows.length === 0) {
      throw new Error('Booking not found');
    }

    const subtotalNum = input.quantity * input.unitPrice;

    const [inserted] = await db
      .insert(bookingServiceItems)
      .values({
        bookingId: input.bookingId,
        serviceType: input.serviceType,
        description: input.description,
        quantity: input.quantity,
        unitPrice: input.unitPrice.toFixed(2),
        subtotal: subtotalNum.toFixed(2),
        notes: input.notes ?? null,
        meta: input.meta ?? null,
      })
      .returning();

    return inserted;
  }

  static async deleteItem(id: number) {
    const [deleted] = await db.delete(bookingServiceItems).where(eq(bookingServiceItems.id, id)).returning();
    return deleted;
  }
}