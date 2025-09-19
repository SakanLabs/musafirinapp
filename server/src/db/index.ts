import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import * as schema from './schema.js';

// Load environment variables
config({ path: '../../../.env' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Create the connection
const client = postgres(DATABASE_URL);

// Create the drizzle instance
export const db = drizzle(client, { schema });

export type Database = typeof db;