CREATE TYPE "public"."product_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('OPENING', 'ADJUSTMENT', 'SALE', 'CANCELLATION');--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_storage_key_not_blank" CHECK (btrim("product_images"."storage_key") <> ''),
	CONSTRAINT "product_images_url_not_blank" CHECK (btrim("product_images"."url") <> '')
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "product_status" DEFAULT 'INACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_sku_not_blank" CHECK (btrim("products"."sku") <> ''),
	CONSTRAINT "products_name_not_blank" CHECK (btrim("products"."name") <> ''),
	CONSTRAINT "products_description_not_blank" CHECK (btrim("products"."description") <> ''),
	CONSTRAINT "products_price_non_negative" CHECK ("products"."price" >= 0),
	CONSTRAINT "products_currency_iso_format" CHECK ("products"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "products_deleted_status_consistent" CHECK ("products"."deleted_at" is null or "products"."status" = 'INACTIVE')
);
--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"product_id" uuid NOT NULL,
	"available_quantity" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_balances_pkey" PRIMARY KEY("product_id"),
	CONSTRAINT "inventory_balances_quantity_non_negative" CHECK ("inventory_balances"."available_quantity" >= 0),
	CONSTRAINT "inventory_balances_version_non_negative" CHECK ("inventory_balances"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "inventory_movement_type" NOT NULL,
	"quantity_delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" varchar(500) NOT NULL,
	"reference_type" varchar(100),
	"reference_id" varchar(128),
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_movements_quantity_non_zero" CHECK ("inventory_movements"."quantity_delta" <> 0),
	CONSTRAINT "inventory_movements_balance_non_negative" CHECK ("inventory_movements"."balance_after" >= 0),
	CONSTRAINT "inventory_movements_reason_not_blank" CHECK (btrim("inventory_movements"."reason") <> ''),
	CONSTRAINT "inventory_movements_reference_consistent" CHECK (("inventory_movements"."reference_type" is null and "inventory_movements"."reference_id" is null)
        or ("inventory_movements"."reference_type" is not null and "inventory_movements"."reference_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_product_unique" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_storage_key_unique" ON "product_images" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_unique" ON "products" USING btree (upper("sku"));--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inventory_balances_quantity_idx" ON "inventory_balances" USING btree ("available_quantity");--> statement-breakpoint
CREATE INDEX "inventory_movements_product_created_idx" ON "inventory_movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_actor_idx" ON "inventory_movements" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_reference_idx" ON "inventory_movements" USING btree ("reference_type","reference_id");