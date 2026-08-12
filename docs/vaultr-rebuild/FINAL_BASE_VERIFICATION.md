# Vaultr-AI — Final Hardened Base Re-Verification After DOC-01 Round 2

## BASE READY FOR VAULTR CONVERSION: NO

Audit date: 2026-08-11<br>
Repository: `C:\Users\Sabarinath.SABARI\Vaultr-AI`<br>
Branch: `master`<br>
Pre-audit HEAD: `204d2d533a075c74fc69f8b283c70fb4e94ec104`<br>
Node: `v22.13.0`<br>
npm: `10.9.2`<br>
Host: Windows PowerShell; disposable Docker/Supabase CLI `v2.108.0` used for live checks.

This was an independent, adversarial, read-only verification of the claimed DOC-01 Round 2 closure. No source, test, dependency, schema, migration, authorization, RLS, workflow, or product code was modified. Only verification documentation under `docs/vaultr-rebuild/` is being added or updated. The prior failed audits remain intact.

The broad runtime baseline is strong, but the gate fails for four independently observed reasons:

1. Tabular chat accepts and forwards caller-supplied historical messages verbatim after current-cell provenance filtering. A stale assistant marker can therefore reach `runLLMStream` after its source version is quarantined.
2. The required clean database migration-chain proof fails. An empty migration chain assumes pre-existing application tables, and applying all dated migrations after the current canonical snapshot fails at `20260424_01_docx_version_display_name.sql` because it references `documents.filename`, which the current schema intentionally no longer has.
3. The account-level portability export returns raw `tabular_cells` without the `provenance_status` label used by the dedicated Tabular export.
4. Several promotion paths, including the `runEditDocument({ reuseVersion })` path, update `documents.current_version_id` without an optimistic current-pointer predicate or affected-row check. A simultaneous-promotion trace can lose a newer promotion or regress the active pointer even though the bytes remain scanned.

The first two findings are independently sufficient for a NO verdict. The latter two mean DOC-01-B and the active-version race criteria are not fully closed even if the first two are repaired.

## DOC-01-A

### Tracked-edit resolution

The independent trace of `backend/src/routes/documents.ts` confirms that the Round 2 `handleEditResolution` path itself is materially improved and passes its direct adversarial checks:

- it resolves the edit in memory;
- it scans the exact resolved bytes before storing them;
- a scan failure records failure and returns without creating a candidate object or advancing the pointer;
- a successful candidate is stored under a new `versionStorageKey` path;
- the inserted `document_versions` row starts at `pending_scan`;
- the old trusted version remains active while the candidate is scanned/stored;
- the candidate is promoted to `ready` only after the scan and storage/row operations succeed;
- the pointer update includes both `document_id` and the expected old `current_version_id` and requires a returned row;
- a lost pointer race marks the candidate failed, deletes candidate objects, and returns `409`;
- storage, insert, finalization, and pointer failures do not make the candidate active.

The focused route security suite passed 3/3 tests. The real disposable stack passed the Round 2 lifecycle tests, including successful immutable promotion, scanner-required failure with the old pointer preserved, and Tabular quarantine redaction.

### Gate verdict

`handleEditResolution`: **PASS for the tested DOC-01-A sequence**.<br>
DOC-01-A as a complete conversion gate: **NOT CLOSED**, because the separate in-place/reuse path and the broader promotion inventory do not provide the same optimistic pointer protection. The trust invalidation around the reuse path is fail-closed, but a simultaneous promotion can still lose or regress activation.

## DOC-01-B

### Provenance storage and current-cell reads

The schema and helper trace are positive:

- `backend/schema.sql` contains `tabular_cells.source_document_version_ids uuid[]`.
- `idx_tabular_cells_source_versions` is a GIN index.
- `parseSourceDocumentVersionIds` rejects null, empty, malformed, blank, and duplicate IDs.
- `classifyTabularCellProvenance` verifies that every referenced version exists, belongs to an expected row document, is the current version set, is not deleted, and has a trusted processing state.
- legacy/missing provenance is `unverified`.
- an old trusted version after an active-version change is `stale`.
- pending, quarantined, failed, processing, deleted, unknown, wrong-document, and missing version states do not become trusted.
- current Tabular API reads, generation/regeneration, and `read_table_cells` call the centralized helper or the equivalent current-source check.

The real Round 2 test persisted an exact source version ID and then changed that version to `quarantined`; the HTTP-facing cell response became `content: null` with `provenance_status: "stale"`.

### Missed consumers

Two independent boundary gaps remain:

