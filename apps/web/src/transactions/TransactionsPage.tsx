import { FinancialAmount } from "@nexora/ui";
import { categoryLabel, type Tag } from "@nexora/domain";
import { useEffect, useState, type FormEvent } from "react";

import "./transactions.css";
import { parseLocalizedAmountMinor } from "../accounts/accountCommands";
import { localCivilDate } from "../date/localCivilDate";
import { AccessibleDialog } from "../settings/AccessibleDialog";
import {
  signedAmountForKind,
  type CreateManualTransactionInput,
  type CreateTransferInput,
} from "./transactionCommands";
import type { TransactionsViewModel } from "./buildTransactionsViewModel";
import { previewTrashSelection } from "./trashSelection";
import { paginateTransactions, transactionPageSize } from "./pagination";

interface TransactionsPageProps {
  readonly initialEditorOpen?: boolean;
  readonly model: TransactionsViewModel;
  readonly standaloneEditor?: boolean;
  readonly tags: readonly Tag[];
  readonly onCancel: (id: string, isTransfer: boolean) => Promise<void>;
  readonly onTrash: (id: string) => Promise<void>;
  readonly onTrashMany: (ids: readonly string[]) => Promise<void>;
  readonly onCreateManual: (input: CreateManualTransactionInput) => Promise<readonly string[]>;
  readonly onCreateTransfer: (input: CreateTransferInput) => Promise<void>;
  readonly onExecuteSalaryAllocations: (
    planIds: readonly string[],
    executionId: string,
  ) => Promise<unknown>;
}

type FormKind = "income" | "expense" | "adjustment" | "transfer";

