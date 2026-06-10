# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

**Vaultr** is a legal AI assistant web application. It started as a Next.js + Ollama UI (nextjs-ollama-llm-ui) and has been extended into a full-featured legal AI platform with multi-provider LLM routing, legal RAG, document processing, and contract scanning — available as both a web app and a Tauri desktop app.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: shadcn/ui + Radix UI primitives, Tailwind CSS, Framer Motion, Lucide icons
- **State**: Zustand with idb-keyval (IndexedDB) persistence
- **Streaming**: Vercel AI SDK (`ai` package)
- **Package Manager**: pnpm (with `pnpm-workspace.yaml` and `pnpm-lock.yaml`)
- **Testing**: Jest with ts-jest (`pnpm test`, `pnpm test:watch`)
- **LLM Providers** (routed in `/api/chat`):
  - **Lex models** (local Ollama): Flash/Core/Pro via `http://localhost:11434`
  - **Anthropic via Groq**: Claude Haiku 4.5, Sonnet 4.6, Opus 4.8
  - **Cerebras via Groq**: ``, ``, `llama4-scout`
  - **Google Gemini**: `gemini-2.5-flash`, `gemini-3.0-flash`
  - **Ollama Cloud**: `-m2.5`, ``, ``, `llama4-scout`
  - **Anthropic Direct**: `claude-opus-4-8` via custom endpoint
- **Database (server)**: SQLite via `better-sqlite3` + Drizzle ORM
- **Auth/Rate-limiting (cloud)**: Supabase — beta user whitelist, per-request usage logging, daily rate limits
- **Desktop**: Tauri v2 with clipboard, dialog, and shell plugins

## CRITICAL CONSTRAINTS

**DO NOT** modify the following:
- `src/lib/lex.ts` — **NEVER touch this file** (per security audit)
- Web search functionality — **MUST always be enabled** (per user requirement)
- `src-tauri/src/lib.rs` — `enable_macos_default_menu` must always be `true`

## Commands

```bash
pnpm dev        # Dev server (uses NODE_OPTIONS=--max-old-space-size=4096)
pnpm build      # Production build (standalone output)
pnpm lint       # ESLint
pnpm test       # Jest test suite
pnpm test:watch # Jest watch mode
pnpm tauri dev   # Tauri desktop dev
pnpm tauri build # Tauri desktop build
```

**Note**: Uses `pnpm` as package manager. `better-sqlite3` requires a native rebuild on install (`postinstall` script handles this automatically).

**Tauri Desktop**: Configuration in `src-tauri/tauri.conf.json`. Desktop app uses clipboard, dialog, and shell plugins via Tauri v2.

## Architecture

### Route Structure

```
src/app/
├── (chat)/               # Route group: all authenticated/chat UI pages
│   ├── page.tsx          # Main chat page
│   ├── c/[id]/           # Individual chat sessions
│   ├── vault/            # Document vault
│   ├── contract-scanner/ # Clause-level contract analysis
│   ├── matters/          # Legal matters/cases
│   ├── workflows/        # Custom AI workflows
│   ├── models/           # Model management
│   └── settings/         # User settings
└── api/                  # All server endpoints
    ├── chat/route.ts     # Central streaming endpoint — routes to all LLM providers
    ├── chats/            # CRUD for chat sessions + messages
    ├── legal-search/     # RAG: queries 12+ legal databases in parallel
    ├── extract-document/ # PDF/DOCX text extraction
    ├── contract-scanner/ # Clause extraction + risk scoring
    ├── scan-reports/     # Generate multi-clause analysis reports
    ├── generate-docx/    # Export analysis as Word documents
    ├── local-vault/      # Manage local document index
    ├── model/route.ts    # Available models + Ollama status
    ├── auth/             # Beta user checks
    ├── download/         # Download document attachments
    ├── export-response/  # Export chat responses
    └── tags/             # Document tagging
```

### `/api/chat` — The Central Streaming Hub

`src/app/api/chat/route.ts` is the most complex file. It:
1. Detects which provider to use from the selected model ID (helper functions in `src/lib/models.ts`)
2. Runs legal database RAG in parallel via `searchLegalDatabases()` in `src/lib/legal-search.ts`
3. Optionally performs a web search (Serper API) if the query triggers search keywords
4. Builds a system prompt with legal context (cases, Wikipedia summary)
5. Strips model-specific thinking tokens, search preambles, and tool-call leakage from the stream
6. Routes to the correct streaming function (Ollama, Groq/Anthropic, Cerebras, Gemini, Ollama Cloud, or Anthropic direct)
7. Returns SSE using `X-Vercel-AI-Data-Stream: v1` format

