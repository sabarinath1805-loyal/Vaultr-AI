# LLM and MCP Threat Model

## LLM data flow

User messages, selected project/review documents, workflow instructions, search results, and optional Word context are assembled by the backend and sent to a configured provider. The provider stream is parsed into content/tool/citation events, stored as chat messages, and rendered by the frontend. The model is not a trusted policy engine.

## Existing controls

- Chat/project/review routes check object access before building model context.
- User-supplied document IDs are reduced through `filterAccessibleDocumentIds` and route-level source checks.
- Word document context is nonce-fenced before entering the system prompt.
- Tool iterations are bounded; the inspected stream path uses a finite iteration limit.
- Citation and source handling has dedicated access/security tests.
- MCP connector secrets and OAuth state/tokens are encrypted at rest.
- MCP URL validation requires HTTPS, rejects localhost/metadata/private targets, resolves DNS addresses, and uses a pinned guarded agent/fetch path for redirects.
- MCP requests have a 30-second timeout and result-size cap of 60,000 characters.
- Custom connector headers are bounded and the `Host` header is excluded.
- Tool discovery records destructive annotations as `requires_confirmation`; destructive tools cannot be enabled through the normal tool toggle without confirmation.
- OAuth callback state is hashed/bound to the user and connector, expires, and is removed after use; callback logging avoids raw authorization state/code.

## Hardening Phase 2 update

- OAuth state consumption is now a `SECURITY DEFINER` Postgres `DELETE ... RETURNING` function granted only to `service_role`; the callback claims before code exchange and passes the claimed verifier through without a second read/delete race.
- Local Supabase concurrency proof showed one winner for two simultaneous claims, no replay result, and no direct browser-role execution.
- The remaining provider-retention, cost/quota, prompt-injection, and tool-approval decisions are deployment/product policy rather than claims made by this code change.

## Threats and residual risk

| Threat | Current posture | Gate 3 need |
|---|---|---|
| Prompt injection in uploaded documents/search results | Model receives untrusted content; fencing and citations help but do not enforce policy | Typed context boundaries, instruction hierarchy, adversarial fixtures |
| Tool exfiltration or destructive tool call | Confirmation metadata and connector ownership checks | Tool input/output isolation, per-tool allowlists, audit review, negative tests |
| SSRF through MCP URL/redirect/DNS behavior | Strong application guard with dedicated SSRF tests | Real network integration for redirect-to-private and DNS rebinding cases |
| OAuth CSRF/state confusion | Code has state hash/expiry binding | Dedicated callback tests for replay, wrong user, wrong connector, expired state, bad resource |
| Oversized/hostile MCP result | 60,000-character cap and timeout | Test truncation, streaming, malformed JSON, and provider retry behavior |
| Provider data retention | External providers are configurable; retention/region policy is not enforced in code | Provider inventory, DPA/subprocessor review, tenant policy, opt-out behavior |
| Provider timeout/cost abuse | Some stream paths have abort/timeout behavior; no uniform provider budget was established | Per-provider timeout, token/cost quotas, cancellation and retry policy |
| Model-generated HTML/Markdown | Frontend rendering and markdown dependencies receive untrusted text | Sanitization/XSS and algorithmic-complexity tests |
| System prompt/secret disclosure | Prompt leak patterns and tool boundaries exist, but model output remains untrusted | Secret canaries and regression suite across every provider/tool path |

## Evidence reviewed

- `backend/src/lib/mcp/client.ts` and `backend/src/lib/mcp/*` guard/test files.
- `backend/src/routes/chat.ts` and `backend/src/routes/projectChat.ts`.
- `backend/src/routes/tabular.ts`.
- `backend/src/routes/user.ts` MCP/OAuth routes.
- `backend/src/lib/chat/tools/documentOps.ts` and access helpers.
- `backend/src/lib/llm/rawStreamLog.ts`.

## Gate 2 conclusion

MCP SSRF controls are the strongest part of this surface and the 102 targeted security tests pass. LLM content isolation, OAuth regression coverage, provider policy, and uniform resource/cost controls are not yet sufficient for an enterprise or production security claim.
