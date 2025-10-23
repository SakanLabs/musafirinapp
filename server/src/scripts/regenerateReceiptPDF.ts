import 'dotenv/config';
import { db } from '../db';
import { receipts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ReceiptService } from '../services/ReceiptService';
import { generateReceiptPDF } from '../utils/pdf';

async function main() {
  const arg = process.argv[2];
  const receiptId = arg ? parseInt(arg, 10) : NaN;
  if (!arg || isNaN(receiptId)) {
    console.error('Usage: bun run src/scripts/regenerateReceiptPDF.ts <receiptId>');
    process.exit(1);
  }

  const svc = new ReceiptService();
  const receipt = await svc.getReceiptById(receiptId);
  if (!receipt) {
    console.error(`Receipt ${receiptId} not found`);
    process.exit(2);
  }

  const data = await svc.prepareReceiptData(receiptId);
  if (!data) {
    console.error('Failed to prepare receipt data');
    process.exit(3);
  }

  console.log('Regenerating PDF...');
  const pdfUrl = await generateReceiptPDF(data);

  const [updated] = await db
    .update(receipts)
    .set({ pdfUrl })
    .where(eq(receipts.id, receiptId))
    .returning();

  console.log('Updated receipt:');
  console.log(JSON.stringify(updated, null, 2));
  console.log(`New PDF URL: ${pdfUrl}`);
}

main().catch((err) => { console.error(err); process.exit(9); });