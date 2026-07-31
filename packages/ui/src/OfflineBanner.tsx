import { type ReactElement, useEffect, useState } from "react";

function readOnlineStatus(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/** Visible only during a real connectivity loss; local ledger work remains available. */
export function OfflineBanner(): ReactElement | null {
  const [isOnline, setIsOnline] = useState(readOnlineStatus);

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  if (isOnline) return null;
  return (
    <p aria-live="polite" className="offline-banner" role="status">
      Sei offline: puoi continuare a consultare e registrare i dati locali.
    </p>
  );
}
