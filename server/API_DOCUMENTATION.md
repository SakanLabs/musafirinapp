# Hotel Booking Management API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All endpoints require admin authentication using BetterAuth middleware. Include the session token in your requests.

## Endpoints

### Bookings

#### GET /bookings
List all bookings with client information and booking items.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "BKG-2024-0001",
      "clientId": 1,
      "hotelName": "Grand Hotel Makkah",
      "city": "Makkah",
      "checkIn": "2024-03-15T00:00:00.000Z",
      "checkOut": "2024-03-20T00:00:00.000Z",
      "totalAmount": "1500.00",
      "paymentStatus": "paid",
      "bookingStatus": "confirmed",
      "meta": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "clientName": "Ahmad Ali",
      "clientEmail": "ahmad@example.com",
      "clientPhone": "+966501234567",
      "items": [
        {
          "id": 1,
          "bookingId": 1,
          "roomType": "DBL",
          "roomCount": 2,
          "unitPrice": "300.00"
        }
      ]
    }
  ]
}
```

#### POST /bookings
Create a new booking with client and booking items.

**Request Body:**
```json
{
  "client": {
    "name": "Ahmad Ali",
    "email": "ahmad@example.com",
    "phone": "+966501234567"
  },
  "booking": {
    "hotelName": "Grand Hotel Makkah",
    "city": "Makkah",
    "checkIn": "2024-03-15",
    "checkOut": "2024-03-20",
    "paymentStatus": "unpaid",
    "bookingStatus": "pending",
    "meta": null
  },
  "items": [
    {
      "roomType": "DBL",
      "roomCount": 2,
      "unitPrice": "300.00"
    },
    {
      "roomType": "TPL",
      "roomCount": 1,
      "unitPrice": "450.00"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking": { /* booking object */ },
    "client": { /* client object */ },
    "items": [ /* booking items array */ ]
  },
  "message": "Booking created successfully"
}
```

#### PATCH /bookings/:id
Update booking payment status or booking status.

**Request Body:**
```json
{
  "paymentStatus": "paid",
  "bookingStatus": "confirmed"
}
```

**Valid Payment Statuses:** `unpaid`, `partial`, `paid`, `overdue`
**Valid Booking Statuses:** `pending`, `confirmed`, `cancelled`

### Invoices

#### GET /invoices
List all invoices with booking and client information.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "number": "INV-2024-0001",
      "bookingId": 1,
      "amount": "1500.00",
      "currency": "SAR",
      "issueDate": "2024-01-15T10:30:00.000Z",
      "dueDate": "2024-02-14T10:30:00.000Z",
      "status": "sent",
      "pdfUrl": "https://minio.example.com/invoices/INV-2024-0001.pdf",
      "bookingCode": "BKG-2024-0001",
      "clientName": "Ahmad Ali",
      "clientEmail": "ahmad@example.com",
      "hotelName": "Grand Hotel Makkah",
      "city": "Makkah"
    }
  ]
}
```

#### POST /invoices/:bookingId/generate
Generate invoice PDF for a booking and upload to MinIO.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "number": "INV-2024-0001",
    "bookingId": 1,
    "amount": "1500.00",
    "currency": "SAR",
    "issueDate": "2024-01-15T10:30:00.000Z",
    "dueDate": "2024-02-14T10:30:00.000Z",
    "status": "draft",
    "pdfUrl": "https://minio.example.com/invoices/INV-2024-0001.pdf"
  },
  "message": "Invoice generated successfully"
}
```

#### GET /invoices/by-number/:number
Serve invoice PDF by invoice number (redirects to MinIO URL).

### Vouchers

#### GET /vouchers
List all vouchers with booking and client information.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "number": "VCH-2024-0001",
      "bookingId": 1,
      "guestName": "Ahmad Ali",
      "qrUrl": "http://localhost:3000/api/vouchers/verify/VCH-2024-0001",
      "pdfUrl": "https://minio.example.com/vouchers/VCH-2024-0001.pdf",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "bookingCode": "BKG-2024-0001",
      "clientName": "Ahmad Ali",
      "clientEmail": "ahmad@example.com",
      "hotelName": "Grand Hotel Makkah",
      "city": "Makkah",
      "checkIn": "2024-03-15T00:00:00.000Z",
      "checkOut": "2024-03-20T00:00:00.000Z"
    }
  ]
}
```

#### POST /vouchers/:bookingId/generate
Generate voucher with QR code, render PDF, and upload to MinIO.

**Request Body:**
```json
{
  "guestName": "Ahmad Ali"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "number": "VCH-2024-0001",
    "bookingId": 1,
    "guestName": "Ahmad Ali",
    "qrUrl": "http://localhost:3000/api/vouchers/verify/VCH-2024-0001",
    "pdfUrl": "https://minio.example.com/vouchers/VCH-2024-0001.pdf",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Voucher generated successfully"
}
```

#### GET /vouchers/by-number/:number
Serve voucher PDF by voucher number (redirects to MinIO URL).

### Reports

#### GET /reports/summary
Get monthly summary report with bookings, revenue, unpaid amounts, and vouchers count.

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "month": 1,
      "year": 2024,
      "monthName": "January"
    },
    "summary": {
      "bookings": {
        "total": 25,
        "confirmed": 20,
        "pending": 5
      },
      "revenue": {
        "total": 45000.00,
        "currency": "SAR"
      },
      "unpaid": {
        "count": 3,
        "amount": 4500.00,
        "currency": "SAR"
      },
      "vouchers": 18,
      "invoices": 22
    },
    "breakdown": {
      "byCity": [
        {
          "city": "Makkah",
          "count": 15,
          "revenue": 30000.00
        },
        {
          "city": "Madinah",
          "count": 10,
          "revenue": 15000.00
        }
      ],
      "byPaymentStatus": [
        {
          "status": "paid",
          "count": 20,
          "amount": 40500.00
        },
        {
          "status": "unpaid",
          "count": 3,
          "amount": 4500.00
        },
        {
          "status": "partial",
          "count": 2,
          "amount": 0.00
        }
      ]
    }
  }
}
```

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error

## Environment Variables

Make sure to set these environment variables for proper functionality:

```env
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=hotel-booking

# Base URL for QR codes
BASE_URL=http://localhost:3000
```

## Dependencies

The API uses the following key dependencies:
- **Hono** - Web framework
- **Drizzle ORM** - Database ORM
- **BetterAuth** - Authentication
- **Puppeteer** - PDF generation
- **QRCode** - QR code generation
- **MinIO** - File storage

## Database Schema

The API works with the following main tables:
- `clients` - Customer information
- `bookings` - Hotel booking records
- `booking_items` - Room details for each booking
- `invoices` - Invoice records with PDF URLs
- `vouchers` - Voucher records with QR codes and PDF URLs

For detailed schema information, see `HOTEL_BOOKING_SCHEMA.md`.