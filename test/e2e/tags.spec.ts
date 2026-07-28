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
