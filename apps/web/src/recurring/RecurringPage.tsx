import { LocalDate, Money, RecurringRule, categoryLabel } from "@nexora/domain";
import type {
  Account,
  AllocationPlan,
  Category,
  RecurrenceUnit,
  WeekendPolicy,
} from "@nexora/domain";
import { formatMinorUnits } from "@nexora/ui";
import { useState, type FormEvent } from "react";

import { formatEditableAmountMinor, parseLocalizedAmountMinor } from "../accounts/accountCommands";
import { AccessibleDialog } from "../settings/AccessibleDialog";
import type { RecurringRuleInput } from "./recurringCommands";
import type { AllocationPlanInput } from "./allocationCommands";

export function RecurringPage({
  accounts,
  allocationPlans,
  categories,
  rules,
  onCreate,
  onCreateAllocation,
  onDeleteAllocation,
  onExecuteAllocations,
  onUpdateAllocation,
  onUpdate,
  onDelete,
}: {
  readonly accounts: readonly Account[];
  readonly allocationPlans: readonly AllocationPlan[];
  readonly categories: readonly Category[];
  readonly rules: readonly RecurringRule[];
  readonly onCreate: (input: RecurringRuleInput) => Promise<void>;
  readonly onCreateAllocation: (input: AllocationPlanInput) => Promise<void>;
  readonly onDeleteAllocation: (id: string) => Promise<void>;
  readonly onExecuteAllocations: (
    planIds: readonly string[],
    executionId: string,
  ) => Promise<{
    readonly alreadyExecutedPlanIds: readonly string[];
    readonly executedPlanIds: readonly string[];
  }>;
  readonly onUpdateAllocation: (id: string, input: AllocationPlanInput) => Promise<void>;
  readonly onUpdate: (id: string, input: RecurringRuleInput) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [formKind, setFormKind] = useState<"income" | "expense">("income");
  const [frequencyUnit, setFrequencyUnit] = useState<RecurrenceUnit>("month");
  const [interval, setInterval] = useState(1);
  const [nominalDate, setNominalDate] = useState("");
  const [nominalDay, setNominalDay] = useState(28);
  const [nominalMonth, setNominalMonth] = useState(1);
  const [weekendPolicy, setWeekendPolicy] = useState<WeekendPolicy>("none");
  const [error, setError] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<RecurringRule | null>(null);
  const openEditor = (rule: RecurringRule | null) => {
    setFormKind(rule?.kind ?? "income");
    setFrequencyUnit(rule?.frequencyUnit ?? "month");
    setInterval(rule?.interval ?? 1);
    setNominalDate(rule?.nextNominalDate.toString() ?? "");
    setNominalDay(rule?.nominalDay ?? 28);
    setNominalMonth(rule?.nominalMonth ?? 1);
    setWeekendPolicy(rule?.weekendPolicy ?? "none");
    setEditing(rule);
  };
  const updateEnabled = async (rule: RecurringRule, enabled: boolean) => {
    try {
      await onUpdate(rule.id, ruleInput(rule, enabled));
    } catch {
      setError("Impossibile aggiornare lo stato della ricorrenza.");
    }
  };
  const remove = async () => {
    if (deleteCandidate === null) return;
    try {
      await onDelete(deleteCandidate.id);
      setDeleteCandidate(null);
      if (editing?.id === deleteCandidate.id) setEditing(null);
    } catch {
      setError(
        "Impossibile eliminare la ricorrenza. I movimenti già confermati restano invariati.",
      );
    }
  };
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
      frequencyUnit,
      interval,
      nominalDay,
      ...(frequencyUnit === "year" ? { nominalMonth } : {}),
      weekendPolicy,
      nextNominalDate: nominalDate,
      enabled: Boolean(form.get("enabled")),
      ...(kind === "expense" && editing?.kind === "expense"
        ? {
            ...(editing.expenseVariability === undefined
              ? {}
              : { expenseVariability: editing.expenseVariability }),
            ...(editing.expenseExceptionality === undefined
              ? {}
              : { expenseExceptionality: editing.expenseExceptionality }),
          }
        : {}),
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
      openEditor(null);
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
              <h2 id="recurring-title">Regole</h2>
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
                      <small>
                        {rule.kind === "income" ? "Entrata" : "Uscita"} ·{" "}
                        {rule.payee ?? "Senza controparte"}
                      </small>
                    </td>
                    <td data-label="Data attesa">
                      {rule.nextExpectedDate.toString()}
                      <small>{frequencyLabel(rule)}</small>
                    </td>
                    <td data-label="Importo">
                      {formatMinorUnits(rule.amount.amountMinor, rule.amount.currency)}
                    </td>
                    <td data-label="Stato">{rule.enabled ? "Attiva" : "Pausa"}</td>
                    <td data-label="Azioni">
                      <button
                        className="text-action"
                        onClick={() => openEditor(rule)}
                        type="button"
                      >
                        Modifica
                      </button>
                      <button
                        className="text-action"
                        onClick={() => void updateEnabled(rule, !rule.enabled)}
                        type="button"
                      >
                        {rule.enabled ? "Metti in pausa" : "Riattiva"}
                      </button>
                      <button
                        className="text-action"
                        onClick={() => setDeleteCandidate(rule)}
                        type="button"
                      >
                        Elimina…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {deleteCandidate === null ? null : (
            <div
              aria-labelledby="delete-recurring-title"
              aria-modal="true"
              className="account-error"
              role="dialog"
            >
              <h3 id="delete-recurring-title">Eliminare la ricorrenza?</h3>
              <p>I movimenti già confermati non verranno eliminati.</p>
              <div className="form-actions">
                <button
                  className="secondary-action"
                  onClick={() => setDeleteCandidate(null)}
                  type="button"
                >
                  Annulla
                </button>
                <button className="primary-action" onClick={() => void remove()} type="button">
                  Elimina ricorrenza
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="account-editor-panel">
          <h2>{editing === null ? "Nuova ricorrenza" : "Modifica ricorrenza"}</h2>
          {error === null ? null : (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form className="account-form" key={editing?.id ?? "new"} onSubmit={save}>
            <label>
              Nome
              <input defaultValue={editing?.name ?? ""} name="name" required />
            </label>
            <label>
              Tipo
              <select
                defaultValue={editing?.kind ?? "income"}
                name="kind"
                onChange={(event) => setFormKind(event.currentTarget.value as "income" | "expense")}
              >
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
                    : formatEditableAmountMinor(
                        editing.amount.amountMinor < 0n
                          ? -editing.amount.amountMinor
                          : editing.amount.amountMinor,
                        editing.amount.currency,
                      )
                }
                inputMode="decimal"
                name="amount"
                required
              />
            </label>
            <label>
              Frequenza
              <select
                name="frequencyUnit"
                onChange={(event) => setFrequencyUnit(event.currentTarget.value as RecurrenceUnit)}
                value={frequencyUnit}
              >
                <option value="week">Settimana</option>
                <option value="month">Mese</option>
                <option value="year">Anno</option>
              </select>
            </label>
            <label>
              Intervallo
              <input
                max="120"
                min="1"
                name="interval"
                onChange={(event) => setInterval(Number(event.currentTarget.value))}
                type="number"
                value={interval}
              />
            </label>
            <label>
              Giorno nominale
              <input
                max="31"
                min="1"
                name="nominalDay"
                onChange={(event) => setNominalDay(Number(event.currentTarget.value))}
                type="number"
                required
                value={nominalDay}
              />
            </label>
            {frequencyUnit !== "year" ? null : (
              <label>
                Mese nominale
                <select
                  name="nominalMonth"
                  onChange={(event) => setNominalMonth(Number(event.currentTarget.value))}
                  value={nominalMonth}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Prossima data prevista
              <input
                onChange={(event) => setNominalDate(event.currentTarget.value)}
                name="nextNominalDate"
                type="date"
                required
                value={nominalDate}
              />
              <small>La serie resta ancorata alla data nominale.</small>
            </label>
            <label>
              Policy weekend
              <select
                name="weekendPolicy"
                onChange={(event) => setWeekendPolicy(event.currentTarget.value as WeekendPolicy)}
                value={weekendPolicy}
              >
                <option value="none">Nessuna</option>
                <option value="previous_business_day">Giorno lavorativo precedente</option>
                <option value="next_business_day">Giorno lavorativo successivo</option>
                <option value="salary_italy">Stipendio italiano</option>
              </select>
            </label>
            <label>
              Categoria
              <select
                defaultValue={editing?.categoryId ?? ""}
                key={`category-${formKind}`}
                name="categoryId"
              >
                <option value="">Nessuna</option>
                {categories
                  .filter(
                    (category) =>
                      !category.isArchived &&
                      (category.kindScope === "both" || category.kindScope === formKind),
                  )
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(category, categories)}
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
            <SchedulePreview
              account={accounts.find(
                (account) => account.id === (editing?.accountId ?? accounts[0]?.id),
              )}
              amountMinor={editing?.amount.amountMinor ?? (formKind === "expense" ? -1n : 1n)}
              frequencyUnit={frequencyUnit}
              interval={interval}
              nominalDate={nominalDate}
              nominalDay={nominalDay}
              nominalMonth={frequencyUnit === "year" ? nominalMonth : undefined}
              weekendPolicy={weekendPolicy}
            />
            <div className="form-actions">
              <button className="secondary-action" onClick={() => openEditor(null)} type="button">
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
        onDelete={onDeleteAllocation}
        onExecute={onExecuteAllocations}
        onUpdate={onUpdateAllocation}
        plans={allocationPlans}
      />
    </div>
  );
}
function AllocationPlans({
  accounts,
  plans,
  onCreate,
  onDelete,
  onExecute,
  onUpdate,
}: {
  readonly accounts: readonly Account[];
  readonly plans: readonly AllocationPlan[];
  readonly onCreate: (input: AllocationPlanInput) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onExecute: (
    planIds: readonly string[],
    executionId: string,
  ) => Promise<{
    readonly alreadyExecutedPlanIds: readonly string[];
    readonly executedPlanIds: readonly string[];
  }>;
  readonly onUpdate: (id: string, input: AllocationPlanInput) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmingTrigger, setConfirmingTrigger] = useState<"salary" | "photo_income" | null>(
    null,
  );
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AllocationPlan | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AllocationPlan | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [needsExecutionRecovery, setNeedsExecutionRecovery] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const source = accounts.find((account) => account.id === String(form.get("allocationSource")));
    const targetId = String(form.get("allocationTarget"));
    if (source === undefined) return;
    if (source.id === targetId) {
      setError("Il conto di origine e quello di destinazione devono essere diversi.");
      return;
    }
    try {
      const input: AllocationPlanInput = {
        name: String(form.get("allocationName") ?? ""),
        trigger: String(form.get("allocationTrigger")) as "salary" | "photo_income",
        sourceAccountId: source.id,
        targetAccountId: targetId,
        amountMinor: abs(
          parseLocalizedAmountMinor(String(form.get("allocationAmount") ?? ""), source.currency),
        ),
        enabled: Boolean(form.get("allocationEnabled")),
      };
      if (editing === null) await onCreate(input);
      else await onUpdate(editing.id, input);
      setError(null);
      setReceipt(
        editing === null ? "Piano di allocazione salvato." : "Piano di allocazione aggiornato.",
      );
      setEditing(null);
      event.currentTarget.reset();
    } catch {
      setError("Impossibile salvare il piano. Verifica conti, valuta e importo.");
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
      const result = await onExecute(
        planIdsFor(confirmingTrigger),
        executionId ?? crypto.randomUUID(),
      );
      setConfirmingTrigger(null);
      setExecutionId(null);
      setNeedsExecutionRecovery(false);
      setReceipt(
        result.alreadyExecutedPlanIds.length === 0
          ? `${result.executedPlanIds.length} allocazioni registrate come trasferimenti.`
          : `${result.executedPlanIds.length} registrate; ${result.alreadyExecutedPlanIds.length} già presenti.`,
      );
    } catch {
      setNeedsExecutionRecovery(true);
      setError(
        "L'esecuzione potrebbe essere parziale. Riprova: i trasferimenti già registrati non verranno duplicati.",
      );
    } finally {
      setIsExecuting(false);
    }
  };
  return (
    <section
      aria-labelledby="allocation-title"
      className="data-panel account-management-panel recurring-allocation-panel"
    >
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
      {receipt === null ? null : (
        <p className="account-feedback" role="status">
          {receipt}
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
              <small>
                {accounts.find((account) => account.id === plan.sourceAccountId)?.name ??
                  "Conto rimosso"}
                {" → "}
                {accounts.find((account) => account.id === plan.targetAccountId)?.name ??
                  "Conto rimosso"}
              </small>
            </div>
            <span>{plan.enabled ? "Attivo" : "Pausa"}</span>
            <div className="allocation-plan-actions">
              <button className="text-action" onClick={() => setEditing(plan)} type="button">
                Modifica
              </button>
              <button
                className="text-action"
                onClick={() =>
                  void onUpdate(plan.id, {
                    name: plan.name,
                    trigger: plan.trigger,
                    sourceAccountId: plan.sourceAccountId,
                    targetAccountId: plan.targetAccountId,
                    amountMinor: plan.amount.amountMinor,
                    enabled: !plan.enabled,
                  }).catch(() => setError("Impossibile aggiornare lo stato del piano."))
                }
                type="button"
              >
                {plan.enabled ? "Metti in pausa" : "Riattiva"}
              </button>
              <button
                className="text-action"
                onClick={() => setDeleteCandidate(plan)}
                type="button"
              >
                Elimina…
              </button>
            </div>
          </li>
        ))}
      </ul>
      {(["salary", "photo_income"] as const).map((trigger) => {
        const planIds = planIdsFor(trigger);
        if (planIds.length === 0) return null;
        const label = trigger === "salary" ? "stipendio" : "reddito fotografico";
        return confirmingTrigger === trigger ? null : (
          <button
            className="secondary-action"
            key={trigger}
            onClick={() => {
              setConfirmingTrigger(trigger);
              setExecutionId(crypto.randomUUID());
            }}
            type="button"
          >
            Conferma allocazioni {label}
          </button>
        );
      })}
      <form
        className="account-form allocation-plan-form"
        key={editing?.id ?? "new"}
        onSubmit={(event) => void save(event)}
      >
        <h3>{editing === null ? "Nuovo piano" : "Modifica piano"}</h3>
        <label>
          Nome piano
          <input defaultValue={editing?.name} name="allocationName" required />
        </label>
        <label>
          Evento
          <select defaultValue={editing?.trigger} name="allocationTrigger">
            <option value="salary">Stipendio</option>
            <option value="photo_income">Reddito fotografico</option>
          </select>
        </label>
        <label>
          Conto origine
          <select
            defaultValue={editing?.sourceAccountId ?? active[0]?.id ?? ""}
            name="allocationSource"
          >
            {active.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Conto destinazione
          <select
            defaultValue={
              editing?.targetAccountId ??
              active.find((account) => account.id !== (editing?.sourceAccountId ?? active[0]?.id))
                ?.id ??
              ""
            }
            name="allocationTarget"
          >
            {active.map((account) => (
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
                : formatEditableAmountMinor(editing.amount.amountMinor, editing.amount.currency)
            }
            inputMode="decimal"
            name="allocationAmount"
            required
          />
        </label>
        <label className="form-toggle">
          <input
            defaultChecked={editing?.enabled ?? true}
            name="allocationEnabled"
            type="checkbox"
          />
          <span>Attiva</span>
        </label>
        <div className="form-actions">
          {editing === null ? null : (
            <button className="secondary-action" onClick={() => setEditing(null)} type="button">
              Annulla
            </button>
          )}
          <button className="primary-action" type="submit">
            {editing === null ? "Salva piano" : "Aggiorna piano"}
          </button>
        </div>
      </form>
      {confirmingTrigger === null ? null : (
        <AccessibleDialog
          labelledBy="allocation-confirm-title"
          onClose={() => {
            if (!needsExecutionRecovery) {
              setConfirmingTrigger(null);
              setExecutionId(null);
            }
          }}
        >
          <h2 id="allocation-confirm-title">
            Conferma allocazioni{" "}
            {confirmingTrigger === "salary" ? "stipendio" : "reddito fotografico"}
          </h2>
          <p>
            {confirmingTrigger === "salary"
              ? "Stipendio ricevuto."
              : "Reddito fotografico ricevuto."}{" "}
            Verranno creati {planIdsFor(confirmingTrigger).length} trasferimenti reali.
          </p>
          <ul>
            {plans
              .filter((plan) => plan.enabled && plan.trigger === confirmingTrigger)
              .map((plan) => (
                <li key={plan.id}>
                  {plan.name}: {formatMinorUnits(plan.amount.amountMinor, plan.amount.currency)}
                </li>
              ))}
          </ul>
          <div className="form-actions">
            <button
              disabled={isExecuting}
              onClick={() => {
                if (!needsExecutionRecovery) {
                  setConfirmingTrigger(null);
                  setExecutionId(null);
                }
              }}
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
              {isExecuting
                ? "Esecuzione…"
                : needsExecutionRecovery
                  ? "Riprova allocazioni"
                  : "Esegui allocazioni"}
            </button>
          </div>
        </AccessibleDialog>
      )}
      {deleteCandidate === null ? null : (
        <AccessibleDialog
          labelledBy="allocation-delete-title"
          onClose={() => setDeleteCandidate(null)}
        >
          <h2 id="allocation-delete-title">Eliminare questo piano?</h2>
          <p>I trasferimenti già eseguiti restano nel ledger.</p>
          <div className="form-actions">
            <button onClick={() => setDeleteCandidate(null)} type="button">
              Annulla
            </button>
            <button
              className="danger-action"
              onClick={() =>
                void onDelete(deleteCandidate.id)
                  .then(() => {
                    setDeleteCandidate(null);
                    setReceipt("Piano eliminato. I trasferimenti già eseguiti restano invariati.");
                  })
                  .catch(() => setError("Impossibile eliminare il piano."))
              }
              type="button"
            >
              Elimina piano
            </button>
          </div>
        </AccessibleDialog>
      )}
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

function ruleInput(rule: RecurringRule, enabled: boolean): RecurringRuleInput {
  return {
    name: rule.name,
    kind: rule.kind,
    accountId: rule.accountId,
    amountMinor: rule.amount.amountMinor,
    frequencyUnit: rule.frequencyUnit,
    interval: rule.interval,
    nominalDay: rule.nominalDay,
    nextNominalDate: rule.nextNominalDate.toString(),
    weekendPolicy: rule.weekendPolicy,
    enabled,
    ...(rule.nominalMonth === undefined ? {} : { nominalMonth: rule.nominalMonth }),
    ...(rule.expenseVariability === undefined
      ? {}
      : { expenseVariability: rule.expenseVariability }),
    ...(rule.expenseExceptionality === undefined
      ? {}
      : { expenseExceptionality: rule.expenseExceptionality }),
    ...(rule.categoryId === undefined ? {} : { categoryId: rule.categoryId }),
    ...(rule.payee === undefined ? {} : { payee: rule.payee }),
  };
}

function SchedulePreview({
  account,
  amountMinor,
  frequencyUnit,
  interval,
  nominalDate,
  nominalDay,
  nominalMonth,
  weekendPolicy,
}: {
  readonly account: Account | undefined;
  readonly amountMinor: bigint;
  readonly frequencyUnit: RecurrenceUnit;
  readonly interval: number;
  readonly nominalDate: string;
  readonly nominalDay: number;
  readonly nominalMonth: number | undefined;
  readonly weekendPolicy: WeekendPolicy;
}) {
  const dates = previewDates({
    account,
    amountMinor,
    frequencyUnit,
    interval,
    nominalDate,
    nominalDay,
    nominalMonth,
    weekendPolicy,
  });
  return (
    <details className="recurring-preview">
      <summary>Anteprima prossime date</summary>
      <p>Solo previsione: nessun movimento viene creato o registrato.</p>
      {dates.length === 0 ? (
        <p>Inserisci una prossima data valida per visualizzare le scadenze.</p>
      ) : (
        <ol>
          {dates.map(({ nominalDate: nominal, effectiveDate }) => (
            <li key={nominal.toString()}>
              {effectiveDate.toString()}
              {nominal.equals(effectiveDate) ? "" : ` (nominale ${nominal.toString()})`}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

function previewDates({
  account,
  amountMinor,
  frequencyUnit,
  interval,
  nominalDate,
  nominalDay,
  nominalMonth,
  weekendPolicy,
}: {
  readonly account: Account | undefined;
  readonly amountMinor: bigint;
  readonly frequencyUnit: RecurrenceUnit;
  readonly interval: number;
  readonly nominalDate: string;
  readonly nominalDay: number;
  readonly nominalMonth: number | undefined;
  readonly weekendPolicy: WeekendPolicy;
}) {
  if (account === undefined || nominalDate === "" || !Number.isInteger(interval) || interval < 1)
    return [];
  try {
    return RecurringRule.create({
      id: "preview",
      name: "Anteprima",
      kind: amountMinor < 0n ? "expense" : "income",
      accountId: account.id,
      amount: Money.fromMinor(amountMinor, account.currency),
      frequencyUnit,
      interval,
      nominalDay,
      ...(frequencyUnit === "year" && nominalMonth !== undefined ? { nominalMonth } : {}),
      weekendPolicy,
      nextNominalDate: LocalDate.parse(nominalDate),
    }).preview();
  } catch {
    return [];
  }
}

function frequencyLabel(rule: RecurringRule): string {
  const every = rule.interval === 1 ? "Ogni" : `Ogni ${rule.interval}`;
  const unit =
    rule.frequencyUnit === "week"
      ? rule.interval === 1
        ? "settimana"
        : "settimane"
      : rule.frequencyUnit === "month"
        ? rule.interval === 1
          ? "mese"
          : "mesi"
        : rule.interval === 1
          ? "anno"
          : "anni";
  return `${every} ${unit}`;
}
