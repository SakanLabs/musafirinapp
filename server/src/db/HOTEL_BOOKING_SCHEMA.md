# Hotel Booking Management Schema

Schema Drizzle ORM untuk sistem Hotel Booking Management (internal use).

## Tabel yang Tersedia

### 1. clients
Tabel untuk menyimpan data klien/customer.
- `id` (serial, primary key)
- `name` (varchar 255, not null)
- `email` (varchar 255, not null, unique)
- `phone` (varchar 50, nullable)
- `created_at` (timestamp, default now)

### 2. bookings
Tabel utama untuk menyimpan data booking hotel.
- `id` (serial, primary key)
- `code` (varchar 50, not null, unique) - Kode booking unik
- `client_id` (integer, foreign key ke clients.id)
- `hotel_name` (varchar 255, not null)
- `city` (enum: 'Makkah' | 'Madinah')
- `check_in` (timestamp, not null)
- `check_out` (timestamp, not null)
- `total_amount` (decimal 10,2, not null)
- `payment_status` (enum: 'unpaid' | 'partial' | 'paid' | 'overdue', default 'unpaid')
- `booking_status` (enum: 'pending' | 'confirmed' | 'cancelled', default 'pending')
- `meta` (jsonb, nullable) - Data tambahan dalam format JSON
- `created_at` (timestamp, default now)
- `updated_at` (timestamp, default now)

### 3. booking_items
Tabel untuk menyimpan detail item booking (kamar).
- `id` (serial, primary key)
- `booking_id` (integer, foreign key ke bookings.id)
- `room_type` (enum: 'DBL' | 'TPL' | 'Quad')
- `room_count` (integer, not null)
- `unit_price` (decimal 10,2, not null)

### 4. invoices
Tabel untuk menyimpan data invoice.
- `id` (serial, primary key)
- `number` (varchar 50, not null, unique) - Format: INV-YYYY-XXXX
- `booking_id` (integer, foreign key ke bookings.id)
- `amount` (decimal 10,2, not null)
- `currency` (varchar 3, default 'SAR')
- `issue_date` (timestamp, not null)
- `due_date` (timestamp, not null)
- `status` (enum: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled', default 'draft')
- `pdf_url` (text, nullable)

### 5. vouchers
Tabel untuk menyimpan data voucher.
- `id` (serial, primary key)
- `number` (varchar 50, not null, unique) - Format: VCH-YYYY-XXXX
- `booking_id` (integer, foreign key ke bookings.id)
- `guest_name` (varchar 255, not null)
- `qr_url` (text, nullable)
- `pdf_url` (text, nullable)
- `created_at` (timestamp, default now)

## Relasi Antar Tabel

```
clients (1) -----> (N) bookings
bookings (1) -----> (N) booking_items
bookings (1) -----> (N) invoices
bookings (1) -----> (N) vouchers
```

## Enums yang Digunakan

- `city`: 'Makkah', 'Madinah'
- `payment_status`: 'unpaid', 'partial', 'paid', 'overdue'
- `booking_status`: 'pending', 'confirmed', 'cancelled'
- `room_type`: 'DBL', 'TPL', 'Quad'
- `invoice_status`: 'draft', 'sent', 'paid', 'overdue', 'cancelled'

## Cara Menggunakan

1. Import types dari schema:
```typescript
import { 
  Client, NewClient,
  Booking, NewBooking,
  BookingItem, NewBookingItem,
  Invoice, NewInvoice,
  Voucher, NewVoucher
} from './db/schema';
```

2. Gunakan dengan Drizzle ORM:
```typescript
import { db } from './db';
import { clients, bookings, bookingItems, invoices, vouchers } from './db/schema';

// Contoh query
const allClients = await db.select().from(clients);
const bookingWithClient = await db
  .select()
  .from(bookings)
  .leftJoin(clients, eq(bookings.clientId, clients.id));
```

## Migration

Migration file telah dibuat di: `server/drizzle/0001_flowery_madripoor.sql`

Untuk menjalankan migration:
```bash
bunx drizzle-kit migrate
```