-- Defense in depth: every backend-owned public table is RLS-enabled even
-- though direct anon/authenticated table grants are revoked. The API uses the
-- service role only after route-level authorization.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'audit_events',
    'chat_messages',
    'chats',
    'contact_messages',
    'courtlistener_citation_index',
    'courtlistener_opinion_cluster_index',
    'document_edits',
    'document_versions',
    'documents',
    'hidden_workflows',
    'library_folders',
    'project_subfolders',
    'projects',
    'tabular_cells',
    'tabular_review_chat_messages',
    'tabular_review_chats',
    'tabular_review_row_sources',
    'tabular_review_rows',
    'tabular_reviews',
    'user_api_keys',
    'user_mcp_connector_tools',
    'user_mcp_connectors',
    'user_mcp_oauth_states',
    'user_mcp_oauth_tokens',
    'user_mcp_tool_audit_logs',
    'user_profiles',
    'workflow_open_source_submissions',
    'workflow_shares',
    'workflows'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;
