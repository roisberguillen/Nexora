import { defineConfig } from "@playwright/test";

const e2ePort = Number(process.env.NEXORA_E2E_PORT ?? "4173");
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  expect: {
    timeout: 15_000,
  },
  projects: [
    {
      name: "chromium-320",
      use: { browserName: "chromium", viewport: { width: 320, height: 800 } },
    },
    {
      name: "chromium-375",
      use: { browserName: "chromium", viewport: { width: 375, height: 812 } },
    },
    {
      name: "chromium-768",
      use: { browserName: "chromium", viewport: { width: 768, height: 1024 } },
    },
    {
      name: "chromium-1024",
      use: { browserName: "chromium", viewport: { width: 1024, height: 900 } },
    },
    {
      name: "chromium-1440",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: `pnpm --filter @nexora/web run preview --host 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
