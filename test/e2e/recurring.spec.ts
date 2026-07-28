import { expect, test } from "@playwright/test";

test("le ricorrenze creano e modificano una proposta senza overflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await page.goto("/#recurring");
  await expect(page.getByRole("heading", { name: "Ricorrenze" })).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill("Stipendio sintetico");
  await page.locator('select[name="accountId"]').selectOption({ label: "Conto quotidiano demo" });
  await page.locator('input[name="amount"]').fill("2500,00");
  await page.getByLabel("Prossima data prevista").fill("2026-08-28");
  await page.getByRole("button", { name: "Salva ricorrenza" }).click();
  await expect(page.getByText("Stipendio sintetico")).toBeVisible();
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.locator('input[name="name"]').fill("Stipendio confermabile");
  await page.getByRole("button", { name: "Salva ricorrenza" }).click();
  await expect(page.getByText("Stipendio confermabile")).toBeVisible();
  await page.getByLabel("Nome piano").fill("Risparmio sintetico");
  await page.getByLabel("Conto origine").selectOption({ label: "Conto quotidiano demo" });
  await page.getByLabel("Conto destinazione").selectOption({ label: "Riserva demo" });
  await page.getByLabel("Importo").last().fill("170,00");
  await page.getByRole("button", { name: "Salva piano" }).click();
  await expect(page.getByText("Risparmio sintetico")).toBeVisible();
  await page.getByRole("button", { name: "Conferma allocazioni stipendio" }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Conferma allocazioni stipendio" });
  await expect(confirmation).toContainText("Stipendio ricevuto");
  await confirmation.getByRole("button", { name: "Esegui allocazioni" }).click();
  await expect(confirmation).not.toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
