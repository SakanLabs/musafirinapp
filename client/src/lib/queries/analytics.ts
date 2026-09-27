import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_ENDPOINTS } from '../api';
import type {
  AnalyticsFilters,
  RevenueData,
  ProfitData,
  AnalyticsData,
  AnalyticsSummary,
  HotelCostTemplate,
  NewHotelCostTemplate,
  OperationalCost,
  NewOperationalCost,
  AnalyticsApiResponse,
  CostApiResponse,
} from 'shared/src/types';

// ===== ANALYTICS QUERY KEYS =====
export const analyticsKeys = {
  all: ['analytics'] as const,
  revenue: (filters?: AnalyticsFilters) => ['analytics', 'revenue', filters] as const,
  profit: (filters?: AnalyticsFilters) => ['analytics', 'profit', filters] as const,
  dashboard: (filters?: AnalyticsFilters) => ['analytics', 'dashboard', filters] as const,
  summary: (filters?: AnalyticsFilters) => ['analytics', 'summary', filters] as const,
} as const;

export const costsKeys = {
  all: ['costs'] as const,
  hotelTemplates: () => ['costs', 'hotel-templates'] as const,
  hotelTemplate: (id: string) => ['costs', 'hotel-template', id] as const,
  operational: (filters?: { bookingId?: string }) => ['costs', 'operational', filters] as const,
  operationalByBooking: (bookingId: string) => ['costs', 'operational', 'booking', bookingId] as const,
} as const;

// ===== HELPER FUNCTIONS =====
function buildQueryString(filters?: AnalyticsFilters): string {
  if (!filters) return '';
  
  const params = new URLSearchParams();
  
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  if (filters.city) {
    params.append('city', filters.city);
  }
  if (filters.status) {
    params.append('status', filters.status);
  }
  
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

// ===== ANALYTICS QUERIES =====
export function useRevenueAnalytics(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: analyticsKeys.revenue(filters),
    queryFn: async (): Promise<RevenueData> => {
      const queryString = buildQueryString(filters);
      const response = await apiClient.get<AnalyticsApiResponse<RevenueData>>(
        `${API_ENDPOINTS.ANALYTICS_REVENUE}${queryString}`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProfitAnalytics(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: analyticsKeys.profit(filters),
    queryFn: async (): Promise<ProfitData> => {
      const queryString = buildQueryString(filters);
      const response = await apiClient.get<AnalyticsApiResponse<ProfitData>>(
        `${API_ENDPOINTS.ANALYTICS_PROFIT}${queryString}`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDashboardAnalytics(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: analyticsKeys.dashboard(filters),
    queryFn: async (): Promise<AnalyticsData> => {
      const queryString = buildQueryString(filters);
      const response = await apiClient.get<AnalyticsApiResponse<AnalyticsData>>(
        `${API_ENDPOINTS.ANALYTICS_DASHBOARD}${queryString}`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAnalyticsSummary(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: analyticsKeys.summary(filters),
    queryFn: async (): Promise<AnalyticsSummary> => {
      const queryString = buildQueryString(filters);
      const response = await apiClient.get<AnalyticsApiResponse<AnalyticsSummary>>(
        `${API_ENDPOINTS.ANALYTICS_SUMMARY}${queryString}`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ===== HOTEL COST TEMPLATE QUERIES =====
export function useHotelCostTemplates() {
  return useQuery({
    queryKey: costsKeys.hotelTemplates(),
    queryFn: async (): Promise<HotelCostTemplate[]> => {
      const response = await apiClient.get<CostApiResponse<HotelCostTemplate[]>>(
        API_ENDPOINTS.COSTS_HOTEL_TEMPLATES
      );
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useHotelCostTemplate(id: string) {
  return useQuery({
    queryKey: costsKeys.hotelTemplate(id),
    queryFn: async (): Promise<HotelCostTemplate> => {
      const response = await apiClient.get<CostApiResponse<HotelCostTemplate>>(
        API_ENDPOINTS.COSTS_HOTEL_TEMPLATE_BY_ID(id)
      );
      return response.data;
    },
    enabled: !!id,
  });
}

// ===== OPERATIONAL COST QUERIES =====
export function useOperationalCosts(filters?: { bookingId?: string }) {
  return useQuery({
    queryKey: costsKeys.operational(filters),
    queryFn: async (): Promise<OperationalCost[]> => {
      const endpoint = filters?.bookingId 
        ? API_ENDPOINTS.COSTS_OPERATIONAL_BY_BOOKING(filters.bookingId)
        : API_ENDPOINTS.COSTS_OPERATIONAL;
      const response = await apiClient.get<CostApiResponse<OperationalCost[]>>(endpoint);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useOperationalCostsByBooking(bookingId: string) {
  return useQuery({
    queryKey: costsKeys.operationalByBooking(bookingId),
    queryFn: async (): Promise<OperationalCost[]> => {
      const response = await apiClient.get<CostApiResponse<OperationalCost[]>>(
        API_ENDPOINTS.COSTS_OPERATIONAL_BY_BOOKING(bookingId)
      );
      return response.data;
    },
    enabled: !!bookingId,
  });
}

// ===== HOTEL COST TEMPLATE MUTATIONS =====
export function useCreateHotelCostTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: NewHotelCostTemplate): Promise<HotelCostTemplate> => {
      const response = await apiClient.post<CostApiResponse<HotelCostTemplate>>(
        API_ENDPOINTS.COSTS_HOTEL_TEMPLATES,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costsKeys.hotelTemplates() });
    },
  });
}

export function useUpdateHotelCostTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NewHotelCostTemplate> }): Promise<HotelCostTemplate> => {
      const response = await apiClient.put<CostApiResponse<HotelCostTemplate>>(
        API_ENDPOINTS.COSTS_HOTEL_TEMPLATE_BY_ID(id),
        data
      );
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: costsKeys.hotelTemplates() });
      queryClient.invalidateQueries({ queryKey: costsKeys.hotelTemplate(id) });
    },
  });
}

export function useDeleteHotelCostTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(API_ENDPOINTS.COSTS_HOTEL_TEMPLATE_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costsKeys.hotelTemplates() });
      // Invalidate analytics queries as cost changes affect profit calculations
      queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
    },
  });
}

// ===== OPERATIONAL COST MUTATIONS =====
export function useCreateOperationalCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: NewOperationalCost): Promise<OperationalCost> => {
      const response = await apiClient.post<CostApiResponse<OperationalCost>>(
        API_ENDPOINTS.COSTS_OPERATIONAL,
        data
      );
      return response.data;
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: costsKeys.operational() });
      queryClient.invalidateQueries({ queryKey: costsKeys.operationalByBooking(data.bookingId.toString()) });
      // Invalidate analytics queries as cost changes affect profit calculations
      queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
    },
  });
}

export function useUpdateOperationalCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NewOperationalCost> }): Promise<OperationalCost> => {
      const response = await apiClient.put<CostApiResponse<OperationalCost>>(
        API_ENDPOINTS.COSTS_OPERATIONAL_BY_ID(id),
        data
      );
      return response.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: costsKeys.operational() });
      queryClient.invalidateQueries({ queryKey: costsKeys.operationalByBooking(result.bookingId.toString()) });
      // Invalidate analytics queries as cost changes affect profit calculations
      queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
    },
  });
}

export function useDeleteOperationalCost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(API_ENDPOINTS.COSTS_OPERATIONAL_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: costsKeys.operational() });
      // Invalidate analytics queries as cost changes affect profit calculations
      queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
    },
  });
}