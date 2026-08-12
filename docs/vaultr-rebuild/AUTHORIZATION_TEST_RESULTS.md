# Gate 2 Authorization and Security Test Results

Date: 2026-08-10

## Executed suites

| Command | Result |
|---|---|
| `npm.cmd test -- src/lib/__tests__/access.test.ts src/lib/__tests__/downloadTokens.test.ts src/lib/mcp/__tests__/client.ssrf.test.ts src/__tests__/integration/projects.routes.test.ts src/__tests__/integration/projectChat.routes.test.ts src/__tests__/integration/tabular.routes.test.ts src/__tests__/integration/documentsUpload.routes.test.ts` from `backend` | 7 files passed; 102 tests passed |
| `npm.cmd test -- --reporter=dot` from `backend` | 36 files passed, 3 skipped; 495 passed, 14 skipped |
| `npm.cmd test -- --reporter=dot` from `frontend` | 25 files passed; 236 passed |
| `npm.cmd run build` from `backend` | Pass |
| `npm.cmd exec -- tsc --noEmit` from `frontend` | Pass |
| `npm.cmd run lint` from `frontend` | Pass; 37 pre-existing warnings, 0 errors |

## Security assertions covered

- Project owner, shared collaborator, and unrelated-user access decisions.
- Denied project chat access before streaming/model invocation.
- Tabular review access and reduction of user-supplied document IDs to accessible documents.
- Row/source document denial for tabular regeneration.
- HMAC download-token round trips, tamper detection, malformed tokens, and path binding.
- MCP URL validation for non-HTTPS, localhost, metadata endpoints, private IPv4/IPv6, mapped/NAT64/private DNS results, credentials, fragments, and guarded redirects.
- User API-key encryption/status and MFA gates for sensitive settings and destructive account operations.
- The full backend suite retains the Gate #1 count: 495 passed and 14 skipped.

## Not executed in this environment

- Real Supabase/RLS integration: Docker daemon is unavailable, and the `supabase` CLI is not installed.
- Stack tests in `backend/src/__tests__/integration/access.supabase.test.ts` and `stack.supabase.test.ts`.
- Full Playwright stack E2E.
- OAuth callback/state integration: no dedicated OAuth test file exists; only code inspection was possible.
- A complete shared-write authorization matrix for project documents/folders/versions/edits and tabular cells.
- Admin/reviewer authorization: no admin route or role exists to test.

## Result

The route-level authorization regression is green. It is not sufficient to claim production authorization readiness because the database client is service-role based and the remaining negative cases are policy decisions rather than simple unit defects. Gate 2 therefore records **conditional authorization readiness** and carries `AUTH-01` through `AUTH-04` into Gate 3.

## Hardening Phase 1 implementation update

- Shared project users are denied project document upload/assignment/rename/move, folder create/edit, and project document mutation; project chat/read/export remain explicitly shared paths.
- Shared tabular users are denied generation, regeneration, and cell clearing. Tabular chat delete/rename now verifies review access and constrains the mutation by both `review_id` and chat owner.
- `clear-cells` validates every requested row against the review before updating cells, closing cross-review row targeting.
- Document version creation/upload/rename and tracked-edit resolution require document ownership; existing replacement/deletion paths remain owner-gated.
- OAuth state contract tests cover expired, replayed/wrong-state, wrong-user, incomplete configuration, and unsafe redirect URI cases. Atomic claim/DB-race testing remains a real-stack follow-up.
- Download tokens now carry a seven-day expiry by default and have an expiry regression test.
- After the Phase 1 changes, the backend suite is 40 test files passed, 3 skipped; 505 passed, 14 skipped. The remaining authorization evidence gap is execution against real Supabase/RLS and a complete shared-write matrix.

## Hardening Phase 2 real-stack evidence

| Command/test | Result |
|---|---|
| Node 22 backend real Supabase suite: `access.supabase.test.ts`, `stack.supabase.test.ts`, `tabularPagination.supabase.test.ts` | 3 files passed; 14 tests passed |
| Node 22 `realAuthorization.supabase.test.ts` against local Supabase/Auth plus Express | 1 file passed; 3 tests passed |
| Node 22 `oauthClaim.supabase.test.ts` against local Postgres RPC | 1 file passed; 1 test passed |

The HTTP test created real Auth users A/B/C, seeded an A-owned project shared only to C, and proved owner read, shared read, outsider concealment, shared child read, and owner-only project mutation. The OAuth test proved exactly one concurrent state claimant, empty replay, and denial of direct browser-role RPC execution.
