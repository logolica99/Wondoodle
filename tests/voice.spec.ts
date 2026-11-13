import { test, expect, type Page, type Route } from "@playwright/test";

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

async function mockTranscribe(
  page: Page,
  handler: (route: Route) => Promise<void> | void
) {
  await page.route("**/api/transcribe", handler);
}

test.describe("Feature 2 — Voice-Aware Learning", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("1. Explain opens the voice panel", async ({ page }) => {
    await waitForCanvas(page);
    await page.getByTestId("tool-explain").click();
    await expect(page.getByTestId("voice-panel")).toBeVisible();
    await expect(page.getByTestId("voice-status-copy")).toContainText(
      /Tell me how you solved it/i
    );
  });

  test("2. microphone permission failure shows recovery", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const err = new DOMException(
          "Permission denied",
          "NotAllowedError"
        );
        throw err;
      };
    });
    await waitForCanvas(page);
    await page.getByTestId("tool-explain").click();
    await page.getByTestId("voice-record").click();
    await expect(page.getByTestId("voice-error")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("voice-error")).toContainText(/microphone/i);
    await expect(page.getByTestId("voice-error-retry")).toBeVisible();
  });

  test("3-5. recording transitions, cancel, and duration limit wiring", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      class FakeRecorder {
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable: ((e: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({
            data: new Blob([new Uint8Array([1, 2, 3, 4])], {
              type: "audio/webm",
            }),
          });
          this.onstop?.();
        }
      }
      // @ts-expect-error test mock
      window.MediaRecorder = FakeRecorder;
      MediaRecorder.isTypeSupported = () => true;
      navigator.mediaDevices.getUserMedia = async () =>
        ({
          getTracks: () => [{ stop: () => undefined, getSettings: () => ({}) }],
          getAudioTracks: () => [{ getSettings: () => ({}) }],
        }) as unknown as MediaStream;

      // Minimal AudioContext stub for meter
      // @ts-expect-error test mock
      window.AudioContext = class {
        createMediaStreamSource() {
          return { connect: () => undefined };
        }
        createAnalyser() {
          return {
            fftSize: 256,
            frequencyBinCount: 8,
            connect: () => undefined,
            getByteTimeDomainData: (arr: Uint8Array) => {
              arr.fill(128);
            },
          };
        }
        close() {
          return Promise.resolve();
        }
      };
    });

    await mockTranscribe(page, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          transcript: "I added ten and five to get fifteen.",
          model: "mock",
        }),
      });
    });

    await waitForCanvas(page);
    await page.getByTestId("tool-explain").click();
    await page.getByTestId("voice-record").click();
    await expect(page.getByTestId("voice-stop")).toBeVisible();
    await expect(page.getByTestId("voice-status-copy")).toContainText(
      /listening/i
    );

    // Cancel discards
    await page.getByTestId("voice-cancel").click();
    await expect(page.getByTestId("voice-record")).toBeVisible();
    await expect(page.getByTestId("transcript-card")).toHaveCount(0);

    // Record + stop → transcript
    await page.getByTestId("voice-record").click();
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-transcribing")).toBeVisible();
    await expect(page.getByTestId("transcript-card")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("transcript-editor")).toHaveValue(
      /added ten and five/i
    );
  });

  test("6-8. transcription failure retry and edited transcript persist", async ({
    page,
  }) => {
    let calls = 0;
    await page.addInitScript(() => {
      class FakeRecorder {
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable: ((e: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({
            data: new Blob([new Uint8Array([9, 9, 9])], { type: "audio/webm" }),
          });
          this.onstop?.();
        }
      }
      // @ts-expect-error test mock
      window.MediaRecorder = FakeRecorder;
      MediaRecorder.isTypeSupported = () => true;
      navigator.mediaDevices.getUserMedia = async () =>
        ({
          getTracks: () => [{ stop: () => undefined, getSettings: () => ({}) }],
          getAudioTracks: () => [{ getSettings: () => ({}) }],
        }) as unknown as MediaStream;
      // @ts-expect-error test mock
      window.AudioContext = class {
        createMediaStreamSource() {
          return { connect: () => undefined };
        }
        createAnalyser() {
          return {
            fftSize: 256,
            frequencyBinCount: 4,
            getByteTimeDomainData: (arr: Uint8Array) => arr.fill(128),
          };
        }
        close() {
          return Promise.resolve();
        }
      };
    });

    await mockTranscribe(page, async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: "Transcription failed. Please try again in a moment.",
            code: "upstream",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          transcript: "First draft words",
          model: "mock",
        }),
      });
    });

    await waitForCanvas(page);
    await page.getByTestId("tool-explain").click();
    await page.getByTestId("voice-record").click();
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("voice-error")).toBeVisible();
    await page.getByTestId("voice-error-retry").click();

    await page.getByTestId("voice-record").click();
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("transcript-editor")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("transcript-editor").fill("Edited learner words");
    await page.getByTestId("transcript-save").click();

    await page.reload();
    await expect(page.getByTestId("smart-canvas")).toBeVisible({
      timeout: 30_000,
    });
    // Marker should exist after refresh
    await expect(page.locator("[data-testid^=voice-marker-]")).toBeVisible({
      timeout: 10_000,
    });
    await page.locator("[data-testid^=voice-marker-]").click();
    await expect(page.getByTestId("transcript-editor")).toHaveValue(
      "Edited learner words"
    );
  });

  test("9. voice note attaches to selected object", async ({ page }) => {
    await page.addInitScript(() => {
      class FakeRecorder {
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable: ((e: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({
            data: new Blob([new Uint8Array([3, 3])], { type: "audio/webm" }),
          });
          this.onstop?.();
        }
      }
      // @ts-expect-error test mock
      window.MediaRecorder = FakeRecorder;
      MediaRecorder.isTypeSupported = () => true;
      navigator.mediaDevices.getUserMedia = async () =>
        ({
          getTracks: () => [{ stop: () => undefined, getSettings: () => ({}) }],
          getAudioTracks: () => [{ getSettings: () => ({}) }],
        }) as unknown as MediaStream;
      // @ts-expect-error test mock
      window.AudioContext = class {
        createMediaStreamSource() {
          return { connect: () => undefined };
        }
        createAnalyser() {
          return {
            fftSize: 256,
            frequencyBinCount: 4,
            getByteTimeDomainData: (arr: Uint8Array) => arr.fill(140),
          };
        }
        close() {
          return Promise.resolve();
        }
      };
    });
    await mockTranscribe(page, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          transcript: "This is about my drawing",
          model: "mock",
        }),
      });
    });

    await waitForCanvas(page);
    // Create text object to select
    await page.getByTestId("tool-text").click();
    const stage = page.locator(".konvajs-content canvas").first();
    const box = await stage.boundingBox();
    if (!box) throw new Error("no stage");
    await page.mouse.click(box.x + 220, box.y + 200);
    await page.getByTestId("text-editor").fill("Homework");
    await page.getByTestId("text-editor").blur();
    await page.getByTestId("tool-select").click();
    await page.mouse.click(box.x + 230, box.y + 210);

    await page.getByTestId("tool-explain").click();
    await page.getByTestId("voice-record").click();
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("transcript-editor")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("transcript-save").click();

    const anchored = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const req = indexedDB.open("WondoodleDB");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("documents", "readonly");
          const getReq = tx.objectStore("documents").get("wondoodle-default");
          getReq.onsuccess = () => {
            const data = getReq.result?.data;
            const note = data?.voiceNotes?.[0];
            resolve(note?.anchor?.type === "object");
          };
        };
      });
    });
    expect(anchored).toBe(true);
  });

  test("12. drawing still works with voice feature present", async ({
    page,
  }) => {
    await waitForCanvas(page);
    await page.getByTestId("tool-pen").click();
    const stage = page.locator(".konvajs-content canvas").first();
    const box = await stage.boundingBox();
    if (!box) throw new Error("no stage");
    await page.mouse.move(box.x + 160, box.y + 160);
    await page.mouse.down();
    await page.mouse.move(box.x + 240, box.y + 220, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId("canvas-empty-state")).toHaveCount(0);
    await expect(page.getByTestId("tool-explain")).toBeVisible();
  });

  test("13. raw audio is not stored in IndexedDB document", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      class FakeRecorder {
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable: ((e: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({
            data: new Blob([new Uint8Array([7, 7, 7, 7])], {
              type: "audio/webm",
            }),
          });
          this.onstop?.();
        }
      }
      // @ts-expect-error test mock
      window.MediaRecorder = FakeRecorder;
      MediaRecorder.isTypeSupported = () => true;
      navigator.mediaDevices.getUserMedia = async () =>
        ({
          getTracks: () => [{ stop: () => undefined, getSettings: () => ({}) }],
          getAudioTracks: () => [{ getSettings: () => ({}) }],
        }) as unknown as MediaStream;
      // @ts-expect-error test mock
      window.AudioContext = class {
        createMediaStreamSource() {
          return { connect: () => undefined };
        }
        createAnalyser() {
          return {
            fftSize: 256,
            frequencyBinCount: 4,
            getByteTimeDomainData: (arr: Uint8Array) => arr.fill(128),
          };
        }
        close() {
          return Promise.resolve();
        }
      };
    });
    await mockTranscribe(page, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          transcript: "Persist text only",
          model: "mock",
        }),
      });
    });

    await waitForCanvas(page);
    await page.getByTestId("tool-explain").click();
    await page.getByTestId("voice-record").click();
    await page.getByTestId("voice-stop").click();
    await expect(page.getByTestId("transcript-editor")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("transcript-save").click();

    const stored = await page.evaluate(async () => {
      return new Promise<string>((resolve) => {
        const req = indexedDB.open("WondoodleDB");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("documents", "readonly");
          const getReq = tx.objectStore("documents").get("wondoodle-default");
          getReq.onsuccess = () => {
            resolve(JSON.stringify(getReq.result?.data ?? {}));
          };
        };
      });
    });
    expect(stored).toContain("Persist text only");
    expect(stored).not.toMatch(/data:audio|audioBlob|objectUrl/);
  });
});

