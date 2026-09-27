// ===== ANALYTICS FILTERS =====
export interface AnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  city?: 'Makkah' | 'Madinah';
  status?: 'pending' | 'confirmed' | 'cancelled';
}

// ===== REVENUE ANALYTICS =====
export interface RevenueData {
  totalRevenue: number;
  revenueByPeriod: PeriodRevenue[];
  revenueByCity: CityRevenue[];
  revenueTrend: RevenueTrend[];
}

export interface PeriodRevenue {
  period: string; // e.g., "2024-01", "2024-Q1", "2024"
  revenue: number;
  bookingCount: number;
}

export interface CityRevenue {
  city: 'Makkah' | 'Madinah';
  revenue: number;
  bookingCount: number;
  averageBookingValue: number;
}

export interface RevenueTrend {
  date: string; // ISO date string
  revenue: number;
  bookingCount: number;
}

// ===== PROFIT ANALYTICS =====
export interface ProfitData {
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  profitByPeriod: PeriodProfit[];
  profitByCity: CityProfit[];
  costBreakdown: CostBreakdown;
}

export interface PeriodProfit {
  period: string;
  revenue: number;
  hotelCosts: number;
  operationalCosts: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
}

export interface CityProfit {
  city: 'Makkah' | 'Madinah';
  revenue: number;
  hotelCosts: number;
  operationalCosts: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
}

export interface CostBreakdown {
  totalHotelCosts: number;
  totalOperationalCosts: number;
  operationalCostsByType: OperationalCostByType[];
}

export interface OperationalCostByType {
  costType: string;
  amount: number;
  percentage: number;
}

// ===== COMBINED ANALYTICS =====
export interface AnalyticsData {
  summary: AnalyticsSummary;
  revenue: RevenueData;
  profit: ProfitData;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalBookings: number;
  averageBookingValue: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  topPerformingCity: {
    city: 'Makkah' | 'Madinah';
    revenue: number;
  };
}

// ===== COST MANAGEMENT TYPES =====
export interface HotelCostTemplate {
  id: number;
  hotelName: string;
  city: 'Makkah' | 'Madinah';
  roomType: string;
  costPrice: string; // decimal as string
  createdAt: Date;
  updatedAt: Date;
}

export interface NewHotelCostTemplate {
  hotelName: string;
  city: 'Makkah' | 'Madinah';
  roomType: string;
  costPrice: string;
}

export interface OperationalCost {
  id: number;
  bookingId: number;
  costType: string;
  amount: string; // decimal as string
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewOperationalCost {
  bookingId: number;
  costType: string;
  amount: string;
  description?: string;
}

// ===== API RESPONSE TYPES =====
export interface AnalyticsApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface CostApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// ===== DASHBOARD CHART TYPES =====
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ComparisonDataPoint {
  category: string;
  current: number;
  previous?: number;
  target?: number;
}

// ===== FILTER OPTIONS =====
export interface FilterOptions {
  cities: Array<{ value: 'Makkah' | 'Madinah'; label: string }>;
  statuses: Array<{ value: 'pending' | 'confirmed' | 'cancelled'; label: string }>;
  dateRanges: Array<{ value: string; label: string; startDate: Date; endDate: Date }>;
}

// ===== EXPORT TYPES =====
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  includeCharts: boolean;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  filters: AnalyticsFilters;
}

// ===== CONSTANTS =====
export const CITIES = ['Makkah', 'Madinah'] as const;
export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export const COST_TYPES = [
  'Transportation',
  'Meals',
  'Guide Services',
  'Administrative',
  'Marketing',
  'Other'
] as const;