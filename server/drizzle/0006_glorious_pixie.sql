DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_plan') THEN
        CREATE TYPE "public"."meal_plan" AS ENUM('Breakfast', 'Half Board', 'Full Board', 'Room Only');
    END IF;
END;
$$;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "meal_plan" "meal_plan" DEFAULT 'Room Only' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banReason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banExpires" timestamp;
