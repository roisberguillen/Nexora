import { describe, expect, it } from "vitest";
import { LocalDate } from "../value-objects/LocalDate";
import { Money } from "../value-objects/Money";
import { Transaction } from "../entities/Transaction";
import { calculatePrudentExpenseForecast } from "./prudentForecast";
describe("calculatePrudentExpenseForecast", () =>
  it("uses a median and a transparent safety range", () => {
    const rows = [100n, 900n, 200n].map((amount, index) =>
      Transaction.create({
        id: `expense-${index}`,
        kind: "expense",
        status: "booked",
        accountId: "account",
        amount: Money.fromMinor(-amount, "EUR"),
        bookedDate: LocalDate.parse(`2026-0${index + 1}-10`),
      }),
    );
    const result = calculatePrudentExpenseForecast(rows, "EUR");
    expect(result).toMatchObject({ method: "monthly_expense_median", historyMonths: 3 });
    expect(result.expectedExpense.amountMinor).toBe(200n);
    expect(result.upperExpense.amountMinor).toBe(220n);
  }));
