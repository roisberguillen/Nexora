import type { Account, Category, Transaction } from "@nexora/domain";
import { buildLedgerJson, buildTransactionsCsv, downloadText } from "./exportData";

export function ExportsPage({ accounts, categories, transactions }: { readonly accounts: readonly Account[]; readonly categories: readonly Category[]; readonly transactions: readonly Transaction[] }) {
  const data = { accounts, categories, transactions };
  return <section className="data-panel" id="exports">
    <div className="panel-heading"><div><p className="eyebrow">Portabilità locale</p><h1>Esporta dati</h1><p>Genera un file locale. Nessun dato viene inviato in rete.</p></div></div>
    <div className="form-actions">
      <button className="primary-action" onClick={() => downloadText("nexora-movimenti.csv", buildTransactionsCsv(data), "text/csv;charset=utf-8")} type="button">Scarica CSV movimenti</button>
      <button className="secondary-action" onClick={() => downloadText("nexora-export.json", buildLedgerJson(data), "application/json")} type="button">Scarica JSON completo</button>
    </div>
    <p className="import-help">Il CSV usa importi in minor units per non perdere precisione; il JSON conserva dati contabili, conti e categorie in formato Nexora v1.</p>
  </section>;
}
