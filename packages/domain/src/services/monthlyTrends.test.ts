import { describe, expect, it } from "vitest";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { Transaction } from "../entities/Transaction";
import { calculateMonthlyTrends } from "./monthlyTrends";
describe("calculateMonthlyTrends", () =>
  it("excludes transfers and cancelled movements", () => {
    const create = (
      id: string,
      kind: "income" | "expense" | "transfer",
      amount: bigint,
      status: "booked" | "cancelled" = "booked",
    ) =>
      Transaction.create({
        id,
        kind,
        status,
        accountId: "account",
        amount: Money.fromMinor(amount, "EUR"),
        bookedDate: LocalDate.parse("2026-07-10"),
      });
    const trend = calculateMonthlyTrends(
      [
        create("income", "income", 1000n),
        create("expense", "expense", -200n),
        create("transfer", "transfer", -50n),
        create("cancelled", "expense", -99n, "cancelled"),
      ],
      "EUR",
    );
    expect(trend[0]).toMatchObject({ month: "2026-07" });
    expect(trend[0]?.savings.amountMinor).toBe(800n);
  }));
