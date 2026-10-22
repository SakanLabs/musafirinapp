import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

const KEY = 'muthowif-bookings';

export interface MuthowifBooking {
  id: number;
  number: string;
  clientId: number;
  guestName: string;
  dateTime: string;
  events: string[];
  totalPax: number;
  meetingPoint: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  totalAmount: string;
  currency: string;
  assignedMuthowifId: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  paidAmount?: string;
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
}

export interface MuthowifBookingDetail extends MuthowifBooking {
  invoices: any[];
  receipts: any[];
  vouchers: any[];
  assignedMuthowif: { id: number; name: string; phone?: string | null } | null;
}

export const useMuthowifBookings = () => {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      return apiClient.get<MuthowifBooking[]>('/api/muthowif-bookings');
    },
  });
};

export const useMuthowifBooking = (id: number) => {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: async () => {
      return apiClient.get<MuthowifBookingDetail>(`/api/muthowif-bookings/${id}`);
    },
    enabled: !!id,
  });
};

export const useCreateMuthowifBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const data = await apiClient.post('/api/muthowif-bookings', payload);
      return data as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
};

export const useAssignMuthowifBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, muthowifId }: { id: number; muthowifId: number | null }) => {
      const data = await apiClient.put(`/api/muthowif-bookings/${id}/assign`, { muthowifId });
      return data as any;
    },
    onSuccess: (_, variables) => invalidateBooking(queryClient, variables.id),
  });
};

export const useCreateMuthowifInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const data = await apiClient.post(`/api/muthowif-bookings/${id}/invoice`, payload);
      return data as any;
    },
    onSuccess: (_, variables) => invalidateBooking(queryClient, variables.id),
  });
};

export const useCreateMuthowifReceipt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const data = await apiClient.post(`/api/muthowif-bookings/${id}/receipt`, payload);
      return data as any;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [KEY, variables.id] });
    },
  });
};

export const useCreateMuthowifVoucher = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const data = await apiClient.post(`/api/muthowif-bookings/${id}/voucher`);
      return data as any;
    },
    onSuccess: (_, variables) => invalidateBooking(queryClient, variables),
  });
};

export type MuthowifBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type MuthowifPaymentMethod = 'bank_transfer' | 'deposit' | 'cash';

export interface MuthowifPaymentItem {
  id: number;
  invoiceId: number;
  amount: string;
  currency: string;
  method: string;
  referenceNumber: string | null;
  paidAt: string;
  termin: number | null;
  terminLabel: string | null;
  receiptNumber: string | null;
  isFromMergedInvoice: boolean;
  meta: any;
}

export interface MuthowifBillingData {
  client: { id: number; name: string; email: string; phone?: string; depositBalance?: string } | null;
  invoice: {
    id: number;
    number: string;
    amount: string;
    paidAmount: string;
    currency: string;
    status: string;
    issueDate: string;
    dueDate: string;
    pdfUrl: string | null;
  } | null;
  payments: MuthowifPaymentItem[];
  receipts: { id: number; number: string; paidAmount: string; meta: any }[];
  summary: {
    totalAmount: number;
    paidAmount: number;
    remainingBalance: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid';
    currency: string;
    clientDepositBalance: number;
  };
}

export interface PayMuthowifBookingData {
  id: number;
  amount: number;
  method: MuthowifPaymentMethod;
  referenceNumber?: string;
  description?: string;
  autoGenerateReceipt?: boolean;
  sendEmail?: boolean;
  sendWhatsApp?: boolean;
}

/** Refreshes everything that shows a muthowif booking's status or payment. */
const invalidateBooking = (queryClient: ReturnType<typeof useQueryClient>, id: number) => {
  queryClient.invalidateQueries({ queryKey: [KEY] });
  queryClient.invalidateQueries({ queryKey: [KEY, id] });
  queryClient.invalidateQueries({ queryKey: ['arrivals'] });
  queryClient.invalidateQueries({ queryKey: ['invoices'] });
};

export const useMuthowifBilling = (id: number) => {
  return useQuery({
    queryKey: [KEY, id, 'billing'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: MuthowifBillingData }>(
        `/api/muthowif-bookings/${id}/billing`
      );
      return response.data;
    },
    enabled: !!id,
  });
};

export const usePayMuthowifBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: PayMuthowifBookingData) => {
      const response = await apiClient.post<{ success: boolean; message: string; data: any }>(
        `/api/muthowif-bookings/${id}/pay`,
        { ...payload, autoGenerateReceipt: payload.autoGenerateReceipt !== false }
      );
      return response.data;
    },
    onSuccess: (_, variables) => invalidateBooking(queryClient, variables.id),
  });
};

export const useDeleteMuthowifPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentId }: { id: number; paymentId: number }) => {
      return apiClient.delete(`/api/muthowif-bookings/${id}/payments/${paymentId}`);
    },
    onSuccess: (_, variables) => invalidateBooking(queryClient, variables.id),
  });
};

export const useUpdateMuthowifStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: MuthowifBookingStatus }) => {
      return apiClient.patch(`/api/muthowif-bookings/${id}/status`, { status });
    },
    onSuccess: (_, variables) => invalidateBooking(queryClient, variables.id),
  });
};

export const useDeleteMuthowifBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/api/muthowif-bookings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: ['arrivals'] });
    },
  });
};

export interface MuthowifAssignmentOption {
  id: number;
  name: string;
  phone: string;
  status: 'idle' | 'assigned' | 'unavailable';
  residentType: string;
  residenceLocation: string | null;
  visaStatus: string;
  upcomingCount: number;
  conflicts: { id: number; number: string; dateTime: string; guestName: string }[];
}

export const useMuthowifAssignmentOptions = (id: number, enabled: boolean) => {
  return useQuery({
    queryKey: [KEY, id, 'assignment-options'],
    queryFn: async () =>
      apiClient.get<{ assignedMuthowifId: number | null; options: MuthowifAssignmentOption[] }>(
        `/api/muthowif-bookings/${id}/assignment-options`
      ),
    enabled: !!id && enabled,
  });
};
