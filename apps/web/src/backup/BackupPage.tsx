import type { BrowserLedger } from "@nexora/database";
import { useMemo, useState } from "react";

import { GoogleDriveBackupProvider } from "../cloud/GoogleDriveBackupProvider";
import { GoogleIdentityAuth } from "../cloud/GoogleIdentityAuth";
import { readGoogleCloudConfig } from "../cloud/cloudConfig";
import type { CloudBackupMetadata } from "../cloud/cloudTypes";
import { loadGoogleIdentity } from "../cloud/loadGoogleIdentity";

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}

export function BackupPage({ ledger }: { readonly ledger: BrowserLedger }) {
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [backupId, setBackupId] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<readonly CloudBackupMetadata[]>([]);
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const cloudConfig = useMemo(readGoogleCloudConfig, []);
  const cloudAuth = useMemo(
    () => new GoogleIdentityAuth(cloudConfig.clientId),
    [cloudConfig.clientId],
  );
  const cloudProvider = useMemo(
    () => new GoogleDriveBackupProvider(() => cloudAuth.getAccessToken()),
    [cloudAuth],
  );
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
  const connectCloud = async () => {
    if (!cloudConfig.enabled) return;
    setIsCloudBusy(true);
    setMessage(null);
    try {
      await loadGoogleIdentity();
      await cloudAuth.connect();
      setCloudBackups(await cloudProvider.list());
      setMessage("Google Drive collegato: vengono mostrati solo backup cifrati privati.");
    } catch {
      setMessage("Collegamento Google Drive non riuscito. Nessun dato locale è stato condiviso.");
    } finally {
      setIsCloudBusy(false);
    }
  };
  const uploadCloud = async () => {
    if (ledger.createEncryptedBackupArchive === undefined || passphrase.trim().length < 12) return;
    setIsCloudBusy(true);
    setMessage(null);
    try {
      const backup = await ledger.createEncryptedBackupArchive({ passphrase });
      await cloudProvider.upload(
        {
          id: backup.id,
          backupId: backup.id,
          checksumSha256: backup.checksumSha256,
          createdAt: backup.createdAt,
          formatVersion: backup.manifest.formatVersion,
          schemaVersion: backup.manifest.schemaVersion,
          size: backup.size,
        },
        backup.archive,
      );
      setPassphrase("");
      setCloudBackups(await cloudProvider.list());
      setMessage(
        "Backup cifrato caricato su Google Drive e verificato localmente prima dell’invio.",
      );
    } catch {
      setMessage("Caricamento cloud non completato: l’archivio locale non è stato modificato.");
    } finally {
      setIsCloudBusy(false);
    }
  };
  const restoreCloud = async (backup: CloudBackupMetadata) => {
    if (ledger.restoreEncryptedBackupArchive === undefined || passphrase.trim().length < 12) return;
    setIsCloudBusy(true);
    setMessage(null);
    try {
      await ledger.restoreEncryptedBackupArchive({
        archive: await cloudProvider.download(backup.id),
        id: backup.backupId,
        passphrase,
      });
      window.location.reload();
    } catch {
      setMessage(
        "Ripristino cloud non completato: il database locale corrente è rimasto protetto.",
      );
      setIsCloudBusy(false);
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
            {cloudConfig.enabled ? (
              <button
                className="secondary-action"
                disabled={isCloudBusy}
                onClick={() => void connectCloud()}
                type="button"
              >
                {isCloudBusy ? "Connessione…" : "Collega Google Drive"}
              </button>
            ) : null}
            {cloudAuth.getStatus() === "connected" ? (
              <button
                className="secondary-action"
                disabled={passphrase.trim().length < 12 || isCloudBusy}
                onClick={() => void uploadCloud()}
                type="button"
              >
                Carica backup cifrato su Drive
              </button>
            ) : null}
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
          {cloudBackups.length > 0 ? (
            <section aria-labelledby="cloud-backup-title">
              <h2 id="cloud-backup-title">Cronologia Google Drive</h2>
              <ul className="account-list">
                {cloudBackups.map((backup) => (
                  <li key={backup.id}>
                    <div className="account-copy">
                      <strong>{backup.backupId}</strong>
                      <small>{new Date(backup.createdAt).toLocaleString("it-IT")}</small>
                    </div>
                    <button
                      className="secondary-action"
                      disabled={passphrase.trim().length < 12 || isCloudBusy}
                      onClick={() => void restoreCloud(backup)}
                      type="button"
                    >
                      Ripristina
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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
