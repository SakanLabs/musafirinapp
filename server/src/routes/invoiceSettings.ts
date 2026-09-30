import { Hono } from 'hono';
import { requireAdminOrFinance } from '../middleware/auth';
import { InvoiceTermsService } from '../services/InvoiceTermsService';

const invoiceSettingsRoutes = new Hono();

// GET /api/invoice-terms-settings - Get all invoice terms settings
invoiceSettingsRoutes.get('/', async (c) => {
  try {
    const settings = await InvoiceTermsService.getAll();
    return c.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error('Error fetching invoice terms settings:', error);
    return c.json({ success: false, error: error.message || 'Failed to fetch settings' }, 500);
  }
});

// GET /api/invoice-terms-settings/:type - Get terms setting for specific type
invoiceSettingsRoutes.get('/:type', async (c) => {
  try {
    const type = c.req.param('type');
    const result = await InvoiceTermsService.getByType(type);
    return c.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error(`Error fetching invoice terms for ${c.req.param('type')}:`, error);
    return c.json({ success: false, error: error.message || 'Failed to fetch setting' }, 500);
  }
});

// PUT /api/invoice-terms-settings/:type - Update terms setting for specific type
invoiceSettingsRoutes.put('/:type', requireAdminOrFinance, async (c) => {
  try {
    const type = c.req.param('type');
    const body = await c.req.json();

    const updated = await InvoiceTermsService.update(type, {
      name: body.name,
      title: body.title,
      checkInTime: body.checkInTime,
      checkOutTime: body.checkOutTime,
      terms: body.terms,
      notes: body.notes,
    });

    return c.json({
      success: true,
      message: `Pengaturan Syarat & Ketentuan untuk ${updated.name || type} berhasil disimpan`,
      data: updated,
    });
  } catch (error: any) {
    console.error(`Error updating invoice terms for ${c.req.param('type')}:`, error);
    return c.json({ success: false, error: error.message || 'Failed to update setting' }, 500);
  }
});

// POST /api/invoice-terms-settings/:type/reset - Reset terms setting for specific type to defaults
invoiceSettingsRoutes.post('/:type/reset', requireAdminOrFinance, async (c) => {
  try {
    const type = c.req.param('type');
    const resetResult = await InvoiceTermsService.reset(type);

    return c.json({
      success: true,
      message: `Pengaturan Syarat & Ketentuan untuk ${resetResult.name || type} berhasil dikembalikan ke default`,
      data: resetResult,
    });
  } catch (error: any) {
    console.error(`Error resetting invoice terms for ${c.req.param('type')}:`, error);
    return c.json({ success: false, error: error.message || 'Failed to reset setting' }, 500);
  }
});

export default invoiceSettingsRoutes;
