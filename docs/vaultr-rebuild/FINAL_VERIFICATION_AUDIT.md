# Vaultr-AI Final Hardened Base Verification Audit

Date: 2026-08-10<br>
Verdict: **NO — the hardened base is not authorized for Vaultr conversion**

## Scope and method

This was a read-only verification of the current Mike-based repository after Hardening Phase 1 and Hardening Phase 2. No source, test, dependency, schema, workflow, or configuration files were changed. The only changes made for this gate are the verification records in `docs/vaultr-rebuild/`.

The previous Phase 2 `CONDITIONALLY READY` result was treated as a set of claims to challenge. I reran the runtime matrix under the actual Node 22 installation, used a disposable local Supabase stack, inspected the real route/service-role boundary, checked the generated-workflow provenance, and followed document bytes from every version-write path into extraction. The last check found a quarantine-boundary bypass, so the gate fails even though the broad regression suites are green.

## Repository integrity

- Active branch: `master`.
- HEAD before this audit's documentation changes: `204d2d5` (`Merge pull request #296 from Open-Legal-Products/fix/word-addin-semver-dependency`).
- `origin`: `https://github.com/sabarinath1805-loyal/Vaultr-AI.git`.
- `upstream`: `https://github.com/Open-Legal-Products/mike.git`.
- `old-vaultr-backup` exists.
- `git merge-base master old-vaultr-backup` returned no merge base; no old Vaultr history was merged into the current Mike history.
- The working tree was already dirty with Phase 1/Phase 2 source, test, dependency, schema, workflow, and documentation changes. No unrelated cleanup or reset was performed.
- `git diff --check` passed; Git reported only normal LF/CRLF conversion warnings.
- No tracked `.env`, `node_modules`, build output, coverage, dump, or log artifact was found in the repository status. No product conversion or rebranding was observed.
- The disposable Supabase stack and temporary Word E2E server were stopped after verification.

## Runtime proof

Node metadata alone was not accepted. The accepted matrix prepended the exact Node 22 directory to `PATH`, because npm command shims otherwise could resolve a different Node executable:

```powershell
$nodeDir='C:\Users\Sabarinath.SABARI\AppData\Local\nvm\v22.13.0'
$env:Path="$nodeDir;$env:Path"
npm.cmd run env --silent | Select-String 'npm_node_execpath|npm_execpath'
```

Observed:

```text
v22.13.0
10.9.2
npm_node_execpath=C:\Users\Sabarinath.SABARI\AppData\Local\nvm\v22.13.0\node.exe
```

All accepted test and build results below used this PATH control.

## Verification results

### Backend

Clean install passed with `npm.cmd ci --ignore-scripts --no-audit`.

Under Node 22:

- `npm.cmd test -- --reporter=dot`: **45 test files passed, 5 skipped; 521 tests passed, 18 skipped**.
- `npm.cmd exec -- tsc --noEmit`: passed.
- `npm.cmd run build`: passed.

The stderr observed during tests was intentional failure-path logging from tests (LLM stream, export, API-key save, and malformed-manifest cases), not an assertion failure.

### Frontend

Clean install passed with `npm.cmd ci --ignore-scripts --no-audit`.

Under Node 22:

- `npm.cmd test -- --reporter=dot`: **25 files and 236 tests passed**.
- `npm.cmd exec -- tsc --noEmit`: passed.
- `npm.cmd run lint`: passed with **0 errors and 37 warnings**.
- Production `npm.cmd run build` with non-secret placeholder Supabase/API variables: passed; Next.js 16.3.0 compiled 23 static pages.

### Word add-in

Clean install passed with `npm.cmd ci --ignore-scripts --no-audit`.

Under Node 22:

- `npm.cmd run typecheck`: passed.
- `npm.cmd run build` with non-secret HTTPS placeholder endpoints: passed and generated the production manifest.
- `npm.cmd run build:e2e`: passed.
- `PLAYWRIGHT_SKIP_WEBSERVER=1 npm.cmd run test:e2e`: **64 passed**.

The Word production build emitted asset-size warnings, including a 546 KiB taskpane, but no build failure. No obvious secret or hardcoded Mike-hosted production endpoint was found in the generated artifact review.

### Real Supabase and HTTP stack

A disposable Supabase CLI 2.108.0 stack loaded the current schema and migrations. The final Node 22 command was:

```text
npm.cmd test -- --run src/__tests__/integration/access.supabase.test.ts src/__tests__/integration/stack.supabase.test.ts src/__tests__/integration/tabularPagination.supabase.test.ts src/__tests__/integration/realAuthorization.supabase.test.ts src/__tests__/integration/oauthClaim.supabase.test.ts
```

