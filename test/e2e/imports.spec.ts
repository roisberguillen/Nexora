import { expect, test } from "@playwright/test";
import * as XLSX from "../../packages/importers/node_modules/xlsx/xlsx.mjs";

test("la pagina Importa è disponibile e non scrive dati prima del dry-run", async ({ page }) => {
  await page.goto("/#imports");

  await expect(page.getByRole("heading", { name: "Importa estratti conto" })).toBeVisible();
  await expect(page.getByLabel("Seleziona un estratto XLSX o PDF")).toBeVisible();
  await expect(
    page.getByText("Il file resta nel browser: questa fase legge soltanto l’anteprima."),
  ).toBeVisible();
});

test("importa e annulla un batch Money Manager senza uscire dalla PWA", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await page.goto("/#imports");

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Data", "Conto", "Importo", "Categoria", "Valuta", "Controparte"],
      ["28/07/2026", "Conto quotidiano demo", "-12,50", "Tempo libero demo", "EUR", "Cinema"],
    ]),
    "Movimenti",
  );
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  await page.getByLabel("Seleziona un estratto XLSX o PDF").setInputFiles({
    name: "movimenti-sintetici.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  });

  await expect(page.getByText("1 pronte")).toBeVisible();
  await page.getByRole("button", { name: "Conferma 1 righe" }).click();
  const history = page
    .getByRole("heading", { name: "Importazioni recenti" })
    .locator("xpath=ancestor::section");
  await expect(history).toContainText("movimenti-sintetici.xlsx");
  await expect(history).toContainText("1 importate");
  await page.getByRole("button", { name: "Annulla batch" }).click();
  await expect(history).toContainText("undone");
});

test("conferma un batch contenente solo un trasferimento tra conti propri", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#imports");

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Data", "Conto", "Importo", "Valuta", "Controparte"],
      ["02/08/2026", "Conto quotidiano demo", "-60,00", "EUR", "Riserva demo"],
    ]),
    "Movimenti",
  );
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  await page.getByLabel("Seleziona un estratto XLSX o PDF").setInputFiles({
    name: "trasferimento-sintetico.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  });

  const transferConfirmation = page.getByRole("checkbox", {
    name: "Confermo trasferimento verso Riserva demo",
  });
  await expect(page.getByRole("button", { name: "Conferma 0 righe" })).toBeDisabled();
  await transferConfirmation.check();
  await page.getByRole("button", { name: "Conferma 1 righe" }).click();

  const history = page
    .getByRole("heading", { name: "Importazioni recenti" })
    .locator("xpath=ancestor::section");
  await expect(history).toContainText("trasferimento-sintetico.xlsx");
  await expect(history).toContainText("1 importate");
});
