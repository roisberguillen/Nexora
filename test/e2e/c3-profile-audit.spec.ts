import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("C3.18 Profile audit", () => {
  test("espone il contratto locale senza overflow e con target raggiungibili", async ({ page }) => {
    await page.goto("/#profile");
    const profile = page.locator("#profile");
    await expect(page.getByRole("heading", { level: 1, name: "Nexora" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dati del profilo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Modifica profilo" })).toBeVisible();
    await expect(page.getByText("Solo locale")).toBeVisible();
    await expect(profile.getByRole("link", { name: "Privacy e sicurezza" })).toHaveAttribute(
      "href",
      "./#privacy-security",
    );
    await expect(profile.getByRole("link", { name: "Impostazioni" })).toHaveAttribute(
      "href",
      "./#settings",
    );
    await expect(profile.getByRole("button", { name: "Logout" })).toHaveCount(0);

    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      touchTargets: [...document.querySelectorAll("#profile button, #profile a")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(layout.touchTargets.every(({ width, height }) => width >= 44 && height >= 44)).toBe(
      true,
    );
    expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
  });

  test("salva, persiste e annulla il nome senza effetto sul ledger", async ({ page }) => {
    await page.goto("/#profile");
    await page.getByRole("button", { name: "Modifica profilo" }).click();
    await page.getByLabel("Nome visualizzato").fill("  Ada   Lovelace  ");
    await page.getByRole("button", { name: "Salva profilo" }).click();
    await expect(page.getByRole("status")).toHaveText("Profilo salvato nei dati locali.");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ada Lovelace");

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ada Lovelace");
    await page.getByRole("button", { name: "Modifica profilo" }).click();
    await page.getByLabel("Nome visualizzato").fill("Nome annullato");
    await page.getByRole("button", { name: "Annulla" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ada Lovelace");

    await page.locator("#profile").getByRole("link", { name: "Privacy e sicurezza" }).click();
    await expect(page).toHaveURL(/#privacy-security$/);
    await page.goBack();
    await expect(page).toHaveURL(/#profile$/);
    await page.locator("#profile").getByRole("link", { name: "Impostazioni" }).click();
    await expect(page).toHaveURL(/#settings$/);
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
    await page.goto("/#profile");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
  });
});
