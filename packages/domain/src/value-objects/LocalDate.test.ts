import { describe, expect, it } from "vitest";

import { DomainError } from "../errors/DomainError";
import { LocalDate } from "./LocalDate";

describe("LocalDate", () => {
  it("accetta date ISO valide, inclusi gli anni bisestili", () => {
    expect(LocalDate.parse("2028-02-29").toString()).toBe("2028-02-29");
  });

  it("rifiuta date inesistenti o formati ambigui", () => {
    expect(() => LocalDate.parse("2027-02-29")).toThrowError(DomainError);
    expect(() => LocalDate.parse("27/07/2026")).toThrowError(DomainError);
  });
});
