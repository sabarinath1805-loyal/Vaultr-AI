-- 006_usage_logs_columns.sql
-- Add response_time_ms and jurisdiction columns to usage_logs so that
-- logUsage() inserts (which include these fields) succeed and the
-- /api/usage/stats endpoint can aggregate on them.
--
-- These columns are referenced by:
--   src/lib/supabase.ts :: logUsage() — inserts both fields
--   src/app/api/usage/stats/route.ts — aggregates total + by model
--
-- Idempotent — safe to re-run.

ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS jurisdiction TEXT;

-- Index jurisdiction for "usage by jurisdiction" breakdowns
CREATE INDEX IF NOT EXISTS idx_usage_logs_jurisdiction
  ON usage_logs(jurisdiction)
  WHERE jurisdiction IS NOT NULL;
