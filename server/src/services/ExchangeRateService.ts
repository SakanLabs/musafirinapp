/**
 * ExchangeRateService
 *
 * Fetches SAR → IDR and USD → IDR exchange rates from BCA Bank Notes Sell.
 *
 * Source: https://www.bca.co.id/en/informasi/kurs
 *
 * BCA page embeds rate data in dropdown option elements:
 *   <a data-value-sell="eRate-TTCounter-BankNotes" data-text=SAR>
 *   <a data-value-sell="eRate-TTCounter-BankNotes" data-text=USD>
 *
 * We extract the 3rd value (Bank Notes) from data-value-sell on each currency row.
 */

import { db } from '../db';
import { exchangeRates } from '../db/schema';
import { desc, eq, and } from 'drizzle-orm';

// ─── Types ──────────────────────────────────────────────────────────

export interface ExchangeRateData {
  baseCurrency: string;
  quoteCurrency: string;
  rateType: string;
  rate: number;
  source: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  stale: boolean;
}

interface ParsedBcaRate {
  currency: string;
  eRateSell: number;
  ttCounterSell: number;
  bankNotesSell: number;
  eRateBuy: number;
  ttCounterBuy: number;
  bankNotesBuy: number;
}

// ─── Constants ──────────────────────────────────────────────────────

const BCA_KURS_URL = 'https://www.bca.co.id/en/informasi/kurs';
const FETCH_TIMEOUT_MS = 15_000;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_REASONABLE_RATE_SAR = 1000; // SAR→IDR should be at least ~1000
const MAX_REASONABLE_RATE_SAR = 20000; // SAR→IDR should be at most ~20000
const MIN_REASONABLE_RATE_USD = 12000; // USD→IDR should be at least ~12000
const MAX_REASONABLE_RATE_USD = 25000; // USD→IDR should be at most ~25000

// Backward-compat aliases used by validateRate
const MIN_REASONABLE_RATE = MIN_REASONABLE_RATE_SAR;
const MAX_REASONABLE_RATE = MAX_REASONABLE_RATE_SAR;

// ─── In-memory cache ────────────────────────────────────────────────

let cachedRate: ExchangeRateData | null = null;
let cachedUsdRate: ExchangeRateData | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let lastRefreshAttempt: Date | null = null;
let consecutiveFailures = 0;
let consecutiveUsdFailures = 0;

// ─── BCA Fetching & Parsing ────────────────────────────────────────

/**
 * Fetch raw HTML from BCA kurs page with timeout.
 */
