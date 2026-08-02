import { expect, test } from "@playwright/test";

test("esporta il ledger JSON completo senza applicare i filtri dei movimenti", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#exports");
  await page.getByLabel("Conto").selectOption({ index: 1 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica JSON completo" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    readonly formatVersion: number;
    readonly entities: Record<string, unknown[]>;
    readonly relations: Record<string, unknown[]>;
  };

  expect(download.suggestedFilename()).toBe("nexora-ledger-completo.json");
  expect(payload.formatVersion).toBe(1);
  expect(Object.keys(payload.entities)).toEqual(
    expect.arrayContaining([
      "accounts",
      "categories",
      "tags",
      "transactions",
      "transfers",
      "importBatches",
      "recurringRules",
      "budgets",
      "loans",
      "investmentPositions",
      "monthlyJournals",
    ]),
  );
  expect(Object.keys(payload.relations)).toEqual(
    expect.arrayContaining(["splits", "transactionTags", "importRows"]),
  );
  expect(payload.entities.transactions).toHaveLength(8);
});
