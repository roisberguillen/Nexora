import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@nexora/ui/styles.css";
import "./page.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { openPwaLedger } from "./persistence/openPwaLedger";
import { StartupOrchestrator } from "./startup/StartupOrchestrator";

const rootElement = document.querySelector("#root");

if (!(rootElement instanceof HTMLElement)) {
  throw new Error("Nexora root element is missing");
}

const startupOrchestrator = new StartupOrchestrator({
  openLedger: () => openPwaLedger(),
});
const ledgerPromise = startupOrchestrator.run().then((result) => {
  if (result.ledger !== undefined) return result.ledger;
  throw result.failure?.cause ?? new Error("Nexora startup did not return a ledger.");
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
    <App ledgerPromise={ledgerPromise} />
  </StrictMode>,
);
