import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '../.env' });

export default defineConfig({
  schema: './server/src/db/schema.ts',
  out: './server/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});