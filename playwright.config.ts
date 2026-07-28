import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-320",
      use: { browserName: "chromium", viewport: { width: 320, height: 800 } },
    },
    {
      name: "chromium-768",
      use: { browserName: "chromium", viewport: { width: 768, height: 1024 } },
    },
    {
      name: "chromium-1440",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: "pnpm --filter @nexora/web run preview --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
