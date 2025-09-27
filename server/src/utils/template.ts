import { readFileSync } from 'fs';
import { join } from 'path';

export interface InvoiceTemplateData {
  brandName: string;
  logoBase64: string;
  saudiRiyalSVGBase64: string;
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
    roomRate: string;
    lineTotal: string;
    notes?: string;
  }>;
  
  subtotal: string;
  taxAmount: string;
  serviceFee: string;
  grandTotal: string;
  paidAmount: string;
  balanceDue: string;
  
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
        // Handle @root references
        itemHtml = itemHtml.replace(/\{\{@root\.(\w+)\}\}/g, (rootMatch: string, rootKey: string) => {
          return data[rootKey] !== undefined ? String(data[rootKey]) : rootMatch;
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
   * Get Saudi Riyal SVG symbol as base64 string
   */
  static getSaudiRiyalSVGBase64(): string {
    try {
      // SVG content for Saudi Riyal Symbol
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1124.14 1256.39">
  <defs>
    <style>
      .cls-1 {
        fill: currentColor;
      }
    </style>
  </defs>
  <path class="cls-1" d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/>
  <path class="cls-1" d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/>
</svg>`;
      return Buffer.from(svgContent).toString('base64');
    } catch (error) {
      console.warn('Failed to generate Saudi Riyal SVG, using fallback');
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
   * Format currency amount (without currency symbol since SVG is used separately)
   */
  static formatCurrency(amount: number | string, currency: string = 'SAR'): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
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
    
    // Map legacy room type codes to readable names (for backward compatibility)
    // New room types will use their original names directly
    const roomTypeMap: { [key: string]: string } = {
      'DBL': 'Deluxe Double',
      'TPL': 'Triple',
      'Quad': 'Quad'
    };
    
    // Map booking items to invoice items and calculate totals
    let subtotalAmount = 0;
    const items = bookingItems.map(item => {
      const totalPrice = parseFloat(item.unitPrice) || 0; // unitPrice currently stores total amount
      const quantity = item.roomCount || 1;
      const roomRatePerNight = totalPrice / (quantity * totalNights); // Calculate actual room rate per night
      const lineTotal = totalPrice; // Use the stored total price directly
      subtotalAmount += lineTotal;
      
      return {
        roomType: roomTypeMap[item.roomType] || item.roomType || 'Standard Room',
        mealPlan: 'Room Only', // Default since not in current schema
        quantity,
        nights: totalNights,
        roomRate: this.formatCurrency(roomRatePerNight), // Show actual room rate per night
        lineTotal: this.formatCurrency(lineTotal),
        notes: '' // Default since not in current schema
      };
    });

    // Calculate totals
    const subtotal = subtotalAmount;
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
      saudiRiyalSVGBase64: this.getSaudiRiyalSVGBase64(),
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
      
      subtotal: this.formatCurrency(subtotal),
      taxAmount: this.formatCurrency(taxAmount),
      serviceFee: this.formatCurrency(serviceFee),
      grandTotal: this.formatCurrency(grandTotal),
      paidAmount: this.formatCurrency(paidAmount),
      balanceDue: this.formatCurrency(balanceDue),
      
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