-- DOC-01: retain server-generated provenance for Tabular assistant turns.
-- The API never trusts this field when supplied by a caller; it is resolved
-- from the authorized review cells before the model context is built.
ALTER TABLE public.tabular_review_chat_messages
  ADD COLUMN IF NOT EXISTS provenance jsonb;
