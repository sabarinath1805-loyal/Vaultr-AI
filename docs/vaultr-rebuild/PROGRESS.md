# Vaultr-AI Rebuild Audit Progress

Last updated: 2026-08-11

## Gate status

| Gate | Status | Evidence |
|---|---|---|
| Gate 1 baseline/security/license audit | Complete | `BASELINE.md`, `AUDIT.md`, `SECURITY_BASELINE.md`, `LICENSE_BASELINE.md` |
| Gate 2 authorization/dependency/test/schema/privacy audit | Conditional GO | `GATE_2_DECISION.md` and the Gate 2 evidence documents in this directory |
| Gate 3 hardening/closure | Not started | Blocked on the conditions below |

## Completed in Gate 2

- Read and reconciled all Gate 1 documents before new audit work.
- Built the endpoint authorization matrix and identified service-role/RLS assumptions.
- Ran the full backend suite: 495 passed, 14 skipped; 36 files passed, 3 skipped.
- Ran scoped authorization/security suites: 102 passed.
- Ran the full frontend suite: 236 passed; corrected the jsdom Blob fixture in a test-only change.
- Re-ran backend build, frontend typecheck, and frontend lint.
- Re-ran dependency audits and classified runtime-reachable risk.
- Audited the Node/Docker/Supabase/LibreOffice/workflow-generator environment.
- Compared `backend/schema.sql` with the 48 migrations and documented migration-only objects.
- Audited document ingestion, LLM/MCP boundaries, privacy/logging, historical Vaultr parity, and enterprise gaps.

## Gate 2 code change

Only `frontend/src/app/lib/mikeApi.test.ts` changed: test fixtures now return Node's standards-compliant Blob so exact byte-content assertions work under jsdom. No application behavior, schema, branding, or feature code was changed.

## Hardening Phase 1 code change

- Added Node 22 runtime contracts, schema-drift checking, workflow-source pin enforcement, upload/container/resource limits, conversion cleanup/timeouts, signed-download expiry, OAuth state validation, owner-only mutation gates, privacy-safe raw-stream capture, and the additive audit-event foundation.
- Added provider governance, infrastructure ownership, Supabase migration readiness, audit-event, and final hardening-result records. Product conversion, branding changes, and old-branch merges remain out of scope.

## Blocking conditions

- Service-role authorization requires a complete shared-write policy and real-stack negative tests.
- Backend/frontend high dependency advisories remain.
- Local Node 22 + Docker/Supabase/LibreOffice runtime is unavailable.
- Schema snapshot/migration/generator provenance is not yet one fail-fast reproducible source.
- Parser resource isolation and privacy logging/retention controls are incomplete.

## Next Gate 3 entry criteria

Use `GATE_2_DECISION.md` as the authoritative exit list. Do not begin historical Vaultr parity implementation until authorization, schema, dependency, and provenance conditions are closed.

## Hardening Phase 1 status

- Node 22 and cross-platform Word E2E contracts are implemented; Windows Word E2E build passes.
- Authorization/linkage, signed-download expiry, OAuth state contracts, schema drift, upload/container validation, document resource limits, conversion timeout/cleanup, logging privacy, and audit foundation controls are implemented and tested at unit/integration level.
- Provider governance, infrastructure ownership, and Supabase migration-readiness records are added.
- Remaining blockers are real-stack execution, LibreOffice/malware/quarantine deployment validation, exact workflow-source pinning, unresolved dependency advisories, and final Word add-in identity/ownership cutover.

## Hardening Phase 2 status

Date: 2026-08-10. This section supersedes the Phase 1 “not available” observations where the current host now has direct evidence.

### Completed and verified

- Node `v22.13.0` / npm `10.9.2` executed the backend real-stack suites and source/build gates.
- A disposable Supabase CLI `v2.108.0` stack ran locally; canonical schema plus 52 migrations loaded successfully.
- Real Supabase auth/RLS/access suites passed 14/14; real Express HTTP owner/shared/outsider tests passed 3/3.
- Atomic OAuth claim proof passed under two concurrent claims: one winner, replay empty, browser role denied.
- Explicit project/workflow authorization policy and owner-only/shared-read/shared-write classifications were added.
- Production-fail-closed scanner boundary, quarantine states, conversion validation, recovery state machine, and configuration validation were added.
- Workflow source is pinned to `Open-Legal-Products/mike-workflows` commit `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`; 31 generated workflows were refreshed and freshness passes.
- Non-breaking lockfile remediation reduced backend advisories to 0 high/1 moderate/1 low and frontend to 0 high/4 moderate/0 low. Root is clean.

