CREATE TYPE "public"."cart_status" AS ENUM('ACTIVE', 'CHECKED_OUT', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."idempotency_status" AS ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PROCESSING', 'INVOICED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_quantity_positive" CHECK ("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "cart_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "carts_closed_at_consistent" CHECK (("carts"."status" = 'ACTIVE' and "carts"."closed_at" is null)
        or ("carts"."status" <> 'ACTIVE' and "carts"."closed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"scope" varchar(100) NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"request_hash" varchar(128) NOT NULL,
	"status" "idempotency_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"response_snapshot" jsonb,
	"order_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_records_scope_not_blank" CHECK (btrim("idempotency_records"."scope") <> ''),
	CONSTRAINT "idempotency_records_key_hash_not_blank" CHECK (btrim("idempotency_records"."key_hash") <> ''),
	CONSTRAINT "idempotency_records_request_hash_not_blank" CHECK (btrim("idempotency_records"."request_hash") <> ''),
	CONSTRAINT "idempotency_records_response_snapshot_is_object" CHECK ("idempotency_records"."response_snapshot" is null or jsonb_typeof("idempotency_records"."response_snapshot") = 'object'),
	CONSTRAINT "idempotency_records_expiry_after_creation" CHECK ("idempotency_records"."expires_at" > "idempotency_records"."created_at")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_snapshot" varchar(64) NOT NULL,
	"name_snapshot" varchar(200) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_sku_snapshot_not_blank" CHECK (btrim("order_items"."sku_snapshot") <> ''),
	CONSTRAINT "order_items_name_snapshot_not_blank" CHECK (btrim("order_items"."name_snapshot") <> ''),
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_non_negative" CHECK ("order_items"."unit_price" >= 0),
	CONSTRAINT "order_items_tax_amount_non_negative" CHECK ("order_items"."tax_amount" >= 0),
	CONSTRAINT "order_items_line_total_non_negative" CHECK ("order_items"."line_total" >= 0),
	CONSTRAINT "order_items_line_total_consistent" CHECK ("order_items"."line_total" = ("order_items"."unit_price" * "order_items"."quantity") + "order_items"."tax_amount"),
	CONSTRAINT "order_items_currency_iso_format" CHECK ("order_items"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" varchar(64) NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'PROCESSING' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"shipping_total" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"tax_total" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"customer_snapshot" jsonb NOT NULL,
	"shipping_address_snapshot" jsonb NOT NULL,
	"shipping_method_snapshot" jsonb NOT NULL,
	"payment_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "orders_number_not_blank" CHECK (btrim("orders"."number") <> ''),
	CONSTRAINT "orders_currency_iso_format" CHECK ("orders"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "orders_subtotal_non_negative" CHECK ("orders"."subtotal" >= 0),
	CONSTRAINT "orders_shipping_total_non_negative" CHECK ("orders"."shipping_total" >= 0),
	CONSTRAINT "orders_tax_total_non_negative" CHECK ("orders"."tax_total" >= 0),
	CONSTRAINT "orders_total_non_negative" CHECK ("orders"."total" >= 0),
	CONSTRAINT "orders_total_consistent" CHECK ("orders"."total" = "orders"."subtotal" + "orders"."shipping_total" + "orders"."tax_total"),
	CONSTRAINT "orders_customer_snapshot_is_object" CHECK (jsonb_typeof("orders"."customer_snapshot") = 'object'),
	CONSTRAINT "orders_shipping_address_snapshot_is_object" CHECK (jsonb_typeof("orders"."shipping_address_snapshot") = 'object'),
	CONSTRAINT "orders_shipping_method_snapshot_is_object" CHECK (jsonb_typeof("orders"."shipping_method_snapshot") = 'object'),
	CONSTRAINT "orders_payment_snapshot_is_object" CHECK (jsonb_typeof("orders"."payment_snapshot") = 'object'),
	CONSTRAINT "orders_cancellation_consistent" CHECK (("orders"."status" = 'CANCELLED') = ("orders"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"method" varchar(100) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"provider_reference" varchar(255),
	"result_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "payments_method_not_blank" CHECK (btrim("payments"."method") <> ''),
	CONSTRAINT "payments_amount_non_negative" CHECK ("payments"."amount" >= 0),
	CONSTRAINT "payments_currency_iso_format" CHECK ("payments"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "payments_result_snapshot_is_object" CHECK (jsonb_typeof("payments"."result_snapshot") = 'object'),
	CONSTRAINT "payments_processed_at_consistent" CHECK (("payments"."status" = 'PENDING' and "payments"."processed_at" is null)
        or ("payments"."status" <> 'PENDING' and "payments"."processed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_cart_product_unique" ON "cart_items" USING btree ("cart_id","product_id");--> statement-breakpoint
CREATE INDEX "cart_items_product_idx" ON "cart_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_customer_active_unique" ON "carts" USING btree ("customer_id") WHERE "carts"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "carts_customer_status_idx" ON "carts" USING btree ("customer_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_key_unique" ON "idempotency_records" USING btree ("customer_id","scope","key_hash");--> statement-breakpoint
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_records_order_idx" ON "idempotency_records" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_items_order_product_unique" ON "order_items" USING btree ("order_id","product_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_unique" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "orders_customer_created_idx" ON "orders" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_unique" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at");