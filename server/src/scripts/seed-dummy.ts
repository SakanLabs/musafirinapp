import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import * as schema from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');
const serverDir = path.resolve(__dirname, '../../');

// Load base .env first, then override with .env.local
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(serverDir, '.env') });
dotenv.config({ path: path.join(projectRoot, '.env.local'), override: true });
dotenv.config({ path: path.join(serverDir, '.env.local'), override: true });

// Fallback to local docker db port 5433 if not provided
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5433/musdb';
console.log('Connecting to DB with connection URL:', connectionString.replace(/:[^:@]+@/, ':***@'));

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Helper to format currency words in Indonesian
function numberToIndonesianWords(num: number): string {
  const units = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  function convert(n: number): string {
    if (n < 12) return units[n]!;
    if (n < 20) return convert(n - 10) + ' Belas';
    if (n < 100) return convert(Math.floor(n / 10)) + ' Puluh' + (n % 10 !== 0 ? ' ' + convert(n % 10) : '');
    if (n < 200) return 'Seratus' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 1000) return convert(Math.floor(n / 100)) + ' Ratus' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 2000) return 'Seribu' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' Juta' + (n % 1000000 !== 0 ? ' ' + convert(n % 1000000) : '');
    return n.toString();
  }
  const intPart = Math.floor(num);
  return (convert(intPart) + ' Riyal Arab Saudi').trim();
}

