CREATE TABLE "transportation_route_pricing_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"transportation_route_master_id" integer NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"cost_price" numeric(10, 2) NOT NULL,
	"selling_price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'SAR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transportation_route_pricing_periods" ADD CONSTRAINT "transportation_route_pricing_periods_transportation_route_master_id_transportation_routes_master_id_fk" FOREIGN KEY ("transportation_route_master_id") REFERENCES "public"."transportation_routes_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transportation_routes_master" DROP COLUMN "vehicle_type";--> statement-breakpoint
ALTER TABLE "transportation_routes_master" DROP COLUMN "cost_price";--> statement-breakpoint
ALTER TABLE "transportation_routes_master" DROP COLUMN "selling_price";--> statement-breakpoint
ALTER TABLE "transportation_routes_master" DROP COLUMN "currency";