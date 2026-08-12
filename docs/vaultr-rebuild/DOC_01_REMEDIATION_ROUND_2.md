# Vaultr-AI DOC-01 Final Blocker Remediation Round 2

Date: 2026-08-11<br>
Scope: narrow remediation of the two blockers raised by the Final Hardened Base Re-Verification.<br>
Final-gate rule: the prior **BASE READY FOR VAULTR CONVERSION: NO** verdict is preserved. This record is not an independent final-gate audit.

## DOC-01-A status

**REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**

Tracked-edit resolution no longer overwrites the trusted active version. It resolves the candidate bytes, scans those exact bytes, stores them under a new version-specific key, creates the version as `pending_scan`, promotes it only after the scan succeeds, and changes the active pointer with an optimistic compare-and-set. A failed scan leaves the prior trusted version and pointer unchanged.

## DOC-01-B status

**REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**

Persisted Tabular cells now carry the exact source document-version ID set used during generation. Reads, regeneration, chat/model context, and exports validate that provenance against the current document version set and current trusted processing state. Missing, malformed, unknown, deleted, stale, or untrusted provenance is never treated as trusted/current content.

## Root causes

### DOC-01-A

`handleEditResolution` loaded a trusted active version, applied a tracked-change decision, and uploaded the changed DOCX to the existing trusted storage path. The version row retained its trusted state, so the new bytes could be consumed before a scanner saw them. The storage object and the database trust state were not coordinated around the mutation.

### DOC-01-B

`tabular_cells` persisted summaries, flags, and reasoning without a source-version snapshot. The UI and `read_table_cells` could therefore return cached derived content after the source document's active version changed or its former source version became pending, quarantined, failed, deleted, or otherwise unknown.

## Byte-mutation paths found

The byte-write inventory was re-run across document routes, tracked-edit helpers, generated Office files, conversion outputs, replication, and storage helpers.

| Path | Mutation model after Round 2 | Trust control |
|---|---|---|
| `backend/src/routes/documents.ts`, `handleEditResolution` | New immutable document version and new DOCX/PDF keys | Exact resolved DOCX is scanned before persistence; inserted version starts `pending_scan`, then becomes `ready`; old active version remains unchanged until the pointer CAS succeeds |
| `backend/src/routes/documents.ts`, `PUT /:documentId/versions/:versionId/file` | Existing version row is repointed to a fresh object key; the old object is deleted after the row is finalized | Candidate bytes are scanned before storage; the database row is written untrusted and promoted only after the scan; failed row updates clean up the fresh objects and never overwrite the old object in place |
| `backend/src/lib/chat/tools/documentOps.ts`, `runEditDocument` with a new version | New version-specific DOCX key | Candidate bytes are scanned before storage; new row starts untrusted and is promoted only through the existing guarded lifecycle |
| `backend/src/lib/chat/tools/documentOps.ts`, `runEditDocument` with `reuseVersion` | The one remaining intentional in-place overwrite | The row is reset to `pending_scan` and its hash is cleared before the object write; upload/finalization failures mark it `failed`; `ready` is written only after the exact candidate bytes passed `scanVersionContent` |
| Generated DOCX/XLSX/PPTX and replicated documents | New object/version keys | Existing creation paths use untrusted initial state and exact-byte scanning before promotion |
| Conversion outputs | Separate per-version PDF keys | Conversion failure cannot make the source version trusted; an optional PDF is retained only when conversion succeeds |

No additional production path was found that replaces bytes at a trusted path without either the new immutable-version boundary or the guarded `reuseVersion` invalidation boundary. Test fixtures and export/cleanup writes are not trusted document-ingestion paths.

## `handleEditResolution` fix

The owner-only route still validates the edit's document and resolves the current active version, but the write sequence is now:

1. Authorize the owner and load the current trusted active version.
2. Download the active bytes and apply the requested accept/reject operation in memory.
3. Run `scanVersionContent` on the exact resolved bytes. A quarantine result returns 422; scanner-unavailable/error results return 503, record bounded scan-failure metadata, and do not create or replace a version.
4. Generate a fresh version-specific DOCX key (`user_accept` or `user_reject`) and upload the exact scanned bytes. PDF conversion, when available, uses a separate version-specific key.
5. Insert a `document_versions` row with the exact hash and `processing_state: pending_scan`.
6. Promote that inserted row to `ready` only after the scanner has trusted the candidate bytes.
7. Update `documents.current_version_id` only when it still equals the active version loaded at step 1.
8. On database, pointer, or storage failure, mark the new row failed where possible and delete newly-created objects best effort. A pointer race returns 409 and leaves the newer active version in control.

Edit resolution success is not itself a trust decision. No trusted consumer is pointed at the new version until the scan and promotion steps complete.

