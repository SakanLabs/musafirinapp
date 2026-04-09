import { db } from '../db';
import { receipts, bookings, clients, invoices, bookingItems, invoicePayments } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateReceiptPDF } from '../utils/pdf';
import { generateReceiptNumber } from '../utils/pdf';
import type { Receipt, NewReceipt } from '../db/schema';

interface ReceiptTemplateData {
  receipt: {
    number: string;
    issueDate: string;
    totalAmount: string;
    paidAmount: string;
    balanceDue: string;
    currency: string;
    amountInWords: string | null;
    notes: string | null;
  };
  booking: {
    code: string;
    hotelName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    city: string;
    mealPlan: string;
    roomSummary?: string; // e.g. "1 Quad Standard Full Board"
  };
  client: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  payer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  hotel: {
    name: string;
    address: string;
  };
  bank: {
    name: string;
    country: string;
    accountName: string;
    accountNumber: string;
  };
  brand: {
    name: string;
    tagline: string;
    website: string;
  };
}

export class ReceiptService {
  async generateReceiptForBooking(bookingId: number): Promise<Receipt | null> {
    try {
      // Check if receipt already exists
      const existingReceipt = await db
        .select()
        .from(receipts)
        .where(eq(receipts.bookingId, bookingId))
        .limit(1);

      if (existingReceipt.length > 0) {
        console.log(`Receipt already exists for booking ${bookingId}`);
        return existingReceipt[0] || null;
      }

      // Get booking data with client
      const bookingData = await this.getBookingWithClient(bookingId);
      if (!bookingData) {
        throw new Error(`Booking ${bookingId} not found or incomplete data`);
      }

      const { booking, client } = bookingData;

      // Get invoice data if exists
      const invoiceData = await this.getInvoiceForBooking(bookingId);

      // Generate receipt number
      const receiptNumber = generateReceiptNumber();

      // Calculate amounts
      const totalAmount = booking.totalAmount;
      const paidAmount = this.calculatePaidAmount(booking);
      const balanceDue = (parseFloat(totalAmount) - parseFloat(paidAmount)).toFixed(2);

      // Prepare receipt data
      const newReceipt: NewReceipt = {
        number: receiptNumber,
        bookingId: booking.id,
        invoiceId: invoiceData?.id || null,
        totalAmount,
        paidAmount,
        balanceDue,
        currency: 'IDR',
        issueDate: new Date(),
        payerName: client?.name || '',
        payerEmail: client?.email || null,
        payerPhone: client?.phone || null,
        payerAddress: client?.address || null,
        hotelName: booking.hotelName,
        hotelAddress: null,
        bankName: 'Bank Syariah Indonesia',
        bankCountry: 'Indonesia',
        accountName: 'PT Thalhah Insan Rabbani',
        accountNumberOrIBAN: '7254459741',
        notes: null,
        amountInWords: null,
        pdfUrl: null,
        meta: {},
      };

      // Insert receipt
      const insertedReceipt = await db.insert(receipts).values(newReceipt).returning();

      if (insertedReceipt.length === 0 || !insertedReceipt[0]) {
        throw new Error('Failed to create receipt');
      }

      const receipt = insertedReceipt[0];

      // Generate PDF
      const receiptData = await this.prepareReceiptData(receipt.id);
      if (receiptData) {
        const pdfUrl = await generateReceiptPDF(receiptData);

        // Update receipt with PDF URL
        const updatedReceipts = await db
          .update(receipts)
          .set({ pdfUrl })
          .where(eq(receipts.id, receipt.id))
          .returning();

        if (updatedReceipts.length > 0) {
          Object.assign(receipt, updatedReceipts[0]);
        } else {
          receipt.pdfUrl = pdfUrl;
        }
      }

      console.log(`Receipt ${receiptNumber} generated successfully for booking ${bookingId}`);
      return receipt;

    } catch (error) {
      console.error('Error generating receipt:', error);
      throw error;
    }
  }

  // NEW: Generate a receipt for a specific invoice payment (partial payments)
  async generateReceiptForInvoicePayment(
    invoiceId: number,
    payment: { amount: number; method: string; referenceNumber?: string; paidAt?: Date; description?: string }
  ): Promise<Receipt | null> {
    try {
      // Fetch invoice
      const invoiceRows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);
      if (invoiceRows.length === 0) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }
      const invoice = invoiceRows[0]!;

      // Get booking and client
      const bookingData = await this.getBookingWithClient(invoice.bookingId as number);
      if (!bookingData || !bookingData.client) {
        throw new Error(`Booking ${invoice.bookingId} not found or incomplete data`);
      }
      const { booking, client } = bookingData;

      // Sum completed payments for this invoice to compute remaining balance AFTER this payment
      const paymentsRows = await db
        .select()
        .from(invoicePayments)
        .where(eq(invoicePayments.invoiceId, invoiceId));
      const totalPaid = paymentsRows
        .filter((p: any) => String(p.status) === 'completed')
        .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

      const totalAmountNum = parseFloat(invoice.amount as any);
      const balanceAfter = Math.max(totalAmountNum - totalPaid, 0);

      const totalAmountStr = invoice.amount != null ? String(invoice.amount) : '0.00';
      const balanceAfterStr = balanceAfter.toFixed(2);

