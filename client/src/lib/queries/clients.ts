import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';
import type { Booking } from './bookings';

// Types for clients (based on the schema)
export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Deposit information (from join with clientDeposits)
  currentBalance?: number | null;
  totalDeposited?: number | null;
  totalUsed?: number | null;
  currency?: string | null;
  lastTransactionAt?: string | null;
}

export interface CreateClientData {
  name: string;
  email: string;
  phone: string;
  address?: string;
}

export interface UpdateClientData {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
}

// Query keys
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...clientKeys.lists(), { filters }] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...clientKeys.details(), id.toString()] as const,
};

// API Response interface for clients
interface ClientsResponse {
  clients: Client[];
  pagination: {
    page: number;
    limit: number;
    totalCount: string;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Get all clients
export function useClients() {
  return useQuery({
    queryKey: clientKeys.lists(),
    queryFn: async () => {
      try {
        const response = await apiClient.get<ClientsResponse>(`${API_ENDPOINTS.CLIENTS}?active=true`);
        return response.clients; // Use 'clients' property instead of 'data'
      } catch (error) {
        // If unauthorized or any error, return empty array to prevent undefined error
        console.warn('Failed to fetch clients:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// API Response interface for single client
export interface ClientBookingSummary {
  id: number;
  code: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  bookingStatus: string;
  mealPlan: Booking['mealPlan'];
  createdAt: string;
}

interface ClientDetailResponse {
  client: Client;
  recentBookings: ClientBookingSummary[];
  recentTransactions: Array<{
    id: number;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
}

async function fetchClientDetail(id: string) {
  const response = await apiClient.get<ClientDetailResponse>(`${API_ENDPOINTS.CLIENTS}/${id}`);
  return response;
}

// Get client by ID
export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => fetchClientDetail(id),
    select: (data) => data.client,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get all bookings for a client (from client detail response)
export function useClientBookings(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => fetchClientDetail(id),
    select: (data) => data.recentBookings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get recent deposit transactions from client detail response
export function useClientRecentTransactions(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => fetchClientDetail(id),
    select: (data) => data.recentTransactions,
    staleTime: 5 * 60 * 1000,
  });
}

// Create new client
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateClientData) => {
      const response = await apiClient.post<{success: boolean, data: Client}>(API_ENDPOINTS.CLIENTS, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch clients list
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

// Update existing client
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateClientData) => {
      const response = await apiClient.put<{success: boolean, data: Client}>(`${API_ENDPOINTS.CLIENTS}/${data.id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate and refetch clients list and specific client
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
    },
  });
}

// Delete client
export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      try {
        console.log('🔥 useDeleteClient mutationFn called with id:', id);
        const response = await apiClient.delete<{success: boolean}>(`${API_ENDPOINTS.CLIENTS}/${id}`);
        console.log('🔥 useDeleteClient success response:', response);
        return response;
      } catch (error: any) {
        console.log('🔥 useDeleteClient caught error:', error);
        console.log('🔥 useDeleteClient error message:', error?.message);
        // Re-throw the error with the original message preserved
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch clients list
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}
