ALTER TABLE "hotel_pricing_periods" ADD COLUMN "agent_price" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "agent_unit_price_usd" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "agent_total_price_usd" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "agent_total_price_sar" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "transportation_route_pricing_periods" ADD COLUMN "agent_price" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "userType" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;