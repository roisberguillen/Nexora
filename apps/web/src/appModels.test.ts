import type { BrowserLedger } from "@nexora/database";
import { describe, expect, it } from "vitest";

import { loadAppModels } from "./appModels";

describe("loadAppModels", () => {
  it("propaga il fallimento del repository senza inventare dati di fallback", async () => {
    const ledger = {
      repository: {
        listAccounts: async () => Promise.reject(new Error("repository unavailable")),
      },
    } as unknown as BrowserLedger;

    await expect(loadAppModels(ledger)).rejects.toMatchObject({
      code: "NX-READ-ACCOUNTS",
      name: "LedgerReadError",
    });
  });
});
