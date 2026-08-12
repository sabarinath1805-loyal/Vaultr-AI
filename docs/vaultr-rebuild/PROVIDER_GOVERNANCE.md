# Provider Governance Baseline

Status: implemented baseline for Hardening Phase 1; product/provider migration is out of scope.

## Active provider paths

| Provider/path | Code boundary | Data sent | Credential source | Storage/logging boundary |
|---|---|---|---|---|
| Anthropic | `backend/src/lib/llm/claude.ts` | Chat messages, system prompts, selected document context, and approved tool definitions | `ANTHROPIC_API_KEY` or an encrypted per-user key | Provider-controlled processing; application stores chat/document records. Raw stream capture is opt-in and disabled in production. |
| Google Gemini | `backend/src/lib/llm/gemini.ts` | Same class of chat/document/tool context, mapped to Gemini content parts | `GEMINI_API_KEY` or an encrypted per-user key | Same application/provider boundary; provider retention and training settings must be configured on the owning provider account. |
| OpenAI | `backend/src/lib/llm/openai.ts` | OpenAI Responses input, tools, and document context | `OPENAI_API_KEY` or encrypted per-user key | Fixed HTTPS API endpoint; application does not persist provider credentials in logs. |
| Ollama/OpenAI-compatible local endpoint | `backend/src/lib/llm/ollama.ts` | Chat/document/tool context to `OLLAMA_BASE_URL` | Optional `OLLAMA_API_KEY` | Default is local `http://localhost:11434/v1`; production must set an owned private endpoint and transport policy. |
| CourtListener | `backend/src/lib/courtlistener.ts` | Case/citation search and selected legal research query data | `COURTLISTENER_API_TOKEN` or encrypted per-user token | Public legal-data service plus optional R2 bulk index; API responses are not raw-logged by default. |
| OpenRouter key storage | `backend/src/lib/userApiKeys.ts` | Key provider is supported in encrypted account storage | Encrypted user API-key table | No active canonical model ID currently routes through OpenRouter; do not advertise it as active until a model route and tests exist. |

## Governance rules

1. Provider selection must remain explicit in `providerForModel`; unknown model IDs fail closed.
2. User keys are encrypted at rest by `USER_API_KEYS_ENCRYPTION_SECRET`. Never add provider keys to request logs, audit metadata, fixtures, or generated artifacts.
3. Document text and chat history are confidential tenant data. Provider calls require a user-authorized route and must be bounded by the document/resource limits in `DOCUMENT_INGESTION_THREAT_MODEL.md`.
4. External MCP responses and retrieved legal data are untrusted context, not instructions. The existing tool-dispatcher and MCP boundaries must preserve that distinction.
5. Raw provider payload capture requires both `NODE_ENV != production` and explicit `LOG_RAW_LLM_STREAM=true`; content remains redacted unless `LOG_RAW_LLM_STREAM_INCLUDE_CONTENT=true` is explicitly set for local debugging.
6. Provider account owners must document retention, training/opt-out, region, incident contact, and deletion behavior before production use. This repository cannot infer those controls from an API key.
7. New providers require: a model allowlist entry, key-source decision, timeout/cancellation behavior, privacy review, mocked request/response tests, and a provider governance row before merge.

## Open governance decisions

- Confirm the Vaultr-owned accounts, billing owners, regions, and provider retention settings before production onboarding.
- Decide whether local Ollama is development-only or an approved production deployment class.
- Decide whether OpenRouter should remain a stored-key option; it currently has no active model routing contract.
