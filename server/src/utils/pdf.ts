import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { Client as MinioClient } from 'minio';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import type { Booking, Invoice, Voucher, Client } from '../db/schema';
import { templateEngine, TemplateHelpers } from './template';

function getPuppeteerExecutablePath(): string | undefined {
  return process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || undefined;
}

async function launchBrowser() {
  return await puppeteer.launch({
    executablePath: getPuppeteerExecutablePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
}

// Initialize MinIO client
const minioClient = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'hotel-booking';

// Ensure bucket exists
export async function ensureBucketExists() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME);
    }
    // Set bucket policy to public read
    await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
        }
      ]
    }));
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
  }
}

// Generate QR Code
export async function generateQRCode(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

// Generate Invoice PDF
export async function generateInvoicePDF(
  invoice: any,
  booking: any,
  client: any,
  bookingItems: any[],
  customDueDate: Date | string,
  customInvoiceDate?: Date | string,
  extraServiceItems: any[] = []
): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  // Prepare data for template
  const templateData = TemplateHelpers.prepareInvoiceData(invoice, booking, client, bookingItems, customDueDate, customInvoiceDate, extraServiceItems);

  // Render HTML using template engine
  const html = templateEngine.renderInvoice(templateData);

  await page.setContent(html);
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  });

  await browser.close();
  return Buffer.from(pdf);
}

// Generate Voucher PDF
export async function generateVoucherPDF(
  voucher: Voucher,
  booking: Booking,
  client: Client,
  bookingItems: any[],
  qrCodeDataURL: string
): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  // Import required modules for Handlebars template
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const { fileURLToPath } = await import('url');
  const { dirname } = await import('path');
  const Handlebars = await import('handlebars');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Helper function to format date
  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); // DD MONTH YYYY
  }

  // Helper function to calculate nights
  function calculateNights(checkIn: Date, checkOut: Date): number {
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Prepare voucher data for Handlebars template
  const voucherData = {
    // Brand info
    brandName: "Musafirin",
    brandTagline: "Atur Sendiri Perjalanan Ibadahmu",
    brandWebsite: "https://hotel.musafirin.co",
    logoBase64: (() => { try { const logoBuffer = readFileSync(join(process.cwd(), "..", "client", "public", "Logo Musafirin with PT.png")); return logoBuffer.toString("base64"); } catch (e) { console.warn("Voucher logo not found, using fallback"); const fallbackBuffer = readFileSync(join(__dirname, "..", "templates", "logomusafirin.png")); return fallbackBuffer.toString("base64"); } })(),
    // Voucher info
    voucherNo: voucher.number,
    issueDate: formatDate(new Date()),
    paymentType: "Prepaid",
    isPayAtHotel: false,
    hotelConfirmationNo: booking.hotelConfirmationNo || '',
    supplierRef: booking.code,

    // Hotel info
    hotelName: booking.hotelName,
    hotelAddress: `${booking.hotelName}, ${booking.city}, Saudi Arabia`,
    hotelPhone: "+966-14-xxxxxxx",
    hotelEmail: "reservations@hotel.example",
    hotelMapUrl: `https://maps.google.com/?q=${encodeURIComponent(booking.hotelName)}`,

    // Guest info
    leadGuest: {
      name: voucher.guestName || client.name,
      email: client.email,
      phone: client.phone || '+966-5XXXXXXX'
    },
    guests: [], // Additional guests if any

    // Calculate totals from booking items
    totalRooms: bookingItems.reduce((sum, item) => sum + item.roomCount, 0),

    // Stay details
    checkIn: formatDate(booking.checkIn ?? new Date()),
    checkOut: formatDate(booking.checkOut ?? new Date()),
    policyCheckInTime: "16:00",
    policyCheckOutTime: "12:00",
    nights: calculateNights(booking.checkIn, booking.checkOut),
    rooms: bookingItems.reduce((sum, item) => sum + item.roomCount, 0),
    // Note: Pax data (adults/children) tidak tersedia di booking items saat ini
    adults: 0, // Data tidak tersedia
    children: 0, // Data tidak tersedia

    // Room details dari booking items yang sebenarnya
    roomsDetail: bookingItems.map(item => ({
      roomType: item.roomType,
      mealPlan: TemplateHelpers.formatMealPlan(booking.mealPlan),
      quantity: item.roomCount,
      remarks: '-'
    })),

    // Inclusions and policies
    inclusions: [
      "Wi-Fi gratis",
      "Akses ke fasilitas hotel"
    ],
    specialRequest: "",
    cancellationPolicy: "Mengikuti kebijakan hotel; no-show dikenakan 1 malam.",
    paymentNote: "Prepaid — hotel tidak akan menagih tamu saat check-in.",

    // Support
    supportEmail: "support@musafirin.co",
    supportPhone: "+966-539101812"
  };

  // Load and compile template
  const templatePath = join(__dirname, '../templates/voucher.html');
  const templateContent = readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);

  // Generate HTML
  const html = template(voucherData);

  await page.setContent(html);
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  });

  await browser.close();
  return Buffer.from(pdf);
}

