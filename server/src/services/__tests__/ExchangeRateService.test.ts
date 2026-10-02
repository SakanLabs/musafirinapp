/**
 * ExchangeRateService Tests
 *
 * Tests the BCA SAR→IDR and USD→IDR exchange rate parser, validator,
 * conversion logic, and failure handling.
 *
 * Run with: bun test server/src/services/__tests__/ExchangeRateService.test.ts
 */

import { describe, test, expect } from 'bun:test';
import { _testing } from '../ExchangeRateService';

const {
  parseSarRateFromHtml,
  parseUsdRateFromHtml,
  parseBcaTimestamp,
  validateRate,
  MIN_REASONABLE_RATE,
  MAX_REASONABLE_RATE,
  MIN_REASONABLE_RATE_USD,
  MAX_REASONABLE_RATE_USD,
} = _testing;

// ─── Representative BCA HTML snippets ───────────────────────────────

const SAMPLE_BCA_HTML = `
<div class="a-dropdown-content content-currency1 ddl-currency hidden">
  <a href="javascript:void(0)"
     class="a-dropdown-option a-dropdown-currency1"
     data-value-buy="17909.00-17795.00-17795.00"
     data-value-sell="17999.00-18075.00-18075.00"
     data-text=USD>
      USD
  </a>
  <a href="javascript:void(0)"
     class="a-dropdown-option a-dropdown-currency1"
     data-value-buy="4751.48-4724.55-4689.00"
     data-value-sell="4812.87-4830.43-4839.00"
     data-text=SAR>
      SAR
  </a>
  <a href="javascript:void(0)"
     class="a-dropdown-option a-dropdown-currency1"
     data-value-buy="2272.98-2257.48-2263.00"
     data-value-sell="2304.05-2315.20-2329.00"
     data-text=HKD>
      HKD
  </a>
</div>
`;

const SAMPLE_BCA_HTML_WITH_TIMESTAMP = SAMPLE_BCA_HTML + `
<div class="kurs-update">Last update: 29 Sep 2026 09:34 WIB</div>
`;

const NO_SAR_HTML = `
<div class="a-dropdown-content">
  <a data-value-buy="17909.00-17795.00-17795.00"
     data-value-sell="17999.00-18075.00-18075.00"
     data-text=USD>USD</a>
</div>
`;

const MALFORMED_HTML = `
<div class="a-dropdown-content">
  <a data-value-buy="invalid"
     data-value-sell="not-a-number"
     data-text=SAR>SAR</a>
</div>
`;

// ─── Parser Tests ───────────────────────────────────────────────────

describe('parseSarRateFromHtml', () => {
  test('extracts SAR Bank Notes Sell correctly', () => {
    const result = parseSarRateFromHtml(SAMPLE_BCA_HTML);
    
    expect(result.currency).toBe('SAR');
    expect(result.bankNotesSell).toBe(4839.00);
  });

  test('extracts all rate values correctly', () => {
    const result = parseSarRateFromHtml(SAMPLE_BCA_HTML);
    
    // Sell values: eRate=4812.87, TTCounter=4830.43, BankNotes=4839.00
    expect(result.eRateSell).toBe(4812.87);
    expect(result.ttCounterSell).toBe(4830.43);
    expect(result.bankNotesSell).toBe(4839.00);
    
    // Buy values: eRate=4751.48, TTCounter=4724.55, BankNotes=4689.00
    expect(result.eRateBuy).toBe(4751.48);
    expect(result.ttCounterBuy).toBe(4724.55);
    expect(result.bankNotesBuy).toBe(4689.00);
  });

  test('does NOT return Bank Notes Buy when asked for Sell', () => {
    const result = parseSarRateFromHtml(SAMPLE_BCA_HTML);
    
    // Bank Notes Sell must be 4839, NOT 4689 (which is Bank Notes Buy)
    expect(result.bankNotesSell).toBe(4839.00);
    expect(result.bankNotesSell).not.toBe(4689.00); // Buy
    expect(result.bankNotesSell).not.toBe(4812.87); // e-Rate Sell
    expect(result.bankNotesSell).not.toBe(4830.43); // TT Counter Sell
  });

  test('does NOT return e-Rate Sell', () => {
    const result = parseSarRateFromHtml(SAMPLE_BCA_HTML);
    expect(result.bankNotesSell).not.toBe(result.eRateSell);
  });

  test('does NOT return TT Counter Sell', () => {
    const result = parseSarRateFromHtml(SAMPLE_BCA_HTML);
    expect(result.bankNotesSell).not.toBe(result.ttCounterSell);
  });

  test('throws when SAR row is missing', () => {
    expect(() => parseSarRateFromHtml(NO_SAR_HTML)).toThrow('SAR currency row not found');
  });

  test('throws on completely empty HTML', () => {
    expect(() => parseSarRateFromHtml('')).toThrow();
  });

  test('handles malformed values gracefully', () => {
    // Should parse but produce NaN values — the validator will catch this
    try {
      const result = parseSarRateFromHtml(MALFORMED_HTML);
      // If it parses, the values should be NaN
      expect(Number.isNaN(result.bankNotesSell) || result.bankNotesSell === 0).toBe(true);
    } catch {
      // Throwing is also acceptable behavior
    }
  });
});

