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
