-- Explicit ingestion state used by scanning, conversion, extraction, and
-- recovery. Existing rows are treated as ready because they predate the
-- quarantine boundary; new uploads must transition through pending_scan.
alter table public.documents
  add column if not exists processing_state text not null default 'ready',
  add column if not exists scan_status text not null default 'clean',
  add column if not exists scan_provider text,
  add column if not exists scan_completed_at timestamptz,
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists last_processing_error text;

alter table public.document_versions
  add column if not exists processing_state text not null default 'ready';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_processing_state_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents add constraint documents_processing_state_check
      check (processing_state in ('uploaded', 'pending_scan', 'clean', 'quarantined', 'processing', 'ready', 'failed'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_scan_status_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents add constraint documents_scan_status_check
      check (scan_status in ('pending', 'clean', 'quarantined', 'unavailable', 'error', 'bypassed'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'document_versions_processing_state_check'
      and conrelid = 'public.document_versions'::regclass
  ) then
    alter table public.document_versions add constraint document_versions_processing_state_check
      check (processing_state in ('uploaded', 'pending_scan', 'clean', 'quarantined', 'processing', 'ready', 'failed'));
  end if;
end;
$$;

create index if not exists documents_processing_state_idx
  on public.documents(processing_state, updated_at);
