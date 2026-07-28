import { expect, test } from "@playwright/test";

test("le ricorrenze creano e modificano una proposta senza overflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await page.goto("/#recurring");
  await expect(page.getByRole("heading", { name: "Ricorrenze" })).toBeVisible();
  await page.getByLabel("Nome").fill("Stipendio sintetico");
  await page.getByLabel("Conto").selectOption({ label: "Conto quotidiano demo" });
  await page.getByLabel("Importo").fill("2500,00");
  await page.getByLabel("Prossima data prevista").fill("2026-08-28");
  await page.getByRole("button", { name: "Salva ricorrenza" }).click();
  await expect(page.getByText("Stipendio sintetico")).toBeVisible();
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Nome").fill("Stipendio confermabile");
  await page.getByRole("button", { name: "Salva ricorrenza" }).click();
  await expect(page.getByText("Stipendio confermabile")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
