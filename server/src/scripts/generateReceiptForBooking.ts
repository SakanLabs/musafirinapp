import path from 'path';
import 'dotenv/config';
import { ReceiptService } from '../services/ReceiptService';

async function main() {
  try {
    // Ensure env is loaded from project root
    const rootEnv = path.resolve(__dirname, '../../../.env');
    process.env.DOTENV_PATH = rootEnv;

    const bookingIdArg = process.argv[2];
    const bookingId = bookingIdArg ? parseInt(bookingIdArg, 10) : NaN;
    if (!bookingIdArg || isNaN(bookingId)) {
      console.error('Usage: bun src/scripts/generateReceiptForBooking.ts <bookingId>');
      process.exit(1);
    }

    const receiptService = new ReceiptService();
    console.log(`Generating receipt for bookingId=${bookingId}...`);

    const receipt = await receiptService.generateReceiptForBooking(bookingId);
    if (!receipt) {
      console.error('Failed to generate receipt: service returned null');
      process.exit(2);
    }

    console.log('Receipt generated successfully:');
    console.log(JSON.stringify(receipt, null, 2));

    if (receipt.pdfUrl) {
      console.log(`PDF URL: ${receipt.pdfUrl}`);
    } else {
      console.warn('No pdfUrl present on receipt record. Check MinIO upload logs.');
    }
  } catch (err) {
    console.error('Error generating receipt:', err);
    process.exit(3);
  }
}

main();