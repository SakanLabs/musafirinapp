import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';

export type ArrivalServiceType = 'hotel' | 'muthowif' | 'transportation';

export interface ArrivalItem {
  serviceType: ArrivalServiceType;
  /** Unique row key: a transportation booking yields one row per route */
  uid: string;
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
  /** Hotel check-in, muthowif schedule, or transport pickup time */
  checkIn: string;
  checkOut: string | null;
  totalAmount: string | number;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'overdue';
  hotelConfirmationNo: string | null;
  source: string | null;
  notes: string;
  totalRooms: number;
  roomSummary: string;
  pax: number;
  daysUntilArrival: number;
  urgency: 'critical' | 'warning' | 'normal';
  isHcnMissing: boolean;
  isHcnUrgent: boolean;
  /** 'issued' = muthowif/transport voucher generated (no delivery tracking) */
  voucherStatus: 'sent' | 'issued' | 'ready_not_sent' | 'not_ready';
  voucherNumber: string | null;
  voucherPdfUrl: string | null;
  voucherSentAt: string | null;
  eventTime: string | null;
  /** Muthowif meeting point or transport "origin → destination" */
  location: string | null;
  /** Muthowif events or transport vehicle info */
  serviceDetail: string | null;
  /** Assigned muthowif or driver */
  assigneeName: string | null;
  assigneePhone: string | null;
  isAssigneeMissing: boolean;
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
  missingAssigneeCount: number;
  urgentMissingAssigneeCount: number;
  countsByServiceType: Record<ArrivalServiceType, number>;
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
  serviceType?: string;
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
      if (filters?.serviceType && filters.serviceType !== 'all') params.append('serviceType', filters.serviceType);

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
