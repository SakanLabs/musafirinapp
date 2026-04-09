import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

export type ServiceItemType = 'visa_umrah' | 'transportasi' | 'other';

export interface BookingServiceItem {
  id: number;
  bookingId: number;
  serviceType: ServiceItemType;
  description: string;
  quantity: number;
  unitPrice: string; // decimal stored as string
  subtotal: string; // decimal stored as string
  notes?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingServiceItemData {
  bookingId: number;
  serviceType: ServiceItemType;
  description: string;
  quantity: number;
  unitPrice: number; // send as number; backend stores decimal
  notes?: string;
  meta?: Record<string, unknown>;
}

export const bookingServiceItemKeys = {
  all: ['bookingServiceItems'] as const,
  listByBooking: (bookingId: string | number) => [...bookingServiceItemKeys.all, 'booking', bookingId.toString()] as const,
};

// List service items by booking
export function useBookingServiceItems(bookingId?: string | number) {
  return useQuery({
    queryKey: bookingServiceItemKeys.listByBooking(bookingId || 'none'),
    queryFn: async () => {
      if (!bookingId) return [] as BookingServiceItem[];
      const response = await apiClient.get<{ success: boolean; data: BookingServiceItem[] }>(API_ENDPOINTS.BOOKING_SERVICE_ITEMS_BY_BOOKING(bookingId));
      return response.data;
    },
    enabled: !!bookingId,
    staleTime: 2 * 60 * 1000,
  });
}

// Create a new service item
export function useCreateBookingServiceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBookingServiceItemData) => {
      const response = await apiClient.post<{ success: boolean; data: BookingServiceItem }>(API_ENDPOINTS.BOOKING_SERVICE_ITEMS, data);
      return response.data;
    },
    onSuccess: (item) => {
      // Invalidate the list for this booking
      queryClient.invalidateQueries({ queryKey: bookingServiceItemKeys.listByBooking(item.bookingId) });
    },
  });
}

// Delete a service item
export function useDeleteBookingServiceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, bookingId }: { id: number; bookingId: number }) => {
      const response = await apiClient.delete<{ success: boolean }>(`${API_ENDPOINTS.BOOKING_SERVICE_ITEMS}/${id}`);
      return { ...response, id, bookingId };
    },
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingServiceItemKeys.listByBooking(variables.bookingId) });
    },
  });
}