import { readFileSync } from 'fs';
import { join } from 'path';

export interface InvoiceTemplateData {
  brandName: string;
  logoBase64: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  
  hotelName: string;
  hotelAddress: string;
  guest: {
    name: string;
    email: string;
    phone: string;
  };
  
  checkIn: string;
  checkOut: string;
  totalNights: number;
  currency: string;
  
  items: Array<{
    roomType: string;
    mealPlan: string;
    quantity: number;
    nights: number;
    roomRate: number;
    lineTotal: number;
    notes?: string;
  }>;
  
  subtotal: number;
  taxAmount: number;
  serviceFee: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  
  payments: Array<{
    method: string;
    date: string;
    transactionId: string;
    amount: number;
  }>;
  
  bank: {
    bankName: string;
    bankCountry: string;
    accountName: string;
    accountNumberOrIBAN: string;
    swift: string;
  };
  
  billingContact: {
    email: string;
    phone: string;
  };
  
  terms: {
    downPaymentPercent: number;
    settlementDeadline: string;
    cancellationPolicy: string;
    policyCheckInTime: string;
    policyCheckOutTime: string;
  };
  
  notes?: string;
}

export interface VoucherTemplateData {
  voucherNumber: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  bookingCode: string;
  issueDate: string;
  hotelName: string;
  city: string;
  checkInDate: string;
  checkOutDate: string;
  duration: number;
  totalAmount: string;
  currency: string;
  rooms: Array<{
    roomType: string;
    roomCount: number;
  }>;
  qrCodeDataURL: string;
}

/**
 * Simple template engine for replacing placeholders in HTML templates
 */
export class TemplateEngine {
  private static instance: TemplateEngine;
  private templateCache: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): TemplateEngine {
    if (!TemplateEngine.instance) {
      TemplateEngine.instance = new TemplateEngine();
    }
    return TemplateEngine.instance;
  }

  /**
   * Load template from file system
   */
  private loadTemplate(templateName: string): string {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    try {
      const templatePath = join(__dirname, '..', 'templates', `${templateName}.html`);
      const template = readFileSync(templatePath, 'utf-8');
      this.templateCache.set(templateName, template);
      return template;
    } catch (error) {
      throw new Error(`Failed to load template: ${templateName}. Error: ${error}`);
    }
  }

  /**
   * Replace placeholders in template with actual data
   */
  private replacePlaceholders(template: string, data: any): string {
    let result = template;

    // Handle simple placeholders {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });

    // Handle conditional blocks {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
      return data[key] ? content : '';
    });

    // Handle each loops {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, key, itemTemplate) => {
      const array = data[key];
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map(item => {
        let itemHtml = itemTemplate;
        // Replace placeholders within the loop
        itemHtml = itemHtml.replace(/\{\{(\w+)\}\}/g, (itemMatch: string, itemKey: string) => {
          return item[itemKey] !== undefined ? String(item[itemKey]) : itemMatch;
        });
        return itemHtml;
      }).join('');
    });

    // Handle nested property access {{object.property}}
    result = result.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, objKey, propKey) => {
      const obj = data[objKey];
      if (obj && obj[propKey] !== undefined) {
        return String(obj[propKey]);
      }
      return match;
    });

    // Handle deeper nested property access {{object.property.subproperty}}
    result = result.replace(/\{\{(\w+)\.(\w+)\.(\w+)\}\}/g, (match, objKey, propKey, subPropKey) => {
      const obj = data[objKey];
      if (obj && obj[propKey] && obj[propKey][subPropKey] !== undefined) {
        return String(obj[propKey][subPropKey]);
      }
      return match;
    });

    return result;
  }

  /**
   * Render invoice template with data
   */
  public renderInvoice(data: InvoiceTemplateData): string {
    const template = this.loadTemplate('invoice');
    return this.replacePlaceholders(template, data);
  }

  /**
   * Render voucher template with data
   */
  public renderVoucher(data: VoucherTemplateData): string {
    const template = this.loadTemplate('voucher');
    return this.replacePlaceholders(template, data);
  }

  /**
   * Clear template cache (useful for development)
   */
  public clearCache(): void {
    this.templateCache.clear();
  }
}

/**
 * Helper functions for formatting data
 */
export class TemplateHelpers {
  /**
   * Get logo as base64 string
   */
  static getLogoBase64(): string {
    try {
      const logoPath = join(__dirname, '..', 'templates', 'logomusafirin.png');
      const logoBuffer = readFileSync(logoPath);
      return logoBuffer.toString('base64');
    } catch (error) {
      console.warn('Logo file not found, using empty string');
      return '';
    }
  }

