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

describe("calculateMonthlyTrends performance", () =>
  it.each([1_000, 10_000, 100_000])(
    "aggregates a synthetic %i-record ledger without precision loss",
    (count) => {
      const transactions = Array.from({ length: count }, (_, index) =>
        Transaction.create({
          id: `benchmark-${index}`,
          kind: index % 3 === 0 ? "income" : "expense",
          status: "booked",
          accountId: "benchmark-account",
          amount: Money.fromMinor(index % 3 === 0 ? 10_000n : -2_500n, "EUR"),
          bookedDate: LocalDate.parse(`2026-${String((index % 12) + 1).padStart(2, "0")}-15`),
        }),
      );

      const trends = calculateMonthlyTrends(transactions, "EUR");

      expect(trends).toHaveLength(12);
      expect(
        trends.reduce((total, trend) => total.add(trend.income), Money.zero("EUR")).amountMinor,
      ).toBe(BigInt(Math.ceil(count / 3)) * 10_000n);
    },
  ));
