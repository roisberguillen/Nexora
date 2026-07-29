import { useEffect, useState } from "react";
import type { TrashedTransaction } from "@nexora/domain";

import { appVersion } from "../appVersion";
import type { FinancialResetPreview } from "../reset/financialReset";

import {
  applyAppPreferences,
  readAppPreferences,
  writeAppPreferences,
  type AppPreferences,
} from "./preferences";

export function SettingsPage({
  onResetFinancialData,
  onCreateResetBackup,
  requiresResetPin = false,
  onPreviewFinancialReset,
  onRestoreTransaction,
  onPurgeTransaction,
  onResetApplication,
  trashedTransactions = [],
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
  readonly onResetApplication?: () => Promise<void>;
  readonly trashedTransactions?: readonly TrashedTransaction[];
}) {
  const [preferences, setPreferences] = useState<AppPreferences>(() => readAppPreferences());
  useEffect(() => {
    applyAppPreferences(preferences);
    writeAppPreferences(preferences);
  }, [preferences]);
  const update = (patch: Partial<AppPreferences>) =>
    setPreferences((current) => ({ ...current, ...patch }));
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
  const [isPurging, setIsPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [isApplicationResetOpen, setIsApplicationResetOpen] = useState(false);
  const [applicationResetPhrase, setApplicationResetPhrase] = useState("");
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
        <SettingsGroup title="Preferenze finanziarie">
          <SettingsRow label="Valuta principale" value="EUR" />
          <SettingsRow label="Formato data" value="GG/MM/AAAA" />
          <SettingsRow label="Mese finanziario" value="Gennaio" />
        </SettingsGroup>
        <SettingsGroup title="Dati e sicurezza">
          <SettingsLink label="Backup" href="./#backup" />
          <SettingsLink label="Esportazione completa" href="./#exports" />
          <SettingsRow label="Archivio locale" value="Locale; non cifrato a riposo" />
        </SettingsGroup>
        {onRestoreTransaction === undefined ? null : (
          <SettingsGroup title="Cestino movimenti">
            <p>I movimenti nel cestino non incidono su saldi, budget o analisi.</p>
            {trashedTransactions.length === 0 ? (
              <p>Il cestino è vuoto.</p>
            ) : (
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
            )}
            {purgeMessage === null ? null : <p role="status">{purgeMessage}</p>}
            {purgeId === null ? null : (
              <div
                aria-labelledby="purge-transaction-title"
                aria-modal="true"
                className="account-feedback"
                role="dialog"
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
              </div>
            )}
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
              <div
                aria-labelledby="reset-financial-title"
                aria-modal="true"
                className="account-feedback"
                role="dialog"
              >
                <h2 id="reset-financial-title">Conferma reset dati finanziari</h2>
                <p>
                  Backup e preferenze restano disponibili. Scrivi la frase richiesta per continuare.
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
                      Passphrase del backup cifrato
                      <input
                        aria-label="Passphrase backup reset"
                        type="password"
                        value={backupPassphrase}
                        onChange={(event) => setBackupPassphrase(event.currentTarget.value)}
                      />
                    </label>
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
                      Prosegui senza backup (scelta esplicita)
                    </label>
                  </>
                ) : (
                  <p role="status">Backup verificato pronto (checksum {backupChecksumPrefix}…).</p>
                )}
                {requiresResetPin ? (
                  <label>
                    PIN o passphrase app
                    <input
                      aria-label="PIN reset finanziario"
                      type="password"
                      value={resetPin}
                      onChange={(event) => setResetPin(event.currentTarget.value)}
                    />
                  </label>
                ) : null}
                <label>
                  Frase di conferma
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
              </div>
            ) : null}
          </SettingsGroup>
        )}
        {onResetApplication === undefined ? null : (
          <SettingsGroup title="Ripristino totale">
            <p>
              Rimuove tutti i dati locali Nexora, inclusi preferenze, blocco app e cache. I backup
              Google Drive non vengono eliminati.
            </p>
            <button
              className="secondary-action"
              onClick={() => setIsApplicationResetOpen(true)}
              type="button"
            >
              Ripristino totale dell’app
            </button>
            {isApplicationResetOpen ? (
              <div
                aria-labelledby="reset-application-title"
                aria-modal="true"
                className="account-feedback"
                role="dialog"
              >
                <h2 id="reset-application-title">Conferma ripristino totale</h2>
                <p>
                  Crea un backup dalla sezione Backup prima di continuare. Scrivi la frase richiesta
                  per confermare.
                </p>
                <label>
                  Frase di conferma
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
                      void onResetApplication().finally(() => setIsResetting(false));
                    }}
                    type="button"
                  >
                    {isResetting ? "Ripristino in corso…" : "Ripristina app"}
                  </button>
                </div>
              </div>
            ) : null}
          </SettingsGroup>
        )}
        <SettingsGroup title="Applicazione">
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
