import { Account, Loan, LocalDate, Money } from "@nexora/domain";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoansPage } from "./LoansPage";

const account = Account.create({
  id: "loan-account",
  name: "Prestito casa",
  type: "loan",
  currency: "EUR",
});
const loan = Loan.create({
  id: "loan",
  accountId: account.id,
  lender: "Finanziaria demo",
  installment: Money.fromMinor(17_200n, "EUR"),
  remainingPrincipal: Money.fromMinor(500_000n, "EUR"),
  originalPrincipal: Money.fromMinor(1_000_000n, "EUR"),
  annualNominalRateBps: 499,
  installmentsPaid: 5,
  installmentsRemaining: 15,
  nextDueDate: LocalDate.parse("2026-09-01"),
});

describe("LoansPage", () => {
  it("shows the accessible detail and edits the full loan model", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn(async () => undefined);
    render(
      <LoansPage
        accounts={[account]}
        loans={[loan]}
        onCreate={async () => undefined}
        onDelete={async () => undefined}
        onUpdate={onUpdate}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Dettaglio" }));
    expect(screen.getByRole("heading", { name: "Dettaglio prestito" })).toBeVisible();
    expect(screen.getByText("Prestito casa")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.getByRole("heading", { name: "Modifica prestito" })).toBeVisible();
    await user.clear(screen.getByLabelText("Finanziaria"));
    await user.type(screen.getByLabelText("Finanziaria"), "Istituto demo");
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    expect(onUpdate).toHaveBeenCalledWith(
      loan.id,
      expect.objectContaining({
        lender: "Istituto demo",
        annualNominalRateBps: 499,
        installmentsPaid: 5,
      }),
    );
  });

  it("confirms deletion without offering an account deletion", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(async () => undefined);
    render(
      <LoansPage
        accounts={[account]}
        loans={[loan]}
        onCreate={async () => undefined}
        onDelete={onDelete}
        onUpdate={async () => undefined}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Elimina…" }));
    expect(screen.getByRole("dialog", { name: "Eliminare questo prestito?" })).toHaveTextContent(
      "movimenti e le ricorrenze restano invariati",
    );
    await user.click(screen.getByRole("button", { name: "Elimina prestito" }));
    expect(onDelete).toHaveBeenCalledWith(loan.id);
  });

  it("preserves bigint amounts exactly when opening and saving an edit", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn(async () => undefined);
    const large = Loan.create({
      id: "large-loan",
      accountId: account.id,
      lender: "Finanziaria demo",
      installment: Money.fromMinor(9_007_199_254_740_993n, "EUR"),
      remainingPrincipal: Money.fromMinor(90_071_992_547_409_930n, "EUR"),
      originalPrincipal: Money.fromMinor(100_000_000_000_000_000n, "EUR"),
    });
    render(
      <LoansPage
        accounts={[account]}
        loans={[large]}
        onCreate={async () => undefined}
        onDelete={async () => undefined}
        onUpdate={onUpdate}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.getByLabelText("Rata mensile")).toHaveValue("90071992547409,93");
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    expect(onUpdate).toHaveBeenCalledWith(
      large.id,
      expect.objectContaining({
        installmentMinor: large.installment.amountMinor,
        remainingPrincipalMinor: large.remainingPrincipal.amountMinor,
      }),
    );
  });

  it("ignores a second submit while a loan is being saved", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const onCreate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(
      <LoansPage
        accounts={[account]}
        loans={[]}
        onCreate={onCreate}
        onDelete={async () => undefined}
        onUpdate={async () => undefined}
      />,
    );
    await user.type(screen.getByLabelText("Finanziaria"), "Banca demo");
    await user.type(screen.getByLabelText("Rata mensile"), "100,00");
    await user.type(screen.getByLabelText("Capitale residuo"), "1000,00");
    await user.dblClick(screen.getByRole("button", { name: "Salva prestito" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    release();
  });
});
