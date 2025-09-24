-- Migration: Add hotel_cost_price to booking_items table
-- This field will store the purchase price from hotel (cost price)
-- while unit_price remains as selling price to customer

ALTER TABLE "booking_items" 
ADD COLUMN "hotel_cost_price" numeric(10,2) DEFAULT 0 NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN "booking_items"."unit_price" IS 'Harga jual ke customer (selling price)';
COMMENT ON COLUMN "booking_items"."hotel_cost_price" IS 'Harga beli ke hotel (hotel cost price)';