import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

// Types for bookings (based on the schema)
export interface Booking {
  id: number;
  code: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue';
  bookingStatus: 'pending' | 'confirmed' | 'cancelled';
  hotelConfirmationNo?: string;
  meta?: any;
  createdAt: string;
  updatedAt: string;
  items?: any[];
}

export interface CreateBookingData {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  hotelName: string;
  city: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  numberOfGuests: number;
  totalAmount: number;
  specialRequests?: string;
}

export interface UpdateBookingData {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  numberOfGuests: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  specialRequests?: string;
}

// Query keys
export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...bookingKeys.lists(), { filters }] as const,
  details: () => [...bookingKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...bookingKeys.details(), id.toString()] as const,
};

// Get all bookings
export function useBookings() {
  return useQuery({
    queryKey: bookingKeys.lists(),
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: Booking[]}>(API_ENDPOINTS.BOOKINGS);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get booking by ID
export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => {
      // Temporarily use test endpoint for testing complete data
      const response = await apiClient.get<{success: boolean, data: Booking}>(`${API_ENDPOINTS.BOOKINGS}/test/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Create new booking
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBookingData) => {
      // Transform data to match backend API format
      const requestData = {
        client: {
          name: data.guestName,
          email: data.guestEmail,
          phone: data.guestPhone
        },
        booking: {
          hotelName: data.hotelName,
          city: data.city,
          checkIn: data.checkInDate,
          checkOut: data.checkOutDate,
          meta: data.specialRequests ? { specialRequests: data.specialRequests } : null
        },
        items: [
          {
            roomType: data.roomType,
            roomCount: 1, // Assuming 1 room for now
            unitPrice: data.totalAmount.toString() // Total amount as unit price for single room
          }
        ]
      };
      
      const response = await apiClient.post<{success: boolean, data: Booking}>(API_ENDPOINTS.BOOKINGS, requestData);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch bookings list
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// Update booking
export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateBookingData) => {
      const { id, ...updateData } = data;
      const response = await apiClient.put<{success: boolean, data: Booking}>(`${API_ENDPOINTS.BOOKINGS}/${id}`, updateData);
      return response.data;
    },
    onSuccess: (response) => {
      // Update the specific booking in cache
      queryClient.setQueryData(bookingKeys.detail(response.id), response);
      // Invalidate bookings list to refresh
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// Update booking status and hotel confirmation number
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      paymentStatus, 
      bookingStatus, 
      hotelConfirmationNo 
    }: { 
      id: string; 
      paymentStatus?: Booking['paymentStatus']; 
      bookingStatus?: Booking['bookingStatus'];
      hotelConfirmationNo?: string;
    }) => {
      const updateData: any = {};
      
      if (paymentStatus) updateData.paymentStatus = paymentStatus;
      if (bookingStatus) updateData.bookingStatus = bookingStatus;
      if (hotelConfirmationNo !== undefined) updateData.hotelConfirmationNo = hotelConfirmationNo;
      
      const response = await apiClient.patch<{success: boolean, data: Booking}>(API_ENDPOINTS.BOOKING_BY_ID(id), updateData);
      return response.data;
    },
    onSuccess: (booking) => {
      // Update the specific booking in cache
      queryClient.setQueryData(bookingKeys.detail(booking.id), booking);
      // Invalidate bookings list to refresh
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// Generate invoice for booking
export function useGenerateInvoice() {
  return useMutation({
    mutationFn: async ({ bookingId, dueDate }: { bookingId: string; dueDate: string }) => {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: any;
        downloadUrl: string;
      }>(API_ENDPOINTS.GENERATE_INVOICE(bookingId), {
        dueDate
      });
      
      // Auto-download the PDF if downloadUrl is provided
      if (response.downloadUrl) {
        const filename = `invoice-${response.data.number || bookingId}.pdf`;
        await apiClient.downloadFile(response.downloadUrl, filename);
      }
      
      return response;
    },
  });
}

// Generate voucher for booking
export function useGenerateVoucher() {
  return useMutation({
    mutationFn: async ({ bookingId, guestName }: { bookingId: string; guestName: string }) => {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: {
          id: number;
          number: string;
          bookingId: number;
          guestName: string;
          qrUrl: string;
          pdfUrl: string;
          createdAt: string;
        };
      }>(API_ENDPOINTS.GENERATE_VOUCHER(bookingId), {
        guestName
      });
      
      // Auto-download the PDF if pdfUrl is provided
      if (response.data.pdfUrl) {
        const filename = `voucher-${response.data.number}.pdf`;
        await apiClient.downloadFile(response.data.pdfUrl, filename);
      }
      
      return response;
    },
  });
}