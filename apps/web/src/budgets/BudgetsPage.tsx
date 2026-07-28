import type { Budget, Category, Transaction } from "@nexora/domain";
import { FinancialAmount, formatMinorUnits } from "@nexora/ui";
import { useState, type FormEvent } from "react";

import { parseLocalizedAmountMinor } from "../accounts/accountCommands";
import type { BudgetInput } from "./budgetCommands";

export function BudgetsPage({
  budgets,
  categories,
  transactions,
  onCreate,
}: {
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly onCreate: (input: BudgetInput) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await onCreate({
        period: String(form.get("period")),
        amountMinor: parseLocalizedAmountMinor(String(form.get("amount")), "EUR"),
        alertAt80: Boolean(form.get("alertAt80")),
        alertAt100: Boolean(form.get("alertAt100")),
        ...(String(form.get("categoryId")) === ""
          ? {}
          : { categoryId: String(form.get("categoryId")) }),
      });
      setError(null);
      formElement.reset();
    } catch {
      setError("Impossibile salvare il budget. Verifica periodo, categoria e importo.");
    }
  };
  const activeCategories = categories.filter(
    (category) => !category.isArchived && category.accepts("expense"),
  );
  return (
    <div id="budgets">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Controllo mensile</p>
          <h1>Budget</h1>
          <p>
            Le soglie considerano solo le spese contabilizzate: risparmio e trasferimenti restano
            esclusi.
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
              <p>Crea un limite mensile per una categoria o per tutte le spese.</p>
            </div>
          ) : (
            <ul className="account-list">
              {budgets.map((budget) => {
                const spent = budget.spentBy(transactions);
                const percent = budget.usagePercent(transactions);
                const remaining = budget.amount.subtract(spent);
                const category =
                  budget.categoryId === undefined
                    ? "Tutte le spese"
                    : (categories.find((item) => item.id === budget.categoryId)?.name ??
                      "Categoria non disponibile");
                const status =
                  percent >= 100 ? "Superato" : percent >= 80 ? "Attenzione" : "Nei limiti";
                return (
                  <li key={budget.id}>
                    <div className="account-copy">
                      <strong>{category}</strong>
                      <small>
                        {budget.period} · {status} · {percent.toFixed(0)}%
                      </small>
                      <small>
                        Speso {formatMinorUnits(spent.amountMinor, spent.currency)} · Residuo{" "}
                        {formatMinorUnits(remaining.amountMinor, remaining.currency)}
                      </small>
                    </div>
                    <FinancialAmount
                      amountMinor={budget.amount.amountMinor}
                      currency={budget.amount.currency}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside aria-labelledby="budget-form-title" className="account-editor-panel">
          <h2 id="budget-form-title">Nuovo budget</h2>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form className="account-form" onSubmit={(event) => void save(event)}>
            <label>
              Periodo
              <input
                defaultValue={new Date().toISOString().slice(0, 7)}
                name="period"
                pattern="[0-9]{4}-[0-9]{2}"
                required
              />
            </label>
            <label>
              Categoria
              <select name="categoryId">
                <option value="">Tutte le spese</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Importo
              <input inputMode="decimal" name="amount" placeholder="0,00" required />
            </label>
            <label>
              <input defaultChecked name="alertAt80" type="checkbox" /> Avvisa all’80%
            </label>
            <label>
              <input defaultChecked name="alertAt100" type="checkbox" /> Avvisa al 100%
            </label>
            <div className="form-actions">
              <button className="primary-action" type="submit">
                Salva budget
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
