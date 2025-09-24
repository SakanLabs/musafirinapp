import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { Client as MinioClient } from 'minio';
import type { Booking, Invoice, Voucher, Client } from '../db/schema';
import { templateEngine, TemplateHelpers } from './template';

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
  customInvoiceDate?: Date | string
): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Prepare data for template
  const templateData = TemplateHelpers.prepareInvoiceData(invoice, booking, client, bookingItems, customDueDate, customInvoiceDate);
  
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
  qrCodeDataURL: string
): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
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
   function formatDate(date: Date | string | undefined): string {
     if (!date) return '';
     if (typeof date === 'string') return date;
     return (date as Date).toISOString().split('T')[0];
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
    logoBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", // Placeholder

    // Voucher info
    voucherNo: voucher.number,
    issueDate: formatDate(new Date()),
    paymentType: "Prepaid",
    isPayAtHotel: false,
    hotelConfirmationNo: booking.hotelConfirmationNo || '',
    supplierRef: booking.code,

    // Hotel info
    hotelName: booking.hotelName,
    hotelAddress: `${booking.city}, Saudi Arabia`,
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

    // Stay details
     checkIn: formatDate(booking.checkIn || new Date()),
     checkOut: formatDate(booking.checkOut || new Date()),
    policyCheckInTime: "15:00",
    policyCheckOutTime: "12:00",
    nights: calculateNights(booking.checkIn, booking.checkOut),
    rooms: 1, // Default to 1, should be calculated from booking items
    adults: 2, // Default to 2, should be calculated from booking items
    children: 0, // Default to 0, should be calculated from booking items

    // Room details - mock data for now
    roomsDetail: [
      {
        roomType: 'Standard Room',
        mealPlan: 'Room Only',
        quantity: 1,
        occupancy: '2A',
        remarks: '-'
      }
    ],

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
    supportPhone: "+966-5XXXXXXX"
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