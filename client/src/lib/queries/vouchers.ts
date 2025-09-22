import { useQuery } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

// Types for vouchers (based on API response)
export interface Voucher {
  id: number;
  number: string;
  bookingId: number;
  guestName: string;
  qrUrl: string;
  pdfUrl: string;
  createdAt: string;
  // Related booking data from join
  bookingCode: string;
  clientName: string;
  clientEmail: string;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
}

// Query keys
export const voucherKeys = {
  all: ['vouchers'] as const,
  lists: () => [...voucherKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...voucherKeys.lists(), { filters }] as const,
  details: () => [...voucherKeys.all, 'detail'] as const,
  detail: (id: string) => [...voucherKeys.details(), id] as const,
};

// Get all vouchers
export function useVouchers() {
  return useQuery({
    queryKey: voucherKeys.lists(),
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: Voucher[]}>(API_ENDPOINTS.VOUCHERS);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get voucher by ID
export function useVoucher(id: string) {
  return useQuery({
    queryKey: voucherKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: Voucher}>(`/api/vouchers/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}