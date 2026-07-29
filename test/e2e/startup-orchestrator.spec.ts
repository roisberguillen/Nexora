import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import { createServer } from "vite";

const workspaceRoot = process.cwd();
const webRoot = resolve(workspaceRoot, "apps/web");
const storageSelectionPath = resolve(webRoot, "src/startup/StorageSelection.ts").replaceAll(
  "\\",
  "/",
);
const orchestratorPath = resolve(webRoot, "src/startup/StartupOrchestrator.ts").replaceAll(
  "\\",
  "/",
);
const diagnosticsPath = resolve(webRoot, "src/startup/StartupDiagnostics.ts").replaceAll("\\", "/");

test("l'orchestratore applica in browser la policy sicura per avvio e recupero", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-1440",
    "La policy viene validata una sola volta in Chromium.",
  );

  const server = await createServer({
    root: webRoot,
    configFile: resolve(webRoot, "vite.config.ts"),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0 },
  });
  try {
    await server.listen();
    const applicationUrl = server.resolvedUrls?.local[0];
    if (applicationUrl === undefined) throw new Error("Vite did not expose a local test URL.");
    await page.goto(applicationUrl);
    const result = await page.evaluate(
      async ({ diagnosticsModuleUrl, orchestratorModuleUrl, storageModuleUrl }) => {
        const [
          { selectStorage, retryTransient },
          { StartupOrchestrator },
          { createStartupDiagnostics },
        ] = await Promise.all([
          import(storageModuleUrl),
          import(orchestratorModuleUrl),
          import(diagnosticsModuleUrl),
        ]);
        const checkedAt = "2026-07-29T12:00:00.000Z";
        const archive = (kind: "opfs" | "indexeddb", state: "absent" | "present" | "blocked") => ({
          kind,
          available: state !== "blocked",
          state,
          lastCheckedAt: checkedAt,
        });
        let attempts = 0;
        const retryResult = await retryTransient(
          async () => {
            attempts += 1;
            if (attempts === 1) throw new Error("transient");
            return "ready";
          },
          () => true,
          { initialDelayMs: 0 },
        );
        const migration = new StartupOrchestrator({
          openLedger: async () => ({ storageKind: "indexeddb" }),
          validateLedger: () => undefined,
          runMigrations: () => undefined,
          verifyData: () => undefined,
        });
        const migrationResult = await migration.run();
        const failedMigration = new StartupOrchestrator({
          openLedger: async () => ({ storageKind: "indexeddb" }),
          runMigrations: () => {
            throw new Error("migration failed");
          },
        });
        const diagnostics = createStartupDiagnostics({
          appVersion: "e2e",
          buildId: "e2e",
          archives: [archive("opfs", "absent"), archive("indexeddb", "absent")],
          capabilities: {
            worker: false,
            opfs: false,
            indexedDb: true,
            crossOriginIsolated: false,
            webAssembly: false,
          },
        });
        return {
          firstOpfs: selectStorage([archive("opfs", "absent"), archive("indexeddb", "absent")]),
          firstIndexedDb: selectStorage(
            [archive("opfs", "absent"), archive("indexeddb", "absent")],
            "indexeddb",
          ),
          validOpfsPreference: selectStorage(
            [archive("opfs", "absent"), archive("indexeddb", "absent")],
            "opfs",
          ),
          invalidPreference: selectStorage(
            [archive("opfs", "absent"), archive("indexeddb", "absent")],
            "invalid",
          ),
          multipleArchives: selectStorage([
            archive("opfs", "present"),
            archive("indexeddb", "present"),
          ]),
          blockedArchive: selectStorage([
            archive("opfs", "blocked"),
            archive("indexeddb", "absent"),
          ]),
          corruptArchive: selectStorage([
            { ...archive("opfs", "absent"), state: "corrupt" },
            archive("indexeddb", "absent"),
          ]),
          retryResult,
          attempts,
          migrationState: migrationResult.state,
          failedMigrationState: (await failedMigration.run()).state,
          diagnostics,
        };
      },
      {
        diagnosticsModuleUrl: `${applicationUrl}@fs/${diagnosticsPath}`,
        orchestratorModuleUrl: `${applicationUrl}@fs/${orchestratorPath}`,
        storageModuleUrl: `${applicationUrl}@fs/${storageSelectionPath}`,
      },
    );

    expect(result.firstOpfs).toEqual({ kind: "open", storageKind: "opfs" });
    expect(result.firstIndexedDb).toEqual({ kind: "open", storageKind: "indexeddb" });
    expect(result.validOpfsPreference).toEqual({ kind: "open", storageKind: "opfs" });
    expect(result.invalidPreference).toEqual({ kind: "open", storageKind: "opfs" });
    expect(result.multipleArchives).toEqual({
      kind: "guided-recovery",
      reason: "multiple-data-archives",
    });
    expect(result.blockedArchive).toEqual({ kind: "guided-recovery", reason: "unsafe-state" });
    expect(result.corruptArchive).toEqual({ kind: "guided-recovery", reason: "unsafe-state" });
    expect(result).toMatchObject({
      retryResult: "ready",
      attempts: 2,
      migrationState: "READY",
      failedMigrationState: "BLOCKING_ERROR",
      diagnostics: {
        capabilities: {
          worker: false,
          webAssembly: false,
          crossOriginIsolated: false,
        },
      },
    });
  } finally {
    await server.close();
  }
});