async function fetchBcaHtml(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(BCA_KURS_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Musafirin/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`BCA returned HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generic BCA currency rate parser.
 *
 * Looks for the dropdown option with data-text=<CURRENCY> and extracts:
 *   data-value-sell = "eRate-TTCounter-BankNotes"
 *   data-value-buy  = "eRate-TTCounter-BankNotes"
 *
 * This approach explicitly validates the currency code rather than relying
 * on fragile column index positions.
 */
function parseCurrencyRateFromHtml(html: string, currencyCode: string): ParsedBcaRate {
  const code = currencyCode.toUpperCase();
  // Find the dropdown option element for the given currency
  const pattern = new RegExp(
    `data-value-buy="([^"]+)"\\s+data-value-sell="([^"]+)"\\s+data-text\\s*=\\s*"?${code}"?`,
    'i'
  );
  const match = html.match(pattern);

  if (!match) {
    // Try alternative attribute order
    const altPattern = new RegExp(
      `data-text\\s*=\\s*"?${code}"?[^>]*data-value-sell="([^"]+)"`,
      'i'
    );
    const altMatch = html.match(altPattern);
    
    if (!altMatch) {
      throw new Error(`BCA_RATE_PARSE_FAILED: ${code} currency row not found in BCA HTML`);
    }
    
    // With alternative pattern, we only have sell values
    const sellValues = altMatch[1]!.split('-').map(v => parseFloat(v.trim()));
    if (sellValues.length < 3 || sellValues[0] === undefined || sellValues[1] === undefined || sellValues[2] === undefined) {
      throw new Error(`BCA_RATE_PARSE_FAILED: ${code} sell values format unexpected`);
    }
    
    return {
      currency: code,
      eRateBuy: 0,
      ttCounterBuy: 0,
      bankNotesBuy: 0,
      eRateSell: sellValues[0],
      ttCounterSell: sellValues[1],
      bankNotesSell: sellValues[2],
    };
  }

  const buyValues = match[1]!.split('-').map(v => parseFloat(v.trim()));
  const sellValues = match[2]!.split('-').map(v => parseFloat(v.trim()));

  if (
    buyValues.length < 3 || sellValues.length < 3 ||
    buyValues[0] === undefined || buyValues[1] === undefined || buyValues[2] === undefined ||
    sellValues[0] === undefined || sellValues[1] === undefined || sellValues[2] === undefined
  ) {
    throw new Error(`BCA_RATE_PARSE_FAILED: ${code} rate values do not have expected 3-part format (eRate-TTCounter-BankNotes)`);
  }

  return {
    currency: code,
    eRateBuy: buyValues[0],
    ttCounterBuy: buyValues[1],
    bankNotesBuy: buyValues[2],
    eRateSell: sellValues[0],
    ttCounterSell: sellValues[1],
    bankNotesSell: sellValues[2],
  };
}

/** Backward-compat wrapper for SAR parsing */
function parseSarRateFromHtml(html: string): ParsedBcaRate {
  return parseCurrencyRateFromHtml(html, 'SAR');
}

/** Parse USD exchange rates from BCA HTML */
function parseUsdRateFromHtml(html: string): ParsedBcaRate {
  return parseCurrencyRateFromHtml(html, 'USD');
}

/**
 * Try to extract the BCA last-updated timestamp from the HTML page.
 * BCA typically shows something like "Last update: 29 Sep 2026 09:34 WIB"
 */
function parseBcaTimestamp(html: string): string | null {
  // Look for common patterns of the update timestamp
  const patterns = [
    /(?:Last\s+(?:update|updated?))[\s:]*(\d{1,2}\s+\w+\s+\d{4}[\s,]*\d{1,2}[:.]\d{2}(?:\s*(?:WIB|WITA|WIT))?)/i,
    /(\d{1,2}\s+\w{3,}\s+\d{4})\s*,?\s*(\d{1,2}[:.]\d{2})\s*(WIB|WITA|WIT)/i,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const dateStr = match[1] + (match[2] ? ' ' + match[2] : '');
        const parsed = new Date(dateStr.replace('.', ':'));
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      } catch {
        // Continue to next pattern
      }
    }
  }
  
  return null;
}

// ─── Validation ─────────────────────────────────────────────────────

/**
 * Validate that a parsed rate is reasonable.
 * Protects against parser errors turning random HTML numbers into rates.
 * Accepts optional min/max bounds for currency-specific validation.
 */
function validateRate(
  rate: number,
  minRate: number = MIN_REASONABLE_RATE,
  maxRate: number = MAX_REASONABLE_RATE
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(rate)) {
    return { valid: false, reason: 'Rate is not a finite number' };
  }
  if (rate <= 0) {
    return { valid: false, reason: 'Rate must be positive' };
  }
  if (rate < minRate) {
    return { valid: false, reason: `Rate ${rate} is below minimum reasonable value ${minRate}` };
  }
  if (rate > maxRate) {
    return { valid: false, reason: `Rate ${rate} exceeds maximum reasonable value ${maxRate}` };
  }
  // Rate of 0 in Bank Notes position means BCA doesn't offer bank notes for this currency
  if (rate === 0) {
    return { valid: false, reason: 'Bank Notes Sell rate is 0 (not available)' };
  }
  return { valid: true };
}

