import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Google Drive resta opzionale: non appare all'avvio e si collega solo da Backup", async ({
  page,
}) => {
  test.skip(
    process.env.NEXORA_E2E_GOOGLE_ONBOARDING !== "true",
    "Richiede una build esplicitamente configurata con un Client ID sintetico.",
  );

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Collega il tuo account Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Collega Google Drive" })).toHaveCount(0);

  await page.goto("/#backup");
  await expect(page.getByRole("heading", { name: "Proteggi l’archivio locale" })).toBeVisible();
  const connectDrive = page.getByRole("button", { name: "Collega Google Drive" });
  await expect(connectDrive).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).include("#backup").analyze();
  expect(accessibility.violations).toEqual([]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Proteggi l’archivio locale" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Collega il tuo account Google" })).toHaveCount(0);

  const bridgeResponse = await page.request.get("/google-drive-oauth-bridge.html");
  expect(bridgeResponse.headers()["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
  expect(bridgeResponse.headers()["cross-origin-embedder-policy"]).toBe("require-corp");

  const bridgePage = page.waitForEvent("popup");
  await connectDrive.click();
  const popup = await bridgePage;
  await popup.waitForURL("**/google-drive-oauth-bridge.html?**");
  await expect(popup.getByRole("heading", { name: "Collega Google Drive" })).toBeVisible();
  await expect(popup.getByRole("button", { name: "Continua con Google" })).toBeVisible();
  await popup.close();
});
