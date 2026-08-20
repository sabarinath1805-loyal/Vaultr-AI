# Vaultr UI Polish Pass — Complete

Date: 2026-08-16
Baseline: `ae84bde30b9b861a8fc57abcc490d6d3f054de3c` (`vaultr-hardened-base-v1`)
Scope: frontend UI presentation and interaction polish only

## Scope and guardrails

This pass used the repository’s `apple-design` and `emil-design-eng` skills. The
skills were read in full before implementation. The work preserves the existing
routes, data flow, authentication, API calls, streaming behavior, persistence,
and document workflows.

No files under `backend/`, `word-addin/`, or the test suite were changed. No
commit or push was performed.

## Files changed

### Frontend source

- `frontend/src/app/globals.css` — Vaultr tokens, layout constraints, typography,
  surfaces, states, and motion/reduced-motion rules.
- `frontend/src/app/(pages)/layout.tsx` — application-shell styling hook.
- `frontend/src/app/(pages)/assistant/chat/[id]/page.tsx` — UI retry action for
  the latest failed assistant turn.
- `frontend/src/app/(pages)/projects/[id]/assistant/chat/[chatId]/page.tsx` —
  project-chat retry and model-selector action wiring.
- `frontend/src/app/components/shared/AppSidebar.tsx` — sidebar hierarchy,
  history grouping/filtering, Lucide icons, and sizing hooks.
- `frontend/src/app/components/shared/SidebarChatItem.tsx` — history row
  styling, masked title treatment, and normalized history icon.
- `frontend/src/app/components/assistant/AddDocButton.tsx` — composer tool-pill
  styling hook.
- `frontend/src/app/components/assistant/AssistantMessage.tsx` — actionable
  amber error card, safe event-error copy, and copy-button affordance.
- `frontend/src/app/components/assistant/ChatInput.tsx` — composer surface,
  disabled-send state, tool affordances, and imperative model-selector handle.
- `frontend/src/app/components/assistant/ChatView.tsx` — centered message
  column, fixed composer column, message-entry motion, and error actions.
- `frontend/src/app/components/assistant/InitialView.tsx` — legal note, quick
  action chips, empty-state columns, and greeting motion.
- `frontend/src/app/components/assistant/ModelToggle.tsx` — contextual model
  tooltip and programmatic opening for “Switch model”.
- `frontend/src/app/components/assistant/UserMessage.tsx` — user-message
  typography and warm bubble surface.
- `frontend/src/app/components/assistant/message/EventBlocks.tsx` — amber
  non-fatal event indicators instead of red error dots.
- `frontend/src/app/components/assistant/message/MarkdownContent.tsx` —
  assistant-copy typography hook.
- `frontend/src/app/components/assistant/message/ResponseStatus.tsx` — Vaultr
  mark for normal state and amber warning icon for errors.
- `frontend/src/app/components/modals/Modal.tsx` — modal/backdrop motion hooks.

### Documentation

- `docs/vaultr-rebuild/UI_POLISH_COMPLETE.md` — this completion record.

The untracked `.agents/` directory and `skills-lock.json` were pre-existing
skill-installation artifacts and were not modified by this pass.

## Design decisions and principle mapping

