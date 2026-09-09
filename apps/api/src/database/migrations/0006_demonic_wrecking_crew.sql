ALTER TABLE "invoice_lines" DROP CONSTRAINT "invoice_lines_currency_iso_format";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_currency_iso_format";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_currency_iso_format";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_currency_iso_format";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_currency_iso_format";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_currency_iso_format";--> statement-breakpoint
ALTER TABLE "invoice_lines" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
UPDATE "invoice_lines" SET "currency" = 'USD' WHERE "currency" <> 'USD';--> statement-breakpoint
UPDATE "invoices" SET "currency" = 'USD' WHERE "currency" <> 'USD';--> statement-breakpoint
UPDATE "products" SET "currency" = 'USD' WHERE "currency" <> 'USD';--> statement-breakpoint
UPDATE "order_items" SET "currency" = 'USD' WHERE "currency" <> 'USD';--> statement-breakpoint
UPDATE "orders" SET "currency" = 'USD' WHERE "currency" <> 'USD';--> statement-breakpoint
UPDATE "payments" SET "currency" = 'USD' WHERE "currency" <> 'USD';--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_currency_usd_only" CHECK ("invoice_lines"."currency" = 'USD');--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_usd_only" CHECK ("invoices"."currency" = 'USD');--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_currency_usd_only" CHECK ("products"."currency" = 'USD');--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_currency_usd_only" CHECK ("order_items"."currency" = 'USD');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_usd_only" CHECK ("orders"."currency" = 'USD');--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_usd_only" CHECK ("payments"."currency" = 'USD');
