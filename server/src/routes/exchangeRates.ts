/**
 * Exchange Rate API Routes
 *
 * GET  /api/exchange-rates/SAR-IDR           — Public: get current rate
 * POST /api/exchange-rates/SAR-IDR/refresh   — Admin: force refresh from BCA
 * POST /api/exchange-rates/SAR-IDR/manual    — Admin: manually set rate (fallback)
 * GET  /api/exchange-rates/SAR-IDR/convert   — Public: convert SAR amount to IDR
 * GET  /api/exchange-rates/SAR-IDR/status     — Admin: get service status
 */

import { Hono } from 'hono';
import {
  getCurrentSarToIdrRate,
  refreshSarToIdrRate,
  convertSarToIdr,
  getServiceStatus,
  setManualRate,
} from '../services/ExchangeRateService';
import { requireAdmin } from '../middleware/auth';

const exchangeRateRoutes = new Hono();

// ─── Public: Get current SAR→IDR rate ──────────────────────────────

exchangeRateRoutes.get('/SAR-IDR', async (c) => {
  try {
    const rate = await getCurrentSarToIdrRate();
    return c.json({
      success: true,
      data: rate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Exchange rate unavailable';
    console.error('[ExchangeRate API] GET /SAR-IDR failed:', message);
    return c.json({
      success: false,
      error: 'Exchange rate currently unavailable',
    }, 503);
  }
});

// ─── Public: Convert SAR amount to IDR ─────────────────────────────

exchangeRateRoutes.get('/SAR-IDR/convert', async (c) => {
  try {
    const amountParam = c.req.query('amount');
    if (!amountParam) {
      return c.json({ success: false, error: 'amount query parameter is required' }, 400);
    }

    const amount = parseFloat(amountParam);
    if (!Number.isFinite(amount) || amount < 0) {
      return c.json({ success: false, error: 'amount must be a non-negative number' }, 400);
    }

    const result = await convertSarToIdr(amount);
    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversion failed';
    console.error('[ExchangeRate API] GET /SAR-IDR/convert failed:', message);
    return c.json({
      success: false,
      error: 'Exchange rate conversion currently unavailable',
    }, 503);
  }
});

// ─── Admin: Force refresh from BCA ─────────────────────────────────

exchangeRateRoutes.post('/SAR-IDR/refresh', requireAdmin, async (c) => {
  try {
    const rate = await refreshSarToIdrRate();
    return c.json({
      success: true,
      data: rate,
      message: 'Exchange rate refreshed successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh failed';
    console.error('[ExchangeRate API] POST /SAR-IDR/refresh failed:', message);
    return c.json({
      success: false,
      error: `Failed to refresh exchange rate: ${message}`,
    }, 500);
  }
});

// ─── Admin: Get service status ─────────────────────────────────────

exchangeRateRoutes.get('/SAR-IDR/status', requireAdmin, async (c) => {
  try {
    const status = getServiceStatus();
    const rate = status.hasRate ? await getCurrentSarToIdrRate() : null;

    return c.json({
      success: true,
      data: {
        ...status,
        currentRate: rate,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Status check failed';
    return c.json({
      success: false,
      error: message,
    }, 500);
  }
});

// ─── Admin: Manually set rate ──────────────────────────────────────

exchangeRateRoutes.post('/SAR-IDR/manual', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const rate = parseFloat(body.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      return c.json({
        success: false,
        error: 'Rate harus berupa angka positif',
      }, 400);
    }

    // Get admin identity from JWT payload
    const payload = c.get('jwtPayload') as any;
    const setBy = payload?.email || payload?.sub || 'admin';

    const rateData = await setManualRate(rate, setBy);

    return c.json({
      success: true,
      message: `Kurs manual berhasil disimpan: 1 SAR = Rp ${new Intl.NumberFormat('id-ID').format(rate)}`,
      data: rateData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set manual rate';
    console.error('[ExchangeRate API] POST /SAR-IDR/manual failed:', message);
    return c.json({
      success: false,
      error: message,
    }, 500);
  }
});

export default exchangeRateRoutes;
