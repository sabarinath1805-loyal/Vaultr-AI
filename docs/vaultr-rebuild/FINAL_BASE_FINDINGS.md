# Vaultr-AI — Final Base Findings After DOC-01 Round 2

Audit date: 2026-08-11<br>
Verdict: **BASE READY FOR VAULTR CONVERSION: NO**<br>
Pre-audit HEAD: `204d2d533a075c74fc69f8b283c70fb4e94ec104`

This document records the independent findings from the final adversarial gate. It does not replace `FINAL_VERIFICATION_FINDINGS.md`, `FINAL_REVERIFICATION_FINDINGS.md`, or `DOC_01_REMEDIATION_ROUND_2.md`; those documents remain historical evidence of the earlier failures and claimed remediations.

## Finding B-01 — Tabular chat history bypasses provenance

Severity: **BLOCKER**<br>
Area: DOC-01-B / model-context boundary<br>
Status: confirmed by static execution trace; no source change made.

### Evidence

`backend/src/routes/tabular.ts` correctly loads current cells and calls `loadTabularCellProvenance` before building `tabularStore` (`:1709-1759`). Non-trusted current cells become `null` in that store. The `read_table_cells` tool also rechecks the store through the provenance helper in `backend/src/lib/chat/tools/toolDispatcher.ts`.

The route then takes a separate path:

- `buildTabularMessages` starts at `backend/src/routes/tabular.ts:1621`.
- It appends every request message with `formatted.push({ role: msg.role, content: msg.content ?? "" })` at `:1666`.
- `POST /:reviewId/chat` passes the caller’s `messages` into that builder at `:1814`.
- `runLLMStream` receives `apiMessages` immediately afterward.
- The persisted-message endpoint returns raw message content and annotations at `:1566-1572`, making replay of an old assistant message a normal client behavior.

### Attack trace

1. Version A is trusted and a Tabular cell contains a synthetic marker such as `STALE-A`.
2. A chat assistant response or client-side history contains that marker.
3. Version A is changed to `quarantined`, `failed`, or another non-trusted state.
4. A new chat request includes the old assistant message plus a new user message.
5. Current-cell reads are correctly redacted, but `buildTabularMessages` still appends the old message verbatim.
6. The stale marker is present in `apiMessages` passed to `runLLMStream`.

This is not dependent on an RLS mistake, a forged version ID, or a provider response. It is a direct model-context construction bypass. The real stack proved current-cell quarantine redaction, but did not prove historical-message revalidation; the direct code path disproves the broader Round 2 claim.

### Minimum remediation required

Make the chat history a provenance-aware consumer: revalidate or remove stale/unverified derived messages before model construction, or store enough provenance with assistant messages to fail closed after source invalidation. Add a regression test that asserts a synthetic quarantined-source marker cannot appear in the `runLLMStream` message array. This audit did not implement that remediation.

## Finding B-02 — The required migration-chain proof is not reproducible

Severity: **BLOCKER**<br>
Area: schema reproducibility<br>
Status: reproduced on a newly named disposable Supabase stack; no migration change made.

### Evidence

The repository drift script passes its textual metrics:

```text
Schema drift check passed: 54 migrations, 15 created tables, 48 final added columns.
```

That does not prove SQL installation. On an empty disposable local Postgres database, applying the 54 files in filename order failed at the first migration because `tabular_review_chat_messages` did not exist. The migration set is incremental and has no complete bootstrap for an empty database.

The canonical `backend/schema.sql` snapshot does load cleanly with PostgreSQL `ON_ERROR_STOP=1`. However, loading that current snapshot and then applying every dated migration in order fails at:

```text
backend/migrations/20260424_01_docx_version_display_name.sql:32
SET display_name = d.filename
ERROR: column d.filename does not exist
```

The current canonical `documents` table has no `filename`; `document_versions` owns the filename, and a later historical migration explicitly drops `documents.filename`. The complete snapshot-plus-all-deltas sequence therefore cannot be used as a fail-fast reproducible installation.

### Minimum remediation required

Choose and document one supported installation contract:

- a complete versioned bootstrap snapshot plus only migrations newer than that snapshot; or
- a genuinely complete ordered migration chain from an empty database.

Then make the CI/audit gate apply that contract with `ON_ERROR_STOP=1`, validate the final schema/RLS/grants/indexes, and fail on obsolete migration assumptions. This audit did not modify the schema or migration files.

## Finding B-03 — Pointer promotion is not uniformly optimistic

