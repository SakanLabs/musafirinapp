import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from '../db/schema.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local'), override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client, { schema });

const categories = [
  { name: 'Kurma', slug: 'kurma', description: 'Kurma premium asli Arab Saudi' },
  { name: 'Parfum & Oud', slug: 'parfum-oud', description: 'Parfum Timur Tengah, Oud, dan Bukhoor' },
  { name: 'Perlengkapan Ibadah', slug: 'perlengkapan-ibadah', description: 'Sajadah, Tasbih, Al-Quran, dan lainnya' },
  { name: 'Fashion Muslim', slug: 'fashion-muslim', description: 'Abaya, Gamis, dan aksesoris' },
  { name: 'Cinderamata', slug: 'cinderamata', description: 'Oleh-oleh khas Saudi' },
  { name: 'Madu & Herbal', slug: 'madu-herbal', description: 'Madu asli Saudi dan herbal Timur Tengah' },
];

interface ProductSeed {
  name: string;
  slug: string;
  description: string;
  categorySlug: string;
  sku: string;
  stock: number;
  price: number;
  promoPrice: number | null;
  weight: number;
  images: string[];
}

const products: ProductSeed[] = [
  // ===== KURMA =====
  {
    name: 'Kurma Ajwa Al-Madinah Premium 1kg',
    slug: 'kurma-ajwa-premium-1kg',
    description: 'Kurma Ajwa asli dari kebun Al-Madinah Al-Munawwarah. Daging tebal, tekstur lembut, dan rasa manis alami yang khas. Dikemas dalam box premium 1kg.',
    categorySlug: 'kurma',
    sku: 'KRM-001',
    stock: 100,
    price: 120000,
    promoPrice: 99000,
    weight: 1.0,
    images: [
      'https://images.unsplash.com/photo-1595510219848-19c8d0f9ad9e?w=800',
      'https://images.unsplash.com/photo-1596591868191-9750cf2e3f7b?w=800',
    ],
  },
  {
    name: 'Kurma Sukari Grade A 500g',
    slug: 'kurma-sukari-grade-a-500g',
    description: 'Kurma Sukari (Sugar Date) dengan kadar gula alami tinggi, tekstur kenyal, dan rasa manis seperti karamel. Grade A ukuran besar. Kemasan vakum 500g.',
    categorySlug: 'kurma',
    sku: 'KRM-002',
    stock: 150,
    price: 75000,
    promoPrice: null,
    weight: 0.5,
    images: [
      'https://images.unsplash.com/photo-1595510219848-19c8d0f9ad9e?w=800',
    ],
  },
  {
    name: 'Kurma Mabroom Premium 1kg',
    slug: 'kurma-mabroom-premium-1kg',
    description: 'Kurma Mabroom dengan bentuk lonjong khas, daging setengah kering, dan rasa manis legit. Sangat cocok sebagai oleh-oleh.',
    categorySlug: 'kurma',
    sku: 'KRM-003',
    stock: 80,
    price: 135000,
    promoPrice: 110000,
    weight: 1.0,
    images: [
      'https://images.unsplash.com/photo-1596591868191-9750cf2e3f7b?w=800',
    ],
  },

  // ===== PARFUM & OUD =====
  {
    name: 'Oud Kayu Premium 3ml',
    slug: 'oud-kayu-premium-3ml',
    description: 'Minyak Oud asli dari kayu gaharu pilihan. Aroma woody yang kaya dan tahan lama. Cocok untuk pria maupun wanita.',
    categorySlug: 'parfum-oud',
    sku: 'PRF-001',
    stock: 60,
    price: 250000,
    promoPrice: 199000,
    weight: 0.05,
    images: [
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800',
    ],
  },
  {
    name: 'Set Hadiah Parfum & Oud 6ml',
    slug: 'set-hadiah-parfum-oud-6ml',
    description: 'Paket hadiah lengkap berisi 3 varian parfum minyak (Oud, Rose, Musk) dalam botol 2ml. Dikemas dalam kotak hadiah eksklusif.',
    categorySlug: 'parfum-oud',
    sku: 'PRF-002',
    stock: 45,
    price: 350000,
    promoPrice: 295000,
    weight: 0.15,
    images: [
      'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800',
      'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=800',
    ],
  },
  {
    name: 'Bukhoor Bakhoor Premium 100g',
    slug: 'bukhoor-bakhoor-premium-100g',
    description: 'Bukhoor (dupa Arab) berkualitas tinggi dengan campuran Oud dan musk. Wangi tahan lama, cocok untuk acara spesial dan jamuan tamu.',
    categorySlug: 'parfum-oud',
    sku: 'PRF-003',
    stock: 70,
    price: 85000,
    promoPrice: null,
    weight: 0.1,
    images: [
      'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=800',
    ],
  },

  // ===== PERLENGKAPAN IBADAH =====
  {
    name: 'Sajadah Travel Silk Premium',
    slug: 'sajadah-travel-silk-premium',
    description: 'Sajadah travel berbahan sutra halus dengan desain khas Timur Tengah. Ringan, mudah dilipat, dan dilengkapi tas penyimpanan. Cocok untuk perjalanan.',
    categorySlug: 'perlengkapan-ibadah',
    sku: 'IBD-001',
    stock: 90,
    price: 150000,
    promoPrice: 125000,
    weight: 0.3,
    images: [
      'https://images.unsplash.com/photo-1597170346296-30c3b1e4968f?w=800',
    ],
  },
  {
    name: 'Tasbih Kayu Khasanah 99 Butir',
    slug: 'tasbih-kayu-khasanah-99-butir',
    description: 'Tasbih 99 butir dari kayu berkualitas tinggi dengan ukiran tangan. Ringan, halus, dan nyaman digenggam.',
    categorySlug: 'perlengkapan-ibadah',
    sku: 'IBD-002',
    stock: 120,
    price: 65000,
    promoPrice: 50000,
    weight: 0.1,
    images: [
      'https://images.unsplash.com/photo-1597170346296-30c3b1e4968f?w=800',
    ],
  },
  {
    name: 'Al-Quran Tajwid Warna A5',
    slug: 'al-quran-tajwid-warna-a5',
    description: 'Al-Quran dengan tajwid warna memudahkan membaca sesuai hukum bacaan. Ukuran A5 praktis, dilengkapi terjemahan Bahasa Indonesia.',
    categorySlug: 'perlengkapan-ibadah',
    sku: 'IBD-003',
    stock: 50,
    price: 180000,
    promoPrice: null,
    weight: 0.5,
    images: [
      'https://images.unsplash.com/photo-1609599002809-b11f8b921eb1?w=800',
    ],
  },

  // ===== FASHION MUSLIM =====
  {
    name: 'Gamis Pria Katun Rayon Navy',
    slug: 'gamis-pria-katun-rayon-navy',
    description: 'Gamis pria berbahan katun rayon adem dan nyaman. Desain simple elegan dengan warna navy. Cocok untuk sehari-hari maupun acara.',
    categorySlug: 'fashion-muslim',
    sku: 'FSH-001',
    stock: 40,
    price: 200000,
    promoPrice: 175000,
    weight: 0.4,
    images: [
      'https://images.unsplash.com/photo-1611715663272-1e7f3b5ec8d9?w=800',
    ],
  },
  {
    name: 'Abaya Wanita Bordir Emas',
    slug: 'abaya-wanita-bordir-emas',
    description: 'Abaya hitam elegan dengan detail bordir emas tangan. Bahan flowy dan nyaman dipakai. Tersedia ukuran M, L, XL.',
    categorySlug: 'fashion-muslim',
    sku: 'FSH-002',
    stock: 30,
    price: 350000,
    promoPrice: null,
    weight: 0.5,
    images: [
      'https://images.unsplash.com/photo-1611715663272-1e7f3b5ec8d9?w=800',
    ],
  },

  // ===== CINDERAMATA =====
  {
    name: 'Gantungan Kunci Ka\'bah 3D',
    slug: 'gantungan-kunci-kabah-3d',
    description: 'Gantungan kunci replika miniatur Ka\'bah 3D. Terbuat dari resin dengan warna emas. Oleh-oleh khas yang penuh berkah.',
    categorySlug: 'cinderamata',
    sku: 'CDR-001',
    stock: 200,
    price: 25000,
    promoPrice: null,
    weight: 0.03,
    images: [
      'https://images.unsplash.com/photo-1586173054996-1e0a4b417669?w=800',
    ],
  },
  {
    name: 'Magnet Kulkas Masjid Nabawi',
    slug: 'magnet-kulkas-masjid-nabawi',
    description: 'Magnet kulkas dengan gambar Masjid Nabawi kualitas HD. Bahan akrilik tebal dan tahan lama.',
    categorySlug: 'cinderamata',
    sku: 'CDR-002',
    stock: 150,
    price: 20000,
    promoPrice: null,
    weight: 0.02,
    images: [
      'https://images.unsplash.com/photo-1586173054996-1e0a4b417669?w=800',
    ],
  },
  {
    name: 'Piring Hias Khat Arab',
    slug: 'piring-hias-khat-arab',
    description: 'Piring hias dengan kaligrafi khat Arab. Bingkai kayu ukiran tangan, cocok sebagai dekorasi dinding bernuansa Islami.',
    categorySlug: 'cinderamata',
    sku: 'CDR-003',
    stock: 25,
    price: 120000,
    promoPrice: 95000,
    weight: 0.6,
    images: [
      'https://images.unsplash.com/photo-1586173054996-1e0a4b417669?w=800',
    ],
  },

  // ===== MADU & HERBAL =====
  {
    name: 'Madu Asli Saudi Sidr 500g',
    slug: 'madu-asli-saudi-sidr-500g',
    description: 'Madu Sidr asli dari pegunungan Hadramaut dan Saudi. Madu monofloral dengan khasiat tinggi untuk imunitas. Dikemas dalam botol kaca 500g.',
    categorySlug: 'madu-herbal',
    sku: 'MDU-001',
    stock: 60,
    price: 280000,
    promoPrice: 250000,
    weight: 0.6,
    images: [
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800',
    ],
  },
  {
    name: 'Madu Hitam Pahit 350g',
    slug: 'madu-hitam-pahit-350g',
    description: 'Madu hitam pahit (black honey) kaya antioksidan untuk pengobatan alami. Diproses secara tradisional dari nektar bunga liar.',
    categorySlug: 'madu-herbal',
    sku: 'MDU-002',
    stock: 40,
    price: 195000,
    promoPrice: null,
    weight: 0.4,
    images: [
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800',
    ],
  },
  {
    name: 'Habbatus Sauda Minyak 100ml',
    slug: 'habbatus-sauda-minyak-100ml',
    description: 'Minyak Habbatus Sauda (Jintan Hitam) 100% murni cold-pressed. Kaya akan Thymoquinone untuk daya tahan tubuh.',
    categorySlug: 'madu-herbal',
    sku: 'MDU-003',
    stock: 75,
    price: 85000,
    promoPrice: 69000,
    weight: 0.15,
    images: [
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800',
    ],
  },
];

