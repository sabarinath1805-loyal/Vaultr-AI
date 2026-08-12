-- DOC-01: never let a directly-created document version default to trusted.
-- Existing rows retain their persisted state; only future inserts change.
ALTER TABLE public.document_versions
  ALTER COLUMN processing_state SET DEFAULT 'pending_scan';