| Decision | Result | Principle | Reasoning |
| --- | --- | --- | --- |
| Centralized warm design tokens | Added page, sidebar, canvas, surface, user, text, border, state, shadow, and easing tokens in `globals.css`. | Both skills | A small, explicit visual vocabulary keeps the interface spatially and optically consistent instead of accumulating one-off values. |
| Content column | Chat content and composer use a centered `min(100%, 760px)` column with 32px top and 120px bottom message padding. | apple-design | Spatial consistency and reading comfort take priority over filling empty viewport area. |
| Warm depth | Page is `#F8F7F4`, sidebar `#F1EFE9`, chat canvas white, and depth comes from low-alpha shadows rather than heavy outlines. | emil-design-eng | Surfaces should have quiet hierarchy and semi-transparent depth, not a collection of hard borders. |
| Sidebar restraint | Sidebar is 220px wide, visually recedes, and separates navigation, projects, and history with spacing/inset tonal separation. | apple-design | Supporting navigation should not compete with the active work surface. |
| History scanning | Added search/filter UI, Today/Yesterday/Last 7 Days/Older disclosure groups, counts, and a right-edge mask fade for long titles. | Both skills | Progressive disclosure reduces visual noise while preserving access to the complete history. |
| Typography scale | Applied 15px/400 body copy, 15px/450 user copy, 13.5px/450 nav, 13px history, 11px tracked labels, 12px legal copy, and 15px composer placeholder. | apple-design | Optical sizing, tracking, and leading make the hierarchy scannable without decorative noise. |
| Composer affordance | Composer uses 16px padding, 16px radius, visible default border, quiet shadow, focus-within shadow, tool pills, and a 0.35-opacity disabled send button. | Both skills | Controls communicate state immediately and remain visually calm when idle. |
| Actionable errors | Raw errors are shown only in collapsed Technical details; the primary card says “Unable to get a response” and offers Try again/Switch model. | apple-design | Feedback is causally clear, actionable, and proportionate to a non-fatal API problem. |
| Motion model | Used short CSS transitions, custom ease-out curves, 50ms message staggering, 200ms error/modal entrances, and reduced-motion overrides. | Both skills | Motion explains state changes, stays interruptible, and avoids animation for decoration. |
| Icon consistency | Sidebar icons use Lucide with a normalized 1.5px stroke; assistant state uses the existing Vaultr SVG mark; copy has a 32px hit target and tooltip. | apple-design | Icons clarify state and interaction; they are not ornamental filler. |
| Press feedback | Quick-action chips, composer tools, send, and error actions use a restrained `scale(0.97)` active response. | emil-design-eng | A small press response gives immediate pointer-down feedback without elastic or distracting movement. |
| Reduced motion | Message transforms are replaced with opacity-only fades and modal transforms are removed under `prefers-reduced-motion: reduce`. | Both skills | Motion preferences are respected while preserving state visibility. |

## Requirement-by-requirement audit

| Issue | Before | After | Evidence in implementation |
| --- | --- | --- | --- |
| 1. Whitespace void | Messages and composer floated in an overly broad canvas with no dependable reading column. | Both are centered in a 760px column; messages have 32px top/120px bottom padding; copy is capped at 75ch. | `.vaultr-message-column`, `.vaultr-composer-column`, `.vaultr-assistant-copy`, `.vaultr-user-message` in `globals.css`. |
| 2. Sidebar overcrowding | Navigation, projects, and a long history list had weak hierarchy and hard title truncation. | Sidebar is 220px; sections are visually separated; history has a search field, collapsible date groups, counts, and CSS mask fade. | `AppSidebar.tsx`, `SidebarChatItem.tsx`, and sidebar selectors in `globals.css`. |
| 3. Flat typography | Most visible text used the same small size and weight. | Message, user, nav, history, date-header, composer, chip, legal, and section-label scales are explicitly defined. | Typography selectors in `globals.css`; component hooks in message/sidebar/composer files. |
| 4. Sterile color system | The interface relied on clinical whites and red non-fatal errors. | Warm page/sidebar/user surfaces, white content surface, warm primary/secondary/muted text, low-alpha borders/shadows, amber error, and green success tokens are centralized. | `:root` Vaultr variables and component selectors in `globals.css`; amber event indicators in `EventBlocks.tsx`. |
| 5. Raw error UX | Provider and connector strings could appear directly in the chat stream. | Inline amber card uses the required title/subtitle, warning triangle, Try again, Switch model, and collapsed Technical details. Event sub-errors use safe human-readable copy. | `AssistantMessage.tsx`, `ResponseStatus.tsx`, `EventBlocks.tsx`, and page-level retry/model actions. |
| 6. Composer clutter | Send state and tool controls had weak affordance; composer surface was glassy and inconsistent. | Send is disabled at opacity 0.35 with not-allowed cursor when empty; documents/workflows are 32px bordered pills; model control has context tooltip and direct opening; composer has 16px padding, 16px radius, border, shadow, and focus transition. | `ChatInput.tsx`, `AddDocButton.tsx`, `ModelToggle.tsx`, and composer selectors in `globals.css`. |
| 7. Invisible quick actions | Empty-state actions lacked a clear border, weight, and press response. | White 10px-radius chips use 8px/14px padding, 13px/450 text, 15px Lucide icon, 8px grid gap, hover tint, and 0.97 active scale in a 760px grid. | `InitialView.tsx` and `.vaultr-quick-action-*` selectors in `globals.css`. |
| 8. Legal disclaimer | Legal note was too faint and lacked a visual anchor. | It is 12px/400 in `#6B6560`, centered below the composer with an info icon and 8px inline gap. | `InitialView.tsx` and `.vaultr-legal-note` in `globals.css`. |
| 9. Inconsistent icons | Sidebar stroke weights varied; assistant state and copy action had weak affordances. | Sidebar Lucide icons inherit 1.5px stroke; the existing Vaultr mark is retained for assistant status; copy action has a 32px/6px target, tooltip, and hover state. | `AppSidebar.tsx`, `SidebarChatItem.tsx`, `ResponseStatus.tsx`, `AssistantMessage.tsx`, and `globals.css`. |
| 10. Flat sidebar/canvas | Sidebar and content did not establish clear depth or surface ownership. | Sidebar uses `#F1EFE9` without a hard right border and a 2px/8px low-alpha edge shadow; outer canvas is warm and the inner reading column is white. | `.vaultr-sidebar`, `.vaultr-chat-canvas`, and `.vaultr-message-column` in `globals.css`. |
| 11. Static transitions | Key state changes were instant or inconsistent. | Sidebar resize is 300ms; nav and tool hover are 150ms; message reveal is 200ms with 50ms stagger; composer focus is 200ms; send/chip/error/modal transitions match the requested timings; reduced motion is supported. | Motion selectors/keyframes and reduced-motion media query in `globals.css`; modal hooks in `Modal.tsx`. |

