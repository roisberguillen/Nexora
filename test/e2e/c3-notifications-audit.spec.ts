import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("C3.17 Notifications audit", () => {
  test("shows local alerts, preserves read state and keeps the surface within the viewport", async ({
    page,
  }, testInfo) => {
    await page.goto("/#notifications");
    await expect(page.getByRole("heading", { name: "Notifiche", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Segna tutte come lette" })).toBeVisible();
    await expect(page.getByLabel(/notifiche non lette/)).toBeVisible();

    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });

    await page.getByRole("button", { name: "Segna tutte come lette" }).click();
    await expect(page.getByRole("button", { name: "Segna tutte come lette" })).toHaveCount(0);
    await expect(page.getByLabel(/notifiche non lette/)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Segna tutte come lette" })).toHaveCount(0);
  });

  test("marks a notification read before deep-linking to its target", async ({ page }) => {
    await page.goto("/#notifications");
    const open = page.getByRole("link", { name: "Apri", exact: true }).first();
    await expect(open).toBeVisible();
    await open.click();
    await expect(page).toHaveURL(/#backup|#accounts|#budgets|#recurring|#loans/);
  });

  test("resta utilizzabile al 200% sui desktop", async ({ context, page }, testInfo) => {
    test.skip(!["chromium-1024", "chromium-1440"].includes(testInfo.project.name));
    const physicalWidth = testInfo.project.name === "chromium-1024" ? 1024 : 1440;
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: physicalWidth / 2,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await page.goto("/#notifications");
    await expect(page.getByRole("heading", { name: "Notifiche", exact: true })).toBeVisible();
    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
  });
});
