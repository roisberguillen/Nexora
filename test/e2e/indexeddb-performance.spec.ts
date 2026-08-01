import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import { createServer } from "vite";

const workspaceRoot = process.cwd();
const webRoot = resolve(workspaceRoot, "apps/web");
const fixturePath = resolve(workspaceRoot, "test/e2e/fixtures/indexeddb-performance.ts").replaceAll(
  "\\",
  "/",
);

test("IndexedDB reale conserva e legge 100.000 movimenti sintetici", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440", "Eseguito una volta sul backend reale.");
  test.setTimeout(180_000);

  const server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, "vite.config.ts"),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });

  try {
    await server.listen();
    const applicationUrl = server.resolvedUrls?.local[0];
    if (applicationUrl === undefined) throw new Error("Vite did not expose a local test URL.");

    await page.goto(applicationUrl);
    const result = await page.evaluate(
      async ({ moduleUrl, databaseName }) => {
        const performanceModule = (await import(moduleUrl)) as {
          runIndexedDbPerformanceTest(name: string): Promise<{
            insertedRecords: number;
            listedRecords: number;
            openMs: number;
            insertMs: number;
            reopenMs: number;
            listMs: number;
          }>;
        };
        return performanceModule.runIndexedDbPerformanceTest(databaseName);
      },
      {
        moduleUrl: `${applicationUrl}@fs/${fixturePath}`,
        databaseName: `nexora-performance-${crypto.randomUUID()}`,
      },
    );

    expect(result).toMatchObject({ insertedRecords: 100_000, listedRecords: 100_000 });
    expect(result.openMs).toBeGreaterThanOrEqual(0);
    expect(result.insertMs).toBeGreaterThanOrEqual(0);
    expect(result.reopenMs).toBeGreaterThanOrEqual(0);
    expect(result.listMs).toBeGreaterThanOrEqual(0);
    console.info(`NEXORA_INDEXEDDB_100K ${JSON.stringify(result)}`);
  } finally {
    await server.close();
  }
});
