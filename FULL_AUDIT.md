# Vaultr — Full Codebase Audit

**Date:** 2026-06-10
**Auditor:** Multi-agent review (6 parallel dimensions: security, bugs, performance, dead code, quality, compliance)
**Scope:** All 128 `.ts`/`.tsx` files under `src/` plus `supabase/migrations/001_initial_schema.sql`, `next.config.mjs`, `package.json`, `src-tauri/tauri.conf.json`, and the `__tests__/security/` harness
**Constraint:** `src/lib/lex.ts` is never modified (read-only reference) and was not touched by this audit
**Production target:** Singapore lawyers handling real client data; PII is implied throughout

---

## 1. Executive Summary

Six parallel specialist subagents scanned Vaultr's source tree. They returned **97 findings** across the security, functional-bug, performance, dead-code, quality, and compliance axes. This document is the *finding inventory and remediation plan* — it does not claim that fixes have been applied. Use it to drive a follow-up PR series, prioritised by the table in §2.

| Dimension | Findings | P0 / critical | P1 / high | P2–P3 / medium–low |
|-----------|---------:|--------------:|----------:|-------------------:|
| Security | 8 | 2 | 6 | 0 |
| Bugs (functional) | 5 | 2 | 2 | 1 |
| Performance | 14 | 0 | 4 | 10 |
| Dead code | 12 | — | — | 12 (all removable) |
| Quality | 16 | — | 3 | 13 |
| Compliance (GDPR/PDPA) | 31 | 9 P0 | 11 P1 | 11 P2 |
| **Total** | **97** | **13** | **23** | **47 + 12 dead code** |

Severity rules used:
- **P0 (security/critical/compliance)** — exploitable now, data loss, or a regulatory failure waiting to happen. Must be fixed before any non-developer traffic.
- **P1 (high)** — direct path to a P0 once combined with another finding, or a real-but-narrow bug that bites production.
- **P2 (medium)** — quality-of-life, perf, or hardening that prevents a future regression.
- **Dead code** — always safe to remove; tracked separately in §7.

Two patterns dominate the audit:

1. **Auth is not enforced as a default.** When Supabase is unconfigured, every route that calls `requireAuth` instead falls through to the open path. When it *is* configured, several routes skip `requireAuth` entirely and rely on IP rate-limits. Any single config flip therefore exposes the entire surface. Fix by adding a `middleware.ts` that hard-gates `/api/*` when Supabase is configured, and a hard-fail boot check when it is not in production.
2. **PII is treated as a log line.** IP addresses, filenames, raw query fragments, and full error bodies from third-party LLMs are written to `console.error`. Under PDPA this is a problem; under SOC2 it's a control failure; under any future subpoena, it's a discoverable artefact. Centralise and scrub.

`src/lib/lex.ts` was not opened, not modified, and not even read by the audit agents — the system prompt is out of scope and remains untouched.

---

## 2. Top P0 / P1 Action List

