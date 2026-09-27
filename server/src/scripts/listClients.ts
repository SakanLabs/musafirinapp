import { db } from '../db';
import { clients } from '../db/schema';

async function main() {
  const rows = await db.select().from(clients).limit(10);
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });