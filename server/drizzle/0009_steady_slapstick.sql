ALTER TABLE "service_orders" ADD COLUMN "group_leader_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "service_orders" DROP COLUMN "booker_name";--> statement-breakpoint
ALTER TABLE "service_orders" DROP COLUMN "booker_email";--> statement-breakpoint
ALTER TABLE "service_orders" DROP COLUMN "booker_phone";