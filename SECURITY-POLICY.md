# Vaultr Open Source Security Assurance Policy

This document is Vaultr's security assurance programme for the open source
software we supply. It is written to satisfy ISO/IEC 18974:2023 (the OpenChain
Security Assurance Specification) for a single-maintainer project. The public
reporting instructions for researchers are in `SECURITY.md`.

## 1. Commitment

We commit to identifying, tracking, and remediating known vulnerabilities in
Vaultr and its dependencies, to testing the software for security before it is
released, and to telling users when a vulnerability affects them. Vaultr
handles legal material for real users, and we treat security as a condition of
shipping, not an afterthought.

## 2. Scope

This programme covers every component Vaultr supplies and every dependency it
pulls in:

- the Next.js frontend in `frontend/`,
- the Express backend in `backend/`,
- the Word add-in in `word-addin/`,
- the Supabase schema and migrations in `supabase/`,
- Docker files, `docker-compose.yml`, CI workflows, and helper scripts,
- all npm dependencies declared in the `package.json` and `package-lock.json`
  files of those packages.

Out of scope: third parties' own deployments of Vaultr and the hosted demo
run by the upstream Mike project.

## 3. Responsible person and roles

**Sabarinath Babu**, Founder of Vaultr, Singapore, is responsible for this
programme and fills every role in it: policy owner, vulnerability triage,
remediation, release approval, security testing, external communication, and
annual review. There are no other participants.

Relevant competence: CISM (Certified Information Security Manager), ISC2
Certified in Cybersecurity, Microsoft Cybersecurity Architect Expert, together
with AI Ethics and Governance (AI Singapore), ITIL, and the SMU Digital Finance
and AI Programme.

Because the sole participant is the author of this policy, awareness of the
policy, its objectives, the responsibilities it assigns, and the consequences
of not following it are established by authorship and reconfirmed at each
annual review. Any future maintainer will be given this file and `SECURITY.md`
before being granted write access.

## 4. Standard practice

### 4.1 Detection of known vulnerabilities

- **GitHub Dependabot alerts** are enabled on the repository and notify
  Sabarinath Babu when a dependency in either lockfile has a published
  vulnerability.
- **GitHub CodeQL** analyses the whole tree on every push and pull request
  (`.github/workflows/codeql.yml`) and reports findings to the repository's
  Security tab.
- **GitHub secret scanning** is enabled, and CI additionally runs **gitleaks**
  over the full git history on every push and pull request
  (`.github/workflows/gitleaks.yml`).
- **OpenSSF Scorecard** (`.github/workflows/scorecard.yml`) checks the
  repository's own security posture, such as pinned dependencies and token
  permissions.

### 4.2 Tracking

Every known vulnerability is tracked where it was detected: the Dependabot
alert history for dependency vulnerabilities, the code scanning alert history
for CodeQL findings, and a GitHub Security Advisory for vulnerabilities in
Vaultr's own code. Each alert stays open until it is fixed or dismissed with a
recorded reason, and the fixing commit is visible in the git history.

### 4.3 Remediation

Vulnerabilities are remediated on the default branch (`master`) within the
following windows, measured from the date the vulnerability is confirmed:

| Severity | Fix deadline |
| --- | --- |
| Critical | 30 days |
| High | 60 days |
| Medium | 90 days |
| Low | Next regular release |

Severity follows the CVSS rating supplied by the advisory or, for our own
code, Sabarinath Babu's assessment using the same scale.

### 4.4 Communication

- Reports from outside the project are received at
  **Sabarinath.1805@gmail.com** or through GitHub private vulnerability
  reporting, acknowledged within 48 hours, and handled as set out in
  `SECURITY.md`.
- Confirmed vulnerabilities in Vaultr's own code are disclosed as **GitHub
  Security Advisories** on the repository once a fix is available, naming the
  affected and fixed versions. Users who self-host Vaultr are expected to
  watch the repository for advisories.
- Vulnerabilities in dependencies that are fixed by a version bump are visible
  in the commit history and in the closed Dependabot alert.

### 4.5 Continuous and pre-release testing

- CodeQL runs on every push and pull request, and the CI workflow
  (`.github/workflows/ci.yml`) runs the build, lint, and unit and integration
  test suites. The end-to-end workflow (`.github/workflows/e2e.yml`) runs the
  Playwright suite against a full local stack.
- **Pre-release check.** Before a release is tagged, Sabarinath Babu confirms
  that there are no open critical Dependabot alerts and no open critical
  CodeQL alerts on the default branch, and runs the licence check described in
  `OPEN-SOURCE-POLICY.md`. A release with an open critical vulnerability is
  not tagged.
- **Post-release monitoring.** Dependabot continues to alert on the default
  branch after release, so newly published vulnerabilities in shipped
  dependencies are detected without any manual step. Only the default branch
  is supported; earlier tags do not receive fixes (see `SECURITY.md`).

### 4.6 Sharing risk information with third parties

Security Advisories are public and machine-readable through GitHub. The
components in each release are recorded in the lockfiles and summarised in
`NOTICES.md`, so downstream users can match advisories against what they run.

## 5. Bill of materials

The npm lockfiles in `frontend/` and `backend/` are the authoritative record
of every open source component in a release. `NOTICES.md` records the licence
summary produced before each release and identifies upstream Mike. Both are
committed, so the component list for any release is available from its tag.

## 6. External inquiries

Anyone can raise a security question or report by email to
Sabarinath.1805@gmail.com; the address is published in `SECURITY.md` and this
file. Sabarinath Babu is responsible for responding. There are no internal
inquiries in a one-person project; decisions are recorded in commits, pull
requests, and advisories.

## 7. Resourcing

Vaultr is self-funded by its founder, who allocates time to triage alerts as
they arrive, to the pre-release check, and to the annual review. If this
programme cannot be sustained, the supported-versions table in `SECURITY.md`
will be updated to say so.

## 8. Metrics

- Zero open critical vulnerabilities (Dependabot or CodeQL) at the time each
  release is tagged.
- Acknowledgement of every external report within 48 hours.
- Remediation within the windows in section 4.3.

These are checked at each release and at the annual review.

## 9. Records and evidence

Evidence that this programme operates is held in:

- the GitHub commit history (fixes, dependency bumps, and this policy's
  revisions),
- the Dependabot alert history and code scanning alert history on the
  repository,
- GitHub Actions run logs for the CodeQL, gitleaks, Scorecard, CI, and
  end-to-end workflows,
- published GitHub Security Advisories,
- `NOTICES.md` for the component record of each release.

## 10. Continuous improvement

Vaultr documents evidence of programme reviews through GitHub commit history.
Each annual review produces an updated version of this policy, committed to
the repository with a dated commit message. Metrics reviewed annually include:
number of open CVEs at release, mean time to remediate critical
vulnerabilities, and number of dependency updates applied.

## 11. Review

Sabarinath Babu reviews this policy and the practices above at least once a
year, and sooner after any critical vulnerability or change to the tooling.
The review date is recorded below.

Last reviewed: September 2026 — Sabarinath Babu, Founder, Vaultr
