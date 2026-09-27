/**
 * Kirimdev.com WhatsApp API Client
 * Berdasarkan spesifikasi Kirimdev Public API v1 (OpenAPI 3.1)
 * Docs: https://api.kirimdev.com/v1/openapi.json
 */

const KIRIMDEV_BASE_URL = process.env.KIRIMDEV_BASE_URL || 'https://api.kirimdev.com/v1';

// Cache untuk phone_number_id agar tidak memanggil /v1/accounts berulang-ulang
let cachedPhoneNumberId: string | null = null;

/**
 * Normalisasi format nomor telepon ke format E.164 digit (tanpa tanda +, spasi, atau dash)
 * Contoh:
 * - 081234567890 -> 6281234567890
 * - +62812-3456-7890 -> 6281234567890
 * - 6281234567890 -> 6281234567890
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  // Hapus semua karakter non-digit
  let cleaned = phone.replace(/\D/g, '');

  // Jika diawali 08..., ganti 0 dengan 62
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Mendapatkan phone_number_id WhatsApp Business yang terhubung.
 * Jika diset di ENV (KIRIMDEV_PHONE_NUMBER_ID), gunakan itu.
 * Jika tidak, ambil otomatis dari GET /v1/accounts dan simpan di cache.
 */
export async function getPhoneNumberId(apiKey: string): Promise<string | null> {
  if (process.env.KIRIMDEV_PHONE_NUMBER_ID) {
    return process.env.KIRIMDEV_PHONE_NUMBER_ID.trim();
  }

  if (cachedPhoneNumberId) {
    return cachedPhoneNumberId;
  }

  try {
    const res = await fetch(`${KIRIMDEV_BASE_URL}/accounts?status=connected`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Kirimdev] Gagal mengambil accounts: ${res.status} ${errText}`);
      return null;
    }

    const data: any = await res.json();
    const accounts = data?.data || [];
    if (accounts.length === 0) {
      console.warn('[Kirimdev] Tidak ada akun WhatsApp yang terhubung (status=connected) di organisasi Anda.');
      return null;
    }

    // Ambil akun pertama yang memiliki phone_number_id
    const activeAccount = accounts.find((acc: any) => acc.phone_number_id);
    if (activeAccount && activeAccount.phone_number_id) {
      cachedPhoneNumberId = activeAccount.phone_number_id;
      console.log(`[Kirimdev] Menggunakan akun WhatsApp: ${activeAccount.phone_number || activeAccount.name} (ID: ${cachedPhoneNumberId})`);
      return cachedPhoneNumberId;
    }

    console.warn('[Kirimdev] Akun ditemukan tetapi belum memiliki phone_number_id.');
    return null;
  } catch (error) {
    console.error('[Kirimdev] Error saat memanggil /v1/accounts:', error);
    return null;
  }
}

export interface SendWhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Mengirim pesan WhatsApp teks menggunakan Kirimdev API v1
 * Endpoint: POST /v1/{phone_number_id}/messages
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<SendWhatsAppResponse> {
  const apiKey = process.env.KIRIMDEV_API_KEY;

  if (!apiKey) {
    console.warn('[Kirimdev] KIRIMDEV_API_KEY belum dikonfigurasi di environment (.env). Pengiriman dilewati.');
    return { success: false, error: 'KIRIMDEV_API_KEY not configured' };
  }

  const recipient = normalizePhoneNumber(to);
  if (!recipient) {
    console.warn('[Kirimdev] Nomor tujuan tidak valid:', to);
    return { success: false, error: 'Invalid recipient phone number' };
  }

  const phoneNumberId = await getPhoneNumberId(apiKey);
  if (!phoneNumberId) {
    console.error('[Kirimdev] phone_number_id tidak ditemukan. Pastikan akun WhatsApp sudah terhubung di dashboard Kirimdev.');
    return { success: false, error: 'No phone_number_id available' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: {
      body: message,
      preview_url: false,
    },
  };

  try {
    const res = await fetch(`${KIRIMDEV_BASE_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      console.error(`[Kirimdev] Gagal mengirim pesan ke ${recipient}:`, errMsg, data);
      return { success: false, error: errMsg };
    }

    const messageId = data?.data?.id || data?.data?.message_id;
    console.log(`[Kirimdev] Pesan WhatsApp berhasil dikirim ke ${recipient} (ID: ${messageId || 'OK'})`);
    return { success: true, messageId };
  } catch (error: any) {
    console.error(`[Kirimdev] Error koneksi saat mengirim pesan ke ${recipient}:`, error?.message || error);
    return { success: false, error: error?.message || 'Network error' };
  }
}

/**
 * Mengirim pesan WhatsApp ke nomor Admin yang terdaftar di ENV
 */
export async function sendWhatsAppToAdmin(message: string): Promise<SendWhatsAppResponse> {
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;

  if (!adminPhone) {
    console.warn('[Kirimdev] ADMIN_WHATSAPP_NUMBER belum diisi di .env. Notifikasi WA admin dilewati.');
    return { success: false, error: 'ADMIN_WHATSAPP_NUMBER not set' };
  }

  return sendWhatsAppMessage(adminPhone, message);
}