Severity: **BLOCKER for the requested active-version race gate**<br>
Area: DOC-01-A companion path / active-version consistency<br>
Status: statically reproduced as a lost-update trace; no source change made.

`handleEditResolution` uses a proper expected-current pointer predicate and passed the route race test. The separate `runEditDocument({ reuseVersion })` path does not:

- it reuses `reuseVersion.storagePath` at `backend/src/lib/chat/tools/documentOps.ts:1280-1285`;
- invalidates the row and hash before the upload at `:1293-1304`;
- scans the candidate before mutation at `:1265`;
- finalizes the row at `:1321-1338`; and
- updates `documents.current_version_id` with only `.eq("id", documentId)` at `:1438-1443`.

A concurrent request can promote Version B after the first request reads Version A but before that first request’s final pointer update. The first request can then make A current again. The same class of missing-CAS pointer update appears in several standard upload/copy/replication paths.

The bytes in this trace are scanned and the reuse path does not preserve the old trusted state across the overwrite. The failure is lost activation/inconsistent version selection, which the requested gate explicitly requires optimistic pointer handling to prevent.

### Minimum remediation required

Use a compare-and-swap/transactional promotion primitive for every pointer-changing path, verify affected-row counts, and define the cleanup/failed-state behavior when promotion loses. Add a real concurrent two-promotion test for both immutable and reuse paths. This audit did not implement that remediation.

## Finding B-04 — Account export omits provenance status

Severity: **BLOCKER for DOC-01-B closure; portability rather than direct model execution**<br>
Area: export boundary<br>
Status: confirmed by static trace; no source change made.

The dedicated `buildUserTabularReviewsExport` path calls `loadTabularCellProvenance` and adds `provenance_status` to each exported cell (`backend/src/lib/userDataExport.ts:131-175`). The account export is a different builder:

- `buildUserAccountExport` loads `tabular_cells` at `:387`;
- it returns `tabular_cells: tabularCells` at `:407` without helper classification or a status field;
- `/user/export` calls that builder at `backend/src/routes/user.ts:1116`.

Thus a stale, quarantined, failed, or legacy cell included in account portability data is not clearly labelled. The output is not itself passed to the model, so this is distinct from B-01; it nevertheless contradicts the explicit export requirement and means the DOC-01-B claim is incomplete.

### Minimum remediation required

Route every Tabular export shape through one provenance-aware serializer, or explicitly mark each portability cell with its current `trusted`/`stale`/`unverified` state and make clear that portability data is not trusted AI work product. Add tests for clean, stale, failed, quarantined, missing, and active-version-changed cells through both export endpoints.

## Positive controls independently confirmed

- `handleEditResolution` no longer overwrites the old trusted bytes in place; the real Round 2 scenario created a new version and preserved the old version/hash.
- Scanner failure and pointer loss behavior in the tested resolution route preserves the prior active version and cleans candidate objects.
- `runEditDocument({ reuseVersion })` clears processing trust and the hash before the same-key upload; no path was found that knowingly leaves the old hash/trust attached to new bytes.
- Document-version helpers reject untrusted, unknown, deleted, or missing versions for trusted content reads.
- Tabular exact source-version provenance, current-pointer comparison, wrong-document rejection, duplicate rejection, and quarantine redaction work in the tested paths.
- Real Supabase Auth/RLS, owner/shared/outsider HTTP authorization, OAuth claim, MCP SSRF, Node 22 backend/frontend/Word, workflow pin, and dependency baseline checks passed as recorded in `FINAL_BASE_VERIFICATION.md`.

## Non-blocking or later work

The following were not converted into gate blockers, but remain operational work: production scanner/converter wiring, hosted Supabase/R2 ownership and restore evidence, hosted OAuth/provider/MFA/email validation, Word identity/certificates, audit retention/legal hold, the backend moderate SDK advisory, the frontend moderate `uuid` advisory, and the Word dev-only advisories.

## Required next sequence

1. Repair B-01 through B-04 without weakening the fail-closed tests.
2. Add the missing chat-history, account-export, three-user provenance-substitution, and concurrent-promotion regression cases.
3. Establish one fail-fast schema bootstrap/migration contract and make the schema gate execute it on a clean database.
4. Rerun this independent final gate under Node 22 with a fresh disposable stack.
5. Only if the rerun is entirely positive may the project consider committing, tagging, pushing, or beginning Vaultr conversion.

## Overnight Foundation Completion Mission — Stage A closure

