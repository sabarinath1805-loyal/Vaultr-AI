# DOC-01 Security Blocker Remediation

Date: 2026-08-11<br>
Status: **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**

## Security invariant

`document_versions.processing_state` is the trusted-content boundary. New versions start as `pending_scan`. Only `clean` or `ready` are trusted states; `uploaded`, `pending_scan`, `processing`, `quarantined`, `failed`, missing values, and unknown values fail closed. New write paths scan exact bytes before promoting a version to `ready` or changing the active pointer.

Download authorization remains separate from trusted AI processing. An authorized raw download may be allowed by the existing download policy, but it does not make a version available to extraction, model context, workflows, Tabular Review, indexing, or conversion.

## Creation and replacement paths

| Path | Source bytes/content | Initial state | Scan lifecycle | Downstream gate |
|---|---|---|---|---|
| `backend/src/routes/documents.ts:456-648` — `POST /single-documents/:documentId/versions/from-document` | Trusted active source version bytes | Explicit `pending_scan` insert | `scanVersionContent` runs before storage/conversion; failure is audited; success promotes to `ready` before `current_version_id` changes | `loadActiveVersion` and `attachActiveVersionPaths` reject non-trusted versions |
| `backend/src/routes/documents.ts:654-842` — `POST /single-documents/:documentId/versions` | Multer upload bytes after file validation | Explicit `pending_scan` insert | Scanner runs before upload/conversion; success promotes to `ready` before active pointer update | Same centralized active-version gate |
| `backend/src/routes/documents.ts:877-1074` — `PUT /single-documents/:documentId/versions/:versionId/file` | Multer replacement bytes after file validation | Existing row is reset to `pending_scan` during replacement | Scanner runs before replacement; success promotes the exact row back to `ready` | Existing current pointer becomes unusable while pending; trusted consumers cannot race through replacement |
| `backend/src/routes/documents.ts:1417-1660` — initial standalone upload | Multer upload bytes | Document and V1 version start pending | Existing scanner runs before storage/conversion; version is inserted pending, promoted after successful scan, then activated | Centralized active-version gate |
| `backend/src/routes/projects.ts:631-780` — project copy of an existing document | Trusted active source bytes | New document and version start `pending_scan` | Source is resolved through `loadActiveVersion`; bytes are scanned before copy/conversion; success promotes version and document before pointer update | Centralized active-version gate |
| `backend/src/routes/projects.ts:1069-1251` — initial project upload | Multer upload bytes | Document and V1 version start pending | Existing scanner runs before storage/conversion; version promotes before pointer update | Centralized active-version gate |
| `backend/src/lib/chat/tools/documentOps.ts:541-644` — `generateDocx` persistence | Generated DOCX bytes after package validation | Document/version start pending | Scanner runs before storage; version promotes before pointer update | Context and active-version helpers gate reads |
| `backend/src/lib/chat/tools/documentOps.ts:1003-1123` — generated XLSX/PPTX persistence | Generated Office bytes | Document/version start pending | Scanner runs before storage and any PDF conversion; version promotes before pointer update | Context and active-version helpers gate reads |
| `backend/src/lib/chat/tools/documentOps.ts:1180-1418` — `runEditDocument` new version or `reuseVersion` overwrite | Tracked-edit output bytes | New row starts pending; reused row is reset to pending before replacement | Scanner runs on edited bytes; reused row is promoted after replacement; new row is promoted before pointer update | `loadCurrentVersionBytes`/`loadActiveVersion` reject pending state |
| `backend/src/lib/chat/tools/toolDispatcher.ts:1615-1858` — `replicate_document` | Bytes from a trusted active version | New documents/versions start pending | Source is re-scanned before bulk storage; versions promote before per-document active pointers | Source active resolver and context path reject untrusted versions |
| `backend/schema.sql:325-343` plus `backend/migrations/20260811_01_document_version_untrusted_default.sql` | Direct database inserts | Database default is `pending_scan` | No direct insert can silently inherit trusted `ready` | Centralized consumers fail closed even if a caller writes an unknown state |