1. `backend/src/lib/userDataExport.ts:131-175` correctly labels cells in `buildUserTabularReviewsExport`, but `buildUserAccountExport` at `:387-407` separately loads `tabular_cells` and returns them raw at `tabular_cells: tabularCells`. `/user/export` calls that builder at `backend/src/routes/user.ts:1116`. A portability export containing stale, quarantined, failed, or legacy cells therefore has no explicit provenance status. This is not itself a model call, but it violates the stated export contract and prevents DOC-01-B from being considered fully closed.
2. `backend/src/routes/tabular.ts:1621-1666` builds model messages by appending every caller-supplied `messages` entry verbatim. The route first filters current cells at `:1709-1759`, but then passes the unfiltered request history into `buildTabularMessages` at `:1814`; `runLLMStream` receives that result. `GET /:reviewId/chats/:chatId/messages` also returns raw message content and annotations at `:1566-1572`, so a normal client replay can carry an old assistant response forward.

## Mutation inventory

| Path | Candidate storage behavior | Trust behavior | Independent result |
|---|---|---|---|
| `handleEditResolution` | New version-specific DOCX/PDF object paths | Exact candidate scan, pending row, ready promotion, CAS pointer, cleanup on loss/failure | Trust sequence passes; separate race finding remains elsewhere |
| Direct document version upload/copy | New version-specific path | Scan before upload; row starts pending and becomes ready after successful scan | No trusted-byte preservation found |
| Project copy/generated/replication paths | New object/version paths | Exact bytes scanned and version rows initialized untrusted before ready promotion | Trust boundary is present; pointer CAS is not uniform |
| `PUT /versions/:versionId/file` | Fresh version-specific object key rather than overwriting the old object | Existing row is moved through untrusted state and finalized after the new bytes are stored | No direct trusted-object overwrite found |
| `runEditDocument({ reuseVersion })` | In-place overwrite of `reuseVersion.storagePath` | Candidate is scanned before invalidation; processing state is set to `pending_scan`, hash cleared before upload, upload/finalization failures set `failed` | No old trust is preserved; no CAS/current-version check and no affected-row verification |
| DOCX/OOXML conversion | In-memory byte transformation before storage | Caller controls scan/storage lifecycle | No separate direct object mutation found |
| `storage.uploadFile` | S3 `PutObject` helper; same-key replacement is possible only when a caller supplies the old key | No trust policy in the storage helper itself | Callers remain the enforcement boundary |

No third category was found in which an in-place byte mutation deliberately leaves the old trusted state in place. The reuse path does invalidate trust before mutation. The remaining gate issue is the promotion race and the absence of a single fail-closed transactional pointer primitive.

## Active-version race

The successful `handleEditResolution` race test is real and passed: its pointer update uses `eq("current_version_id", active.id)`, checks the returned row, and cleans up on a lost race.

The broader simultaneous-promotion attack does not pass the required standard. In `runEditDocument`, the reuse path can:

1. read Version A as active;
2. scan edited bytes derived from A;
3. invalidate and replace A’s object;
4. finalize A as ready; and
5. update `documents.current_version_id` with only `.eq("id", documentId)` at `backend/src/lib/chat/tools/documentOps.ts:1438-1443`.

If another request promotes Version B between steps 1 and 5, the reuse request can write the pointer back to A. The new bytes are scanned, so this is not an unscanned-byte trust leak, but it is a lost promotion/inconsistent activation. The standard document upload/copy and replication pointer updates also do not uniformly use an expected-current predicate. No affected-row count is required on several of these updates.

Verdict: **FAIL for the explicit “two simultaneous promotions must prevent lost updates/inconsistent activation” criterion.**

## Tabular provenance

The exact source-version column, GIN index, helper classifications, current-version comparison, wrong-document rejection, duplicate rejection, and real ready-to-quarantine API scenario all passed. The helper is not an authorization helper by itself; its callers must establish review/document access. Route-level creation/update/regeneration paths filter accessible document IDs before deriving or persisting source IDs.

The remaining result is **not proven closed** because the account export and chat-history paths are direct consumers that do not apply the same policy. A correct current-cell map cannot protect a raw historical message that is appended later to the model request.

## Tabular quarantine/failed-state attack

The real stack confirmed `ready → quarantined` redaction through the Tabular review HTTP response. Unit coverage also confirms stale/unverified classifications for active-version changes, unknown states, malformed arrays, wrong-document versions, and missing rows.

The centralized helper would fail closed for `failed`, `pending_scan`, `processing`, deleted, and unknown versions when those states are reached by a current-cell read or `read_table_cells`. However, the chat-history replay attack is state-independent after a stale response has already been persisted or delivered: the route does not reclassify old `messages` content. The account-level export likewise does not label the state. Therefore the end-to-end quarantine/failed-state gate is **FAIL**.

## Model/chat/workflow boundary

### Document context

The static document-consumer search found the centralized trusted-version path in active-version resolution, context builders, extraction, replication, `read_document`, and related document reads. Unknown/pending/quarantined/failed version states are rejected or stripped of storage paths. No direct trusted document-version read bypass was confirmed in the audited consumer paths.

### Tabular model context

