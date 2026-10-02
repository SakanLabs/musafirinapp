import puppeteer, { type Browser } from 'puppeteer';
import QRCode from 'qrcode';
import { Client as MinioClient } from 'minio';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import type { Booking, Invoice, Voucher, Client } from '../db/schema';
import { templateEngine, TemplateHelpers } from './template';

function getClientPublicPath(fileName: string): string {
  // 1. Try relative to import.meta.dir (server/src/utils)
  const relativePath = path.join(import.meta.dir, '..', '..', '..', 'client', 'public', fileName);
  if (fs.existsSync(relativePath)) {
    return relativePath;
  }
  // 2. Try process.cwd() client/public (if running from workspace root)
  const cwdPath = path.join(process.cwd(), 'client', 'public', fileName);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  // 3. Try process.cwd() sibling (if running from server/)
  const siblingPath = path.join(process.cwd(), '..', 'client', 'public', fileName);
  if (fs.existsSync(siblingPath)) {
    return siblingPath;
  }
  return cwdPath;
}

function getTemplatePath(fileName: string): string {
  return path.join(import.meta.dir, '..', 'templates', fileName);
}

function getPuppeteerExecutablePath(): string | undefined {
  return process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || undefined;
}

let browserInstance: Browser | null = null;

async function launchBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      executablePath: getPuppeteerExecutablePath(),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
  }
  return browserInstance;
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
  let page;
  try {
    const browser = await launchBrowser();
    page = await browser.newPage();
  } catch (err) {
    console.warn("Browser crashed, restarting for invoice PDF...");
    if (browserInstance) {
      try { await browserInstance.close(); } catch (e) {}
      browserInstance = null;
    }
    const browser = await launchBrowser();
    page = await browser.newPage();
  }

  try {
    // Prepare data for template
    const templateData = await TemplateHelpers.prepareInvoiceData(invoice, booking, client, bookingItems, customDueDate, customInvoiceDate, extraServiceItems);

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

    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

// Generate Voucher PDF
export async function generateVoucherPDF(
  voucher: Voucher,
  booking: Booking,
  client: Client,
  bookingItems: any[],
  qrCodeDataURL: string
): Promise<Buffer> {
  let page;
  try {
    const browser = await launchBrowser();
    page = await browser.newPage();
  } catch (err) {
    console.warn("Browser crashed, restarting for voucher PDF...");
    if (browserInstance) {
      try { await browserInstance.close(); } catch (e) {}
      browserInstance = null;
    }
    const browser = await launchBrowser();
    page = await browser.newPage();
  }

  try {
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
    brandTagline: "We are musafirin of Baitullah",
    brandWebsite: "https://hotel.musafirin.co",
    logoBase64: TemplateHelpers.getLogoBase64(),
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

  return Buffer.from(pdf);
  } finally {
    await page.close();
  }
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

// Get file stream from MinIO
export async function getFileStreamFromMinio(fileName: string) {
  try {
    return await minioClient.getObject(BUCKET_NAME, fileName);
  } catch (error) {
    console.error('Error getting file from MinIO:', error);
    throw new Error('Failed to get file from MinIO');
  }
}

// Check if file exists in MinIO
export async function fileExistsInMinio(fileName: string): Promise<boolean> {
  try {
    await minioClient.statObject(BUCKET_NAME, fileName);
    return true;
  } catch {
    return false;
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
    const Handlebars = (await import('handlebars')).default || (await import('handlebars'));

    const templatePath = getTemplatePath('kwitansi.html');
    const templateSource = readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    const logoBase64 = TemplateHelpers.getLogoBase64();
    const saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();

    let signatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    try {
      const signaturePath = getClientPublicPath('ttd.png');
      signatureBase64 = readFileSync(signaturePath).toString('base64');
    } catch (e) {
      console.warn('Signature image not found, using transparent fallback');
    }

    const formatDate = (date: any) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-GB');
    };

    const receiptDateStr = formatDate(receiptReq.issueDate || receiptReq.createdAt || new Date());

    const totalInvoiceNum = parseFloat(receiptReq.totalAmount || invoiceReq?.amount || serviceOrderReq.totalPriceSAR || '0');
    const currentPaymentNum = parseFloat(receiptReq.paidAmount || '0');
    const balanceDueNum = parseFloat(receiptReq.balanceDue || '0');

    let cumulativePaidNum = totalInvoiceNum - balanceDueNum;
    if (isNaN(cumulativePaidNum) || cumulativePaidNum < currentPaymentNum) {
      cumulativePaidNum = currentPaymentNum;
    }

    const terminNumber = receiptReq.meta?.termin || 1;
    const isPaidFull = balanceDueNum <= 0;
    let terminBadge = receiptReq.meta?.terminLabel || `Termin #${terminNumber}`;
    if (!receiptReq.meta?.terminLabel) {
      if (isPaidFull && terminNumber === 1) {
        terminBadge = 'Pelunasan (Lunas Penuh)';
      } else if (isPaidFull) {
        terminBadge = `Termin #${terminNumber} (Pelunasan)`;
      } else if (terminNumber === 1) {
        terminBadge = 'Termin #1 (Uang Muka / DP)';
      }
    }

    const productName = serviceOrderReq.productType ? (serviceOrderReq.productType.includes('visa') ? 'Visa Umrah' : serviceOrderReq.productType) : 'Service Order';
    const paymentTitle = `Pembayaran ${productName}`;
    const paymentDesc = receiptReq.meta?.description || (serviceOrderReq.notes ? `Catatan: ${serviceOrderReq.notes}` : '');
    const refNumber = receiptReq.meta?.referenceNumber || receiptReq.meta?.payment?.referenceNumber || '-';
    const methodStr = (receiptReq.meta?.paymentMethod || receiptReq.meta?.payment?.method || receiptReq.meta?.method) === 'deposit' ? 'Saldo Deposit' : 'Transfer Bank';

    const serviceDetails = `Type: ${serviceOrderReq.productType || 'Visa'}${serviceOrderReq.groupLeaderName ? ` | Group: ${serviceOrderReq.groupLeaderName}` : ''}${serviceOrderReq.totalPeople ? ` (${serviceOrderReq.totalPeople} Pax)` : ''}`;

    const templateData = {
      receiptNo: receiptReq.number || '',
      receiptDate: receiptDateStr,
      payer: {
        name: receiptReq.payerName || clientReq.name || '',
        email: clientReq.email || '-',
        phone: clientReq.phone || '-',
        address: clientReq.address || '-',
      },
      invoice: {
        invoiceNo: invoiceReq?.number || '-',
        invoiceDate: invoiceReq?.issueDate ? formatDate(invoiceReq.issueDate) : '-',
      },
      hotelName: `Layanan ${productName}`,
      hotelAddress: serviceOrderReq.groupLeaderName ? `Group Leader: ${serviceOrderReq.groupLeaderName} (${serviceOrderReq.totalPeople || 1} Pax)` : '',
      terminBadge,
      isPaidFull,
      payments: [
        {
          label: paymentTitle,
          terminBadge,
          date: receiptDateStr,
          description: paymentDesc,
          details: serviceDetails,
          method: methodStr,
          transactionId: refNumber,
          amount: currentPaymentNum.toFixed(2),
        }
      ],
      totals: {
        invoiceAmount: totalInvoiceNum.toFixed(2),
        currentPaymentAmount: currentPaymentNum.toFixed(2),
        paidAmount: cumulativePaidNum.toFixed(2),
        balanceDue: balanceDueNum.toFixed(2),
      },
      bank: {
        bankName: receiptReq.bankName || 'Bank Syariah Indonesia',
        bankCountry: receiptReq.bankCountry || 'Indonesia',
        accountName: receiptReq.accountName || 'PT Thalhah Insan Rabbani',
        accountNumberOrIBAN: receiptReq.accountNumberOrIBAN || '7254459741',
      },
      notes: receiptReq.notes || serviceOrderReq.notes || '',
      brandName: 'Musafirin',
      logoBase64,
      saudiRiyalSVGBase64,
      signatureBase64,
    };

    const renderedHtml = template(templateData);
    await page.setContent(renderedHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    await page.close();
    return Buffer.from(pdf);
  } catch (error) {
    await page.close();
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
    const { readFileSync } = await import('fs');
    const Handlebars = (await import('handlebars')).default || (await import('handlebars'));
    const templatePath = getTemplatePath('kwitansi.html');
    const templateSource = readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    const logoBase64 = TemplateHelpers.getLogoBase64();
    const saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();

    let signatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    try {
      const signaturePath = getClientPublicPath('ttd.png');
      signatureBase64 = readFileSync(signaturePath).toString('base64');
    } catch (error) {
      console.warn('Signature image not found, using transparent fallback');
    }

    const totalInvoiceNum = parseFloat(receiptData.receipt?.totalAmount || '0');
    const currentPaymentNum = parseFloat(receiptData.receipt?.paidAmount || '0');
    const balanceDueNum = parseFloat(receiptData.receipt?.balanceDue || '0');

    let cumulativePaidNum = totalInvoiceNum - balanceDueNum;
    if (isNaN(cumulativePaidNum) || cumulativePaidNum < currentPaymentNum) {
      cumulativePaidNum = currentPaymentNum;
    }

    const terminNumber = receiptData.receipt?.meta?.termin || 1;
    const isPaidFull = balanceDueNum <= 0;
    let terminBadge = receiptData.receipt?.meta?.terminLabel || `Termin #${terminNumber}`;
    if (!receiptData.receipt?.meta?.terminLabel) {
      if (isPaidFull && terminNumber === 1) {
        terminBadge = 'Pelunasan (Lunas Penuh)';
      } else if (isPaidFull) {
        terminBadge = `Termin #${terminNumber} (Pelunasan)`;
      } else if (terminNumber === 1) {
        terminBadge = 'Termin #1 (Uang Muka / DP)';
      }
    }

    const paymentMethod = receiptData.receipt?.meta?.payment?.method === 'deposit' ? 'Saldo Deposit' : 'Transfer Bank';
    const transactionId = receiptData.receipt?.meta?.payment?.referenceNumber || '-';
    const description = receiptData.receipt?.meta?.payment?.description || receiptData.receipt?.notes || '';

    const hotelDetails = {
      name: receiptData.booking?.hotelName || receiptData.hotel?.name || '',
      checkIn: receiptData.booking?.checkIn || '',
      checkOut: receiptData.booking?.checkOut || '',
      roomSummary: receiptData.booking?.roomSummary || '',
    };

    const templateData = {
      receiptNo: receiptData.receipt?.number || '',
      receiptDate: receiptData.receipt?.issueDate || '',
      payer: {
        name: receiptData.payer?.name || '',
        email: receiptData.payer?.email || '',
        phone: receiptData.payer?.phone || '',
        address: receiptData.payer?.address || '',
      },
      invoice: {
        invoiceNo: receiptData.receipt?.number || '',
        invoiceDate: receiptData.receipt?.issueDate || '',
      },
      hotelName: receiptData.booking?.hotelName || receiptData.hotel?.name || '',
      hotelAddress: receiptData.hotel?.address || '',
      terminBadge,
      isPaidFull,
      payments: [
        {
          label: 'Pembayaran Hotel',
          terminBadge,
          date: receiptData.receipt?.issueDate || '',
          description,
          hotelDetails,
          method: paymentMethod,
          transactionId,
          amount: currentPaymentNum.toFixed(2),
        }
      ],
      totals: {
        invoiceAmount: totalInvoiceNum.toFixed(2),
        currentPaymentAmount: currentPaymentNum.toFixed(2),
        paidAmount: cumulativePaidNum.toFixed(2),
        balanceDue: balanceDueNum.toFixed(2),
      },
      bank: {
        bankName: receiptData.bank?.name || 'Bank Syariah Indonesia',
        bankCountry: receiptData.bank?.country || 'Indonesia',
        accountName: receiptData.bank?.accountName || 'PT Thalhah Insan Rabbani',
        accountNumberOrIBAN: receiptData.bank?.accountNumber || '7254459741',
      },
      notes: receiptData.receipt?.notes || '',
      brandName: receiptData.brand?.name || 'Musafirin',
      logoBase64,
      saudiRiyalSVGBase64,
      signatureBase64,
    };

    const renderedHtml = template(templateData);
    await page.setContent(renderedHtml, { waitUntil: 'networkidle0' });

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

    await page.close();

    // Upload to MinIO
    const fileName = `receipts/${receiptData.receipt.number}.pdf`;
    const pdfUrl = await uploadToMinio(fileName, Buffer.from(pdf));

    return pdfUrl;
  } catch (error) {
    await page.close();
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
  let page;
  try {
    const browser = await launchBrowser();
    page = await browser.newPage();
  } catch (err) {
    console.warn('Browser crashed, restarting for service order invoice PDF...');
    if (browserInstance) {
      try { await browserInstance.close(); } catch (e) {}
      browserInstance = null;
    }
    const browser = await launchBrowser();
    page = await browser.newPage();
  }

  try {
    const templatePath = getTemplatePath('invoice-visa.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    // Get Logo base64 and Saudi Riyal SVG icon base64
    const logoBase64 = TemplateHelpers.getLogoBase64();
    const saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();

    // Calculate amounts
    const totalAmount = parseFloat(serviceOrder.totalAmount || serviceOrder.totalPriceSAR || invoice.amount || '0') || 0;
    const subtotal = totalAmount;
    const discount = 0;
    const grandTotal = subtotal - discount;

    // Fetch payments associated with this invoice if available
    let paidAmount = parseFloat(invoice.paidAmount != null ? invoice.paidAmount.toString() : '0') || 0;
    let paymentsList: any[] = [];
    if (invoice.id) {
      try {
        const { db } = await import('../db');
        const { serviceOrderInvoicePayments } = await import('../db/schema');
        const { eq, asc } = await import('drizzle-orm');
        const pRows = await db
          .select()
          .from(serviceOrderInvoicePayments)
          .where(eq(serviceOrderInvoicePayments.invoiceId, invoice.id))
          .orderBy(asc(serviceOrderInvoicePayments.paidAt));
        if (pRows && pRows.length > 0) {
          paymentsList = pRows.map(p => ({
            date: p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB') : '-',
            method: p.method === 'deposit' ? 'Saldo Deposit' : 'Transfer Bank',
            transactionId: p.referenceNumber || '-',
            amount: parseFloat(p.amount || '0').toFixed(2),
          }));
          const totalFromPayments = pRows.reduce((sum, p) => sum + (parseFloat(p.amount || '0') || 0), 0);
          if (totalFromPayments > paidAmount) {
            paidAmount = totalFromPayments;
          }
        }
      } catch (err) {
        console.warn('Could not query payments for service order invoice PDF:', err);
      }
    }

    const balanceDue = Math.max(0, grandTotal - paidAmount);
    const isPaidFull = balanceDue <= 0.001 && grandTotal > 0;
    const isPartial = paidAmount > 0 && !isPaidFull;

    // Fetch live USD to IDR rate (visa uses USD, not SAR)
    let hasExchangeRate = false;
    let grandTotalIdr = '';
    let balanceDueIdr = '';
    let exchangeRateValue = '';
    let exchangeRateSource = 'BCA Bank Notes - Jual';
    try {
      const { getCurrentUsdToIdrRate, formatIdr } = await import('../services/ExchangeRateService');
      const rateData = await getCurrentUsdToIdrRate();
      const rate = rateData.rate;
      grandTotalIdr = formatIdr(Math.round(grandTotal * rate));
      balanceDueIdr = formatIdr(Math.round(balanceDue * rate));
      exchangeRateValue = new Intl.NumberFormat('id-ID').format(rate);
      hasExchangeRate = true;
    } catch (err) {
      console.warn('Could not fetch USD exchange rate for visa invoice IDR display:', err);
    }

    // Dynamic terms configuration from InvoiceTermsService
    let termsTitle = 'Ketentuan Visa';
    let termsHtml = '';
    let termsList: string[] = [];
    try {
      const { InvoiceTermsService } = await import('../services/InvoiceTermsService');
      const termsConfig = await InvoiceTermsService.getByType('visa');
      termsTitle = termsConfig.title || 'Ketentuan Visa';
      termsHtml = termsConfig.termsHtml;
      termsList = termsConfig.terms;
    } catch (err) {
      console.warn('Could not fetch dynamic invoice terms for visa:', err);
    }

    // Product name and items
    const productType = serviceOrder.productType || 'visa_umrah';
    let productName = 'Visa Umrah';
    if (productType === 'siskopatuh') {
      productName = 'Siskopatuh';
    } else if (productType.includes('visa')) {
      productName = 'Visa Umrah';
    } else {
      productName = String(productType);
    }

    const totalPeople = parseInt(serviceOrder.totalPeople) || 1;
    const unitPrice = totalPeople > 0 ? (totalAmount / totalPeople) : totalAmount;

    const items = [
      {
        no: 1,
        name: productName,
        description: serviceOrder.servicePackage ? `Paket: ${serviceOrder.servicePackage}` : 'Penerbitan Visa Umrah Elektronik',
        notes: serviceOrder.groupLeaderName ? `Penanggung Jawab Grup: ${serviceOrder.groupLeaderName}` : '',
        pax: totalPeople,
        unitPrice: unitPrice.toFixed(2),
        lineTotal: totalAmount.toFixed(2)
      }
    ];

    // Format dates (DD/MM/YYYY)
    const formatDate = (date: any) => {
      if (!date) return '-';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-GB');
    };

    const templateData = {
      // Header
      invoiceNo: invoice.number,
      invoiceDate: formatDate(customInvoiceDate || invoice.issueDate || invoice.createdAt || new Date()),
      dueDate: formatDate(customDueDate || invoice.dueDate || new Date()),

      // Provider
      company: {
        name: 'PT Thalhah Insan Rabbani',
        brand: 'Musafirin of Baitullah',
        email: 'billing@musafirin.com',
        phone: '+6285218300910'
      },

      // Client
      client: {
        name: client.name || 'Pelanggan',
        company: client.company || '',
        email: client.email || '-',
        phone: client.phone || '-',
        address: client.address || ''
      },

      // Service Order summary
      orderNo: serviceOrder.number || '-',
      productName,
      groupLeaderName: serviceOrder.groupLeaderName || '',
      totalPeople,
      isPaidFull,
      isPartial,

      // Items & Totals
      items,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      balanceDue: balanceDue.toFixed(2),

      // Exchange Rate (SAR to IDR)
      hasExchangeRate,
      grandTotalIdr,
      balanceDueIdr,
      exchangeRateValue,
      exchangeRateSource,

      // Payments history
      payments: paymentsList,

      // Bank Details
      bank: {
        bankName: 'Bank Syariah Indonesia',
        bankCountry: 'Indonesia',
        accountName: 'PT Thalhah Insan Rabbani',
        accountNumberOrIBAN: '7254459741'
      },

      // Contact info
      billingContact: {
        email: 'billing@musafirin.com',
        phone: '+6285218300910'
      },

      // Brand
      brandName: 'Musafirin',
      brandTagline: 'We are musafirin of Baitullah',

      // Dynamic Terms
      termsTitle,
      termsHtml,
      termsList,

      // Assets
      logoBase64,
      saudiRiyalSVGBase64
    };

    const renderedHtml = template(templateData);
    await page.setContent(renderedHtml);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '8mm',
        right: '10mm',
        bottom: '8mm',
        left: '10mm'
      }
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
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
    const templatePath = getTemplatePath('transportation-invoice.html');
    const templateHtml = readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateHtml);

    // Load logo base64
    const logoBase64 = TemplateHelpers.getLogoBase64();

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

    // Load dynamic terms & conditions setting
    try {
      const { InvoiceTermsService } = await import('../services/InvoiceTermsService');
      const termsConfig = await InvoiceTermsService.getByType('transportation');
      (templateData as any).termsTitle = termsConfig.title || 'Syarat & Ketentuan';
      (templateData as any).termsHtml = termsConfig.termsHtml;
    } catch (err) {
      console.warn('Failed to load dynamic terms for transportation invoice:', err);
    }

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

    await page.close();
    return Buffer.from(pdf);
  } catch (error) {
    await page.close();
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
    const templatePath = getTemplatePath('transportation-receipt.html');
    const templateHtml = readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateHtml);

    // Load logo base64
    const logoBase64 = TemplateHelpers.getLogoBase64();

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
    const totalAmount = parseFloat(receipt.totalAmount || invoice?.amount || booking.totalAmount || '0');
    const currentPayment = parseFloat(receipt.paidAmount || '0');
    const balanceDue = parseFloat(receipt.balanceDue || '0');
    let cumulativePaid = totalAmount - balanceDue;
    if (isNaN(cumulativePaid) || cumulativePaid < currentPayment) {
      cumulativePaid = currentPayment;
    }

    const terminNumber = receipt.meta?.termin || 1;
    const isPaidFull = balanceDue <= 0;
    let terminBadge = receipt.meta?.terminLabel || `Termin #${terminNumber}`;
    if (!receipt.meta?.terminLabel) {
      if (isPaidFull && terminNumber === 1) {
        terminBadge = 'Pelunasan (Lunas Penuh)';
      } else if (isPaidFull) {
        terminBadge = `Termin #${terminNumber} (Pelunasan)`;
      } else if (terminNumber === 1) {
        terminBadge = 'Termin #1 (Uang Muka / DP)';
      }
    }

    // ToWords functionality (simplified for transportation or import from elsewhere if needed)
    // For now, using a placeholder or a simple toString
    const amountInWords = receipt.amountInWords || `${currentPayment.toFixed(2)} SAR Only`;

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
      terminBadge,
      isPaidFull,
      payments: [
        {
          label: 'Pembayaran Transportasi',
          terminBadge,
          date: formatDate(receipt.issueDate || receipt.createdAt || new Date()),
          method: receipt.meta?.method || 'Transfer Bank',
          transactionId: receipt.meta?.referenceNumber || '-',
          amount: currentPayment.toFixed(2),
          transportationDetails: null
        }
      ],
      totalInvoiceAmount: totalAmount.toFixed(2),
      currentPaymentAmount: currentPayment.toFixed(2),
      totalPaidAmount: cumulativePaid.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
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

    await page.close();
    return Buffer.from(pdf);
  } catch (error) {
    await page.close();
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
    const templatePath = getTemplatePath('transportation-voucher.html');
    let templateHtml = '';
    try {
      templateHtml = readFileSync(templatePath, 'utf-8');
    } catch {
      console.warn('transportation-voucher.html not found, falling back to voucher.html');
      templateHtml = readFileSync(join(process.cwd(), 'src', 'templates', 'voucher.html'), 'utf-8');
    }
    const template = Handlebars.compile(templateHtml);

    const logoBase64 = TemplateHelpers.getLogoBase64();

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

    await page.close();
    return Buffer.from(pdf);
  } catch (error) {
    await page.close();
    throw error;
  }
}


export async function generateCustomLaInvoicePDF(
  invoiceData: any
): Promise<string> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const templatePath = path.join(__dirname, '../templates/custom-la-invoice.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    const logoPath = path.join(__dirname, '../templates/logomusafirin.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    // Default bank if not provided
    const defaultBank = {
      bankName: 'Bank Syariah Indonesia',
      bankCountry: 'Indonesia',
      accountName: 'PT Thalhah Insan Rabbani',
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
    await page.close();
  }
}

export async function generateCustomLaReceiptPDF(
  receiptData: any
): Promise<string> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const templatePath = getTemplatePath('custom-la-receipt.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    const logoBase64 = TemplateHelpers.getLogoBase64();
    const saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();

    const totalInvoiceNum = parseFloat(receiptData.totals?.invoiceAmount || receiptData.totalAmount || '0');
    const currentPaymentNum = parseFloat(receiptData.totals?.currentPaymentAmount || receiptData.paidAmount || '0');
    const balanceDueNum = parseFloat(receiptData.totals?.balanceDue || receiptData.balanceDue || '0');
    let cumulativePaidNum = parseFloat(receiptData.totals?.totalPaidAmount || '0');
    if (isNaN(cumulativePaidNum) || cumulativePaidNum <= 0) {
      cumulativePaidNum = totalInvoiceNum - balanceDueNum;
    }
    if (isNaN(cumulativePaidNum) || cumulativePaidNum < currentPaymentNum) {
      cumulativePaidNum = currentPaymentNum;
    }

    const terminNumber = receiptData.termin || 1;
    const isPaidFull = balanceDueNum <= 0;
    let terminBadge = receiptData.terminBadge || `Termin #${terminNumber}`;
    if (!receiptData.terminBadge) {
      if (isPaidFull && terminNumber === 1) {
        terminBadge = 'Pelunasan (Lunas Penuh)';
      } else if (isPaidFull) {
        terminBadge = `Termin #${terminNumber} (Pelunasan)`;
      } else if (terminNumber === 1) {
        terminBadge = 'Termin #1 (Uang Muka / DP)';
      }
    }

    const data = {
      ...receiptData,
      logoBase64,
      saudiRiyalSVGBase64,
      brandName: 'Musafirin',
      terminBadge,
      isFullyPaid: isPaidFull,
      totals: {
        invoiceAmount: totalInvoiceNum.toFixed(2),
        currentPaymentAmount: currentPaymentNum.toFixed(2),
        totalPaidAmount: cumulativePaidNum.toFixed(2),
        balanceDue: balanceDueNum.toFixed(2),
      }
    };

    const html = template(data);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    const fileName = `receipts/${receiptData.receiptNo}.pdf`;
    const pdfUrl = await uploadToMinio(fileName, Buffer.from(pdf), 'application/pdf');

    return pdfUrl;
  } finally {
    await page.close();
  }
}

