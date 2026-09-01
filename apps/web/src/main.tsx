import "@vitejs/plugin-react/preamble";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@nexora/ui/styles.css";
import "./page.css";
import "./startup/startup.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import type { LedgerStorageKind } from "@nexora/database";
import { openTauriLedger } from "@nexora/database-tauri";
import { registerSW } from "virtual:pwa-register";

import { App, type StartupDiagnosticsContext } from "./App";
import { loadAppModels } from "./appModels";
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
import { StorageDiscovery, type StorageArchiveInspection } from "./startup/StorageDiscovery";
import { selectStorage } from "./startup/StorageSelection";
import { readRecoverySelection, StartupRecoveryRequiredError } from "./startup/StartupRecovery";
import { StartupModelLoadError } from "./startup/StartupOrchestrator";
import { readStoragePreferenceHint } from "./startup/storagePreference";
import { withStartupLock } from "./startup/StartupLock";
import { renderPreMountError } from "./startup/PreMountError";
import { applyAppPreferences, readAppPreferences } from "./settings/preferences";

const rootElement = document.querySelector("#root");

if (!(rootElement instanceof HTMLElement)) {
  renderPreMountError(null);
  throw new Error("Nexora root element is missing");
}

// Apply the local visual preference before mounting so every route starts with
// the selected theme, text scale and motion policy without a visible reset.
applyAppPreferences(readAppPreferences());

const nativeRuntime = isTauri();
const applyPwaUpdate =
  import.meta.env.PROD && !nativeRuntime
    ? registerSW({
        onNeedRefresh() {
          window.dispatchEvent(
            new CustomEvent<PwaUpdateEventDetail>(pwaUpdateEventName, {
              detail: { applyUpdate: () => applyPwaUpdate?.(true) },
            }),
          );
        },
      })
    : undefined;

let selectedStorageKind: LedgerStorageKind | undefined;
let allowOpfsFallback = false;
let discoveredArchives: readonly StorageArchiveInspection[] = [];
const startupBootstrap = createStartupBootstrap(
  new StartupOrchestrator({
    discoverStorage: async () => {
      if (nativeRuntime) {
        selectedStorageKind = "native-sqlite";
        return;
      }
      const discovery = await new StorageDiscovery().inspect();
      discoveredArchives = discovery.archives;
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
      if (storageKind === "native-sqlite") {
        return withStartupLock(() => openTauriLedger());
      }
      return withStartupLock(() =>
        openPwaLedgerWithSafeOpfsFallback({
          allowOpfsFallback,
          persistSelection: false,
          selectedStorageKind: storageKind,
        }),
      );
    },
    verifyData: async (ledger) => {
      try {
        await loadAppModels(ledger);
      } catch (cause) {
        throw new StartupModelLoadError(cause);
      }
    },
    validateEnvironment: () => {
      if (nativeRuntime) return;
      if (
        typeof indexedDB === "undefined" &&
        typeof navigator.storage?.getDirectory !== "function"
      ) {
        throw new Error("No supported local browser storage is available.");
      }
    },
    validateLedger: async (ledger) => {
      await ledger.repository.listAccounts();
    },
    // SQLite and IndexedDB adapters apply their own atomic migrations while opening.
    runMigrations: () => undefined,
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
  if (ledger.storageKind === "native-sqlite") return ledger;
  try {
    // The ledger is already opened and verified here; a blocked preference store must
    // not turn a valid local ledger into a startup failure.
    persistPwaLedgerSelection(ledger.storageKind);
  } catch (error) {
    console.warn(
      "[Nexora startup] Could not persist the verified storage preference.",
      error instanceof Error ? error.name : "UnknownError",
    );
  }
  return ledger;
});

const getStartupDiagnostics = (): StartupDiagnosticsContext => {
  const failure = startupBootstrap.getFailure();
  return {
    archives: discoveredArchives,
    ...(failure === undefined ? {} : { errorCode: failure.code }),
    ...(failure === undefined ? {} : { failureCategory: failure.category }),
    ...(failure === undefined ? {} : { failureDetail: failure.detail }),
    ...(selectedStorageKind === undefined ? {} : { selectedBackend: selectedStorageKind }),
  };
};

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
      <App
        ledgerPromise={ledgerPromise}
        startupBootstrap={startupBootstrap}
        startupDiagnostics={getStartupDiagnostics}
      />
    </StrictMode>,
  );
} catch (error) {
  console.error(
    "[Nexora startup] React mount failed.",
    error instanceof Error ? error.name : "UnknownError",
  );
  renderPreMountError(rootElement);
}
