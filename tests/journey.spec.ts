import { test, expect, type Page } from "@playwright/test";

async function clearStorage(page: Page) {
  await page.goto("/journey");
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("WondoodleDB");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });
}

test.describe("Learning Journey", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("1. journey page loads with empty state", async ({ page }) => {
    await page.goto("/journey");
    await expect(page.getByTestId("journey-page")).toBeVisible();
    await expect(page.getByTestId("journey-map")).toBeVisible();
    await expect(page.getByTestId("lesson-summary-empty")).toContainText(
      /first doodle/i
    );
  });

  test("2. main navigation works between canvas and journey", async ({
    page,
  }) => {
    await page.goto("/journey");
    await page.getByTestId("nav-canvas").click();
    await expect(page).toHaveURL(/\/learn/);
    await expect(page.getByTestId("learn-workspace")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("nav-journey").first().click();
    await expect(page).toHaveURL(/\/journey/);
    await expect(page.getByTestId("journey-page")).toBeVisible();
  });

  test("3. available and upcoming nodes are distinguishable", async ({
    page,
  }) => {
    await page.goto("/journey");
    const doodle = page.getByTestId("journey-node-create_first_doodle");
    const radar = page.getByTestId("journey-node-discover_misconception");
    await expect(doodle).toHaveAttribute("data-available", "available");
    await expect(radar).toHaveAttribute("data-available", "coming_soon");
    await expect(doodle).toHaveAttribute("data-completed", "false");
  });

  test("4-6. completion only after real event; persists; no duplicate count", async ({
    page,
  }) => {
    await page.goto("/journey");
    await expect(
      page.getByTestId("journey-node-create_first_doodle")
    ).toHaveAttribute("data-completed", "false");

    // Seed via the live Dexie schema the app already opened, then put twice.
    await page.evaluate(async () => {
      const open = indexedDB.open("WondoodleDB");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      if (!db.objectStoreNames.contains("learningEvents")) {
        db.close();
        throw new Error("learningEvents store missing");
      }
      const event = {
        eventId: "doodle_created:wondoodle-default",
        sessionId: "test-session",
        documentId: "wondoodle-default",
        conceptId: null,
        eventType: "doodle_created",
        payload: { kind: "stroke" },
        timestamp: Date.now(),
        source: "canvas",
      };
      const put = () =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction("learningEvents", "readwrite");
          tx.objectStore("learningEvents").put(event);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      await put();
      await put();
      db.close();
    });

    await page.reload();
    await expect(
      page.getByTestId("journey-node-create_first_doodle")
    ).toHaveAttribute("data-completed", "true", { timeout: 10_000 });
    await expect(page.getByTestId("lesson-summary-content")).toBeVisible();

    const count = await page.evaluate(async () => {
      const open = indexedDB.open("WondoodleDB");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const tx = db.transaction("learningEvents", "readonly");
      const all = await new Promise<unknown[]>((resolve, reject) => {
        const req = tx.objectStore("learningEvents").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return all.filter(
        (e) =>
          (e as { eventId?: string }).eventId ===
          "doodle_created:wondoodle-default"
      ).length;
    });
    expect(count).toBe(1);
  });

  test("7. available nodes navigate correctly", async ({ page }) => {
    await page.goto("/journey");
    await page.getByTestId("journey-node-create_first_doodle").click();
    await expect(page.getByTestId("journey-go")).toBeVisible();
    await page.getByTestId("journey-go").click();
    await expect(page).toHaveURL(/\/learn/);
  });

  test("8. coming soon nodes do not navigate to broken routes", async ({
    page,
  }) => {
    await page.goto("/journey");
    await page.getByTestId("journey-node-discover_misconception").click();
    await expect(page.getByTestId("journey-coming-soon")).toBeVisible();
    await expect(page.getByTestId("journey-go")).toHaveCount(0);
    await expect(page).toHaveURL(/\/journey/);
  });

  test("9. empty-state experience looks polished", async ({ page }) => {
    await page.goto("/journey");
    await expect(page.getByTestId("lesson-summary-empty")).toBeVisible();
    await expect(page.getByTestId("summary-start-doodle")).toBeVisible();
  });

  test("10. responsive layout does not clip map", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/journey");
    const map = page.getByTestId("journey-map");
    await expect(map).toBeVisible();
    const box = await map.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(280);
    expect(box!.height).toBeGreaterThan(300);
  });

  test("11. keyboard navigation focuses journey nodes", async ({ page }) => {
    await page.goto("/journey");
    await page.getByTestId("journey-node-create_first_doodle").focus();
    await expect(
      page.getByTestId("journey-node-create_first_doodle")
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("journey-detail")).toBeVisible();
  });

  test("12. talk-with-pip available node links to learn talk mode", async ({
    page,
  }) => {
    await page.goto("/journey");
    await page.getByTestId("journey-node-talk_with_pip").click();
    await page.getByTestId("journey-go").click();
    await expect(page).toHaveURL(/\/learn\?talk=1/);
  });
});
