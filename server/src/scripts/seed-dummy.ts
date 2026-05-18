import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from '../db/schema.js';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
  console.log('Seeding dummy data...');

  try {
    // 1. Create Client
    console.log('Creating client...');
    const timestamp = Date.now();
    const newClient = await db.insert(schema.clients).values({
      name: `Travel Berkah Bersama ${timestamp}`,
      email: `info-${timestamp}@travelberkah.com`,
      phone: `+628123456${Math.floor(Math.random() * 1000)}`,
      address: 'Jl. Sudirman No. 123, Jakarta',
      isActive: true,
    }).returning();
    const clientId = newClient[0].id;

    // Create deposit
    await db.insert(schema.clientDeposits).values({
      clientId,
      currentBalance: '100000',
      totalDeposited: '150000',
      totalUsed: '50000',
    });

    // 2. Create Master Hotel
    console.log('Creating hotels...');
    const makkahHotel = await db.insert(schema.hotels).values({
      code: `MKK-SFC-${timestamp}`,
      name: `Swissotel Makkah ${timestamp}`,
      city: 'Makkah',
      starRating: 5,
      address: 'Abraj Al Bait Complex',
      isActive: true,
    }).returning();
    const madinahHotel = await db.insert(schema.hotels).values({
      code: `MDN-PLM-${timestamp}`,
      name: `Pullman Zamzam Madinah ${timestamp}`,
      city: 'Madinah',
      starRating: 5,
      address: 'Opposite to Bab Al Salam',
      isActive: true,
    }).returning();

    // 3. Create Master Transport Route
    console.log('Creating transport route...');
    const transportRoute = await db.insert(schema.transportationRoutesMaster).values({
      originLocation: 'Jeddah Airport',
      destinationLocation: 'Makkah Hotel',
      supplierName: 'Al-Haram Transport',
      isActive: true,
    }).returning();

    // 4. Create Muthowifs
    console.log('Creating muthowifs...');
    await db.insert(schema.muthowifs).values([
      {
        name: 'Ust. Ahmad Fauzi',
        phone: '+966501234567',
        visaStatus: 'student',
        residentType: 'mahasiswa',
        residenceLocation: 'Madinah',
        status: 'idle'
      },
      {
        name: 'Ust. Budi Santoso',
        phone: '+966509876543',
        visaStatus: 'resident',
        residentType: 'mukimin',
        residenceLocation: 'Makkah',
        status: 'idle'
      }
    ]);

    // 5. Create Booking
    console.log('Creating booking...');
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const booking = await db.insert(schema.bookings).values({
      code: `BKG-${timestamp}`,
      clientId,
      clientName: newClient[0].name,
      clientEmail: newClient[0].email,
      clientPhone: newClient[0].phone,
      hotelName: makkahHotel[0].name,
      city: 'Makkah',
      checkIn: now,
      checkOut: nextWeek,
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
      mealPlan: 'Breakfast',
      totalAmount: '15000',
    }).returning();
    const bookingId = booking[0].id;

    // Booking Items
    await db.insert(schema.bookingItems).values({
      bookingId,
      roomType: 'Double',
      roomCount: 5,
      unitPrice: '500',
      totalPrice: '15000',
    });

    // 6. Create Service Order
    console.log('Creating service order...');
    await db.insert(schema.serviceOrders).values({
      number: `SO-${timestamp}`,
      clientId,
      groupLeaderName: newClient[0].name,
      productType: 'visa_umrah',
      status: 'submitted',
      totalPeople: 10,
      unitPriceUSD: '350',
      totalPriceUSD: '3500',
      totalPriceSAR: '13125',
      departureDate: now,
      returnDate: nextWeek,
      meta: { type: 'umrah' }
    });

    // 7. Create Transportation Booking
    console.log('Creating transportation booking...');
    await db.insert(schema.transportationBookings).values({
      number: `TRB-${timestamp}`,
      clientId,
      customerName: newClient[0].name,
      status: 'confirmed',
      totalAmount: '1500',
    });

    // 8. Create Custom LA Request
    console.log('Creating Custom LA Request...');
    await db.insert(schema.customLaRequests).values({
      number: `CLA-${timestamp}`,
      clientId,
      customerName: newClient[0].name,
      customerPhone: newClient[0].phone,
      travelName: 'Travel Berkah Bersama Tour',
      status: 'invoiced',
      totalAmountSAR: '25000',
      totalPax: 15,
      meta: {
        tanggalKedatangan: now.toISOString(),
        tanggalKeberangkatan: nextWeek.toISOString(),
        rooms: {
          makkah: { nights: 4, doubleQty: 2, doublePrice: 300, tripleQty: 1, triplePrice: 350 },
          madinah: { nights: 3, doubleQty: 2, doublePrice: 250, tripleQty: 1, triplePrice: 300 }
        },
        totals: {
          totalPax: 15,
          makkahHotelTotal: 3800,
          madinahHotelTotal: 2900,
          totalTransport: 2500,
          subTotalHandling: 3500,
          grandTotal: 25000,
          perPaxPrice: 1666,
          profit: 2500,
          includeVisa: true,
          visaTotal: 4500
        },
        handlingDetails: {
          handlingAirport: 50,
          handlingHotel: 50,
          tiketMuseum: 30,
          muthowif: 1500,
          muthowifahRaudhah: 500,
          tipDriver: 300,
          biayaTakTerduga: 200,
          keretaCepat: 150
        }
      }
    });

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.end();
  }
}

seed();