## Active-version safety

The old trusted version remains active while the candidate is scanned, stored, and promoted. If a concurrent upload/edit changes the pointer first, the compare-and-set fails; the candidate is marked failed and its newly-created objects are deleted. If the pointer does refer to a pending candidate, `loadActiveVersion` and the downstream trust helpers reject it, so extraction, chat context, model context, replication, and Tabular source loading cannot use it.

The focused route tests cover pointer-race failure. The real-stack accept test verifies that the old version remains ready and unchanged while a new `user_accept` version becomes the current ready version. The real-stack scanner-unavailable test verifies that a rejected candidate does not replace the active version or create an extra trusted version.

## Tabular provenance model

The existing model is:

`tabular_reviews` -> `tabular_review_rows` -> `tabular_review_row_sources` -> source `documents` -> source `document_versions`; cells live in `tabular_cells` and are keyed to a row and column.

`tabular_cells.source_document_version_ids uuid[]` stores the exact current-version ID for every source document used to build that cell. The array supports a folder/grouped row with multiple source documents; it is not inferred later from mutable `documents.current_version_id`. Generation records the IDs returned by the trusted `loadRowDocumentText` snapshot, and successful regeneration replaces the cell's provenance with the new exact set.

`classifyTabularCellProvenance` and `loadTabularCellProvenance` require all of the following before a cell is `trusted`:

- provenance parses as a non-empty, duplicate-free version-ID array;
- the row has an expected source-document set;
- every recorded version exists and belongs to an expected source document;
- every source document has a current version and the recorded set exactly matches that current set;
- every recorded version is not deleted and has a trusted processing state.

An older version that is still individually trusted is `stale` once the document's active version changes. A source version that is pending, quarantined, failed, deleted, or unknown makes the cell unavailable as trusted/current output. Legacy or malformed provenance is `unverified`.

## Existing-data migration

Migration `backend/migrations/20260811_02_tabular_cell_source_versions.sql` adds the nullable `uuid[]` column and a GIN index. It deliberately does not backfill existing cells: reliable source-version provenance cannot be reconstructed from all historical rows without risking false trust. Existing null-provenance cells remain `unverified` and require regeneration before trusted use.

The array is validated against `documents` and `document_versions` at consumption time because a normal scalar foreign key cannot enforce membership for each element of a PostgreSQL array. Missing IDs, cross-document IDs, deleted rows, and unknown processing states fail closed.

## Tabular invalidation

The implementation uses consumption-time validation as the authoritative invalidation mechanism, with provenance cleared when cells are regenerated, cleared, or reset for a new generation.

| Source transition | Cell result |
|---|---|
| `ready` -> `pending_scan` | `stale`; content is redacted/not generated for trusted consumers |
| `ready` -> `quarantined` | `stale`; no model/chat use |
| `ready` -> `failed` or unknown | `stale` or `unverified`; no model/chat use |
| Active version A -> version B | A-derived cells are `stale`, not relabeled as B-derived |
| Source version deleted/missing | `unverified`; no trusted use |
| Missing/malformed provenance | `unverified`; no trusted use |

The review detail API returns `content: null` for non-trusted cells and reports `provenance_status`. Generation and regeneration refuse to send source text to the model unless the source snapshot is still trusted/current immediately before the call and before persistence.

## Internal enforcement

The trust/provenance checks are applied below the frontend boundary at these consumers:

- `backend/src/routes/tabular.ts`: review detail redaction, source extraction, generation, regeneration, clear/reset, and Tabular chat initialization;
- `backend/src/lib/chat/tools/toolDispatcher.ts`: `read_table_cells` reloads provenance from the database before returning cell content to the model;
- `backend/src/lib/userDataExport.ts`: Tabular exports annotate each cell with its current provenance status; unverified legacy cells are not silently presented as current trusted output;
- `backend/src/lib/documentVersions.ts`, `contextBuilders.ts`, and `documentOps.ts`: active-version and extraction reads reject pending/quarantined/failed/unknown versions;
- storage-byte readers and tracked-edit helpers: document bytes are loaded through the trusted active-version resolver, and the intentional in-place reuse path invalidates state before replacement.

No separate Tabular workflow consumer bypassing these boundaries was found in the repository search. Any future consumer must use the same provenance loader rather than trusting the persisted cell payload alone.

## Schema

- Canonical `backend/schema.sql`: `tabular_cells.source_document_version_ids uuid[]` plus `idx_tabular_cells_source_versions` GIN index.
- Migration: `20260811_02_tabular_cell_source_versions.sql`.
- Schema drift: passed with **54 migrations, 15 created tables, and 48 final added columns**.
- Disposable live database checks: **29/29 public tables had RLS; 0 public tables lacked RLS; 0 browser-role grants**. The new provenance column exists as nullable `uuid[]`; `document_versions.processing_state` remains non-null with `pending_scan` default.

