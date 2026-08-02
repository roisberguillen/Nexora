import { describe, expect, it } from "vitest";

import { readGenericCsv } from "./genericCsvPreview";

function bytes(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer;
}

describe("generic CSV preview", () => {
  it("detects semicolon delimiter and preserves exact source cells", () => {
    expect(
      readGenericCsv(bytes("Data;Conto;Importo\r\n02/08/2026; N26 ;-12,50")).sheets[0]?.rows,
    ).toEqual([
      ["Data", "Conto", "Importo"],
      ["02/08/2026", " N26 ", "-12,50"],
    ]);
  });

  it("supports quoted delimiters, escaped quotes and logical newlines", () => {
    expect(
      readGenericCsv(bytes('Data,Nota,Importo\n02/08/2026,"Cinema, sala ""A""\nsera",-12.50'))
        .sheets[0]?.rows[1],
    ).toEqual(["02/08/2026", 'Cinema, sala "A"\nsera', "-12.50"]);
  });

  it("rejects malformed or ambiguous content", () => {
    expect(() => readGenericCsv(bytes("una colonna"))).toThrow("csv_delimiter_not_found");
    expect(() => readGenericCsv(bytes('Data,Nota\n02/08/2026,"aperta'))).toThrow(
      "invalid_csv_quotes",
    );
  });
});
