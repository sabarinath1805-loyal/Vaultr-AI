# Private mode

When `NEXT_PUBLIC_SUPABASE_URL` is not set (or set but the project is down),
Vaultr runs in **private mode**: routes that require auth return a per-machine
local identity instead of 503ing. This lets the app be fully usable for local
document work — Matters, Vault, History, Contract Scanner — without ever
contacting Supabase.

## How it works

1. `src/lib/api-auth.ts` boots in dev/staging/local without Supabase
   configured. In `production`, the boot guard at the top of the file throws
   unless Supabase is configured — private mode is dev-only.
2. `requireAuth` lazy-imports `src/lib/local-user.ts`. The first call writes
   `%APPDATA%\Vaultr\.vaultr\local-user.json` with a stable UUID v5 derived
   from `node-machine-id`. Subsequent calls read it back.
3. The schema (`src/lib/db/schema.ts`) treats `owner_id` as opaque TEXT, so the
   synthetic UUID flows through the DB layer unmodified. Private-mode and
   hosted-mode rows look identical from the DB's perspective.

## To upgrade to a real machine-id

The current implementation works without `node-machine-id` by falling back to
a per-process random seed. That means the `userId` survives server restarts
because it's persisted to disk — but it changes if you delete
`local-user.json`, which is fine for local development but means each
re-install creates a new identity.

To make the identity truly machine-bound (the same across re-installs):

```
pnpm add node-machine-id
```

Then restart the dev server. The lazy `require()` in `local-user.ts` will
find the package and use the real machine-id. Delete
`%APPDATA%\Vaultr\.vaultr\local-user.json` once to force regeneration.

## To switch to hosted Supabase

Set in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The CSP in `src-tauri/tauri.conf.json` already permits
`https://xdblqjuycpaowomrvwht.supabase.co`; change that if you point at a
different project.

## Limitations of private mode

- No multi-user separation: all callers on the same machine share one
  `owner_id`. Not a concern for single-user desktop, but it means there is
  no row-level isolation between browser tabs.
- No rate-limiting beyond the global `src/proxy.ts` per-IP quota.
- `auth/check-beta` still returns 405 in private mode (no auth to gate).
