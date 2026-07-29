import { type ReactElement, useEffect, useState } from "react";

export function StartupLoadingScreen(): ReactElement {
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
          <li>Verifica ambiente</li>
          <li>Ricerca archivio</li>
          <li>Controllo dati</li>
          <li>Aggiornamento archivio</li>
          <li>Preparazione interfaccia</li>
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
