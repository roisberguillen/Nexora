import { expect, test } from "@playwright/test";

test("la pagina Budget crea, modifica ed elimina un limite mensile senza overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#budgets");
  await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
  await page.getByLabel("Periodo").fill("2026-07");
  await page.getByLabel("Categoria").selectOption({ label: "Spese demo → Spesa quotidiana demo" });
  await page.getByLabel("Importo").fill("80,00");
  await page.getByRole("button", { name: "Salva budget" }).click();
  await expect(page.getByRole("heading", { name: "Budget mensili" })).toBeVisible();
  const budgetList = page.getByRole("region", { name: "Budget mensili" });
  await expect(budgetList.getByText("Spese demo → Spesa quotidiana demo")).toBeVisible();
  await expect(budgetList.getByText("Superato")).toBeVisible();
  await expect(budgetList.getByRole("progressbar")).toBeVisible();
  await page.getByRole("button", { name: "Modifica" }).click();
  await expect(page.getByRole("heading", { name: "Modifica budget" })).toBeVisible();
  await page.getByLabel("Importo").fill("90,00");
  await page.getByRole("button", { name: "Aggiorna budget" }).click();
  await expect(budgetList.getByText(/90,00/)).toBeVisible();
  await page.getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "I movimenti associati non verranno cancellati.",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Elimina" }).click();
  await page.getByRole("button", { name: "Elimina budget" }).click();
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
  await expect(page.getByLabel("Periodo")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
