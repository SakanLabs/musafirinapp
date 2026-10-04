import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

export interface ArrivalItem {
  id: number;
  code: string;
  clientId: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  totalAmount: string | number;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'overdue';
  hotelConfirmationNo: string | null;
  notes: string;
  totalRooms: number;
  roomSummary: string;
  pax: number;
  daysUntilArrival: number;
  urgency: 'critical' | 'warning' | 'normal';
  isHcnMissing: boolean;
  isHcnUrgent: boolean;
  voucherStatus: 'sent' | 'ready_not_sent' | 'not_ready';
  voucherNumber: string | null;
  voucherPdfUrl: string | null;
  voucherSentAt: string | null;
  notificationSummary: {
    paymentEmail: string;
    paymentWhatsApp: string;
    voucherEmail: string;
    voucherWhatsApp: string;
  };
}

export interface ArrivalsSummary {
  totalArrivals: number;
  todayArrivals: number;
  next3DaysArrivals: number;
  missingHcnCount: number;
  urgentMissingHcnCount: number;
  voucherNotSentCount: number;
  paymentIncompleteCount: number;
  windowPeriod: {
    from: string;
    to: string;
    printedAt: string;
  };
}

export interface ArrivalsData {
  data: ArrivalItem[];
  summary: ArrivalsSummary;
}

export interface ArrivalsFilterParams {
  from?: string;
  to?: string;
  city?: string;
  hotel?: string;
  paymentStatus?: string;
  voucherStatus?: string;
  search?: string;
}

export function useUpcomingArrivals(filters?: ArrivalsFilterParams) {
  return useQuery({
    queryKey: ['arrivals', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.from) params.append('from', filters.from);
      if (filters?.to) params.append('to', filters.to);
      if (filters?.city && filters.city !== 'all') params.append('city', filters.city);
      if (filters?.hotel) params.append('hotel', filters.hotel);
      if (filters?.paymentStatus && filters.paymentStatus !== 'all') params.append('paymentStatus', filters.paymentStatus);
      if (filters?.voucherStatus && filters.voucherStatus !== 'all') params.append('voucherStatus', filters.voucherStatus);
      if (filters?.search) params.append('search', filters.search);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await apiClient.get<{
        success: boolean;
        data: ArrivalItem[];
        summary: ArrivalsSummary;
      }>(`/api/bookings/arrivals${qs}`);

      return {
        data: response.data || [],
        summary: response.summary,
      };
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
