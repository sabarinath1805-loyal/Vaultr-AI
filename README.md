<p align="center">
  <img src="public/icon-512.png" alt="Vaultr logo" width="112" />
</p>

<h1 align="center">Vaultr</h1>

<p align="center"><strong>Private legal intelligence, in your hands.</strong><br />A local-first AI legal assistant for research, contracts, and matters.</p>

<p align="center">
  <a href="https://github.com/sabarinath1805-loyal/Vaultr-AI/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/sabarinath1805-loyal/Vaultr-AI/ci.yml?branch=master&label=build" alt="Build status" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" />
  <img src="https://img.shields.io/badge/version-1.0.0-informational.svg" alt="Version 1.0.0" />
  <img src="https://img.shields.io/badge/node-22%20LTS-green.svg" alt="Node 22 LTS required" />
  <img src="https://img.shields.io/badge/pnpm-11-orange.svg" alt="pnpm 11" />
  <img src="https://img.shields.io/badge/open%20source-yes-brightgreen.svg" alt="Open source" />
</p>

Vaultr is a local-first AI legal assistant: in Private Mode, your documents and conversations stay on your device. Cloud providers, legal search, authentication, and Supabase-backed RAG are optional and opt-in.

## Why Vaultr

- 🔒 **Private by default** - local Ollama inference, SQLite storage, and an IndexedDB vault.
- ⚖️ **Legal workflows** - contract scanning, matter management, document review, and legal research.
- 🧠 **Multi-model** - switch providers per conversation and keep a local fallback available.
- 🔎 **Grounded research** - retrieve relevant cases and citations from configured legal sources.
- 📝 **Practical output** - export responses, generate DOCX files, and track risks clearly.
- 🖥️ **Desktop-first option** - package the same app in a Tauri v2 shell for macOS, Windows, and Linux.

## Supported providers

| Provider | Use | Configuration |
| --- | --- | --- |
| Ollama | Local/private models | `OLLAMA_URL` |
| Groq | Fast hosted inference and fallback | `GROQ_API_KEY` |
| Gemini | Google-hosted models | `GEMINI_API_KEY` |
| OpenAI-compatible | ClaudeOpus gateway and compatible endpoints | `CLAUDEOPUS_API_KEY`, `ANTHROPIC_BASE_URL` |

## Screenshots

<!-- Replace these paths with final screenshots before launch. -->
![Vaultr chat workspace](docs/screenshots/chat-workspace.png)
![Vaultr contract scanner](docs/screenshots/contract-scanner.png)
![Vaultr private mode](docs/screenshots/private-mode.png)

## Architecture

```text
Next.js 16 App Router + TypeScript
        |
        +-- Tauri v2 desktop shell
        +-- SQLite + Drizzle (local chats and metadata)
        +-- IndexedDB (local vault and UI state)
        +-- Optional Supabase + pgvector (auth, usage, cloud RAG)
        +-- Ollama, Groq, Gemini, and OpenAI-compatible providers
```

The browser UI lives in `src/app` and `src/components`; server routes are in `src/app/api`; shared integrations are in `src/lib`; migrations are in `supabase/migrations`; and the desktop shell is in `src-tauri`.

## Quick start

### Prerequisites

**Node 22 LTS is required. Do not use Node 24:** `better-sqlite3` does not provide a prebuilt Windows binary for Node 24 and its native compilation fails on a typical Windows setup. The repository includes `.nvmrc` with the supported major version. Install Node 22 LTS, then install pnpm 11 and (for desktop builds) Rust, the Tauri system prerequisites, and Ollama if you want local inference. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for platform-specific packages.

```bash
git clone https://github.com/sabarinath1805-loyal/Vaultr-AI.git
cd Vaultr-AI
nvm use                         # Node 22, when using nvm
pnpm install
cp .env.example .env.local       # macOS/Linux
# Copy-Item .env.example .env.local  # Windows PowerShell
pnpm dev
```

Open `http://localhost:3000`. Run `pnpm tauri:dev` for the desktop shell. Configure only the providers you need; every environment variable is documented in `.env.example`.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm tauri:build
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Bug fixes, tests, documentation, accessibility improvements, UI work, and new model integrations are welcome.

## License

Vaultr is released under the [MIT License](LICENSE).

## Built by

Vaultr is built by **Sabarinath**, a 13-year-old student in Singapore, as a student-built open source project. Contributions, thoughtful feedback, and responsible issue reports are welcome.
