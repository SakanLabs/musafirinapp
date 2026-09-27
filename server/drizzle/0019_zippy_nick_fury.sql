CREATE TYPE "public"."agent_request_service_type" AS ENUM('hotel', 'transportation', 'muthowif', 'visa', 'siskopatuh', 'custom_la');--> statement-breakpoint
CREATE TYPE "public"."agent_request_status" AS ENUM('draft', 'submitted', 'need_more_info', 'in_review', 'quoted', 'quote_revision_requested', 'quote_accepted', 'invoiced', 'payment_uploaded', 'paid', 'voucher_issued', 'completed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."custom_la_expense_status" AS ENUM('pending', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."muthowif_booking_event" AS ENUM('Umrah', 'Makkah City Tour', 'Madinah City Tour');--> statement-breakpoint
CREATE TYPE "public"."muthowif_booking_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "agent_company_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"company_phone" varchar(50),
	"company_email" varchar(255),
	"company_address" text,
	"city" varchar(100),
	"province" varchar(100),
	"country" varchar(100) DEFAULT 'Indonesia',
	"logo_url" text,
	"license_number" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_company_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "agent_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"request_id" integer,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_request_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"agent_request_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_request_invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "agent_request_timeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"actor_id" text,
	"actor_role" varchar(20) NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" varchar(50) NOT NULL,
	"agent_id" text NOT NULL,
	"service_type" "agent_request_service_type" NOT NULL,
	"status" "agent_request_status" DEFAULT 'draft' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"meta" jsonb,
	"quotation_data" jsonb,
	"quotation_notes" text,
	"agent_quotation_response" text,
	"total_amount" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"linked_booking_id" integer,
	"linked_transport_id" integer,
	"linked_service_order_id" integer,
	"linked_muthowif_booking_id" integer,
	"linked_custom_la_id" integer,
	"assigned_admin_id" text,
	"payment_proof_url" text,
	"payment_proof_uploaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "custom_la_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"custom_la_request_id" integer NOT NULL,
	"category" varchar(100) NOT NULL,
	"supplier_name" varchar(255) NOT NULL,
	"description" text,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"payment_date" timestamp,
	"payment_method" varchar(50),
	"reference_number" varchar(100),
	"notes" text,
	"status" "custom_la_expense_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"client_id" integer,
	"client_name" varchar(255) NOT NULL,
	"client_email" varchar(255),
	"client_phone" varchar(50),
	"client_address" text,
	"title" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"items" jsonb NOT NULL,
	"notes" text,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "manual_invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "muthowif_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"client_id" integer NOT NULL,
	"guest_name" varchar(255) NOT NULL,
	"date_time" timestamp NOT NULL,
	"events" jsonb NOT NULL,
	"total_pax" integer NOT NULL,
	"meeting_point" varchar(255) NOT NULL,
	"status" "muthowif_booking_status" DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"assigned_muthowif_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "muthowif_bookings_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "muthowif_invoice_payments" (
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
CREATE TABLE "muthowif_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"muthowif_booking_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "muthowif_invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "muthowif_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"muthowif_booking_id" integer NOT NULL,
	"muthowif_invoice_id" integer,
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
	CONSTRAINT "muthowif_receipts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "muthowif_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"muthowif_booking_id" integer NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"pdf_url" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "muthowif_vouchers_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "agent_company_profiles" ADD CONSTRAINT "agent_company_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_notifications" ADD CONSTRAINT "agent_notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_notifications" ADD CONSTRAINT "agent_notifications_request_id_agent_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."agent_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_request_invoices" ADD CONSTRAINT "agent_request_invoices_agent_request_id_agent_requests_id_fk" FOREIGN KEY ("agent_request_id") REFERENCES "public"."agent_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_request_timeline" ADD CONSTRAINT "agent_request_timeline_request_id_agent_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."agent_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_request_timeline" ADD CONSTRAINT "agent_request_timeline_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_linked_booking_id_bookings_id_fk" FOREIGN KEY ("linked_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_linked_transport_id_transportation_bookings_id_fk" FOREIGN KEY ("linked_transport_id") REFERENCES "public"."transportation_bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_linked_service_order_id_service_orders_id_fk" FOREIGN KEY ("linked_service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_linked_muthowif_booking_id_muthowif_bookings_id_fk" FOREIGN KEY ("linked_muthowif_booking_id") REFERENCES "public"."muthowif_bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_linked_custom_la_id_custom_la_requests_id_fk" FOREIGN KEY ("linked_custom_la_id") REFERENCES "public"."custom_la_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_assigned_admin_id_user_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_la_expenses" ADD CONSTRAINT "custom_la_expenses_custom_la_request_id_custom_la_requests_id_fk" FOREIGN KEY ("custom_la_request_id") REFERENCES "public"."custom_la_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_invoices" ADD CONSTRAINT "manual_invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muthowif_bookings" ADD CONSTRAINT "muthowif_bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muthowif_bookings" ADD CONSTRAINT "muthowif_bookings_assigned_muthowif_id_muthowifs_id_fk" FOREIGN KEY ("assigned_muthowif_id") REFERENCES "public"."muthowifs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muthowif_invoice_payments" ADD CONSTRAINT "muthowif_invoice_payments_invoice_id_muthowif_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."muthowif_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muthowif_invoices" ADD CONSTRAINT "muthowif_invoices_muthowif_booking_id_muthowif_bookings_id_fk" FOREIGN KEY ("muthowif_booking_id") REFERENCES "public"."muthowif_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muthowif_receipts" ADD CONSTRAINT "muthowif_receipts_muthowif_booking_id_muthowif_bookings_id_fk" FOREIGN KEY ("muthowif_booking_id") REFERENCES "public"."muthowif_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muthowif_receipts" ADD CONSTRAINT "muthowif_receipts_muthowif_invoice_id_muthowif_invoices_id_fk" FOREIGN KEY ("muthowif_invoice_id") REFERENCES "public"."muthowif_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muthowif_vouchers" ADD CONSTRAINT "muthowif_vouchers_muthowif_booking_id_muthowif_bookings_id_fk" FOREIGN KEY ("muthowif_booking_id") REFERENCES "public"."muthowif_bookings"("id") ON DELETE cascade ON UPDATE no action;