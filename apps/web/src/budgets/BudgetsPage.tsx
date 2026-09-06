import {
  calculateBudgetProgress,
  categoryLabel,
  nextBudgetPeriod,
  previousBudgetPeriod,
  resolveActiveBudgetsForPeriod,
  type Budget,
  type Category,
  type Transaction,
  type TransactionSplit,
} from "@nexora/domain";
import { FinancialAmount, formatMinorUnits, formatPercentage } from "@nexora/ui";
import { useState, type CSSProperties, type FormEvent } from "react";

import { formatEditableAmountMinor, parseLocalizedAmountMinor } from "../accounts/accountCommands";
import { AccessibleDialog } from "../settings/AccessibleDialog";
import { currentBudgetPeriod, type BudgetInput } from "./budgetCommands";

export function BudgetsPage({
  budgets,
  categories,
  transactions,
  transactionSplits,
  onCreate,
  onUpdate,
  onDelete,
  today,
}: {
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly transactionSplits: readonly TransactionSplit[];
  readonly onCreate: (input: BudgetInput) => Promise<void>;
  readonly onUpdate: (id: string, input: BudgetInput) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
  readonly today?: Date;
}) {
  const [editing, setEditing] = useState<Budget>();
  const [deleteCandidate, setDeleteCandidate] = useState<Budget>();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMacroCategoryId, setSelectedMacroCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(() => currentBudgetPeriod(today));
  const isCurrentPeriod = selectedPeriod === currentBudgetPeriod(today);
  const visibleBudgets = resolveActiveBudgetsForPeriod(budgets, selectedPeriod);
  const activeMacroCategories = categories.filter(
    (category) =>
      !category.isArchived && category.parentId === undefined && category.accepts("expense"),
  );
  const activeSubcategories = categories.filter(
    (category) =>
      !category.isArchived &&
      category.parentId === selectedMacroCategoryId &&
      category.accepts("expense"),
  );

  const openEditor = (budget: Budget | undefined) => {
    const category = categories.find((item) => item.id === budget?.categoryId);
    setEditing(budget);
    setSelectedMacroCategoryId(category?.parentId ?? category?.id ?? "");
    setSelectedSubcategoryId(category?.parentId === undefined ? "" : (category?.id ?? ""));
    setError(null);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setIsSaving(true);
    try {
      const categoryId = selectedSubcategoryId;
      if (categoryId === "") throw new Error("A subcategory is required.");
      const editingArchivedCategory = categories.find(
        (category) => category.id === editing?.categoryId && category.isArchived,
      );
      if (editingArchivedCategory !== undefined && categoryId === editingArchivedCategory.id) {
        throw new Error("Select an active category before updating an archived budget.");
      }
      const firstAlertPercentage = Number(form.get("firstAlertPercentage"));
      const secondAlertPercentage = Number(form.get("secondAlertPercentage"));
      if (
        !Number.isInteger(firstAlertPercentage) ||
        !Number.isInteger(secondAlertPercentage) ||
        firstAlertPercentage <= 0 ||
        secondAlertPercentage <= 0 ||
        firstAlertPercentage > 100 ||
        secondAlertPercentage > 100 ||
        firstAlertPercentage >= secondAlertPercentage
      ) {
        throw new Error("Invalid alert threshold pair.");
      }
      const input: BudgetInput = {
        amountMinor: parseLocalizedAmountMinor(String(form.get("amount")), "EUR"),
        categoryId,
        firstAlertPercentage,
        secondAlertPercentage,
      };
      if (editing === undefined) await onCreate(input);
      else await onUpdate(editing.id, input);
      setError(null);
      openEditor(undefined);
      formElement.reset();
    } catch {
      setError(
        "Impossibile salvare il budget. Scegli una categoria e una sottocategoria, inserisci importo e due soglie tra 1 e 100 con la prima minore della seconda.",
      );
    } finally {
      setIsSaving(false);
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
        <nav aria-label="Navigazione periodo budget" className="budget-period-navigation">
          <button
            aria-label="Mese precedente"
            className="secondary-action"
            onClick={() => setSelectedPeriod((period) => previousBudgetPeriod(period))}
            type="button"
          >
            ←
          </button>
          <output aria-live="polite">{selectedPeriod}</output>
          <button
            aria-label="Mese successivo"
            className="secondary-action"
            onClick={() => setSelectedPeriod((period) => nextBudgetPeriod(period))}
            type="button"
          >
            →
          </button>
        </nav>
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
            <span className="panel-meta">{visibleBudgets.length}</span>
          </div>
          {visibleBudgets.length === 0 ? (
            <div className="account-list-empty">
              <h3>Nessun budget</h3>
              <p>
                Imposta un limite mensile per una specifica sotto-categoria. Nexora lo applicherà
                automaticamente ogni mese finché non lo modifichi o disattivi.
              </p>
              <button
                className="secondary-action"
                onClick={() => openEditor(undefined)}
                type="button"
              >
                Crea budget
              </button>
            </div>
          ) : (
            <ul className="account-list budget-list">
              {visibleBudgets.map((budget) => {
                const progress = calculateBudgetProgress({
                  budget,
                  targetPeriod: selectedPeriod,
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
                  progress.status === "over_budget"
                    ? "Superato"
                    : progress.status === "critical"
                      ? "Critico"
                      : progress.status === "warning"
                        ? "Attenzione"
                        : "Nei limiti";
                const visiblePercentage = Math.max(0, Math.min(progress.percentage, 100));
                return (
                  <li key={budget.id} className={`budget-card is-${progress.status}`}>
                    <div className="account-copy">
                      <strong>{category}</strong>
                      <small>
                        {selectedPeriod} · {status} · {formatPercentage(progress.percentage, 0)}{" "}
                        utilizzato
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
                        aria-label={`Consumo budget ${category}: ${formatPercentage(progress.percentage, 0)}`}
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
                      {budget.firstAlertPercentage !== undefined &&
                      budget.secondAlertPercentage !== undefined ? (
                        <small>
                          Soglie: {budget.firstAlertPercentage}% · {budget.secondAlertPercentage}%
                        </small>
                      ) : null}
                    </div>
                    <FinancialAmount
                      amountMinor={budget.amount.amountMinor}
                      currency={budget.amount.currency}
                    />
                    {isCurrentPeriod ? (
                      <div className="budget-card-actions" aria-label={`Azioni per ${category}`}>
                        <button
                          className="text-action"
                          onClick={() => openEditor(budget)}
                          type="button"
                        >
                          Modifica
                        </button>
                        <button
                          className="text-action"
                          onClick={() => setDeleteCandidate(budget)}
                          type="button"
                        >
                          Disattiva
                        </button>
                      </div>
                    ) : (
                      <small>Configurazione storica</small>
                    )}
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
            aria-busy={isSaving}
            aria-disabled={!isCurrentPeriod}
            className="account-form"
            key={editing?.id ?? "new"}
            onSubmit={(event) => void save(event)}
          >
            <label>
              Categoria
              <select
                onChange={(event) => {
                  setSelectedMacroCategoryId(event.target.value);
                  setSelectedSubcategoryId("");
                }}
                required
                value={selectedMacroCategoryId}
              >
                <option value="">Seleziona categoria</option>
                {activeMacroCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sotto-categoria
              <select
                disabled={selectedMacroCategoryId === ""}
                onChange={(event) => setSelectedSubcategoryId(event.target.value)}
                required
                value={selectedSubcategoryId}
              >
                <option value="">Seleziona sotto-categoria</option>
                {activeSubcategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
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
            <label>
              Prima soglia di notifica (%)
              <input
                defaultValue={editing?.firstAlertPercentage}
                inputMode="numeric"
                max="100"
                min="1"
                name="firstAlertPercentage"
                required
                step="1"
                type="number"
              />
            </label>
            <label>
              Seconda soglia di notifica (%)
              <input
                defaultValue={editing?.secondAlertPercentage}
                inputMode="numeric"
                max="100"
                min="1"
                name="secondAlertPercentage"
                required
                step="1"
                type="number"
              />
            </label>
            <div className="form-actions">
              {editing === undefined ? null : (
                <button
                  className="secondary-action"
                  onClick={() => openEditor(undefined)}
                  type="button"
                >
                  Annulla modifica
                </button>
              )}
              <button
                className="primary-action"
                disabled={!isCurrentPeriod || isSaving}
                type="submit"
              >
                {editing === undefined ? "Salva budget" : "Salva modifiche"}
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
          <h2 id="delete-budget-title">Disattivare questo budget?</h2>
          <p>
            Il mese corrente resta visibile; dal mese successivo Nexora non applicherà più il
            limite. I movimenti non verranno cancellati.
          </p>
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
              {isDeleting ? "Disattivazione…" : "Disattiva budget"}
            </button>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}
