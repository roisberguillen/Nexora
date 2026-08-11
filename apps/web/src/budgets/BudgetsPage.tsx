import {
  calculateBudgetProgress,
  categoryLabel,
  type Budget,
  type Category,
  type Transaction,
  type TransactionSplit,
} from "@nexora/domain";
import { FinancialAmount, formatMinorUnits } from "@nexora/ui";
import { useState, type CSSProperties, type FormEvent } from "react";

import { formatEditableAmountMinor, parseLocalizedAmountMinor } from "../accounts/accountCommands";
import { AccessibleDialog } from "../settings/AccessibleDialog";
import type { BudgetInput } from "./budgetCommands";

const currentPeriod = () =>
  new Intl.DateTimeFormat("sv-SE", {
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).format(new Date());

export function BudgetsPage({
  budgets,
  categories,
  transactions,
  transactionSplits,
  onCreate,
  onUpdate,
  onDelete,
}: {
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly transactionSplits: readonly TransactionSplit[];
  readonly onCreate: (input: BudgetInput) => Promise<void>;
  readonly onUpdate: (id: string, input: BudgetInput) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Budget>();
  const [deleteCandidate, setDeleteCandidate] = useState<Budget>();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const activeCategories = categories.filter(
    (category) => !category.isArchived && category.accepts("expense"),
  );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const categoryId = String(form.get("categoryId") ?? "");
      const editingArchivedCategory = categories.find(
        (category) => category.id === editing?.categoryId && category.isArchived,
      );
      if (editingArchivedCategory !== undefined && categoryId === editingArchivedCategory.id) {
        throw new Error("Select an active category before updating an archived budget.");
      }
      const input: BudgetInput = {
        period: String(form.get("period")),
        amountMinor: parseLocalizedAmountMinor(String(form.get("amount")), "EUR"),
        alertAt80: Boolean(form.get("alertAt80")),
        alertAt100: Boolean(form.get("alertAt100")),
        ...(categoryId === "" ? {} : { categoryId }),
      };
      if (editing === undefined) await onCreate(input);
      else await onUpdate(editing.id, input);
      setError(null);
      setEditing(undefined);
      formElement.reset();
    } catch {
      setError(
        "Impossibile salvare il budget. Verifica periodo, categoria, importo e che non esista già un limite identico.",
      );
    }
  };

  const confirmDelete = async () => {
    if (deleteCandidate === undefined) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteCandidate.id);
      if (editing?.id === deleteCandidate.id) setEditing(undefined);
      setDeleteCandidate(undefined);
      setError(null);
    } catch {
      setError("Impossibile eliminare il budget. Riprova.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="budgets">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Controllo mensile</p>
          <h1>Budget</h1>
          <p>
            I budget misurano solo spese realmente contabilizzate: entrate, trasferimenti,
            rettifiche e movimenti annullati restano esclusi.
          </p>
        </div>
      </header>
      <div className="accounts-layout has-editor">
        <section
          className="data-panel account-management-panel"
          aria-labelledby="budget-list-title"
        >
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Piani attivi</p>
              <h2 id="budget-list-title">Budget mensili</h2>
            </div>
            <span className="panel-meta">{budgets.length}</span>
          </div>
          {budgets.length === 0 ? (
            <div className="account-list-empty">
              <h3>Nessun budget</h3>
              <p>
                Crea un limite mensile per una macro categoria, una sottocategoria o tutte le spese.
              </p>
              <button
                className="secondary-action"
                onClick={() => setEditing(undefined)}
                type="button"
              >
                Crea budget
              </button>
            </div>
          ) : (
            <ul className="account-list budget-list">
              {budgets.map((budget) => {
                const progress = calculateBudgetProgress({
                  budget,
                  categories,
                  transactions,
                  splits: transactionSplits,
                });
                const selectedCategory = categories.find((item) => item.id === budget.categoryId);
                const category =
                  selectedCategory === undefined
                    ? budget.categoryId === undefined
                      ? "Tutte le spese"
                      : "Categoria archiviata o non disponibile"
                    : categoryLabel(selectedCategory, categories);
                const status =
                  progress.status === "exceeded"
                    ? "Superato"
                    : progress.status === "warning"
                      ? "Attenzione"
                      : "Nei limiti";
                const visiblePercentage = Math.max(0, Math.min(progress.percentage, 100));
                return (
                  <li key={budget.id} className={`budget-card is-${progress.status}`}>
                    <div className="account-copy">
                      <strong>{category}</strong>
                      <small>
                        {budget.period} · {status} · {progress.percentage.toFixed(0)}% utilizzato
                      </small>
                      {progress.scope.includesDescendants ? (
                        <small>
                          Include {(progress.scope.categoryIds?.size ?? 1) - 1} sottocategorie
                        </small>
                      ) : null}
                      {selectedCategory?.isArchived ? (
                        <small>Categoria archiviata: budget storico</small>
                      ) : null}
                      <div
                        aria-label={`Consumo budget ${category}: ${progress.percentage.toFixed(0)} percento`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={visiblePercentage}
                        className="budget-progress"
                        role="progressbar"
                        style={{ "--budget-progress": `${visiblePercentage}%` } as CSSProperties}
                      >
                        <span />
                      </div>
                      <small>
                        Speso{" "}
                        {formatMinorUnits(progress.spent.amountMinor, progress.spent.currency)} ·
                        Disponibile{" "}
                        {formatMinorUnits(
                          progress.remaining.amountMinor,
                          progress.remaining.currency,
                        )}
                      </small>
                    </div>
                    <FinancialAmount
                      amountMinor={budget.amount.amountMinor}
                      currency={budget.amount.currency}
                    />
                    <div className="budget-card-actions" aria-label={`Azioni per ${category}`}>
                      <button
                        className="text-action"
                        onClick={() => setEditing(budget)}
                        type="button"
                      >
                        Modifica
                      </button>
                      <button
                        className="text-action"
                        onClick={() => setDeleteCandidate(budget)}
                        type="button"
                      >
                        Elimina
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside aria-labelledby="budget-form-title" className="account-editor-panel">
          <h2 id="budget-form-title">
            {editing === undefined ? "Nuovo budget" : "Modifica budget"}
          </h2>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="account-form"
            key={editing?.id ?? "new"}
            onSubmit={(event) => void save(event)}
          >
            <label>
              Periodo
              <input
                defaultValue={editing?.period ?? currentPeriod()}
                name="period"
                pattern="[0-9]{4}-[0-9]{2}"
                required
              />
            </label>
            <label>
              Categoria
              <select defaultValue={editing?.categoryId ?? ""} name="categoryId">
                <option value="">Tutte le spese</option>
                {editing?.categoryId !== undefined &&
                categories.find((category) => category.id === editing.categoryId)?.isArchived ? (
                  <option disabled value={editing.categoryId}>
                    Categoria archiviata — scegli una categoria attiva
                  </option>
                ) : null}
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryLabel(category, categories)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Importo
              <input
                defaultValue={
                  editing === undefined
                    ? undefined
                    : formatEditableAmountMinor(editing.amount.amountMinor, editing.amount.currency)
                }
                inputMode="decimal"
                name="amount"
                placeholder="0,00"
                required
              />
            </label>
            <label className="budget-alert-toggle">
              <input defaultChecked={editing?.alertAt80 ?? true} name="alertAt80" type="checkbox" />{" "}
              Avvisa all’80%
            </label>
            <label className="budget-alert-toggle">
              <input
                defaultChecked={editing?.alertAt100 ?? true}
                name="alertAt100"
                type="checkbox"
              />{" "}
              Avvisa al 100%
            </label>
            <div className="form-actions">
              {editing === undefined ? null : (
                <button
                  className="secondary-action"
                  onClick={() => setEditing(undefined)}
                  type="button"
                >
                  Annulla modifica
                </button>
              )}
              <button className="primary-action" type="submit">
                {editing === undefined ? "Salva budget" : "Aggiorna budget"}
              </button>
            </div>
          </form>
        </aside>
      </div>
      {deleteCandidate === undefined ? null : (
        <AccessibleDialog
          labelledBy="delete-budget-title"
          onClose={() => setDeleteCandidate(undefined)}
        >
          <h2 id="delete-budget-title">Eliminare questo budget?</h2>
          <p>I movimenti associati non verranno cancellati.</p>
          <div className="form-actions">
            <button
              disabled={isDeleting}
              onClick={() => setDeleteCandidate(undefined)}
              type="button"
            >
              Annulla
            </button>
            <button
              className="danger-action"
              disabled={isDeleting}
              onClick={() => void confirmDelete()}
              type="button"
            >
              {isDeleting ? "Eliminazione…" : "Elimina budget"}
            </button>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}
