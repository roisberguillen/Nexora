import { useState } from "react";

import { AccessibleDialog } from "../settings/AccessibleDialog";
import {
  dismissGoogleDriveOnboarding,
  useGoogleDriveSession,
  wasGoogleDriveOnboardingDismissed,
} from "./GoogleDriveSessionContext";

export function GoogleDriveOnboarding() {
  const session = useGoogleDriveSession();
  const [dismissed, setDismissed] = useState(() => wasGoogleDriveOnboardingDismissed());
  const [error, setError] = useState<string>();

  if (!session.config.enabled || session.status === "connected" || dismissed) return null;

  const continueWithoutDrive = () => {
    dismissGoogleDriveOnboarding();
    setDismissed(true);
  };

  const connect = async () => {
    setError(undefined);
    try {
      await session.connect();
    } catch {
      setError(
        "Collegamento non riuscito. Nessun dato locale è stato condiviso: puoi riprovare o continuare senza Drive.",
      );
    }
  };

  return (
    <div className="google-drive-onboarding-overlay" role="presentation">
      <AccessibleDialog labelledBy="google-drive-onboarding-title" onClose={continueWithoutDrive}>
        <p className="eyebrow">Backup Google Drive</p>
        <h2 id="google-drive-onboarding-title">Collega il tuo account Google</h2>
        <p>
          Scegli il tuo account Google per conservare su Drive copie cifrate dei backup Nexora.
          L’app continua a funzionare anche senza collegamento.
        </p>
        <ul className="google-drive-onboarding-benefits">
          <li>Google riceve soltanto archivi già cifrati.</li>
          <li>Nexora usa una cartella privata dedicata.</li>
          <li>Il token resta in memoria fino alla chiusura dell’app.</li>
        </ul>
        {error === undefined ? null : (
          <p aria-live="polite" className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            className="primary-action"
            disabled={session.status === "authorizing"}
            onClick={() => void connect()}
            type="button"
          >
            {session.status === "authorizing" ? "Apertura Google…" : "Collega Google Drive"}
          </button>
          <button
            className="secondary-action"
            disabled={session.status === "authorizing"}
            onClick={continueWithoutDrive}
            type="button"
          >
            Continua senza Drive
          </button>
        </div>
      </AccessibleDialog>
    </div>
  );
}
