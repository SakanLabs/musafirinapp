import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

// Types for transportation bookings (based on the backend schema)
export interface TransportationRoute {
  id: number;
  transportationBookingId: number;
  pickupDateTime: string;
  originLocation: string;
  destinationLocation: string;
  vehicleType: string;
  price: string;
  currency?: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlateNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransportationBooking {
  id: number;
  number: string;
  clientId?: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  totalAmount: string;
  currency: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  routeCount: number;
  createdAt: string;
  updatedAt: string;
  routes?: TransportationRoute[];
}

export interface CreateTransportationBookingData {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  totalAmount: number;
  currency?: string;
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  routes: {
    pickupDate: string;
    pickupTime: string;
    origin: string;
    destination: string;
    vehicleType: string;
    price: number;
    notes?: string;
  }[];
}

export interface UpdateTransportationBookingData extends CreateTransportationBookingData {
  id: string | number;
}

// Query keys
export const transportationBookingKeys = {
  all: ['transportation-bookings'] as const,
  lists: () => [...transportationBookingKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...transportationBookingKeys.lists(), { filters }] as const,
  details: () => [...transportationBookingKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...transportationBookingKeys.details(), id.toString()] as const,
};

// Get all transportation bookings
export function useTransportationBookings() {
  return useQuery({
    queryKey: transportationBookingKeys.lists(),
    queryFn: async () => {
      const response = await apiClient.get<TransportationBooking[]>(API_ENDPOINTS.TRANSPORTATION);
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get transportation booking by ID
export function useTransportationBooking(id: string) {
  return useQuery({
    queryKey: transportationBookingKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<TransportationBooking>(`${API_ENDPOINTS.TRANSPORTATION}/${id}`);
      return response;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Create new transportation booking
export function useCreateTransportationBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTransportationBookingData) => {
      console.log('Creating transportation booking with data:', data);
      
      const requestData = {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || null,
        totalAmount: data.totalAmount,
        currency: data.currency || 'SAR',
        status: data.status || 'pending',
        notes: data.notes || null,
        routes: data.routes
      };
      
      console.log('Sending request data to backend:', requestData);
      
      const response = await apiClient.post<TransportationBooking>(API_ENDPOINTS.TRANSPORTATION, requestData);
      return response;
    },
    onSuccess: () => {
      // Invalidate and refetch transportation bookings list
      queryClient.invalidateQueries({ queryKey: transportationBookingKeys.lists() });
    },
  });
}

// Update transportation booking
export function useUpdateTransportationBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateTransportationBookingData) => {
      const { id, ...updateData } = data;
      const response = await apiClient.put<TransportationBooking>(`${API_ENDPOINTS.TRANSPORTATION}/${id}`, updateData);
      return response;
    },
    onSuccess: (response) => {
      // Update the specific booking in cache
      queryClient.setQueryData(transportationBookingKeys.detail(response.id), response);
      // Invalidate bookings list to refresh
      queryClient.invalidateQueries({ queryKey: transportationBookingKeys.lists() });
    },
  });
}

// Delete transportation booking
export function useDeleteTransportationBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string | number) => {
      const bookingId = id.toString();
      const response = await apiClient.delete<{ message: string }>(
        `${API_ENDPOINTS.TRANSPORTATION}/${bookingId}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transportationBookingKeys.lists() });
    },
  });
}

// Generate invoice for transportation booking
export function useGenerateTransportationInvoice() {
  return useMutation({
    mutationFn: async (bookingId: string | number) => {
      const response = await apiClient.post<{
        id: number;
        number: string;
        transportationBookingId: number;
        amount: string;
        currency: string;
        issueDate: string;
        dueDate: string;
        status: string;
      }>(`${API_ENDPOINTS.TRANSPORTATION}/${bookingId}/invoice`);
      return response;
    },
  });
}

// Generate receipt for transportation booking
export function useGenerateTransportationReceipt() {
  return useMutation({
    mutationFn: async (bookingId: string | number) => {
      const response = await apiClient.post<{
        id: number;
        number: string;
        transportationBookingId: number;
        amount: string;
        currency: string;
        issueDate: string;
      }>(`${API_ENDPOINTS.TRANSPORTATION}/${bookingId}/receipt`);
      return response;
    },
  });
}