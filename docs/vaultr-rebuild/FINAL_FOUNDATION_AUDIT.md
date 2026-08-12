# Vaultr-AI Final Foundation Audit - Stage B

Date: 2026-08-12 (Asia/Singapore)<br>
Branch: `master`<br>
Pre-freeze HEAD: `204d2d533a075c74fc69f8b283c70fb4e94ec104`<br>
Node: `v22.13.0`<br>
npm: `10.9.2`

This document is an append-only final Stage B audit record. Historical audit
documents remain unchanged in substance. Stage A was formally closed with:

`STAGE A COMPLETE - SOURCE FROZEN FOR FINAL AUDIT`

From that boundary onward, no product source, test, dependency, schema,
authorization, or infrastructure changes were made. Only audit evidence
documents were appended.

## Verdict

# BASE READY FOR VAULTR CONVERSION: NO

B-04 is closed, but Stage B found a new foundation blocker: **B-05 / DOC-01-C
- reuse-path concurrent cleanup/data-integrity failure**.

## Evidence summary

| Area | Stage B result |
|---|---|
| B-01 Tabular provenance | Positive: actual provider-facing reattack and 47/47 targeted route/history tests passed. |
| B-02 schema bootstrap | Positive: independent C and D clean stacks passed canonical bootstrap, ledger, drift, 29/29 RLS, and 0 browser grants; populated repeat failed closed. |
| B-03 active-pointer CAS | Positive for pointer ownership: one concurrent winner and one explicit conflict; runtime pointer write inventory resolves through the central CAS helper. |
| B-04 account-export provenance | Closed: real cross-tenant export attack and `GET /user/export` label affected cells `unverified` and redact foreign content/IDs/rows/sentinels. |
| Authorization | Positive for tested owner/shared/outsider HTTP policy: 3/3. |
| OAuth claim | Positive in the live Supabase matrix; atomic claim and browser-role denial passed. |
| MCP/SSRF and raw logging | Positive targeted set: 69/69 tests passed across 10 files; production raw logging remains opt-in/redacted. |
| Workflow provenance | Positive: pinned SHA, 31 generated workflows, byte-for-byte freshness; missing/wrong source checks fail closed. |
| Dependencies | No critical/high production vulnerability; known moderate advisories recorded below. |
| DOC-01 | Blocked by B-05. |

## B-05 / DOC-01-C - exact blocker

**Severity:** BLOCKER / P1 data-integrity and trust-boundary failure.

**Affected path:** `backend/src/lib/chat/tools/documentOps.ts`,
`runEditDocument`, the `reuseVersion` branch around the in-place invalidation,
storage upload, and finalization, followed by the CAS promotion at the end of
the function. The CAS implementation is
`backend/src/lib/documentPromotion.ts`.

The `reuseVersion` branch is intended to collapse multiple edit tool calls in
one assistant turn into one version. It first verifies the active pointer, but
the later sequence is not atomic with the pointer CAS:

1. mark the reused `document_versions` row untrusted and clear its hash;
2. overwrite the existing storage object;
3. mark the same row `ready` with a hash for the new bytes; and
4. call `promoteDocumentVersion` with the old expected pointer.

An adversarial interleaving changed the pointer between steps 1-3 and step 4.
The actual compiled production path returned a conflict but left the reused
historical row/object changed. The reproduction result was:

`resultOk=false, pointerChanged=true, replaced=true, promoteExpected=v-reuse, versionStateAfterConflict=ready, hashAfterConflict=new-hash, integrityFinding=true`

This violates immutable document-version history. A losing request must not
rewrite a version identity that may now be historical, and a `ready` hash must
continue to describe the bytes associated with that immutable version. The
pointer winner remained active, so this is not a silent pointer regression; it
is nevertheless a trust/data-integrity failure in historical version, download,
and audit surfaces.

### Required remediation before the next gate

Use an atomic lease/reservation/CAS on the expected current version before any
in-place mutation, or create an immutable new row and storage object for every
edit and deduplicate only at the assistant-turn layer. If promotion loses, the
original row, storage object, hash, and trust state must remain unchanged; only
candidate artifacts may be cleaned up. Add a real concurrent reuse regression
that checks pointer, row identity, bytes, hash, processing state, storage
object, and loser response.

## Regression, infrastructure, and audit details

- Backend full run: **51 files passed / 8 optional files skipped; 574 tests
  passed / 28 skipped**, followed by a successful TypeScript build.
- Frontend: **25 files / 236 tests**, typecheck and production build passed;
  lint had **0 errors / 37 warnings** and 23 static pages were generated.
- Word add-in: typecheck, production build, HTTPS manifest, and **64/64
  Playwright** passed.
- Live stack: **8 files / 28 tests passed** under Node 22 with the local
  Supabase S3-compatible storage endpoint. DOC-01 storage tests passed with a
  process-only download-signing secret. LibreOffice was unavailable, so PDF
  sidecar conversion followed its documented fallback.
- Schema: baseline `20260811_03_tabular_chat_provenance`; 55 migrations; 15
  created tables; 49 final added columns; 29/29 RLS; 0 direct browser grants.
- Workflow source: exact commit
  `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`; **31** system workflows;
  byte-for-byte fresh. Missing source and wrong SHA both failed closed.
- Dependency audits: root 0; backend 1 moderate `@anthropic-ai/sdk`
  advisory; frontend 4 moderate `uuid` chain advisories; Word 0. No
  automatic upgrade was performed.
- Secret/privacy scan: scoped Gitleaks found only three intentional synthetic
  API-key fixtures in `backend/src/lib/__tests__/safeError.test.ts`; frontend,
  Word, and scripts were clean. Raw LLM capture is opt-in and redacts secrets
  and content by default.