## Focused tests

```text
npm.cmd test -- --run src/lib/__tests__/tabularProvenance.test.ts src/__tests__/integration/tabular.routes.test.ts src/lib/__tests__/documentVersionSecurity.test.ts src/lib/__tests__/documentVersions.test.ts src/lib/__tests__/documentScanning.test.ts src/lib/__tests__/docxTrackedChanges.test.ts
```

Result: **6 files passed; 103 tests passed**.

```text
npm.cmd test -- --run src/__tests__/integration/documentsEditResolution.routes.test.ts
```

Result: **1 file passed; 3 tests passed**. This covers successful immutable accept, scan failure with no write/insert, and optimistic pointer loss cleanup.

```text
npm.cmd test -- --run src/lib/__tests__/tabularProvenance.test.ts src/__tests__/integration/tabular.routes.test.ts
```

Result: **2 files passed; 43 tests passed**, including stale active-version, missing-provenance, and route redaction coverage.

## Full regression

Backend command:

```text
npm.cmd test -- --reporter=dot
npm.cmd exec -- tsc --noEmit
npm.cmd run build
```

Result: **48 test files passed, 7 skipped; 553 tests passed, 24 skipped (577 total)**. Backend typecheck and build passed.

Frontend contract check, run directly because the local `node_modules/.bin` link for Vitest is missing:

```text
node node_modules/vitest/vitest.mjs run --run
```

Result: **25 files passed; 236 tests passed**. The local frontend TypeScript check could not be counted as green because this workspace install lacks Next declaration files and reports one existing JSX typing error; no dependency or frontend source was changed to hide that environment issue. Word/backend contracts were not changed, so the prior focused Word evidence remains the applicable evidence for this narrow backend remediation.

Repository schema drift passed as recorded above. The prior pinned workflow-freshness evidence remains unchanged; this narrow remediation did not modify workflow source or generation inputs. `git diff --check` is part of the closing repository check.

## Real-stack proof

The disposable Supabase/HTTP/R2-local stack was run with the opt-in real-stack environment and no production services:

```text
npm.cmd test -- --run src/__tests__/integration/stack.supabase.test.ts src/__tests__/integration/access.supabase.test.ts src/__tests__/integration/tabularPagination.supabase.test.ts src/__tests__/integration/realAuthorization.supabase.test.ts src/__tests__/integration/oauthClaim.supabase.test.ts src/__tests__/integration/doc01.supabase.test.ts src/__tests__/integration/doc01Round2.supabase.test.ts
```

Result: **7 files passed; 24 tests passed**.

The three Round 2 real-stack tests proved:

- tracked-edit accept leaves the prior version ready and unchanged, creates a distinct `user_accept` version, and moves the pointer only to the scanned new version;
- scanner-unavailable rejection returns a failure, leaves the active pointer unchanged, and does not create a new trusted version;
- a Tabular cell persists the exact source-version array, is readable while the source is trusted/current, and is redacted with stale provenance after the source version is quarantined.

The live schema/RLS assertions also confirmed the provenance column, the `pending_scan` default, 29/29 RLS coverage, and zero browser grants.

## Files changed

Round 2 implementation and evidence files:

- `backend/src/routes/documents.ts`
- `backend/src/lib/chat/tools/documentOps.ts`
- `backend/src/lib/tabularProvenance.ts`
- `backend/src/routes/tabular.ts`
- `backend/src/lib/chat/types.ts`
- `backend/src/lib/chat/tools/toolDispatcher.ts`
- `backend/src/lib/userDataExport.ts`
- `backend/schema.sql`
- `backend/migrations/20260811_02_tabular_cell_source_versions.sql`
- `backend/src/lib/__tests__/tabularProvenance.test.ts`
- `backend/src/__tests__/integration/documentsEditResolution.routes.test.ts`
- `backend/src/__tests__/integration/tabular.routes.test.ts`
- `backend/src/__tests__/integration/doc01Round2.supabase.test.ts`
- `docs/vaultr-rebuild/DOC_01_REMEDIATION_ROUND_2.md`
- `docs/vaultr-rebuild/DOC_01_REMEDIATION.md`
- `docs/vaultr-rebuild/DOCUMENT_INGESTION_THREAT_MODEL.md`
- `docs/vaultr-rebuild/FINAL_REVERIFICATION_FINDINGS.md`
- `docs/vaultr-rebuild/PROGRESS.md`

No frontend or Word source change was made for this remediation.

## Remaining DOC-01 concerns

