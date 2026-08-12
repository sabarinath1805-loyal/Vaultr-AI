# Vaultr-AI Data Lifecycle Baseline

Date: 2026-08-10<br>
Status: technical baseline; legal, contractual, and customer-specific retention decisions remain owner-approved policy.

This document records what the repository can enforce today. It does not infer a statutory retention period.

| Object | Primary location | Technical baseline | Deletion/retention behavior | Production decision |
|---|---|---|---|---|
| Auth users and profiles | Supabase Auth/Postgres | Account deletion routes remove the caller's account data; Auth backup/grace behavior is platform-specific | Delete request is immediate in the application path; verify hosted Auth backup purge semantics | Owner must set backup/grace and legal-hold policy |
| API keys and MCP credentials/tokens | Encrypted Postgres fields | Encrypted at rest; account/connector cleanup removes rows | No plaintext export; provider-side token revocation is not automatic | Define revocation confirmation and rotation cadence |
| Documents and versions | R2/S3-compatible storage plus Postgres metadata | Upload/version failures mark processing failure and clean newly-created paths best-effort; account/project cleanup deletes known paths | Source/PDF objects are deleted through application cleanup; object versioning/backup copies are outside the app | Configure bucket versioning, lifecycle, orphan sweep, and deletion verification |
| Chats and tabular reviews | Postgres | User-scoped cleanup helpers support account/export/delete routes | Deletion is application-triggered and audited where wired | Define retention, export format, and legal hold |
| Workflows and shares | Postgres | Owner-scoped routes and user cleanup cover user-owned rows | Shared/system provenance is retained according to deployment policy | Define open-source submission and share retention |
| OAuth state | Postgres | Ten-minute state TTL; atomic claim deletes before code exchange | Expired states are not claimable; successful states are one-time | Keep TTL at or below the documented bound unless reviewed |
| Signed download/export links | Client URL/token | HMAC download tokens expire; direct storage URLs may be valid for up to one hour | Expiry is cryptographic; browser/history/support copies are not controlled by the app | Minimize TTL and prevent URL capture in telemetry |
| Raw LLM debug capture | Local filesystem when explicitly enabled | Disabled in production; non-production files are mode-restricted and pruned after seven days/100 files | Cleanup is bounded but deployment storage policy still applies | Keep disabled by default; support approvals must be time-bounded |
| Audit events | Postgres `audit_events` | Metadata-only sanitizer; non-blocking writes | No automated deletion route exists yet | POLICY DECISION REQUIRED for retention, legal hold, viewer access, and purge |
| Scan/conversion workspaces | Private local temp directories | Mode 0700; `finally` cleanup after scan/conversion | Ephemeral cleanup on success/failure; crash residue requires host/container cleanup | Add worker temp-volume janitor and alerting |
| Database/object-storage backups | Hosted backup systems or operator archives | Backup/restore mechanics are documented separately; backup retention is not source-controlled | Deletion of live rows does not prove backup erasure | POLICY DECISION REQUIRED for retention, encryption, residency, and restore access |
| External providers | Provider-controlled systems | Provider/model is configurable and no provider retention is enforced in code | Deletion from Vaultr cannot retract already-transmitted content | Record DPA, region, training/retention, and deletion terms per provider |

## Required production controls

- Publish an approved retention schedule and legal-hold exception for each object class.
- Keep audit and backup access separate from normal application access; log administrator exports and restores.
- Prove account deletion against live rows, storage paths, derived PDFs, audit behavior, and the documented backup limitation.
- Never use raw LLM capture as a production diagnostic default.
