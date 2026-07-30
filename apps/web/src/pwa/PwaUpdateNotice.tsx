import { useEffect, useState } from "react";

export const pwaUpdateEventName = "nexora:pwa-update-ready";

export interface PwaUpdateEventDetail {
  readonly applyUpdate: () => void;
}

export function PwaUpdateNotice() {
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | undefined>();

  useEffect(() => {
    const onUpdateReady = (event: Event) => {
      const detail = (event as CustomEvent<PwaUpdateEventDetail>).detail;
      if (detail?.applyUpdate !== undefined) setApplyUpdate(() => detail.applyUpdate);
    };
    window.addEventListener(pwaUpdateEventName, onUpdateReady);
    return () => window.removeEventListener(pwaUpdateEventName, onUpdateReady);
  }, []);

  if (applyUpdate === undefined) return null;
  return (
    <aside
      aria-label="Aggiornamento applicazione disponibile"
      className="pwa-update-notice"
      role="status"
    >
      <p>È disponibile un aggiornamento di Nexora. I dati locali non verranno modificati.</p>
      <button className="primary-action" onClick={applyUpdate} type="button">
        Aggiorna ora
      </button>
    </aside>
  );
}
