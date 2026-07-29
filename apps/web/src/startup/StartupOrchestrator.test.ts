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

  it("classifica errori non noti come bloccanti", () => {
    expect(classifyStartupError(new Error("unexpected"))).toMatchObject({
      code: "NX-START-001",
      kind: "blocking",
    });
  });
});
