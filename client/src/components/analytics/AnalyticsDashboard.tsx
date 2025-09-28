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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error Loading Analytics</h3>
        <p className="text-red-600 text-sm mt-1">
          {error instanceof Error ? error.message : 'Failed to load analytics data'}
        </p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  const { summary, revenue, profit } = analytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue & Profit Analytics</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive analysis of your business performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={filters.startDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  startDate: e.target.value ? new Date(e.target.value) : undefined
                }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={filters.endDate?.toISOString().split('T')[0] || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  endDate: e.target.value ? new Date(e.target.value) : undefined
                }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Summary Cards */}
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

      {/* Revenue and Profit Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Revenue chart will be displayed here</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Profit Analysis</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Profit chart will be displayed here</p>
            </div>
          </div>
        </Card>
      </div>

      {/* City Performance Comparison */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance by City</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {revenue.revenueByCity.map((city, index) => {
            const cityProfit = profit.profitByCity.find(p => p.city === city.city);
            return (
              <div key={index} className="border rounded-lg p-4">
                <h4 className="font-medium text-lg mb-3">{city.city}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Revenue:</span>
                    <span className="font-medium"><SARAmount amount={city.revenue || 0} /></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bookings:</span>
                    <span className="font-medium">{city.bookingCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Booking Value:</span>
                    <span className="font-medium"><SARAmount amount={city.averageBookingValue || 0} /></span>
                  </div>
                  {cityProfit && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Net Profit:</span>
                        <span className={`font-medium ${(cityProfit.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <SARAmount amount={cityProfit.netProfit || 0} />
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Profit Margin:</span>
                        <span className={`font-medium ${(cityProfit.profitMargin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

      {/* Cost Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Total Costs</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Hotel Costs:</span>
                <span className="font-medium"><SARAmount amount={profit.costBreakdown?.totalHotelCosts || 0} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Operational Costs:</span>
                <span className="font-medium"><SARAmount amount={profit.costBreakdown?.totalOperationalCosts || 0} /></span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Total:</span>
                <span className="font-medium">
                  <SARAmount amount={(profit.costBreakdown?.totalHotelCosts || 0) + (profit.costBreakdown?.totalOperationalCosts || 0)} />
                </span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-3">Operational Costs by Type</h4>
            <div className="space-y-2">
              {(profit.costBreakdown?.operationalCostsByType || []).map((cost, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{cost.costType}:</span>
                  <span className="font-medium">
                    <SARAmount amount={cost.amount || 0} /> ({(cost.percentage || 0).toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue by Period</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Period</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">Bookings</th>
                  <th className="text-right py-2">Avg Value</th>
                </tr>
              </thead>
              <tbody>
                {(revenue.revenueByPeriod || []).map((period, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{period.period}</td>
                    <td className="text-right py-2"><SARAmount amount={period.revenue || 0} /></td>
                    <td className="text-right py-2">{period.bookingCount || 0}</td>
                    <td className="text-right py-2">
                      <SARAmount amount={(period.revenue || 0) / (period.bookingCount || 1)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Profit by Period</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Period</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">Costs</th>
                  <th className="text-right py-2">Net Profit</th>
                  <th className="text-right py-2">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(profit.profitByPeriod || []).map((period, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{period.period}</td>
                    <td className="text-right py-2"><SARAmount amount={period.revenue || 0} /></td>
                    <td className="text-right py-2">
                      <SARAmount amount={(period.hotelCosts || 0) + (period.operationalCosts || 0)} />
                    </td>
                    <td className="text-right py-2 font-medium">
                      <span className={(period.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        <SARAmount amount={period.netProfit || 0} />
                      </span>
                    </td>
                    <td className="text-right py-2">
                      <span className={(period.profitMargin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
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

// Helper functions for trend calculations
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