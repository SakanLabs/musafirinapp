CREATE TABLE "hotel_pricing_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"hotel_id" integer NOT NULL,
	"room_type" varchar(255) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"cost_price" numeric(10, 2) NOT NULL,
	"selling_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"city" "city" NOT NULL,
	"address" text,
	"star_rating" integer,
	"contact_person" varchar(255),
	"contact_phone" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_order_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"service_order_id" integer NOT NULL,
	"service_order_invoice_id" integer,
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
	CONSTRAINT "service_order_receipts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "transportation_routes_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"origin_location" varchar(500) NOT NULL,
	"destination_location" varchar(500) NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"cost_price" numeric(10, 2) NOT NULL,
	"selling_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportation_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"transportation_booking_id" integer NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"pdf_url" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transportation_vouchers_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "hotel_pricing_periods" ADD CONSTRAINT "hotel_pricing_periods_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_receipts" ADD CONSTRAINT "service_order_receipts_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_receipts" ADD CONSTRAINT "service_order_receipts_service_order_invoice_id_service_order_invoices_id_fk" FOREIGN KEY ("service_order_invoice_id") REFERENCES "public"."service_order_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_vouchers" ADD CONSTRAINT "transportation_vouchers_transportation_booking_id_transportation_bookings_id_fk" FOREIGN KEY ("transportation_booking_id") REFERENCES "public"."transportation_bookings"("id") ON DELETE cascade ON UPDATE no action;