// API client configuration with credentials for BetterAuth session
const API_BASE_URL = 'http://localhost:3000';

// Generic API client with credentials included
export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      credentials: 'include', // Include cookies for BetterAuth session
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include', // Include cookies for BetterAuth session
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      credentials: 'include', // Include cookies for BetterAuth session
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      credentials: 'include', // Include cookies for BetterAuth session
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include', // Include cookies for BetterAuth session
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  // Download file from URL
  async downloadFile(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  },
};

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  BOOKINGS: '/api/bookings',
  BOOKING_BY_ID: (id: string) => `/api/bookings/${id}`,
  
  // Invoice endpoints
  INVOICES: '/api/invoices',
  GENERATE_INVOICE: (id: string) => `/api/invoices/${id}/generate`,
  INVOICE_BY_BOOKING: (bookingId: string) => `/api/invoices/booking/${bookingId}`,
  INVOICE_BY_BOOKING_TEST: (bookingId: string) => `/api/invoices/test/booking/${bookingId}`,
  DOWNLOAD_INVOICE: (id: string) => `/api/invoices/${id}/download`,
  
  // Voucher endpoints
  VOUCHERS: '/api/vouchers',
  GENERATE_VOUCHER: (id: string) => `/api/vouchers/${id}/generate`,
  
  // Reports endpoints
  REPORTS_SUMMARY: '/api/reports/summary',
} as const;