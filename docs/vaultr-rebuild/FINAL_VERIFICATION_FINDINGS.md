# Final Hardened Base Verification Findings

Date: 2026-08-10<br>
Gate verdict: **NO**

## BLOCKER

### DOC-01 — Alternate document-version paths bypass the scan boundary

**Severity:** BLOCKER<br>
**Status:** **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**.

The final audit identified that initial document upload routes called the scanner while alternate version paths did not. The remediation now covers every discovered production version-write path:

| Path | Evidence | Result |
|---|---|---|
| Copy active bytes into a new version | `backend/src/routes/documents.ts` | Scans exact bytes, inserts `pending_scan`, promotes before pointer update |
| Upload a new version | `backend/src/routes/documents.ts` | Scans before upload/conversion, inserts `pending_scan`, promotes before pointer update |
| Replace an existing version | `backend/src/routes/documents.ts` | Scans replacement, resets row to `pending_scan`, promotes after replacement |
| Project copy, generated files, edits, replication | `backend/src/routes/projects.ts`, `backend/src/lib/chat/tools/documentOps.ts`, `backend/src/lib/chat/tools/toolDispatcher.ts` | All start untrusted and promote only after scan |

`document_versions.processing_state` now defaults to `pending_scan` in `backend/schema.sql` and the additive migration `backend/migrations/20260811_01_document_version_untrusted_default.sql`. Active-version resolution and path attachment use the centralized fail-closed helper in `backend/src/lib/documentVersions.ts`; chat context, Tabular Review, and `read_document` cannot use untrusted version bytes.

The remediation resets replacement rows before bytes change, promotes versions before changing the active pointer, and selects only trusted fallback versions after deletion. Unknown states fail closed. An authorized download is intentionally separate from trusted AI processing.

**Independent re-verification required:** rerun the final hardened-base audit, including the broader live HTTP matrix and production-style deployment checks. The remediation itself has focused/full Node 22 regression evidence, schema drift evidence, and an opt-in real-stack DOC-01 test covering all three original HTTP paths plus pending-active refusal.

## MUST FIX BEFORE PILOT

### TEST-01 — Real HTTP test harness does not self-provision application env

Running the real-stack suite with only `SUPABASE_TEST_*` variables caused three HTTP tests to return 500 because the app requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. The suite passed 18/18 only after the command supplied both test variables and application variables in-process. The harness should validate or provision this relationship so a future operator cannot mistake a misconfigured test for a product result.

### TEST-02 — Real HTTP authorization coverage is narrower than the requested attack matrix

The live proof covered owner/shared/outsider project and child-document reads, shared project mutation denial, outsider denial, and the selected OAuth/RLS paths. It did not exercise all requested live cases: sharing mutation, document rename/delete/version/download, chat rename/delete, Tabular Review row/cell mutation, workflow access, exports, parent/child ID substitution across all resources, and revoked-share behavior. Mocked route tests exist but do not prove the service-role-backed live boundary.

### OAUTH-01 — Full callback/provider exchange is not live-tested

The real database test proves atomic state claim semantics. Unit tests prove state/expiry/user/redirect validation. A real callback including provider code exchange and connector persistence was not run against a provider sandbox.

### AUDIT-01 — Audit-event coverage is incomplete

The audit foundation is present and sensitive calls such as account deletion/export, project sharing/export, document deletion/export/quarantine, provider-key changes, MCP connector changes, and MFA changes emit events. The inspected call sites do not provide equivalent coverage for every workflow mutation, chat rename/delete, Tabular Review mutation/delete, user chat/review export, or every project deletion path. This should be closed before external pilot use, with metadata assertions that no content or credential is recorded.

### AUTH-SEM-01 — Shared project chat write semantics need an explicit decision

The project chat path can accept an existing chat in the same project without requiring that the caller own that chat. This may be intended shared-write behavior, but it could let a collaborator write into another member's conversation. No confirmed read bypass was found; the policy and live test should make the intended behavior explicit.

## MUST FIX BEFORE PRODUCTION

### PROD-01 — Scanner and converter deployment wiring is unproven

The scanner/converter contracts and fail-closed configuration are tested, but production scanner binary/vendor availability, converter container isolation, network policy, resource quotas, and operational worker wiring were not exercised in a production-style deployment.

### PROD-02 — Word development-tool advisories remain

The Word production-only audit is clean, but the full audit reports 8 high, 7 moderate, and 4 low development-tool advisories. This requires owner-reviewed remediation or an explicit supported-toolchain exception before production release.

### PROD-03 — Retention, log operations, and audit observability remain deployment work

Raw-content capture is production-disabled and metadata logging is constrained, but retention/deletion scheduling, audit viewer/access governance, log rotation, signed-URL privacy policy, and hosted monitoring are not production-certified.

### PROD-04 — Hosted DR/backup and ownership are not certified

Local disposable backup/restore evidence exists. Hosted Supabase backup retention, R2/object-storage restore, provider ownership, Word identity/certificates, domains/DNS/email, monitoring, signing-key rotation, and encryption-key operations still require deployment-owner validation.

## DEFERRED

- Mike-to-Vaultr product conversion, branding, UI changes, and old-branch parity work.
- Historical `old-vaultr-backup` merge or source copying.
- SSO/SCIM, enterprise administration, legal hold, SOC 2/ISO work, and other product/deployment expansion.
- Manual cutover of third-party/provider infrastructure listed in `INFRASTRUCTURE_OWNERSHIP.md`.

## Gate effect

`DOC-01` was a conversion blocker because it permitted a current version that bypassed scanning to reach model extraction. The remediation removes that path and is now **REMEDIATED — PENDING INDEPENDENT RE-VERIFICATION**. The final gate remains NO until the independent final audit rerun confirms the fix.
