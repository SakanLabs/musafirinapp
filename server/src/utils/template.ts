import { readFileSync } from 'fs';
import { join } from 'path';

export interface InvoiceTemplateData {
  brandName: string;
  logoBase64: string;
  saudiRiyalSVGBase64: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  templateName?: string;

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
  mealPlanLabel: string;

  items: Array<{
    roomType: string;
    mealPlan: string;
    quantity: number;
    nights: number;
    roomRate: string;
    lineTotal: string;
    // For combined template custom display
    productName?: string;
    detailText?: string;
    nightsDisplay?: string; // "Variable" | "-" | number as string
    unitPriceVariable?: boolean; // true -> show "Variable" in template
    notes?: string;
    hasPricingPeriods?: boolean;
    pricingPeriods?: Array<{
      startDate: string;
      endDate: string;
      nights: number;
      pricePerNight: string;
      subtotal: string;
    }>;
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
  roomsDetail: Array<{
    roomType: string;
    mealPlan: string;
    quantity: number;
    remarks: string;
    hasPricingPeriods?: boolean;
    pricingPeriods?: Array<{
      startDate: string;
      endDate: string;
      nights: number;
      pricePerNight: string;
    }>;
  }>;
  qrCodeDataURL: string;
}

/**
 * Simple template engine for replacing placeholders in HTML templates
 */
export class TemplateEngine {
  private static instance: TemplateEngine;
  private templateCache: Map<string, string> = new Map();

