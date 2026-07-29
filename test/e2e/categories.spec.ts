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

test("unisce una categoria e riassegna i riferimenti", async ({ page }) => {
  await page.goto("/#categories");
  await page.getByLabel("Nome").fill("Origine merge");
  await page.getByRole("button", { name: "Salva categoria" }).click();
  await expect(page.getByRole("table")).toContainText("Origine merge");
  await page.getByLabel("Nome").fill("Destinazione merge");
  await page.getByRole("button", { name: "Salva categoria" }).click();
  await expect(page.getByRole("table")).toContainText("Destinazione merge");
  const sourceRow = page.getByRole("row").filter({ hasText: "Origine merge" });
  await sourceRow.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Unisci in").selectOption({ label: "Destinazione merge" });
  await page.getByRole("button", { name: "Unisci e riassegna" }).click();
  await expect(page.getByRole("table")).not.toContainText("Origine merge");
});
