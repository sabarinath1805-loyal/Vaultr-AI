# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

**Vaultr** is a legal AI assistant web application forked from `nextjs-ollama-llm-ui` and extended into a multi-provider legal platform with RAG over legal databases + personal documents, document processing, contract scanning, and matters (legal cases) — available as both a web app and a Tauri v2 desktop bundle.

The production target is **Singapore lawyers** handling real client data, so PII handling and auth boundaries matter throughout the stack.

## Tech Stack

- **Framework**: Next.js 16.2 (App Router) + TypeScript, webpack (not turbopack)
- **UI**: shadcn/ui + Radix UI primitives, Tailwind CSS, Framer Motion, Lucide icons, sonner toasts
- **State**: Zustand with `idb-keyval` (IndexedDB) persistence
- **Streaming**: Vercel AI SDK (`ai` package), SSE `X-Vercel-AI-Data-Stream: v1`
- **Package manager**: pnpm (with `pnpm-workspace.yaml`). `better-sqlite3` needs a native rebuild on install — `postinstall` script handles it.
- **Database (server)**: SQLite via `better-sqlite3` + Drizzle ORM
- **Database (cloud RAG)**: Supabase + pgvector — stores document chunks, matter memory, user memory with 1024-dim Voyage AI embeddings
- **Embeddings**: Voyage AI `voyage-law-2` (legal-optimised, 1024 dimensions) — key in `VOYAGE_API_KEY`
- **Auth / rate-limiting / usage logging (cloud)**: Supabase, gated on `NEXT_PUBLIC_SUPABASE_URL` being set
- **Tauri v2 desktop**: `src-tauri/tauri.conf.json` — bundle ID `com.vaultr.app`

## CRITICAL CONSTRAINTS

**DO NOT** modify the following:
- `src/lib/lex.ts` — system prompt + model ID constants; read-only by security audit. (The chat route, the contract-scanner LLM prompt, and the agent route all compose on top of this — never edit it.)
- Web search functionality — must always remain enabled (per user requirement). RAG + Tavily/Serper search wiring must not be removed.
- `src-tauri/src/lib.rs` — `enable_macos_default_menu` must always stay `true`.

**Remove before beta launch** (dev-only escape hatches):
- `src/lib/api-auth.ts` — the `NODE_ENV === "development"` bypass that returns the synthetic dev UUID `00000000-0000-0000-0000-000000000001`.
- `src/components/auth/auth-provider.tsx` — the dev branch that renders children when Supabase is configured but no user is signed in.
- `src/middleware.ts` — the dev branch that forwards the dev UUID via `x-vaultr-user-id` header.
- Audit: `grep -rn "00000000-0000-0000-0000-000000000001" src/` — every match must be inside a `NODE_ENV === "development"` check.

## Commands

```bash
pnpm dev              # Dev server (uses NODE_OPTIONS=--max-old-space-size=4096, --webpack)
pnpm build            # Production build (standalone output, --webpack)
pnpm lint             # ESLint flat config
pnpm test             # Jest test suite (ts-jest)
pnpm test:watch       # Jest watch mode
pnpm tauri dev        # Tauri desktop dev (drives the same Next.js dev server)
pnpm tauri build      # Tauri desktop bundle

# Targeted checks
npx tsc --noEmit              # Type-check without emit (the build itself ignores TS errors)
npx jest __tests__/security/auth.test.ts          # Run a single test file
npx jest -t "isValidUUID"                          # Run a single test by name
npx jest __tests__/security --testPathPattern=... # Run a test directory
```

## Architecture

### `/api/chat/route.ts` — Central streaming hub

This is the most complex file in the codebase and the single point through which every chat request flows. The route:

1. Detects the provider from the selected model ID using helpers in `src/lib/models.ts` (`isAnthropicModel`, `isCerebrasModel`, `isGroqModel`, `isGeminiModel`, `isOllamaCloudModel`, `isLexModel`).
2. Runs legal RAG in parallel via `searchLegalDatabases()` in `src/lib/legal-search.ts`.
3. Runs personal RAG (document chunks + matter memory + user memory) via `retrieveRelevantChunks`, `retrieveMatterMemory`, `retrieveUserMemory` in `src/lib/rag-retrieve.ts`; context is formatted by `formatRetrievedContext`.
4. Optionally performs web search (Serper) if the query triggers search keywords.
5. Builds a system prompt with legal context (cases, Wikipedia summary, retrieved chunks, remembered facts).
6. Strips model-specific thinking tokens, search preambles, and tool-call leakage from the stream during streaming — not just at the end (see `stripSearchPreambleFromStreamChunk` in `src/lib/chat-message-content.ts`).
7. Routes to the correct streaming function (Ollama, Groq/Anthropic, Cerebras, Gemini, Ollama Cloud, or Anthropic direct).
8. Returns SSE in `X-Vercel-AI-Data-Stream: v1` format.

The route enforces auth, request body size caps, privacy-mode rate limits, and per-model usage recording (`logUsage`).

### `/api/agent/route.ts` — Agent Mode v2 (7-step pipeline)

