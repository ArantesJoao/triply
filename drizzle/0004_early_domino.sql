ALTER TABLE "item" ADD COLUMN "stops" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "travel_mode" varchar(16);