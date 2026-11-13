import { test, expect, type Page } from "@playwright/test";

async function clearStorage(page: Page) {
  await page.goto("/learn");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("WondoodleDB");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });
}

async function waitForCanvas(page: Page) {
  await page.goto("/learn");
  await expect(page.getByTestId("learn-workspace")).toBeVisible();
  await expect(page.getByTestId("smart-canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("canvas-loading")).toHaveCount(0, {
    timeout: 15_000,
  });
}

test.describe("UI polish — paper, mascot, layout", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("paper style persists across reload", async ({ page }) => {
    await waitForCanvas(page);
    await page.getByTestId("paper-ruled").click();
    await expect(page.getByTestId("paper-ruled")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.reload();
    await expect(page.getByTestId("smart-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("paper-ruled")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("export preview includes selected paper style background", async ({
    page,
  }) => {
    await waitForCanvas(page);
    await page.getByTestId("paper-dotted").click();

    await page.getByTestId("tool-pen").click();
    const stage = page.locator(".konvajs-content canvas").first();
    const box = await stage.boundingBox();
    if (!box) throw new Error("No stage");
    await page.mouse.move(box.x + 180, box.y + 180);
    await page.mouse.down();
    await page.mouse.move(box.x + 260, box.y + 220, { steps: 8 });
    await page.mouse.up();

    await page.getByTestId("export-button").click();
    await expect(page.getByTestId("export-preview-dialog")).toBeVisible();
    const preview = page.getByTestId("export-preview-image");
    await expect(preview).toBeVisible();
    const src = await preview.getAttribute("src");
    expect(src).toMatch(/^data:image\/png/);
  });

  test("mascot can be minimized and hidden", async ({ page }) => {
    await waitForCanvas(page);
    await expect(page.getByTestId("pip-mascot")).toBeVisible();
    await page.getByTestId("pip-minimize-button").click();
    await expect(page.getByTestId("pip-mascot")).toHaveCount(0);
    await expect(page.getByTestId("pip-expand-button")).toBeVisible();
    await page.getByTestId("pip-expand-button").click();
    await expect(page.getByTestId("pip-mascot")).toBeVisible();

    await page.getByTestId("pip-hide-button").click();
    await expect(page.getByTestId("pip-show-button")).toBeVisible();
    await page.getByTestId("pip-show-button").click();
    await expect(page.getByTestId("pip-mascot")).toBeVisible();
  });

  test("empty state fades after first interaction", async ({ page }) => {
    await waitForCanvas(page);
    await expect(page.getByTestId("canvas-empty-state")).toBeVisible();
    await expect(page.getByTestId("empty-state-illustration")).toBeVisible();

    const stage = page.locator(".konvajs-content canvas").first();
    const box = await stage.boundingBox();
    if (!box) throw new Error("No stage");
    await page.mouse.click(box.x + 120, box.y + 120);
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
  });

  test("zoom controls are visible and not clipped", async ({ page }) => {
    await waitForCanvas(page);
    const zoom = page.getByTestId("zoom-controls");
    await expect(zoom).toBeVisible();
    const box = await zoom.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
    if (!viewport) return;
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);

    await page.getByTestId("zoom-in").click();
    await expect(page.getByTestId("zoom-label")).not.toHaveText("100%");
    await page.getByTestId("zoom-reset").click();
    await expect(page.getByTestId("zoom-label")).toHaveText("100%");
  });

  test("responsive layout has no horizontal overflow", async ({ page }) => {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await waitForCanvas(page);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      await expect(page.getByTestId("canvas-toolbar")).toBeVisible();
      await expect(page.getByTestId("zoom-controls")).toBeVisible();
      await expect(page.getByTestId("paper-style-picker")).toBeVisible();
    }
  });
});