Agent Mode runs `claude-fable-5` as the reasoning engine through a deterministic 7-step pipeline and emits SSE `agent_step` progress events that drive the step-tracker UI:

1. `parse` — break the user goal into subtasks
2. `matter` — load the active matter context
3. `search` — query legal databases
4. `fetch` — pull case excerpts
5. `tavily` — web search (only if warranted)
6. `synthesise` — combine sources
7. `draft` — write the final response

Step IDs and human-readable labels live in `src/components/chat/agent-step-tracker.tsx` (`AGENT_STEP_IDS`, `AGENT_STEP_LABELS_DONE`, `AGENT_STEP_LABELS_ACTIVE`). The `agent_step` SSE event format is `2:[{"type":"agent_step","step":"<id>","status":"active|done"}]\n`.

### Lex cloud lineup (current)

Defined as constants in `src/lib/models.ts` — update the `ANTHROPIC_*_MODEL` constants and the `description` fields in `GROQ_MODELS` together when changing lineup. The model selector UI reads display names via `getModelDisplayMetadata` and `groqIdToLexName`.

| Tier       | Model ID                          | Notes                          |
|------------|-----------------------------------|--------------------------------|
| Lex Core   | `claude-haiku-4-5-20251001`       | Default for most legal work    |
| Lex Pro    | `claude-sonnet-4-6`               | Powerful analysis              |
| Lex Ultra  | `claude-opus-4-8`                 | Advanced reasoning             |
| Lex Max    | `claude-fable-5`                  | Deep analysis, allow 1–2 min   |

Local Lex (Ollama) tiers are in `LEX_MODELS` in the same file. The chat route has a 16K token cap branch for Ultra/Max — if the Opus or Fable model ID changes, update `src/app/api/chat/route.ts` too.

### State management — `src/app/hooks/useChatStore.ts`

Single Zustand store with `idb-keyval` IndexedDB persistence. It owns: every chat session, the selected model, the cloud/private mode toggle, the document vault and attachments, custom workflows, contract-scanner progress, and user preferences (theme, thinking mode, jurisdiction).

**Dual storage** is the norm: chat messages live in both this client store and the server-side SQLite via `/api/chats/{id}/messages`. The server's `addMessage` and `replaceMessages` helpers generate `uuidv4()` server-side and enforce `ownerId` — never trust client-provided IDs.

### Database layer

- **SQLite + Drizzle** (`src/lib/db/`): `chats` and `messages` tables. Schema in `src/lib/db/schema.ts`. Use `uuidv4()` server-side for any new ID.
- **Supabase** (`src/lib/supabase.ts`): when configured, drives beta-user auth, usage logging, and rate limiting. Tables: `beta_users`, `usage_logs`, `rate_limits`. Server-side helpers use the service role key; browser-side uses the anon key and RLS.
- **Supabase pgvector (cloud RAG)**: `document_chunks` (per-user document chunks with 1024-dim embeddings), `matter_memory`, `user_memory`. Each has an RPC for similarity search (`match_document_chunks`, `match_matter_memory`, `match_user_memory`).
- **Local vault** (`src/lib/local-documents.ts` + `src/app/hooks/useLocalVaultStore.ts`): documents uploaded through the web app are stored in IndexedDB by default, not in SQLite.

### Legal RAG — `src/lib/legal-search.ts`

Queries external legal databases in parallel (CourtListener, Caselaw Access Project, EUR-Lex, Indian Kanoon) plus Tavily jurisdiction-scoped search (Singapore, UK, AU, CA) and a Wikipedia summary when the query looks like a legal concept. Auto-detects jurisdiction, returns scored/ranked results. Key helpers:
- `isLegalQuery()` — keyword-based legal query detection (≥4 words, not a greeting)
- `detectJurisdiction()` — US, UK, EU, AU, SG, IN, CA
- `JURISDICTION_DB_PRIORITY` — which DBs to query per jurisdiction (max 4)
- 5-minute in-memory cache keyed by `query|jurisdiction`, max 200 entries
- `tavilyIsWarranted()` — guard that decides when web search is worth firing (date signals, jurisdiction markers, RAG result count under 3)

All search calls go through `sanitizeSearchQuery` (strips control chars, caps at 200 chars).

### Personal RAG — `src/lib/embeddings.ts`, `rag-ingest.ts`, `rag-retrieve.ts`, `rag-memory.ts`

The personal-RAG stack sits on top of Voyage AI + Supabase pgvector:

- `src/lib/embeddings.ts` — `embedText` / `embedDocument` (single-text, retrieval-optimised) and `embedBatch` (up to 128 inputs per request, auto-batched, 30s timeout). `chunkText(text, chunkSize = 512, overlap = 64)` splits on word boundaries and discards sub-50-char chunks. Throws if `VOYAGE_API_KEY` is missing.
- `src/lib/rag-ingest.ts` — `ingestDocument({ userId, matterId?, documentName, content, source? })` chunks + embeds + upserts into `document_chunks`. Deletes prior chunks for the same `(user_id, document_name)` pair before re-ingesting. Fire-and-forget safe.
- `src/lib/rag-retrieve.ts` — `retrieveRelevantChunks` (similarity > 0.65), `retrieveMatterMemory` and `retrieveUserMemory` (similarity > 0.6), and `formatRetrievedContext` which composes the three arrays into a single system-prompt section with `[documentName]` prefixes on chunks and bullet lists for memories.
- `src/lib/rag-memory.ts` — `saveUserMemory` (with exact-content duplicate guard), `saveMatterMemory`, and `extractAndSaveMemories` which uses Claude Haiku with an 8s `AbortSignal.timeout` to extract user + matter memories from a conversation turn.

