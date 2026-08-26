# Hardened Baseline Freeze Record

Date: 2026-08-10<br>
Freeze status: **NOT FROZEN — final verification verdict remains NO pending DOC-01 re-verification**

This file records the attempted final baseline gate. It is not an authorization to begin Mike-to-Vaultr conversion and it does not represent a Git freeze.

## Repository identity before verification documentation

- Branch: `master`.
- HEAD before the verification documentation: `204d2d5`.
- Origin: `https://github.com/sabarinath1805-loyal/Vaultr-AI.git`.
- Upstream: `https://github.com/Open-Legal-Products/mike.git`.
- `old-vaultr-backup`: exists; no merge base with `master`.
- Working tree: dirty from pre-existing Hardening Phase 1/Phase 2 changes plus the verification documents recorded by this gate. No source or configuration changes were made by the final audit.

Because the verdict is NO, no baseline commit was created, no baseline SHA exists, and no `vaultr-hardened-base-v1` tag was created.

## Runtime baseline

Accepted verification commands prepended:

```powershell
$nodeDir='C:\Users\Sabarinath.SABARI\AppData\Local\nvm\v22.13.0'
$env:Path="$nodeDir;$env:Path"
```

Observed Node: `v22.13.0`<br>
Observed npm: `10.9.2`<br>
OS/environment: Windows PowerShell on the local development host; disposable Docker/Supabase CLI stack used for live checks.

## Regression evidence

| Area | Result |
|---|---|
| Backend clean install | Passed: `npm ci --ignore-scripts --no-audit` |
| Backend tests | 45 files passed, 5 skipped; 521 tests passed, 18 skipped |
| Backend typecheck/build | Passed |
| Frontend clean install | Passed |
| Frontend tests | 25 files; 236 tests passed |
| Frontend typecheck/lint/build | Passed; 0 lint errors, 37 warnings |
| Word clean install | Passed |
| Word typecheck/build/build:e2e | Passed |
| Word Playwright | 64 passed |
| Real Supabase selected stack | 5 files; 18 tests passed |
| Live RLS inventory | 29/29 tables RLS-enabled; 0 browser-grant rows |
| Schema drift | Passed: 52 migrations, 15 created tables, 47 final added columns |
| Workflow freshness | Passed; 31 generated workflows |

The real-stack command had to provide both `SUPABASE_TEST_*` and the app's `SUPABASE_URL`/`SUPABASE_SECRET_KEY` variables. The initial incomplete environment produced three HTTP 500s; the corrected in-process environment produced the accepted 18/18 result. No source was changed between these runs.

## Provenance and dependency records

- Approved workflow source: `https://github.com/Open-Legal-Products/mike-workflows.git`.
- Approved workflow source SHA: `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`.
- License observed in the source clone: MIT.
- Fresh production audits: root 0; backend 1 moderate/0 high; frontend 4 moderate/0 high; Word production-only 0.
- Word full dev-inclusive audit: 4 low, 7 moderate, 8 high, 0 critical.

## Remediation status

`DOC-01` is **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**. The document version copy, upload, replacement, project-copy, generated-file, edit, and replication paths now initialize `pending_scan`, scan exact bytes, and promote to `ready` before active-pointer updates. `document_versions.processing_state` defaults to `pending_scan`; active-version extraction and chat context fail closed for untrusted or unknown states.

The next attempt is an independent final audit rerun, including the broader live HTTP matrix. Focused/full Node 22 and opt-in real-stack DOC-01 tests are recorded in `DOC_01_REMEDIATION.md`. Pilot and production concerns listed in `FINAL_VERIFICATION_FINDINGS.md` remain separate.

## Freeze decision

**BASE READY FOR VAULTR CONVERSION: NO**

- No source fix was made.
- No commit was created.
- No annotated tag was created.
- Nothing was pushed.

## Final Base Re-Verification (2026-08-11)

This section supersedes the pending-reverification status above while preserving the earlier audit record.

