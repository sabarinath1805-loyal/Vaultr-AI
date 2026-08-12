# Infrastructure Ownership and Cutover Inventory

Status: ownership-preparation baseline. No external account, domain, secret, or deployment was changed by this audit.

| System | Current evidence | Vaultr ownership action | Current risk/status |
|---|---|---|---|
| Git repository | `origin` is `sabarinath1805-loyal/Vaultr-AI`; `upstream` is `Open-Legal-Products/mike`; current branch is `master` | Confirm Vaultr GitHub org/repo, branch protection, CODEOWNERS, release owner, and security contact | Repo identity is known locally; branch governance is not yet verified |
| Supabase Auth/Postgres | URLs/keys are environment-driven; `backend/schema.sql` plus 49 dated migrations | Create/select the Vaultr project, record project ref privately, rotate service-role and signing secrets, apply migrations in order | No hosted project was connected during audit; real-stack gate remains blocked |
| R2/S3-compatible object storage | `R2_ENDPOINT_URL`, access keys, and bucket name are environment-driven; example default still says `mike` | Create a Vaultr bucket, set lifecycle/retention/versioning policy, least-privilege token, and backup owner; remove `mike` default from deployment values | Ownership unconfirmed; example default is a migration hazard |
| LLM providers | Anthropic, Gemini, OpenAI, optional Ollama/CourtListener env keys | Assign account/billing owners, regions, retention/training settings, spend limits, incident contacts, and key rotation cadence | Provider account ownership is not evidenced in repo |
| MCP servers/connectors | User-configured HTTPS URLs, OAuth state/token tables, SSRF guard | Establish allowlist/approval policy, connector owner, OAuth client registration owner, and egress monitoring | Security code exists; governance and inventory are not centralized |
| LibreOffice | Local/Docker/nixpacks binary path; conversion is server-side | Own the runtime image/package, patch cadence, sandbox profile, and test fixtures | Host lacks LibreOffice; production packaging must be verified |
| GitHub Actions | `.github/workflows/ci.yml` uses Node 22 and repository secrets by name | Move secrets to Vaultr-owned environment, require approvals for production, pin third-party actions by policy | Workflow exists; org ownership/secret provenance not verified |
| Word add-in | `word-addin/manifest.xml` and `REACT_APP_*` build-time config | Register Vaultr App/manifest identity, approved domains, certificate owner, and marketplace/private deployment process | Existing add-in is still Mike-branded/configured |
| Email/notifications | Supabase Auth and optional `resend` dependency; no single sender inventory in code | Choose Vaultr sender domain/provider, DNS owner, bounce/complaint owner, and deletion policy | Not ready for production identity migration |
| Domains | README and UI contain Mike-era links/domains | Reserve/verify Vaultr domains and update deployment/manifest/config references in a separate approved product migration | Deliberately not changed in this hardening phase |

## Required ownership records before production

- Named primary and backup owner per system.
- Account/project identifiers stored in the secret manager or controlled inventory, not source.
- Key rotation, backup/restore, incident, and offboarding procedures.
- Data residency, retention, deletion, and processor/subprocessor review.
- A deployment manifest proving that no Mike-owned endpoint, bucket, domain, OAuth client, or secret remains.

## Phase 2 ownership classification

This is an explicit handoff classification, not evidence that the external system has already been migrated.

| Area | Classification | Required owner action |
|---|---|---|
| GitHub repository, branch protection, CODEOWNERS | MUST MIGRATE | Assign Vaultr org/repo owners and protected release branch |
| GitHub Actions and CI secrets | READY FOR VAULTR / MUST MIGRATE | Move secrets to Vaultr environments; require production approvals |
| Supabase Auth/Postgres/storage configuration | READY FOR VAULTR / MUST MIGRATE | Create target project, rotate inherited credentials, run schema/RLS/backup gates |
| R2/S3 bucket and lifecycle | READY FOR VAULTR / MUST MIGRATE | Create bucket, least-privilege token, versioning/lifecycle/orphan policy |
| Anthropic/Gemini/OpenRouter/CourtListener/email providers | MUST MIGRATE | Assign billing/data-retention owners and rotate keys |
| MCP server inventory and OAuth clients | READY FOR VAULTR | Approve allowlist, client registrations, egress monitoring, and token revocation owner |
| LibreOffice/scanner worker | BLOCKED | Wire non-root isolated worker and select/operate scanner |
| Word add-in registration, publishing, certificates, tenant | BLOCKED / MUST MIGRATE | Register Vaultr identity, approved domains, certificate owner, deployment channel |
| Deployment platform, domains, DNS, email sender | BLOCKED / MUST MIGRATE | Name platform owner, configure HTTPS/DNS/sender verification, prove rollback |
| Monitoring, error tracking, analytics | NOT EVIDENCED | Choose Vaultr-controlled systems and document privacy/redaction settings |
| Encryption, signing, download, OAuth secrets | READY FOR VAULTR / MUST ROTATE | Store only in secret manager; rotate after target ownership is confirmed |

No external manual configuration was performed during Phase 2.