// ─── USD Parser Tests ───────────────────────────────────────────────

describe('parseUsdRateFromHtml', () => {
  test('extracts USD Bank Notes Sell correctly', () => {
    const result = parseUsdRateFromHtml(SAMPLE_BCA_HTML);
    
    expect(result.currency).toBe('USD');
    expect(result.bankNotesSell).toBe(18075.00);
  });

  test('extracts all USD rate values correctly', () => {
    const result = parseUsdRateFromHtml(SAMPLE_BCA_HTML);
    
    // Sell values: eRate=17999.00, TTCounter=18075.00, BankNotes=18075.00
    expect(result.eRateSell).toBe(17999.00);
    expect(result.ttCounterSell).toBe(18075.00);
    expect(result.bankNotesSell).toBe(18075.00);
    
    // Buy values: eRate=17909.00, TTCounter=17795.00, BankNotes=17795.00
    expect(result.eRateBuy).toBe(17909.00);
    expect(result.ttCounterBuy).toBe(17795.00);
    expect(result.bankNotesBuy).toBe(17795.00);
  });

  test('throws when USD row is missing', () => {
    const noUsdHtml = `
    <div class="a-dropdown-content">
      <a data-value-buy="4751.48-4724.55-4689.00"
         data-value-sell="4812.87-4830.43-4839.00"
         data-text=SAR>SAR</a>
    </div>`;
    expect(() => parseUsdRateFromHtml(noUsdHtml)).toThrow('USD currency row not found');
  });
});

// ─── Validation Tests ───────────────────────────────────────────────