- Verdict: **BASE READY FOR VAULTR CONVERSION: NO**.
- Pre-audit HEAD: `204d2d533a075c74fc69f8b283c70fb4e94ec104`.
- Node 22: `v22.13.0`; npm: `10.9.2`.
- Backend: 46 files passed, 6 skipped; 540 tests passed, 21 skipped; typecheck/build passed.
- Frontend: 25 files; 236 tests passed; typecheck/lint/build passed with 0 lint errors and 37 warnings.
- Word: typecheck/build/manifest passed; 64 Playwright tests passed.
- Real Supabase/RLS: 6 files and 21 tests passed; 29/29 public tables RLS-enabled; 0 browser-role grant rows.
- Schema drift: 53 migrations, 15 created tables, and 47 final added columns.
- Workflow freshness passed at pinned source commit `4b9c7cd0d93b6254780abcc2cc382be6b56cd945` after an exact disposable source checkout; the repository-default sibling source directory was absent.
- DOC-01 is reopened by two blockers: tracked-change resolution overwrites trusted bytes without rescanning, and persisted Tabular Review cells are not version-bound or invalidated.
- Full clean-install proof is incomplete because the concurrent `npm ci` attempt exceeded the tool timeout; dry-run lockfile validation passed for all three packages.
- No baseline commit, tag, or push was created. Vaultr conversion remains prohibited until both DOC-01 blockers are remediated and independently re-verified.

## Final Hardened Base Re-Verification After DOC-01 Round 2 — 2026-08-11

This is a prepared freeze record only. The gate result is **BASE READY FOR VAULTR CONVERSION: NO**, so this record does not identify a hardened commit or tag.

### Repository and runtime

- Branch: `master`
- Pre-freeze/pre-audit HEAD: `204d2d533a075c74fc69f8b283c70fb4e94ec104`
- Node: `v22.13.0`
- npm: `10.9.2`
- Origin: `https://github.com/sabarinath1805-loyal/Vaultr-AI.git`
- Upstream: `https://github.com/Open-Legal-Products/mike.git`
- Working tree: dirty from accumulated hardening/remediation work and prior verification records; no audit source changes were made.

### Regression evidence

| Surface | Final evidence |
|---|---|
| Backend | Clean install, typecheck/build passed; 48 files and 553 tests passed; 7 files and 24 tests skipped |
| Frontend | Clean install, Node 22 typecheck, 25 files/236 tests, lint (0 errors/37 warnings), and Next production build passed |
| Word | Clean install, typecheck, webpack production build, HTTPS production manifest, and 64/64 Playwright passed |
| Real stack | 7 files and 24 tests passed on disposable Supabase/Auth/R2-compatible local stack |
| RLS/grants | 29/29 public tables RLS-enabled; 0 direct anon/authenticated table-grant rows |
| Schema drift | 54 migrations, 15 created tables, 48 final added columns |
| Workflow | Exact SHA `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`; 31 workflows; freshness passed |
| Production audits | Backend 1 moderate; frontend 4 moderate; Word 0 vulnerabilities |

### Freeze blockers

- Tabular chat history is not provenance-revalidated before model context construction.
- The clean migration chain is not fail-fast reproducible; the snapshot-plus-all-migrations sequence fails on an obsolete `documents.filename` reference.
- Account portability export omits provenance status for Tabular cells.
- Concurrent pointer promotions are not uniformly compare-and-swap protected.

See `FINAL_BASE_VERIFICATION.md` and `FINAL_BASE_FINDINGS.md` for the attack traces, line-level evidence, test commands, and minimum remediation. The prior freeze/audit history above is intentionally preserved.

### Freeze decision

- Hardened commit SHA: **none — not created**
- Freeze documentation commit SHA: **none — not created**
- `vaultr-hardened-base-v1`: **not created**
- Push to origin: **not attempted**
- Upstream: **untouched**
- Vaultr conversion: **prohibited**

## Overnight Foundation Completion Mission — pre-freeze Stage A record

Date: 2026-08-11. The four conversion blockers from the prior NO audit were
implemented and Stage A evidence is green, but this file remains a **NO
FREEZE / Stage B PENDING** record. The prior freeze history above is
preserved.

Stage A remediation status:

- B-01: **REMEDIATED — PENDING STAGE B VERIFICATION**. Tabular chat history is
  now server-owned and derived assistant content is revalidated against exact
  authorized source versions before model context construction.
- B-02: **REMEDIATED — PENDING STAGE B VERIFICATION**. Empty-database setup is
  now the canonical schema snapshot plus only post-baseline migrations, with
  an explicit checksum ledger and fail-fast verification.
- B-03: **REMEDIATED — PENDING STAGE B VERIFICATION**. Runtime pointer
  promotions use the central expected-current compare-and-swap helper.
- B-04: **REMEDIATED — PENDING STAGE B VERIFICATION**. Account exports label
  Tabular cell provenance and redact foreign source metadata/content.

Stage A counted evidence includes backend **51 files passed / 573 tests
passed / 27 skipped**, frontend **25 files / 236 tests**, Word **64/64 E2E**,
the expanded real stack **8 files / 27 tests**, two empty canonical schema
bootstraps, **29/29 RLS**, **0 direct browser grants**, and workflow freshness
at the approved 31-workflow SHA. Stage B has not yet been performed, so no
hardened commit, tag, or push is permitted by the mission.