async function seed() {
  console.log('Seeding store data...\n');

  try {
    // Create categories
    console.log('Creating categories...');
    const categoryMap = new Map<string, number>();
    for (const cat of categories) {
      const [inserted] = await db.insert(schema.storeCategories).values({
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      }).returning();
      categoryMap.set(cat.slug, inserted.id);
      console.log(`  ✓ ${cat.name}`);
    }

    // Create products + images
    console.log('\nCreating products...');
    for (const product of products) {
      const categoryId = categoryMap.get(product.categorySlug);
      if (!categoryId) {
        console.error(`  ✗ Category "${product.categorySlug}" not found`);
        continue;
      }

      const [inserted] = await db.insert(schema.storeProducts).values({
        name: product.name,
        slug: product.slug,
        description: product.description,
        categoryId,
        sku: product.sku,
        stock: product.stock,
        price: product.price.toString(),
        promoPrice: product.promoPrice?.toString() || null,
        weight: product.weight.toString(),
        isActive: true,
        isPreOrder: false,
      }).returning();

      // Insert images
      for (let i = 0; i < product.images.length; i++) {
        await db.insert(schema.storeProductImages).values({
          productId: inserted.id,
          imageUrl: product.images[i],
          thumbnail: i === 0,
          sortOrder: i,
        });
      }

      console.log(`  ✓ ${product.name} (${product.images.length} images)`);
    }

    console.log(`\n✅ Done! ${categories.length} categories, ${products.length} products seeded.`);
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await client.end();
  }
}

seed();