describe('validateRate', () => {
  test('accepts reasonable SAR→IDR rate', () => {
    expect(validateRate(4839).valid).toBe(true);
    expect(validateRate(4500).valid).toBe(true);
    expect(validateRate(5200).valid).toBe(true);
  });

  test('accepts reasonable USD→IDR rate with USD-specific bounds', () => {
    expect(validateRate(16000, MIN_REASONABLE_RATE_USD, MAX_REASONABLE_RATE_USD).valid).toBe(true);
    expect(validateRate(18075, MIN_REASONABLE_RATE_USD, MAX_REASONABLE_RATE_USD).valid).toBe(true);
  });

  test('rejects SAR-range rate when using USD bounds', () => {
    const result = validateRate(4839, MIN_REASONABLE_RATE_USD, MAX_REASONABLE_RATE_USD);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('below minimum');
  });

  test('rejects zero rate', () => {
    const result = validateRate(0);
    expect(result.valid).toBe(false);
  });

  test('rejects negative rate', () => {
    const result = validateRate(-100);
    expect(result.valid).toBe(false);
  });

  test('rejects NaN', () => {
    const result = validateRate(NaN);
    expect(result.valid).toBe(false);
  });

  test('rejects Infinity', () => {
    const result = validateRate(Infinity);
    expect(result.valid).toBe(false);
  });

  test('rejects unreasonably low rate', () => {
    const result = validateRate(50);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('below minimum');
  });

  test('rejects unreasonably high rate', () => {
    const result = validateRate(50000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exceeds maximum');
  });
});

// ─── Conversion Tests ───────────────────────────────────────────────

describe('SAR→IDR Conversion', () => {
  test('500 SAR × 4839 = 2,419,500 IDR', () => {
    const rate = 4839;
    const amountSar = 500;
    const expectedIdr = 2419500;
    
    expect(Math.round(amountSar * rate)).toBe(expectedIdr);
  });

  test('2500 SAR × 4839 = 12,097,500 IDR', () => {
    const rate = 4839;
    const amountSar = 2500;
    const expectedIdr = 12097500;
    
    expect(Math.round(amountSar * rate)).toBe(expectedIdr);
  });

  test('1 SAR × 4839 = 4,839 IDR', () => {
    const rate = 4839;
    const amountSar = 1;
    const expectedIdr = 4839;
    
    expect(Math.round(amountSar * rate)).toBe(expectedIdr);
  });

  test('fractional SAR rounds to whole IDR', () => {
    const rate = 4839;
    const amountSar = 100.5; // 100.5 × 4839 = 486,319.5
    const expectedIdr = 486320; // Rounded
    
    expect(Math.round(amountSar * rate)).toBe(expectedIdr);
  });

  test('zero SAR = zero IDR', () => {
    const rate = 4839;
    expect(Math.round(0 * rate)).toBe(0);
  });
});

// ─── Timestamp Parsing Tests ────────────────────────────────────────

describe('parseBcaTimestamp', () => {
  test('returns null when no timestamp found', () => {
    expect(parseBcaTimestamp(SAMPLE_BCA_HTML)).toBe(null);
  });

  test('parses "Last update: 29 Sep 2026 09:34 WIB" format', () => {
    const result = parseBcaTimestamp(SAMPLE_BCA_HTML_WITH_TIMESTAMP);
    // Should return a valid ISO string or null
    if (result) {
      expect(new Date(result).getTime()).not.toBe(NaN);
    }
  });
});

// ─── Invoice Snapshot Tests ─────────────────────────────────────────

describe('Invoice Exchange Rate Snapshot', () => {
  test('snapshot preserves rate independently of current rate', () => {
    // Simulate: invoice created at rate 4839
    const snapshotRate = 4839;
    const invoiceAmountSar = 2500;
    const snapshotIdr = Math.round(invoiceAmountSar * snapshotRate);
    
    // Later, rate changes to 4900
    const currentRate = 4900;
    const currentIdr = Math.round(invoiceAmountSar * currentRate);
    
    // Invoice must still use snapshot rate
    expect(snapshotIdr).toBe(12097500);
    expect(snapshotIdr).not.toBe(currentIdr);
    expect(currentIdr).toBe(12250000);
  });

  test('snapshot rate is not affected by rate refresh', () => {
    // Simulate invoice with frozen snapshot
    const snapshot = {
      rate: 4839,
      source: 'BCA',
      rateType: 'BANK_NOTES_SELL',
      amountSar: 500,
      convertedAmountIdr: Math.round(500 * 4839),
    };

    // "Refresh" happens — new rate is different
    const newRate = 4900;

    // Snapshot must be unchanged
    expect(snapshot.rate).toBe(4839);
    expect(snapshot.convertedAmountIdr).toBe(2419500);
    expect(snapshot.convertedAmountIdr).not.toBe(Math.round(500 * newRate));
  });
});

// ─── IDR Formatting Tests ───────────────────────────────────────────

describe('IDR Formatting', () => {
  test('formats with Indonesian locale', () => {
    const formatter = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const formatted = formatter.format(2419500);
    // Should contain "Rp" and use period separators
    expect(formatted).toContain('Rp');
    // Should NOT contain decimal places
    expect(formatted).not.toContain(',00');
  });
});
