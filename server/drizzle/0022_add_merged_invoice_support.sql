-- Add meta JSONB column to manual_invoices for merged invoice support
ALTER TABLE "manual_invoices" ADD COLUMN IF NOT EXISTS "meta" jsonb;
