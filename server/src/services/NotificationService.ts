/**
 * NotificationService
 * 
 * Centralized transactional client notification service for:
 * 1. Payment Confirmation (Email + WhatsApp)
 * 2. Voucher Delivery (Email + WhatsApp)
 * 
 * Guarantees:
 * - Idempotency & duplicate protection per (bookingId, type, channel, referenceId)
 * - Independent tracking for Email and WhatsApp
 * - Non-blocking: external provider failures never roll back business transactions
 * - Retry support for individual failed channels
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { bookings, clients, vouchers, bookingItems, notificationLogs, invoices, invoicePayments } from '../db/schema';
import type { NotificationLog, NewNotificationLog } from '../db/schema';
import { sendEmail } from '../lib/email';
import { sendWhatsAppMessage, normalizePhoneNumber } from '../lib/whatsapp';
import { formatOperationalDate } from '../lib/date';

export type NotificationType = 'payment_confirmation' | 'voucher' | 'invoice';
export type NotificationChannel = 'email' | 'whatsapp';

export interface SendPaymentConfirmationParams {
  bookingId?: number;
  orderCode?: string;
  orderTitle?: string;
  paymentId?: string | number | null;
  amount?: string | number;
  currency?: string;
  method?: string;
  terminLabel?: string;
  remainingBalance?: number;
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  paymentStatus?: string;
  checkIn?: Date | string;
  checkOut?: Date | string;
  channels?: NotificationChannel[];
  forceResend?: boolean;
  sentBy?: string;
}

export interface SendVoucherParams {
  bookingId: number;
  voucherId?: number;
  voucherNumber?: string;
  channels?: NotificationChannel[];
  forceResend?: boolean;
  sentBy?: string;
}

export interface SendInvoiceParams {
  bookingId?: number;
  clientId?: number;
  invoiceNumber: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  totalAmount: number | string;
  currency?: string;
  dueDate: Date | string;
  issueDate?: Date | string;
  downloadUrl?: string;
  channels?: NotificationChannel[];
  forceResend?: boolean;
  sentBy?: string;
}

export interface ChannelSendResult {
  channel: NotificationChannel;
  status: 'sent' | 'failed' | 'skipped';
  recipient: string;
  providerMessageId?: string;
  errorMessage?: string;
  skippedReason?: string;
}

export interface NotificationDispatchResult {
  bookingId?: number;
  type: NotificationType;
  results: ChannelSendResult[];
}

export interface InvoiceNotificationDispatchResult {
  bookingId?: number;
  invoiceNumber: string;
  type: NotificationType;
  results: ChannelSendResult[];
}

export class NotificationService {
  private getBaseUrl(): string {
    return process.env.BASE_URL || process.env.BETTER_AUTH_URL || 'https://musafirin.co';
  }

  private getAdminBaseUrl(): string {
    return process.env.ADMIN_URL || 'https://admin.musafirin.co';
  }

  /**
   * Mengirim notifikasi Konfirmasi Pembayaran ke Klien (Email & WhatsApp)
   */
  async sendPaymentConfirmation(params: SendPaymentConfirmationParams): Promise<NotificationDispatchResult> {
    const { bookingId, forceResend = false } = params;
    const channels = params.channels || ['email', 'whatsapp'];

    let bookingCode = params.orderCode || 'ORDER';
    let hotelName = params.orderTitle || 'Layanan Musafirin';
    let city = '';
    let formattedCheckIn = params.checkIn ? formatOperationalDate(params.checkIn, 'long') : '-';
    let formattedCheckOut = params.checkOut ? formatOperationalDate(params.checkOut, 'long') : '-';
    let paymentStatus = params.paymentStatus || 'paid';
    let recipientName = params.recipientName || 'Pelanggan Musafirin';
    let recipientEmail = params.recipientEmail || '';
    let recipientPhone = params.recipientPhone || '';
    let paymentAmount = params.amount ?? 0;
    let currency = params.currency || 'SAR';
    let method = params.method || 'Transfer Bank';
    let terminLabel = params.terminLabel || 'Pembayaran';
    let remainingBalance = params.remainingBalance ?? 0;
    let referenceId = String(params.paymentId || `PAY-${bookingCode}-${Date.now()}`);

    // 1. Fetch booking info if bookingId is provided
    if (bookingId) {
      const bookingRows = await db
        .select({
          id: bookings.id,
          code: bookings.code,
          hotelName: bookings.hotelName,
          city: bookings.city,
          checkIn: bookings.checkIn,
          checkOut: bookings.checkOut,
          totalAmount: bookings.totalAmount,
          paymentStatus: bookings.paymentStatus,
          meta: bookings.meta,
          clientName: clients.name,
          clientEmail: clients.email,
          clientPhone: clients.phone,
        })
        .from(bookings)
        .leftJoin(clients, eq(bookings.clientId, clients.id))
        .where(eq(bookings.id, bookingId))
        .limit(1);

      if (bookingRows.length > 0) {
        const booking = bookingRows[0]!;
        const meta = (booking.meta as Record<string, any>) || {};
        const payments = Array.isArray(meta.payments) ? meta.payments : [];
        const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;

        bookingCode = booking.code;
        hotelName = booking.hotelName;
        city = booking.city;
        paymentStatus = booking.paymentStatus;
        recipientName = booking.clientName || meta.guestName || recipientName;
        recipientEmail = booking.clientEmail || meta.guestEmail || recipientEmail;
        recipientPhone = booking.clientPhone || meta.guestPhone || recipientPhone;
        paymentAmount = params.amount ?? (latestPayment?.amount || booking.totalAmount);
        currency = params.currency || 'SAR';
        method = params.method || latestPayment?.method || method;
        terminLabel = params.terminLabel || latestPayment?.terminLabel || (booking.paymentStatus === 'paid' ? 'Lunas Penuh' : 'Pembayaran');
        remainingBalance = params.remainingBalance ?? (typeof meta.remainingBalance === 'number' ? meta.remainingBalance : 0);
        referenceId = String(params.paymentId || latestPayment?.reference || `PAY-${booking.code}-${payments.length || 1}`);
        formattedCheckIn = formatOperationalDate(booking.checkIn, 'long');
        formattedCheckOut = formatOperationalDate(booking.checkOut, 'long');
      }
    }

    const results: ChannelSendResult[] = [];

    // Format formatted amounts
    const formattedAmount = typeof paymentAmount === 'number'
      ? paymentAmount.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(paymentAmount);
    const formattedRemaining = remainingBalance.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // 2. Process each channel independently
    for (const channel of channels) {
      if (channel === 'email') {
        if (!recipientEmail || !recipientEmail.includes('@')) {
          results.push({
            channel: 'email',
            status: 'failed',
            recipient: recipientEmail || '(email tidak tersedia)',
            errorMessage: 'Alamat email klien tidak valid atau belum diisi',
          });
          continue;
        }

        // Idempotency check if bookingId present
        if (bookingId) {
          const isDuplicate = await this.checkDuplicate('payment_confirmation', bookingId, 'email', referenceId);
          if (isDuplicate && !forceResend) {
            console.log(`[NotificationService] Payment email skipped (already sent) for ${bookingCode}`);
            results.push({
              channel: 'email',
              status: 'skipped',
              recipient: recipientEmail,
              skippedReason: 'Notifikasi email sudah pernah dikirim untuk pembayaran ini',
            });
            continue;
          }
        }

        // Prepare email content
        const subject = `Konfirmasi Pembayaran — ${bookingCode}`;
        const textMessage = `Assalamu'alaikum Bapak/Ibu ${recipientName},\n\n` +
          `Pembayaran untuk ${bookingCode} (${hotelName}) telah kami terima dan konfirmasi.\n\n` +
          `Rincian Pembayaran:\n` +
          `• Kode: ${bookingCode}\n` +
          `• Layanan/Hotel: ${hotelName}${city ? ` (${city})` : ''}\n` +
          `• Jadwal: ${formattedCheckIn} s.d. ${formattedCheckOut}\n` +
          `• Status Pembayaran: ${paymentStatus.toUpperCase()} (${terminLabel})\n` +
          `• Jumlah Diterima: ${currency} ${formattedAmount}\n` +
          `• Sisa Pembayaran: ${currency} ${formattedRemaining}\n` +
          `• Metode: ${method}\n\n` +
          `Terima kasih telah mempercayakan perjalanan ibadah Anda kepada Musafirin.`;

        const htmlMessage = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <div style="background: #111111; padding: 28px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">MUSAFIRIN</h1>
                <p style="margin: 6px 0 0; font-size: 13px; color: #9ca3af;">Bukti Konfirmasi Pembayaran</p>
              </div>

              <div style="padding: 28px;">
                <div style="background-color: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                  <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #047857; letter-spacing: 0.05em;">Pembayaran Dikonfirmasi</span>
                  <div style="font-size: 26px; font-weight: 800; color: #065f46; margin-top: 4px;">${currency} ${formattedAmount}</div>
                  <div style="font-size: 12px; color: #047857; margin-top: 2px;">${terminLabel}</div>
                </div>

                <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-top: 0;">
                  Assalamu'alaikum <strong>${recipientName}</strong>,<br/>
                  Pembayaran untuk reservasi Anda telah berhasil kami terima dan catat di sistem Musafirin.
                </p>

                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Kode / Nomor</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 700; text-align: right;">${bookingCode}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Layanan</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right;">${hotelName}${city ? ` (${city})` : ''}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Jadwal</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 500; text-align: right;">${formattedCheckIn} &ndash; ${formattedCheckOut}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Metode Pembayaran</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 500; text-align: right;">${method}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Status Pembayaran</td>
                    <td style="padding: 10px 0; color: ${paymentStatus === 'paid' ? '#059669' : '#d97706'}; font-weight: 700; text-align: right; text-transform: uppercase;">
                      ${paymentStatus}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Sisa Pembayaran</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 700; text-align: right;">${currency} ${formattedRemaining}</td>
                  </tr>
                </table>

                <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; line-height: 1.5;">
                  Terima kasih telah mempercayakan perjalanan Anda kepada <strong>Musafirin</strong>.<br/>
                  Jika ada pertanyaan, silakan hubungi tim operasional kami.
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        let logId: number | null = null;
        if (bookingId) {
          logId = await this.recordPendingLog({
            bookingId,
            clientId: null,
            type: 'payment_confirmation',
            channel: 'email',
            recipient: recipientEmail,
            referenceId,
            metadata: { amount: paymentAmount, currency, terminLabel },
          });
        }

        try {
          const emailRes = await sendEmail({
            to: recipientEmail,
            subject,
            text: textMessage,
            html: htmlMessage,
          });

          if (emailRes.success) {
            if (logId) await this.markLogSent(logId, emailRes.messageId);
            results.push({
              channel: 'email',
              status: 'sent',
              recipient: recipientEmail,
              providerMessageId: emailRes.messageId,
            });
          } else {
            if (logId) await this.markLogFailed(logId, emailRes.error || 'SMTP delivery failed');
            results.push({
              channel: 'email',
              status: 'failed',
              recipient: recipientEmail,
              errorMessage: emailRes.error || 'Gagal mengirim email',
            });
          }
        } catch (err: any) {
          if (logId) await this.markLogFailed(logId, err?.message || 'Unexpected email error');
          results.push({
            channel: 'email',
            status: 'failed',
            recipient: recipientEmail,
            errorMessage: err?.message || 'Unexpected email error',
          });
        }
      }

      if (channel === 'whatsapp') {
        const cleanPhone = normalizePhoneNumber(recipientPhone);
        if (!cleanPhone) {
          results.push({
            channel: 'whatsapp',
            status: 'failed',
            recipient: recipientPhone || '(nomor telepon tidak tersedia)',
            errorMessage: 'Nomor telepon klien tidak valid atau belum diisi',
          });
          continue;
        }

        // Idempotency check if bookingId present
        if (bookingId) {
          const isDuplicate = await this.checkDuplicate('payment_confirmation', bookingId, 'whatsapp', referenceId);
          if (isDuplicate && !forceResend) {
            console.log(`[NotificationService] Payment WhatsApp skipped (already sent) for ${bookingCode}`);
            results.push({
              channel: 'whatsapp',
              status: 'skipped',
              recipient: cleanPhone,
              skippedReason: 'Notifikasi WhatsApp sudah pernah dikirim untuk pembayaran ini',
            });
            continue;
          }
        }

        const waText =
          `Assalamu'alaikum Bapak/Ibu *${recipientName}*,\n\n` +
          `Pembayaran untuk *${bookingCode}* telah kami terima dan konfirmasi.\n\n` +
          `📋 *Detail Pembayaran:*\n` +
          `• Kode: \`${bookingCode}\`\n` +
          `• Layanan/Hotel: *${hotelName}${city ? ` (${city})` : ''}*\n` +
          `• Jadwal: ${formattedCheckIn} s.d. ${formattedCheckOut}\n` +
          `• Jumlah Diterima: *${currency} ${formattedAmount}*\n` +
          `• Keterangan: *${terminLabel}*\n` +
          `• Status: *${paymentStatus.toUpperCase()}*\n` +
          `• Sisa Tagihan: *${currency} ${formattedRemaining}*\n\n` +
          `Terima kasih telah mempercayakan perjalanan ibadah Anda kepada Musafirin.`;

        let logId: number | null = null;
        if (bookingId) {
          logId = await this.recordPendingLog({
            bookingId,
            clientId: null,
            type: 'payment_confirmation',
            channel: 'whatsapp',
            recipient: cleanPhone,
            referenceId,
            metadata: { amount: paymentAmount, currency, terminLabel },
          });
        }

        try {
          const waRes = await sendWhatsAppMessage(cleanPhone, waText);
          if (waRes.success) {
            if (logId) await this.markLogSent(logId, waRes.messageId);
            results.push({
              channel: 'whatsapp',
              status: 'sent',
              recipient: cleanPhone,
              providerMessageId: waRes.messageId,
            });
          } else {
            if (logId) await this.markLogFailed(logId, waRes.error || 'WhatsApp delivery failed');
            results.push({
              channel: 'whatsapp',
              status: 'failed',
              recipient: cleanPhone,
              errorMessage: waRes.error || 'Gagal mengirim WhatsApp',
            });
          }
        } catch (err: any) {
          if (logId) await this.markLogFailed(logId, err?.message || 'Unexpected WhatsApp error');
          results.push({
            channel: 'whatsapp',
            status: 'failed',
            recipient: cleanPhone,
            errorMessage: err?.message || 'Unexpected WhatsApp error',
          });
        }
      }
    }

    return {
      bookingId,
      type: 'payment_confirmation',
      results,
    };
  }

  /**
   * Mengirim notifikasi Voucher ke Klien (Email & WhatsApp)
   */
  async sendVoucher(params: SendVoucherParams): Promise<NotificationDispatchResult> {
    const { bookingId, forceResend = false, sentBy } = params;
    const channels = params.channels || ['email', 'whatsapp'];

    // 1. Fetch booking, voucher, items, and client info
    const voucherRows = await db
      .select({
        id: vouchers.id,
        number: vouchers.number,
        guestName: vouchers.guestName,
        pdfUrl: vouchers.pdfUrl,
        sentAt: vouchers.sentAt,
        bookingCode: bookings.code,
        hotelName: bookings.hotelName,
        city: bookings.city,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        hcn: bookings.hotelConfirmationNo,
        meta: bookings.meta,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(vouchers)
      .innerJoin(bookings, eq(vouchers.bookingId, bookings.id))
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(eq(vouchers.bookingId, bookingId))
      .limit(1);

    if (voucherRows.length === 0) {
      throw new Error(`Voucher untuk booking #${bookingId} belum diterbitkan. Silakan generate voucher terlebih dahulu.`);
    }

    const voucher = voucherRows[0]!;
    const meta = (voucher.meta as Record<string, any>) || {};

    // Get rooms summary
    const items = await db
      .select({
        roomType: bookingItems.roomType,
        roomCount: bookingItems.roomCount,
      })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId));

    const roomSummary = items.map(i => `${i.roomCount}x ${i.roomType}`).join(', ') || 'Kamar Standar';
    const referenceId = voucher.number;

    const recipientName = voucher.guestName || voucher.clientName || meta.guestName || 'Pelanggan Musafirin';
    const recipientEmail = voucher.clientEmail || meta.guestEmail || '';
    const recipientPhone = voucher.clientPhone || meta.guestPhone || '';

    // Secure download URL
    const baseUrl = this.getBaseUrl();
    const voucherDownloadUrl = `${baseUrl}/api/vouchers/by-number/${voucher.number}`;

    const formattedCheckIn = formatOperationalDate(voucher.checkIn, 'long');
    const formattedCheckOut = formatOperationalDate(voucher.checkOut, 'long');

    const results: ChannelSendResult[] = [];
    let anyChannelSent = false;

    // 2. Process each channel
    for (const channel of channels) {
      if (channel === 'email') {
        if (!recipientEmail || !recipientEmail.includes('@')) {
          results.push({
            channel: 'email',
            status: 'failed',
            recipient: recipientEmail || '(email tidak tersedia)',
            errorMessage: 'Alamat email klien tidak valid atau belum diisi',
          });
          continue;
        }

        // Idempotency check
        const isDuplicate = await this.checkDuplicate('voucher', bookingId, 'email', referenceId);
        if (isDuplicate && !forceResend) {
          console.log(`[NotificationService] Voucher email skipped (already sent) for voucher ${voucher.number}`);
          results.push({
            channel: 'email',
            status: 'skipped',
            recipient: recipientEmail,
            skippedReason: 'Voucher sudah pernah dikirim via email',
          });
          continue;
        }

        const subject = `Voucher Booking ${voucher.bookingCode} — Musafirin`;
        const textMessage =
          `Assalamu'alaikum Bapak/Ibu ${recipientName},\n\n` +
          `Voucher untuk booking ${voucher.bookingCode} telah tersedia.\n\n` +
          `Rincian Reservasi:\n` +
          `• No. Voucher: ${voucher.number}\n` +
          `• Hotel: ${voucher.hotelName} (${voucher.city})\n` +
          `• HCN (Hotel Confirmation): ${voucher.hcn || 'Terkonfirmasi'}\n` +
          `• Check-in: ${formattedCheckIn}\n` +
          `• Check-out: ${formattedCheckOut}\n` +
          `• Tipe Kamar: ${roomSummary}\n\n` +
          `Voucher dapat diunduh melalui link berikut:\n${voucherDownloadUrl}\n\n` +
          `Mohon periksa kembali nama tamu, tanggal, hotel, dan detail reservasi Anda.\n` +
          `Terima kasih telah mempercayakan perjalanan Anda kepada Musafirin.`;

        const htmlMessage = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <div style="background: #111111; padding: 28px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">MUSAFIRIN</h1>
                <p style="margin: 6px 0 0; font-size: 13px; color: #9ca3af;">Hotel Reservation Voucher</p>
              </div>

              <div style="padding: 28px;">
                <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                  <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1e40af; letter-spacing: 0.05em;">Nomor Voucher</span>
                  <div style="font-size: 22px; font-weight: 800; color: #1e3a8a; margin-top: 4px; font-family: monospace;">${voucher.number}</div>
                  ${voucher.hcn ? `<div style="font-size: 12px; color: #1e40af; margin-top: 4px;">HCN: <strong>${voucher.hcn}</strong></div>` : ''}
                </div>

                <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-top: 0;">
                  Assalamu'alaikum <strong>${recipientName}</strong>,<br/>
                  Voucher reservasi hotel Anda telah resmi diterbitkan. Silakan periksa rincian reservasi di bawah ini:
                </p>

                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Kode Booking</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 700; text-align: right;">${voucher.bookingCode}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Hotel & Kota</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right;">${voucher.hotelName} (${voucher.city})</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Check-in</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right;">${formattedCheckIn}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Check-out</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right;">${formattedCheckOut}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Kamar</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right;">${roomSummary}</td>
                  </tr>
                </table>

                <div style="text-align: center; margin: 32px 0 20px 0;">
                  <a href="${voucherDownloadUrl}" style="background-color: #111111; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 14px;">
                    Unduh Dokumen Voucher (PDF) &rarr;
                  </a>
                </div>

                <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; line-height: 1.5;">
                  Tunjukkan voucher ini kepada resepsionis hotel saat check-in.<br/>
                  Terima kasih telah mempercayakan perjalanan Anda kepada <strong>Musafirin</strong>.
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        const logId = await this.recordPendingLog({
          bookingId,
          clientId: null,
          type: 'voucher',
          channel: 'email',
          recipient: recipientEmail,
          referenceId,
          metadata: { voucherNumber: voucher.number, pdfUrl: voucher.pdfUrl },
        });

        try {
          const emailRes = await sendEmail({
            to: recipientEmail,
            subject,
            text: textMessage,
            html: htmlMessage,
          });

          if (emailRes.success) {
            await this.markLogSent(logId, emailRes.messageId);
            anyChannelSent = true;
            results.push({
              channel: 'email',
              status: 'sent',
              recipient: recipientEmail,
              providerMessageId: emailRes.messageId,
            });
          } else {
            await this.markLogFailed(logId, emailRes.error || 'SMTP delivery failed');
            results.push({
              channel: 'email',
              status: 'failed',
              recipient: recipientEmail,
              errorMessage: emailRes.error || 'Gagal mengirim email',
            });
          }
        } catch (err: any) {
          await this.markLogFailed(logId, err?.message || 'Unexpected email error');
          results.push({
            channel: 'email',
            status: 'failed',
            recipient: recipientEmail,
            errorMessage: err?.message || 'Unexpected email error',
          });
        }
      }

      if (channel === 'whatsapp') {
        const cleanPhone = normalizePhoneNumber(recipientPhone);
        if (!cleanPhone) {
          results.push({
            channel: 'whatsapp',
            status: 'failed',
            recipient: recipientPhone || '(nomor telepon tidak tersedia)',
            errorMessage: 'Nomor telepon klien tidak valid atau belum diisi',
          });
          continue;
        }

        // Idempotency check
        const isDuplicate = await this.checkDuplicate('voucher', bookingId, 'whatsapp', referenceId);
        if (isDuplicate && !forceResend) {
          console.log(`[NotificationService] Voucher WhatsApp skipped (already sent) for voucher ${voucher.number}`);
          results.push({
            channel: 'whatsapp',
            status: 'skipped',
            recipient: cleanPhone,
            skippedReason: 'Voucher sudah pernah dikirim via WhatsApp',
          });
          continue;
        }

        const waText =
          `Assalamu'alaikum Bapak/Ibu *${recipientName}*,\n\n` +
          `Voucher untuk booking *${voucher.bookingCode}* telah tersedia.\n\n` +
          `🏨 *Rincian Reservasi:*\n` +
          `• No. Voucher: \`${voucher.number}\`\n` +
          `• Hotel: *${voucher.hotelName} (${voucher.city})*\n` +
          (voucher.hcn ? `• HCN (Hotel Confirmation): *${voucher.hcn}*\n` : '') +
          `• Check-in: *${formattedCheckIn}*\n` +
          `• Check-out: *${formattedCheckOut}*\n` +
          `• Kamar: *${roomSummary}*\n\n` +
          `📄 *Unduh Voucher (PDF):*\n${voucherDownloadUrl}\n\n` +
          `Mohon periksa kembali nama tamu, tanggal, hotel, dan detail reservasi Anda.\n` +
          `Terima kasih telah mempercayakan perjalanan Anda kepada Musafirin.`;

        const logId = await this.recordPendingLog({
          bookingId,
          clientId: null,
          type: 'voucher',
          channel: 'whatsapp',
          recipient: cleanPhone,
          referenceId,
          metadata: { voucherNumber: voucher.number, pdfUrl: voucher.pdfUrl },
        });

        try {
          const waRes = await sendWhatsAppMessage(cleanPhone, waText);
          if (waRes.success) {
            await this.markLogSent(logId, waRes.messageId);
            anyChannelSent = true;
            results.push({
              channel: 'whatsapp',
              status: 'sent',
              recipient: cleanPhone,
              providerMessageId: waRes.messageId,
            });
          } else {
            await this.markLogFailed(logId, waRes.error || 'WhatsApp delivery failed');
            results.push({
              channel: 'whatsapp',
              status: 'failed',
              recipient: cleanPhone,
              errorMessage: waRes.error || 'Gagal mengirim WhatsApp',
            });
          }
        } catch (err: any) {
          await this.markLogFailed(logId, err?.message || 'Unexpected WhatsApp error');
          results.push({
            channel: 'whatsapp',
            status: 'failed',
            recipient: cleanPhone,
            errorMessage: err?.message || 'Unexpected WhatsApp error',
          });
        }
      }
    }

    // Update voucher sent_at and sent_by if at least one channel succeeded
    if (anyChannelSent) {
      await db
        .update(vouchers)
        .set({
          sentAt: new Date(),
          sentBy: sentBy || 'admin',
        })
        .where(eq(vouchers.id, voucher.id));
    }

    return {
      bookingId,
      type: 'voucher',
      results,
    };
  }

  /**
   * Mengirim notifikasi Invoice ke Klien (Email & WhatsApp)
   */
  async sendInvoice(params: SendInvoiceParams): Promise<InvoiceNotificationDispatchResult> {
    const {
      bookingId,
      clientId,
      invoiceNumber,
      recipientName,
      recipientEmail = '',
      recipientPhone = '',
      totalAmount,
      currency = 'SAR',
      dueDate,
      issueDate,
      downloadUrl,
      forceResend = false,
    } = params;
    const channels = params.channels || ['email', 'whatsapp'];

    const formattedAmount = typeof totalAmount === 'number'
      ? totalAmount.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(totalAmount);
    const formattedDueDate = formatOperationalDate(dueDate, 'long');
    const formattedIssueDate = issueDate ? formatOperationalDate(issueDate, 'long') : formatOperationalDate(new Date(), 'long');
    const invoicePdfUrl = downloadUrl || `${this.getBaseUrl()}/api/invoices/by-number/${invoiceNumber}`;

    const results: ChannelSendResult[] = [];

    for (const channel of channels) {
      if (channel === 'email') {
        if (!recipientEmail || !recipientEmail.includes('@')) {
          results.push({
            channel: 'email',
            status: 'failed',
            recipient: recipientEmail || '(email tidak tersedia)',
            errorMessage: 'Alamat email klien tidak valid atau belum diisi',
          });
          continue;
        }

        // Idempotency check if bookingId available
        if (bookingId) {
          const isDuplicate = await this.checkDuplicate('invoice', bookingId, 'email', invoiceNumber);
          if (isDuplicate && !forceResend) {
            console.log(`[NotificationService] Invoice email skipped (already sent) for ${invoiceNumber}`);
            results.push({
              channel: 'email',
              status: 'skipped',
              recipient: recipientEmail,
              skippedReason: 'Invoice sudah pernah dikirim via email',
            });
            continue;
          }
        }

        const subject = `Tagihan Invoice ${invoiceNumber} — Musafirin`;
        const textMessage =
          `Assalamu'alaikum Bapak/Ibu ${recipientName},\n\n` +
          `Berikut adalah rincian tagihan Invoice resmi dari Musafirin:\n\n` +
          `Rincian Tagihan:\n` +
          `• No. Invoice: ${invoiceNumber}\n` +
          `• Tanggal Terbit: ${formattedIssueDate}\n` +
          `• Jatuh Tempo: ${formattedDueDate}\n` +
          `• Total Tagihan: ${currency} ${formattedAmount}\n\n` +
          `Dokumen invoice resmi dapat diunduh melalui tautan berikut:\n${invoicePdfUrl}\n\n` +
          `Mohon untuk melakukan pembayaran sebelum tanggal jatuh tempo.\n` +
          `Terima kasih telah mempercayakan perjalanan Anda kepada Musafirin.`;

        const htmlMessage = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <div style="background: #111111; padding: 28px; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">MUSAFIRIN</h1>
                <p style="margin: 6px 0 0; font-size: 13px; color: #9ca3af;">Tagihan Invoice Resmi</p>
              </div>

              <div style="padding: 28px;">
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px; text-align: center;">
                  <span style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Total Tagihan Invoice</span>
                  <div style="font-size: 26px; font-weight: 800; color: #0f172a; margin-top: 4px;">${currency} ${formattedAmount}</div>
                  <div style="font-size: 12px; color: #e11d48; margin-top: 4px; font-weight: 600;">Jatuh Tempo: ${formattedDueDate}</div>
                </div>

                <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-top: 0;">
                  Assalamu'alaikum <strong>${recipientName}</strong>,<br/>
                  Invoice tagihan resmi Anda telah diterbitkan. Berikut rincian ringkasan invoice:
                </p>

                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Nomor Invoice</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 700; text-align: right; font-family: monospace;">${invoiceNumber}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Tanggal Terbit</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right;">${formattedIssueDate}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Jatuh Tempo</td>
                    <td style="padding: 10px 0; color: #e11d48; font-weight: 700; text-align: right;">${formattedDueDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Total Tagihan</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 800; text-align: right;">${currency} ${formattedAmount}</td>
                  </tr>
                </table>

                <div style="text-align: center; margin: 32px 0 20px 0;">
                  <a href="${invoicePdfUrl}" style="background-color: #111111; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 14px;">
                    Unduh Dokumen Invoice (PDF) &rarr;
                  </a>
                </div>

                <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; line-height: 1.5;">
                  Silakan lakukan pembayaran sebelum tanggal jatuh tempo.<br/>
                  Terima kasih atas kerja sama dan kepercayaannya kepada <strong>Musafirin</strong>.
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        let logId: number | null = null;
        if (bookingId) {
          logId = await this.recordPendingLog({
            bookingId,
            clientId: clientId || null,
            type: 'invoice',
            channel: 'email',
            recipient: recipientEmail,
            referenceId: invoiceNumber,
            metadata: { invoiceNumber, totalAmount, currency, dueDate },
          });
        }

        try {
          const emailRes = await sendEmail({
            to: recipientEmail,
            subject,
            text: textMessage,
            html: htmlMessage,
          });

          if (emailRes.success) {
            if (logId) await this.markLogSent(logId, emailRes.messageId);
            results.push({
              channel: 'email',
              status: 'sent',
              recipient: recipientEmail,
              providerMessageId: emailRes.messageId,
            });
          } else {
            if (logId) await this.markLogFailed(logId, emailRes.error || 'SMTP delivery failed');
            results.push({
              channel: 'email',
              status: 'failed',
              recipient: recipientEmail,
              errorMessage: emailRes.error || 'Gagal mengirim email',
            });
          }
        } catch (err: any) {
          if (logId) await this.markLogFailed(logId, err?.message || 'Unexpected email error');
          results.push({
            channel: 'email',
            status: 'failed',
            recipient: recipientEmail,
            errorMessage: err?.message || 'Unexpected email error',
          });
        }
      }

      if (channel === 'whatsapp') {
        const cleanPhone = normalizePhoneNumber(recipientPhone);
        if (!cleanPhone) {
          results.push({
            channel: 'whatsapp',
            status: 'failed',
            recipient: recipientPhone || '(nomor telepon tidak tersedia)',
            errorMessage: 'Nomor telepon klien tidak valid atau belum diisi',
          });
          continue;
        }

        if (bookingId) {
          const isDuplicate = await this.checkDuplicate('invoice', bookingId, 'whatsapp', invoiceNumber);
          if (isDuplicate && !forceResend) {
            console.log(`[NotificationService] Invoice WhatsApp skipped (already sent) for ${invoiceNumber}`);
            results.push({
              channel: 'whatsapp',
              status: 'skipped',
              recipient: cleanPhone,
              skippedReason: 'Invoice sudah pernah dikirim via WhatsApp',
            });
            continue;
          }
        }

        const waText =
          `Assalamu'alaikum Bapak/Ibu *${recipientName}*,\n\n` +
          `Berikut adalah rincian tagihan Invoice resmi dari Musafirin:\n\n` +
          `📄 *Detail Tagihan Invoice:*\n` +
          `• No. Invoice: \`${invoiceNumber}\`\n` +
          `• Tanggal Terbit: ${formattedIssueDate}\n` +
          `• Jatuh Tempo: *${formattedDueDate}*\n` +
          `• Total Tagihan: *${currency} ${formattedAmount}*\n\n` +
          `🔗 *Unduh Dokumen Invoice (PDF):*\n${invoicePdfUrl}\n\n` +
          `Mohon untuk melakukan konfirmasi atau pembayaran sebelum tanggal jatuh tempo.\n` +
          `Terima kasih telah mempercayakan perjalanan ibadah Anda kepada Musafirin.`;

        let logId: number | null = null;
        if (bookingId) {
          logId = await this.recordPendingLog({
            bookingId,
            clientId: clientId || null,
            type: 'invoice',
            channel: 'whatsapp',
            recipient: cleanPhone,
            referenceId: invoiceNumber,
            metadata: { invoiceNumber, totalAmount, currency, dueDate },
          });
        }

        try {
          const waRes = await sendWhatsAppMessage(cleanPhone, waText);
          if (waRes.success) {
            if (logId) await this.markLogSent(logId, waRes.messageId);
            results.push({
              channel: 'whatsapp',
              status: 'sent',
              recipient: cleanPhone,
              providerMessageId: waRes.messageId,
            });
          } else {
            if (logId) await this.markLogFailed(logId, waRes.error || 'WhatsApp delivery failed');
            results.push({
              channel: 'whatsapp',
              status: 'failed',
              recipient: cleanPhone,
              errorMessage: waRes.error || 'Gagal mengirim WhatsApp',
            });
          }
        } catch (err: any) {
          if (logId) await this.markLogFailed(logId, err?.message || 'Unexpected WhatsApp error');
          results.push({
            channel: 'whatsapp',
            status: 'failed',
            recipient: cleanPhone,
            errorMessage: err?.message || 'Unexpected WhatsApp error',
          });
        }
      }
    }

    return {
      bookingId,
      invoiceNumber,
      type: 'invoice',
      results,
    };
  }

  /**
   * Retry specific failed notification by its log ID
   */
  async retryNotification(logId: number, sentBy?: string): Promise<ChannelSendResult> {
    const logs = await db
      .select()
      .from(notificationLogs)
      .where(eq(notificationLogs.id, logId))
      .limit(1);

    if (logs.length === 0) {
      throw new Error(`Notification log #${logId} not found`);
    }

    const log = logs[0]!;

    if (log.type === 'payment_confirmation') {
      const res = await this.sendPaymentConfirmation({
        bookingId: log.bookingId,
        paymentId: log.referenceId || undefined,
        channels: [log.channel as NotificationChannel],
        forceResend: true,
        sentBy,
      });
      return res.results[0] || { channel: log.channel as NotificationChannel, status: 'failed', recipient: log.recipient, errorMessage: 'Retry failed' };
    } else if (log.type === 'voucher') {
      const res = await this.sendVoucher({
        bookingId: log.bookingId,
        channels: [log.channel as NotificationChannel],
        forceResend: true,
        sentBy,
      });
      return res.results[0] || { channel: log.channel as NotificationChannel, status: 'failed', recipient: log.recipient, errorMessage: 'Retry failed' };
    } else if (log.type === 'invoice') {
      const meta = (log.metadata as Record<string, any>) || {};
      const res = await this.sendInvoice({
        bookingId: log.bookingId,
        invoiceNumber: log.referenceId || String(meta.invoiceNumber || ''),
        recipientName: 'Pelanggan Musafirin',
        recipientEmail: log.channel === 'email' ? log.recipient : undefined,
        recipientPhone: log.channel === 'whatsapp' ? log.recipient : undefined,
        totalAmount: meta.totalAmount || 0,
        currency: meta.currency || 'SAR',
        dueDate: meta.dueDate || new Date(),
        channels: [log.channel as NotificationChannel],
        forceResend: true,
        sentBy,
      });
      return res.results[0] || { channel: log.channel as NotificationChannel, status: 'failed', recipient: log.recipient, errorMessage: 'Retry failed' };
    }

    throw new Error(`Unsupported notification type: ${log.type}`);
  }

  /**
   * Get all notification logs for a booking
   */
  async getBookingNotifications(bookingId: number): Promise<NotificationLog[]> {
    return db
      .select()
      .from(notificationLogs)
      .where(eq(notificationLogs.bookingId, bookingId))
      .orderBy(desc(notificationLogs.createdAt));
  }

  // --- Helpers for idempotency and log management ---

  private async checkDuplicate(
    type: NotificationType,
    bookingId: number,
    channel: NotificationChannel,
    referenceId?: string
  ): Promise<boolean> {
    const conditions = [
      eq(notificationLogs.type, type),
      eq(notificationLogs.bookingId, bookingId),
      eq(notificationLogs.channel, channel),
      eq(notificationLogs.status, 'sent'),
    ];

    if (referenceId) {
      conditions.push(eq(notificationLogs.referenceId, referenceId));
    }

    const existing = await db
      .select({ id: notificationLogs.id })
      .from(notificationLogs)
      .where(and(...conditions))
      .limit(1);

    return existing.length > 0;
  }

  private async recordPendingLog(data: {
    bookingId: number;
    clientId: number | null;
    type: NotificationType;
    channel: NotificationChannel;
    recipient: string;
    referenceId?: string;
    metadata?: Record<string, any>;
  }): Promise<number> {
    // Check if an existing failed or pending log exists for this tuple
    const existing = await db
      .select({ id: notificationLogs.id, retryCount: notificationLogs.retryCount })
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.bookingId, data.bookingId),
          eq(notificationLogs.type, data.type),
          eq(notificationLogs.channel, data.channel),
          data.referenceId ? eq(notificationLogs.referenceId, data.referenceId) : sql`true`
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      const current = existing[0];
      await db
        .update(notificationLogs)
        .set({
          status: 'pending',
          recipient: data.recipient,
          retryCount: current.retryCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(notificationLogs.id, current.id));
      return current.id;
    }

    const [inserted] = await db
      .insert(notificationLogs)
      .values({
        bookingId: data.bookingId,
        clientId: data.clientId,
        type: data.type,
        channel: data.channel,
        recipient: data.recipient,
        status: 'pending',
        referenceId: data.referenceId,
        metadata: data.metadata,
        retryCount: 0,
      })
      .returning({ id: notificationLogs.id });

    return inserted!.id;
  }

  private async markLogSent(logId: number, providerMessageId?: string): Promise<void> {
    await db
      .update(notificationLogs)
      .set({
        status: 'sent',
        providerMessageId: providerMessageId || null,
        errorMessage: null,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notificationLogs.id, logId));
  }

  private async markLogFailed(logId: number, errorMessage: string): Promise<void> {
    await db
      .update(notificationLogs)
      .set({
        status: 'failed',
        errorMessage,
        failedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notificationLogs.id, logId));
  }
}

export const notificationService = new NotificationService();