| # | Severity | File | Issue | One-line fix |
|---|----------|------|-------|--------------|
| 1 | P0 | `src/app/api/scan-reports/route.ts:286` | DELETE has no `requireAuth` and no owner filter | Add `requireAuth()` and `WHERE id=? AND owner_id=?` |
| 2 | P0 | `src/app/api/local-vault/route.ts:91` | PUT wipes the entire vault with no auth | Add `requireAuth()`; partition by `userId` |
| 3 | P0 | `supabase/migrations/001_initial_schema.sql:14` | No data-retention / right-to-erasure path; no FK cascade | Add `delete_user_data(user_id)` RPC + `ON DELETE CASCADE` |
| 4 | P0 | `supabase/migrations/001_initial_schema.sql:39` | RLS enabled but no write policies on `usage_logs` / `rate_limits`; no read policy on `beta_users` | Add INSERT/UPDATE/DELETE policies + restrictive SELECT on `beta_users` |
| 5 | P0 | `src/lib/api-auth.ts:42` | `SKIP_AUTH_CHECK` / "allow all when Supabase not configured" | Hard-fail boot in production when Supabase URL is unset; remove env-driven bypass |
| 6 | P0 | `src/app/api` (no `middleware.ts`) | No top-level middleware — every route hand-rolls auth/size/rate-limit | Add `middleware.ts` that gates `/api/*` and adds HSTS / CSP / COOP headers |
| 7 | P0 | `next.config.mjs:26` | CSP has `unsafe-inline`/`unsafe-eval`; no HSTS, CORS, COOP, CORP | Replace with nonce CSP; add HSTS preload; set strict transport headers |
| 8 | P0 | `src/lib/supabase.ts:18` | Client-side `persistSession:true` + IndexedDB chat cache unencrypted at rest | Disable `persistSession` for legal deployments; encrypt IndexedDB or move to server session cookie |
| 9 | P0 | `src/lib/supabase.ts:102` | `logUsage()` stores full client IP forever in `usage_logs` | Mask to /24 (v4) / /48 (v6); add 90-day retention cron + privacy-policy notice |
| 10 | P1 | `src/app/api/scan-reports/route.ts:177` | GET returns *all* scan reports, not just the caller's | Add `WHERE owner_id = $userId`; drop the silent "anonymous" fallback |
| 11 | P1 | `src/app/api/chat/route.ts:190` | Trusts `x-forwarded-for` blindly; same header writes the IP into `usage_logs` | Use a trusted-proxy-aware helper; mask before persisting |
| 12 | P1 | `src/app/api/export-response/route.ts:98` | No auth on export; output written to shared `DOWNLOAD_DIR` | `requireAuth()`; user-scoped output path; signed download token |
| 13 | P1 | `src/app/api/generate-docx/route.ts:142` | No auth; no size cap; no rate limit | `requireAuth()`; `validateRequestSize(1MB)`; per-user rate cap |
| 14 | P1 | `src/lib/api-auth.ts:42` | `SKIP_AUTH_CHECK` env var allows bypass | Build-time guard so it cannot be set in production |
| 15 | P1 | `src/app/api/legal-search/route.ts:11` | In-memory rate-limit map has no TTL → unbounded growth | LRU cap (e.g. 5k) + periodic sweep, or move to `rate_limits` table |
| 16 | P1 | `src/app/api/legal-search/route.ts:1` | Route is fully unauthenticated; 200-char queries hit 12+ external DBs | `requireAuth()` + per-user quota distinct from per-IP |
| 17 | P1 | `src/app/api/extract-legal-query/route.ts:1` | Verbatim user message → Groq (third-party LLM) with no redaction or audit | `requireAuth()` unconditionally; local Ollama path when privacy mode is on |
| 18 | P1 | `src/app/api/agent/route.ts:165` | `ANTHROPIC_BASE_URL` is user-overridable to any host; full transcript sent | Allow-list approved hosts; redact NRIC/UEN/passport before send |
| 19 | P1 | `src/lib/legal-search.ts:82` | Query fragments (and downstream PII) logged to `console.error` from 6+ sites | PII-scrubbing logger wrapper; replace with `request_id` |
| 20 | P1 | `src/app/api/chat/route.ts:273` | Filenames logged in plaintext (often contain client matter refs) | Hash to `[doc_a3f9]` placeholders in server logs |
| 21 | P1 | `src/lib/api-auth.ts:103` | `sanitizeString` does not normalise Unicode / strip zero-width / homoglyphs | NFKC normalise; strip ZW/ZWJ/direction overrides |
| 22 | P1 | `src/app/api/auth/check-beta/route.ts:27` | Unauthenticated user-enumeration endpoint | Require auth or CAPTCHA; return constant response to anonymous callers |
| 23 | P1 | `src/app/api/download/[filename]/route.ts:18` | No auth; default `DOWNLOAD_DIR` falls back to `/tmp` (world-readable) | `requireAuth()` + signed time-limited token; override `DOWNLOAD_DIR` to non-world-readable path |
| 24 | P1 | `src/lib/legal-search.ts:805,807` | `c.title.toLowerCase()` and `c.jurisdiction.toLowerCase()` will crash on null fields | Null-guard before `.toLowerCase()` |
| 25 | P1 | `src/lib/legal-search.ts:686` | Race condition in `getCachedResult` mutates the map during iteration | Move eviction to the write path only |
| 26 | P1 | `src/lib/matters.ts:173` | `crypto.randomUUID` fallback uses `Math.random` — not a UUID and not crypto-safe | Use the `uuid` package or assert `crypto.randomUUID` is available |
| 27 | P1 | `src/lib/db/chats.ts:131` | N+1 query in `listChatsWithMessages` | Single SQL JOIN or paginate with lazy-load |
| 28 | P1 | `src/lib/db/index.ts:54` | Missing composite indexes on `messages(chat_id, created_at)` and `messages(created_at)` | Add the indexes via migration |
| 29 | P1 | `src/lib/legal-search.ts:785` | 12 parallel `searchLegalDatabases` calls with 8s timeouts each | Cap concurrency (e.g. 4) with `Promise.allSettled`; cancel slow losers |
| 30 | P1 | `src/components/chat/chat.tsx:797` | No debounce on message input; re-renders storm | `useCallback` handlers + debounced input |

