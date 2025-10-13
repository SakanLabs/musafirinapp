import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

// Types for receipts (based on API documentation)
export interface Receipt {
  id: number;
  number: string;
  bookingId: number;
  invoiceId: number;
  amount: string;
  currency: string;
  issueDate: string;
  pdfUrl: string;
  // Related booking and client data
  bookingCode: string;
  clientName: string;
  clientEmail: string;
  hotelName: string;
  city: string;
  // Invoice data
  invoiceNumber: string;
  createdAt: string;
  updatedAt: string;
}

// Query keys
export const receiptKeys = {
  all: ['receipts'] as const,
  lists: () => [...receiptKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...receiptKeys.lists(), { filters }] as const,
  details: () => [...receiptKeys.all, 'detail'] as const,
  detail: (id: string) => [...receiptKeys.details(), id] as const,
  byBooking: (bookingId: string) => [...receiptKeys.all, 'booking', bookingId] as const,
};

// Get all receipts with pagination
export function useReceipts(page = 1, limit = 10) {
  return useQuery({
    queryKey: receiptKeys.list({ page, limit }),
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: Receipt[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(`${API_ENDPOINTS.RECEIPTS}?page=${page}&limit=${limit}`);
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get receipt by ID
export function useReceipt(id: string) {
  return useQuery({
    queryKey: receiptKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: Receipt}>(API_ENDPOINTS.RECEIPT_BY_ID(id));
      return response.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Get receipts by booking ID
export function useReceiptsByBooking(bookingId: string) {
  return useQuery({
    queryKey: receiptKeys.byBooking(bookingId),
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: Receipt[]}>(API_ENDPOINTS.RECEIPT_BY_BOOKING(bookingId));
      return response.data;
    },
    enabled: !!bookingId,
    staleTime: 5 * 60 * 1000,
  });
}

// Generate receipt for booking
export function useGenerateReceipt() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiClient.post<{success: boolean, data: Receipt}>(API_ENDPOINTS.GENERATE_RECEIPT, {
        bookingId
      });
      return response.data;
    },
    onSuccess: (_, bookingId) => {
      // Invalidate and refetch receipts
      queryClient.invalidateQueries({ queryKey: receiptKeys.lists() });
      queryClient.invalidateQueries({ queryKey: receiptKeys.byBooking(bookingId.toString()) });
    },
  });
}