### Partially verified

- Frontend/Word final production artifact inspection is complete; final backend rerun and gate-document consolidation are still in the closing gate.
- Local PostgreSQL dump/archive inspection is available; isolated restore and hosted backup/R2 restore are evidence requirements, not hosted sign-off.
- Scanner and converter interfaces are tested as contracts; no production scanner binary or container sidecar was exercised.

### Blocked or production-only

- Word identity/certificate/tenant ownership, hosted Supabase, R2, DNS/email/provider ownership, and deployment secret rotation were not changed.
- Word dev-tool dependency advisories remain (8 high, 7 moderate, 4 low); remediation needs owner-approved major upgrades.
- Audit retention/legal hold, hosted backup retention, scanner vendor selection, and conversion-worker wiring require deployment owners.

### Intentionally deferred

- Mike-to-Vaultr conversion, branding/UI changes, old-branch merges, upstream changes, commits, PRs, and history rewrites.

## Final Hardened Base Verification Audit

Date: 2026-08-10. Final gate verdict: **BASE READY FOR VAULTR CONVERSION: NO**.

The final read-only audit independently confirmed the actual Node `v22.13.0` / npm `10.9.2` runtime, green backend/frontend/Word regression suites, 64 Word E2E tests, the disposable real Supabase/RLS inventory, atomic OAuth claim behavior, schema drift, workflow provenance/freshness, and current dependency counts. The real stack was stopped after verification.

The gate is blocked by `DOC-01`: document version copy, upload, and replacement routes bypass `scanDocumentBuffer`; `document_versions.processing_state` defaults to `ready`; and active-version extraction/model context does not enforce scan state. This permits an unscanned version to reach model extraction. No source or test fix was attempted.

See `FINAL_VERIFICATION_AUDIT.md`, `FINAL_VERIFICATION_FINDINGS.md`, and `BASELINE_FREEZE.md` for exact commands, counts, evidence, severity classification, and the minimum repair/re-verification requirements. Vaultr conversion, the hardened baseline commit, and `vaultr-hardened-base-v1` remain intentionally unstarted.

## DOC-01 remediation

Date: 2026-08-11. Status: **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**.

The document-version scan/quarantine blocker was fixed without beginning Vaultr conversion. All discovered version creation/replacement paths now start untrusted, scan exact bytes before promotion, and update active pointers only after promotion. A centralized fail-closed trust helper gates active-version resolution, chat/model context, extraction, Tabular Review, replication, and conversion-related reads. The database default is now `pending_scan` through an additive migration.

Evidence: focused Node 22 tests **115/115 passed**; full backend **540 passed, 18 skipped across 46 passed files and 5 skipped files**; typecheck/build passed; schema drift passed across **53 migrations**; opt-in real-stack DOC-01 test **3/3 passed**; existing real-stack suite **18/18 passed**. See `DOC_01_REMEDIATION.md` for the complete creation-path trace and independent rerun requirements.

The previous final verification verdict remains NO until an independent Final Hardened Base Verification Audit rerun is completed. No commit, tag, push, or Vaultr product conversion was performed.

## Final Base Re-Verification & Freeze

Date: 2026-08-11. Verdict: **BASE READY FOR VAULTR CONVERSION: NO**.

The final independent re-verification is recorded in `FINAL_REVERIFICATION_AUDIT.md` and `FINAL_REVERIFICATION_FINDINGS.md`. Node 22 backend, frontend, Word, schema, workflow, dependency, and disposable real-Supabase checks were rerun. The real stack passed 6 files / 21 tests and confirmed 29/29 public tables have RLS enabled.

DOC-01 is **BLOCKER REOPENED** for two missed production paths:

- `backend/src/routes/documents.ts:1236-1412` (`handleEditResolution`) overwrites trusted storage bytes after tracked-change resolution without resetting to `pending_scan` or scanning the output.
- Persisted `tabular_cells` are returned to AI tooling without source-version binding, invalidation, or a source trust recheck, allowing cached derived content to survive a source quarantine/failure state.

No source fix, commit, tag, push, freeze, or Vaultr conversion was performed. Next work is limited to remediating these blockers, adding adversarial regression coverage, and independently rerunning the gate.

## DOC-01 Final Blocker Remediation Round 2

