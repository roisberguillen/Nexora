import { Money } from "@nexora/domain";
import { describe, expect, it } from "vitest";
import { previewTrashSelection } from "./trashSelection";

describe("previewTrashSelection", () => {
  it("keeps transfers neutral and reports impacted accounts", () => {
    const item = (id: string, amount: bigint, isTransfer = false) => ({
      id,
      amount: Money.fromMinor(amount, "EUR"),
      isTransfer,
      accountLabel: isTransfer ? "A → B" : "A",
      bookedDate: "2026-07-29",
      canCancel: true,
      categoryLabel: "x",
      kindLabel: "x",
      statusLabel: "x",
      title: "x",
    });
    const preview = previewTrashSelection(
      [item("income", 1200n), item("expense", -500n), item("transfer", 800n, true)],
      new Set(["income", "transfer"]),
    );
    expect(preview).toMatchObject({
      transactionGroups: 2,
      transfers: 1,
      incomeMinor: 1200n,
      expenseMinor: 0n,
      accountLabels: ["A", "A → B"],
    });
  });
});
