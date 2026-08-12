# Gate 2 Test Environment

## Canonical repository environment

| Component | Repository/CI expectation | Current host observation |
|---|---|---|
| Node.js | Node 22 in Dockerfile, CI, package engines, and README | Node `v24.18.0` |
| npm | Lockfile installs | npm `11.16.0` |
| Docker | Required for local Supabase/MinIO stack | Docker client `29.1.3`; daemon unavailable on the Windows named pipe |
| Supabase CLI | Required for stack tests | Not installed/on PATH |
| LibreOffice | Required for legacy DOC/PPT conversion | Not installed/on PATH |
| Bash/Unix shell | Required by `backend/scripts/test-stack.sh` and local stack scripts | Not available as the required local command path |
| Ollama | Optional provider runtime | Not installed/on PATH |
| Workflow source | Sibling `mike-workflows` tree for generator | Missing; generator fails fast |

## Passing local checks

- Backend: 36 test files passed, 3 skipped; 495 passed, 14 skipped.
- Frontend: 25 test files passed; 236 passed.
- Backend TypeScript build passed.
- Frontend typecheck passed.
- Frontend lint passed with 37 warnings and no errors.
- Root and Word lockfile dry-runs passed in Gate 1.

## Blocked checks

- Real Supabase/RLS stack tests cannot run without Docker daemon and CLI.
- Full local stack E2E cannot run on this Windows host with the repository's Bash scripts and absent services.
- Full workflow generation cannot run because `mike-workflows` is not present.
- Node 22 compatibility was not executed locally because no version manager or Node 22 installation is available. The CI/Docker Node 22 definition remains the canonical target.

## Reproduction commands

```text
cd backend
npm.cmd test -- --reporter=dot
npm.cmd run build

cd ../frontend
npm.cmd test -- --reporter=dot
npm.cmd exec -- tsc --noEmit
npm.cmd run lint

cd ..
node scripts/build-workflows.js
```

## Gate 2 conclusion

The unit and mocked route environment is green. Infrastructure-dependent authorization, RLS, conversion, and E2E evidence is incomplete. Do not treat a green local mocked suite as a release claim until a disposable Node 22 + Docker/Supabase runner is available.

## Hardening Phase 1 update

- Canonical runtime is now Node 22.x, enforced by `.nvmrc` and package engines (`>=22 <23`). The observed host remains Node 24.18.0, so host green results are advisory until rerun under Node 22.
- Word add-in `build:e2e` is now a Node wrapper that works on Windows and POSIX; Windows build verified successfully. Playwright lists 64 Word E2E tests.
- The schema drift gate passes without a database. The workflow generator remains intentionally blocked until its external source is present and pinned to an exact commit.
- Current backend verification is 40 test files passed, 3 skipped; 505 passed, 14 skipped. Current Word verification is a clean 64-test Playwright pass using the hermetic Office shim and static E2E server.
- Docker daemon, Supabase CLI, LibreOffice, Ollama, and the `mike-workflows` source remain unavailable locally. WSL2 + Docker Desktop is the supported real-stack path; native PowerShell is not required for the Bash stack harness.

## Hardening Phase 2 runtime evidence

| Component | Evidence |
|---|---|
| Node.js | `C:\Users\Sabarinath.SABARI\AppData\Local\nvm\v22.13.0\node.exe` reports `v22.13.0`; npm reports `10.9.2` |
| Docker | Docker Desktop daemon healthy; server `29.1.3` |
| Supabase CLI | `npx supabase@2.108.0` started the disposable stack |
| Local stack | API `http://127.0.0.1:54321`, Postgres `127.0.0.1:54322`; credentials were process-local and are not committed |
| Real stack suites | 14 access/RLS tests, 3 HTTP authorization tests, and 1 OAuth claim test passed under Node 22; final inventory 29/29 public tables RLS-enabled |

The earlier host Node 24 observation remains useful context but is no longer the only runtime evidence. LibreOffice and a production malware scanner remain unavailable and are documented as deployment gates.
