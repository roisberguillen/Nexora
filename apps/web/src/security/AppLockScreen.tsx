import { useState } from "react";
import { verifyAppLock, type AppLockConfig } from "./appLock";

export function AppLockScreen({
  config,
  onUnlock,
}: {
  readonly config: AppLockConfig;
  readonly onUnlock: () => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string>();
  const [isVerifying, setIsVerifying] = useState(false);
  const unlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      </form>
    </main>
  );
}
