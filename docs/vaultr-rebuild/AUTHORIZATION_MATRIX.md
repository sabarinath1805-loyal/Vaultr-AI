# Gate 2 Authorization Matrix

Date: 2026-08-10<br>
Repository: `Vaultr-AI` at `master` (`204d2d5`)<br>
Scope: audit of the current Mike-based application only. No Vaultr feature conversion was performed.

## Effective authorization model

1. Express routes authenticate with `requireAuth` using Supabase `auth.getUser(token)`.
2. The middleware places `userId`, lower-cased `userEmail`, and the bearer token in `res.locals`.
3. API routes query through `createServerSupabase()`, which uses `SUPABASE_SECRET_KEY` and therefore bypasses Postgres RLS.
4. Route code and access helpers are consequently the effective object-level authorization boundary.
5. The database snapshot revokes direct table privileges from `anon` and `authenticated`; no admin role or admin route was found.

Legend: `Owner` means the authenticated user owns the object; `Shared` means the route intentionally permits a project/review/workflow collaborator; `MFA` means the route also requires an enrolled MFA assurance check; `Open` is deliberately unauthenticated.

## Route matrix

| Mounted endpoint | Method | Required boundary | Owner/shared behavior | Gate 2 result |
|---|---:|---|---|---|
| `/health` | GET | Open | Service health only | Pass |
| `/manifest-signing-key` | GET | Open | Public verification key | Pass |
| `/chat` | GET | Auth | User-scoped chat overview | Pass; route test coverage |
| `/chat` | POST | Auth | Creates/streams own chat; project context is checked | Pass; route tests |
| `/chat/create` | POST | Auth | Creates a chat for caller; project ID is checked when supplied | Pass |
| `/chat/:chatId` | GET | Auth + object access | Own chat or accessible project chat | Pass |
| `/chat/:chatId` | PATCH/DELETE | Auth + Owner | Owner-only rename/delete query | Pass |
| `/chat/:chatId/generate-title` | POST | Auth + chat access | Model side effect on caller-accessible chat | Pass; negative cases should remain in Gate 3 |
| `/models/ollama` | GET | Auth | Uses configured local Ollama endpoint; no object ID | Pass; outbound dependency remains |
| `/projects` | GET | Auth | Own and shared project overview via scoped RPC | Pass |
| `/projects` | POST | Auth | Creates with caller as `user_id` | Pass |
| `/projects/:projectId` | GET | Auth + Owner/Shared | Owner or lower-cased email in `shared_with` | Pass; shared/denied tests |
| `/projects/:projectId/people` | GET | Auth + Owner/Shared | Owner or project collaborator | Pass |
| `/projects/:projectId` | PATCH/DELETE | Auth + Owner | Owner-only filters/deletion helper | Pass; owner update test |
| `/projects/:projectId/documents` | GET | Auth + Owner/Shared | Project access helper | Pass |
| `/projects/:projectId/export` | GET | Auth + MFA + Owner/Shared | Project manifest only after access check | Pass; MFA/export tests |
| `/projects/:projectId/documents/:documentId` | POST | Auth + Project access + source Owner | Target project access; source document is owner-scoped before copy | Pass; retain source-owner negative case |
| `/projects/:projectId/documents` | POST | Auth + Project access | Shared members can upload into an accessible project | Pass as implemented; shared mutation policy requires explicit product decision |
| `/projects/:projectId/documents/:documentId` | PATCH | Auth + Project access | Shared members may rename under current helper path | Conditional; mutation scope needs policy test |
| `/projects/:projectId/chats` | GET | Auth + Project access | Shared project chat list | Pass |
| `/projects/:projectId/folders` | POST | Auth + Project access | Shared members may create folders under current route | Conditional; mutation scope needs policy test |
| `/projects/:projectId/folders/:folderId` | PATCH | Auth + Project access | Shared members may mutate folder metadata under current route | Conditional |
| `/projects/:projectId/folders/:folderId` | DELETE | Auth + Project access + Owner | Owner-only delete path | Pass by code inspection |
| `/projects/:projectId/documents/:documentId/folder` | PATCH | Auth + Project access | Shared mutation permitted by project access helper | Conditional |
| `/single-documents` | GET | Auth + Owner | Standalone document list is user filtered | Pass by code inspection |
| `/single-documents` | POST | Auth + Owner | New document gets caller `user_id` | Pass; upload bounds test |
| `/single-documents/:documentId` | DELETE | Auth + document access | Access helper; deletion behavior should remain owner-only by policy | Conditional; verify owner check explicitly |
| `/single-documents/:documentId/display` | GET | Auth + document access | Owner or accessible project collaborator | Pass |
| `/single-documents/download-zip` | POST | Auth + filtered document IDs | IDs are reduced through `filterAccessibleDocumentIds` | Pass; negative test |
| `/single-documents/:documentId/url` | GET | Auth + document access | Signed URL only after access check | Pass; signed URL lifetime remains privacy risk |
| `/single-documents/:documentId/docx` | GET | Auth + document access | Download/export of accessible document | Pass |
| `/single-documents/:documentId/versions` | GET | Auth + document access | Version metadata for accessible document | Pass |
| `/single-documents/:documentId/versions/from-document` | POST | Auth + target/source access; source Owner for move/delete | Both documents checked; source destructive path owner-gated | Pass by code inspection |
| `/single-documents/:documentId/versions` | POST | Auth + document access | Shared collaborators can upload a version under current helper | Conditional; explicit shared-write policy required |
| `/single-documents/:documentId/versions/:versionId` | PATCH | Auth + document access | Shared collaborators can rename a version under current helper | Conditional |
| `/single-documents/:documentId/versions/:versionId/file` | PUT | Auth + document access + Owner | Destructive file replacement owner-only | Pass by code inspection |
| `/single-documents/:documentId/versions/:versionId` | DELETE | Auth + document access + Owner | Owner-only version deletion | Pass by code inspection |
| `/single-documents/:documentId/tracked-change-ids` | GET | Auth + document access | Accessible document only | Pass |
| `/single-documents/:documentId/edits/:editId/accept` | POST | Auth + document access | Edit resolution currently follows document access | Conditional; shared edit-write policy required |
| `/single-documents/:documentId/edits/:editId/reject` | POST | Auth + document access | Edit resolution currently follows document access | Conditional; shared edit-write policy required |
| `/library/:kind` | GET | Auth + Owner | Library rows are caller filtered | Pass |
| `/library/:kind/documents` | POST | Auth + Owner | New library document gets caller `user_id` | Pass |
| `/library/:kind/folders` | POST | Auth + Owner | Parent and owner checked | Pass |
| `/library/:kind/folders/:folderId` | PATCH/DELETE | Auth + Owner | Owner filters and parent checks | Pass |
| `/library/:kind/documents/:documentId` | PATCH | Auth + Owner | Rename/move is owner filtered | Pass |
| `/tabular-review` | GET | Auth | Scoped overview RPC uses user ID/email | Pass |
| `/tabular-review/ids` | GET | Auth | Scoped ID RPC | Pass |
| `/tabular-review` | POST | Auth + project access + filtered document IDs | Caller owns standalone review or has project access; supplied docs are reduced | Pass; tests |
| `/tabular-review/prompt` | POST | Auth | Model prompt helper; no review object | Pass; provider risk remains |
| `/tabular-review/:reviewId` | GET | Auth + Owner/Shared/project access | `ensureReviewAccess` | Pass; denied tests |
| `/tabular-review/:reviewId/people` | GET | Auth + Owner/Shared/project access | Review access | Pass |
| `/tabular-review/:reviewId` | PATCH | Auth + review access | Shared collaborators can mutate under current helper | Conditional; shared-write policy required |
| `/tabular-review/:reviewId` | DELETE | Auth + Owner | Owner-only query | Pass by code inspection |
| `/tabular-review/:reviewId/clear-cells` | POST | Auth + review access | Shared collaborator can clear cells under current helper | Conditional; high-impact shared write |
| `/tabular-review/:reviewId/regenerate-cell` | POST | Auth + review access + row/source access | Source document is checked before model call | Pass; denied source test |
| `/tabular-review/:reviewId/generate` | POST | Auth + review access + filtered docs | Model/SSE side effect after access filtering | Pass by route tests |
| `/tabular-review/:reviewId/chats` | GET | Auth + review access | Review-scoped chat list | Pass |
| `/tabular-review/:reviewId/chats/:chatId` | PATCH/DELETE | Auth + chat Owner | Caller owns chat; route must also keep `reviewId` linked to chat | Conditional; add linkage regression |
| `/tabular-review/:reviewId/chats/:chatId/messages` | GET | Auth + review access + chat linkage | Review access before message read | Conditional; linkage test required |
| `/tabular-review/:reviewId/chat` | POST | Auth + review access | Model/tools only for accessible review context | Pass by route tests |
| `/workflows` | GET | Auth | Own, shared, and system workflows via overview RPC | Pass |
| `/workflows` | POST | Auth + Owner | Creates caller-owned workflow | Pass |
| `/workflows/:workflowId` | GET | Auth + Owner/Shared/System | Owner, editable share, or system workflow | Pass by code inspection |
| `/workflows/:workflowId` | PUT/PATCH | Auth + Owner | Owner-only update | Pass |
| `/workflows/:workflowId` | DELETE | Auth + Owner | Owner-only delete | Pass |
| `/workflows/hidden` | GET/POST | Auth + Owner | User hidden-workflow rows; POST should validate workflow visibility | Conditional; missing negative test |
| `/workflows/hidden/:workflowId` | DELETE | Auth + Owner of hidden row | User + workflow filter | Pass |
| `/workflows/:workflowId/open-source` | POST | Auth + workflow Owner | Owner-only submission; submission queue has no admin surface | Conditional; enterprise/admin gap |
| `/workflows/:workflowId/shares` | GET | Auth + workflow Owner | Owner-only share listing | Pass |
| `/workflows/:workflowId/shares/:shareId` | DELETE | Auth + workflow Owner | Owner + workflow/share ID filters | Pass |
| `/workflows/:workflowId/share` | POST | Auth + workflow Owner | Owner-only share creation | Pass |
| `/user/profile` | GET/POST/PATCH | Auth; bootstrap exception | Caller profile only; GET/POST intentionally MFA-exempt | Pass; MFA tests |
| `/user/security/mfa-login` | PATCH | Auth + MFA | Caller profile only | Pass; MFA negative test |
| `/user/lookup` | GET | Auth | Email lookup for sharing; can reveal account existence/profile fields | Conditional; privacy review required |
| `/user/api-keys` | GET | Auth | Caller status only; no plaintext key | Pass |
| `/user/api-keys/:provider` | PUT | Auth + MFA + Owner | Encrypted caller key | Pass; MFA/crypto tests |
| `/user/mcp-connectors` | GET/POST | Auth; POST + MFA | Caller-owned connectors; encrypted auth config | Pass by code/tests |
| `/user/mcp-connectors/:connectorId` | GET/PATCH/DELETE | Auth; writes + MFA + Owner | Connector ID is caller filtered | Pass by code inspection |
| `/user/mcp-connectors/:connectorId/oauth/start` | POST | Auth + MFA + Owner | Caller connector only | Pass by code inspection |
| `/user/mcp-connectors/oauth/callback` | GET | OAuth state-bound | Intentionally unauthenticated callback; state hash/expiry binds flow to user/connector | Conditional; add OAuth regression suite |
| `/user/mcp-connectors/:connectorId/refresh-tools` | POST | Auth + MFA + Owner | Caller connector only | Pass by code inspection |
| `/user/mcp-connectors/:connectorId/tools/:toolId` | PATCH | Auth + MFA + Owner | Caller connector/tool only; destructive tool cannot be enabled without confirmation | Pass by code inspection |
| `/user/account` | DELETE | Auth + MFA + Owner | Caller account cleanup | Pass; MFA test |
| `/user/chats`, `/user/projects`, `/user/tabular-reviews` | DELETE | Auth + MFA + Owner | Caller-scoped cleanup helpers | Pass; MFA tests |
| `/user/export`, `/user/chats/export`, `/user/tabular-reviews/export` | GET | Auth + MFA + Owner | Caller-scoped exports | Pass; MFA tests |
| `/download/:token` | GET | Auth + token verification + document access | HMAC token is rechecked against accessible document | Pass; token tests |
| `/case-law/case-opinions` | POST | Auth | User settings plus external CourtListener/model call | Pass by mount; external data boundary remains |

The same user-router paths are mounted under `/users` as well as `/user` in `backend/src/app.ts`.

## Authorization findings carried into Gate 3

- `AUTH-01` (P1): because service-role queries bypass RLS, every shared-write route must have an explicit policy test. Current code allows some shared collaborators to upload/rename/move/resolve content. This may be intentional, but it is not a documented role model.
- `AUTH-02` (P1): tabular chat mutation/read routes should assert that the supplied `reviewId` owns the supplied `chatId`, not only that the caller owns the chat row.
- `AUTH-03` (P1): OAuth callback, hidden workflow submission, and workflow open-source review need dedicated negative tests. No admin role was found.
- `AUTH-04` (P2): `/user/lookup` should return the minimum sharing-safe response and have an account-enumeration policy.

## Hardening Phase 2 explicit policy

The service-role client bypasses RLS, so this table is the application policy contract. “Owner only” is enforced by an owner filter or `access.isOwner`; a shared reader cannot infer write authority from read access.

| Operation class | Owner | Shared reader | Shared writer | Outsider |
|---|---|---|---|---|
| Project read, project chat read/create, project export | Allow | Allow | Allow | Deny/conceal |
| Project rename/delete/share | Allow | Deny | Deny | Deny/conceal |
| Document read/download/version metadata | Allow | Allow | Allow | Deny/conceal |
| Document upload/rename/delete/version/edit-resolution | Allow | Deny | Deny | Deny/conceal |
| Review read/chat read | Allow | Allow | Allow | Deny/conceal |
| Review generate/cell modify/clear | Allow | Deny | Deny until separately approved | Deny/conceal |
| Workflow read/execute | Allow | Allow | Allow | Deny |
| Workflow edit/share/delete | Allow | Deny | Allow only through explicit workflow edit policy | Deny |
| Account export/delete, provider key, MCP connector, MFA changes | Allow with required MFA where routed | Deny | Deny | Deny |

