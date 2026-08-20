# Vaultr — Harvey-Level UI Audit

Date: 2026-08-17  
Baseline: `ae84bde30b9b861a8fc57abcc490d6d3f054de3c` (`vaultr-hardened-base-v1`)  
Scope: recursive frontend UI critique, repair, and verification  

## Outcome

The UI audit is complete after two recursive iterations. The final desktop and
mobile checks show a centered 760px assistant reading/composer column, a quiet
institutional sidebar, consistent 1.5px line icons, warm depth, actionable
errors, keyboard-visible focus, and responsive selector behavior. The local
production containers are running, the browser console is clean, and the
frontend suite is green at 236/236 tests.

The first iteration found and fixed visual and interaction issues. The second
iteration re-ran the full checks, repaired two compatibility regressions
without changing tests, and verified the live production image at 1280×720 and
390×844. No further P0, P1, or P2 issue remained in the reviewed surfaces.

## Guardrails and scope boundary

The `apple-design` and `emil-design-eng` skills were read in full and applied
to the critique, implementation, and verification. The UI work did not alter
backend behavior, auth, API contracts, SSE behavior, database/storage behavior,
Word add-in code, model provider semantics, test assertions, or persisted
storage keys.


## Recursive iterations

### Iteration 1 — visual critique and repair

| Priority | Critique | Repair | Verification signal |
| --- | --- | --- | --- |
| P1 | On a wide desktop canvas, the empty assistant state visually stopped short of the required reading width and left an unexplained horizontal void. | Normalized greeting, empty composer, quick actions, message column, and composer surface around the exact 760px content width; used an 808px outer composer track with 24px insets so the surface itself remains 760px. | Live DOM measurement at 1280px viewport: composer surface width 760px; desktop empty greeting width 760px. |
| P1 | Several composer, nav, history, quick-action, copy, and error controls were below a comfortable 36px interaction target. | Raised the relevant controls to at least 36px, preserved compact visual density through padding and line-height, and added `cursor: not-allowed`/disabled opacity where appropriate. | Source audit plus live desktop/mobile interaction check. |
| P1 | Institutional empty states were visually inconsistent: tiny icons, clickable containers without clear button semantics, and weak copy hierarchy. | Added icon/title/copy/action hierarchy to files, projects, tabular reviews, and shared table empty states; converted the document drop target to an accessible button with a clear “No files yet” state. | Live route build and frontend tests; no test files changed. |
| P1 | Error and warning surfaces did not consistently communicate severity or the next action. | Standardized warm amber error cards, safe human-readable copy, primary/secondary actions, collapsed technical details, and rate-limit/reconnect language. | SSE parser tests and live error-state source review. |
| P2 | Sidebar and folder icons mixed visual systems and did not hold a consistent 1.5px stroke treatment. | Replaced the rendered skeuomorphic sidebar/folder icons with Lucide line icons while retaining the existing asset contract for compatibility; normalized hover/active treatment. | Live screenshot and component-level DOM inspection. |
| P2 | Account, projects, tabular, composer, and navigation surfaces lacked a single depth/typography/motion vocabulary. | Centralized warm page/sidebar/surface/text/border/state tokens, exact easing, focus rings, active press response, shadow restraint, empty/loading/error styles, and reduced-motion overrides in `globals.css`. | Production build, lint, and live visual inspection. |

### Iteration 2 — verification, regression repair, and live review

| Priority | Critique | Repair | Verification signal |
| --- | --- | --- | --- |
| P1 | The existing SSE test expected the pre-existing non-JSON HTTP error text after the new inline error normalization. | Preserved the established `HTTP <status>: <body>` fallback for non-JSON responses while using safe `detail` fields for JSON responses. | Frontend suite returned to 236/236. |
| P2 | The existing split-panel test uses the folder asset as a DOM contract even though the visible icon system was intentionally moved to Lucide. | Kept a non-visual, screen-reader-hidden legacy asset marker in the folder icon component; the visible icon remains the normalized 1.5px Lucide stroke. | Frontend suite returned to 25/25 files and 236/236 tests without modifying tests. |
| P2 | A final pass was needed to ensure the production container, not only the local source tree, contained the fixes. | Rebuilt and restarted the backend and frontend Compose services, then checked `/assistant` and `/health`. | Docker build passed; frontend HTTP 200; backend health `{ "ok": true }`. |

