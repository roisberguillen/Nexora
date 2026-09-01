import { expect, test } from "@playwright/test";
import * as XLSX from "../../packages/importers/node_modules/xlsx/xlsx.mjs";

test("la pagina Importa è disponibile e non scrive dati prima del dry-run", async ({ page }) => {
  await page.goto("/#imports");

  await expect(page.getByRole("heading", { name: "Importa estratti conto" })).toBeVisible();
  await expect(page.getByLabel("Seleziona un estratto CSV, XLSX o PDF")).toBeVisible();
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
  await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles({
    name: "movimenti-sintetici.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  });

  await expect(page.getByText("1 pronte")).toBeVisible();
  await page.getByLabel("Nome nuovo profilo").fill("Money Manager E2E");
  await page.getByRole("button", { name: "Salva profilo mapping" }).click();
  await expect(page.getByLabel("Profilo mapping")).toHaveValue(/^mapping-/);
  await expect(
    page.getByLabel("Profilo mapping").getByRole("option", { name: "Money Manager E2E" }),
  ).toBeAttached();
  await page.getByRole("button", { name: "Conferma 1 righe" }).click();
  const history = page
    .getByRole("heading", { name: "Importazioni recenti" })
    .locator("xpath=ancestor::section");
  await expect(history).toContainText("movimenti-sintetici.xlsx");
  await expect(history).toContainText("1 importate");
  await page.getByRole("button", { name: "Annulla batch" }).click();
  await expect(history).toContainText("undone");
});

test("esegue il piano Money Manager con account, categorie, transfer, adjustment e deduplica", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#imports");

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        "Data",
        "Conto",
        "Importo",
        "Categoria",
        "Sotto-categoria",
        "Valuta",
        "Controparte",
        "Tipologia",
      ],
      [
        "10/08/2026",
        "Conto quotidiano demo",
        "-12,50",
        "Alimentazione sintetica",
        "Spesa sintetica",
        "EUR",
        "Esercente sintetico",
        "Spesa",
      ],
      [
        "11/08/2026",
        "Riserva sintetica",
        "-8,00",
        "Servizi sintetici",
        "Cloud sintetico",
        "EUR",
        "Fornitore sintetico",
        "Spesa",
      ],
      [
        "12/08/2026",
        "Diretta sim",
        "86,49",
        "Modifica Saldo",
        "",
        "EUR",
        "Rettifica sintetica",
        "Guadagno",
      ],
      [
        "13/08/2026",
        "Conto quotidiano demo",
        "-50,00",
        "Diretta sim",
        "",
        "EUR",
        "Giroconto sintetico",
        "Trasferimento uscita",
      ],
    ]),
    "Movimenti",
  );
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  const upload = {
    name: "money-manager-semantico-sintetico.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  };
  await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles(upload);

  await expect(page.getByRole("heading", { name: "Piano di migrazione" })).toBeVisible();
  await expect(page.getByText("Directa SIM", { exact: true })).toBeVisible();
  await expect(page.getByText("Categorie Money Manager")).toBeVisible();
  await expect(page.getByLabel(/Conto per riga/)).toHaveCount(0);
  await page.getByLabel("Risoluzione per Riserva sintetica").selectOption("create:savings");
  await expect(page.getByText("4 pronte")).toBeVisible();
  await page.getByRole("button", { name: "Conferma 4 righe" }).click();

  const history = page
    .getByRole("heading", { name: "Importazioni recenti" })
    .locator("xpath=ancestor::section");
  await expect(history).toContainText("money-manager-semantico-sintetico.xlsx");
  await expect(history).toContainText("4 importate");

  await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles(upload);
  await expect(page.getByText("4 duplicate")).toBeVisible();
  await expect(page.getByRole("button", { name: "Conferma 0 righe" })).toBeDisabled();

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
  await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles({
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

test("importa un CSV generico solo dopo anteprima e conferma", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#imports");

  await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles({
    name: "movimenti-generici.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Data;Conto;Importo;Categoria;Valuta;Controparte\n02/08/2026;Conto quotidiano demo;-18,40;Tempo libero demo;EUR;Cinema",
      "utf8",
    ),
  });

  await expect(page.getByText("1 pronte")).toBeVisible();
  await expect(page.getByRole("button", { name: "Conferma 1 righe" })).toBeEnabled();
  await page.getByRole("button", { name: "Conferma 1 righe" }).click();
  const history = page
    .getByRole("heading", { name: "Importazioni recenti" })
    .locator("xpath=ancestor::section");
  await expect(history).toContainText("movimenti-generici.csv");
  await expect(history).toContainText("1 importate");
});

test("rileva il CSV Mediobanca Premier dalle intestazioni e usa Data valuta", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#imports");

  await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles({
    name: "estratto.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Data contabile;Data valuta;Tipologia;Entrate;Uscite;Divisa\n13/08/2026;11/08/2026;Pagamento POS;;-7,40;EUR",
      "utf8",
    ),
  });

  await expect(page.getByText("Data movimento: Data valuta.")).toBeVisible();
  await expect(page.getByText("2026-08-11")).toBeVisible();
  await expect(page.getByText(/-7,40/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Conferma 0 righe" })).toBeDisabled();
  await page
    .getByLabel("Conto locale predefinito")
    .selectOption({ label: "Conto quotidiano demo" });
  await expect(page.getByText("1 pronte")).toBeVisible();
  await expect(page.getByRole("button", { name: "Conferma 1 righe" })).toBeEnabled();
});

test("mantiene il flusso Import utilizzabile al 200% su desktop", async ({ page }) => {
  test.skip(
    !["chromium-1024", "chromium-1440"].includes(test.info().project.name),
    "La verifica zoom è prevista sulle larghezze desktop.",
  );

  await page.goto("/#imports");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });

  await expect(page.getByRole("heading", { name: "Importa estratti conto" })).toBeVisible();
  await expect(page.getByLabel("Seleziona un estratto CSV, XLSX o PDF")).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth * 2);
});
