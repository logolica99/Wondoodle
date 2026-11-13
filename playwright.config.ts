import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use Playwright's bundled Chromium by default.
        // System Chrome (`channel: "chrome"`) can crash repeatedly on macOS
        // when launched headless from automation — only opt in via PLAYWRIGHT_CHANNEL.
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
        launchOptions: {
          args: ["--disable-dev-shm-usage"],
        },
      },
    },
  ],
  webServer: {
    command: "npx next dev -H 127.0.0.1 -p 3000",
    url: "http://127.0.0.1:3000/learn",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