export async function generateMuthowifInvoicePDF(
  invoiceData: any
): Promise<string> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const templatePath = path.join(__dirname, '../templates/muthowif-invoice.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    const logoPath = path.join(__dirname, '../templates/logomusafirin.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    const defaultBank = {
      bankName: 'Bank Syariah Indonesia',
      bankCountry: 'Indonesia',
      accountName: 'PT Thalhah Insan Rabbani',
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
      `invoices/${fileName}`,
      fileStream,
      fs.statSync(tempFilePath).size,
      { 'Content-Type': 'application/pdf' }
    );

    fs.unlinkSync(tempFilePath);

    const isLocal = (process.env.MINIO_ENDPOINT || 'localhost').includes('localhost') || (process.env.MINIO_ENDPOINT || 'localhost').includes('127.0.0.1');
    const endpoint = isLocal ? 'localhost:9000' : (process.env.MINIO_ENDPOINT || 'localhost');
    return `http://${endpoint}/${(process.env.MINIO_BUCKET || 'musafirin-assets')}/invoices/${fileName}`;
  } finally {
    await page.close();
  }
}

export async function generateMuthowifReceiptPDF(
  receiptData: any
): Promise<string> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const templatePath = path.join(__dirname, '../templates/muthowif-receipt.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    const logoBase64 = TemplateHelpers.getLogoBase64();
    const saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();
    let signatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    try {
      const signaturePath = path.join(__dirname, '../../../client/public/ttd.png');
      if (fs.existsSync(signaturePath)) signatureBase64 = fs.readFileSync(signaturePath).toString('base64');
    } catch (e) { }

    const totalInvoiceNum = parseFloat(receiptData.invoice?.amount || receiptData.totalAmount || '0');
    const currentPaymentNum = parseFloat(receiptData.paidAmount || receiptData.totalAmount || '0');
    const balanceDueNum = parseFloat(receiptData.balanceDue || '0');
    let cumulativePaidNum = totalInvoiceNum - balanceDueNum;
    if (isNaN(cumulativePaidNum) || cumulativePaidNum < currentPaymentNum) {
      cumulativePaidNum = currentPaymentNum;
    }

    const terminNumber = receiptData.termin || receiptData.meta?.termin || 1;
    const isPaidFull = balanceDueNum <= 0;
    let terminBadge = receiptData.terminLabel || receiptData.meta?.terminLabel || `Termin #${terminNumber}`;
    if (!receiptData.meta?.terminLabel && !receiptData.terminLabel) {
      if (isPaidFull && terminNumber === 1) {
        terminBadge = 'Pelunasan (Lunas Penuh)';
      } else if (isPaidFull) {
        terminBadge = `Termin #${terminNumber} (Pelunasan)`;
      } else if (terminNumber === 1) {
        terminBadge = 'Termin #1 (Uang Muka / DP)';
      }
    }

    // Provide the structure expected by kwitansi.html
    const data = {
      receiptNo: receiptData.receiptNo,
      receiptDate: receiptData.receiptDate,
      payer: {
        name: receiptData.client?.name || receiptData.guestName,
        email: receiptData.client?.email || '-',
        phone: receiptData.client?.phone || '-',
        address: receiptData.client?.address || '-'
      },
      invoice: {
        invoiceNo: receiptData.invoice?.number || '-',
        invoiceDate: receiptData.invoice?.issueDate ? new Date(receiptData.invoice.issueDate).toLocaleDateString('id-ID') : '-'
      },
      hotelName: 'Muthowif Order',
      hotelAddress: receiptData.meetingPoint || '-',
      terminBadge,
      isPaidFull,
      payments: [
        {
          label: 'Layanan Muthowif',
          terminBadge,
          date: receiptData.receiptDate,
          hotelDetails: {
            name: receiptData.events ? receiptData.events.join(', ') : 'Pemesanan Muthowif',
            checkIn: receiptData.dateTime,
            checkOut: '-',
            roomSummary: receiptData.guestName + ' (' + receiptData.totalPax + ' Pax)'
          },
          method: receiptData.paymentMethod || 'Transfer Bank',
          transactionId: receiptData.transactionId || '-',
          amount: currentPaymentNum.toFixed(2)
        }
      ],
      saudiRiyalSVGBase64,
      totals: {
        invoiceAmount: totalInvoiceNum.toFixed(2),
        currentPaymentAmount: currentPaymentNum.toFixed(2),
        paidAmount: cumulativePaidNum.toFixed(2),
        balanceDue: balanceDueNum.toFixed(2)
      },
      amountInWords: '',
      bank: {
        bankName: "Bank Syariah Indonesia",
        bankCountry: "Indonesia",
        accountName: "PT Thalhah Insan Rabbani",
        accountNumberOrIBAN: "7290382041"
      },
      notes: '',
      signatureBase64,
      brandName: 'Musafirin',
      logoBase64
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
    await page.close();
  }
}

