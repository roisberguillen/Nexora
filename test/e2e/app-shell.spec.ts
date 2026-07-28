import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la shell è accessibile e non produce overflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible();

  const viewport = page.viewportSize();
  if (viewport && viewport.width < 900) {
    const menuButton = page.getByRole("button", { name: "Apri navigazione" });
    await menuButton.click();
    await expect(page.getByLabel("Pannello di navigazione")).toHaveClass(/is-open/);
    await page.keyboard.press("Escape");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  }

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("la build resta consultabile offline", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440");

  await page.goto("/");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible();
    const networkIsUnavailable = await page.evaluate(async () => {
      try {
        await fetch(`/network-probe-${Date.now()}`, { cache: "no-store" });
        return false;
      } catch {
        return true;
      }
    });
    expect(networkIsUnavailable).toBe(true);
  } finally {
    await context.setOffline(false);
  }
});
