import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { StatCard } from '../ui/stat-card';
import { SARAmount } from '../ui/sar-currency';
import { useDashboardAnalytics } from '../../lib/queries';
import type { AnalyticsFilters } from 'shared/src/types';
import { Coins, BarChart3, TrendingUp, Percent, Filter, Download } from 'lucide-react';

export function AnalyticsDashboard() {
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data: analytics, isLoading, error } = useDashboardAnalytics(filters);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-destructive">Error Loading Analytics</h3>
        <p className="text-sm text-destructive/80 mt-1">
          {error instanceof Error ? error.message : 'Failed to load analytics data'}
        </p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-muted border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">No analytics data available</p>
      </div>
    );
  }

  const { summary, revenue, profit } = analytics;

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {showFilters && (
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={filters.startDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  startDate: e.target.value ? new Date(e.target.value) : undefined
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={filters.endDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  endDate: e.target.value ? new Date(e.target.value) : undefined
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={filters.city || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  city: e.target.value as 'Makkah' | 'Madinah' | undefined
                }))}
              >
                <option value="">All Cities</option>
                <option value="Makkah">Makkah</option>
                <option value="Madinah">Madinah</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={filters.status || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  status: e.target.value as 'pending' | 'confirmed' | 'cancelled' | undefined
                }))}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={<SARAmount amount={summary.totalRevenue || 0} />}
          icon={Coins}
          change={revenue.revenueTrend?.length > 1 ? {
            value: `${calculateTrendPercentage(revenue.revenueTrend).toFixed(1)}%`,
            type: revenue.revenueTrend[revenue.revenueTrend.length - 1]?.revenue > 
                   (revenue.revenueTrend[revenue.revenueTrend.length - 2]?.revenue || 0) 
                   ? 'increase' : 'decrease'
          } : undefined}
        />
        <StatCard
          title="Total Bookings"
          value={(summary.totalBookings || 0).toString()}
          icon={BarChart3}
          change={revenue.revenueTrend?.length > 1 ? {
            value: `${calculateBookingTrendPercentage(revenue.revenueTrend).toFixed(1)}%`,
            type: revenue.revenueTrend[revenue.revenueTrend.length - 1]?.bookingCount > 
                   (revenue.revenueTrend[revenue.revenueTrend.length - 2]?.bookingCount || 0)
                   ? 'increase' : 'decrease'
          } : undefined}
        />
        <StatCard
          title="Net Profit"
          value={<SARAmount amount={summary.netProfit || 0} />}
          icon={TrendingUp}
          change={profit.profitByPeriod?.length > 1 ? {
            value: `${calculateProfitTrendPercentage(profit.profitByPeriod).toFixed(1)}%`,
            type: (summary.netProfit || 0) > 0 ? 'increase' : 'decrease'
          } : undefined}
        />
        <StatCard
          title="Profit Margin"
          value={`${(summary.profitMargin || 0).toFixed(1)}%`}
          icon={Percent}
          change={profit.profitByPeriod?.length > 1 ? {
            value: `${calculateMarginTrendPercentage(profit.profitByPeriod).toFixed(1)}%`,
            type: (summary.profitMargin || 0) > 0 ? 'increase' : 'decrease'
          } : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Revenue chart will be displayed here</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Profit Analysis</h3>
          <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Profit chart will be displayed here</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Performance by City</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {revenue.revenueByCity.map((city, index) => {
            const cityProfit = profit.profitByCity.find(p => p.city === city.city);
            return (
              <div key={index} className="bg-muted rounded-xl p-6">
                <h4 className="text-base font-semibold text-foreground mb-3">{city.city}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Revenue:</span>
                    <span className="text-sm font-medium text-foreground"><SARAmount amount={city.revenue || 0} /></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Bookings:</span>
                    <span className="text-sm font-medium text-foreground">{city.bookingCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Booking Value:</span>
                    <span className="text-sm font-medium text-foreground"><SARAmount amount={city.averageBookingValue || 0} /></span>
                  </div>
                  {cityProfit && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Net Profit:</span>
                        <span className={`text-sm font-medium ${(cityProfit.netProfit || 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                          <SARAmount amount={cityProfit.netProfit || 0} />
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Profit Margin:</span>
                        <span className={`text-sm font-medium ${(cityProfit.profitMargin || 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                          {(cityProfit.profitMargin || 0).toFixed(1)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Cost Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Total Costs</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Hotel Costs:</span>
                <span className="text-sm font-medium text-foreground"><SARAmount amount={profit.costBreakdown?.totalHotelCosts || 0} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Operational Costs:</span>
                <span className="text-sm font-medium text-foreground"><SARAmount amount={profit.costBreakdown?.totalOperationalCosts || 0} /></span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-sm font-semibold text-foreground">Total:</span>
                <span className="text-sm font-semibold text-foreground">
                  <SARAmount amount={(profit.costBreakdown?.totalHotelCosts || 0) + (profit.costBreakdown?.totalOperationalCosts || 0)} />
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Operational Costs by Type</h4>
            <div className="space-y-2">
              {(profit.costBreakdown?.operationalCostsByType || []).map((cost, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{cost.costType}:</span>
                  <span className="text-sm font-medium text-foreground">
                    <SARAmount amount={cost.amount || 0} /> ({(cost.percentage || 0).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Revenue by Period</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Period</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Bookings</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Value</th>
                </tr>
              </thead>
              <tbody>
                {(revenue.revenueByPeriod || []).map((period, index) => (
                  <tr key={index} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 text-sm text-foreground">{period.period}</td>
                    <td className="text-right py-2.5 text-sm text-foreground"><SARAmount amount={period.revenue || 0} /></td>
                    <td className="text-right py-2.5 text-sm text-foreground">{period.bookingCount || 0}</td>
                    <td className="text-right py-2.5 text-sm text-foreground">
                      <SARAmount amount={(period.revenue || 0) / (period.bookingCount || 1)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Profit by Period</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Period</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Costs</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Profit</th>
                  <th className="text-right py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(profit.profitByPeriod || []).map((period, index) => (
                  <tr key={index} className="border-b border-border last:border-b-0">
                    <td className="py-2.5 text-sm text-foreground">{period.period}</td>
                    <td className="text-right py-2.5 text-sm text-foreground"><SARAmount amount={period.revenue || 0} /></td>
                    <td className="text-right py-2.5 text-sm text-foreground">
                      <SARAmount amount={(period.hotelCosts || 0) + (period.operationalCosts || 0)} />
                    </td>
                    <td className="text-right py-2.5 text-sm font-medium">
                      <span className={(period.netProfit || 0) >= 0 ? 'text-green-600' : 'text-destructive'}>
                        <SARAmount amount={period.netProfit || 0} />
                      </span>
                    </td>
                    <td className="text-right py-2.5">
                      <span className={`text-sm font-medium ${(period.profitMargin || 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {(period.profitMargin || 0).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function calculateTrendPercentage(data: Array<{ revenue: number }>): number {
  if (data.length < 2) return 0;
  const current = data[data.length - 1].revenue;
  const previous = data[data.length - 2].revenue;
  return previous > 0 ? ((current - previous) / previous) * 100 : 0;
}

function calculateBookingTrendPercentage(data: Array<{ bookingCount: number }>): number {
  if (data.length < 2) return 0;
  const current = data[data.length - 1].bookingCount;
  const previous = data[data.length - 2].bookingCount;
  return previous > 0 ? ((current - previous) / previous) * 100 : 0;
}

function calculateProfitTrendPercentage(data: Array<{ netProfit: number }>): number {
  if (data.length < 2) return 0;
  const current = data[data.length - 1].netProfit;
  const previous = data[data.length - 2].netProfit;
  return previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
}

function calculateMarginTrendPercentage(data: Array<{ profitMargin: number }>): number {
  if (data.length < 2) return 0;
  const current = data[data.length - 1].profitMargin;
  const previous = data[data.length - 2].profitMargin;
  return current - previous;
}