export function TransactionsPage({
  initialEditorOpen = false,
  model,
  standaloneEditor = false,
  tags,
  onCancel,
  onTrash,
  onTrashMany,
  onCreateManual,
  onCreateTransfer,
  onExecuteSalaryAllocations,
}: TransactionsPageProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(initialEditorOpen);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<FormKind>("expense");
  const [salaryAllocationPlanIds, setSalaryAllocationPlanIds] = useState<readonly string[]>([]);
  const [salaryAllocationExecutionId, setSalaryAllocationExecutionId] = useState<string | null>(
    null,
  );
  const [salaryAllocationNeedsRecovery, setSalaryAllocationNeedsRecovery] = useState(false);
  const [selectedForTrash, setSelectedForTrash] = useState<ReadonlySet<string>>(new Set());
  const [isTrashConfirmOpen, setIsTrashConfirmOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const selectionPreview = previewTrashSelection(model.items, selectedForTrash);
  const pagination = paginateTransactions(model.items, currentPage);
  const { currentPage: visiblePage, items: visibleItems, pageCount } = pagination;

  useEffect(() => {
    if (currentPage !== visiblePage) setCurrentPage(visiblePage);
  }, [currentPage, visiblePage]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const accountId = String(form.get("account") ?? "");
    const amountText = String(form.get("amount") ?? "");
    const account = model.accounts.find((item) => item.id === accountId);
    if (account === undefined) {
      setError("Scegli un conto attivo.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const amountMinor = parseLocalizedAmountMinor(amountText, account.currency);
      const bookedDate = String(form.get("bookedDate") ?? "");
      const status = String(form.get("status") ?? "booked") as "expected" | "booked";
      const description = String(form.get("description") ?? "");
      if (kind === "transfer") {
        await onCreateTransfer({
          amountMinor,
          bookedDate,
          creditAccountId: String(form.get("destination") ?? ""),
          debitAccountId: accountId,
          description,
          status,
        });
      } else {
        const categoryId = String(form.get("category") ?? "") || undefined;
        const splitCategories = form.getAll("splitCategory").map(String);
        const splitAmounts = form.getAll("splitAmount").map(String);
        const tagIds = form.getAll("tagId").map(String);
        const signedAmount = signedAmountForKind(
          kind,
          amountMinor,
          String(form.get("adjustmentDirection") ?? "increase") as "increase" | "decrease",
        );
        const splits = splitCategories.map((categoryId, index) => ({
          categoryId,
          amountMinor: signedAmountForKind(
            kind,
            parseLocalizedAmountMinor(splitAmounts[index] ?? "", account.currency),
            String(form.get("adjustmentDirection") ?? "increase") as "increase" | "decrease",
          ),
        }));
        if (
          splits.length > 0 &&
          splits.reduce((total, split) => total + split.amountMinor, 0n) !== signedAmount
        ) {
          throw new Error("Split total must equal the transaction amount.");
        }
        const planIds = await onCreateManual({
          accountId,
          amountMinor: signedAmount,
          bookedDate,
          description,
          kind,
          payee: String(form.get("payee") ?? ""),
          status,
          ...(tagIds.length > 0 ? { tagIds } : {}),
          ...(splits.length > 0 ? { splits } : categoryId === undefined ? {} : { categoryId }),
          ...(kind !== "expense" || String(form.get("expenseVariability")) === "unclassified"
            ? {}
            : {
                expenseVariability: String(form.get("expenseVariability")) as "fixed" | "variable",
              }),
          ...(kind !== "expense" || String(form.get("expenseExceptionality")) === "unclassified"
            ? {}
            : {
                expenseExceptionality: String(form.get("expenseExceptionality")) as
                  "ordinary" | "extraordinary",
              }),
        });
        setSalaryAllocationPlanIds(planIds);
        setSalaryAllocationExecutionId(planIds.length === 0 ? null : crypto.randomUUID());
        setSalaryAllocationNeedsRecovery(false);
      }
      setIsEditorOpen(false);
      setMessage(
        kind === "transfer"
          ? "Trasferimento salvato con due gambe collegate."
          : "Movimento salvato nel ledger locale.",
      );
    } catch (cause) {
      setError(transactionErrorMessage(cause));
    } finally {
      setIsSaving(false);
    }
  };

  const executeSalaryAllocations = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (salaryAllocationExecutionId === null) return;
      await onExecuteSalaryAllocations(salaryAllocationPlanIds, salaryAllocationExecutionId);
      setSalaryAllocationPlanIds([]);
      setSalaryAllocationExecutionId(null);
      setSalaryAllocationNeedsRecovery(false);
      setMessage("Allocazioni stipendio registrate come trasferimenti collegati.");
    } catch {
      setSalaryAllocationNeedsRecovery(true);
      setError(
        "L'esecuzione delle allocazioni potrebbe essere parziale. Riprova: i trasferimenti già registrati non verranno duplicati.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = async (id: string, isTransfer: boolean) => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await onCancel(id, isTransfer);
      setMessage(isTransfer ? "Trasferimento annullato in modo atomico." : "Movimento annullato.");
    } catch (cause) {
      setError(transactionErrorMessage(cause));
    } finally {
      setIsSaving(false);
    }
  };

  const trash = async (id: string, isTransfer: boolean) => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await onTrash(id);
      setMessage(
        isTransfer
          ? "Trasferimento spostato nel cestino come gruppo."
          : "Movimento spostato nel cestino.",
      );
    } catch (cause) {
      setError(transactionErrorMessage(cause));
    } finally {
      setIsSaving(false);
    }
  };
  const trashSelected = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onTrashMany(selectionPreview.selectedIds);
      setSelectedForTrash(new Set());
      setIsTrashConfirmOpen(false);
      setMessage("Movimenti selezionati spostati nel cestino in modo atomico.");
    } catch (cause) {
      setError(transactionErrorMessage(cause));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={standaloneEditor ? "transactions-page is-standalone" : "transactions-page"}
      id="transactions"
    >
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">{standaloneEditor ? "Nuova registrazione" : "Ledger locale"}</p>
          <h1>{standaloneEditor ? "Nuova registrazione" : "Gestisci i movimenti"}</h1>
          <p>
            {standaloneEditor
              ? "Aggiungi movimento"
              : "Registra entrate, spese, rettifiche e trasferimenti. I trasferimenti non alterano entrate o spese."}
          </p>
        </div>
        {standaloneEditor ? null : (
          <button
            className="primary-action"
            onClick={() => {
              setIsEditorOpen(true);
              setError(null);
              setMessage(null);
            }}
            type="button"
          >
            Nuovo movimento
          </button>
        )}
      </header>

      <div aria-live="polite" className="account-message-region">
        {message === null ? null : (
          <p className="account-feedback" role="status">
            {message}
          </p>
        )}
        {error === null ? null : (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
        {salaryAllocationPlanIds.length === 0 ? null : (
          <AccessibleDialog
            labelledBy="salary-allocation-confirm-title"
            onClose={() => {
              if (!salaryAllocationNeedsRecovery) {
                setSalaryAllocationPlanIds([]);
                setSalaryAllocationExecutionId(null);
              }
            }}
          >
            <h2 id="salary-allocation-confirm-title">Conferma allocazioni stipendio</h2>
            <p>Stipendio ricevuto. Eseguire le allocazioni pianificate?</p>
            <div className="form-actions">
              <button
                className="secondary-action"
                disabled={isSaving}
                onClick={() => {
                  if (!salaryAllocationNeedsRecovery) {
                    setSalaryAllocationPlanIds([]);
                    setSalaryAllocationExecutionId(null);
                  }
                }}
                type="button"
              >
                Non ora
              </button>
              <button
                className="primary-action"
                disabled={isSaving}
                onClick={() => void executeSalaryAllocations()}
                type="button"
              >
                {isSaving
                  ? "Esecuzione…"
                  : salaryAllocationNeedsRecovery
                    ? "Riprova allocazioni"
                    : "Esegui allocazioni"}
              </button>
            </div>
          </AccessibleDialog>
        )}
      </div>

      <div className={`accounts-layout${isEditorOpen ? " has-editor" : ""}`}>
        <section
          aria-labelledby="transaction-list-title"
          className="data-panel account-management-panel"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Registrazioni</p>
              <h2 id="transaction-list-title">Movimenti</h2>
            </div>
            <span className="panel-meta">{model.items.length}</span>
          </div>
          {selectionPreview.transactionGroups === 0 ? null : (
            <div aria-live="polite" className="account-feedback">
              <strong>{selectionPreview.transactionGroups} gruppi selezionati</strong> ·
              trasferimenti: {selectionPreview.transfers} · conti:{" "}
              {selectionPreview.accountLabels.join(", ")}
              <span className="sr-only">
                Entrate: {selectionPreview.incomeMinor.toString()} minor units; uscite:{" "}
                {selectionPreview.expenseMinor.toString()} minor units.
              </span>
              <button
                className="text-action"
                disabled={isSaving}
                onClick={() => setIsTrashConfirmOpen(true)}
                type="button"
              >
                Cestina selezione
              </button>
            </div>
          )}
          {isTrashConfirmOpen ? (
            <div
              aria-labelledby="trash-selection-title"
              aria-modal="true"
              className="account-feedback"
              role="dialog"
            >
              <h3 id="trash-selection-title">Spostare nel cestino?</h3>
              <p>
                {selectionPreview.transactionGroups} gruppi · {selectionPreview.transfers}{" "}
                trasferimenti · conti: {selectionPreview.accountLabels.join(", ")}.
              </p>
              <p>
                Entrate:{" "}
                <FinancialAmount amountMinor={selectionPreview.incomeMinor} currency="EUR" />
                {" · "}Uscite:{" "}
                <FinancialAmount amountMinor={selectionPreview.expenseMinor} currency="EUR" />
              </p>
              <p>I movimenti resteranno ripristinabili dal cestino.</p>
              <div className="form-actions">
                <button
                  className="secondary-action"
                  disabled={isSaving}
                  onClick={() => setIsTrashConfirmOpen(false)}
                  type="button"
                >
                  Annulla
                </button>
                <button
                  className="primary-action"
                  disabled={isSaving}
                  onClick={() => void trashSelected()}
                  type="button"
                >
                  {isSaving ? "Spostamento…" : "Sposta nel cestino"}
                </button>
              </div>
            </div>
          ) : null}
          {model.items.length === 0 ? (
            <div className="account-list-empty">
              <h3>Nessun movimento registrato</h3>
              <p>Crea il primo movimento dal pulsante in alto.</p>
            </div>
          ) : (
            <div className="account-table-wrap">
              <table className="account-table transaction-management-table">
                <caption className="sr-only">Movimenti registrati nel ledger</caption>
                <thead>
                  <tr>
                    <th scope="col">Seleziona</th>
                    <th scope="col">Operazione</th>
                    <th scope="col">Conto</th>
                    <th scope="col">Data</th>
                    <th scope="col">Stato</th>
                    <th scope="col">Importo</th>
                    <th scope="col">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Seleziona">
                        <input
                          aria-label={`Seleziona ${item.title}`}
                          checked={selectedForTrash.has(item.id)}
                          disabled={!item.canCancel || isSaving}
                          onChange={(event) =>
                            setSelectedForTrash((current) => {
                              const next = new Set(current);
                              if (event.currentTarget.checked) next.add(item.id);
                              else next.delete(item.id);
                              return next;
                            })
                          }
                          type="checkbox"
                        />
                      </td>
                      <td data-label="Operazione">
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.kindLabel} · {item.categoryLabel}
                          </small>
                        </span>
                      </td>
                      <td data-label="Conto">{item.accountLabel}</td>
                      <td data-label="Data">{item.bookedDate}</td>
                      <td data-label="Stato">
                        <span className="account-status">{item.statusLabel}</span>
                      </td>
                      <td data-label="Importo">
                        <FinancialAmount
                          amountMinor={item.amount.amountMinor}
                          currency={item.amount.currency}
                          showPositiveSign={item.amount.amountMinor > 0n && !item.isTransfer}
                          tone={
                            item.amount.amountMinor < 0n
                              ? "negative"
                              : item.isTransfer
                                ? "neutral"
                                : "positive"
                          }
                        />
                      </td>
                      <td data-label="Azioni">
                        {item.canCancel ? (
                          <span className="table-actions">
                            <button
                              className="text-action"
                              disabled={isSaving}
                              onClick={() => void cancel(item.id, item.isTransfer)}
                              type="button"
                            >
                              Annulla
                            </button>
                            <button
                              className="text-action"
                              disabled={isSaving}
                              onClick={() => void trash(item.id, item.isTransfer)}
                              type="button"
                            >
                              Cestina
                            </button>
                          </span>
                        ) : (
                          <span className="table-muted">Non annullabile</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {model.items.length > transactionPageSize ? (
            <nav aria-label="Paginazione movimenti" className="table-pagination">
              <p aria-live="polite">
                Pagina {visiblePage} di {pageCount} · visualizzati {visibleItems.length} di{" "}
                {model.items.length} movimenti
              </p>
              <div className="table-actions">
                <button
                  className="secondary-action"
                  disabled={visiblePage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  Precedente
                </button>
                <button
                  className="secondary-action"
                  disabled={visiblePage === pageCount}
                  onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                  type="button"
                >
                  Successiva
                </button>
              </div>
            </nav>
          ) : null}
        </section>
        {isEditorOpen ? (
          <TransactionForm
            accounts={model.accounts}
            categories={model.categories}
            isSaving={isSaving}
            kind={kind}
            onCancel={() => setIsEditorOpen(false)}
            onKindChange={setKind}
            onSubmit={save}
            tags={tags}
            useSegmentedKinds={standaloneEditor}
          />
        ) : (
          <aside aria-labelledby="transaction-help-title" className="account-help-panel">
            <p className="eyebrow">Integrità</p>
            <h2 id="transaction-help-title">Ogni saldo è ricostruibile</h2>
            <p>
              Un annullamento non cancella dati. I movimenti riconciliati restano protetti e
              richiederanno una rettifica.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

function TransactionForm({
  accounts,
  categories,
  isSaving,
  kind,
  onCancel,
  onKindChange,
  onSubmit,
  tags,
  useSegmentedKinds,
}: {
  readonly accounts: TransactionsViewModel["accounts"];
  readonly categories: TransactionsViewModel["categories"];
  readonly isSaving: boolean;
  readonly kind: FormKind;
  readonly onCancel: () => void;
  readonly onKindChange: (kind: FormKind) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly tags: readonly Tag[];
  readonly useSegmentedKinds: boolean;
}) {
  const [splitRows, setSplitRows] = useState<readonly string[]>([]);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [amountText, setAmountText] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const isTransfer = kind === "transfer";
  const hasSplits = splitRows.length > 0;
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const currency = selectedAccount?.currency ?? "EUR";
  const transactionAmount = tryParseAmountMinor(amountText, currency);
  const assignedAmount = hasSplits
    ? splitRows.reduce<bigint | undefined>((total, rowId) => {
        const value = tryParseAmountMinor(splitAmounts[rowId] ?? "", currency);
        return total === undefined || value === undefined ? undefined : total + value;
      }, 0n)
    : 0n;
  const amountRemaining =
    transactionAmount === undefined || assignedAmount === undefined
      ? undefined
      : transactionAmount - assignedAmount;
  const splitsAreBalanced =
    hasSplits && transactionAmount !== undefined && assignedAmount === transactionAmount;
  const categoriesForKind = categories.filter(
    (category) =>
      kind === "adjustment" || category.kindScope === "both" || category.kindScope === kind,
  );
  return (
    <aside aria-labelledby="transaction-form-title" className="account-editor-panel">
      <div className="account-editor-heading">
        <div>
          <p className="eyebrow">Nuova registrazione</p>
          <h2 id="transaction-form-title">Aggiungi movimento</h2>
        </div>
        <button
          aria-label="Chiudi modulo movimento"
          className="editor-close"
          onClick={onCancel}
          type="button"
        >
          ×
        </button>
      </div>
      <form className="account-form" onSubmit={onSubmit}>
        {useSegmentedKinds ? (
          <fieldset className="transaction-kind-segmented">
            <legend>Tipo movimento</legend>
            <div aria-label="Tipo movimento" role="radiogroup">
              {(
                [
                  ["income", "Entrata"],
                  ["expense", "Uscita"],
                  ["transfer", "Trasferimento"],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    checked={kind === value}
                    name="kind"
                    onChange={() => onKindChange(value)}
                    type="radio"
                    value={value}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <label>
            Tipo
            <select
              name="kind"
              onChange={(event) => onKindChange(event.currentTarget.value as FormKind)}
              value={kind}
            >
              <option value="expense">Spesa</option>
              <option value="income">Entrata</option>
              <option value="adjustment">Rettifica</option>
              <option value="transfer">Trasferimento</option>
            </select>
          </label>
        )}
        <label>
          {isTransfer ? "Conto origine" : "Conto"}
          <select
            name="account"
            onChange={(event) => setSelectedAccountId(event.currentTarget.value)}
            required
            value={selectedAccountId}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.currency}
              </option>
            ))}
          </select>
        </label>
        {isTransfer ? (
          <label>
            Conto destinazione
            <select name="destination" required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.currency}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!isTransfer && kind !== "adjustment" && !hasSplits ? (
          <label>
            Categoria
            <select name="category">
              <option value="">Senza categoria</option>
              {categoriesForKind.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryLabel(category, categories)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!isTransfer && kind !== "adjustment" ? (
          <fieldset className="split-editor">
            <legend>Ripartizione per categoria</legend>
            {splitRows.map((rowId, index) => (
              <div className="split-row" key={rowId}>
                <select aria-label={`Categoria split ${index + 1}`} name="splitCategory" required>
                  <option value="">Categoria</option>
                  {categoriesForKind.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(category, categories)}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Importo split ${index + 1}`}
                  inputMode="decimal"
                  name="splitAmount"
                  onChange={(event) =>
                    setSplitAmounts((amounts) => ({
                      ...amounts,
                      [rowId]: event.currentTarget.value,
                    }))
                  }
                  placeholder="0,00"
                  required
                />
                <button
                  aria-label={`Rimuovi split ${index + 1}`}
                  className="text-action"
                  onClick={() => setSplitRows((rows) => rows.filter((id) => id !== rowId))}
                  type="button"
                >
                  Rimuovi
                </button>
              </div>
            ))}
            {hasSplits ? (
              <div aria-live="polite" className="split-summary">
                <span>
                  Assegnato:{" "}
                  {assignedAmount === undefined ? (
                    "—"
                  ) : (
                    <FinancialAmount amountMinor={assignedAmount} currency={currency} />
                  )}
                </span>
                <span className={amountRemaining === 0n ? "is-balanced" : "is-unbalanced"}>
                  Da assegnare:{" "}
                  {amountRemaining === undefined ? (
                    "—"
                  ) : (
                    <FinancialAmount amountMinor={amountRemaining} currency={currency} />
                  )}
                </span>
              </div>
            ) : null}
            <button
              className="text-action"
              onClick={() => setSplitRows((rows) => [...rows, crypto.randomUUID()])}
              type="button"
            >
              Aggiungi ripartizione
            </button>
          </fieldset>
        ) : null}
        {kind === "expense" ? (
          <details className="expense-behavior-details">
            <summary>Dettagli finanziari (facoltativi)</summary>
            <p className="import-help">
              La categoria descrive la destinazione della spesa. Queste informazioni non modificano
              le categorie esistenti.
            </p>
            <fieldset>
              <legend>Natura della spesa</legend>
              <label>
                <input defaultChecked name="expenseVariability" type="radio" value="unclassified" />
                Non specificata
              </label>
              <label>
                <input name="expenseVariability" type="radio" value="fixed" /> Fissa
              </label>
              <label>
                <input name="expenseVariability" type="radio" value="variable" /> Variabile
              </label>
            </fieldset>
            <fieldset>
              <legend>Evento</legend>
              <label>
                <input
                  defaultChecked
                  name="expenseExceptionality"
                  type="radio"
                  value="unclassified"
                />
                Non specificato
              </label>
              <label>
                <input name="expenseExceptionality" type="radio" value="ordinary" /> Ordinario
              </label>
              <label>
                <input name="expenseExceptionality" type="radio" value="extraordinary" />
                Straordinario
              </label>
            </fieldset>
            <p className="import-help">
              Per una spesa ricorrente usa una vera <a href="#recurring">regola di ricorrenza</a>:
              frequenza e prossima data restano gestite in un solo punto.
            </p>
          </details>
        ) : null}
        {!isTransfer ? (
          <fieldset className="tag-selector">
            <legend>Tag</legend>
            {tags.filter((tag) => !tag.isArchived).length === 0 ? (
              <p>Nessun tag attivo. Puoi crearne uno dalla sezione Tag.</p>
            ) : (
              <div>
                {tags
                  .filter((tag) => !tag.isArchived)
                  .map((tag) => (
                    <label key={tag.id}>
                      <input name="tagId" type="checkbox" value={tag.id} />
                      {tag.name}
                    </label>
                  ))}
              </div>
            )}
          </fieldset>
        ) : null}
        {kind === "adjustment" ? (
          <label>
            Direzione
            <select name="adjustmentDirection">
              <option value="increase">Aumenta il saldo</option>
              <option value="decrease">Riduce il saldo</option>
            </select>
          </label>
        ) : null}
        <label>
          Importo
          <input
            aria-label="Importo"
            inputMode="decimal"
            name="amount"
            onChange={(event) => setAmountText(event.currentTarget.value)}
            placeholder="0,00"
            required
          />
        </label>
        <label>
          Data operazione
          <input name="bookedDate" required type="date" defaultValue={localCivilDate()} />
        </label>
        <label>
          Stato
          <select name="status">
            <option value="booked">Contabilizzato</option>
            <option value="expected">Previsto</option>
          </select>
        </label>
        {!isTransfer ? (
          <label>
            Controparte
            <input name="payee" placeholder="Facoltativo" />
          </label>
        ) : null}
        <label>
          Descrizione
          <input name="description" placeholder="Facoltativa" />
        </label>
        {isTransfer ? (
          <p className="immutable-note">
            Nexora crea automaticamente due gambe nella stessa valuta. Nessun trasferimento viene
            conteggiato come entrata o spesa.
          </p>
        ) : null}
        <div className="form-actions">
          <button className="secondary-action" onClick={onCancel} type="button">
            Annulla
          </button>
          <button
            className="primary-action"
            disabled={isSaving || accounts.length === 0 || (hasSplits && !splitsAreBalanced)}
            type="submit"
          >
            {isSaving ? "Salvataggio…" : "Salva movimento"}
          </button>
        </div>
      </form>
    </aside>
  );
}

function tryParseAmountMinor(value: string, currency: string): bigint | undefined {
  if (value.trim() === "") return undefined;
  try {
    return parseLocalizedAmountMinor(value, currency);
  } catch {
    return undefined;
  }
}

function transactionErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Il movimento non è stato salvato.";
  if (error.message.includes("same currency"))
    return "Il trasferimento richiede due conti nella stessa valuta.";
  if (error.message.includes("different"))
    return "Origine e destinazione devono essere conti diversi.";
  if (error.message.includes("Reconciled"))
    return "Un movimento riconciliato richiede una rettifica, non può essere annullato.";
  if (error.message.includes("positive")) return "Inserisci un importo maggiore di zero.";
  return "Operazione non consentita. Verifica conto, categoria e importo.";
}