### Tabular Review (coming soon)

Not yet present in the codebase. Planned feature for contract / matter review with structured column output.

### Security layer

Authentication and rate limiting are enforced at the API layer, not the UI layer:
- `src/middleware.ts` — global rate limit (60 req/min per IP) on `/api/*`, security headers on every response, Supabase token gate on every non-allowlisted route, and forwards the resolved user id to routes via `x-vaultr-user-id` (read-only hint — routes still verify on their own).
- `src/lib/api-auth.ts` — `requireAuth()` validates JWT tokens, `sanitizeString()` for input, `validateRequestSize()` clones the request and enforces per-endpoint body caps.
- `src/lib/rate-limit.ts` — in-memory per-IP per-model daily limit, with a downgrade suggestion when at limit.
- `src/lib/supabase.ts` — Supabase-backed auth when configured.
- `src/app/api/download/[filename]/route.ts` — `path.basename()` plus resolved-path containment check; never trust the URL parameter.

Per-endpoint body size caps live alongside the routes. New endpoints should reuse `validateRequestSize`, `requireAuth`, and `checkRateLimit`.

## Key Patterns

- **Token flushing**: The chat route uses a `WeakMap`-based per-stream state machine to batch tokens before flushing (min 3 chars or 50ms idle). Look in `src/app/api/chat/route.ts` for `flushStream` / token batching state.
- **Thinking strip**: Lex local Ollama models emit `<think>...</think>` tokens; these are accumulated server-side and injected as a special UI panel marker, never sent raw to the user.
- **Search preamble stripping**: `stripSearchPreambleFromStreamChunk` runs on every chunk before flushing, not just on final content.
- **React Strict Mode off**: `next.config.mjs` has `reactStrictMode: false` — effects may fire twice per mount. Don't rely on single-mount semantics.
- **Build errors ignored**: `next.config.mjs` sets `typescript.ignoreBuildErrors: true`. Always run `npx tsc --noEmit` separately to catch type errors.
- **RAG similarity thresholds**: `document_chunks` rows are filtered to similarity > 0.65; `matter_memory` and `user_memory` rows are filtered to > 0.6. These constants are inline in `src/lib/rag-retrieve.ts`.

## Testing

Jest is configured with ts-jest for TypeScript support. `jest.config.js`:
- `testMatch: ["**/__tests__/**/*.test.ts"]`
- `moduleNameMapper`: `@/` → `src/`
- Coverage excludes `src/lib/lex.ts`

Test files go in `__tests__/` directories. The existing security-focused suites (`__tests__/security/`) cover the security-critical helpers (`requireAuth`, `validateRequestSize`, `sanitizeString`, `isValidUUID`, `sanitizeSearchQuery`, `checkRateLimit`, `recordUsage`, `formatCasesForContext`, `extractThinkContent`, `stripAssistantMarkup`, `flushThinkStripState`). New security-sensitive helpers should add tests here. RAG helper tests (`embeddings`, `rag-retrieve`, `rag-memory`, `legal-search`) live in `__tests__/rag/` and use `jest.mock` for the external Voyage / Supabase / Tavily calls.

## Environment variables

`.env.local.example` defines the variables; `.env.local` is for local overrides (not checked in).

- `OLLAMA_URL` — local Ollama server (default `http://localhost:11434`)
- `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY`, `CLAUDEOPUS_API_KEY`, `SERPER_API_KEY`, `TAVILY_API_KEY` — cloud provider keys
- `ANTHROPIC_BASE_URL` — custom endpoint for ClaudeOpus (ignored for localhost/Ollama patterns)
- `VOYAGE_API_KEY` — required for personal RAG (embeddings); missing key throws on `embedText` / `embedBatch`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase auth/rate-limiting + pgvector RAG
- `HARVARD_CAP_API_KEY` — optional enhanced CourtListener access
- `TMPDIR` (system) — used as fallback for `DOWNLOAD_DIR` in download endpoints; never hardcode `/tmp`

When `NEXT_PUBLIC_SUPABASE_URL` is unset, the app runs without authentication in private mode and the personal-RAG stack is a no-op (returns empty arrays).

## Deployment

- **Firebase Hosting** at `firebase.json` and `.firebaserc` (static `out/` directory deployed)
- **Tauri Desktop** at `src-tauri/tauri.conf.json` — frontend served from `.next`, dev URL `http://localhost:3000`
- **Supabase** at `supabase/migrations/` — SQL migrations; cloud auth/rate-limiting/pgvector RAG activates when `NEXT_PUBLIC_SUPABASE_URL` is set
