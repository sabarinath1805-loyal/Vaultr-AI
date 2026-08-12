# Frontend Test Baseline

## Before Gate 2

Gate 1 recorded 233 passing and 3 failing frontend tests. All three failures were the same environment issue: tests called `.text()` on a Blob returned by `Response.blob()`, while the jsdom Blob implementation in the configured Vitest environment exposed neither `.text()` nor `.arrayBuffer()`.

## Gate 2 correction

Only `frontend/src/app/lib/mikeApi.test.ts` changed. The tests now provide a small response fixture whose `blob()` returns Node's standards-compliant `node:buffer` Blob, and read the returned bytes through that Blob's `.text()` method. The assertions still compare the exact byte content (`zip-bytes`, `zip`, and `bytes`); no assertion was removed and no production API code changed.

## After Gate 2

```text
25 test files passed
236 tests passed
```

The full command was `npm.cmd test -- --reporter=dot` from `frontend`.

Additional checks:

- `npm.cmd exec -- tsc --noEmit`: pass.
- `npm.cmd run lint`: pass, 37 warnings, 0 errors.
- Frontend production build had already passed in Gate 1 and the test-only change does not enter the application bundle. A post-change rerun without env values failed during config loading; a rerun with the documented placeholders reached `Creating an optimized production build` but timed out at 180 seconds without a compile error.

## Remaining baseline concerns

- Local execution is Node 24, while CI and Docker target Node 22.
- Vitest emits existing React `act(...)` warnings in hook/modal tests and existing lint warnings.
- No browser Playwright run was possible locally because the full stack could not be started.

The frontend unit baseline is now green, but cross-runtime and browser-level evidence remains a Gate 3 task.
