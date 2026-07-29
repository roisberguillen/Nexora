import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@nexora/ui/styles.css";
import "./page.css";
import "./startup/startup.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { openPwaLedger, persistPwaLedgerSelection } from "./persistence/openPwaLedger";
import { StartupOrchestrator } from "./startup/StartupOrchestrator";
import { StorageDiscovery } from "./startup/StorageDiscovery";
import { selectStorage } from "./startup/StorageSelection";

const rootElement = document.querySelector("#root");

if (!(rootElement instanceof HTMLElement)) {
  throw new Error("Nexora root element is missing");
}

const ledgerPromise = (async () => {
  const discovery = await new StorageDiscovery().inspect();
  const selection = selectStorage(discovery.archives, readStoragePreferenceHint());
  if (selection.kind === "guided-recovery") {
    throw new Error("Nexora requires guided recovery before it can choose an archive safely.");
  }
  const startupOrchestrator = new StartupOrchestrator({
    openLedger: () =>
      openPwaLedger({ selectedStorageKind: selection.storageKind, persistSelection: false }),
  });
  const result = await startupOrchestrator.run();
  if (result.ledger !== undefined) {
    persistPwaLedgerSelection(result.ledger.storageKind);
    return result.ledger;
  }
  throw result.failure?.cause ?? new Error("Nexora startup did not return a ledger.");
})();

function readStoragePreferenceHint(): "opfs" | "indexeddb" | undefined {
  try {
    const value = globalThis.localStorage?.getItem("nexora.ledger-storage.v1");
    return value === "opfs" || value === "indexeddb" ? value : undefined;
  } catch {
    return undefined;
  }
}

window.addEventListener(
  "pagehide",
  () => {
    void ledgerPromise.then((ledger) => ledger.close()).catch(() => undefined);
  },
  { once: true },
);

createRoot(rootElement).render(
  <StrictMode>
    <App ledgerPromise={ledgerPromise} />
  </StrictMode>,
);
