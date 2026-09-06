import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinancialAmount, formatMinorUnits, formatPercentage } from "./FinancialAmount";

describe("FinancialAmount", () => {
  it("formatta EUR con locale italiano senza convertire bigint in number", () => {
    expect(formatMinorUnits(900_719_925_474_099_312_345n, "EUR")).toBe(
      "9.007.199.254.740.993.123,45 €",
    );
    expect(formatMinorUnits(-89_640n, "EUR")).toBe("-896,40 €");
  });

  it("supporta valute prive di cifre decimali e il segno positivo esplicito", () => {
    expect(formatMinorUnits(12_345n, "JPY")).toBe("12.345 JPY");
    expect(formatMinorUnits(240_000n, "EUR", "it-IT", true)).toBe("+2.400,00 €");
  });

  it("espone un tono semantico senza modificare il valore visibile", () => {
    const { container } = render(
      <FinancialAmount amountMinor={-1_250n} currency="EUR" tone="negative" />,
    );

    const amount = container.querySelector(".financial-amount");
    expect(amount).toHaveTextContent("-12,50 €");
    expect(amount).toHaveClass("financial-amount", "is-negative");
  });

  it("formatta percentuali con locale e precisione condivisi", () => {
    expect(formatPercentage(12.5)).toBe("12,5%");
    expect(formatPercentage(-3.456, 2, 2)).toBe("-3,46%");
    expect(formatPercentage(0, 1, 1)).toBe("0,0%");
  });
});