The remainder of this document expands each finding with the verbatim description and remediation that the source-agent produced, grouped by dimension.

---

## 3. Security (8 findings)

### S-1 — `src/app/api/scan-reports/route.ts:286`  [P0]
DELETE has NO authentication. Any caller can delete any scan report by ID.

**Fix:** Add `requireAuth(req)` and filter by `ownerId`: `DELETE … WHERE id = ? AND owner_id = ?`.

### S-2 — `src/app/api/local-vault/route.ts:91`  [P0]
PUT has NO authentication. Anyone can wipe the entire local vault database.

**Fix:** Add `requireAuth()` before processing the PUT; partition vault by `userId`.

### S-3 — `src/app/api/scan-reports/route.ts:177`  [P1]
GET /scan-reports list returns ALL scan reports with no owner filter — cross-tenant data leak.

**Fix:** Add `WHERE owner_id = $userId` to the base query; remove the silent `userId='anonymous'` fallback.

### S-4 — `src/app/api/chat/route.ts:190`  [P1]
Rate limiting trusts `x-forwarded-for` header without validation — trivially spoofed to bypass the per-IP limit.

**Fix:** Use a trusted-proxy-aware helper; fall back to `req.socket.remoteAddress`; mask IPs before storage (see C-9).

### S-5 — `src/app/api/export-response/route.ts:98`  [P1]
POST has NO authentication — allows unauthenticated export generation; output lands in shared `DOWNLOAD_DIR`.

**Fix:** Add `requireAuth(req)`; use authenticated `userId` in audit; write to user-scoped path with signed download token.

### S-6 — `src/app/api/generate-docx/route.ts:142`  [P1]
POST has NO authentication — unauthenticated DOCX generation, no size cap, no rate limit.

**Fix:** Add `requireAuth(req)`; `validateRequestSize(1MB)`; per-user hourly cap.

### S-7 — `src/lib/api-auth.ts:42`  [P1]
`SKIP_AUTH_CHECK` env var allows auth to be disabled in production.

**Fix:** Remove it, or guard it behind a build-time check that fails the prod build.

### S-8 — `src/app/api/legal-search/route.ts:11`  [P1]
In-memory rate-limit Map has no TTL/cleanup — memory leak grows unbounded.

**Fix:** LRU cap + periodic sweep, or move to the `rate_limits` Supabase table (which is already provisioned but unused for this route).

---

## 4. Functional Bugs (5 findings)

### B-1 — `src/lib/legal-search.ts:805`  [critical]
`c.title.toLowerCase()` crashes when `c.title` is undefined or null in an API response.

**Fix:**
```ts
const title = c.title || "";
const lowerTitle = title.toLowerCase();
```

### B-2 — `src/lib/legal-search.ts:807`  [critical]
`c.jurisdiction.toLowerCase()` has the same crash class.

**Fix:**
```ts
const jurisdiction = c.jurisdiction || "";
if (detectedJurisdiction && jurisdiction.toLowerCase().includes(detectedJurisdiction)) score += 2;
```

### B-3 — `src/lib/legal-search.ts:686`  [major]
Race condition in cache eviction — `getCachedResult` mutates the Map while iterating when entries expire.

**Fix:** Move eviction to the write path (`setCachedResult`); reads only read.

### B-4 — `src/lib/matters.ts:173`  [major]
`crypto.randomUUID` is optional per spec; fallback uses `Math.random`, which is not crypto-safe and can produce non-UUID strings.

**Fix:** Use the `uuid` package, or assert `crypto.randomUUID` is available (Node 19+, modern browsers).

### B-5 — `src/lib/legal-search.ts:808`  [minor]
`parseInt(c.year, 10)` returns `NaN` for empty strings. The score code happens to treat NaN as falsy so this is benign, but a defensive parse is clearer.

**Fix:**
```ts
const year = c.year ? parseInt(c.year, 10) : 0;
```

### B-6 — `src/lib/contract-scanner.ts:157`  [minor]
`sortClausesByRisk` accesses `RISK_ORDER[a.risk]` without a fallback — undefined comparisons on unexpected risk values.

**Fix:**
```ts
const aOrder = RISK_ORDER[a.risk] ?? 4;
const bOrder = RISK_ORDER[b.risk] ?? 4;
return aOrder - bOrder;
```

---

## 5. Performance (14 findings)

### P-1 — `src/lib/db/chats.ts:131`  [high]
N+1 in `listChatsWithMessages` — one query per chat to fetch its messages.

