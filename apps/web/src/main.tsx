import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@nexora/ui/styles.css";
import "./page.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { openPwaLedger } from "./persistence/openPwaLedger";

const rootElement = document.querySelector("#root");

if (!(rootElement instanceof HTMLElement)) {
  throw new Error("Nexora root element is missing");
}

const ledgerPromise = openPwaLedger();

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