Seed/fixture inserts in tests and cleanup/export queries do not create trusted content paths. No production import or restore code was found that inserts `document_versions`; restored historical rows retain their persisted state for compatibility and are still rejected if missing/unknown/untrusted.

## Central trust helper

`backend/src/lib/documentVersionSecurity.ts` provides:

- `classifyDocumentVersionState` for pending, trusted, quarantined, failed, processing, and unknown states.
- `isDocumentVersionTrusted`, which returns true only for `clean` and `ready`.
- `assertDocumentVersionTrusted`, which throws on unknown or untrusted values.
- `scanVersionContent`, which maps the existing scanner result into the canonical state and trusted boolean.

Unknown and missing states are not coerced to legacy trust.

## Downstream enforcement

- `backend/src/lib/documentVersions.ts:69-113` refuses an active version unless it belongs to the document, is not deleted, has storage, and is trusted.
- `backend/src/lib/documentVersions.ts:121-198` removes storage paths from list/context rows when the active version is not trusted.
- `backend/src/lib/chat/contextBuilders.ts:538-569` and `:596-660` therefore exclude pending/quarantined/unknown versions from chat/model context and project context.
- `backend/src/lib/chat/tools/documentOps.ts:1188-1238` loads edited bytes only through the trusted active resolver.
- `backend/src/lib/chat/tools/documentOps.ts:1576-1660` refuses extraction without a trusted database-resolved active version and no longer falls back to stale `docStore.storage_path`.
- `backend/src/routes/tabular.ts:435-468` receives only paths attached by the gated helper, so Tabular Review extraction skips untrusted versions.
- Project-copy and document-replication sources resolve through `loadActiveVersion`; they cannot copy untrusted bytes into another trusted context.
- Display, URL, tracked-change, and conversion paths using `loadActiveVersion` refuse untrusted versions. Raw signed download remains an access decision and is not treated as AI trust.

## Active-version behavior and race prevention

The active pointer is allowed to exist while a version is pending, but trusted consumers reject it. New and replacement paths scan exact bytes before setting `ready`; they promote the version before changing `documents.current_version_id`. During an in-place edit replacement, the current row is reset to `pending_scan` before its storage bytes/metadata are changed, so concurrent trusted reads fail closed. Delete fallback selection now chooses only trusted remaining versions.

## Security events

Scanner rejection continues to emit `document.quarantine`. Scanner unavailable/error paths emit `document.scan.failure` with only status/provider/state metadata. No document content, extracted text, credentials, or storage bytes are logged in these events.

## Verification performed

Focused Node 22 run:

```text
npm.cmd test -- --run src/lib/__tests__/documentVersionSecurity.test.ts src/lib/__tests__/documentVersions.test.ts src/lib/__tests__/documentScanning.test.ts src/__tests__/integration/documentsUpload.routes.test.ts src/__tests__/integration/projects.routes.test.ts src/__tests__/integration/tabular.routes.test.ts src/__tests__/integration/projectChat.routes.test.ts
```

Result: **7 files passed; 115 tests passed**.

Full backend Node 22 run:

```text
npm.cmd test -- --reporter=dot
npm.cmd exec -- tsc --noEmit
npm.cmd run build
node scripts/check-schema-drift.mjs
```

Result: **46 files passed, 5 skipped; 540 tests passed, 18 skipped**. Typecheck/build passed. Schema drift passed with **53 migrations, 15 created tables, 47 final added columns**.

Opt-in real-stack DOC-01 run:

```text
npm.cmd test -- --run src/__tests__/integration/doc01.supabase.test.ts
```

Result: **1 file passed; 3 tests passed**. The test exercised direct version upload, from-document copy, replacement, verified each promoted version is `ready`, proved an omitted database state defaults to `pending_scan`, and proved a pending active version returns `404 No file available` from the display boundary. The disposable database-level default check and the existing real-stack suite also passed **5 files / 18 tests**.

