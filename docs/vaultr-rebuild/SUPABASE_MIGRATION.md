# Supabase Migration Readiness

Status: prepared; no hosted Supabase project was mutated during Hardening Phase 1.

## Canonical inputs

- Fresh database: `backend/schema.sql`.
- Existing database upgrades: the 49 files in `backend/migrations/`, applied lexicographically by date-prefixed filename.
- Drift gate: `node scripts/check-schema-drift.mjs` checks migration-created tables and final migration-added columns against the canonical schema. It currently passes.
- Application access: backend service-role client after route-level authorization; browser roles are explicitly revoked from backend-owned tables in the fresh schema.

## Vaultr cutover procedure

1. Create/select a Vaultr-owned Supabase project and record its project ref in the private infrastructure inventory.
2. Configure `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, frontend public URL/key, and test-only service/anon keys through the secret manager. Do not commit values.
3. For a fresh project, apply `backend/schema.sql` once. For an existing Mike-derived project, take a verified backup and apply every migration newer than the deployed baseline in filename order.
4. Run `node scripts/check-schema-drift.mjs`, backend build/tests, and the real-stack Supabase tests with `SUPABASE_TEST_URL`, `SUPABASE_TEST_SERVICE_ROLE_KEY`, and `SUPABASE_TEST_ANON_KEY` set only in the test environment.
5. Verify RLS is enabled and anon/authenticated direct grants are absent for backend-owned tables; verify service-role access is limited to the backend runtime.
6. Validate triggers/RPCs, MFA/profile fields, encrypted API-key rows, MCP OAuth state/token rows, workflow submission rows, and audit events before traffic cutover.
7. Rotate all inherited service-role, signing, encryption, and download-token secrets after the Vaultr project is confirmed.

## Data and migration cautions

- The first historical BYO-key migration added `user_profiles.claude_api_key` and `gemini_api_key`; the current canonical schema intentionally omits them in favor of encrypted `user_api_keys`. Confirm whether an existing database contains values and migrate/retire them under a reviewed data procedure before production cutover.
- `contact_messages` and `workflow_open_source_submissions` are now represented in `backend/schema.sql`; earlier Gate 2 drift is closed for fresh installs.
- `audit_events` is additive and non-blocking during rollout. Business actions should continue if the audit table is temporarily unavailable, while the deployment alarm records the write failure.
- No migration in this phase renames product tables, changes product identity, or imports the old branch.

## Hardening Phase 2 local proof

- Docker Desktop and Supabase CLI `2.108.0` were used to start a disposable local stack on 2026-08-10.
- `backend/schema.sql` loaded with PostgreSQL `ON_ERROR_STOP=1`; all 52 dated migrations then applied without SQL errors.
- The canonical snapshot was reapplied successfully to confirm idempotent fresh-install behavior for the tested objects.
- Real Auth sign-in, service-role access, deny-all browser RLS, shared/outsider HTTP authorization, and the atomic OAuth claim RPC passed under Node 22.
- The local stack is evidence for schema/RLS behavior only. It is not evidence of hosted Supabase project ownership, Auth email delivery, MFA enrollment UX, redirect allowlists, production storage, backup retention, or DNS.
- The final inventory recorded 29/29 backend-owned public tables with RLS enabled, zero direct `anon`/`authenticated` table grants, and 203 explicit service-role table grants.

## Cutover checklist

- [ ] Vaultr Supabase project/ref and region recorded in private inventory.
- [ ] Auth site URL, redirect allowlist, email sender/templates, password reset, MFA factors, and rate limits configured.
- [ ] Backend/frontend URLs and Word add-in origins use Vaultr HTTPS domains.
- [ ] `schema.sql` and all 52 migrations applied with captured output/checksum.
- [ ] RLS enabled and `anon`/`authenticated` direct grants absent for backend-owned tables; service-role grants verified.
- [ ] Storage buckets/policies or R2 mapping verified; document/version paths reconciled.
- [ ] Backup, restore, row counts, migration rollback point, and named cutover owner recorded.
- [ ] OAuth callback URL/client registrations, provider keys, download signing secret, manifest key, and API-key encryption secret rotated.
- [ ] Owner/shared/outsider, MFA, export, delete, and Word smoke tests pass against the target.

## Gate evidence required

- Migration output and schema checksum captured from the Vaultr target.
- Row-count/backup evidence for user profiles, documents, versions, API keys, connectors, workflows, and audit events.
- Auth login, MFA, owner/shared/outsider authorization, signed-download expiry, and RLS negative tests against the target.
- Rollback owner and restore point documented before changing DNS or Word/add-in configuration.
