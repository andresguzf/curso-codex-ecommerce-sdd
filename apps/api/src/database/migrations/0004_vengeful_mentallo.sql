CREATE TYPE "public"."invoice_origin" AS ENUM('MANUAL', 'ORDER');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'PENDING_PAYMENT', 'PAID', 'VOID');--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"product_id" uuid,
	"position" integer NOT NULL,
	"sku_snapshot" varchar(64),
	"name_snapshot" varchar(200) NOT NULL,
	"description_snapshot" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"tax_rate" numeric(7, 4) DEFAULT '0.0000' NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"line_subtotal" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_lines_position_positive" CHECK ("invoice_lines"."position" > 0),
	CONSTRAINT "invoice_lines_sku_snapshot_not_blank" CHECK ("invoice_lines"."sku_snapshot" is null or btrim("invoice_lines"."sku_snapshot") <> ''),
	CONSTRAINT "invoice_lines_name_snapshot_not_blank" CHECK (btrim("invoice_lines"."name_snapshot") <> ''),
	CONSTRAINT "invoice_lines_description_snapshot_not_blank" CHECK (btrim("invoice_lines"."description_snapshot") <> ''),
	CONSTRAINT "invoice_lines_quantity_positive" CHECK ("invoice_lines"."quantity" > 0),
	CONSTRAINT "invoice_lines_unit_price_non_negative" CHECK ("invoice_lines"."unit_price" >= 0),
	CONSTRAINT "invoice_lines_tax_rate_valid" CHECK ("invoice_lines"."tax_rate" >= 0 and "invoice_lines"."tax_rate" <= 100),
	CONSTRAINT "invoice_lines_tax_amount_non_negative" CHECK ("invoice_lines"."tax_amount" >= 0),
	CONSTRAINT "invoice_lines_subtotal_consistent" CHECK ("invoice_lines"."line_subtotal" = "invoice_lines"."unit_price" * "invoice_lines"."quantity"),
	CONSTRAINT "invoice_lines_total_consistent" CHECK ("invoice_lines"."line_total" = "invoice_lines"."line_subtotal" + "invoice_lines"."tax_amount"),
	CONSTRAINT "invoice_lines_currency_iso_format" CHECK ("invoice_lines"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" varchar(64),
	"origin" "invoice_origin" NOT NULL,
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"order_id" uuid,
	"customer_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"currency" varchar(3) NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"shipping_total" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"tax_total" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"issuer_snapshot" jsonb NOT NULL,
	"customer_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	CONSTRAINT "invoices_number_not_blank" CHECK ("invoices"."number" is null or btrim("invoices"."number") <> ''),
	CONSTRAINT "invoices_origin_order_consistent" CHECK (("invoices"."origin" = 'MANUAL' and "invoices"."order_id" is null)
        or ("invoices"."origin" = 'ORDER' and "invoices"."order_id" is not null)),
	CONSTRAINT "invoices_numbering_state_consistent" CHECK (("invoices"."status" = 'DRAFT' and "invoices"."number" is null and "invoices"."issued_at" is null)
        or ("invoices"."status" in ('PENDING_PAYMENT', 'PAID') and "invoices"."number" is not null and "invoices"."issued_at" is not null)
        or ("invoices"."status" = 'VOID' and (("invoices"."number" is null and "invoices"."issued_at" is null)
          or ("invoices"."number" is not null and "invoices"."issued_at" is not null)))),
	CONSTRAINT "invoices_voided_at_consistent" CHECK (("invoices"."status" = 'VOID') = ("invoices"."voided_at" is not null)),
	CONSTRAINT "invoices_paid_at_consistent" CHECK (("invoices"."status" = 'PAID' and "invoices"."paid_at" is not null)
        or ("invoices"."status" in ('DRAFT', 'PENDING_PAYMENT') and "invoices"."paid_at" is null)
        or "invoices"."status" = 'VOID'),
	CONSTRAINT "invoices_issued_after_creation" CHECK ("invoices"."issued_at" is null or "invoices"."issued_at" >= "invoices"."created_at"),
	CONSTRAINT "invoices_due_after_issue" CHECK ("invoices"."due_at" is null or ("invoices"."issued_at" is not null and "invoices"."due_at" >= "invoices"."issued_at")),
	CONSTRAINT "invoices_paid_after_issue" CHECK ("invoices"."paid_at" is null or ("invoices"."issued_at" is not null and "invoices"."paid_at" >= "invoices"."issued_at")),
	CONSTRAINT "invoices_currency_iso_format" CHECK ("invoices"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "invoices_subtotal_non_negative" CHECK ("invoices"."subtotal" >= 0),
	CONSTRAINT "invoices_shipping_total_non_negative" CHECK ("invoices"."shipping_total" >= 0),
	CONSTRAINT "invoices_tax_total_non_negative" CHECK ("invoices"."tax_total" >= 0),
	CONSTRAINT "invoices_total_non_negative" CHECK ("invoices"."total" >= 0),
	CONSTRAINT "invoices_total_consistent" CHECK ("invoices"."total" = "invoices"."subtotal" + "invoices"."shipping_total" + "invoices"."tax_total"),
	CONSTRAINT "invoices_issuer_snapshot_is_object" CHECK (jsonb_typeof("invoices"."issuer_snapshot") = 'object'),
	CONSTRAINT "invoices_customer_snapshot_is_object" CHECK (jsonb_typeof("invoices"."customer_snapshot") = 'object')
);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lines_invoice_position_unique" ON "invoice_lines" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE INDEX "invoice_lines_product_idx" ON "invoice_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_unique" ON "invoices" USING btree ("number") WHERE "invoices"."number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_active_order_unique" ON "invoices" USING btree ("order_id") WHERE "invoices"."order_id" is not null and "invoices"."status" <> 'VOID';--> statement-breakpoint
CREATE INDEX "invoices_customer_created_idx" ON "invoices" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_status_created_idx" ON "invoices" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "invoices_origin_created_idx" ON "invoices" USING btree ("origin","created_at");--> statement-breakpoint
CREATE INDEX "invoices_created_by_idx" ON "invoices" USING btree ("created_by_user_id");