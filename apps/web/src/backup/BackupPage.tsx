import type { BrowserLedger } from "@nexora/database";
import { useState } from "react";

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}

export function BackupPage({ ledger }: { readonly ledger: BrowserLedger }) {
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [backupId, setBackupId] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
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

  const restore = async () => {
    if (
      !canCreate ||
      backupId.trim() === "" ||
      passphrase.trim().length < 12 ||
      ledger.restoreEncryptedBackup === undefined
    )
      return;
    setIsRestoring(true);
    setMessage(null);
    try {
      const directory = await (window as DirectoryPickerWindow).showDirectoryPicker!();
      await ledger.restoreEncryptedBackup({ directory, id: backupId.trim(), passphrase });
      window.location.reload();
    } catch {
      setMessage("Ripristino non completato: l’archivio locale corrente è rimasto protetto.");
      setIsRestoring(false);
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
          <hr />
          <h2>Ripristina un backup</h2>
          <label className="account-form-label">
            Nome file backup
            <input
              onChange={(event) => setBackupId(event.target.value)}
              placeholder="nexora-v10-….nexora-backup"
              value={backupId}
            />
          </label>
          <div className="form-actions">
            <button
              className="secondary-action"
              disabled={backupId.trim() === "" || passphrase.trim().length < 12 || isRestoring}
              onClick={() => void restore()}
              type="button"
            >
              {isRestoring ? "Ripristino verificato…" : "Scegli cartella NAS e ripristina"}
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