## Verification

All verification below was run against the final working tree after the last
CSS, model-selector, and project split-panel alignment adjustments.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` from `frontend/` | PASS |
| `npm run lint` from `frontend/` | PASS — 0 errors, 37 existing warnings; no new error was introduced |
| `npm run build` from `frontend/` | PASS — all 23 app routes generated |
| `npm run test` from `frontend/` | PASS — 25 test files, 236 tests |
| `docker compose up -d --build frontend` | PASS — final frontend image built and container restarted |
| `GET http://localhost:3000/assistant` | PASS — HTTP 200 |
| `GET http://localhost:3001/health` | PASS — `{"ok":true}` |
| Docker service check | PASS — frontend, backend, Supabase gateway, auth, database, storage, REST, and Mailpit were running |

The requested `npm run typecheck` script does not exist in
`frontend/package.json`; the repository’s equivalent check was run directly as
`npx tsc --noEmit`. No package script or lockfile was added just to manufacture
that missing command.

## Git scope audit

- `git diff --check`: no whitespace errors.
- `git diff --name-only -- backend word-addin`: empty.
- No test/spec file appears in the tracked diff.
- No backend, API route, auth, streaming/SSE, database/storage, local-storage
  key, package name, module name, import alias, or Word add-in file was changed.
- The completion document itself is intentionally new and uncommitted, so a
  plain `git diff --stat` does not include it until it is staged; the status
  output below records it separately.

### Tracked diff stat

```text
 .../src/app/(pages)/assistant/chat/[id]/page.tsx   |  22 +-
 frontend/src/app/(pages)/layout.tsx                |   2 +-
 .../projects/[id]/assistant/chat/[chatId]/page.tsx | 139 ++--
 .../src/app/components/assistant/AddDocButton.tsx  |   8 +-
 .../app/components/assistant/AssistantMessage.tsx  |  80 +-
 .../src/app/components/assistant/ChatInput.tsx     |  31 +-
 frontend/src/app/components/assistant/ChatView.tsx |  39 +-
 .../src/app/components/assistant/InitialView.tsx   |  45 +-
 .../src/app/components/assistant/ModelToggle.tsx   | 188 +++--
 .../src/app/components/assistant/UserMessage.tsx   |   6 +-
 .../components/assistant/message/EventBlocks.tsx   |  16 +-
 .../assistant/message/MarkdownContent.tsx          |   2 +-
 .../assistant/message/ResponseStatus.tsx           |  22 +-
 frontend/src/app/components/modals/Modal.tsx       |   4 +-
 frontend/src/app/components/shared/AppSidebar.tsx  | 317 +++++---
 .../src/app/components/shared/SidebarChatItem.tsx  |  40 +-
 frontend/src/app/globals.css                       | 805 ++++++++++++++++++++-
 17 files changed, 1407 insertions(+), 359 deletions(-)
```

## Final state

The UI polish pass is complete and left dirty for review as required. No commit
was created and nothing was pushed.
