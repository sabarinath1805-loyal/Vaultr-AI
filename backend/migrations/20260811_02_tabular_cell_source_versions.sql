-- DOC-01: bind generated Tabular Review cells to the exact document-version
-- set used for extraction. Existing rows are intentionally left NULL because
-- their source version cannot be established deterministically; consumers
-- must treat those legacy cells as unverified until regenerated.
ALTER TABLE public.tabular_cells
  ADD COLUMN IF NOT EXISTS source_document_version_ids uuid[];

CREATE INDEX IF NOT EXISTS idx_tabular_cells_source_versions
  ON public.tabular_cells USING gin (source_document_version_ids);
