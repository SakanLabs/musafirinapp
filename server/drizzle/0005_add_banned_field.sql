DO $$ BEGIN
  CREATE TYPE "public"."deposit_transaction_status" AS ENUM('pending', 'completed', 'cancelled', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."deposit_transaction_type" AS ENUM('deposit', 'usage', 'refund', 'adjustment');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"current_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_deposited" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_used" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"last_transaction_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deposit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"type" "deposit_transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_before" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "booking_items" ALTER COLUMN "room_type" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "hotel_cost_templates" ALTER COLUMN "room_type" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "address" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_deposits" ADD CONSTRAINT "client_deposits_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "deposit_transactions" ADD CONSTRAINT "deposit_transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "deposit_transactions" ADD CONSTRAINT "deposit_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DROP TYPE IF EXISTS "public"."room_type";