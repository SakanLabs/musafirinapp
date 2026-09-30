import { eq } from 'drizzle-orm';
import { db } from '../db';
import { invoiceTermsSettings, type InvoiceTermsSetting, type NewInvoiceTermsSetting } from '../db/schema';

export interface DefaultInvoiceTermConfig {
  type: string;
  name: string;
  title: string;
  checkInTime: string;
  checkOutTime: string;
  terms: string[];
  notes?: string;
}

export const DEFAULT_INVOICE_TERMS: Record<string, DefaultInvoiceTermConfig> = {
  hotel: {
    type: 'hotel',
    name: 'Invoice Hotel & Booking Umum',
    title: 'Ketentuan Pemesanan',
    checkInTime: '16:00',
    checkOutTime: '12:00',
    terms: [
      'Pemesanan terkonfirmasi setelah Full Payment.',
      'Pembatalan: Pesanan ini tidak dapat di batalkan dan di refund.',
      'Check-in: {checkInTime} | Check-out: {checkOutTime}.',
      'Perubahan/permintaan khusus tergantung ketersediaan. Harga dapat berubah sebelum pelunasan.'
    ]
  },
  manual: {
    type: 'manual',
    name: 'Invoice Manual',
    title: 'Ketentuan Pemesanan',
    checkInTime: '16:00',
    checkOutTime: '12:00',
    terms: [
      'Pemesanan terkonfirmasi setelah pembayaran uang muka / termin disetujui sesuai kesepakatan.',
      'Pembatalan & Perubahan: Mengikuti ketentuan dan kebijakan layanan terkait yang telah disepakati.',
      'Pelunasan wajib diselesaikan paling lambat pada tanggal jatuh tempo yang tertera pada invoice.'
    ]
  },
  transportation: {
    type: 'transportation',
    name: 'Invoice Transportasi',
    title: 'Syarat & Ketentuan',
    checkInTime: '16:00',
    checkOutTime: '12:00',
    terms: [
      'Pemesanan transportasi terkonfirmasi setelah pembayaran diterima.',
      'Pembatalan: Mengikuti kebijakan operasional armada.',
      'Perubahan jadwal mohon konfirmasi maksimal 24 jam sebelum penjemputan.',
      'Kapasitas bagasi menyesuaikan jenis kendaraan yang dipesan.'
    ]
  },
  custom_la: {
    type: 'custom_la',
    name: 'Invoice Land Arrangement (LA)',
    title: 'Ketentuan Pemesanan LA',
    checkInTime: '16:00',
    checkOutTime: '12:00',
    terms: [
      'Pemesanan Land Arrangement terkonfirmasi setelah deposit / pembayaran disetujui sesuai invoice.',
      'Pembatalan & perubahan jadwal mengikuti regulasi otoritas Saudi serta kebijakan pihak hotel/transportasi.',
      'Pelunasan wajib diselesaikan paling lambat pada tanggal jatuh tempo yang telah disepakati.'
    ]
  },
  muthowif: {
    type: 'muthowif',
    name: 'Invoice Muthowif',
    title: 'Syarat & Ketentuan Layanan',
    checkInTime: '16:00',
    checkOutTime: '12:00',
    terms: [
      'Jadwal pendampingan Muthowif terkonfirmasi setelah pembayaran atau uang muka diterima.',
      'Perubahan jadwal mohon dikonfirmasikan paling lambat 24 jam sebelum waktu pelaksanaan kegiatan.',
      'Biaya akomodasi atau transportasi tambahan di luar paket menjadi tanggungan pihak pemesan.'
    ]
  }
};

