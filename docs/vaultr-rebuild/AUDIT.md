# Vaultr-AI Repository Audit

Audit date: 2026-08-10. Scope is the current `master` repository only, with the historical `old-vaultr-backup` branch inspected for existence, head, shape, and relationship. No product behavior was changed.

## Executive summary

The repository is a working Mike legal-AI monorepo with four executable surfaces: a Next.js frontend, an Express/TypeScript backend, a Word add-in, and Playwright E2E suites. The backend and frontend type/build paths are largely healthy, and the backend unit suite is green. The baseline is not fully green because frontend unit tests fail in three Blob export cases, stack/root E2E tests are Windows-blocked by Bash/Supabase prerequisites, Word E2E is Windows-blocked by a Unix-style environment assignment, and npm audit reports substantial backend/frontend dependency exposure.

The main architectural risk is not a missing feature but coupling: route files and UI components are unusually large, the backend uses Supabase service-role access behind application-level authorization, sharing is email/JSONB based rather than a first-class tenant/membership model, document conversion/extraction is synchronous, and the LLM/MCP boundary is security-sensitive. These are audit priorities, not approved refactor work.

## Repository map

```text
Vaultr-AI/
|- frontend/       Next.js client and authenticated product UI
|- backend/        Express API, Supabase access, storage, LLM/MCP/tool runtime
|- word-addin/     React/webpack Office task pane and Word automation
|- e2e/            root Playwright browser suite
|- scripts/        local stack, workflow generation, test helpers
|- supabase/       gateway configuration and migrations/schema support
|- docker/         local database-init and service support
|- docs/           project documentation and audit outputs
|- .github/        CI, CodeQL, gitleaks, Scorecard, stack and E2E workflows
`- LICENSE, SECURITY.md, README.md
```

The root package and all three application packages identify as private `mike` packages under `AGPL-3.0-only`. This is a product monorepo, not a separately maintained Vaultr implementation.

## Runtime architecture

### Frontend

Next.js 16.2.6 with React and TypeScript. The root layout configures application metadata/providers. The authenticated `(pages)` shell gates access through the Supabase browser session, provides profile/MFA state, chat history, responsive sidebar state, and page chrome. There is no Redux/Zustand/TanStack Query/IndexedDB layer; state is primarily React context plus component state, `localStorage`, and `sessionStorage` for narrowly scoped UX/session flags.

The API boundary is mostly `frontend/src/app/lib/mikeApi.ts`, with direct `fetch`/SSE consumers in hooks and views. Main UI domains are assistant chat, projects, library, workflows, tabular reviews, and account/security settings. The product has both generic assistant chat and project-scoped chat.

### Backend

Express with CORS, Helmet, JSON body limits, general and route-specific rate limits, and Bearer-token authentication. `backend/src/app.ts` mounts route families under `/chat`, `/projects`, `/single-documents`, `/library`, `/tabular-review`, `/workflows`, `/user`, `/download`, `/case-law`, and supporting routes. `backend/src/middleware/auth.ts` verifies the Supabase token using `auth.getUser`, sets request identity, synchronizes profile email, and enforces the configured MFA-on-login policy.

The server creates a Supabase service client for database operations. Authorization therefore depends on route-level filters and centralized helpers rather than relying only on database RLS. Storage is S3/R2-compatible. The LLM layer supports Claude, Gemini, OpenAI, Ollama, and user-configured provider keys. MCP connector support includes encrypted connector credentials, OAuth, tool caching, confirmation policy, and guarded outbound egress.

### Database and storage

Supabase Postgres uses `pgcrypto` and `pg_trgm`, with `backend/schema.sql` plus dated migrations. Main records are `user_profiles`, provider/MCP credential tables, `projects`, folders, `documents`, `document_versions`, `document_edits`, `chats`, `chat_messages`, `workflows`, `tabular_reviews`, rows/cells/messages, and CourtListener indexes. Deletion paths use foreign-key cascades plus explicit storage cleanup in `userDataCleanup.ts`.

The schema has RLS enabled on sensitive tables, but the API's service-role client bypasses those policies. There is no explicit organization/workspace/membership table; project and review sharing is represented mainly by email lists in JSONB fields. The CI E2E workflow explicitly applies migrations on top of the schema because the committed schema can lag migrations, including the open-source workflow submissions migration.

### Word add-in

The add-in is a React 19/webpack Office TaskPaneApp with Word API 1.4 and `ReadWriteDocument` permissions. Its client stores Supabase access/refresh tokens in `OfficeRuntime.storage`, refreshes on expiry/401, and sends the current token to the backend. Word document operations use `Word.run`, selection/range checks, tracked changes, and compressed document export. Add-in chat streams through `/chat` with document context; workflow and project pickers call the same backend APIs. E2E uses a hermetic Office shim and intercepted routes rather than a real Word/hosted API.

## Key flows

### Authentication and MFA

1. Browser or add-in authenticates with Supabase Auth.
2. Browser stores/refreshes the Supabase session; the add-in stores tokens through OfficeRuntime storage.
3. Backend verifies the Bearer token through Supabase `auth.getUser` on each authenticated request.
4. Profile MFA preference can cause a `mfa_verification_required` response; the frontend handles `/verify-mfa` and a short session-storage grace period.
5. Destructive user-data operations also require MFA when enrolled.

### Document upload and viewing

1. Multer accepts one in-memory file up to 100 MB.
2. The API creates a document/version record and stores the source in S3/R2-compatible storage.
3. Office formats may be converted through LibreOffice to a PDF rendition; PDF page count and version metadata are recorded.
4. Chat document tools extract PDF, DOCX, spreadsheet, and presentation content synchronously. Legacy DOC/PPT conversion depends on LibreOffice. No OCR or worker/queue pipeline was identified.
5. View/download routes enforce document access, use current or historical versions, and use HMAC-signed download tokens for protected downloads.

### Chat and project chat

1. The client posts message history, model, project/document context, and optional input answers.
2. Backend validates the request, loads authorized chat/project/document context, persists the user message, and builds a prompt/context bundle.
3. The selected provider stream runs with document, edit, workflow, CourtListener, tabular, and optional MCP tools.
4. SSE emits content, reasoning, tools, citations, chat identity, and terminal events; disconnects can save partial assistant state.
5. Final citations are parsed and verified against document state before persistence.

### Tabular review

Reviews combine a workflow/column configuration with documents and row/cell records. The backend filters submitted document IDs through `filterAccessibleDocumentIds`, extracts sources, requests per-cell or per-row model output, parses summary/flag/reasoning/citations, persists cells, and emits progress SSE. The frontend renders review/chat/detail panels and exports review data to Excel.

### Workflows

User workflows are stored in the database with sharing, hiding, and open-source submission support. System workflows are generated by `scripts/build-workflows.js` from a sibling `mike-workflows` repository. That sibling directory was not present, so regeneration was not attempted. This is a build-input dependency that should be made explicit in CI/release documentation.

## Technical risk register

| Priority | Finding | Evidence / impact | Next audit action |
| --- | --- | --- | --- |
| P0 | Authorization relies heavily on service-role API code | Backend uses Supabase service credentials while RLS exists; a missed route filter becomes a cross-user data exposure | Build an endpoint-by-endpoint authorization matrix and negative tests |
| P0 | Dependency audit failures | Backend: 46 production advisories (17 high); frontend: 69 (21 high), including XML, URI, `tmp`, `ws`, `sharp`, `undici`, and transitive SDK chains | Produce a package/path reachability review and remediation plan before deployment |
| P1 | Tenant/sharing model is email/JSONB based | No organization/membership table; case-insensitive email comparison and JSON containment are spread across product semantics | Define the intended ownership, membership, revocation, and audit model |
| P1 | Untrusted legal content crosses the LLM boundary | Uploaded document text and user prompts are sent to configured model providers; prompt-injection defenses are prompt/tool policy, not a hard isolation boundary | Threat-model prompt injection, exfiltration, citations, tool confirmation, and provider retention |
| P1 | Synchronous conversion/extraction | 100 MB in-memory uploads plus LibreOffice/PDF/spreadsheet extraction occur in request paths; large or hostile files can consume CPU/memory | Measure limits, timeouts, cancellation, queueing, and parser isolation |
| P1 | Local CI and E2E reproducibility | Bash wrapper and Supabase CLI assumptions prevent stack/root E2E on Windows; add-in script uses Unix env syntax | Make scripts cross-platform or pin a supported Linux/WSL/container execution path |
| P1 | Frontend unit baseline is red | Three Blob `.text()` failures in export tests under observed Node 24/jsdom | Decide supported Node/test runtime and repair the harness or implementation contract |
| P2 | Schema/migration drift | CI applies migrations over `schema.sql`; generated system workflows depend on an absent sibling repo | Add schema drift and generated-artifact checks |
| P2 | Sensitive logging controls need review | Document extraction has development logging paths; optional raw LLM stream logging can persist provider payloads | Inventory log content, defaults, retention, redaction, and production configuration |
| P2 | Large modules increase review/change risk | Backend `tabular.ts` is about 2,130 lines; `documents.ts` about 1,485; frontend `DocTable.tsx` about 3,204 and `TRChatPanel.tsx` about 1,927 | Map boundaries and test coverage before any refactor is authorized |
| P2 | Documentation drift | README Node requirement and coverage docs disagree with package/observed baselines | Establish a generated or verified support matrix |

## Security-positive observations

- Bearer authentication is applied through middleware on protected router families.
- CORS is restricted to `FRONTEND_URL`; Helmet sets CSP-related and referrer/frame policies.
- Global, chat, upload, export, and destructive-operation rate limits are present.
- Document and project access are centralized in `backend/src/lib/access.ts`, including shared-project checks and tabular document-ID filtering.
- MCP URL validation requires HTTPS, blocks metadata/local/private addresses, validates DNS, pins connect-time lookup, and refuses redirects.
- MCP auth configuration and user provider keys are encrypted at rest using server-side secrets.
- User download tokens are HMAC based and downloads re-check document access.
- CodeQL, gitleaks, Scorecard, and dependency audit jobs exist in CI.

These observations describe controls in code; they are not a substitute for deployed configuration review, negative tests, or an independent security assessment.

## Historical Vaultr branch note

`old-vaultr-backup` exists locally and points to a Vaultr-oriented UI commit. Its top-level tree includes Next/Tauri/Drizzle/Firebase-era files and does not share a Git merge base with current `master`. The requested audit stopped at confirmation. No source was copied, no branch was merged, and no parity claim is made.