export async function generateMuthowifVoucherPDF(
  voucherData: any
): Promise<string> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const templatePath = path.join(__dirname, '../templates/muthowif-voucher.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    const logoPath = path.join(__dirname, '../templates/logomusafirin.png');
    const logoBase64 = fs.readFileSync(logoPath, 'base64');

    const data = {
      ...voucherData,
      logoBase64,
      brandName: 'Musafirin'
    };

    const html = template(data);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const fileName = `${voucherData.voucherNo}.pdf`;
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
      `vouchers/${fileName}`,
      fileStream,
      fs.statSync(tempFilePath).size,
      { 'Content-Type': 'application/pdf' }
    );

    fs.unlinkSync(tempFilePath);

    const isLocal = (process.env.MINIO_ENDPOINT || 'localhost').includes('localhost') || (process.env.MINIO_ENDPOINT || 'localhost').includes('127.0.0.1');
    const endpoint = isLocal ? 'localhost:9000' : (process.env.MINIO_ENDPOINT || 'localhost');
    return `http://${endpoint}/${(process.env.MINIO_BUCKET || 'musafirin-assets')}/vouchers/${fileName}`;
  } finally {
    await page.close();
  }
}

export async function generateAgentRequestInvoicePDF(
  invoiceData: any,
  agentRequestData: any
): Promise<string> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const templateName = 'agent-request-invoice.html';
    const templatePath = getTemplatePath(templateName);
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    const template = Handlebars.compile(templateHtml);
    const logoPath = getTemplatePath('logomusafirin.png');
    const logoBase64 = fs.readFileSync(logoPath).toString('base64');

    const currency = agentRequestData.currency || "SAR";
    const formattedAmount = Number(agentRequestData.totalAmount || invoiceData.amount || 0).toLocaleString("id-ID");

    const invoiceDataForTemplate = {
      invoiceNo: invoiceData.number,
      date: invoiceData.issueDate ? new Date(invoiceData.issueDate).toLocaleDateString("id-ID") : new Date().toLocaleDateString("id-ID"),
      dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString("id-ID") : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("id-ID"),
      agentName: "Agent Request",
      totalAmount: invoiceData.amount || 0,
      description: agentRequestData.title || "Agent Service Request",
      currency,
      formattedAmount,
      logoBase64
    };

    const html = template(invoiceDataForTemplate);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const fileName = `${invoiceData.number}.pdf`;
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, fileName);

    await page.pdf({
      path: tempFilePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });

    return tempFilePath;
  } catch (error) {
    console.error('Failed to generate agent request invoice PDF:', error);
    throw error;
  } finally {
    await page.close();
  }
}

