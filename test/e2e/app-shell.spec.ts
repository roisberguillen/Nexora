import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la shell è accessibile e non produce overflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible();

  const viewport = page.viewportSize();
  if (viewport && viewport.width < 900) {
    const mobileNavigation = page.getByRole("navigation", { name: "Navigazione mobile" });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const quickAction = page.getByRole("button", { name: "Nuova operazione" });
    await quickAction.click();
    await expect(page.getByRole("dialog", { name: "Nuova operazione" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(quickAction).toBeFocused();
  }

  if (viewport && viewport.width >= 900) {
    const desktopNavigation = page.getByRole("navigation", { name: "Navigazione principale" });
    await expect(desktopNavigation.getByRole("heading", { name: "Principale" })).toBeVisible();
    await expect(desktopNavigation.getByRole("link", { name: "Notifiche" })).toBeVisible();
    const collapse = page.getByRole("button", { name: "Riduci menu" });
    await collapse.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Pannello di navigazione")).toHaveClass(/is-collapsed/);
    await expect(page.getByRole("button", { name: "Espandi menu" })).toBeFocused();
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
