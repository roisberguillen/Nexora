import type { Account, Category, Transaction } from "@nexora/domain";
import { useState } from "react";
import { buildLedgerWorkbook } from "@nexora/importers";
import { buildLedgerJson, buildTransactionsCsv, buildTransactionsRows, downloadBytes, downloadText, filterExportTransactions } from "./exportData";

export function ExportsPage({ accounts, categories, transactions }: { readonly accounts: readonly Account[]; readonly categories: readonly Category[]; readonly transactions: readonly Transaction[] }) {
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filteredTransactions = filterExportTransactions(transactions, { ...(accountId === "" ? {} : { accountId }), ...(categoryId === "" ? {} : { categoryId }), ...(from === "" ? {} : { from }), ...(to === "" ? {} : { to }) });
  const data = { accounts, categories, transactions: filteredTransactions };
  return <section className="data-panel" id="exports">
    <div className="panel-heading"><div><p className="eyebrow">Portabilità locale</p><h1>Esporta dati</h1><p>Genera un file locale. Nessun dato viene inviato in rete.</p></div></div>
    <div className="mapping-grid">
      <label className="account-form-label">Dal <input onChange={(event) => setFrom(event.target.value)} type="date" value={from} /></label>
      <label className="account-form-label">Al <input onChange={(event) => setTo(event.target.value)} type="date" value={to} /></label>
      <label className="account-form-label">Conto <select onChange={(event) => setAccountId(event.target.value)} value={accountId}><option value="">Tutti i conti</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label className="account-form-label">Categoria <select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}><option value="">Tutte le categorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    </div>
    <p aria-live="polite" className="import-help">{filteredTransactions.length} movimenti inclusi.</p>
    <div className="form-actions">
      <button className="primary-action" onClick={() => downloadText("nexora-movimenti.csv", buildTransactionsCsv(data), "text/csv;charset=utf-8")} type="button">Scarica CSV movimenti</button>
      <button className="secondary-action" onClick={() => downloadBytes("nexora-movimenti.xlsx", buildLedgerWorkbook(buildTransactionsRows(data)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")} type="button">Scarica XLSX movimenti</button>
      <button className="secondary-action" onClick={() => downloadText("nexora-export.json", buildLedgerJson(data), "application/json")} type="button">Scarica JSON completo</button>
    </div>
    <p className="import-help">Il CSV usa importi in minor units per non perdere precisione; il JSON conserva dati contabili, conti e categorie in formato Nexora v1.</p>
  </section>;
}
