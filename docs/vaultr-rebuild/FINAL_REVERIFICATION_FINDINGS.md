# Vaultr-AI Final Re-Verification Findings

Date: 2026-08-11<br>
Gate verdict: **BASE READY FOR VAULTR CONVERSION: NO**

This document records the current independent final-gate findings. Earlier audit and remediation records remain historical evidence and are not deleted or rewritten.

## BLOCKER

### DOC-01-A - Tracked-change resolution overwrites trusted bytes without rescanning

**Status:** BLOCKER - remediation closure reopened.

Evidence: `backend/src/routes/documents.ts:1236-1412`, function `handleEditResolution`, resolves a trusted active version, produces resolved tracked-change bytes, clears and recomputes `content_sha256`, and uploads those bytes at approximately lines 1396-1411. The path does not set `processing_state` to `pending_scan` and does not scan the resolved bytes.

An attacker or ordinary edit flow can therefore leave a version marked `ready` or `clean` while its storage key contains newly produced, unscanned bytes. Concurrent active-version consumers can treat those bytes as trusted and pass them to extraction or model context. This is the prohibited **new unscanned bytes plus old trusted state** race.

Minimum remediation scope: route tracked-change accept/reject output through the same exact-byte scan, untrusted-state transition, promotion, and pointer/storage consistency boundary as every other version replacement. Add a regression test that interleaves trusted reads with the replacement transition.

### DOC-01-B - Persisted Tabular Review cells are not version-bound or invalidated

**Status:** BLOCKER - cached derived-content bypass.

Evidence: `backend/src/routes/tabular.ts:1606-1620` loads persisted `tabular_cells` for review; `backend/src/lib/chat/tools/toolDispatcher.ts:810-858` exposes `cell.summary`, `cell.flag`, and `cell.reasoning` through `read_table_cells`. The `tabular_cells` schema in `backend/schema.sql:823-834` and `tabular_review_row_sources` in `backend/schema.sql:810-820` do not retain a source-version ID/hash or enforce source trust on read.

If a source version that was once trusted later becomes `pending_scan`, `quarantined`, or `failed`, previously derived cell content remains readable by the AI path. The active-version byte gate does not invalidate or revalidate this persisted derived content.

Minimum remediation scope: bind derived rows/cells to the exact source version or content hash, invalidate or quarantine derived content on source-state changes, and re-check source trust before returning cells to model/tool consumers. Add regression coverage for state transitions after review extraction.

## MUST FIX BEFORE PILOT

- **TEST-01:** the real HTTP harness requires both `SUPABASE_TEST_*` and application `SUPABASE_URL`/`SUPABASE_SECRET_KEY` variables; the incomplete environment produced HTTP 500s before the corrected run.
- **TEST-02:** the live authorization matrix is narrower than the requested full attack matrix. Missing independent live cases include the complete version/download/export/chat/review/cell/workflow mutation surface, cross-resource ID substitution, and revoked-share behavior.
- **OAUTH-01:** atomic OAuth state claim and validation are proven, but a provider sandbox callback and code exchange were not run live.
- **AUDIT-01:** audit-event coverage is incomplete for some workflow, chat, Tabular Review, and project mutation/export paths; metadata must remain content- and credential-free.
- **AUTH-SEM-01:** shared-project chat write semantics need an explicit policy decision and live assertion.
- **Workflow source prerequisite:** default freshness fails when the configured sibling `..\\mike-workflows` checkout is absent. Freshness passed only after materializing the exact pinned source checkout in a disposable directory.
- **Clean-install proof:** backend, frontend, and Word `npm ci --dry-run` checks passed; the full concurrent install exceeded the available tool timeout and is not counted as completed clean-install evidence.
- **Historical secret ownership:** gitleaks reported one historical generic API-key match in an old commit. The current source contains no matching `serperApiKey`; owner validation and rotation remain required.

## MUST FIX BEFORE PRODUCTION

- Scanner/converter production binaries, isolation, network policy, quotas, and worker wiring remain deployment evidence gaps.
- Word development-tree advisories remain: 8 high, 7 moderate, and 4 low.
- Hosted retention, audit observability, backups/restore, object-storage recovery, domain/identity ownership, monitoring, and signing/encryption-key operations remain deployment-owner work.

## DEFERRED

- Vaultr product conversion, branding, UI changes, and historical branch parity.
- SSO/SCIM, enterprise administration, legal hold, SOC 2/ISO work, and other product expansion.

## Gate effect

The final gate is **NO**. The hardened foundation must not be committed, tagged, pushed, or used as the starting point for Vaultr v2 conversion. No source, test, dependency, schema, authorization, RLS, OAuth, or product fix was made during this re-verification.

## Round 2 remediation status (2026-08-11)

This section records the subsequent narrow implementation response; it is not an independent re-verification and does not alter the gate verdict above.

### DOC-01-A

**REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**

`handleEditResolution` now creates a new version for resolved tracked-edit bytes, scans the exact candidate before trusted promotion, starts the row untrusted, and changes the active pointer only after promotion with an optimistic compare-and-set. The prior trusted version remains unchanged while this occurs. The separate turn-scoped in-place reuse path invalidates state and clears the hash before replacement and marks failures untrusted/failed.

### DOC-01-B

**REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**

`tabular_cells.source_document_version_ids` records the exact source-version set. Review reads, generation/regeneration, Tabular chat/model reads, and exports now validate that set against the expected source documents, current pointers, deletion state, and trusted processing state. Legacy/malformed/missing provenance is unverified; old-version cells become stale after an active-version change or source quarantine/failure.

Round 2 evidence is recorded in `DOC_01_REMEDIATION_ROUND_2.md`: focused route/provenance regressions passed, the full backend suite passed **553 tests with 24 skipped**, schema drift passed at **54 migrations**, and the disposable real stack passed **7 files / 24 tests**. The required next action remains an independent/adversarial Final Hardened Base Verification Audit. Until that happens, the final base verdict remains **BASE READY FOR VAULTR CONVERSION: NO**.
