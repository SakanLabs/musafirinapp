import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

export interface NotificationLog {
  id: number;
  bookingId: number;
  clientId: number | null;
  type: 'payment_confirmation' | 'voucher';
  channel: 'email' | 'whatsapp';
  recipient: string;
  status: 'pending' | 'sent' | 'failed';
  referenceId: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  retryCount: number;
  sentAt: string | null;
  failedAt: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendNotificationPayload {
  bookingId: number;
  type: 'payment_confirmation' | 'voucher';
  channels?: ('email' | 'whatsapp')[];
  forceResend?: boolean;
}

export function useBookingNotifications(bookingId: number | string) {
  return useQuery({
    queryKey: ['notifications', 'booking', String(bookingId)],
    queryFn: async () => {
      if (!bookingId) return [];
      const response = await apiClient.get<{ success: boolean; data: NotificationLog[] }>(
        `/api/bookings/${bookingId}/notifications`
      );
      return response.data || [];
    },
    enabled: Boolean(bookingId),
    staleTime: 30 * 1000,
  });
}

export function useSendBookingNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendNotificationPayload) => {
      const response = await apiClient.post<{
        success: boolean;
        data: any;
        message: string;
      }>(`/api/bookings/${payload.bookingId}/notifications/send`, {
        type: payload.type,
        channels: payload.channels,
        forceResend: payload.forceResend,
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'booking', String(variables.bookingId)] });
      queryClient.invalidateQueries({ queryKey: ['arrivals'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useRetryNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, bookingId }: { logId: number; bookingId?: number }) => {
      const response = await apiClient.post<{
        success: boolean;
        data: any;
        message: string;
      }>(`/api/notifications/${logId}/retry`);
      return response;
    },
    onSuccess: (_, variables) => {
      if (variables.bookingId) {
        queryClient.invalidateQueries({ queryKey: ['notifications', 'booking', String(variables.bookingId)] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
      queryClient.invalidateQueries({ queryKey: ['arrivals'] });
    },
  });
}
