import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la gestione categorie crea, modifica e archivia senza overflow", async ({ page }) => {
  await page.goto("/#categories");
  await expect(page.getByRole("heading", { name: "Gestisci le categorie" })).toBeVisible();

  await page.getByLabel("Nome").fill("Casa sintetica");
  await page.getByLabel("Ambito").selectOption("expense");
  await page.getByRole("button", { name: "Salva categoria" }).click();

  const tree = page.getByRole("tree", { name: "Categorie finanziarie" });
  const category = tree.locator(".category-tree-group").filter({ hasText: "Casa sintetica" });
  await expect(category).toContainText("Casa sintetica");
  await category.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Nome").fill("Abitazione sintetica");
  await page.getByRole("button", { name: "Salva categoria" }).click();
  const renamed = tree.locator(".category-tree-group").filter({ hasText: "Abitazione sintetica" });
  await expect(renamed).toContainText("Abitazione sintetica");
  await renamed.getByRole("button", { name: "Modifica" }).click();
  await page
    .locator(".account-editor-panel form")
    .getByRole("button", { name: "Archivia" })
    .click();
  await expect(renamed).toContainText("Archiviata");

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
  const tree = page.getByRole("tree", { name: "Categorie finanziarie" });
  await expect(tree).toContainText("Origine merge");
  await page.getByLabel("Nome").fill("Destinazione merge");
  await page.getByRole("button", { name: "Salva categoria" }).click();
  await expect(tree).toContainText("Destinazione merge");
  const sourceCategory = tree.locator(".category-tree-group").filter({ hasText: "Origine merge" });
  await sourceCategory.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Unisci in").selectOption({ label: "Destinazione merge" });
  await page.getByRole("button", { name: "Unisci e riassegna" }).click();
  await expect(tree).not.toContainText("Origine merge");
});