// Generate Manual Invoice PDF
export async function generateManualInvoicePDF(
  manualInvoice: any
): Promise<string> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const templatePath = path.join(import.meta.dir, '../templates/manual-invoice.html');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);

    let logoBase64 = '';
    try {
      logoBase64 = TemplateHelpers.getLogoBase64();
    } catch {
      const logoPath = path.join(import.meta.dir, '../templates/logomusafirin.png');
      if (fs.existsSync(logoPath)) {
        logoBase64 = fs.readFileSync(logoPath, 'base64');
      }
    }

    let saudiRiyalSVGBase64 = '';
    try {
      saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();
    } catch {
      saudiRiyalSVGBase64 = '';
    }

    const defaultBank = {
      bankName: 'Bank Syariah Indonesia',
      bankCountry: 'Indonesia',
      accountName: 'PT. Thalhah Insan Rabbani',
      accountNumberOrIBAN: '7254459741'
    };

    const currency = manualInvoice.currency || 'SAR';
    const subtotal = parseFloat(manualInvoice.amount) || 0;

    // Fetch payments associated with this manual invoice
    let paymentsList: any[] = manualInvoice.payments || [];
    if ((!paymentsList || paymentsList.length === 0) && manualInvoice.id) {
      try {
        const { db } = await import('../db');
        const { manualInvoicePayments } = await import('../db/schema');
        const { eq, asc } = await import('drizzle-orm');
        paymentsList = await db
          .select()
          .from(manualInvoicePayments)
          .where(eq(manualInvoicePayments.manualInvoiceId, manualInvoice.id))
          .orderBy(asc(manualInvoicePayments.paidAt));
      } catch (err) {
        console.warn('Could not query payments for manual invoice PDF:', err);
      }
    }

    const paidAmount = paymentsList.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
    const balanceDue = Math.max(0, subtotal - paidAmount);
    const isPaidFull = balanceDue <= 0.001 && subtotal > 0;
    const isPartial = paidAmount > 0 && !isPaidFull;

    // Fetch live SAR to IDR rate
    let hasExchangeRate = false;
    let grandTotalIdr = '';
    let balanceDueIdr = '';
    let exchangeRateValue = '';
    let exchangeRate = 0;
    try {
      const { getCurrentSarToIdrRate, formatIdr } = await import('../services/ExchangeRateService');
      const rateData = await getCurrentSarToIdrRate();
      exchangeRate = rateData.rate;
      grandTotalIdr = formatIdr(Math.round(subtotal * exchangeRate));
      balanceDueIdr = formatIdr(Math.round(balanceDue * exchangeRate));
      exchangeRateValue = new Intl.NumberFormat('id-ID').format(exchangeRate);
      hasExchangeRate = true;
    } catch (err) {
      console.warn('Failed to fetch exchange rate for manual invoice PDF:', err);
    }

    // Build dynamic payment schedule (termin pembayaran) based on configured paymentTerms or default 3-term policy (60% / 20% / 20%)
    const { formatIdr } = await import('../services/ExchangeRateService');
    const paymentSchedule: any[] = [];

    let configuredTerms: any[] = manualInvoice.paymentTerms;
    if (!Array.isArray(configuredTerms) || configuredTerms.length === 0) {
      const term1Amount = Math.round(subtotal * 0.60 * 100) / 100;
      const term2Amount = Math.round(subtotal * 0.20 * 100) / 100;
      const term3Amount = Math.round((subtotal - term1Amount - term2Amount) * 100) / 100;
      const issueDate = manualInvoice.issueDate ? new Date(manualInvoice.issueDate) : new Date();
      const dueDate = manualInvoice.dueDate ? new Date(manualInvoice.dueDate) : new Date();
      const diffTime = Math.max(0, dueDate.getTime() - issueDate.getTime());
      const midDate = new Date(issueDate.getTime() + Math.round(diffTime * 0.5));

      configuredTerms = [
        {
          termNumber: 1,
          label: 'Termin #1 (Uang Muka / DP)',
          percentage: 60,
          amount: term1Amount,
          dueDate: issueDate.toISOString().split('T')[0],
        },
        {
          termNumber: 2,
          label: 'Termin #2',
          percentage: 20,
          amount: term2Amount,
          dueDate: midDate.toISOString().split('T')[0],
        },
        {
          termNumber: 3,
          label: 'Termin #3 (Pelunasan)',
          percentage: 20,
          amount: term3Amount,
          dueDate: dueDate.toISOString().split('T')[0],
        },
      ];
    }

    const totalPaidCount = paymentsList.length;
    let runningRemainingBalance = balanceDue;

    configuredTerms.forEach((term: any, idx: number) => {
      if (idx < totalPaidCount) {
        // Term has an actual recorded payment
        const p = paymentsList[idx];
        const pAmount = parseFloat(p.amount) || 0;
        const terminNum = p.meta?.termin || term.termNumber || (idx + 1);
        const isThisPaymentFull = isPaidFull && idx === totalPaidCount - 1;
        let terminLabel = p.meta?.terminLabel || term.label;
        if (!terminLabel) {
          if (isThisPaymentFull && terminNum === 1) {
            terminLabel = 'Pelunasan (Lunas Penuh)';
          } else if (isThisPaymentFull) {
            terminLabel = `Termin #${terminNum} (Pelunasan)`;
          } else if (terminNum === 1) {
            terminLabel = 'Termin #1 (Uang Muka / DP)';
          } else {
            terminLabel = `Termin #${terminNum}`;
          }
        }
        const pMeta = p.meta || {};
        const termMeta = term || {};
        // Locked IDR amount: check payment meta first, then term, then fallback to current exchange rate
        let termIdrText = '';
        if (pMeta.idrAmount && !isNaN(parseFloat(pMeta.idrAmount))) {
          termIdrText = formatIdr(Math.round(parseFloat(pMeta.idrAmount)));
        } else if (pMeta.exchangeRate && !isNaN(parseFloat(pMeta.exchangeRate))) {
          termIdrText = formatIdr(Math.round(pAmount * parseFloat(pMeta.exchangeRate)));
        } else if (termMeta.idrAmount && !isNaN(parseFloat(termMeta.idrAmount))) {
          termIdrText = formatIdr(Math.round(parseFloat(termMeta.idrAmount)));
        } else if (termMeta.exchangeRate && !isNaN(parseFloat(termMeta.exchangeRate))) {
          termIdrText = formatIdr(Math.round(pAmount * parseFloat(termMeta.exchangeRate)));
        } else if (exchangeRate > 0) {
          termIdrText = formatIdr(Math.round(pAmount * exchangeRate));
        }

        paymentSchedule.push({
          terminLabel,
          date: TemplateHelpers.formatDate(p.paidAt || p.createdAt || new Date()),
          method: (p.method || 'Bank Transfer').toUpperCase(),
          reference: p.referenceNumber || p.meta?.referenceNumber || '',
          amountFormatted: TemplateHelpers.formatCurrency(pAmount),
          amountIdr: termIdrText,
          isPaid: true,
          statusText: 'Lunas',
        });
      } else {
        // Term is pending/scheduled
        if (runningRemainingBalance > 0.001) {
          const isLastConfiguredTerm = idx === configuredTerms.length - 1;
          const plannedTermAmount = parseFloat(term.amount) || 0;
          const termAllocated = isLastConfiguredTerm
            ? runningRemainingBalance
            : Math.min(runningRemainingBalance, plannedTermAmount > 0 ? plannedTermAmount : Math.round((parseFloat(term.percentage || 0) / 100) * subtotal * 100) / 100);

          runningRemainingBalance = Math.max(0, runningRemainingBalance - termAllocated);

          let pendingIdrText = '';
          if (term.idrAmount && !isNaN(parseFloat(term.idrAmount))) {
            pendingIdrText = formatIdr(Math.round(parseFloat(term.idrAmount)));
          } else if (term.exchangeRate && !isNaN(parseFloat(term.exchangeRate))) {
            pendingIdrText = formatIdr(Math.round(termAllocated * parseFloat(term.exchangeRate)));
          } else if (exchangeRate > 0) {
            pendingIdrText = formatIdr(Math.round(termAllocated * exchangeRate));
          }

          paymentSchedule.push({
            terminLabel: term.label || `Termin #${term.termNumber || idx + 1}`,
            date: TemplateHelpers.formatDate(term.dueDate || manualInvoice.dueDate || new Date()),
            method: 'Menunggu Pembayaran',
            reference: '',
            amountFormatted: TemplateHelpers.formatCurrency(termAllocated),
            amountIdr: pendingIdrText,
            isPaid: false,
            statusText: 'Menunggu',
          });
        }
      }
    });

    // If there are extra payments beyond configured terms
    if (totalPaidCount > configuredTerms.length) {
      for (let i = configuredTerms.length; i < totalPaidCount; i++) {
        const p = paymentsList[i];
        const pAmount = parseFloat(p.amount) || 0;
        const pMeta = p.meta || {};
        let extraIdrText = '';
        if (pMeta.idrAmount && !isNaN(parseFloat(pMeta.idrAmount))) {
          extraIdrText = formatIdr(Math.round(parseFloat(pMeta.idrAmount)));
        } else if (pMeta.exchangeRate && !isNaN(parseFloat(pMeta.exchangeRate))) {
          extraIdrText = formatIdr(Math.round(pAmount * parseFloat(pMeta.exchangeRate)));
        } else if (exchangeRate > 0) {
          extraIdrText = formatIdr(Math.round(pAmount * exchangeRate));
        }
        paymentSchedule.push({
          terminLabel: p.meta?.terminLabel || `Termin #${i + 1}`,
          date: TemplateHelpers.formatDate(p.paidAt || p.createdAt || new Date()),
          method: (p.method || 'Bank Transfer').toUpperCase(),
          reference: p.referenceNumber || p.meta?.referenceNumber || '',
          amountFormatted: TemplateHelpers.formatCurrency(pAmount),
          amountIdr: extraIdrText,
          isPaid: true,
          statusText: 'Lunas',
        });
      }
    }

    const items = (manualInvoice.items || []).map((item: any, idx: number) => ({
      no: idx + 1,
      description: item.description,
      quantity: item.quantity,
      unitPriceFormatted: TemplateHelpers.formatCurrency(item.unitPrice),
      subtotalFormatted: TemplateHelpers.formatCurrency(item.subtotal),
      notes: item.notes || ''
    }));

    const data = {
      brandName: 'Musafirin',
      brandTagline: 'We are musafirin of Baitullah',
      logoBase64,
      saudiRiyalSVGBase64,
      invoiceNo: manualInvoice.number,
      invoiceDate: TemplateHelpers.formatDate(manualInvoice.issueDate),
      dueDate: TemplateHelpers.formatDate(manualInvoice.dueDate),
      status: (manualInvoice.status || 'DRAFT').toUpperCase(),
      isPaidFull,
      isPartial,
      title: manualInvoice.title || 'Tagihan Layanan',
      client: {
        name: manualInvoice.clientName,
        email: manualInvoice.clientEmail || '',
        phone: manualInvoice.clientPhone || '',
        address: manualInvoice.clientAddress || ''
      },
      currency,
      items,
      subtotal: TemplateHelpers.formatCurrency(subtotal),
      grandTotal: TemplateHelpers.formatCurrency(subtotal),
      paidAmount: TemplateHelpers.formatCurrency(paidAmount),
      balanceDue: TemplateHelpers.formatCurrency(balanceDue),
      hasExchangeRate,
      grandTotalIdr,
      balanceDueIdr,
      exchangeRateValue,
      paymentSchedule,
      notes: manualInvoice.notes || '',
      bank: defaultBank,
      billingContact: {
        email: 'finance@musafirin.co',
        phone: '+966 539 101 812'
      },
      termsTitle: 'Ketentuan Pemesanan',
      termsHtml: '',
    };

    try {
      const { InvoiceTermsService } = await import('../services/InvoiceTermsService');
      const termsConfig = await InvoiceTermsService.getByType('manual');
      data.termsTitle = termsConfig.title || 'Ketentuan Pemesanan';
      data.termsHtml = termsConfig.termsHtml;
    } catch (err) {
      console.warn('Failed to load terms for manual invoice PDF:', err);
    }

    const html = template(data);
    await page.setContent(html);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    const pdfUrl = await uploadToMinio(
      `invoices/${manualInvoice.number}.pdf`,
      Buffer.from(pdfBuffer),
      'application/pdf'
    );

    return pdfUrl;
  } catch (error) {
    console.error('Error generating manual invoice PDF:', error);
    throw error;
  } finally {
    await page.close();
  }
}

