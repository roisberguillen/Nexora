import { useState } from "react";

import { AccessibleDialog } from "../settings/AccessibleDialog";

import { verifyAppLock, type AppLockConfig } from "./appLock";

export function AppLockScreen({
  config,
  onUnlock,
  onRecoveryReset,
}: {
  readonly config: AppLockConfig;
  readonly onUnlock: () => void;
  readonly onRecoveryReset?: () => Promise<void>;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string>();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [recoveryError, setRecoveryError] = useState<string>();
  const [isRecovering, setIsRecovering] = useState(false);
  const unlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isVerifying) return;
    setIsVerifying(true);
    setError(undefined);
    try {
      if (!(await verifyAppLock(passphrase, config))) {
        setError("PIN o passphrase non corretti.");
        return;
      }
      setPassphrase("");
      onUnlock();
    } catch {
      setError("Impossibile verificare il blocco locale. Riprova.");
    } finally {
      setIsVerifying(false);
    }
  };
  return (
    <main className="app-lock-screen">
      <form className="data-panel app-lock-card" onSubmit={(event) => void unlock(event)}>
        <p className="eyebrow">Nexora è bloccata</p>
        <h1>Sblocca l’app</h1>
        <p>Inserisci il PIN o la passphrase configurati su questo browser.</p>
        <label className="field-label" htmlFor="app-lock-passphrase">
          PIN o passphrase
        </label>
        <input
          autoComplete="current-password"
          autoFocus
          id="app-lock-passphrase"
          onChange={(event) => setPassphrase(event.target.value)}
          required
          type="password"
          value={passphrase}
        />
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary-action" disabled={isVerifying} type="submit">
          {isVerifying ? "Verifica in corso…" : "Sblocca Nexora"}
        </button>
        {onRecoveryReset === undefined ? (
          <p className="import-help" role="status">
            Il ripristino sicuro sarà disponibile quando l&apos;archivio locale è pronto.
          </p>
        ) : (
          <button
            className="secondary-action"
            onClick={() => setIsRecoveryOpen(true)}
            type="button"
          >
            Hai dimenticato il PIN?
          </button>
        )}
      </form>
      {isRecoveryOpen ? (
        <AccessibleDialog
          labelledBy="locked-app-reset-title"
          onClose={() => {
            if (isRecovering) return;
            setRecoveryPhrase("");
            setRecoveryError(undefined);
            setIsRecoveryOpen(false);
          }}
        >
          <h2 id="locked-app-reset-title">Ripristino totale dell’app</h2>
          <p>
            Se non ricordi il PIN non può essere recuperato. Questo elimina tutti i dati locali,
            incluso il blocco app; i backup già presenti su Google Drive restano invariati.
          </p>
          <label className="field-label" htmlFor="locked-app-reset-phrase">
            Digita RIPRISTINA NEXORA per confermare
          </label>
          <input
            autoComplete="off"
            id="locked-app-reset-phrase"
            onChange={(event) => setRecoveryPhrase(event.currentTarget.value)}
            value={recoveryPhrase}
          />
          {recoveryError === undefined ? null : (
            <p className="form-error" role="alert">
              {recoveryError}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-action"
              disabled={isRecovering}
              onClick={() => {
                setRecoveryPhrase("");
                setRecoveryError(undefined);
                setIsRecoveryOpen(false);
              }}
              type="button"
            >
              Annulla
            </button>
            <button
              className="primary-action"
              disabled={
                isRecovering ||
                recoveryPhrase !== "RIPRISTINA NEXORA" ||
                onRecoveryReset === undefined
              }
              onClick={() => {
                if (onRecoveryReset === undefined) return;
                setIsRecovering(true);
                setRecoveryError(undefined);
                void onRecoveryReset()
                  .catch(() =>
                    setRecoveryError(
                      "Ripristino non completato: i dati locali non sono stati modificati.",
                    ),
                  )
                  .finally(() => setIsRecovering(false));
              }}
              type="button"
            >
              {isRecovering ? "Ripristino in corso…" : "Ripristina app"}
            </button>
          </div>
        </AccessibleDialog>
      ) : null}
    </main>
  );
}