With the test variables and the application variables both supplied in-process (`SUPABASE_TEST_*` plus `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SUPABASE_ANON_KEY`), the result was **5 files passed; 18 tests passed**. The first attempt with only `SUPABASE_TEST_*` exposed a harness reproducibility issue: the application correctly required its own `SUPABASE_URL`/`SUPABASE_SECRET_KEY` and returned three HTTP 500 responses. No source was changed to obtain the successful rerun.

The live HTTP authorization test proved owner A, shared collaborator C, and outsider B for project and child-document reads, plus shared mutation denial and outsider denial. It did not constitute the full HTTP attack matrix requested by this audit; the missing live cases are recorded as pilot findings below.

The real OAuth claim test proved concurrent same-state claims have exactly one winner, replay returns no row, and the browser role cannot call the claim RPC. Unit tests separately cover expiry, wrong state, wrong user, malformed state, and redirect/config validation.

## What I tried to break

I reviewed the central authorization policy and route helpers for project, document, version, chat, review, tabular, workflow, export, storage, and child-resource IDs. I searched for service-role queries that authorize after lookup, checked parent-resource linkage, reviewed owner/shared-read/shared-write classifications, and inspected the negative mocked suites for ID substitution and SSRF cases.

The MCP defenses still have tests for localhost, loopback, RFC1918/private and metadata addresses, IPv6 private/loopback, unsafe DNS, redirects, URL credentials, and unsafe `Host` headers. No regression was found there.

I also challenged document type/magic validation, malformed containers, resource limits, converter output validation, temporary-directory permissions, timeout/cleanup paths, scanner state mapping, production config fail-closed checks, raw LLM capture controls, OAuth replay, RLS grants, schema drift, workflow freshness, and Word build/E2E behavior.

The successful initial-upload scanner checks did not survive the alternate-version-path review. That is the decisive failure described next.

## Document security verdict

**BLOCKER — DOC-01: alternate document-version paths bypass quarantine scanning and the downstream processing boundary.**

The initial upload paths call `scanDocumentBuffer` and reject non-processable states:

- `backend/src/routes/documents.ts:1420-1428`.
- `backend/src/routes/projects.ts:1075-1085`.

However, the following owner-authorized version paths write or replace bytes without calling the scanner or setting a pending/quarantine state:

- Copy from another document: `backend/src/routes/documents.ts:470-562`, with the `document_versions` insert at `:549-562`.
- Upload a new version: `backend/src/routes/documents.ts:602-741`, with the insert at `:728-741`.
- Replace an existing version: `backend/src/routes/documents.ts:816-947`, with the in-place update at `:936-947`.

Those inserts/updates omit `processing_state` and `scan_status`. The schema defaults `document_versions.processing_state` to `ready` at `backend/schema.sql:318-329`. Therefore an unscanned new version can become the current version and appear processable by default.

The downstream boundary does not close this gap:

- `backend/src/lib/documentVersions.ts:65-100` loads the active version without selecting or enforcing processing/scan state.
- `backend/src/lib/documentVersions.ts:109-171` attaches active paths without a state filter.
- `backend/src/lib/chat/contextBuilders.ts:538-553` and `:596-617` filter document status to `ready`, but do not filter the active version's processing/scan state.
- `backend/src/lib/chat/tools/documentOps.ts:1100-1108` downloads active-version bytes directly.
- `backend/src/lib/chat/tools/documentOps.ts:1466-1501` feeds those bytes into `read_document` extraction without an `isDocumentProcessable` check.

This is not a documentation concern or a theoretical malware claim. The current source contains a reachable write path that bypasses the scanner and a reachable model/extraction path that trusts the resulting version. It matches the audit's explicit quarantine-bypass blocker example. The minimum repair for a future gate is to apply scanner state to every version create/replace/copy path and enforce processable state at every extraction, model, download, conversion, indexing, and review boundary, followed by real route tests for quarantined and unscanned versions. No repair was made in this audit.

## Authorization verdict

The central policy is coherent for the routes inspected: project rename/delete/share, document upload/rename/delete/version/edit resolution, review mutation, and tabular generation/cell mutation are owner-only; project/document/chat/review read and workflow/export/download are classified explicitly; chat creation and workflow execution allow the documented shared-write/read cases.

The narrow real stack proves the basic owner/shared/outsider project and child-document read/mutation boundary. Mocked suites cover many more branches, including project, tabular, chat, and MCP cases. Because the full requested HTTP matrix was not executed against real service-role-backed routes, this area is not a complete YES proof. No confirmed cross-user read bypass was found in the reviewed routes.

One policy ambiguity remains for pilot review: project chat accepts an existing chat ID within the project without requiring the caller to own that chat, so a shared collaborator may write into another member's chat. This was not confirmed as a data-read bypass, but the intended shared-write policy should be made explicit and tested at the live HTTP boundary.

## Real Supabase/RLS verdict

