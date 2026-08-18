import { describe, expect, it } from "vitest";
import { Money } from "@nexora/domain";

import { filterTransactions, emptyTransactionFilters } from "./transactionFilters";
import type { TransactionListItem } from "./buildTransactionsViewModel";

const items: readonly TransactionListItem[] = [
  item({
    accountLabel: "Conto quotidiano",
    bookedDate: "2026-08-03",
    categoryLabel: "Spesa · Casa",
    id: "1",
    kindLabel: "Spesa",
    title: "Supermercato",
  }),
  item({
    accountLabel: "Risparmio",
    bookedDate: "2026-08-04",
    categoryLabel: "Trasferimento interno",
    id: "2",
    kindLabel: "Trasferimento",
    title: "Riserva",
  }),
  item({
    accountLabel: "Conto quotidiano",
    bookedDate: "2026-07-31",
    categoryLabel: "Entrata · Lavoro",
    id: "3",
    kindLabel: "Entrata",
    title: "Stipendio",
  }),
];

describe("filterTransactions", () => {
  it("combina testo, periodo, conto, categoria e tipo senza cambiare gli elementi", () => {
    const result = filterTransactions(items, {
      accountLabel: "Conto quotidiano",
      categoryLabel: "Spesa · Casa",
      kindLabel: "Spesa",
      month: "2026-08",
      query: "super",
      statusLabel: "",
    });

    expect(result.map((item) => item.id)).toEqual(["1"]);
    expect(items).toHaveLength(3);
  });

  it("mantiene trasferimenti e filtra per tipo", () => {
    expect(
      filterTransactions(items, { ...emptyTransactionFilters, kindLabel: "Trasferimento" }).map(
        (item) => item.id,
      ),
    ).toEqual(["2"]);
  });

  it("cerca senza distinzione maiuscole e spazi e combina lo stato", () => {
    expect(
      filterTransactions(items, {
        ...emptyTransactionFilters,
        query: "  SUPERmercato ",
        statusLabel: "Contabilizzato",
      }).map((item) => item.id),
    ).toEqual(["1"]);
  });
});

function item(overrides: Partial<TransactionListItem>): TransactionListItem {
  return {
    accountLabel: "Conto",
    amount: Money.fromMinor(-1n, "EUR"),
    bookedDate: "2026-08-01",
    canCancel: true,
    categoryLabel: "Spesa",
    id: "1",
    isTransfer: false,
    kindLabel: "Spesa",
    statusLabel: "Contabilizzato",
    title: "Movimento",
    ...overrides,
  };
}
