import { Hono } from 'hono';
import { analyticsService, type AnalyticsFilters } from '../services/AnalyticsService';
import { requireAdmin } from '../middleware/auth';

const app = new Hono();

// Helper function to parse and validate query parameters
function parseAnalyticsFilters(query: Record<string, string | undefined>): AnalyticsFilters {
  const filters: AnalyticsFilters = {};

  if (query.startDate) {
    const startDate = new Date(query.startDate);
    if (!isNaN(startDate.getTime())) {
      filters.startDate = startDate;
    }
  }

  if (query.endDate) {
    const endDate = new Date(query.endDate);
    if (!isNaN(endDate.getTime())) {
      filters.endDate = endDate;
    }
  }

  if (query.city && (query.city === 'Makkah' || query.city === 'Madinah')) {
    filters.city = query.city;
  }

  if (query.status && ['pending', 'confirmed', 'cancelled'].includes(query.status)) {
    filters.status = query.status as 'pending' | 'confirmed' | 'cancelled';
  }

  return filters;
}

/**
 * GET /analytics/revenue
 * Get comprehensive revenue analytics data
 */
app.get('/revenue', requireAdmin, async (c) => {
  try {
    const query = c.req.query();
    const filters = parseAnalyticsFilters(query);
    const revenueData = await analyticsService.getRevenueData(filters);
    
    return c.json({
      success: true,
      data: revenueData,
    });
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch revenue data',
    }, 500);
  }
});

/**
 * GET /analytics/profit
 * Get comprehensive profit analytics data
 */
app.get('/profit', requireAdmin, async (c) => {
  try {
    const query = c.req.query();
    const filters = parseAnalyticsFilters(query);
    const profitData = await analyticsService.getProfitData(filters);
    
    return c.json({
      success: true,
      data: profitData,
    });
  } catch (error) {
    console.error('Error fetching profit data:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch profit data',
    }, 500);
  }
});

/**
 * GET /analytics/dashboard
 * Get combined analytics data for dashboard
 */
app.get('/dashboard', requireAdmin, async (c) => {
  try {
    const query = c.req.query();
    const filters = parseAnalyticsFilters(query);
    const analyticsData = await analyticsService.getAnalyticsData(filters);
    
    return c.json({
      success: true,
      data: analyticsData,
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch analytics data',
    }, 500);
  }
});

/**
 * GET /analytics/summary
 * Get quick summary statistics
 */
app.get('/summary', requireAdmin, async (c) => {
  try {
    const query = c.req.query();
    const filters = parseAnalyticsFilters(query);
    const analyticsData = await analyticsService.getAnalyticsData(filters);
    
    return c.json({
      success: true,
      data: analyticsData.summary,
    });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch analytics summary',
    }, 500);
  }
});

export default app;