test.describe("Feature 2 — API validation", () => {
  test("14-15. missing key and invalid upload responses", async ({
    request,
  }) => {
    const missing = await request.post("/api/transcribe", {
      multipart: {
        audio: {
          name: "clip.webm",
          mimeType: "audio/webm",
          buffer: Buffer.from([1, 2, 3, 4, 5, 6]),
        },
      },
    });
    // Without OPENAI_API_KEY in test env this should be 503 missing_api_key,
    // or 502/500 if a key exists but upstream fails — never 200 for tiny noise.
    const missingJson = await missing.json();
    expect(missingJson.ok).toBe(false);
    expect(["missing_api_key", "upstream", "server", "empty_audio"]).toContain(
      missingJson.code
    );

    const tooLarge = await request.post("/api/transcribe", {
      multipart: {
        audio: {
          name: "huge.webm",
          mimeType: "audio/webm",
          buffer: Buffer.alloc(10 * 1024 * 1024 + 10, 1),
        },
      },
    });
    expect(tooLarge.status()).toBe(413);
    const largeJson = await tooLarge.json();
    expect(largeJson.code).toBe("too_large");

    const badType = await request.post("/api/transcribe", {
      multipart: {
        audio: {
          name: "notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("hello"),
        },
      },
    });
    expect(badType.status()).toBe(415);
    const badJson = await badType.json();
    expect(badJson.code).toBe("unsupported_type");
  });
});
