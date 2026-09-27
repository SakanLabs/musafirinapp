CREATE TYPE "public"."service_order_product" AS ENUM('visa_umrah', 'siskopatuh');--> statement-breakpoint
CREATE TYPE "public"."service_order_status" AS ENUM('draft', 'submitted', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "booking_item_pricing_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_item_id" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"nights" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"hotel_cost_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_order_checklists" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_order_id" integer NOT NULL,
	"items" jsonb NOT NULL,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"client_id" integer NOT NULL,
	"product_type" "service_order_product" NOT NULL,
	"status" "service_order_status" DEFAULT 'draft' NOT NULL,
	"booker_name" varchar(255) NOT NULL,
	"booker_email" varchar(255),
	"booker_phone" varchar(50),
	"group_leader_name" varchar(255) NOT NULL,
	"total_people" integer NOT NULL,
	"unit_price_usd" numeric(10, 2) NOT NULL,
	"total_price_usd" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"exchange_rate_to_sar" numeric(10, 4) DEFAULT '3.75' NOT NULL,
	"total_price_sar" numeric(10, 2) NOT NULL,
	"departure_date" timestamp NOT NULL,
	"return_date" timestamp NOT NULL,
	"notes" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "booking_items" ADD COLUMN "has_pricing_periods" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_item_pricing_periods" ADD CONSTRAINT "booking_item_pricing_periods_booking_item_id_booking_items_id_fk" FOREIGN KEY ("booking_item_id") REFERENCES "public"."booking_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_checklists" ADD CONSTRAINT "service_order_checklists_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;