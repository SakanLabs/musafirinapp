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
  customLaRequestId?: number;
  routes?: TransportationRoute[];
  paymentStatus?: 'paid' | 'partial' | 'unpaid';
  paidAmount?: number;
  remainingBalance?: number;
  clientName?: string;
  clientDepositBalance?: number;
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
    /** Existing route id, lets the server keep its driver/vehicle assignment */
    id?: number | string;
    driverName?: string;
    driverPhone?: string;
    vehiclePlateNumber?: string;
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
export function useTransportationBookings(clientId?: number, unlinked?: boolean) {
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

export interface UpdateTransportationOperationsData {
  id: string | number;
  status?: TransportationBooking['status'];
  routes?: { id: number; driverName?: string; driverPhone?: string; vehiclePlateNumber?: string }[];
}

// Update booking status and driver/vehicle per route (operational fields only)
export function useUpdateTransportationOperations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTransportationOperationsData) => {
      const response = await apiClient.patch<{ success: boolean; data: TransportationBooking }>(
        `${API_ENDPOINTS.TRANSPORTATION}/${id}/operations`,
        payload
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: transportationBookingKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: transportationBookingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['arrivals'] });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { bookingId: string | number, dueDate: string, forceRegenerate?: boolean, invoiceDate?: string, sendEmail?: boolean, sendWhatsApp?: boolean }) => {
      const response = await apiClient.post<{
        id: number;
        number: string;
        transportationBookingId: number;
        amount: string;
        currency: string;
        issueDate: string;
        dueDate: string;
        status: string;
        pdfUrl?: string;
      }>(`${API_ENDPOINTS.TRANSPORTATION}/${data.bookingId}/invoice`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...transportationBookingKeys.detail(variables.bookingId), 'invoice'] });
    }
  });
}

// Get existing invoice for transportation booking (returns null if none)
export function useTransportationInvoice(bookingId: string | number) {
  return useQuery({
    queryKey: [...transportationBookingKeys.detail(bookingId), 'invoice'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: {
            id: number;
            number: string;
            transportationBookingId: number;
            amount: string;
            currency: string;
            issueDate: string;
            dueDate: string;
            status: string;
          };
        }>(API_ENDPOINTS.TRANSPORTATION_INVOICE(bookingId));
        return response.data;
      } catch (error) {
        // If invoice does not exist, API returns 404, so return null
        return null as any;
      }
    },
    enabled: !!bookingId,
    retry: false,
    staleTime: 2 * 60 * 1000,
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

export type TransportationPaymentMethod = 'bank_transfer' | 'deposit' | 'cash';

export interface TransportationPaymentItem {
  id: number;
  invoiceId: number;
  amount: string;
  method: string;
  referenceNumber: string | null;
  paidAt: string;
  notes: string | null;
  termin: number | null;
  terminLabel: string | null;
  receiptNumber: string | null;
  meta: any;
  createdAt: string;
}

export interface TransportationReceiptItem {
  id: number;
  number: string;
  transportationBookingId: number;
  invoiceId: number | null;
  amount: string;
  paidAmount: string;
  remainingAmount: string | null;
  currency: string;
  issueDate: string;
  receivedFrom: string;
  description: string;
  pdfUrl: string | null;
  meta: any;
  createdAt: string;
}

export interface TransportationBookingBillingData {
  booking: TransportationBooking;
  client: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    depositBalance?: string;
  } | null;
  invoice: {
    id: number;
    number: string;
    amount: string;
    paidAmount: string;
    status: string;
    issueDate: string;
    dueDate: string;
    pdfUrl: string | null;
  } | null;
  payments: TransportationPaymentItem[];
  receipts: TransportationReceiptItem[];
  summary: {
    totalAmount: number;
    paidAmount: number;
    remainingBalance: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid';
    currency: string;
    clientDepositBalance: number;
  };
}

export interface PayTransportationBookingData {
  bookingId: string | number;
  amount: number;
  method: TransportationPaymentMethod;
  referenceNumber?: string;
  description?: string;
  autoGenerateReceipt?: boolean;
  sendEmail?: boolean;
  sendWhatsApp?: boolean;
}

// Get billing, payment records, and receipts for transportation booking
export function useTransportationBookingBilling(bookingId: string | number) {
  return useQuery({
    queryKey: [...transportationBookingKeys.detail(bookingId), 'billing'],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: TransportationBookingBillingData;
      }>(API_ENDPOINTS.TRANSPORTATION_BILLING(bookingId));
      return response.data;
    },
    enabled: !!bookingId,
  });
}

// Record payment for transportation booking
export function usePayTransportationBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: PayTransportationBookingData) => {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: any;
      }>(API_ENDPOINTS.TRANSPORTATION_PAY(data.bookingId), {
        amount: data.amount,
        method: data.method,
        referenceNumber: data.referenceNumber,
        description: data.description,
        autoGenerateReceipt: data.autoGenerateReceipt !== false,
        sendEmail: data.sendEmail,
        sendWhatsApp: data.sendWhatsApp,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: transportationBookingKeys.detail(variables.bookingId) });
      qc.invalidateQueries({ queryKey: [...transportationBookingKeys.detail(variables.bookingId), 'billing'] });
      qc.invalidateQueries({ queryKey: [...transportationBookingKeys.detail(variables.bookingId), 'invoice'] });
      qc.invalidateQueries({ queryKey: transportationBookingKeys.lists() });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
}

// Delete / cancel a transportation payment
export function useDeleteTransportationPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, paymentId }: { bookingId: string | number; paymentId: string | number }) => {
      const response = await apiClient.delete<{
        success: boolean;
        message: string;
      }>(API_ENDPOINTS.TRANSPORTATION_DELETE_PAYMENT(bookingId, paymentId));
      return response;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: transportationBookingKeys.detail(variables.bookingId) });
      qc.invalidateQueries({ queryKey: [...transportationBookingKeys.detail(variables.bookingId), 'billing'] });
      qc.invalidateQueries({ queryKey: [...transportationBookingKeys.detail(variables.bookingId), 'invoice'] });
      qc.invalidateQueries({ queryKey: transportationBookingKeys.lists() });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['receipts'] });
    },
  });
}