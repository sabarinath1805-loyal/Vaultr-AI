# Vaultr-AI — Overnight Foundation Completion Mission

## Stage A remediation record

Audit date: 2026-08-11<br>
Repository: `C:\Users\Sabarinath.SABARI\Vaultr-AI`<br>
Stage A status: **COMPLETE — focused and full Stage A checks green**<br>
Overall conversion verdict: **PENDING STAGE B — not yet ready for conversion**

This record covers only the four blockers named by the overnight foundation
mission. Earlier NO findings remain preserved in `FINAL_BASE_FINDINGS.md`,
`FINAL_BASE_VERIFICATION.md`, `FINAL_REVERIFICATION_FINDINGS.md`, and the
earlier DOC-01 records. Stage A remediation is not an independent sign-off:
the implementation is now frozen for the adversarial Stage B review below.

## B-01 — Tabular chat-history provenance bypass

Status: **REMEDIATED — PENDING STAGE B VERIFICATION**

### Root cause

The route previously accepted caller-supplied message objects and appended
their assistant content directly to the provider message array. Persisted
assistant output had no explicit source-version contract, so an assistant
message containing output derived from a source that later became stale,
pending, failed, quarantined, deleted, or otherwise untrusted could be
replayed into `runLLMStream` after current-cell filtering had correctly
redacted the live Tabular store.

### Stage A fix

- Added `backend/src/lib/tabularChatHistory.ts` with strict versioned
  provenance prototypes for ordinary plain conversation and derived Tabular
  output.
- `POST /tabular-review/:reviewId/chat` now accepts the caller only as the
  source of the current non-empty user prompt. It does not trust caller
  message roles, assistant content, or caller-supplied provenance claims for
  historical replay.
- Historical context is loaded from the authorized persisted chat rows by the
  server. User-authored strings remain ordinary conversation. Assistant text
  is sent only when its persisted derived provenance resolves to the exact
  authorized document set, exact source versions, current document pointers,
  non-deleted versions, and trusted processing states.
- Invalid, missing, duplicate, wrong-document, outsider, stale, pending,
  failed, quarantined, deleted, or otherwise untrusted derived provenance is
  replaced with a neutral regeneration marker and the original assistant text
  is not sent to the model.
- Successful assistant messages persist either plain provenance or the exact
  source-version IDs observed by Tabular reads. Error and abort messages do
  not acquire trusted derived provenance.

### Tests and evidence

- `backend/src/lib/__tests__/tabularChatHistory.test.ts`: **11 passed**.
- `backend/src/__tests__/integration/tabular.routes.test.ts`: **36 passed**,
  including inspection of the final provider-facing message array; stale
  original assistant text and caller-injected assistant text were absent.
- `backend/src/__tests__/integration/hardeningFinal.supabase.test.ts`:
  real persisted stale derived chat was neutralized; **3/3 passed** for the
  real hardening boundary suite.
- Full backend regression: **51 files passed, 8 skipped; 573 tests passed,
  27 skipped**.
- Expanded disposable real-stack matrix: **8 files passed, 27 tests passed**.

### Remaining concern for Stage B

Stage B must independently attempt malicious replay, provenance substitution,
all source trust states, ordinary user-authored text, shared-collaborator
access, and the actual final provider array. A green Stage A test does not
permit this item to be declared closed yet.

## B-02 — Schema/migration reproducibility failure

Status: **REMEDIATED — PENDING STAGE B VERIFICATION**

### Root cause

The historical migration directory is an incremental change history rather
than a complete empty-database bootstrap. The first dated Tabular migration
assumes its chat table already exists, while applying every historical
migration after the current snapshot reaches an obsolete reference to
`documents.filename`. A textual drift count could not prove SQL
reproducibility.

### Stage A fix

- Established one canonical contract: an empty database receives
  `backend/schema.sql` as the complete baseline snapshot, then only migration
  files lexicographically newer than the explicit baseline are applied.
- Added `backend/schema-baseline.json`, which records baseline
  `20260811_03_tabular_chat_provenance`, its checksum, date, all **55** dated
  migrations represented by the snapshot, and the rule that historical files
  at or below that boundary are not replayed.
- Added the `public.mike_schema_migrations` ledger with a canonical snapshot
  source marker and checksum. Incremental migrations are recorded as they are
  applied.
- Added `scripts/schema-bootstrap.mjs` and the root wrappers
  `scripts/bootstrap-schema.mjs` and `scripts/check-schema-bootstrap.mjs`.
  Bootstrap is fail-fast (`ON_ERROR_STOP`), rejects a non-empty target, and
  verifies tables, RLS, browser grants, provenance type/index, audit events,
  and the OAuth claim function.
