import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

async function waitForCanvas(page: Page, options?: { reload?: boolean }) {
  if (options?.reload) {
    await page.reload();
  } else {
    await page.goto("/learn");
  }
  await expect(page.getByTestId("learn-workspace")).toBeVisible();
  await expect(page.getByTestId("smart-canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("canvas-toolbar")).toBeVisible();
  await expect(page.getByTestId("canvas-loading")).toHaveCount(0, {
    timeout: 15_000,
  });
}

async function getStageBox(page: Page) {
  const stage = page.locator(".konvajs-content canvas").first();
  await expect(stage).toBeVisible();
  const box = await stage.boundingBox();
  if (!box) throw new Error("Canvas stage not found");
  return { stage, box };
}

async function drawStroke(
  page: Page,
  startOffset = { x: 200, y: 200 }
) {
  await page.getByTestId("tool-pen").click();
  const { box } = await getStageBox(page);
  const x = box.x + startOffset.x;
  const y = box.y + startOffset.y;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 120, y + 40, { steps: 12 });
  await page.mouse.move(x + 180, y + 90, { steps: 10 });
  await page.mouse.up();
}

test.describe("Smart Canvas", () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage once per test without wiping again on intentional reloads.
    await page.goto("/learn");
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase("WondoodleDB");
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      });
    });
  });

  test("1. /learn page loads", async ({ page }) => {
    await waitForCanvas(page);
    await expect(page.getByTestId("wondoodle-logo-icon")).toBeVisible();
  });

  test("2. canvas and essential tools are visible", async ({ page }) => {
    await waitForCanvas(page);
    await expect(page.getByTestId("tool-select")).toBeVisible();
    await expect(page.getByTestId("tool-pen")).toBeVisible();
    await expect(page.getByTestId("tool-eraser")).toBeVisible();
    await expect(page.getByTestId("tool-text")).toBeVisible();
    await expect(page.getByTestId("tool-image")).toBeVisible();
    await expect(page.getByTestId("tool-undo")).toBeVisible();
    await expect(page.getByTestId("tool-redo")).toBeVisible();
    await expect(page.getByTestId("export-button")).toBeVisible();
    await expect(page.getByTestId("canvas-settings")).toBeVisible();
  });

  test("3-5. drawing, undo, and redo", async ({ page }) => {
    await waitForCanvas(page);
    await drawStroke(page);

    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
    await expect(page.getByTestId("tool-undo")).toBeEnabled();

    await page.getByTestId("tool-undo").click();
    await expect(page.getByTestId("canvas-empty-state")).toBeVisible();
    await expect(page.getByTestId("tool-redo")).toBeEnabled();

    await page.getByTestId("tool-redo").click();
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
  });

  test("6. text can be added and edited", async ({ page }) => {
    await waitForCanvas(page);
    await page.getByTestId("tool-text").click();
    const { box } = await getStageBox(page);

    await page.mouse.click(box.x + 260, box.y + 220);
    const editor = page.getByTestId("text-editor");
    await expect(editor).toBeVisible();
    await editor.fill("Homework notes");
    await editor.blur();
    await expect(page.getByTestId("text-editor")).toHaveCount(0);
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
  });

  test("7. image can be uploaded and moved", async ({ page }) => {
    await waitForCanvas(page);

    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAMElEQVR4nO3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOBvAcQAAAF5q1sNAAAAAElFTkSuQmCC";
    const tmpDir = path.join(__dirname, ".tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, "test-image.png");
    fs.writeFileSync(filePath, Buffer.from(pngBase64, "base64"));

    await page.getByTestId("image-file-input").setInputFiles(filePath);
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("image-error")).toHaveCount(0);

    await page.getByTestId("tool-select").click();
    const { box } = await getStageBox(page);
    await page.mouse.move(box.x + 160, box.y + 160);
    await page.mouse.down();
    await page.mouse.move(box.x + 240, box.y + 220, { steps: 8 });
    await page.mouse.up();
  });

  test("8. erasing removes the intended stroke", async ({ page }) => {
    await waitForCanvas(page);
    await drawStroke(page, { x: 220, y: 240 });
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);

    await page.getByTestId("tool-eraser").click();
    const { box } = await getStageBox(page);
    await page.mouse.move(box.x + 220, box.y + 240);
    await page.mouse.down();
    await page.mouse.move(box.x + 300, box.y + 280, { steps: 15 });
    await page.mouse.move(box.x + 360, box.y + 300, { steps: 10 });
    await page.mouse.up();

    await expect(page.getByTestId("canvas-empty-state")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("9. refresh restores saved content", async ({ page }) => {
    await waitForCanvas(page);
    await drawStroke(page, { x: 180, y: 180 });
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);

    await expect
      .poll(async () => page.getByTestId("save-status").textContent(), {
        timeout: 10_000,
      })
      .toMatch(/Saved/);

    await waitForCanvas(page, { reload: true });
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
  });

  test("10. clear canvas requires confirmation", async ({ page }) => {
    await waitForCanvas(page);
    await drawStroke(page);
    await expect(page.getByTestId("clear-canvas-button")).toBeEnabled();

    await page.getByTestId("clear-canvas-button").click();
    await expect(page.getByTestId("clear-confirm-dialog")).toBeVisible();
    await page.getByTestId("clear-cancel").click();
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);

    await page.getByTestId("clear-canvas-button").click();
    await page.getByTestId("clear-confirm").click();
    await expect(page.getByTestId("canvas-empty-state")).toBeVisible();
  });

  test("11. PNG export creates a non-empty file", async ({ page }) => {
    await waitForCanvas(page);
    await drawStroke(page);

    await page.getByTestId("export-button").click();
    await expect(page.getByTestId("export-preview-dialog")).toBeVisible();
    await expect(page.getByTestId("export-preview-image")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-confirm-download").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/i);

    const downloadPath = path.join(__dirname, ".tmp", "export.png");
    fs.mkdirSync(path.dirname(downloadPath), { recursive: true });
    await download.saveAs(downloadPath);
    const stats = fs.statSync(downloadPath);
    expect(stats.size).toBeGreaterThan(100);
  });

  test("12. invalid image files show an error", async ({ page }) => {
    await waitForCanvas(page);

    await page.getByTestId("image-file-input").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is not an image"),
    });

    await expect(page.getByTestId("image-error")).toBeVisible();
    await expect(page.getByTestId("image-error")).toContainText(
      /Unsupported|JPEG|PNG|WebP/i
    );
  });
});
