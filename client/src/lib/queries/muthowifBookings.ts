import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

const KEY = 'muthowif-bookings';

export const useMuthowifBookings = () => {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/muthowif-bookings');
      return data;
    },
  });
};

export const useMuthowifBooking = (id: number) => {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/muthowif-bookings/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateMuthowifBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/api/muthowif-bookings', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
};

export const useAssignMuthowifBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, muthowifId }: { id: number; muthowifId: number }) => {
      const { data } = await apiClient.put(`/api/muthowif-bookings/${id}/assign`, { muthowifId });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: [KEY, variables.id] });
    },
  });
};

export const useCreateMuthowifInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const { data } = await apiClient.post(`/api/muthowif-bookings/${id}/invoice`, payload);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [KEY, variables.id] });
    },
  });
};

export const useCreateMuthowifReceipt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const { data } = await apiClient.post(`/api/muthowif-bookings/${id}/receipt`, payload);
      return data;
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
      const { data } = await apiClient.post(`/api/muthowif-bookings/${id}/voucher`);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [KEY, variables] });
    },
  });
};
