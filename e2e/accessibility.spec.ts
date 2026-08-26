/**
 * Accessibility (axe-core) E2E scans:
 *   1. /login — the unauthenticated entry point
 *   2. /assistant — the main chat/home surface
 *   3. /projects — the projects list
 *   4. /tabular-reviews — the tabular review list
 *
 * Each test loads a core page, waits for a page-specific anchor element (so the
 * scan runs against the real rendered UI, not a loading state), then runs an
 * axe-core scan via @axe-core/playwright.
 *
 * TWO-TIER POLICY — why only `critical` fails the build:
 * axe grades each violation minor → moderate → serious → critical. Turning the
 * scanner on with everything blocking would land a wall of red on day one and
 * the check would get ignored or reverted. So we start by ENFORCING only
 * `critical` (zero tolerance — these break the page outright for assistive
 * tech), while `serious` violations are LOGGED to the test output on every run
 * so the backlog stays visible. Once the serious backlog is cleared, ratchet:
 * move "serious" into the failing tier by adding it to BLOCKING_IMPACTS below.
 *
 * No selector exclusions are currently needed — the app renders no third-party
 * embedded widgets (chat bubbles, cookie banners, analytics iframes) on these
 * pages. If one appears, exclude it with `.exclude("<selector>")` on the
 * AxeBuilder and document here what the selector is and why it's out of scope.
 *
 * Prerequisite: auth.setup.ts has already saved the session to e2e/.auth/user.json
 * (tests 2–4 inherit the authenticated storageState from playwright.config.ts).
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Impact levels that fail the test. Ratchet by adding "serious" here. */
const BLOCKING_IMPACTS = ["critical"];

/** Impact levels that are reported in the test output but do not fail. */
const LOGGED_IMPACTS = ["serious"];

/**
 * One-line summary per violation: rule id, impact, how many DOM nodes are
 * affected, and the axe help URL (which explains the rule and how to fix it).
 */
function formatViolation(v: {
    id: string;
    impact?: string | null;
    nodes: unknown[];
    helpUrl: string;
}): string {
    return `[${v.impact}] ${v.id} (${v.nodes.length} node${
        v.nodes.length === 1 ? "" : "s"
    }) — ${v.helpUrl}`;
}

function formatViolationDetails(v: {
    nodes: Array<{
        target: unknown[];
        failureSummary?: string;
    }>;
}): string {
    return v.nodes
        .map((node) => {
            const target = node.target.join(" ");
            const summary = node.failureSummary?.replace(/\s+/g, " ").trim();
            return `    ${target}${summary ? ` — ${summary}` : ""}`;
        })
        .join("\n");
}

/**
 * Run an axe scan on the current page. Violations at BLOCKING_IMPACTS fail the
 * test with a readable list; violations at LOGGED_IMPACTS are printed to the
 * test output (visible in the report and CI logs) without failing.
 */
async function expectNoBlockingViolations(page: Page, pageLabel: string) {
    const results = await new AxeBuilder({ page }).analyze();

    const blocking = results.violations.filter((v) =>
        BLOCKING_IMPACTS.includes(v.impact ?? ""),
    );
    const logged = results.violations.filter((v) =>
        LOGGED_IMPACTS.includes(v.impact ?? ""),
    );

    if (logged.length > 0) {
        /* Non-failing tier: surface the backlog on every run so it can be
           burned down, then promoted into BLOCKING_IMPACTS. */
        console.log(
            `[a11y] ${pageLabel}: ${logged.length} serious violation(s) ` +
                `(logged, not yet enforced):\n` +
                logged
                    .map(
                        (v) =>
                            `  ${formatViolation(v)}\n${formatViolationDetails(v)}`,
                    )
                    .join("\n"),
        );
    }

    expect(
        blocking.map(formatViolation),
        `critical-impact axe violations on ${pageLabel}`,
    ).toEqual([]);
}

async function ensureSidebarOpen(page: Page) {
    const openSidebar = page.getByRole("button", { name: "Open sidebar" });
    if (await openSidebar.isVisible()) await openSidebar.click();
}

