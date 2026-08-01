import type { BrowserLedger } from "@nexora/database";

import {
  StartupOrchestrator,
  type StartupFailure,
  type StartupProgressEvent,
} from "./StartupOrchestrator";

export interface StartupBootstrap {
  readonly ledgerPromise: Promise<BrowserLedger>;
  getFailure(): StartupFailure | undefined;
  getProgress(): StartupProgressEvent | undefined;
  subscribe(listener: (event: StartupProgressEvent) => void): () => void;
}

export function createStartupBootstrap(orchestrator: StartupOrchestrator): StartupBootstrap {
  let progress: StartupProgressEvent | undefined;
  let failure: StartupFailure | undefined;
  const listeners = new Set<(event: StartupProgressEvent) => void>();
  const ledgerPromise = orchestrator
    .run((event) => {
      progress = event;
      for (const listener of listeners) listener(event);
    })
    .then((result) => {
      if (result.ledger !== undefined) return result.ledger;
      failure = result.failure;
      throw failure?.cause ?? new Error("Nexora startup did not return a ledger.");
    });

  return {
    ledgerPromise,
    getFailure: () => failure,
    getProgress: () => progress,
    subscribe(listener) {
      listeners.add(listener);
      if (progress !== undefined) listener(progress);
      return () => listeners.delete(listener);
    },
  };
}
