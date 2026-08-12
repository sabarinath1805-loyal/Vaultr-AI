# RLS and Service-Role Boundary

## Boundary statement

The current backend does not use the end-user Supabase JWT for data queries. `backend/src/lib/supabase.ts` creates a server client with `SUPABASE_SECRET_KEY`; its own comment states that this bypasses RLS. `backend/src/middleware/auth.ts` validates the bearer token first, but the subsequent database operations execute with service-role authority.

Therefore:

```text
browser -> bearer token -> requireAuth -> route object check -> service_role query -> Postgres
                                      ^ effective authorization boundary
```

If a route omits or weakens its object check, Postgres RLS will not rescue the request.

## Database evidence

`backend/schema.sql`:

- Revokes all table privileges from `anon` and `authenticated` for application data, API keys, MCP data, and citation index tables.
- Enables RLS on sensitive tables such as API keys, MCP connector/token/state/tool/audit tables, tabular row/source tables, and citation indexes.
- Does not define user-facing `CREATE POLICY` rules for those tables. With direct client grants revoked, this is a backend-only/deny-by-default posture.
- Grants `SELECT, INSERT, UPDATE, DELETE` on all tables and sequence usage to `service_role`.

The canonical snapshot includes `contact_messages` and
`workflow_open_source_submissions` as well as the other backend-owned tables;
they are no longer migration-only exceptions. The stack bootstrap verifies the
29-table RLS/direct-grant inventory after loading the snapshot, and CI does not
re-grant privileges through a warning-only migration loop.

## Application controls that must hold

- `requireAuth` must run for every non-health route.
- `checkProjectAccess`, `ensureDocAccess`, `ensureReviewAccess`, and `filterAccessibleDocumentIds` must run before object reads or model/tool calls.
- Owner-only mutations must use owner filters or an explicit `isOwner` result.
- User-supplied document IDs must be reduced against accessible IDs before context assembly.
- API keys, connector secrets, OAuth state/tokens, and tool audit records must stay caller-scoped.
- The service-role key must never reach browser bundles, logs, or generated export payloads.

## Evidence reviewed

- `backend/src/middleware/auth.ts`
- `backend/src/lib/access.ts`
- `backend/src/lib/supabase.ts`
- `backend/src/app.ts`
- `backend/schema.sql`
- `backend/migrations/20260508_01_revoke_client_grants_backend_tables.sql`
- `backend/migrations/20260508_02_revoke_client_grants_user_profiles.sql`
- `backend/migrations/20260613_04_user_mcp_connectors.sql`
- `backend/migrations/20260615_01_mcp_connector_oauth.sql`
- `backend/migrations/20260629_01_workflow_open_source_submissions.sql`

## Gate 2 assessment

The direct-browser boundary is strong: browser roles cannot query application tables. The service-role boundary is a material residual risk because the route policy is distributed across many handlers and shared-write semantics are not consistently explicit. A real local Supabase test must be restored before production authorization sign-off, and Gate 3 must add negative coverage for every shared-write path.
