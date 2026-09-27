import { useQuery } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

// Types for dashboard reports
export interface DashboardSummary {
  totalBookings: number;
  totalRevenue: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  totalVouchers: number;
  usedVouchers: number;
  recentBookings: Array<{
    id: string;
    guestName: string;
    checkInDate: string;
    roomType: string;
    status: string;
    totalAmount: number;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    bookings: number;
  }>;
  roomTypeStats: Array<{
    roomType: string;
    bookings: number;
    revenue: number;
  }>;
}

// Query keys
export const reportKeys = {
  all: ['reports'] as const,
  summary: () => [...reportKeys.all, 'summary'] as const,
};

// Get dashboard summary
export function useDashboardSummary() {
  return useQuery({
    queryKey: reportKeys.summary(),
    queryFn: () => apiClient.get<DashboardSummary>(API_ENDPOINTS.REPORTS_SUMMARY),
    staleTime: 2 * 60 * 1000, // 2 minutes (more frequent updates for dashboard)
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
  });
}