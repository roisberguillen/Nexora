import { Account, Money } from "@nexora/domain";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@nexora/importers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nexora/importers")>()),
  resolvePremierBankDefaultAccount: () => "Conto bancario demo",
  readMoneyManagerWorkbook: () => ({
    sheets: [
      {
        name: "Money Manager",
        rows: [
          [
            "Data",
            "Conto",
            "Importo",
            "Valuta",
            "Controparte",
            "Nota",
            "Categoria",
            "Sotto-categoria",
            "Tipo",
          ],
          [
            "46246",
            "Conto quotidiano demo",
            "-10,00",
            "EUR",
            "Demo",
            "Demo",
            "Alimentazione",
            "Spesa alimentare",
            "Spesa",
          ],
        ],
      },
    ],
  }),
}));

import { ImportsPage } from "./ImportsPage";

const bankAccount = Account.create({
  id: "bank-demo",
  name: "Conto bancario demo",
  type: "checking",
  currency: "EUR",
  openingBalance: Money.zero("EUR"),
});

describe("ImportsPage", () => {
  it("detects a supported bank CSV by headers, maps it and selects its existing account", async () => {
    const user = userEvent.setup();
    render(
      <ImportsPage
        accounts={[bankAccount]}
        batches={[]}
        categories={[]}
        onCommit={vi.fn(async () => undefined)}
        onUndo={vi.fn(async () => undefined)}
        transactions={[]}
      />,
    );

    await user.upload(
      screen.getByLabelText("Seleziona un estratto CSV, XLSX o PDF"),
      new File(
        [
          "Data contabile;Data valuta;Tipologia;Entrate;Uscite;Divisa\n13/08/2026;11/08/2026;Pagamento POS;;-7,40;EUR",
        ],
        "estratto.csv",
        { type: "text/csv" },
      ),
    );

    expect(await screen.findByText("Data movimento: Data valuta.")).toBeVisible();
    expect(screen.getByLabelText("Data")).toHaveValue("0");
    expect(screen.getByLabelText("Importo")).toHaveValue("2");
    expect(screen.getByLabelText("Valuta")).toHaveValue("3");
    expect(screen.getByLabelText("Controparte")).toHaveValue("4");
    expect(screen.getByLabelText("Conto locale predefinito")).toHaveValue("Conto bancario demo");
    expect(screen.getByText("1 pronte")).toBeVisible();
  });

  it("shows one Money Manager migration plan and removes per-row account repair", async () => {
    const user = userEvent.setup();
    const currentAccount = Account.create({
      id: "current-main",
      name: "Conto quotidiano demo",
      type: "checking",
      currency: "EUR",
    });
    render(
      <ImportsPage
        accounts={[currentAccount]}
        batches={[]}
        categories={[]}
        onCommit={vi.fn(async () => undefined)}
        onUndo={vi.fn(async () => undefined)}
        transactions={[]}
      />,
    );
    await user.upload(
      screen.getByLabelText("Seleziona un estratto CSV, XLSX o PDF"),
      new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "moneymanager.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Piano di migrazione" })).toBeVisible();
    expect(screen.getByText("Conti rilevati")).toBeVisible();
    expect(screen.getByText("Categorie Money Manager")).toBeVisible();
    expect(screen.queryByLabelText("Conto per riga 2")).not.toBeInTheDocument();
    expect(screen.getByText("1 pronte")).toBeVisible();
  });
});
