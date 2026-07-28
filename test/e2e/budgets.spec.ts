import { expect, test } from "@playwright/test";

test("la pagina Budget crea un limite mensile senza overflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#budgets");
  await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
  await page.getByLabel("Periodo").fill("2026-07");
  await page.getByLabel("Categoria").selectOption({ label: "Spesa quotidiana demo" });
  await page.getByLabel("Importo").fill("80,00");
  await page.getByRole("button", { name: "Salva budget" }).click();
  await expect(page.getByRole("heading", { name: "Budget mensili" })).toBeVisible();
  const budgetList = page.getByRole("region", { name: "Budget mensili" });
  await expect(budgetList.getByText("Spesa quotidiana demo")).toBeVisible();
  await expect(budgetList.getByText("Superato")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
