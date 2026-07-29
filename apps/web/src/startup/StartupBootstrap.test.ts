import { InMemoryLedgerRepository, type BrowserLedger } from "@nexora/database";
import { describe, expect, it, vi } from "vitest";

import { createStartupBootstrap } from "./StartupBootstrap";
import { StartupOrchestrator } from "./StartupOrchestrator";

const ledger: BrowserLedger = {
  repository: new InMemoryLedgerRepository(),
  schemaVersion: 11,
  storageKind: "indexeddb",
  close: vi.fn(async () => undefined),
};

describe("createStartupBootstrap", () => {
  it("espone alla UI il progresso emesso dall'orchestratore", async () => {
    const bootstrap = createStartupBootstrap(
      new StartupOrchestrator({ openLedger: async () => ledger }),
    );
    const states: string[] = [];
    const unsubscribe = bootstrap.subscribe((event) => states.push(event.state));

    await expect(bootstrap.ledgerPromise).resolves.toBe(ledger);
    unsubscribe();

    expect(bootstrap.getProgress()).toMatchObject({ state: "READY", phase: "ready" });
    expect(states).toContain("READY");
  });
});
