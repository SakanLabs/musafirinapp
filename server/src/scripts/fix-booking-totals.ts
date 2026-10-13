/**
 * Script untuk mendeteksi dan memperbaiki total harga booking hotel yang keliru
 * (misal terisi hanya harga 1 malam padahal durasi menginap > 1 malam).
 *
 * Cara menjalankan:
 * 1. Dry run (hanya cek data tanpa mengubah database):
 *    docker exec -it musafirin_backend bun run server/src/scripts/fix-booking-totals.ts --dry-run
 *
 * 2. Eksekusi perbaikan database:
 *    docker exec -it musafirin_backend bun run server/src/scripts/fix-booking-totals.ts
 */

import { client } from '../db/index.js';

interface AffectedBooking {
  id: number;
  code: string;
  hotelName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  currentTotal: number;
  correctTotal: number;
  oneNightTotal: number;
  paidAmount: number;
  meta: Record<string, any>;
  invoiceId?: number;
  invoiceNumber?: string;
  invoiceAmount?: number;
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('=====================================================');
  console.log(`🔍 MEMERIKSA TOTAL HARGA BOOKING HOTEL ${isDryRun ? '(DRY-RUN)' : '(LIVE FIX)'}`);
  console.log('=====================================================\n');

  try {
    // 1. Ambil semua booking yang menginap > 1 malam beserta items dan pricing periods
    const rows = await client<any[]>`
      SELECT 
        b.id,
        b.code,
        b.hotel_name,
        b.check_in,
        b.check_out,
        EXTRACT(DAY FROM (b.check_out - b.check_in))::int AS nights,
        b.total_amount::numeric AS current_total,
        b.meta,
        COALESCE(
          json_agg(
            json_build_object(
              'id', bi.id,
              'roomCount', bi.room_count,
              'unitPrice', bi.unit_price::numeric,
              'hasPricingPeriods', bi.has_pricing_periods,
              'periodsTotal', (
                SELECT COALESCE(SUM(bipp.subtotal::numeric), 0)
                FROM booking_item_pricing_periods bipp
                WHERE bipp.booking_item_id = bi.id
              )
            )
          ) FILTER (WHERE bi.id IS NOT NULL),
          '[]'::json
        ) AS items,
        i.id AS invoice_id,
        i.number AS invoice_number,
        i.amount::numeric AS invoice_amount
      FROM bookings b
      LEFT JOIN booking_items bi ON bi.booking_id = b.id
      LEFT JOIN invoices i ON i.booking_id = b.id
      GROUP BY b.id, b.code, b.hotel_name, b.check_in, b.check_out, b.total_amount, b.meta, i.id, i.number, i.amount
      HAVING EXTRACT(DAY FROM (b.check_out - b.check_in)) > 1;
    `;

    const affected: AffectedBooking[] = [];

    for (const row of rows) {
      const nights = Number(row.nights) || 1;
      const currentTotal = Number(row.current_total) || 0;
      const items = Array.isArray(row.items) ? row.items : [];

      let correctTotal = 0;
      let oneNightTotal = 0;

      for (const item of items) {
        const roomCount = Number(item.roomCount) || 1;
        const unitPrice = Number(item.unitPrice) || 0;
        const hasPricingPeriods = Boolean(item.hasPricingPeriods);
        const periodsTotal = Number(item.periodsTotal) || 0;

        oneNightTotal += roomCount * unitPrice;

        if (hasPricingPeriods && periodsTotal > 0) {
          correctTotal += periodsTotal * roomCount;
        } else {
          correctTotal += roomCount * unitPrice * nights;
        }
      }

      // Deteksi jika total saat ini salah (terutama jika sama dengan harga 1 malam atau selisih signifikan)
      const diff = Math.abs(currentTotal - correctTotal);
      const isOneNightPrice = Math.abs(currentTotal - oneNightTotal) < 1.0;

      if (diff > 1.0 && (isOneNightPrice || currentTotal < correctTotal)) {
        const meta = (row.meta as Record<string, any>) || {};
        const payments = Array.isArray(meta.payments) ? meta.payments : [];
        const paidAmount = payments.reduce(
          (sum: number, p: any) => sum + (parseFloat(p.amount) || 0),
          0
        );

        affected.push({
          id: row.id,
          code: row.code,
          hotelName: row.hotel_name,
          checkIn: new Date(row.check_in).toISOString().split('T')[0] || '',
          checkOut: new Date(row.check_out).toISOString().split('T')[0] || '',
          nights,
          currentTotal,
          correctTotal,
          oneNightTotal,
          paidAmount,
          meta,
          invoiceId: row.invoice_id,
          invoiceNumber: row.invoice_number,
          invoiceAmount: row.invoice_amount ? Number(row.invoice_amount) : undefined,
        });
      }
    }

    if (affected.length === 0) {
      console.log('✅ Tidak ditemukan data booking hotel yang keliru. Semua data sudah valid!\n');
      process.exit(0);
    }

    console.log(`⚠️  Ditemukan ${affected.length} booking dengan total harga keliru:\n`);
    for (const b of affected) {
      console.log(`-----------------------------------------------------`);
      console.log(`ID: ${b.id} | Kode: ${b.code} | Hotel: ${b.hotelName}`);
      console.log(`Periode: ${b.checkIn} s/d ${b.checkOut} (${b.nights} Malam)`);
      console.log(`Total Sekarang    : SAR ${b.currentTotal.toLocaleString('id-ID')}`);
      console.log(`Total Seharusnya  : SAR ${b.correctTotal.toLocaleString('id-ID')}`);
      console.log(`Sudah Dibayar     : SAR ${b.paidAmount.toLocaleString('id-ID')}`);
      console.log(`Sisa Tagihan Baru : SAR ${Math.max(0, b.correctTotal - b.paidAmount).toLocaleString('id-ID')}`);
      if (b.invoiceNumber) {
        console.log(`Invoice Terkait   : ${b.invoiceNumber} (Nominal saat ini: SAR ${b.invoiceAmount?.toLocaleString('id-ID')})`);
      }
    }
    console.log('-----------------------------------------------------\n');

    if (isDryRun) {
      console.log('ℹ️  Mode DRY-RUN aktif: Tidak ada perubahan yang disimpan ke database.');
      console.log('Jalankan tanpa flag --dry-run untuk menerapkan perbaikan:\n');
      console.log('docker exec -it musafirin_backend bun run server/src/scripts/fix-booking-totals.ts\n');
      process.exit(0);
    }

    console.log('🚀 Memulai perbaikan data ke database...\n');

    for (const b of affected) {
      const remainingBalance = Math.max(0, b.correctTotal - b.paidAmount);
      const updatedMeta = {
        ...b.meta,
        remainingBalance,
      };

      // 1. Update Booking
      await client`
        UPDATE bookings
        SET 
          total_amount = ${b.correctTotal.toFixed(2)},
          meta = ${client.json(updatedMeta)},
          updated_at = NOW()
        WHERE id = ${b.id};
      `;

      // 2. Update Invoice terkait (jika ada dan nominalnya juga keliru)
      if (b.invoiceId && b.invoiceAmount !== undefined && Math.abs(b.invoiceAmount - b.correctTotal) > 1.0) {
        await client`
          UPDATE invoices
          SET amount = ${b.correctTotal.toFixed(2)}
          WHERE id = ${b.invoiceId};
        `;
        console.log(`  ✓ Updated Invoice ${b.invoiceNumber} (ID: ${b.invoiceId}) -> SAR ${b.correctTotal.toFixed(2)}`);
      }

      console.log(`  ✓ Updated Booking ${b.code} (ID: ${b.id}) -> SAR ${b.correctTotal.toFixed(2)}`);
    }

    console.log(`\n🎉 Selesai! Berhasil memperbaiki ${affected.length} data booking hotel.\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat memeriksa/memperbaiki data:', error);
    process.exit(1);
  }
}

run();
