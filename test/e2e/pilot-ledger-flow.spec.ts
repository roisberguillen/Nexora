import { expect, test } from "@playwright/test";

test("il verticale pilota aggiorna dashboard, conti e movimenti dal ledger locale", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText("Spese896,40");

  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill("Fondo progetto");
  await page.getByLabel("Tipo").selectOption("savings");
  await page.getByLabel("Saldo iniziale").fill("100,00");
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");

  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByLabel("Importo").fill("25,00");
  await page.getByLabel("Descrizione").fill("Spesa verticale pilota");
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento salvato nel ledger locale");
  await expect(page.getByRole("table", { name: "Movimenti registrati nel ledger" })).toContainText(
    "Spesa verticale pilota",
  );

  await page.goto("/#overview");
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText("Spese921,40");
  await expect(page.getByRole("complementary", { name: "Conti" })).toContainText("Fondo progetto");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