// Upload file to MinIO
export async function uploadToMinio(
  fileName: string,
  buffer: Buffer,
  contentType: string = 'application/pdf'
): Promise<string> {
  try {
    await ensureBucketExists();

    await minioClient.putObject(BUCKET_NAME, fileName, buffer, buffer.length, {
      'Content-Type': contentType,
    });

    // Return the URL to access the file
    const baseUrl = process.env.MINIO_BASE_URL || `http://localhost:9000`;
    return `${baseUrl}/${BUCKET_NAME}/${fileName}`;
  } catch (error) {
    console.error('Error uploading to MinIO:', error);
    throw new Error('Failed to upload file');
  }
}

// Generate Service Order Receipt PDF
export async function generateServiceOrderReceiptPDF(
  receiptReq: any,
  serviceOrderReq: any,
  clientReq: any,
  invoiceReq: any
): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const templatePath = join(process.cwd(), 'src', 'templates', 'kwitansi.html');
    let template = readFileSync(templatePath, 'utf-8');

    const logoPath = join(process.cwd(), '..', 'logomusafirin.png');
    let logoBase64 = '';
    try {
      logoBase64 = readFileSync(logoPath).toString('base64');
    } catch (e) { }

    const saudiRiyalPath = join(process.cwd(), 'client', 'Saudi_Riyal_Symbol.svg');
    let saudiRiyalSVGBase64 = '';
    try {
      saudiRiyalSVGBase64 = readFileSync(saudiRiyalPath).toString('base64');
    } catch (e) { }

    const signaturePath = join(process.cwd(), 'public', 'ttd.png');
    let signatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    try {
      signatureBase64 = readFileSync(signaturePath).toString('base64');
    } catch (e) { }

    let renderedHtml = template;
    const formatDate = (date: any) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-CA');
    };

    const receiptDateStr = formatDate(receiptReq.issueDate || receiptReq.createdAt || new Date());

    // Replace text templates
    renderedHtml = renderedHtml.replace(/\{\{receiptNo\}\}/g, receiptReq.number || '');
    renderedHtml = renderedHtml.replace(/\{\{receiptDate\}\}/g, receiptDateStr);

    renderedHtml = renderedHtml.replace(/\{\{payer\.name\}\}/g, receiptReq.payerName || clientReq.name || '');
    renderedHtml = renderedHtml.replace(/\{\{payer\.email\}\}/g, clientReq.email || '-');
    renderedHtml = renderedHtml.replace(/\{\{payer\.phone\}\}/g, clientReq.phone || '-');
    renderedHtml = renderedHtml.replace(/\{\{payer\.address\}\}/g, '-');

    renderedHtml = renderedHtml.replace(/\{\{invoice\.invoiceNo\}\}/g, invoiceReq?.number || '-');
    renderedHtml = renderedHtml.replace(/\{\{invoice\.invoiceDate\}\}/g, invoiceReq?.issueDate ? formatDate(invoiceReq.issueDate) : '-');

    renderedHtml = renderedHtml.replace(/\{\{hotelName\}\}/g, serviceOrderReq.productType || 'Service Order');
    renderedHtml = renderedHtml.replace(/\{\{hotelAddress\}\}/g, '');

    renderedHtml = renderedHtml.replace(/\{\{totals\.invoiceAmount\}\}/g, receiptReq.totalAmount || '0');
    renderedHtml = renderedHtml.replace(/\{\{totals\.paidAmount\}\}/g, receiptReq.paidAmount || '0');
    renderedHtml = renderedHtml.replace(/\{\{totals\.balanceDue\}\}/g, receiptReq.balanceDue || '0');
    renderedHtml = renderedHtml.replace(/\{\{amountInWords\}\}/g, '');

    renderedHtml = renderedHtml.replace(/\{\{bank\.bankName\}\}/g, 'Bank Syariah Indonesia');
    renderedHtml = renderedHtml.replace(/\{\{bank\.bankCountry\}\}/g, 'Indonesia');
    renderedHtml = renderedHtml.replace(/\{\{bank\.accountName\}\}/g, 'PT Thalhah Insan Rabbani');
    renderedHtml = renderedHtml.replace(/\{\{bank\.accountNumberOrIBAN\}\}/g, '7254459741');

    renderedHtml = renderedHtml.replace(/\{\{notes\}\}/g, serviceOrderReq.notes || '');
    renderedHtml = renderedHtml.replace(/\{\{brandName\}\}/g, 'Musafirin');

    renderedHtml = renderedHtml.replace(/\{\{logoBase64\}\}/g, logoBase64);
    renderedHtml = renderedHtml.replace(/\{\{saudiRiyalSVGBase64\}\}/g, saudiRiyalSVGBase64);
    renderedHtml = renderedHtml.replace(/\{\{signatureBase64\}\}/g, signatureBase64);

    renderedHtml = renderedHtml.replace(/\{\{#if amountInWords\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    if (!serviceOrderReq.notes) {
      renderedHtml = renderedHtml.replace(/\{\{#if notes\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    } else {
      renderedHtml = renderedHtml.replace(/\{\{#if notes\}\}/g, '');
      renderedHtml = renderedHtml.replace(/\{\{\/if\}\}/g, '');
    }

    const serviceDetails = `
        <div class="cs-text-sm cs-text-gray-700">Type: ${serviceOrderReq.productType || ''}</div>
        <div class="cs-text-sm cs-text-gray-500">Group Leader: ${serviceOrderReq.groupLeaderName || ''}</div>
        <div class="cs-text-sm cs-text-gray-500">Total People: ${serviceOrderReq.totalPeople || '1'}</div>
    `;
    const paymentRow = `
      <tr>
        <td>
          <div class="cs-font-semibold">Service Order Payment</div>
          <div class="cs-text-sm cs-text-gray-500">${receiptDateStr}</div>
          ${serviceDetails}
        </td>
        <td>Transfer Bank</td>
        <td>-</td>
        <td class="cs-num">
          <img src="data:image/svg+xml;base64,${saudiRiyalSVGBase64}" class="cs-sar-icon" alt="SAR" />
          ${receiptReq.paidAmount || '0'}
        </td>
      </tr>
    `;
    renderedHtml = renderedHtml.replace(/\{\{#each payments\}\}[\s\S]*?\{\{\/each\}\}/g, paymentRow);

    await page.setContent(renderedHtml);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    await browser.close();
    return Buffer.from(pdf);
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Check if file exists in MinIO
export async function checkFileExistsInMinio(fileName: string): Promise<boolean> {
  try {
    await minioClient.statObject(BUCKET_NAME, fileName);
    return true;
  } catch (error) {
    // If error occurs (file not found), return false
    return false;
  }
}

// Delete file from MinIO bucket (ignores missing files)
export async function deleteFromMinio(fileName: string): Promise<void> {
  try {
    await ensureBucketExists();
    await minioClient.removeObject(BUCKET_NAME, fileName);
  } catch (error: any) {
    if (error?.code === 'NoSuchKey' || error?.code === 'NotFound') {
      return;
    }
    console.error('Error deleting from MinIO:', error);
    throw new Error('Failed to delete file');
  }
}

// Generate unique invoice number
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `INV-${year}-${timestamp}`;
}

// Generate unique voucher number
export function generateVoucherNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `VCH-${year}-${timestamp}`;
}

// Generate unique booking code
export function generateBookingCode(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-${timestamp}-${random}`;
}

// Generate unique receipt number
export function generateReceiptNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `KWT-${year}-${timestamp}`;
}

// Generate unique service order number
export function generateServiceOrderNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `SO-${year}-${timestamp}`;
}

// Generate receipt PDF
export async function generateReceiptPDF(receiptData: any): Promise<string> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    // Load template directly
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const templatePath = join(process.cwd(), 'src', 'templates', 'kwitansi.html');
    let template = readFileSync(templatePath, 'utf-8');

    // Load logo base64
    const logoPath = join(process.cwd(), '..', 'logomusafirin.png');
    let logoBase64 = '';
    try {
      const logoBuffer = readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    } catch (error) {
      console.warn('Logo file not found, using empty logo');
    }

    // Load Saudi Riyal SVG base64
    const saudiRiyalPath = join(process.cwd(), 'client', 'Saudi_Riyal_Symbol.svg');
    let saudiRiyalSVGBase64 = '';
    try {
      const saudiRiyalBuffer = readFileSync(saudiRiyalPath);
      saudiRiyalSVGBase64 = saudiRiyalBuffer.toString('base64');
    } catch (error) {
      console.warn('Saudi Riyal SVG not found, using SAR text');
    }

    // Load signature image base64
    const signaturePath = join(process.cwd(), 'public', 'ttd.png');
    let signatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    try {
      const sigBuffer = readFileSync(signaturePath);
      signatureBase64 = sigBuffer.toString('base64');
    } catch (error) {
      console.warn('Signature image not found, using transparent fallback');
    }

    // Comprehensive template replacement
    let renderedHtml = template;

    // Basic receipt info
    renderedHtml = renderedHtml.replace(/\{\{receiptNo\}\}/g, receiptData.receipt?.number || '');
    renderedHtml = renderedHtml.replace(/\{\{receiptDate\}\}/g, receiptData.receipt?.issueDate || '');

    // Payer information
    renderedHtml = renderedHtml.replace(/\{\{payer\.name\}\}/g, receiptData.payer?.name || '');
    renderedHtml = renderedHtml.replace(/\{\{payer\.email\}\}/g, receiptData.payer?.email || '');
    renderedHtml = renderedHtml.replace(/\{\{payer\.phone\}\}/g, receiptData.payer?.phone || '');
    renderedHtml = renderedHtml.replace(/\{\{payer\.address\}\}/g, receiptData.payer?.address || '');

    // Invoice information
    renderedHtml = renderedHtml.replace(/\{\{invoice\.invoiceNo\}\}/g, receiptData.receipt?.number || '');
    renderedHtml = renderedHtml.replace(/\{\{invoice\.invoiceDate\}\}/g, receiptData.receipt?.issueDate || '');

    // Hotel information
    renderedHtml = renderedHtml.replace(/\{\{hotelName\}\}/g, receiptData.booking?.hotelName || receiptData.hotel?.name || '');
    renderedHtml = renderedHtml.replace(/\{\{hotelAddress\}\}/g, receiptData.hotel?.address || '');

    // Totals
    renderedHtml = renderedHtml.replace(/\{\{totals\.invoiceAmount\}\}/g, receiptData.receipt?.totalAmount || '0');
    renderedHtml = renderedHtml.replace(/\{\{totals\.paidAmount\}\}/g, receiptData.receipt?.paidAmount || '0');
    renderedHtml = renderedHtml.replace(/\{\{totals\.balanceDue\}\}/g, receiptData.receipt?.balanceDue || '0');

    // Amount in words
    renderedHtml = renderedHtml.replace(/\{\{amountInWords\}\}/g, receiptData.receipt?.amountInWords || '');

    // Bank information
    renderedHtml = renderedHtml.replace(/\{\{bank\.bankName\}\}/g, receiptData.bank?.name || '');
    renderedHtml = renderedHtml.replace(/\{\{bank\.bankCountry\}\}/g, receiptData.bank?.country || '');
    renderedHtml = renderedHtml.replace(/\{\{bank\.accountName\}\}/g, receiptData.bank?.accountName || '');
    renderedHtml = renderedHtml.replace(/\{\{bank\.accountNumberOrIBAN\}\}/g, receiptData.bank?.accountNumber || '');

    // Notes
    renderedHtml = renderedHtml.replace(/\{\{notes\}\}/g, receiptData.receipt?.notes || '');

    // Brand information
    renderedHtml = renderedHtml.replace(/\{\{brandName\}\}/g, receiptData.brand?.name || 'Musafirin');

    // Logo and icons
    renderedHtml = renderedHtml.replace(/\{\{logoBase64\}\}/g, logoBase64);
    renderedHtml = renderedHtml.replace(/\{\{saudiRiyalSVGBase64\}\}/g, saudiRiyalSVGBase64);
    renderedHtml = renderedHtml.replace(/\{\{signatureBase64\}\}/g, signatureBase64);

    // Handle conditional blocks (simple implementation)
    // Remove {{#if amountInWords}} blocks if no amount in words
    if (!receiptData.receipt?.amountInWords) {
      renderedHtml = renderedHtml.replace(/\{\{#if amountInWords\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    } else {
      renderedHtml = renderedHtml.replace(/\{\{#if amountInWords\}\}/g, '');
      renderedHtml = renderedHtml.replace(/\{\{\/if\}\}/g, '');
    }

    // Remove {{#if notes}} blocks if no notes
    if (!receiptData.receipt?.notes) {
      renderedHtml = renderedHtml.replace(/\{\{#if notes\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    } else {
      renderedHtml = renderedHtml.replace(/\{\{#if notes\}\}/g, '');
      renderedHtml = renderedHtml.replace(/\{\{\/if\}\}/g, '');
    }

    // Handle payments loop (simple implementation for now)
    // Build hotel details under payment row
    const hotelDetails = `
        <div class="cs-text-sm cs-text-gray-700">${receiptData.booking?.hotelName || ''}</div>
        <div class="cs-text-sm cs-text-gray-500">Check-in: ${receiptData.booking?.checkIn || ''}</div>
        <div class="cs-text-sm cs-text-gray-500">Check-out: ${receiptData.booking?.checkOut || ''}</div>
        ${receiptData.booking?.roomSummary ? `<div class=\"cs-text-sm cs-text-gray-700\">${receiptData.booking.roomSummary}</div>` : ''}
    `;
    const paymentRow = `
      <tr>
        <td>
          <div class="cs-font-semibold">Pembayaran Hotel</div>
          <div class="cs-text-sm cs-text-gray-500">${receiptData.receipt?.issueDate || ''}</div>
          ${hotelDetails}
        </td>
        <td>Transfer Bank</td>
        <td>-</td>
        <td class="cs-num">
          <img src="data:image/svg+xml;base64,${saudiRiyalSVGBase64}" class="cs-sar-icon" alt="SAR" />
          ${receiptData.receipt?.paidAmount || '0'}
        </td>
      </tr>
    `;

    // Replace the payments loop
    renderedHtml = renderedHtml.replace(/\{\{#each payments\}\}[\s\S]*?\{\{\/each\}\}/g, paymentRow);

    await page.setContent(renderedHtml);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    // Upload to MinIO
    const fileName = `receipts/${receiptData.receipt.number}.pdf`;
    const pdfUrl = await uploadToMinio(fileName, Buffer.from(pdf));

    return pdfUrl;
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Generate Service Order Invoice PDF
export async function generateServiceOrderInvoicePDF(
  invoice: any,
  serviceOrder: any,
  client: any,
  customDueDate: Date | string,
  customInvoiceDate?: Date | string
): Promise<Buffer> {
  const browser = await launchBrowser();

  const page = await browser.newPage();

  try {
    // Load template directly
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const templatePath = join(process.cwd(), 'src', 'templates', 'invoice-visa.html');
    let template = readFileSync(templatePath, 'utf-8');

    // Load logo base64
    const logoPath = join(process.cwd(), '..', 'logomusafirin.png');
    let logoBase64 = '';
    try {
      const logoBuffer = readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    } catch (error) {
      console.warn('Logo file not found, using empty logo');
    }

    // Load Saudi Riyal SVG icon base64 using the correct implementation
    const saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();

    // Calculate amounts
    const totalAmount = parseFloat(serviceOrder.totalAmount || invoice.amount || '0');
    const subtotal = totalAmount;
    const discount = 0;
    const grandTotal = subtotal - discount;
    const paidAmount = 0;
    const balanceDue = grandTotal - paidAmount;

    // Create service order item
    const totalPeople = serviceOrder.totalPeople || 1;
    const serviceOrderItem = {
      name: `Visa Umroh`,
      pax: totalPeople,
      unitPrice: totalAmount / totalPeople,
      lineTotal: totalAmount
    };

    // Prepare data for template matching the expected structure
    const templateData = {
      // Invoice header data
      invoiceNo: invoice.number,
      invoiceDate: new Date(customInvoiceDate || new Date()).toLocaleDateString('en-GB'),
      dueDate: new Date(customDueDate).toLocaleDateString('en-GB'),

      // Client data
      client: {
        name: client.name || 'N/A',
        email: client.email || 'N/A',
        phone: client.phone || 'N/A'
      },

      // Items array
      items: [serviceOrderItem],

      // Financial data
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      balanceDue: balanceDue.toFixed(2),

      // Bank information
      bank: {
        bankName: 'Bank Syariah Indonesia',
        bankCountry: 'Indonesia',
        accountName: 'PT Thalhah Insan Rabbani',
        accountNumberOrIBAN: '7254459741'
      },

      // Contact information
      billingContact: {
        email: 'billing@musafirin.com',
        phone: '+6285218300910'
      },

      // Brand
      brandName: 'Musafirin',

      // Base64 encoded images
      logoBase64: logoBase64,
      saudiRiyalSVGBase64: saudiRiyalSVGBase64
    };

    // Replace template variables
    let renderedHtml = template
      // Invoice header
      .replace(/\{\{invoiceNo\}\}/g, templateData.invoiceNo)
      .replace(/\{\{invoiceDate\}\}/g, templateData.invoiceDate)
      .replace(/\{\{dueDate\}\}/g, templateData.dueDate)

      // Client information
      .replace(/\{\{client\.name\}\}/g, templateData.client.name)
      .replace(/\{\{client\.email\}\}/g, templateData.client.email)
      .replace(/\{\{client\.phone\}\}/g, templateData.client.phone)

      // Financial totals
      .replace(/\{\{subtotal\}\}/g, templateData.subtotal)
      .replace(/\{\{discount\}\}/g, templateData.discount)
      .replace(/\{\{grandTotal\}\}/g, templateData.grandTotal)
      .replace(/\{\{paidAmount\}\}/g, templateData.paidAmount)
      .replace(/\{\{balanceDue\}\}/g, templateData.balanceDue)

      // Bank information
      .replace(/\{\{bank\.bankName\}\}/g, templateData.bank.bankName)
      .replace(/\{\{bank\.bankCountry\}\}/g, templateData.bank.bankCountry)
      .replace(/\{\{bank\.accountName\}\}/g, templateData.bank.accountName)
      .replace(/\{\{bank\.accountNumberOrIBAN\}\}/g, templateData.bank.accountNumberOrIBAN)

      // Contact information
      .replace(/\{\{billingContact\.email\}\}/g, templateData.billingContact.email)
      .replace(/\{\{billingContact\.phone\}\}/g, templateData.billingContact.phone)

      // Brand
      .replace(/\{\{brandName\}\}/g, templateData.brandName)

      // Images
      .replace(/\{\{logoBase64\}\}/g, templateData.logoBase64)
      .replace(/\{\{saudiRiyalSVGBase64\}\}/g, templateData.saudiRiyalSVGBase64);

    // Handle items loop
    const itemsHtml = templateData.items.map(item => `
      <tr>
        <td>
          <div class="cs-font-semibold">Visa Umroh</div>
        </td>
        <td class="cs-text-center">${item.pax}</td>
        <td class="cs-num">
          <img src="data:image/svg+xml;base64,${templateData.saudiRiyalSVGBase64}" class="cs-sar-icon" alt="SAR" />
          ${item.unitPrice.toFixed(2)}
        </td>
        <td class="cs-num">
          <div class="cs-font-semibold">
            <img src="data:image/svg+xml;base64,${templateData.saudiRiyalSVGBase64}" class="cs-sar-icon" alt="SAR" />
            ${item.lineTotal.toFixed(2)}
          </div>
        </td>
      </tr>
    `).join('');

    // Replace the items loop
    renderedHtml = renderedHtml.replace(/\{\{#each items\}\}[\s\S]*?\{\{\/each\}\}/g, itemsHtml);

    await page.setContent(renderedHtml);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();
    return Buffer.from(pdf);
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Generate unique service order invoice number
export function generateServiceOrderInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `SO-INV-${year}-${timestamp}`;
}

// Generate Transportation Invoice PDF
export async function generateTransportationInvoicePDF(
  invoice: any,
  booking: any,
  client: any,
  routes: any[]
): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    // Import required modules for Handlebars template
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const Handlebars = await import('handlebars');
    const templatePath = join(process.cwd(), 'src', 'templates', 'transportation-invoice.html');
    const templateHtml = readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateHtml);

    // Load logo base64
    const logoPath = join(process.cwd(), '..', 'logomusafirin.png');
    let logoBase64 = '';
    try {
      const logoBuffer = readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    } catch (error) {
      console.warn('Logo file not found, using empty logo');
    }

    // Load Saudi Riyal SVG icon base64
    const saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();

    // Format dates
    const formatDate = (date: any) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-CA');
    };

    const formatDateTime = (date: any) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleString('en-CA');
    };

    // Prepare data
    const totalAmount = parseFloat(invoice.amount || booking.totalAmount || '0');

    // Determine vehicle type, driver name, driver phone from the first route or combine them
    const firstRoute = routes[0] || {};

    const templateData = {
      invoiceNo: invoice.number,
      invoiceDate: formatDate(invoice.issueDate),
      dueDate: formatDate(invoice.dueDate),
      client: {
        name: client.name,
        email: client.email || booking.customerEmail || '-',
        phone: client.phone || booking.customerPhone || '-',
      },
      vehicleType: firstRoute.vehicleType || '-',
      driverName: firstRoute.driverName || '-',
      driverPhone: firstRoute.driverPhone || '-',
      vehiclePlateNumber: firstRoute.vehiclePlateNumber || '-',
      pickupDateTime: firstRoute.pickupDateTime ? formatDateTime(firstRoute.pickupDateTime) : '-',
      originLocation: firstRoute.originLocation || '-',
      destinationLocation: firstRoute.destinationLocation || '-',
      routes: routes.map(r => ({
        ...r,
        pickupDateTime: r.pickupDateTime ? formatDateTime(r.pickupDateTime) : '-',
        price: parseFloat(r.price).toFixed(2),
      })),
      subtotal: totalAmount.toFixed(2),
      grandTotal: totalAmount.toFixed(2),
      paidAmount: '0.00',
      balanceDue: totalAmount.toFixed(2),

      bank: {
        bankName: 'Bank Syariah Indonesia',
        bankCountry: 'Indonesia',
        accountName: 'PT Thalhah Insan Rabbani',
        accountNumberOrIBAN: '7254459741',
        swift: '-'
      },
      billingContact: {
        email: 'billing@musafirin.com',
        phone: '+6285218300910'
      },
      brandName: 'Musafirin',
      logoBase64,
      saudiRiyalSVGBase64
    };

    const renderedHtml = template(templateData);

    await page.setContent(renderedHtml);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();
    return Buffer.from(pdf);
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Generate Transportation Receipt PDF
export async function generateTransportationReceiptPDF(
  receipt: any,
  booking: any,
  client: any,
  routes: any[],
  invoice: any
): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    // Import required modules for Handlebars template
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const Handlebars = await import('handlebars');
    const templatePath = join(process.cwd(), 'src', 'templates', 'transportation-receipt.html');
    const templateHtml = readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateHtml);

    // Load logo base64
    const logoPath = join(process.cwd(), '..', 'logomusafirin.png');
    let logoBase64 = '';
    try {
      const logoBuffer = readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    } catch (error) {
      console.warn('Logo file not found, using empty logo');
    }

    // Load Saudi Riyal SVG icon base64
    const saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();

    // Format dates
    const formatDate = (date: any) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-CA');
    };

    const formatDateTime = (date: any) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleString('en-CA');
    };

    // Determine vehicle type, driver name, driver phone from the first route or combine them
    const firstRoute = routes[0] || {};
    const totalAmount = parseFloat(receipt.totalAmount || booking.totalAmount || '0');

    // ToWords functionality (simplified for transportation or import from elsewhere if needed)
    // For now, using a placeholder or a simple toString
    const amountInWords = receipt.amountInWords || `${totalAmount} SAR Only`;

    const templateData = {
      receiptNo: receipt.number,
      receiptDate: formatDate(receipt.issueDate || receipt.createdAt || new Date()),
      payer: {
        name: client.name || receipt.payerName,
        email: client.email || booking.customerEmail || '-',
        phone: client.phone || booking.customerPhone || '-',
        address: '-'
      },
      invoice: {
        invoiceNo: invoice?.number || '-',
        invoiceDate: invoice?.issueDate ? formatDate(invoice.issueDate) : '-'
      },
      transportationDetails: {
        route: firstRoute.originLocation ? `${firstRoute.originLocation} → ${firstRoute.destinationLocation}` : '-',
        originLocation: firstRoute.originLocation || '-',
        destinationLocation: firstRoute.destinationLocation || '-',
        pickupDateTime: firstRoute.pickupDateTime ? formatDateTime(firstRoute.pickupDateTime) : '-',
        vehicleType: firstRoute.vehicleType || '-',
        driverName: firstRoute.driverName || '-',
        driverPhone: firstRoute.driverPhone || '-',
        vehiclePlateNumber: firstRoute.vehiclePlateNumber || '-',
        notes: booking.notes || ''
      },
      payments: [
        {
          label: 'Pembayaran Transportasi',
          date: formatDate(receipt.createdAt || new Date()),
          method: 'Transfer',
          transactionId: '-',
          amount: totalAmount.toFixed(2),
          transportationDetails: null
        }
      ],
      totalInvoiceAmount: totalAmount.toFixed(2),
      totalPaidAmount: totalAmount.toFixed(2),
      balanceDue: '0.00',
      notes: receipt.notes || '',
      billingContact: {
        email: 'billing@musafirin.com',
        phone: '+6285218300910'
      },
      logoBase64,
      saudiRiyalSVGBase64
    };

    const renderedHtml = template(templateData);

    await page.setContent(renderedHtml);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();
    return Buffer.from(pdf);
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Generate Transportation Voucher PDF
export async function generateTransportationVoucherPDF(
  voucher: any,
  booking: any,
  client: any,
  routes: any[]
): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const Handlebars = await import('handlebars');
    // We will use transportation-voucher.html
    const templatePath = join(process.cwd(), 'src', 'templates', 'transportation-voucher.html');
    let templateHtml = '';
    try {
      templateHtml = readFileSync(templatePath, 'utf-8');
    } catch {
      console.warn('transportation-voucher.html not found, falling back to voucher.html');
      templateHtml = readFileSync(join(process.cwd(), 'src', 'templates', 'voucher.html'), 'utf-8');
    }
    const template = Handlebars.compile(templateHtml);

    const logoPath = join(process.cwd(), '..', 'logomusafirin.png');
    let logoBase64 = '';
    try {
      const logoBuffer = readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    } catch (error) {
      console.warn('Logo file not found');
    }

    const formatDate = (date: any) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-CA');
    };

    const formatDateTime = (date: any) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleString('en-CA');
    };

    const firstRoute = routes[0] || {};

    const templateData = {
      voucherNo: voucher.number,
      issueDate: formatDate(voucher.issueDate || voucher.createdAt || new Date()),
      guest: {
        name: client.name || booking.customerName,
        phone: client.phone || booking.customerPhone || '-',
        email: client.email || booking.customerEmail || '-'
      },
      bookingNo: booking.id, // Or booking code
      bookingNotes: booking.notes,
      routeInfo: firstRoute.originLocation ? `${firstRoute.originLocation} → ${firstRoute.destinationLocation}` : '-',
      firstPickupDateTime: firstRoute.pickupDateTime ? formatDateTime(firstRoute.pickupDateTime) : '-',
      vehicleType: firstRoute.vehicleType || '-',
      driverName: firstRoute.driverName || '-',
      driverPhone: firstRoute.driverPhone || '-',
      vehiclePlateNumber: firstRoute.vehiclePlateNumber || '-',
      routes: routes.map((r, i) => ({
        index: i + 1,
        origin: r.originLocation,
        destination: r.destinationLocation,
        pickupDateTime: r.pickupDateTime ? formatDateTime(r.pickupDateTime) : '-',
        vehicleType: r.vehicleType,
        driverName: r.driverName || '-',
        driverPhone: r.driverPhone || '-',
        vehiclePlate: r.vehiclePlateNumber || '-'
      })),
      companyInfo: {
        name: 'PT Thalhah Insan Rabbani',
        brand: 'Musafirin',
        address: 'Gdg. Nifa, Kav 1-2, Jl. RS. Fatmawati No. 39, Cilandak, Jakarta Selatan',
        phone: '+6285218300910',
        email: 'billing@musafirin.com'
      },
      logoBase64
    };

    const renderedHtml = template(templateData);

    await page.setContent(renderedHtml);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();
    return Buffer.from(pdf);
  } catch (error) {
    await browser.close();
    throw error;
  }
}


export async function generateCustomLaInvoicePDF(
  invoiceData: any
): Promise<string> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const templatePath = path.join(__dirname, '../templates/custom-la-invoice.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    const logoPath = path.join(__dirname, '../templates/logomusafirin.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    // Default bank if not provided
    const defaultBank = {
      bankName: 'Bank Syariah Indonesia',
      bankCountry: 'Indonesia',
      accountName: 'PT Musafirin Internasional',
      accountNumberOrIBAN: '7254459741'
    };

    const data = {
      ...invoiceData,
      logoBase64,
      bank: invoiceData.bank || defaultBank,
      brandName: 'Musafirin'
    };

    const html = template(data);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const fileName = `${invoiceData.invoiceNo}.pdf`;
    const tempFilePath = path.join(__dirname, '../../temp', fileName);

    if (!fs.existsSync(path.join(__dirname, '../../temp'))) {
      fs.mkdirSync(path.join(__dirname, '../../temp'), { recursive: true });
    }

    await page.pdf({
      path: tempFilePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    const fileStream = fs.createReadStream(tempFilePath);
    await minioClient.putObject(
      (process.env.MINIO_BUCKET || 'musafirin-assets'),
      `receipts/${fileName}`,
      fileStream,
      fs.statSync(tempFilePath).size,
      { 'Content-Type': 'application/pdf' }
    );

    fs.unlinkSync(tempFilePath);

    // In local dev, use port 3000 mapping if (process.env.MINIO_ENDPOINT || 'localhost') is localhost
    const isLocal = (process.env.MINIO_ENDPOINT || 'localhost').includes('localhost') || (process.env.MINIO_ENDPOINT || 'localhost').includes('127.0.0.1');
    const endpoint = isLocal ? 'localhost:9000' : (process.env.MINIO_ENDPOINT || 'localhost');
    return `http://${endpoint}/${(process.env.MINIO_BUCKET || 'musafirin-assets')}/receipts/${fileName}`;
  } finally {
    await browser.close();
  }
}

export async function generateCustomLaReceiptPDF(
  receiptData: any
): Promise<string> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const templatePath = path.join(__dirname, '../templates/custom-la-receipt.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    const logoPath = path.join(__dirname, '../templates/logomusafirin.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    const data = {
      ...receiptData,
      logoBase64,
      brandName: 'Musafirin'
    };

    const html = template(data);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const fileName = `${receiptData.receiptNo}.pdf`;
    const tempFilePath = path.join(__dirname, '../../temp', fileName);

    if (!fs.existsSync(path.join(__dirname, '../../temp'))) {
      fs.mkdirSync(path.join(__dirname, '../../temp'), { recursive: true });
    }

    await page.pdf({
      path: tempFilePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    const fileStream = fs.createReadStream(tempFilePath);
    await minioClient.putObject(
      (process.env.MINIO_BUCKET || 'musafirin-assets'),
      `receipts/${fileName}`,
      fileStream,
      fs.statSync(tempFilePath).size,
      { 'Content-Type': 'application/pdf' }
    );

    fs.unlinkSync(tempFilePath);

    const isLocal = (process.env.MINIO_ENDPOINT || 'localhost').includes('localhost') || (process.env.MINIO_ENDPOINT || 'localhost').includes('127.0.0.1');
    const endpoint = isLocal ? 'localhost:9000' : (process.env.MINIO_ENDPOINT || 'localhost');
    return `http://${endpoint}/${(process.env.MINIO_BUCKET || 'musafirin-assets')}/receipts/${fileName}`;
  } finally {
    await browser.close();
  }
}
