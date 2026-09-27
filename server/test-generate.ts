import { db } from './src/db/index.js';
import * as schema from './src/db/schema.js';
import { eq } from 'drizzle-orm';
import { generateAgentRequestInvoicePDF, uploadToMinio } from './src/utils/pdf.js';
import * as fs from 'fs';

async function main() {
  const invoice = await db.select().from(schema.agentRequestInvoices).where(eq(schema.agentRequestInvoices.number, 'INV-AR-2026-069449'));
  const request = await db.select().from(schema.agentRequests).where(eq(schema.agentRequests.id, 2));

  if (invoice.length && request.length) {
    const inv = invoice[0];
    const req = request[0];
    
    console.log('Generating PDF...');
    const pdfPath = await generateAgentRequestInvoicePDF(inv, req);
    console.log('PDF generated at:', pdfPath);
    
    const fileBuffer = fs.readFileSync(pdfPath);
    const minioPath = `agent-request-invoices/${inv.number}.pdf`;
    
    console.log('Uploading to MinIO...');
    await uploadToMinio(minioPath, fileBuffer, "application/pdf");
    console.log('Done!');
    fs.unlinkSync(pdfPath);
  }
  process.exit(0);
}
main();