- Default-run skipped tests are all opt-in local Supabase suites requiring
  explicit URL/key variables (and, for DOC-01, object-storage variables plus
  the real-HTTP flag). All eight optional files were enabled and passed in the
  live Stage B stack, so the skipped count is not unevidenced security coverage.
- `git diff --check` passed. The working tree remains intentionally dirty;
  no product conversion, commit, tag, or push was performed.

## Pilot prerequisites

Before pilot consideration, the repository must remediate and re-audit B-05.
It must also resolve or explicitly accept the production dependency advisories,
provision and own LibreOffice/PDF conversion, confirm the production scanner
and object-storage configuration/ownership, and complete hosted Supabase/R2
operational controls. These operational items do not change the gate result;
B-05 alone is sufficient for `NO`.

The foundation still contains a conversion blocker. Vaultr v2 product
conversion must not begin.

## Current B-05 remediation round - frozen Stage B result

Date: 2026-08-12 (Asia/Singapore). This append is the authoritative result
for the latest B-05 / DOC-01-C remediation round; the earlier NO finding above
is preserved as history.

Stage A selected strategy (b). `runEditDocument` now creates a fresh storage
object and fresh `document_versions` row for every edit, including a call that
contains `reuseVersion`. The reused version is only an expected-current
optimistic guard. It is never invalidated, overwritten, re-hashed, or
re-trusted. Candidate rows begin untrusted, are finalized from their own
stored bytes, and are promoted through the existing central CAS. Candidate
row/object cleanup is used on upload, insert, trust, edit-record, and
promotion failure paths, with a version-number uniqueness retry for concurrent
writers.

### Independent frozen Stage B evidence

- A hand-driven script written outside the repository and run against the
  compiled production path on a fresh disposable stack passed sequential reuse,
  stale reuse with zero mutation, and a real concurrent reuse race. The race
  produced exactly one successful promotion and one explicit loser failure;
  persisted original row identity, bytes, storage path, hash, processing/trust
  state, and object bytes were unchanged; the winner was ready, active, and
  hash-matched. Only two version rows/objects remained.
- The complete fresh real-stack matrix passed **9 files / 31 tests**. This
  included the B-01 provenance/history boundary, OAuth claim, three-user
  authorization, B-04 cross-tenant export with `GET /user/export`, direct and
  copied uploads, replacement, tracked-change resolution, scan failure, and
  the Stage A reuse suite. LibreOffice was absent; the documented PDF-sidecar
  fallback was observed and no DOCX trust assertion failed.
- A separate fresh database passed the independent concurrent trusted-pointer
  CAS attack: one winner, one explicit `conflict`, pointer on the winner, and
  the losing candidate's `ready` trust state preserved.
- Two independent canonical schema stacks passed bootstrap, verifier, drift,
  the 55-migration ledger, 29/29 RLS, and zero direct browser grants. The
  deliberate populated-target bootstrap rerun failed closed with exit 1. All
  disposable stacks were stopped afterward.
- Node **v22.13.0** / npm **10.9.2** backend regression/build passed **51
  files / 574 tests**, with **9 files / 31 tests** skipped only because they
  require opt-in real-stack credentials; all nine were enabled in the live
  matrix. The current B-01 provider-facing focused set passed **55/55** and
  the focused trust/OAuth/SSRF/privacy/authorization/conversion set passed
  **69/69**.
- Frontend passed **25 files / 236 tests**, typecheck, production build with
  configured HTTPS-shaped variables, and lint with **0 errors / 37 warnings**;
  23 pages were generated. Word passed typecheck, production webpack/HTTPS
  manifest, and **64/64** Playwright tests.
- Workflow provenance generated **31** workflows byte-for-byte at the pinned
  source SHA `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`; missing-source and
  wrong-SHA negative checks failed closed. Dependency audits found root 0,
  backend 1 moderate, frontend 4 moderate, and Word 0 production advisories;
  no high or critical advisory and no forced upgrade.
- Current source-scoped Gitleaks scans for backend, frontend, Word, and
  scripts found no leaks under the repository allowlist. Full history found
  one redacted historical generic-api-key match in old commit
  `4050d671cd1b5f017017beb3b30181703cb0f2e0`; it is not present in current
  source. `git diff --check` passed, with only Git's LF/CRLF normalization
  notices.

### DOC-01 mutation inventory disposition

The frozen source inventory covered standard upload, new-version upload,
from-document copy, owner replacement, tracked-change resolution,
`runEditDocument` in all branches including `reuseVersion`, generated
DOCX/XLSX/PPTX, project replication, conversion, recovery, download, and
cleanup. New candidate paths use unique objects, committed content hashes,
untrusted initial states, and ready/trusted transitions only after their own
bytes are stored and scanned. The owner replacement endpoint is an explicit
destructive operation that keeps its selected row ID but writes a fresh object
key, resets the row untrusted before updating it, and does not overwrite an
old object key. It is distinct from the B-05 losing-CAS failure and produced
no trusted hash/path mismatch in the live replacement test. Deletion nulls
paths and marks the row deleted only after current-pointer CAS when needed.

### Current verdict

B-01, B-02, B-03, B-04, B-05, and DOC-01 are independently closed for this
round. No new blocker was found after the exact source-freeze boundary.

**BASE READY FOR VAULTR CONVERSION: YES**

Stage C is limited to freezing this hardened foundation: review and stage the
accumulated changes, create the requested commit and annotated tag, and push
only the commit and tag to `origin`. Vaultr product conversion, branding,
hosting cutover, UI redesign, and domain work remain out of scope.
