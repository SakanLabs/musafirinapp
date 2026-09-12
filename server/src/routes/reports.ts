import { Hono } from 'hono';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db';
import { bookings, invoices, vouchers, clients, bookingItems } from '../db/schema';
import { requireAdmin } from '../middleware/auth';

const reportsRoutes = new Hono();

// GET /api/reports/summary - Get operational overview and summary report
reportsRoutes.get('/summary', requireAdmin, async (c) => {
  try {
    const now = new Date();

    // 1. Total Bookings Breakdown
    const [totalBookingsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings);
    const totalBookings = totalBookingsRes?.count || 0;

    const [confirmedBookingsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(eq(bookings.bookingStatus, 'confirmed'));
    const confirmedBookings = confirmedBookingsRes?.count || 0;

    const [pendingBookingsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(eq(bookings.bookingStatus, 'pending'));
    const pendingBookings = pendingBookingsRes?.count || 0;

    const [cancelledBookingsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(eq(bookings.bookingStatus, 'cancelled'));
    const cancelledBookings = cancelledBookingsRes?.count || 0;

    // Completed: confirmed bookings where checkout is past
    const [completedBookingsRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(sql`${bookings.bookingStatus} = 'confirmed' AND ${bookings.checkOut} <= NOW()`);
    const completedBookings = completedBookingsRes?.count || 0;

    // 2. Gross Revenue (Total Accrued Platform Billing from confirmed/paid/partial bookings)
    const [revenueResult] = await db
      .select({ 
        total: sql<string>`COALESCE(SUM(CAST(${bookings.totalAmount} AS DECIMAL)), 0)` 
      })
      .from(bookings)
      .where(sql`${bookings.bookingStatus} = 'confirmed'`);
    const totalRevenue = parseFloat(revenueResult?.total || '0');

    // 3. Invoices Tracking Breakdown
    const [invoicesRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices);
    const totalInvoices = invoicesRes?.count || 0;

    const [paidInvoicesRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(sql`${invoices.status} IN ('paid', 'partially_paid')`);
    const paidInvoices = paidInvoicesRes?.count || 0;

    const [pendingInvoicesRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(sql`${invoices.status} IN ('draft', 'sent', 'overdue')`);
    const pendingInvoices = pendingInvoicesRes?.count || 0;

    // 4. Vouchers Tracking
    const [vouchersRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers);
    const totalVouchers = vouchersRes?.count || 0;

    const [usedVouchersRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vouchers)
      .leftJoin(bookings, eq(vouchers.bookingId, bookings.id))
      .where(sql`${bookings.checkIn} <= NOW()`);
    const usedVouchers = usedVouchersRes?.count || 0;

    // 5. Bookings by City
    const bookingsByCityResult = await db
      .select({
        city: bookings.city,
        count: sql<number>`count(*)::int`,
        revenue: sql<string>`COALESCE(SUM(CAST(${bookings.totalAmount} AS DECIMAL)), 0)`
      })
      .from(bookings)
      .where(sql`${bookings.bookingStatus} != 'cancelled'`)
      .groupBy(bookings.city);

    const roomTypeStats = bookingsByCityResult.map(row => ({
      roomType: row.city,
      bookings: Number(row.count),
      revenue: parseFloat(row.revenue),
    }));

    // 6. Recent Bookings (Last 10 bookings platform-wide)
    const recentBookingsResult = await db
      .select({
        id: bookings.id,
        code: bookings.code,
        guestName: sql<string>`COALESCE(${clients.name}, 'Unknown Guest')`,
        checkInDate: bookings.checkIn,
        roomType: sql<string>`COALESCE(${bookingItems.roomType}, 'Double')`,
        status: bookings.bookingStatus,
        totalAmount: bookings.totalAmount,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .leftJoin(bookingItems, eq(bookings.id, bookingItems.bookingId))
      .orderBy(sql`${bookings.createdAt} DESC`)
      .limit(10);

    const recentBookings = recentBookingsResult.map(row => ({
      id: row.code || row.id.toString(),
      guestName: row.guestName,
      checkInDate: row.checkInDate ? new Date(row.checkInDate).toISOString() : new Date().toISOString(),
      roomType: row.roomType,
      status: row.status,
      totalAmount: parseFloat(row.totalAmount || '0'),
    }));

    // 7. Monthly Revenue Trend (Last 6 Months)
    const monthlyRevenueResult = await db
      .select({
        monthYear: sql<string>`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`,
        monthName: sql<string>`TO_CHAR(${bookings.createdAt}, 'Mon YYYY')`,
        monthTimestamp: sql<Date>`DATE_TRUNC('month', ${bookings.createdAt})`,
        revenue: sql<string>`COALESCE(SUM(CASE WHEN ${bookings.bookingStatus} = 'confirmed' THEN CAST(${bookings.totalAmount} AS DECIMAL) ELSE 0 END), 0)`,
        bookingsCount: sql<number>`COUNT(*)::int`,
      })
      .from(bookings)
      .groupBy(sql`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`, sql`TO_CHAR(${bookings.createdAt}, 'Mon YYYY')`, sql`DATE_TRUNC('month', ${bookings.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${bookings.createdAt}) ASC`);

    let monthlyRevenue = monthlyRevenueResult.map(m => ({
      month: m.monthName,
      revenue: parseFloat(m.revenue),
      bookings: Number(m.bookingsCount),
    }));

    // If monthlyRevenue is empty, fallback to current month
    if (monthlyRevenue.length === 0) {
      monthlyRevenue = [{
        month: now.toLocaleString('default', { month: 'short', year: 'numeric' }),
        revenue: totalRevenue,
        bookings: totalBookings,
      }];
    }

    return c.json({
      totalBookings,
      totalRevenue,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      totalVouchers,
      usedVouchers,
      recentBookings,
      monthlyRevenue,
      roomTypeStats,
    });
  } catch (error) {
    console.error('Error generating reports:', error);
    return c.json({ error: 'Failed to generate reports' }, 500);
  }
});

export default reportsRoutes;