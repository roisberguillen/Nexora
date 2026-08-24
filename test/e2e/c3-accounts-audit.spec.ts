import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("C3.4 Accounts: lista, azioni valide e touch target responsive", async ({ page }) => {
  await page.goto("/#accounts");
  await expect(page.getByRole("heading", { name: "Gestisci i tuoi conti" })).toBeVisible();

  const create = page.getByRole("button", { name: "Nuovo conto" });
  const createBox = await create.boundingBox();
  expect(createBox?.width).toBeGreaterThanOrEqual(44);
  expect(createBox?.height).toBeGreaterThanOrEqual(44);
  await create.click();
  await expect(page.getByRole("heading", { name: "Crea un conto" })).toBeVisible();

  const close = page.getByRole("button", { name: "Chiudi modulo conto" });
  const closeBox = await close.boundingBox();
  expect(closeBox?.width).toBeGreaterThanOrEqual(44);
  expect(closeBox?.height).toBeGreaterThanOrEqual(44);
  await page.getByLabel("Nome conto").fill("Conto vuoto sintetico");
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");

  const table = page.getByRole("table", {
    name: "Conti registrati con saldo, stato e azioni disponibili",
  });
  const row = table.getByRole("row", { name: /Conto vuoto sintetico/ });
  await expect(row.getByRole("button", { name: "Elimina" })).toBeVisible();
  for (const label of ["Modifica", "Archivia", "Elimina", "Svuota conto"]) {
    const box = await row.getByRole("button", { name: label }).boundingBox();
    expect(box?.width, `${label} width`).toBeGreaterThanOrEqual(44);
    expect(box?.height, `${label} height`).toBeGreaterThanOrEqual(44);
  }

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
});

test("C3.4 Accounts: un conto con movimenti non espone elimina", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#accounts");
  const populatedRow = page.getByRole("row", { name: /Conto quotidiano demo/ });
  await expect(populatedRow.getByRole("button", { name: "Elimina" })).toHaveCount(0);
});

test("C3.4 Accounts: zoom 200% mantiene lista, editor e azioni", async ({
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
  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await expect(page.getByRole("heading", { name: "Crea un conto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crea conto" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
});
