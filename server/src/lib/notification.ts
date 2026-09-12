/**
 * Notification Service
 * Mengelola notifikasi booking ke WhatsApp (via Kirimdev) dan Email (via SMTP) untuk Admin.
 */

import { sendWhatsAppToAdmin } from './whatsapp';
import { sendEmail } from './email';

export type BookingEventType =
  | 'hotel_booking'
  | 'public_hotel_checkout'
  | 'public_transportation_checkout'
  | 'public_custom_la_checkout'
  | 'agent_request'
  | 'muthowif_booking'
  | 'service_order';

export interface BookingNotificationPayload {
  type: BookingEventType;
  bookingCode: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  title: string;
  details: Record<string, string | number | undefined | null>;
  totalAmount?: string | number | null;
  currency?: string;
  source?: string;
  dashboardPath?: string;
}

const TYPE_LABELS: Record<BookingEventType, string> = {
  hotel_booking: '🏨 Booking Hotel (Direct)',
  public_hotel_checkout: '🛒 Checkout Hotel (Web Store)',
  public_transportation_checkout: '🚐 Checkout Transportasi (Web Store)',
  public_custom_la_checkout: '📦 Checkout Custom LA (Web Store)',
  agent_request: '🤝 Permintaan Hotel / Layanan Agen',
  muthowif_booking: '🕋 Booking Muthowif',
  service_order: '📑 Service Order Baru',
};

/**
 * Memformat pesan teks untuk WhatsApp
 */
function formatWhatsAppMessage(payload: BookingNotificationPayload, adminBaseUrl: string): string {
  const label = TYPE_LABELS[payload.type] || 'Pesanan Baru';
  const currency = payload.currency || 'SAR';

  let text = `🚨 *NOTIFIKASI BOOKING MASUK* 🚨\n`;
  text += `*Musafirin System*\n\n`;
  text += `📌 *Kategori:* ${label}\n`;
  text += `🔢 *No/Kode:* \`${payload.bookingCode}\`\n`;
  text += `👤 *Klien/Tamu:* ${payload.customerName}\n`;

  if (payload.customerPhone) {
    text += `📞 *Kontak:* ${payload.customerPhone}\n`;
  }
  if (payload.customerEmail) {
    text += `✉️ *Email:* ${payload.customerEmail}\n`;
  }

  text += `\n📝 *Detail Pesanan:*\n`;
  for (const [key, value] of Object.entries(payload.details)) {
    if (value !== undefined && value !== null && value !== '') {
      text += `• ${key}: *${value}*\n`;
    }
  }

  if (payload.totalAmount !== undefined && payload.totalAmount !== null) {
    const formattedAmount = typeof payload.totalAmount === 'number'
      ? payload.totalAmount.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : payload.totalAmount;
    text += `\n💰 *Total:* *${currency} ${formattedAmount}*\n`;
  }

  if (payload.source) {
    text += `🌐 *Sumber:* ${payload.source}\n`;
  }

  const dashboardUrl = payload.dashboardPath
    ? `${adminBaseUrl}${payload.dashboardPath.startsWith('/') ? '' : '/'}${payload.dashboardPath}`
    : adminBaseUrl;

  text += `\n🔗 *Buka di Dashboard:*\n${dashboardUrl}`;

  return text;
}

/**
 * Memformat template HTML untuk Email
 */
function formatEmailHtml(payload: BookingNotificationPayload, adminBaseUrl: string): string {
  const label = TYPE_LABELS[payload.type] || 'Pesanan Baru';
  const currency = payload.currency || 'SAR';
  const dashboardUrl = payload.dashboardPath
    ? `${adminBaseUrl}${payload.dashboardPath.startsWith('/') ? '' : '/'}${payload.dashboardPath}`
    : adminBaseUrl;

  let detailRows = '';
  for (const [key, value] of Object.entries(payload.details)) {
    if (value !== undefined && value !== null && value !== '') {
      detailRows += `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 500;">${key}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${value}</td>
        </tr>
      `;
    }
  }

  const formattedAmount = payload.totalAmount
    ? (typeof payload.totalAmount === 'number'
        ? payload.totalAmount.toLocaleString('id-ID', { minimumFractionDigits: 2 })
        : payload.totalAmount)
    : null;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 24px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700;">🚨 Notifikasi Booking Baru</h2>
          <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Ada pesanan baru masuk ke sistem Musafirin</p>
        </div>

        <div style="padding: 24px;">
          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
            <div style="font-size: 13px; color: #1e40af; font-weight: 600; text-transform: uppercase;">${label}</div>
            <div style="font-size: 18px; color: #1e3a8a; font-weight: bold; margin-top: 2px;">${payload.bookingCode}</div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 500;">Pemesan</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${payload.customerName}</td>
            </tr>
            ${payload.customerPhone ? `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 500;">Kontak</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${payload.customerPhone}</td>
            </tr>` : ''}
            ${payload.customerEmail ? `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-weight: 500;">Email</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600;">${payload.customerEmail}</td>
            </tr>` : ''}
            ${detailRows}
            ${formattedAmount ? `
            <tr style="background-color: #f1f5f9;">
              <td style="padding: 12px; color: #0f172a; font-weight: bold; font-size: 15px;">Total Biaya</td>
              <td style="padding: 12px; color: #16a34a; font-weight: bold; font-size: 16px;">${currency} ${formattedAmount}</td>
            </tr>` : ''}
          </table>

          <div style="text-align: center; margin-top: 28px;">
            <a href="${dashboardUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 14px;">
              Buka di Dashboard Admin &rarr;
            </a>
          </div>
        </div>

        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
          Musafirin Internal Notification System &bull; Notifikasi Otomatis
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Mengirim notifikasi booking baru ke Admin via WhatsApp dan Email secara bersamaan (Asinkron)
 */
export async function notifyAdminNewBooking(payload: BookingNotificationPayload): Promise<void> {
  const adminBaseUrl = process.env.BASE_URL || process.env.BETTER_AUTH_URL || 'https://admin.musafirin.co';
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER;

  // 1. WhatsApp Message
  const waMessage = formatWhatsAppMessage(payload, adminBaseUrl);

  // 2. Email Message
  const emailSubject = `[Booking Masuk] ${payload.title} - ${payload.bookingCode}`;
  const emailHtml = formatEmailHtml(payload, adminBaseUrl);

  // Kirim secara paralel tanpa menunggu/memblokir response request booking klien
  Promise.allSettled([
    // Kirim WhatsApp
    sendWhatsAppToAdmin(waMessage).catch((err) => {
      console.error('[Notification] Error mengirim WhatsApp:', err);
    }),

    // Kirim Email jika alamat email admin tersedia
    adminEmail ? sendEmail({
      to: adminEmail,
      subject: emailSubject,
      text: waMessage,
      html: emailHtml,
    }).catch((err) => {
      console.error('[Notification] Error mengirim Email:', err);
    }) : Promise.resolve(),
  ]).then((results) => {
    const waStatus = results[0].status === 'fulfilled' ? 'selesai' : 'gagal';
    const emailStatus = results[1].status === 'fulfilled' ? 'selesai' : 'gagal';
    console.log(`[Notification] Dispatch notifikasi booking [${payload.bookingCode}] -> WA: ${waStatus}, Email: ${emailStatus}`);
  });
}
