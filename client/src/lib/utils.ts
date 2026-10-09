import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currency formatting
export function formatCurrency(amount: number | string, currency: string = 'SAR'): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '-';
  
  if (currency === 'SAR') {
    // Format SAR with custom symbol
    return `SAR ${formatSAR(numAmount)}`;
  }
  
  if (currency === 'IDR') {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(numAmount);
}

// Format SAR with custom symbol - only replace currency symbol, keep Latin numbers
export function formatSAR(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '-';
  
  // Format number with standard locale but replace $ with SAR symbol
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
  
  return formattedNumber;
}

// Date formatting
export function formatDate(date: string | Date, format: 'short' | 'long' | 'datetime' = 'short'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '-';
  
  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    case 'long':
      return dateObj.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    case 'datetime':
      return dateObj.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    default:
      return dateObj.toLocaleDateString('id-ID');
  }
}

// WhatsApp share functionality
export interface WhatsAppShareOptions {
  phoneNumber?: string;
  message: string;
}

export function shareToWhatsApp({ phoneNumber, message }: WhatsAppShareOptions): void {
  const encodedMessage = encodeURIComponent(message);
  let url = `https://wa.me/`;
  
  if (phoneNumber) {
    // Remove any non-numeric characters and ensure it starts with country code
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const formattedNumber = cleanNumber.startsWith('62') ? cleanNumber : `62${cleanNumber.replace(/^0/, '')}`;
    url += `${formattedNumber}?text=${encodedMessage}`;
  } else {
    url += `?text=${encodedMessage}`;
  }
  
  window.open(url, '_blank');
}

// Generate WhatsApp message templates
export function generateBookingWhatsAppMessage(booking: {
  code: string;
  clientName: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: string;
  currency: string;
}): string {
  return `🏨 *Konfirmasi Booking Hotel*

📋 *Kode Booking:* ${booking.code}
👤 *Nama Tamu:* ${booking.clientName}
🏨 *Hotel:* ${booking.hotelName}
📅 *Check-in:* ${formatDate(booking.checkIn, 'long')}
📅 *Check-out:* ${formatDate(booking.checkOut, 'long')}
💰 *Total:* ${formatCurrency(booking.totalAmount, booking.currency)}

Terima kasih telah mempercayai layanan kami! 🙏`;
}

export function generateInvoiceWhatsAppMessage(invoice: {
  number: string;
  clientName: string;
  amount: string;
  currency: string;
  dueDate?: string;
  pdfUrl?: string;
}): string {
  let message = `🧾 *Invoice Hotel*

📄 *Nomor Invoice:* ${invoice.number}
👤 *Nama:* ${invoice.clientName}
💰 *Total:* ${formatCurrency(invoice.amount, invoice.currency)}`;

  if (invoice.dueDate) {
    message += `\n⏰ *Jatuh Tempo:* ${formatDate(invoice.dueDate, 'long')}`;
  }

  if (invoice.pdfUrl) {
    message += `\n\n📎 *Link Invoice:* ${invoice.pdfUrl}`;
  }

  message += `\n\nMohon segera lakukan pembayaran. Terima kasih! 🙏`;
  
  return message;
}

export function generateVoucherWhatsAppMessage(voucher: {
  number: string;
  guestName: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  pdfUrl?: string;
}): string {
  let message = `🎫 *Voucher Hotel*

🎟️ *Nomor Voucher:* ${voucher.number}
👤 *Nama Tamu:* ${voucher.guestName}
🏨 *Hotel:* ${voucher.hotelName}
📅 *Check-in:* ${formatDate(voucher.checkIn, 'long')}
📅 *Check-out:* ${formatDate(voucher.checkOut, 'long')}`;

  if (voucher.pdfUrl) {
    message += `\n\n📎 *Link Voucher:* ${voucher.pdfUrl}`;
  }

  message += `\n\nSelamat menikmati liburan Anda! 🏖️`;
  
  return message;
}

// Status badge helpers
export function getPaymentStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'failed':
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getBookingStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'confirmed':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