// ─── Database Operations ────────────────────────────────────────────

/**
 * Load the most recent valid rate from the database for a given currency pair.
 */
async function loadLatestRateFromDb(
  baseCurrency: string = 'SAR',
  quoteCurrency: string = 'IDR'
): Promise<ExchangeRateData | null> {
  try {
    const result = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, baseCurrency),
          eq(exchangeRates.quoteCurrency, quoteCurrency),
          eq(exchangeRates.rateType, 'BANK_NOTES_SELL'),
          eq(exchangeRates.source, 'BCA')
        )
      )
      .orderBy(desc(exchangeRates.fetchedAt))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0]!;
    return {
      baseCurrency: row.baseCurrency,
      quoteCurrency: row.quoteCurrency,
      rateType: row.rateType,
      rate: parseFloat(row.rate),
      source: row.source,
      sourceUrl: row.sourceUrl || BCA_KURS_URL,
      sourceUpdatedAt: row.sourceUpdatedAt?.toISOString() || null,
      fetchedAt: row.fetchedAt.toISOString(),
      stale: false,
    };
  } catch (error) {
    console.error(`[ExchangeRate] Failed to load ${baseCurrency}→${quoteCurrency} rate from database:`, error);
    return null;
  }
}

/**
 * Persist a rate to the database if it's new (dedup by rate + sourceUpdatedAt).
 */