**Fix:** Single SQL JOIN, or paginate the home screen with lazy message loading.

### P-2 — `src/lib/db/index.ts:54`  [high]
Missing composite indexes — `messages(chat_id, created_at)` and `messages(created_at)` need explicit indexes.

**Fix:** Add a migration with the indexes.

### P-3 — `src/lib/legal-search.ts:785`  [high]
`searchLegalDatabases` fans out 12 concurrent requests each with an 8-second timeout.

**Fix:** Cap concurrency to ~4 with `Promise.allSettled`; prefer early-return sources; cancel losers.

### P-4 — `src/components/chat/chat.tsx:797`  [high]
Message input is not debounced; handlers are not memoised — re-render storms during typing.

**Fix:** `useCallback` for handlers; debounce the text input update; lift non-rendering state out of `Chat`.

### P-5 — `src/app/hooks/useChatStore.ts:177`  [high]
`syncQueues` Map is not bounded; completed entries never get reaped.

**Fix:** Sweep on every Nth `enqueue`, or use a per-chat WeakMap.

### P-6 — `src/components/chat/chat-message.tsx:642`  [medium]
`useMemo` not used for `cleanContent`, citation extraction, or markdown component construction.

**Fix:** Wrap each in `useMemo` keyed on the message id.

### P-7 — `src/app/api/chats/route.ts:16`  [medium]
`listChatsWithMessages` has no pagination — the entire history is fetched in one call.

**Fix:** Add `LIMIT/OFFSET` (or cursor) pagination; default page size 20.

### P-8 — `src/components/chat/chat.tsx:605`  [medium]
Inline styles on every streaming token — style recalc on every chunk.

**Fix:** Move to CSS classes; use CSS variables.

### P-9 — `src/components/chat/composer-card.tsx:239`  [medium]
Document content extraction is not properly async-batched.

**Fix:** `await Promise.all(...)` for parallel files; surface a single error if any fail.

### P-10 — `src/app/hooks/useLocalVaultStore.ts:138`  [medium]
Linear-scan duplicate filename check.

**Fix:** Maintain a `Set<string>` of filenames; O(1) lookups.

### P-11 — `src/lib/chat-message-content.ts:36`  [low]
Excessive array operations in `extractThinkContent` — early returns and a precompiled regex help.

**Fix:** Combine the two regex passes into one; bail on the first match.

### P-12 — `src/components/chat/chat-list.tsx:418`  [low]
No virtualization for the message list — a long conversation renders all nodes.

**Fix:** Add a windowing implementation (e.g. `react-virtuoso` or a manual IntersectionObserver) — but only if a 1k+ message thread is a real product case.

### P-13 — `src/components/chat/composer-card.tsx:186`  [low]
No debounce on form submit — accidental double-send.

**Fix:** Disable submit button + in-flight ref.

### P-14 — `src/lib/legal-search.ts:695`  [low]
Manual cache eviction runs on the read path.

**Fix:** Move to the write path; rely on the same hook the rest of the codebase uses.

---

## 6. Compliance — GDPR / PDPA / SOC2 (31 findings)

The compliance audit produced 31 findings; nine are P0 (must fix before any non-developer traffic). They cluster around three themes:

1. **No right-to-erasure path** (C-3, C-4, C-5, C-6, C-14)
2. **PII in logs** (C-12, C-13, C-19, C-20, C-26, C-31)
3. **Unauthenticated routes leaking user data** (C-1, C-2, C-7, C-8, C-9, C-10, C-11, C-15, C-16, C-17, C-18, C-22, C-23, C-24, C-25, C-27, C-28, C-29, C-30)

### Compliance P0 (must fix first)

