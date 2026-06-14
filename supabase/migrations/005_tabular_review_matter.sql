-- 005_tabular_review_matter.sql
-- Add matter_id to tabular_reviews so each Tabular Review can be linked to a
-- Matter (formerly "Project") from the local vault. This is the link that
-- powers the "In Matter" tab and "Filter by matter" dropdown on the Tabular
-- Review list page, and the matter selector in the "New Review" dialog.

ALTER TABLE tabular_reviews
  ADD COLUMN IF NOT EXISTS matter_id TEXT;

-- Index for the "reviews in matter" filter
CREATE INDEX IF NOT EXISTS idx_tabular_reviews_matter_id
  ON tabular_reviews(matter_id);

-- Backfill: copy any existing project_id values into matter_id so the
-- legacy data still surfaces in the "In Matter" tab. (Idempotent — running
-- this migration twice is safe because the column is already populated.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tabular_reviews' AND column_name = 'project_id'
  ) THEN
    UPDATE tabular_reviews
    SET matter_id = project_id
    WHERE matter_id IS NULL AND project_id IS NOT NULL;
  END IF;
END $$;
