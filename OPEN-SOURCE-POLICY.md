# Vaultr Open Source Policy

This document is the open source licence compliance programme for Vaultr. It is
written to satisfy the requirements of ISO/IEC 5230:2020 (the OpenChain
specification) for a single-maintainer project.

## 1. Licence commitment

Vaultr is free and open source software released under the GNU Affero General
Public License, version 3.0 (AGPL-3.0). The full licence text is in the
`LICENSE` file at the root of this repository, and every package manifest in
the repository declares `AGPL-3.0-only`.

We publish the complete corresponding source code of every release on GitHub
at https://github.com/sabarinath1805-loyal/Vaultr-AI. Anyone who interacts with
a Vaultr instance we operate over a network is entitled to that source, as
required by section 13 of the AGPL-3.0.

## 2. Upstream attribution

Vaultr is a fork of **Mike** by Open Legal Products
(https://github.com/open-legal-products/mike), which is also licensed under
AGPL-3.0. We keep the original AGPL-3.0 `LICENSE` file, credit Mike and its
contributors in `README.md` and `NOTICES.md`, and track the upstream repository
as the `upstream` git remote so the relationship between the two code bases
stays visible in the git history.

## 3. Responsible person and roles

Vaultr is developed and maintained by a single person, **Sabarinath Babu**,
Founder of Vaultr, based in Singapore. He holds every role in this programme:

- policy owner and reviewer,
- licence identification and obligation review,
- release manager (runs the pre-release licence check and publishes tags),
- point of contact for external licence compliance inquiries.

Relevant competence: CISM, ISC2 Certified in Cybersecurity, Microsoft
Cybersecurity Architect Expert, AI Ethics and Governance (AI Singapore), ITIL,
and the SMU Digital Finance and AI Programme, together with hands-on
maintenance of this AGPL-3.0 code base since the fork.

Because there is one participant and he is the author of this policy, awareness
of the policy, its objectives, his responsibilities, and the consequences of
not following it are established by authorship and confirmed at each annual
review. If Vaultr ever gains additional maintainers, they will be pointed to
this file and `CONTRIBUTING.md` before their first change is merged.

## 4. Scope

This programme covers all software Vaultr supplies:

- the Next.js frontend in `frontend/`,
- the Express backend in `backend/`,
- the Word add-in in `word-addin/`,
- the Supabase schema and migrations in `supabase/`,
- Docker files, `docker-compose.yml`, and the helper scripts in `scripts/`,
- every third-party dependency those components pull in, principally npm
  packages declared in the `package.json` and `package-lock.json` files of
  `frontend/` and `backend/`.

Out of scope: the configuration choices of third parties who self-host Vaultr,
and the hosted demo operated by the upstream Mike project.

## 5. Licence identification and bill of materials

The npm lockfiles in `frontend/` and `backend/` are the authoritative bill of
materials for each release. Before each release Sabarinath Babu runs the
`license-checker` npm package in both directories:

```bash
cd frontend && npx license-checker --summary
cd backend  && npx license-checker --summary
```

The output is saved to `NOTICES.md` at the repository root, together with the
date and the release it applies to. The per-package detail (without
`--summary`) is used during review and is reproducible from the lockfile at
any tagged commit.

## 6. Reviewing licence obligations

For every licence that appears in the `license-checker` output we determine
whether it is compatible with AGPL-3.0 and what it obliges us to do:

- **Permissive licences** (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC,
  BlueOak-1.0.0, 0BSD, MIT-0, Unlicense, CC0-1.0, Python-2.0, MPL-2.0):
  permitted. Obligation: preserve copyright and licence notices. Those notices
  ship inside each package under `node_modules` and are summarised in
  `NOTICES.md`.
- **Copyleft licences compatible with AGPL-3.0** (LGPL-3.0, GPL-3.0,
  AGPL-3.0): permitted. Obligation: source availability, which we meet by
  publishing the full source on GitHub.
- **Dual or multi-licensed packages** (for example `MIT OR GPL-3.0-or-later`):
  we use the package under the compatible option and note it in `NOTICES.md`.
- **Entries the tool cannot classify** (`UNKNOWN`, `Custom`, or a licence
  followed by `*`): checked manually against the package's repository before
  the release is tagged, and the finding is recorded in `NOTICES.md`.

Sabarinath Babu performs this review. A new dependency is not merged until its
licence is identified and found compatible.

## 7. Handling non-compliant cases

Licences that are incompatible with AGPL-3.0 (proprietary or unlicensed code,
licences with non-commercial or no-derivatives restrictions, and copyleft
licences that cannot be combined with AGPL-3.0) are not permitted in Vaultr.

If one is found, in a pull request or in the pre-release check, the release is
blocked until the dependency is removed or replaced. If the code is already in
a published release, we remove it in the next release and record the change in
the commit history and `NOTICES.md`. Reports from outside the project go to
Sabarinath.1805@gmail.com and are handled the same way.

## 8. Distribution use cases

- **Source distribution.** The GitHub repository is the primary distribution.
  Every tagged release contains `LICENSE`, `NOTICES.md`, and the complete
  source.
- **Binary distribution.** Container images built from `backend/Dockerfile`
  and `frontend/Dockerfile`, and any compiled bundles, correspond exactly to a
  tagged commit. The tag is the corresponding source, and `LICENSE` and
  `NOTICES.md` are part of the build context.
- **Integration with other open source.** Vaultr combines npm packages into a
  single application. We only combine licences that are compatible with
  AGPL-3.0 (section 6).
- **Modified open source.** Vaultr itself is a modification of Mike. All
  modifications are recorded in the git history and remain under AGPL-3.0. We
  do not currently vendor or patch third-party dependencies; if we ever do, the
  modified package and the nature of the change will be recorded in
  `NOTICES.md`.
- **Attribution requirements.** Upstream Mike and every dependency with an
  attribution requirement are credited in `NOTICES.md`. Package-level notices
  are preserved unmodified inside `node_modules`.
- **Network use.** Any hosted Vaultr instance we operate links to this
  repository so users can obtain the corresponding source.

## 9. Compliance artifacts and archiving

The compliance artifacts for every release are:

1. `LICENSE` (the AGPL-3.0 text), and
2. `NOTICES.md` (upstream credit and the dependency licence summary).

Both live at the repository root and are therefore included in every tagged
release and every build. Releases are tagged in git on GitHub, and the tags are
retained for as long as the repository exists, which is at least as long as we
offer the software. The git history is the archive of every past artifact.

## 10. Contributions

Inbound contributions are accepted under AGPL-3.0 only, following
`CONTRIBUTING.md`. Any code Sabarinath Babu contributes to other projects,
including back to upstream Mike, is contributed under that project's licence
and must not include third-party proprietary code or secrets.

## 11. Inquiries

External inquiries about open source licence compliance go to
**Sabarinath.1805@gmail.com**. This policy, `SECURITY.md`, `CONTRIBUTING.md`,
and `NOTICES.md` are public on GitHub, and our website is
https://vaultr-law.lovable.app. Sabarinath Babu is responsible for responding.
There are no internal inquiries in a one-person project; decisions are recorded
in commits and pull requests.

## 12. Legal expertise

Vaultr identifies and engages external legal counsel as needed to address
open source licence compliance matters. For routine compliance questions,
Sabarinath Babu draws on his CISM certification and professional experience.
External legal expertise is sourced as required for non-routine matters.
Contact: Sabarinath.1805@gmail.com

## 13. Resourcing and review

Vaultr is self-funded by its founder, who allocates time for the pre-release
licence check and for this policy's review. Sabarinath Babu reviews this
policy, `NOTICES.md`, and the supporting procedures at least once a year, and
sooner if a licence changes or a dependency is found to be non-compliant. The
review date is recorded at the bottom of each policy file.

Last reviewed: September 2026 — Sabarinath Babu, Founder, Vaultr
