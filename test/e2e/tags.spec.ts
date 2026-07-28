import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la gestione tag crea, modifica e archivia senza overflow", async ({ page }) => {
  await page.goto("/#tags");
  await expect(page.getByRole("heading", { name: "Gestisci i tag" })).toBeVisible();

  await page.getByLabel("Nome").fill("Lavoro sintetico");
  await page.getByRole("button", { name: "Salva tag" }).click();

  const table = page.getByRole("table", { name: "Tag registrati nel ledger" });
  await expect(table).toContainText("Lavoro sintetico");
  await table.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Nome").fill("Fotografia sintetica");
  await page.getByRole("button", { name: "Salva tag" }).click();
  await expect(table).toContainText("Fotografia sintetica");
  await table.getByRole("button", { name: "Modifica" }).click();
  await page.getByRole("button", { name: "Archivia" }).click();
  await expect(table).toContainText("Archiviato");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("un tag attivo può essere assegnato a un nuovo movimento", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#tags");
  await page.getByLabel("Nome").fill("Progetto sintetico");
  await page.getByRole("button", { name: "Salva tag" }).click();
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await expect(page.getByRole("checkbox", { name: "Progetto sintetico" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Progetto sintetico" }).check();
  await page.getByLabel("Importo", { exact: true }).fill("12,00");
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento salvato");
});
