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

async function installRealtimeMocks(
  page: Page,
  options?: { failSession?: boolean; denyMic?: boolean }
) {
  await page.route("**/api/realtime/session", async (route) => {
    if (options?.failSession) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "Realtime voice isn't configured yet (missing API key).",
          code: "missing_api_key",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        clientSecret: "ek_test_secret",
        expiresAt: Date.now() + 600_000,
        model: "gpt-realtime",
      }),
    });
  });

  await page.route("https://api.openai.com/v1/realtime/calls", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/sdp",
      body: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n",
    });
  });

  await page.addInitScript(
    ({ denyMic }) => {
      const audioTrack = {
        kind: "audio",
        enabled: true,
        stop: () => {
          (window as unknown as { __pipTrackStopped?: boolean }).__pipTrackStopped =
            true;
        },
        getSettings: () => ({}),
      };

      navigator.mediaDevices.getUserMedia = async () => {
        if (denyMic) {
          throw new DOMException("Permission denied", "NotAllowedError");
        }
        return {
          getTracks: () => [audioTrack],
          getAudioTracks: () => [audioTrack],
        } as unknown as MediaStream;
      };

      class FakeDataChannel extends EventTarget {
        readyState = "connecting";
        label = "oai-events";
        sent: string[] = [];
        send(data: string) {
          this.sent.push(data);
          (
            window as unknown as { __pipDcSent?: string[] }
          ).__pipDcSent = this.sent;
        }
        close() {
          this.readyState = "closed";
        }
        openNow() {
          this.readyState = "open";
          this.dispatchEvent(new Event("open"));
        }
      }

      class FakeRTCPeerConnection extends EventTarget {
        connectionState = "connected";
        ontrack: ((e: { streams: MediaStream[] }) => void) | null = null;
        private channel: FakeDataChannel | null = null;
        createDataChannel() {
          this.channel = new FakeDataChannel();
          (
            window as unknown as { __pipDc?: FakeDataChannel }
          ).__pipDc = this.channel;
          return this.channel;
        }
        addTrack() {
          return {};
        }
        getSenders() {
          return [{ track: audioTrack }];
        }
        async createOffer() {
          return { type: "offer", sdp: "v=0\r\n" };
        }
        async setLocalDescription() {
          return;
        }
        async setRemoteDescription() {
          queueMicrotask(() => {
            this.channel?.openNow();
          });
        }
        close() {
          this.connectionState = "closed";
          this.channel?.close();
        }
      }

      (
        window as unknown as { RTCPeerConnection: typeof FakeRTCPeerConnection }
      ).RTCPeerConnection = FakeRTCPeerConnection;

      class FakeAudioContext {
        createMediaStreamSource() {
          return { connect: () => undefined };
        }
        createAnalyser() {
          return {
            fftSize: 256,
            frequencyBinCount: 8,
            getByteTimeDomainData: (arr: Uint8Array) => {
              arr.fill(128);
            },
          };
        }
        close() {
          return Promise.resolve();
        }
      }
      (window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext =
        FakeAudioContext;
    },
    { denyMic: Boolean(options?.denyMic) }
  );
}

async function openCompanion(page: Page) {
  await page.getByTestId("tool-talk-pip").click();
  await expect(page.getByTestId("pip-companion")).toBeVisible();
}

async function connectSession(page: Page) {
  await openCompanion(page);
  await page.getByTestId("pip-talk-button").click();
  await expect(page.getByTestId("pip-session-controls")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId("pip-mic-indicator")).toBeVisible();
}

