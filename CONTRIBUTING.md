# Contributing to Vaultr

Thank you for helping improve Vaultr. Contributions of all sizes are welcome:
bug reports, documentation fixes, tests, and features. Please keep changes
small, focused, and easy to review.

Vaultr is maintained by one person, Sabarinath Babu, so reviews may take a few
days. Questions can go to **Sabarinath.1805@gmail.com**.

## Licence

Vaultr is licensed under the GNU Affero General Public License v3.0
(AGPL-3.0). By submitting a contribution you agree that it is licensed under
AGPL-3.0 and that you have the right to contribute it.

Vaultr is a fork of [Mike](https://github.com/open-legal-products/mike) by
Open Legal Products, which is also AGPL-3.0. Much of the code base is shared
with upstream, so please keep upstream copyright notices intact and do not
remove attribution when you edit inherited files.

### Licence compatibility of contributions

- Every new dependency must carry a licence compatible with AGPL-3.0.
  Permissive licences (MIT, Apache-2.0, BSD, ISC, and similar) and
  AGPL-compatible copyleft licences (LGPL-3.0, GPL-3.0, AGPL-3.0) are fine.
- Incompatible licences are not permitted: proprietary code, code with no
  licence, non-commercial or no-derivatives terms, and copyleft licences that
  cannot be combined with AGPL-3.0. A pull request that adds one will not be
  merged until the dependency is replaced.
- If you add or upgrade dependencies, run the `license-checker` npm package
  in the package you changed and confirm nothing incompatible appears:

  ```bash
  cd frontend && npx license-checker --summary
  cd backend  && npx license-checker --summary
  ```

- If you copy code from another project rather than adding it as a
  dependency, keep its licence header and add an attribution entry to
  `NOTICES.md` naming the project, its licence, and where the code lives.

See `OPEN-SOURCE-POLICY.md` for the full policy.

## Bug reports and feature requests

Use [GitHub Issues](https://github.com/sabarinath1805-loyal/Vaultr-AI/issues).

- **Bug reports:** include the commit or tag you are running, steps to
  reproduce, what you expected, and what happened. Do not include real client
  documents or secrets.
- **Feature requests:** describe the problem you are trying to solve, not only
  the solution you have in mind. Please do not propose local-hosting refactors
  of the main app (local LLMs, local databases, local filesystem storage);
  those belong to a future fully local version of the project.

**Security vulnerabilities are not GitHub issues.** Report them privately as
described in `SECURITY.md`.

## Pull request process

1. Fork the repository and create a branch from `master`.
2. Make one focused change per pull request: one bug, feature, or cleanup.
3. Run the relevant build or test command for the area you changed (see
   below), review `git diff`, and remove unrelated changes.
4. Update docs or `.env.example` files when you change setup, configuration,
   or user-facing behaviour.
5. Never commit secrets, API keys, private documents, or local `.env` files.
6. Open the pull request using the template in
   `.github/PULL_REQUEST_TEMPLATE.md` (summary, why, changes, tradeoffs, how
   verified, checklist).
7. CI runs the build, lint, unit and integration tests, and the secret and
   code scans on every pull request. All checks must pass.
8. Sabarinath Babu reviews every pull request and merges it once it is
   approved.

## Conduct

Be professional and courteous in issues, pull requests, and email. Assume good
faith, keep feedback about the work rather than the person, and respect that
Vaultr handles legal material for real users. Contributors who do not meet
this standard may have their contributions declined.

## Local development

Backend:

```bash
npm run build --prefix backend
```

Frontend:

```bash
npm run build --prefix frontend
```

## Testing

```bash
npm test --prefix backend            # backend unit + route integration tests (vitest)
npm test --prefix frontend           # frontend component/hook tests (vitest + jsdom)
npm run test:e2e                     # Playwright end-to-end suite, see docs/e2e-ci.md
npm run test:stack --prefix backend  # gated: real-Supabase auth/access tests (run `supabase start` first)
```

- New features and bug fixes should come with a test at the lowest layer that
  can catch the regression: unit first, then route-level integration, then
  end-to-end only for flows that genuinely need a browser.
- CI runs the build and unit/integration tests on every pull request
  (`.github/workflows/ci.yml`) and the Playwright suite in a full local stack
  (`.github/workflows/e2e.yml`).
- Tests that need a live Supabase or an LLM key are env-gated and skip cleanly
  when the environment is absent, so a plain `npm test` should always be
  green.

## System workflows

System workflows live in the sibling
[`sabarinath1805-loyal/vaultr-workflows`](https://github.com/sabarinath1805-loyal/vaultr-workflows)
repository under `assistant-workflows/` and `tabular-review-workflows/`. Put
structured metadata in the YAML frontmatter at the top of `SKILL.md`, set
`metadata.vaultr-availability` to `system`, put workflow instructions in the
body of `SKILL.md`, and use `table-columns.yaml` for tabular review columns.

After changing system workflows, regenerate the app files:

```bash
node scripts/build-workflows.js
```

Last reviewed: September 2026 — Sabarinath Babu, Founder, Vaultr