      // Create receipt with per-payment amount
      const receiptNumber = generateReceiptNumber();
      const newReceipt: NewReceipt = {
        number: receiptNumber,
        bookingId: booking.id,
        invoiceId: invoice.id,
        totalAmount: totalAmountStr,
        paidAmount: payment.amount.toFixed(2),
        balanceDue: balanceAfterStr,
        currency: invoice.currency || 'SAR',
        issueDate: payment.paidAt || new Date(),
        payerName: client?.name || '',
        payerEmail: client?.email || null,
        payerPhone: client?.phone || null,
        payerAddress: client?.address || null,
        hotelName: booking.hotelName,
        hotelAddress: null,
        bankName: 'Bank Syariah Indonesia',
        bankCountry: 'Indonesia',
        accountName: 'PT Thalhah Insan Rabbani',
        accountNumberOrIBAN: '7254459741',
        notes: payment.description || null,
        amountInWords: null,
        pdfUrl: null,
        meta: {
          payment: {
            method: payment.method,
            referenceNumber: payment.referenceNumber || null,
            paidAt: (payment.paidAt || new Date()).toISOString(),
            description: payment.description || null,
          },
        },
      };

      const inserted = await db.insert(receipts).values(newReceipt).returning();
      if (inserted.length === 0 || !inserted[0]) {
        throw new Error('Failed to create receipt for payment');
      }
      const created = inserted[0]!;

      // Prepare template data and generate PDF
      try {
        const receiptData = await this.prepareReceiptData(created.id);
        if (receiptData) {
          const pdfUrl = await generateReceiptPDF(receiptData);
          const updated = await db
            .update(receipts)
            .set({ pdfUrl })
            .where(eq(receipts.id, created.id))
            .returning();
          if (updated.length > 0) {
            Object.assign(created, updated[0]!);
          } else {
            created.pdfUrl = pdfUrl;
          }
        }
      } catch (pdfError) {
        console.error('Non-fatal error generating PDF for receipt:', pdfError);
      }

      return created;
    } catch (error) {
      console.error('Error generating per-payment receipt:', error);
      throw error;
    }
  }

  async getReceiptsByBooking(bookingId: number): Promise<Receipt[]> {
    return await db
      .select()
      .from(receipts)
      .where(eq(receipts.bookingId, bookingId))
      .orderBy(desc(receipts.createdAt));
  }

  async getAllReceipts(): Promise<Receipt[]> {
    return await db
      .select()
      .from(receipts)
      .orderBy(desc(receipts.createdAt));
  }

  async getReceiptById(receiptId: number): Promise<Receipt | null> {
    const result = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, receiptId))
      .limit(1);
    return result[0] ?? null;
  }

  private async getBookingWithClient(bookingId: number) {
    const result = await db
      .select({
        booking: bookings,
        client: clients,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  private async getInvoiceForBooking(bookingId: number) {
    const result = await db
      .select()
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .limit(1);

    return result[0] ?? null;
  }

  private calculatePaidAmount(booking: any): string {
    if (!booking.meta || !booking.meta.payments || !Array.isArray(booking.meta.payments)) {
      return '0.00';
    }

    const totalPaid = booking.meta.payments.reduce((sum: number, payment: any) => {
      return sum + (parseFloat(payment.amount) || 0);
    }, 0);

    return totalPaid.toFixed(2);
  }

  async prepareReceiptData(receiptId: number): Promise<ReceiptTemplateData | null> {
    try {
      const receipt = await this.getReceiptById(receiptId);
      if (!receipt) {
        return null;
      }

      const bookingData = await this.getBookingWithClient(receipt.bookingId);
      if (!bookingData || !bookingData.client) {
        return null;
      }

      const { booking, client } = bookingData;

      // Calculate nights
      const checkInDate = new Date(booking.checkIn);
      const checkOutDate = new Date(booking.checkOut);
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

      // Fetch booking items to build room summary
      const items = await db
        .select()
        .from(bookingItems)
        .where(eq(bookingItems.bookingId, booking.id));
      const roomSummary = items && items.length > 0
        ? items.map((it: any) => `${it.roomCount} ${it.roomType} ${booking.mealPlan}`).join(', ')
        : undefined;

      // Use stored receipt amounts (supports per-payment receipts)
      return {
        receipt: {
          number: receipt.number,
          issueDate: receipt.issueDate.toLocaleDateString('id-ID'),
          totalAmount: receipt.totalAmount,
          paidAmount: receipt.paidAmount,
          balanceDue: receipt.balanceDue,
          currency: receipt.currency,
          amountInWords: receipt.amountInWords,
          notes: receipt.notes,
        },
        booking: {
          code: booking.code,
          hotelName: booking.hotelName,
          checkIn: checkInDate.toLocaleDateString('id-ID'),
          checkOut: checkOutDate.toLocaleDateString('id-ID'),
          nights,
          city: booking.city,
          mealPlan: booking.mealPlan,
          roomSummary,
        },
        client: {
          name: client?.name || '',
          email: client?.email || '',
          phone: client?.phone || '',
          address: client?.address || '',
        },
        payer: {
          name: receipt.payerName,
          email: receipt.payerEmail || '',
          phone: receipt.payerPhone || '',
          address: receipt.payerAddress || '',
        },
        hotel: {
          name: receipt.hotelName,
          address: receipt.hotelAddress || '',
        },
        bank: {
          name: receipt.bankName || '',
          country: receipt.bankCountry || '',
          accountName: receipt.accountName || '',
          accountNumber: receipt.accountNumberOrIBAN || '',
        },
        brand: {
          name: 'Poppy Ayu',
          tagline: 'Your Trusted Travel Partner',
          website: 'www.musafirin.com',
        },
      };
    } catch (error) {
      console.error('Error preparing receipt data:', error);
      return null;
    }
  }
}

export const receiptService = new ReceiptService();