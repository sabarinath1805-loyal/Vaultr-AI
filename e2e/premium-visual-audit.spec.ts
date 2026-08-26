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

const detailRoutes = [
    { name: "project-workspace", source: "/projects", url: /\/projects\/[^/]+$/ },
    { name: "tabular-review-detail", source: "/tabular-reviews", url: /\/tabular-reviews\/[^/]+$/ },
] as const;

for (const route of detailRoutes) {
    test(`captures ${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
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