Date: 2026-08-11. Scope remained limited to the two DOC-01 findings from the final re-verification.

- DOC-01-A: **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**. `handleEditResolution` now uses a new immutable version, exact-byte scanning, pending-before-trust promotion, and an optimistic active-pointer update. The old trusted version remains active until the new version is ready; scan/storage/database/pointer failures fail closed. The only other in-place path found, turn-scoped `runEditDocument` reuse, invalidates processing state and hash before replacement and fails closed on upload/finalization errors.
- DOC-01-B: **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**. Tabular cells now persist exact `source_document_version_ids`; reads and model boundaries revalidate the source set against current version pointers and trusted processing states. Legacy cells are unverified, active-version changes make old results stale, and quarantined/failed/pending/unknown sources are blocked.
- Added `20260811_02_tabular_cell_source_versions.sql` and the canonical schema column/Gin index; schema drift passed with **54 migrations**.
- Focused Round 2 tests passed: provenance/tabular/security set **6 files / 103 tests**, edit-resolution route **1 file / 3 tests**, and overlapping provenance/tabular set **2 files / 43 tests**.
- Full backend regression passed **48 files, 553 tests, 7 skipped files, 24 skipped tests**; backend typecheck/build passed. Frontend tests passed **25 files / 236 tests** through the dependency-local Vitest entrypoint; its local typecheck install lacks Next declaration files and was not counted green. The disposable real stack passed **7 files / 24 tests**.
- No commit, tag, push, PR, Vaultr conversion, or final-gate rerun was performed. The final base verdict remains **BASE READY FOR VAULTR CONVERSION: NO** pending independent re-verification.

## Final Hardened Base Re-Verification After DOC-01 Round 2

Date: 2026-08-11. Independent final gate verdict: **BASE READY FOR VAULTR CONVERSION: NO**.

This audit independently reran the claimed Round 2 closure under Node `v22.13.0` / npm `10.9.2`. The broad regression baseline is green: backend **48 files / 553 tests passed / 7 files and 24 tests skipped**, frontend **25 files / 236 tests passed** with typecheck and build passing, Word typecheck/build/manifest passing with **64/64 Playwright tests**, production dependency audits at backend **1 moderate**, frontend **4 moderate**, Word **0**, and the disposable real Supabase matrix at **7 files / 24 tests passed**. The workflow checkout matched the approved SHA `4b9c7cd0d93b6254780abcc2cc382be6b56cd945` and freshness regenerated **31 workflows** byte-for-byte. Live schema inspection confirmed **29/29 RLS-enabled public tables** and **0 browser-role grant rows**.

The independent gate remains NO for findings recorded in `FINAL_BASE_FINDINGS.md` and `FINAL_BASE_VERIFICATION.md`:

- raw caller-supplied Tabular chat history reaches `runLLMStream` after current-cell provenance filtering, so stale derived content can reach trusted model context;
- the required clean migration-chain proof fails on an empty database and also fails when all dated migrations are applied after the current canonical snapshot (`20260424_01_docx_version_display_name.sql` references the removed `documents.filename` column);
- `/user/export` returns raw account-export Tabular cells without `provenance_status`;
- `runEditDocument({ reuseVersion })` and several other pointer-changing paths do not use an expected-current compare-and-swap, so simultaneous promotions can lose activation or regress the current pointer.

The Round 2 resolution path itself passed its focused and real-stack lifecycle checks, and the reuse path does invalidate trust before same-key mutation. Those positive controls do not close the model-history, export, migration, or promotion-race findings. No source/test/dependency/schema/RLS/authorization fix was made. No commit, tag, push, or Vaultr conversion was started.

## Overnight Foundation Completion Mission — Stage A

Date: 2026-08-11.

Stage A implemented the four remaining conversion blockers and stopped before
the independent verification boundary:

- **B-01 — Tabular chat replay:** added server-owned history loading and
  versioned provenance for derived assistant output. Caller-supplied assistant
  objects and provenance claims are not trusted. Invalid source state becomes
  a neutral regeneration marker rather than model context.
- **B-02 — schema bootstrap:** added an explicit canonical snapshot baseline,
  checksum ledger, empty-target guard, post-baseline migration rule, and
  actual SQL verification for tables, RLS, grants, provenance, audit, and
  OAuth structures.
- **B-03 — active pointer CAS:** centralized trusted candidate validation and
  expected-current compare-and-swap promotion, then migrated the runtime
  upload/copy/edit/replication promotion paths.