async function persistRate(data: ExchangeRateData): Promise<void> {
  try {
    // Check for duplicate: same rate and same source timestamp
    const existing = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, data.baseCurrency),
          eq(exchangeRates.quoteCurrency, data.quoteCurrency),
          eq(exchangeRates.rateType, data.rateType),
          eq(exchangeRates.source, data.source)
        )
      )
      .orderBy(desc(exchangeRates.fetchedAt))
      .limit(1);

    // Skip if rate and source timestamp haven't changed
    if (existing.length > 0 && existing[0]) {
      const lastRate = parseFloat(existing[0].rate);
      const lastSourceUpdated = existing[0].sourceUpdatedAt?.toISOString() || null;
      
      if (lastRate === data.rate && lastSourceUpdated === data.sourceUpdatedAt) {
        return; // No change, skip duplicate insert
      }
    }

    await db.insert(exchangeRates).values({
      baseCurrency: data.baseCurrency,
      quoteCurrency: data.quoteCurrency,
      rateType: data.rateType,
      rate: String(data.rate),
      source: data.source,
      sourceUrl: data.sourceUrl,
      sourceUpdatedAt: data.sourceUpdatedAt ? new Date(data.sourceUpdatedAt) : null,
      fetchedAt: new Date(data.fetchedAt),
    });

    console.log(
      `[ExchangeRate] BCA_RATE_REFRESH_SUCCESS currency=SAR rateType=BANK_NOTES_SELL rate=${data.rate}` +
      (data.sourceUpdatedAt ? ` sourceUpdatedAt=${data.sourceUpdatedAt}` : '')
    );
  } catch (error) {
    console.error('[ExchangeRate] Failed to persist rate to database:', error);
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Refresh the SAR→IDR rate from BCA.
 * On failure, retains the last known valid rate and marks it stale.
 */
export async function refreshSarToIdrRate(): Promise<ExchangeRateData> {
  lastRefreshAttempt = new Date();

  try {
    // 1. Fetch BCA page
    const html = await fetchBcaHtml();

    // 2. Parse SAR rates
    const parsed = parseSarRateFromHtml(html);

    // 3. Get specifically Bank Notes Sell
    const bankNotesSellRate = parsed.bankNotesSell;

    // 4. Validate
    const validation = validateRate(bankNotesSellRate, MIN_REASONABLE_RATE_SAR, MAX_REASONABLE_RATE_SAR);
    if (!validation.valid) {
      throw new Error(`BCA_RATE_VALIDATION_FAILED: ${validation.reason}`);
    }

    // 5. Parse BCA timestamp
    const sourceUpdatedAt = parseBcaTimestamp(html);

    // 6. Build rate data
    const now = new Date().toISOString();
    const oldRate = cachedRate?.rate;

    const rateData: ExchangeRateData = {
      baseCurrency: 'SAR',
      quoteCurrency: 'IDR',
      rateType: 'BANK_NOTES_SELL',
      rate: bankNotesSellRate,
      source: 'BCA',
      sourceUrl: BCA_KURS_URL,
      sourceUpdatedAt,
      fetchedAt: now,
      stale: false,
    };

    // 7. Persist to database (deduplicated)
    await persistRate(rateData);

    // 8. Update in-memory cache
    cachedRate = rateData;
    consecutiveFailures = 0;

    if (oldRate && oldRate !== bankNotesSellRate) {
      console.log(
        `[ExchangeRate] BCA_RATE_REFRESH_SUCCESS currency=SAR rateType=BANK_NOTES_SELL oldRate=${oldRate} newRate=${bankNotesSellRate}`
      );
    }

    return rateData;
  } catch (error) {
    consecutiveFailures++;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Determine log event type
    if (errorMessage.includes('PARSE_FAILED')) {
      console.error(`[ExchangeRate] BCA_RATE_PARSE_FAILED: ${errorMessage}`);
    } else if (errorMessage.includes('VALIDATION_FAILED')) {
      console.error(`[ExchangeRate] BCA_RATE_VALIDATION_FAILED: ${errorMessage}`);
    } else {
      console.error(`[ExchangeRate] BCA_RATE_REFRESH_FAILED: ${errorMessage}`);
    }

    // Return cached rate if available, marked stale
    if (cachedRate) {
      console.warn('[ExchangeRate] BCA_RATE_USING_STALE_CACHE: Using last known valid SAR rate');
      cachedRate = { ...cachedRate, stale: true };
      return cachedRate;
    }

    // Try to load from database as last resort
    const dbRate = await loadLatestRateFromDb('SAR', 'IDR');
    if (dbRate) {
      console.warn('[ExchangeRate] BCA_RATE_USING_STALE_CACHE: Loaded SAR from database');
      cachedRate = { ...dbRate, stale: true };
      return cachedRate;
    }

    // No valid rate ever obtained
    throw new Error(
      'No valid BCA exchange rate available. Cannot calculate SAR→IDR conversion. ' +
      `Last error: ${errorMessage}`
    );
  }
}

/**
 * Refresh the USD→IDR rate from BCA.
 * On failure, retains the last known valid rate and marks it stale.
 */
export async function refreshUsdToIdrRate(): Promise<ExchangeRateData> {
  lastRefreshAttempt = new Date();

  try {
    // 1. Fetch BCA page
    const html = await fetchBcaHtml();

    // 2. Parse USD rates
    const parsed = parseUsdRateFromHtml(html);

    // 3. Get specifically Bank Notes Sell
    const bankNotesSellRate = parsed.bankNotesSell;

    // 4. Validate with USD-specific bounds
    const validation = validateRate(bankNotesSellRate, MIN_REASONABLE_RATE_USD, MAX_REASONABLE_RATE_USD);
    if (!validation.valid) {
      throw new Error(`BCA_RATE_VALIDATION_FAILED: USD ${validation.reason}`);
    }

    // 5. Parse BCA timestamp
    const sourceUpdatedAt = parseBcaTimestamp(html);

    // 6. Build rate data
    const now = new Date().toISOString();
    const oldRate = cachedUsdRate?.rate;

    const rateData: ExchangeRateData = {
      baseCurrency: 'USD',
      quoteCurrency: 'IDR',
      rateType: 'BANK_NOTES_SELL',
      rate: bankNotesSellRate,
      source: 'BCA',
      sourceUrl: BCA_KURS_URL,
      sourceUpdatedAt,
      fetchedAt: now,
      stale: false,
    };

    // 7. Persist to database (deduplicated)
    await persistRate(rateData);

    // 8. Update in-memory cache
    cachedUsdRate = rateData;
    consecutiveUsdFailures = 0;

    if (oldRate && oldRate !== bankNotesSellRate) {
      console.log(
        `[ExchangeRate] BCA_RATE_REFRESH_SUCCESS currency=USD rateType=BANK_NOTES_SELL oldRate=${oldRate} newRate=${bankNotesSellRate}`
      );
    }

    return rateData;
  } catch (error) {
    consecutiveUsdFailures++;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('PARSE_FAILED')) {
      console.error(`[ExchangeRate] BCA_USD_RATE_PARSE_FAILED: ${errorMessage}`);
    } else if (errorMessage.includes('VALIDATION_FAILED')) {
      console.error(`[ExchangeRate] BCA_USD_RATE_VALIDATION_FAILED: ${errorMessage}`);
    } else {
      console.error(`[ExchangeRate] BCA_USD_RATE_REFRESH_FAILED: ${errorMessage}`);
    }

    // Return cached rate if available, marked stale
    if (cachedUsdRate) {
      console.warn('[ExchangeRate] BCA_RATE_USING_STALE_CACHE: Using last known valid USD rate');
      cachedUsdRate = { ...cachedUsdRate, stale: true };
      return cachedUsdRate;
    }

    // Try to load from database as last resort
    const dbRate = await loadLatestRateFromDb('USD', 'IDR');
    if (dbRate) {
      console.warn('[ExchangeRate] BCA_RATE_USING_STALE_CACHE: Loaded USD from database');
      cachedUsdRate = { ...dbRate, stale: true };
      return cachedUsdRate;
    }

    // No valid rate ever obtained
    throw new Error(
      'No valid BCA exchange rate available. Cannot calculate USD→IDR conversion. ' +
      `Last error: ${errorMessage}`
    );
  }
}