The current `tabularStore` and `read_table_cells` path only expose trusted current cells. That control is bypassed by the separate conversation-history path:

```text
client replays assistant message containing marker from Version A
        ↓
POST /tabular-review/:reviewId/chat messages[]
        ↓
buildTabularMessages appends raw msg.content
        ↓
apiMessages
        ↓
runLLMStream
```

After Version A is quarantined, `tabularStore` contains no trusted content, but the replayed historical marker is still in `apiMessages`. This is a confirmed code-path blocker even without making a provider call.

### Workflow context

No direct raw `tabular_cells` workflow loader was found in the backend search. Generated workflow instructions are a separate instruction boundary. Document-backed workflow context uses the trusted document-version helpers. That does not repair the Tabular chat-history bypass.

## Tenant isolation

The live owner/shared-reader/outsider HTTP suite passed, along with the broader access, project, document, Tabular pagination, DOC-01, and OAuth stack tests. The route inventory shows document IDs are filtered through `filterAccessibleDocumentIds` on review creation/update/generation, and the provenance helper rejects a version that belongs to a document outside the row’s expected document set.

No confirmed cross-tenant provenance injection was reproduced. The residual evidence gap is that the existing real HTTP matrix does not create three users and attempt every source-version substitution against Tabular cells, exports, and chat history. Because the backend uses a service-role client, route-level authorization remains material; the absence of a confirmed tenant exploit is not treated as a substitute for that missing adversarial test.

## RLS

On the disposable stack after loading the canonical schema:

- public backend-owned tables: `29`;
- RLS-enabled tables: `29/29`;
- direct `anon`/`authenticated` table-grant rows: `0`;
- `tabular_cells.source_document_version_ids`: `uuid[]`, nullable;
- `idx_tabular_cells_source_versions`: present as a GIN index.

The real access/OAuth/authorization matrix passed against Supabase Auth/Postgres. The service-role architecture still means route authorization is the primary application boundary.

## Node 22

The final baseline commands explicitly prepended:

```powershell
$node22='C:\Users\Sabarinath.SABARI\AppData\Local\nvm\v22.13.0'
$env:Path="$node22;$env:Path"
```

Observed runtime: Node `v22.13.0`, npm `10.9.2`, Windows PowerShell.

## Backend

- Clean install: `npm.cmd ci` completed; 466 packages added and 467 audited.
- TypeScript/build: passed under Node 22.
- Full suite: **48 test files passed, 7 skipped; 553 tests passed, 24 skipped**.
- Focused provenance/document/edit suite: **7 files, 108 tests passed**.
- MCP/LLM privacy/OAuth focused suite: **3 files, 14 tests passed**.
- Production dependency audit: one moderate advisory in `@anthropic-ai/sdk`; no high advisory.

## Frontend

- Clean install: `npm.cmd ci` completed; 1,246 packages added and 1,247 audited.
- TypeScript: passed under Node 22.
- Unit tests: **25 files, 236 tests passed**.
- Lint: passed with **0 errors and 37 warnings**.
- Production build: passed with Next.js `16.3.0`; 23 static pages generated.
- Production dependency audit: **4 moderate**, no high; the `uuid` advisory has no available fix in the current dependency path.

## Word

- Clean install: `npm.cmd ci` completed; 934 packages added and 935 audited.
- TypeScript: passed.
- Production webpack build: passed; the production manifest was generated using the synthetic HTTPS URL `https://example.com` and contained no local URL.
- Playwright E2E: **64/64 passed** with one worker.
- Production dependency audit: **0 vulnerabilities**.
- Dev-inclusive install audit still reports 19 total vulnerabilities (4 low, 7 moderate, 8 high); these are not in the production dependency audit but remain pilot/production upgrade work.

## Real stack

A newly named disposable Supabase CLI `v2.108.0` stack was used. No hosted Supabase or production object storage was touched. The corrected final command supplied both the `SUPABASE_TEST_*` variables and the Express app’s `SUPABASE_URL`/`SUPABASE_SECRET_KEY`, plus local S3-compatible storage and a synthetic download-signing secret.

Final result: **7 files passed, 24 tests passed**. This included:

- stack Auth/RLS and direct browser-role denial;
- access and pagination;
- owner/shared/outsider real HTTP authorization;
- atomic OAuth claim;
- DOC-01 direct upload/copy/replacement lifecycle;
- DOC-01 Round 2 immutable resolution, scan failure, and quarantine/provenance lifecycle.

The initial run without the app variables produced configuration-induced HTTP 500s; it was not counted as evidence. The corrected rerun passed 24/24. The stack, data volume, exact temporary directory, prior Phase 2 temporary directory, and pinned workflow checkout were stopped/removed after verification.

## OAuth

The real disposable OAuth claim test passed 1/1. The focused state suite covered replay, expiry, wrong-state, wrong-user, redirect/configuration, and absent-credential contracts. No provider authorization-code exchange against a hosted identity provider was attempted; that remains deployment/pilot evidence, not a basis for a YES.

