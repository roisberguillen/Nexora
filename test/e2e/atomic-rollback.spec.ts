import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import { createServer } from "vite";

const workspaceRoot = process.cwd();
const webRoot = resolve(workspaceRoot, "apps/web");
const fixturePath = resolve(workspaceRoot, "test/e2e/fixtures/atomic-rollback.ts").replaceAll(
  "\\",
  "/",
);

test("un errore atomico non persiste record parziali su IndexedDB e OPFS", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-1440",
    "Eseguito una volta sui backend browser reali.",
  );
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
    const results = await page.evaluate(
      async ({ moduleUrl, id }) => {
        const module = (await import(moduleUrl)) as {
          verifyAtomicRollback(
            backend: "indexeddb" | "opfs",
            location: string,
          ): Promise<{ persistedAccount: boolean }>;
        };
        return Promise.all([
          module.verifyAtomicRollback("indexeddb", `nexora-rollback-${id}`),
          module.verifyAtomicRollback("opfs", `/nexora-rollback-${id}/ledger.sqlite3`),
        ]);
      },
      { moduleUrl: `${applicationUrl}@fs/${fixturePath}`, id: crypto.randomUUID() },
    );
    expect(results).toEqual([{ persistedAccount: false }, { persistedAccount: false }]);
  } finally {
    await server.close();
  }
});
