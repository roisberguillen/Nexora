import type { BrowserLedger } from "@nexora/database";
import { useState } from "react";

import { createAppLock, removeAppLock, type AppLockConfig } from "./appLock";

export function PrivacySecurityPage({
  ledger,
  lockConfig,
  onLockConfigChanged,
  onManualLock,
}: {
  readonly ledger: BrowserLedger;
  readonly lockConfig: AppLockConfig | undefined;
  readonly onLockConfigChanged: (config: AppLockConfig | undefined) => void;
  readonly onManualLock: () => void;
}) {
  const backend = ledger.storageKind === "opfs" ? "SQLite su OPFS" : "IndexedDB";
  return (
    <div id="privacy-security">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Trasparenza locale</p>
          <h1>Privacy e sicurezza</h1>
          <p>Questa pagina descrive la protezione realmente disponibile sul dispositivo.</p>
        </div>
      </header>
      <div className="settings-groups">
        <section className="data-panel settings-group">
          <h2>Archivio attivo</h2>
          <div className="settings-row">
            <span>Backend</span>
            <small>{backend}</small>
          </div>
          <div className="settings-row">
            <span>Cifratura a riposo del ledger</span>
            <small>Non fornita dal browser</small>
          </div>
          <p className="import-help">
            Proteggi profilo utente e dispositivo: un browser già aperto può leggere il ledger
            locale.
          </p>
        </section>
        <section className="data-panel settings-group">
          <h2>Blocco dell’app</h2>
          {lockConfig ? (
            <>
              <p className="import-help">
                Blocco attivo dopo {lockConfig.timeoutMinutes} minuti di inattività. Protegge la
                sessione aperta, non cifra il ledger nel browser.
              </p>
              <div className="settings-actions">
                <button className="secondary-action" onClick={onManualLock} type="button">
                  Blocca ora
                </button>
                <button
                  className="secondary-action"
                  onClick={() => {
                    removeAppLock();
                    onLockConfigChanged(undefined);
                  }}
                  type="button"
                >
                  Disattiva blocco
                </button>
              </div>
            </>
          ) : (
            <AppLockSetup onConfigured={onLockConfigChanged} />
          )}
        </section>
        <section className="data-panel settings-group">
          <h2>Backup</h2>
          <p className="import-help">
            I backup supportati sono cifrati AES-256-GCM con chiave PBKDF2 derivata dalla
            passphrase. La passphrase non viene salvata.
          </p>
        </section>
        <section className="data-panel settings-group">
          <h2>Google Drive</h2>
          <p className="import-help">
            Se configurato, Drive riceve solo archivi già cifrati nell’area privata appDataFolder.
            Il token OAuth resta soltanto in memoria.
          </p>
        </section>
      </div>
    </div>
  );
}

function AppLockSetup({
  onConfigured,
}: {
  readonly onConfigured: (config: AppLockConfig) => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState<AppLockConfig["timeoutMinutes"]>(5);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setIsSaving(true);
    try {
      onConfigured(await createAppLock(passphrase, timeoutMinutes));
      setPassphrase("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossibile attivare il blocco.");
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <form className="app-lock-setup" onSubmit={(event) => void save(event)}>
      <p className="import-help">
        Configura un PIN o una passphrase di almeno 4 caratteri. Nexora salva soltanto un
        verificatore derivato con PBKDF2.
      </p>
      <label className="field-label" htmlFor="new-app-lock">
        PIN o passphrase
      </label>
      <input
        autoComplete="new-password"
        id="new-app-lock"
        minLength={4}
        onChange={(event) => setPassphrase(event.target.value)}
        required
        type="password"
        value={passphrase}
      />
      <label className="field-label" htmlFor="app-lock-timeout">
        Blocca dopo inattività
      </label>
      <select
        id="app-lock-timeout"
        onChange={(event) =>
          setTimeoutMinutes(Number(event.target.value) as AppLockConfig["timeoutMinutes"])
        }
        value={timeoutMinutes}
      >
        <option value={1}>1 minuto</option>
        <option value={5}>5 minuti</option>
        <option value={15}>15 minuti</option>
      </select>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary-action" disabled={isSaving} type="submit">
        {isSaving ? "Attivazione…" : "Attiva blocco"}
      </button>
    </form>
  );
}
