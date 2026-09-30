import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  // Extended fields for Invoice Detail
  bookingPaymentStatus?: 'unpaid' | 'partial' | 'paid' | 'overdue';
  bookingMeta?: Record<string, unknown>;
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
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: Invoice}>(API_ENDPOINTS.INVOICE_BY_ID(id));
      return response.data;
    },
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

// Record payment for an invoice
export interface PayInvoiceData {
  id: string;
  method: 'bank_transfer' | 'deposit' | 'cash';
  amount: number;
  referenceNumber?: string;
  description?: string;
}

export function usePayInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PayInvoiceData) => {
      const payload: { method: PayInvoiceData['method']; amount: number; referenceNumber?: string; description?: string } = {
        method: data.method,
        amount: data.amount,
      };
      if (data.referenceNumber) payload.referenceNumber = data.referenceNumber;
      if (data.description) payload.description = data.description;

      const response = await apiClient.post<{ success: boolean; data: Invoice }>(
        API_ENDPOINTS.INVOICE_PAY(data.id),
        payload
      );
      return response.data;
    },
    onSuccess: (invoice) => {
      // Update the specific invoice in cache
      queryClient.setQueryData(invoiceKeys.detail(invoice.id.toString()), invoice);
      // Invalidate invoices list to refresh
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

// Tambahkan tipe respons untuk backfill status
export interface BackfillStatusResponse {
  success: boolean;
  data: {
    totalProcessed: number;
    updatedCount: number;
    changes: Array<{ id: number; from: string; to: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' }>; 
  };
  message?: string;
}

// Tambahkan mutation untuk memanggil POST /api/invoices/backfill-status
export function useBackfillInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ success: boolean; data: BackfillStatusResponse['data']; message?: string }>(
        API_ENDPOINTS.BACKFILL_INVOICE_STATUS
      );
      return response.data;
    },
    onSuccess: () => {
      // Refresh daftar invoices agar status terbaru muncul
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

// Hapus invoice
export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ success: boolean; message?: string }>(API_ENDPOINTS.INVOICE_BY_ID(id));
      return response;
    },
    onSuccess: (_res, id) => {
      // Invalidasi daftar dan detail invoice
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

// Manual invoice types
export interface CreateManualInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  notes?: string;
}

export interface ManualInvoicePaymentTerm {
  termNumber: number;
  label: string;
  percentage: number;
  amount: number;
  dueDate: string;
  notes?: string;
  idrAmount?: number;
  exchangeRate?: number;
}

export interface CreateManualInvoiceData {
  clientId?: number | null;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  title?: string;
  currency: string;
  issueDate?: string;
  dueDate: string;
  notes?: string;
  items: CreateManualInvoiceItem[];
  paymentTerms?: ManualInvoicePaymentTerm[];
}

export interface CreateManualInvoiceResponse {
  success: boolean;
  data: {
    id: number;
    number: string;
    amount: string;
    currency: string;
    pdfUrl: string;
    downloadUrl: string;
  };
  message?: string;
}

// Buat manual invoice
export function useCreateManualInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateManualInvoiceData) => {
      const response = await apiClient.post<CreateManualInvoiceResponse>(
        API_ENDPOINTS.INVOICE_MANUAL,
        data
      );
      return response;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      if (res?.data?.downloadUrl) {
        try {
          apiClient.downloadFile(res.data.downloadUrl, `${res.data.number}.pdf`).catch(err => {
            console.warn('Auto download failed:', err);
          });
        } catch (e) {
          console.warn('Auto download trigger error:', e);
        }
      }
    },
  });
}

// Manual invoice types
export interface ManualInvoicePaymentRecord {
  id: number;
  manualInvoiceId: number;
  amount: string;
  currency: string;
  method?: string;
  referenceNumber?: string;
  paidAt: string;
  status: string;
  meta?: {
    termin?: number;
    terminLabel?: string;
    description?: string;
    receiptNumber?: string;
  };
}

export interface ManualInvoiceReceiptRecord {
  id: number;
  manualInvoiceId: number;
  paymentId?: number;
  number: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  currency: string;
  issueDate: string;
  payerName: string;
  payerEmail?: string;
  payerPhone?: string;
  payerAddress?: string;
  pdfUrl?: string;
  meta?: Record<string, any>;
}

export interface ManualInvoiceDetail {
  id: number;
  number: string;
  clientId?: number | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  title?: string | null;
  amount: string;
  paidAmount: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'pending' | 'overdue' | 'cancelled';
  items: CreateManualInvoiceItem[];
  paymentTerms?: ManualInvoicePaymentTerm[];
  notes?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  summary: {
    totalAmount: number;
    paidAmount: number;
    remainingBalance: number;
    currency: string;
    clientDepositBalance: number;
  };
  payments: ManualInvoicePaymentRecord[];
  receipts: ManualInvoiceReceiptRecord[];
}