Date: 2026-08-11. The four blocker implementations are now present and their
focused/full checks are green. The original B-01 through B-04 sections above
remain preserved as the independent pre-remediation findings; this closure
section records the Stage A response and does not claim that Stage B has passed.

| Finding | Stage A status | Primary implementation |
|---|---|---|
| B-01 | **REMEDIATED — PENDING STAGE B VERIFICATION** | Server-owned persisted chat history plus strict derived-output provenance validation in `backend/src/lib/tabularChatHistory.ts` and `backend/src/routes/tabular.ts` |
| B-02 | **REMEDIATED — PENDING STAGE B VERIFICATION** | Explicit snapshot baseline/ledger and fail-fast canonical bootstrap in `backend/schema-baseline.json` and `scripts/schema-bootstrap.mjs` |
| B-03 | **REMEDIATED — PENDING STAGE B VERIFICATION** | Central CAS promotion primitive in `backend/src/lib/documentPromotion.ts`, migrated across runtime promotion paths |
| B-04 | **REMEDIATED — PENDING STAGE B VERIFICATION** | Account-export classification and foreign-provenance redaction in `backend/src/lib/userDataExport.ts` |

Stage A's strongest positive evidence is the expanded disposable real-stack
matrix (**8 files / 27 tests passed**) and the full backend regression (**51
files passed, 8 skipped; 573 tests passed, 27 tests skipped**). The new real
suite also proved stale Tabular chat neutralization, account-export
status/redaction, and a winner-versus-stale promotion retry. Those tests are
evidence for the remediation, not a substitute for the required independent
Stage B attacks.

The overall verdict remains **BASE READY FOR VAULTR CONVERSION: PENDING STAGE
B**. If Stage B exposes any new blocker, the final verdict must remain NO and
the source must not be fixed during that verification stage.

## Overnight Foundation Completion Mission - Stage B findings

Date: 2026-08-12. Stage B was completed without changing source after the
verification boundary. It independently closed B-01, B-02, and B-03, but
reopened B-04 as a blocker.

### Positive independent closures

- **B-01:** Server-owned Tabular chat history was confirmed against a live
  state matrix. Trusted original output was retained; every invalid or stale
  derived state was neutralized, and caller-supplied assistant replay was not
  included in the provider history.
- **B-02:** Two fresh disposable databases passed the canonical snapshot plus
  post-baseline migration bootstrap, ledger, drift, RLS, and grant checks. A
  populated-target repeat failed closed as designed.
- **B-03:** Runtime inventory found no unguarded backend route/helper pointer
  update. A live simultaneous promotion race produced exactly one winner and
  one explicit conflict, with the winner left active.

### B-04 - account-export status remains a blocker

The independent cross-tenant injection seeded User A's owned review with a
cell whose source version belonged to User B and was trusted for User B. The
serialized account export correctly produced `content: null`,
`source_document_version_ids: null`, `foreign_version_exported: false`, and
no foreign version row. It nevertheless reported
`provenance_status: "trusted"`.

This is inaccurate for User A's export boundary. Once source metadata is
foreign or inaccessible, the portable cell must be labelled `unverified`,
regardless of the source version's trust state for another account. The
remaining issue is in `backend/src/lib/userDataExport.ts`, where the status is
constructed before inaccessible-source redaction without the required
unverified override.

Minimum remediation: override the serialized status to `unverified` for every
foreign, inaccessible, missing, or unresolved source; add a live cross-tenant
injection test; rerun the focused suite, full regression, and final gate. This
remediation was not applied during Stage B.

## Final gate decision

**BASE READY FOR VAULTR CONVERSION: NO**. The green regression, RLS,
authorization, workflow, schema-bootstrap, and dependency evidence does not
override the explicit B-04 status-accuracy failure. No source was staged or
committed, no tag was created, and no remote was pushed. The earlier blocker
history and Stage A pending statuses remain preserved above.

## B-04 Final Remediation Mission - Stage A record

Date: 2026-08-12. The prior Stage B B-04 blocker was reproduced and fixed in
`backend/src/lib/userDataExport.ts` before the new independent audit. The
serializer now forces foreign, inaccessible, missing, malformed, unresolved,
wrong-document, or otherwise non-exporter-resolvable provenance to
`provenance_status: "unverified"` after applying the existing content/source
metadata redaction.

The required unit matrix passed at the final serialized boundary, and the
real Supabase/HTTP hardening suite passed the owner export plus the direct
`GET /user/export` route check. The previous foreign trusted-source result is
preserved above as the reason for the remediation; it is not silently
rewritten.

