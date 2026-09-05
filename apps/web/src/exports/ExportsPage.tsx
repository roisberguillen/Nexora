import type { Account, Category, Transaction } from "@nexora/domain";
import { useState } from "react";
import { useRef } from "react";
import { buildLedgerWorkbook } from "@nexora/importers";
import {
  buildTransactionsCsv,
  buildTransactionsRows,
  downloadBytes,
  downloadText,
  filterExportTransactions,
} from "./exportData";

export function ExportsPage({
  accounts,
  categories,
  transactions,
  onExportCompleteJson,
}: {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly onExportCompleteJson: () => Promise<Uint8Array>;
}) {
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activeExport, setActiveExport] = useState<"csv" | "xlsx" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportLock = useRef(false);
  const filteredTransactions = filterExportTransactions(transactions, {
    ...(accountId === "" ? {} : { accountId }),
    ...(categoryId === "" ? {} : { categoryId }),
    ...(from === "" ? {} : { from }),
    ...(to === "" ? {} : { to }),
  });
  const data = { accounts, categories, transactions: filteredTransactions };
  const runSyncExport = (format: "csv" | "xlsx", action: () => void) => {
    if (exportLock.current) return;
    exportLock.current = true;
    setActiveExport(format);
    setExportError(null);
    try {
      action();
    } catch {
      setExportError("L’esportazione non è riuscita.");
    } finally {
      exportLock.current = false;
      setActiveExport(null);
    }
  };
  return (
    <section className="data-panel" id="exports">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Portabilità locale</p>
          <h1>Esporta dati</h1>
          <p>Genera un file locale. Nessun dato viene inviato in rete.</p>
        </div>
      </div>
      <div className="mapping-grid">
        <label className="account-form-label">
          Dal <input onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        </label>
        <label className="account-form-label">
          Al <input onChange={(event) => setTo(event.target.value)} type="date" value={to} />
        </label>
        <label className="account-form-label">
          Conto{" "}
          <select onChange={(event) => setAccountId(event.target.value)} value={accountId}>
            <option value="">Tutti i conti</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="account-form-label">
          Categoria{" "}
          <select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
            <option value="">Tutte le categorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p aria-live="polite" className="import-help">
        {filteredTransactions.length === 0
          ? "Nessun movimento corrisponde ai filtri selezionati."
          : `${filteredTransactions.length} movimenti inclusi.`}
      </p>
      <div className="form-actions">
        <button
          className="primary-action"
          disabled={activeExport !== null || filteredTransactions.length === 0}
          onClick={() =>
            runSyncExport("csv", () =>
              downloadText(
                "nexora-movimenti.csv",
                buildTransactionsCsv(data),
                "text/csv;charset=utf-8",
              ),
            )
          }
          type="button"
        >
          {activeExport === "csv" ? "Preparazione CSV…" : "Scarica CSV movimenti"}
        </button>
        <button
          className="secondary-action"
          disabled={activeExport !== null || filteredTransactions.length === 0}
          onClick={() =>
            runSyncExport("xlsx", () =>
              downloadBytes(
                "nexora-movimenti.xlsx",
                buildLedgerWorkbook(buildTransactionsRows(data)),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ),
            )
          }
          type="button"
        >
          {activeExport === "xlsx" ? "Preparazione XLSX…" : "Scarica XLSX movimenti"}
        </button>
        <button
          className="secondary-action"
          disabled={activeExport !== null}
          onClick={() => {
            if (exportLock.current) return;
            exportLock.current = true;
            setActiveExport("json");
            setExportError(null);
            void onExportCompleteJson()
              .then((bytes) =>
                downloadBytes("nexora-ledger-completo.json", bytes, "application/json"),
              )
              .catch(() => setExportError("L’esportazione completa non è riuscita."))
              .finally(() => {
                exportLock.current = false;
                setActiveExport(null);
              });
          }}
          type="button"
        >
          {activeExport === "json" ? "Preparazione JSON…" : "Scarica JSON completo"}
        </button>
      </div>
      {exportError === null ? null : <p role="alert">{exportError}</p>}
      <p className="import-help">
        CSV e XLSX rispettano i filtri. Il JSON completo include tutte le entità e relazioni del
        ledger in formato portabile Nexora v1, senza applicare filtri impliciti.
      </p>
    </section>
  );
}
