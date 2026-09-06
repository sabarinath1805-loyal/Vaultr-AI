import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const artifactDir = path.join(process.cwd(), "test-results", "premium-visual-audit");

async function waitForSettledContent(page: import("@playwright/test").Page) {
    await expect(page.locator(".animate-pulse")).toHaveCount(0, { timeout: 15_000 });
}

test.beforeAll(() => {
    fs.mkdirSync(artifactDir, { recursive: true });
});

const desktopRoutes = [
    { name: "assistant", path: "/assistant", ready: /Good (morning|afternoon|evening)/, table: false },
    { name: "projects", path: "/projects", ready: "Projects", table: true },
    { name: "library", path: "/library", ready: "Files", table: true },
    { name: "tabular-reviews", path: "/tabular-reviews", ready: "Tabular Reviews", table: true },
    { name: "workflows", path: "/workflows", ready: "Workflows", table: true },
    { name: "account", path: "/account", ready: "Settings", table: false },
] as const;

for (const route of desktopRoutes) {
    test(`captures ${route.name} at desktop`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(route.path);
        await expect(page.getByRole("heading", { name: route.ready }).first()).toBeVisible({
            timeout: 15_000,
        });
        if (route.table) {
            await expect(page.getByRole("table")).toHaveAttribute("aria-busy", "false", {
                timeout: 15_000,
            });
        }
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
            .toBe(0);
        await page.screenshot({
            path: path.join(artifactDir, `${route.name}-1440.png`),
            fullPage: true,
        });
    });
}

for (const route of desktopRoutes.slice(0, 3)) {
    test(`captures ${route.name} at narrow width`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(route.path);
        await expect(page.getByRole("heading", { name: route.ready }).first()).toBeVisible({
            timeout: 15_000,
        });
        if (route.table) {
            await expect(page.getByRole("table")).toHaveAttribute("aria-busy", "false", {
                timeout: 15_000,
            });
        }
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
            .toBe(0);
        await page.screenshot({
            path: path.join(artifactDir, `${route.name}-375.png`),
            fullPage: true,
        });
    });
}

for (const width of [768, 1024] as const) {
    test(`captures projects at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/projects");
        await expect(page.getByRole("heading", { name: "Projects" }).first()).toBeVisible();
        await expect(page.getByRole("table")).toHaveAttribute("aria-busy", "false", {
            timeout: 15_000,
        });
        await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
            .toBe(0);
        await page.screenshot({
            path: path.join(artifactDir, `projects-${width}.png`),
            fullPage: true,
        });
    });
}

test("captures the unauthenticated login state", async ({ browser }) => {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await page.screenshot({
        path: path.join(artifactDir, "login-1440.png"),
        fullPage: true,
    });
    await context.close();
});

/* The detail captures need at least one project / review to open. Spec files
   run alphabetically, so on a fresh database (CI, nightly) nothing has created
   either yet — the list renders its empty state, the row click goes nowhere,
   and toHaveURL times out. Seed one of each through the same UI flows the
   dedicated specs exercise (project-management.spec.ts createProject and
   tabular-reviews.spec.ts createReview are the sources of truth for these
   selectors), then capture from the list like a user would. */
async function seedProject(page: import("@playwright/test").Page) {
    await page.goto("/projects");
    const createBtn = page.getByRole("button", { name: "New project" });
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    const nameInput = page.getByPlaceholder("Project name");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(`Visual Audit Proj ${Date.now()}`);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/projects\/.+/, { timeout: 15_000 });
}

async function seedTabularReview(page: import("@playwright/test").Page) {
    await page.goto("/tabular-reviews");
    const heading = page.getByRole("heading", { name: "Tabular Reviews" });
    await expect(heading).toBeVisible({ timeout: 10_000 });
    /* Icon-only "new review" button: last button in the h1's actions sibling. */
    await heading.locator("xpath=../div[1]").getByRole("button").last().click();
    const titleInput = page.getByPlaceholder("Review name");
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await titleInput.fill(`Visual Audit Review ${Date.now()}`);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
        .locator('button[name="modalAction"][value="create-review"]')
        .click();
    await page.waitForURL(/\/tabular-reviews\/.+/, { timeout: 30_000 });
}

const detailRoutes = [
    { name: "project-workspace", source: "/projects", url: /\/projects\/[^/]+$/, seed: seedProject },
    { name: "tabular-review-detail", source: "/tabular-reviews", url: /\/tabular-reviews\/[^/]+$/, seed: seedTabularReview },
] as const;

for (const route of detailRoutes) {
    test(`captures ${route.name}`, async ({ page }) => {
        /* Seeding adds a navigation + modal round-trip on top of the capture. */
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 1440, height: 900 });
        await route.seed(page);
        await page.goto(route.source);
        const table = page.getByRole("table");
        await expect(table).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });
        const firstDataRow = table.getByRole("row").nth(1);
        await expect(firstDataRow).toBeVisible();
        await firstDataRow.click();
        await expect(page).toHaveURL(route.url, { timeout: 15_000 });
        await expect(page.getByRole("main").first()).toBeVisible();
        await waitForSettledContent(page);
        await page.screenshot({
            path: path.join(artifactDir, `${route.name}-1440.png`),
            fullPage: true,
        });
    });
}

test("captures workflow detail modal", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/workflows");
    const table = page.getByRole("table");
    await expect(table).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });
    await table.getByRole("row").nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
        path: path.join(artifactDir, "workflow-detail-modal-1440.png"),
        fullPage: true,
    });
});
