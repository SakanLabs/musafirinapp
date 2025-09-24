import { db } from '../db';
import { bookings, bookingItems, operationalCosts, hotelCostTemplates } from '../db/schema';
import { eq, gte, lte, and, sql, desc, asc } from 'drizzle-orm';

export interface RevenueData {
  totalRevenue: number;
  revenueByPeriod: Array<{
    period: string;
    revenue: number;
  }>;
  revenueByCity: Array<{
    city: string;
    revenue: number;
    bookingCount: number;
    averageBookingValue: number;
  }>;
  revenueTrend: Array<{
    date: string;
    revenue: number;
    bookingCount: number;
  }>;
}

export interface ProfitData {
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  totalRevenue: number;
  totalHotelCosts: number;
  totalAdditionalCosts: number;
  profitByPeriod: Array<{
    period: string;
    grossProfit: number;
    netProfit: number;
    revenue: number;
    hotelCosts: number;
    additionalCosts: number;
  }>;
  profitByCity: Array<{
    city: string;
    grossProfit: number;
    netProfit: number;
    revenue: number;
    hotelCosts: number;
    additionalCosts: number;
  }>;
  costBreakdown?: Array<{
    costType: string;
    amount: number;
    percentage: number;
  }>;
}

export interface AnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  city?: string;
  status?: string;
}

