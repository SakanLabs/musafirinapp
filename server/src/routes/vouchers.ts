import { Hono } from 'hono';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { vouchers, bookings, clients, bookingItems } from '../db/schema';
import { requireAdmin } from '../middleware/auth';
import { generateVoucherNumber, generateVoucherPDF, generateQRCode, uploadToMinio } from '../utils/pdf';
import type { NewVoucher } from '../db/schema';

const voucherRoutes = new Hono();

// GET /api/vouchers - List all vouchers
voucherRoutes.get('/', requireAdmin, async (c) => {
  try {
    const allVouchers = await db
      .select({
        id: vouchers.id,
        number: vouchers.number,
        bookingId: vouchers.bookingId,
        guestName: vouchers.guestName,
        qrUrl: vouchers.qrUrl,
        pdfUrl: vouchers.pdfUrl,
        createdAt: vouchers.createdAt,
        bookingCode: bookings.code,
        clientName: clients.name,
        clientEmail: clients.email,
        hotelName: bookings.hotelName,
        city: bookings.city,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
      })
      .from(vouchers)
      .leftJoin(bookings, eq(vouchers.bookingId, bookings.id))
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .orderBy(desc(vouchers.createdAt));

    return c.json({
      success: true,
      data: allVouchers,
    });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    return c.json({ error: 'Failed to fetch vouchers' }, 500);
  }
});

// POST /api/vouchers/:bookingId/generate - Generate voucher for booking
voucherRoutes.post('/:bookingId/generate', requireAdmin, async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const body = await c.req.json();
    const { guestName } = body;

    console.log('Generate voucher request:', {
      bookingId,
      body,
      guestName,
      guestNameType: typeof guestName,
      guestNameLength: guestName?.length
    });

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    if (!guestName) {
      return c.json({ error: 'Guest name is required' }, 400);
    }

    // Check if booking exists
    const booking = await db
      .select({
        id: bookings.id,
        code: bookings.code,
        clientId: bookings.clientId,
        hotelName: bookings.hotelName,
        city: bookings.city,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        totalAmount: bookings.totalAmount,
        paymentStatus: bookings.paymentStatus,
        bookingStatus: bookings.bookingStatus,
        hotelConfirmationNo: bookings.hotelConfirmationNo,
        meta: bookings.meta,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (booking.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const bookingData = booking[0]!;

    // Validate payment status - voucher can only be generated for paid bookings
    if (bookingData.paymentStatus !== 'paid') {
      return c.json({ 
        error: 'Voucher can only be generated for paid bookings',
        currentStatus: bookingData.paymentStatus 
      }, 400);
    }

    // Validate hotel confirmation number - required for voucher generation
    if (!bookingData.hotelConfirmationNo) {
      return c.json({ 
        error: 'Hotel confirmation number is required to generate voucher. Please update the booking first.' 
      }, 400);
    }

    // Check if voucher already exists for this booking
    const existingVoucher = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.bookingId, bookingId))
      .limit(1);

    if (existingVoucher.length > 0) {
      return c.json({ error: 'Voucher already exists for this booking' }, 400);
    }

    // Generate voucher number
    const voucherNumber = generateVoucherNumber();

    // Generate QR code data (voucher verification URL)
    const qrData = `${process.env.BASE_URL || 'http://localhost:3000'}/api/vouchers/verify/${voucherNumber}`;
    const qrCodeDataURL = await generateQRCode(qrData);

    // Create voucher object for PDF generation
    const voucherForPDF = {
      id: 0, // temporary ID
      number: voucherNumber,
      bookingId: bookingId,
      guestName: guestName,
      qrUrl: qrData,
      pdfUrl: null,
      createdAt: new Date(),
    };

    // Create proper booking object for PDF generation
    const bookingForPDF = {
      id: bookingData.id,
      code: bookingData.code,
      clientId: bookingData.clientId!,
      hotelName: bookingData.hotelName,
      city: bookingData.city,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      totalAmount: bookingData.totalAmount,
      paymentStatus: bookingData.paymentStatus,
      bookingStatus: bookingData.bookingStatus,
      hotelConfirmationNo: bookingData.hotelConfirmationNo,
      meta: bookingData.meta,
      createdAt: bookingData.createdAt,
      updatedAt: bookingData.updatedAt,
    };

    // Generate PDF
    const pdfBuffer = await generateVoucherPDF(
      voucherForPDF,
      bookingForPDF,
      {
        id: bookingData.clientId!,
        name: bookingData.clientName!,
        email: bookingData.clientEmail!,
        phone: bookingData.clientPhone,
        createdAt: new Date(),
      },
      qrCodeDataURL
    );

    // Upload to MinIO
    const pdfUrl = await uploadToMinio(
      `vouchers/${voucherNumber}.pdf`,
      pdfBuffer,
      'application/pdf'
    );

    // Save voucher to database
    const newVoucher: NewVoucher = {
      number: voucherNumber,
      bookingId: bookingId,
      guestName: guestName,
      qrUrl: qrData,
      pdfUrl: pdfUrl,
    };

    const [insertedVoucher] = await db
      .insert(vouchers)
      .values(newVoucher)
      .returning();

    return c.json({
      success: true,
      data: insertedVoucher,
      message: 'Voucher generated successfully',
    }, 201);
  } catch (error) {
    console.error('Error generating voucher:', error);
    return c.json({ error: 'Failed to generate voucher' }, 500);
  }
});