  /**
   * Format date to readable string
   */
  static formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Format currency amount
   */
  static formatCurrency(amount: number | string, currency: string = 'SAR'): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toFixed(2)} ${currency}`;
  }

  /**
   * Calculate duration between two dates
   */
  static calculateDuration(checkIn: Date | string, checkOut: Date | string): number {
    const start = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
    const end = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Generate payment terms text
   */
  static getPaymentTerms(dueDate: Date | string): string {
    const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays}` : '0';
  }

  /**
   * Prepare invoice data for template
   */
  static prepareInvoiceData(
    invoice: any,
    booking: any,
    client: any,
    bookingItems: any[],
    customDueDate: Date | string,
    customInvoiceDate?: Date | string
  ): InvoiceTemplateData {
    const checkInDate = this.formatDate(booking.checkIn);
    const checkOutDate = this.formatDate(booking.checkOut);
    const totalNights = this.calculateDuration(booking.checkIn, booking.checkOut);
    
    // Map room types to readable names
    const roomTypeMap: { [key: string]: string } = {
      'DBL': 'Deluxe Double',
      'TPL': 'Triple',
      'Quad': 'Quad'
    };
    
    // Map booking items to invoice items
    const items = bookingItems.map(item => {
      const roomRate = parseFloat(item.unitPrice) || 0;
      const quantity = item.roomCount || 1;
      const lineTotal = roomRate * quantity * totalNights;
      
      return {
        roomType: roomTypeMap[item.roomType] || item.roomType || 'Standard Room',
        mealPlan: 'Room Only', // Default since not in current schema
        quantity,
        nights: totalNights,
        roomRate,
        lineTotal,
        notes: '' // Default since not in current schema
      };
    });

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxAmount = 0; // Default to 0, can be calculated based on business rules
    const serviceFee = 0; // Default to 0, can be calculated based on business rules
    const grandTotal = subtotal + taxAmount + serviceFee;
    
    // Process payments from booking meta or create default based on payment status
    let payments: any[] = [];
    let paidAmount = 0;
    
    // Check if payments exist in booking meta
    if (booking.meta && booking.meta.payments) {
      payments = booking.meta.payments.map((p: any) => ({
        method: p.method || 'Bank Transfer',
        date: this.formatDate(p.date || new Date()),
        transactionId: p.transactionId || '',
        amount: parseFloat(p.amount) || 0
      }));
      paidAmount = payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
    } else {
      // Create default payment based on payment status
      if (booking.paymentStatus === 'paid') {
        paidAmount = grandTotal;
        payments = [{
          method: 'Bank Transfer',
          date: this.formatDate(new Date()),
          transactionId: 'TRX-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          amount: grandTotal
        }];
      } else if (booking.paymentStatus === 'partial') {
        paidAmount = grandTotal * 0.3; // 30% down payment
        payments = [{
          method: 'Bank Transfer',
          date: this.formatDate(new Date()),
          transactionId: 'TRX-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          amount: paidAmount
        }];
      }
    }
    
    const balanceDue = grandTotal - paidAmount;

    // Determine hotel address based on city
    const hotelAddress = booking.city === 'Makkah' 
      ? 'Central Area, Makkah, Saudi Arabia'
      : 'Central Area, Madinah, Saudi Arabia';

    return {
      brandName: "Musafirin",
      logoBase64: this.getLogoBase64(),
      invoiceNo: invoice.number,
      invoiceDate: this.formatDate(customInvoiceDate || invoice.createdAt || new Date()),
      dueDate: this.formatDate(customDueDate),
      
      hotelName: booking.hotelName || 'Hotel Name',
      hotelAddress,
      guest: {
        name: client.name,
        email: client.email,
        phone: client.phone || ''
      },
      
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalNights,
      currency: invoice.currency || 'SAR',
      
      items,
      
      subtotal,
      taxAmount,
      serviceFee,
      grandTotal,
      paidAmount,
      balanceDue,
      
      payments,
      
      bank: {
        bankName: "Bank Syariah Indonesia",
        bankCountry: "Indonesia",
        accountName: "PT. Thalhah Insan Rabbani",
        accountNumberOrIBAN: "7254459741",
        swift: ""
      },
      
      billingContact: {
        email: "hotel@musafirin.co",
        phone: "+6281235623973"
      },
      
      terms: {
        downPaymentPercent: 30,
        settlementDeadline: this.formatDate(customDueDate),
        cancellationPolicy: "Pembatalan ≤ 7 hari sebelum check-in dikenakan 1 malam; ≤ 72 jam non-refundable, mengikuti kebijakan hotel.",
        policyCheckInTime: "15:00",
        policyCheckOutTime: "12:00"
      },
      
      notes: "Harap bawa ID saat check-in."
    };
  }

  /**
   * Prepare voucher data for template
   */
  static prepareVoucherData(
    voucher: any,
    booking: any,
    client: any,
    bookingItems: any[],
    qrCodeDataURL: string
  ): VoucherTemplateData {
    const checkInDate = this.formatDate(booking.checkIn);
    const checkOutDate = this.formatDate(booking.checkOut);
    const duration = this.calculateDuration(booking.checkIn, booking.checkOut);

    // Group rooms by type
    const roomsMap = new Map<string, number>();
    bookingItems.forEach(item => {
      const current = roomsMap.get(item.roomType) || 0;
      roomsMap.set(item.roomType, current + item.roomCount);
    });

    const rooms = Array.from(roomsMap.entries()).map(([roomType, roomCount]) => ({
      roomType,
      roomCount
    }));

    return {
      voucherNumber: voucher.number,
      guestName: voucher.guestName || client.name,
      guestEmail: client.email,
      guestPhone: client.phone,
      bookingCode: booking.code,
      issueDate: this.formatDate(voucher.createdAt),
      hotelName: booking.hotelName,
      city: booking.city,
      checkInDate,
      checkOutDate,
      duration,
      totalAmount: this.formatCurrency(booking.totalAmount, 'SAR'),
      currency: 'SAR',
      rooms,
      qrCodeDataURL
    };
  }
}

// Export singleton instance
export const templateEngine = TemplateEngine.getInstance();