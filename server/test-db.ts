import { db } from './src/db/index.js';
import * as schema from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const invoice = await db.select().from(schema.agentRequestInvoices).where(eq(schema.agentRequestInvoices.number, 'INV-AR-2026-069449'));
  console.log(invoice);
  process.exit(0);
}
main();
