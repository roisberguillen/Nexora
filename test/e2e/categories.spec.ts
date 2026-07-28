import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la gestione categorie crea, modifica e archivia senza overflow", async ({ page }) => {
  await page.goto("/#categories");
  await expect(page.getByRole("heading", { name: "Gestisci le categorie" })).toBeVisible();

  await page.getByLabel("Nome").fill("Casa sintetica");
  await page.getByLabel("Ambito").selectOption("expense");
  await page.getByRole("button", { name: "Salva categoria" }).click();

  const table = page.getByRole("table");
  await expect(table).toContainText("Casa sintetica");
  await table.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Nome").fill("Abitazione sintetica");
  await page.getByRole("button", { name: "Salva categoria" }).click();
  await expect(table).toContainText("Abitazione sintetica");
  await table.getByRole("button", { name: "Modifica" }).click();
  await page.getByRole("button", { name: "Archivia" }).click();
  await expect(table).toContainText("Archiviata");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
