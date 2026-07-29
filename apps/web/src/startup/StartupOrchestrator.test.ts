import { InMemoryLedgerRepository, PersistenceError, type BrowserLedger } from "@nexora/database";
import { describe, expect, it, vi } from "vitest";

import { StartupOrchestrator, classifyStartupError } from "./StartupOrchestrator";

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

  it("interrompe in modo recuperabile se il worker o il backend non sono disponibili", () => {
    for (const code of ["worker_failed", "opfs_unavailable", "indexeddb_unavailable"] as const) {
      expect(classifyStartupError(new PersistenceError(code, code))).toMatchObject({
        code: "NX-STORAGE-001",
        kind: "recoverable",
      });
    }
  });

  it("ferma l'avvio se la verifica dei dati segnala un archivio corrotto", async () => {
    const failure = new PersistenceError("corrupt_record", "corrupt");
    const orchestrator = new StartupOrchestrator({
      openLedger: vi.fn(async () => ledger),
      verifyData: vi.fn(async () => Promise.reject(failure)),
    });

    await expect(orchestrator.run()).resolves.toMatchObject({
      state: "BLOCKING_ERROR",
      failure: { code: "NX-START-001", kind: "blocking", cause: failure },
    });
  });

  it("classifica errori non noti come bloccanti", () => {
    expect(classifyStartupError(new Error("unexpected"))).toMatchObject({
      code: "NX-START-001",
      kind: "blocking",
    });
  });
});
