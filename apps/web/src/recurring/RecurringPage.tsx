import type {
  Account,
  AllocationPlan,
  Category,
  RecurringRule,
  WeekendPolicy,
} from "@nexora/domain";
import { formatMinorUnits } from "@nexora/ui";
import { useState, type FormEvent } from "react";

import { parseLocalizedAmountMinor } from "../accounts/accountCommands";
import type { RecurringRuleInput } from "./recurringCommands";
import type { AllocationPlanInput } from "./allocationCommands";

export function RecurringPage({
  accounts,
  allocationPlans,
  categories,
  rules,
  onCreate,
  onCreateAllocation,
  onExecuteAllocations,
  onUpdate,
}: {
  readonly accounts: readonly Account[];
  readonly allocationPlans: readonly AllocationPlan[];
  readonly categories: readonly Category[];
  readonly rules: readonly RecurringRule[];
  readonly onCreate: (input: RecurringRuleInput) => Promise<void>;
  readonly onCreateAllocation: (input: AllocationPlanInput) => Promise<void>;
  readonly onExecuteAllocations: (planIds: readonly string[]) => Promise<void>;
  readonly onUpdate: (id: string, input: RecurringRuleInput) => Promise<void>;
}) {
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const account = accounts.find((item) => item.id === String(form.get("accountId")))!;
    const kind = String(form.get("kind")) as "income" | "expense";
    const rawAmount = parseLocalizedAmountMinor(String(form.get("amount") ?? ""), account.currency);
    const input: RecurringRuleInput = {
      name: String(form.get("name") ?? ""),
      accountId: account.id,
      kind,
      amountMinor: kind === "expense" ? -abs(rawAmount) : abs(rawAmount),
      nominalDay: Number(form.get("nominalDay")),
      weekendPolicy: String(form.get("weekendPolicy")) as WeekendPolicy,
      nextExpectedDate: String(form.get("nextExpectedDate")),
      enabled: Boolean(form.get("enabled")),
      ...(optional(String(form.get("categoryId") ?? "")) === undefined
        ? {}
        : { categoryId: optional(String(form.get("categoryId") ?? ""))! }),
      ...(optional(String(form.get("payee") ?? "")) === undefined
        ? {}
        : { payee: optional(String(form.get("payee") ?? ""))! }),
    };
    try {
      setError(null);
      if (editing === null) await onCreate(input);
      else await onUpdate(editing.id, input);
      setEditing(null);
      event.currentTarget.reset();
    } catch {
      setError("Impossibile salvare la ricorrenza. Verifica conto, categoria, importo e data.");
    }
  };
  return (
    <div id="recurring">
      <header className="accounts-heading">
        <div>
          <p className="eyebrow">Pianificazione locale</p>
          <h1>Ricorrenze</h1>
          <p>
            Le date previste non cambiano il saldo. Registra sempre un movimento solo dopo conferma.
          </p>
        </div>
      </header>
      <div className="accounts-layout has-editor">
        <section className="data-panel account-management-panel" aria-labelledby="recurring-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Prossime scadenze</p>
              <h2 id="recurring-title">Regole attive</h2>
            </div>
            <span className="panel-meta">{rules.length}</span>
          </div>
          <div className="account-table-wrap">
            <table className="account-table">
              <thead>
                <tr>
                  <th>Regola</th>
                  <th>Data attesa</th>
                  <th>Importo</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td data-label="Regola">
                      <strong>{rule.name}</strong>
                      <small>{rule.payee ?? "Senza controparte"}</small>
                    </td>
                    <td data-label="Data attesa">{rule.nextExpectedDate.toString()}</td>
                    <td data-label="Importo">
                      {formatMinorUnits(rule.amount.amountMinor, rule.amount.currency)}
                    </td>
                    <td data-label="Stato">{rule.enabled ? "Attiva" : "Pausa"}</td>
                    <td data-label="Azioni">
                      <button
                        className="text-action"
                        onClick={() => setEditing(rule)}
                        type="button"
                      >
                        Modifica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="account-editor-panel">
          <h2>{editing === null ? "Nuova ricorrenza" : "Modifica ricorrenza"}</h2>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form className="account-form" onSubmit={save}>
            <label>
              Nome
              <input
                defaultValue={editing?.name ?? ""}
                key={editing?.id ?? "new"}
                name="name"
                required
              />
            </label>
            <label>
              Tipo
              <select defaultValue={editing?.kind ?? "income"} name="kind">
                <option value="income">Entrata</option>
                <option value="expense">Spesa</option>
              </select>
            </label>
            <label>
              Conto
              <select defaultValue={editing?.accountId ?? accounts[0]?.id} name="accountId">
                {accounts
                  .filter((account) => !account.isArchived)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Importo
              <input
                defaultValue={
                  editing === null
                    ? ""
                    : (editing.amount.amountMinor < 0n
                        ? -editing.amount.amountMinor
                        : editing.amount.amountMinor
                      ).toString()
                }
                inputMode="decimal"
                name="amount"
                required
              />
            </label>
            <label>
              Giorno nominale
              <input
                defaultValue={editing?.nominalDay ?? 28}
                max="31"
                min="1"
                name="nominalDay"
                type="number"
                required
              />
            </label>
            <label>
              Prossima data prevista
              <input
                defaultValue={editing?.nextExpectedDate.toString() ?? ""}
                name="nextExpectedDate"
                type="date"
                required
              />
            </label>
            <label>
              Policy weekend
              <select defaultValue={editing?.weekendPolicy ?? "none"} name="weekendPolicy">
                <option value="none">Nessuna</option>
                <option value="salary_italy">Stipendio italiano</option>
              </select>
            </label>
            <label>
              Categoria
              <select defaultValue={editing?.categoryId ?? ""} name="categoryId">
                <option value="">Nessuna</option>
                {categories
                  .filter((category) => !category.isArchived)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Controparte
              <input defaultValue={editing?.payee ?? ""} name="payee" />
            </label>
            <label className="form-toggle">
              <input defaultChecked={editing?.enabled ?? true} name="enabled" type="checkbox" />{" "}
              Attiva
            </label>
            <div className="form-actions">
              <button className="secondary-action" onClick={() => setEditing(null)} type="button">
                Annulla
              </button>
              <button className="primary-action" type="submit">
                Salva ricorrenza
              </button>
            </div>
          </form>
        </aside>
      </div>
      <AllocationPlans
        accounts={accounts}
        onCreate={onCreateAllocation}
        onExecute={onExecuteAllocations}
        plans={allocationPlans}
      />
    </div>
  );
}
function AllocationPlans({
  accounts,
  plans,
  onCreate,
  onExecute,
}: {
  readonly accounts: readonly Account[];
  readonly plans: readonly AllocationPlan[];
  readonly onCreate: (input: AllocationPlanInput) => Promise<void>;
  readonly onExecute: (planIds: readonly string[]) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmingTrigger, setConfirmingTrigger] = useState<"salary" | "photo_income" | null>(
    null,
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const source = accounts.find((account) => account.id === String(form.get("allocationSource")));
    if (source === undefined) return;
    try {
      await onCreate({
        name: String(form.get("allocationName") ?? ""),
        trigger: String(form.get("allocationTrigger")) as "salary" | "photo_income",
        sourceAccountId: source.id,
        targetAccountId: String(form.get("allocationTarget")),
        amountMinor: abs(
          parseLocalizedAmountMinor(String(form.get("allocationAmount") ?? ""), source.currency),
        ),
        enabled: true,
      });
      setError(null);
      event.currentTarget.reset();
    } catch {
      setError("Impossibile salvare il piano di allocazione.");
    }
  };
  const active = accounts.filter((account) => !account.isArchived);
  const planIdsFor = (trigger: "salary" | "photo_income") =>
    plans.filter((plan) => plan.enabled && plan.trigger === trigger).map((plan) => plan.id);
  const executeAllocations = async () => {
    if (confirmingTrigger === null) return;
    setIsExecuting(true);
    setError(null);
    try {
      await onExecute(planIdsFor(confirmingTrigger));
      setConfirmingTrigger(null);
    } catch {
      setError("Impossibile eseguire le allocazioni. Nessun trasferimento è stato salvato.");
    } finally {
      setIsExecuting(false);
    }
  };
  return (
    <section className="data-panel account-management-panel" aria-labelledby="allocation-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Solo dopo conferma</p>
          <h2 id="allocation-title">Piani di allocazione</h2>
        </div>
        <span className="panel-meta">{plans.length}</span>
      </div>
      {error === null ? null : (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      <ul className="account-list">
        {plans.map((plan) => (
          <li key={plan.id}>
            <div className="account-copy">
              <strong>{plan.name}</strong>
              <small>
                {plan.trigger === "salary" ? "Stipendio" : "Reddito fotografico"} ·{" "}
                {formatMinorUnits(plan.amount.amountMinor, plan.amount.currency)}
              </small>
            </div>
            <span>{plan.enabled ? "Attivo" : "Pausa"}</span>
          </li>
        ))}
      </ul>
      {(["salary", "photo_income"] as const).map((trigger) => {
        const planIds = planIdsFor(trigger);
        if (planIds.length === 0) return null;
        const label = trigger === "salary" ? "stipendio" : "reddito fotografico";
        const question =
          trigger === "salary"
            ? "Stipendio ricevuto. Eseguire le allocazioni pianificate?"
            : "Reddito fotografico ricevuto. Eseguire le allocazioni pianificate?";
        return confirmingTrigger === trigger ? (
          <div
            aria-label={`Conferma allocazioni ${label}`}
            className="account-error"
            key={trigger}
            role="alertdialog"
          >
            <p>{question}</p>
            <div className="form-actions">
              <button
                className="secondary-action"
                disabled={isExecuting}
                onClick={() => setConfirmingTrigger(null)}
                type="button"
              >
                Annulla
              </button>
              <button
                className="primary-action"
                disabled={isExecuting}
                onClick={() => void executeAllocations()}
                type="button"
              >
                {isExecuting ? "Esecuzione…" : "Esegui allocazioni"}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="secondary-action"
            key={trigger}
            onClick={() => setConfirmingTrigger(trigger)}
            type="button"
          >
            Conferma allocazioni {label}
          </button>
        );
      })}
      <form className="account-form" onSubmit={(event) => void save(event)}>
        <label>
          Nome piano
          <input name="allocationName" required />
        </label>
        <label>
          Evento
          <select name="allocationTrigger">
            <option value="salary">Stipendio</option>
            <option value="photo_income">Reddito fotografico</option>
          </select>
        </label>
        <label>
          Conto origine
          <select name="allocationSource">
            {active.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Conto destinazione
          <select name="allocationTarget">
            {active.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Importo
          <input inputMode="decimal" name="allocationAmount" required />
        </label>
        <div className="form-actions">
          <button className="primary-action" type="submit">
            Salva piano
          </button>
        </div>
      </form>
    </section>
  );
}
function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}
function optional(value: string): string | undefined {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}
