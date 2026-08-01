import { InMemoryLedgerRepository, PersistenceError, type BrowserLedger } from "@nexora/database";
import { describe, expect, it, vi } from "vitest";

import {
  StartupModelLoadError,
  StartupOrchestrator,
  classifyStartupError,
} from "./StartupOrchestrator";
import { StartupRecoveryRequiredError } from "./StartupRecovery";

const ledger: BrowserLedger = {
  repository: new InMemoryLedgerRepository(),
  schemaVersion: 11,
  storageKind: "indexeddb",
  close: vi.fn(async () => undefined),
};

describe("StartupOrchestrator", () => {
  it("attraversa gli stati di avvio e non aggiorna preferenze direttamente", async () => {
    const openLedger = vi.fn(async () => ledger);
    const progress: string[] = [];
    const orchestrator = new StartupOrchestrator({
      openLedger,
      now: () => new Date("2026-07-29T12:00:00.000Z"),
    });

    await expect(orchestrator.run((event) => progress.push(event.state))).resolves.toMatchObject({
      state: "READY",
      ledger,
    });
    expect(openLedger).toHaveBeenCalledOnce();
    expect(progress).toEqual([
      "CHECKING_ENVIRONMENT",
      "DISCOVERING_STORAGE",
      "OPENING_EXISTING_STORAGE",
      "VALIDATING_LEDGER",
      "RUNNING_MIGRATIONS",
      "VERIFYING_DATA",
      "READY",
    ]);
  });

  it("classifica un blocco migrazione come recuperabile senza aprire un fallback", async () => {
    const failure = new PersistenceError("upgrade_blocked", "blocked");
    const orchestrator = new StartupOrchestrator({
      openLedger: vi.fn(async () => Promise.reject(failure)),
    });

    await expect(orchestrator.run()).resolves.toMatchObject({
      state: "RECOVERABLE_ERROR",
      failure: { code: "NX-MIGRATION-001", kind: "recoverable", cause: failure },
    });
  });

  it("continua con la verifica quando migrazione e dati sono validi", async () => {
    const validateLedger = vi.fn();
    const runMigrations = vi.fn();
    const verifyData = vi.fn();
    const orchestrator = new StartupOrchestrator({
      openLedger: vi.fn(async () => ledger),
      validateLedger,
      runMigrations,
      verifyData,
    });

    await expect(orchestrator.run()).resolves.toMatchObject({ state: "READY", ledger });
    expect(validateLedger).toHaveBeenCalledWith(ledger);
    expect(runMigrations).toHaveBeenCalledWith(ledger);
    expect(verifyData).toHaveBeenCalledWith(ledger);
  });

  it("distingue indisponibilità di backend e timeout", () => {
    for (const code of [
      "opfs_unavailable",
      "indexeddb_unavailable",
      "native_sqlite_unavailable",
    ] as const) {
      expect(classifyStartupError(new PersistenceError(code, code))).toMatchObject({
        code: "NX-STORAGE-001",
        kind: "recoverable",
      });
    }
    expect(
      classifyStartupError(new PersistenceError("native_sqlite_unavailable", "native unavailable")),
    ).toMatchObject({
      category: "native-sqlite-open",
      detail: { backend: "native-sqlite", phase: "opening" },
    });
    expect(classifyStartupError(new PersistenceError("worker_failed", "timeout"))).toMatchObject({
      category: "timeout",
      code: "NX-TIMEOUT-001",
      kind: "recoverable",
    });
  });

  it("ferma l'avvio se la verifica dei dati segnala un archivio corrotto", async () => {
    const failure = new PersistenceError("corrupt_record", "corrupt");
    const orchestrator = new StartupOrchestrator({
      openLedger: vi.fn(async () => ledger),
      verifyData: vi.fn(async () => Promise.reject(failure)),
    });

    await expect(orchestrator.run()).resolves.toMatchObject({
      state: "RECOVERABLE_ERROR",
      failure: { category: "database-incompatible", code: "NX-DATABASE-001", cause: failure },
    });
    expect(ledger.close).toHaveBeenCalled();
  });

  it("esegue la discovery prima dell'apertura e non avvia due aperture concorrenti", async () => {
    let resolveOpen: ((value: BrowserLedger) => void) | undefined;
    const discoverStorage = vi.fn();
    const openLedger = vi.fn(
      () =>
        new Promise<BrowserLedger>((resolve) => {
          resolveOpen = resolve;
        }),
    );
    const orchestrator = new StartupOrchestrator({ discoverStorage, openLedger });

    const firstRun = orchestrator.run();
    const secondRun = orchestrator.run();
    await vi.waitFor(() => {
      expect(discoverStorage).toHaveBeenCalledOnce();
      expect(openLedger).toHaveBeenCalledOnce();
    });
    resolveOpen?.(ledger);

    await expect(Promise.all([firstRun, secondRun])).resolves.toHaveLength(2);
  });

  it("classifica il timeout dell'apertura come recuperabile", async () => {
    const orchestrator = new StartupOrchestrator({
      openLedger: () => new Promise<BrowserLedger>(() => undefined),
      timeouts: { storage: 1 },
    });

    await expect(orchestrator.run()).resolves.toMatchObject({
      state: "RECOVERABLE_ERROR",
      failure: { category: "timeout", code: "NX-TIMEOUT-001", kind: "recoverable" },
    });
  });

  it("distingue un errore di caricamento modelli dopo l'apertura del ledger", async () => {
    const failure = new StartupModelLoadError(new Error("view model unavailable"));
    const orchestrator = new StartupOrchestrator({
      openLedger: async () => ledger,
      verifyData: async () => Promise.reject(failure),
    });

    await expect(orchestrator.run()).resolves.toMatchObject({
      state: "RECOVERABLE_ERROR",
      failure: { category: "model-loading", code: "NX-MODEL-001", cause: failure },
    });
    expect(ledger.close).toHaveBeenCalled();
  });

  it("non maschera l'errore originale se una fixture senza close fallisce dopo l'apertura", async () => {
    const failure = new PersistenceError("corrupt_record", "corrupt");
    const incompleteLedger = { ...ledger, close: undefined } as unknown as BrowserLedger;
    const orchestrator = new StartupOrchestrator({
      openLedger: async () => incompleteLedger,
      verifyData: async () => Promise.reject(failure),
    });

    await expect(orchestrator.run()).resolves.toMatchObject({
      state: "RECOVERABLE_ERROR",
      failure: { category: "database-incompatible", cause: failure },
    });
  });

  it("classifica errori non noti come bloccanti", () => {
    expect(classifyStartupError(new Error("unexpected"))).toMatchObject({
      code: "NX-START-001",
      kind: "blocking",
    });
  });

  it("classifica la selezione esplicita richiesta quando sono presenti due archivi", async () => {
    const recovery = new StartupRecoveryRequiredError([]);
    const progress: string[] = [];
    const orchestrator = new StartupOrchestrator({
      discoverStorage: async () => Promise.reject(recovery),
      openLedger: async () => ledger,
    });

    await expect(
      orchestrator.run((event) => progress.push(`${event.state}:${event.phase}`)),
    ).resolves.toMatchObject({
      state: "RECOVERABLE_ERROR",
      failure: { category: "guided-recovery", code: "NX-RECOVERY-001", cause: recovery },
    });
    expect(progress.at(-1)).toBe("RECOVERABLE_ERROR:storage");
  });
});
