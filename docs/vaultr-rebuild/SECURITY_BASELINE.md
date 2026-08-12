# Security Baseline

This document records the observed security controls, trust boundaries, and open validation work. It is a baseline, not a penetration-test report or a guarantee of secure deployment.

## Assets and trust boundaries

The highest-value assets are Supabase user/session identity, user provider API keys, MCP bearer/OAuth credentials, legal documents and versions, chat content/citations, project/review sharing state, storage objects, and Word document contents.

Relevant boundaries are:

1. Browser / Office add-in to the backend API.
2. Backend to Supabase Auth and Postgres via service-role credentials.
3. Backend to S3/R2-compatible storage.
4. Backend to external model providers, CourtListener, and user-configured MCP servers.
5. Uploaded files and model output as untrusted content inside document/chat/tool workflows.
6. Local Docker services and host tools such as Ollama and LibreOffice.

## Identity and session controls

- Browser authentication uses Supabase's browser client and `onAuthStateChange`.
- The Word add-in uses Supabase password authentication and keeps access/refresh tokens in OfficeRuntime storage.
- Backend authentication verifies the presented Bearer token using Supabase `auth.getUser` and places the verified user ID/email in request locals.
- MFA enrollment/on-login behavior is checked server-side, with frontend verification routes and a short session-storage grace window.
- Destructive account/data operations are MFA-gated when the profile is enrolled.

Open validation: confirm production cookie/token posture, refresh-token revocation behavior, session lifetime, MFA enrollment/recovery semantics, and add-in OfficeRuntime storage isolation on all supported Office hosts.

## Authorization and data isolation

`backend/src/lib/access.ts` centralizes project owner/shared-email checks, document access, review access, accessible project IDs, and user-supplied tabular document-ID filtering. Routes commonly combine those helpers with user-specific query filters. Download routes verify both the signed token and document access.

The main systemic risk is that the server uses a Supabase service client, so database RLS is not the sole enforcement layer. RLS being enabled is positive defense-in-depth but does not prove API isolation. The schema also uses text user IDs in several business tables and represents sharing through email arrays/JSONB rather than a normalized organization membership model. Revocation, email change, duplicate/case normalization, and auditability need explicit tests.

Required negative-test matrix:

- Owner A cannot read, rename, delete, export, or mutate owner B's project/doc/version/chat/review.
- A shared project member can perform only the operations intended for members; owner-only operations remain forbidden.
- A direct shared review cannot be used to reach unrelated documents or project records.
- User-supplied document IDs are reduced to the caller's accessible set before extraction/generation.
- Signed download tokens cannot be replayed for another path, filename, user, or document version.
- Account deletion removes access to shared records and storage prefixes without deleting another owner's data.

## Secrets and cryptography

Observed secret classes include Supabase service credentials, model provider keys, CourtListener tokens, R2/S3 credentials, download-signing secret, user API-key encryption secret, MCP encrypted auth configuration, OAuth state/token encryption, and optional manifest signing key.

Positive controls include server-side encryption fields for user API keys/MCP credentials, HMAC-style download tokens, encrypted OAuth state/configuration, and a gitleaks CI job scanning full history. `.env` files were absent in the worktree during this audit and values were not printed.

Deployment requirements:

- Never expose service-role, storage, signing, or encryption secrets to the browser, add-in bundle, Docker image history, or logs.
- Replace all local demo keys and default secrets before any non-local deployment.
- Rotate secrets after any accidental logging or exposure.
- Keep encryption/signing secrets stable during a deployment window and document rotation/migration behavior.
- Verify that provider keys are never included in SSE/error bodies or telemetry.

## Network and SSRF controls

MCP connector URLs are required to use HTTPS. Validation strips URL credentials/hash, blocks localhost and metadata hosts, resolves DNS with all addresses, fails closed on blocked/private/reserved IPs, and uses a guarded undici dispatcher to validate at connection time. Outbound requests use manual redirect handling, and OAuth discovery/registration/refresh routes through the same guarded fetch helper. Custom headers exclude `Host` and are length/count limited.

This is a strong control for the inspected MCP path. Remaining validation should cover DNS rebinding under real network conditions, IPv4-mapped/NAT64/IPv6 edge cases, redirect handling at every SDK layer, proxy environment variables, OAuth authorization URL handling, timeout/body-size limits, and all other outbound integrations. Do not generalize the MCP guard to LibreOffice, model providers, storage, or CourtListener without checking their separate clients.

## Content, injection, and model boundary

The application processes untrusted document text, DOCX/XML, spreadsheets, presentations, chat text, workflow content, MCP tool descriptions/results, case-law HTML, and model output. Chat code uses validation, context fencing, citations, tool policies, and citation verification. The frontend uses a sanitizer before rendering case-law HTML and escapes highlighted text before constructing marked HTML.

The residual risk is material: prompt instructions are not a hard security boundary, and a model with document/MCP/edit tools can be induced to disclose or mutate information if authorization, tool confirmation, or context separation fails. The audit did not perform adversarial prompt-injection testing.

Document parsers and converters also need threat-model coverage for malformed XML, decompression/resource exhaustion, macro-enabled files, formula handling, external references, and LibreOffice sandboxing. Uploads are accepted in memory with a 100 MB limit; extraction is synchronous and no isolated worker/queue was found.

## Logging and privacy

Error logging is generally structured around user IDs, record IDs, route names, and safe error helpers. However, development logging paths and optional raw LLM stream logging need deployment review because legal document excerpts, prompts, provider payloads, or sensitive metadata can enter stdout or a configured file directory if enabled. Verify that production `NODE_ENV`, `LOG_RAW_LLM_STREAM`, raw-log directory, container logs, tracing, and retention policies cannot silently capture document content or credentials.

## Dependency and supply-chain baseline

The observed `npm audit --omit=dev --audit-level=high` results are:

| Package area | Result |
| --- | --- |
| Root | 0 vulnerabilities |
| Backend | 46 vulnerabilities: 17 high, 29 moderate |
| Frontend | 69 vulnerabilities: 21 high, 47 moderate, 1 low |
| Word add-in | 0 vulnerabilities |

Many findings are transitive and several report no fix. Notable affected chains include `mammoth`/`@xmldom/xmldom`, MCP SDK dependencies, `express-rate-limit`/`ip-address`, `libreoffice-convert`/`tmp`, `@supabase/supabase-js`/`ws`, Next/OpenNext/Wrangler/`sharp`/`undici`, and editor/markdown dependencies. This result is a triage input, not permission to run `npm audit fix`.

CI also contains CodeQL, gitleaks, and Scorecard workflows. Confirm their schedules, branch protection, artifact retention, and whether the same lockfiles/build outputs are covered in release gates.

## Deployment baseline risks

- Docker Compose contains local demo credentials and a host Ollama URL; bind addresses and secrets must remain local-only.
- Backend CORS defaults to localhost and production depends on `FRONTEND_URL`.
- Trust proxy behavior is configurable; production must set the correct hop count or rate-limit/IP semantics can be wrong.
- LibreOffice is installed in the backend image and needs resource/time limits and a non-privileged execution review.
- Supabase CLI/configuration is not committed in the expected form; local/CI stack bootstrap differs from README expectations.
- Manifest generation requires a deployed HTTPS origin; the local add-in manifest contains localhost URLs.

## Security disposition

No critical exploit was proven in this read-only pass. The baseline is not security-clear for production because dependency exposure, service-role authorization reliance, untested cross-user negative cases, sensitive-content logging risk, synchronous parser/converter exposure, and incomplete deployment validation remain open.
