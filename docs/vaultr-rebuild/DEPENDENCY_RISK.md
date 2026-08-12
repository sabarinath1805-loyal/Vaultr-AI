# Dependency Risk Register

Audit date: 2026-08-10<br>
Command: `npm.cmd audit --omit=dev --audit-level=high`

## Counts

| Workspace | High | Moderate | Low | Critical |
|---|---:|---:|---:|---:|
| Root | 0 | 0 | 0 | 0 |
| Backend | 17 | 29 | 0 | 0 |
| Frontend | 21 | 47 | 1 | 0 |
| Word add-in | 0 | 0 | 0 | 0 |

The root and Word audit commands passed with zero advisories. Backend and frontend audit commands returned non-zero because advisories remain. No `npm audit fix` or dependency upgrade was performed in Gate 2.

## Hardening Phase 2 registry evidence

Node 22 `npm audit --json` was rerun after a non-breaking `npm audit fix --package-lock-only` in backend, frontend, and Word. No `--force` upgrade was used and no application dependency range was widened by automation.

| Workspace | High | Moderate | Low | Critical | Disposition |
|---|---:|---:|---:|---:|---|
| Root | 0 | 0 | 0 | 0 | Clean |
| Backend | 0 | 1 | 1 | 0 | High runtime reachability cleared by lockfile patch; remaining direct/transitive advisories need owner review |
| Frontend | 0 | 4 | 0 | 0 | High runtime reachability cleared by lockfile patch; Fortune Sheet/ExcelJS dependency chain remains |
| Word add-in | 8 | 7 | 4 | 0 | Primarily development/Office tooling chain; major upgrade requires Word E2E and signing/development workflow review |

The remaining Word advisories are a release blocker for a blanket dependency-clean verdict, although the production browser bundle does not ship the dev toolchain. Do not run `npm audit fix --force` without an owner-approved compatibility branch and the full Word regression suite.

## Highest-risk runtime paths

| Area | Packages/advisory family | Runtime reachability | Gate 2 position |
|---|---|---|---|
| Document ingestion | `mammoth` -> `@xmldom/xmldom`; `fast-xml-parser`; `libreoffice-convert` -> `tmp`; `docx` -> `nanoid` | Upload, conversion, extraction, export; attacker-controlled documents reach these paths | P0/P1 triage before production pilot |
| MCP and schema validation | `@modelcontextprotocol/sdk`, `ajv`, `ajv-formats`, `fast-uri`, nested Express/Hono packages | User-enabled connector discovery and tool calls; SSRF guard is application-level | P1; pin/upgrade and test effective paths |
| Rate limiting | `express-rate-limit` -> `ip-address` | Runtime middleware; current application SSRF parser is separate, so advisory reachability needs validation | P1 reachability review |
| Google/model transport | `@google/genai`, `protobufjs`, `ws` | Provider/realtime flows only when configured | P1; provider-specific exposure review |
| Frontend SSR/deploy | `next`, `@opennextjs/cloudflare`, `@opennextjs/aws`, `wrangler`, `miniflare`, `sharp` | Next SSR/build/deploy and image/runtime paths, dependent on deployment mode | P1; deploy-target upgrade plan |
| Rendered model/document text | `markdown-it`, `linkify-it`, `tiptap-markdown` | Untrusted assistant/document text is rendered in the UI | P1 DoS/XSS regression review |
| Spreadsheet/export chain | `exceljs`, `tmp`, `uuid` | Tabular export path; some dependencies may be Node-only but require bundling verification | P1 reachability confirmation |

## Important advisory themes

- XML recursion/injection and document-processing denial of service.
- Temporary-file path traversal in `tmp` and Office conversion.
- MCP SDK and URL parser host-confusion advisories; current custom URL/DNS pinning mitigates SSRF classes but does not remove all SDK risk.
- WebSocket memory exhaustion and transport issues.
- Next.js SSRF/cache/server-action/internal-disclosure families.
- Markdown/linkification quadratic behavior on adversarial text.

## Controls already present

- Upload size is bounded at 100 MB and allowed document types are explicit.
- MCP URLs require HTTPS, reject local/metadata/private DNS targets, and use pinned guarded fetch/agent behavior.
- No dependency auto-fix was run; the lockfiles remain reviewable.
- CI installs from lockfiles with the repository's canonical Node 22 environment.

## Required before production

1. Produce a package-to-route reachability map for every high advisory.
2. Upgrade advisories with available fixes and record exceptions for no-fix packages.
3. Run parser/converter fixtures under CPU, memory, timeout, and child-process limits.
4. Pin and review MCP SDK transitive packages independently of the Google provider.
5. Confirm the deployed Next/OpenNext target and remove unused server/build packages where possible.
6. Make high-severity audit output merge-blocking after the exception list is explicit.

Conclusion: dependency risk is **not a production GO**. It is compatible with a tightly scoped next audit/hardening phase.

## Hardening Phase 1 update

- Runtime contracts now require Node `>=22 <23` in all four packages; `.nvmrc` is `22`.
- No `npm audit fix --force` was used. Registry patch verification was unavailable from this Windows environment, so no unverified transitive override was added.
- Current audit baseline remains: backend 17 high / 29 moderate; frontend 21 high / 47 moderate / 1 low; root and Word clean. These unresolved advisories remain a production blocker.
