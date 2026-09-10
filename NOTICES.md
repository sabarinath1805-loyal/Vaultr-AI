# Notices

This file records the open source software that Vaultr is built on and the
licences of its dependencies. It is one of the two compliance artifacts
shipped with every release; the other is the `LICENSE` file, which contains
the full text of the GNU Affero General Public License v3.0.

Questions about anything in this file: **Sabarinath.1805@gmail.com**.

## Vaultr

Vaultr is licensed under the GNU Affero General Public License, version 3.0
(AGPL-3.0). Copyright for the Vaultr modifications belongs to Sabarinath Babu.
The complete corresponding source is published at
https://github.com/sabarinath1805-loyal/Vaultr-AI.

## Upstream: Mike by Open Legal Products

Vaultr is a fork of **Mike**, developed by Open Legal Products and the Mike
contributors, and available at https://github.com/open-legal-products/mike
under the AGPL-3.0. The original licence is preserved unchanged in `LICENSE`.

We are grateful to Open Legal Products and everyone who has contributed to
Mike. Vaultr would not exist without their work. Files inherited from Mike
retain their original copyright, and the full modification history relative to
upstream is visible in this repository's git log.

## Dependency notices

Run `npx license-checker --summary` (the `license-checker` npm package) in
`/frontend` and `/backend` and paste the output here before each release.

Per-package detail, including each package's copyright holders and licence
text, is reproducible from the lockfiles by running `npx license-checker`
without `--summary`, and is also present inside each package under
`node_modules`.

### Frontend (`frontend/`)

Generated 10 September 2026 with `license-checker@25.0.1` against the
`master` branch.

```
├─ MIT: 931
├─ Apache-2.0: 142
├─ ISC: 62
├─ BSD-2-Clause: 20
├─ BSD-3-Clause: 13
├─ BlueOak-1.0.0: 12
├─ MIT OR Apache-2.0: 3
├─ MIT-0: 3
├─ CC0-1.0: 3
├─ MPL-2.0: 3
├─ Apache-2.0 AND LGPL-3.0-or-later AND MIT: 2
├─ Apache-2.0 AND LGPL-3.0-or-later: 2
├─ Unlicense: 2
├─ MIT*: 2
├─ Python-2.0: 1
├─ Custom: http://github.com/substack/node-bufferlist: 1
├─ CC-BY-4.0: 1
├─ (MPL-2.0 OR Apache-2.0): 1
├─ BSD*: 1
├─ (MIT OR GPL-3.0-or-later): 1
├─ (MIT AND Zlib): 1
├─ 0BSD: 1
├─ UNLICENSED: 1
└─ MIT AND ISC: 1
```

### Backend (`backend/`)

Generated 10 September 2026 with `license-checker@25.0.1` against the
`master` branch.

```
├─ MIT: 297
├─ Apache-2.0: 108
├─ BSD-3-Clause: 18
├─ ISC: 12
├─ BSD-2-Clause: 10
├─ MPL-2.0: 2
├─ BSD*: 1
├─ Unlicense: 1
├─ (MIT OR GPL-3.0-or-later): 1
├─ (MIT AND Zlib): 1
├─ BlueOak-1.0.0: 1
├─ 0BSD: 1
└─ UNLICENSED: 1
```

### Review notes for the entries above

- **UNLICENSED (one in each tree)** is the Vaultr package itself
  (`vaultr@0.1.0` in the frontend and `vaultr-backend@1.0.0` in the backend).
  `license-checker` reports any package marked `private: true` as
  UNLICENSED regardless of its `license` field. Both manifests declare
  `AGPL-3.0-only`. No third-party dependency is unlicensed.
- **Apache-2.0 AND LGPL-3.0-or-later (AND MIT)** are the prebuilt `sharp`
  binaries (`@img/sharp-win32-x64`, `@img/sharp-wasm32`), which bundle
  libvips. LGPL-3.0 is compatible with AGPL-3.0.
- **(MIT OR GPL-3.0-or-later)** is `jszip`, used under the MIT option.
- **MIT\*** (`chainsaw`, `traverse`) and **BSD\*** (`duck`) are packages
  whose licence is declared in a form the tool does not recognise. Checked
  manually: `chainsaw` and `traverse` declare `MIT/X11` in their
  `package.json` (and `traverse` ships an MIT LICENSE file); `duck` ships a
  two-clause BSD LICENSE file. All are compatible with AGPL-3.0.
- **Custom: http://github.com/substack/node-bufferlist** is `buffers@0.1.1`,
  a transitive dependency of `exceljs` (via `unzipper` and `binary`). The
  published package contains no licence file and no `license` field, and its
  upstream repository is no longer available on GitHub. The tool's "Custom"
  entry is only a link from the package README. **Open item:** the licence of
  this package could not be confirmed from the package or its source
  repository. It is tracked for replacement or confirmation before the next
  release.
- **CC-BY-4.0** is `caniuse-lite`, a data package. Attribution is satisfied
  by this notice.
- **Python-2.0** is `argparse`, a permissive licence compatible with
  AGPL-3.0.

Apart from the open item on `buffers@0.1.1` above, no licence incompatible
with AGPL-3.0 was found in either tree.

## Other components

The local development stack in `docker-compose.yml` pulls container images
for Supabase Postgres, GoTrue, PostgREST, nginx, Mailpit, RustFS, and the AWS
CLI. These images are used to run Vaultr locally and in CI and are not
redistributed by Vaultr; each is covered by its own upstream licence.

Last reviewed: September 2026 — Sabarinath Babu, Founder, Vaultr