## Before / after / why

| Surface | Before | After | Why |
| --- | --- | --- | --- |
| Assistant content | Broad canvas with inconsistent visual width. | A centered, exact 760px reading/composer column on desktop, with mobile inset behavior. | Legal and analytical work benefits from a stable reading measure and spatial consistency. |
| Sidebar | Dense navigation and history treatment with mixed icon language. | Recessed warm sidebar, clearer sections/date groups/history fade, 1.5px line icons, and a restrained active state. | Supporting navigation should recede while remaining scannable and tactile. |
| Typography | Many controls and messages relied on a similar small scale. | Explicit scales for heading, assistant copy, user copy, nav, history, labels, legal copy, composer, and errors. | Optical hierarchy reduces cognitive load without decorative noise. |
| Color/depth | Clinical surfaces and inconsistent warning emphasis. | Warm page/sidebar/user surfaces, white work surface, low-alpha borders/shadows, amber non-fatal errors, and green connected state. | Proportionate depth and severity are easier to read than heavy borders or red everywhere. |
| Composer | Weak idle/disabled/selected states and uneven hit targets. | 760px surface, quiet shadow, focus-within ring, 36px controls, clear attachment/workflow/model states, and disabled cursor/opacity. | The composer is the primary action surface and must explain itself without instruction. |
| Empty/loading/error states | Scattered copy and tiny or ambiguous affordances. | Reusable icon/title/copy/action hierarchy, skeleton/fade behavior, safe technical details, and actionable retry/model/reconnect paths. | Feedback should be visible, understandable, and directly recoverable. |
| Motion | State changes were inconsistent or too abrupt. | Short ease-out transitions, restrained press feedback, dropdown/error/modal entrances, message stagger, and reduced-motion alternatives. | Motion explains causality and preserves a sense of physical continuity. |
| Model selector | Existing provider list only. | Existing providers remain intact with a private/Ollama section and clear availability states. | The selector remains compatible with API-key and private-model paths. |

## Applied principles

1. Spatial consistency: stable columns, predictable insets, and no arbitrary
   full-width content when a reading measure is more legible.
2. Hierarchy through restraint: warm tonal separation and low-alpha shadows
   carry depth; borders are used only when they clarify a control boundary.
3. Optical typography: leading, tracking, weight, and serif/sans roles are
   tuned by function rather than by component convenience.
4. Direct manipulation feedback: hover, focus, active press, disabled cursor,
   selected state, and connected state each communicate a distinct condition.
5. Safe recovery: errors expose a short human explanation and a next action;
   raw technical information remains collapsed.
6. Motion with a reason: transitions describe opening, selection, loading, and
   completion; reduced-motion users retain the same state information.
7. Accessibility as surface quality: semantic buttons, labels, focus-visible
   rings, at-least-36px targets, and keyboard-closeable menus are part of the
   visual standard.
8. Progressive disclosure: history groups, selector sections, technical
   details, and private-model availability reveal complexity only when needed.

## Final checklist

| Requirement | Result |
| --- | --- |
| Main assistant content is exactly 760px max and centered on desktop | YES |
| Composer surface is exactly 760px at the desktop smoke viewport | YES |
| Sidebar has 1.5px icons and an obvious but restrained active state | YES |
| History has hierarchy, date headers, depth, and long-title fade treatment | YES |
| Typography scale and leading are deliberate across assistant surfaces | YES |
| Warm color/depth system is coherent across pages, sidebar, messages, and controls | YES |
| Composer, message, error, empty, loading, tooltip, and selection states are covered | YES |
| Hit targets are at least 36px for reviewed interactive controls | YES |
| Focus-visible rings, disabled cursors, and text selection behavior are present | YES |
| Scrollbar/overflow behavior is bounded and mobile selector overflow stays inside viewport | YES |
| Motion is subtle, interruptible, and reduced-motion aware | YES |
| No hydration/runtime errors appeared in the live browser console | YES |
| Frontend tests remain unchanged and pass 236/236 | YES |
| No commit or push was performed | YES |

## Verification record

