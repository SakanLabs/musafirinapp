import { db } from './server/src/db';
import { clients } from './server/src/db/schema';
console.log("Checking DB connection...");
console.time("db");
await db.select().from(clients).limit(1);
console.timeEnd("db");
console.log("DB connection successful!");
