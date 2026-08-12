# Privacy and Logging Baseline

Audit date: 2026-08-10

## Data handled

The application handles account identifiers, profile fields, API keys, MCP credentials/OAuth tokens, documents and extracted text, chat prompts/responses, workflow definitions, tabular review contents, signed object-storage URLs, and external provider/search results.

## Positive controls observed

- User API keys and MCP credentials/OAuth tokens use encrypted storage fields.
- Auth middleware logs user ID/path for profile-sync failures rather than bearer tokens.
- OAuth callback logs state hashes and boolean presence indicators, not raw state or authorization code.
- `safeError` and error helpers redact common secret/token/auth labels in selected paths.
- Frontend API error logging is development-oriented and limits non-JSON body previews.
- Download tokens are HMAC verified and document access is rechecked.
- There is no evidence of a product analytics or session-recording SDK in the inspected source.

## Logging hazards

1. `backend/src/lib/llm/rawStreamLog.ts` writes complete raw provider payloads to console when `LOG_RAW_LLM_STREAM=true`, including arbitrary model/request content, and can write JSON stream files under `RAW_LLM_STREAM_LOG_DIR`.
2. Raw stream files have no repository-defined retention, deletion, encryption, access-control, or size-rotation policy.
3. Development logging in `backend/src/lib/chat/tools/documentOps.ts` includes filenames, storage paths, magic bytes, and the first 120 extracted characters. That excerpt can contain privileged document text.
4. Chat route development logs include request metadata and model/stream counts. They do not intentionally log full prompts, but downstream errors/provider payloads can still contain user content.
5. Signed object-storage URLs are returned to clients and may appear in browser history, telemetry, support captures, or error context. The inspected direct URL lifetime is up to one hour; HMAC download links require authentication but are still bearer-like artifacts.
6. Error stacks in test/development output can contain provider or database details. Production safe-error behavior is not uniform across all routes.
7. No centralized retention, deletion, legal hold, customer export audit, or privacy-event taxonomy was found in the repository.

## Baseline policy for deployment

- `LOG_RAW_LLM_STREAM` must be false in production and should require an explicit, time-bounded support/debug approval in non-production.
- `RAW_LLM_STREAM_LOG_DIR` should be unset by default; if enabled, use encrypted, access-controlled, short-retention storage with automatic deletion and redaction.
- Never log prompts, extracted text, model output, document bytes, signed URLs, API keys, OAuth codes, or connector headers in normal request logs.
- Use structured event IDs and metadata-only correlation: request ID, user pseudonymous ID, object ID, provider/model name, status, latency, and byte/count metrics.
- Define retention and deletion behavior for database rows, object versions, exports, raw logs, audit logs, and backups.
- Scrub secrets and URL query strings at the logging boundary, not only in individual error helpers.
- Add privacy regression tests with secret/document canaries that assert they do not occur in log output.

## Gate 2 conclusion

The code has useful secret-storage and selected redaction controls, but opt-in raw LLM logging and unbounded local stream files are incompatible with an enterprise privacy claim without deployment controls. Privacy/logging is **conditional**.

## Hardening Phase 1 implementation update

- Raw provider capture requires explicit local opt-in and is disabled whenever `NODE_ENV=production`.
- Captured payloads redact credential-like keys and content by default, truncate long strings, require an absolute log directory, use modes 0700/0600, and prune logs older than seven days or beyond 100 files.
- Document read completion logs no longer include a text excerpt; only filename and extracted length are emitted.

## Hardening Phase 2 controls

- `backend/src/lib/configValidation.ts` rejects production raw-LLM logging, debug/auth-bypass flags, unsafe URLs, weak signing/encryption secrets, missing manifest signing configuration, unsafe R2 endpoints, and required-scanner gaps without logging secret values.
- `DATA_LIFECYCLE.md` records the technical deletion/retention baseline and marks audit, backup, provider, and legal-hold decisions that cannot be inferred from code.
- Audit events are now wired for account export/delete, project export/delete/share, document export/delete/quarantine, provider-key changes, MCP connector lifecycle/OAuth changes, and MFA preference changes.
- Audit metadata remains bounded and sanitized; audit writes remain non-blocking and therefore require operational monitoring if the table is unavailable.
