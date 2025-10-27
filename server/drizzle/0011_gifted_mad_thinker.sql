CREATE TYPE "public"."transportation_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('sedan', 'suv', 'van', 'bus', 'minibus');--> statement-breakpoint
CREATE TABLE "transportation_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"client_id" integer NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_phone" varchar(50),
	"customer_email" varchar(255),
	"status" "transportation_status" DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transportation_bookings_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "transportation_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"transportation_booking_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transportation_invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "transportation_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"transportation_booking_id" integer NOT NULL,
	"transportation_invoice_id" integer,
	"total_amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) NOT NULL,
	"balance_due" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"payer_name" varchar(255) NOT NULL,
	"payer_email" varchar(255),
	"payer_phone" varchar(50),
	"payer_address" text,
	"bank_name" varchar(255),
	"bank_country" varchar(100),
	"account_name" varchar(255),
	"account_number_or_iban" varchar(100),
	"notes" text,
	"amount_in_words" text,
	"pdf_url" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transportation_receipts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "transportation_routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"transportation_booking_id" integer NOT NULL,
	"pickup_date_time" timestamp NOT NULL,
	"origin_location" varchar(500) NOT NULL,
	"destination_location" varchar(500) NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"driver_name" varchar(255),
	"driver_phone" varchar(50),
	"vehicle_plate_number" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transportation_bookings" ADD CONSTRAINT "transportation_bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_invoices" ADD CONSTRAINT "transportation_invoices_transportation_booking_id_transportation_bookings_id_fk" FOREIGN KEY ("transportation_booking_id") REFERENCES "public"."transportation_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_receipts" ADD CONSTRAINT "transportation_receipts_transportation_booking_id_transportation_bookings_id_fk" FOREIGN KEY ("transportation_booking_id") REFERENCES "public"."transportation_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_receipts" ADD CONSTRAINT "transportation_receipts_transportation_invoice_id_transportation_invoices_id_fk" FOREIGN KEY ("transportation_invoice_id") REFERENCES "public"."transportation_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_routes" ADD CONSTRAINT "transportation_routes_transportation_booking_id_transportation_bookings_id_fk" FOREIGN KEY ("transportation_booking_id") REFERENCES "public"."transportation_bookings"("id") ON DELETE cascade ON UPDATE no action;