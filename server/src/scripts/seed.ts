import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from '../db/schema.js';
import { auth } from '../lib/auth.js';
import { eq, inArray } from 'drizzle-orm';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local'), override: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
  console.log('🌱 Starting full database seed...');

  try {
    // -------------------------------------------------------------
    // 1. CLEAN UP SEED USERS & ACCOUNTS
    // -------------------------------------------------------------
    console.log('🧹 Cleaning up existing seed users...');
    const seedEmails = ['owner@musafirin.com', 'admin@musafirin.com', 'agent@musafirin.com'];
    
    const existingUsers = await db.select({ id: schema.user.id })
      .from(schema.user)
      .where(inArray(schema.user.email, seedEmails));
    
    if (existingUsers.length > 0) {
      const userIds = existingUsers.map(u => u.id);
      await db.delete(schema.account).where(inArray(schema.account.userId, userIds));
      await db.delete(schema.user).where(inArray(schema.user.email, seedEmails));
    }

    // -------------------------------------------------------------
    // 2. CREATE SYSTEM USERS WITH ROLES (via Better Auth programmatic signup)
    // -------------------------------------------------------------
    console.log('👤 Creating owner user...');
    await auth.api.signUpEmail({
      body: {
        email: 'owner@musafirin.com',
        password: 'password123',
        name: 'System Owner',
      }
    });
    await db.update(schema.user)
      .set({ role: 'owner', userType: 'direct' })
      .where(eq(schema.user.email, 'owner@musafirin.com'));
    console.log('  ✓ Created owner@musafirin.com (password123)');

    console.log('👤 Creating admin user...');
    await auth.api.signUpEmail({
      body: {
        email: 'admin@musafirin.com',
        password: 'password123',
        name: 'System Admin',
      }
    });
    await db.update(schema.user)
      .set({ role: 'admin', userType: 'direct' })
      .where(eq(schema.user.email, 'admin@musafirin.com'));
    console.log('  ✓ Created admin@musafirin.com (password123)');

    console.log('👤 Creating agent user...');
    await auth.api.signUpEmail({
      body: {
        email: 'agent@musafirin.com',
        password: 'password123',
        name: 'Mitra Travel Agent',
      }
    });
    await db.update(schema.user)
      .set({ role: 'user', userType: 'agent' })
      .where(eq(schema.user.email, 'agent@musafirin.com'));
    console.log('  ✓ Created agent@musafirin.com (password123)');

    // -------------------------------------------------------------
    // 3. SEED STORE CATEGORIES & PRODUCTS
    // -------------------------------------------------------------
    console.log('🛍️ Seeding store categories and products...');
    const storeCategories = [
      { name: 'Kurma', slug: 'kurma', description: 'Kurma premium asli Arab Saudi' },
      { name: 'Parfum & Oud', slug: 'parfum-oud', description: 'Parfum Timur Tengah, Oud, dan Bukhoor' },
      { name: 'Perlengkapan Ibadah', slug: 'perlengkapan-ibadah', description: 'Sajadah, Tasbih, Al-Quran, dan lainnya' },
    ];

    const categoryMap = new Map<string, number>();
    for (const cat of storeCategories) {
      // Check if exists first
      const existing = await db.select().from(schema.storeCategories).where(eq(schema.storeCategories.slug, cat.slug));
      if (existing.length > 0) {
        categoryMap.set(cat.slug, existing[0]!.id);
        continue;
      }
      
      const [inserted] = await db.insert(schema.storeCategories).values({
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      }).returning();
      if (inserted) {
        categoryMap.set(cat.slug, inserted.id);
        console.log(`  ✓ Store Category: ${cat.name}`);
      }
    }

    const storeProducts = [
      {
        name: 'Kurma Ajwa Al-Madinah Premium 1kg',
        slug: 'kurma-ajwa-premium-1kg',
        description: 'Kurma Ajwa asli dari kebun Al-Madinah. Daging tebal, tekstur lembut, dan rasa manis alami khas.',
        categorySlug: 'kurma',
        sku: 'KRM-001',
        stock: 100,
        price: '120000',
        promoPrice: '99000',
        weight: '1.0',
        images: ['https://images.unsplash.com/photo-1595510219848-19c8d0f9ad9e?w=800'],
      },
      {
        name: 'Oud Kayu Premium 3ml',
        slug: 'oud-kayu-premium-3ml',
        description: 'Minyak Oud asli dari kayu gaharu pilihan. Aroma woody yang kaya dan tahan lama.',
        categorySlug: 'parfum-oud',
        sku: 'PRF-001',
        stock: 60,
        price: '250000',
        promoPrice: '199000',
        weight: '0.05',
        images: ['https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800'],
      },
      {
        name: 'Sajadah Travel Silk Premium',
        slug: 'sajadah-travel-silk-premium',
        description: 'Sajadah travel berbahan sutra halus dengan desain khas Timur Tengah.',
        categorySlug: 'perlengkapan-ibadah',
        sku: 'IBD-001',
        stock: 90,
        price: '150000',
        promoPrice: '125000',
        weight: '0.3',
        images: ['https://images.unsplash.com/photo-1597170346296-30c3b1e4968f?w=800'],
      }
    ];

    for (const prod of storeProducts) {
      const categoryId = categoryMap.get(prod.categorySlug);
      if (!categoryId) continue;

      // Check if exists
      const existing = await db.select().from(schema.storeProducts).where(eq(schema.storeProducts.slug, prod.slug));
      if (existing.length > 0) continue;

      const [inserted] = await db.insert(schema.storeProducts).values({
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        categoryId,
        sku: prod.sku,
        stock: prod.stock,
        price: prod.price,
        promoPrice: prod.promoPrice,
        weight: prod.weight,
        isActive: true,
        isPreOrder: false,
      }).returning();

      if (inserted) {
        for (let i = 0; i < prod.images.length; i++) {
          await db.insert(schema.storeProductImages).values({
            productId: inserted.id,
            imageUrl: prod.images[i]!,
            thumbnail: i === 0,
            sortOrder: i,
          });
        }
        console.log(`  ✓ Store Product: ${prod.name}`);
      }
    }

    // -------------------------------------------------------------
    // 4. SEED SERVICE MASTER DATA
    // -------------------------------------------------------------
    console.log('🛠️ Seeding master services...');
    const services = [
      { name: 'Visa Umrah', category: 'Visa' as const, price: '175', unitType: 'Per Pax', description: 'Pengurusan Visa Umrah Resmi' },
      { name: 'Siskopatuh', category: 'Siskopatuh' as const, price: '15', unitType: 'Per Pax', description: 'Registrasi Siskopatuh Kemenag' },
      { name: 'Handling Airport Jeddah', category: 'Handling Airport' as const, price: '50', unitType: 'Per Pax', description: 'Penanganan kedatangan/keberangkatan bandara Jeddah' },
      { name: 'Handling Hotel Makkah', category: 'Handling Hotel' as const, price: '50', unitType: 'Per Pax', description: 'Penanganan check-in/check-out hotel Makkah' },
      { name: 'Muthowif Harian Makkah', category: 'Muthowif' as const, price: '1500', unitType: 'Per Group', description: 'Jasa pembimbing ibadah di Makkah' },
      { name: 'Kereta Cepat Haramain', category: 'Transportasi' as const, price: '150', unitType: 'Per Pax', description: 'Tiket kereta cepat kelas ekonomi' },
    ];

    for (const s of services) {
      const existing = await db.select().from(schema.serviceMaster).where(eq(schema.serviceMaster.name, s.name));
      if (existing.length === 0) {
        await db.insert(schema.serviceMaster).values({
          name: s.name,
          category: s.category,
          price: s.price,
          unitType: s.unitType,
          description: s.description,
          isActive: true,
        });
        console.log(`  ✓ Service: ${s.name}`);
      }
    }

    // -------------------------------------------------------------
    // 5. SEED CLIENTS & DEPOSITS
    // -------------------------------------------------------------
    console.log('💼 Seeding clients and deposits...');
    const timestamp = Date.now();
    const newClient = await db.insert(schema.clients).values({
      name: 'PT Cahaya Haramain Mandiri',
      email: `info-${timestamp}@cahayaharamain.com`,
      phone: '+6281122334455',
      address: 'Kuningan City Mall Lt. 3, Jakarta Selatan',
      isActive: true,
    }).returning();
    const clientObj = newClient[0]!;
    const clientId = clientObj.id;

    await db.insert(schema.clientDeposits).values({
      clientId,
      currentBalance: '250000.00',
      totalDeposited: '300000.00',
      totalUsed: '50000.00',
      currency: 'SAR',
    });
    console.log(`  ✓ Created Client: ${clientObj.name} with 250,000 SAR Deposit`);

    // -------------------------------------------------------------
    // 6. SEED HOTELS & PRICING
    // -------------------------------------------------------------
    console.log('🏨 Seeding hotels and pricing...');
    const makkahHotel = await db.insert(schema.hotels).values({
      name: 'Swissotel Makkah',
      city: 'Makkah',
      starRating: 5,
      address: 'Abraj Al Bait Complex, Makkah',
      supplierName: 'Elaf Group',
      picName: 'Hisham Al-Harbi',
      picContact: '+966551234567',
      isActive: true,
    }).returning();
    const makkahHotelObj = makkahHotel[0]!;

    const madinahHotel = await db.insert(schema.hotels).values({
      name: 'Pullman Zamzam Madinah',
      city: 'Madinah',
      starRating: 5,
      address: 'Amr Bin Al Aas Street, Madinah',
      supplierName: 'Zamzam Group',
      picName: 'Yasser Madani',
      picContact: '+966559876543',
      isActive: true,
    }).returning();
    const madinahHotelObj = madinahHotel[0]!;

    // Add pricing periods for Makkah hotel
    const pricingStart = new Date('2026-01-01');
    const pricingEnd = new Date('2026-12-31');

    await db.insert(schema.hotelPricingPeriods).values([
      {
        hotelId: makkahHotelObj.id,
        roomType: 'Double',
        mealPlan: 'Breakfast',
        startDate: pricingStart,
        endDate: pricingEnd,
        costPrice: '450.00',
        sellingPrice: '600.00',
        agentPrice: '550.00',
        currency: 'SAR',
        isActive: true,
      },
      {
        hotelId: makkahHotelObj.id,
        roomType: 'Triple',
        mealPlan: 'Breakfast',
        startDate: pricingStart,
        endDate: pricingEnd,
        costPrice: '550.00',
        sellingPrice: '700.00',
        agentPrice: '650.00',
        currency: 'SAR',
        isActive: true,
      }
    ]);

    // Add pricing periods for Madinah hotel
    await db.insert(schema.hotelPricingPeriods).values([
      {
        hotelId: madinahHotelObj.id,
        roomType: 'Double',
        mealPlan: 'Breakfast',
        startDate: pricingStart,
        endDate: pricingEnd,
        costPrice: '350.00',
        sellingPrice: '480.00',
        agentPrice: '420.00',
        currency: 'SAR',
        isActive: true,
      }
    ]);
    console.log('  ✓ Created Hotels Swissotel Makkah & Pullman Zamzam Madinah with Pricing Periods');

    // -------------------------------------------------------------
    // 7. SEED TRANSPORT MASTER ROUTES
    // -------------------------------------------------------------
    console.log('🚌 Seeding transport routes master...');
    const transportMaster = await db.insert(schema.transportationRoutesMaster).values([
      {
        originLocation: 'Jeddah Airport',
        destinationLocation: 'Makkah Hotel',
        supplierName: 'Saptco VIP',
        picName: 'Fahd Transport',
        picContact: '+966503334445',
        isActive: true,
      },
      {
        originLocation: 'Makkah Hotel',
        destinationLocation: 'Madinah Hotel',
        supplierName: 'Saptco VIP',
        picName: 'Fahd Transport',
        picContact: '+966503334445',
        isActive: true,
      }
    ]).returning();

    // Add pricing for the routes
    const routeStartDate = new Date('2026-01-01');
    const routeEndDate = new Date('2026-12-31');
    
    await db.insert(schema.transportationRoutePricingPeriods).values([
      {
        transportationRouteMasterId: transportMaster[0]!.id,
        vehicleType: 'bus' as const,
        startDate: routeStartDate,
        endDate: routeEndDate,
        costPrice: '800.00',
        sellingPrice: '1100.00',
        agentPrice: '1000.00',
        currency: 'SAR',
        isActive: true,
      },
      {
        transportationRouteMasterId: transportMaster[1]!.id,
        vehicleType: 'bus' as const,
        startDate: routeStartDate,
        endDate: routeEndDate,
        costPrice: '900.00',
        sellingPrice: '1200.00',
        agentPrice: '1100.00',
        currency: 'SAR',
        isActive: true,
      }
    ]);
    console.log('  ✓ Created Transport routes & Route Pricing Periods');

    // -------------------------------------------------------------
    // 8. SEED MUTHOWIFS
    // -------------------------------------------------------------
    console.log('👳 Seeding muthowifs...');
    await db.insert(schema.muthowifs).values([
      {
        name: 'Ust. Ahmad Fauzi Lc.',
        phone: '+966501234567',
        iqamaOrPassportNo: 'IQ-998877665',
        visaStatus: 'student' as const,
        residentType: 'mahasiswa' as const,
        residenceLocation: 'Universitas Islam Madinah',
        lastEducation: 'S1 Syariah UIM',
        status: 'idle' as const,
        notes: 'Sangat berpengalaman memimpin rombongan VIP',
        isActive: true,
      },
      {
        name: 'Ust. Budi Santoso',
        phone: '+966509876543',
        iqamaOrPassportNo: 'IQ-112233445',
        visaStatus: 'resident' as const,
        residentType: 'mukimin' as const,
        residenceLocation: 'Misfalah, Makkah',
        lastEducation: 'SMA',
        status: 'idle' as const,
        notes: 'Menguasai rute-rute ziarah Makkah',
        isActive: true,
      }
    ]);
    console.log('  ✓ Created Muthowifs (Ust. Ahmad Fauzi & Ust. Budi Santoso)');

    // -------------------------------------------------------------
    // 9. SEED CRM LEADS
    // -------------------------------------------------------------
    console.log('📈 Seeding CRM Leads...');
    const ownerUser = await db.select().from(schema.user).where(eq(schema.user.email, 'owner@musafirin.com'));
    const ownerId = ownerUser[0]?.id || null;

    await db.insert(schema.leads).values([
      {
        name: 'Bpk. H. Rahmat',
        phone: '+6281299998888',
        companyName: 'Kabilah Tour & Travel',
        requirement: 'Butuh LA Makkah Swissotel 50 kamar untuk keberangkatan Maulid Nabi September 2026',
        status: 'DISCUSSION' as const,
        value: '150000.00',
        notes: 'Sangat tertarik, minta dikirim penawaran harga terbaik',
        assignedTo: ownerId,
        orderIndex: 0,
      },
      {
        name: 'Ibu Aisyah',
        phone: '+6287711223344',
        companyName: 'Safara Mulia Travel',
        requirement: 'Permintaan 20 Visa Umrah reguler keberangkatan cepat',
        status: 'NEW' as const,
        value: '3500.00',
        notes: 'Kontak pertama via WhatsApp',
        assignedTo: ownerId,
        orderIndex: 1,
      }
    ]);
    console.log('  ✓ Created CRM Leads');

    // -------------------------------------------------------------
    // 10. SEED BOOKINGS, INVOICES & LA REQUESTS
    // -------------------------------------------------------------
    console.log('📑 Seeding bookings and invoices...');
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 10);
    const checkOut = new Date();
    checkOut.setDate(checkIn.getDate() + 5);

    const booking = await db.insert(schema.bookings).values({
      code: `BKG-${timestamp}`,
      clientId,
      hotelName: makkahHotelObj.name,
      city: 'Makkah' as const,
      mealPlan: 'Breakfast' as const,
      checkIn,
      checkOut,
      totalAmount: '2750.00', // 5 nights * 1 room * 550 agentPrice
      paymentStatus: 'partial' as const,
      bookingStatus: 'confirmed' as const,
      hotelConfirmationNo: 'CFM-998822',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    const bookingId = booking[0]!.id;

    await db.insert(schema.bookingItems).values({
      bookingId,
      roomType: 'Double',
      roomCount: 1,
      unitPrice: '550.00',
      hotelCostPrice: '450.00',
      hasPricingPeriods: false,
    });

    const invoice = await db.insert(schema.invoices).values({
      number: `INV-2026-0001`,
      bookingId,
      amount: '2750.00',
      paidAmount: '1000.00',
      currency: 'SAR',
      issueDate: new Date(),
      dueDate: checkIn,
      status: 'partially_paid' as const,
    }).returning();
    const invoiceId = invoice[0]!.id;

    await db.insert(schema.invoicePayments).values({
      invoiceId,
      amount: '1000.00',
      currency: 'SAR',
      method: 'bank_transfer',
      referenceNumber: 'TRF-BANK-00192',
      paidAt: new Date(),
      status: 'completed' as const,
    });

    await db.insert(schema.receipts).values({
      number: `KWT-2026-0001`,
      bookingId,
      invoiceId,
      totalAmount: '2750.00',
      paidAmount: '1000.00',
      balanceDue: '1750.00',
      currency: 'SAR',
      issueDate: new Date(),
      payerName: 'PT Cahaya Haramain Mandiri',
      hotelName: makkahHotelObj.name,
      notes: 'Pembayaran DP 1 kamar Swissotel Makkah',
    });

    await db.insert(schema.vouchers).values({
      number: `VCH-2026-0001`,
      bookingId,
      guestName: 'Rombongan PT Cahaya Haramain',
    });

    // Custom LA request
    await db.insert(schema.customLaRequests).values({
      number: `CLA-${timestamp}`,
      clientId,
      customerName: 'Bpk. H. Rahmat',
      customerPhone: '+6281299998888',
      travelName: 'Kabilah Tour & Travel',
      status: 'quoted' as const,
      totalAmountSAR: '15000.00',
      totalPax: 10,
      meta: {
        tanggalKedatangan: checkIn.toISOString(),
        tanggalKeberangkatan: checkOut.toISOString(),
        rooms: {
          makkah: { nights: 3, doubleQty: 2, doublePrice: 550 },
        },
        totals: {
          grandTotal: 15000,
        }
      }
    });

    console.log('  ✓ Created sample Bookings, Invoices, Vouchers, and Custom LA Requests');
    console.log('\n🎉 ALL DATABASE SEEDING COMPLETED SUCCESSFULLY 🎉\n');
  } catch (error) {
    console.error('❌ Seeding failed with error:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

seed();
