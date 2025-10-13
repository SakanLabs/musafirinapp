-- Migration: Add pricing periods support for booking items
-- Created: 2024-01-26
-- Purpose: Support multiple pricing periods within a single booking (e.g., Makkah/Madinah hotels)

-- Add has_pricing_periods flag to booking_items table
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "has_pricing_periods" boolean DEFAULT false NOT NULL;

-- Create booking_item_pricing_periods table
CREATE TABLE IF NOT EXISTS "booking_item_pricing_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_item_id" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"nights" integer NOT NULL,
	"unit_price" numeric(10,2) NOT NULL,
	"hotel_cost_price" numeric(10,2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(10,2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint
DO $$ BEGIN
  ALTER TABLE "booking_item_pricing_periods" ADD CONSTRAINT "booking_item_pricing_periods_booking_item_id_booking_items_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_booking_item_pricing_periods_booking_item_id" ON "booking_item_pricing_periods" ("booking_item_id");
CREATE INDEX IF NOT EXISTS "idx_booking_item_pricing_periods_dates" ON "booking_item_pricing_periods" ("start_date", "end_date");

-- Add comments for documentation
COMMENT ON TABLE "booking_item_pricing_periods" IS 'Stores multiple pricing periods for booking items, especially useful for Makkah and Madinah hotels with period-based pricing';
COMMENT ON COLUMN "booking_item_pricing_periods"."start_date" IS 'Start date of this pricing period (inclusive)';
COMMENT ON COLUMN "booking_item_pricing_periods"."end_date" IS 'End date of this pricing period (exclusive)';
COMMENT ON COLUMN "booking_item_pricing_periods"."nights" IS 'Number of nights in this pricing period';
COMMENT ON COLUMN "booking_item_pricing_periods"."unit_price" IS 'Price per room per night for this period';
COMMENT ON COLUMN "booking_item_pricing_periods"."hotel_cost_price" IS 'Hotel cost per room per night for this period';
COMMENT ON COLUMN "booking_item_pricing_periods"."subtotal" IS 'Total amount for this period (nights * room_count * unit_price)';