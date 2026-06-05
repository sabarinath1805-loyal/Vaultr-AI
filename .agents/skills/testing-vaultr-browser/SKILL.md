---
name: testing-vaultr-browser
description: Test Vaultr browser flows end-to-end. Use when verifying chat, Cloud/Private mode, model selector, Models page, Contract Scanner, or runtime loop fixes.
---

# Vaultr Browser Testing

## Devin Secrets Needed

- `GROQ_API_KEY` — required for live Cloud Mode chat streaming through Groq.
- `TAVILY_API_KEY` — required only when a test needs real web-search results.

## Setup

1. Check PR CI/comments before execution with the built-in git tools.
2. Start the local production app from the repo root or worktree:
   ```bash
   GROQ_API_KEY=${GROQ_API_KEY} pnpm -C /path/to/Vaultr-AI start
   ```
3. Open `http://localhost:3000` in the browser.
4. If the app is already built with `output: 'standalone'`, `next start` may print a standalone warning while still serving the app; verify the browser loads before treating it as blocked.

## Core Browser Flow

1. In Cloud Mode, send a short prompt such as `Hello` and wait for a streamed Lex response.
2. Verify no React runtime overlay appears and server/browser logs do not contain `Maximum update depth exceeded`.
3. Toggle Cloud → Private → Cloud from the composer switch.
4. Verify Private Mode shows `Models` in the sidebar and the local/Ollama selector state, while Cloud Mode hides `Models` and selects `Lex Core`.
5. For elaboration-prompt changes, send a prompt containing `explain further`, `explain more`, `walk me through`, or `give me more detail`; verify the response is separated into short paragraphs.

## Evidence Capture

- Record browser interactions when testing UI behavior.
- Add recording annotations for setup, each test start, and each pass/fail assertion.
- Save screenshots for the Cloud chat response, mode/sidebar state, Models page, and any prompt-formatting response.
- Post exactly one PR comment with concise pass/fail bullets, caveats first, recording link, screenshots, and the Devin session URL.

## Known Local Environment Notes

- Ollama is often not running in the VM. Private Mode can still be tested for UI state (`Ollama not running`, Models visibility), but successful local inference requires an Ollama service and installed models.
- `/api/tags` may log `ECONNREFUSED` when Ollama is absent; that is expected unless the test specifically requires local model execution.
- Do not print secret values or write `.env.local` with real secrets; pass secrets as environment references such as `${GROQ_API_KEY}`.