## Overnight Foundation Completion Mission - final Stage B disposition

Date: 2026-08-12. Stage B independently closed B-01 through B-03. The live
cross-tenant account-export attack found that B-04 still emits
`provenance_status: "trusted"` for a foreign/inaccessible source after
redacting the content and source IDs. This fails the explicit export-status
invariant, so the freeze gate is **NO**.

No hardened source commit was created. No documentation-only freeze commit
was created. The annotated tag `vaultr-hardened-base-v1` was not created. No
push to `origin` was attempted, and `upstream` was not changed. The working
tree remains dirty by design, with the accumulated hardening/remediation
changes and audit records preserved for the next remediation round.

The minimum next action before any freeze consideration is to override the
status to `unverified` whenever account-export provenance is foreign,
inaccessible, missing, or unresolved, add the live injection regression test,
and rerun the complete two-stage gate. Vaultr conversion remains prohibited.

## B-04 Final Remediation Mission - pre-freeze Stage A record

Date: 2026-08-12. B-04 was remediated at the final account-export boundary:
foreign or otherwise inaccessible provenance now fails closed to
`unverified`, while content/source metadata remains redacted. The serialized
unit matrix and the real `/user/export` path passed.

Stage A counts are backend **51 passed / 8 skipped files; 574 passed / 28
skipped tests**, frontend **25/236**, Word **64/64**, and a real three-user
authorization matrix of **3/3**. Two fresh schema stacks passed canonical
bootstrap, verification, and drift; a populated-target repeat failed closed.

This is a pre-freeze record only. The product source is now frozen for the
independent Stage B audit. No freeze commit, tag, or push is authorized until
Stage B returns an unconditional YES.

## Stage B conditional-freeze decision — not authorized

Date: 2026-08-12 (Asia/Singapore). Stage A was formally closed and product
source was frozen before the final audit. Stage B completed its independent
checks, but discovered **B-05 / DOC-01-C**, a blocker in the `reuseVersion`
edit lifecycle.

The reuse path overwrites an existing version's object and finalizes its row as
trusted-ready before the expected-current CAS promotion. A concurrent pointer
change can make the promotion lose while leaving the non-winning historical
row and object replaced. The deterministic compiled-path reproduction recorded
an explicit conflict together with `versionStateAfterConflict=ready`,
`hashAfterConflict=new-hash`, and `integrityFinding=true`.

Therefore this is not a baseline freeze:

`BASE READY FOR VAULTR CONVERSION: NO`

No files were staged, no commit or annotated tag was created, and no remote was
updated. `master`, `origin`, and `upstream` remain untouched. The next freeze
attempt requires an immutable/atomic reuse-path remediation, a real concurrent
regression, and a complete fresh Stage A plus Stage B audit.

## B-05 remediation - Stage A evidence before the new freeze boundary

Date: 2026-08-12 (Asia/Singapore). The reuse-path remediation chose immutable
new rows and objects for every edit. A `reuseVersion` value is now an
expected-current guard only; the referenced historical row and object are
never edited. New candidates begin untrusted, are finalized only after their
own bytes are stored and hashed, and are promoted through the existing CAS.
All failure paths remove only the candidate artifacts.

Fresh real-stack Stage A evidence:

- the new persisted reuse suite passed **3/3** for sequential, stale, and
  concurrent reuse behavior;
- a second fresh stack passed **9 files / 31 tests** across the full real
  integration matrix;
- both fresh canonical schema stacks passed bootstrap, verifier, drift,
  RLS/grant, and populated-target fail-closed checks;
- backend Node 22 regression passed **51 files / 574 tests** with **9 files /
  31 tests** skipped as opt-in real-stack suites, and build passed;
- frontend passed **25 files / 236 tests**; Word Playwright passed **64/64**.

This remains a pre-freeze record. Stage B must run after the exact declaration
`STAGE A COMPLETE - SOURCE FROZEN FOR FINAL AUDIT` and must be independently
green before this document can become a baseline freeze.

## Hardened foundation baseline freeze - current round

Date: 2026-08-12 (Asia/Singapore). The current Stage B audit returned an
unconditional YES after the source-freeze boundary. B-01, B-02, B-03, B-04,
B-05, and DOC-01 are closed for this round. The earlier NO decisions remain
append-only historical records and are not being rewritten.

Freeze evidence:

- Node **v22.13.0** / npm **10.9.2**;
- backend **51 files / 574 tests** passed, **9 files / 31 tests** skipped only
  for opt-in real-stack suites, typecheck/build passed;
- B-01 provider-facing focused set **55/55** and focused trust/security set
  **69/69**;
