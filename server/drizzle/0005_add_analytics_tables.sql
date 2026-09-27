-- Migration: Add analytics tables for operational costs and hotel cost templates
-- Created: 2024-01-24

-- Create operational_costs table for tracking additional expenses per booking
CREATE TABLE IF NOT EXISTS "operational_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"cost_type" varchar(100) NOT NULL,
	"description" text,
	"amount" numeric(10,2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"incurred_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create hotel_cost_templates table for default pricing
CREATE TABLE IF NOT EXISTS "hotel_cost_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"hotel_name" varchar(255) NOT NULL,
	"city" "city" NOT NULL,
	"room_type" "room_type" NOT NULL,
	"cost_price" numeric(10,2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"effective_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "operational_costs" ADD CONSTRAINT "operational_costs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_operational_costs_booking_id" ON "operational_costs" ("booking_id");
CREATE INDEX IF NOT EXISTS "idx_operational_costs_cost_type" ON "operational_costs" ("cost_type");
CREATE INDEX IF NOT EXISTS "idx_operational_costs_incurred_date" ON "operational_costs" ("incurred_date");

CREATE INDEX IF NOT EXISTS "idx_hotel_cost_templates_hotel_city" ON "hotel_cost_templates" ("hotel_name", "city");
CREATE INDEX IF NOT EXISTS "idx_hotel_cost_templates_room_type" ON "hotel_cost_templates" ("room_type");
CREATE INDEX IF NOT EXISTS "idx_hotel_cost_templates_active" ON "hotel_cost_templates" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_hotel_cost_templates_effective_date" ON "hotel_cost_templates" ("effective_date");

-- Add unique constraint for hotel cost templates to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS "idx_hotel_cost_templates_unique" ON "hotel_cost_templates" ("hotel_name", "city", "room_type", "effective_date") WHERE "is_active" = true;

-- Add comments for documentation
COMMENT ON TABLE "operational_costs" IS 'Additional operational expenses per booking for profit calculation';
COMMENT ON TABLE "hotel_cost_templates" IS 'Default hotel cost prices for auto-filling booking forms';

COMMENT ON COLUMN "operational_costs"."cost_type" IS 'Type of cost: transportation, visa, admin, etc.';
COMMENT ON COLUMN "operational_costs"."amount" IS 'Cost amount in specified currency';
COMMENT ON COLUMN "hotel_cost_templates"."cost_price" IS 'Hotel purchase price per night';
COMMENT ON COLUMN "hotel_cost_templates"."is_active" IS 'Whether this template is currently active';