test.describe("Feature 2 — Live Voice Companion (Pip)", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("voice panel opens from Talk to Pip", async ({ page }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);
    await openCompanion(page);
    await expect(page.getByTestId("pip-talk-button")).toBeVisible();
    await expect(page.getByTestId("pip-connection-status")).toContainText(
      /Ready when you are/i
    );
  });

  test("session connects successfully with mocked responses", async ({
    page,
  }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);
    await connectSession(page);
    await expect(page.getByTestId("pip-connection-status")).toContainText(
      /Connected|Listening|talking|say something/i
    );
  });

  test("missing microphone permission is handled", async ({ page }) => {
    await installRealtimeMocks(page, { denyMic: true });
    await waitForCanvas(page);
    await openCompanion(page);
    await page.getByTestId("pip-talk-button").click();
    await expect(page.getByTestId("pip-error")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("pip-error")).toContainText(/microphone/i);
    await expect(page.getByTestId("pip-retry")).toBeVisible();
  });

  test("listening and speaking states update from server events", async ({
    page,
  }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);
    await connectSession(page);

    await page.evaluate(() => {
      const dc = (window as unknown as { __pipDc?: EventTarget }).__pipDc;
      dc?.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "input_audio_buffer.speech_started" }),
        })
      );
    });
    await expect(page.getByTestId("pip-voice-orb")).toHaveAttribute(
      "data-state",
      "listening"
    );
    await expect(page.getByTestId("pip-connection-status")).toContainText(
      /Listening/i
    );

    await page.evaluate(() => {
      const dc = (window as unknown as { __pipDc?: EventTarget }).__pipDc;
      dc?.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "response.created" }),
        })
      );
    });
    await expect(page.getByTestId("pip-voice-orb")).toHaveAttribute(
      "data-state",
      "speaking"
    );
  });

  test("mute works", async ({ page }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);
    await connectSession(page);
    await page.getByTestId("pip-mute").click();
    await expect(page.getByTestId("pip-mute")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("pip-connection-status")).toContainText(
      /muted/i
    );
    await page.getByTestId("pip-mute").click();
    await expect(page.getByTestId("pip-mute")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  test("interruptions cancel active playback", async ({ page }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);
    await connectSession(page);

    await page.evaluate(() => {
      const dc = (window as unknown as { __pipDc?: EventTarget }).__pipDc;
      dc?.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({ type: "response.created" }),
        })
      );
    });
    await expect(page.getByTestId("pip-interrupt")).toBeEnabled();
    await page.getByTestId("pip-interrupt").click();
    await expect(page.getByTestId("pip-voice-orb")).toHaveAttribute(
      "data-state",
      "idle"
    );
    const sent = await page.evaluate(() => {
      return (window as unknown as { __pipDcSent?: string[] }).__pipDcSent ?? [];
    });
    expect(sent.some((s) => s.includes("response.cancel"))).toBeTruthy();
  });

  test("end conversation disconnects the microphone", async ({ page }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);
    await connectSession(page);
    await page.getByTestId("pip-end").click();
    await expect(page.getByTestId("pip-companion")).toHaveCount(0);
    const stopped = await page.evaluate(
      () =>
        Boolean(
          (window as unknown as { __pipTrackStopped?: boolean }).__pipTrackStopped
        )
    );
    expect(stopped).toBeTruthy();
  });

  test("empty canvas share is handled", async ({ page }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);
    await connectSession(page);
    await page.getByTestId("pip-share-canvas").click();
    await expect(page.getByTestId("pip-share-message")).toContainText(
      /empty/i
    );
  });

  test("canvas snapshot can be sent when drawing exists", async ({ page }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);

    await page.getByTestId("tool-pen").click();
    const canvas = page.getByTestId("smart-canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    await page.mouse.move(box.x + 120, box.y + 140);
    await page.mouse.down();
    await page.mouse.move(box.x + 180, box.y + 190);
    await page.mouse.up();

    await connectSession(page);
    await page.getByTestId("pip-share-canvas").click();
    await expect(page.getByTestId("pip-share-message")).toContainText(
      /Shared|looking/i,
      { timeout: 15_000 }
    );
    const sent = await page.evaluate(() => {
      return (window as unknown as { __pipDcSent?: string[] }).__pipDcSent ?? [];
    });
    expect(
      sent.some(
        (s) => s.includes("input_image") || s.includes("conversation.item.create")
      )
    ).toBeTruthy();
  });

  test("connection failure permits retry", async ({ page }) => {
    await installRealtimeMocks(page, { failSession: true });
    await waitForCanvas(page);
    await openCompanion(page);
    await page.getByTestId("pip-talk-button").click();
    await expect(page.getByTestId("pip-error")).toBeVisible();
    await expect(page.getByTestId("pip-retry")).toBeVisible();

    await page.unroute("**/api/realtime/session");
    await page.route("**/api/realtime/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          clientSecret: "ek_test_secret",
          expiresAt: Date.now() + 600_000,
          model: "gpt-realtime",
        }),
      });
    });

    await page.getByTestId("pip-retry").click();
    await expect(page.getByTestId("pip-session-controls")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("drawing remains operational throughout the session", async ({
    page,
  }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);
    await connectSession(page);

    await page.getByTestId("tool-pen").click();
    await expect(page.getByTestId("tool-pen")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const canvas = page.getByTestId("smart-canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    await page.mouse.move(box.x + 90, box.y + 110);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 160);
    await page.mouse.up();

    await expect(page.getByTestId("pip-companion")).toBeVisible();
    await expect(page.getByTestId("pip-session-controls")).toBeVisible();
  });

  test("minimize companion panel works", async ({ page }) => {
    await installRealtimeMocks(page);
    await waitForCanvas(page);
    await openCompanion(page);
    await page.getByTestId("pip-companion-minimize").click();
    await expect(page.getByTestId("pip-companion-minimized")).toBeVisible();
    await page.getByTestId("pip-companion-expand").click();
    await expect(page.getByTestId("pip-companion")).toBeVisible();
  });
});
