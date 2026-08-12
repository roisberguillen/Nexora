import { expect, test } from "@playwright/test";

test("i prestiti registrano rata, residuo e scadenza senza overflow", async ({ page }) => {
  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill("Findomestic sintetico");
  await page.getByLabel("Tipo").selectOption("loan");
  await page.getByRole("button", { name: "Crea conto" }).click();
  await page.goto("/#loans");
  await expect(page.getByRole("heading", { name: "Prestiti", exact: true })).toBeVisible();
  await page.getByLabel("Conto prestito").selectOption({ label: "Findomestic sintetico · EUR" });
  await page.getByLabel("Finanziaria").fill("Findomestic");
  await page.getByLabel("Rata mensile").fill("172,00");
  await page.getByLabel("Capitale residuo").fill("5000,00");
  await page.getByLabel("Capitale originario").fill("10000,00");
  await page.getByLabel("Prossima scadenza").fill("2026-08-01");
  await page.getByRole("button", { name: "Salva prestito" }).click();
  await expect(page.getByText("Findomestic", { exact: true })).toBeVisible();
  await expect(page.getByText("Progresso 50%")).toBeVisible();
  await page.getByRole("button", { name: "Dettaglio" }).click();
  await expect(page.getByRole("heading", { name: "Dettaglio prestito" })).toBeVisible();
  await expect(page.locator(".loan-detail-list dd").first()).toHaveText("Findomestic");
  await page.getByRole("button", { name: "Chiudi" }).click();
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Finanziaria").fill("Agos");
  await page.getByRole("button", { name: "Aggiorna prestito" }).click();
  await expect(page.getByText("Agos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Elimina…" }).click();
  await expect(page.getByRole("dialog", { name: "Eliminare questo prestito?" })).toBeVisible();
  await page.getByRole("button", { name: "Elimina prestito" }).click();
  await expect(page.getByText("Nessun prestito")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
