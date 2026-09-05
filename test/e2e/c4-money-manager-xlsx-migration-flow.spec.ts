import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "../../packages/importers/node_modules/xlsx/xlsx.mjs";

const accountName = "N26 C4.7";
const fileName = "money-manager-c4-7-sintetico.xlsx";
const spreadsheetMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

test.describe("C4.7 migrazione Money Manager XLSX", () => {
  test("completa piano, preview, commit, superfici, reimport e undo", async ({ context, page }) => {
    await page.clock.install({ time: "2026-09-05T10:00:00+02:00" });
    const runtimeErrors: string[] = [];
    const networkEvidence: string[] = [];
    observeRuntime(page, runtimeErrors, networkEvidence);

    await page.goto("/");
    await createInitialAccount(page);
    await page.goto("/#imports");
    const upload = { name: fileName, mimeType: spreadsheetMime, buffer: createWorkbook() };
    await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles(upload);
    await page.getByLabel("Foglio da importare").selectOption("Movimenti");

    await expect(page.getByRole("heading", { name: "Piano di migrazione" })).toBeVisible();
    await expect(page.getByText("Money Manager riconosciuto")).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Piano di migrazione" })
        .getByText("Directa SIM", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Piano di migrazione" })
        .getByText("Riserva C4.7", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("6 movimenti", { exact: true })).toBeVisible();
    await page.getByLabel("Risoluzione per Riserva C4.7").selectOption("create:savings");
    await expect(page.getByText("1 trasferimenti")).toBeVisible();
    await expect(page.getByText("1 rettifiche")).toBeVisible();
    await expect(page.getByText("2 conti da creare")).toBeVisible();
    await expect(page.getByText("6 categorie da creare")).toBeVisible();
    await expect(page.getByText("5 pronte")).toBeVisible();
    await expect(page.getByText("1 da revisionare", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Conferma 5 righe" })).toBeEnabled();
    await page.getByLabel("Nome nuovo profilo").fill("Money Manager C4.7");
    await page.getByRole("button", { name: "Salva profilo mapping" }).click();
    await expect(
      page.getByLabel("Profilo mapping").getByRole("option", { name: "Money Manager C4.7" }),
    ).toBeAttached();

    const beforeCommit = await context.newPage();
    await beforeCommit.goto("/#accounts");
    await expect(beforeCommit.getByText("Riserva C4.7", { exact: true })).toHaveCount(0);
    await expect(beforeCommit.getByText("Directa SIM", { exact: true })).toHaveCount(0);
    await beforeCommit.goto("/#transactions");
    await expect(
      beforeCommit.getByRole("heading", { name: "Nessun movimento registrato" }),
    ).toBeVisible();
    await beforeCommit.close();

    await page.getByRole("button", { name: "Conferma 5 righe" }).click();
    await expect(page.getByRole("heading", { name: "Importazioni recenti" })).toBeVisible();
    const history = page
      .getByRole("heading", { name: "Importazioni recenti" })
      .locator("xpath=ancestor::section");
    await expect(history).toContainText(fileName);
    await expect(history).toContainText("5 importate");
    await expect(history).toContainText("1 da revisionare");
    await expect(page.getByLabel("Report qualità importazioni")).toContainText(
      "100% contabilizzate",
    );

    await page.goto("/#accounts");
    await expect(page.getByRole("row", { name: /N26 C4\.7/ })).toContainText("3.100,00");
    await expect(page.getByRole("row", { name: /Riserva C4\.7/ })).toContainText("250,00");
    await expect(page.getByRole("row", { name: /Directa SIM/ })).toContainText("86,49");
    await page.goto("/#transactions");
    const transactions = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
    await expect(transactions.locator(".transaction-list-row")).toHaveCount(5);
    await expect(transactions).toContainText("Provider C4.7");
    await expect(transactions).toContainText("Giroconto C4.7");
    await expect(transactions).toContainText("Importato");
    await page.goto("/#");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("3.350,00");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("2.500,00");
    await page.goto("/#analytics");
    await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText(
      "2.350,00",
    );

    await page.reload();
    await page.goto("/#imports");
    await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles(upload);
    await page.getByLabel("Foglio da importare").selectOption("Movimenti");
    await expect(page.getByText("5 duplicate")).toBeVisible();
    await expect(page.getByText("1 da revisionare", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Conferma 0 righe" })).toBeDisabled();

    await page.getByRole("button", { name: "Annulla batch" }).dblclick();
    await expect(history).toContainText("undone");
    await page.goto("/#accounts");
    await expect(page.getByRole("row", { name: /N26 C4\.7/ })).toContainText("1.000,00");
    await expect(page.getByRole("row", { name: /Riserva C4\.7/ })).toContainText("0,00");
    await expect(page.getByRole("row", { name: /Directa SIM/ })).toContainText("0,00");
    await page.goto("/#imports");
    await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles(upload);
    await page.getByLabel("Foglio da importare").selectOption("Movimenti");
    await expect(page.getByText("5 duplicate")).toBeVisible();
    await expect(page.getByRole("button", { name: "Conferma 0 righe" })).toBeDisabled();

    await expectNoOverflowA11yAndTargets(page);
    expect(networkEvidence).toEqual([]);
    expect(runtimeErrors).toEqual([]);
    await page.close();
    const reopened = await context.newPage();
    observeRuntime(reopened, runtimeErrors, networkEvidence);
    await reopened.goto("/#accounts");
    await expect(reopened.getByRole("row", { name: /N26 C4\.7/ })).toContainText("1.000,00");
    await reopened.goto("/#imports");
    await expect(reopened.getByRole("heading", { name: "Importazioni recenti" })).toBeVisible();
    await expectNoOverflowA11yAndTargets(reopened);
    expect(runtimeErrors).toEqual([]);
  });

  test("rifiuta XLSX non valido senza scritture parziali", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-390",
      "Percorso negativo dedicato al profilo mobile medio.",
    );
    await page.goto("/#imports");
    await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles({
      name: fileName,
      mimeType: spreadsheetMime,
      buffer: Buffer.from("<script>financial-data</script>", "utf8"),
    });
    await expect(page.getByRole("alert")).toContainText("non è un estratto");
    await expect(page.getByRole("heading", { name: "Importazioni recenti" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Importa estratti conto" })).toBeVisible();
  });

  test("mantiene il flusso utilizzabile con zoom browser reale al 200%", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(
      !["chromium-1024", "chromium-1440"].includes(testInfo.project.name),
      "Zoom reale applicabile ai desktop.",
    );
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: (testInfo.project.name === "chromium-1024" ? 1024 : 1440) / 2,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await page.goto("/#imports");
    await expectNoOverflowA11yAndTargets(page);
  });

  test("importa e riapre offline su IndexedDB", async ({ context, page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-1440",
      "Smoke offline eseguito una volta sul desktop.",
    );
    await page.addInitScript(() =>
      window.localStorage.setItem("nexora.ledger-storage.v1", "indexeddb"),
    );
    await page.goto("/");
    await createInitialAccount(page);
    await activateServiceWorker(page);
    await context.setOffline(true);
    try {
      await page.goto("/#imports");
      await importSimpleWorkbook(page, "indexeddb-offline-c4-7.xlsx");
      await page.getByRole("button", { name: "Conferma 1 righe" }).click();
      await expect(page.getByRole("heading", { name: "Importazioni recenti" })).toBeVisible();
      await page.goto("/#accounts");
      await expect(page.getByRole("row", { name: /N26 C4\.7/ })).toContainText("990,00");
      await page.reload();
      await expect(page.getByRole("row", { name: /N26 C4\.7/ })).toContainText("990,00");
      const reopened = await context.newPage();
      await reopened.goto("/#imports");
      await expect(reopened.getByRole("heading", { name: "Importazioni recenti" })).toBeVisible();
      await reopened.close();
    } finally {
      await context.setOffline(false);
    }
  });

  test("riapre il batch importato nel profilo OPFS/PWA", async ({ context, page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-1440",
      "Smoke OPFS/PWA eseguito una volta sul desktop.",
    );
    await page.goto("/");
    await createInitialAccount(page);
    await activateServiceWorker(page);
    await page.goto("/#imports");
    await importSimpleWorkbook(page, "opfs-c4-7.xlsx");
    await page.getByRole("button", { name: "Conferma 1 righe" }).click();
    await expect(page.getByRole("heading", { name: "Importazioni recenti" })).toBeVisible();
    await page.reload();
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto("/#imports");
    await expect(reopened.getByRole("heading", { name: "Importazioni recenti" })).toBeVisible();
    await expect(reopened.getByText("opfs-c4-7.xlsx")).toBeVisible();
    await expectNoOverflowA11yAndTargets(reopened);
  });
});

function createWorkbook(): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Profilo", "C4.7 sintetico"]]),
    "Informazioni",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        "Giorno",
        "Conto",
        "Categoria",
        "Sotto-categoria",
        "Nota",
        "EUR",
        "Guadagni/Spese",
        "Descrizione",
        "Importo",
        "Valuta",
        "Conto",
      ],
      [
        new Date(2026, 8, 1),
        accountName,
        "Reddito C4.7",
        "Stipendio",
        "Datore C4.7",
        "",
        "Guadagno",
        "",
        2500,
        "EUR",
        "",
      ],
      [
        new Date(2026, 8, 2),
        accountName,
        "Casa C4.7",
        "Spesa",
        "Negozio C4.7",
        "",
        "Spesa",
        "",
        100,
        "EUR",
        "",
      ],
      [
        new Date(2026, 8, 3),
        "Riserva C4.7",
        "Servizi C4.7",
        "Cloud",
        "Provider C4.7",
        "",
        "Spesa",
        "",
        50,
        "EUR",
        "",
      ],
      [
        new Date(2026, 8, 4),
        "Directa SIM",
        "Modifica Saldo",
        "",
        "Rettifica C4.7",
        "",
        "Guadagno",
        "",
        86.49,
        "EUR",
        "",
      ],
      [
        new Date(2026, 8, 5),
        accountName,
        "Riserva C4.7",
        "",
        "Giroconto C4.7",
        "",
        "Trasferimento uscita",
        "",
        300,
        "EUR",
        "Riserva C4.7",
      ],
      [
        60,
        accountName,
        "Casa C4.7",
        "Spesa",
        "Data non valida C4.7",
        "",
        "Spesa",
        "",
        20,
        "EUR",
        "",
      ],
    ]),
    "Movimenti",
  );
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

async function createInitialAccount(page: Page): Promise<void> {
  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill(accountName);
  await page.getByLabel("Tipo").selectOption("checking");
  await page.getByLabel("Valuta").fill("EUR");
  await page.getByLabel("Saldo iniziale").fill("1000,00");
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
}

async function importSimpleWorkbook(page: Page, name: string): Promise<void> {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Data", "Conto", "Importo", "Valuta", "Controparte"],
      ["01/09/2026", accountName, "-10,00", "EUR", "Offline C4.7"],
    ]),
    "Movimenti",
  );
  await page.getByLabel("Seleziona un estratto CSV, XLSX o PDF").setInputFiles({
    name,
    mimeType: spreadsheetMime,
    buffer: XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
  });
  await expect(page.getByText("1 pronte", { exact: true })).toBeVisible();
}

async function activateServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function expectNoOverflowA11yAndTargets(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("*")]
        .filter((element) => element.scrollWidth > element.clientWidth)
        .slice(0, 8)
        .map(
          (element) =>
            `${element.tagName}.${element.className}:${element.clientWidth}/${element.scrollWidth}`,
        )
        .join(" | "),
    ),
  ).toBeLessThanOrEqual(dimensions.clientWidth);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  for (const element of await page.locator("button:visible, a:visible").all()) {
    const box = await element.boundingBox();
    if (box !== null)
      expect(
        Math.min(box.width, box.height),
        await element.evaluate(
          (node) =>
            `${node.tagName}.${node.className} ${node.textContent?.trim().slice(0, 40) ?? ""}`,
        ),
      ).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
}

function observeRuntime(page: Page, errors: string[], networkEvidence: string[]): void {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const evidence = `${request.url()} ${request.postData() ?? ""}`;
    if (/money-manager-c4-7|Datore C4\.7|Provider C4\.7|Giroconto C4\.7/.test(evidence))
      networkEvidence.push(evidence);
  });
}
