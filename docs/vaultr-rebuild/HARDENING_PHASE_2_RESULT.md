# Vaultr-AI Hardening Phase 2 Result

Date: 2026-08-10<br>
Scope: current repository only. No Mike-to-Vaultr conversion, branding/UI change, old-branch merge, upstream change, commit, PR, history rewrite, or external production configuration was performed.

## Verdict

**CONDITIONALLY READY**

The repository is a hardened base candidate for controlled deployment work: Node 22, real local Supabase/Auth/RLS, HTTP tenant authorization, atomic OAuth state claiming, schema reproducibility, workflow provenance, document scanning/quarantine contracts, production configuration checks, backup/restore mechanics, and Word/frontend/backend regression evidence are now present. It is not a production cutover sign-off because deployment ownership, scanner/converter worker wiring, Word identity, hosted Supabase/R2, retention policy, and Word development-tool advisories remain open.

## Runtime evidence

- Node `v22.13.0` and npm `10.9.2` were used for the final backend, frontend, and Word checks.
- Backend final regression: 45 test files passed, 5 skipped; 521 tests passed, 18 skipped; TypeScript build passed.
- Frontend: 25 test files passed; 236 tests passed; typecheck passed; lint passed with 37 warnings and 0 errors; production build passed under Node 22 with controlled placeholder build variables.
- Word add-in typecheck and production build passed with controlled public build variables; the artifact secret-pattern scan found no high-risk secret patterns.

## Real-stack evidence

- Docker Desktop server `29.1.3` and Supabase CLI `2.108.0` ran a disposable local stack.
- Canonical schema plus all 52 migrations loaded with PostgreSQL `ON_ERROR_STOP=1`.
- Five real-stack test files passed; 18 tests passed: auth contract, deny-all RLS, access filtering, tabular pagination, HTTP owner/shared/outsider authorization, and OAuth state claiming.
- Final inventory: 29/29 backend-owned public tables have RLS enabled; direct `anon`/`authenticated` table grants are zero; service-role table grants are explicit.

## Authorization evidence

- `backend/src/lib/authorizationPolicy.ts` and `AUTHORIZATION_MATRIX.md` define owner-only, shared-read, and shared-write classifications.
- The real HTTP proof created users A/B/C and an A-owned project shared only to C. A could read, C could read project and child documents, B received concealment, and C could not rename/delete the project.
- The policy remains an application boundary because the backend uses the service-role client; RLS is defense in depth, not a substitute for route checks.

## OAuth evidence

- `claim_mcp_oauth_state(text)` performs an atomic expiring `DELETE ... RETURNING`, is `SECURITY DEFINER`, and is executable only by `service_role`.
- Two concurrent claims produced one winner; replay produced no row; direct browser-role execution was denied.

## Dependency risk

After a non-breaking lockfile-only remediation (no `--force`): root is 0/0/0, backend is 0 high/1 moderate/1 low, frontend is 0 high/4 moderate/0 low, and Word is 8 high/7 moderate/4 low. Backend/frontend high runtime reachability was reduced to zero. Word advisories are primarily the development/Office toolchain and still require owner-approved major upgrades plus Word regression before a clean dependency verdict.

## Document isolation

- Upload type/magic, archive, parser, page/slide/cell/text, input/output, timeout, and temporary-workspace limits remain active.
- Conversion uses private temporary directories, no-shell execution, bounded timeout/output, PDF magic validation, and cleanup.
- `Dockerfile.document-converter` supplies a non-root LibreOffice boundary; production sidecar/worker wiring is not yet proven.

## Malware/quarantine

- `documentScanning.ts` provides clean/quarantined/unavailable/error/bypassed states, private scanner input, no-shell invocation, timeout, and fail-closed production behavior.
- Scanner command tests exercised clean, quarantine, and error mappings; recovery tests enforce legal transitions and explicit quarantine review before retry.
- No production scanner vendor/binary was selected or run. This remains a deployment blocker.

## Schema reproducibility

- `backend/schema.sql` is the fresh-install snapshot; 52 dated migrations are applied in order.
- `scripts/check-schema-drift.mjs` passes: 52 migrations, 15 created tables, 47 final added columns.
- Canonical snapshot reapplication and live migration application both completed without SQL errors in the disposable stack.

## Workflow provenance

- Source is `Open-Legal-Products/mike-workflows` at exact commit `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`.
- Upstream MIT license evidence was captured; 31 system workflows were generated.
- `check-workflow-freshness.mjs` and CI checkout the exact SHA and fail on generated-artifact drift or missing source.

## Logging/privacy

- Production config validation rejects raw LLM capture, unsafe URLs, weak/missing cryptographic settings, missing object storage/scanner configuration, and auth/debug bypass flags without printing secrets.
- Raw capture is disabled in production; local capture is bounded, redacted, mode-restricted, and pruned.
- `DATA_LIFECYCLE.md` records technical deletion/retention behavior and explicitly marks audit, backup, provider, and legal-hold policy decisions.

## Audit events

Sensitive event coverage now includes account export/delete, project export/delete/share, document export/delete/quarantine, provider-key changes, MCP connector lifecycle/OAuth changes, and MFA preference changes. Events remain metadata-only and non-blocking; retention, alerting, administrative access, and a redacted viewer are not yet implemented.

## Backup/restore

- A custom-format local PostgreSQL archive was created and inspected: 430,329 bytes, 878 TOC entries, SHA-256 `05250E4B5FD03491E183245C9556877376B28E03DC4AD1B7566F3AC11B514FCB`.
- Restore into a fresh disposable database succeeded with `pg_restore --no-owner --exit-on-error`; row-count checks passed.
- This is local mechanics evidence only. Hosted backup retention, R2 object restore, recovery objectives, and restore authorization remain open.

## Infrastructure ownership

`INFRASTRUCTURE_OWNERSHIP.md` classifies GitHub/CI, Supabase, R2, providers, MCP, scanner/converter, Word identity/certificates/tenant, deployment, DNS/email, monitoring, and secrets. No external account, domain, certificate, secret, deployment, or hosted database was changed.

## Supabase readiness

The repository is ready for a controlled target-project rehearsal: apply the snapshot/migrations, verify the 29/29 RLS inventory and zero direct browser grants, run the real Auth/authorization/OAuth suites, capture checksums/row counts, then rotate inherited secrets. Hosted Auth email/MFA/redirects, production storage, R2 mapping, backups, and ownership still require an operator.

## Word add-in

Node 22 typecheck/build passed. The production manifest was generated with explicit public URLs, and the hermetic Playwright suite passed 64/64 tests against the static E2E server and Office shim. Vaultr registration, certificate, tenant, approved domains, publishing channel, and production API identity remain unverified.

## Remaining blockers

- Wire and exercise the non-root conversion worker and production malware scanner; add queue/cancellation/orphan cleanup operations.
- Resolve or formally accept Word dev-tool dependency advisories with owner-approved upgrades.
- Establish Vaultr ownership of hosted Supabase/Auth, R2, providers, deployment, domains/DNS/email, monitoring, Word identity/certificates, and secret rotation.
- Approve retention, legal hold, audit viewer/access, backup/R2 lifecycle, residency, and provider deletion policies.
- Run a hosted-target rehearsal with MFA, Auth email/redirects, storage, backup/restore, and rollback evidence.

## Intentionally deferred

Mike-to-Vaultr conversion, branding/UI/product changes, old-branch merges, upstream changes, commits, PRs, and history rewrites remain out of scope.