async function seed() {
  console.log('🚀 Starting comprehensive dummy data generation for Musafirin...');

  try {
    const timestamp = Date.now();
    const currentYear = new Date().getFullYear();

    // -------------------------------------------------------------
    // 0. FETCH EXISTING USERS (Owner, Admin, Agent, Direct User)
    // -------------------------------------------------------------
    console.log('👤 Fetching users...');
    const users = await db.select().from(schema.user);
    const ownerUser = users.find(u => u.role === 'owner') || users[0];
    const adminUser = users.find(u => u.role === 'admin') || users[0];
    const agentUser = users.find(u => u.userType === 'agent') || users[1] || users[0];
    const directUser = users.find(u => u.userType === 'direct') || users[0];

    const ownerId = ownerUser?.id || null;
    const adminId = adminUser?.id || null;
    const agentId = agentUser?.id || null;
    const directUserId = directUser?.id || null;

    // Ensure Agent Company Profile exists
    if (agentId) {
      const existingProfile = await db.select().from(schema.agentCompanyProfiles).where(eq(schema.agentCompanyProfiles.userId, agentId));
      if (existingProfile.length === 0) {
        await db.insert(schema.agentCompanyProfiles).values({
          userId: agentId,
          companyName: 'PT Safir Nusantara Mandiri',
          companyPhone: '+6281234567890',
          companyEmail: 'info@safirnusantara.com',
          companyAddress: 'Jl. Pemuda No. 45, Surabaya, Jawa Timur',
          city: 'Surabaya',
          province: 'Jawa Timur',
          country: 'Indonesia',
          licenseNumber: 'KEMENAG-PPIU/2023/8891',
          notes: 'Mitra travel agent resmi PPIU Jawa Timur sejak 2021',
        });
        console.log('  ✓ Created Agent Company Profile for Mitra Travel Agent');
      }
    }

    // -------------------------------------------------------------
    // 1. SEED MASTER CLIENTS & DEPOSIT BALANCES
    // -------------------------------------------------------------
    console.log('🏢 Seeding Indonesian Travel Clients & Deposits...');
    const clientsData = [
      {
        name: 'PT Cahaya Haramain Mandiri',
        email: 'info@cahayaharamain.com',
        phone: '+6281122334455',
        address: 'Kuningan City Mall Lt. 3, Jakarta Selatan',
        deposit: '250000.00',
        deposited: '350000.00',
        used: '100000.00',
      },
      {
        name: 'PT Al-Mabroor Wisata Utama',
        email: 'operasional@almabroor.co.id',
        phone: '+6281233445566',
        address: 'Jl. Raya Darmo No. 88, Surabaya, Jawa Timur',
        deposit: '180000.00',
        deposited: '250000.00',
        used: '70000.00',
      },
      {
        name: 'PT Annur Hidayah Tour & Travel',
        email: 'booking@annurhidayah.com',
        phone: '+6281399887766',
        address: 'Jl. R.E. Martadinata No. 120, Bandung, Jawa Barat',
        deposit: '125000.00',
        deposited: '150000.00',
        used: '25000.00',
      },
      {
        name: 'PT Barakah Al-Madinah Tour',
        email: 'kontak@barakahmadinah.com',
        phone: '+628116543210',
        address: 'Jl. Gatot Subroto No. 55, Medan, Sumatera Utara',
        deposit: '95000.00',
        deposited: '140000.00',
        used: '45000.00',
      },
      {
        name: 'PT Risalah Safari Mandiri',
        email: 'travel@risalahsafari.com',
        phone: '+6281244556677',
        address: 'Jl. A.P. Pettarani No. 12, Makassar, Sulawesi Selatan',
        deposit: '65000.00',
        deposited: '100000.00',
        used: '35000.00',
      },
      {
        name: 'PT Menara Suci Wisata',
        email: 'sales@menarasuci.co.id',
        phone: '+6281229988112',
        address: 'Jl. Slamet Riyadi No. 200, Surakarta, Jawa Tengah',
        deposit: '110000.00',
        deposited: '160000.00',
        used: '50000.00',
      },
    ];

    const insertedClients: schema.Client[] = [];
    for (const c of clientsData) {
      let clientRec = (await db.select().from(schema.clients).where(eq(schema.clients.email, c.email)))[0];
      if (!clientRec) {
        const [inserted] = await db.insert(schema.clients).values({
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.address,
          isActive: true,
        }).returning();
        clientRec = inserted!;
      }
      insertedClients.push(clientRec);

      // Client Deposit
      const existingDeposit = await db.select().from(schema.clientDeposits).where(eq(schema.clientDeposits.clientId, clientRec.id));
      if (existingDeposit.length === 0) {
        await db.insert(schema.clientDeposits).values({
          clientId: clientRec.id,
          currentBalance: c.deposit,
          totalDeposited: c.deposited,
          totalUsed: c.used,
          currency: 'SAR',
          lastTransactionAt: new Date(),
        });
      }

      // Deposit Transactions
      const existingTx = await db.select().from(schema.depositTransactions).where(eq(schema.depositTransactions.clientId, clientRec.id));
      if (existingTx.length === 0) {
        await db.insert(schema.depositTransactions).values([
          {
            clientId: clientRec.id,
            type: 'deposit',
            amount: c.deposited,
            balanceBefore: '0.00',
            balanceAfter: c.deposited,
            currency: 'SAR',
            status: 'completed',
            description: `Initial bank transfer topup for ${c.name}`,
            referenceNumber: `DEP-${Math.floor(100000 + Math.random() * 900000)}`,
            processedBy: 'System Admin',
            processedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
          },
          {
            clientId: clientRec.id,
            type: 'usage',
            amount: c.used,
            balanceBefore: c.deposited,
            balanceAfter: c.deposit,
            currency: 'SAR',
            status: 'completed',
            description: `Deposit usage for hotel booking & visa arrangement`,
            referenceNumber: `USG-${Math.floor(100000 + Math.random() * 900000)}`,
            processedBy: 'System Admin',
            processedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
          },
        ]);
      }
    }
    console.log(`  ✓ ${insertedClients.length} Clients & Deposits verified.`);

    // -------------------------------------------------------------
    // 2. SEED MASTER MUTHOWIFS
    // -------------------------------------------------------------
    console.log('👳 Seeding Muthowifs...');
    const muthowifsData = [
      {
        name: 'Ust. Ahmad Fauzi Lc.',
        phone: '+966501234567',
        iqamaOrPassportNo: 'IQ-998877665',
        visaStatus: 'student' as const,
        residentType: 'mahasiswa' as const,
        residenceLocation: 'Universitas Islam Madinah',
        lastEducation: 'S1 Syariah UIM',
        status: 'idle' as const,
        notes: 'Sangat berpengalaman memimpin rombongan VIP dan manasik umrah akurat',
        isActive: true,
      },
      {
        name: 'Ust. Budi Santoso',
        phone: '+966509876543',
        iqamaOrPassportNo: 'IQ-112233445',
        visaStatus: 'resident' as const,
        residentType: 'mukimin' as const,
        residenceLocation: 'Misfalah, Makkah',
        lastEducation: 'SMA / Ma\'had Al-Haram',
        status: 'assigned' as const,
        notes: 'Mukimin 12 tahun, menguasai rute ziarah Makkah & sejarah Jabal Nur',
        isActive: true,
      },
      {
        name: 'Ust. Salman Al-Farisi M.Ag',
        phone: '+966551122334',
        iqamaOrPassportNo: 'IQ-445566778',
        visaStatus: 'student' as const,
        residentType: 'mahasiswa' as const,
        residenceLocation: 'Al-Awali, Makkah (Umm Al-Qura University)',
        lastEducation: 'S2 Ushul Fiqh Umm Al-Qura',
        status: 'idle' as const,
        notes: 'Pakar sejarah Makkah & Madinah, bahasa Arab fasih dan ramah jamaah lansia',
        isActive: true,
      },
      {
        name: 'Ust. Muhammad Ridwan Lc.',
        phone: '+966548899001',
        iqamaOrPassportNo: 'IQ-778899002',
        visaStatus: 'resident' as const,
        residentType: 'mukimin' as const,
        residenceLocation: 'Qurban, Madinah',
        lastEducation: 'S1 Hadits UIM',
        status: 'idle' as const,
        notes: 'Berpengalaman mendampingi city tour Madinah, Khandaq, dan Raudhah',
        isActive: true,
      },
      {
        name: 'Ust. Zakariya Al-Anshori',
        phone: '+966567788990',
        iqamaOrPassportNo: 'IQ-334455667',
        visaStatus: 'resident' as const,
        residentType: 'mukimin' as const,
        residenceLocation: 'Aziziyah, Makkah',
        lastEducation: 'Ma\'had Haromain',
        status: 'idle' as const,
        notes: 'Muthowif enerjik, spesialisasi rombongan keluarga besar dan anak muda',
        isActive: true,
      },
    ];

    const insertedMuthowifs: schema.Muthowif[] = [];
    for (const m of muthowifsData) {
      let mRec = (await db.select().from(schema.muthowifs).where(eq(schema.muthowifs.phone, m.phone)))[0];
      if (!mRec) {
        const [inserted] = await db.insert(schema.muthowifs).values(m).returning();
        mRec = inserted!;
      }
      insertedMuthowifs.push(mRec);
    }
    console.log(`  ✓ ${insertedMuthowifs.length} Muthowifs ready.`);

    // -------------------------------------------------------------
    // 3. SEED MASTER TRANSPORT ROUTES & PRICING
    // -------------------------------------------------------------
    console.log('🚌 Seeding Master Transport Routes...');
    const routesData = [
      {
        originLocation: 'Jeddah King Abdulaziz Airport (JED)',
        destinationLocation: 'Makkah Hotel (Haram / Aziziyah)',
        supplierName: 'Al-Haram VIP Transport',
        picName: 'Sheikh Tariq Al-Otaibi',
        picContact: '+966504445566',
      },
      {
        originLocation: 'Makkah Hotel',
        destinationLocation: 'Madinah Hotel',
        supplierName: 'Saptco VIP Express',
        picName: 'Fahd Transport Manager',
        picContact: '+966503334445',
      },
      {
        originLocation: 'Madinah Hotel',
        destinationLocation: 'Prince Mohammad Bin Abdulaziz Airport (MED)',
        supplierName: 'Al-Rawdah City Lines',
        picName: 'Yasser Madani',
        picContact: '+966559876543',
      },
      {
        originLocation: 'Makkah Hotel',
        destinationLocation: 'Ziarah Makkah (Jabal Tsur, Arafah, Muzdalifah, Mina, Jabal Nur)',
        supplierName: 'Al-Haram VIP Transport',
        picName: 'Sheikh Tariq Al-Otaibi',
        picContact: '+966504445566',
      },
      {
        originLocation: 'Madinah Hotel',
        destinationLocation: 'Ziarah Madinah (Masjid Quba, Jabal Uhud, Masjid Qiblatain, Kebun Kurma)',
        supplierName: 'Al-Rawdah City Lines',
        picName: 'Yasser Madani',
        picContact: '+966559876543',
      },
    ];

    const insertedRoutes: schema.TransportationRouteMaster[] = [];
    const routeStartDate = new Date('2026-01-01');
    const routeEndDate = new Date('2026-12-31');

    for (const r of routesData) {
      let rRec = (await db.select().from(schema.transportationRoutesMaster).where(
        eq(schema.transportationRoutesMaster.originLocation, r.originLocation)
      ))[0];

      if (!rRec) {
        const [inserted] = await db.insert(schema.transportationRoutesMaster).values({
          ...r,
          isActive: true,
        }).returning();
        rRec = inserted!;

        // Add pricing periods for bus & hiace
        await db.insert(schema.transportationRoutePricingPeriods).values([
          {
            transportationRouteMasterId: rRec.id,
            vehicleType: 'bus',
            startDate: routeStartDate,
            endDate: routeEndDate,
            costPrice: '750.00',
            sellingPrice: '1000.00',
            agentPrice: '900.00',
            currency: 'SAR',
            isActive: true,
          },
          {
            transportationRouteMasterId: rRec.id,
            vehicleType: 'hiace',
            startDate: routeStartDate,
            endDate: routeEndDate,
            costPrice: '400.00',
            sellingPrice: '600.00',
            agentPrice: '520.00',
            currency: 'SAR',
            isActive: true,
          },
          {
            transportationRouteMasterId: rRec.id,
            vehicleType: 'staria',
            startDate: routeStartDate,
            endDate: routeEndDate,
            costPrice: '500.00',
            sellingPrice: '750.00',
            agentPrice: '680.00',
            currency: 'SAR',
            isActive: true,
          },
        ]);
      }
      insertedRoutes.push(rRec);
    }
    console.log(`  ✓ ${insertedRoutes.length} Transport Routes ready.`);

    // -------------------------------------------------------------
    // 4. SEED MASTER SERVICES
    // -------------------------------------------------------------
    console.log('🛠️ Seeding Master Services...');
    const masterServices = [
      { name: 'Visa Umrah Reguler', category: 'Visa' as const, price: '175.00', unitType: 'Per Pax', description: 'Pengurusan Visa Umrah Resmi Provider Saudi' },
      { name: 'Siskopatuh Kemenag', category: 'Siskopatuh' as const, price: '15.00', unitType: 'Per Pax', description: 'Registrasi Siskopatuh Kemenag RI resmi' },
      { name: 'Handling Airport Jeddah (Kedatangan/Kepulangan)', category: 'Handling Airport' as const, price: '45.00', unitType: 'Per Pax', description: 'Handling bagasi, sambut jamaah di terminal kedatangan/keberangkatan JED' },
      { name: 'Handling Hotel Makkah', category: 'Handling Hotel' as const, price: '40.00', unitType: 'Per Pax', description: 'Pengurusan check-in kamar, pembagian kunci & handling koper hotel Makkah' },
      { name: 'Handling Hotel Madinah', category: 'Handling Hotel' as const, price: '40.00', unitType: 'Per Pax', description: 'Pengurusan check-in kamar & koper hotel Madinah' },
      { name: 'Muthowif Harian Makkah (Guide Ibadah)', category: 'Muthowif' as const, price: '1200.00', unitType: 'Per Group', description: 'Jasa pembimbing ibadah umrah thowaf & sa\'i di Makkah' },
      { name: 'Muthowif Harian Madinah (Ziarah & Raudhah)', category: 'Muthowif' as const, price: '1000.00', unitType: 'Per Group', description: 'Jasa pembimbing ziarah Madinah & bimbingan Raudhah' },
      { name: 'Tiket Kereta Cepat Haramain (Makkah - Madinah)', category: 'Transportasi' as const, price: '175.00', unitType: 'Per Pax', description: 'Tiket Haramain High Speed Railway Kelas Ekonomi' },
      { name: 'Tiket Museum Wahyu (Jabal Nur)', category: 'Tiket Museum' as const, price: '35.00', unitType: 'Per Pax', description: 'Tiket masuk Revelation Exhibition Jabal Nur Makkah' },
    ];

    for (const s of masterServices) {
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
      }
    }
    console.log('  ✓ Master services checked.');

    // -------------------------------------------------------------
    // 5. SEED HOTEL BOOKINGS, INVOICES, PAYMENTS, RECEIPTS & VOUCHERS
    // -------------------------------------------------------------
    console.log('🏨 Seeding Rich Hotel Bookings, Invoices, Receipts & Vouchers...');
    
    // Fetch hotels
    const allHotels = await db.select().from(schema.hotels);
    const makkahHotels = allHotels.filter(h => h.city === 'Makkah');
    const madinahHotels = allHotels.filter(h => h.city === 'Madinah');

    const defaultMakkahHotel = makkahHotels[0]?.name || 'Swissotel Makkah';
    const defaultMadinahHotel = madinahHotels[0]?.name || 'Pullman Zamzam Madinah';

    // We'll create 8 varied hotel bookings
    const bookingsSetup = [
      {
        codeOffset: '101',
        clientIdx: 0,
        hotelName: defaultMakkahHotel,
        city: 'Makkah' as const,
        mealPlan: 'Breakfast' as const,
        daysFromNow: 5,
        nights: 5,
        roomType: 'Double',
        roomCount: 10,
        unitPrice: '580.00',
        costPrice: '480.00',
        totalAmount: '29000.00',
        paymentStatus: 'paid' as const,
        bookingStatus: 'confirmed' as const,
        invoiceStatus: 'paid' as const,
        paidAmount: '29000.00',
        guestName: 'Grup Travel PT Cahaya Haramain Mandiri (20 Pax)',
        hasOperationalCost: true,
        costType: 'handling',
        costAmount: '800.00',
      },
      {
        codeOffset: '102',
        clientIdx: 1,
        hotelName: defaultMadinahHotel,
        city: 'Madinah' as const,
        mealPlan: 'Full Board' as const,
        daysFromNow: 12,
        nights: 4,
        roomType: 'Triple',
        roomCount: 6,
        unitPrice: '520.00',
        costPrice: '410.00',
        totalAmount: '12480.00',
        paymentStatus: 'partial' as const,
        bookingStatus: 'confirmed' as const,
        invoiceStatus: 'partially_paid' as const,
        paidAmount: '6000.00',
        guestName: 'Grup Al-Mabroor Gelombang 1 (18 Pax)',
        hasOperationalCost: true,
        costType: 'porter',
        costAmount: '450.00',
      },
      {
        codeOffset: '103',
        clientIdx: 2,
        hotelName: defaultMakkahHotel,
        city: 'Makkah' as const,
        mealPlan: 'Half Board' as const,
        daysFromNow: 20,
        nights: 6,
        roomType: 'Quad',
        roomCount: 8,
        unitPrice: '650.00',
        costPrice: '520.00',
        totalAmount: '31200.00',
        paymentStatus: 'unpaid' as const,
        bookingStatus: 'pending' as const,
        invoiceStatus: 'sent' as const,
        paidAmount: '0.00',
        guestName: 'Grup Annur Hidayah Reguler (32 Pax)',
        hasOperationalCost: false,
      },
      {
        codeOffset: '104',
        clientIdx: 3,
        hotelName: defaultMadinahHotel,
        city: 'Madinah' as const,
        mealPlan: 'Room Only' as const,
        daysFromNow: -10,
        nights: 5,
        roomType: 'Double',
        roomCount: 4,
        unitPrice: '450.00',
        costPrice: '350.00',
        totalAmount: '9000.00',
        paymentStatus: 'paid' as const,
        bookingStatus: 'confirmed' as const,
        invoiceStatus: 'paid' as const,
        paidAmount: '9000.00',
        guestName: 'Keluarga Bpk. H. Sukardi (8 Pax)',
        hasOperationalCost: true,
        costType: 'guide',
        costAmount: '600.00',
      },
      {
        codeOffset: '105',
        clientIdx: 4,
        hotelName: makkahHotels[1]?.name || defaultMakkahHotel,
        city: 'Makkah' as const,
        mealPlan: 'Full Board' as const,
        daysFromNow: 35,
        nights: 7,
        roomType: 'Double',
        roomCount: 5,
        unitPrice: '750.00',
        costPrice: '620.00',
        totalAmount: '26250.00',
        paymentStatus: 'partial' as const,
        bookingStatus: 'confirmed' as const,
        invoiceStatus: 'partially_paid' as const,
        paidAmount: '10000.00',
        guestName: 'Rombongan Risalah Safari VIP (10 Pax)',
        hasOperationalCost: false,
      },
      {
        codeOffset: '106',
        clientIdx: 5,
        hotelName: madinahHotels[1]?.name || defaultMadinahHotel,
        city: 'Madinah' as const,
        mealPlan: 'Breakfast' as const,
        daysFromNow: -25,
        nights: 4,
        roomType: 'Quad',
        roomCount: 12,
        unitPrice: '480.00',
        costPrice: '380.00',
        totalAmount: '23040.00',
        paymentStatus: 'paid' as const,
        bookingStatus: 'confirmed' as const,
        invoiceStatus: 'paid' as const,
        paidAmount: '23040.00',
        guestName: 'PT Menara Suci Kloter Syawal (48 Pax)',
        hasOperationalCost: true,
        costType: 'handling',
        costAmount: '1200.00',
      },
      {
        codeOffset: '107',
        clientIdx: 0,
        hotelName: defaultMakkahHotel,
        city: 'Makkah' as const,
        mealPlan: 'Breakfast' as const,
        daysFromNow: -5,
        nights: 5,
        roomType: 'Triple',
        roomCount: 5,
        unitPrice: '620.00',
        costPrice: '500.00',
        totalAmount: '15500.00',
        paymentStatus: 'overdue' as const,
        bookingStatus: 'confirmed' as const,
        invoiceStatus: 'overdue' as const,
        paidAmount: '0.00',
        guestName: 'Rombongan Kadin Jabar (15 Pax)',
        hasOperationalCost: false,
      },
      {
        codeOffset: '108',
        clientIdx: 1,
        hotelName: defaultMadinahHotel,
        city: 'Madinah' as const,
        mealPlan: 'Room Only' as const,
        daysFromNow: 40,
        nights: 3,
        roomType: 'Double',
        roomCount: 3,
        unitPrice: '420.00',
        costPrice: '330.00',
        totalAmount: '3780.00',
        paymentStatus: 'unpaid' as const,
        bookingStatus: 'cancelled' as const,
        invoiceStatus: 'cancelled' as const,
        paidAmount: '0.00',
        guestName: 'Rombongan Batal (Pembatalan Visa)',
        hasOperationalCost: false,
      },
    ];

    let bkgCounter = 1;
    for (const b of bookingsSetup) {
      const clientObj = insertedClients[b.clientIdx] || insertedClients[0]!;
      const bkgCode = `BK-${currentYear}-${b.codeOffset}`;
      
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + b.daysFromNow);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + b.nights);

      // Check if booking exists
      let bkg = (await db.select().from(schema.bookings).where(eq(schema.bookings.code, bkgCode)))[0];
      if (!bkg) {
        const bookingCreatedDate = new Date(Date.now() - ((bkgCounter % 5) * 1.5) * 24 * 3600 * 1000);
        const [inserted] = await db.insert(schema.bookings).values({
          code: bkgCode,
          clientId: clientObj.id,
          hotelName: b.hotelName,
          city: b.city,
          mealPlan: b.mealPlan,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          totalAmount: b.totalAmount,
          paymentStatus: b.paymentStatus,
          bookingStatus: b.bookingStatus,
          hotelConfirmationNo: `CFM-SA-${Math.floor(100000 + Math.random() * 900000)}`,
          meta: {
            guestLeader: b.guestName,
            notes: 'Pemesanan langsung via sistem B2B Musafirin',
          },
          createdAt: bookingCreatedDate,
          updatedAt: bookingCreatedDate,
        }).returning();
        bkg = inserted!;

        // Add Booking Item
        await db.insert(schema.bookingItems).values({
          bookingId: bkg.id,
          roomType: b.roomType,
          roomCount: b.roomCount,
          unitPrice: b.unitPrice,
          hotelCostPrice: b.costPrice,
          hasPricingPeriods: false,
        });

        // Add Operational Costs if specified
        if (b.hasOperationalCost && b.costAmount) {
          await db.insert(schema.operationalCosts).values({
            bookingId: bkg.id,
            costType: b.costType || 'handling',
            description: `Biaya operasional lapangan (${b.costType}) untuk rombongan`,
            amount: b.costAmount,
            currency: 'SAR',
          });
        }
      }

      // Add Invoice
      const invNumber = `INV-${currentYear}-${(1000 + bkgCounter).toString()}`;
      let inv = (await db.select().from(schema.invoices).where(eq(schema.invoices.number, invNumber)))[0];
      if (!inv) {
        const dueDate = new Date(checkInDate);
        dueDate.setDate(dueDate.getDate() - 3);
        const invoiceIssueDate = new Date(Date.now() - ((bkgCounter % 5) * 1.5) * 24 * 3600 * 1000);

        const [insertedInv] = await db.insert(schema.invoices).values({
          number: invNumber,
          bookingId: bkg.id,
          amount: b.totalAmount,
          paidAmount: b.paidAmount,
          currency: 'SAR',
          issueDate: invoiceIssueDate,
          dueDate: dueDate,
          status: b.invoiceStatus,
          pdfUrl: `http://localhost:9000/hotel-booking/invoices/${invNumber}.pdf`,
        }).returning();
        inv = insertedInv!;

        // If paid or partially paid, create payment record and receipt
        const paidNum = parseFloat(b.paidAmount);
        if (paidNum > 0) {
          await db.insert(schema.invoicePayments).values({
            invoiceId: inv.id,
            amount: b.paidAmount,
            currency: 'SAR',
            method: 'bank_transfer',
            referenceNumber: `TRF-BSI-${Math.floor(100000 + Math.random() * 900000)}`,
            paidAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
            status: 'completed',
          });

          // Receipt (Kwitansi)
          const kwtNumber = `KWT-${currentYear}-${(2000 + bkgCounter).toString()}`;
          const balanceDue = (parseFloat(b.totalAmount) - paidNum).toFixed(2);
          await db.insert(schema.receipts).values({
            number: kwtNumber,
            bookingId: bkg.id,
            invoiceId: inv.id,
            totalAmount: b.totalAmount,
            paidAmount: b.paidAmount,
            balanceDue: balanceDue,
            currency: 'SAR',
            issueDate: new Date(),
            payerName: clientObj.name,
            payerEmail: clientObj.email,
            payerPhone: clientObj.phone,
            payerAddress: clientObj.address,
            hotelName: b.hotelName,
            bankName: 'Bank Syariah Indonesia (BSI)',
            bankCountry: 'Indonesia',
            accountName: 'PT Musafirin Global Travel',
            accountNumberOrIBAN: '7192837465',
            notes: `Pembayaran hotel ${b.hotelName} untuk rombongan ${b.guestName}`,
            amountInWords: numberToIndonesianWords(paidNum),
            pdfUrl: `http://localhost:9000/hotel-booking/receipts/${kwtNumber}.pdf`,
            meta: [
              {
                method: 'Bank Transfer (BSI VA)',
                amount: b.paidAmount,
                date: new Date().toISOString(),
                ref: `TRF-BSI-${Math.floor(100000 + Math.random() * 900000)}`,
              }
            ],
          });
        }

        // Voucher for confirmed booking
        if (b.bookingStatus === 'confirmed') {
          const vchNumber = `VCH-${currentYear}-${(3000 + bkgCounter).toString()}`;
          await db.insert(schema.vouchers).values({
            number: vchNumber,
            bookingId: bkg.id,
            guestName: b.guestName,
            qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${vchNumber}`,
            pdfUrl: `http://localhost:9000/hotel-booking/vouchers/${vchNumber}.pdf`,
            createdAt: new Date(),
          });
        }
      }
      bkgCounter++;
    }
    console.log(`  ✓ ${bookingsSetup.length} Hotel Bookings, Invoices, Receipts & Vouchers ready.`);

    // -------------------------------------------------------------
    // 6. SEED SERVICE ORDERS (Visa Umrah & Siskopatuh)
    // -------------------------------------------------------------
    console.log('🛂 Seeding Service Orders (Visa & Siskopatuh)...');
    const serviceOrdersSetup = [
      {
        number: `SO-${currentYear}-0101`,
        clientIdx: 0,
        leaderName: 'Ust. H. Ridwan Kamil',
        leaderPhone: '+6281299881122',
        productType: 'visa_umrah' as const,
        pkg: 'Visa Umrah Reguler 90 Hari',
        pax: 45,
        unitUSD: '185.00',
        totalUSD: '8325.00',
        status: 'paid' as const,
        invStatus: 'paid' as const,
        paidAmount: '31218.75',
        daysAhead: 15,
      },
      {
        number: `SO-${currentYear}-0102`,
        clientIdx: 1,
        leaderName: 'H. Bambang Sugianto',
        leaderPhone: '+6281355443322',
        productType: 'visa_umrah' as const,
        pkg: 'Visa Umrah Fast Track VIP',
        pax: 20,
        unitUSD: '210.00',
        totalUSD: '4200.00',
        status: 'submitted' as const,
        invStatus: 'sent' as const,
        paidAmount: '0.00',
        daysAhead: 25,
      },
      {
        number: `SO-${currentYear}-0103`,
        clientIdx: 2,
        leaderName: 'Hj. Siti Mariam',
        leaderPhone: '+6281877665544',
        productType: 'siskopatuh' as const,
        pkg: 'Registrasi Siskopatuh Massal',
        pax: 50,
        unitUSD: '15.00',
        totalUSD: '750.00',
        status: 'paid' as const,
        invStatus: 'paid' as const,
        paidAmount: '2812.50',
        daysAhead: 10,
      },
      {
        number: `SO-${currentYear}-0104`,
        clientIdx: 3,
        leaderName: 'Ust. H. Fauzan Akbar',
        leaderPhone: '+628114433221',
        productType: 'visa_umrah' as const,
        pkg: 'Visa Umrah Reguler',
        pax: 35,
        unitUSD: '180.00',
        totalUSD: '6300.00',
        status: 'draft' as const,
        invStatus: 'draft' as const,
        paidAmount: '0.00',
        daysAhead: 40,
      },
    ];

    let soCounter = 1;
    for (const so of serviceOrdersSetup) {
      const clientObj = insertedClients[so.clientIdx] || insertedClients[0]!;
      const totalSAR = (parseFloat(so.totalUSD) * 3.75).toFixed(2);
      const depDate = new Date();
      depDate.setDate(depDate.getDate() + so.daysAhead);
      const retDate = new Date(depDate);
      retDate.setDate(retDate.getDate() + 12);

      let soRec = (await db.select().from(schema.serviceOrders).where(eq(schema.serviceOrders.number, so.number)))[0];
      if (!soRec) {
        const [inserted] = await db.insert(schema.serviceOrders).values({
          number: so.number,
          clientId: clientObj.id,
          userId: adminId,
          servicePackage: so.pkg,
          productType: so.productType,
          status: so.status,
          groupLeaderName: so.leaderName,
          groupLeaderPhone: so.leaderPhone,
          totalPeople: so.pax,
          unitPriceUSD: so.unitUSD,
          totalPriceUSD: so.totalUSD,
          agentUnitPriceUSD: (parseFloat(so.unitUSD) - 15).toFixed(2),
          agentTotalPriceUSD: ((parseFloat(so.unitUSD) - 15) * so.pax).toFixed(2),
          currency: 'USD',
          exchangeRateToSAR: '3.7500',
          totalPriceSAR: totalSAR,
          agentTotalPriceSAR: (((parseFloat(so.unitUSD) - 15) * so.pax) * 3.75).toFixed(2),
          departureDate: depDate,
          returnDate: retDate,
          notes: `Permintaan pengurusan ${so.pkg} rombongan ${so.leaderName}`,
          meta: {
            airlines: 'Saudia Airlines SV-819',
            pnrCode: 'K892LM',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();
        soRec = inserted!;

        // Add Checklist
        await db.insert(schema.serviceOrderChecklists).values({
          serviceOrderId: soRec.id,
          items: {
            passport: true,
            ktp: true,
            kk: true,
            foto: true,
            bukuNikah: true,
            vaksinMeningitis: true,
            hotelMakkah: true,
            hotelMadinah: true,
            tiketPesawat: true,
          },
          remarks: 'Dokumen lengkap, siap submit ke provider muassasah',
        });

        // Add Service Order Invoice
        const soiNumber = `SOI-${currentYear}-${(5000 + soCounter).toString()}`;
        const [soInv] = await db.insert(schema.serviceOrderInvoices).values({
          number: soiNumber,
          serviceOrderId: soRec.id,
          amount: totalSAR,
          paidAmount: so.paidAmount,
          currency: 'SAR',
          issueDate: new Date(),
          dueDate: depDate,
          status: so.invStatus,
          pdfUrl: `http://localhost:9000/hotel-booking/service-invoices/${soiNumber}.pdf`,
        }).returning();

        // Add Payment & Receipt if paid
        if (parseFloat(so.paidAmount) > 0) {
          await db.insert(schema.serviceOrderInvoicePayments).values({
            invoiceId: soInv!.id,
            amount: so.paidAmount,
            currency: 'SAR',
            method: 'bank_transfer',
            referenceNumber: `TRF-BSI-${Math.floor(100000 + Math.random() * 900000)}`,
            paidAt: new Date(),
            status: 'completed',
          });

          const sorNumber = `SOR-${currentYear}-${(6000 + soCounter).toString()}`;
          await db.insert(schema.serviceOrderReceipts).values({
            number: sorNumber,
            serviceOrderId: soRec.id,
            serviceOrderInvoiceId: soInv!.id,
            totalAmount: totalSAR,
            paidAmount: so.paidAmount,
            balanceDue: '0.00',
            currency: 'SAR',
            issueDate: new Date(),
            payerName: clientObj.name,
            payerEmail: clientObj.email,
            payerPhone: clientObj.phone,
            notes: `Lunas pembayaran ${so.pkg} rombongan ${so.leaderName}`,
            amountInWords: numberToIndonesianWords(parseFloat(so.paidAmount)),
          });
        }
      }
      soCounter++;
    }
    console.log(`  ✓ ${serviceOrdersSetup.length} Service Orders ready.`);

    // -------------------------------------------------------------
    // 7. SEED TRANSPORTATION BOOKINGS & ROUTES
    // -------------------------------------------------------------
    console.log('🚖 Seeding Transportation Bookings, Routes, Invoices & Vouchers...');
    const transportBookingsSetup = [
      {
        number: `TB-${currentYear}-0201`,
        clientIdx: 0,
        customerName: 'Rombongan VIP PT Cahaya Haramain (45 Pax)',
        customerPhone: '+6281122334455',
        status: 'confirmed' as const,
        totalAmount: '4500.00',
        routes: [
          {
            origin: 'Jeddah King Abdulaziz Airport (JED)',
            dest: 'Swissotel Makkah',
            vehicle: 'bus' as const,
            price: '1500.00',
            driver: 'Tariq Al-Otaibi',
            phone: '+966504445566',
            plate: '4821 BHD',
            daysAhead: 5,
          },
          {
            origin: 'Swissotel Makkah',
            dest: 'Pullman Zamzam Madinah',
            vehicle: 'bus' as const,
            price: '1800.00',
            driver: 'Tariq Al-Otaibi',
            phone: '+966504445566',
            plate: '4821 BHD',
            daysAhead: 10,
          },
          {
            origin: 'Pullman Zamzam Madinah',
            dest: 'Prince Mohammad Bin Abdulaziz Airport (MED)',
            vehicle: 'bus' as const,
            price: '1200.00',
            driver: 'Youssef Al-Ghamdi',
            phone: '+966559876543',
            plate: '7729 KSA',
            daysAhead: 15,
          },
        ],
      },
      {
        number: `TB-${currentYear}-0202`,
        clientIdx: 1,
        customerName: 'Keluarga Bpk. H. Sukardi (8 Pax)',
        customerPhone: '+6281233445566',
        status: 'confirmed' as const,
        totalAmount: '2100.00',
        routes: [
          {
            origin: 'Jeddah King Abdulaziz Airport (JED)',
            dest: 'Makkah Clock Royal Tower',
            vehicle: 'hiace' as const,
            price: '700.00',
            driver: 'Sultan Mansoor',
            phone: '+966541122334',
            plate: '9921 KSA',
            daysAhead: 8,
          },
          {
            origin: 'Makkah Hotel',
            dest: 'Ziarah Makkah (Jabal Tsur & Arafah)',
            vehicle: 'hiace' as const,
            price: '600.00',
            driver: 'Sultan Mansoor',
            phone: '+966541122334',
            plate: '9921 KSA',
            daysAhead: 10,
          },
          {
            origin: 'Makkah Clock Royal Tower',
            dest: 'Madinah Hotel',
            vehicle: 'hiace' as const,
            price: '800.00',
            driver: 'Sultan Mansoor',
            phone: '+966541122334',
            plate: '9921 KSA',
            daysAhead: 13,
          },
        ],
      },
      {
        number: `TB-${currentYear}-0203`,
        clientIdx: 2,
        customerName: 'Grup Annur Hidayah Ziarah Madinah (30 Pax)',
        customerPhone: '+6281399887766',
        status: 'completed' as const,
        totalAmount: '1100.00',
        routes: [
          {
            origin: 'Madinah Hotel',
            dest: 'Ziarah Madinah (Masjid Quba, Uhud, Qiblatain)',
            vehicle: 'bus' as const,
            price: '1100.00',
            driver: 'Amir Al-Harbi',
            phone: '+966567788112',
            plate: '1102 KSA',
            daysAhead: -5,
          },
        ],
      },
    ];

    let tbCounter = 1;
    for (const tb of transportBookingsSetup) {
      const clientObj = insertedClients[tb.clientIdx] || insertedClients[0]!;
      let tbRec = (await db.select().from(schema.transportationBookings).where(eq(schema.transportationBookings.number, tb.number)))[0];
      if (!tbRec) {
        const [inserted] = await db.insert(schema.transportationBookings).values({
          number: tb.number,
          clientId: clientObj.id,
          customerName: tb.customerName,
          customerPhone: tb.customerPhone,
          customerEmail: clientObj.email,
          status: tb.status,
          totalAmount: tb.totalAmount,
          currency: 'SAR',
          notes: 'Pemesanan armada bus/hiace full AC eksekutif',
        }).returning();
        tbRec = inserted!;

        // Insert Routes
        for (const r of tb.routes) {
          const pickupDate = new Date();
          pickupDate.setDate(pickupDate.getDate() + r.daysAhead);
          pickupDate.setHours(9, 0, 0, 0);

          await db.insert(schema.transportationRoutes).values({
            transportationBookingId: tbRec.id,
            pickupDateTime: pickupDate,
            originLocation: r.origin,
            destinationLocation: r.dest,
            vehicleType: r.vehicle,
            price: r.price,
            currency: 'SAR',
            driverName: r.driver,
            driverPhone: r.phone,
            vehiclePlateNumber: r.plate,
            notes: 'Driver siap stand-by 30 menit sebelum jadwal pickup',
          });
        }

        // Transportation Invoice
        const tiNumber = `TI-${currentYear}-${(7000 + tbCounter).toString()}`;
        const [tInv] = await db.insert(schema.transportationInvoices).values({
          number: tiNumber,
          transportationBookingId: tbRec.id,
          amount: tb.totalAmount,
          paidAmount: tb.status === 'confirmed' || tb.status === 'completed' ? tb.totalAmount : '0.00',
          currency: 'SAR',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
          status: tb.status === 'confirmed' || tb.status === 'completed' ? 'paid' : 'sent',
        }).returning();

        // If paid, create payment, receipt, and voucher
        if (tb.status === 'confirmed' || tb.status === 'completed') {
          await db.insert(schema.transportationInvoicePayments).values({
            invoiceId: tInv!.id,
            amount: tb.totalAmount,
            currency: 'SAR',
            method: 'bank_transfer',
            referenceNumber: `TRF-TRB-${Math.floor(100000 + Math.random() * 900000)}`,
            paidAt: new Date(),
            status: 'completed',
          });

          const trNumber = `TR-${currentYear}-${(8000 + tbCounter).toString()}`;
          await db.insert(schema.transportationReceipts).values({
            number: trNumber,
            transportationBookingId: tbRec.id,
            transportationInvoiceId: tInv!.id,
            totalAmount: tb.totalAmount,
            paidAmount: tb.totalAmount,
            balanceDue: '0.00',
            currency: 'SAR',
            issueDate: new Date(),
            payerName: clientObj.name,
            payerEmail: clientObj.email,
            payerPhone: clientObj.phone,
            notes: `Lunas sewa armada transportasi ${tb.customerName}`,
            amountInWords: numberToIndonesianWords(parseFloat(tb.totalAmount)),
          });

          const tvNumber = `TV-${currentYear}-${(9000 + tbCounter).toString()}`;
          await db.insert(schema.transportationVouchers).values({
            number: tvNumber,
            transportationBookingId: tbRec.id,
          });
        }
      }
      tbCounter++;
    }
    console.log(`  ✓ ${transportBookingsSetup.length} Transportation Bookings ready.`);

    // -------------------------------------------------------------
    // 8. SEED MUTHOWIF BOOKINGS
    // -------------------------------------------------------------
    console.log('📖 Seeding Muthowif Bookings, Invoices & Vouchers...');
    const muthowifBookingsSetup = [
      {
        number: `MB-${currentYear}-0301`,
        clientIdx: 0,
        guestName: 'Rombongan PT Cahaya Haramain Mandiri (45 Pax)',
        events: ['Umrah', 'Makkah City Tour'],
        totalPax: 45,
        meetingPoint: 'Lobby Swissotel Makkah',
        status: 'confirmed' as const,
        amount: '2200.00',
        muthowifIdx: 0, // Ust. Ahmad Fauzi Lc.
        daysAhead: 6,
      },
      {
        number: `MB-${currentYear}-0302`,
        clientIdx: 1,
        guestName: 'Keluarga Bpk. H. Sukardi (8 Pax)',
        events: ['Umrah'],
        totalPax: 8,
        meetingPoint: 'Pintu 1 King Abdulaziz Gate, Masjidil Haram',
        status: 'confirmed' as const,
        amount: '1200.00',
        muthowifIdx: 1, // Ust. Budi Santoso
        daysAhead: 9,
      },
      {
        number: `MB-${currentYear}-0303`,
        clientIdx: 2,
        guestName: 'Grup Annur Hidayah Ziarah Madinah (32 Pax)',
        events: ['Madinah City Tour'],
        totalPax: 32,
        meetingPoint: 'Lobby Pullman Zamzam Madinah',
        status: 'completed' as const,
        amount: '1000.00',
        muthowifIdx: 3, // Ust. Muhammad Ridwan Lc.
        daysAhead: -4,
      },
    ];

    let mbCounter = 1;
    for (const mb of muthowifBookingsSetup) {
      const clientObj = insertedClients[mb.clientIdx] || insertedClients[0]!;
      const assignedM = insertedMuthowifs[mb.muthowifIdx] || insertedMuthowifs[0]!;

      let mbRec = (await db.select().from(schema.muthowifBookings).where(eq(schema.muthowifBookings.number, mb.number)))[0];
      if (!mbRec) {
        const eventDate = new Date();
        eventDate.setDate(eventDate.getDate() + mb.daysAhead);
        eventDate.setHours(16, 0, 0, 0);

        const [inserted] = await db.insert(schema.muthowifBookings).values({
          number: mb.number,
          clientId: clientObj.id,
          guestName: mb.guestName,
          dateTime: eventDate,
          events: mb.events,
          totalPax: mb.totalPax,
          meetingPoint: mb.meetingPoint,
          status: mb.status,
          totalAmount: mb.amount,
          currency: 'SAR',
          assignedMuthowifId: assignedM.id,
          notes: `Muthowif ditugaskan: ${assignedM.name} (${assignedM.phone})`,
        }).returning();
        mbRec = inserted!;

        // Add assignment log
        await db.insert(schema.muthowifAssignments).values({
          muthowifId: assignedM.id,
          referenceType: 'booking',
          referenceId: mbRec.id,
          startDate: eventDate,
          endDate: new Date(eventDate.getTime() + 6 * 3600 * 1000),
          taskDescription: `Bimbingan ${mb.events.join(' & ')} untuk ${mb.guestName}`,
          status: mb.status === 'completed' ? 'completed' : 'active',
          assignedBy: 'System Admin',
        });

        // Muthowif Invoice
        const mbiNumber = `MBI-${currentYear}-${(1000 + mbCounter).toString()}`;
        const [mbi] = await db.insert(schema.muthowifInvoices).values({
          number: mbiNumber,
          muthowifBookingId: mbRec.id,
          amount: mb.amount,
          paidAmount: mb.amount,
          currency: 'SAR',
          issueDate: new Date(),
          dueDate: eventDate,
          status: 'paid',
        }).returning();

        // Payment & Receipt
        await db.insert(schema.muthowifInvoicePayments).values({
          invoiceId: mbi!.id,
          amount: mb.amount,
          currency: 'SAR',
          method: 'bank_transfer',
          referenceNumber: `TRF-MB-${Math.floor(100000 + Math.random() * 900000)}`,
          paidAt: new Date(),
          status: 'completed',
        });

        const mbrNumber = `MBR-${currentYear}-${(2000 + mbCounter).toString()}`;
        await db.insert(schema.muthowifReceipts).values({
          number: mbrNumber,
          muthowifBookingId: mbRec.id,
          muthowifInvoiceId: mbi!.id,
          totalAmount: mb.amount,
          paidAmount: mb.amount,
          balanceDue: '0.00',
          currency: 'SAR',
          issueDate: new Date(),
          payerName: clientObj.name,
          payerEmail: clientObj.email,
          payerPhone: clientObj.phone,
          notes: `Lunas jasa pembimbing ibadah ${assignedM.name}`,
          amountInWords: numberToIndonesianWords(parseFloat(mb.amount)),
        });

        const mbvNumber = `MBV-${currentYear}-${(3000 + mbCounter).toString()}`;
        await db.insert(schema.muthowifVouchers).values({
          number: mbvNumber,
          muthowifBookingId: mbRec.id,
        });
      }
      mbCounter++;
    }
    console.log(`  ✓ ${muthowifBookingsSetup.length} Muthowif Bookings ready.`);

    // -------------------------------------------------------------
    // 9. SEED CUSTOM LA REQUESTS, INVOICES & EXPENSES
    // -------------------------------------------------------------
    console.log('📦 Seeding Custom LA (Land Arrangement) Requests...');
    const customLaSetup = [
      {
        number: `CLA-${currentYear}-0401`,
        clientIdx: 0,
        customerName: 'Bpk. H. Rahmat Hidayat',
        customerPhone: '+6281299998888',
        travelName: 'Kabilah Tour & Travel',
        status: 'invoiced' as const,
        totalAmountSAR: '52000.00',
        totalPax: 25,
        daysAhead: 18,
      },
      {
        number: `CLA-${currentYear}-0402`,
        clientIdx: 1,
        customerName: 'Hj. Syarifah Fatimah',
        customerPhone: '+6281277889900',
        travelName: 'Safara Mulia Wisata',
        status: 'approved' as const,
        totalAmountSAR: '84000.00',
        totalPax: 40,
        daysAhead: 30,
      },
      {
        number: `CLA-${currentYear}-0403`,
        clientIdx: 2,
        customerName: 'Drs. H. M. Zainuddin',
        customerPhone: '+6281344556677',
        travelName: 'Al-Hidayah Tour & Travel',
        status: 'quoted' as const,
        totalAmountSAR: '36000.00',
        totalPax: 15,
        daysAhead: 45,
      },
    ];

    let claCounter = 1;
    for (const cla of customLaSetup) {
      const clientObj = insertedClients[cla.clientIdx] || insertedClients[0]!;
      let claRec = (await db.select().from(schema.customLaRequests).where(eq(schema.customLaRequests.number, cla.number)))[0];
      if (!claRec) {
        const kedatangan = new Date();
        kedatangan.setDate(kedatangan.getDate() + cla.daysAhead);
        const kepulangan = new Date(kedatangan);
        kepulangan.setDate(kepulangan.getDate() + 9);

        const [inserted] = await db.insert(schema.customLaRequests).values({
          number: cla.number,
          clientId: clientObj.id,
          customerName: cla.customerName,
          customerPhone: cla.customerPhone,
          customerEmail: clientObj.email,
          travelName: cla.travelName,
          status: cla.status,
          totalAmountSAR: cla.totalAmountSAR,
          totalPax: cla.totalPax,
          meta: {
            tanggalKedatangan: kedatangan.toISOString(),
            tanggalKeberangkatan: kepulangan.toISOString(),
            hotelMakkah: 'Swissotel Makkah',
            hotelMadinah: 'Pullman Zamzam Madinah',
            rooms: {
              makkah: { nights: 5, doubleQty: 4, doublePrice: 600, tripleQty: 3, triplePrice: 700, quadQty: 2, quadPrice: 800 },
              madinah: { nights: 4, doubleQty: 4, doublePrice: 480, tripleQty: 3, triplePrice: 550, quadQty: 2, quadPrice: 650 },
            },
            totals: {
              totalPax: cla.totalPax,
              makkahHotelTotal: 21500,
              madinahHotelTotal: 16800,
              totalTransport: 4500,
              subTotalHandling: 3200,
              visaTotal: 4000,
              grandTotal: parseFloat(cla.totalAmountSAR),
              perPaxPrice: Math.round(parseFloat(cla.totalAmountSAR) / cla.totalPax),
              profit: 5000,
            },
            handlingDetails: {
              handlingAirport: 45,
              handlingHotel: 40,
              muthowif: 1200,
              tipDriver: 300,
              tiketMuseum: 35,
            },
          },
        }).returning();
        claRec = inserted!;

        // Add Custom LA Invoice if invoiced/approved
        if (cla.status === 'invoiced' || cla.status === 'approved') {
          const claiNumber = `CLAI-${currentYear}-${(1000 + claCounter).toString()}`;
          const [clai] = await db.insert(schema.customLaInvoices).values({
            number: claiNumber,
            customLaRequestId: claRec.id,
            amount: cla.totalAmountSAR,
            currency: 'SAR',
            issueDate: new Date(),
            dueDate: kedatangan,
            status: 'sent',
          }).returning();

          // Custom LA Expenses to suppliers
          await db.insert(schema.customLaExpenses).values([
            {
              customLaRequestId: claRec.id,
              category: 'hotel',
              supplierName: 'Elaf Group (Swissotel Makkah)',
              description: 'DP 50% Kamar Hotel Swissotel Makkah',
              amount: '10750.00',
              currency: 'SAR',
              status: 'paid',
              paymentDate: new Date(),
              paymentMethod: 'bank_transfer',
              referenceNumber: `EXP-HTL-${Math.floor(100000 + Math.random() * 900000)}`,
            },
            {
              customLaRequestId: claRec.id,
              category: 'transportasi',
              supplierName: 'Al-Haram VIP Transport',
              description: 'Sewa Bus Full Route JED - MAK - MAD - JED',
              amount: '4500.00',
              currency: 'SAR',
              status: 'pending',
              paymentMethod: 'bank_transfer',
            },
          ]);
        }
      }
      claCounter++;
    }
    console.log(`  ✓ ${customLaSetup.length} Custom LA Requests ready.`);

    // -------------------------------------------------------------
    // 10. SEED CRM LEADS
    // -------------------------------------------------------------
    console.log('🎯 Seeding CRM Leads Pipeline...');
    const crmLeadsData = [
      {
        name: 'H. Syamsul Arifin',
        phone: '+6281211112222',
        companyName: 'PT Madinah Iman Wisata',
        requirement: 'Permintaan Land Arrangement (LA) Full Package Umrah Syawal 45 Pax Hotel Bintang 5',
        status: 'DISCUSSION' as const,
        value: '120000.00',
        notes: 'Sedang membandingkan penawaran Swissotel vs Pullman Zamzam. Follow up lusa.',
        assignedTo: ownerId,
        orderIndex: 0,
      },
      {
        name: 'Ibu Hj. Ratna Juwita',
        phone: '+6281333334444',
        companyName: 'PT Juwita Tour & Travel',
        requirement: 'Permintaan 30 Visa Umrah & Booking Kereta Cepat Haramain untuk keberangkatan Rajab',
        status: 'QUOTED' as const,
        value: '22500.00',
        notes: 'Quotation resmi sudah dikirim via WhatsApp & Email, menunggu approval direktur.',
        assignedTo: adminId,
        orderIndex: 1,
      },
      {
        name: 'Bpk. Hendra Gunawan',
        phone: '+6281555556666',
        companyName: 'PT Nusantara Barakah Mandiri',
        requirement: 'Permintaan 10 Kamar Quad Swissotel Makkah + 10 Kamar Quad Madinah periode Maulid',
        status: 'FOLLOW_UP' as const,
        value: '65000.00',
        notes: 'Customer meminta diskon khusus jika take all 20 kamar.',
        assignedTo: ownerId,
        orderIndex: 2,
      },
      {
        name: 'Ust. H. Abdullah Mansur',
        phone: '+6281777778888',
        companyName: 'KBIH Al-Ikhlas Bekasi',
        requirement: 'Paket LA Umrah Plus Turki 50 Jamaah keberangkatan Desember 2026',
        status: 'NEW' as const,
        value: '185000.00',
        notes: 'Lead baru masuk dari formulir website, butuh dihubungi via telpon.',
        assignedTo: adminId,
        orderIndex: 3,
      },
      {
        name: 'H. M. Yusuf Santoso',
        phone: '+6281999990000',
        companyName: 'PT Cordova Safari Tour',
        requirement: 'Booking 1 Armada Bus VIP Saptco rute Jeddah - Makkah - Madinah - Med Airport',
        status: 'WON' as const,
        value: '4500.00',
        notes: 'Deal selesai, sudah terbit invoice TB-2026-0201 dan lunas.',
        assignedTo: adminId,
        orderIndex: 4,
      },
      {
        name: 'Ibu Siti Khadijah',
        phone: '+6281888889999',
        companyName: 'PT Berkah Shafa Wisata',
        requirement: 'Permintaan Hotel Makkah Bintang 3 Ring 1 dengan budget < 350 SAR',
        status: 'LOST' as const,
        value: '15000.00',
        notes: 'Budget tidak cocok dengan ketersediaan hotel ring 1 peak season.',
        assignedTo: ownerId,
        orderIndex: 5,
      },
    ];

    for (const lead of crmLeadsData) {
      const existing = await db.select().from(schema.leads).where(eq(schema.leads.phone, lead.phone));
      if (existing.length === 0) {
        await db.insert(schema.leads).values({
          ...lead,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    console.log(`  ✓ ${crmLeadsData.length} CRM Leads ready.`);

    // -------------------------------------------------------------
    // 11. SEED STORE ORDERS & SHIPMENTS
    // -------------------------------------------------------------
    console.log('🛍️ Seeding Store Orders, Payments & Shipments...');
    if (directUserId) {
      // Create user address
      let userAddr = (await db.select().from(schema.storeUserAddresses).where(eq(schema.storeUserAddresses.userId, directUserId)))[0];
      if (!userAddr) {
        const [insertedAddr] = await db.insert(schema.storeUserAddresses).values({
          userId: directUserId,
          label: 'Kantor Utama',
          recipientName: directUser?.name || 'Fajar Notes',
          recipientPhone: '+6281291535163',
          shippingAddress: 'Gedung Menara Kadin Lt. 15, Jl. H.R. Rasuna Said Blok X-5',
          city: 'Jakarta Selatan',
          province: 'DKI Jakarta',
          postalCode: '12950',
          isDefault: true,
        }).returning();
        userAddr = insertedAddr!;
      }

      // Fetch store products
      const prods = await db.select().from(schema.storeProducts);
      if (prods.length > 0) {
        const p1 = prods[0]!;
        const p2 = prods[1] || prods[0]!;

        const orderNum = `ORD-${currentYear}-99281`;
        let existingOrd = (await db.select().from(schema.storeOrders).where(eq(schema.storeOrders.orderNumber, orderNum)))[0];
        if (!existingOrd) {
          const item1Qty = 2;
          const item1Price = parseFloat(p1.promoPrice || p1.price);
          const item2Qty = 1;
          const item2Price = parseFloat(p2.promoPrice || p2.price);
          const subtotal = item1Qty * item1Price + item2Qty * item2Price;
          const shipping = 25000;
          const total = subtotal + shipping;

          const [insertedOrder] = await db.insert(schema.storeOrders).values({
            orderNumber: orderNum,
            userId: directUserId,
            totalAmount: subtotal.toFixed(2),
            shippingCost: shipping.toFixed(2),
            discountAmount: '0.00',
            finalAmount: total.toFixed(2),
            currency: 'IDR',
            paymentStatus: 'paid',
            orderStatus: 'processing',
            shippingName: userAddr.recipientName,
            shippingPhone: userAddr.recipientPhone,
            shippingAddress: `${userAddr.shippingAddress}, ${userAddr.city}, ${userAddr.province} ${userAddr.postalCode}`,
            trackingNumber: 'JNE-CGK-8819201',
            courierName: 'JNE Reguler',
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 3600 * 1000),
            isPreOrder: false,
          }).returning();

          // Items
          await db.insert(schema.storeOrderItems).values([
            {
              orderId: insertedOrder!.id,
              productId: p1.id,
              quantity: item1Qty,
              price: item1Price.toFixed(2),
              subtotal: (item1Qty * item1Price).toFixed(2),
            },
            {
              orderId: insertedOrder!.id,
              productId: p2.id,
              quantity: item2Qty,
              price: item2Price.toFixed(2),
              subtotal: (item2Qty * item2Price).toFixed(2),
            },
          ]);

          // Payment
          await db.insert(schema.storePayments).values({
            orderId: insertedOrder!.id,
            amount: total.toFixed(2),
            bankName: 'BCA Virtual Account',
            accountName: userAddr.recipientName,
            paymentProofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
            status: 'approved',
            verifiedBy: adminId,
            verifiedAt: new Date(),
          });

          // Shipment
          const [shipment] = await db.insert(schema.storeShipments).values({
            orderId: insertedOrder!.id,
            trackingNumber: 'JNE-CGK-8819201',
            courierName: 'JNE Reguler',
            status: 'OUT_FOR_DELIVERY',
            estimatedArrival: new Date(Date.now() + 1 * 24 * 3600 * 1000),
          }).returning();

          // Shipment Logs
          await db.insert(schema.storeShipmentLogs).values([
            {
              shipmentId: shipment!.id,
              status: 'PENDING',
              description: 'Pesanan diterima dan menunggu proses packing',
            },
            {
              shipmentId: shipment!.id,
              status: 'PACKING',
              description: 'Pesanan telah dipacking rapi dengan bubble wrap',
            },
            {
              shipmentId: shipment!.id,
              status: 'OUT_FOR_DELIVERY',
              description: 'Paket diserahkan ke kurir JNE Tomang untuk pengantaran ke alamat',
            },
          ]);
        }
      }
    }
    console.log('  ✓ Store Orders & Shipments checked.');

    // -------------------------------------------------------------
    // 12. SEED AGENT REQUESTS & TIMELINE
    // -------------------------------------------------------------
    console.log('🤝 Seeding Agent Portal Requests & Timeline...');
    if (agentId) {
      const agentRequestsData = [
        {
          reqNum: `AR-${currentYear}-0601`,
          serviceType: 'hotel' as const,
          status: 'quoted' as const,
          title: 'Permintaan 15 Kamar Double Swissotel Makkah (12-17 Oktober 2026)',
          description: 'Mohon penawaran harga agent terbaik untuk rombongan umrah 30 jamaah plus sarapan',
          totalAmount: '43500.00',
          meta: {
            hotelName: defaultMakkahHotel,
            city: 'Makkah',
            roomType: 'Double',
            roomsCount: 15,
            nights: 5,
            checkIn: '2026-10-12',
            checkOut: '2026-10-17',
          },
          quotationData: {
            unitPrice: 580,
            totalPrice: 43500,
            validUntil: '2026-09-30',
            notes: 'Harga agent khusus rekanan resmi',
          },
        },
        {
          reqNum: `AR-${currentYear}-0602`,
          serviceType: 'visa' as const,
          status: 'paid' as const,
          title: 'Pengurusan 25 Visa Umrah Rombongan Safir Nusantara',
          description: 'Dokumen paspor dan tiket sudah siap, keberangkatan tanggal 20 Oktober 2026',
          totalAmount: '17343.75',
          meta: {
            totalPax: 25,
            departureDate: '2026-10-20',
            airline: 'Garuda Indonesia GA-980',
          },
          quotationData: {
            perPaxUSD: 185,
            totalUSD: 4625,
            totalSAR: 17343.75,
          },
        },
        {
          reqNum: `AR-${currentYear}-0603`,
          serviceType: 'transportation' as const,
          status: 'submitted' as const,
          title: 'Sewa 1 Bus Eksekutif Rute JED Airport ke Makkah',
          description: 'Kedatangan rombongan di Terminal 1 Jeddah pukul 18:30 waktu Saudi',
          totalAmount: '1500.00',
          meta: {
            vehicle: 'bus',
            origin: 'Jeddah King Abdulaziz Airport',
            destination: 'Swissotel Makkah',
            pickupDateTime: '2026-10-20T18:30:00Z',
          },
        },
      ];

      for (const ar of agentRequestsData) {
        let arRec = (await db.select().from(schema.agentRequests).where(eq(schema.agentRequests.requestNumber, ar.reqNum)))[0];
        if (!arRec) {
          const [inserted] = await db.insert(schema.agentRequests).values({
            requestNumber: ar.reqNum,
            agentId: agentId,
            serviceType: ar.serviceType,
            status: ar.status,
            title: ar.title,
            description: ar.description,
            totalAmount: ar.totalAmount,
            currency: 'SAR',
            meta: ar.meta,
            quotationData: ar.quotationData,
            quotationNotes: 'Penawaran harga terbaik dari Musafirin Operations',
            assignedAdminId: adminId,
            createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
            updatedAt: new Date(),
          }).returning();
          arRec = inserted!;

          // Add Timeline
          await db.insert(schema.agentRequestTimeline).values([
            {
              requestId: arRec.id,
              eventType: 'request_created',
              title: 'Pengajuan Request Baru',
              description: `Agent mengajukan request untuk ${ar.title}`,
              actorId: agentId,
              actorRole: 'agent',
            },
            {
              requestId: arRec.id,
              eventType: 'admin_assigned',
              title: 'Request Ditugaskan ke Admin',
              description: 'Admin Operasional sedang meninjau ketersediaan dan menyusun penawaran',
              actorId: adminId,
              actorRole: 'admin',
            },
          ]);

          // Add Notification
          await db.insert(schema.agentNotifications).values({
            userId: agentId,
            requestId: arRec.id,
            title: `Update Request: ${ar.reqNum}`,
            message: `Request Anda "${ar.title}" saat ini berstatus: ${ar.status.toUpperCase()}`,
            type: 'status_change',
            isRead: false,
          });
        }
      }
      console.log(`  ✓ ${agentRequestsData.length} Agent Requests ready.`);
    }

    console.log('\n=============================================================');
    console.log('🎉 ALL DUMMY DATA SUCCESSFULLY CREATED & SYNCHRONIZED! 🎉');
    console.log('=============================================================\n');

  } catch (error) {
    console.error('❌ Error while seeding dummy data:', error);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

seed();
