CREATE TYPE "public"."assignment_reference_type" AS ENUM('service_order', 'custom_la', 'booking');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."custom_la_request_status" AS ENUM('pending', 'quoted', 'approved', 'invoiced', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('NEW', 'DISCUSSION', 'QUOTED', 'FOLLOW_UP', 'WON', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."muthowif_status" AS ENUM('idle', 'assigned', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."pre_order_status" AS ENUM('PO_OPEN', 'PO_CLOSED', 'PURCHASING', 'SHIPPING_FROM_SAUDI', 'ARRIVED_INDONESIA', 'LOCAL_DELIVERY', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."resident_type" AS ENUM('mahasiswa', 'mukimin');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('Visa', 'Siskopatuh', 'Transportasi', 'Handling Airport', 'Handling Hotel', 'Muthowif', 'Tiket Museum', 'Lainnya');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('PENDING', 'PACKING', 'READY_TO_SHIP', 'SHIPPED_FROM_SAUDI', 'ARRIVED_INDONESIA', 'CUSTOMS_CLEARANCE', 'LOCAL_COURIER', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."store_order_status" AS ENUM('pending', 'processing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."store_payment_status" AS ENUM('unpaid', 'partial', 'paid', 'verified', 'failed');--> statement-breakpoint
CREATE TYPE "public"."visa_status" AS ENUM('umrah', 'ziarah', 'student', 'worker', 'resident');--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'partially_paid' BEFORE 'paid';--> statement-breakpoint
ALTER TYPE "public"."vehicle_type" ADD VALUE 'staria';--> statement-breakpoint
ALTER TYPE "public"."vehicle_type" ADD VALUE 'hiace';--> statement-breakpoint
ALTER TYPE "public"."vehicle_type" ADD VALUE 'gmc';--> statement-breakpoint
ALTER TYPE "public"."vehicle_type" ADD VALUE 'coaster';--> statement-breakpoint
CREATE TABLE "custom_la_invoice_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"reference_number" varchar(100),
	"notes" text,
	"status" "deposit_transaction_status" DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_la_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"custom_la_request_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_la_invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "custom_la_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"custom_la_request_id" integer NOT NULL,
	"invoice_id" integer,
	"payment_id" integer,
	"total_amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) NOT NULL,
	"balance_due" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"payer_name" varchar(255) NOT NULL,
	"payer_email" varchar(255),
	"payer_phone" varchar(50),
	"payer_address" text,
	"payment_method" varchar(50) NOT NULL,
	"amount_in_words" text,
	"notes" text,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_la_receipts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "custom_la_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"client_id" integer NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_phone" varchar(50),
	"customer_email" varchar(255),
	"travel_name" varchar(255),
	"status" "custom_la_request_status" DEFAULT 'pending' NOT NULL,
	"total_amount_sar" numeric(10, 2) NOT NULL,
	"total_pax" integer NOT NULL,
	"meta" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_la_requests_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"company_name" varchar(255),
	"requirement" text NOT NULL,
	"status" "lead_status" DEFAULT 'NEW' NOT NULL,
	"value" numeric(12, 2),
	"notes" text,
	"assigned_to" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "muthowif_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"muthowif_id" integer NOT NULL,
	"reference_type" "assignment_reference_type" NOT NULL,
	"reference_id" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"task_description" text,
	"status" "assignment_status" DEFAULT 'active' NOT NULL,
	"assigned_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "muthowifs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"iqama_or_passport_no" varchar(100),
	"visa_status" "visa_status" NOT NULL,
	"resident_type" "resident_type" NOT NULL,
	"residence_location" text,
	"last_education" varchar(255),
	"status" "muthowif_status" DEFAULT 'idle' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "service_category" NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"unit_type" varchar(50) DEFAULT 'Per Pax' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_order_invoice_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"method" varchar(50),
	"reference_number" varchar(100),
	"paid_at" timestamp NOT NULL,
	"status" "deposit_transaction_status" DEFAULT 'completed' NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "store_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"user_id" text NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"shipping_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"final_amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"payment_status" "store_payment_status" DEFAULT 'unpaid' NOT NULL,
	"order_status" "store_order_status" DEFAULT 'pending' NOT NULL,
	"pre_order_status" "pre_order_status",
	"shipping_name" varchar(255) NOT NULL,
	"shipping_phone" varchar(50) NOT NULL,
	"shipping_address" text NOT NULL,
	"tracking_number" varchar(100),
	"courier_name" varchar(100),
	"estimated_delivery" timestamp,
	"is_pre_order" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "store_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"payment_proof_url" text NOT NULL,
	"notes" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"verified_by" text,
	"verified_by_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"thumbnail" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"category_id" integer NOT NULL,
	"sku" varchar(100) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"promo_price" numeric(10, 2),
	"weight" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"dimensions" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_pre_order" boolean DEFAULT false NOT NULL,
	"pre_order_open_date" timestamp,
	"pre_order_close_date" timestamp,
	"estimated_arrival_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "store_shipment_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"shipment_id" integer NOT NULL,
	"status" "shipment_status" NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"tracking_number" varchar(100) NOT NULL,
	"courier_name" varchar(100) NOT NULL,
	"status" "shipment_status" DEFAULT 'PENDING' NOT NULL,
	"estimated_arrival" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_user_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" varchar(100) NOT NULL,
	"recipient_name" varchar(255) NOT NULL,
	"recipient_phone" varchar(50) NOT NULL,
	"shipping_address" text NOT NULL,
	"province" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"postal_code" varchar(20) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportation_invoice_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"method" varchar(50),
	"reference_number" varchar(100),
	"paid_at" timestamp NOT NULL,
	"status" "deposit_transaction_status" DEFAULT 'completed' NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "custom_la_request_id" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_order_invoices" ADD COLUMN "paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "service_package" text;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "custom_la_request_id" integer;--> statement-breakpoint
ALTER TABLE "transportation_bookings" ADD COLUMN "custom_la_request_id" integer;--> statement-breakpoint
ALTER TABLE "transportation_invoices" ADD COLUMN "paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_la_invoice_payments" ADD CONSTRAINT "custom_la_invoice_payments_invoice_id_custom_la_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."custom_la_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_la_invoices" ADD CONSTRAINT "custom_la_invoices_custom_la_request_id_custom_la_requests_id_fk" FOREIGN KEY ("custom_la_request_id") REFERENCES "public"."custom_la_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_la_receipts" ADD CONSTRAINT "custom_la_receipts_custom_la_request_id_custom_la_requests_id_fk" FOREIGN KEY ("custom_la_request_id") REFERENCES "public"."custom_la_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_la_receipts" ADD CONSTRAINT "custom_la_receipts_invoice_id_custom_la_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."custom_la_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_la_receipts" ADD CONSTRAINT "custom_la_receipts_payment_id_custom_la_invoice_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."custom_la_invoice_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_la_requests" ADD CONSTRAINT "custom_la_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muthowif_assignments" ADD CONSTRAINT "muthowif_assignments_muthowif_id_muthowifs_id_fk" FOREIGN KEY ("muthowif_id") REFERENCES "public"."muthowifs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_order_invoice_payments" ADD CONSTRAINT "service_order_invoice_payments_invoice_id_service_order_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."service_order_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cart_items" ADD CONSTRAINT "store_cart_items_cart_id_store_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."store_carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cart_items" ADD CONSTRAINT "store_cart_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_carts" ADD CONSTRAINT "store_carts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_order_id_store_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_payments" ADD CONSTRAINT "store_payments_order_id_store_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_payments" ADD CONSTRAINT "store_payments_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_images" ADD CONSTRAINT "store_product_images_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_category_id_store_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_shipment_logs" ADD CONSTRAINT "store_shipment_logs_shipment_id_store_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."store_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_shipments" ADD CONSTRAINT "store_shipments_order_id_store_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_user_addresses" ADD CONSTRAINT "store_user_addresses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_invoice_payments" ADD CONSTRAINT "transportation_invoice_payments_invoice_id_transportation_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."transportation_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_custom_la_request_id_custom_la_requests_id_fk" FOREIGN KEY ("custom_la_request_id") REFERENCES "public"."custom_la_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_custom_la_request_id_custom_la_requests_id_fk" FOREIGN KEY ("custom_la_request_id") REFERENCES "public"."custom_la_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_bookings" ADD CONSTRAINT "transportation_bookings_custom_la_request_id_custom_la_requests_id_fk" FOREIGN KEY ("custom_la_request_id") REFERENCES "public"."custom_la_requests"("id") ON DELETE set null ON UPDATE no action;