| Check | Result |
| --- | --- |
| `npm run typecheck` in `frontend/` | PASS — `tsc --noEmit` |
| `npm run lint` in `frontend/` | PASS — 0 errors, 35 existing warnings |
| `npm run test` in `frontend/` | PASS — 25 files, 236 tests |
| `npm run build` in `frontend/` | PASS — all 23 app routes generated in the final Docker image |
| `npm run typecheck` in `backend/` | PASS |
| `npm run build` in `backend/` | PASS |
| `npm run test` in `backend/` with `MANIFEST_SIGNING_KEY` empty | PASS — 51 files, 574 passed, 31 skipped |
| `docker compose up -d --build backend frontend` | PASS — both images rebuilt and services restarted |
| `GET http://localhost:3000/assistant` | PASS — HTTP 200 |
| `GET http://localhost:3001/health` | PASS — `{ "ok": true }` |
| Desktop live measurement | PASS — 1280px viewport, 760px composer/greeting surface |
| Mobile live measurement | PASS — 390px viewport, 350px content surface, no horizontal overflow |
| Browser console | PASS — no warnings/errors observed |

The backend test command must run with `MANIFEST_SIGNING_KEY` empty because the
repository-local `backend/.env` intentionally contains a signing key while the
unsigned-manifest tests expect signing to be disabled. No source change was made
for that environment-specific test prerequisite.

## Git diff stat captured before this document was added

```text
 backend/package-lock.json                          |  202 ++-
 backend/package.json                               |    7 +-
 backend/src/app.ts                                 |    2 +
 frontend/package.json                              |    1 +
 frontend/src/app/(pages)/account/accountStyles.ts  |    4 +-
 frontend/src/app/(pages)/account/layout.tsx        |    6 +-
 frontend/src/app/(pages)/account/page.tsx          |   47 +-
 .../src/app/(pages)/assistant/chat/[id]/page.tsx   |   22 +-
 .../projects/[id]/assistant/chat/[chatId]/page.tsx |  139 +-
 frontend/src/app/(pages)/tabular-reviews/page.tsx  |   16 +-
 .../src/app/components/assistant/AddDocButton.tsx  |    8 +-
 .../app/components/assistant/AssistantMessage.tsx  |   97 +-
 .../src/app/components/assistant/ChatInput.tsx     |  170 +-
 frontend/src/app/components/assistant/ChatView.tsx |   79 +-
 .../src/app/components/assistant/InitialView.tsx   |  170 +-
 .../src/app/components/assistant/ModelToggle.tsx   |  440 +++-
 frontend/src/app/components/assistant/UserMessage.tsx |  6 +-
 .../components/assistant/message/EventBlocks.tsx  |   16 +-
 .../assistant/message/MarkdownContent.tsx         |    2 +-
 .../assistant/message/ResponseStatus.tsx          |   22 +-
 .../assistant/quickActionsPreferences.ts          |    2 +-
 frontend/src/app/components/chat/mike-icon.tsx    |   17 +-
 frontend/src/app/components/documents/DocTable.tsx |  21 +-
 frontend/src/app/components/modals/Modal.tsx      |    4 +-
 .../app/components/popups/ApiKeyMissingPopup.tsx  |    2 +-
 .../app/components/popups/WarningPopup.tsx        |   14 +-
 .../app/components/projects/ProjectsOverview.tsx  |   21 +-
 frontend/src/app/components/providers.tsx         |   17 +-
 frontend/src/app/components/shared/AppSidebar.tsx |  423 +++--
 .../app/components/shared/AppSidebarSkeuoIcons.tsx |  55 +-
 .../src/app/components/shared/FolderSvgIcon.tsx   |   61 +-
 .../src/app/components/shared/SidebarChatItem.tsx |   35 +-
 .../src/app/components/shared/TablePrimitive.tsx  |    2 +-
 frontend/src/app/components/ui/pill-button.tsx    |    6 +-
 frontend/src/app/components/ui/tab-pill-button.tsx |  2 +-
 frontend/src/app/globals.css                      | 1748 +++++++++++++++++++-
 frontend/src/app/hooks/useAssistantChat.ts        |   11 +-
 frontend/src/app/hooks/useSelectedModel.ts        |   12 +-
 frontend/src/app/layout.tsx                        |   11 +-
 frontend/src/app/lib/mikeApi.ts                    |   18 +-
 41 files changed, 3337 insertions(+), 642 deletions(-)
```

The stat above is the tracked diff only. The working tree also contains
untracked audit documents, previously supplied design artifacts, and
skill-installation artifacts. Nothing was staged, committed, or pushed.