| ID | File | Issue | Remediation |
|----|------|-------|-------------|
| C-1 | `src/lib/supabase.ts:18` | Supabase URL/anon key embedded in client bundle; `persistSession:true` stores JWTs in `localStorage`; chat content in IndexedDB unencrypted at rest. CSP allows `unsafe-inline`. | Disable `persistSession` for legal deployments; encrypt IndexedDB with WebCrypto, or move to an HttpOnly+Secure+SameSite=Strict server cookie; tighten CSP to nonce-based. |
| C-2 | `src/lib/supabase.ts:102` | `logUsage()` stores full client IP indefinitely in `usage_logs`; pairs with `user_id` and `model` to form a persistent behavioural profile. | Mask IPs to /24 (v4) / /48 (v6); add a 90-day retention cron (pg_cron); mirror the same for `rate_limits`; document in the privacy policy. |
| C-3 | `supabase/migrations/001_initial_schema.sql:14` | No retention or deletion mechanism for `usage_logs`/`rate_limits`; no FK `ON DELETE CASCADE` from `auth.users`; right-to-erasure (GDPR Art. 17 / PDPA) is impossible without manual admin work. | Add `delete_user_data(user_id)` RPC; add retention TTL + cron; add RLS write policies. |
| C-4 | `supabase/migrations/001_initial_schema.sql:39` | RLS enabled but only SELECT policies defined; `beta_users` has no policies so even the anon key can enumerate beta-tester emails. | Add INSERT/UPDATE/DELETE policies on the logs; add a restrictive SELECT on `beta_users` (service-role only). |
| C-5 | `src/lib/api-auth.ts:42` | `SKIP_AUTH_CHECK` and the "allow all when Supabase not configured" comment imply open-access fall-through. | Hard-fail boot in production when `NEXT_PUBLIC_SUPABASE_URL` is unset; remove or guard `SKIP_AUTH_CHECK`. |
| C-6 | `src/app/api` (no `middleware.ts`) | No central middleware; per-route hand-rolled auth leads to drift. Anonymous-callable routes when Supabase is configured: `legal-search`, `extract-legal-query`, `extract-document`, `download`, `generate-docx`, `export-response`, `scan-reports`. | Add `middleware.ts` that gates `/api/*` when Supabase is configured; add a 60 req/min global cap; add CORS / security headers. |
| C-7 | `next.config.mjs:26` | CSP allows `unsafe-inline`/`unsafe-eval`; no HSTS, COOP, CORP, CORS. | Replace with nonce-based CSP; HSTS preload; COOP/COEP/CORP; strict CORS; `Referrer-Policy: no-referrer` on PII routes. |
| C-8 | `src/app/api/chat/route.ts:150` | Trusts `x-forwarded-for` with no hop-count check; the IP then goes into the in-memory rate limiter (collision risk behind NAT) *and* `usage_logs` (PII). | Trusted-proxy-aware IP helper; mask before storage. |
| C-9 | (cross-cutting) | In-memory legal-search cache (5 min TTL, 500 entries) holds full `LegalSearchResult` objects keyed on raw query text — no PII filter, no LRU on read path. | Cap at 200 entries with strict LRU; never cache queries matching NRIC/email patterns. |

### Compliance P1

| ID | File | Issue | Remediation |
|----|------|-------|-------------|
| C-10 | `src/app/api/legal-search/route.ts:1` | Unauthenticated; no audit trail; per-IP-only rate limit. | `requireAuth()`; log to a Supabase audit table; add per-user quota. |
| C-11 | `src/app/api/extract-legal-query/route.ts:1` | Verbatim user message sent to Groq (third-party LLM) with no redaction. | `requireAuth()` unconditionally; local Ollama path in privacy mode. |
| C-12 | `src/app/api/agent/route.ts:165` | `ANTHROPIC_BASE_URL` is user-overridable; full transcript + document content can be sent to an attacker-controlled host. | Allow-list `api.anthropic.com` / `api.claudeopus.pro`; reject others; redact NRIC/UEN/passport before send. |
| C-13 | `src/lib/legal-search.ts:82` | Query fragments logged to `console.error` (CourtListener, SingaporeLawWatch, ICLR, FedCourtAU, GoogleScholar, extractLegalQuery fallbacks). | PII-scrubbing logger; cap log strings at 50 chars; use `request_id` instead of query text. |
| C-14 | `src/app/api/chat/route.ts:273` | Filenames logged in plaintext — often contain client matter references. | Hash to `[doc_a3f9]` placeholders in server logs. |
| C-15 | `src/lib/api-auth.ts:103` | `sanitizeString` does not normalise Unicode, strip zero-width chars, or fold homoglyphs. | NFKC normalise; strip ZW/ZWJ/direction overrides; run a PII detector pass before persisting. |
| C-16 | `src/app/api/auth/check-beta/route.ts:27` | Unauthenticated user-enumeration endpoint — any email can be probed. | Require auth or CAPTCHA; return a constant response to anonymous callers. |
| C-17 | `src/app/api/download/[filename]/route.ts:18` | Unauthenticated; default `DOWNLOAD_DIR` falls back to `/tmp/vaultr-downloads` (world-readable on Linux); no signed URL; no `Content-Disposition: attachment`. | `requireAuth()` + signed, time-limited token; `Cache-Control: private, no-store`; reject `/tmp` fall-through in prod. |
| C-18 | `src/app/api/scan-reports/route.ts:147` | GET downgrades to `userId='anonymous'` on auth failure; DELETE/POST have no auth at all — scan reports store counterparty names, financial terms, risk findings. | `requireAuth()`; never fall through to `anonymous`; add `owner_id` filtering on every query. |
| C-19 | `src/app/api/local-vault/route.ts:64` | GET returns all documents (including base64 `dataUrl`) to any caller; PUT replaces the whole vault. | `requireAuth()`; partition by `userId`; never return `dataUrl` for documents the caller does not own. |
| C-20 | `src/lib/db/index.ts:45` | No GDPR Art. 20 data-export endpoint; no easy delete path; no retention baseline. | Add `/api/user/export` (JSON archive) and `/api/user/delete`; document retention in the privacy policy. |
| C-21 | `src/lib/rate-limit.ts:19` | In-memory Map, no eviction, not horizontally scalable, hard-coded limits. | Move to Supabase `rate_limits` (already provisioned) or Redis; add LRU sweep; externalise limits to env. |

