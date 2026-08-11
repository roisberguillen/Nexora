import { Account, AllocationPlan, Category, LocalDate, Money, RecurringRule } from "@nexora/domain";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RecurringPage } from "./RecurringPage";

describe("RecurringPage", () => {
  it("aligns the enabled toggle with its label", () => {
    render(
      <RecurringPage
        accounts={[]}
        allocationPlans={[]}
        categories={[]}
        onCreate={async () => undefined}
        onCreateAllocation={async () => undefined}
        onDeleteAllocation={async () => undefined}
        onExecuteAllocations={async () => ({ alreadyExecutedPlanIds: [], executedPlanIds: [] })}
        onDelete={async () => undefined}
        onUpdate={async () => undefined}
        onUpdateAllocation={async () => undefined}
        rules={[]}
      />,
    );

    expect(screen.getAllByLabelText("Attiva")[0]!.parentElement).toHaveClass("form-toggle");
    expect(screen.getAllByLabelText("Attiva")[1]!.parentElement).toHaveClass("form-toggle");
    expect(screen.getByRole("region", { name: "Piani di allocazione" })).toHaveClass(
      "recurring-allocation-panel",
    );
    expect(screen.getByLabelText("Nome piano").closest("form")).toHaveClass("allocation-plan-form");
  });

  it("updates category choices when the selected rule kind changes", async () => {
    const user = userEvent.setup();
    renderPage();
    const category = screen.getByLabelText("Categoria");

    expect(within(category).getByRole("option", { name: "Stipendio" })).toBeVisible();
    expect(within(category).queryByRole("option", { name: "Alimentari" })).toBeNull();

    await user.selectOptions(screen.getByLabelText("Tipo"), "expense");

    expect(
      within(screen.getByLabelText("Categoria")).getByRole("option", { name: "Alimentari" }),
    ).toBeVisible();
    expect(
      within(screen.getByLabelText("Categoria")).queryByRole("option", { name: "Stipendio" }),
    ).toBeNull();
  });

  it("remounts the complete form when switching between rules and a new rule", async () => {
    const user = userEvent.setup();
    renderPage({ rules: [incomeRule, expenseRule] });

    await user.click(screen.getAllByRole("button", { name: "Modifica" })[0]!);
    expect(screen.getByLabelText("Nome")).toHaveValue("Stipendio");
    expect(screen.getByLabelText("Tipo")).toHaveValue("income");
    expect(screen.getAllByLabelText("Importo")[0]).toHaveValue("1200,00");

    await user.click(screen.getAllByRole("button", { name: "Modifica" })[1]!);
    expect(screen.getByLabelText("Nome")).toHaveValue("Spesa casa");
    expect(screen.getByLabelText("Tipo")).toHaveValue("expense");

    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.getByLabelText("Tipo")).toHaveValue("income");
    expect(screen.getByLabelText("Categoria")).toHaveValue("");
  });

  it("offers advanced schedule controls and previews dates through the domain rule", async () => {
    const user = userEvent.setup();
    renderPage({ rules: [incomeRule] });

    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.getByLabelText("Frequenza")).toHaveValue("month");
    expect(screen.getByLabelText("Intervallo")).toHaveValue(1);

    await user.click(screen.getByText("Anteprima prossime date"));
    expect(screen.getAllByText("2026-08-28")).toHaveLength(2);
    expect(screen.getByText("2026-09-28")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Frequenza"), "week");
    await user.clear(screen.getByLabelText("Intervallo"));
    await user.type(screen.getByLabelText("Intervallo"), "2");
    expect(screen.getByLabelText("Frequenza")).toHaveValue("week");
  });

  it("preserves every supported weekend policy and expense behavior when pausing a rule", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn(async () => undefined);
    const classifiedRule = RecurringRule.create({
      ...expenseRule.toProps(),
      weekendPolicy: "next_business_day",
      expenseVariability: "fixed",
      expenseExceptionality: "ordinary",
    });
    render(
      <RecurringPage
        accounts={[account]}
        allocationPlans={[]}
        categories={[incomeCategory, expenseCategory]}
        onCreate={vi.fn(async () => undefined)}
        onCreateAllocation={vi.fn(async () => undefined)}
        onDeleteAllocation={vi.fn(async () => undefined)}
        onExecuteAllocations={vi.fn(async () => ({
          alreadyExecutedPlanIds: [],
          executedPlanIds: [],
        }))}
        onDelete={vi.fn(async () => undefined)}
        onUpdate={onUpdate}
        onUpdateAllocation={vi.fn(async () => undefined)}
        rules={[classifiedRule]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.getByLabelText("Policy weekend")).toHaveValue("next_business_day");
    await user.click(screen.getByRole("button", { name: "Metti in pausa" }));

    expect(onUpdate).toHaveBeenCalledWith(
      classifiedRule.id,
      expect.objectContaining({
        enabled: false,
        weekendPolicy: "next_business_day",
        expenseVariability: "fixed",
        expenseExceptionality: "ordinary",
      }),
    );
  });

  it("edits, pauses and asks before deleting an allocation plan", async () => {
    const user = userEvent.setup();
    const onUpdateAllocation = vi.fn(async () => undefined);
    const onDeleteAllocation = vi.fn(async () => undefined);
    const plan = AllocationPlan.create({
      id: "allocation",
      name: "Risparmio",
      trigger: "salary",
      sourceAccountId: account.id,
      targetAccountId: secondAccount.id,
      amount: Money.fromMinor(10_000n, "EUR"),
    });
    render(
      <RecurringPage
        accounts={[account, secondAccount]}
        allocationPlans={[plan]}
        categories={[incomeCategory, expenseCategory]}
        onCreate={vi.fn(async () => undefined)}
        onCreateAllocation={vi.fn(async () => undefined)}
        onDelete={vi.fn(async () => undefined)}
        onDeleteAllocation={onDeleteAllocation}
        onExecuteAllocations={vi.fn(async () => ({
          alreadyExecutedPlanIds: [],
          executedPlanIds: [],
        }))}
        onUpdate={vi.fn(async () => undefined)}
        onUpdateAllocation={onUpdateAllocation}
        rules={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.getByRole("heading", { name: "Modifica piano" })).toBeVisible();
    expect(screen.getByLabelText("Nome piano")).toHaveValue("Risparmio");
    await user.click(screen.getByRole("button", { name: "Metti in pausa" }));
    expect(onUpdateAllocation).toHaveBeenCalledWith(
      plan.id,
      expect.objectContaining({ enabled: false }),
    );
    await user.click(screen.getByRole("button", { name: "Elimina…" }));
    expect(screen.getByRole("dialog", { name: "Eliminare questo piano?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Elimina piano" }));
    expect(onDeleteAllocation).toHaveBeenCalledWith(plan.id);
  });

  it("keeps the execution id available for a safe retry after a partial allocation failure", async () => {
    const user = userEvent.setup();
    const onExecuteAllocations = vi
      .fn<
        (
          planIds: readonly string[],
          executionId: string,
        ) => Promise<{
          readonly alreadyExecutedPlanIds: readonly string[];
          readonly executedPlanIds: readonly string[];
        }>
      >()
      .mockRejectedValueOnce(new Error("partial failure"))
      .mockResolvedValueOnce({ alreadyExecutedPlanIds: ["allocation"], executedPlanIds: [] });
    const plan = AllocationPlan.create({
      id: "allocation",
      name: "Risparmio",
      trigger: "salary",
      sourceAccountId: account.id,
      targetAccountId: secondAccount.id,
      amount: Money.fromMinor(10_000n, "EUR"),
    });
    render(
      <RecurringPage
        accounts={[account, secondAccount]}
        allocationPlans={[plan]}
        categories={[incomeCategory, expenseCategory]}
        onCreate={vi.fn(async () => undefined)}
        onCreateAllocation={vi.fn(async () => undefined)}
        onDelete={vi.fn(async () => undefined)}
        onDeleteAllocation={vi.fn(async () => undefined)}
        onExecuteAllocations={onExecuteAllocations}
        onUpdate={vi.fn(async () => undefined)}
        onUpdateAllocation={vi.fn(async () => undefined)}
        rules={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Conferma allocazioni stipendio" }));
    await user.click(screen.getByRole("button", { name: "Esegui allocazioni" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/potrebbe essere parziale/i);
    expect(screen.getByRole("button", { name: "Riprova allocazioni" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Riprova allocazioni" }));
    await screen.findByRole("status");
    expect(onExecuteAllocations).toHaveBeenCalledTimes(2);
    expect(onExecuteAllocations.mock.calls[1]?.[1]).toBe(onExecuteAllocations.mock.calls[0]?.[1]);
  });
});

const account = Account.create({ id: "account", name: "Conto", type: "checking", currency: "EUR" });
const secondAccount = Account.create({
  id: "second",
  name: "Riserva",
  type: "savings",
  currency: "EUR",
});
const incomeCategory = Category.create({ id: "income", name: "Stipendio", kindScope: "income" });
const expenseCategory = Category.create({
  id: "expense",
  name: "Alimentari",
  kindScope: "expense",
});
const incomeRule = RecurringRule.create({
  id: "income-rule",
  name: "Stipendio",
  kind: "income",
  accountId: account.id,
  amount: Money.fromMinor(120_000n, "EUR"),
  nominalDay: 28,
  nextExpectedDate: LocalDate.parse("2026-08-28"),
});
const expenseRule = RecurringRule.create({
  id: "expense-rule",
  name: "Spesa casa",
  kind: "expense",
  accountId: account.id,
  amount: Money.fromMinor(-85_000n, "EUR"),
  nominalDay: 28,
  nextExpectedDate: LocalDate.parse("2026-08-28"),
  categoryId: expenseCategory.id,
});

function renderPage({
  rules = [] as readonly RecurringRule[],
}: { rules?: readonly RecurringRule[] } = {}) {
  return render(
    <RecurringPage
      accounts={[account]}
      allocationPlans={[]}
      categories={[incomeCategory, expenseCategory]}
      onCreate={vi.fn(async () => undefined)}
      onCreateAllocation={vi.fn(async () => undefined)}
      onDeleteAllocation={vi.fn(async () => undefined)}
      onExecuteAllocations={vi.fn(async () => ({
        alreadyExecutedPlanIds: [],
        executedPlanIds: [],
      }))}
      onDelete={vi.fn(async () => undefined)}
      onUpdate={vi.fn(async () => undefined)}
      onUpdateAllocation={vi.fn(async () => undefined)}
      rules={rules}
    />,
  );
}
