import { InMemoryLedgerRepository, PersistenceError, type BrowserLedger } from "@nexora/database";
import { describe, expect, it, vi } from "vitest";

import { createStartupBootstrap } from "./StartupBootstrap";
import { StartupModelLoadError, StartupOrchestrator } from "./StartupOrchestrator";

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

  it("conserva la classificazione dell'errore per la diagnostica di recovery", async () => {
    const failure = new PersistenceError("indexeddb_unavailable", "blocked");
    const bootstrap = createStartupBootstrap(
      new StartupOrchestrator({ openLedger: async () => Promise.reject(failure) }),
    );

    await expect(bootstrap.ledgerPromise).rejects.toBe(failure);

    expect(bootstrap.getFailure()).toMatchObject({
      category: "indexeddb-open",
      code: "NX-STORAGE-001",
    });
  });

  it("non consente di persistere una selezione prima della verifica dei modelli", async () => {
    const persistSelection = vi.fn();
    const bootstrap = createStartupBootstrap(
      new StartupOrchestrator({
        openLedger: async () => ledger,
        verifyData: async () => Promise.reject(new StartupModelLoadError(new Error("models"))),
      }),
    );

    await expect(bootstrap.ledgerPromise.then(persistSelection)).rejects.toBeInstanceOf(
      StartupModelLoadError,
    );

    expect(persistSelection).not.toHaveBeenCalled();
  });
});
