import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables from .env or .env.local
config({ path: ['.env', '.env.local'], override: true });

export default defineConfig({
  schema: './server/src/db/schema.ts',
  out: './server/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});