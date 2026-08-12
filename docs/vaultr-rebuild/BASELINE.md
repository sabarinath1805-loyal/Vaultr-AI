# Vaultr-AI Rebuild Audit Baseline

Audit date: 2026-08-10 (Asia/Singapore)

This is a read-only baseline of the current repository at `master`. The audit did not merge, copy, rename, refactor, or port the historical Vaultr code. The only intended worktree changes are the five documents in this directory.

## Repository identity

- Current branch: `master`
- Current commit: `204d2d5` (`Merge pull request #296 from Open-Legal-Products/fix/word-addin-semver-dependency`)
- Working tree at audit start: clean, tracking `origin/master`
- `origin`: `https://github.com/sabarinath1805-loyal/Vaultr-AI.git`
- `upstream`: `https://github.com/Open-Legal-Products/mike.git`
- Historical branch present locally: `old-vaultr-backup`
- Historical branch head: `e9b36f1c499c44ef0a8737e941659edbe71d870c` (`ui: reshape Matters Vault Settings and review surfaces like Mike`)
- Relationship: `master...old-vaultr-backup` has `255` commits on the master side and `444` on the old-branch side; Git reports no merge base. No relationship-changing operation was performed.

The old branch is an independent historical Vaultr tree with a different top-level shape (`src`, `components`, `src-tauri`, `drizzle.config.ts`, etc.). The current tree is the Mike monorepo shape (`backend`, `frontend`, `word-addin`, `e2e`, `supabase`, `docker`). A parity or migration decision therefore requires a later explicit mapping exercise.

## Runtime and local tool availability

| Tool | Observed result |
| --- | --- |
| Node | `v24.18.0` |
| npm / npx | `11.16.0` |
| Bun | `1.3.14` |
| Docker | `29.1.3`; Compose `v2.40.3-desktop.1` |
| Supabase CLI | not found |
| Ollama | not found |
| LibreOffice / `soffice` | not found on host; backend image installs LibreOffice |

The repository declares Node `>=22` in the root package and uses Node 22 Docker/CI images. The README still says Node 20 or newer. That documentation/toolchain mismatch should be resolved before a reproducible local onboarding claim is made.

## Install and build baseline

All install checks were read-only dry-runs or inspections; no dependency versions were changed.

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd ci --dry-run --ignore-scripts` (root) | PASS | Lockfile/install plan accepted |
| `npm.cmd ci --dry-run --ignore-scripts` (backend) | PASS | Lockfile/install plan accepted |
| `npm.cmd ci --dry-run --ignore-scripts` (frontend) | PASS | Lockfile/install plan accepted |
| `npm.cmd ci --dry-run --ignore-scripts` (word-addin) | PASS | Install plan accepted |
| `npm.cmd ls --depth=0 --ignore-scripts` (root/backend/frontend/word-addin) | PASS | No missing top-level packages reported |
| `npm.cmd run build` (backend) | PASS | TypeScript build completed |
| `npm.cmd exec -- tsc --noEmit` (backend) | PASS | Strict typecheck completed |
| `npm.cmd exec -- tsc --noEmit` (frontend) | PASS | Strict typecheck completed |
| `npm.cmd run lint` (frontend) | PASS with 37 warnings | 0 errors; warnings include hooks, unused variables/directives, and `img` usage |
| frontend production build with placeholder public env | PASS | Next 16.2.6/Turbopack; 23/23 static pages generated; approximately 4.7 minutes on this Windows host |
| `npm.cmd run typecheck` (word-addin) | PASS | Strict typecheck completed |
| Word add-in production build with HTTPS placeholder `WORD_ADDIN_PUBLIC_URL` | PASS with 3 webpack size warnings | Manifest generated; `taskpane.js` is approximately 549 KiB |

The first Word build attempt failed because `WORD_ADDIN_PUBLIC_URL` was absent. This is an intentional production-manifest requirement, not a source failure; rerunning with `https://word.example.com` passed.

## Test baseline

| Command | Result | Observed result |
| --- | --- | --- |
| `npm.cmd test -- --reporter=dot` (backend) | PASS | 36 files passed, 3 skipped; 495 passed, 14 skipped (509 total) |
| `npm.cmd run test:coverage -- --reporter=dot` (backend) | PASS | Same tests; actual coverage 33.13% statements, 27.22% branches, 33.98% functions, 33.58% lines |
| `npm.cmd test -- --reporter=dot` (frontend) | FAIL | 25 files: 24 passed, 1 failed; 236 tests: 233 passed, 3 failed |
| `npm.cmd run test:coverage -- --reporter=dot` (frontend) | FAIL | Same three failures, so no coverage report produced |
| `npm.cmd run test:e2e -- --list` (root) | PASS | 31 tests in 8 files listed |
| `npm.cmd run test:e2e` (root) | FAIL on Windows | Playwright web server cannot run `bash scripts/e2e-local-stack.sh`; `Bash/Service/CreateInstance/E_ACCESSDENIED`; backend connection then refused |
| `npm.cmd run test:stack` (backend) | FAIL on Windows | Same Bash service access denial before stack tests; Supabase CLI is also unavailable on host |
| `npm.cmd run test:e2e -- --list` (word-addin) | PASS | 64 tests in 7 files listed |
| `npm.cmd run test:e2e` (word-addin) | FAIL on Windows | `REACT_APP_API_BASE_URL` Unix inline assignment is not recognized by `cmd.exe` |
| `npm.cmd audit --omit=dev --audit-level=high` (root) | PASS | 0 vulnerabilities |
| Same command (backend) | FAIL | 46 vulnerabilities: 17 high, 29 moderate; several with no fix available |
| Same command (frontend) | FAIL | 69 vulnerabilities: 21 high, 47 moderate, 1 low; several with no fix available |
| Same command (word-addin) | PASS | 0 vulnerabilities |

The three frontend unit failures are all Blob export assertions in `frontend/src/app/lib/mikeApi.test.ts` (`exportAccountData`, `downloadDocumentsZip`, and the combined chat/tabular export case): `TypeError: blob.text is not a function`. They appear to be a jsdom/Blob test-runtime incompatibility under the observed Node 24 environment. They are not treated as proof of a production behavior defect, but they must be fixed or explicitly supported before the frontend baseline is green.

Backend coverage passes configured floors, but `docs/testing-coverage.md` records older lower measured values (23.88/17.98/23.06/23.79). The documentation and current measurement are inconsistent.

## Environment baseline

Root public/local variables include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, and local Supabase mailer/anon-key settings. Backend variables include `PORT`, `FRONTEND_URL`, `DOWNLOAD_SIGNING_SECRET`, Supabase service credentials, R2/S3 credentials and bucket, model provider keys, user API-key encryption secret, optional CourtListener token, and optional manifest signing key. Frontend variables include Supabase URL/publishable key and API base URL. The Word add-in uses Supabase/API public variables and a required deployed HTTPS origin for manifest generation.

No `.env`, `backend/.env`, `frontend/.env.local`, or `word-addin/.env` files were present during the check. Secret values were not printed.

## Not run / blocked

- Full root E2E and backend stack tests are blocked by the Windows Bash wrapper and missing Supabase CLI/local stack prerequisites.
- Full Word add-in E2E is blocked by the Windows-incompatible inline environment assignment in its package script.
- No production model calls, hosted Supabase, hosted object storage, or deployed Word manifest validation were attempted.
- No old Vaultr branch code was copied or executed as part of this baseline.
