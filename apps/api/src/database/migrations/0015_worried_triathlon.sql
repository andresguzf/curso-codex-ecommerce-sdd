CREATE TABLE "catalog_image_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cloud_name" varchar(100) NOT NULL,
	"storage_key" varchar(512),
	"state" varchar(16) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_image_operations_state" CHECK ("catalog_image_operations"."state" in ('UPLOADING','CONFIRMED','PENDING','DONE','BLOCKED')),
	CONSTRAINT "catalog_image_operations_attempts" CHECK ("catalog_image_operations"."attempts" between 0 and 8)
);
--> statement-breakpoint
CREATE INDEX "catalog_image_operations_due_idx" ON "catalog_image_operations" USING btree ("state","next_attempt_at");