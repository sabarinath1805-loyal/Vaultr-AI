# Document Ingestion Threat Model

## Scope and trust boundaries

The upload and read paths accept user-controlled bytes, filenames, MIME metadata, document IDs, and document contents. Bytes are held in memory by Multer, stored in object storage, optionally converted by LibreOffice, parsed by document libraries, and then placed into model context. A collaborator may also cause an accessible project document to be read or edited depending on route policy.

## Accepted formats and limits

The backend accepts PDF, DOCX/DOC, XLSX/XLSM/XLS, PPTX/PPT, and related configured Office extensions. Upload handling uses one file with a 100 MB limit. Filenames are sanitized for storage/download names. There is no general parser-level page, slide, row, cell, XML-node, decompression-ratio, memory, or CPU budget in the inspected path.

## Parser/converter map

| Input | Processing | Main threat |
|---|---|---|
| PDF | `pdfjs-dist` page text extraction | Huge page count, malformed PDF CPU/memory use, full-buffer retention |
| DOCX | ZIP/XML/accepted-view extraction; `mammoth` fallback | ZIP/XML expansion, XML recursion/injection, malformed tracked-change structures |
| DOC/PPT legacy | LibreOffice conversion to PDF, then PDF extraction | Untrusted converter child process, resource exhaustion, temporary-file/path issues |
| XLSX/XLSM/XLS | SheetJS workbook parse and used-range-to-text conversion | Huge dimensions, formula/shared-string expansion, XLSM content, memory use |
| PPTX | JSZip/XML slide text extraction | ZIP expansion, XML complexity, unbounded slide count |
| Stored versions | S3/object-storage download into an ArrayBuffer | Memory pressure and orphaned objects after partial failure |

## Existing mitigations

- Explicit extension allowlist and 100 MB upload limit.
- User/document/project access checks before reading stored bytes.
- Storage paths are generated from document/version identifiers rather than trusted filenames.
- No macro execution was found; XLSM is parsed as data, not launched in Excel.
- Legacy conversion uses a separate converter path rather than executing document content in the web process.
- Upload and version routes clean up some newly-created storage objects after database failure.

## Residual threats

1. **Resource exhaustion (P1):** a 100 MB compressed archive can expand far beyond memory-safe limits; workbook dimensions and page/slide counts are not capped.
2. **Converter escape (P1):** LibreOffice is not visibly sandboxed, bounded by a per-operation timeout, or isolated under a low-privilege worker in the repository.
3. **XML/parser advisories (P1):** the dependency audit reports `@xmldom/xmldom`, `fast-xml-parser`, `mammoth`, and related high advisories in runtime-reachable paths.
4. **Synchronous request pressure (P1):** parsing/conversion is performed in request paths without a durable queue or uniform cancellation budget.
5. **Partial persistence (P2):** storage/database failures can leave orphaned objects; cleanup is best effort in several paths.
6. **Content-to-model injection (P1):** extracted text is untrusted prompt material. The chat path nonce-fences Word context, but documents can still contain instructions that influence model behavior.
7. **Sensitive intermediate material (P1):** extracted text can appear in model requests, raw LLM debug logs when enabled, and temporary converter files.
8. **Download amplification (P2):** `downloadFile` reads complete objects into memory before parsing or response construction.

## Required Gate 3 controls

- Run parsers in isolated workers/containers with memory, CPU, wall-clock, and process limits.
- Enforce ZIP entry count/expanded-size limits and parser-specific page/slide/row/cell limits.
- Add safe fixtures for malformed PDFs, nested ZIP/XML, formula-heavy spreadsheets, XLSM, and converter failures.
- Add malware scanning and a quarantine/review state before broad sharing or model ingestion.
- Define storage lifecycle, orphan cleanup, and deletion verification.
- Redact document contents from normal logs and disable raw provider capture by deployment policy.
- Establish a bounded extraction representation before model context assembly.

## Gate 2 conclusion

The type allowlist, ownership checks, and no-macro execution posture are useful controls. The absence of parser/converter resource isolation and the runtime dependency advisories prevent a production ingestion sign-off.

## Hardening Phase 1 implementation update

