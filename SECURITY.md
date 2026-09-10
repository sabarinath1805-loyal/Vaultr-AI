# Security Policy

Vaultr is a solo-maintained open source legal research product. This page
explains how to report a vulnerability to us and what to expect afterwards.
The programme behind it is described in `SECURITY-POLICY.md`.

## Reporting a vulnerability

Email **Sabarinath.1805@gmail.com** with the subject line `Vaultr security`.
If you prefer to report through GitHub, you can use the repository's
**Security tab, Report a vulnerability** (private vulnerability reporting).

Please do not open a public GitHub issue for anything security-sensitive.

A PGP key for encrypted reports is available on request by email.

### What to include

- The component affected (frontend, backend, Word add-in, Supabase schema,
  Docker setup) and the commit or tag you tested.
- Steps to reproduce, or a proof of concept, with the minimum data needed to
  demonstrate the issue.
- The impact as you understand it (for example data exposure, privilege
  escalation, prompt injection leading to data leakage).
- Whether you have already shared the finding anywhere else.
- How you would like to be credited, if at all.

### What to expect

| Step | Commitment |
| --- | --- |
| Acknowledgement of your report | Within 48 hours |
| Fix for a critical vulnerability | Within 30 days of confirmation |
| Fix for a high severity vulnerability | Within 60 days of confirmation |
| Fix for a medium severity vulnerability | Within 90 days of confirmation |

Sabarinath Babu triages every report personally. We will keep you informed of
progress and agree a disclosure date with you before anything is published.

## Disclosure

Confirmed vulnerabilities are published as **GitHub Security Advisories** on
this repository once a fix is available on the default branch. The advisory
records the affected versions, the fixed commit, and credit to the reporter
unless they ask to remain anonymous.

## Supported versions

| Version | Supported |
| --- | --- |
| Tip of the default branch (`master`) | Yes |
| Tagged releases (`v0.1.0` to `v0.4.0`) | No |

Security fixes land only on the default branch. Existing tags are historical
snapshots and do not receive backported fixes. If you self-host Vaultr, update
to the latest default branch before reporting; the issue may already be fixed.

## How we find vulnerabilities ourselves

- **GitHub Dependabot alerts** for known vulnerabilities in npm dependencies.
- **GitHub CodeQL** code scanning on every push and pull request
  (`.github/workflows/codeql.yml`).
- **GitHub secret scanning**, plus a **gitleaks** scan of the full git history
  in CI (`.github/workflows/gitleaks.yml`).
- **OpenSSF Scorecard** checks of the repository's own security posture
  (`.github/workflows/scorecard.yml`).

## Scope

- The code, default configuration, and deployment guidance in this repository
  are in scope.
- Vaultr is an LLM legal product, so LLM-specific reports are welcome: prompt
  injection (including through uploaded documents), bypassing model guardrails,
  and leaking another user's data or system prompts through model output.
- Secrets accidentally committed to this repository's history are in scope,
  even though CI runs a secret scanner.
- Independent self-hosted installations run by third parties are out of scope.
  Findings that only apply to how an outside operator has deployed Vaultr
  should go to that operator.
- The hosted demo of the upstream Mike project at `app.mikeoss.com` is
  operated by Open Legal Products, not Vaultr. Findings against that service
  should go to upstream.

When testing, use only accounts and data you own, do not attempt denial of
service, and access no more of another user's data than the minimum needed to
demonstrate the issue.

Last reviewed: September 2026 — Sabarinath Babu, Founder, Vaultr
