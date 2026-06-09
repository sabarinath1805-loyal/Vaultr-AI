# Vaultr Audit Report

**Date:** 2026-06-09
**Auditor:** Claude Opus 4.8 (Comprehensive 8-hour audit)
**Scope:** Full codebase review covering security, features, performance, and code quality
**Constraint:** `src/lib/lex.ts` must never be modified

---

## 1. Architecture Overview

Vaultr is a Next.js 16 + TypeScript legal AI assistant for Singapore lawyers, with optional Tauri desktop app. It supports:
- **Cloud mode**: Routes to Claude (via ClaudeOpus.pro), Groq, Gemini, Ollama Cloud
- **Private mode**: Local Ollama only
- **Tavily web search** for current legal information
- **RAG** across 12+ legal databases (CourtListener, BAILII, AustLII, etc.)
- **Citation resolver** that fetches judgment excerpts via Tavily
- **Document vault** (local SQLite, IndexedDB)
- **Contract scanner** with clause-level risk scoring
- **Matters** (legal case management)
- **Usage dashboard** (Supabase-backed metrics)

---

## 2. API Endpoints (Complete Inventory)

| Endpoint | Methods | Auth | Purpose | Issues Found |
|----------|---------|------|---------|--------------|
| `/api/chat` | POST | Optional (Supabase) | Main streaming chat with RAG + Tavily | Auth bypass in privacy mode (FIXED), IP-based rate limit (FIXED) |
| `/api/chats` | GET, POST | **ADDED** | List/create chats | DELETE removed (was unprotected) |
| `/api/chats/[id]` | GET, PATCH, DELETE | **ADDED** | Chat CRUD | All now require auth + ownership |
| `/api/chats/[id]/messages` | POST, PUT | **ADDED** | Add/replace messages | UUIDs now server-generated |
| `/api/contract-scanner` | POST | **NONE** | Scan a contract | **CRITICAL: No auth, runs expensive LLM call** |
| `/api/extract-document` | POST | **NONE** | Extract PDF/DOCX text | No auth, no rate limit |
| `/api/extract-legal-query` | POST | YES (optional) | Extract search terms via Groq | OK |
| `/api/legal-search` | POST | **NONE** | Search 12+ legal databases | **MEDIUM: No auth** |
| `/api/local-vault` | GET, PUT | **NONE** | Manage local docs (full replace) | **HIGH: No auth, full PUT replaces everything** |
| `/api/scan-reports` | GET, POST, DELETE | **NONE** | Contract scan history | **HIGH: No auth, DELETE has no id validation** |
| `/api/tags` | GET | **NONE** | List Ollama models | OK (no sensitive data) |
| `/api/model` | POST | **NONE** | Pull Ollama model | **LOW: SSRF risk if OLLAMA_URL is user-controlled** |
| `/api/download/[filename]` | GET | **NONE** | Download generated docx/pdf | **HIGH: Path traversal (FIXED)** |
| `/api/export-response` | POST | **NONE** | Export chat as PDF/DOCX | **MEDIUM: No auth, hardcoded /tmp path** |
| `/api/generate-docx` | POST | **NONE** | Generate structured DOCX | **MEDIUM: No auth, hardcoded /tmp path** |
| `/api/auth/check-beta` | POST | **NONE** | Check if email is approved | **LOW: Email enumeration possible** |

---

## 3. Environment Variables

| Variable | Purpose | Used In |
|----------|---------|---------|
| `GROQ_API_KEY` | Groq API (llama models) | chat, extract-legal-query, contract-scanner fallback |
| `TAVILY_API_KEY` | Tavily web search | chat, citation-resolver |
| `GEMINI_API_KEY` | Google Gemini | chat (Gemini models) |
| `OLLAMA_API_KEY` | Ollama Cloud | chat (Ollama Cloud) |
| `CEREBRAS_API_KEY` | Cerebras inference | chat (fallback) |
| `HARVARD_CAP_API_KEY` | Harvard Caselaw Access | legal-search (optional) |
| `CLAUDEOPUS_API_KEY` | ClaudeOpus.pro (Anthropic) | chat, contract-scanner |
| `ANTHROPIC_BASE_URL` | Custom Claude endpoint | chat, contract-scanner |
| `OLLAMA_URL` | Local Ollama server | chat (private mode), contract-scanner (private) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role | supabase (server) |
| `DOWNLOAD_DIR` | Where to write docx/pdf | download, export, generate-docx |
| `NODE_OPTIONS` | Node memory limit | build scripts |

