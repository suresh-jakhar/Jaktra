ALTER TYPE "public"."integration_provider" ADD VALUE IF NOT EXISTS 'razorpay';

DO $$ BEGIN
 CREATE TYPE "public"."payment_link_status" AS ENUM('active', 'paid', 'expired', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'INR' NOT NULL;

CREATE TABLE IF NOT EXISTS "invoice_payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"provider_payment_link_id" text NOT NULL,
	"provider_order_id" text,
	"payment_url" text NOT NULL,
	"status" "payment_link_status" DEFAULT 'active' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text NOT NULL,
	"metadata" jsonb,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"external_event_id" text NOT NULL,
	"payment_id" text,
	"invoice_id" uuid,
	"status" text NOT NULL,
	"raw_payload" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);

DO $$ BEGIN
 ALTER TABLE "invoice_payment_links" ADD CONSTRAINT "invoice_payment_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "invoice_payment_links" ADD CONSTRAINT "invoice_payment_links_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "invoice_payment_links_tenant_id_idx" ON "invoice_payment_links" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "invoice_payment_links_invoice_id_idx" ON "invoice_payment_links" USING btree ("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_payment_links_provider_link_id_idx" ON "invoice_payment_links" USING btree ("provider_payment_link_id");
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payment_links_tenant_invoice_provider_active_uniq" ON "invoice_payment_links" USING btree ("tenant_id","invoice_id","provider") WHERE status = 'active';

CREATE INDEX IF NOT EXISTS "payment_webhook_events_tenant_id_idx" ON "payment_webhook_events" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_invoice_id_idx" ON "payment_webhook_events" USING btree ("invoice_id");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_payment_id_idx" ON "payment_webhook_events" USING btree ("payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_tenant_provider_external_event_uniq" ON "payment_webhook_events" USING btree ("tenant_id","provider","external_event_id");