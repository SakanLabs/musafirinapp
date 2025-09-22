import { Hono } from 'hono';
import { sql, gte, lt, eq, and } from 'drizzle-orm';
import { db } from '../db';
import { bookings, invoices, vouchers, clients, bookingItems } from '../db/schema';
import { requireAdmin } from '../middleware/auth';

const reportsRoutes = new Hono();

// GET /api/reports/summary - Get monthly summary report
reportsRoutes.get('/summary', requireAdmin, async (c) => {
  try {
    // Get current month start and end dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Get total bookings this month
    const totalBookingsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, currentMonthStart),
          lt(bookings.createdAt, nextMonthStart)
        )
      );

    const totalBookings = totalBookingsResult[0]?.count || 0;

    // Get confirmed bookings this month
    const confirmedBookingsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, currentMonthStart),
          lt(bookings.createdAt, nextMonthStart),
          eq(bookings.bookingStatus, 'confirmed')
        )
      );

    const confirmedBookings = confirmedBookingsResult[0]?.count || 0;

    // Get total revenue this month (sum of confirmed bookings)
    const revenueResult = await db
      .select({ 
        total: sql<string>`COALESCE(SUM(CAST(${bookings.totalAmount} AS DECIMAL)), 0)` 
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, currentMonthStart),
          lt(bookings.createdAt, nextMonthStart),
          eq(bookings.bookingStatus, 'confirmed'),
          eq(bookings.paymentStatus, 'paid')
        )
      );

    const totalRevenue = parseFloat(revenueResult[0]?.total || '0');

    // Get unpaid bookings this month
    const unpaidBookingsResult = await db
      .select({ 
        count: sql<number>`count(*)`,
        total: sql<string>`COALESCE(SUM(CAST(${bookings.totalAmount} AS DECIMAL)), 0)`
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, currentMonthStart),
          lt(bookings.createdAt, nextMonthStart),
          eq(bookings.paymentStatus, 'unpaid')
        )
      );

    const unpaidCount = unpaidBookingsResult[0]?.count || 0;
    const unpaidAmount = parseFloat(unpaidBookingsResult[0]?.total || '0');

    // Get total vouchers generated this month
    const vouchersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(vouchers)
      .where(
        and(
          gte(vouchers.createdAt, currentMonthStart),
          lt(vouchers.createdAt, nextMonthStart)
        )
      );

    const totalVouchers = vouchersResult[0]?.count || 0;

    // Get total invoices generated this month
    const invoicesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(
        and(
          gte(invoices.issueDate, currentMonthStart),
          lt(invoices.issueDate, nextMonthStart)
        )
      );

    const totalInvoices = invoicesResult[0]?.count || 0;

    // Get bookings by city this month
    const bookingsByCityResult = await db
      .select({
        city: bookings.city,
        count: sql<number>`count(*)`,
        revenue: sql<string>`COALESCE(SUM(CASE WHEN ${bookings.paymentStatus} = 'paid' THEN CAST(${bookings.totalAmount} AS DECIMAL) ELSE 0 END), 0)`
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, currentMonthStart),
          lt(bookings.createdAt, nextMonthStart)
        )
      )
      .groupBy(bookings.city);

    const bookingsByCity = bookingsByCityResult.map(row => ({
      city: row.city,
      count: row.count,
      revenue: parseFloat(row.revenue),
    }));

    // Get payment status breakdown
    const paymentStatusResult = await db
      .select({
        status: bookings.paymentStatus,
        count: sql<number>`count(*)`,
        amount: sql<string>`COALESCE(SUM(CAST(${bookings.totalAmount} AS DECIMAL)), 0)`
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, currentMonthStart),
          lt(bookings.createdAt, nextMonthStart)
        )
      )
      .groupBy(bookings.paymentStatus);

    const paymentStatusBreakdown = paymentStatusResult.map(row => ({
      status: row.status,
      count: row.count,
      amount: parseFloat(row.amount),
    }));

    // Get recent bookings (last 10 bookings this month)
    const recentBookingsResult = await db
      .select({
        id: bookings.id,
        guestName: sql<string>`COALESCE(${clients.name}, 'Unknown Guest')`,
        checkInDate: bookings.checkIn,
        roomType: sql<string>`COALESCE(${bookingItems.roomType}, 'DBL')`,
        status: bookings.bookingStatus,
        totalAmount: bookings.totalAmount,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .leftJoin(bookingItems, eq(bookings.id, bookingItems.bookingId))
      .where(
        and(
          gte(bookings.createdAt, currentMonthStart),
          lt(bookings.createdAt, nextMonthStart)
        )
      )
      .orderBy(sql`${bookings.createdAt} DESC`)
      .limit(10);

    const recentBookings = recentBookingsResult.map(row => ({
      id: row.id.toString(),
      guestName: row.guestName,
      checkInDate: row.checkInDate.toISOString(),
      roomType: row.roomType,
      status: row.status,
      totalAmount: parseFloat(row.totalAmount),
    }));

    // Return data structure that matches client DashboardSummary interface
    return c.json({
      totalBookings,
      totalRevenue,
      pendingBookings: totalBookings - confirmedBookings,
      confirmedBookings,
      completedBookings: 0, // We don't have completed status in current schema
      cancelledBookings: 0, // We don't have cancelled bookings count yet
      totalInvoices,
      paidInvoices: 0, // We don't have paid invoices count yet
      pendingInvoices: 0, // We don't have pending invoices count yet
      totalVouchers,
      usedVouchers: 0, // We don't have used vouchers count yet
      recentBookings,
      monthlyRevenue: [{
        month: now.toLocaleString('default', { month: 'long' }),
        revenue: totalRevenue,
        bookings: totalBookings,
      }],
      roomTypeStats: bookingsByCity.map(city => ({
        roomType: city.city,
        bookings: city.count,
        revenue: city.revenue,
      })),
    });
  } catch (error) {
    console.error('Error generating reports:', error);
    return c.json({ error: 'Failed to generate reports' }, 500);
  }
});

export default reportsRoutes;