import { LocalDate, Money, Transaction } from "@nexora/domain";
import { describe, expect, it } from "vitest";

import { countExpiredTrashEntries, isTrashEntryExpired } from "./trashRetention";

const entry = {
  transaction: Transaction.create({
    id: "trashed-entry",
    kind: "expense",
    status: "booked",
    accountId: "account-1",
    amount: Money.fromMinor(-100n, "EUR"),
    bookedDate: LocalDate.parse("2026-06-29"),
  }),
  deletedAt: "2026-06-29T10:00:00.000Z",
  deletionGroupId: "transaction:trashed-entry",
};

describe("trash retention", () => {
  it("marks expired entries for review without purging them", () => {
    const now = new Date("2026-07-29T10:00:00.000Z");
    expect(isTrashEntryExpired(entry, 30, now)).toBe(true);
    expect(countExpiredTrashEntries([entry], 30, now)).toBe(1);
  });
});