## MCP

The MCP SSRF suite passed its HTTPS/invalid/localhost/private-IP/DNS-mixed-record/redirect/dispatcher cases. The MCP OAuth state and raw-stream privacy tests were included in the **14/14** focused result. No new MCP blocker was found.

## Dependencies

Fresh Node 22 production audits:

| Package | Result |
|---|---|
| Backend | 1 moderate (`@anthropic-ai/sdk`); 0 high |
| Frontend | 4 moderate (`uuid` through Fortune Sheet/ExcelJS); 0 high |
| Word production | 0 vulnerabilities |

No dependency modification or `npm audit fix` was performed. The backend advisory requires a breaking SDK upgrade for the available fix; the frontend advisory has no available fix. Neither is a meaningful runtime High under this gate, but both remain recorded risk.

## Schema

The repository drift script passed independently:

`Schema drift check passed: 54 migrations, 15 created tables, 48 final added columns.`

The live canonical schema loaded successfully with PostgreSQL `ON_ERROR_STOP=1`, and the actual provenance type/index/RLS/grant queries passed. The required complete migration-chain test did not pass:

- on an empty disposable database, the first migration `20260419_tabular_chat_jsonb.sql` failed because `tabular_review_chat_messages` did not exist;
- after loading the canonical snapshot, sequential application failed at `20260424_01_docx_version_display_name.sql:32` with `column d.filename does not exist`;
- the current canonical schema has no `documents.filename`; the filename is on `document_versions`, and a later historical migration explicitly drops `documents.filename`.

The metrics-only drift script is therefore insufficient to establish a reproducible fail-fast install. This is a conversion blocker under the requested schema gate.

## Workflows

The configured source is `https://github.com/Open-Legal-Products/mike-workflows.git` at exact commit `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`. An exact disposable checkout was used; the checkout HEAD matched the approved SHA, 31 workflow leaves were present, and `check-workflow-freshness.mjs` regenerated an artifact byte-for-byte equal to the committed artifact.

The temporary checkout was removed after the check. The repository-default sibling source directory remains absent, so the explicit pinned checkout is still required for a fresh operator run.

## Privacy/secrets

- `git diff --check`: no whitespace errors.
- Tracked secret-like files are limited to `.env.example`, `backend/.env.example`, and `frontend/.env.local.example`; no local `.env` file is tracked or staged.
- Gitleaks current-tree scan reported seven redacted hits, all in ignored/generated `frontend/.next` metadata from the local build. A source-target scan reported three redacted generic-key hits in `backend/src/lib/__tests__/safeError.test.ts`; these are explicit synthetic fixtures, not credentials. No real current runtime secret was identified.
- Gitleaks Git-history scan reported one redacted historical generic API-key match in an older commit (`src/app/hooks/useChatStore.ts`); it is not present in the current tracked source.
- New hardening logs expose identifiers, filenames, storage paths, byte lengths, and bounded error text in development/test output; the raw-stream capture tests confirm provider credentials and content are redacted/disabled in production. No provider key, token, document bytes, extracted Tabular value, or source text was found in the new audit-path logging.

## Findings

### BLOCKER

- **B-01 — Tabular chat-history provenance bypass.** Raw replayed message content reaches `runLLMStream` after current-cell provenance filtering. This permits stale derived content to enter trusted model context.
- **B-02 — Migration-chain/schema reproducibility failure.** Neither an empty migration-only install nor the canonical-snapshot-plus-all-migrations sequence completes fail-fast.
- **B-03 — Active-version promotion race.** The reuse and several other promotion paths do not use a compare-and-swap current pointer or verify affected-row counts. Simultaneous promotions can lose a newer activation or regress the pointer.
- **B-04 — Account export provenance omission.** `/user/export` returns raw Tabular cells without `provenance_status`, so the claimed portability labeling boundary is incomplete. This is a portability path rather than a direct model path, but it leaves DOC-01-B open under the requested gate.

### MUST FIX BEFORE PILOT

- Add a three-user real HTTP provenance-substitution matrix covering document versions, Tabular reviews/rows/cells, account export, chat replay, and source-version IDs.
- Resolve the backend moderate `@anthropic-ai/sdk` advisory through an owner-approved compatible upgrade or documented compensating control.
- Resolve or explicitly accept the frontend `uuid` dependency advisory; it has no current automated fix.
- Exercise the actual production scanner/quarantine service and LibreOffice/converter container wiring rather than only their local contracts.

### MUST FIX BEFORE PRODUCTION

- Establish the supported schema bootstrap/migration contract, fail-fast migration application, migration checksums, backup/restore evidence, and hosted Supabase/R2 ownership.
- Rotate deployment secrets, configure production download/manifest signing, establish audit retention/legal hold, and complete Word identity/certificate/tenant ownership.
- Complete hosted OAuth provider redirect, email, MFA, storage, monitoring, and incident-response validation.

