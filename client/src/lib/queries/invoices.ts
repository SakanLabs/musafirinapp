import { useQuery } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

// Types for invoices (based on API documentation)
export interface Invoice {
  id: number;
  number: string;
  bookingId: number;
  amount: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'pending' | 'overdue' | 'cancelled';
  pdfUrl: string;
  // Related booking and client data
  bookingCode: string;
  clientName: string;
  clientEmail: string;
  hotelName: string;
  city: string;
}

// Query keys
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...invoiceKeys.lists(), { filters }] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
};

// Get all invoices
export function useInvoices() {
  return useQuery({
    queryKey: invoiceKeys.lists(),
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: Invoice[]}>(API_ENDPOINTS.INVOICES);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get invoice by ID
export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => apiClient.get<Invoice>(`/api/invoices/${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get or create invoice by booking ID
export function useInvoiceByBooking(bookingId: string) {
  return useQuery({
    queryKey: [...invoiceKeys.all, 'booking', bookingId],
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: Invoice}>(
        API_ENDPOINTS.INVOICE_BY_BOOKING(bookingId)
      );
      return response.data;
    },
    enabled: !!bookingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Check if invoice exists for booking (without creating one)
export function useCheckInvoiceExists(bookingId: string) {
  return useQuery({
    queryKey: [...invoiceKeys.all, 'check-exists', bookingId],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{success: boolean, data: Invoice[]}>(API_ENDPOINTS.INVOICES);
        const invoices = response.data;
        const existingInvoice = invoices.find(invoice => invoice.bookingId.toString() === bookingId);
        return existingInvoice || null;
      } catch (error) {
        console.error('Error checking invoice existence:', error);
        return null;
      }
    },
    enabled: !!bookingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}