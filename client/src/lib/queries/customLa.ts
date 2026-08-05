import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api";

export interface CustomLaRequest {
  id: number;
  number: string;
  clientId: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  travelName?: string;
  status: "pending" | "quoted" | "invoiced" | "cancelled";
  totalAmountSAR: number | string;
  totalPax: number;
  meta: any;
  createdAt: string;
  updatedAt: string;
  linkedBookings?: any[];
  linkedTransport?: any[];
  linkedServiceOrders?: any[];
}

export function useCustomLaRequests() {
  return useQuery({
    queryKey: ["custom-la-requests"],
    queryFn: async () => {
      const response = await apiClient.get<{ data: CustomLaRequest[] }>("/api/custom-la");
      return response.data;
    },
  });
}

export function useCustomLaRequest(id: number) {
  return useQuery({
    queryKey: ["custom-la-request", id],
    queryFn: async () => {
      const response = await apiClient.get<{ data: CustomLaRequest }>(`/api/custom-la/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUpdateCustomLaStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiClient.put<{ data: CustomLaRequest }>(`/api/custom-la/${id}/status`, { status });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["custom-la-requests"] });
      queryClient.invalidateQueries({ queryKey: ["custom-la-request", data.id] });
    },
  });
}

export function useUpdateCustomLaRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CustomLaRequest> }) => {
      const response = await apiClient.put<{ data: CustomLaRequest }>(`/api/custom-la/${id}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["custom-la-requests"] });
      queryClient.invalidateQueries({ queryKey: ["custom-la-request", data.id] });
    },
  });
}


export function useCreateCustomLaRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CustomLaRequest, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'status'>) => {
      const response = await apiClient.post<{ data: CustomLaRequest }>(`/api/custom-la`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-la-requests"] });
    },
  });
}

export const fetchLaBilling = async (id: number) => {
  const res = await apiClient.get(`/api/custom-la-billing/${id}`);
  return res.data;
};

export const generateLaInvoice = async (id: number, data: any) => {
  const res = await apiClient.post(`/api/custom-la-billing/${id}/invoice`, data);
  return res.data;
};

export const recordLaPayment = async (id: number, data: any) => {
  const res = await apiClient.post(`/api/custom-la-billing/${id}/payment`, data);
  return res.data;
};

export const generateLaReceipt = async (id: number, paymentId: number) => {
  const res = await apiClient.post(`/api/custom-la-billing/${id}/receipt/${paymentId}`, {});
  return res.data;
};

// ===== FINANCE TRACKING =====

export interface CustomLaExpense {
  id: number;
  customLaRequestId: number;
  category: string;
  supplierName: string;
  description?: string | null;
  amount: string;
  currency: string;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSummary {
  customLaId: number;
  customLaNumber: string;
  totalAmountSAR: number;
  totalIncome: number;
  totalExpensesPaid: number;
  totalExpensesPending: number;
  totalExpensesAll: number;
  netProfit: number;
  projectedProfit: number;
  profitMarginPercent: string;
  categoryBreakdown: Record<string, {
    total: number;
    paid: number;
    pending: number;
    count: number;
  }>;
}

export function useCustomLaFinanceSummary(laId: number) {
  return useQuery({
    queryKey: ['custom-la-finance-summary', laId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: FinanceSummary }>(`/api/custom-la-finance/${laId}/summary`);
      return response.data;
    },
    enabled: !!laId,
  });
}

export function useCustomLaExpenses(laId: number) {
  return useQuery({
    queryKey: ['custom-la-expenses', laId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: CustomLaExpense[] }>(`/api/custom-la-finance/${laId}/expenses`);
      return response.data;
    },
    enabled: !!laId,
  });
}

export function useCreateCustomLaExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ laId, data }: { laId: number; data: any }) => {
      const response = await apiClient.post(`/api/custom-la-finance/${laId}/expense`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['custom-la-expenses', variables.laId] });
      queryClient.invalidateQueries({ queryKey: ['custom-la-finance-summary', variables.laId] });
    },
  });
}

export function useUpdateCustomLaExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ laId, expenseId, data }: { laId: number; expenseId: number; data: any }) => {
      const response = await apiClient.put(`/api/custom-la-finance/${laId}/expense/${expenseId}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['custom-la-expenses', variables.laId] });
      queryClient.invalidateQueries({ queryKey: ['custom-la-finance-summary', variables.laId] });
    },
  });
}

export function useDeleteCustomLaExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ laId, expenseId }: { laId: number; expenseId: number }) => {
      const response = await apiClient.delete(`/api/custom-la-finance/${laId}/expense/${expenseId}`);
      return response;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['custom-la-expenses', variables.laId] });
      queryClient.invalidateQueries({ queryKey: ['custom-la-finance-summary', variables.laId] });
    },
  });
}