### DEFERRED

- Mike-to-Vaultr conversion, branding, Lex/Matters/Vault/Research/Contract Scanner product work, old Vaultr parity, navigation redesign, and upstream changes remain out of scope.

## Git freeze

The verdict is NO. No source was staged or committed by this audit. No baseline commit was created. No `vaultr-hardened-base-v1` tag exists. The working tree remains dirty from the accumulated hardening/remediation work and its prior verification history; it was not reset or cleaned.

## Push

No push was authorized or attempted. `origin` remains `https://github.com/sabarinath1805-loyal/Vaultr-AI.git`; `upstream` remains `https://github.com/Open-Legal-Products/mike.git`. Neither remote was changed by this audit.

## Remaining work

Foundation work must first close B-01 through B-04, then independently rerun the full gate. Only after that should the project decide whether to freeze/tag/push the hardened baseline. The green Node 22, frontend, Word, real-stack, RLS, OAuth, MCP, and workflow results are useful evidence but do not override the blockers.

## Final statement

The foundation still contains conversion blockers. Vaultr v2 product conversion must not begin.

## Overnight Foundation Completion Mission — Stage A evidence

Date: 2026-08-11. The four remediation changes described in
`FINAL_BLOCKER_REMEDIATION.md` are now implemented. The earlier findings and
NO verdict above are intentionally preserved as historical pre-remediation
evidence; this section does not silently rewrite that audit.

Stage A checks completed under Node `v22.13.0` / npm `10.9.2`:

| Area | Result |
|---|---|
| Backend focused blockers | Tabular provenance 8 pass; Tabular route 36 pass; promotion 7 pass; export 1 pass; edit-resolution route 3 pass |
| Backend full regression | 51 files passed, 8 skipped; 573 tests passed, 27 skipped |
| Backend build/typecheck | Passed |
| Frontend | 25 files / 236 tests passed; direct `tsc --noEmit` passed; lint 0 errors / 37 warnings; production build passed |
| Word add-in | Typecheck passed; production webpack build and HTTPS manifest generation passed; Playwright 64/64 passed |
| Canonical schema | Two empty disposable stacks bootstrapped; 55 migrations represented; repeat populated-target bootstrap failed closed |
| Live schema verification | 29/29 RLS-enabled tables; 0 direct browser grants; 1 canonical ledger row |
| Schema drift | 55 migrations, 15 created tables, 49 final added columns |
| Real Supabase Stage A matrix | 8 files / 27 tests passed, including the new hardening boundary suite |
| Workflow provenance | Exact SHA `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`; 31 workflows; byte-for-byte freshness passed from a disposable exact checkout |
| Production dependency audit | Backend 1 moderate; frontend 4 moderate; Word 0; no runtime High advisories |
| `git diff --check` | Passed; only Git line-ending normalization warnings were emitted |

The frontend package has no named `typecheck` script; the equivalent direct
TypeScript command passed. The Word production build requires a deployed
HTTPS URL; Stage A used a synthetic HTTPS origin only for manifest generation.
LibreOffice was unavailable on this host, and the DOC-01 fixture tests
explicitly tolerated conversion unavailability while still proving trust and
pointer behavior.

## Stage B status

**Stage B has not yet been performed.** Source changes are about to be frozen
for the independent adversarial review. No YES verdict, hardened source
commit, tag, or push is authorized at this point.

## Overnight Foundation Completion Mission - Stage B independent verification

Date: 2026-08-12. This section is the final verification record for the
mission. Earlier NO records and the Stage A pending section are preserved as
historical evidence. Stage B was verification-only; no source fix was made
after its boundary.

### Repository and scope controls

- Branch: `master`; HEAD: `204d2d533a075c74fc69f8b283c70fb4e94ec104`.
- `origin`: `https://github.com/sabarinath1805-loyal/Vaultr-AI.git`.
- `upstream`: `https://github.com/Open-Legal-Products/mike.git`.
- The separate `old-vaultr-backup` was not merged or inspected as product
  source for this gate.
- The working tree remains dirty from the accumulated hardening work and
  audit records. No files were staged, committed, tagged, or pushed.
- Node `v22.13.0`; npm `10.9.2`.

### Independent blocker checks

