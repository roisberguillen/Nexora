import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const bridgeUrl =
  "/google-drive-oauth-bridge.html?client_id=client.apps.googleusercontent.com&nonce=00000000-0000-4000-8000-000000000000&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.appdata";

test("il ponte Google Drive rende sempre azionabile il consenso", async ({ page }) => {
  await page.route("https://accounts.google.com/gsi/client", (route) => route.abort());
  await page.goto(bridgeUrl);

  const continueWithGoogle = page.getByRole("button", { name: "Continua con Google" });
  await expect(continueWithGoogle).toBeEnabled();
  await continueWithGoogle.click();
  await expect(
    page.getByText("Google non è ancora pronto. Attendi un istante e riprova."),
  ).toBeVisible();
});

test("Google Drive resta opzionale: non appare all'avvio e si collega solo da Backup", async ({
  page,
}) => {
  test.skip(
    process.env.NEXORA_E2E_GOOGLE_ONBOARDING !== "true",
    "Richiede una build esplicitamente configurata con un Client ID sintetico.",
  );

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Panoramica finanziaria" }),
  ).toBeVisible();
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
