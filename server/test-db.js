import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const hotels = await pool.query('SELECT id, name FROM hotels');
  console.log("HOTELS:", hotels.rows);
  
  const pricing = await pool.query('SELECT hotel_id, room_type, start_date, end_date FROM hotel_pricing_periods');
  console.log("HOTEL PRICING PERIODS:", pricing.rows);
  
  process.exit(0);
}
run();