- Updated CI, local stack setup, README, and schema documentation to use this
  one contract. Historical migration files were not rewritten or hidden.

### Tests and evidence

- Two newly named disposable Supabase/Postgres stacks were bootstrapped from
  empty targets. Both reported:
  `Canonical schema bootstrap passed: baseline 20260811_03_tabular_chat_provenance, 55 migrations represented, 55 migration files present.`
- Both live verification runs reported **29/29 RLS-enabled tables**, **0
  direct browser grants**, and **1 ledger row**.
- Repeating bootstrap against a populated target failed closed with the
  strict non-empty-target error.
- `npm run check:schema` passed: **55 migrations, 15 created tables, 49 final
  added columns**.
- The real-stack matrix used the canonical schema and passed **27/27 tests**.

### Remaining concern for Stage B

Stage B must repeat the canonical procedure from two genuinely empty
disposable environments, attempt representative stale/wrong bootstrap state,
and verify the ledger/checksum and final SQL objects without hidden manual
preparation.

## B-03 — Active-version promotion race

Status: **REMEDIATED — PENDING STAGE B VERIFICATION**

### Root cause

Multiple pointer-changing paths updated `documents.current_version_id`
directly after preparing a candidate. The tracked-edit path had a compare and
set, but reuse, upload, copy, and replication paths did not consistently
predicate the update on the expected current pointer or verify that a row was
actually changed.

### Stage A fix

- Added `backend/src/lib/documentPromotion.ts` as the central promotion
  primitive.
- The helper validates that the candidate exists, belongs to the target
  document, is not deleted, and is trusted before issuing an atomic update.
- The update includes the expected-current-pointer predicate, handles a null
  expected pointer explicitly, selects the affected document, and returns a
  predictable conflict when the pointer changed first.
- Migrated tracked-edit reuse, direct upload, replacement, source-version
  copy, project copy/upload, replication, initial upload, and other runtime
  pointer-changing call sites to the helper. A runtime search found no
  remaining unguarded `documents.current_version_id` update in backend
  routes/helpers; remaining matches are responses, types, or tests.

### Tests and evidence

- `backend/src/lib/__tests__/documentPromotion.test.ts`: **7 passed**,
  covering success, stale retry/conflict, null pointer, wrong document,
  pending/quarantined, and deleted candidates.
- `backend/src/__tests__/integration/documentsEditResolution.routes.test.ts`:
  **3 passed**.
- Real Supabase hardening boundary: winner promotion followed by stale retry
  left the winner active; the CAS portion passed within the **3/3** real
  hardening tests.
- DOC-01 and Round 2 real lifecycle suites remained green in the expanded
  **27/27** matrix.
- Full backend regression remained green at **573 passed / 27 skipped**.

### Remaining concern for Stage B

Stage B must re-inventory every pointer write independently, exercise
simultaneous promotions and representative upload/copy/replication/reuse
paths, and confirm that conflict handling is observable and cannot regress
trust state.

## B-04 — Account-export provenance omission

Status: **REMEDIATED — PENDING STAGE B VERIFICATION**

### Root cause

The dedicated Tabular export classified each cell, but
`buildUserAccountExport` returned raw `tabular_cells` without a matching
provenance status. Historical portability data was therefore not
distinguishable from current trusted work product, and foreign source-version
metadata could not safely be handled as an explicit account-export boundary.

### Stage A fix

- `backend/src/lib/userDataExport.ts` now loads owned reviews, rows, and
  cells, classifies every cell through the shared Tabular provenance loader,
  and emits `provenance_status` for trusted, stale, unverified, pending,
  processing, failed, quarantined, and deleted states where applicable.
- Owned historical/stale data remains exportable as portability data; it is
  not silently rewritten as current trusted work product.
- Source-version IDs and derived content that point outside the exporting
  account’s owned documents are redacted. Foreign or inaccessible provenance
  is labelled unverified rather than being exposed through the export.
- Missing or malformed provenance remains portable only as historical content
  with an explicit unverified status and no fabricated source metadata.

### Tests and evidence

- `backend/src/lib/__tests__/userDataExport.test.ts`: **1 passed**, covering
  trusted, stale, pending, processing, failed, quarantined, deleted,
  unverified, malformed, and foreign-source redaction behavior.
- Real Supabase hardening boundary: owner export labelled trusted/stale/
  unverified data and redacted foreign content/metadata; included in the
  **3/3** real hardening tests.
- Full backend regression and the expanded real-stack matrix remained green.

### Remaining concern for Stage B

