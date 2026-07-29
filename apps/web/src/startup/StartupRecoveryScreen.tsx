import { type ReactElement, useState } from "react";

import {
  restorePortableBackupTemporarily,
  verifyRecoveryBackup,
} from "./RecoveryBackupVerification";
import type { StorageArchiveInspection } from "./StorageDiscovery";

export interface StartupRecoveryScreenProps {
  readonly onRetry: () => void;
  readonly recoveryArchives: readonly StorageArchiveInspection[] | undefined;
  readonly onOpenSafeCopy: (storageKind: "opfs" | "indexeddb") => void;
  readonly onExportDiagnostics: () => void;
}

export function StartupRecoveryScreen(props: StartupRecoveryScreenProps): ReactElement {
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  const [backup, setBackup] = useState<File>();
  const [passphrase, setPassphrase] = useState("");
  const [backupMessage, setBackupMessage] = useState<string>();
  const [isVerifyingBackup, setIsVerifyingBackup] = useState(false);
  const verifyBackup = async (): Promise<void> => {
    if (backup === undefined || passphrase.length < 12) return;
    setIsVerifyingBackup(true);
    setBackupMessage(undefined);
    try {
      const result = await verifyRecoveryBackup(
        new Uint8Array(await backup.arrayBuffer()),
        passphrase,
      );
      setBackupMessage(
        `Backup verificato (${result.kind}, schema ${result.schemaVersion}). Nessun archivio locale è stato modificato.`,
      );
    } catch {
      setBackupMessage(
        "Backup non verificato: il file o la passphrase non sono validi. Nessun archivio locale è stato modificato.",
      );
    } finally {
      setIsVerifyingBackup(false);
    }
  };
  const restoreTemporarily = async (): Promise<void> => {
    if (backup === undefined || passphrase.length < 12) return;
    setIsVerifyingBackup(true);
    setBackupMessage(undefined);
    try {
      const result = await restorePortableBackupTemporarily(
        new Uint8Array(await backup.arrayBuffer()),
        passphrase,
      );
      setBackupMessage(
        `Ripristino temporaneo riuscito: ${result.restoredTransactions} movimenti verificati. La copia temporanea è stata rimossa e l’archivio locale non è stato modificato.`,
      );
    } catch {
      setBackupMessage(
        "Ripristino temporaneo non riuscito: l’archivio locale non è stato modificato.",
      );
    } finally {
      setIsVerifyingBackup(false);
    }
  };
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
        {props.recoveryArchives?.map((archive) => (
          <button
            key={archive.kind}
            onClick={() => props.onOpenSafeCopy(archive.kind)}
            type="button"
          >
            Apri archivio {archive.kind === "opfs" ? "OPFS" : "IndexedDB"}
          </button>
        ))}
        <button onClick={props.onExportDiagnostics} type="button">
          Esporta diagnostica
        </button>
      </div>
      {isGuidanceOpen ? (
        <div className="startup-recovery__guidance">
          <h2>Recupero guidato</h2>
          <p>
            Puoi scegliere uno degli archivi rilevati oppure verificare un backup cifrato senza
            modificare i dati locali.
          </p>
          <label>
            File backup `.nexora-backup`
            <input
              accept=".nexora-backup,application/octet-stream"
              onChange={(event) => setBackup(event.target.files?.[0])}
              type="file"
            />
          </label>
          <label>
            Passphrase del backup
            <input
              autoComplete="current-password"
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </label>
          <button
            disabled={backup === undefined || passphrase.length < 12 || isVerifyingBackup}
            onClick={() => void verifyBackup()}
            type="button"
          >
            {isVerifyingBackup ? "Verifica backup…" : "Verifica backup senza ripristinare"}
          </button>
          <button
            disabled={backup === undefined || passphrase.length < 12 || isVerifyingBackup}
            onClick={() => void restoreTemporarily()}
            type="button"
          >
            Prova ripristino temporaneo
          </button>
          {backupMessage === undefined ? null : (
            <p aria-live="polite" role="status">
              {backupMessage}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
