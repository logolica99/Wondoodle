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

async function drawStroke(page: Page) {
  await page.getByTestId("tool-pen").click();
  const stage = page.locator(".konvajs-content canvas").first();
  const box = await stage.boundingBox();
  if (!box) throw new Error("No stage");
  const x = box.x + 180;
  const y = box.y + 180;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 100, y + 50, { steps: 10 });
  await page.mouse.up();
}

test.describe("Feature 1.5 — Kid-friendly UX", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("welcome screen navigates to workspace", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("welcome-screen")).toBeVisible();
    await expect(page.getByTestId("pip-mascot")).toBeVisible();
    await expect(page.getByTestId("welcome-start")).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId("welcome-start").click();
    await expect(page).toHaveURL(/\/learn/);
    await expect(page.getByTestId("learn-workspace")).toBeVisible();
  });

  test("returning users resume saved work from welcome", async ({ page }) => {
    await waitForCanvas(page);
    await drawStroke(page);
    await expect
      .poll(async () => page.getByTestId("save-status").textContent(), {
        timeout: 10_000,
      })
      .toMatch(/All saved|Saved/i);

    await page.goto("/");
    await expect(page.getByTestId("welcome-screen")).toBeVisible();
    await expect(page.getByTestId("welcome-start")).toContainText(/Continue learning/i);
    await expect(page.getByTestId("welcome-resume-hint")).toBeVisible();
    await page.getByTestId("welcome-start").click();
    await expect(page.getByTestId("smart-canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
  });

  test("toolbar selection states and labels", async ({ page }) => {
    await waitForCanvas(page);
    const draw = page.getByTestId("tool-pen");
    const move = page.getByTestId("tool-select");
    await expect(draw).toHaveAttribute("aria-pressed", "true");
    await expect(draw).toHaveAttribute("aria-label", "Draw");
    await move.click();
    await expect(move).toHaveAttribute("aria-pressed", "true");
    await expect(draw).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("tool-eraser")).toHaveAttribute("aria-label", "Erase");
    await expect(page.getByTestId("tool-text")).toHaveAttribute("aria-label", "Write");
    await expect(page.getByTestId("tool-image")).toHaveAttribute("aria-label", "Photo");
  });

  test("keyboard accessibility for tools", async ({ page }) => {
    await waitForCanvas(page);
    await page.getByTestId("tool-pen").focus();
    await expect(page.getByTestId("tool-pen")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("tool-eraser")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("tool-eraser")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("friendly save status copy", async ({ page }) => {
    await waitForCanvas(page);
    await drawStroke(page);
    await expect
      .poll(async () => page.getByTestId("save-status").textContent(), {
        timeout: 10_000,
      })
      .toMatch(/All saved!/);
  });

  test("mascot can be hidden and shown", async ({ page }) => {
    await waitForCanvas(page);
    await expect(page.getByTestId("pip-mascot")).toBeVisible();
    await page.getByTestId("pip-hide-button").click();
    await expect(page.getByTestId("pip-mascot")).toHaveCount(0);
    await expect(page.getByTestId("pip-show-button")).toBeVisible();
    await page.getByTestId("pip-show-button").click();
    await expect(page.getByTestId("pip-mascot")).toBeVisible();
  });

  test("pip help control opens tip", async ({ page }) => {
    await waitForCanvas(page);
    await page.getByTestId("pip-help-button").click();
    await expect(page.getByTestId("pip-help-bubble")).toBeVisible();
    await expect(page.getByTestId("pip-mascot")).toHaveAttribute(
      "data-mood",
      "thinking"
    );
  });

  test("reduced-motion keeps mascot idle without looping mood attrs", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await waitForCanvas(page);
    const pip = page.getByTestId("pip-mascot");
    await expect(pip).toBeVisible();
    // After workspace entry, mood settles to idle (no continuous welcome bounce).
    await expect
      .poll(async () => pip.getAttribute("data-mood"), { timeout: 5_000 })
      .toBe("idle");
  });

  test("responsive layout has no horizontal overflow", async ({ page }) => {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await waitForCanvas(page);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      await expect(page.getByTestId("canvas-toolbar")).toBeVisible();
      await expect(page.getByTestId("tool-undo")).toBeVisible();
      await expect(page.getByTestId("export-button")).toBeVisible();
      await expect(page.getByTestId("save-status")).toBeVisible();
    }
  });

  test("export preview dialog works", async ({ page }) => {
    await waitForCanvas(page);
    await drawStroke(page);
    await page.getByTestId("export-button").click();
    await expect(page.getByTestId("export-preview-dialog")).toBeVisible();
    await expect(page.getByTestId("export-preview-image")).toBeVisible();
    await page.getByRole("button", { name: /Keep editing/i }).click();
    await expect(page.getByTestId("export-preview-dialog")).toHaveCount(0);
  });

  test("empty canvas uses kid-friendly copy", async ({ page }) => {
    await waitForCanvas(page);
    await expect(page.getByTestId("canvas-empty-state")).toContainText(
      "Your ideas start here!"
    );
  });

  test("first creation shows celebration once", async ({ page }) => {
    await waitForCanvas(page);
    // Reset celebration flag for this session path
    await page.evaluate(() => {
      const raw = localStorage.getItem("wondoodle-ui");
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.state = {
          ...parsed.state,
          celebratedFirstStroke: false,
        };
        localStorage.setItem("wondoodle-ui", JSON.stringify(parsed));
      }
    });
    await page.reload();
    await expect(page.getByTestId("smart-canvas")).toBeVisible({ timeout: 30_000 });
    await drawStroke(page);
    await expect(page.getByTestId("first-stroke-celebration")).toBeVisible();
    await expect(page.getByTestId("first-stroke-celebration")).toContainText(
      "Nice start!"
    );
  });
});
