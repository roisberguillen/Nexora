import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la gestione tag crea, modifica e archivia senza overflow", async ({ page }) => {
  await page.goto("/#tags");
  await expect(page.getByRole("heading", { name: "Gestisci i tag" })).toBeVisible();

  await page.getByLabel("Nome").fill("Lavoro sintetico");
  await page.getByRole("button", { name: "Salva tag" }).click();

  const table = page.getByRole("table", { name: "Tag registrati nel ledger" });
  await expect(table).toContainText("Lavoro sintetico");
  await page.getByLabel("Nome").fill("lavoro sintetico");
  await page.getByRole("button", { name: "Salva tag" }).click();
  await expect(page.getByRole("alert")).toHaveText("Impossibile salvare il tag.");
  await table.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Nome").fill("Fotografia sintetica");
  await page.getByRole("button", { name: "Salva tag" }).click();
  await expect(table).toContainText("Fotografia sintetica");
  await table.getByRole("button", { name: "Modifica" }).click();
  await page.getByRole("button", { name: "Archivia" }).click();
  await expect(table).toContainText("Archiviato");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("un tag attivo può essere assegnato a un nuovo movimento", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#tags");
  await page.getByLabel("Nome").fill("Progetto sintetico");
  await page.getByRole("button", { name: "Salva tag" }).click();
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByText("Altri dettagli").click();
  await expect(page.getByRole("checkbox", { name: "Progetto sintetico" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Progetto sintetico" }).check();
  await page.getByLabel("Importo", { exact: true }).fill("12,00");
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento salvato");
});

test("unisce e deduplica un tag", async ({ page }) => {
  await page.goto("/#tags");
  await page.getByLabel("Nome").fill("Origine tag");
  await page.getByRole("button", { name: "Salva tag" }).click();
  await expect(page.getByRole("table", { name: "Tag registrati nel ledger" })).toContainText(
    "Origine tag",
  );
  await page.getByLabel("Nome").fill("Destinazione tag");
  await page.getByRole("button", { name: "Salva tag" }).click();
  await expect(page.getByRole("table", { name: "Tag registrati nel ledger" })).toContainText(
    "Destinazione tag",
  );
  const sourceRow = page.getByRole("row").filter({ hasText: "Origine tag" });
  await sourceRow.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Unisci in").selectOption({ label: "Destinazione tag" });
  await page.getByRole("button", { name: "Unisci e deduplica" }).click();
  await expect(page.getByRole("table", { name: "Tag registrati nel ledger" })).not.toContainText(
    "Origine tag",
  );
});

test("la tassonomia resta utilizzabile al 200% su desktop", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium-1440", "Il controllo zoom richiede il desktop.");
  await page.goto("/#tags");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(page.getByRole("heading", { name: "Gestisci i tag" })).toBeVisible();
  await expect(page.getByLabel("Nome")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salva tag" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
