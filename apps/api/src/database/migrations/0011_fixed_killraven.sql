CREATE TABLE "store_logo_assets" (
	"storage_key" varchar(512) PRIMARY KEY NOT NULL,
	"url" varchar(2048) NOT NULL,
	"mime_type" varchar(32) NOT NULL,
	"size" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_logo_assets_mime" CHECK ("store_logo_assets"."mime_type" in ('image/png','image/jpeg','image/webp')),
	CONSTRAINT "store_logo_assets_size" CHECK ("store_logo_assets"."size" > 0),
	CONSTRAINT "store_logo_assets_sha256" CHECK ("store_logo_assets"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "store_profiles" DROP CONSTRAINT "store_profiles_logo_reference_complete";--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "logo_sha256" varchar(64);--> statement-breakpoint
-- Earlier profile logos accepted arbitrary URLs and cannot be treated as managed assets.
-- Leave historical document snapshots untouched; administrators can upload a new logo.
UPDATE "store_profiles" SET "logo_storage_key" = NULL, "logo_url" = NULL WHERE "logo_storage_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD CONSTRAINT "store_profiles_logo_reference_complete" CHECK (("store_profiles"."logo_storage_key" is null and "store_profiles"."logo_url" is null and "store_profiles"."logo_sha256" is null) or ("store_profiles"."logo_storage_key" is not null and "store_profiles"."logo_url" is not null and "store_profiles"."logo_sha256" ~ '^[0-9a-f]{64}$'));
