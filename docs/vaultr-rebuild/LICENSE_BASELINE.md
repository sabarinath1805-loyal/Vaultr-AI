# License and Provenance Baseline

This is a repository-level license inventory, not legal advice. It identifies what is visible in the current tree and what must be verified before a Vaultr-to-Mike rebuild or redistribution.

## Current repository declarations

- Root `package.json`: private package `mike`, `AGPL-3.0-only`.
- `backend/package.json`: private package `mike-backend`, `AGPL-3.0-only`.
- `frontend/package.json`: private package `mike`, `AGPL-3.0-only`.
- `word-addin/package.json`: private package `mike-word-addin`, `AGPL-3.0-only`.
- Root `LICENSE`: GNU Affero General Public License, version 3, with the repository's full license text.
- Root `SECURITY.md`: reports are expected through GitHub private vulnerability reporting; code, defaults, deployment guidance, hosted service, and LLM-specific issues are in scope.
- `git ls-files` found `LICENSE` as the only tracked filename matching the license/notice/copyright search used for this baseline. No separate third-party notices inventory was identified by that search.

The packages are marked private for package publication purposes; that does not remove source-license obligations for the covered work.

## AGPL implications to verify for any rebuild

The current repository declares AGPL-3.0-only. Before distributing or operating a modified network service, confirm the obligations relevant to the intended deployment, including:

- preserving copyright and license notices;
- providing corresponding source for covered modifications to users who interact with the service over a network;
- preserving applicable notices and identifying modified versions;
- checking whether separately licensed dependencies, generated artifacts, model/workflow content, fonts, Office assets, and bundled runtime files are compatible;
- documenting the exact source commit, build inputs, lockfiles, and any generated workflow source used for the deployment.

No relicensing, dual-licensing, copyright assignment, or contributor agreement was inferred from the repository. Those questions require maintainer/legal confirmation.

## Historical Vaultr provenance boundary

The local `old-vaultr-backup` branch exists at `e9b36f1c499c44ef0a8737e941659edbe71d870c` and has a Vaultr-oriented tree. It has no merge base with current `master` (`git rev-list --left-right --count master...old-vaultr-backup` reported `255 444`; `git diff master...old-vaultr-backup` cannot run because there is no merge base). The branch was inspected only; no files were copied or merged.

Therefore, this baseline makes no claim that old Vaultr code is license-compatible with the current Mike tree. Any future port must preserve provenance at file/change level, identify authors and upstream sources, inspect embedded assets and generated files, and obtain the required permission where a license does not grant the intended use.

## Missing inventory work

Before a redistribution or rebuild milestone, produce:

1. An SPDX/dependency inventory for root, backend, frontend, Word add-in, Docker images, and generated bundles.
2. A source-to-binary inventory for third-party fonts, icons, Office assets, parser/converter components, and generated system workflows.
3. A provenance matrix for every proposed Vaultr-derived file or behavior, with commit/path/source owner and license.
4. A review of model prompts, workflow definitions, and user-submitted/open-source workflow content for separate terms.
5. A release artifact that includes the exact source offer and notices required by AGPL-3.0-only.
