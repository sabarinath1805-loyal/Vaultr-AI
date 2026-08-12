# Vaultr-AI Hardening Phase 1 Result

Date: 2026-08-10<br>
Scope: current Mike-based `master`; no product conversion, branding conversion, old-branch merge, upstream change, history rewrite, commit, or PR.

## Verdict

**CONDITIONALLY READY**

The repository has a materially hardened implementation baseline and green host-side unit, mocked-route, build, schema, and Word E2E evidence. It is not a production or real-stack release sign-off because Node 22 execution, Supabase/RLS, LibreOffice, malware quarantine, workflow-source provenance, dependency remediation, and final ownership/cutover evidence remain open.

## Runtime

- Canonical runtime is Node 22.x, enforced by `.nvmrc`, package engines, Docker, CI, and README.
- The audit host is Node `v24.18.0` with npm `11.16.0`; host results are advisory until rerun under Node 22.
- Docker daemon, Supabase CLI, LibreOffice, Ollama, and the sibling `mike-workflows` source are unavailable on this host.
- Word E2E now uses a cross-platform Node build wrapper and signal-aware static server.

## Tests

- Backend: 40 test files passed, 3 skipped; 505 passed, 14 skipped.
- Backend TypeScript build: pass.
- Frontend: 25 test files passed; 236 passed.
- Frontend typecheck: pass.
- Frontend lint: pass; 37 warnings, 0 errors.
- Schema drift: pass — 49 migrations, 15 created tables, 40 final added columns.
- Word add-in E2E build: pass with three webpack performance warnings.
- Word Playwright E2E: 64 passed using the hermetic Office shim and Chromium.
- Real Supabase/RLS, local stack, and LibreOffice conversion tests: not executed because required infrastructure is absent.

## Authorization

Owner-only gates now protect project document/folder mutations, document version creation/upload/rename, tracked-edit resolution, tabular generation/regeneration/cell clearing, and tabular chat rename/delete. Row IDs are constrained to the requested review. Project read/chat/export behavior remains explicitly shared where intended. OAuth state validation covers state binding, expiry, user binding, redirect safety, and required decrypted configuration. Atomic OAuth state claim and real Supabase/RLS negative tests remain open.

## Schema

`backend/schema.sql` now includes migration-only contact/workflow submission tables and additive `audit_events`, with RLS and direct-grant hardening. `scripts/check-schema-drift.mjs` is wired into CI and fails on migration filename, table, or final-column drift. Workflow generation now requires a present source and exact 40-character commit SHA; it currently fails fast because the source tree and approved pin are absent.

## Dependencies

Node 22 is pinned as the supported runtime. Existing backend/frontend audit findings remain; no forceful automated upgrade was applied. High runtime-reachable parser and framework advisories require owner-reviewed upgrades, compatibility tests, and registry-backed verification.

## Document security

Uploads now validate trusted magic/container markers and MIME consistency, bound Office ZIP entries and declared expansion, cap PDF pages, spreadsheet cells, presentation slides, and extracted text, and bound LibreOffice conversion time and temporary-file scope. Cleanup covers newly-created objects on initial upload failure. Malware scanning/quarantine, worker/container isolation, and durable queue/cancellation controls remain deployment blockers.

## Logging/privacy

Raw LLM capture is disabled in production, requires explicit non-production opt-in, redacts secret-like fields and content by default, truncates strings, requires an absolute directory, applies restrictive file modes, and prunes old files. Document-operation logs no longer emit extracted text excerpts. A full privacy retention/deletion taxonomy and production logging rollout evidence remain open.

## Provider governance

`PROVIDER_GOVERNANCE.md` records the active provider paths, secret ownership, data-flow rules, model/provider approval requirements, and incident controls. OpenRouter is documented as stored-but-not-canonical active routing; Ollama remains optional and unavailable locally. No provider migration was started.

## Infrastructure ownership

`INFRASTRUCTURE_OWNERSHIP.md` assigns future ownership for repository/CI, Supabase, object storage, providers, MCP, conversion workers, Word deployment, email, and domains. No hosted resource or DNS/add-in ownership was changed during this phase.

## Supabase

`SUPABASE_MIGRATION.md` defines the fresh-install and existing-database cutover procedure, backup/rollback evidence, secret rotation, RLS/grant verification, and audit-event rollout. No hosted Supabase project was mutated. A real target project, migration checksum, row-count evidence, and RLS negative tests are still required.

## Word add-in

The Windows E2E build passes, Playwright discovers 64 tests, and the full hermetic suite passes 64/64 after replacing the non-terminating Windows server wrapper. Final add-in identity, certificate, deployment URL, tenant ownership, and production cutover remain unverified.

## Code changes

- Runtime and cross-platform E2E contracts: `.nvmrc`, package engines/locks, README, Word build/server scripts, and Playwright configuration.
- Route authorization/linkage: projects, documents, and tabular routes.
- Upload/document processing: file validation, parser limits, conversion timeout/cleanup, and failure cleanup.
- Security contracts: expiring signed downloads and OAuth state validation/tests.
- Reproducibility: schema drift gate and workflow-source pin enforcement.
- Privacy/audit: safe raw-stream logging and additive audit-event table/library/wiring.
- Required evidence docs: provider governance, infrastructure ownership, Supabase migration, audit foundation, and this result.

## Remaining blockers

- Node 22 rerun and disposable Docker/Supabase/RLS evidence.
- LibreOffice sandbox/worker validation and malware scanning/quarantine deployment.
- Approved exact `mike-workflows` source SHA and CI generator/freshness verification.
- Owner-reviewed remediation of unresolved dependency advisories.
- Atomic OAuth state claim and complete audit-event coverage for all sensitive mutations.
- Vaultr-controlled Supabase, object-storage, provider, Word identity, certificate, tenant, domain, and DNS cutover ownership.

## Next 10 tasks

1. Run the full backend/frontend/Word/schema suites in a Node 22 CI or WSL2 runner.
2. Provision a disposable Supabase target and run schema, RLS, owner/shared/outsider, MFA, and signed-download negative tests.
3. Capture schema/migration checksums, row counts, backup, restore point, and rollback owner evidence.
4. Obtain and approve the exact `mike-workflows` source SHA, then enable generator and generated-artifact freshness checks in CI.
5. Build a low-privilege document conversion worker with CPU, memory, wall-clock, and filesystem limits.
6. Add malware scanning/quarantine and explicit document processing status transitions.
7. Review and remediate runtime-reachable dependency advisories with focused parser and regression tests.
8. Implement atomic OAuth state claiming and expand sensitive-action audit coverage.
9. Define privacy retention/deletion/export procedures and production logging configuration checks.
10. Confirm Vaultr ownership of Supabase, storage, providers, Word deployment identity, certificates, domains, and DNS before any product conversion gate.