| Blocker | Stage B check | Result |
|---|---|---|
| B-01 chat replay | Live history-state matrix covering trusted, stale, pending, failed, quarantined, deleted, missing, malformed, wrong-document, outsider, and ordinary-user content; route/provider-array inspection | **Closed**. Only validated current user input and trusted persisted derived output reach model history; invalid derived output becomes the neutral marker. |
| B-02 schema/bootstrap | Two fresh disposable Supabase databases bootstrapped and verified; populated-target repeat attempted | **Closed for the documented contract**. Both fresh runs passed; repeat failed closed as required. |
| B-03 active pointer | Runtime write inventory plus live simultaneous promotion race with one expected current pointer | **Closed for the CAS boundary**. One winner, one explicit conflict, and the final pointer remained the winner. |
| B-04 account export | Live cross-tenant injected source-version row through the account-export builder | **BLOCKER remains**. Foreign content and source IDs were redacted, but the serialized status incorrectly remained `trusted` instead of `unverified`. |

### Schema/bootstrap proof

Fresh disposable stacks C and D each passed the canonical bootstrap with
PostgreSQL `ON_ERROR_STOP=1`, followed by the bootstrap verifier and drift
check. Both recorded baseline
`20260811_03_tabular_chat_provenance`, represented all 55 migration files,
verified 29/29 RLS-enabled backend public tables, and verified zero direct
anon/authenticated table grants. Re-running the bootstrap against a populated
database failed closed with the expected target-not-empty error. The stacks
were stopped after verification.

### Clean dependency and regression verification

The lockfile installs were rerun before the final checks: root/backend clean
install added 466 packages, frontend added 1246 packages, and Word added 934
packages. The installs completed without failure.

| Surface | Final clean result |
|---|---|
| Backend | 51 files passed, 8 skipped; 573 tests passed, 27 skipped; build/typecheck passed |
| Frontend | 25 files, 236 tests passed; direct `tsc --noEmit` passed; lint 0 errors / 37 warnings; production build passed |
| Word add-in | Typecheck passed; production build and HTTPS manifest generation passed; Playwright **64/64** passed |
| Real Supabase matrix | 8 files / 27 tests passed; the embedded three-user authorization suite passed 3/3, with owner/shared access and outsider denial checks |
| OAuth/MCP targeted checks | 5 files passed, 2 skipped; 20 tests passed, 4 skipped |
| RLS/grants | 29/29 backend public tables RLS-enabled; 0 direct browser-role grants |
| DOC-01 lifecycle | DOC-01 and Round 2 suites remained green in the 8-file / 27-test real-stack matrix |

The real matrix is evidence for the tested HTTP and database boundaries; it
is not a claim that every production dependency, scanner, converter, or
hosted service was available locally. LibreOffice/conversion was unavailable
on this host and the relevant fixture checks documented that limitation.

### Workflow, dependency, secret, and privacy checks

- Workflow source was the exact approved SHA
  `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`; 31 generated workflows matched
  the freshness artifact. Missing-source and wrong-SHA checks failed closed.
- Production dependency audit: root 0 vulnerabilities; backend 1 moderate
  `@anthropic-ai/sdk` advisory and no High advisories; frontend 4 moderate
  `uuid`-chain advisories with no automated fix; Word 0 vulnerabilities.
  No dependency was changed during Stage B.
- Source-target secret scanning found only the documented synthetic test
  fixtures; the seven whole-tree findings were generated/ignored Next build
  metadata. No current runtime credential was identified. Raw-stream tests
  and the privacy review found no new hardening-path logging of provider
  credentials, Tabular values, document bytes, or source text.
- `git diff --check` passed. Generated build outputs and local disposable
  service state were not converted into source changes.

### Final verdict

**BASE READY FOR VAULTR CONVERSION: NO**

The B-04 account-export status error is a remaining conversion blocker. The
minimum fix is to label foreign/inaccessible source provenance `unverified`
after redaction and add a real cross-tenant export regression test. Because
Stage B found this blocker, no hardened source commit, freeze record commit,
`vaultr-hardened-base-v1` tag, or push was created or attempted. Vaultr v2
product conversion must not begin.

## B-04 Final Remediation Mission - Stage A completion

Date: 2026-08-12. The previous B-04 Stage B finding was remediated before the
new independent audit boundary. The prior findings and NO verdict remain
historical evidence above.

### Account-export boundary

`buildUserAccountExport` now treats account ownership/accessibility as a
separate trust boundary from source-version trust. Only a complete,
exporter-resolvable source set can retain the source classification. Foreign,
inaccessible, missing, malformed, unresolved, wrong-document, duplicate,
deleted, or otherwise unverifiable provenance is serialized as `unverified`;
foreign/inaccessible content and source IDs remain redacted.

### Stage A checks

| Area | Result |
|---|---|
| B-04 unit matrix | 2 tests passed at the final serialized account-export boundary |
| Real B-04 route boundary | 4 hardening tests passed, including `GET /user/export` |
| Real authorization | Three-user owner/shared/outsider suite: 3/3 passed |
| Backend | 51 files passed, 8 skipped; 574 tests passed, 28 skipped; typecheck/build passed |
| Frontend | 25 files / 236 tests; typecheck/build passed; lint 0 errors / 37 warnings |
| Word | Typecheck/build/HTTPS manifest passed; Playwright 64/64 passed |
| Canonical schema | Two fresh bootstrap/verifier/drift runs passed; populated repeat failed closed |