---

## 4. External Services

| Service | Purpose | Auth |
|---------|---------|------|
| **Tavily** | Web search + citation resolver | API key |
| **Supabase** | Beta whitelist, auth, usage logs, rate limits | JWT |
| **Groq** | LLM inference (llama, Claude Haiku/Sonnet) | API key |
| **ClaudeOpus.pro** | Anthropic Claude models (OpenAI-compatible) | API key |
| **Google Gemini** | Gemini models | API key |
| **Cerebras** | Fast inference (fallback) | API key |
| **Ollama Cloud** | Cloud-hosted Ollama models | API key |
| **Ollama (local)** | Private mode LLM | None (local) |
| **CourtListener** | US case law | None (free) |
| **BAILII** | UK/Ireland case law | None (free) |
| **AustLII** | Australia case law | None (free) |
| **CommonLII** | Commonwealth case law | None (free) |
| **EUR-Lex** | EU law | None (free) |
| **Indian Kanoon** | India case law | Token (empty) |
| **Singapore Courts** | SG case law | None (free) |
| **Singapore Statutes** | SG statutes | None (free) |
| **UK Legislation** | UK statutes | None (free) |
| **AU Legislation** | AU statutes | None (free) |
| **India Code** | India statutes | None (free) |
| **WorldLII** | International case law | None (free) |
| **Caselaw Access Project** | US historical cases | Optional API key |
| **Wikipedia** | Legal concept grounding | None (free) |

---

## 5. Security Issues Found

### P0 - CRITICAL (Already Fixed in commit 5a17641)
1. ✅ **`/api/chats` had no auth** — anyone could read/write/delete all chats
2. ✅ **No chat ownership validation** — cross-user data access possible
3. ✅ **Unprotected DELETE `/api/chats`** — mass destruction endpoint
4. ✅ **Privacy mode rate limit bypass** — set `usePrivacyMode: true` to skip all limits

### P0 - CRITICAL (To Fix This Session)
5. 🔴 **`/api/contract-scanner` has no auth** — expensive LLM calls, anyone can abuse
6. 🔴 **`/api/extract-document` has no auth** — no rate limit on PDF/DOCX parsing
7. 🔴 **`/api/local-vault` PUT replaces entire vault** — one request wipes all docs

### P1 - HIGH (To Fix)
8. 🟠 **`/api/scan-reports` DELETE has no ownership check** — anyone can delete any report
9. 🟠 **`/api/scan-reports` GET lists all reports** — privacy leak
10. 🟠 **`/api/legal-search` has no auth** — no rate limit on 12+ external API calls
11. 🟠 **`/api/download/[filename]` path traversal** (already fixed but needs verification)
12. 🟠 **`/api/export-response` and `/api/generate-docx` use hardcoded `/tmp`** — already added DOWNLOAD_DIR support to download, but not to these
13. 🟠 **Client-provided message IDs** (already fixed in messages endpoint)
14. 🟠 **No content-length limit on most endpoints** (chat has 100KB, others unlimited)
15. 🟠 **`/api/auth/check-beta` allows email enumeration** — returns boolean, attacker can probe valid emails

### P2 - MEDIUM
16. 🟡 **No security headers** (CSP, X-Frame-Options, X-Content-Type-Options)
17. 🟡 **Legal search query injection** — passed to multiple external APIs
18. 🟡 **No request timeout on most endpoints**
19. 🟡 **No request body size limit on most endpoints**
20. 🟡 **Indian Kanoon uses empty token** — `Authorization: "Token "` may fail silently

