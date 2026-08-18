import { Money } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import type { TransactionListItem } from "./buildTransactionsViewModel";
import { groupTransactionsByDate, transactionDateGroupLabel } from "./transactionDateGroups";

describe("transaction date groups", () => {
  const now = new Date("2026-08-18T09:00:00");

  it("uses Italian relative labels for today and yesterday", () => {
    expect(transactionDateGroupLabel("2026-08-18", now)).toBe("Oggi");
    expect(transactionDateGroupLabel("2026-08-17", now)).toBe("Ieri");
  });

  it("includes the year only for an older calendar year", () => {
    expect(transactionDateGroupLabel("2026-08-10", now)).toBe("10 agosto");
    expect(transactionDateGroupLabel("2025-12-31", now)).toBe("31 dicembre 2025");
  });

  it("groups the already filtered and sorted input without reordering it", () => {
    const items = [
      item("today", "2026-08-18"),
      item("yesterday", "2026-08-17"),
      item("today-2", "2026-08-18"),
    ];

    expect(groupTransactionsByDate(items, "recent", now)).toEqual([
      expect.objectContaining({ key: "2026-08-18", label: "Oggi", items: [items[0], items[2]] }),
      expect.objectContaining({ key: "2026-08-17", label: "Ieri", items: [items[1]] }),
    ]);
  });

  it("uses a single neutral group for amount sorting", () => {
    const items = [item("first", "2026-08-17"), item("second", "2026-08-18")];

    expect(groupTransactionsByDate(items, "amount-desc", now)).toEqual([
      { key: "all", label: "Movimenti", items },
    ]);
  });
});

function item(id: string, bookedDate: string): TransactionListItem {
  return {
    accountLabel: "Conto corrente",
    amount: Money.fromMinor(-100n, "EUR"),
    bookedDate,
    canCancel: true,
    categoryLabel: "Alimentari",
    id,
    isTransfer: false,
    kind: "expense",
    kindLabel: "Spesa",
    source: "manual",
    status: "booked",
    statusLabel: "Contabilizzato",
    title: id,
  };
}
