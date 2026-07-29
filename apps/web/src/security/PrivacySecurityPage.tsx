import type { BrowserLedger } from "@nexora/database";

export function PrivacySecurityPage({ ledger }: { readonly ledger: BrowserLedger }) {
  const backend = ledger.storageKind === "opfs" ? "SQLite su OPFS" : "IndexedDB";
  return (
    <div id="privacy-security">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Trasparenza locale</p>
          <h1>Privacy e sicurezza</h1>
          <p>Questa pagina descrive la protezione realmente disponibile sul dispositivo.</p>
        </div>
      </header>
      <div className="settings-groups">
        <section className="data-panel settings-group">
          <h2>Archivio attivo</h2>
          <div className="settings-row">
            <span>Backend</span>
            <small>{backend}</small>
          </div>
          <div className="settings-row">
            <span>Cifratura a riposo del ledger</span>
            <small>Non fornita dal browser</small>
          </div>
          <p className="import-help">
            Proteggi profilo utente e dispositivo: un browser già aperto può leggere il ledger
            locale.
          </p>
        </section>
        <section className="data-panel settings-group">
          <h2>Backup</h2>
          <p className="import-help">
            I backup supportati sono cifrati AES-256-GCM con chiave PBKDF2 derivata dalla
            passphrase. La passphrase non viene salvata.
          </p>
        </section>
        <section className="data-panel settings-group">
          <h2>Google Drive</h2>
          <p className="import-help">
            Se configurato, Drive riceve solo archivi già cifrati nell’area privata appDataFolder.
            Il token OAuth resta soltanto in memoria.
          </p>
        </section>
      </div>
    </div>
  );
}