Stage B must independently inspect the serialized account export for every
  trust state, missing/malformed provenance, cross-tenant injection, and shared
  resource semantics. This item remains pending until that independent review
  completes.

## Stage A gate result

The four implementation changes and their focused/full checks are complete.
No product branding, UI conversion, old Vaultr merge, hosted infrastructure
cutover, or unrelated feature work was performed. Source changes are now
frozen for Stage B. The overall verdict remains **not ready for conversion**
until the verification-only stage either closes every invariant or records a
new blocker.

## Overnight Foundation Completion Mission - Stage B result

Date: 2026-08-12. Stage B was performed as a verification-only pass after
the Stage A source boundary. No source, test, dependency, schema, RLS, or
authorization implementation was changed during this stage. The result is
**BASE READY FOR VAULTR CONVERSION: NO** because B-04 remains open.

### B-01 - independently closed

The route boundary was re-read and exercised to confirm that the current
request contributes only its validated user prompt and that the provider
history is assembled from persisted, server-owned messages. A caller-supplied
assistant object is not accepted as trusted replay content.

Against the live disposable Supabase data, trusted original output reached
the history loader, while stale, pending, failed, quarantined, deleted,
missing, malformed, wrong-document, and outsider-derived records all became
the neutral regeneration marker. Ordinary user text remained intact, and the
all-derived-fail-closed case produced no trusted derived context. B-01 is
therefore closed by the independent Stage B check.

### B-02 - independently closed

Two fresh disposable Supabase databases were created and bootstrapped from
the canonical snapshot. Both passed the actual SQL bootstrap, canonical
ledger, table/RLS/grant verification, and migration-drift checks:

- baseline `20260811_03_tabular_chat_provenance`;
- 55 migration files represented by the ledger;
- 29/29 backend public tables RLS-enabled;
- zero direct browser-role table grants.

A repeat bootstrap against a populated target failed closed with the expected
non-empty-target error. This verifies the documented installation contract:
the canonical snapshot is installed on a new database and only migrations
newer than the baseline are applied. B-02 is closed for the new bootstrap
contract; the historical pre-remediation migration-chain failures remain
preserved above as audit evidence.

### B-03 - independently closed for the active-pointer CAS boundary

Runtime inventory found no remaining unguarded `documents.current_version_id`
update in backend routes or helpers; the remaining matches are response,
type, test, or historical-migration references. A live concurrent promotion
attack started two candidates with the same expected current version. Exactly
one promotion succeeded, the other returned the explicit `conflict` result,
and the final pointer was the winning candidate. B-03 is closed for the
required pointer race and runtime write inventory.

The reuse path should receive a follow-up regression test for candidate-state
cleanup when a concurrent pointer change occurs before final promotion. That
observation did not change the verified CAS result, and no Stage B source fix
was applied.

### B-04 - NOT CLOSED: Stage B blocker

The independent live export attack exposed a remaining account-export
provenance-labeling error. User A's owned review was seeded with a Tabular row
whose cell referenced User B's trusted document version. The account export
correctly redacted the cell content and source-version IDs, and did not export
User B's version row, but it serialized:

```json
{
  "provenance_status": "trusted",
  "content": null,
  "source_document_version_ids": null,
  "foreign_version_exported": false,
  "foreign_sentinel_present": false
}
```

The status is inaccurate at the exporting-account boundary. A foreign or
otherwise inaccessible source cannot be labelled `trusted` for that account;
it must be explicitly `unverified` even when the source version is trusted
for its owner. The cause is in
`backend/src/lib/userDataExport.ts`: the cell status is constructed before
the inaccessible-source redaction and is not overridden when source metadata
is rejected.

The minimum remediation is to set the serialized cell's
`provenance_status` to `unverified` whenever the source metadata is foreign,
inaccessible, missing, or otherwise cannot be resolved for the exporting
account, and to add a real cross-tenant injection regression test. That fix
was intentionally **not** applied during Stage B.

## Final gate disposition

Stage B independently closed B-01, B-02, and B-03, but the B-04 attack
produced a new blocker under the explicit requirement that account-export
provenance status be accurate and explicit. No freeze, source commit, tag, or
push is permitted. Vaultr product conversion remains prohibited until B-04
is fixed and the full gate is rerun.

## B-04 Final Remediation Mission - Stage A closure

Date: 2026-08-12. The prior Stage B attack is now remediated at the account
export serialization boundary. The historical NO finding above is preserved;
this section records the new implementation and does not yet declare an
independent final-gate result.

### Root cause confirmed

