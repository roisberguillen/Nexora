import {
  detectMoneyManagerMapping,
  dryRunMoneyManagerRows,
  previewMoneyManagerRows,
  readBankWorkbook,
  readPremierBankCsv,
  detectPremierBankCsv,
  resolvePremierBankDefaultAccount,
  resolvePdfStatementDefaultAccount,
  readMoneyManagerWorkbook,
  readBankPdf,
  readGenericCsv,
  type DryRunStatus,
  type MoneyManagerField,
  type MoneyManagerDryRunRow,
  type MoneyManagerMapping,
  type MoneyManagerSheet,
  buildMoneyManagerSemanticPlan,
  moneyManagerCategoryPathKey,
  moneyManagerSemanticKey,
  type MoneyManagerSemanticMapping,
  type MoneyManagerSemanticPlan,
} from "@nexora/importers";
import type {
  Account,
  AccountType,
  Category,
  Transaction,
  TrashedTransaction,
} from "@nexora/domain";
import type { ImportBatch, ImporterType } from "@nexora/domain";
import { formatMinorUnits } from "@nexora/ui";
import { useState, type ChangeEvent } from "react";

import {
  confirmedTransferRowNumbers,
  countCommittableImportRows,
  resolvePreviewAccount,
} from "./importReview";
import { buildImportQualityReport } from "./importQualityReport";
import { loadImportMappingProfiles, saveImportMappingProfile } from "./mappingProfiles";

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

const accountCreationTypes: readonly { readonly type: AccountType; readonly label: string }[] = [
  { type: "checking", label: "Conto corrente" },
  { type: "savings", label: "Risparmio" },
  { type: "cash", label: "Contanti" },
  { type: "investment", label: "Investimento" },
  { type: "loan", label: "Prestito" },
];

