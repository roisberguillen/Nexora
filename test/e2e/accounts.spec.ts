import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la gestione conti crea, modifica e archivia senza overflow", async ({ page }) => {
  await page.goto("/#accounts");
  await expect(page.getByRole("heading", { name: "Gestisci i tuoi conti" })).toBeVisible();

  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill("Portafoglio sintetico");
  await page.getByLabel("Tipo").selectOption("cash");
  await page.getByLabel("Saldo iniziale").fill("123,45");
  await page.getByRole("button", { name: "Crea conto" }).click();

  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
  const table = page.getByRole("table", {
    name: "Conti registrati con saldo, stato e azioni disponibili",
  });
  await expect(table).toContainText("Portafoglio sintetico");
  await expect(table).toContainText("123,45");
  if ((await page.evaluate(() => document.documentElement.clientWidth)) >= 768) {
    const row = table.getByRole("row", { name: /Portafoglio sintetico/ });
    const rowBox = await row.boundingBox();
    const actionCell = row.locator('td[data-label="Azioni"]');
    const actionCellBox = await actionCell.boundingBox();
    expect(actionCellBox).not.toBeNull();
    expect(rowBox?.height, "desktop account row height").toBeLessThan(180);
    for (const button of await actionCell.getByRole("button").all()) {
      await expect(button).toBeVisible();
      const buttonBox = await button.boundingBox();
      expect(buttonBox).not.toBeNull();
      expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(
        actionCellBox!.x + actionCellBox!.width + 1,
      );
    }
  } else {
    const row = table.getByRole("row", { name: /Portafoglio sintetico/ });
    const buttons = await row.locator('td[data-label="Azioni"] .table-actions button').all();
    const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));
    expect(boxes.every((box) => box !== null && Math.abs(box.y - boxes[0]!.y) <= 1)).toBe(true);
  }

  await table.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Nome conto").fill("Contanti sintetici");
  await page.getByLabel("Saldo iniziale").fill("150,00");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByRole("status")).toContainText("Modifiche del conto salvate");
  await expect(table).toContainText("Contanti sintetici");

  await table.getByRole("button", { name: "Archivia" }).click();
  await expect(page.getByRole("status")).toContainText("Conto archiviato");
  await expect(table).toContainText("Archiviato");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("la pagina conti desktop resta coerente con la baseline visuale", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440");

  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await expect(page.getByRole("heading", { name: "Crea un conto" })).toBeVisible();

  await expect(page).toHaveScreenshot("accounts-1440.png", {
    animations: "disabled",
    fullPage: true,
    maxDiffPixels: 300,
  });
});

test("svuota un conto con frase esplicita e conserva un percorso di ripristino", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#accounts");
  const emptyButton = page.locator('button[aria-label^="Svuota Conto quotidiano demo"]');
  await expect(emptyButton).toHaveCount(1);
  await emptyButton.click();
  const dialog = page.getByRole("dialog", { name: "Svuotare Conto quotidiano demo?" });
  await expect(dialog).toBeVisible();
  await page.getByLabel("Scrivi SVUOTA CONTO per confermare").fill("SVUOTA CONTO");
  await dialog.getByRole("button", { name: "Svuota conto" }).click();
  await expect(page.getByRole("status")).toContainText("spostati nel cestino");
});
