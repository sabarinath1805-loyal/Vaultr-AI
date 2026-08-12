# Historical Vaultr Parity and Provenance

## Comparison basis

- Current branch: `master`, fresh Mike-based application.
- Historical branch: `old-vaultr-backup` at `e9b36f1c499c44ef0a8737e941659edbe71d870c`.
- The branches have no merge base; `master...old-vaultr-backup` reports 255 commits unique to current and 444 unique to historical.
- No source files, components, migrations, or branding were copied from the historical branch during Gate 2.

The historical branch identifies itself as `Vaultr`, version 1.0.0, local-first legal assistant, MIT licensed. The current packages and root license are AGPL-3.0-only. This license and provenance mismatch remains a legal clearance issue; feature similarity is not provenance clearance.

## Capability comparison

| Historical Vaultr capability | Current Mike baseline | Gate 2 observation |
|---|---|---|
| Matters and matter timeline/billing/parties | Projects, documents, folders, chats, tabular reviews | Not parity-equivalent; matters data model is absent |
| Contract Scanner with risk classification and PDF report | No equivalent scanner surface found | Missing |
| Local-first vault, IndexedDB/SQLite, Tauri document picker | Managed backend/API and object storage model | Missing by design in current baseline; no conversion authorized |
| Chat with provider fallback, RAG, memory, citations | Current chat/LLM/project chat paths | Partial functional concept; provider/flow parity is unproven |
| Legal research, Tavily/CourtListener, citation resolver | Current case-law/CourtListener surface | Partial; old research/RAG path is not a one-to-one match |
| Tabular review | Current tabular review with rows/cells/chats | Present but schema/API model differs from old Supabase table design |
| Custom/built-in workflows and DOCX generation | Current workflows and generated system workflow artifact | Present in a different implementation; source tree missing for regeneration |
| Local document extraction/edit/tracked changes | Current document version/edit routes and parsers | Partial; parser, conversion, and sharing semantics differ |
| Usage/credits/model/settings pages | Current account/settings/model paths | Partial UI parity only; not audited as a branding conversion |
| Tauri desktop packaging | No current `src-tauri` equivalent found | Missing |
| Local billing export and matter-linked records | No current equivalent found | Missing |

## Parity decision

Gate 2 does not authorize parity implementation. This document is an inventory/provenance record only. Any future parity work must have:

- a feature-by-feature acceptance matrix;
- an approved source/provenance and license decision;
- a data-migration plan that does not silently merge incompatible schemas;
- explicit security review for local storage, matters, contract scanning, and provider integrations.
