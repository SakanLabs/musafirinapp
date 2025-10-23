CREATE TABLE "service_order_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" varchar(50) NOT NULL,
	"service_order_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"issue_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_order_invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "service_order_invoices" ADD CONSTRAINT "service_order_invoices_service_order_id_service_orders_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "public"."service_orders"("id") ON DELETE cascade ON UPDATE no action;