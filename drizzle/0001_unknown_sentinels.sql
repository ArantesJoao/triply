ALTER TABLE "trip" ADD COLUMN "tag_colors" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "tag_icons" jsonb DEFAULT '{}'::jsonb;