The live schema contained **29 public backend-owned tables**. Every one had `relrowsecurity = true`; every table had **zero policies**, which is intentional deny-all behavior for browser roles in this service-role architecture; browser grants were zero; service-role grants were present for the application path. The independently recreated owner/shared/outsider HTTP model passed the five selected real-stack files and 18 tests.

This supports the Phase 2 RLS claim, but it does not compensate for the application authorization and document-state boundary because the backend service client bypasses RLS.

## OAuth verdict

The atomic claim migration and real disposable database test prove one-winner concurrency, replay rejection, browser-role denial, expiry/user/state checks in the surrounding unit suite, and redirect validation. No OAuth replay defect was found. Full provider callback plus code-exchange integration remains unproven and is classified as pilot/production work, not as the current blocker.

## Dependency verdict

Fresh audits after clean installs reported:

| Package | `npm audit --omit=dev` | Full audit note |
|---|---:|---|
| Root | 0 total | clean |
| Backend | 1 moderate, 0 high | no runtime high |
| Frontend | 4 moderate, 0 high | no runtime high |
| Word add-in | 0 total | full dev-inclusive audit: 4 low, 7 moderate, 8 high, 0 critical |

The Word highs are in the Office/webpack/Playwright development toolchain according to the package graph and shipped-runtime dependency review; they remain an owner-reviewed pilot/production remediation item. No meaningful backend or frontend runtime high advisory was found.

## Schema verdict

Under Node 22, `node scripts/check-schema-drift.mjs` passed:

```text
Schema drift check passed: 52 migrations, 15 created tables, 47 final added columns.
```

The migration count and final schema were also loaded into a clean disposable database. The migration-created table count is 15; the live final backend-owned public table count is 29 because the final schema includes pre-existing plus migration-created tables. The audit-event schema and RLS migration were present and loaded. The checker was also reviewed for fail-fast behavior against its expected schema input; no worktree mutation was retained from that check.

## Workflow provenance verdict

The approved source is `https://github.com/Open-Legal-Products/mike-workflows.git`, licensed MIT, at exact commit `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`. The commit exists locally and `git ls-remote` matched the same SHA on `refs/heads/main`. `scripts/workflow-source.json` names the same repository and exact ref. Under Node 22, `node scripts/check-workflow-freshness.mjs` generated **31 system workflows** and passed freshness at that SHA.

The freshness script fails closed when the approved source directory is absent (`Workflow source directory not found`). No alternate branch or moving source was found in the inspected generation path.

## Privacy/logging verdict

Raw LLM stream capture is opt-in, production configuration rejects unsafe raw-content settings, and document debug logging in the hardened tree logs metadata/magic bytes rather than extracted excerpts. OAuth/MCP/provider paths were reviewed for token/key leakage; no real secret was included in this report. Audit metadata is structured and does not intentionally carry document contents or full credentials.

This is sufficient for continued engineering but not production certification. Retention, audit-event viewing, log rotation, signed-URL privacy policy, and hosted operational controls remain unresolved.

## Word add-in verdict

The Node 22 typecheck, production build/manifest generation, E2E build, and all **64 Playwright tests** passed. HTTPS placeholder production endpoints were used; no accidental Mike production endpoint or obvious secret was found in the reviewed output. OfficeRuntime token handling remained present. Remaining Word dependency advisories are development-tooling risk and do not currently block foundation conversion independently.

## Other verification areas

- Converter boundary: private temporary directory, non-root Docker expectation, timeout, output-size limit, PDF magic validation, cleanup in `finally`, and child-process termination logic are present. Production-style container/network/resource execution was not independently proven.
- Failure cleanup: unit/contract tests cover storage, conversion, extraction, timeout, invalid output, oversize output, scanning, and retry state behavior; full production storage and scanner failure exercises remain unproven.
- Backup/restore: the Phase 2 isolated dump/restore evidence recorded a 430,329-byte archive, 878 TOC entries, SHA-256 `05250E4B5FD03491E183245C9556877376B28E03DC4AD1B7566F3AC11B514FCB`, and successful restore into a fresh disposable database. Hosted backup retention/R2 restore is not certified here.
- Production configuration: required Supabase URLs/secrets, signing/encryption secrets, raw logging, placeholder/demo values, and unsafe callback/localhost values are validated in code and tests. Hosted startup-path proof remains deployment work.
- Infrastructure: hosted Supabase/Auth, object storage, provider accounts, MCP/CourtListener, Microsoft identity/certificates, domains/DNS/email, monitoring, signing keys, and encryption-key ownership require manual cutover or remain unknown. No hidden upstream production coupling was found that makes local foundation development unsafe.

## Conclusion

The broad runtime, schema, workflow, RLS, OAuth, dependency, and Word results are strong, but the confirmed document-version quarantine bypass is a BLOCKER under the requested gate rules. The foundation is not safe enough to freeze as the Vaultr conversion base.
