import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("l'onboarding Google resta accessibile, responsive e ignorabile", async ({ page }) => {
  test.skip(
    process.env.NEXORA_E2E_GOOGLE_ONBOARDING !== "true",
    "Richiede una build esplicitamente configurata con un Client ID sintetico.",
  );

  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Collega il tuo account Google" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible();
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).include("[role=dialog]").analyze();
  expect(accessibility.violations).toEqual([]);

  await dialog.getByRole("button", { name: "Continua senza Drive" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Collega il tuo account Google" })).toHaveCount(0);
});
