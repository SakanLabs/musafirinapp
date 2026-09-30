/**
 * ExchangeRateService
 *
 * Fetches SAR → IDR exchange rate from BCA Bank Notes Sell.
 *
 * Source: https://www.bca.co.id/en/informasi/kurs
 *
 * BCA page embeds rate data in dropdown option elements:
 *   <a data-value-sell="eRate-TTCounter-BankNotes" data-text=SAR>
 *
 * We extract the 3rd value (Bank Notes) from data-value-sell on the SAR row.
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
const MIN_REASONABLE_RATE = 1000; // SAR→IDR should be at least ~1000
const MAX_REASONABLE_RATE = 20000; // SAR→IDR should be at most ~20000

// ─── In-memory cache ────────────────────────────────────────────────

let cachedRate: ExchangeRateData | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let lastRefreshAttempt: Date | null = null;
let consecutiveFailures = 0;

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
 * Parse SAR exchange rates from BCA HTML.
 *
 * Looks for the dropdown option with data-text=SAR and extracts:
 *   data-value-sell = "eRate-TTCounter-BankNotes"
 *   data-value-buy  = "eRate-TTCounter-BankNotes"
 *
 * This approach explicitly validates currency=SAR rather than relying
 * on fragile column index positions.
 */
function parseSarRateFromHtml(html: string): ParsedBcaRate {
  // Find the SAR dropdown option element
  // Pattern: <a ... data-value-sell="..." data-value-buy="..." data-text=SAR ...>
  const sarPattern = /data-value-buy="([^"]+)"\s+data-value-sell="([^"]+)"\s+data-text\s*=\s*"?SAR"?/i;
  const match = html.match(sarPattern);

  if (!match) {
    // Try alternative attribute order
    const altPattern = /data-text\s*=\s*"?SAR"?[^>]*data-value-sell="([^"]+)"/i;
    const altMatch = html.match(altPattern);
    
    if (!altMatch) {
      throw new Error('BCA_RATE_PARSE_FAILED: SAR currency row not found in BCA HTML');
    }
    
    // With alternative pattern, we only have sell values
    const sellValues = altMatch[1]!.split('-').map(v => parseFloat(v.trim()));
    if (sellValues.length < 3 || sellValues[0] === undefined || sellValues[1] === undefined || sellValues[2] === undefined) {
      throw new Error('BCA_RATE_PARSE_FAILED: SAR sell values format unexpected');
    }
    
    return {
      currency: 'SAR',
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
    throw new Error('BCA_RATE_PARSE_FAILED: SAR rate values do not have expected 3-part format (eRate-TTCounter-BankNotes)');
  }

  return {
    currency: 'SAR',
    eRateBuy: buyValues[0],
    ttCounterBuy: buyValues[1],
    bankNotesBuy: buyValues[2],
    eRateSell: sellValues[0],
    ttCounterSell: sellValues[1],
    bankNotesSell: sellValues[2],
  };
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
 */
function validateRate(rate: number): { valid: boolean; reason?: string } {
  if (!Number.isFinite(rate)) {
    return { valid: false, reason: 'Rate is not a finite number' };
  }
  if (rate <= 0) {
    return { valid: false, reason: 'Rate must be positive' };
  }
  if (rate < MIN_REASONABLE_RATE) {
    return { valid: false, reason: `Rate ${rate} is below minimum reasonable value ${MIN_REASONABLE_RATE}` };
  }
  if (rate > MAX_REASONABLE_RATE) {
    return { valid: false, reason: `Rate ${rate} exceeds maximum reasonable value ${MAX_REASONABLE_RATE}` };
  }
  // Rate of 0 in Bank Notes position means BCA doesn't offer bank notes for this currency
  if (rate === 0) {
    return { valid: false, reason: 'Bank Notes Sell rate is 0 (not available)' };
  }
  return { valid: true };
}

// ─── Database Operations ────────────────────────────────────────────

/**
 * Load the most recent valid rate from the database.
 */
async function loadLatestRateFromDb(): Promise<ExchangeRateData | null> {
  try {
    const result = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, 'SAR'),
          eq(exchangeRates.quoteCurrency, 'IDR'),
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
    console.error('[ExchangeRate] Failed to load rate from database:', error);
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
    const validation = validateRate(bankNotesSellRate);
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
      console.warn('[ExchangeRate] BCA_RATE_USING_STALE_CACHE: Using last known valid rate');
      cachedRate = { ...cachedRate, stale: true };
      return cachedRate;
    }

    // Try to load from database as last resort
    const dbRate = await loadLatestRateFromDb();
    if (dbRate) {
      console.warn('[ExchangeRate] BCA_RATE_USING_STALE_CACHE: Loaded from database');
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
 * Get the current SAR→IDR rate.
 * Returns cached rate if available, otherwise fetches.
 */
export async function getCurrentSarToIdrRate(): Promise<ExchangeRateData> {
  if (cachedRate) {
    return cachedRate;
  }

  // Try to load from database first
  const dbRate = await loadLatestRateFromDb();
  if (dbRate) {
    cachedRate = dbRate;
    return cachedRate;
  }

  // No cache at all — must fetch
  return refreshSarToIdrRate();
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
  // Multiply SAR amount (in cents) by rate, then round to whole rupiah
  // Example: 500.50 SAR × 4839 = 2,419,519.5 → Rp 2,419,520
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
    // Try to load existing rate from DB first (fast startup)
    const dbRate = await loadLatestRateFromDb();
    if (dbRate) {
      cachedRate = dbRate;
      console.log(
        `[ExchangeRate] Loaded cached rate from DB: 1 SAR = Rp ${dbRate.rate} (fetched ${dbRate.fetchedAt})`
      );
    }

    // Then do a fresh fetch in the background
    refreshSarToIdrRate().catch(err => {
      console.error('[ExchangeRate] Initial refresh failed:', err instanceof Error ? err.message : err);
    });
  } catch (error) {
    console.error('[ExchangeRate] Init failed to load from DB:', error);
  }

  // Start periodic refresh
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  refreshTimer = setInterval(async () => {
    try {
      await refreshSarToIdrRate();
    } catch (error) {
      console.error('[ExchangeRate] Periodic refresh failed:', error instanceof Error ? error.message : error);
    }
  }, REFRESH_INTERVAL_MS);

  console.log(`[ExchangeRate] Periodic refresh scheduled every ${REFRESH_INTERVAL_MS / 60000} minutes`);
}

/**
 * Get service status info for admin display.
 */
export function getServiceStatus(): {
  hasRate: boolean;
  rate: number | null;
  stale: boolean;
  source: string | null;
  lastRefreshAttempt: string | null;
  consecutiveFailures: number;
  refreshIntervalMinutes: number;
} {
  return {
    hasRate: cachedRate !== null,
    rate: cachedRate?.rate ?? null,
    stale: cachedRate?.stale ?? false,
    source: cachedRate?.source ?? null,
    lastRefreshAttempt: lastRefreshAttempt?.toISOString() ?? null,
    consecutiveFailures,
    refreshIntervalMinutes: REFRESH_INTERVAL_MS / 60000,
  };
}

/**
 * Manually set the SAR→IDR exchange rate.
 * Used as fallback when BCA fetch is unavailable.
 */
export async function setManualRate(rate: number, setBy: string): Promise<ExchangeRateData> {
  // Validate
  const validation = validateRate(rate);
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
    `[ExchangeRate] MANUAL_RATE_SET rate=${rate} setBy=${setBy}`
  );

  return rateData;
}

// ─── Exports for testing ────────────────────────────────────────────

export const _testing = {
  parseSarRateFromHtml,
  parseBcaTimestamp,
  validateRate,
  MIN_REASONABLE_RATE,
  MAX_REASONABLE_RATE,
};