/**
 * Get the current SAR→IDR rate.
 * Returns cached rate if available, otherwise fetches.
 */
export async function getCurrentSarToIdrRate(): Promise<ExchangeRateData> {
  if (cachedRate) {
    return cachedRate;
  }

  // Try to load from database first
  const dbRate = await loadLatestRateFromDb('SAR', 'IDR');
  if (dbRate) {
    cachedRate = dbRate;
    return cachedRate;
  }

  // No cache at all — must fetch
  return refreshSarToIdrRate();
}

/**
 * Get the current USD→IDR rate.
 * Returns cached rate if available, otherwise fetches.
 */
export async function getCurrentUsdToIdrRate(): Promise<ExchangeRateData> {
  if (cachedUsdRate) {
    return cachedUsdRate;
  }

  // Try to load from database first
  const dbRate = await loadLatestRateFromDb('USD', 'IDR');
  if (dbRate) {
    cachedUsdRate = dbRate;
    return cachedUsdRate;
  }

  // No cache at all — must fetch
  return refreshUsdToIdrRate();
}

/**
 * Convert SAR amount to IDR using the current rate.
 * Uses integer arithmetic for financial precision.
 *
 * @param amountSar - Amount in SAR (string or number)
 * @returns Object with converted amount and rate details
 */
export async function convertSarToIdr(amountSar: number | string): Promise<{
  amountSar: number;
  amountIdr: number;
  rate: number;
  rateType: string;
  source: string;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  stale: boolean;
}> {
  const sarAmount = typeof amountSar === 'string' ? parseFloat(amountSar) : amountSar;
  
  if (!Number.isFinite(sarAmount) || sarAmount < 0) {
    throw new Error('Invalid SAR amount');
  }

  const rateData = await getCurrentSarToIdrRate();

  // Use integer arithmetic to avoid floating-point precision issues
  const amountIdr = Math.round(sarAmount * rateData.rate);

  return {
    amountSar: sarAmount,
    amountIdr,
    rate: rateData.rate,
    rateType: rateData.rateType,
    source: rateData.source,
    sourceUpdatedAt: rateData.sourceUpdatedAt,
    fetchedAt: rateData.fetchedAt,
    stale: rateData.stale,
  };
}

