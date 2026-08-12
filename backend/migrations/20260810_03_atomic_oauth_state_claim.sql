-- Atomically consume an OAuth state before exchanging its authorization code.
-- The DELETE ... RETURNING statement is one database operation: concurrent
-- callbacks can observe at most one claimed row.
create or replace function public.claim_mcp_oauth_state(p_state_hash text)
returns setof public.user_mcp_oauth_states
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    delete from public.user_mcp_oauth_states
    where state_hash = p_state_hash
      and expires_at > now()
    returning *;
end;
$$;

revoke all on function public.claim_mcp_oauth_state(text) from public, anon, authenticated;
grant execute on function public.claim_mcp_oauth_state(text) to service_role;