Stage A evidence also includes backend **51/8 files and 574/28 tests**,
frontend **25/236**, Word **64/64**, two fresh canonical schema bootstrap
runs, and the real three-user authorization **3/3** matrix. All four blocker
statuses remain pending the independent Stage B audit until that audit is
complete.

## Stage B finding — B-05 / DOC-01-C

Date: 2026-08-12. This blocker was discovered after the source-freeze
declaration and was not remediated during the independent audit.

**Severity:** BLOCKER / P1 data-integrity and trust-boundary failure.

**Affected code:** `backend/src/lib/chat/tools/documentOps.ts`,
`runEditDocument`, `reuseVersion` branch around the in-place invalidation,
upload, and finalization sequence, followed by the CAS call;
`backend/src/lib/documentPromotion.ts` is the CAS boundary.

**Exact failure:** when a same-turn edit reuses a version, the implementation
first clears that existing row's trust/hash state, overwrites its storage path,
and marks the same row `ready` with the new hash. If another request changes
the document pointer before the final `promoteDocumentVersion` call, the CAS
correctly returns a conflict, but the historical row and storage object have
already been replaced. The independent interleaving produced:

`resultOk=false, pointerChanged=true, replaced=true, promoteExpected=v-reuse, versionStateAfterConflict=ready, hashAfterConflict=new-hash, integrityFinding=true`

**Security/data impact:** a non-winning historical version is no longer
immutable and its UUID, bytes, hash, and trusted-ready state describe different
content after a conflict. The current pointer is not silently moved, but
version/history/download surfaces can observe corrupted trusted history. This
breaks DOC-01's trust lifecycle even though the pointer CAS itself remains
correct.

**Minimum remediation:** reserve the expected current version atomically before
any in-place storage or row mutation, or use immutable new rows/objects for all
edits and collapse same-turn edits outside the version identity. A conflict
must leave the original row/object/hash/trust state untouched and clean only
candidate artifacts. Add a real concurrent reuse regression covering the
loser, bytes, hash, processing state, storage object, and historical row.

**Final finding:** B-05 forces **BASE READY FOR VAULTR CONVERSION: NO**. No
source commit, tag, or push was created. Previous B-04 history remains above;
B-04 is now independently closed, while B-05 is the outstanding foundation
blocker.

## B-05 remediation record - Stage A

Date: 2026-08-12. The B-05/DOC-01-C failure was remediated with immutable
candidate versions. `runEditDocument` no longer invalidates, overwrites, or
re-trusts a reused `document_versions` row. Every edit gets a fresh storage
object and fresh row, initially untrusted, and the central expected-current
CAS decides whether that candidate becomes active. Failed candidates are
cleaned up without touching the expected original.

The required persisted real-stack matrix passed: sequential reuse, stale reuse,
and two concurrent reuse attempts. The concurrent assertions found exactly one
successful promotion and one explicit loser failure; the original row's
identity, bytes, hash, path, and processing/trust state remained unchanged;
candidate paths were distinct; and the winner was ready, trusted, and active.
The complete real integration matrix passed **9 files / 31 tests** on a second
fresh stack. Backend, frontend, Word, schema, and bootstrap evidence is
recorded in the Stage A remediation sections of the final audit documents.

This record does not close B-05 yet. Stage B must independently re-attack the
compiled path and persisted storage state after the exact source-freeze
boundary, then decide the final gate.

## B-05 / DOC-01-C - Stage B closed

Date: 2026-08-12. The independent frozen audit did not reproduce the prior
integrity failure. A hand-driven compiled-path test passed sequential reuse,
stale reuse with zero mutation, and a persisted concurrent race with exactly
one winner and one explicit loser. The reused original's identity, bytes,
object, hash, and processing/trust state were unchanged after the loser; the
winner was ready, active, and hash-matched.

The live nine-file/31-test matrix and the separate B-03 concurrent CAS attack
also passed. The DOC-01 mutation inventory found all candidate creation paths
use their own object and row with untrusted-before-ready gating. The explicit
owner replacement endpoint retains its selected row ID by design, but uses a
fresh object key, updates the row to untrusted before ready, and never
overwrites the old object key; its lifecycle did not produce a trusted
hash/path mismatch.

B-05 / DOC-01-C is **CLOSED** for the current round. No new blocker was found
after the freeze boundary.

**BASE READY FOR VAULTR CONVERSION: YES**
