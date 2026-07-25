# Vaultr

A legal AI assistant for **Singapore lawyers** — multi-provider LLM chat with RAG over legal databases and personal documents, document processing, contract scanning, and matter (legal case) management.

Web app + Tauri v2 desktop bundle.

This is a heavily modified fork of [`nextjs-ollama-llm-ui`](https://github.com/jakobhoeg/nextjs-ollama-llm-ui).

---

## Features

- **Multi-provider chat** — Ollama (local), Groq, Anthropic direct, Anthropic via ClaudeOpus proxy, Cerebras, Gemini, Ollama Cloud. Lex cloud lineup (Core / Pro / Ultra / Max) is the default; switch freely per chat.
- **Agent Mode (v2)** — deterministic 7-step pipeline (`parse → matter → search → fetch → tavily → synthesise → draft`) driven by `claude-fable-5`, with live step-tracker UI.
- **Legal RAG** — parallel queries across CourtListener, Caselaw Access Project, EUR-Lex, Indian Kanoon, jurisdiction-scoped Tavily search, and Wikipedia for legal concepts. Auto-detects jurisdiction (US / UK / EU / AU / SG / IN / CA).
- **Personal RAG** — Jina AI embeddings (`jina-embeddings-v3`, 1024-dim) over your documents, matter memory, and user memory, stored in Supabase pgvector.
- **Document processing** — upload PDF / DOCX, extract text, embed, ingest into the personal vault. IndexedDB-backed by default.
- **Contract Scanner** — extract clauses, classify risks, generate risk-report PDFs.
- **Matters** — organise chats, documents, and memories per legal case.
- **Tabular Review** — extract per-column answers from a document via a single LLM call.
- **Voice input** — speech recognition in the composer.
- **Code highlighting**, **light / dark mode**, **per-user usage telemetry**, **beta-user auth gate** (Supabase).

---

## Tech stack

- Next.js 16.2 (App Router) + TypeScript, webpack-based production build
- shadcn/ui + Radix UI, Tailwind CSS, Framer Motion, Lucide, sonner
- Zustand with `idb-keyval` IndexedDB persistence
- Vercel AI SDK, SSE (`X-Vercel-AI-Data-Stream: v1`)
- SQLite + Drizzle ORM (server), Supabase + pgvector (cloud RAG / auth / usage)
- Jina AI embeddings
- Tauri v2 (desktop)

See `CLAUDE.md` for the full architecture walkthrough, API surface, and codebase guardrails.

---

## Quick start

### Prerequisites

- Node.js 18+
- pnpm (the project uses pnpm — there is intentionally no `package-lock.json`)
- (Optional) Ollama running locally for offline / private mode — `OLLAMA_URL` defaults to `http://localhost:11434`
- (Optional) A Supabase project if you want cloud RAG + auth + usage logging

### Install

```bash
pnpm install
```

The `postinstall` script rebuilds `better-sqlite3` against your local Node ABI.

### Configure

Copy `.env.local.example` to `.env.local` and fill in any keys you want to use. Every key is optional — the app degrades gracefully:

| Key missing              | Effect                                                                    |
|--------------------------|---------------------------------------------------------------------------|
| `OLLAMA_URL` set, no others | App runs offline in **Private Mode** with local Ollama.               |
| `NEXT_PUBLIC_SUPABASE_URL`  | Personal RAG + auth + usage logging disable; private mode is unauthenticated. |
| `JINA_API_KEY`               | Personal-RAG embedding calls throw on use.                           |
| Other provider keys          | That provider is hidden from the model selector.                     |

See `CLAUDE.md` → *Environment variables* for the full list and what each controls.

### Develop

```bash
pnpm dev                 # Next.js dev server on http://localhost:3000
pnpm tauri:dev           # Tauri desktop dev (drives the Next.js dev server)
```

### Build & deploy

```bash
pnpm build               # Standalone Next.js build into .next/
pnpm start               # Serve the production build
pnpm tauri:build         # Tauri desktop bundle (src-tauri/)
firebase deploy          # Static deploy of `out/` to Firebase Hosting
```

---

## Scripts

| Script              | What it does                                                 |
|---------------------|--------------------------------------------------------------|
| `pnpm dev`          | Dev server (`NODE_OPTIONS=--max-old-space-size=4096`)        |
| `pnpm build`        | Production build, webpack, standalone output                 |
| `pnpm start`        | Serve the production build                                   |
| `pnpm lint`         | ESLint flat config                                           |
| `pnpm test`         | Jest suite (ts-jest, node env)                               |
| `pnpm test:watch`   | Jest watch mode                                              |
| `pnpm tauri:dev`    | Tauri desktop dev                                            |
| `pnpm tauri:build`  | Tauri desktop bundle                                         |
| `npx tsc --noEmit`  | Type-check without emit (the build itself ignores TS errors) |

Targeted examples:

```bash
npx jest __tests__/security/auth.test.ts                 # Single test file
npx jest -t "isValidUUID"                                # Single test by name
npx jest __tests__/security --testPathPattern=security   # A directory
```

---

## Project layout

```
src/
  app/
    (chat)/                # Web UI: chat, contract-scanner, history, matters,
                           #   models, settings, tabular-review, usage, vault, workflows
    api/                   # Server routes (chat, agent, chats, contract-scanner,
                           #   download-token, download, export-response,
                           #   extract-document, extract-legal-query, generate-docx,
                           #   legal-search, local-vault, matters, model,
                           #   scan-reports, tabular-review, tags, usage/stats,
                           #   auth/check-beta)
  components/              # UI components (chat, contract-scanner, …)
  hooks/                   # useChatStore (Zustand + idb-keyval),
                           # useLocalVaultStore, useSpeechRecognition
  lib/                     # Backend helpers (see CLAUDE.md → Architecture)
__tests__/                 # Jest suites (security/, rag/, lib/)
src-tauri/                 # Tauri v2 desktop shell
supabase/migrations/       # SQL migrations (001 → 006)
public/                    # Static assets
scripts/                   # Build helpers (e.g. favicon generation)
```

For an exhaustive map of `src/lib/` and the streaming/streaming-stripping state machine in `src/app/api/chat/route.ts`, see `CLAUDE.md`.

## Docs

- [`docs/private-mode.md`](docs/private-mode.md) — how the app behaves when Supabase isn't configured, and how to enable real machine-bound IDs.

---

## License

See `LICENSE`.