No Stage B conclusion is implied by this section. The source freeze boundary
begins immediately after this Stage A record. The next action is an
independent adversarial review of B-01 through B-04 and the remaining DOC-01,
authorization, OAuth, MCP/SSRF, privacy, workflow, dependency, and skipped-test
controls.

## Final Hardened Base Re-Verification — Stage B result

Date: 2026-08-12 (Asia/Singapore). Stage B began after the exact declaration
`STAGE A COMPLETE - SOURCE FROZEN FOR FINAL AUDIT`. Product source and tests
were not modified after the boundary.

### Runtime and regression evidence

- Node **v22.13.0**; npm **10.9.2**.
- Backend full regression: **51 files passed, 8 optional files skipped;
  574 tests passed, 28 skipped**. The backend TypeScript build passed.
- Provider-facing Tabular history/route reattack: **47/47** targeted tests
  passed. The actual final provider message array excluded invalid or
  caller-injected derived assistant content while preserving ordinary user
  text.
- Targeted trust/OAuth/SSRF/privacy/authorization/conversion set: **69/69**
  passed across 10 files.
- Frontend Stage A Node 22 regression remained green: **25 files / 236 tests**,
  typecheck and production build passed, lint **0 errors / 37 warnings**,
  23 static pages built.
- Word add-in Stage A Node 22 typecheck, production build, HTTPS manifest, and
  Playwright were green: **64/64 E2E tests**.
- `git diff --check`: passed. CRLF normalization notices are Git working-copy
  warnings only; no whitespace errors were reported.

### Real disposable Supabase evidence

The two independent Stage B database runs were C and D. C was reset from its
disposable stack backup and D was initialized as a separate stack. Both were
bootstrapped from the canonical `backend/schema.sql`, baseline, and migration
ledger with fail-fast SQL. Both passed:

- baseline `20260811_03_tabular_chat_provenance`;
- 55 migration files represented;
- 29/29 backend public tables RLS-enabled;
- zero direct browser-role grants;
- one migration-ledger row; and
- schema drift: 55 migrations, 15 created tables, 49 final added columns.

The deliberate second bootstrap against D's populated target failed closed
with exit 1 and the expected non-empty-target error. No disposable Docker
services remained running at the end of the audit.

The final Node 22 real-stack matrix passed **8 files / 28 tests**, including
stack/RLS access, Tabular pagination, OAuth state claim, real HTTP owner/shared/
outsider authorization, DOC-01 direct/copy/replacement lifecycle, DOC-01
tracked-edit resolution lifecycle, and final hardening/account export. The
DOC-01 storage suites used the local S3-compatible Supabase storage endpoint
with process-only audit credentials. LibreOffice was not installed, so the
tested PDF sidecar path recorded its documented conversion-unavailable fallback;
the DOCX trust lifecycle itself passed.

### Workflow, dependency, privacy, and skipped-test evidence

- Workflow source checkout matched the pinned commit
  `4b9c7cd0d93b6254780abcc2cc382be6b56cd945`; generation produced **31 system
  workflows** and the generated artifact matched byte-for-byte. Missing-source
  and wrong-SHA negative checks both failed closed.
- Production dependency audits under Node 22 found: root **0**; backend **1
  moderate** `@anthropic-ai/sdk` advisory; frontend **4 moderate** advisories
  through the `uuid` dependency chain; Word **0**. No critical or high
  production vulnerability was reported, and no automatic upgrade was run.
- Scoped Gitleaks scans found no leak in frontend source, Word source, or
  scripts. The three backend findings were deliberate synthetic API-key
  strings in `backend/src/lib/__tests__/safeError.test.ts`, used to prove
  redaction; they are not credentials. Raw LLM logging remained opt-in and
  redacted by default, with its focused tests passing.
- The 28 tests skipped by the ordinary backend run are the opt-in disposable
  Supabase suites: `stack.supabase.test.ts`, `access.supabase.test.ts`,
  `tabularPagination.supabase.test.ts`, `oauthClaim.supabase.test.ts`,
  `realAuthorization.supabase.test.ts`, `doc01.supabase.test.ts`,
  `doc01Round2.supabase.test.ts`, and `hardeningFinal.supabase.test.ts`.
  They require explicit local Supabase credentials; the DOC-01 files also
  require object-storage credentials, and realAuthorization/DOC-01 require
  the explicit real-HTTP flag. All eight were enabled and passed in the live
  Stage B stack, so no security-critical skip remained unevidenced.

### B-01 through B-04 and DOC-01 disposition

- **B-01:** independently positive. Live/manual matrix covered ordinary user
  text, invalid derived states, foreign/wrong-document/missing/malformed/
  duplicate provenance, pointer changes, and caller-injected assistant text;
  provider-facing tests passed.
