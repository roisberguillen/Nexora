import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("C3.3 Dashboard: stato vuoto, dati reali e responsive senza overflow", async ({ page }) => {
  await page.goto("/#overview");
  await expect(
    page.getByRole("heading", { level: 1, name: "Panoramica finanziaria" }),
  ).toBeVisible();
  await expect(page.getByText("Panoramica finanziaria", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Il ledger è pronto per i primi dati" }),
  ).toBeVisible();
  await expect(page.getByText("NESSUN BUDGET", { exact: true })).toHaveCount(1);

  const demoButton = page.getByRole("button", { name: "Carica dati dimostrativi" });
  const demoBox = await demoButton.boundingBox();
  expect(demoBox?.width).toBeGreaterThanOrEqual(44);
  expect(demoBox?.height).toBeGreaterThanOrEqual(44);
  await demoButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText("Disponibilità attuale");
  await expect(page.getByText("Entrate del mese")).toBeVisible();
  await expect(page.getByText("Spese del mese")).toBeVisible();
  await expect(page.getByText("Risparmio del mese")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Budget" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prossime uscite" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Andamento spese" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spese principali" })).toBeVisible();
  await expect(page.getByText("Trasferimento interno", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Conto quotidiano demo → Riserva demo")).toHaveCount(1);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
});

test("C3.3 Dashboard: zoom 200% mantiene contenuto prioritario e azioni", async ({
  page,
  context,
}, testInfo) => {
  test.skip(!["chromium-1024", "chromium-1440"].includes(testInfo.project.name));

  const width = testInfo.project.name === "chromium-1024" ? 1024 : 1440;
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 2,
    height: 900,
    mobile: false,
    width: Math.floor(width / 2),
  });
  await page.goto("/#overview");
  await expect(
    page.getByRole("heading", { level: 1, name: "Panoramica finanziaria" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
});