  private constructor() { }

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
   * Find the matching {{/each}} for a {{#each}} block, accounting for nesting.
   * Returns the index of the start of the matching {{/each}} tag,
   * or -1 if not found.
   */
  private findMatchingEachClose(template: string, startAfter: number): number {
    let depth = 1;
    let pos = startAfter;

    while (pos < template.length && depth > 0) {
      const nextOpen = template.indexOf('{{#each ', pos);
      const nextClose = template.indexOf('{{/each}}', pos);

      if (nextClose === -1) {
        // No closing tag found
        return -1;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Found a nested {{#each}} before the next {{/each}}
        depth++;
        pos = nextOpen + 8; // skip past "{{#each "
      } else {
        // Found {{/each}}
        depth--;
        if (depth === 0) {
          return nextClose;
        }
        pos = nextClose + 9; // skip past "{{/each}}"
      }
    }

    return -1;
  }

  /**
   * Process a single item template within a loop iteration.
   * Handles nested {{#each}}, {{#if}}/{{else}}, placeholders, and @root references.
   */
  private processItemTemplate(itemHtml: string, item: any, rootData: any): string {
    // 1. Recursively process nested {{#each}} blocks first
    itemHtml = this.processEachBlocks(itemHtml, item, rootData);

    // 2. Handle else blocks {{#if variable}}...{{else}}...{{/if}}
    itemHtml = itemHtml.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (condMatch: string, condKey: string, ifContent: string, elseContent: string) => {
      return item[condKey] ? ifContent : elseContent;
    });

    // 3. Handle conditional blocks without else {{#if variable}}...{{/if}}
    itemHtml = itemHtml.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (condMatch: string, condKey: string, condContent: string) => {
      return item[condKey] ? condContent : '';
    });

    // 4. Handle @root references (before item-level placeholders)
    itemHtml = itemHtml.replace(/\{\{@root\.(\w+)\}\}/g, (rootMatch: string, rootKey: string) => {
      return rootData[rootKey] !== undefined ? String(rootData[rootKey]) : rootMatch;
    });

    // 5. Replace item-level placeholders {{variable}}
    itemHtml = itemHtml.replace(/\{\{(\w+)\}\}/g, (itemMatch: string, itemKey: string) => {
      const value = item[itemKey];
      if (value !== undefined && value !== null) {
        return String(value);
      }
      return itemMatch;
    });

    return itemHtml;
  }

  /**
   * Process all {{#each}} blocks in the template, with support for nesting.
   * Uses depth-counting to find matching {{#each}}/{{/each}} pairs.
   */
  private processEachBlocks(template: string, data: any, rootData?: any): string {
    const root = rootData || data;
    let result = '';
    let pos = 0;

    while (pos < template.length) {
      const eachOpenStart = template.indexOf('{{#each ', pos);

      if (eachOpenStart === -1) {
        // No more {{#each}} blocks, append the rest
        result += template.substring(pos);
        break;
      }

      // Append everything before this {{#each}}
      result += template.substring(pos, eachOpenStart);

      // Find the end of the opening tag: {{#each key}}
      const eachOpenEnd = template.indexOf('}}', eachOpenStart);
      if (eachOpenEnd === -1) {
        // Malformed tag, append as-is
        result += template.substring(eachOpenStart);
        break;
      }

      // Extract the array key
      const key = template.substring(eachOpenStart + 8, eachOpenEnd).trim();
      const bodyStart = eachOpenEnd + 2;

      // Find the matching {{/each}}
      const closeStart = this.findMatchingEachClose(template, bodyStart);
      if (closeStart === -1) {
        // No matching close, append as-is
        result += template.substring(eachOpenStart);
        break;
      }

      const itemTemplate = template.substring(bodyStart, closeStart);
      const array = data[key];

      if (Array.isArray(array)) {
        result += array.map(item => {
          return this.processItemTemplate(itemTemplate, item, root);
        }).join('');
      }
      // else: array is not found or not an array -> output nothing

      pos = closeStart + 9; // skip past "{{/each}}"
    }

    return result;
  }

  /**
   * Replace placeholders in template with actual data
   */
  private replacePlaceholders(template: string, data: any): string {
    let result = template;

    // Handle simple placeholders {{variable}} (top-level only, before loops)
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      if (value !== undefined && value !== null) {
        return String(value);
      }
      return match;
    });

    // Handle each loops with proper nesting support
    result = this.processEachBlocks(result, data);

    // Handle top-level conditional blocks {{#if variable}}...{{/if}} (no else)
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
      return data[key] ? content : '';
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
  public renderInvoice(data: InvoiceTemplateData & { templateName?: string }): string {
    // Use templateName from data if available, otherwise default to 'invoice'
    const templateName = data.templateName ? data.templateName.replace('.html', '') : 'invoice';
    const template = this.loadTemplate(templateName);
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
  static formatCurrency(amount: number | string | null | undefined, currency: string = 'SAR'): string {
    if (amount === null || amount === undefined || amount === '') {
      return '0.00';
    }

    const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    const validAmount = isNaN(numAmount) ? 0 : numAmount;

    return validAmount.toFixed(2);
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
    customInvoiceDate?: Date | string,
    extraServiceItems: any[] = []
  ): InvoiceTemplateData {
    const checkInDate = this.formatDate(booking.checkIn);
    const checkOutDate = this.formatDate(booking.checkOut);
    const totalNights = this.calculateDuration(booking.checkIn, booking.checkOut);
    const mealPlanLabel = this.formatMealPlan(booking.mealPlan);

    // Map legacy room type codes to readable names (for backward compatibility)
    // New room types will use their original names directly
    const roomTypeMap: { [key: string]: string } = {
      'DBL': 'Deluxe Double',
      'TPL': 'Triple',
      'Quad': 'Quad'
    };

    // Map booking items to invoice items and calculate totals
    let subtotalAmount = 0;
    const items = bookingItems.map((item) => {
      const quantity = item.roomCount || 1;
      let lineTotal = 0;
      let roomRatePerNight = 0;
      let pricingPeriods: any[] = [];

      if (item.hasPricingPeriods && item.pricingPeriods && item.pricingPeriods.length > 0) {
        console.log('Processing item with pricing periods:', {
          roomType: item.roomType,
          pricingPeriodsCount: item.pricingPeriods.length
        });

        // Item has pricing periods - use them for calculations
        pricingPeriods = item.pricingPeriods.map((period: any) => {
          const unitPrice = typeof period.unitPrice === 'string'
            ? parseFloat(period.unitPrice)
            : Number(period.unitPrice);
          const periodSubtotal = typeof period.subtotal === 'string'
            ? parseFloat(period.subtotal)
            : Number(period.subtotal);

          lineTotal += periodSubtotal;

          return {
            startDate: this.formatDate(period.startDate),
            endDate: this.formatDate(period.endDate),
            nights: period.nights || 0,
            pricePerNight: TemplateHelpers.formatCurrency(unitPrice),
            subtotal: TemplateHelpers.formatCurrency(periodSubtotal)
          };
        });

        // For pricing periods, roomRate is shown as "Variable" in template
        roomRatePerNight = 0; // Not used when hasPricingPeriods is true
      } else {
        console.log('Processing item without pricing periods:', {
          roomType: item.roomType,
          unitPrice: item.unitPrice,
          unitPriceType: typeof item.unitPrice,
          quantity,
          totalNights,
          hasPricingPeriods: item.hasPricingPeriods
        });

        const unitPriceValue = typeof item.unitPrice === 'string'
          ? parseFloat(item.unitPrice)
          : Number(item.unitPrice);
        const unitPrice = isNaN(unitPriceValue) ? 0 : unitPriceValue;

        roomRatePerNight = unitPrice;
        lineTotal = unitPrice * quantity * totalNights;

        console.log('Calculated values for non-pricing-period item:', {
          unitPriceValue,
          unitPrice,
          roomRatePerNight,
          lineTotal,
          calculation: `${unitPrice} × ${quantity} × ${totalNights} = ${lineTotal}`,
          isValidCalculation: !isNaN(lineTotal) && lineTotal > 0
        });
      }

      subtotalAmount += lineTotal;

      const formattedRoomRate = TemplateHelpers.formatCurrency(roomRatePerNight) || '0.00';
      const formattedLineTotal = TemplateHelpers.formatCurrency(lineTotal) || '0.00';

      console.log('Creating finalItem with hasPricingPeriods:', {
        itemHasPricingPeriods: item.hasPricingPeriods,
        itemHasPricingPeriodsType: typeof item.hasPricingPeriods,
        pricingPeriodsLength: item.pricingPeriods?.length || 0,
        finalHasPricingPeriods: item.hasPricingPeriods || false
      });

      const finalItem = {
        roomType: roomTypeMap[item.roomType] || item.roomType || 'Standard Room',
        mealPlan: this.formatMealPlan(booking.mealPlan) || 'No Meal',
        quantity: quantity || 1,
        nights: totalNights || 0,
        roomRate: formattedRoomRate,
        lineTotal: formattedLineTotal,
        // Business rules for combined invoice display
        productName: booking.hotelName || 'Hotel',
        detailText: `${roomTypeMap[item.roomType] || item.roomType} • ${this.formatDate(booking.checkIn)} - ${this.formatDate(booking.checkOut)}`,
        nightsDisplay: (item.hasPricingPeriods ? 'Variable' : String(totalNights || 0)),
        unitPriceVariable: !!item.hasPricingPeriods,
        hasPricingPeriods: item.hasPricingPeriods || false,
        pricingPeriods: pricingPeriods || []
      };

      console.log('Final item data sent to template:', {
        roomType: finalItem.roomType,
        roomRate: finalItem.roomRate,
        lineTotal: finalItem.lineTotal,
        hasPricingPeriods: finalItem.hasPricingPeriods,
        quantity: finalItem.quantity,
        nights: finalItem.nights,
        pricingPeriodsCount: finalItem.pricingPeriods.length
      });

      return finalItem;
    });

    // Append extra service items (e.g., Visa Umrah, Transportation) to invoice items
    const serviceTypeLabelMap: Record<string, string> = {
      visa_umrah: 'Visa Umrah',
      transportasi: 'Transportation/Bus Full Trip',
      other: 'Other Service',
    };
    const mappedServiceItems = (extraServiceItems || []).map((sItem: any, idx: number) => {
      const qty = sItem.quantity || 1;
      const unitPriceVal = typeof sItem.unitPrice === 'string' ? parseFloat(sItem.unitPrice) : Number(sItem.unitPrice);
      const subtotalVal = typeof sItem.subtotal === 'string' ? parseFloat(sItem.subtotal) : Number(sItem.subtotal);
      const lineTotal = isNaN(subtotalVal) ? qty * (isNaN(unitPriceVal) ? 0 : unitPriceVal) : subtotalVal;
      subtotalAmount += lineTotal;
      const isVisaUmrah = sItem.serviceType === 'visa_umrah';
      const isTransportasi = sItem.serviceType === 'transportasi';
      const productName = isVisaUmrah
        ? 'Visa Umrah'
        : isTransportasi
          ? (sItem.meta?.vehicleType || 'Transportasi')
          : (serviceTypeLabelMap[sItem.serviceType] || 'Service');
      const detailText = isVisaUmrah
        ? 'Visa Umrah'
        : isTransportasi
          ? (sItem.meta?.route || sItem.description || '-')
          : (sItem.description || '-');
      console.log('Mapping extra service item to invoice row:', {
        index: idx,
        raw: sItem,
        qty,
        unitPriceVal,
        subtotalVal,
        computedLineTotal: lineTotal,
        productName,
        detailText,
        isVisaUmrah,
        isTransportasi
      });
      return {
        roomType: serviceTypeLabelMap[sItem.serviceType] || sItem.serviceType || 'Service',
        mealPlan: '-',
        quantity: qty,
        nights: 0,
        roomRate: TemplateHelpers.formatCurrency(unitPriceVal),
        lineTotal: TemplateHelpers.formatCurrency(lineTotal),
        productName,
        detailText,
        nightsDisplay: '-',
        unitPriceVariable: false,
        hasPricingPeriods: false,
        pricingPeriods: []
      };
    });

    // Merge items arrays
    const allItems = [...items, ...mappedServiceItems];

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



    const finalData = {
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
      mealPlanLabel,

      items: allItems,

      subtotal: TemplateHelpers.formatCurrency(subtotal),
      taxAmount: TemplateHelpers.formatCurrency(taxAmount),
      serviceFee: TemplateHelpers.formatCurrency(serviceFee),
      grandTotal: TemplateHelpers.formatCurrency(grandTotal),
      paidAmount: TemplateHelpers.formatCurrency(paidAmount),
      balanceDue: TemplateHelpers.formatCurrency(balanceDue),

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

    // Determine which template to use
    // 1) Combined invoice when there are hotel items (nights > 0) AND service items (nights == 0)
    // 2) Hotel with variable pricing -> invoice.html
    // 3) Simple hotel (flat rate) -> invoice-simple.html
    const hasAnyPricingPeriods = allItems.some(item => item.hasPricingPeriods);
    const hasHotelItems = allItems.some(item => (item.nights || 0) > 0);
    const hasServiceItems = allItems.some(item => (item.nights || 0) === 0);
    const templateName = (hasHotelItems && hasServiceItems)
      ? 'invoice-combined.html'
      : (hasAnyPricingPeriods ? 'invoice.html' : 'invoice-simple.html');

    console.log('Final data being sent to template:', {
      templateName,
      itemsCount: allItems.length,
      hasAnyPricingPeriods,
      items: allItems.map((item, index) => ({
        index,
        roomType: item.roomType,
        roomRate: item.roomRate,
        roomRateType: typeof item.roomRate,
        lineTotal: item.lineTotal,
        lineTotalType: typeof item.lineTotal,
        hasPricingPeriods: item.hasPricingPeriods,
        hasPricingPeriodsType: typeof item.hasPricingPeriods,
        pricingPeriodsCount: item.pricingPeriods?.length || 0,
        quantity: item.quantity,
        nights: item.nights,
        productName: item.productName,
        detailText: item.detailText,
        nightsDisplay: item.nightsDisplay,
        unitPriceVariable: item.unitPriceVariable
      })),
      subtotal: finalData.subtotal,
      grandTotal: finalData.grandTotal
    });

    return {
      ...finalData,
      templateName
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

    // Prepare detailed room information with pricing periods
    const roomsDetail = bookingItems.map(item => {
      let remarks = '';
      let pricingPeriods: any[] = [];

      if (item.hasPricingPeriods && item.pricingPeriods && item.pricingPeriods.length > 0) {
        remarks = 'Variable pricing periods - see details';
        pricingPeriods = item.pricingPeriods.map((period: any) => ({
          startDate: this.formatDate(period.startDate),
          endDate: this.formatDate(period.endDate),
          nights: period.nights,
          pricePerNight: TemplateHelpers.formatCurrency(parseFloat(period.pricePerNight))
        }));
      } else {
        remarks = `${duration} nights total`;
      }

      return {
        roomType: item.roomType,
        mealPlan: this.formatMealPlan(booking.mealPlan),
        quantity: item.roomCount,
        remarks,
        hasPricingPeriods: item.hasPricingPeriods || false,
        pricingPeriods: pricingPeriods.length > 0 ? pricingPeriods : undefined
      };
    });

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
      totalAmount: TemplateHelpers.formatCurrency(booking.totalAmount, 'SAR'),
      currency: 'SAR',
      rooms,
      roomsDetail,
      qrCodeDataURL
    };
  }
  /**
   * Map meal plan enum to friendly label used in invoices
   */

  static formatMealPlan(mealPlan: string | null | undefined): string {
    const map: Record<string, string> = {
      'Breakfast': 'Breakfast (BB)',
      'Half Board': 'Half Board (HB)',
      'Full Board': 'Full Board (FB)',
      'Room Only': 'Room Only (RO)'
    };
    if (!mealPlan) return 'Room Only (RO)';
    return map[mealPlan] || mealPlan;
  }
}

// Export singleton instance
export const templateEngine = TemplateEngine.getInstance();
