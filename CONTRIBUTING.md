# Contributing to Vaultr

Welcome. Vaultr is a student-led open source project, and first-time contributors are especially welcome. Small documentation fixes, reproducible bug reports, tests, and accessibility improvements are valuable contributions.

## Set up a development environment

1. Install Node.js 18 or newer and pnpm 11. Install Rust and the platform prerequisites if you will work on Tauri.
2. Fork the repository on GitHub, then clone your fork:

   ```bash
   git clone https://github.com/<your-user>/Vaultr-AI.git
   cd Vaultr-AI
   git remote add upstream https://github.com/sabarinath1805-loyal/Vaultr-AI.git
   pnpm install
   ```

3. Copy `.env.example` to `.env.local`. Start with local Ollama, or add only the provider keys needed for your work.
4. Run `pnpm dev` for the web app or `pnpm tauri:dev` for the desktop shell.

## Checks before a pull request

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Use `pnpm test:watch` while iterating. Add or update a test when changing behavior, especially around authentication, request validation, storage, streaming, or provider fallbacks.

## Code style

Use TypeScript, two-space indentation, semicolons, and the existing ESLint flat configuration. Prefer small typed functions, descriptive names, and existing shared utilities. Keep secrets server-side, avoid logging user content, and preserve Private Mode behavior. Use `PascalCase` for React components, `camelCase` for functions and variables, and kebab-case for route/component filenames.

## Issues and pull requests

Search existing issues first. A bug report should include reproduction steps, expected and actual behavior, environment details, and sanitized logs. Feature requests should explain the user problem and proposed outcome.

PRs should have a focused title and description, link an issue when one exists, explain privacy or security implications, include screenshots for UI changes, and confirm that tests, lint, typecheck, and build pass. Keep unrelated formatting changes out of the PR.

## Welcome contributions

Bug fixes, new model integrations, UI and accessibility improvements, performance work, documentation, tests, translations, and developer tooling are all welcome. Please be kind, inclusive, patient, and respectful in issues, reviews, and discussions.