// Get manual invoice by ID
export function useManualInvoice(id?: string | number) {
  return useQuery({
    queryKey: ['manual-invoices', 'detail', id],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: ManualInvoiceDetail }>(
        API_ENDPOINTS.INVOICE_MANUAL_DETAIL(id!)
      );
      return response.data;
    },
    enabled: !!id,
  });
}

// Update manual invoice
export function useUpdateManualInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: CreateManualInvoiceData }) => {
      const response = await apiClient.put<{ success: boolean; message: string; data: any; downloadUrl?: string }>(
        API_ENDPOINTS.INVOICE_MANUAL_UPDATE(id),
        data
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manual-invoices', 'detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

// Record payment for manual invoice
export interface PayManualInvoiceData {
  manualInvoiceId: string | number;
  method: 'bank_transfer' | 'deposit' | 'cash';
  amount: number;
  referenceNumber?: string;
  description?: string;
  autoGenerateReceipt?: boolean;
  idrAmount?: number;
  exchangeRate?: number;
}

export function usePayManualInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PayManualInvoiceData) => {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: {
          payment: ManualInvoicePaymentRecord;
          receipt?: ManualInvoiceReceiptRecord;
          summary: any;
        };
      }>(API_ENDPOINTS.INVOICE_MANUAL_PAY(data.manualInvoiceId), {
        method: data.method,
        amount: data.amount,
        referenceNumber: data.referenceNumber,
        description: data.description,
        autoGenerateReceipt: data.autoGenerateReceipt !== false,
        idrAmount: data.idrAmount,
        exchangeRate: data.exchangeRate,
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manual-invoices', 'detail', variables.manualInvoiceId] });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// Update / edit manual invoice payment
export interface UpdateManualInvoicePaymentData {
  manualInvoiceId: string | number;
  paymentId: string | number;
  data: {
    amount?: number;
    idrAmount?: number;
    exchangeRate?: number;
    method?: string;
    referenceNumber?: string;
    description?: string;
    paidAt?: string;
  };
}

export function useUpdateManualInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ manualInvoiceId, paymentId, data }: UpdateManualInvoicePaymentData) => {
      const response = await apiClient.put<{ success: boolean; message: string; paymentId: number }>(
        API_ENDPOINTS.INVOICE_MANUAL_UPDATE_PAYMENT(manualInvoiceId, paymentId),
        data
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manual-invoices', 'detail', variables.manualInvoiceId] });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// Delete / cancel manual invoice payment
export function useDeleteManualInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ manualInvoiceId, paymentId }: { manualInvoiceId: string | number; paymentId: string | number }) => {
      const response = await apiClient.delete<{ success: boolean; message: string }>(
        API_ENDPOINTS.INVOICE_MANUAL_DELETE_PAYMENT(manualInvoiceId, paymentId)
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['manual-invoices', 'detail', variables.manualInvoiceId] });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// ==========================================
// Invoice Terms & Conditions Settings Hooks
// ==========================================

export interface InvoiceTermsSetting {
  id: number;
  type: string;
  name: string;
  title: string;
  checkInTime: string;
  checkOutTime: string;
  terms: string[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateInvoiceTermsSettingPayload {
  name?: string;
  title?: string;
  checkInTime?: string;
  checkOutTime?: string;
  terms?: string[];
  notes?: string;
}

export const invoiceTermsKeys = {
  all: ['invoice-terms-settings'] as const,
  lists: () => [...invoiceTermsKeys.all, 'list'] as const,
  detail: (type: string) => [...invoiceTermsKeys.all, 'detail', type] as const,
};

// Hook to get all terms settings
export function useInvoiceTermsSettings() {
  return useQuery({
    queryKey: invoiceTermsKeys.lists(),
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: InvoiceTermsSetting[] }>(
        API_ENDPOINTS.INVOICE_TERMS_SETTINGS
      );
      return response.data;
    },
  });
}

// Hook to get terms setting by type
export function useInvoiceTermsSetting(type: string) {
  return useQuery({
    queryKey: invoiceTermsKeys.detail(type),
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: {
          title: string;
          checkInTime: string;
          checkOutTime: string;
          terms: string[];
          termsHtml: string;
          setting?: InvoiceTermsSetting;
        };
      }>(API_ENDPOINTS.INVOICE_TERMS_SETTING_BY_TYPE(type));
      return response.data;
    },
    enabled: !!type,
  });
}

// Hook to update terms setting by type
export function useUpdateInvoiceTermsSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ type, data }: { type: string; data: UpdateInvoiceTermsSettingPayload }) => {
      const response = await apiClient.put<{ success: boolean; message: string; data: InvoiceTermsSetting }>(
        API_ENDPOINTS.INVOICE_TERMS_SETTING_BY_TYPE(type),
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceTermsKeys.all });
    },
  });
}

// Hook to reset terms setting by type to defaults
export function useResetInvoiceTermsSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (type: string) => {
      const response = await apiClient.post<{ success: boolean; message: string; data: InvoiceTermsSetting }>(
        API_ENDPOINTS.INVOICE_TERMS_SETTING_RESET(type)
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceTermsKeys.all });
    },
  });
}