- frontend **25/236**, typecheck/build, lint **0 errors / 37 warnings**;
- Word typecheck/build/HTTPS manifest and **64/64** Playwright;
- independent real B-05 persisted reuse attack: sequential and stale cases
  passed, plus exactly one winner/one explicit loser in the concurrent case;
- complete fresh real matrix **9 files / 31 tests**, including the B-04
  cross-tenant export route and DOC-01 lifecycle;
- independent B-03 concurrent CAS attack: one winner/one conflict, pointer
  on the winner, loser trust state preserved;
- two fresh canonical schema stacks: 55 migrations, 29/29 RLS, zero browser
  grants, drift passed, populated bootstrap failed closed;
- workflow freshness passed at the approved exact SHA with both negative
  controls failing closed; dependency audits found no high/critical issue;
- current source-scoped secret scans clean and `git diff --check` passed;
- all disposable services stopped and no conversion artifacts or secrets are
  present in the repository working tree.

The working tree contains the accumulated hardening implementation, tests,
schema/migration work, workflow provenance artifacts, and append-only audit
documents from the prior missions. Stage C now authorizes staging that reviewed
scope, creating the hardened-base commit and annotated tag
`vaultr-hardened-base-v1`, and pushing only those two refs to `origin`.
`upstream` must remain untouched. No Vaultr product conversion begins here.

**BASE READY FOR VAULTR CONVERSION: YES**

## Final Post-UI Checkpoint Freeze — 2026-08-23

This is the append-only freeze record for the post-UI foundation. The
original hardened base remains `vaultr-hardened-base-v1` at
`ae84bde30b9b861a8fc57abcc490d6d3f054de3c`; the foundation UI commit is
`2a1eafb`. The final audited commit is the checkpoint commit created from
this reviewed tree and is reported after Git creates it.

The exact Stage A boundary was:

`STAGE A COMPLETE — SOURCE FROZEN FOR FINAL POST-UI AUDIT`

After that boundary, only independent verification was performed. The
narrow Stage A changes addressed populated-table scan timing, row-checkbox
accessible names, valid table action-cell semantics, and the scoped workflow
detail heading locator. The generated workflow source remains canonical at
`CP Checklist Draft`; freshness reproduced 31 workflows byte-for-byte from
`4b9c7cd0d93b6254780abcc2cc382be6b56cd945`.

### Freeze evidence

| Gate | Result |
|---|---|
| Node / npm | v22.15.0 / 10.9.2 |
| npm audit: root, frontend, backend, Word | 0 findings in every severity/informational category for all four workspaces |
| Frontend | typecheck/build pass; 28 files / 240 tests; lint 0 errors / 36 warnings; 23 routes |
| Backend | build pass; 51 files / 574 tests; 9 files / 31 tests skipped under existing opt-in gates |
| Word add-in | typecheck/build/manifest pass; 64/64 headless tests |
| Repository Playwright | 27 passed / 4 skipped / 0 failed / 0 flaky, final no-retry run |
| Real Supabase/storage matrix | 9 files / 31 tests passed |
| Fresh database | bootstrap and verification pass; 29/29 RLS; 0 browser grants; populated rerun fails closed |
| Workflow reproducibility | 31 generated workflows, byte-for-byte fresh |
| B-01 / B-02 / B-03 | independently closed |
| B-04 | independently closed, foreign provenance unverified and redacted |
| B-05 / DOC-01-C | independently closed, immutable reuse preserved on loser path |
| DOC-01 | independently closed across the frozen mutation inventory |

The backend regression environment blanked `MANIFEST_SIGNING_KEY` for the
test process only, isolating developer-local secret state without printing,
changing, or deleting the secret. The final browser suite was run headless;
no popup was opened. A reused backend process had previously exhausted its
known in-memory rate limiter, so it was restarted before the authoritative
no-retry run. The transient HTTP 429 cascade was not reproduced after the
clean service reset.

The axe gate had no critical violations. Serious contrast findings remain
non-blocking UI debt: login Sign up at 3.9:1 and two muted Projects/Tabular
tabs at 2.53:1. Expected missing-project 404s render `Project not found` and
are narrowly suppressed from console diagnostics while unexpected errors
remain visible.

### Freeze decision

The reviewed tracked scope is authorized for the checkpoint commit
`chore: freeze hardened Vaultr UI foundation`, the new annotated tag
`vaultr-hardened-ui-base-v1`, and push to `origin` only. The user-owned
`Claude web May 2026.zip` remains untouched, untracked, and excluded.

**POST-UI FOUNDATION READY FOR LEX PORT: YES**

Lex work remains out of scope.
