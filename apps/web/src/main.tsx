import "@vitejs/plugin-react/preamble";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@nexora/ui/styles.css";
import "./page.css";
import "./startup/startup.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App } from "./App";
import {
  PwaUpdateNotice,
  pwaUpdateEventName,
  type PwaUpdateEventDetail,
} from "./pwa/PwaUpdateNotice";
import "./pwa/pwa.css";
import {
  openPwaLedgerWithSafeOpfsFallback,
  persistPwaLedgerSelection,
} from "./persistence/openPwaLedger";
import { StartupOrchestrator } from "./startup/StartupOrchestrator";
import { createStartupBootstrap } from "./startup/StartupBootstrap";
import { StorageDiscovery } from "./startup/StorageDiscovery";
import { selectStorage } from "./startup/StorageSelection";
import { readRecoverySelection, StartupRecoveryRequiredError } from "./startup/StartupRecovery";
import { readStoragePreferenceHint } from "./startup/storagePreference";
import { withStartupLock } from "./startup/StartupLock";
import { renderPreMountError } from "./startup/PreMountError";

const rootElement = document.querySelector("#root");

if (!(rootElement instanceof HTMLElement)) {
  renderPreMountError(null);
  throw new Error("Nexora root element is missing");
}

const applyPwaUpdate = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(
      new CustomEvent<PwaUpdateEventDetail>(pwaUpdateEventName, {
        detail: { applyUpdate: () => applyPwaUpdate(true) },
      }),
    );
  },
});

let selectedStorageKind: "opfs" | "indexeddb" | undefined;
let allowOpfsFallback = false;
const startupBootstrap = createStartupBootstrap(
  new StartupOrchestrator({
    discoverStorage: async () => {
      const discovery = await new StorageDiscovery().inspect();
      const recoverySelection = readRecoverySelection(discovery.archives);
      if (recoverySelection !== undefined) {
        selectedStorageKind = recoverySelection;
        allowOpfsFallback = false;
        return;
      }
      const selection = selectStorage(discovery.archives, readStoragePreferenceHint());
      if (selection.kind === "guided-recovery") {
        throw new StartupRecoveryRequiredError(discovery.archives);
      }
      selectedStorageKind = selection.storageKind;
      allowOpfsFallback =
        selection.storageKind === "opfs" &&
        discovery.archives.some((archive) => archive.kind === "opfs" && archive.state === "absent");
    },
    openLedger: () => {
      if (selectedStorageKind === undefined)
        throw new Error("Nexora storage selection is missing.");
      const storageKind = selectedStorageKind;
      return withStartupLock(() =>
        openPwaLedgerWithSafeOpfsFallback({
          allowOpfsFallback,
          persistSelection: false,
          selectedStorageKind: storageKind,
        }),
      );
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

try {
  createRoot(rootElement).render(
    <StrictMode>
      <PwaUpdateNotice />
      <App ledgerPromise={ledgerPromise} startupBootstrap={startupBootstrap} />
    </StrictMode>,
  );
} catch (error) {
  console.error(
    "[Nexora startup] React mount failed.",
    error instanceof Error ? error.name : "UnknownError",
  );
  renderPreMountError(rootElement);
}