The machine-readable contract is `backend/src/lib/authorizationPolicy.ts`; regression coverage is in `backend/src/lib/__tests__/authorizationPolicy.test.ts` and the real HTTP stack test.

## Overnight Stage A authorization/provenance boundary

The four-blocker remediation adds two explicit route-level rules to this
matrix:

- Tabular chat history is server-owned. The current request may contribute only
  its validated user prompt; assistant history is loaded from the authorized
  persisted chat and its derived provenance is checked against the review's
  authorized source-document set. A caller-supplied version UUID cannot grant
  access or label arbitrary assistant text as trusted.
- Account export is scoped to the exporting user's owned reviews, rows, cells,
  documents, and versions. A cell that names a foreign or inaccessible source
  is exported as unverified with source metadata/content redacted. Shared
  review access does not turn another user's source versions into account-
  export-owned provenance.

The new real-stack hardening suite exercised owner/foreign records and passed
the chat-neutralization, export-redaction, and CAS checks. Stage B still must
independently exercise the full owner/outsider/shared-collaborator substitution
matrix; this section is not a final authorization sign-off.

## Overnight Foundation Completion Mission - Stage B authorization evidence

The expanded real-stack matrix included the three-user owner/shared/outsider
HTTP authorization suite, which passed **3/3** tests: owner/shared reads were
allowed according to policy, outsider reads were denied or concealed, and
shared/outsider child-resource access was denied where required. This is
positive evidence for the tested route policy, not a blanket production
authorization sign-off.

The independent account-export injection also exposed a separate labeling
requirement in the policy boundary. Redacting a foreign source's content and
IDs is not sufficient: the exporting account must receive an explicit
`unverified` status. The observed `trusted` label for a redacted foreign
source is recorded as blocker B-04 in the final audit and was not fixed during
Stage B.

## B-04 Final Remediation Mission - Stage A boundary

The account-export policy now applies exporter-scoped provenance after the
existing owner-scoped source classification. A foreign or inaccessible source
cannot retain `trusted` merely because its version is trusted for another
account. It is serialized as `unverified`, with content and source-version
metadata redacted and foreign version rows excluded. The final unit and real
HTTP route checks passed; independent Stage B authorization and substitution
attacks remain pending.
