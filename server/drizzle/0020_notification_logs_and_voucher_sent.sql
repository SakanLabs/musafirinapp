CREATE TABLE IF NOT EXISTS "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"client_id" integer,
	"type" varchar(50) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reference_id" varchar(100),
	"provider_message_id" text,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN IF NOT EXISTS "sent_at" timestamp;
--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN IF NOT EXISTS "sent_by" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_check_in" ON "bookings" ("check_in");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bookings_booking_status" ON "bookings" ("booking_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_logs_lookup" ON "notification_logs" ("booking_id", "type", "channel", "reference_id");