`loadTabularCellProvenance` determines whether a source version is trusted in
the database's document context. `buildUserAccountExport` separately
determines whether the exporting account owns every document/version needed
to resolve that provenance. Before this remediation, the builder redacted
foreign content and source IDs but copied the source-context state into
`provenance_status` unchanged. A version trusted for User B could therefore
be labelled `trusted` in User A's export.

### Remediation

`backend/src/lib/userDataExport.ts` now derives an account-export status only
when both conditions hold:

1. the provenance parser accepts the complete source-version set; and
2. the exporting account can resolve every source document/version in the
   exported owned set.

If either condition fails, the serialized status is forced to `unverified`.
The existing redaction remains in force: inaccessible source content and
source-version IDs are serialized as `null`, and foreign version rows are not
loaded into the export's `document_versions` collection.

This is a deliberate second security boundary. Trust for a source owner is
not trust for the account receiving a portability export.

### Regression coverage

The final serialized account-export boundary now covers:

- owned trusted, stale, pending, processing, failed, quarantined, and deleted
  sources;
- missing, malformed, duplicate, wrong-document, and unresolved provenance;
- foreign trusted, pending, failed, and quarantined sources;
- inaccessible source versions;
- mixed owned/foreign and mixed trusted/invalid provenance;
- source versions absent from the exporting account's version rows; and
- malicious cross-tenant UUID substitution.

Foreign/inaccessible cases assert all of the required conditions: status is
`unverified` and never `trusted`, content is redacted, source IDs are absent,
foreign version rows are absent, and synthetic foreign sentinel text is absent
from the complete serialized export. The integration suite additionally
exercises `GET /user/export` with real Auth and Supabase data.

### Stage A evidence

- `backend/src/lib/__tests__/userDataExport.test.ts`: **2 passed**, including
  the complete serialized provenance matrix.
- `backend/src/__tests__/integration/hardeningFinal.supabase.test.ts`: **4
  passed** on the real disposable stack, including the final `/user/export`
  route boundary.
- Three-user owner/shared/outsider HTTP authorization suite: **3 passed**.
- Backend full regression: **51 files passed, 8 skipped; 574 tests passed,
  28 skipped**; typecheck/build passed.
- Frontend: **25 files / 236 tests passed**; direct TypeScript check and
  production build passed; lint **0 errors / 37 warnings**.
- Word: typecheck, production build/HTTPS manifest, and Playwright **64/64**
  passed.
- Two fresh canonical schema stacks passed the bootstrap/verifier/drift
  contract; the populated-target repeat failed closed.

The implementation is now frozen for the required independent adversarial
Stage B audit. No product-source change is authorized after this boundary.

## Stage B final independent audit — B-04 closed, new B-05 blocker

Date: 2026-08-12 (Asia/Singapore). The exact Stage A declaration was made:

`STAGE A COMPLETE - SOURCE FROZEN FOR FINAL AUDIT`

No product source, test, dependency, schema, authorization, or infrastructure
changes were made after that boundary. Documentation-only evidence updates are
recorded here.

B-04 is independently closed. A hand-driven attack against the compiled
account-export path on a disposable Supabase stack affected five cells and
passed every required boundary assertion: affected statuses were
`unverified`, foreign content was absent, foreign source IDs were absent,
foreign version rows were absent, foreign sentinels were absent, and
`GET /user/export` returned HTTP 200 with the same protections. The final
real-stack suite also passed **28/28** tests across the eight Supabase
integration files, including the account-export route check.

The independent audit found a new conversion blocker:

### B-05 / DOC-01-C — reuse-path concurrent cleanup/data-integrity failure

- **Severity:** BLOCKER / P1 data integrity and trust-boundary failure.
- **Affected path:** `backend/src/lib/chat/tools/documentOps.ts`,
  `runEditDocument`, the `reuseVersion` branch and its final promotion;
  central conflict handling is in `backend/src/lib/documentPromotion.ts`.
- **Reproduction:** a deterministic adversarial interleaving was run against
  the compiled production path. `runEditDocument({ reuseVersion })` first
  observed the expected current version, then a concurrent pointer change was
  injected before the final CAS. The reuse branch invalidated the existing
  version row, cleared its hash, overwrote the existing storage object,
  finalized the same row as `ready` with the new hash, and only then attempted
  the expected-current promotion.
- **Observed result:** the CAS correctly returned an explicit conflict, but the
  old row and object had already been changed. The harness produced:

  `resultOk=false, pointerChanged=true, replaced=true, promoteExpected=v-reuse, versionStateAfterConflict=ready, hashAfterConflict=new-hash, integrityFinding=true`

