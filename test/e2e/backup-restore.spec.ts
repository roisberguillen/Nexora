import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import { createServer } from "vite";

const workspaceRoot = process.cwd();
const webRoot = resolve(workspaceRoot, "apps/web");
const fixturePath = resolve(workspaceRoot, "test/e2e/fixtures/backup-restore-smoke.ts").replaceAll(
  "\\",
  "/",
);

test("backup cifrato e restore SQLite funzionano su OPFS reale", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-1440",
    "Lo smoke backup/restore viene eseguito una sola volta.",
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
      async ({ moduleUrl, filename, backupDirectoryName }) => {
        const smokeModule = (await import(moduleUrl)) as {
          runBackupRestoreSmokeTest(options: {
            filename: string;
            backupDirectoryName: string;
          }): Promise<{
            archiveChecksumLength: number;
            failedRestorePreservedData: boolean;
            restoredAmountMinor: string;
            laterAccountRemoved: boolean;
            reopenedSchemaVersion: number;
          }>;
        };
        return smokeModule.runBackupRestoreSmokeTest({
          filename,
          backupDirectoryName,
        });
      },
      {
        moduleUrl: `${applicationUrl}@fs/${fixturePath}`,
        filename: `/nexora-backup-e2e-${crypto.randomUUID()}/ledger.sqlite3`,
        backupDirectoryName: `nexora-backup-store-${crypto.randomUUID()}`,
      },
    );

    expect(result).toEqual({
      archiveChecksumLength: 64,
      failedRestorePreservedData: true,
      restoredAmountMinor: "900719925474099312345678901234567890",
      laterAccountRemoved: true,
      reopenedSchemaVersion: 5,
    });
  } finally {
    await server.close();
  }
});
