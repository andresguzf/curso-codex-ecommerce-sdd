ALTER TABLE "categories" ADD COLUMN "show_on_landing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "landing_order" smallint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "featured_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_landing_order_unique" ON "categories" USING btree ("landing_order") WHERE "categories"."show_on_landing" = true;--> statement-breakpoint
CREATE INDEX "products_public_featured_idx" ON "products" USING btree ("is_featured","featured_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "products"."status" = 'ACTIVE' and "products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "products_public_recent_idx" ON "products" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "products"."status" = 'ACTIVE' and "products"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_landing_selection_consistent" CHECK (
      ("categories"."show_on_landing" = true and "categories"."landing_order" is not null and "categories"."landing_order" between 1 and 3)
      or ("categories"."show_on_landing" = false and "categories"."landing_order" is null)
    );--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_featured_timestamp_required" CHECK ("products"."is_featured" = false or "products"."featured_at" is not null);