## Independent re-verification requirement

The previous final verification verdict remains NO. This remediation record does not authorize conversion or change that verdict. It is ready for an independent Final Hardened Base Verification Audit rerun.

## Final independent re-verification supersession (2026-08-11)

The prior `REMEDIATED - PENDING INDEPENDENT RE-VERIFICATION` closure claim is superseded by the final independent audit. Status: **BLOCKER REOPENED - PENDING REMEDIATION**.

Two production paths were missed in the prior creation/replacement inventory:

1. `backend/src/routes/documents.ts:1236-1412`, `handleEditResolution`, resolves a trusted version and overwrites its storage bytes with tracked-change-resolved output without resetting `processing_state` to `pending_scan` or scanning the new bytes. The old trusted state can therefore authorize new unscanned bytes.
2. Persisted Tabular Review cells are not bound to a source version or content hash. `backend/src/routes/tabular.ts:1606-1620` loads them and `backend/src/lib/chat/tools/toolDispatcher.ts:810-858` returns derived summaries/reasoning to the model without invalidation or a source trust recheck after quarantine/failure.

No source or test fix was made during this audit. The two paths must be remediated, regression-tested under state/race transitions, and independently re-verified before DOC-01 can close or the Vaultr conversion gate can change from NO.

## Final Blocker Remediation Round 2 (2026-08-11)

Status for both findings: **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**.

Round 2 addresses the two paths identified above without changing the final base verdict. `handleEditResolution` now uses immutable Option B semantics: it resolves and scans the exact candidate bytes, stores them at a new version-specific path, inserts a `pending_scan` version, promotes only after the scan succeeds, and changes `documents.current_version_id` with an optimistic compare-and-set. The previous trusted active version remains immutable and usable until the new version is ready. Scanner failure, storage failure, database failure, or a pointer race cannot leave the candidate trusted; newly-created objects are cleaned up best effort.

The only remaining intentional in-place document-byte path found is the turn-scoped `runEditDocument({ reuseVersion })` path in `backend/src/lib/chat/tools/documentOps.ts`. It invalidates the version state and clears its hash before overwriting the object, then marks storage/finalization failures `failed`; `ready` is written only after the exact candidate bytes have passed the scanner. All other discovered generation, replication, upload, and conversion writes use new version/object paths or the existing exact-byte scan lifecycle.

Tabular cells now persist `source_document_version_ids uuid[]`. Generation records the exact trusted current-version set used to extract the row's source text. Reads classify the set against the expected row source documents, their current pointers, version ownership/deletion state, and trusted processing state. A version switch makes A-derived content stale rather than relabeling it as B-derived; pending, quarantined, failed, deleted, unknown, missing, or malformed provenance is not trusted. Review detail redacts non-trusted content, generation/regeneration rechecks immediately before model use and persistence, Tabular chat's `read_table_cells` path rechecks at model boundary, and exports label provenance status. Legacy cells are not backfilled and remain unverified until regenerated.

Round 2 adds migration `20260811_02_tabular_cell_source_versions.sql`, the canonical schema column and GIN index, provenance and route/unit regressions, mocked edit-resolution route regressions, and an opt-in real-stack suite. The schema check passed with **54 migrations**. Focused coverage passed **6 files / 103 tests**, **1 file / 3 tests**, and **2 files / 43 tests** for the overlapping focused commands. Full backend coverage passed **48 files, 553 tests, 7 skipped files, and 24 skipped tests**; typecheck and build passed. The disposable real stack passed **7 files / 24 tests**, including successful tracked-edit versioning, scanner-unavailable failure without pointer replacement, and Tabular quarantine redaction.

The previous final-gate verdict remains **BASE READY FOR VAULTR CONVERSION: NO**. This Round 2 record does not perform or substitute for the required independent/adversarial Final Hardened Base Verification Audit.
