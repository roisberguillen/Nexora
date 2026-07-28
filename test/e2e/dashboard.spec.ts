import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la dashboard sintetica è accessibile e responsive", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible();

  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText(
    "Patrimonio locale5.133,60 €",
  );
  await expect(page.getByText("Conto quotidiano demo → Riserva demo")).toHaveCount(1);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("la dashboard desktop resta coerente con la baseline visuale", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440");

  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();

  await expect(page).toHaveScreenshot("dashboard-1440.png", {
    animations: "disabled",
    fullPage: true,
  });
});