async function expectFinalTableState(
    page: Page,
    selectAllLabel: string,
): Promise<void> {
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 10_000 });
    await expect(
        table.getByRole("checkbox", { name: selectAllLabel }),
    ).toBeVisible({ timeout: 10_000 });

    const checkboxes = table.getByRole("checkbox");
    for (let index = 0; index < (await checkboxes.count()); index += 1) {
        await expect(checkboxes.nth(index)).toHaveAttribute(
            "aria-label",
            /.+/,
        );
    }}

/* ─── Test 1: login page (pre-auth) ──────────────────────────────────────── */

/* describe-scoped test.use so only this test runs without a stored session.
   File-level test.use would wipe the storageState for the authenticated
   scans below. */
test.describe("unauthenticated", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("login page has no critical accessibility violations", async ({
        page,
    }) => {
        await page.goto("/login");
        await expect(page).toHaveURL(/\/login/);
        /* The login form's email field renders once the page is interactive. */
        await expect(page.locator("#email")).toBeVisible({ timeout: 10_000 });

        await expectNoBlockingViolations(page, "/login");
    });
});

/* ─── Test 2: assistant (main chat/home) ─────────────────────────────────── */

test("assistant page has no critical accessibility violations", async ({
    page,
}) => {
    await page.goto("/assistant");
    await expect(page).toHaveURL(/\/assistant/);
    /* The InitialView renders a greeting heading once loaded. */
    await expect(page.locator("h1, h2").first()).toBeVisible({
        timeout: 10_000,
    });

    await expectNoBlockingViolations(page, "/assistant");
});

test("interactive icon motion respects reduced-motion preferences", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/assistant");
    await ensureSidebarOpen(page);

    const searchButton = page.getByRole("button", { name: /Search/ });
    await expect(searchButton).toBeVisible({ timeout: 10_000 });
    await searchButton.hover();

    const movingParts = searchButton.locator(".vaultr-moving-icon, .vaultr-moving-icon *");
    const motionStyles = await movingParts.evaluateAll((elements) =>
        elements.map((element) => {
            const style = getComputedStyle(element);
            return {
                animationName: style.animationName,
                transitionDuration: style.transitionDuration,
                transform: style.transform,
            };
        }),
    );

    expect(motionStyles.length).toBeGreaterThan(0);
    expect(motionStyles).toEqual(
        expect.arrayContaining(
            motionStyles.map(() => ({
                animationName: "none",
                transitionDuration: "0s",
                transform: "none",
            })),
        ),
    );
});

test("search dialog contains and restores keyboard focus", async ({ page }) => {
    await page.goto("/assistant");
    await ensureSidebarOpen(page);

    const searchTrigger = page.getByRole("button", { name: /Search/ });
    await searchTrigger.click();
    const dialog = page.getByRole("dialog", {
        name: "Search chats and projects",
    });
    const searchInput = dialog.getByPlaceholder("Search chats and projects");
    await expect(searchInput).toBeFocused();

    await searchInput.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(searchTrigger).toBeFocused();

    await searchTrigger.click();
    await expect(searchInput).toBeFocused();
    await searchInput.press("Shift+Tab");
    await expect
        .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
        .toBe(true);
    await dialog.locator("button:not(:disabled)").last().press("Tab");
    await expect(searchInput).toBeFocused();
});

/* ─── Test 3: projects list ──────────────────────────────────────────────── */

test("projects page has no critical accessibility violations", async ({
    page,
}) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects/);
    /* The final-state select-all checkbox appears only after project loading
       has completed, including the populated row render. */
    await expectFinalTableState(page, "Select all projects");

    await expectNoBlockingViolations(page, "/projects");
});

/* ─── Test 4: tabular reviews list ───────────────────────────────────────── */

test("tabular reviews page has no critical accessibility violations", async ({
    page,
}) => {
    await page.goto("/tabular-reviews");
    await expect(page).toHaveURL(/\/tabular-reviews/);
    await expectFinalTableState(page, "Select all reviews");

    await expectNoBlockingViolations(page, "/tabular-reviews");
});
