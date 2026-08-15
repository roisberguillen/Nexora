import { Account, Money } from "@nexora/domain";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ImportsPage } from "./ImportsPage";

const mediobancaAccount = Account.create({
  id: "mediobanca-premier",
  name: "Mediobanca Premier",
  type: "checking",
  currency: "EUR",
  openingBalance: Money.zero("EUR"),
});

describe("ImportsPage", () => {
  it("detects a Mediobanca CSV by headers, maps it automatically and selects its existing account", async () => {
    const user = userEvent.setup();
    render(
      <ImportsPage
        accounts={[mediobancaAccount]}
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
    expect(screen.getByLabelText("Conto locale predefinito")).toHaveValue("Mediobanca Premier");
    expect(screen.getByText("1 pronte")).toBeVisible();
  });
});