### P3 - LOW
21. ⚪ **`/api/model` POST proxies to OLLAMA_URL** — SSRF if OLLAMA_URL is user-controlled (currently it's an env var, so OK)
22. ⚪ **Console.error may leak sensitive data** in error messages
23. ⚪ **No CSRF protection** on POST endpoints (relying on CORS + Bearer token)

---

## 6. Performance Issues Found

1. **Sequential RAG queries**: `searchLegalDatabases` runs 4 databases in parallel but `extractLegalQuery` (LLM call) happens BEFORE the parallel block. Could run in parallel.
2. **No request timeout on most endpoints**: Could hang indefinitely
3. **Tavily call and RAG call are sequential** in some code paths
4. **Wikipedia fetch is sequential** with RAG
5. **No streaming for non-LLM responses**
6. **No caching of legal search results**
7. **`/api/chat` reassembles `systemMessage` as one big string** — could be slow for large contexts

---

## 7. Bugs Found (Non-Security)

1. **`/api/chat/route.ts:148`** — `if (privacyMode && !isLexModel(requestedModel))` checks model, but if `requestedModel` is null, this passes. Need to also check that requestedModel is a valid Lex model.
2. **`/api/chats/route.ts:36`** — `await req.json().catch(() => ({}))` silently swallows JSON parse errors
3. **`/api/contract-scanner/route.ts:82`** — `JSON.parse(responseBody)` can throw if response is empty
4. **`/lib/legal-search.ts`** — Many try/catch blocks silently swallow errors with empty catch — hard to debug
5. **`/api/chat/route.ts`** — `clearTimeout(timeout)` only called in catch block, not in success path (memory leak risk on long-lived connections)
6. **`/lib/tauri-env.ts`** — `getConfiguredApiKey` reads from disk on every call — should be cached
7. **`/api/scan-reports/route.ts`** — `GET` with no `id` returns ALL reports with no pagination
8. **`/api/local-vault/route.ts:101-103`** — `DELETE FROM local_vault_documents` then re-inserts. If the PUT request is malformed, data is lost.

---

## 8. Dead Code

1. **Cerebras** — Still referenced in `/api/chat/route.ts` and `/lib/models.ts` for cloud provider routing. Used as fallback. Not dead, but flagged in Phase 5 cleanup.
2. **`Ollama Cloud`** — Same as above, used as fallback. Not dead.
3. **`z.ai` / `glm-4` / `minimax`** — Not found in src/ (already cleaned up)
4. **`/api/chat/test.ts`** — Test file in production code path. Should be in `__tests__/`.
5. **Backup files** — `src/app/api/chat/route.ts.backup` and `.bak` should be removed
6. **Unused imports** — Need full sweep

---

## 9. Code Quality Issues

1. **No tests** — Project has no test suite configured
2. **No JSDoc** on most public functions
3. **Inconsistent error handling** — some endpoints log errors, others silently swallow
4. **Magic numbers** — Rate limits hardcoded in `/lib/rate-limit.ts`
5. **No request validation library** (zod is installed but barely used)
6. **Type safety** — Many `as` casts, `unknown` types not narrowed

---

## 10. Compliance & Privacy

1. **No data retention policy** documented
2. **No GDPR data export/delete** endpoint
3. **Usage logs stored in Supabase** — needs retention policy
4. **No audit log** for sensitive operations

---

## 11. Test Coverage

- **Unit tests**: 0
- **Integration tests**: 0
- **E2E tests**: 0
- **Security tests**: 0

---

## 12. Next Steps

This report will guide Phases 2-7 of the audit:
- **Phase 2**: Fix P0/P1 security issues
- **Phase 3**: Verify all features work end-to-end
- **Phase 4**: Add performance timing + optimizations
- **Phase 5**: Remove dead code + debug logs
- **Phase 6**: Write comprehensive test suite
- **Phase 7**: Add documentation