- **B-04 — account export:** added per-cell provenance classification and
  redaction of foreign/inaccessible source metadata while preserving owned
  historical portability data.

Stage A evidence:

- Focused blocker tests: Tabular history **11**, Tabular route **36**,
  promotion **7**, export **1**, edit-resolution **3**; all passed.
- Backend full regression: **51 files passed, 8 skipped; 573 tests passed,
  27 skipped**; build/typecheck passed.
- Frontend: **25 files / 236 tests passed**, direct TypeScript check passed,
  lint **0 errors / 37 warnings**, production build passed.
- Word: typecheck and production manifest build passed; **64/64 Playwright**
  tests passed.
- Real Supabase: **8 files / 27 tests passed**, including the new hardening
  boundary suite.
- Schema: two empty disposable bootstrap runs passed; populated-target repeat
  failed closed; verification **29/29 RLS, 0 browser grants, 1 ledger row**;
  drift **55 migrations / 15 created tables / 49 final columns**.
- Workflow freshness passed from the exact approved SHA
  `4b9c7cd0d93b6254780abcc2cc382be6b56cd945` with **31 generated workflows**.
- Production audits: backend **1 moderate**, frontend **4 moderate**, Word
  **0**, with no runtime High advisories.

All four blockers are now marked **REMEDIATED — PENDING STAGE B
VERIFICATION** in `FINAL_BLOCKER_REMEDIATION.md`. Source modifications stop at
this boundary. Stage B is verification-only; any newly found blocker must be
documented without a Stage B source fix and must keep the final verdict NO.

## Overnight Foundation Completion Mission - Stage B final result

Date: 2026-08-12. The independent verification stage is complete. Source
changes stopped at the Stage A boundary and were not modified in response to
the Stage B result.

- B-01: independently closed. Server-owned chat history and fail-closed
  derived provenance survived the live stale/pending/failed/quarantined/
  deleted/missing/malformed/outsider state matrix.
- B-02: independently closed for the documented canonical bootstrap. Two
  fresh databases passed bootstrap, ledger, drift, RLS, and grant checks; a
  populated-target repeat failed closed.
- B-03: independently closed for the active-pointer CAS boundary. The live
  simultaneous promotion attack produced one winner and one explicit conflict.
- B-04: **BLOCKER remains**. A foreign trusted source injected into an owned
  account export had content and source metadata redacted, but its serialized
  status remained `trusted` instead of `unverified`.

Final evidence includes clean lockfile installs, backend 51/8 and 573/27
regression counts, frontend 25/236, Word 64/64, two fresh schema bootstraps,
29/29 RLS and 0 browser grants, the 8-file/27-test real-stack matrix, the
approved 31-workflow SHA, and the recorded dependency/secret/privacy scans.

Final status: **BASE READY FOR VAULTR CONVERSION: NO**. No source or
documentation freeze commit, tag, or push was created. The next permitted
work is the B-04 status override plus its regression test and a fresh full
gate rerun.

## B-04 Final Remediation Mission - Stage A complete

Date: 2026-08-12. The confirmed account-export labeling defect is fixed. The
final serializer now enforces exporter-scoped provenance: foreign,
inaccessible, missing, malformed, unresolved, wrong-document, duplicate, or
mixed invalid source sets are labelled `unverified`; inaccessible content,
source IDs, and foreign version rows remain absent.

Stage A verification passed:

- B-04 serialized unit matrix: **2 tests**.
- Real hardening/account-export/HTTP route suite: **4 tests**.
- Real owner/shared/outsider authorization: **3 tests**.
- Backend: **51 files passed, 8 skipped; 574 tests passed, 28 skipped**;
  typecheck/build passed.
- Frontend: **25 files / 236 tests passed**; typecheck/build passed; lint **0
  errors / 37 warnings**.
- Word: typecheck/build/HTTPS manifest and **64/64** Playwright passed.
- Schema: two fresh canonical bootstrap/verifier/drift runs passed and a
  populated-target repeat failed closed.

**STAGE A COMPLETE - SOURCE FROZEN FOR FINAL AUDIT**

From this boundary onward, Stage B is verification-only. Product source must
not be modified in response to any finding; a blocker must be documented and
the final verdict must remain NO.

## B-04 final remediation mission — Stage B complete

