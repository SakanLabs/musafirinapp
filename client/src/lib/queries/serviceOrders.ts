import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

export type ProductType = 'visa_umrah' | 'siskopatuh';
export type ServiceOrderStatus = 'draft' | 'submitted' | 'paid' | 'cancelled';

export interface ServiceOrderListItem {
  id: number;
  number: string;
  productType: ProductType;
  status: ServiceOrderStatus;
  clientId: number;
  clientName: string;
  groupLeaderName: string;
  groupLeaderPhone: string;
  totalPeople: number;
  unitPriceUSD: string;
  totalPriceUSD: string;
  totalPriceSAR: string;
  departureDate: string;
  returnDate: string;
  createdAt: string;
}

export interface CreateServiceOrderData {
  clientId: number;
  productType: ProductType;
  groupLeaderName: string;
  groupLeaderPhone?: string;
  totalPeople: number;
  unitPriceUSD: number;
  departureDate: string; // ISO date
  returnDate: string; // ISO date
  notes?: string;
}

export interface ServiceOrderChecklist {
  id?: number;
  serviceOrderId: number;
  items: Record<string, boolean & { note?: string }> | any; // flexible
  remarks?: string | null;
}

export const serviceOrderKeys = {
  all: ['service-orders'] as const,
  lists: () => [...serviceOrderKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...serviceOrderKeys.lists(), { filters }] as const,
  details: () => [...serviceOrderKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...serviceOrderKeys.details(), id.toString()] as const,
  checklist: (id: string | number) => [...serviceOrderKeys.detail(id), 'checklist'] as const,
};

export function useServiceOrders() {
  return useQuery({
    queryKey: serviceOrderKeys.lists(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ServiceOrderListItem[] }>(API_ENDPOINTS.SERVICE_ORDERS);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useServiceOrder(id: string | number) {
  return useQuery({
    queryKey: serviceOrderKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { order: any; client: any } }>(API_ENDPOINTS.SERVICE_ORDER_BY_ID(id));
      
      // Combine order and client data into a single object
      const { order, client } = res.data;
      return {
        ...order,
        clientName: client?.name || null,
        clientEmail: client?.email || null,
        clientPhone: client?.phone || null,
        clientAddress: client?.address || null,
      };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateServiceOrderData) => {
      const payload = {
        clientId: data.clientId,
        productType: data.productType,
        groupLeaderName: data.groupLeaderName,
        groupLeaderPhone: data.groupLeaderPhone || null,
        totalPeople: data.totalPeople,
        unitPriceUSD: data.unitPriceUSD,
        departureDate: data.departureDate,
        returnDate: data.returnDate,
        notes: data.notes || null,
      };
      const res = await apiClient.post<{ success: boolean; data: any }>(API_ENDPOINTS.SERVICE_ORDERS, payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.lists() });
    },
  });
}

export function useUpdateServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: Partial<CreateServiceOrderData> }) => {
      const payload = {
        ...data,
        departureDate: data.departureDate,
        returnDate: data.returnDate,
      };
      const res = await apiClient.patch<{ success: boolean; data: any }>(API_ENDPOINTS.SERVICE_ORDER_BY_ID(id), payload);
      return res.data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.lists() });
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(variables.id) });
    },
  });
}

export function useDeleteServiceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | number) => {
      const res = await apiClient.delete<{ success: boolean; message: string }>(API_ENDPOINTS.SERVICE_ORDER_BY_ID(id));
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.lists() });
    },
  });
}

export function useChecklist(id: string | number) {
  return useQuery({
    queryKey: serviceOrderKeys.checklist(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: ServiceOrderChecklist | null }>(API_ENDPOINTS.SERVICE_ORDER_CHECKLIST(id));
      return res.data || null;
    },
    enabled: !!id,
  });
}

export function useUpsertChecklist(id: string | number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checklist: ServiceOrderChecklist) => {
      const res = await apiClient.post<{ success: boolean; data: ServiceOrderChecklist }>(API_ENDPOINTS.SERVICE_ORDER_CHECKLIST(id), checklist);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.checklist(id) });
    },
  });
}

// Generate invoice for service order
export function useGenerateServiceOrderInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceOrderId, customDueDate, customInvoiceDate }: { 
      serviceOrderId: string | number; 
      customDueDate: string; 
      customInvoiceDate?: string; 
    }) => {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: { number?: string; id: string };
        downloadUrl: string;
      }>(API_ENDPOINTS.SERVICE_ORDER_GENERATE_INVOICE(serviceOrderId), {
        customDueDate,
        customInvoiceDate
      });
      
      // Auto-download the PDF if downloadUrl is provided
      if (response.downloadUrl) {
        const filename = `service-order-invoice-${response.data.number || serviceOrderId}.pdf`;
        await apiClient.downloadFile(response.downloadUrl, filename);
      }
      
      return response;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(variables.serviceOrderId) });
      qc.invalidateQueries({ queryKey: serviceOrderKeys.lists() });
    },
  });
}

// Get existing invoice for service order
export function useServiceOrderInvoice(serviceOrderId: string | number) {
  return useQuery({
    queryKey: [...serviceOrderKeys.detail(serviceOrderId), 'invoice'],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: {
          id: number;
          number: string;
          serviceOrderId: number;
          amount: string;
          currency: string;
          issueDate: string;
          dueDate: string;
          status: string;
          pdfUrl: string;
        };
      }>(API_ENDPOINTS.SERVICE_ORDER_GET_INVOICE(serviceOrderId));
      return response.data;
    },
    enabled: !!serviceOrderId,
    retry: false, // Don't retry if invoice doesn't exist
  });
}

// Regenerate invoice for service order
export function useRegenerateServiceOrderInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceOrderId, customDueDate, customInvoiceDate }: { 
      serviceOrderId: string | number; 
      customDueDate: string; 
      customInvoiceDate?: string; 
    }) => {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data: { number?: string; id: string };
        downloadUrl: string;
      }>(API_ENDPOINTS.SERVICE_ORDER_REGENERATE_INVOICE(serviceOrderId), {
        customDueDate,
        customInvoiceDate
      });
      
      // Auto-download the PDF if downloadUrl is provided
      if (response.downloadUrl) {
        const filename = `service-order-invoice-${response.data.number || serviceOrderId}.pdf`;
        await apiClient.downloadFile(response.downloadUrl, filename);
      }
      
      return response;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(variables.serviceOrderId) });
      qc.invalidateQueries({ queryKey: [...serviceOrderKeys.detail(variables.serviceOrderId), 'invoice'] });
      qc.invalidateQueries({ queryKey: serviceOrderKeys.lists() });
    },
  });
}

// Update service order status
export function useUpdateServiceOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceOrderId, status }: { 
      serviceOrderId: string | number; 
      status: ServiceOrderStatus; 
    }) => {
      const response = await apiClient.patch<{
        success: boolean;
        message: string;
        data: ServiceOrderListItem;
      }>(API_ENDPOINTS.SERVICE_ORDER_UPDATE_STATUS(serviceOrderId), {
        status
      });
      
      return response;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(variables.serviceOrderId) });
      qc.invalidateQueries({ queryKey: serviceOrderKeys.lists() });
    },
  });
}