// GET /api/vouchers/by-number/:number - Serve voucher PDF
voucherRoutes.get('/by-number/:number', requireAdmin, async (c) => {
  try {
    const voucherNumber = c.req.param('number');

    if (!voucherNumber) {
      return c.json({ error: 'Voucher number is required' }, 400);
    }

    // Find voucher by number
    const voucher = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.number, voucherNumber))
      .limit(1);

    if (voucher.length === 0) {
      return c.json({ error: 'Voucher not found' }, 404);
    }

    const voucherData = voucher[0]!;

    if (!voucherData.pdfUrl) {
      return c.json({ error: 'PDF not available for this voucher' }, 404);
    }

    // Redirect to MinIO URL or serve the PDF directly
    // For now, we'll redirect to the MinIO URL
    return c.redirect(voucherData.pdfUrl);
  } catch (error) {
    console.error('Error serving voucher PDF:', error);
    return c.json({ error: 'Failed to serve voucher PDF' }, 500);
  }
});



// Endpoint untuk generate voucher dengan tabel yang benar
voucherRoutes.post('/hotel/:bookingId/generate', async (c) => {
  try {
    const bookingId = parseInt(c.req.param('bookingId'));
    const body = await c.req.json();

    if (!bookingId || isNaN(bookingId)) {
      return c.json({ error: 'Invalid booking ID' }, 400);
    }

    if (!body.guestName || typeof body.guestName !== 'string' || body.guestName.trim().length === 0) {
      return c.json({ error: 'Guest name is required' }, 400);
    }

    // Query booking dari tabel bookings
    const bookingResult = await db.execute(
      sql`SELECT id, code, client_id, hotel_name, city, check_in, check_out, total_amount, payment_status, booking_status 
          FROM bookings 
          WHERE id = ${bookingId}`
    );

    if (bookingResult.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookingResult[0];
    if (!booking) {
      return c.json({ error: 'Booking data not found' }, 404);
    }

    // Check if voucher already exists
    const existingVoucherResult = await db.execute(
      sql`SELECT id, number FROM vouchers WHERE booking_id = ${bookingId}`
    );

    if (existingVoucherResult.length > 0) {
      return c.json({ 
        error: 'Voucher already exists for this booking',
        existingVoucher: existingVoucherResult[0]
      }, 400);
    }

    // Generate voucher number
    const voucherNumber = `VCH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Generate QR code
    const qrCode = await generateQRCode(voucherNumber);

    // Insert voucher ke tabel vouchers
    const newVoucherResult = await db.execute(
      sql`INSERT INTO vouchers (number, booking_id, guest_name, qr_url, pdf_url, created_at) 
          VALUES (${voucherNumber}, ${bookingId}, ${body.guestName}, ${qrCode}, '', NOW()) 
          RETURNING id, number`
    );

    if (!newVoucherResult[0]) {
      throw new Error('Failed to insert voucher');
    }

    return c.json({
      success: true,
      message: 'Voucher generated successfully',
      voucher: {
        id: newVoucherResult[0].id,
        voucherNumber: newVoucherResult[0].number,
        bookingId: bookingId,
        guestName: body.guestName,
        qrCode,
        booking: {
          code: booking.code,
          hotelName: booking.hotel_name,
          city: booking.city,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          totalAmount: booking.total_amount,
          paymentStatus: booking.payment_status,
          bookingStatus: booking.booking_status
        }
      }
    });

  } catch (error) {
    console.error('❌ Error generating voucher:', error);
    return c.json({ 
      error: 'Failed to generate voucher', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

export default voucherRoutes;