### State Management

`src/app/hooks/useChatStore.ts` — single Zustand store with `idb-keyval` (IndexedDB) persistence. It holds:
- All chat sessions (`chats: Record<string, ChatSession>`)
- Selected model, cloud/private mode toggle
- Document vault, attached documents, workflows
- Contract scanner state (progress, results)
- User preferences (theme, thinking mode, jurisdiction)

### Database Layer

**SQLite + Drizzle** (`src/lib/db/`): Chat sessions and messages stored server-side.
**Supabase** (`src/lib/supabase.ts`): Beta auth, rate limiting, usage logging — used when `NEXT_PUBLIC_SUPABASE_URL` is configured.

### Legal RAG (`src/lib/legal-search.ts`)

Queries 12+ legal databases in parallel, auto-detects jurisdiction from query keywords, and returns scored + ranked results. Key helpers:
- `isLegalQuery()` — keyword-based legal query detection
- `detectJurisdiction()` — US, UK, EU, AU, SG, IN, CA, International
- `JURISDICTION_DB_PRIORITY` — which DBs to query per jurisdiction (max 4)
- Results are scored by keyword match, jurisdiction match, and recency

### Document Processing (`src/lib/file-extraction/`)

- `pdf-extractor.ts`: `pdf-parse` for text extraction
- `docx-extractor.ts`: `mammoth` for DOCX conversion

### Model Routing (`src/lib/models.ts`)

Helper functions for provider detection:
- `isAnthropicModel()`, `isCerebrasModel()`, `isGroqModel()`, `isGeminiModel()`, `isOllamaCloudModel()`, `isLexModel()`
- `groqIdToLexName()` — maps cloud model IDs to UI display names
- `getModelDisplayMetadata()` — gets badge, color, name, provider for a model ID

Lex models are local Ollama; everything else routes through cloud APIs.

## Testing

Jest is configured with ts-jest for TypeScript support:
- Test files go in `__tests__/` directories
- Run tests with `pnpm test`
- Watch mode: `pnpm test:watch`

## Key Patterns

- **Token flushing**: The chat route uses a `WeakMap`-based per-stream state machine to batch tokens before flushing (min 3 chars or 50ms idle)
- **Thinking strip**: Lex local models emit `<think>...</think>` tokens; these are accumulated server-side and injected as a special UI panel marker
- **Search preamble stripping**: Accumulation-based regex strip for noisy search-process tokens at the start of streams
- **Dual storage**: Chat messages are both in the Zustand/IndexedDB client store AND synced to SQLite via `/api/chats/{id}/messages`
- **React Strict Mode off**: `next.config.mjs` has `reactStrictMode: false` — component effects may fire twice per mount
- **Build errors ignored**: `next.config.mjs` sets `typescript.ignoreBuildErrors: true`

## Security

Authentication and rate limiting are enforced at the API layer:
- `src/lib/api-auth.ts` — `requireAuth()` validates JWT tokens, `sanitizeString()` for input validation
- `src/lib/supabase.ts` — Supabase-backed auth when configured
- IP-based rate limiting in `src/lib/rate-limit.ts`

## Deployment

- **Firebase Hosting** config at `firebase.json` and `.firebaserc` (static `out/` directory is deployed)
- **Tauri Desktop**: `src-tauri/tauri.conf.json` — bundle ID `com.vaultr.app`, frontend served from `.next`, dev URL `http://localhost:3000`
- **Supabase**: `supabase/migrations/` contains SQL migrations; cloud auth/rate-limiting activates when `NEXT_PUBLIC_SUPABASE_URL` is set

## Environment Variables

Key variables (see `.env.example` or Supabase/schema docs for full list):
- `OLLAMA_URL` — local Ollama server (default `http://localhost:11434`)
- `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY`, `CLAUDEOPUS_API_KEY`, `SERPER_API_KEY` — cloud provider keys
- `ANTHROPIC_BASE_URL` — custom endpoint for ClaudeOpus (ignored for localhost/Ollama patterns)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase auth/rate-limiting
- `HARVARD_CAP_API_KEY` — optional enhanced CourtListener access

**Local development environment**: Set `NEXT_PUBLIC_SUPABASE_URL` to activate Supabase auth/rate-limiting. Otherwise runs without authentication in private mode.

**Environment file**: `.env.local.example` contains variable definitions; `.env.local` for local overrides (not checked in).