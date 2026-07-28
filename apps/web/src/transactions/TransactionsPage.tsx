import { FinancialAmount } from "@nexora/ui";
import type { Tag } from "@nexora/domain";
import { useState, type FormEvent } from "react";

import { parseLocalizedAmountMinor } from "../accounts/accountCommands";
import {
  signedAmountForKind,
  type CreateManualTransactionInput,
  type CreateTransferInput,
} from "./transactionCommands";
import type { TransactionsViewModel } from "./buildTransactionsViewModel";

interface TransactionsPageProps {
  readonly model: TransactionsViewModel;
  readonly tags: readonly Tag[];
  readonly onCancel: (id: string, isTransfer: boolean) => Promise<void>;
  readonly onCreateManual: (input: CreateManualTransactionInput) => Promise<void>;
  readonly onCreateTransfer: (input: CreateTransferInput) => Promise<void>;
}

type FormKind = "income" | "expense" | "adjustment" | "transfer";

export function TransactionsPage({
  model,
  tags,
  onCancel,
  onCreateManual,
  onCreateTransfer,
}: TransactionsPageProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<FormKind>("expense");

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
        await onCreateManual({
          accountId,
          amountMinor: signedAmount,
          bookedDate,
          description,
          kind,
          payee: String(form.get("payee") ?? ""),
          status,
          ...(tagIds.length > 0 ? { tagIds } : {}),
          ...(splits.length > 0 ? { splits } : categoryId === undefined ? {} : { categoryId }),
        });
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

  return (
    <div id="transactions">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Ledger locale</p>
          <h1>Gestisci i movimenti</h1>
          <p>
            Registra entrate, spese, rettifiche e trasferimenti. I trasferimenti non alterano
            entrate o spese.
          </p>
        </div>
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
                    <th scope="col">Operazione</th>
                    <th scope="col">Conto</th>
                    <th scope="col">Data</th>
                    <th scope="col">Stato</th>
                    <th scope="col">Importo</th>
                    <th scope="col">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {model.items.map((item) => (
                    <tr key={item.id}>
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
                          <button
                            className="text-action"
                            disabled={isSaving}
                            onClick={() => void cancel(item.id, item.isTransfer)}
                            type="button"
                          >
                            Annulla
                          </button>
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
}: {
  readonly accounts: TransactionsViewModel["accounts"];
  readonly categories: TransactionsViewModel["categories"];
  readonly isSaving: boolean;
  readonly kind: FormKind;
  readonly onCancel: () => void;
  readonly onKindChange: (kind: FormKind) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly tags: readonly Tag[];
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
                  {category.name}
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
                      {category.name}
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
          <input
            name="bookedDate"
            required
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
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
