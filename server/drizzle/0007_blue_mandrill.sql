CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"booking_id" integer NOT NULL,
	"invoice_id" integer,
	"total_amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) NOT NULL,
	"balance_due" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"payer_name" varchar(255) NOT NULL,
	"payer_email" varchar(255),
	"payer_phone" varchar(50),
	"payer_address" text,
	"hotel_name" varchar(255) NOT NULL,
	"hotel_address" text,
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
	CONSTRAINT "receipts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;