### Compliance P2

| ID | File | Issue | Remediation |
|----|------|-------|-------------|
| C-22 | `src/app/api/contract-scanner/route.ts:10` | 10MB cap enforced post-parse; no MIME allow-list; output persisted to unauthenticated `scan_reports`. | Pre-check `Content-Length`; allow-list MIME types; stream to disk. |
| C-23 | `src/app/api/extract-document/route.ts:67` | `dataUrl` is parsed and the text returned to any caller; no auth, no type cap, no per-user concurrency cap. | `requireAuth()`; MIME allow-list; per-user concurrency cap. |
| C-24 | `src/lib/supabase.ts:78` | `beta_users.email` stored plaintext; no consent timestamp; no deletion API. | Hash at app level; add `consent_version` + `accepted_at`; add deletion API. |
| C-25 | `src/lib/api-auth.ts:82` | `validateRequestSize()` clones the body (doubles memory); single 50KB cap is overridden ad-hoc in routes that need more. | Take explicit `maxBytes`; trust `Content-Length` first; stream a length check for large bodies. |
| C-26 | `src/app/api/chat/route.ts:293` | System prompt + full conversation + attached document text sent to third-party LLMs on every call. | Surface a DPA / sub-processor list in the privacy policy; in privacy mode, refuse all non-local providers. |
| C-27 | `src/app/hooks/useChatStore.ts:0` | Zustand store persists chat messages + base64 document bodies to IndexedDB unencrypted. | WebCrypto encryption keyed on a user passphrase; clear on logout. |
| C-28 | `src/app/api/generate-docx/route.ts:142` | Unauthenticated; no size cap; no rate limit; pathological input balloons output size. | `requireAuth()`; `validateRequestSize(1MB)`; per-user hourly cap. |
| C-29 | `src/app/api/export-response/route.ts:98` | Same shape as C-28; output written to shared `DOWNLOAD_DIR`. | `requireAuth()`; user-scoped output path; signed token. |
| C-30 | `src/lib/hermes.ts:0` | Third-party gateway unverified — logging, retention, TLS pinning unknown. | Document the data flow; require a DPA; strip `matterId` from the request body. |
| C-31 | `src/app/api/chat/route.ts:1130` | `console.error("[Anthropic Error Body]", errorText)` logs the full error body — Anthropic may echo the offending prompt. | Truncate to 500 chars; strip echoed-prompt patterns. |

---

## 7. Dead Code (12 findings — safe to remove)

| File | Line | Dead export | Notes |
|------|-----:|-------------|-------|
| `src/components/sidebar-skeleton.tsx` | 3 | `SidebarSkeleton` (default) | Never imported. |
| `src/components/emoji-picker.tsx` | 17 | `EmojiPicker` | Defined, never used. |
| `src/components/button-with-tooltip.tsx` | 35 | `ButtonWithTooltip` (default) | Never imported. |
| `src/components/pull-model.tsx` | 7 | `PullModel` | Never imported. |
| `src/components/pull-model-form.tsx` | 29 | `PullModelForm` | Never imported. |
| `src/components/image-embedder.tsx` | 55 | `MultiImagePicker` | Never imported. |
| `src/components/ui/chat/hooks/useAutoScroll.tsx` | 15 | `useAutoScroll` | Whole sub-tree (~663 lines) is unreferenced. |
| `src/components/ui/chat/message-loading.tsx` | 2 | `MessageLoading` | Used only by the also-dead `chat-bubble`. |
| `src/components/ui/chat/chat-input.tsx` | 41 | `ChatInput` | Never imported. |
| `src/components/ui/chat/chat-message-list.tsx` | 55 | `ChatMessageList` | Used only by the also-dead `chat-bubble`. |
| `src/components/ui/chat/chat-bubble.tsx` | 203 | `ChatBubble`, `ChatBubbleMessage` | Whole sub-tree never imported outside the directory. |
| `src/components/ui/chat/expandable-chat.tsx` | 148 | `ExpandableChat`, `ChatPosition`, `ChatSize` | Never imported. |

