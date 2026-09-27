-- Migration: Change room_type from enum to varchar for flexibility
-- This allows hotels to use any room type name instead of being limited to DBL, TPL, Quad

-- Step 1: Add new varchar column
ALTER TABLE "booking_items" 
ADD COLUMN "room_type_new" varchar(255);

-- Step 2: Copy existing data with mapping
UPDATE "booking_items" 
SET "room_type_new" = CASE 
    WHEN "room_type" = 'DBL' THEN 'Double Room'
    WHEN "room_type" = 'TPL' THEN 'Triple Room'
    WHEN "room_type" = 'Quad' THEN 'Quad Room'
    ELSE "room_type"::text
END;

-- Step 3: Make the new column NOT NULL
ALTER TABLE "booking_items" 
ALTER COLUMN "room_type_new" SET NOT NULL;

-- Step 4: Drop the old column
ALTER TABLE "booking_items" 
DROP COLUMN "room_type";

-- Step 5: Rename the new column
ALTER TABLE "booking_items" 
RENAME COLUMN "room_type_new" TO "room_type";

-- Step 6: Do the same for hotel_cost_templates table
ALTER TABLE "hotel_cost_templates" 
ADD COLUMN "room_type_new" varchar(255);

UPDATE "hotel_cost_templates" 
SET "room_type_new" = CASE 
    WHEN "room_type" = 'DBL' THEN 'Double Room'
    WHEN "room_type" = 'TPL' THEN 'Triple Room'
    WHEN "room_type" = 'Quad' THEN 'Quad Room'
    ELSE "room_type"::text
END;

ALTER TABLE "hotel_cost_templates" 
ALTER COLUMN "room_type_new" SET NOT NULL;

ALTER TABLE "hotel_cost_templates" 
DROP COLUMN "room_type";

ALTER TABLE "hotel_cost_templates" 
RENAME COLUMN "room_type_new" TO "room_type";

-- Add comments for clarity
COMMENT ON COLUMN "booking_items"."room_type" IS 'Room type name (flexible text field)';
COMMENT ON COLUMN "hotel_cost_templates"."room_type" IS 'Room type name (flexible text field)';