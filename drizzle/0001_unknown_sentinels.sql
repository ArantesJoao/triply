ALTER TABLE "trip" ADD COLUMN IF NOT EXISTS "tag_colors" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN IF NOT EXISTS "tag_icons" jsonb DEFAULT '{}'::jsonb;
