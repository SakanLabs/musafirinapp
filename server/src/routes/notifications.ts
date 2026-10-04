import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { notificationLogs } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { notificationService } from '../services/NotificationService';

const notificationRoutes = new Hono();

// POST /api/notifications/:id/retry - Retry a specific notification log
notificationRoutes.post('/:id/retry', requireAdmin, async (c) => {
  try {
    const idParam = c.req.param('id');
    const logId = parseInt(idParam, 10);

    if (isNaN(logId)) {
      return c.json({ error: 'Invalid notification log ID' }, 400);
    }

    const result = await notificationService.retryNotification(logId);

    return c.json({
      success: result.status === 'sent',
      data: result,
      message: result.status === 'sent' ? 'Notifikasi berhasil dikirim ulang' : 'Pengiriman ulang gagal',
    });
  } catch (error: any) {
    console.error('Error retrying notification:', error);
    return c.json({ error: error?.message || 'Failed to retry notification' }, 500);
  }
});

// GET /api/notifications/:id - Get detail of a specific notification log
notificationRoutes.get('/:id', requireAdmin, async (c) => {
  try {
    const idParam = c.req.param('id');
    const logId = parseInt(idParam, 10);

    if (isNaN(logId)) {
      return c.json({ error: 'Invalid notification log ID' }, 400);
    }

    const rows = await db
      .select()
      .from(notificationLogs)
      .where(eq(notificationLogs.id, logId))
      .limit(1);

    if (rows.length === 0) {
      return c.json({ error: 'Notification log not found' }, 404);
    }

    return c.json({
      success: true,
      data: rows[0],
    });
  } catch (error: any) {
    console.error('Error fetching notification detail:', error);
    return c.json({ error: 'Failed to fetch notification detail' }, 500);
  }
});

export default notificationRoutes;
