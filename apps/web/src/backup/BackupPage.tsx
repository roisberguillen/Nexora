import type { Ledger, VerifiedPortableBackup } from "@nexora/database";
import { useEffect, useState } from "react";

import { useGoogleDriveSession } from "../cloud/GoogleDriveSessionContext";
import type { CloudBackupMetadata } from "../cloud/cloudTypes";
import { AccessibleDialog } from "../settings/AccessibleDialog";
import { appendBackupHistory, readBackupHistory } from "./backupHistory";

function errorCode(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function describeCloudError(error: unknown): string {
  switch (errorCode(error)) {
    case "cloud_session_expired":
      return "La sessione Google Drive è scaduta: ricollega l'account e riprova.";
    case "cloud_permission_denied":
      return "Google Drive ha negato l'accesso all'area privata dell'app.";
    case "cloud_backup_not_found":
      return "L'archivio cloud selezionato non è più disponibile.";
    case "cloud_rate_limited":
      return "Google Drive sta limitando le richieste: riprova tra qualche minuto.";
    case "cloud_timeout":
      return "La connessione a Google Drive ha superato il tempo massimo: riprova.";
    case "cloud_invalid_backup_metadata":
      return "Il backup Drive non contiene metadati Nexora validi.";
    case "cloud_checksum_mismatch":
      return "Il checksum del backup Drive non coincide con la ricevuta salvata.";
    case "google_identity_timeout":
      return "Google non ha completato il consenso entro il tempo previsto.";
    default:
      return "La connessione a Google Drive non è disponibile: riprova quando torni online.";
  }
}

export function BackupPage({ ledger }: { readonly ledger: Ledger }) {
  const googleDriveSession = useGoogleDriveSession();
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState<File>();
  const [verifiedArchive, setVerifiedArchive] = useState<VerifiedPortableBackup>();
  const [isRestoreConfirmationOpen, setIsRestoreConfirmationOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<readonly CloudBackupMetadata[]>([]);
  const [verifiedCloudArchive, setVerifiedCloudArchive] = useState<{
    readonly metadata: CloudBackupMetadata;
    readonly receipt: VerifiedPortableBackup;
    readonly archive: Uint8Array;
  }>();
  const [isCloudRestoreConfirmationOpen, setIsCloudRestoreConfirmationOpen] = useState(false);
  const [history, setHistory] = useState(() => readBackupHistory());
  const [cloudStatus, setCloudStatus] = useState<
    "idle" | "authorizing" | "connected" | "expired" | "error"
  >(googleDriveSession.status);
  const [cloudError, setCloudError] = useState<string>();
  const cloudConfig = googleDriveSession.config;
  const cloudProvider = googleDriveSession.provider;
  const canCreate = ledger.createEncryptedBackupArchive !== undefined;

  useEffect(() => {
    setCloudStatus(googleDriveSession.status);
    if (googleDriveSession.status !== "connected") return;
    let isActive = true;
    void cloudProvider.list().then(
      (backups) => isActive && setCloudBackups(backups),
      (error: unknown) => {
        if (!isActive) return;
        setCloudError(describeCloudError(error));
      },
    );
    return () => {
      isActive = false;
    };
  }, [cloudProvider, googleDriveSession.status]);

  const create = async () => {
    if (
      !canCreate ||
      passphrase.trim().length < 12 ||
      ledger.createEncryptedBackupArchive === undefined
    )
      return;
    setIsCreating(true);
    setMessage(null);
    setOperationError(null);
    try {
      const backup = await ledger.createEncryptedBackupArchive({ passphrase });
      const anchor = document.createElement("a");
      const archiveBytes = new Uint8Array(backup.archive.byteLength);
      archiveBytes.set(backup.archive);
      const archiveUrl = URL.createObjectURL(
        new Blob([archiveBytes.buffer], { type: "application/octet-stream" }),
      );
      anchor.href = archiveUrl;
      anchor.download = backup.id;
      anchor.click();
      URL.revokeObjectURL(archiveUrl);
      appendBackupHistory({
        operation: "manual_backup",
        storageKind: ledger.storageKind,
        outcome: "succeeded",
        size: backup.size,
        checksumPrefix: backup.checksumSha256.slice(0, 12),
      });
      setHistory(readBackupHistory());
      setPassphrase("");
      setVerifiedArchive(undefined);
      setVerifiedCloudArchive(undefined);
      setMessage(
        `Backup verificato scaricato: ${backup.id}. Checksum ${backup.checksumSha256.slice(0, 12)}…`,
      );
    } catch {
      appendBackupHistory({
        operation: "local_backup",
        storageKind: ledger.storageKind,
        outcome: "failed",
      });
      setHistory(readBackupHistory());
      setOperationError("Backup non creato: nessun dato del ledger è stato modificato.");
    } finally {
      setIsCreating(false);
    }
  };

  const restoreSelectedArchive = async () => {
    if (
      !selectedArchive ||
      !verifiedArchive ||
      passphrase.trim().length < 12 ||
      ledger.restoreEncryptedBackupArchive === undefined
    )
      return;
    setIsRestoring(true);
    setMessage(null);
    setOperationError(null);
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
      setIsRestoreConfirmationOpen(false);
      window.location.reload();
    } catch {
      appendBackupHistory({
        operation: "restore",
        storageKind: ledger.storageKind,
        outcome: "failed",
      });
      setHistory(readBackupHistory());
      setOperationError(
        "Ripristino non completato: l’archivio locale corrente è rimasto protetto.",
      );
      setIsRestoring(false);
    }
  };
  const runRecoveryDrill = async () => {
    if (
      !selectedArchive ||
      passphrase.trim().length < 12 ||
      ledger.verifyEncryptedBackupArchive === undefined
    )
      return;
    setIsRestoring(true);
    setMessage(null);
    setOperationError(null);
    setVerifiedArchive(undefined);
    try {
      const receipt = await ledger.verifyEncryptedBackupArchive({
        archive: new Uint8Array(await selectedArchive.arrayBuffer()),
        passphrase,
      });
      setVerifiedArchive(receipt);
      appendBackupHistory({
        operation: "restore_test",
        storageKind: ledger.storageKind,
        outcome: "succeeded",
        size: selectedArchive.size,
      });
      setHistory(readBackupHistory());
      setMessage("Archivio verificato: il ledger attivo non è stato modificato.");
    } catch {
      appendBackupHistory({
        operation: "restore_test",
        storageKind: ledger.storageKind,
        outcome: "failed",
      });
      setHistory(readBackupHistory());
      setOperationError(
        "Verifica non riuscita: il ledger attivo non è stato modificato. Controlla file e passphrase.",
      );
    } finally {
      setIsRestoring(false);
    }
  };
  const connectCloud = async () => {
    if (!cloudConfig.enabled) return;
    setIsCloudBusy(true);
    setMessage(null);
    setOperationError(null);
    setCloudError(undefined);
    try {
      await googleDriveSession.connect();
      setMessage("Google Drive collegato: vengono gestiti solo backup cifrati privati.");
    } catch (error) {
      setCloudStatus("error");
      setCloudError(describeCloudError(error));
      setMessage("Collegamento Google Drive non riuscito. Nessun dato locale è stato condiviso.");
    } finally {
      setIsCloudBusy(false);
    }
  };
  const disconnectCloud = async () => {
    await googleDriveSession.disconnect();
    setCloudBackups([]);
    setVerifiedCloudArchive(undefined);
    setIsCloudRestoreConfirmationOpen(false);
    setCloudStatus("idle");
    setMessage("Google Drive disconnesso: nessun token è conservato nel browser.");
  };
  const uploadCloud = async () => {
    if (ledger.createEncryptedBackupArchive === undefined || passphrase.trim().length < 12) return;
    setIsCloudBusy(true);
    setMessage(null);
    setCloudError(undefined);
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
      setVerifiedArchive(undefined);
      setVerifiedCloudArchive(undefined);
      setCloudBackups(await cloudProvider.list());
      setMessage("Backup cifrato caricato su Google Drive dopo la verifica locale.");
    } catch (error) {
      const code = errorCode(error);
      if (code === "cloud_session_expired") setCloudStatus("expired");
      else if (code?.startsWith("cloud_") === true) setCloudStatus("error");
      setCloudError(
        code?.startsWith("cloud_") === true
          ? describeCloudError(error)
          : "Il file o la passphrase non permettono di verificare questo backup Drive.",
      );
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
  const verifyCloudRestore = async (backup: CloudBackupMetadata) => {
    if (ledger.verifyEncryptedBackupArchive === undefined || passphrase.trim().length < 12) return;
    setIsCloudBusy(true);
    setMessage(null);
    setOperationError(null);
    setCloudError(undefined);
    setVerifiedCloudArchive(undefined);
    try {
      const archive = await cloudProvider.download(backup.id, backup.size);
      const receipt = await ledger.verifyEncryptedBackupArchive({
        archive,
        passphrase,
      });
      if (receipt.checksumSha256 !== backup.checksumSha256) {
        throw new Error("cloud_checksum_mismatch");
      }
      appendBackupHistory({
        operation: "cloud_verify",
        storageKind: ledger.storageKind,
        outcome: "succeeded",
        size: backup.size,
        checksumPrefix: backup.checksumSha256.slice(0, 12),
      });
      setHistory(readBackupHistory());
      setVerifiedCloudArchive({ metadata: backup, receipt, archive });
      setMessage(
        "Backup Drive verificato in sola lettura: il ledger attivo non è stato modificato.",
      );
    } catch (error) {
      const code = errorCode(error);
      if (code === "cloud_session_expired") setCloudStatus("expired");
      else if (code?.startsWith("cloud_") === true && code !== "cloud_checksum_mismatch")
        setCloudStatus("error");
      setCloudError(
        code?.startsWith("cloud_") === true
          ? describeCloudError(error)
          : "Il file o la passphrase non permettono di verificare questo backup Drive.",
      );
      appendBackupHistory({
        operation: "cloud_verify",
        storageKind: ledger.storageKind,
        outcome: "failed",
      });
      setHistory(readBackupHistory());
      setOperationError("Verifica Drive non riuscita: il ledger locale è rimasto protetto.");
    } finally {
      setIsCloudBusy(false);
    }
  };
  const restoreVerifiedCloud = async () => {
    if (
      verifiedCloudArchive === undefined ||
      ledger.restoreEncryptedBackupArchive === undefined ||
      passphrase.trim().length < 12
    )
      return;
    setIsCloudBusy(true);
    setMessage(null);
    setOperationError(null);
    try {
      await ledger.restoreEncryptedBackupArchive({
        archive: verifiedCloudArchive.archive,
        id: verifiedCloudArchive.metadata.backupId,
        passphrase,
      });
      appendBackupHistory({
        operation: "cloud_download",
        storageKind: ledger.storageKind,
        outcome: "succeeded",
        size: verifiedCloudArchive.metadata.size,
        checksumPrefix: verifiedCloudArchive.receipt.checksumSha256.slice(0, 12),
      });
      setHistory(readBackupHistory());
      setIsCloudRestoreConfirmationOpen(false);
      window.location.reload();
    } catch (error) {
      const code = errorCode(error);
      if (code === "cloud_session_expired") {
        setCloudStatus("expired");
        setCloudError(describeCloudError(error));
      }
      appendBackupHistory({
        operation: "cloud_download",
        storageKind: ledger.storageKind,
        outcome: "failed",
      });
      setHistory(readBackupHistory());
      setOperationError(
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
            Crea un file `.nexora-backup` cifrato da conservare dove preferisci. La passphrase non
            viene salvata.
          </p>
        </div>
      </div>
      <label className="account-form-label backup-passphrase">
        Passphrase (minimo 12 caratteri)
        <input
          autoComplete="new-password"
          onChange={(event) => {
            setPassphrase(event.target.value);
            setVerifiedArchive(undefined);
            setVerifiedCloudArchive(undefined);
            setIsRestoreConfirmationOpen(false);
            setIsCloudRestoreConfirmationOpen(false);
          }}
          type="password"
          value={passphrase}
        />
      </label>
      {canCreate ? (
        <>
          <div className="form-actions backup-create-actions">
            <button
              className="primary-action"
              disabled={passphrase.trim().length < 12 || isCreating}
              onClick={() => void create()}
              type="button"
            >
              {isCreating ? "Verifica backup…" : "Scarica backup cifrato"}
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
            {cloudStatus === "connected" ? (
              <button
                className="secondary-action"
                disabled={passphrase.trim().length < 12 || isCloudBusy}
                onClick={() => void uploadCloud()}
                type="button"
              >
                Carica backup cifrato su Drive
              </button>
            ) : null}
            {cloudStatus === "connected" ? (
              <button
                className="secondary-action"
                disabled={isCloudBusy}
                onClick={() => void disconnectCloud()}
                type="button"
              >
                Disconnetti Drive
              </button>
            ) : null}
          </div>
          <hr />
        </>
      ) : (
        <p className="account-error" role="alert">
          Il backup portabile non è disponibile per questo archivio. Nessun dato è stato modificato.
        </p>
      )}
      <hr />
      <h2>Ripristina un archivio portabile</h2>
      <label className="account-form-label">
        File `.nexora-backup`
        <input
          accept=".nexora-backup,application/octet-stream"
          onChange={(event) => setSelectedArchive(event.target.files?.[0])}
          onInput={() => {
            setVerifiedArchive(undefined);
            setIsRestoreConfirmationOpen(false);
            setMessage(null);
            setOperationError(null);
          }}
          type="file"
        />
      </label>
      {verifiedArchive === undefined || selectedArchive === undefined ? null : (
        <section aria-labelledby="backup-verification-title" className="backup-verification-report">
          <h3 id="backup-verification-title">Archivio verificato</h3>
          <dl>
            <div>
              <dt>File</dt>
              <dd>{selectedArchive.name}</dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd>{verifiedArchive.manifest.schemaVersion}</dd>
            </div>
            <div>
              <dt>Creato</dt>
              <dd>{new Date(verifiedArchive.manifest.createdAt).toLocaleString("it-IT")}</dd>
            </div>
            <div>
              <dt>Integrità</dt>
              <dd>{verifiedArchive.checksumSha256.slice(0, 12)}…</dd>
            </div>
          </dl>
          <p>La verifica è avvenuta in sola lettura. I dati correnti non sono stati modificati.</p>
        </section>
      )}
      <div className="form-actions">
        <button
          className="secondary-action"
          disabled={
            !selectedArchive ||
            !verifiedArchive ||
            passphrase.trim().length < 12 ||
            isRestoring ||
            ledger.restoreEncryptedBackupArchive === undefined
          }
          onClick={() => setIsRestoreConfirmationOpen(true)}
          type="button"
        >
          Ripristina archivio verificato
        </button>
        <button
          className="secondary-action"
          disabled={
            !selectedArchive ||
            passphrase.trim().length < 12 ||
            isRestoring ||
            ledger.verifyEncryptedBackupArchive === undefined
          }
          onClick={() => void runRecoveryDrill()}
          type="button"
        >
          Verifica archivio senza ripristinare
        </button>
      </div>
      {isRestoreConfirmationOpen && selectedArchive !== undefined ? (
        <AccessibleDialog
          labelledBy="manual-restore-confirmation-title"
          onClose={() => !isRestoring && setIsRestoreConfirmationOpen(false)}
        >
          <h2 id="manual-restore-confirmation-title">Confermare il ripristino?</h2>
          <p>
            Il ledger corrente sarà sostituito con “{selectedArchive.name}”. Nexora creerà un
            checkpoint e ripristinerà i dati correnti se il controllo finale non riesce.
          </p>
          <div className="form-actions">
            <button
              className="secondary-action"
              disabled={isRestoring}
              onClick={() => setIsRestoreConfirmationOpen(false)}
              type="button"
            >
              Annulla
            </button>
            <button
              className="primary-action"
              disabled={isRestoring}
              onClick={() => void restoreSelectedArchive()}
              type="button"
            >
              {isRestoring ? "Ripristino in corso…" : "Conferma ripristino"}
            </button>
          </div>
        </AccessibleDialog>
      ) : null}
      <section aria-labelledby="cloud-backup-title" className="backup-cloud-unavailable">
        <h2 id="cloud-backup-title">Backup cloud</h2>
        {cloudConfig.enabled ? (
          <>
            <p>
              Stato Drive:{" "}
              {cloudStatus === "idle"
                ? "non collegato"
                : cloudStatus === "authorizing"
                  ? "collegamento in corso"
                  : cloudStatus === "connected"
                    ? "collegato"
                    : cloudStatus === "expired"
                      ? "sessione scaduta"
                      : "errore autorizzazione"}
              . Drive usa `appDataFolder` e riceve esclusivamente archivi già cifrati.
            </p>
            <p>
              Account e cartella: l’account viene scelto nel consenso Google; Nexora usa soltanto la
              propria cartella privata, non visibile alle altre app.
            </p>
            {cloudError === undefined ? null : (
              <p aria-live="polite" className="form-error" role="alert">
                {cloudError}
              </p>
            )}
          </>
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
                  onClick={() => void verifyCloudRestore(backup)}
                  type="button"
                >
                  Verifica per il ripristino
                </button>
              </li>
            ))}
          </ul>
        )}
        {verifiedCloudArchive === undefined ? null : (
          <section
            aria-labelledby="cloud-verification-title"
            className="backup-verification-report"
          >
            <h3 id="cloud-verification-title">Backup Drive verificato</h3>
            <dl>
              <div>
                <dt>File</dt>
                <dd>{verifiedCloudArchive.metadata.backupId}</dd>
              </div>
              <div>
                <dt>Schema</dt>
                <dd>{verifiedCloudArchive.receipt.manifest.schemaVersion}</dd>
              </div>
              <div>
                <dt>Creato</dt>
                <dd>
                  {new Date(verifiedCloudArchive.receipt.manifest.createdAt).toLocaleString(
                    "it-IT",
                  )}
                </dd>
              </div>
              <div>
                <dt>Integrità</dt>
                <dd>{verifiedCloudArchive.receipt.checksumSha256.slice(0, 12)}…</dd>
              </div>
            </dl>
            <p>Il contenuto è rimasto cifrato su Drive ed è stato verificato localmente.</p>
            <div className="form-actions">
              <button
                className="primary-action"
                disabled={isCloudBusy}
                onClick={() => setIsCloudRestoreConfirmationOpen(true)}
                type="button"
              >
                Ripristina backup Drive verificato
              </button>
            </div>
          </section>
        )}
      </section>
      {isCloudRestoreConfirmationOpen && verifiedCloudArchive !== undefined ? (
        <AccessibleDialog
          labelledBy="cloud-restore-confirmation-title"
          onClose={() => !isCloudBusy && setIsCloudRestoreConfirmationOpen(false)}
        >
          <h2 id="cloud-restore-confirmation-title">Confermare il ripristino da Drive?</h2>
          <p>
            Il ledger corrente sarà sostituito con “{verifiedCloudArchive.metadata.backupId}”. Un
            checkpoint verificato proteggerà i dati correnti in caso di errore.
          </p>
          <div className="form-actions">
            <button
              className="secondary-action"
              disabled={isCloudBusy}
              onClick={() => setIsCloudRestoreConfirmationOpen(false)}
              type="button"
            >
              Annulla
            </button>
            <button
              className="primary-action"
              disabled={isCloudBusy}
              onClick={() => void restoreVerifiedCloud()}
              type="button"
            >
              {isCloudBusy ? "Ripristino in corso…" : "Conferma ripristino da Drive"}
            </button>
          </div>
        </AccessibleDialog>
      ) : null}
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
      {operationError === null ? null : (
        <p aria-live="assertive" className="account-error" role="alert">
          {operationError}
        </p>
      )}
    </section>
  );
}
