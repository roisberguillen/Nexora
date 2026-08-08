import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("il backup manuale resta accessibile e senza overflow", async ({ page }) => {
  await page.goto("/#backup");
  await expect(page.getByRole("heading", { name: "Proteggi l’archivio locale" })).toBeVisible();
  await expect(page.getByLabel("Passphrase (minimo 12 caratteri)")).toBeVisible();
  await expect(page.getByLabel("File `.nexora-backup`")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Backup cloud" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Backup cloud" })).toContainText(
    /Drive usa|VITE_GOOGLE_CLIENT_ID/,
  );

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("download, verifica e conferma del restore manuale usano il ledger reale", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-1440",
    "Il round-trip cifrato UI viene eseguito una sola volta; il layout gira su tutti i viewport.",
  );

  await page.goto("/");
  const demoButton = page.getByRole("button", { name: "Carica dati dimostrativi" });
  if (await demoButton.isVisible().catch(() => false)) await demoButton.click();
  await page.goto("/#backup");

  const passphrase = page.getByLabel("Passphrase (minimo 12 caratteri)");
  await passphrase.fill("passphrase-e2e-sicura");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica backup cifrato" }).click();
  const download = await downloadPromise;
  const archivePath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(archivePath);
  await expect(page.getByRole("status")).toContainText("Backup verificato scaricato");

  await passphrase.fill("passphrase-e2e-sicura");
  await page.getByLabel("File `.nexora-backup`").setInputFiles(archivePath);
  await page.getByRole("button", { name: "Verifica archivio senza ripristinare" }).click();
  await expect(page.getByRole("heading", { name: "Archivio verificato" })).toBeVisible();
  await expect(page.getByText(download.suggestedFilename())).toBeVisible();

  await page.getByRole("button", { name: "Ripristina archivio verificato" }).click();
  const dialog = page.getByRole("dialog", { name: "Confermare il ripristino?" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await dialog.getByRole("button", { name: "Annulla" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Archivio verificato" })).toBeVisible();
});
