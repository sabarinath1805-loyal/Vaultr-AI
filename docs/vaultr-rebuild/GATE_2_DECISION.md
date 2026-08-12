# Vaultr-AI Rebuild Audit Gate 2 Decision

Date: 2026-08-10<br>
Branch: `master`<br>
Scope: Gate 2 audit only; no Mike-to-Vaultr conversion or historical source port was performed.

## Verdict: CONDITIONAL GO

**Conditional GO for the next audit/hardening phase and a controlled non-production environment.**<br>
**NO GO for production, public pilot, or enterprise readiness.**

## Why

### Authorization

Route-level and helper-level negative tests are green, including project sharing, private denial, tabular document filtering, project chat, download-token binding, and MCP SSRF guards. However, the backend uses a service-role Supabase client that bypasses RLS. The database snapshot denies direct browser roles, but cannot compensate for an omitted route check. Shared-write semantics and OAuth/workflow negative coverage are not complete.

### Dependency risk

Root and Word workspaces audit clean. Backend has 17 high/29 moderate advisories; frontend has 21 high/47 moderate/1 low. Several high findings are on upload/extraction/conversion, MCP/model transport, SSR, and rendered-content paths. No automatic fix was applied.

### Test environment

Backend and frontend mocked/unit baselines are green. Node 22, Docker/Supabase, LibreOffice, full local stack E2E, and the external workflow source are unavailable on this host. Infrastructure-dependent security evidence is therefore incomplete.

### Schema and generation

`backend/schema.sql` is not equivalent to the 48 migration files. At least `contact_messages` and `workflow_open_source_submissions` are migration-only. The workflow generator cannot run without the sibling `mike-workflows` source tree, so generated-artifact provenance/freshness is not independently reproducible.

### Privacy and ingestion

The application has useful access checks, encryption fields, and MCP SSRF controls, but document parsing/conversion lacks an evident resource sandbox and raw LLM capture can persist sensitive payloads without repository-defined retention.

## Conditions to exit Gate 2

1. Restore a reproducible Node 22 + Docker/Supabase runner and pass real access/RLS stack tests.
2. Decide and test the shared collaborator write policy for every project/document/version/edit/tabular mutation.
3. Add OAuth replay/wrong-user/expired-state tests and link tabular child IDs to parent review IDs in tests and code as needed.
4. Resolve high dependency advisories or document reviewed reachability exceptions with owners/dates.
5. Make schema installation and migration drift checks fail-fast and reproducible.
6. Restore/pin workflow generator provenance and freshness checks.
7. Add ingestion resource limits, converter isolation, privacy-safe logging policy, and retention controls.

No product feature conversion, rename, branding change, historical merge, or enterprise implementation is authorized by this decision.
