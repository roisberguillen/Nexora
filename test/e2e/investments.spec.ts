import { expect, test } from "@playwright/test";

test("gli investimenti registrano valore e rendimento senza overflow", async ({ page }) => {
  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill("Directa sintetica");
  await page.getByLabel("Tipo").selectOption("investment");
  await page.getByRole("button", { name: "Crea conto" }).click();
  await page.goto("/#investments");
  await expect(page.getByRole("heading", { name: "Investimenti", exact: true })).toBeVisible();
  await page.getByLabel("Conto investimento").selectOption({ label: "Directa sintetica · EUR" });
  await page.getByLabel("Nome posizione").fill("ETF globale");
  await page.getByLabel("Ticker").fill("VWCE");
  await page.getByLabel("Capitale investito").fill("1000,00");
  await page.getByLabel("Valore corrente").fill("1125,00");
  await page.getByLabel("Data valutazione").fill("2026-08-01");
  await page.getByRole("button", { name: "Salva posizione" }).click();
  await expect(page.getByText("ETF globale", { exact: true })).toBeVisible();
  await expect(page.getByText("Rendimento 125,00 € (12,50%)")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
