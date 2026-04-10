ALTER TABLE "hotels" ALTER COLUMN "contact_person" SET DATA TYPE varchar(150);--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "supplier_name" varchar(255);--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "pic_name" varchar(255);--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "pic_contact" varchar(255);--> statement-breakpoint
ALTER TABLE "transportation_routes_master" ADD COLUMN "supplier_name" varchar(255);--> statement-breakpoint
ALTER TABLE "transportation_routes_master" ADD COLUMN "pic_name" varchar(255);--> statement-breakpoint
ALTER TABLE "transportation_routes_master" ADD COLUMN "pic_contact" varchar(255);