export class AnalyticsService {
  /**
   * Get comprehensive revenue data with filtering options
   */
  async getRevenueData(filters: AnalyticsFilters = {}): Promise<RevenueData> {
    const whereConditions = this.buildWhereConditions(filters);

    // Total revenue query
    const totalRevenueResult = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
      })
      .from(bookings)
      .where(whereConditions);

    const totalRevenue = Number(totalRevenueResult[0]?.totalRevenue || 0);

    // Revenue by city
    const revenueByCityResult = await db
      .select({
        city: bookings.city,
        revenue: sql<number>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
        bookingCount: sql<number>`COUNT(*)`,
      })
      .from(bookings)
      .where(whereConditions)
      .groupBy(bookings.city)
      .orderBy(desc(sql`SUM(${bookings.totalAmount})`));

    const revenueByCity = revenueByCityResult.map(row => {
      const revenue = Number(row.revenue);
      const bookingCount = Number(row.bookingCount);
      const averageBookingValue = bookingCount > 0 ? revenue / bookingCount : 0;
      
      return {
        city: row.city,
        revenue,
        bookingCount,
        averageBookingValue,
      };
    });

    // Revenue trend (last 30 days)
    const revenueTrendResult = await db
      .select({
        date: sql<string>`DATE(${bookings.createdAt})`,
        revenue: sql<number>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
        bookingCount: sql<number>`COUNT(*)`,
      })
      .from(bookings)
      .where(
        and(
          whereConditions,
          gte(bookings.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(sql`DATE(${bookings.createdAt})`)
      .orderBy(asc(sql`DATE(${bookings.createdAt})`));

    const revenueTrend = revenueTrendResult.map(row => ({
      date: row.date,
      revenue: Number(row.revenue),
      bookingCount: Number(row.bookingCount),
    }));

    // Revenue by period (monthly for current year)
    const revenueByPeriodResult = await db
      .select({
        period: sql<string>`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`,
        revenue: sql<number>`COALESCE(SUM(${bookings.totalAmount}), 0)`,
      })
      .from(bookings)
      .where(
        and(
          whereConditions,
          gte(bookings.createdAt, new Date(new Date().getFullYear(), 0, 1))
        )
      )
      .groupBy(sql`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`));

    const revenueByPeriod = revenueByPeriodResult.map(row => ({
      period: row.period,
      revenue: Number(row.revenue),
    }));

    return {
      totalRevenue,
      revenueByPeriod,
      revenueByCity,
      revenueTrend,
    };
  }

  /**
   * Get comprehensive profit data with cost breakdown
   */
  async getProfitData(filters: AnalyticsFilters = {}): Promise<ProfitData> {
    const whereConditions = this.buildWhereConditions(filters);

    // Get revenue and hotel costs from booking items
    const profitQuery = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${bookingItems.unitPrice} * ${bookingItems.roomCount}), 0)`,
        totalHotelCosts: sql<number>`COALESCE(SUM(${bookingItems.hotelCostPrice} * ${bookingItems.roomCount}), 0)`,
        bookingId: bookingItems.bookingId,
      })
      .from(bookingItems)
      .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
      .where(whereConditions)
      .groupBy(bookingItems.bookingId);

    const totalRevenue = profitQuery.reduce((sum, row) => sum + Number(row.totalRevenue), 0);
    const totalHotelCosts = profitQuery.reduce((sum, row) => sum + Number(row.totalHotelCosts), 0);

    // Get additional operational costs
    const additionalCostsQuery = await db
      .select({
        totalAdditionalCosts: sql<number>`COALESCE(SUM(${operationalCosts.amount}), 0)`,
      })
      .from(operationalCosts)
      .innerJoin(bookings, eq(bookings.id, operationalCosts.bookingId))
      .where(whereConditions);

    const totalAdditionalCosts = Number(additionalCostsQuery[0]?.totalAdditionalCosts || 0);

    // Calculate profits
    const grossProfit = totalRevenue - totalHotelCosts;
    const netProfit = grossProfit - totalAdditionalCosts;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Profit by city
    const profitByCityResult = await db
      .select({
        city: bookings.city,
        revenue: sql<number>`COALESCE(SUM(${bookingItems.unitPrice} * ${bookingItems.roomCount}), 0)`,
        hotelCosts: sql<number>`COALESCE(SUM(${bookingItems.hotelCostPrice} * ${bookingItems.roomCount}), 0)`,
      })
      .from(bookingItems)
      .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
      .where(whereConditions)
      .groupBy(bookings.city)
      .orderBy(desc(sql`SUM(${bookingItems.unitPrice} * ${bookingItems.roomCount})`));

    // Get additional costs by city
    const additionalCostsByCity = await db
      .select({
        city: bookings.city,
        additionalCosts: sql<number>`COALESCE(SUM(${operationalCosts.amount}), 0)`,
      })
      .from(operationalCosts)
      .innerJoin(bookings, eq(bookings.id, operationalCosts.bookingId))
      .where(whereConditions)
      .groupBy(bookings.city);

    const additionalCostsMap = new Map(
      additionalCostsByCity.map(row => [row.city, Number(row.additionalCosts)])
    );

    const profitByCity = profitByCityResult.map(row => {
      const revenue = Number(row.revenue);
      const hotelCosts = Number(row.hotelCosts);
      const additionalCosts = additionalCostsMap.get(row.city) || 0;
      const grossProfit = revenue - hotelCosts;
      const netProfit = grossProfit - additionalCosts;

      return {
        city: row.city,
        grossProfit,
        netProfit,
        revenue,
        hotelCosts,
        additionalCosts,
      };
    });

    // Profit by period (monthly)
    const profitByPeriodResult = await db
      .select({
        period: sql<string>`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`,
        revenue: sql<number>`COALESCE(SUM(${bookingItems.unitPrice} * ${bookingItems.roomCount}), 0)`,
        hotelCosts: sql<number>`COALESCE(SUM(${bookingItems.hotelCostPrice} * ${bookingItems.roomCount}), 0)`,
      })
      .from(bookingItems)
      .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
      .where(
        and(
          whereConditions,
          gte(bookings.createdAt, new Date(new Date().getFullYear(), 0, 1))
        )
      )
      .groupBy(sql`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`));

    // Get additional costs by period
    const additionalCostsByPeriod = await db
      .select({
        period: sql<string>`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`,
        additionalCosts: sql<number>`COALESCE(SUM(${operationalCosts.amount}), 0)`,
      })
      .from(operationalCosts)
      .innerJoin(bookings, eq(bookings.id, operationalCosts.bookingId))
      .where(
        and(
          whereConditions,
          gte(bookings.createdAt, new Date(new Date().getFullYear(), 0, 1))
        )
      )
      .groupBy(sql`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${bookings.createdAt}, 'YYYY-MM')`));

    const additionalCostsByPeriodMap = new Map(
      additionalCostsByPeriod.map(row => [row.period, Number(row.additionalCosts)])
    );

    const profitByPeriod = profitByPeriodResult.map(row => {
      const revenue = Number(row.revenue);
      const hotelCosts = Number(row.hotelCosts);
      const additionalCosts = additionalCostsByPeriodMap.get(row.period) || 0;
      const grossProfit = revenue - hotelCosts;
      const netProfit = grossProfit - additionalCosts;

      return {
        period: row.period,
        grossProfit,
        netProfit,
        revenue,
        hotelCosts,
        additionalCosts,
      };
    });

    // Cost breakdown
    const costBreakdownResult = await db
      .select({
        costType: operationalCosts.costType,
        amount: sql<number>`COALESCE(SUM(${operationalCosts.amount}), 0)`,
      })
      .from(operationalCosts)
      .innerJoin(bookings, eq(bookings.id, operationalCosts.bookingId))
      .where(whereConditions)
      .groupBy(operationalCosts.costType)
      .orderBy(desc(sql`SUM(${operationalCosts.amount})`));

    const totalCosts = totalHotelCosts + totalAdditionalCosts;
    const costBreakdown = [
      {
        costType: 'Hotel Costs',
        amount: totalHotelCosts,
        percentage: totalCosts > 0 ? (totalHotelCosts / totalCosts) * 100 : 0,
      },
      ...costBreakdownResult.map(row => ({
        costType: row.costType,
        amount: Number(row.amount),
        percentage: totalCosts > 0 ? (Number(row.amount) / totalCosts) * 100 : 0,
      })),
    ];

    return {
      grossProfit,
      netProfit,
      profitMargin,
      totalRevenue,
      totalHotelCosts,
      totalAdditionalCosts,
      profitByPeriod,
      profitByCity,
      costBreakdown,
    };
  }

  /**
   * Get combined analytics data (revenue + profit)
   */
  async getAnalyticsData(filters: AnalyticsFilters = {}) {
    const [revenueData, profitData] = await Promise.all([
      this.getRevenueData(filters),
      this.getProfitData(filters),
    ]);

    return {
      revenue: revenueData,
      profit: profitData,
      summary: {
        totalRevenue: revenueData.totalRevenue,
        grossProfit: profitData.grossProfit,
        netProfit: profitData.netProfit,
        profitMargin: profitData.profitMargin,
        totalBookings: revenueData.revenueByCity.reduce((sum, city) => sum + city.bookingCount, 0),
      },
    };
  }

  /**
   * Build WHERE conditions based on filters
   */
  private buildWhereConditions(filters: AnalyticsFilters) {
    const conditions = [];

    if (filters.startDate) {
      conditions.push(gte(bookings.createdAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(bookings.createdAt, filters.endDate));
    }

    if (filters.city) {
      conditions.push(sql`${bookings.city} = ${filters.city}`);
    }

    if (filters.status) {
      conditions.push(eq(bookings.status, filters.status));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

export const analyticsService = new AnalyticsService();