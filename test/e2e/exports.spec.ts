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

test("esporta il CSV filtrato e mantiene le azioni utilizzabili su ogni viewport", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#exports");
  await page.getByLabel("Conto").selectOption({ index: 1 });

  const exportPanel = page.locator("#exports");
  await expect(exportPanel).toContainText("5 movimenti inclusi.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica CSV movimenti" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");

  expect(download.suggestedFilename()).toBe("nexora-movimenti.csv");
  expect(csv).toContain("id,data,tipo,stato,conto,importo_minor,valuta");
  expect(csv).toContain("Conto quotidiano demo");
  expect(csv).toContain("-1250");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("mantiene il flusso Export utilizzabile al 200% su desktop", async ({ page }) => {
  test.skip(
    !["chromium-1024", "chromium-1440"].includes(test.info().project.name),
    "La verifica zoom è prevista sulle larghezze desktop.",
  );

  await page.goto("/#exports");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });

  await expect(page.getByRole("heading", { name: "Esporta dati" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scarica CSV movimenti" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth * 2);
});
