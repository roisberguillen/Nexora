import { NavIcon } from "@nexora/ui";
import { useRef, useState } from "react";

import { readLocalProfile, saveLocalProfile, type LocalProfile } from "./profileStorage";

export function ProfilePage() {
  const [profile, setProfile] = useState<LocalProfile>(() => readLocalProfile());
  const [draft, setDraft] = useState(profile.displayName ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const saveInProgress = useRef(false);
  const displayName = profile.displayName ?? "Nexora";

  const startEditing = () => {
    setDraft(profile.displayName ?? "");
    setFeedback(undefined);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(profile.displayName ?? "");
    setFeedback(undefined);
    setIsEditing(false);
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveInProgress.current) return;
    saveInProgress.current = true;
    setIsSaving(true);
    setFeedback(undefined);
    try {
      const saved = saveLocalProfile(draft);
      setProfile(saved);
      setDraft(saved.displayName ?? "");
      setIsEditing(false);
      setFeedback("Profilo salvato nei dati locali.");
    } catch (cause) {
      setFeedback(
        cause instanceof Error && cause.message === "profile_name_too_long"
          ? "Il nome può contenere al massimo 120 caratteri."
          : "Inserisci un nome visualizzato per salvare il profilo.",
      );
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div id="profile">
      <header className="profile-hero">
        <span aria-hidden="true" className="profile-avatar">
          <NavIcon name="profile" />
        </span>
        <div>
          <p className="eyebrow">Profilo locale</p>
          <h1>{displayName}</h1>
          <p className="profile-hero-copy">
            Gestisci solo le informazioni personali salvate su questo dispositivo.
          </p>
        </div>
      </header>

      <section aria-labelledby="profile-data-heading" className="data-panel profile-identity">
        <div className="profile-section-heading">
          <div>
            <p className="eyebrow">I tuoi dati</p>
            <h2 id="profile-data-heading">Dati del profilo</h2>
          </div>
          <span className="profile-chip">Solo locale</span>
        </div>
        {isEditing ? (
          <form aria-busy={isSaving} className="profile-form" onSubmit={save}>
            <label className="field-label" htmlFor="profile-display-name">
              Nome visualizzato
            </label>
            <input
              autoComplete="name"
              id="profile-display-name"
              maxLength={120}
              onChange={(event) => setDraft(event.target.value)}
              value={draft}
            />
            <p className="import-help">Il nome viene salvato solo nei dati locali di Nexora.</p>
            <div className="profile-form-actions">
              <button className="primary-action" disabled={isSaving} type="submit">
                {isSaving ? "Salvataggio…" : "Salva profilo"}
              </button>
              <button
                className="secondary-action"
                disabled={isSaving}
                onClick={cancelEditing}
                type="button"
              >
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-identity-row">
            <div>
              <span className="profile-field-label">Nome visualizzato</span>
              <strong>{profile.displayName ?? "Non configurato"}</strong>
              <small>
                {profile.displayName === undefined
                  ? "Nessun dato personale è ancora salvato."
                  : "Salvato nei dati locali di questo dispositivo."}
              </small>
            </div>
            <button className="secondary-action" onClick={startEditing} type="button">
              Modifica profilo
            </button>
          </div>
        )}
        {feedback ? (
          <p
            aria-live="polite"
            className={
              feedback.startsWith("Profilo salvato") ? "account-feedback" : "account-error"
            }
            role="status"
          >
            {feedback}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="profile-navigation-heading" className="data-panel profile-group">
        <h2 id="profile-navigation-heading">Sicurezza e impostazioni</h2>
        <a className="profile-row" href="./#privacy-security">
          <NavIcon name="settings" />
          <span>Privacy e sicurezza</span>
          <small aria-hidden="true">›</small>
        </a>
        <a className="profile-row" href="./#settings">
          <NavIcon name="settings" />
          <span>Impostazioni</span>
          <small aria-hidden="true">›</small>
        </a>
      </section>
    </div>
  );
}