/**
 * Convert USD amount to IDR using the current rate.
 * Uses integer arithmetic for financial precision.
 *
 * @param amountUsd - Amount in USD (string or number)
 * @returns Object with converted amount and rate details
 */
export async function convertUsdToIdr(amountUsd: number | string): Promise<{
  amountUsd: number;
  amountIdr: number;
  rate: number;
  rateType: string;
  source: string;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  stale: boolean;
}> {
  const usdAmount = typeof amountUsd === 'string' ? parseFloat(amountUsd) : amountUsd;
  
  if (!Number.isFinite(usdAmount) || usdAmount < 0) {
    throw new Error('Invalid USD amount');
  }

  const rateData = await getCurrentUsdToIdrRate();

  const amountIdr = Math.round(usdAmount * rateData.rate);

  return {
    amountUsd: usdAmount,
    amountIdr,
    rate: rateData.rate,
    rateType: rateData.rateType,
    source: rateData.source,
    sourceUpdatedAt: rateData.sourceUpdatedAt,
    fetchedAt: rateData.fetchedAt,
    stale: rateData.stale,
  };
}

/**
 * Format IDR amount with Indonesian number formatting.
 * Example: 2419500 → "Rp 2.419.500"
 */
export function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Lifecycle ──────────────────────────────────────────────────────

/**
 * Initialize the exchange rate service.
 * Loads cached rate and starts periodic refresh.
 */
export async function initExchangeRateService(): Promise<void> {
  console.log('[ExchangeRate] Initializing exchange rate service...');

  try {
    // Try to load existing rates from DB first (fast startup)
    const dbSarRate = await loadLatestRateFromDb('SAR', 'IDR');
    if (dbSarRate) {
      cachedRate = dbSarRate;
      console.log(
        `[ExchangeRate] Loaded cached SAR rate from DB: 1 SAR = Rp ${dbSarRate.rate} (fetched ${dbSarRate.fetchedAt})`
      );
    }

    const dbUsdRate = await loadLatestRateFromDb('USD', 'IDR');
    if (dbUsdRate) {
      cachedUsdRate = dbUsdRate;
      console.log(
        `[ExchangeRate] Loaded cached USD rate from DB: 1 USD = Rp ${dbUsdRate.rate} (fetched ${dbUsdRate.fetchedAt})`
      );
    }

    // Then do a fresh fetch for both in the background
    refreshSarToIdrRate().catch(err => {
      console.error('[ExchangeRate] Initial SAR refresh failed:', err instanceof Error ? err.message : err);
    });
    refreshUsdToIdrRate().catch(err => {
      console.error('[ExchangeRate] Initial USD refresh failed:', err instanceof Error ? err.message : err);
    });
  } catch (error) {
    console.error('[ExchangeRate] Init failed to load from DB:', error);
  }

  // Start periodic refresh for both currencies
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  refreshTimer = setInterval(async () => {
    try {
      await refreshSarToIdrRate();
    } catch (error) {
      console.error('[ExchangeRate] Periodic SAR refresh failed:', error instanceof Error ? error.message : error);
    }
    try {
      await refreshUsdToIdrRate();
    } catch (error) {
      console.error('[ExchangeRate] Periodic USD refresh failed:', error instanceof Error ? error.message : error);
    }
  }, REFRESH_INTERVAL_MS);

  console.log(`[ExchangeRate] Periodic refresh scheduled every ${REFRESH_INTERVAL_MS / 60000} minutes (SAR + USD)`);
}

/**
 * Get service status info for admin display.
 */
