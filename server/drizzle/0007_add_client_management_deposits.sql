-- Migration: Add client management and deposit system
-- Created: 2024-01-25

-- Add new columns to existing clients table
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

-- Create deposit transaction type enum
DO $$ BEGIN
  CREATE TYPE "public"."deposit_transaction_type" AS ENUM('deposit', 'usage', 'refund', 'adjustment');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create deposit transaction status enum
DO $$ BEGIN
  CREATE TYPE "public"."deposit_transaction_status" AS ENUM('pending', 'completed', 'cancelled', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create client_deposits table for tracking deposit balance
CREATE TABLE IF NOT EXISTS "client_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"current_balance" numeric(10,2) DEFAULT '0' NOT NULL,
	"total_deposited" numeric(10,2) DEFAULT '0' NOT NULL,
	"total_used" numeric(10,2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"last_transaction_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create deposit_transactions table for tracking all deposit activities
CREATE TABLE IF NOT EXISTS "deposit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"type" "deposit_transaction_type" NOT NULL,
	"amount" numeric(10,2) NOT NULL,
	"balance_before" numeric(10,2) NOT NULL,
	"balance_after" numeric(10,2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"status" "deposit_transaction_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"booking_id" integer,
	"reference_number" varchar(100),
	"processed_by" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "client_deposits" ADD CONSTRAINT "client_deposits_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "deposit_transactions" ADD CONSTRAINT "deposit_transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "deposit_transactions" ADD CONSTRAINT "deposit_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_client_deposits_client_id" ON "client_deposits"("client_id");
CREATE INDEX IF NOT EXISTS "idx_deposit_transactions_client_id" ON "deposit_transactions"("client_id");
CREATE INDEX IF NOT EXISTS "idx_deposit_transactions_booking_id" ON "deposit_transactions"("booking_id");
CREATE INDEX IF NOT EXISTS "idx_deposit_transactions_type" ON "deposit_transactions"("type");
CREATE INDEX IF NOT EXISTS "idx_deposit_transactions_status" ON "deposit_transactions"("status");
CREATE INDEX IF NOT EXISTS "idx_deposit_transactions_created_at" ON "deposit_transactions"("created_at");

-- Create unique constraint for one deposit record per client
CREATE UNIQUE INDEX IF NOT EXISTS "idx_client_deposits_unique_client" ON "client_deposits"("client_id");

-- Add comments for documentation
COMMENT ON TABLE "client_deposits" IS 'Tracks current deposit balance and totals for each client';
COMMENT ON TABLE "deposit_transactions" IS 'Records all deposit-related transactions (deposits, usage, refunds, adjustments)';
COMMENT ON COLUMN "client_deposits"."current_balance" IS 'Current available balance for the client';
COMMENT ON COLUMN "client_deposits"."total_deposited" IS 'Total amount ever deposited by the client';
COMMENT ON COLUMN "client_deposits"."total_used" IS 'Total amount used from deposits for bookings';
COMMENT ON COLUMN "deposit_transactions"."type" IS 'Type of transaction: deposit, usage, refund, or adjustment';
COMMENT ON COLUMN "deposit_transactions"."balance_before" IS 'Client balance before this transaction';
COMMENT ON COLUMN "deposit_transactions"."balance_after" IS 'Client balance after this transaction';
COMMENT ON COLUMN "deposit_transactions"."booking_id" IS 'Associated booking ID for usage transactions';
COMMENT ON COLUMN "deposit_transactions"."reference_number" IS 'External reference number for tracking';
COMMENT ON COLUMN "deposit_transactions"."processed_by" IS 'Admin user who processed the transaction';