/**
 * Script Pengujian Kirimdev WhatsApp API
 * Penggunaan:
 *   bun run server/src/scripts/test-whatsapp.ts [nomor_tujuan] [pesan]
 *
 * Contoh:
 *   bun run server/src/scripts/test-whatsapp.ts 08123456789 "Halo, ini tes pesan dari Musafirin"
 */

import * as dotenv from 'dotenv';
import { sendWhatsAppMessage, sendWhatsAppToAdmin, getPhoneNumberId } from '../lib/whatsapp';

dotenv.config({ path: './server/.env' });
dotenv.config({ path: '.env' });

async function main() {
  console.log('==================================================');
  console.log('       PENGUJIAN KIRIMDEV WHATSAPP API            ');
  console.log('==================================================');

  const apiKey = process.env.KIRIMDEV_API_KEY;
  const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
  const phoneIdEnv = process.env.KIRIMDEV_PHONE_NUMBER_ID;

  console.log(`API Key: ${apiKey ? apiKey.slice(0, 10) + '...' : '❌ (Belum diisi di .env)'}`);
  console.log(`Admin WA: ${adminNumber || '❌ (Belum diisi di .env)'}`);
  console.log(`Phone ID: ${phoneIdEnv || '(Auto-discovery dari /v1/accounts)'}`);
  console.log('--------------------------------------------------');

  if (!apiKey) {
    console.error('❌ Error: KIRIMDEV_API_KEY belum diset di .env');
    process.exit(1);
  }

  // Cek koneksi akun
  console.log('🔍 Memeriksa akun WhatsApp yang terhubung...');
  const resolvedPhoneId = await getPhoneNumberId(apiKey);
  if (!resolvedPhoneId) {
    console.error('❌ Gagal mendeteksi phone_number_id. Pastikan nomor WhatsApp sudah terhubung di dashboard Kirimdev.');
    process.exit(1);
  }
  console.log(`✅ Akun WhatsApp aktif terdeteksi! Phone Number ID: ${resolvedPhoneId}`);

  // Tentukan nomor tujuan
  const customTarget = process.argv[2];
  const customMessage = process.argv[3] || '🚨 *Tes Notifikasi Musafirin*\nSistem WhatsApp Kirimdev berhasil terhubung!';

  if (customTarget) {
    console.log(`\n📤 Mengirim pesan uji coba ke: ${customTarget}`);
    const res = await sendWhatsAppMessage(customTarget, customMessage);
    if (res.success) {
      console.log('🎉 SUKSES! Pesan berhasil terkirim via Kirimdev.');
    } else {
      console.error(`❌ GAGAL: ${res.error}`);
    }
  } else if (adminNumber) {
    console.log(`\n📤 Mengirim pesan uji coba ke Admin WA: ${adminNumber}`);
    const res = await sendWhatsAppToAdmin(customMessage);
    if (res.success) {
      console.log('🎉 SUKSES! Pesan berhasil terkirim ke Admin WA.');
    } else {
      console.error(`❌ GAGAL: ${res.error}`);
    }
  } else {
    console.log('\n⚠️ Tidak ada nomor tujuan yang diberikan dan ADMIN_WHATSAPP_NUMBER belum diisi.');
    console.log('Gunakan: bun run server/src/scripts/test-whatsapp.ts 08123456789 "Pesan tes"');
  }

  console.log('==================================================\n');
}

main().catch(console.error);