export function getServiceStatus(): {
  hasRate: boolean;
  rate: number | null;
  stale: boolean;
  source: string | null;
  hasUsdRate: boolean;
  usdRate: number | null;
  usdStale: boolean;
  lastRefreshAttempt: string | null;
  consecutiveFailures: number;
  consecutiveUsdFailures: number;
  refreshIntervalMinutes: number;
} {
  return {
    hasRate: cachedRate !== null,
    rate: cachedRate?.rate ?? null,
    stale: cachedRate?.stale ?? false,
    source: cachedRate?.source ?? null,
    hasUsdRate: cachedUsdRate !== null,
    usdRate: cachedUsdRate?.rate ?? null,
    usdStale: cachedUsdRate?.stale ?? false,
    lastRefreshAttempt: lastRefreshAttempt?.toISOString() ?? null,
    consecutiveFailures,
    consecutiveUsdFailures,
    refreshIntervalMinutes: REFRESH_INTERVAL_MS / 60000,
  };
}

/**
 * Manually set the SAR→IDR exchange rate.
 * Used as fallback when BCA fetch is unavailable.
 */
export async function setManualRate(rate: number, setBy: string): Promise<ExchangeRateData> {
  // Validate
  const validation = validateRate(rate, MIN_REASONABLE_RATE_SAR, MAX_REASONABLE_RATE_SAR);
  if (!validation.valid) {
    throw new Error(`Invalid rate: ${validation.reason}`);
  }

  const now = new Date().toISOString();

  const rateData: ExchangeRateData = {
    baseCurrency: 'SAR',
    quoteCurrency: 'IDR',
    rateType: 'BANK_NOTES_SELL',
    rate,
    source: `MANUAL (${setBy})`,
    sourceUrl: '',
    sourceUpdatedAt: now,
    fetchedAt: now,
    stale: false,
  };

  // Persist to database
  await persistRate(rateData);

  // Update in-memory cache
  cachedRate = rateData;
  consecutiveFailures = 0;

  console.log(
    `[ExchangeRate] MANUAL_RATE_SET currency=SAR rate=${rate} setBy=${setBy}`
  );

  return rateData;
}

/**
 * Manually set the USD→IDR exchange rate.
 * Used as fallback when BCA fetch is unavailable.
 */
export async function setManualUsdRate(rate: number, setBy: string): Promise<ExchangeRateData> {
  // Validate with USD-specific bounds
  const validation = validateRate(rate, MIN_REASONABLE_RATE_USD, MAX_REASONABLE_RATE_USD);
  if (!validation.valid) {
    throw new Error(`Invalid rate: ${validation.reason}`);
  }

  const now = new Date().toISOString();

  const rateData: ExchangeRateData = {
    baseCurrency: 'USD',
    quoteCurrency: 'IDR',
    rateType: 'BANK_NOTES_SELL',
    rate,
    source: `MANUAL (${setBy})`,
    sourceUrl: '',
    sourceUpdatedAt: now,
    fetchedAt: now,
    stale: false,
  };

  // Persist to database
  await persistRate(rateData);

  // Update in-memory cache
  cachedUsdRate = rateData;
  consecutiveUsdFailures = 0;

  console.log(
    `[ExchangeRate] MANUAL_RATE_SET currency=USD rate=${rate} setBy=${setBy}`
  );

  return rateData;
}

// ─── Exports for testing ────────────────────────────────────────────

export const _testing = {
  parseCurrencyRateFromHtml,
  parseSarRateFromHtml,
  parseUsdRateFromHtml,
  parseBcaTimestamp,
  validateRate,
  MIN_REASONABLE_RATE,
  MAX_REASONABLE_RATE,
  MIN_REASONABLE_RATE_SAR,
  MAX_REASONABLE_RATE_SAR,
  MIN_REASONABLE_RATE_USD,
  MAX_REASONABLE_RATE_USD,
};