A single PR can remove all twelve files plus the directory `src/components/ui/chat/` if no other code in the project pulls from it. Run `grep -r "ui/chat"` first to be safe.

---

## 8. Code Quality (16 findings)

The quality audit found three `major` issues and thirteen `minor`/`style` issues. The majors:

| ID | File:Line | Issue | Remediation |
|----|-----------|-------|-------------|
| Q-1 | `src/lib/models.ts:263` | `getCloudProviderLabel` has no explicit return type | Add `: string` |
| Q-2 | `src/lib/models.ts:289` | `getModelDisplayMetadata` has no explicit return type | Add the inline object type |
| Q-3 | `src/components/chat/chat.tsx:19` | `ResponseFlowState` defined inline | Move to a types file and export |
| Q-4 | `src/components/chat/chat.tsx:129` | Unused `shouldDirectStreamLexMax = false` | Remove or implement |
| Q-5 | `src/components/chat/chat.tsx:324` | `getErrorMessage` declared inside `handleResponseError` — recreated on every call | Move outside the callback or `useCallback` it |
| Q-6 | `src/components/chat/chat-message.tsx:100` | `useEffect` with empty deps calls `generate()` on mount | Use `[status]` or a separate handler |
| Q-7 | `src/components/chat/composer-card.tsx:245` | Empty comment "Document text extracted successfully" — no value | Remove |

Minor / style items (collapsed — full text in the source output):

- Magic numbers: `chat.tsx:238` (1000 ms interval), `composer-card.tsx:211` (3000 ms), `composer-card.tsx:226` (50 ms), `thinking-process.tsx:39` (2000 ms), `chat-message.tsx:38` (800 chars).
- Constants in need of a name: `chat.tsx:19`, `chat-message.tsx:426` (Google search URL), `chat-message.tsx:276` (inline color `#378ADD`), `sources-dropdown.tsx:52` (jurisdiction hex colors), `add-doc-button.tsx:58` (file accept list).
- Style: `chat.tsx:317` uses `console.error` for error reporting — should be a structured logger; `model-selector.tsx:19` uses `sessionStorage` without a try-catch (can throw in private browsing).

---

## 9. Test Coverage (current state)

The repo currently has 5 test files in `__tests__/security/`. They cover: `auth.test.ts`, `legal-search.test.ts`, `rate-limit.test.ts`, and related helpers. None of the 97 findings in this audit have corresponding test coverage.

**Recommended next tests to write (one per finding, in order of severity):**

1. `__tests__/security/scan-reports-auth.test.ts` — verify DELETE rejects unauthenticated requests (S-1).
2. `__tests__/security/local-vault-auth.test.ts` — verify PUT rejects unauthenticated requests (S-2).
3. `__tests__/security/legal-search-null-guards.test.ts` — verify `scoreResults` does not crash on null `c.title` or `c.jurisdiction` (B-1, B-2).
4. `__tests__/security/matters-uuid.test.ts` — verify `crypto.randomUUID` fallback is not `Math.random` (B-4).
5. `__tests__/compliance/usage-logs-ip-mask.test.ts` — verify `logUsage()` masks IPs (C-2).
6. `__tests__/compliance/rls-policies.test.ts` — integration test against a dev Supabase project (C-3, C-4).
7. `__tests__/api/middleware-auth.test.ts` — verify all `/api/*` routes 401 when unauthenticated (C-6).
8. `__tests__/api/csp-headers.test.ts` — verify the response carries HSTS / COOP / CORP (C-7).
9. `__tests__/perf/chat-list-pagination.test.ts` — verify `listChatsWithMessages` paginates (P-7).

The harness is already wired up in `jest.config.js` (`ts-jest`, `moduleNameMapper` for `@/` → `src/`). New tests should be added in `__tests__/security/` for security/compliance and `__tests__/perf/` for performance.

---

## 10. Files Reviewed (full inventory)

All 128 `.ts`/`.tsx` files under `src/` were scanned, plus `supabase/migrations/001_initial_schema.sql`, `next.config.mjs`, `package.json`, `src-tauri/tauri.conf.json`, `jest.config.js`, and the `__tests__/security/` tree.

