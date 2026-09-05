import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "../../packages/importers/node_modules/xlsx/xlsx.mjs";

const sourceFile = "estratto-generico-c4-8.csv";
const sourceMime = "text/csv";

test.describe("C4.8 estratto conto, mapping, undo ed export", () => {
  test("completa il ciclo CSV generico fino a undo e JSON completo", async ({ context, page }) => {
    await page.clock.install({ time: "2026-09-05T10:00:00+02:00" });
    const runtimeErrors: string[] = [];
    const networkEvidence: string[] = [];
    observeRuntime(page, runtimeErrors, networkEvidence);

    await createAccount(page, "Mediobanca C4.8", "checking", "500,00");
    await createAccount(page, "Riserva C4.8", "savings", "100,00");
    await createExpenseCategory(page);
    await page.goto("/#imports");
    const upload = { name: sourceFile, mimeType: sourceMime, buffer: createStatementCsv() };
    await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles(upload);
    await configureGenericMapping(page);

    await expect(page.getByText("5 pronte")).toHaveCount(0);
    await expect(page.getByText("3 pronte", { exact: true })).toBeVisible();
    await expect(page.getByText("2 da revisionare", { exact: true })).toBeVisible();
    await expect(page.getByText("0 duplicate", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Importazioni recenti" })).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Confermo trasferimento verso Riserva C4.8" }).check();
    await expect(page.getByRole("button", { name: "Conferma 4 righe" })).toBeEnabled();
    await page.getByLabel("Nome nuovo profilo").fill("Estratto generico C4.8");
    await page.getByRole("button", { name: "Salva profilo mapping" }).click();

    await page.getByRole("button", { name: "Conferma 4 righe" }).click();
    const history = page
      .getByRole("heading", { name: "Importazioni recenti" })
      .locator("xpath=ancestor::section");
    await expect(history).toContainText("estratto-generico-c4-8.csv");
    await expect(history).toContainText("4 importate");
    await expect(history).toContainText("1 da revisionare");
    await expect(page.getByLabel("Report qualità importazioni")).toContainText(
      "100% contabilizzate",
    );

    await page.goto("/#accounts");
    await expect(page.getByRole("row", { name: /Mediobanca C4\.8/ })).toContainText("1.664,44");
    await expect(page.getByRole("row", { name: /Riserva C4\.8/ })).toContainText("300,00");
    await page.goto("/#transactions");
    await expect(page.locator(".transaction-list-row")).toHaveCount(4);
    await expect(page.getByText("Negozio C4.8")).toBeVisible();
    await expect(page.getByText("=2+3")).toBeVisible();
    await expect(page.getByText("Importato").first()).toBeVisible();

    await page.goto("/#exports");
    await page.getByRole("textbox", { name: "Dal", exact: true }).fill("2026-09-01");
    await page.getByRole("textbox", { name: "Al", exact: true }).fill("2026-09-04");
    await page
      .getByRole("combobox", { name: "Conto", exact: true })
      .selectOption({ label: "Mediobanca C4.8" });
    await expect(page.locator("#exports")).toContainText("4 movimenti inclusi.");
    const csv = await downloadText(page, "Scarica CSV movimenti");
    expect(csv).toContain("id,data,tipo,stato,conto,importo_minor");
    expect(csv).toContain("150000");
    expect(csv).toContain("-12555");
    expect(csv).toContain("-20000");
    expect(csv).toContain("-1001");
    expect(csv).toContain("'=2+3");
    expect(csv).not.toContain('","=2+3"');
    const xlsxBytes = await downloadBytes(page, "Scarica XLSX movimenti");
    const workbook = XLSX.read(xlsxBytes, { type: "buffer", cellFormula: true });
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Movimenti!, { header: 1 });
    expect(rows).toHaveLength(5);
    expect(rows.slice(1).map((row) => row[5])).toEqual(["150000", "-12555", "-20000", "-1001"]);
    expect(workbook.Sheets.Movimenti!["I5"]?.f).toBeUndefined();
    expect(workbook.Sheets.Movimenti!["I5"]?.v).toBe("=2+3");

    await page.getByLabel("Categoria").selectOption({ label: "Spese C4.8" });
    await expect(page.locator("#exports")).toContainText("2 movimenti inclusi.");
    const categoryCsv = await downloadText(page, "Scarica CSV movimenti");
    expect(categoryCsv).toContain("Negozio C4.8");
    expect(categoryCsv).toContain("'=2+3");
    expect(categoryCsv).not.toContain("Datore C4.8");

    await page.goto("/#imports");
    await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles(upload);
    await configureGenericMapping(page);
    await page.getByRole("checkbox", { name: "Confermo trasferimento verso Riserva C4.8" }).check();
    await expect(page.getByText("4 duplicate", { exact: true })).toBeVisible();
    await expect(page.getByText("1 da revisionare", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Conferma 0 righe" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Importazioni recenti" })).toHaveCount(1);
    await page.getByRole("button", { name: "Annulla batch" }).click();
    await expect(history).toContainText("undone");
    await page.goto("/#accounts");
    await expect(page.getByRole("row", { name: /Mediobanca C4\.8/ })).toContainText("500,00");
    await expect(page.getByRole("row", { name: /Riserva C4\.8/ })).toContainText("100,00");
    await page.goto("/#exports");
    await page.getByRole("textbox", { name: "Dal", exact: true }).fill("2026-09-01");
    await page.getByRole("textbox", { name: "Al", exact: true }).fill("2026-09-04");
    await page
      .getByRole("combobox", { name: "Conto", exact: true })
      .selectOption({ label: "Mediobanca C4.8" });
    await expect(page.locator("#exports")).toContainText(
      "Nessun movimento corrisponde ai filtri selezionati.",
    );
    await expect(page.getByRole("button", { name: "Scarica CSV movimenti" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Scarica XLSX movimenti" })).toBeDisabled();
    const jsonBytes = await downloadBytes(page, "Scarica JSON completo");
    const payload = JSON.parse(Buffer.from(jsonBytes).toString("utf8")) as {
      readonly formatVersion: number;
      readonly entities: Record<string, unknown[]>;
    };
    expect(payload.formatVersion).toBe(1);
    expect(payload.entities.accounts).toHaveLength(2);
    expect(payload.entities.transactions).toHaveLength(5);
    expect(payload.entities.importBatches).toHaveLength(1);
    expect(payload.entities.importBatches).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "undone" })]),
    );

    await expectNoOverflowA11yAndTargets(page);
    expect(runtimeErrors).toEqual([]);
    expect(networkEvidence).toEqual([]);
    const reopened = await context.newPage();
    await reopened.goto("/#exports");
    await expect(
      reopened.getByText("Nessun movimento corrisponde ai filtri selezionati."),
    ).toHaveCount(1);
    await reopened.close();
  });

  test("mantiene il ciclo import/export leggibile al 200% reale", async ({
    context,
    page,
  }, info) => {
    test.skip(!["chromium-1024", "chromium-1440"].includes(info.project.name), "Zoom desktop.");
    const client = await context.newCDPSession(page);
    const width = info.project.name === "chromium-1024" ? 1024 : 1440;
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: width / 2,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await page.goto("/#imports");
    await expectNoOverflowA11yAndTargets(page);
    await page.goto("/#exports");
    await expectNoOverflowA11yAndTargets(page);
  });

  test("importa, annulla e riapre offline su IndexedDB", async ({ context, page }, info) => {
    test.skip(info.project.name !== "chromium-1440", "Smoke offline desktop.");
    await page.addInitScript(() =>
      window.localStorage.setItem("nexora.ledger-storage.v1", "indexeddb"),
    );
    await page.goto("/#accounts");
    await createAccount(page, "Mediobanca C4.8 offline", "checking", "500,00");
    await activateServiceWorker(page);
    await context.setOffline(true);
    try {
      await page.goto("/#imports");
      await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles({
        name: sourceFile,
        mimeType: sourceMime,
        buffer: Buffer.from(
          "Operazione;Valore;Divisa;Soggetto;Memo\n01/09/2026;-10,01;EUR;Offline C4.8;Offline",
          "utf8",
        ),
      });
      await setMapping(page, {
        date: "Operazione",
        amount: "Valore",
        currency: "Divisa",
        payee: "Soggetto",
        note: "Memo",
      });
      await page
        .getByLabel("Conto locale predefinito")
        .selectOption({ label: "Mediobanca C4.8 offline" });
      await expect(page.getByText("1 pronte", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Conferma 1 righe" }).click();
      await expect(page.getByRole("heading", { name: "Importazioni recenti" })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Importazioni recenti" })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});

function createStatementCsv(): Buffer {
  return Buffer.from(
    [
      "Operazione;Valore;Classe;Divisa;Soggetto;Memo",
      "01/09/2026;1.500,00;;EUR;Datore C4.8;Accredito",
      "02/09/2026;-125,55;Spese C4.8;EUR;Negozio C4.8;Acquisto",
      "03/09/2026;-200,00;;EUR;Riserva C4.8;Giroconto",
      "04/09/2026;-10,01;Spese C4.8;EUR;=2+3;Controllo formula",
      "31/02/2026;-19,99;Spese C4.8;EUR;Data non valida C4.8;Riga da revisionare",
    ].join("\n"),
    "utf8",
  );
}

async function configureGenericMapping(page: Page): Promise<void> {
  await setMapping(page, {
    date: "Operazione",
    amount: "Valore",
    category: "Classe",
    currency: "Divisa",
    payee: "Soggetto",
    note: "Memo",
  });
  await page.getByLabel("Conto locale predefinito").selectOption({ label: "Mediobanca C4.8" });
}

async function setMapping(page: Page, mapping: Record<string, string>): Promise<void> {
  for (const [field, header] of Object.entries(mapping)) {
    const label =
      field === "date"
        ? "Data"
        : field === "amount"
          ? "Importo"
          : field === "category"
            ? "Categoria"
            : field === "currency"
              ? "Valuta"
              : field === "payee"
                ? "Controparte"
                : "Nota";
    await page.getByRole("combobox", { name: label, exact: true }).selectOption({ label: header });
  }
}

async function createAccount(
  page: Page,
  name: string,
  type: string,
  balance: string,
): Promise<void> {
  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill(name);
  await page.getByLabel("Tipo").selectOption(type);
  await page.getByLabel("Saldo iniziale").fill(balance);
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato");
}

async function createExpenseCategory(page: Page): Promise<void> {
  await page.goto("/#categories");
  await page.getByRole("button", { name: "Aggiungi tassonomia predefinita" }).click();
  await page
    .getByRole("button", { name: /Aggiungi sottocategoria/ })
    .first()
    .click();
  await page.getByLabel("Nome").fill("Spese C4.8");
  await page.getByLabel("Ambito").selectOption("expense");
  await page.getByRole("button", { name: "Salva categoria" }).click();
}

async function downloadText(page: Page, name: string): Promise<string> {
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name }).click();
  const download = await promise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream ?? []) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function downloadBytes(page: Page, name: string): Promise<Buffer> {
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name }).click();
  const download = await promise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream ?? []) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function expectNoOverflowA11yAndTargets(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const element of await page.locator("button:visible, a:visible").all()) {
    const box = await element.boundingBox();
    if (box !== null) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  const firstInteractive = page.locator("button:visible, a:visible").first();
  await firstInteractive.focus();
  await expect(firstInteractive).toBeFocused();
}

async function activateServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

function observeRuntime(page: Page, errors: string[], network: string[]): void {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const evidence = `${request.url()} ${request.postData() ?? ""}`;
    if (/C4\.8|estratto-generico|1500|125,55|2\+3/.test(evidence)) network.push(evidence);
  });
}