export function ImportsPage({
  accounts,
  batches,
  categories,
  onUndo,
  transactions,
  trashedTransactions,
  onCommit,
}: {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly trashedTransactions: readonly TrashedTransaction[];
  readonly onCommit: (input: {
    readonly filename: string;
    readonly importerType: ImporterType;
    readonly rows: readonly MoneyManagerDryRunRow[];
    readonly sourceSha256: string;
    readonly mappingProfileId?: string;
    readonly confirmedTransferRowNumbers?: readonly number[];
    readonly accountsToCreate?: readonly Account[];
    readonly categoriesToCreate?: readonly Category[];
  }) => Promise<void>;
  readonly onUndo: (batchId: string) => Promise<void>;
  readonly batches: readonly ImportBatch[];
}) {
  const [sheets, setSheets] = useState<readonly MoneyManagerSheet[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [mapping, setMapping] = useState<MoneyManagerMapping>({});
  const [mappingProfiles, setMappingProfiles] = useState(loadImportMappingProfiles);
  const [selectedMappingProfileId, setSelectedMappingProfileId] = useState("");
  const [mappingProfileName, setMappingProfileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<{
    readonly filename: string;
    readonly importerType: ImporterType;
    readonly sha256: string;
  } | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isUndoing, setIsUndoing] = useState<string | null>(null);
  const [fallbackAccountName, setFallbackAccountName] = useState("");
  const [rowAccountOverrides, setRowAccountOverrides] = useState<Record<number, string>>({});
  const [confirmedTransferRows, setConfirmedTransferRows] = useState<Record<number, boolean>>({});
  const [accountPlanDecisions, setAccountPlanDecisions] = useState<Record<string, string>>({});

  const selectedSheet = sheets.find((sheet) => sheet.name === selectedSheetName);
  const headers = selectedSheet?.rows[0] ?? [];
  const rawPreview =
    selectedSheet === undefined
      ? []
      : previewMoneyManagerRows(
          selectedSheet.rows.slice(1),
          mapping,
          1,
          selectedSheet.rawRows?.slice(1),
        );
  const preview = rawPreview.map((row) => {
    const account = rowAccountOverrides[row.sourceRowNumber] ?? row.account ?? fallbackAccountName;
    return resolvePreviewAccount(row, account);
  });
  const selectedMappingProfile = mappingProfiles.find(
    (candidate) => candidate.id === selectedMappingProfileId,
  );
  const semanticMapping = mergeSemanticMapping(
    selectedMappingProfile?.semanticMapping,
    accountPlanDecisions,
  );
  const semanticPlan =
    source?.importerType === "money_manager_xlsx"
      ? buildMoneyManagerSemanticPlan(
          preview,
          accounts,
          categories,
          (() => {
            let index = 0;
            return () => `${source.sha256.slice(0, 12)}-${++index}`;
          })(),
          semanticMapping,
        )
      : undefined;
  const dryRun = dryRunMoneyManagerRows(
    preview,
    accounts,
    categories,
    [...transactions, ...trashedTransactions.map((entry) => entry.transaction)],
    semanticPlan,
  );
  const readyCount = dryRun.filter((row) => row.status === "ready").length;
  const reviewCount = dryRun.filter((row) => row.status === "needs_review").length;
  const duplicateCount = dryRun.filter((row) => row.status === "skipped_duplicate").length;
  const confirmedTransferRowsList = confirmedTransferRowNumbers(dryRun, confirmedTransferRows);
  const committableCount = countCommittableImportRows(dryRun, confirmedTransferRows);
  const qualityReport = buildImportQualityReport(batches);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file === undefined) return;
    try {
      const bytes = await file.arrayBuffer();
      const filename = file.name.toLocaleLowerCase("it-IT");
      const genericCsv = filename.endsWith(".csv") ? readGenericCsv(bytes) : undefined;
      const importerType: ImporterType = filename.endsWith(".pdf")
        ? "n26_pdf"
        : genericCsv !== undefined && detectPremierBankCsv(genericCsv.sheets[0]?.rows[0] ?? [])
          ? "mediobanca_csv"
          : genericCsv !== undefined
            ? "generic_csv"
            : filename.includes("mediobanca")
              ? "mediobanca_xlsx"
              : "money_manager_xlsx";
      const workbook =
        importerType === "mediobanca_csv"
          ? readPremierBankCsv(bytes)
          : importerType === "generic_csv"
            ? genericCsv!
            : importerType === "n26_pdf"
              ? await readBankPdf(bytes)
              : importerType === "mediobanca_xlsx"
                ? readBankWorkbook(bytes)
                : readMoneyManagerWorkbook(bytes);
      const initialSheet = workbook.sheets[0];
      if (initialSheet === undefined) throw new Error("empty_workbook");
      setSheets(workbook.sheets);
      setSelectedSheetName(initialSheet.name);
      setMapping(detectMoneyManagerMapping(initialSheet.rows[0] ?? []));
      setSelectedMappingProfileId("");
      setFallbackAccountName(
        importerType === "mediobanca_csv"
          ? resolvePremierBankDefaultAccount(accounts)
          : importerType === "n26_pdf"
            ? resolvePdfStatementDefaultAccount(accounts)
            : "",
      );
      setRowAccountOverrides({});
      setConfirmedTransferRows({});
      setAccountPlanDecisions({});
      setSource({ filename: file.name, importerType, sha256: await sha256(bytes) });
      setError(null);
    } catch (cause) {
      setSheets([]);
      setSelectedSheetName("");
      setMapping({});
      setSelectedMappingProfileId("");
      setSource(null);
      setRowAccountOverrides({});
      setConfirmedTransferRows({});
      setAccountPlanDecisions({});
      setError(
        cause instanceof Error && cause.message === "not_n26_statement"
          ? "Il PDF non è stato riconosciuto come un estratto conto supportato. I dati locali non sono stati modificati."
          : cause instanceof Error && cause.message === "n26_statement_parse_failed"
            ? "Estratto conto riconosciuto, ma non è stato possibile interpretare correttamente i movimenti. Nessun dato locale è stato modificato."
            : "Il file non è un estratto CSV, XLSX o PDF leggibile. I dati locali non sono stati modificati.",
      );
    }
  };

  const selectSheet = (name: string) => {
    const sheet = sheets.find((candidate) => candidate.name === name);
    if (sheet === undefined) return;
    setSelectedSheetName(name);
    setMapping(detectMoneyManagerMapping(sheet.rows[0] ?? []));
    setSelectedMappingProfileId("");
  };

  return (
    <div id="imports">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Importazione locale</p>
          <h1>Importa estratti conto</h1>
          <p>
            Carica un CSV, XLSX o PDF. Verifica le colonne e rivedi ogni riga prima di qualsiasi
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
          <span>Seleziona un estratto CSV, XLSX o PDF</span>
          <input
            accept=".csv,.xlsx,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
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
      {batches.length === 0 ? null : (
        <section aria-labelledby="import-history-title" className="data-panel import-preview-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Audit locale</p>
              <h2 id="import-history-title">Importazioni recenti</h2>
            </div>
            <span className="panel-meta">{batches.length}</span>
          </div>
          <div aria-label="Report qualità importazioni" className="import-summary" role="status">
            <strong>{qualityReport.completionPercent}% contabilizzate</strong>
            <span>{qualityReport.rowsImported} importate</span>
            <span>{qualityReport.rowsSkipped} ignorate</span>
            <span>{qualityReport.rowsFailed} in errore o revisione</span>
          </div>
          <ul className="account-list">
            {batches.map((batch) => (
              <li key={batch.id}>
                <div className="account-copy">
                  <strong>{batch.sourceFilename}</strong>
                  <small>
                    {batch.rowsImported} importate · {batch.rowsSkipped} duplicate ·{" "}
                    {batch.rowsFailed} da revisionare
                  </small>
                </div>
                <span
                  className={`import-status is-${batch.status === "committed" ? "ready" : "needs_review"}`}
                >
                  {batch.status}
                </span>
                {batch.status === "committed" ? (
                  <button
                    className="text-action"
                    disabled={isUndoing !== null}
                    onClick={() => {
                      setIsUndoing(batch.id);
                      void onUndo(batch.id)
                        .catch(() =>
                          setError(
                            "Impossibile annullare il batch: nessun dato è stato modificato.",
                          ),
                        )
                        .finally(() => setIsUndoing(null));
                    }}
                    type="button"
                  >
                    {isUndoing === batch.id ? "Annullamento…" : "Annulla batch"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
      {selectedSheet === undefined ? null : (
        <div className="import-layout">
          {semanticPlan === undefined ? null : (
            <section
              aria-labelledby="money-manager-plan-title"
              className="data-panel import-preview-panel"
            >
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Money Manager riconosciuto</p>
                  <h2 id="money-manager-plan-title">Piano di migrazione</h2>
                  <p className="import-file-name">File: {source?.filename}</p>
                </div>
                <span className="panel-meta">{preview.length} movimenti</span>
              </div>
              <div className="import-mapping-content">
                <h3>Conti rilevati</h3>
                <ul className="account-list">
                  {semanticPlan.accounts.map((item) => (
                    <li key={item.sourceName}>
                      <div className="account-copy">
                        <strong>{item.sourceName}</strong>
                        <small>
                          {item.status === "existing"
                            ? `Esistente · ${item.currency ?? "—"}`
                            : item.status === "to_create"
                              ? `${item.proposedAccount?.type ?? "account"} · ${item.currency ?? "—"} · verrà creato alla conferma`
                              : "Richiede una decisione unica"}
                        </small>
                      </div>
                      <span
                        className={`import-status is-${item.status === "needs_review" ? "needs_review" : "ready"}`}
                      >
                        {item.status === "existing"
                          ? "Esistente"
                          : item.status === "to_create"
                            ? "Da creare"
                            : "Da revisionare"}
                      </span>
                      {item.status === "needs_review" ? (
                        <label className="account-form-label">
                          Risoluzione per {item.sourceName}
                          <select
                            onChange={(event) =>
                              setAccountPlanDecisions((current) => ({
                                ...current,
                                [moneyManagerSemanticKey(item.sourceName)]: event.target.value,
                              }))
                            }
                            value={
                              accountPlanDecisions[moneyManagerSemanticKey(item.sourceName)] ?? ""
                            }
                          >
                            <option value="">Scegli una sola volta</option>
                            {accounts
                              .filter(
                                (account) =>
                                  !account.isArchived && account.currency === item.currency,
                              )
                              .map((account) => (
                                <option key={account.id} value={`account:${account.id}`}>
                                  Usa {account.name}
                                </option>
                              ))}
                            {accountCreationTypes.map(({ type, label }) => (
                              <option key={type} value={`create:${type}`}>
                                Crea come {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <h3>Categorie Money Manager</h3>
                <ul className="account-list">
                  {semanticPlan.categories.map((item) => (
                    <li key={`${item.sourceCategory}/${item.sourceSubcategory ?? ""}`}>
                      <div className="account-copy">
                        <strong>
                          {item.sourceCategory}
                          {item.sourceSubcategory === undefined
                            ? ""
                            : ` / ${item.sourceSubcategory}`}
                        </strong>
                        <small>
                          {item.status === "existing"
                            ? "Esistente"
                            : item.status === "to_create"
                              ? "Verrà creata alla conferma"
                              : "Richiede mapping"}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="import-summary" role="status">
                  <span>
                    {dryRun.filter((row) => row.kind === "transfer").length} trasferimenti
                  </span>
                  <span>{dryRun.filter((row) => row.kind === "adjustment").length} rettifiche</span>
                  <span>{semanticPlan.accountsToCreate.length} conti da creare</span>
                  <span>{semanticPlan.categoriesToCreate.length} categorie da creare</span>
                </div>
              </div>
            </section>
          )}
          <section aria-labelledby="mapping-title" className="data-panel import-mapping-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Passo 2 di 4</p>
                <h2 id="mapping-title">Foglio e colonne</h2>
                <p className="import-file-name">File: {source?.filename}</p>
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
                disponibili. Per un estratto senza colonna conto, seleziona il conto locale sotto.
              </p>
              {source?.importerType === "mediobanca_csv" ? (
                <p className="import-help">Data movimento: Data valuta.</p>
              ) : null}
              <label className="account-form-label">
                Conto locale predefinito
                <select
                  onChange={(event) => setFallbackAccountName(event.target.value)}
                  value={fallbackAccountName}
                >
                  <option value="">Usa la colonna dell'estratto</option>
                  {accounts
                    .filter((account) => !account.isArchived)
                    .map((account) => (
                      <option key={account.id} value={account.name}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
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
                        setSelectedMappingProfileId("");
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
              <div className="mapping-grid">
                <label className="account-form-label">
                  Profilo mapping
                  <select
                    onChange={(event) => {
                      const id = event.target.value;
                      setSelectedMappingProfileId(id);
                      const profile = mappingProfiles.find((candidate) => candidate.id === id);
                      if (profile !== undefined) {
                        setMapping(profile.mapping);
                        setAccountPlanDecisions({});
                      }
                    }}
                    value={selectedMappingProfileId}
                  >
                    <option value="">Mapping rilevato o personalizzato</option>
                    {mappingProfiles
                      .filter((profile) => profile.importerType === source?.importerType)
                      .map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="account-form-label">
                  Nome nuovo profilo
                  <input
                    maxLength={80}
                    onChange={(event) => setMappingProfileName(event.target.value)}
                    value={mappingProfileName}
                  />
                </label>
              </div>
              <div className="form-actions">
                <button
                  className="secondary-action"
                  disabled={source === null || mappingProfileName.trim() === ""}
                  onClick={() => {
                    if (source === null) return;
                    const profile = {
                      id: `mapping-${crypto.randomUUID()}`,
                      name: mappingProfileName,
                      importerType: source.importerType,
                      mapping,
                      ...(semanticPlan === undefined
                        ? {}
                        : { semanticMapping: semanticMappingFromPlan(semanticPlan) }),
                    } as const;
                    setMappingProfiles(saveImportMappingProfile(profile));
                    setSelectedMappingProfileId(profile.id);
                    setMappingProfileName("");
                  }}
                  type="button"
                >
                  Salva profilo mapping
                </button>
              </div>
            </div>
          </section>

          <section aria-labelledby="preview-title" className="data-panel import-preview-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Passo 3 di 4</p>
                <h2 id="preview-title">Anteprima e revisione</h2>
                <p className="import-file-name">File: {source?.filename}</p>
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
                <caption className="sr-only">Anteprima delle righe dell'estratto locale</caption>
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
                      <td data-label="Conto">
                        {semanticPlan === undefined ? (
                          <>
                            <label
                              className="sr-only"
                              htmlFor={`import-account-${row.preview.sourceRowNumber}`}
                            >
                              Conto per riga {row.preview.sourceRowNumber}
                            </label>
                            <select
                              id={`import-account-${row.preview.sourceRowNumber}`}
                              onChange={(event) =>
                                setRowAccountOverrides((current) => ({
                                  ...current,
                                  [row.preview.sourceRowNumber]: event.target.value,
                                }))
                              }
                              value={row.preview.account ?? ""}
                            >
                              <option value="">Da risolvere</option>
                              {accounts
                                .filter((account) => !account.isArchived)
                                .map((account) => (
                                  <option key={account.id} value={account.name}>
                                    {account.name}
                                  </option>
                                ))}
                            </select>
                          </>
                        ) : (
                          <span>
                            {accounts.find((account) => account.id === row.accountId)?.name ??
                              semanticPlan.accounts.find(
                                (item) => item.targetAccountId === row.accountId,
                              )?.proposedAccount?.name ??
                              row.preview.account ??
                              "Da risolvere"}
                          </span>
                        )}
                      </td>
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
                        {row.transferCandidateAccountId === undefined ||
                        row.kind === "transfer" ? null : (
                          <label className="import-transfer-confirmation">
                            <input
                              checked={confirmedTransferRows[row.preview.sourceRowNumber] ?? false}
                              onChange={(event) =>
                                setConfirmedTransferRows((current) => ({
                                  ...current,
                                  [row.preview.sourceRowNumber]: event.target.checked,
                                }))
                              }
                              type="checkbox"
                            />
                            Confermo trasferimento verso{" "}
                            {accounts.find(
                              (account) => account.id === row.transferCandidateAccountId,
                            )?.name ?? "conto locale"}
                          </label>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="import-next-step">
              Nessuna riga è stata ancora salvata. La conferma crea un batch atomico e conserva le
              righe da revisionare o duplicate nell’audit.
            </p>
            <div className="form-actions">
              <button
                className="primary-action"
                disabled={source === null || committableCount === 0 || isCommitting}
                onClick={() => {
                  if (source === null) return;
                  setIsCommitting(true);
                  setError(null);
                  void onCommit({
                    filename: source.filename,
                    importerType: source.importerType,
                    rows: dryRun,
                    confirmedTransferRowNumbers: confirmedTransferRowsList,
                    sourceSha256: source.sha256,
                    ...(semanticPlan === undefined
                      ? {}
                      : {
                          accountsToCreate: semanticPlan.accountsToCreate,
                          categoriesToCreate: semanticPlan.categoriesToCreate,
                        }),
                    ...(selectedMappingProfileId === ""
                      ? {}
                      : { mappingProfileId: selectedMappingProfileId }),
                  })
                    .catch(() =>
                      setError(
                        "L’importazione non è stata completata: nessun movimento è stato salvato.",
                      ),
                    )
                    .finally(() => setIsCommitting(false));
                }}
                type="button"
              >
                {isCommitting ? "Importazione in corso…" : `Conferma ${committableCount} righe`}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function mergeSemanticMapping(
  saved: MoneyManagerSemanticMapping | undefined,
  decisions: Readonly<Record<string, string>>,
): MoneyManagerSemanticMapping {
  const accountMappings = { ...(saved?.accountMappings ?? {}) };
  const accountConfigurations = { ...(saved?.accountConfigurations ?? {}) };
  for (const [sourceName, decision] of Object.entries(decisions)) {
    if (decision.startsWith("account:")) {
      accountMappings[sourceName] = decision.slice("account:".length);
      delete accountConfigurations[sourceName];
    } else if (decision.startsWith("create:")) {
      accountConfigurations[sourceName] = {
        type: decision.slice("create:".length) as AccountType,
      };
      delete accountMappings[sourceName];
    }
  }
  return {
    accountMappings: Object.freeze(accountMappings),
    accountConfigurations: Object.freeze(accountConfigurations),
    categoryMappings: saved?.categoryMappings ?? {},
  };
}

function semanticMappingFromPlan(plan: MoneyManagerSemanticPlan): MoneyManagerSemanticMapping {
  return {
    accountMappings: Object.freeze(
      Object.fromEntries(
        plan.accounts
          .filter((item) => item.targetAccountId !== undefined)
          .map((item) => [moneyManagerSemanticKey(item.sourceName), item.targetAccountId!]),
      ),
    ),
    accountConfigurations: Object.freeze(
      Object.fromEntries(
        plan.accounts
          .filter((item) => item.proposedAccount !== undefined)
          .map((item) => [
            moneyManagerSemanticKey(item.sourceName),
            {
              type: item.proposedAccount!.type,
              ...(item.proposedAccount!.institution === undefined
                ? {}
                : { institution: item.proposedAccount!.institution }),
            },
          ]),
      ),
    ),
    categoryMappings: Object.freeze(
      Object.fromEntries(
        plan.categories
          .filter((item) => item.targetCategoryId !== undefined)
          .map((item) => [
            moneyManagerCategoryPathKey(item.sourceCategory, item.sourceSubcategory),
            item.targetCategoryId!,
          ]),
      ),
    ),
  };
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
