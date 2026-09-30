/**
 * Client-side exchange rate utilities.
 * Centralizes all SAR→IDR conversion logic for the frontend.
 */

import { apiClient, API_ENDPOINTS } from './api';

// ─── Types ──────────────────────────────────────────────────────────

export interface ExchangeRateResponse {
  success: boolean;
  data: {
    baseCurrency: string;
    quoteCurrency: string;
    rateType: string;
    rate: number;
    source: string;
    sourceUrl: string;
    sourceUpdatedAt: string | null;
    fetchedAt: string;
    stale: boolean;
  };
}

export interface ConversionResponse {
  success: boolean;
  data: {
    amountSar: number;
    amountIdr: number;
    rate: number;
    rateType: string;
    source: string;
    sourceUpdatedAt: string | null;
    fetchedAt: string;
    stale: boolean;
  };
}

export interface ExchangeRateStatusResponse {
  success: boolean;
  data: {
    hasRate: boolean;
    rate: number | null;
    stale: boolean;
    lastRefreshAttempt: string | null;
    consecutiveFailures: number;
    refreshIntervalMinutes: number;
    currentRate: ExchangeRateResponse['data'] | null;
  };
}

// ─── API calls ──────────────────────────────────────────────────────

/**
 * Get the current SAR→IDR exchange rate.
 */
export async function fetchExchangeRate(): Promise<ExchangeRateResponse> {
  return apiClient.get<ExchangeRateResponse>(API_ENDPOINTS.EXCHANGE_RATE_SAR_IDR);
}

/**
 * Convert SAR amount to IDR via the server.
 */
export async function fetchConversion(amountSar: number): Promise<ConversionResponse> {
  return apiClient.get<ConversionResponse>(API_ENDPOINTS.EXCHANGE_RATE_SAR_IDR_CONVERT(amountSar));
}

/**
 * Admin: Force refresh exchange rate from BCA.
 */
export async function refreshExchangeRate(): Promise<ExchangeRateResponse & { message?: string }> {
  return apiClient.post<ExchangeRateResponse & { message?: string }>(API_ENDPOINTS.EXCHANGE_RATE_SAR_IDR_REFRESH);
}

/**
 * Admin: Get exchange rate service status.
 */
export async function fetchExchangeRateStatus(): Promise<ExchangeRateStatusResponse> {
  return apiClient.get<ExchangeRateStatusResponse>(API_ENDPOINTS.EXCHANGE_RATE_SAR_IDR_STATUS);
}

/**
 * Admin: Manually set exchange rate (fallback when BCA fetch fails).
 */
export async function setManualExchangeRate(rate: number): Promise<ExchangeRateResponse & { message?: string }> {
  return apiClient.post<ExchangeRateResponse & { message?: string }>(API_ENDPOINTS.EXCHANGE_RATE_SAR_IDR_MANUAL, { rate });
}

// ─── Client-side formatting ─────────────────────────────────────────

/**
 * Format IDR amount with Indonesian number formatting.
 * Example: 2419500 → "Rp 2.419.500"
 */
export function formatIdr(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(num)) return '-';

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Convert SAR to IDR client-side using a known rate.
 * Uses Math.round for whole-rupiah precision.
 */
export function convertSarToIdrLocal(amountSar: number | string, rate: number): number {
  const sar = typeof amountSar === 'string' ? parseFloat(amountSar) : amountSar;
  if (!Number.isFinite(sar) || !Number.isFinite(rate)) return 0;
  return Math.round(sar * rate);
}

/**
 * Format SAR amount with IDR conversion display.
 * Example: "Rp 2.419.500" with subtitle "≈ 500 SAR"
 */
export function formatSarWithIdr(
  amountSar: number | string,
  rate: number | null
): { idr: string | null; sar: string } {
  const sar = typeof amountSar === 'string' ? parseFloat(amountSar) : amountSar;
  const sarFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(sar);

  if (!rate || !Number.isFinite(rate)) {
    return { idr: null, sar: `${sarFormatted} SAR` };
  }

  const idrAmount = Math.round(sar * rate);
  return {
    idr: formatIdr(idrAmount),
    sar: `≈ ${sarFormatted} SAR`,
  };
}
