import type { BrowserLedger } from "@nexora/database";
import { useMemo, useState } from "react";

import { GoogleDriveBackupProvider } from "../cloud/GoogleDriveBackupProvider";
import { GoogleIdentityAuth } from "../cloud/GoogleIdentityAuth";
import { readGoogleCloudConfig } from "../cloud/cloudConfig";
import type { CloudBackupMetadata } from "../cloud/cloudTypes";
import { loadGoogleIdentity } from "../cloud/loadGoogleIdentity";
import { appendBackupHistory, readBackupHistory } from "./backupHistory";

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}

export function BackupPage({ ledger }: { readonly ledger: BrowserLedger }) {
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState<File>();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<readonly CloudBackupMetadata[]>([]);
  const [history, setHistory] = useState(() => readBackupHistory());
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
      appendBackupHistory({
        operation: "local_backup",
        storageKind: ledger.storageKind,
        outcome: "succeeded",
        size: backup.size,
        checksumPrefix: backup.checksumSha256.slice(0, 12),
      });
      setHistory(readBackupHistory());
      setPassphrase("");
      setMessage(
        `Backup verificato creato: ${backup.id}. Checksum ${backup.checksumSha256.slice(0, 12)}…`,
      );
    } catch {
      appendBackupHistory({
        operation: "local_backup",
        storageKind: ledger.storageKind,
        outcome: "failed",
      });
      setHistory(readBackupHistory());
      setMessage("Backup non creato: nessun dato del ledger è stato modificato.");
    } finally {
      setIsCreating(false);
    }
  };

  const restoreSelectedArchive = async () => {
    if (
      !selectedArchive ||
      passphrase.trim().length < 12 ||
      ledger.restoreEncryptedBackupArchive === undefined
    )
      return;
    setIsRestoring(true);
    setMessage(null);
    try {
      await ledger.restoreEncryptedBackupArchive({
        archive: new Uint8Array(await selectedArchive.arrayBuffer()),
        id: selectedArchive.name,
        passphrase,
      });
      appendBackupHistory({
        operation: "restore",
        storageKind: ledger.storageKind,
        outcome: "succeeded",
        size: selectedArchive.size,
      });
      setHistory(readBackupHistory());
      window.location.reload();
    } catch {
      appendBackupHistory({
        operation: "restore",
        storageKind: ledger.storageKind,
        outcome: "failed",
      });
      setHistory(readBackupHistory());
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
      setMessage("Google Drive collegato: vengono gestiti solo backup cifrati privati.");
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
      appendBackupHistory({
        operation: "cloud_upload",
        storageKind: ledger.storageKind,
        outcome: "succeeded",
        size: backup.size,
        checksumPrefix: backup.checksumSha256.slice(0, 12),
      });
      setHistory(readBackupHistory());
      setPassphrase("");
      setCloudBackups(await cloudProvider.list());
      setMessage("Backup cifrato caricato su Google Drive dopo la verifica locale.");
    } catch {
      appendBackupHistory({
        operation: "cloud_upload",
        storageKind: ledger.storageKind,
        outcome: "failed",
      });
      setHistory(readBackupHistory());
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
      appendBackupHistory({
        operation: "cloud_download",
        storageKind: ledger.storageKind,
        outcome: "succeeded",
        size: backup.size,
        checksumPrefix: backup.checksumSha256.slice(0, 12),
      });
      setHistory(readBackupHistory());
      window.location.reload();
    } catch {
      appendBackupHistory({
        operation: "cloud_download",
        storageKind: ledger.storageKind,
        outcome: "failed",
      });
      setHistory(readBackupHistory());
      setMessage(
        "Ripristino Google Drive non completato: l’archivio locale corrente è rimasto protetto.",
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
      <label className="account-form-label">
        Passphrase (minimo 12 caratteri)
        <input
          autoComplete="new-password"
          onChange={(event) => setPassphrase(event.target.value)}
          type="password"
          value={passphrase}
        />
      </label>
      {canCreate ? (
        <>
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
        </>
      ) : (
        <p className="account-error" role="alert">
          Il backup fisico richiede SQLite su OPFS e un browser con selezione cartella. Su IndexedDB
          usa l’export JSON completo.
        </p>
      )}
      <hr />
      <h2>Ripristina un archivio portabile</h2>
      <label className="account-form-label">
        File `.nexora-backup`
        <input
          accept=".nexora-backup,application/octet-stream"
          onChange={(event) => setSelectedArchive(event.target.files?.[0])}
          type="file"
        />
      </label>
      <div className="form-actions">
        <button
          className="secondary-action"
          disabled={
            !selectedArchive ||
            passphrase.trim().length < 12 ||
            isRestoring ||
            ledger.restoreEncryptedBackupArchive === undefined
          }
          onClick={() => void restoreSelectedArchive()}
          type="button"
        >
          {isRestoring ? "Ripristino verificato…" : "Ripristina archivio selezionato"}
        </button>
      </div>
      <section aria-labelledby="cloud-backup-title" className="backup-cloud-unavailable">
        <h2 id="cloud-backup-title">Backup cloud</h2>
        {cloudConfig.enabled ? (
          <p>Drive usa `appDataFolder` e riceve esclusivamente archivi già cifrati.</p>
        ) : (
          <p>Configura `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_DRIVE_ENABLED=true` per attivarlo.</p>
        )}
        {cloudBackups.length === 0 ? null : (
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
                  Ripristina da Drive
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="backup-history-title" className="backup-cloud-unavailable">
        <h2 id="backup-history-title">Cronologia backup</h2>
        {history.length === 0 ? (
          <p>Nessuna operazione registrata in questo browser.</p>
        ) : (
          <ul className="account-list">
            {history.slice(0, 8).map((entry) => (
              <li key={entry.id}>
                <div className="account-copy">
                  <strong>{entry.operation.replaceAll("_", " ")}</strong>
                  <small>
                    {new Date(entry.occurredAt).toLocaleString("it-IT")} · {entry.storageKind} ·{" "}
                    {entry.outcome === "succeeded" ? "riuscito" : "non riuscito"}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {message === null ? null : (
        <p aria-live="polite" className="import-help" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
