import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api';

export interface Hotel {
  id: number;
  name: string;
  city: 'Makkah' | 'Madinah';
  address: string | null;
  starRating: number | null;
  contactPerson: string | null;
  contactPhone: string | null;
  supplierName: string | null;
  picName: string | null;
  picContact: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HotelPricingPeriod {
  id: number;
  hotelId: number;
  roomType: string;
  mealPlan: string;
  startDate: string;
  endDate: string;
  costPrice: string;
  sellingPrice: string;
  currency: string;
  isActive: boolean;
}

export interface TransportationRouteMaster {
  id: number;
  originLocation: string;
  destinationLocation: string;
  supplierName: string | null;
  picName: string | null;
  picContact: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransportationRoutePricingPeriod {
  id: number;
  transportationRouteMasterId: number;
  vehicleType: string;
  startDate: string;
  endDate: string;
  costPrice: string;
  sellingPrice: string;
  currency: string;
  isActive: boolean;
}

// hotels
export const useHotels = () => {
  return useQuery({
    queryKey: ['hotels'],
    queryFn: async () => {
      const response = await apiClient.get<Hotel[]>('/api/master/hotels');
      return response;
    },
  });
};

export const useCreateHotel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Hotel>) => {
      const response = await apiClient.post<Hotel>('/api/master/hotels', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
    },
  });
};

export const useUpdateHotel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Hotel> & { id: number }) => {
      const response = await apiClient.put<Hotel>(`/api/master/hotels/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
    },
  });
};

export const useDeleteHotel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete<{message: string}>(`/api/master/hotels/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
    },
  });
};

// hotel pricing
export const useHotelPricing = (hotelId: number) => {
  return useQuery({
    queryKey: ['hotels', hotelId, 'pricing'],
    queryFn: async () => {
      const response = await apiClient.get<HotelPricingPeriod[]>(`/api/master/hotels/${hotelId}/pricing`);
      return response;
    },
    enabled: !!hotelId,
  });
};

export const useCreateHotelPricing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hotelId, data }: { hotelId: number, data: Partial<HotelPricingPeriod> }) => {
      const response = await apiClient.post<HotelPricingPeriod>(`/api/master/hotels/${hotelId}/pricing`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotels', variables.hotelId, 'pricing'] });
    },
  });
};

export const useUpdateHotelPricing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hotelId, id, data }: { hotelId: number, id: number, data: Partial<HotelPricingPeriod> }) => {
      const response = await apiClient.put<HotelPricingPeriod>(`/api/master/hotels/${hotelId}/pricing/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotels', variables.hotelId, 'pricing'] });
    },
  });
};

export const useDeleteHotelPricing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hotelId, id }: { hotelId: number, id: number }) => {
      const response = await apiClient.delete<{message: string}>(`/api/master/hotels/${hotelId}/pricing/${id}`);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hotels', variables.hotelId, 'pricing'] });
    },
  });
};

// transport routes
export const useTransportRoutes = () => {
  return useQuery({
    queryKey: ['transport-routes'],
    queryFn: async () => {
      const response = await apiClient.get<TransportationRouteMaster[]>('/api/master/transport-routes');
      return response;
    },
  });
};

export const useCreateTransportRoute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<TransportationRouteMaster>) => {
      const response = await apiClient.post<TransportationRouteMaster>('/api/master/transport-routes', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-routes'] });
    },
  });
};

export const useUpdateTransportRoute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<TransportationRouteMaster> & { id: number }) => {
      const response = await apiClient.put<TransportationRouteMaster>(`/api/master/transport-routes/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-routes'] });
    },
  });
};

export const useDeleteTransportRoute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete<{message: string}>(`/api/master/transport-routes/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-routes'] });
    },
  });
};

// transport route pricing
export const useTransportPricing = (routeId: number) => {
  return useQuery({
    queryKey: ['transport-routes', routeId, 'pricing'],
    queryFn: async () => {
      const response = await apiClient.get<TransportationRoutePricingPeriod[]>(`/api/master/transport-routes/${routeId}/pricing`);
      return response;
    },
    enabled: !!routeId,
  });
};

export const useCreateTransportPricing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ routeId, data }: { routeId: number, data: Partial<TransportationRoutePricingPeriod> }) => {
      const response = await apiClient.post<TransportationRoutePricingPeriod>(`/api/master/transport-routes/${routeId}/pricing`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transport-routes', variables.routeId, 'pricing'] });
    },
  });
};

export const useUpdateTransportPricing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ routeId, id, data }: { routeId: number, id: number, data: Partial<TransportationRoutePricingPeriod> }) => {
      const response = await apiClient.put<TransportationRoutePricingPeriod>(`/api/master/transport-routes/${routeId}/pricing/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transport-routes', variables.routeId, 'pricing'] });
    },
  });
};

export const useDeleteTransportPricing = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ routeId, id }: { routeId: number, id: number }) => {
      const response = await apiClient.delete<{message: string}>(`/api/master/transport-routes/${routeId}/pricing/${id}`);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transport-routes', variables.routeId, 'pricing'] });
    },
  });
};