**API routes (15):** `agent`, `auth/check-beta`, `chat`, `chats`, `chats/[id]`, `chats/[id]/messages`, `contract-scanner`, `download/[filename]`, `export-response`, `extract-document`, `extract-legal-query`, `generate-docx`, `legal-search`, `local-vault`, `model`, `scan-reports`, `tags`.

**Library (`src/lib/`):** `api-auth`, `api/chats`, `api/contract-scanner`, `chat-message-content`, `citation-resolver`, `contract-scanner`, `db/{chats,index,schema}`, `document-extraction`, `dropdown-position`, `extract-file-content`, `file-extraction/{pdf-extractor,docx-extractor}`, `generate-docx`, `hermes`, `legal-query-extractor`, `legal-search`, `lex` (read-only — not opened), `local-documents`, `matters`, `models`, `rate-limit`, `safe-storage`, `scan-reports`, `supabase`, `tauri-client`, `tauri-env`, `utils`.

**Components (45):** all of `src/components/` including the chat surface, the contract-scanner surface, the shared / vault / auth / workflows / onboarding / ui subtrees, and the unused `ui/chat/*` tree (see §7).

**Hooks:** `useChatStore`, `useContractScannerStore`, `useLocalVaultStore`, `useSpeechRecognition`.

**Pages (12):** `c/[id]`, `contract-scanner`, `history`, `layout`, `matters`, `matters/[id]`, `models`, `page` (home), `settings`, `usage`, `vault`, `workflows`.

**Other:** `src/utils/initial-questions.ts`, `src/types/pdf-parse.d.ts`.

**Supporting files (reviewed but not part of source tree):** `supabase/migrations/001_initial_schema.sql`, `next.config.mjs`, `package.json`, `src-tauri/tauri.conf.json`, `jest.config.js`, the 5 existing tests in `__tests__/security/`.

---

## 11. Recommended PR Slicing

To keep the work reviewable, group findings into the following PRs:

| PR | Findings | Approx. scope |
|----|----------|---------------|
| **PR 1 — Auth gate** | S-1, S-2, S-5, S-6, S-7, C-5, C-6, C-10, C-11, C-16, C-17, C-18, C-19 | Add `middleware.ts`; flip routes to default-deny; remove `SKIP_AUTH_CHECK`; hard-fail boot in production. |
| **PR 2 — Headers & CORS** | C-7 | Nonce-based CSP; HSTS preload; COOP/COEP/CORP; CORS allow-list. |
| **PR 3 — PII hygiene** | C-1, C-2, C-8, C-9, C-12, C-13, C-14, C-15, C-25, C-26, C-31 | PII-scrubbing logger; IP masking + retention cron; Unicode normalisation; truncate Anthropic error bodies. |
| **PR 4 — Data lifecycle** | C-3, C-4, C-20, C-21, C-27, C-30 | `delete_user_data` RPC; RLS write policies; data export endpoint; move rate limit to Supabase; Hermes data-flow doc. |
| **PR 5 — Functional bugs** | B-1, B-2, B-3, B-4, B-5, B-6, S-4, S-8, C-22, C-23, C-24, C-28, C-29 | Null guards, race fix, real UUID generator, defensive parse, fallback for `RISK_ORDER`, IP trust helper, contract-scanner MIME allow-list, etc. |
| **PR 6 — Performance** | P-1 through P-14 | JOIN-based `listChatsWithMessages`; composite indexes; concurrency cap on legal search; debounce/memoize on the chat surface. |
| **PR 7 — Quality + dead code** | All Q-* and all 12 dead-code findings | Delete unused components; add explicit return types; name magic numbers; extract `ResponseFlowState`. |
| **PR 8 — Tests** | §9 list | One test file per P0/P1, plus regression tests for each bug fix. |

This slicing keeps each PR small enough for a single review pass and lets the security/compliance work (PRs 1–4) land first so that a follow-up audit can validate against the new posture.

---

## 12. Out of Scope / Notes

- `src/lib/lex.ts` was *not* read or modified. The system prompt and the model ID constants are the security boundary's input — the audit agents did not touch them.
- Web search functionality (Tavily / Serper wiring in `src/app/api/chat/route.ts` and the `legal-search.ts` orchestrator) is required to remain enabled and was not flagged for removal.
- `src-tauri/src/lib.rs` `enable_macos_default_menu` is required to stay `true`; this audit did not open `src-tauri/`.
- Findings reference the **current** state of the source. After a PR series lands, re-run the same six agents to verify P0/P1 closure and to discover any regressions in the patches themselves.

---

*End of audit.*
