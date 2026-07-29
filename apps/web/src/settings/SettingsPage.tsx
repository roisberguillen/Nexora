import { useEffect, useState } from "react";

import {
  applyAppPreferences,
  readAppPreferences,
  writeAppPreferences,
  type AppPreferences,
} from "./preferences";

export function SettingsPage({
  onResetFinancialData,
}: {
  readonly onResetFinancialData?: () => Promise<void>;
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
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const resetFinancialData = async () => {
    if (onResetFinancialData === undefined || resetPhrase !== "RESETTA DATI FINANZIARI") return;
    setIsResetting(true);
    setResetMessage(null);
    try {
      await onResetFinancialData();
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
            <button className="secondary-action" onClick={() => setIsResetOpen(true)} type="button">
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
                    onClick={() => setIsResetOpen(false)}
                    type="button"
                  >
                    Annulla
                  </button>
                  <button
                    className="primary-action"
                    disabled={isResetting || resetPhrase !== "RESETTA DATI FINANZIARI"}
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
        <SettingsGroup title="Applicazione">
          <SettingsRow label="Versione app" value="0.4.0" />
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
