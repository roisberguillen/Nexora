import {
  detectMoneyManagerMapping,
  dryRunMoneyManagerRows,
  previewMoneyManagerRows,
  readMoneyManagerWorkbook,
  type DryRunStatus,
  type MoneyManagerField,
  type MoneyManagerMapping,
  type MoneyManagerSheet,
} from "@nexora/importers";
import type { Account, Category, Transaction } from "@nexora/domain";
import { formatMinorUnits } from "@nexora/ui";
import { useState, type ChangeEvent } from "react";

const mappingFields: readonly { readonly field: MoneyManagerField; readonly label: string }[] = [
  { field: "date", label: "Data" },
  { field: "account", label: "Conto" },
  { field: "amount", label: "Importo" },
  { field: "category", label: "Categoria" },
  { field: "currency", label: "Valuta" },
  { field: "payee", label: "Controparte" },
  { field: "note", label: "Nota" },
  { field: "type", label: "Tipo" },
];

export function ImportsPage({
  accounts,
  categories,
  transactions,
}: {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
}) {
  const [sheets, setSheets] = useState<readonly MoneyManagerSheet[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [mapping, setMapping] = useState<MoneyManagerMapping>({});
  const [error, setError] = useState<string | null>(null);

  const selectedSheet = sheets.find((sheet) => sheet.name === selectedSheetName);
  const headers = selectedSheet?.rows[0] ?? [];
  const preview =
    selectedSheet === undefined
      ? []
      : previewMoneyManagerRows(selectedSheet.rows.slice(1), mapping);
  const dryRun = dryRunMoneyManagerRows(preview, accounts, categories, transactions);
  const readyCount = dryRun.filter((row) => row.status === "ready").length;
  const reviewCount = dryRun.filter((row) => row.status === "needs_review").length;
  const duplicateCount = dryRun.filter((row) => row.status === "skipped_duplicate").length;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file === undefined) return;
    try {
      const workbook = readMoneyManagerWorkbook(await file.arrayBuffer());
      const initialSheet = workbook.sheets[0];
      if (initialSheet === undefined) throw new Error("empty_workbook");
      setSheets(workbook.sheets);
      setSelectedSheetName(initialSheet.name);
      setMapping(detectMoneyManagerMapping(initialSheet.rows[0] ?? []));
      setError(null);
    } catch {
      setSheets([]);
      setSelectedSheetName("");
      setMapping({});
      setError(
        "Il file non è un workbook XLSX leggibile. I dati locali non sono stati modificati.",
      );
    }
  };

  const selectSheet = (name: string) => {
    const sheet = sheets.find((candidate) => candidate.name === name);
    if (sheet === undefined) return;
    setSelectedSheetName(name);
    setMapping(detectMoneyManagerMapping(sheet.rows[0] ?? []));
  };

  return (
    <div id="imports">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Importazione locale</p>
          <h1>Importa da Money Manager</h1>
          <p>
            Carica un file XLSX, verifica le colonne e rivedi ogni riga prima di qualsiasi
            importazione nel ledger.
          </p>
        </div>
      </header>

      <section aria-labelledby="upload-title" className="import-upload-panel">
        <div>
          <p className="eyebrow">Passo 1 di 4</p>
          <h2 id="upload-title">Scegli il file esportato</h2>
          <p>Il file resta nel browser: questa fase legge soltanto l’anteprima.</p>
        </div>
        <label className="file-picker">
          <span>Seleziona un file XLSX</span>
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => void handleFile(event)}
            type="file"
          />
        </label>
      </section>

      {error === null ? null : (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      {selectedSheet === undefined ? null : (
        <div className="import-layout">
          <section aria-labelledby="mapping-title" className="data-panel import-mapping-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Passo 2 di 4</p>
                <h2 id="mapping-title">Foglio e colonne</h2>
              </div>
              <span className="panel-meta">{selectedSheet.rows.length - 1}</span>
            </div>
            <div className="import-mapping-content">
              <label className="account-form-label">
                Foglio da importare
                <select
                  onChange={(event) => selectSheet(event.target.value)}
                  value={selectedSheetName}
                >
                  {sheets.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="import-help">
                Le colonne rilevate vengono proposte automaticamente. Lascia vuoti i campi non
                disponibili.
              </p>
              <div className="mapping-grid">
                {mappingFields.map(({ field, label }) => (
                  <label className="account-form-label" key={field}>
                    {label}
                    <select
                      onChange={(event) => {
                        const value = event.target.value;
                        setMapping(
                          updateMapping(mapping, field, value === "" ? undefined : Number(value)),
                        );
                      }}
                      value={mapping[field] ?? ""}
                    >
                      <option value="">Non disponibile</option>
                      {headers.map((header, index) => (
                        <option key={`${header}-${index}`} value={index}>
                          {header || `Colonna ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="preview-title" className="data-panel import-preview-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Passo 3 di 4</p>
                <h2 id="preview-title">Anteprima e revisione</h2>
              </div>
              <span className="panel-meta">{preview.length}</span>
            </div>
            <div aria-live="polite" className="import-summary" role="status">
              <strong>{readyCount} pronte</strong>
              <span>{reviewCount} da revisionare</span>
              <span>{duplicateCount} duplicate</span>
            </div>
            <div className="account-table-wrap">
              <table className="account-table import-table">
                <caption className="sr-only">Anteprima delle righe del file XLSX</caption>
                <thead>
                  <tr>
                    <th>Riga</th>
                    <th>Data</th>
                    <th>Conto</th>
                    <th>Importo</th>
                    <th>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {dryRun.map((row) => (
                    <tr key={row.preview.sourceRowNumber}>
                      <td data-label="Riga">{row.preview.sourceRowNumber}</td>
                      <td data-label="Data">{row.preview.date ?? "—"}</td>
                      <td data-label="Conto">{row.preview.account ?? "—"}</td>
                      <td data-label="Importo">
                        {row.preview.amountMinor === undefined
                          ? "—"
                          : formatMinor(row.preview.amountMinor, row.preview.currency ?? "EUR")}
                      </td>
                      <td data-label="Stato">
                        <span className={`import-status is-${row.status}`}>
                          {dryRunLabel(row.status)}
                        </span>
                        <small>{row.message}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="import-next-step">
              Passo 4 sarà disponibile dopo la validazione, deduplica e dry-run. Nessuna riga è
              stata ancora salvata.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function formatMinor(amountMinor: bigint, currency: string): string {
  return formatMinorUnits(amountMinor, currency);
}

function updateMapping(
  mapping: MoneyManagerMapping,
  field: MoneyManagerField,
  value: number | undefined,
): MoneyManagerMapping {
  const entries = Object.entries(mapping).filter(([key]) => key !== field);
  if (value !== undefined) entries.push([field, value]);
  return Object.freeze(Object.fromEntries(entries) as MoneyManagerMapping);
}

function dryRunLabel(status: DryRunStatus): string {
  return status === "ready"
    ? "Pronta"
    : status === "skipped_duplicate"
      ? "Duplicata"
      : "Da revisionare";
}