- Multer's 100 MB in-memory limit remains the ingress ceiling; uploads now validate MIME type where trustworthy and require PDF, OLE, or extension-matching Office ZIP magic/container markers.
- Office ZIPs are bounded to 2,000 entries and 250 MB declared uncompressed size. Spreadsheet sheets are bounded to 100,000 cells; presentations to 500 slides; extracted text to 2,000,000 characters; PDFs to 500 pages.
- LibreOffice conversion uses private temporary directories and `execFile` timeout/kill options (default 120 seconds, configurable only within a 5-minute ceiling). Failed initial uploads delete created source/PDF objects and mark the record in error.
- Malware scanning, quarantine, and a hardened worker/container profile remain deployment-level blockers; parser limits are resource controls, not malware detection.

## Hardening Phase 2 update

- Document rows and versions now carry explicit processing states, scan status/provider, attempt count, completion time, and bounded failure detail.
- `documentScanning.ts` provides a scanner command boundary with no shell, private temp input, timeout, clean/quarantine/unavailable/error/bypass results, and fail-closed production behavior.
- `documentRecovery.ts` defines legal transitions, explicit quarantine review before retry, and bounded persisted error detail.
- `Dockerfile.document-converter` describes the non-root LibreOffice image boundary; deployment wiring, network policy, resource limits, and scanner selection remain unverified.
- The local unit contract tests prove production scanner absence is unavailable, development bypass is explicit, quarantine is not processable, invalid PDF output is rejected, and recovery transitions are constrained.

## DOC-01 remediation update

The former alternate-version scan bypass is remediated, pending independent re-verification. Every discovered version create/copy/replace path now starts with `pending_scan`, invokes the existing scanner lifecycle on the exact bytes before conversion/promotion, and promotes the version to `ready` only after a successful scan. The canonical database default is also `pending_scan` through `20260811_01_document_version_untrusted_default.sql`, preserving historical persisted states.

`documentVersionSecurity.ts` is the fail-closed trust helper. `loadActiveVersion` and `attachActiveVersionPaths` refuse or hide non-trusted versions, chat context and `read_document` cannot fall back to stale storage paths, and Tabular Review receives no storage path for an untrusted active version. Active-pointer updates occur only after promotion; replacement rows are reset to pending before their bytes change. Authorized raw download remains separate from trusted AI processing.

The focused and full Node 22 suites are green, schema drift passes across 53 migrations, and the opt-in real Supabase DOC-01 test covers direct upload, from-document copy, replacement, pending default, and pending-active display refusal. Scanner/converter deployment wiring and broader independent final-gate verification remain outstanding.

## DOC-01 Final Blocker Remediation Round 2

Date: 2026-08-11. Both narrow DOC-01 findings are **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**. The final hardened-base gate remains **NO**.

Tracked-change resolution in `backend/src/routes/documents.ts` no longer overwrites the trusted active object. The route is owner-authorized, resolves the candidate in memory, scans the exact resulting bytes, stores them at a fresh version-specific DOCX/PDF path, inserts a `pending_scan` version, promotes only after the successful scan, and uses an optimistic current-version pointer update. Scan, storage, database, and pointer-race failures leave the old active version in control and make any candidate unavailable or failed. The turn-scoped `runEditDocument` reuse path is the only intentional in-place overwrite found; it resets processing state and clears the hash before replacement and only finalizes after the candidate scan succeeds.

Tabular Review cells now persist `source_document_version_ids uuid[]` with a GIN index. The generation snapshot records the exact trusted current version for every source document in a row, including grouped rows with multiple sources. Consumption validates existence, document ownership, exact current-version match, deletion state, and `document_versions.processing_state`. A source transition to pending, quarantined, failed, deleted, unknown, or malformed provenance is stale/unverified and cannot enter trusted UI content, Tabular chat/model context, regeneration, or current export output. Active-version changes make old derived results stale rather than silently relabeling them. Existing cells are not backfilled because historical provenance cannot be established safely; null provenance is fail-closed and requires regeneration.

The additive migration `20260811_02_tabular_cell_source_versions.sql` and canonical schema passed drift verification at **54 migrations**. The Round 2 focused suites and the disposable Supabase/HTTP real-stack suite passed as recorded in `docs/vaultr-rebuild/DOC_01_REMEDIATION_ROUND_2.md`. These controls narrow the DOC-01 findings only; parser resource isolation, scanner/converter deployment wiring, and other final-gate/deployment findings remain outside this remediation.