- **B-02:** independently positive. Two clean canonical bootstraps, ledger,
  drift, RLS, grants, and populated-target fail-closed behavior passed.
- **B-03:** independently positive for pointer ownership. Runtime inventory
  found the only non-read pointer assignment in the central CAS helper; the
  concurrent trusted promotion attack produced one winner and one explicit
  conflict, with the winner active and the loser trust state preserved.
- **B-04:** independently closed. The real account-export attack now labels
  affected cells `unverified` and redacts content, source IDs, foreign rows,
  and sentinel data, including through `GET /user/export`.
- **DOC-01:** **BLOCKED by B-05 / DOC-01-C**. The reuse-path race mutates an
  existing trusted historical row/object before the final CAS conflict and
  leaves it `ready` with a new hash. This violates immutable version history
  and is a foundation integrity blocker.

### Final verdict

**BASE READY FOR VAULTR CONVERSION: NO**

B-05 was found after source freeze. It must be remediated and re-audited before
any baseline freeze or Vaultr conversion. No commit, tag, or push was created.

## B-05 remediation - Stage A pre-freeze record

Date: 2026-08-12 (Asia/Singapore). The former reuse-path in-place mutation was
removed from `runEditDocument`. The implementation now uses an immutable
candidate row and a unique candidate storage object for every edit, including
`reuseVersion` edits. The expected reused version is checked only as an
optimistic current-pointer precondition. Candidate cleanup is limited to the
new row/object on any upload, insert, trust, edit-record, or promotion failure.

The new real integration suite passed **3/3** on a fresh stack for sequential
reuse, stale reuse, and a persisted concurrent reuse race. The concurrent
case asserted one winner and one explicit loser failure, unchanged original
row/object bytes, hash, processing/trust state, and a ready/trusted active
winner. A second fresh stack passed the complete **9-file / 31-test** real
matrix, including the prior B-01 through B-04 and DOC-01 scenarios.

Stage A canonical bootstrap/verifier/drift passed on both disposable stacks,
including 29/29 RLS-enabled public tables, zero direct browser grants, the
55-migration ledger, and populated-target fail-closed behavior. Node 22
ordinary backend regression after the change passed **51 files / 574 tests**
with **9 files / 31 tests** skipped as opt-in real-stack coverage, and the
backend build passed. Frontend passed **25 files / 236 tests**; Word passed
typecheck/build/manifest and **64/64** Playwright tests.

The final independent adversarial audit has not yet been performed for this
remediation round. No freeze, commit, tag, or push is authorized until Stage B
returns an unconditional YES.

## B-05 remediation round - final frozen Stage B verification

Date: 2026-08-12 (Asia/Singapore). Stage B was run after the exact frozen
source boundary. The independent compiled-path audit passed sequential reuse,
stale reuse, and a real concurrent reuse race against persisted rows and
objects. It observed exactly one winner and one explicit loser; the original
row identity, bytes, storage path, hash, and processing/trust state were
unchanged, and the winner was ready, active, and hash-matched.

The fresh real Supabase matrix passed **9 files / 31 tests**. It re-ran the
prior B-01 through B-04 and DOC-01 lifecycle coverage, including the real
cross-tenant export route and the new reuse suite. A separate fresh-stack
concurrent trusted-promotion attack passed one winner and one explicit CAS
conflict while preserving the loser's ready state. Fresh canonical schema
stacks C and D passed the baseline/ledger, 29/29 RLS, zero browser grants,
drift, and populated-target fail-closed contract.

Frozen regression evidence is Node **v22.13.0** / npm **10.9.2**; backend
**51 files / 574 tests** passed with **9 files / 31 tests** skipped only for
opt-in real stacks, build passed; current B-01 provider-facing tests passed
**55/55**; focused trust/OAuth/SSRF/privacy/authorization/conversion tests
passed **69/69**; frontend passed **25/236** with typecheck/build and lint
**0 errors / 37 warnings**; Word typecheck/build/HTTPS manifest and
Playwright **64/64** passed. Workflow freshness passed at the approved
31-workflow SHA and both negative checks failed closed. Production dependency
audits were root 0, backend 1 moderate, frontend 4 moderate, Word 0, with no
high/critical finding or forced upgrade. Current source-scoped Gitleaks scans
were clean; the only history finding was a redacted old generic-api-key
fixture match. `git diff --check` passed.

The final DOC-01 inventory found no trusted ready/hash/object mismatch. All
new candidate paths use their own object and row; the explicit owner
replacement endpoint uses a fresh object key and untrusted-before-ready row
transition, while deletion and recovery remain guarded. The previous B-05
reuse mutation is absent.

### Final gate

**BASE READY FOR VAULTR CONVERSION: YES**

Stage C may freeze the accumulated hardened foundation. Vaultr conversion
itself remains prohibited by this mission.
