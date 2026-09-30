CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "products_name_search_idx" ON "products" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_description_search_idx" ON "products" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_sku_search_idx" ON "products" USING gin ("sku" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "users_email_search_idx" ON "users" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "users_display_name_search_idx" ON "users" USING gin ("display_name" gin_trgm_ops);
