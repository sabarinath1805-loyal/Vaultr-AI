-- Minimal security-event trail. Metadata is intentionally non-secret and
-- bounded by backend/src/lib/auditEvents.ts.
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  action text not null,
  resource_type text not null,
  resource_id text,
  success boolean not null,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_user_occurred_idx
  on public.audit_events(user_id, occurred_at desc);
create index if not exists audit_events_action_occurred_idx
  on public.audit_events(action, occurred_at desc);

alter table public.audit_events enable row level security;
revoke all privileges on table public.audit_events from anon, authenticated;
