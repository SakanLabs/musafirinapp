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

  // We need to get booking items for the voucher template
  // For now, we'll create a mock array - this should be passed as parameter in real implementation
  const mockBookingItems = [
    {
      roomType: 'Standard Room', // This should come from actual booking items
      roomCount: 1,
      unitPrice: booking.totalAmount.toString(),
    }
  ];

  // Prepare data for template
  const templateData = TemplateHelpers.prepareVoucherData(voucher, booking, client, mockBookingItems, qrCodeDataURL);
  
  // Render HTML using template engine
  const html = templateEngine.renderVoucher(templateData);

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