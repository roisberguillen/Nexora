import { describe, expect, it } from "vitest";

import { DomainError } from "../errors/DomainError";
import { Money } from "./Money";

describe("Money", () => {
  it("esegue operazioni soltanto in minor units e nella stessa valuta", () => {
    const left = Money.fromMinor(12_050n, "EUR");
    const right = Money.fromMinor(950n, "EUR");

    expect(left.add(right).amountMinor).toBe(13_000n);
    expect(left.subtract(right).amountMinor).toBe(11_100n);
    expect(right.negate().amountMinor).toBe(-950n);
  });

  it("rifiuta number e operazioni tra valute diverse", () => {
    expect(() => Money.fromMinor(10 as unknown as bigint, "EUR")).toThrowError(DomainError);
    expect(() => Money.fromMinor(100n, "eur")).toThrowError(DomainError);
    expect(() => Money.fromMinor(100n, "EUR").add(Money.fromMinor(100n, "USD"))).toThrowError(
      DomainError,
    );
  });

  it("serializza bigint come stringa JSON senza perdita di precisione", () => {
    const money = Money.fromMinor(9_007_199_254_740_993n, "EUR");

    expect(JSON.stringify(money)).toBe('{"amountMinor":"9007199254740993","currency":"EUR"}');
  });
});
