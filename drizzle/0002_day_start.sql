ALTER TABLE "city" ADD COLUMN IF NOT EXISTS "day_start_min" integer;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN IF NOT EXISTS "day_start_min" integer DEFAULT 480 NOT NULL;