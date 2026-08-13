import { expect, test } from "@playwright/test";

test("analytics, journal and notifications use the persisted ledger without responsive overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();

  await page.goto("/#analytics");
  await expect(page.getByRole("heading", { name: "Analisi", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Grafico delle spese mensili" })).toBeVisible();

  await page.goto("/#journal");
  await expect(page.getByRole("heading", { name: "Diario", exact: true })).toBeVisible();
  await page.getByLabel("Come è andato il mese?").fill("Riflessione E2E sintetica");
  await page.getByLabel("Percezione di controllo").selectOption("4");
  await page.getByRole("button", { name: "Salva diario" }).click();
  await expect(page.getByRole("status")).toContainText("Diario mensile salvato");

  await page.goto("/#notifications");
  await expect(page.getByRole("heading", { name: "Notifiche", exact: true })).toBeVisible();
  await page.getByLabel("Soglia saldo basso (EUR)").fill("25,00");
  await page.getByRole("button", { name: "Salva soglia" }).click();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
