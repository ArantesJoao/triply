CREATE TABLE "geocode_cache" (
	"query" text PRIMARY KEY NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
