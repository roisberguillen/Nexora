import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import { createServer } from "vite";

const workspaceRoot = process.cwd();
const webRoot = resolve(workspaceRoot, "apps/web");
const fixturePath = resolve(workspaceRoot, "test/e2e/fixtures/indexeddb-smoke.ts").replaceAll(
  "\\",
  "/",
);

test("IndexedDB conserva i dati dopo la riapertura", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-1440",
    "Lo smoke IndexedDB viene eseguito una sola volta.",
  );

  const server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, "vite.config.ts"),
    logLevel: "silent",
    server: {
      host: "127.0.0.1",
      port: 0,
    },
  });

  try {
    await server.listen();
    const applicationUrl = server.resolvedUrls?.local[0];
    if (applicationUrl === undefined) {
      throw new Error("Vite did not expose a local test URL.");
    }

    await page.goto(applicationUrl);
    const result = await page.evaluate(
      async ({ moduleUrl, databaseName }) => {
        const smokeModule = (await import(moduleUrl)) as {
          runIndexedDbSmokeTest(name: string): Promise<{
            amountMinor: string;
            firstSchemaVersion: number;
            reopenedSchemaVersion: number;
            storageKind: string;
          }>;
        };
        return smokeModule.runIndexedDbSmokeTest(databaseName);
      },
      {
        moduleUrl: `${applicationUrl}@fs/${fixturePath}`,
        databaseName: `nexora-e2e-${crypto.randomUUID()}`,
      },
    );

    expect(result).toEqual({
      amountMinor: "900719925474099312345678901234567890",
      firstSchemaVersion: 11,
      reopenedSchemaVersion: 11,
      storageKind: "indexeddb",
    });
  } finally {
    await server.close();
  }
});
