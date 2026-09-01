CREATE TYPE "public"."user_role" AS ENUM('CUSTOMER', 'ADMIN', 'BILLING');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INACTIVE', 'BLOCKED');--> statement-breakpoint
CREATE TABLE "audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(128) NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correlation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_entries_action_not_blank" CHECK (btrim("audit_entries"."action") <> ''),
	CONSTRAINT "audit_entries_entity_type_not_blank" CHECK (btrim("audit_entries"."entity_type") <> ''),
	CONSTRAINT "audit_entries_entity_id_not_blank" CHECK (btrim("audit_entries"."entity_id") <> ''),
	CONSTRAINT "audit_entries_changes_is_object" CHECK (jsonb_typeof("audit_entries"."changes") = 'object')
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" varchar(512),
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_not_blank" CHECK (btrim("sessions"."token_hash") <> ''),
	CONSTRAINT "sessions_expiry_after_creation" CHECK ("sessions"."expires_at" > "sessions"."created_at"),
	CONSTRAINT "sessions_revocation_after_creation" CHECK ("sessions"."revoked_at" is null or "sessions"."revoked_at" >= "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_not_blank" CHECK (btrim("users"."email") <> ''),
	CONSTRAINT "users_password_hash_not_blank" CHECK (btrim("users"."password_hash") <> ''),
	CONSTRAINT "users_display_name_not_blank" CHECK (btrim("users"."display_name") <> ''),
	CONSTRAINT "users_deleted_status_consistent" CHECK ("users"."deleted_at" is null or "users"."status" <> 'ACTIVE')
);
--> statement-breakpoint
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entries_actor_idx" ON "audit_entries" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_entries_entity_idx" ON "audit_entries" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_entries_created_at_idx" ON "audit_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_entries_correlation_idx" ON "audit_entries" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignments_user_unique" ON "role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "role_assignments_role_idx" ON "role_assignments" USING btree ("role");--> statement-breakpoint
CREATE INDEX "role_assignments_assigned_by_idx" ON "role_assignments" USING btree ("assigned_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");