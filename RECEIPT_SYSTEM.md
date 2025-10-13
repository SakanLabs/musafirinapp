# Receipt Management System

## Overview
Sistem manajemen kwitansi (receipt) yang terintegrasi dengan sistem booking hotel Musafirin. Sistem ini secara otomatis menghasilkan kwitansi ketika pembayaran booking selesai dan menyediakan interface untuk mengelola kwitansi.

## Features

### Backend Features
1. **Automatic Receipt Generation**: Kwitansi otomatis dibuat ketika status pembayaran booking berubah menjadi 'paid'
2. **PDF Generation**: Menghasilkan kwitansi dalam format PDF menggunakan template HTML
3. **Receipt Management**: CRUD operations untuk mengelola kwitansi
4. **Database Integration**: Tabel receipts terintegrasi dengan bookings dan invoices

### Frontend Features
1. **Receipt List Page**: Halaman untuk melihat daftar semua kwitansi
2. **Receipt Details**: Informasi detail kwitansi dengan link ke booking dan invoice terkait
3. **PDF Download**: Download kwitansi dalam format PDF
4. **Navigation Integration**: Link "Receipts" di sidebar navigation

## Database Schema

### Receipts Table
```sql
CREATE TABLE receipts (
  id SERIAL PRIMARY KEY,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  booking_id INTEGER REFERENCES bookings(id),
  invoice_id INTEGER REFERENCES invoices(id),
  amount DECIMAL(10,2) NOT NULL,
  issue_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Receipt Endpoints
- `GET /api/receipts` - Get all receipts
- `GET /api/receipts/:id` - Get receipt by ID
- `GET /api/receipts/booking/:bookingId` - Get receipts by booking ID
- `GET /api/receipts/number/:receiptNumber` - Get receipt by number
- `POST /api/receipts/generate` - Generate new receipt
- `GET /api/receipts/:id/download` - Download receipt PDF

## Frontend Routes
- `/receipts` - Receipt list page
- Receipt details accessible via actions in the list

## Automatic Generation
Kwitansi otomatis dibuat di endpoint pembayaran booking (`/api/bookings/:id/payment`) ketika:
1. Status pembayaran berubah menjadi 'paid'
2. Belum ada kwitansi untuk booking tersebut
3. Ada invoice yang terkait dengan booking

## PDF Template
Template kwitansi menggunakan file HTML (`/server/src/templates/kwitansi.html`) dengan styling yang sesuai untuk pencetakan.

## Usage

### Manual Testing
1. Buka aplikasi di browser: http://localhost:5173
2. Login ke sistem
3. Buat booking baru atau gunakan booking yang ada
4. Lakukan pembayaran hingga status menjadi 'paid'
5. Kwitansi akan otomatis dibuat
6. Akses halaman "Receipts" dari sidebar untuk melihat kwitansi
7. Download PDF kwitansi jika diperlukan

### Development
- Server: `npm run dev` di folder `/server`
- Client: `npm run dev` di folder `/client`
- Database: PostgreSQL dengan schema yang sudah di-migrate

## Files Modified/Created

### Backend
- `/server/src/db/schema.ts` - Added receipts table schema
- `/server/src/services/ReceiptService.ts` - Receipt service implementation
- `/server/src/routes/receipts.ts` - Receipt API routes
- `/server/src/routes/bookings.ts` - Added automatic receipt generation
- `/server/drizzle/` - Database migration files

### Frontend
- `/client/src/lib/queries/receipts.ts` - Receipt data fetching
- `/client/src/lib/api.ts` - Added receipt API endpoints
- `/client/src/routes/receipts.tsx` - Receipt list page
- `/client/src/components/layout/Sidebar.tsx` - Added receipts navigation

## Notes
- Sistem menggunakan format nomor kwitansi: RCP-YYYYMMDD-XXXX
- Kwitansi hanya dibuat untuk booking dengan status pembayaran 'paid'
- PDF generation menggunakan Puppeteer
- Frontend menggunakan React Query untuk data fetching
- UI menggunakan shadcn/ui components