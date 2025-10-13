import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';

// Types for deposits (based on the schema)
export interface ClientDeposit {
  id: number;
  clientId: number;
  currentBalance: string;
  totalDeposited: string;
  totalUsed: string;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
}

export interface DepositTransaction {
  id: number;
  clientId: number;
  type: 'deposit' | 'usage' | 'refund' | 'adjustment';
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  status: 'pending' | 'completed' | 'failed';
  description?: string;
  bookingId?: number;
  referenceNumber?: string;
  processedAt?: string;
  createdAt: string;
  clientName?: string;
  bookingCode?: string;
}

export interface AddDepositData {
  clientId: number;
  amount: number;
  description?: string;
  referenceNumber?: string;
}

export interface RefundDepositData {
  clientId: number;
  amount: number;
  description?: string;
  referenceNumber?: string;
}

export interface AdjustDepositData {
  clientId: number;
  amount: number;
  type: 'increase' | 'decrease';
  description?: string;
  referenceNumber?: string;
}

export interface DepositSummary {
  totalClients: number;
  totalBalance: string;
  totalDeposited: string;
  totalUsed: string;
  recentTransactions: DepositTransaction[];
}

// Query keys
export const depositKeys = {
  all: ['deposits'] as const,
  balances: () => [...depositKeys.all, 'balance'] as const,
  balance: (clientId: string | number) => [...depositKeys.balances(), clientId.toString()] as const,
  transactions: () => [...depositKeys.all, 'transactions'] as const,
  clientTransactions: (clientId: string | number) => [...depositKeys.transactions(), clientId.toString()] as const,
  summary: () => [...depositKeys.all, 'summary'] as const,
};

// Get client deposit balance
export function useClientDepositBalance(clientId: string) {
  return useQuery({
    queryKey: depositKeys.balance(clientId),
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: ClientDeposit}>(
        API_ENDPOINTS.DEPOSIT_BALANCE(clientId)
      );
      return response.data;
    },
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get client deposit transactions
export function useClientDepositTransactions(clientId: string) {
  return useQuery({
    queryKey: depositKeys.clientTransactions(clientId),
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: DepositTransaction[]}>(
        API_ENDPOINTS.DEPOSIT_TRANSACTIONS(clientId)
      );
      return response.data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get deposit summary
export function useDepositSummary() {
  return useQuery({
    queryKey: depositKeys.summary(),
    queryFn: async () => {
      const response = await apiClient.get<{success: boolean, data: DepositSummary}>(
        API_ENDPOINTS.DEPOSIT_SUMMARY
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Add deposit
export function useAddDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddDepositData) => {
      const response = await apiClient.post<{success: boolean, data: DepositTransaction}>(
        API_ENDPOINTS.DEPOSIT_ADD(data.clientId.toString()), 
        data
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: depositKeys.balance(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.clientTransactions(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.summary() });
    },
  });
}

// Refund deposit
export function useRefundDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RefundDepositData) => {
      const response = await apiClient.post<{success: boolean, data: DepositTransaction}>(
        API_ENDPOINTS.DEPOSIT_REFUND(data.clientId.toString()), 
        data
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: depositKeys.balance(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.clientTransactions(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.summary() });
    },
  });
}

// Adjust deposit
export function useAdjustDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AdjustDepositData) => {
      const response = await apiClient.post<{success: boolean, data: DepositTransaction}>(
        API_ENDPOINTS.DEPOSIT_ADJUST(data.clientId.toString()), 
        data
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: depositKeys.balance(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.clientTransactions(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.summary() });
    },
  });
}
export interface UpdateDepositTransactionData {
  clientId: number;
  transactionId: number;
  amount?: number;
  description?: string;
  referenceNumber?: string;
  processedBy?: string;
}

export interface DeleteDepositTransactionData {
  clientId: number;
  transactionId: number;
}

export function useUpdateDepositTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateDepositTransactionData) => {
      const response = await apiClient.patch<{success: boolean, data: DepositTransaction}>(
        API_ENDPOINTS.DEPOSIT_UPDATE_TRANSACTION(data.clientId.toString(), data.transactionId),
        data
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: depositKeys.balance(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.clientTransactions(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.summary() });
    },
  });
}

export function useDeleteDepositTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DeleteDepositTransactionData) => {
      const response = await apiClient.delete<{success: boolean, data: {deletedId: number}}>(
        API_ENDPOINTS.DEPOSIT_DELETE_TRANSACTION(data.clientId.toString(), data.transactionId)
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: depositKeys.balance(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.clientTransactions(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: depositKeys.summary() });
    },
  });
}