import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la gestione conti crea, modifica e archivia senza overflow", async ({ page }) => {
  await page.goto("/#accounts");
  await expect(page.getByRole("heading", { name: "Gestisci i tuoi conti" })).toBeVisible();

  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill("Portafoglio sintetico");
  await page.getByLabel("Tipo").selectOption("cash");
  await page.getByLabel("Saldo iniziale").fill("123,45");
  await page.getByRole("button", { name: "Crea conto" }).click();

  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
  const table = page.getByRole("table", {
    name: "Conti registrati con saldo, stato e azioni disponibili",
  });
  await expect(table).toContainText("Portafoglio sintetico");
  await expect(table).toContainText("123,45");

  await table.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Nome conto").fill("Contanti sintetici");
  await page.getByLabel("Saldo iniziale").fill("150,00");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByRole("status")).toContainText("Modifiche del conto salvate");
  await expect(table).toContainText("Contanti sintetici");

  await table.getByRole("button", { name: "Archivia" }).click();
  await expect(page.getByRole("status")).toContainText("Conto archiviato");
  await expect(table).toContainText("Archiviato");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("la pagina conti desktop resta coerente con la baseline visuale", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440");

  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await expect(page.getByRole("heading", { name: "Crea un conto" })).toBeVisible();

  await expect(page).toHaveScreenshot("accounts-1440.png", {
    animations: "disabled",
    fullPage: true,
  });
});
