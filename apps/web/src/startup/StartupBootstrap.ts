import type { BrowserLedger } from "@nexora/database";

import { StartupOrchestrator, type StartupProgressEvent } from "./StartupOrchestrator";

export interface StartupBootstrap {
  readonly ledgerPromise: Promise<BrowserLedger>;
  getProgress(): StartupProgressEvent | undefined;
  subscribe(listener: (event: StartupProgressEvent) => void): () => void;
}

export function createStartupBootstrap(orchestrator: StartupOrchestrator): StartupBootstrap {
  let progress: StartupProgressEvent | undefined;
  const listeners = new Set<(event: StartupProgressEvent) => void>();
  const ledgerPromise = orchestrator
    .run((event) => {
      progress = event;
      for (const listener of listeners) listener(event);
    })
    .then((result) => {
      if (result.ledger !== undefined) return result.ledger;
      throw result.failure?.cause ?? new Error("Nexora startup did not return a ledger.");
    });

  return {
    ledgerPromise,
    getProgress: () => progress,
    subscribe(listener) {
      listeners.add(listener);
      if (progress !== undefined) listener(progress);
      return () => listeners.delete(listener);
    },
  };
}
