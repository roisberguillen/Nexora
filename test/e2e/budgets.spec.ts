import { expect, test } from "@playwright/test";

test("la pagina Budget crea, modifica ed elimina un limite mensile senza overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#budgets");
  await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption("demo-category-expenses");
  await page
    .getByRole("combobox", { name: "Sotto-categoria", exact: true })
    .selectOption("demo-category-groceries");
  await page.getByLabel("Importo").fill("80,00");
  await page.getByLabel("Prima soglia di notifica (%)").fill("60");
  await page.getByLabel("Seconda soglia di notifica (%)").fill("90");
  await page.getByRole("button", { name: "Salva budget" }).click();
  await expect(page.getByRole("heading", { name: "Budget mensili" })).toBeVisible();
  const budgetList = page.getByRole("region", { name: "Budget mensili" });
  await expect(budgetList.getByText("Spese demo → Spesa quotidiana demo")).toBeVisible();
  await expect(budgetList.getByText("Nei limiti")).toBeVisible();
  await expect(budgetList.getByRole("progressbar")).toBeVisible();
  await page.getByRole("button", { name: "Modifica" }).click();
  await expect(page.getByRole("heading", { name: "Modifica budget" })).toBeVisible();
  await page.getByLabel("Importo").fill("90,00");
  await page.getByLabel("Prima soglia di notifica (%)").fill("65");
  await page.getByLabel("Seconda soglia di notifica (%)").fill("95");
  await page.getByRole("button", { name: "Aggiorna budget" }).click();
  await expect(budgetList.getByText("90,00 €", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Disattiva" }).click();
  await expect(page.getByRole("dialog")).toContainText("I movimenti non verranno cancellati.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Disattiva" }).click();
  await page.getByRole("button", { name: "Disattiva budget" }).click();
  await page.getByRole("button", { name: "Mese successivo" }).click();
  await expect(page.getByRole("heading", { name: "Nessun budget" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("il form Budget resta utilizzabile al 200% su desktop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440", "Verifica zoom solo sul viewport desktop.");
  await page.goto("/#budgets");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
  await expect(page.getByLabel("Prima soglia di notifica (%)")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
