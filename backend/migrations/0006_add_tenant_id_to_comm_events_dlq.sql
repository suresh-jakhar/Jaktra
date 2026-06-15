-- Add tenant_id to communications table
ALTER TABLE communications ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to events table
ALTER TABLE events ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Add tenant_id to dlq_entries table
ALTER TABLE dlq_entries ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill tenant_id from invoices table
UPDATE communications SET tenant_id = invoices.tenant_id FROM invoices WHERE communications.invoice_id = invoices.id;
UPDATE events SET tenant_id = invoices.tenant_id FROM invoices WHERE events.invoice_id = invoices.id;
UPDATE dlq_entries SET tenant_id = invoices.tenant_id FROM invoices WHERE dlq_entries.invoice_id = invoices.id;

-- Add indexes for tenant-scoped queries
CREATE INDEX communications_tenant_id_idx ON communications(tenant_id);
CREATE INDEX events_tenant_id_idx ON events(tenant_id);
CREATE INDEX dlq_entries_tenant_id_idx ON dlq_entries(tenant_id);

-- Make tenant_id NOT NULL after backfill
ALTER TABLE communications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE dlq_entries ALTER COLUMN tenant_id SET NOT NULL;
