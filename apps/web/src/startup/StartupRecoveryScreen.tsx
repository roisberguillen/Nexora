import { type ReactElement, useState } from "react";

export interface StartupRecoveryScreenProps {
  readonly onRetry: () => void;
  readonly onOpenSafeCopy: () => void;
  readonly onRestoreBackup: () => void;
  readonly onExportDiagnostics: () => void;
}

export function StartupRecoveryScreen(props: StartupRecoveryScreenProps): ReactElement {
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  return (
    <section aria-labelledby="startup-recovery-title" className="startup-recovery" role="alert">
      <h1 id="startup-recovery-title">
        Nexora non riesce ad aprire i tuoi dati in questo momento.
      </h1>
      <p>
        I tuoi dati non sono stati modificati. Puoi riprovare oppure avviare il recupero guidato.
      </p>
      <div className="startup-recovery__actions">
        <button onClick={props.onRetry} type="button">
          Riprova
        </button>
        <button onClick={() => setIsGuidanceOpen((open) => !open)} type="button">
          Avvia recupero guidato
        </button>
        <button onClick={props.onOpenSafeCopy} type="button">
          Apri una copia sicura
        </button>
        <button onClick={props.onRestoreBackup} type="button">
          Ripristina da backup
        </button>
        <button onClick={props.onExportDiagnostics} type="button">
          Esporta diagnostica
        </button>
      </div>
      {isGuidanceOpen ? (
        <div className="startup-recovery__guidance">
          <h2>Recupero guidato</h2>
          <p>
            Potrai scegliere una copia verificata o un backup. Nexora non eliminerà l’altro
            archivio.
          </p>
          <p>Prima di ogni aggiornamento verrà proposta una copia di sicurezza.</p>
        </div>
      ) : null}
    </section>
  );
}
