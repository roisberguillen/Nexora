import { useEffect, useState } from "react";
import type { TrashedTransaction } from "@nexora/domain";

import { appVersion } from "../appVersion";
import type { FinancialResetPreview } from "../reset/financialReset";
import type { TotalResetReport } from "../reset/totalReset";
import { countExpiredTrashEntries } from "../transactions/trashRetention";

import { AccessibleDialog } from "./AccessibleDialog";

import {
  applyAppPreferences,
  readAppPreferences,
  writeAppPreferences,
  type AppPreferences,
} from "./preferences";
import {
  probeLocalHost,
  readLocalHostConnection,
  writeLocalHostConnection,
  type LocalHostHealth,
} from "./localHostConnection";

export function SettingsPage({
  onResetFinancialData,
  onCreateResetBackup,
  requiresResetPin = false,
  onPreviewFinancialReset,
  onRestoreTransaction,
  onPurgeTransaction,
  onPurgeTransactions,
  onResetApplication,
  trashedTransactions = [],
  onProbeLocalHost = probeLocalHost,
}: {
  readonly onResetFinancialData?: (input: {
    readonly backupChecksumPrefix?: string;
    readonly pin?: string;
  }) => Promise<void>;
  readonly onCreateResetBackup?: (passphrase: string) => Promise<string>;
  readonly requiresResetPin?: boolean;
  readonly onPreviewFinancialReset?: () => Promise<FinancialResetPreview>;
  readonly onRestoreTransaction?: (id: string) => Promise<void>;
  readonly onPurgeTransaction?: (id: string) => Promise<void>;
  readonly onPurgeTransactions?: (ids: readonly string[]) => Promise<void>;
  readonly onResetApplication?: (input: {
    readonly deleteCloud: boolean;
  }) => Promise<TotalResetReport>;
  readonly trashedTransactions?: readonly TrashedTransaction[];
  readonly onProbeLocalHost?: (endpoint: string) => Promise<LocalHostHealth>;
}) {
  const [preferences, setPreferences] = useState<AppPreferences>(() => readAppPreferences());
  useEffect(() => {
    applyAppPreferences(preferences);
    writeAppPreferences(preferences);
  }, [preferences]);
  const update = (patch: Partial<AppPreferences>) =>
    setPreferences((current) => ({ ...current, ...patch }));
  const [hostConnection, setHostConnection] = useState(() => readLocalHostConnection());
  const [hostMessage, setHostMessage] = useState<string | null>(null);
  const [isCheckingHost, setIsCheckingHost] = useState(false);
  const activateHost = async () => {
    setIsCheckingHost(true);
    setHostMessage(null);
    try {
      const health = await onProbeLocalHost(hostConnection.endpoint);
      const next = {
        enabled: true,
        endpoint: hostConnection.endpoint,
        ...(health.appUrl === undefined ? {} : { appUrl: health.appUrl }),
      };
      writeLocalHostConnection(next);
      setHostConnection(next);
      setHostMessage(
        health.appUrl === undefined
          ? "Host collegato. L’host non ha pubblicato un indirizzo dell’app."
          : `Host attivo. Apri Nexora da: ${health.appUrl}`,
      );
    } catch {
      setHostMessage(
        "Host non raggiungibile. Avvialo sul PC e verifica l’indirizzo prima di collegarlo.",
      );
    } finally {
      setIsCheckingHost(false);
    }
  };
  const deactivateHost = () => {
    const next = { enabled: false, endpoint: hostConnection.endpoint };
    writeLocalHostConnection(next);
    setHostConnection(next);
    setHostMessage("Host disattivato in questo browser. Il servizio sul PC resta invariato.");
  };
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetPreview, setResetPreview] = useState<FinancialResetPreview | null>(null);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupChecksumPrefix, setBackupChecksumPrefix] = useState<string | null>(null);
  const [skipBackup, setSkipBackup] = useState(false);
  const [resetPin, setResetPin] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [purgeId, setPurgeId] = useState<string | null>(null);
  const [isPurgeAllOpen, setIsPurgeAllOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [isApplicationResetOpen, setIsApplicationResetOpen] = useState(false);
  const [applicationResetPhrase, setApplicationResetPhrase] = useState("");
  const [applicationResetReport, setApplicationResetReport] = useState<TotalResetReport | null>(
    null,
  );
  const [applicationResetMessage, setApplicationResetMessage] = useState<string | null>(null);
  const expiredTrashEntries = countExpiredTrashEntries(
    trashedTransactions,
    preferences.trashRetentionDays,
  );
  const resetFinancialData = async () => {
    if (
      onResetFinancialData === undefined ||
      resetPhrase !== "RESETTA DATI FINANZIARI" ||
      (!skipBackup && backupChecksumPrefix === null)
    )
      return;
    setIsResetting(true);
    setResetMessage(null);
    try {
      await onResetFinancialData({
        ...(backupChecksumPrefix === null ? {} : { backupChecksumPrefix }),
        ...(resetPin === "" ? {} : { pin: resetPin }),
      });
      setResetPhrase("");
      setIsResetOpen(false);
      setResetMessage("Dati finanziari resettati. Preferenze e backup non sono stati modificati.");
    } catch {
      setResetMessage("Reset non completato: i dati esistenti non sono stati modificati.");
    } finally {
      setIsResetting(false);
    }
  };
  return (
    <div id="settings">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Applicazione</p>
          <h1>Impostazioni</h1>
          <p>
            Le preferenze restano salvate solo nel browser e non contengono dati finanziari o
            credenziali.
          </p>
        </div>
      </header>
      <div className="settings-groups">
        <SettingsGroup title="Aspetto">
          <SettingsSelect
            label="Tema"
            value={preferences.theme}
            onChange={(theme) => update({ theme: theme as AppPreferences["theme"] })}
            options={[
              ["light", "Chiaro"],
              ["dark", "Scuro"],
              ["system", "Sistema"],
            ]}
          />
          <SettingsSelect
            label="Dimensione testo"
            value={preferences.textScale}
            onChange={(textScale) =>
              update({ textScale: textScale as AppPreferences["textScale"] })
            }
            options={[
              ["medium", "Media"],
              ["large", "Grande"],
            ]}
          />
          <SettingsToggle
            label="Riduci animazioni"
            checked={preferences.reduceMotion}
            onChange={(reduceMotion) => update({ reduceMotion })}
          />
        </SettingsGroup>
        <SettingsGroup title="Gestione dati">
          <p>
            Gestisci gli elementi archiviati, il cestino e le copie di sicurezza senza esporre
            credenziali o dati finanziari nella pagina.
          </p>
          <SettingsLink label="Elementi archiviati" href="./#categories" />
          <SettingsLink label="Tag archiviati" href="./#tags" />
          <SettingsLink label="Backup ed esportazione" href="./#backup" />
          <SettingsLink label="Esportazione completa" href="./#exports" />
          <SettingsRow label="Archivio locale" value="Locale; non cifrato a riposo" />
        </SettingsGroup>
        <SettingsGroup title="Connessione dispositivi">
          <p>
            Questo dispositivo usa il proprio archivio locale. La sincronizzazione con un host
            Nexora sarà disponibile solo dopo pairing esplicito e connessione protetta.
          </p>
          <SettingsRow
            label="Stato connessione"
            value={hostConnection.enabled ? "Host collegato" : "Solo locale"}
          />
          <SettingsRow label="Origine dati" value="Archivio di questo browser" />
          <label className="settings-row">
            <span>Indirizzo host</span>
            <input
              aria-label="Indirizzo host"
              disabled={isCheckingHost || hostConnection.enabled}
              inputMode="url"
              onChange={(event) =>
                setHostConnection((current) => ({
                  ...current,
                  endpoint: event.currentTarget.value,
                }))
              }
              value={hostConnection.endpoint}
            />
          </label>
          <div className="settings-actions">
            {hostConnection.enabled ? (
              <button className="secondary-action" onClick={deactivateHost} type="button">
                Disattiva host
              </button>
            ) : (
              <button
                className="primary-action"
                disabled={isCheckingHost}
                onClick={() => void activateHost()}
                type="button"
              >
                {isCheckingHost ? "Verifica host…" : "Attiva host"}
              </button>
            )}
          </div>
          {hostMessage === null ? (
            <p className="account-feedback">
              Nessun host condiviso configurato: anche offline puoi continuare a usare Nexora.
            </p>
          ) : (
            <p className="account-feedback" role="status">
              {hostMessage}
            </p>
          )}
        </SettingsGroup>
        {onRestoreTransaction === undefined ? null : (
          <SettingsGroup title="Cestino">
            <p>I movimenti nel cestino non incidono su saldi, budget o analisi.</p>
            <SettingsSelect
              label="Conservazione cestino"
              value={String(preferences.trashRetentionDays)}
              onChange={(value) =>
                update({
                  trashRetentionDays: Number(value) as AppPreferences["trashRetentionDays"],
                })
              }
              options={[
                ["7", "7 giorni"],
                ["30", "30 giorni (predefinito)"],
                ["90", "90 giorni"],
              ]}
            />
            {expiredTrashEntries === 0 ? null : (
              <p className="account-feedback" role="status">
                {expiredTrashEntries} elementi hanno superato la conservazione scelta: verifica e
                conferma manualmente l&apos;eliminazione. Nexora non elimina dati in background.
              </p>
            )}
            {trashedTransactions.length === 0 ? (
              <p>Il cestino è vuoto.</p>
            ) : (
              <>
                {onPurgeTransactions === undefined ? null : (
                  <button
                    className="secondary-action"
                    disabled={isRestoring || isPurging}
                    onClick={() => setIsPurgeAllOpen(true)}
                    type="button"
                  >
                    Svuota cestino
                  </button>
                )}
                <ul className="settings-list">
                  {trashedTransactions.map(({ transaction, deletedAt }) => (
                    <li key={transaction.id}>
                      <span>
                        {transaction.description ?? transaction.payee ?? "Movimento"} ·{" "}
                        {transaction.bookedDate.toString()}
                      </span>
                      <button
                        className="text-action"
                        disabled={isRestoring}
                        onClick={() => {
                          setIsRestoring(true);
                          void onRestoreTransaction(transaction.id).finally(() =>
                            setIsRestoring(false),
                          );
                        }}
                        type="button"
                      >
                        Ripristina
                      </button>
                      {onPurgeTransaction === undefined ? null : (
                        <button
                          className="text-action"
                          disabled={isRestoring || isPurging}
                          onClick={() => setPurgeId(transaction.id)}
                          type="button"
                        >
                          Elimina definitivamente
                        </button>
                      )}
                      <small>
                        Eliminato il {new Intl.DateTimeFormat("it-IT").format(new Date(deletedAt))}
                      </small>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {purgeMessage === null ? null : <p role="status">{purgeMessage}</p>}
            {purgeId === null ? null : (
              <AccessibleDialog
                labelledBy="purge-transaction-title"
                onClose={() => !isPurging && setPurgeId(null)}
              >
                <h2 id="purge-transaction-title">Eliminare definitivamente?</h2>
                <p>
                  Questa operazione non è annullabile. L&apos;audit dell&apos;importazione resta
                  conservato.
                </p>
                <div className="form-actions">
                  <button
                    className="secondary-action"
                    disabled={isPurging}
                    onClick={() => setPurgeId(null)}
                    type="button"
                  >
                    Annulla
                  </button>
                  <button
                    className="primary-action"
                    disabled={isPurging}
                    onClick={() => {
                      if (onPurgeTransaction === undefined) return;
                      setIsPurging(true);
                      setPurgeMessage(null);
                      void onPurgeTransaction(purgeId)
                        .then(() => {
                          setPurgeId(null);
                          setPurgeMessage("Movimento eliminato definitivamente.");
                        })
                        .catch(() =>
                          setPurgeMessage(
                            "Eliminazione non completata: i dati sono rimasti invariati.",
                          ),
                        )
                        .finally(() => setIsPurging(false));
                    }}
                    type="button"
                  >
                    {isPurging ? "Eliminazione…" : "Elimina definitivamente"}
                  </button>
                </div>
              </AccessibleDialog>
            )}
            {isPurgeAllOpen ? (
              <AccessibleDialog
                labelledBy="purge-all-transactions-title"
                onClose={() => !isPurging && setIsPurgeAllOpen(false)}
              >
                <h2 id="purge-all-transactions-title">Svuotare il cestino?</h2>
                <p>
                  Saranno eliminati definitivamente {trashedTransactions.length} movimenti.
                  L&apos;operazione è atomica e conserva l&apos;audit delle importazioni.
                </p>
                <div className="form-actions">
                  <button
                    className="secondary-action"
                    disabled={isPurging}
                    onClick={() => setIsPurgeAllOpen(false)}
                    type="button"
                  >
                    Annulla
                  </button>
                  <button
                    className="primary-action"
                    disabled={isPurging}
                    onClick={() => {
                      if (onPurgeTransactions === undefined) return;
                      setIsPurging(true);
                      setPurgeMessage(null);
                      void onPurgeTransactions(
                        trashedTransactions.map(({ transaction }) => transaction.id),
                      )
                        .then(() => {
                          setIsPurgeAllOpen(false);
                          setPurgeMessage("Cestino svuotato definitivamente.");
                        })
                        .catch(() =>
                          setPurgeMessage(
                            "Svuotamento non completato: i dati sono rimasti invariati.",
                          ),
                        )
                        .finally(() => setIsPurging(false));
                    }}
                    type="button"
                  >
                    {isPurging ? "Svuotamento…" : "Svuota cestino"}
                  </button>
                </div>
              </AccessibleDialog>
            ) : null}
          </SettingsGroup>
        )}
        {onResetFinancialData === undefined ? null : (
          <SettingsGroup title="Zona pericolosa">
            <p>
              Il reset rimuove conti, movimenti, importazioni, budget e pianificazioni dal ledger
              locale.
            </p>
            {resetMessage === null ? null : (
              <p className="account-feedback" role="status">
                {resetMessage}
              </p>
            )}
            <button
              className="secondary-action"
              onClick={() => {
                void onPreviewFinancialReset?.().then(setResetPreview);
                setIsResetOpen(true);
              }}
              type="button"
            >
              Reset dati finanziari
            </button>
            {isResetOpen ? (
              <AccessibleDialog
                labelledBy="reset-financial-title"
                onClose={() => {
                  if (isResetting) return;
                  setResetPhrase("");
                  setBackupPassphrase("");
                  setBackupChecksumPrefix(null);
                  setSkipBackup(false);
                  setResetPin("");
                  setIsResetOpen(false);
                }}
              >
                <h2 id="reset-financial-title">Conferma reset dati finanziari</h2>
                <p>
                  Questo rimuove soltanto i dati finanziari locali. Preferenze, blocco app e backup
                  esistenti restano disponibili.
                </p>
                {resetPreview === null ? null : (
                  <p>
                    <strong>Eliminerai:</strong> {resetPreview.transactions} movimenti,{" "}
                    {resetPreview.accounts} conti, {resetPreview.categories} categorie,{" "}
                    {resetPreview.imports} importazioni e {resetPreview.plans} pianificazioni.{" "}
                    <strong>Restano:</strong> {resetPreview.kept.join(", ")}.
                  </p>
                )}
                {backupChecksumPrefix === null ? (
                  <>
                    <label>
                      Passphrase per un nuovo backup (facoltativo)
                      <input
                        aria-label="Passphrase backup reset"
                        type="password"
                        value={backupPassphrase}
                        onChange={(event) => setBackupPassphrase(event.currentTarget.value)}
                      />
                    </label>
                    <p className="import-help">
                      Il backup è consigliato ma non obbligatorio. Se lo crei, scegli ora una nuova
                      passphrase di almeno 12 caratteri: non è il PIN dell&apos;app e Nexora non può
                      recuperarla per te.
                    </p>
                    <button
                      className="secondary-action"
                      disabled={
                        isResetting ||
                        backupPassphrase.length < 12 ||
                        onCreateResetBackup === undefined
                      }
                      onClick={() =>
                        void onCreateResetBackup?.(backupPassphrase)
                          .then(setBackupChecksumPrefix)
                          .catch(() =>
                            setResetMessage("Backup non creato: i dati non sono stati modificati."),
                          )
                      }
                      type="button"
                    >
                      Crea backup verificato
                    </button>
                    <label>
                      <input
                        aria-label="Procedi senza backup"
                        type="checkbox"
                        checked={skipBackup}
                        onChange={(event) => setSkipBackup(event.currentTarget.checked)}
                      />{" "}
                      Prosegui senza backup (scelta esplicita e irreversibile)
                    </label>
                  </>
                ) : (
                  <p role="status">Backup verificato pronto (checksum {backupChecksumPrefix}…).</p>
                )}
                {requiresResetPin ? (
                  <>
                    <p className="import-help">
                      Il blocco app è attivo. Inserisci il PIN o la passphrase configurati in
                      Privacy e sicurezza. Se non li ricordi, usa il ripristino totale qui sotto:
                      rimuove anche il blocco, ma cancella tutti i dati locali.
                    </p>
                    <label>
                      PIN o passphrase del blocco app
                      <input
                        aria-label="PIN reset finanziario"
                        type="password"
                        value={resetPin}
                        onChange={(event) => setResetPin(event.currentTarget.value)}
                      />
                    </label>
                  </>
                ) : null}
                <label>
                  Digita RESETTA DATI FINANZIARI per confermare
                  <input
                    aria-label="Frase di conferma reset"
                    onChange={(event) => setResetPhrase(event.currentTarget.value)}
                    value={resetPhrase}
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="secondary-action"
                    disabled={isResetting}
                    onClick={() => {
                      setResetPhrase("");
                      setBackupPassphrase("");
                      setBackupChecksumPrefix(null);
                      setSkipBackup(false);
                      setResetPin("");
                      setIsResetOpen(false);
                    }}
                    type="button"
                  >
                    Annulla
                  </button>
                  <button
                    className="primary-action"
                    disabled={
                      isResetting ||
                      resetPhrase !== "RESETTA DATI FINANZIARI" ||
                      (!skipBackup && backupChecksumPrefix === null) ||
                      (requiresResetPin && resetPin === "")
                    }
                    onClick={() => void resetFinancialData()}
                    type="button"
                  >
                    {isResetting ? "Reset in corso…" : "Conferma reset"}
                  </button>
                </div>
              </AccessibleDialog>
            ) : null}
          </SettingsGroup>
        )}
        {onResetApplication === undefined ? null : (
          <SettingsGroup title="Ripristino totale">
            <p>
              Rimuove tutti i dati locali Nexora, inclusi preferenze, blocco app e cache. I backup
              Google Drive non vengono eliminati. Non richiede il PIN del blocco app né la
              passphrase di un backup.
            </p>
            <button
              className="secondary-action"
              onClick={() => setIsApplicationResetOpen(true)}
              type="button"
            >
              Ripristino totale dell’app
            </button>
            {isApplicationResetOpen ? (
              <AccessibleDialog
                labelledBy="reset-application-title"
                onClose={() => !isResetting && setIsApplicationResetOpen(false)}
              >
                <h2 id="reset-application-title">Conferma ripristino totale</h2>
                <p>
                  Cancellerai tutti i dati locali, incluso l&apos;eventuale blocco app. I backup già
                  presenti su Google Drive restano invariati. Se desideri conservarne uno nuovo,
                  annulla e crealo prima dalla sezione Backup.
                </p>
                <label>
                  Digita RIPRISTINA NEXORA per confermare
                  <input
                    aria-label="Frase di conferma ripristino totale"
                    onChange={(event) => setApplicationResetPhrase(event.currentTarget.value)}
                    value={applicationResetPhrase}
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="secondary-action"
                    disabled={isResetting}
                    onClick={() => {
                      setApplicationResetPhrase("");
                      setIsApplicationResetOpen(false);
                    }}
                    type="button"
                  >
                    Annulla
                  </button>
                  <button
                    className="primary-action"
                    disabled={isResetting || applicationResetPhrase !== "RIPRISTINA NEXORA"}
                    onClick={() => {
                      setIsResetting(true);
                      setApplicationResetMessage(null);
                      void onResetApplication({ deleteCloud: false })
                        .then(setApplicationResetReport)
                        .catch(() =>
                          setApplicationResetMessage(
                            "Ripristino non completato: verifica l’archivio locale prima di riprovare.",
                          ),
                        )
                        .finally(() => setIsResetting(false));
                    }}
                    type="button"
                  >
                    {isResetting ? "Ripristino in corso…" : "Ripristina app"}
                  </button>
                </div>
                {applicationResetReport === null ? null : (
                  <p aria-atomic="true" role="status">
                    Reset locale:{" "}
                    {applicationResetReport.local === "succeeded" ? "riuscito" : "non riuscito"}.
                    Backup cloud eliminati: {applicationResetReport.cloudDeleted}; rimanenti:{" "}
                    {applicationResetReport.cloudRemaining}.
                  </p>
                )}
                {applicationResetMessage === null ? null : (
                  <p aria-atomic="true" className="form-error" role="alert">
                    {applicationResetMessage}
                  </p>
                )}
              </AccessibleDialog>
            ) : null}
          </SettingsGroup>
        )}
        <SettingsGroup title="Applicazione">
          <p className="import-help">
            Valuta principale, formato data e giorno iniziale del mese finanziario non sono ancora
            configurabili: per evitare impostazioni solo apparenti, Nexora usa EUR, formato italiano
            e mese civile finché non sarà disponibile una migrazione dati sicura.
          </p>
          <SettingsRow label="Versione app" value={appVersion} />
          <SettingsLink label="Privacy e sicurezza" href="./#privacy-security" />
          <SettingsLink label="Note di rilascio" href="./#overview" />
        </SettingsGroup>
      </div>
    </div>
  );
}
function SettingsGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="data-panel settings-group" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function SettingsRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="settings-row">
      <span>{label}</span>
      <small>{value}</small>
    </div>
  );
}
function SettingsLink({ label, href }: { readonly label: string; readonly href: string }) {
  return (
    <a className="settings-row" href={href}>
      <span>{label}</span>
      <small aria-hidden="true">›</small>
    </a>
  );
}
function SettingsSelect({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly (readonly [string, string])[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="settings-row">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
function SettingsToggle({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-row">
      <span>{label}</span>
      <input
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}
