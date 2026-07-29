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
import { createStartupBootstrap } from "./startup/StartupBootstrap";
import { StorageDiscovery } from "./startup/StorageDiscovery";
import { selectStorage } from "./startup/StorageSelection";
import { readStoragePreferenceHint } from "./startup/storagePreference";

const rootElement = document.querySelector("#root");

if (!(rootElement instanceof HTMLElement)) {
  throw new Error("Nexora root element is missing");
}

let selectedStorageKind: "opfs" | "indexeddb" | undefined;
const startupBootstrap = createStartupBootstrap(
  new StartupOrchestrator({
    discoverStorage: async () => {
      const discovery = await new StorageDiscovery().inspect();
      const selection = selectStorage(discovery.archives, readStoragePreferenceHint());
      if (selection.kind === "guided-recovery") {
        throw new Error("Nexora requires guided recovery before it can choose an archive safely.");
      }
      selectedStorageKind = selection.storageKind;
    },
    openLedger: () => {
      if (selectedStorageKind === undefined)
        throw new Error("Nexora storage selection is missing.");
      return openPwaLedger({ selectedStorageKind, persistSelection: false });
    },
    timeouts: {
      environment: 5_000,
      storage: 15_000,
      validation: 15_000,
      migration: 30_000,
      verification: 15_000,
    },
  }),
);
const ledgerPromise = startupBootstrap.ledgerPromise.then((ledger) => {
  persistPwaLedgerSelection(ledger.storageKind);
  return ledger;
});

window.addEventListener(
  "pagehide",
  () => {
    void ledgerPromise.then((ledger) => ledger.close()).catch(() => undefined);
  },
  { once: true },
);

createRoot(rootElement).render(
  <StrictMode>
    <App ledgerPromise={ledgerPromise} startupBootstrap={startupBootstrap} />
  </StrictMode>,
);
