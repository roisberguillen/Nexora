import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("C3.1 shell: drawer, focus, route e resize live", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-390");

  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Apri navigazione" });
  await menu.click();
  const drawer = page.getByLabel("Pannello di navigazione");
  await expect(drawer).toHaveClass(/is-open/);
  await expect(drawer.getByRole("button", { name: "Chiudi navigazione" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(drawer).toContainText("Panoramica");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMenu = page.getByRole("button", { name: "Apri menu completo" });
  await mobileMenu.click();
  const mobileDrawer = page.getByRole("dialog", { name: "Menu" });
  const mobileDrawerBox = await mobileDrawer.boundingBox();
  expect(mobileDrawerBox?.x).toBe(0);
  expect(mobileDrawerBox?.y).toBe(0);
  expect(mobileDrawerBox?.width).toBe(390);
  expect(mobileDrawerBox?.height).toBe(844);
  for (const label of [
    "Budget",
    "Ricorrenze e allocazioni",
    "Prestiti",
    "Investimenti",
    "Diario finanziario",
    "Categorie",
    "Tag",
    "Importa",
    "Esporta",
    "Backup",
    "Impostazioni e cestino",
    "Privacy e sicurezza",
  ]) {
    await expect(mobileDrawer.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(
    page.getByRole("navigation", { name: "Navigazione mobile" }).getByRole("link"),
  ).toHaveCount(5);
  await mobileDrawer.getByRole("button", { name: "Chiudi menu" }).click();
  await page
    .getByRole("navigation", { name: "Navigazione mobile" })
    .getByRole("link", { name: "Movimenti" })
    .click();
  await expect(page).toHaveURL(/#transactions$/);
  await page.goBack();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/#transactions$/);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.getByRole("navigation", { name: "Navigazione mobile" })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByRole("navigation", { name: "Navigazione mobile" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
});

test("C3.1 shell: zoom browser 200% resta utilizzabile", async ({ context, page }, testInfo) => {
  test.skip(!["chromium-1024", "chromium-1440"].includes(testInfo.project.name));

  const physicalWidth = testInfo.project.name === "chromium-1024" ? 1024 : 1440;
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: physicalWidth / 2,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Panoramica finanziaria" }),
  ).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.getByRole("navigation", { name: "Navigazione mobile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuova operazione" })).toBeVisible();
  expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
});