Date: 2026-08-12. The independent Stage B audit ran after the source-freeze
declaration with Node **v22.13.0** / npm **10.9.2**. B-04 is now independently
closed: the real disposable-stack export attack and `GET /user/export` route
both returned exporter-scoped `unverified` labels for affected provenance and
redacted foreign content, IDs, version rows, and sentinels.

The final live Supabase matrix passed **8 files / 28 tests**. Two independent
canonical bootstrap runs passed 29/29 RLS, 0 browser grants, ledger and drift;
the populated-target repeat failed closed. Backend full regression/build,
Tabular provider-facing reattack, targeted OAuth/SSRF/privacy/authorization
tests, workflow freshness, dependency audit, frontend, and Word evidence are
recorded in the final verification document.

Stage B nevertheless found **B-05 / DOC-01-C**, a BLOCKER/P1 reuse-path
data-integrity failure. A losing concurrent `runEditDocument({ reuseVersion })`
request receives the correct pointer conflict only after it has already
overwritten and re-trusted the historical row/object it reused. The required
minimum remediation is documented in `FINAL_BASE_FINDINGS.md` and
`FINAL_BLOCKER_REMEDIATION.md`.

Final status: **BASE READY FOR VAULTR CONVERSION: NO**. No product source
changes were made after the freeze declaration. No commit, tag, or push was
created. Vaultr v2 product conversion must not begin.

## B-05 / DOC-01-C remediation - Stage A complete pending independent audit

Date: 2026-08-12. The reuse-path integrity blocker was addressed by making all
edits immutable: every edit creates a new row and object, while `reuseVersion`
is only a stale-turn/current-pointer precondition. The original historical
row/object/hash/trust state is not mutated, and candidate artifacts are
cleaned up on failed promotion and other failure paths.

The real persisted reuse suite passed **3/3** on one fresh stack. The full real
matrix passed **9 files / 31 tests** on a second fresh stack, including the
prior B-01 through B-04 and DOC-01 coverage. Node 22 backend regression/build,
frontend tests/typecheck/lint/build, Word typecheck/build/manifest/Playwright,
and two canonical schema stacks passed as recorded in the final verification
documents. Current ordinary regression counts are backend **51 files / 574
tests** passed with **9 files / 31 tests** skipped, frontend **25/236**, and
Word **64/64**.

The exact Stage A source-freeze declaration and independent Stage B audit are
still required. No final baseline freeze or Vaultr conversion is authorized.

## B-05 remediation round - final Stage B and baseline-freeze decision

Date: 2026-08-12 (Asia/Singapore). After the exact frozen-source declaration,
an independent compiled-path audit passed sequential reuse, stale reuse, and
the persisted concurrent reuse race. Exactly one candidate won, the loser
returned an explicit failure, the original row/object/hash/trust state stayed
unchanged, and the winner was ready, active, and hash-matched. A separate real
concurrent B-03 CAS attack also produced one winner and one explicit conflict
without changing the loser's trust state.

Stage B evidence is complete:

- fresh real Supabase matrix: **9 files / 31 tests passed**, including the
  cross-tenant B-04 export route and all DOC-01 lifecycle paths;
- current B-01 provider-facing reattack: **55/55**; focused security/OAuth/
  SSRF/privacy/authorization/conversion set: **69/69**;
- two independent canonical schema stacks: bootstrap, ledger, drift, 29/29
  RLS, zero browser grants, and populated-target fail-closed rerun passed;
- Node **v22.13.0** / npm **10.9.2** backend **51/574** plus build, frontend
  **25/236** plus typecheck/lint/build, and Word **64/64** plus typecheck/build/
  HTTPS manifest;
- workflow provenance positive at the approved 31-workflow SHA, missing and
  wrong-SHA checks negative as required; dependency audits root 0, backend 1
  moderate, frontend 4 moderate, Word 0, with no high/critical issue;
- current source-scoped Gitleaks clean, one redacted historical generic-key
  match only, `git diff --check` clean, and disposable infrastructure stopped.

DOC-01's frozen mutation inventory found no trusted version/hash/object
mismatch. The B-05 reuse mutation is gone; all run-edit candidates use new
rows and objects. The owner replacement path remains an intentional explicit
destructive operation but uses a fresh object key and untrusted-before-ready
state, and did not overwrite an object in place or fail the trust invariant.

Final status for this round: **BASE READY FOR VAULTR CONVERSION: YES**.
Stage C is limited to the requested hardened-base commit/tag/push to `origin`.
Vaultr v2 conversion and all branding, UI, hosting, and domain work remain
prohibited.