Both findings are implemented as **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**. An independent/adversarial audit must still inspect the complete mutation inventory, race behavior, and every model/workflow/export boundary. The final base gate remains **NO** until that audit passes. The other non-DOC-01 production/deployment findings recorded by the final re-verification are outside this narrow task and remain unchanged.

## Git

No commit was created. No tag was created. Nothing was pushed and no PR was opened.

## Final statement

**DOC-01-A AND DOC-01-B REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**

## Overnight Stage A additions

The later overnight mission found four broader conversion blockers and added
the following closure work without changing the DOC-01 trust invariant:

- Tabular chat assistant history now carries explicit derived provenance and
  is revalidated server-side before `runLLMStream`; caller replay is not a
  trusted history source.
- Account portability export now includes `provenance_status` per Tabular
  cell and redacts inaccessible foreign source metadata.
- All runtime document pointer promotions route through a trusted candidate
  validation and expected-current CAS helper.
- The schema snapshot has an explicit baseline/ledger contract and actual
  empty-database bootstrap verification.

These additions are recorded as **REMEDIATED — PENDING STAGE B VERIFICATION**.
They do not change the required independent final gate or permit a YES freeze.

## Stage B independent DOC-01 re-audit - B-05 blocker

Date: 2026-08-12. The live DOC-01 direct-upload, copy, replacement, tracked
resolution, scan-failure, and Tabular provenance scenarios passed **6/6** on
the Node 22 local stack with disposable S3-compatible storage. The expected
LibreOffice-unavailable PDF fallback was observed; no trusted DOCX lifecycle
assertion failed.

The separate reuse-path attack found **B-05 / DOC-01-C (BLOCKER/P1)** after
source freeze. `runEditDocument` reuses an existing `document_versions` row,
clears its hash/trust, overwrites its storage object, and sets that same row
back to `ready` with the new hash before calling the expected-current CAS. A
concurrent pointer change makes the CAS return an explicit conflict but does
not roll back the row/object mutation. The independent reproduction recorded
`resultOk=false`, `pointerChanged=true`, `replaced=true`,
`versionStateAfterConflict=ready`, `hashAfterConflict=new-hash`, and
`integrityFinding=true`.

This violates immutable historical versions and the DOC-01 trust boundary.
The minimum remediation is an atomic reuse reservation or immutable new
version/object for every edit, with original row/object/hash/trust preserved
on conflict and a real concurrent reuse regression. It was intentionally not
fixed during Stage B.

DOC-01 final status: **BLOCKED - BASE READY FOR VAULTR CONVERSION: NO**.

## B-05 / DOC-01-C Stage A remediation

Date: 2026-08-12. The reuse-path race was fixed using immutable new version
rows and storage objects. The `reuseVersion` input remains an optimistic
expected-current check, but no branch may mutate the referenced row or object.
Each candidate is uploaded under a unique path, inserted with an untrusted
state, finalized from its own hash, and promoted by the central expected-current
CAS. Candidate-only cleanup runs on all failed paths, including a promotion
conflict.

Real persisted coverage passed **3/3** on a fresh disposable stack:

- sequential same-turn reuse succeeds without changing the old row/object;
- an already-stale reuse attempt fails before mutation; and
- two concurrent reuse attempts produce one winner and one explicit loser,
  preserve the original row/object bytes/hash/trust/processing state, leave no
  in-place replacement, and leave the winner ready/trusted/active.

A second fresh stack passed the complete **9-file / 31-test** integration
matrix. This is the Stage A remediation record; the required frozen-source
independent DOC-01/B-01 through B-04 audit remains pending.

## B-05 / DOC-01-C - final frozen re-verification

Date: 2026-08-12 (Asia/Singapore). Stage B ran after the exact source-freeze
boundary and independently exercised the compiled `runEditDocument` path,
not merely the Stage A test. Sequential reuse, stale reuse, and a persisted
real concurrent race all passed. The concurrent race produced exactly one
promotion and one explicit loser failure; the original row identity, bytes,
storage object, hash, processing/trust state, and path were unchanged; the
winner was ready/trusted/active; and no candidate row/object was left in place
for the loser.

The complete real-stack matrix passed **9 files / 31 tests**, covering direct
upload, copy, replacement, tracked-change resolution, scanner failure,
Tabular provenance, account-export redaction/status, authorization, and the
new reuse suite. A separate real concurrent trusted-promotion CAS attack
passed one winner and one explicit conflict. The frozen static inventory
covered standard upload, version upload, replacement, tracked resolution,
all `runEditDocument` branches, reuse, copy, replication, generated files,
conversion, recovery, and cleanup. No trusted row/hash/object mismatch was
found.

DOC-01 status for this remediation round: **CLOSED**.

**BASE READY FOR VAULTR CONVERSION: YES**

Only the hardened foundation freeze is authorized next; Vaultr product
conversion remains outside this mission.
