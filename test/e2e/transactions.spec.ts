import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la gestione movimenti registra e annulla un trasferimento senza overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await page.goto("/#transactions");
  await expect(page.getByRole("heading", { name: "Gestisci i movimenti" })).toBeVisible();

  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByLabel("Tipo").selectOption("transfer");
  const accounts = page.getByLabel("Conto origine");
  const source = await accounts.inputValue();
  await page.getByLabel("Conto destinazione").selectOption({ index: 1 });
  await expect(page.getByLabel("Conto destinazione")).not.toHaveValue(source);
  await page.getByLabel("Importo").fill("25,00");
  await page.getByLabel("Descrizione").fill("Riserva mensile");
  await page.getByRole("button", { name: "Salva movimento" }).click();

  await expect(page.getByRole("status")).toContainText("Trasferimento salvato");
  const table = page.getByRole("table", { name: "Movimenti registrati nel ledger" });
  await expect(table).toContainText("Riserva mensile");
  await table
    .getByRole("row", { name: /Riserva mensile/ })
    .getByRole("button", { name: "Annulla" })
    .click();
  await expect(page.getByRole("status")).toContainText("Trasferimento annullato");
  await expect(table).toContainText("Annullato");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("il modulo movimenti espone righe split responsive", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByRole("button", { name: "Aggiungi ripartizione" }).click();
  await expect(page.getByLabel("Categoria split 1")).toBeVisible();
  await expect(page.getByLabel("Importo split 1")).toBeVisible();
  await page.getByRole("button", { name: "Rimuovi split 1" }).click();
  await expect(page.getByLabel("Categoria split 1")).toHaveCount(0);
});
