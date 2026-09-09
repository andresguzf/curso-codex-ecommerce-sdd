DROP INDEX "carts_customer_active_unique";--> statement-breakpoint
ALTER TABLE "carts" ALTER COLUMN "customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "carts" ADD COLUMN "anonymous_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "carts" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "carts_anonymous_active_unique" ON "carts" USING btree ("anonymous_token_hash") WHERE "carts"."status" = 'ACTIVE' and "carts"."anonymous_token_hash" is not null;--> statement-breakpoint
CREATE INDEX "carts_expires_at_idx" ON "carts" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_customer_active_unique" ON "carts" USING btree ("customer_id") WHERE "carts"."status" = 'ACTIVE' and "carts"."customer_id" is not null;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_owner_consistent" CHECK (("carts"."customer_id" is not null and "carts"."anonymous_token_hash" is null and "carts"."expires_at" is null)
        or ("carts"."customer_id" is null and "carts"."anonymous_token_hash" is not null and "carts"."expires_at" is not null));