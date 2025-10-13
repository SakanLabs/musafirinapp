import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

// Types for bookings (based on the schema)
export interface BookingItem {
  id: number;
  bookingId: number;
  roomType: string; // Changed from enum to string for flexibility
  roomCount: number;
  unitPrice: string; // decimal as string
  hotelCostPrice: string; // decimal as string
  hasPricingPeriods?: boolean;
  pricingPeriods?: PricingPeriod[];
}

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
  mealPlan: 'Breakfast' | 'Half Board' | 'Full Board' | 'Room Only';
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue';
  bookingStatus: 'pending' | 'confirmed' | 'cancelled';
  hotelConfirmationNo?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  items?: BookingItem[];
}

export interface PricingPeriod {
  startDate: string;
  endDate: string;
  nights: number;
  unitPrice: number;
  hotelCostPrice?: number;
  subtotal: number;
}

export interface CreateBookingRoomItem {
  roomType: string;
  roomCount: number;
  unitPrice: number;
  hotelCostPrice?: number;
  hasPricingPeriods?: boolean;
  pricingPeriods?: PricingPeriod[];
}

export interface CreateBookingData {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  hotelName: string;
  city: string;
  checkInDate: string;
  checkOutDate: string;
  rooms: CreateBookingRoomItem[];
  mealPlan: 'Breakfast' | 'Half Board' | 'Full Board' | 'Room Only';
  numberOfGuests: number;
  totalAmount: number;
  specialRequests?: string;
  paymentMethod?: 'bank_transfer' | 'deposit' | 'cash';
  paymentAmount?: number;
  // Legacy fields for backward compatibility
  roomType?: string;
  hotelCostPerNight?: number;
  totalHotelCost?: number;
}

export interface UpdateBookingData {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  mealPlan: 'Breakfast' | 'Half Board' | 'Full Board' | 'Room Only';
  numberOfGuests: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  specialRequests?: string;
  rooms: CreateBookingRoomItem[];
  // Legacy fields for backward compatibility
  roomType?: string;
  hotelCostPerNight?: number;
  totalHotelCost?: number;
}

// Query keys
export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...bookingKeys.lists(), { filters }] as const,
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
      const response = await apiClient.get<{success: boolean, data: Booking}>(`${API_ENDPOINTS.BOOKINGS}/${id}`);
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
      console.log('Creating booking with data:', data);
      
      // Transform data to match backend API format
      let items: any[];
      
      if (data.rooms && data.rooms.length > 0) {
        // New multiple rooms format
        items = data.rooms.map(room => ({
          roomType: room.roomType,
          roomCount: room.roomCount,
          unitPrice: room.unitPrice.toString(),
          hotelCostPrice: room.hotelCostPrice || 0,
          hasPricingPeriods: room.hasPricingPeriods || false,
          ...(room.hasPricingPeriods && room.pricingPeriods ? { pricingPeriods: room.pricingPeriods } : {})
        }));
      } else {
        // Legacy single room format for backward compatibility
        items = [
          {
            roomType: data.roomType || '',
            roomCount: 1,
            unitPrice: data.totalAmount.toString(),
            hotelCostPrice: data.hotelCostPerNight || 0
          }
        ];
      }

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
          mealPlan: data.mealPlan,
          meta: {
            ...(data.specialRequests && { specialRequests: data.specialRequests }),
            numberOfGuests: data.numberOfGuests
          }
        },
        items,
        ...(data.paymentMethod && data.paymentAmount && data.paymentAmount > 0
          ? { payment: { method: data.paymentMethod, amount: data.paymentAmount } }
          : {})
      };
      
      console.log('Sending request data to backend:', requestData);
      
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
      const updateData: Partial<Pick<Booking, 'paymentStatus' | 'bookingStatus' | 'hotelConfirmationNo'>> = {};
      
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

// Delete booking
export function useDeleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string | number) => {
      const bookingId = id.toString();
      const response = await apiClient.delete<{ success: boolean; data: { id: number; code: string; clientId: number } }>(
        API_ENDPOINTS.BOOKING_BY_ID(bookingId)
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

// Generate invoice for booking (automatically replaces existing invoice)
export function useGenerateInvoice() {
  return useMutation({
    mutationFn: async ({ bookingId, dueDate }: { bookingId: string; dueDate: string }) => {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: { number?: string; id: string };
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

// Alias for backward compatibility - now both functions do the same thing
export function useRegenerateInvoice() {
  return useGenerateInvoice();
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

// Alias for backward compatibility - now both functions do the same thing
export function useRegenerateVoucher() {
  return useGenerateVoucher();
}

export interface PayBookingData {
  id: string;
  method: 'bank_transfer' | 'deposit' | 'cash';
  amount: number;
  referenceNumber?: string;
  description?: string;
}

export function usePayBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PayBookingData) => {
      const payload: { method: PayBookingData['method']; amount: number; referenceNumber?: string; description?: string } = {
        method: data.method,
        amount: data.amount,
      };
      if (data.referenceNumber) payload.referenceNumber = data.referenceNumber;
      if (data.description) payload.description = data.description;

      const response = await apiClient.post<{ success: boolean; data: Booking }>(
        API_ENDPOINTS.BOOKING_PAY(data.id),
        payload
      );
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
