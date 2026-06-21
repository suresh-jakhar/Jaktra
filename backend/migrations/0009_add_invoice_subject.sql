-- Migration: Add optional subject/description field to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subject TEXT;
