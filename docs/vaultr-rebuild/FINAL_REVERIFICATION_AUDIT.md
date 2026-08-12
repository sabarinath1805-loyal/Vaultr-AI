# Vaultr-AI Final Base Re-Verification Audit

Date: 2026-08-11<br>
Verdict: **BASE READY FOR VAULTR CONVERSION: NO**

This is the independent final read-only re-verification after the DOC-01 remediation attempt. No source, test, dependency, authorization, RLS, OAuth, UI, infrastructure, or product-conversion changes were made during this audit. Only verification documentation is being updated.

## Repository state

- Branch: `master`.
- Pre-audit HEAD: `204d2d533a075c74fc69f8b283c70fb4e94ec104`.
- `origin`: `https://github.com/sabarinath1805-loyal/Vaultr-AI.git`.
- `upstream`: `https://github.com/Open-Legal-Products/mike.git`.
- `old-vaultr-backup`: present as a separate local branch and not an ancestor of current `master`.
- Working tree: dirty with the accumulated Phase 1, Phase 2, DOC-01, and audit evidence changes; no freeze commit, tag, or push exists.
- Environment: Windows 10 Pro 64-bit, PowerShell, Docker available.
- Current `master` remains Mike-derived; no mass old-Vaultr merge, rebrand, or Vaultr product conversion was found.

`git diff --check` returned no content errors; Git reported normal LF/CRLF conversion warnings for existing working-tree files.

## Node 22 baseline

All accepted test/build commands used the Node 22 directory prepended to `PATH`:

- Node: `v22.13.0`.
- npm: `10.9.2`.

The default shell Node 24 installation was not accepted as verification evidence.

## DOC-01 adversarial result

### Schema default

- Repository schema drift passed with **53 migrations**, **15 created tables**, and **47 final added columns**.
- Live database inspection found **29 public tables**, all **29 RLS-enabled**, **0 tables without RLS**, **0 browser-role grant rows**, and `service_role` with `rolbypassrls=true`.
- Live `document_versions.processing_state` default: `'pending_scan'::text`.
- Live insertion without `processing_state` produced `pending_scan` in the DOC-01 HTTP test.
- `processing_state` is `NOT NULL`; the check constraint rejects synthetic `unknown` values.

### Trust states

`documentVersionSecurity.ts` accepts only `clean` and `ready`. Unit tests reject `uploaded`, `pending_scan`, `processing`, `failed`, `quarantined`, missing, and unknown states. `clean` is retained for historical scanner-complete rows; new successful paths promote to `ready` after scanning.

### Reverification findings

The claimed closure is **not independently proven**. Two production bypasses remain:

1. `backend/src/routes/documents.ts:1236-1412`, `handleEditResolution`, resolves a trusted current version, transforms tracked-change bytes, and overwrites the same storage key. It clears and recomputes `content_sha256`, but never resets `processing_state` to `pending_scan` and never scans the newly produced bytes. This creates the prohibited state **new unscanned bytes + old trusted state**.
2. `backend/src/routes/tabular.ts:1606-1620` loads persisted `tabular_cells`, and `backend/src/lib/chat/tools/toolDispatcher.ts:810-858` returns their summaries/reasoning to the model through `read_table_cells`. `tabular_cells` has no source-version ID/hash and no state revalidation. After a source version becomes `pending_scan`, `quarantined`, or `failed`, previously derived cell content remains model-readable.

These are BLOCKER findings under the requested gate. No fixes were made.

## Runtime and regression results

| Area | Result |
|---|---|
| Backend tests | **46 files passed, 6 skipped; 540 passed, 21 skipped** |
| Backend typecheck/build | Passed under Node 22 |
| Frontend tests | **25 files; 236 passed** |
| Frontend typecheck | Passed |
| Frontend lint | 0 errors, 37 warnings |
| Frontend production build | Passed with synthetic non-secret build variables; missing variables fail fast as designed |
| Word typecheck | Passed |
| Word production build/manifest | Passed with synthetic non-secret variables; HTTPS manifest guard passed |
| Word Playwright E2E | **64 passed** |
| MCP security suite | **2 files; 12 passed** |
| Document/input/conversion/recovery suite | **6 files; 52 passed** |
| Config/audit/auth/privacy suite | **5 files; 22 passed** |
| Lockfile validation | `npm ci --ignore-scripts --no-audit --dry-run` passed for backend, frontend, and Word; full concurrent install exceeded the tool timeout and is not counted as a completed clean-install proof |

## Real Supabase/RLS and tenant evidence

The disposable local Supabase stack was started and stopped after verification. The strongest available matrix passed **6 files / 21 tests**, including:

- Supabase auth/RLS deny-all behavior.
- Owner/shared/outsider project and child-document reads.
- Owner-only project mutation.
- Atomic OAuth state claim and browser-role rejection.
- DOC-01 direct upload, copy, replacement, pending default, and pending-active refusal.
- Tabular pagination/access checks.

The live tenant matrix remains narrower than the requested full attack matrix; it does not independently cover every document-version mutation, download/export, chat, workflow, review, row/cell, ID-substitution, and revoked-share case.

## Dependencies, workflow provenance, and secrets

Fresh `npm audit --omit=dev` results:

- Backend: 0 high, 1 moderate, 0 low.
- Frontend: 0 high, 4 moderate, 0 low.
- Word production dependencies: 0 vulnerabilities.
- Word full development tree: 8 high, 7 moderate, 4 low.

Schema drift passed. The workflow source is pinned to `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`; using a disposable checkout of that exact source, freshness passed and generated **31 workflows**. The repository-default freshness command fails when the configured sibling `..\\mike-workflows` directory is absent, so the source checkout remains an external reproducibility prerequisite.

Gitleaks found no current source-tree secret in the reviewed application paths. It reported generated frontend build-cache false positives and one historical generic API-key match in an old commit (`serperApiKey`); the value is not reproduced here and is not present in the current source tree. Secret validity/rotation remains an owner task.

## Freeze decision

**BASE READY FOR VAULTR CONVERSION: NO**

The hardened baseline must not be committed, tagged, pushed, or used as the start point for Vaultr v2 conversion. The minimum remediation is to close both DOC-01 bypasses, add regression coverage for tracked-change replacement and derived Tabular Review invalidation/version binding, then rerun this audit independently.