// In-memory cache for fast PDF rendering
const cachedTerms = new Map<string, InvoiceTermsSetting>();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export class InvoiceTermsService {
  /**
   * Helper to get a guaranteed default fallback configuration
   */
  public static getFallback(type: string): DefaultInvoiceTermConfig {
    const key = (type || 'hotel').toLowerCase();
    return DEFAULT_INVOICE_TERMS[key] ?? DEFAULT_INVOICE_TERMS['hotel']!;
  }

  /**
   * Format array of terms string into clean HTML paragraph lines
   */
  public static formatTermsHtml(
    termsList: string[] = [],
    checkInTime: string = '16:00',
    checkOutTime: string = '12:00'
  ): string {
    if (!Array.isArray(termsList) || termsList.length === 0) {
      return '';
    }

    return termsList
      .map((rawTerm, idx) => {
        let text = (rawTerm || '').trim();
        if (!text) return '';

        // Replace dynamic variables if present
        text = text
          .replace(/\{checkInTime\}/g, checkInTime || '16:00')
          .replace(/\{checkOutTime\}/g, checkOutTime || '12:00');

        // Apply bolding to well-known phrases if not already tagged with HTML
        if (!text.includes('<span') && !text.includes('<strong>')) {
          text = text
            .replace(/\bterkonfirmasi\b/gi, '<span class="cs-font-semibold">terkonfirmasi</span>')
            .replace(/\bPembatalan & Perubahan:\b/gi, '<span class="cs-font-semibold">Pembatalan & Perubahan:</span>')
            .replace(/\bPembatalan:\b/gi, '<span class="cs-font-semibold">Pembatalan:</span>');
        }

        const isLast = idx === termsList.length - 1;
        const mbClass = isLast ? 'cs-mb-0' : 'cs-mb-1';
        return `<p class="${mbClass}">• ${text}</p>`;
      })
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Invalidate cache
   */
  public static clearCache(): void {
    cachedTerms.clear();
    cacheTimestamp = 0;
  }

  /**
   * Get all terms settings from DB or defaults
   */
  public static async getAll(): Promise<InvoiceTermsSetting[]> {
    try {
      const rows = await db.select().from(invoiceTermsSettings);
      if (rows.length > 0) {
        return rows;
      }
    } catch (err) {
      console.warn('Failed to query invoiceTermsSettings from DB, falling back to defaults:', err);
    }

    // Fallback to defaults converted to setting objects
    return Object.values(DEFAULT_INVOICE_TERMS).map((def, idx) => ({
      id: idx + 1,
      type: def.type,
      name: def.name,
      title: def.title,
      checkInTime: def.checkInTime || '16:00',
      checkOutTime: def.checkOutTime || '12:00',
      terms: def.terms,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Get terms setting by invoice type with fallback
   */
  public static async getByType(type: string): Promise<{
    title: string;
    checkInTime: string;
    checkOutTime: string;
    terms: string[];
    termsHtml: string;
    setting?: InvoiceTermsSetting;
  }> {
    const normalizedType = (type || 'hotel').toLowerCase();
    const now = Date.now();

    // Check cache
    if (now - cacheTimestamp < CACHE_TTL_MS && cachedTerms.has(normalizedType)) {
      const cached = cachedTerms.get(normalizedType)!;
      const termsArray = Array.isArray(cached.terms) ? (cached.terms as string[]) : [];
      return {
        title: cached.title || 'Ketentuan Pemesanan',
        checkInTime: cached.checkInTime || '16:00',
        checkOutTime: cached.checkOutTime || '12:00',
        terms: termsArray,
        termsHtml: this.formatTermsHtml(termsArray, cached.checkInTime || '16:00', cached.checkOutTime || '12:00'),
        setting: cached,
      };
    }

    let found: InvoiceTermsSetting | undefined;
    try {
      const rows = await db
        .select()
        .from(invoiceTermsSettings)
        .where(eq(invoiceTermsSettings.type, normalizedType))
        .limit(1);

      if (rows.length > 0 && rows[0]) {
        found = rows[0];
        cachedTerms.set(normalizedType, found);
        cacheTimestamp = now;
      }
    } catch (err) {
      console.warn(`Failed to fetch terms setting for ${normalizedType}:`, err);
    }

    if (found) {
      const termsArray = Array.isArray(found.terms) ? (found.terms as string[]) : [];
      return {
        title: found.title || 'Ketentuan Pemesanan',
        checkInTime: found.checkInTime || '16:00',
        checkOutTime: found.checkOutTime || '12:00',
        terms: termsArray,
        termsHtml: this.formatTermsHtml(termsArray, found.checkInTime || '16:00', found.checkOutTime || '12:00'),
        setting: found,
      };
    }

    // Default fallback
    const fallback = this.getFallback(normalizedType);
    return {
      title: fallback.title,
      checkInTime: fallback.checkInTime || '16:00',
      checkOutTime: fallback.checkOutTime || '12:00',
      terms: fallback.terms,
      termsHtml: this.formatTermsHtml(fallback.terms, fallback.checkInTime, fallback.checkOutTime),
    };
  }

  /**
   * Update or upsert terms setting for a type
   */
  public static async update(
    type: string,
    data: {
      name?: string;
      title?: string;
      checkInTime?: string;
      checkOutTime?: string;
      terms?: string[];
      notes?: string;
    }
  ): Promise<InvoiceTermsSetting> {
    const normalizedType = (type || 'hotel').toLowerCase();
    const fallback = this.getFallback(normalizedType);

    const existing = await db
      .select()
      .from(invoiceTermsSettings)
      .where(eq(invoiceTermsSettings.type, normalizedType))
      .limit(1);

    const updatePayload: Partial<NewInvoiceTermsSetting> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updatePayload.name = data.name.trim() || fallback.name;
    if (data.title !== undefined) updatePayload.title = data.title.trim() || fallback.title;
    if (data.checkInTime !== undefined) updatePayload.checkInTime = data.checkInTime.trim() || '16:00';
    if (data.checkOutTime !== undefined) updatePayload.checkOutTime = data.checkOutTime.trim() || '12:00';
    if (data.terms !== undefined && Array.isArray(data.terms)) {
      updatePayload.terms = data.terms.map(t => (t || '').trim()).filter(Boolean);
    }
    if (data.notes !== undefined) updatePayload.notes = data.notes ? data.notes.trim() : null;

    let result: InvoiceTermsSetting;

    if (existing.length > 0 && existing[0]) {
      const updatedList = await db
        .update(invoiceTermsSettings)
        .set(updatePayload)
        .where(eq(invoiceTermsSettings.type, normalizedType))
        .returning();
      if (!updatedList[0]) {
        throw new Error(`Failed to update invoice terms setting for ${normalizedType}`);
      }
      result = updatedList[0];
    } else {
      const insertPayload: NewInvoiceTermsSetting = {
        type: normalizedType,
        name: updatePayload.name || fallback.name,
        title: updatePayload.title || fallback.title,
        checkInTime: updatePayload.checkInTime || fallback.checkInTime || '16:00',
        checkOutTime: updatePayload.checkOutTime || fallback.checkOutTime || '12:00',
        terms: updatePayload.terms || fallback.terms,
        notes: updatePayload.notes || null,
      };
      const createdList = await db
        .insert(invoiceTermsSettings)
        .values(insertPayload)
        .returning();
      if (!createdList[0]) {
        throw new Error(`Failed to insert invoice terms setting for ${normalizedType}`);
      }
      result = createdList[0];
    }

    InvoiceTermsService.clearCache();
    return result;
  }

  /**
   * Reset a setting to factory default
   */
  public static async reset(type: string): Promise<InvoiceTermsSetting> {
    const normalizedType = (type || 'hotel').toLowerCase();
    const fallback = this.getFallback(normalizedType);

    const result = await this.update(normalizedType, {
      name: fallback.name,
      title: fallback.title,
      checkInTime: fallback.checkInTime,
      checkOutTime: fallback.checkOutTime,
      terms: fallback.terms,
      notes: fallback.notes || undefined,
    });

    InvoiceTermsService.clearCache();
    return result;
  }
}