- **Impact:** a non-winning historical version can retain new bytes and a
  trusted-ready state after the caller loses the pointer race. Version identity,
  historical immutability, stored bytes, hash, and trust state are no longer
  aligned. The current pointer may remain on the concurrent winner, but the
  losing historical record can still be surfaced by version/history/download
  paths and is no longer a trustworthy audit record.
- **Minimum remediation:** reserve the expected current row with an atomic
  lease/lock/CAS before any in-place mutation, or preferably create an
  immutable new version/object for every edit and collapse same-turn edits at
  the turn/response layer. On conflict, preserve the original row, object, and
  hash/trust state unchanged and delete only candidate objects. Add a real
  concurrent reuse regression that asserts byte, hash, processing state, and
  historical-row immutability after the loser receives a conflict.

This was discovered after the source-freeze declaration and was not fixed, as
required by Stage B. It is sufficient to fail the final gate even though B-01,
B-02, B-03, B-04, the real authorization matrix, OAuth claim checks, MCP/SSRF
tests, workflow provenance, schema bootstrap, and Node 22 regressions were
otherwise positive.

### Final disposition

**BASE READY FOR VAULTR CONVERSION: NO**

No commit, tag, or push was authorized. The next permitted action is a new
remediation round for B-05 followed by a complete two-stage re-audit. Vaultr
v2 product conversion must not begin.

## B-05 / DOC-01-C remediation - Stage A

Date: 2026-08-12 (Asia/Singapore). The B-05 reuse-path defect was remediated
before the new source-freeze boundary. Strategy (b) was selected: every
`runEditDocument` edit, including an edit carrying `reuseVersion`, now writes
new candidate bytes to a new storage path and inserts a new immutable
`document_versions` row. The reused version is retained only as the
same-turn expected-current precondition; its row, object, hash, and trust
state are never mutated.

The candidate is uploaded and inserted untrusted, then hashed/trusted and
promoted through the existing expected-current CAS helper. Unique version
number allocation retries the documented Postgres uniqueness race. Upload,
insert, trust, edit-record, and promotion failures remove only the candidate
row/object. A stale reuse precondition returns before any candidate mutation.
The loser of a promotion race therefore cannot rewrite the original
historical identity or its storage object.

Stage A regression coverage was added in
`backend/src/__tests__/integration/doc01Reuse.supabase.test.ts` and exercises
real Supabase HTTP/auth, database rows, and object storage:

- sequential same-turn reuse creates a distinct row/object and preserves the
  original and first-edit bytes, hashes, paths, and trust state;
- stale reuse fails with zero mutation; and
- two real concurrent reuse attempts produce exactly one promotion, one
  explicit failure, two surviving version rows, a ready/trusted active winner,
  and byte/hash/path/trust preservation for the original row and object.

On a fresh disposable Stage A stack this suite passed **3/3**. A second fresh
stack passed the complete real matrix: **9 files / 31 tests**, including the
eight prior B-01 through B-04 and DOC-01 integration files. Canonical schema
bootstrap, verification, drift, RLS/grant checks, and the populated-target
fail-closed rerun passed on both stacks. Ordinary Node 22 regression after
the remediation passed **51 files / 574 tests**, with **9 files / 31 tests**
skipped because they are opt-in real-stack suites; the backend build passed.
Frontend passed **25 files / 236 tests** and Word Playwright passed **64/64**.

This is a Stage A remediation record only. Independent Stage B verification
and the final freeze decision remain pending.

## B-05 / DOC-01-C - Stage B closure

Date: 2026-08-12 (Asia/Singapore). The product source was frozen at the
required boundary before this verification. An independent hand-driven audit
of the compiled implementation then exercised sequential reuse, stale reuse,
and a real concurrent reuse race against persisted Supabase rows and
S3-compatible objects. It passed exactly one winner and one explicit loser;
the original reused row/object bytes, identity, hash, and processing/trust
state stayed unchanged, the candidate paths remained distinct, and the
winner was ready, active, and hash-matched.

The nine-file live matrix passed **31/31**, including the new reuse suite and
the prior B-01 through B-04/DOC-01 scenarios. A separate real concurrent CAS
attack passed one trusted winner and one explicit `conflict`, with the losing
candidate's trust state preserved. Two fresh canonical schema stacks passed
bootstrap, verifier, drift, RLS/grant, and populated-target fail-closed
checks. The focused B-01 set passed **55/55**, the focused security set
passed **69/69**, backend passed **51/574** with only opt-in real-stack skips,
frontend **25/236**, and Word **64/64**.

No B-05 regression or new foundation blocker was found. B-05 / DOC-01-C is
closed for this round.

**BASE READY FOR VAULTR CONVERSION: YES**

This YES permits only the Stage C baseline freeze and does not authorize any
Vaultr product conversion work.
