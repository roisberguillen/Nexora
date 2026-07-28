import type { BrowserLedger } from "@nexora/database";
import { useState } from "react";

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}

export function BackupPage({ ledger }: { readonly ledger: BrowserLedger }) {
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const canCreate =
    ledger.createEncryptedBackup !== undefined &&
    (window as DirectoryPickerWindow).showDirectoryPicker !== undefined;

  const create = async () => {
    if (!canCreate || passphrase.trim().length < 12 || ledger.createEncryptedBackup === undefined)
      return;
    setIsCreating(true);
    setMessage(null);
    try {
      const directory = await (window as DirectoryPickerWindow).showDirectoryPicker!();
      const backup = await ledger.createEncryptedBackup({ directory, passphrase });
      setPassphrase("");
      setMessage(
        `Backup verificato creato: ${backup.id}. Checksum ${backup.checksumSha256.slice(0, 12)}…`,
      );
    } catch {
      setMessage("Backup non creato: nessun dato del ledger è stato modificato.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="data-panel" id="backup">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Backup cifrato</p>
          <h1>Proteggi l’archivio locale</h1>
          <p>
            Seleziona la cartella NAS nel browser, ad esempio la cartella Nexora sul tuo My Cloud.
            La passphrase non viene salvata.
          </p>
        </div>
      </div>
      {canCreate ? (
        <>
          <label className="account-form-label">
            Passphrase (minimo 12 caratteri)
            <input
              autoComplete="new-password"
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </label>
          <div className="form-actions">
            <button
              className="primary-action"
              disabled={passphrase.trim().length < 12 || isCreating}
              onClick={() => void create()}
              type="button"
            >
              {isCreating ? "Verifica backup…" : "Scegli cartella NAS e crea backup"}
            </button>
          </div>
        </>
      ) : (
        <p className="account-error" role="alert">
          Il backup fisico richiede SQLite su OPFS e un browser con selezione cartella. Su IndexedDB
          usa l’export JSON completo.
        </p>
      )}
      {message === null ? null : (
        <p aria-live="polite" className="import-help" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