// Generate Manual Invoice Receipt PDF
export async function generateManualInvoiceReceiptPDF(
  receiptReq: any,
  manualInvoiceReq: any,
  clientReq?: any
): Promise<Buffer> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    const { readFileSync } = await import('fs');
    const Handlebars = (await import('handlebars')).default || (await import('handlebars'));

    const templatePath = getTemplatePath('kwitansi.html');
    const templateSource = readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);

    const logoBase64 = TemplateHelpers.getLogoBase64();
    const saudiRiyalSVGBase64 = TemplateHelpers.getSaudiRiyalSVGBase64();

    let signatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    try {
      const signaturePath = getClientPublicPath('ttd.png');
      signatureBase64 = readFileSync(signaturePath).toString('base64');
    } catch (e) {
      console.warn('Signature image not found, using transparent fallback');
    }

    const formatDate = (date: any) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-GB');
    };

    const receiptDateStr = formatDate(receiptReq.issueDate || receiptReq.createdAt || new Date());

    const totalInvoiceNum = parseFloat(receiptReq.totalAmount || manualInvoiceReq?.amount || '0');
    const currentPaymentNum = parseFloat(receiptReq.paidAmount || '0');
    const balanceDueNum = parseFloat(receiptReq.balanceDue || '0');

    let cumulativePaidNum = totalInvoiceNum - balanceDueNum;
    if (isNaN(cumulativePaidNum) || cumulativePaidNum < currentPaymentNum) {
      cumulativePaidNum = currentPaymentNum;
    }

    const terminNumber = receiptReq.meta?.termin || 1;
    const isPaidFull = balanceDueNum <= 0;
    let terminBadge = receiptReq.meta?.terminLabel || `Termin #${terminNumber}`;
    if (!receiptReq.meta?.terminLabel) {
      if (isPaidFull && terminNumber === 1) {
        terminBadge = 'Pelunasan (Lunas Penuh)';
      } else if (isPaidFull) {
        terminBadge = `Termin #${terminNumber} (Pelunasan)`;
      } else if (terminNumber === 1) {
        terminBadge = 'Termin #1 (Uang Muka / DP)';
      }
    }

    const invoiceTitle = manualInvoiceReq?.title || 'Invoice Manual';
    const paymentTitle = `Pembayaran ${invoiceTitle}`;
    const paymentDesc = receiptReq.meta?.description || manualInvoiceReq?.notes || '';
    const refNumber = receiptReq.meta?.referenceNumber || '-';
    const rawMethod = receiptReq.meta?.paymentMethod || receiptReq.meta?.method || 'bank_transfer';
    const methodStr = rawMethod === 'deposit' ? 'Saldo Deposit' : rawMethod === 'cash' ? 'Tunai / Cash' : 'Transfer Bank';

    const itemsSummary = Array.isArray(manualInvoiceReq?.items)
      ? manualInvoiceReq.items.map((i: any) => `${i.description} (${i.quantity}x)`).join(', ')
      : '';

    const receiptMeta = receiptReq.meta || {};
    let idrAmountText = '';
    let exchangeRateText = '';
    if (receiptMeta.idrAmount && !isNaN(parseFloat(receiptMeta.idrAmount))) {
      idrAmountText = new Intl.NumberFormat('id-ID').format(Math.round(parseFloat(receiptMeta.idrAmount)));
    }
    if (receiptMeta.exchangeRate && !isNaN(parseFloat(receiptMeta.exchangeRate))) {
      exchangeRateText = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(parseFloat(receiptMeta.exchangeRate));
    }

    const templateData = {
      receiptNo: receiptReq.number || '',
      receiptDate: receiptDateStr,
      payer: {
        name: receiptReq.payerName || manualInvoiceReq?.clientName || clientReq?.name || '',
        email: receiptReq.payerEmail || manualInvoiceReq?.clientEmail || clientReq?.email || '-',
        phone: receiptReq.payerPhone || manualInvoiceReq?.clientPhone || clientReq?.phone || '-',
        address: receiptReq.payerAddress || manualInvoiceReq?.clientAddress || clientReq?.address || '-',
      },
      invoice: {
        invoiceNo: manualInvoiceReq?.number || '-',
        invoiceDate: manualInvoiceReq?.issueDate ? formatDate(manualInvoiceReq.issueDate) : '-',
      },
      hotelName: invoiceTitle,
      hotelAddress: itemsSummary ? `Layanan: ${itemsSummary}` : '',
      terminBadge,
      isPaidFull,
      idrAmountText,
      exchangeRateText,
      payments: [
        {
          label: paymentTitle,
          terminBadge,
          date: receiptDateStr,
          description: paymentDesc,
          details: itemsSummary ? `Rincian: ${itemsSummary}` : '',
          method: methodStr,
          transactionId: refNumber,
          amount: currentPaymentNum.toFixed(2),
        }
      ],
      totals: {
        invoiceAmount: totalInvoiceNum.toFixed(2),
        currentPaymentAmount: currentPaymentNum.toFixed(2),
        paidAmount: cumulativePaidNum.toFixed(2),
        balanceDue: balanceDueNum.toFixed(2),
      },
      bank: {
        bankName: 'Bank Syariah Indonesia',
        bankCountry: 'Indonesia',
        accountName: 'PT Thalhah Insan Rabbani',
        accountNumberOrIBAN: '7254459741',
      },
      notes: receiptReq.notes || manualInvoiceReq?.notes || '',
      brandName: 'Musafirin',
      logoBase64,
      saudiRiyalSVGBase64,
      signatureBase64,
    };

    const renderedHtml = template(templateData);
    await page.setContent(renderedHtml, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    return Buffer.from(pdf);
  } catch (error) {
    console.error('Error generating manual invoice receipt PDF:', error);
    throw error;
  } finally {
    await page.close();
  }
}


