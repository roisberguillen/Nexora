import { type ReactElement, useEffect, useState } from "react";

import type { StartupProgressEvent } from "./StartupOrchestrator";

export const startupLoadingSteps = [
  { label: "Verifica ambiente", states: ["CHECKING_ENVIRONMENT"] },
  { label: "Ricerca archivio", states: ["DISCOVERING_STORAGE", "OPENING_EXISTING_STORAGE"] },
  { label: "Controllo dati", states: ["VALIDATING_LEDGER"] },
  { label: "Aggiornamento archivio", states: ["RUNNING_MIGRATIONS"] },
  { label: "Preparazione interfaccia", states: ["VERIFYING_DATA", "READY"] },
] as const;

export function StartupLoadingScreen({
  progress,
}: {
  readonly progress: StartupProgressEvent | undefined;
}): ReactElement {
  const [isLongRunning, setIsLongRunning] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setIsLongRunning(true), 8_000);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <section aria-live="polite" className="startup-loading" role="status">
      <span aria-hidden="true" className="startup-loading__spinner" />
      <div>
        <h1>Preparazione del tuo archivio</h1>
        <p>Stiamo verificando e proteggendo i tuoi dati.</p>
        <ol aria-label="Fasi di avvio" className="startup-loading__steps">
          {startupLoadingSteps.map((step) => {
            const current = progress !== undefined && step.states.includes(progress.state as never);
            return (
              <li
                aria-current={current ? "step" : undefined}
                className={current ? "is-current" : undefined}
                key={step.label}
              >
                {step.label}
                {current ? ": in corso" : ""}
              </li>
            );
          })}
        </ol>
        {isLongRunning ? (
          <p className="startup-loading__notice">
            L’operazione sta richiedendo più tempo del previsto. I tuoi dati non sono stati
            modificati.
          </p>
        ) : null}
      </div>
    </section>
  );
}
