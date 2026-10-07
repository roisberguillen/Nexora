import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const sourceAccount = "Conto origine C4.3";
const destinationAccount = "Conto destinazione C4.3";
const rootCategory = "Casa C4.3";
const expenseCategory = "Utenze C4.3";
const bookedDate = "2026-10-04";

test.describe("C4.3 flusso completo dei trasferimenti tra conti", () => {
  test("riconcilia trasferimento, annullamento, correzione e cinque superfici", async ({
    context,
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    observeRuntimeErrors(page, consoleErrors);

    if (["chromium-1024", "chromium-1440"].includes(testInfo.project.name)) {
      const physicalWidth = testInfo.project.name === "chromium-1024" ? 1024 : 1440;
      const client = await context.newCDPSession(page);
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: physicalWidth / 2,
        height: 900,
        deviceScaleFactor: 2,
        mobile: false,
      });
    }

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Il ledger è pronto per i primi dati" }),
    ).toBeVisible();
    await createAccounts(page);
    await createBudgetFixture(page);
    await navigateToSurface(page, "transactions");

    await createManualTransaction(page, "income", "Entrata riferimento C4.3", "500,00");
    await createManualTransaction(page, "expense", "Uscita riferimento C4.3", "100,00", true);
    await assertFinancialState(page, { source: "1.400,00", destination: "200,00" });
    await assertNeutralReports(page, "100,00");

    await navigateToSurface(page, "transactions");
    await createTransfer(page, "Trasferimento C4.3 300", "300,00");
    const list = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
    const transferRow = transactionRow(page, "Trasferimento C4.3 300");
    await expect(list.locator(":scope .transaction-list-row")).toHaveCount(3);
    await expect(transferRow).toContainText("Conto origine C4.3 → Conto destinazione C4.3");
    await expect(transferRow).toContainText("300,00");
    await inspectTransferDetails(page, transferRow, [
      "Trasferimento C4.3 300",
      "Conto origine C4.3",
      "Conto destinazione C4.3",
      "300,00",
      "Trasferimento",
      "Contabilizzato",
    ]);
    await assertFinancialState(page, { source: "1.100,00", destination: "500,00" });
    await assertNeutralReports(page, "100,00");

    await navigateToSurface(page, "transactions");
    await expect(transactionRow(page, "Trasferimento C4.3 300")).toBeVisible();
    await page.reload();
    await expect(transactionRow(page, "Trasferimento C4.3 300")).toBeVisible();
    await page.close();
    const reopenedPage = await context.newPage();
    observeRuntimeErrors(reopenedPage, consoleErrors);
    await reopenedPage.goto("/#transactions");
    await expect(transactionRow(reopenedPage, "Trasferimento C4.3 300")).toBeVisible();
    await assertFinancialState(reopenedPage, { source: "1.100,00", destination: "500,00" });

    await navigateToSurface(reopenedPage, "transactions");
    await cancelTransfer(reopenedPage, "Trasferimento C4.3 300");
    await assertFinancialState(reopenedPage, { source: "1.400,00", destination: "200,00" });
    await navigateToSurface(reopenedPage, "transactions");
    await expect(transactionRow(reopenedPage, "Trasferimento C4.3 300")).toContainText("Annullato");
    await expect(
      transactionRow(reopenedPage, "Trasferimento C4.3 300").getByRole("button", {
        name: /Azioni per/,
      }),
    ).toBeDisabled();
    await assertNeutralReports(reopenedPage, "100,00");

    await navigateToSurface(reopenedPage, "transactions");
    await createTransfer(reopenedPage, "Trasferimento C4.3 250", "250,00");
    const activeTransfer = transactionRow(reopenedPage, "Trasferimento C4.3 250");
    await expect(activeTransfer).toContainText("250,00");
    await activeTransfer.getByRole("button", { name: /Azioni per/ }).click();
    await expect(reopenedPage.getByRole("menuitem", { name: "Modifica" })).toHaveCount(0);
    await reopenedPage.keyboard.press("Escape");
    await assertFinancialState(reopenedPage, { source: "1.150,00", destination: "450,00" });
    await assertNeutralReports(reopenedPage, "100,00");
    await navigateToSurface(reopenedPage, "transactions");
    await expect(
      reopenedPage.getByRole("list", { name: "Movimenti registrati nel ledger" }),
    ).toContainText("Trasferimento C4.3 300");

    await navigateToSurface(reopenedPage, "transactions");
    await expectNoOverflowAndA11y(reopenedPage);
    expect(consoleErrors).toEqual([]);
  });

  test("crea e rilegge un trasferimento offline su IndexedDB isolato", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-1440");
    await page.addInitScript(() =>
      window.localStorage.setItem("nexora.ledger-storage.v1", "indexeddb"),
    );
    await page.goto("/");
    await createAccounts(page);
    await navigateToSurface(page, "transactions");
    await activateServiceWorker(page);
    await context.setOffline(true);
    try {
      await createTransfer(page, "Trasferimento offline C4.3", "75,00");
      await assertFinancialState(page, { source: "925,00", destination: "275,00" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await assertFinancialState(page, { source: "925,00", destination: "275,00" });
      await navigateToSurface(page, "transactions");
      await expect(transactionRow(page, "Trasferimento offline C4.3")).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test("rifiuta i casi negativi del trasferimento senza scritture parziali", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-390");
    await page.goto("/");
    await createAccounts(page);
    await navigateToSurface(page, "transactions");
    await page.getByRole("button", { name: "Nuovo movimento" }).click();
    await selectTransferKind(page);
    const destination = page.locator('select[name="destination"]');
    const sourceControl = page.locator('select[name="account"]');
    const source = await sourceControl.inputValue();
    await destination.selectOption(source);
    await page.getByRole("textbox", { name: "Importo" }).fill("0,00");
    await page.getByRole("button", { name: "Salva movimento" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await destination.selectOption({ label: `${destinationAccount} · EUR` });
    await page.getByRole("textbox", { name: "Importo" }).fill("-10,00");
    await page.getByRole("button", { name: "Salva movimento" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("textbox", { name: "Importo" }).fill("1,234");
    await page.getByRole("button", { name: "Salva movimento" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: "Annulla", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nuovo movimento" })).toHaveCount(0);
    await expect(
      page
        .getByRole("list", { name: "Movimenti registrati nel ledger" })
        .locator(".transaction-list-row"),
    ).toHaveCount(0);
    await expect(page.locator('p.account-feedback[role="status"]')).toHaveCount(0);
  });
});

async function createAccounts(page: Page): Promise<void> {
  await navigateToSurface(page, "accounts");
  await createAccount(page, sourceAccount, "1000,00");
  await createAccount(page, destinationAccount, "200,00");
}

async function createAccount(page: Page, name: string, balance: string): Promise<void> {
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill(name);
  await page.getByLabel("Tipo").selectOption("checking");
  await page.getByLabel("Valuta").fill("EUR");
  await page.getByLabel("Saldo iniziale").fill(balance);
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
}

async function createBudgetFixture(page: Page): Promise<void> {
  await page.goto("/#categories");
  await page.getByLabel("Nome").fill(rootCategory);
  await page.getByLabel("Ambito").selectOption("expense");
  await page.getByRole("button", { name: "Salva categoria" }).click();
  const root = page.locator(".category-tree-group").filter({ hasText: rootCategory });
  await root.getByRole("button", { name: "Aggiungi sottocategoria" }).click();
  await page.getByLabel("Nome").fill(expenseCategory);
  await page.getByRole("button", { name: "Salva categoria" }).click();

  await page.goto("/#budgets");
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption({ label: rootCategory });
  await page
    .getByRole("combobox", { name: "Sotto-categoria", exact: true })
    .selectOption({ label: expenseCategory });
  await page.getByLabel("Importo").fill("500,00");
  await page.getByLabel("Prima soglia di notifica (%)").fill("50");
  await page.getByLabel("Seconda soglia di notifica (%)").fill("80");
  await page.getByRole("button", { name: "Salva budget" }).click();
  await expect(page.getByRole("heading", { name: "Budget mensili" })).toBeVisible();
}

async function createManualTransaction(
  page: Page,
  kind: "income" | "expense",
  description: string,
  amount: string,
  withCategory = false,
): Promise<void> {
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await setTransactionKind(page, kind);
  await page.getByRole("textbox", { name: "Importo" }).fill(amount);
  await page.locator('select[name="account"]').selectOption({ label: `${sourceAccount} · EUR` });
  if (withCategory)
    await page
      .locator('select[name="category"]')
      .selectOption({ label: `${rootCategory} → ${expenseCategory}` });
  await page.getByLabel("Data").fill(bookedDate);
  await page.getByLabel("Descrizione").fill(description);
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento salvato");
}

async function createTransfer(page: Page, description: string, amount: string): Promise<void> {
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await selectTransferKind(page);
  await page.locator('select[name="account"]').selectOption({ label: `${sourceAccount} · EUR` });
  await page
    .locator('select[name="destination"]')
    .selectOption({ label: `${destinationAccount} · EUR` });
  await page.getByRole("textbox", { name: "Importo" }).fill(amount);
  await page.getByLabel("Data operazione").fill(bookedDate);
  await page.getByLabel("Descrizione").fill(description);
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.locator('p.account-feedback[role="status"]')).toContainText(
    "Trasferimento salvato",
  );
}

async function selectTransferKind(page: Page): Promise<void> {
  const select = page.locator('select[name="kind"]');
  if ((await select.count()) > 0) await select.selectOption("transfer");
  else await page.getByRole("radio", { name: "Trasferimento", exact: true }).check();
}

async function setTransactionKind(page: Page, kind: "income" | "expense"): Promise<void> {
  const select = page.locator('select[name="kind"]');
  if ((await select.count()) > 0) await select.selectOption(kind);
  else
    await page
      .getByRole("radio", { name: kind === "income" ? "Entrata" : "Uscita", exact: true })
      .check();
}

async function cancelTransfer(page: Page, description: string): Promise<void> {
  const row = transactionRow(page, description);
  await row.getByRole("button", { name: /Azioni per/ }).click();
  await page.getByRole("menuitem", { name: "Annulla" }).click();
  await expect(page.getByRole("status")).toContainText("Trasferimento annullato");
}

async function inspectTransferDetails(
  page: Page,
  row: ReturnType<typeof transactionRow>,
  values: readonly string[],
) {
  await row.locator(".transaction-list-open").click();
  const details = page.locator(".transaction-details-panel");
  for (const value of values) await expect(details).toContainText(value);
  await page.getByRole("button", { name: "Chiudi dettaglio movimento" }).click();
}

async function assertFinancialState(
  page: Page,
  expected: { source: string; destination: string },
): Promise<void> {
  await navigateToSurface(page, "accounts");
  await expect(accountRow(page, sourceAccount)).toContainText(expected.source);
  await expect(accountRow(page, destinationAccount)).toContainText(expected.destination);
}

async function assertNeutralReports(page: Page, expenseAmount: string): Promise<void> {
  await navigateToSurface(page, "transactions");
  await expect(page.getByLabel("Riepilogo movimenti")).toContainText("500,00");
  await expect(page.getByLabel("Riepilogo movimenti")).toContainText(expenseAmount);
  await expect(page.getByLabel("Riepilogo movimenti")).toContainText("400,00");
  await page.goto("/#overview");
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText("1.600,00");
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText("500,00");
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText(expenseAmount);
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText("400,00");
  await page.goto("/#budgets");
  await expect(page.getByRole("region", { name: "Budget mensili" })).toContainText(expenseAmount);
  await page.goto("/#analytics");
  await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText("500,00");
  await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText(
    expenseAmount,
  );
  await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText("400,00");
}

function transactionRow(page: Page, description: string) {
  return page.locator(".transaction-list-row").filter({ hasText: description }).first();
}

function accountRow(page: Page, name: string) {
  return page.getByRole("row", { name: new RegExp(name) });
}

async function navigateToSurface(
  page: Page,
  surface: "accounts" | "analytics" | "overview" | "transactions",
): Promise<void> {
  const mobile = page.getByRole("navigation", { name: "Navigazione mobile" });
  const desktop = page.getByRole("navigation", { name: "Navigazione principale" });
  if (await mobile.isVisible()) {
    const labels = {
      accounts: "Conti",
      analytics: "Analisi",
      overview: "Panoramica",
      transactions: "Movimenti",
    } as const;
    await mobile.getByRole("link", { name: labels[surface], exact: true }).click();
    return;
  }
  if (await desktop.isVisible()) {
    const labels = {
      accounts: "Conti",
      analytics: "Analisi",
      overview: "Panoramica",
      transactions: "Movimenti",
    } as const;
    await desktop.getByRole("link", { name: labels[surface], exact: true }).click();
    return;
  }
  throw new Error("Nessuna navigazione visibile: impossibile raggiungere la superficie richiesta.");
}

async function activateServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function expectNoOverflowAndA11y(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}

function observeRuntimeErrors(page: Page, errors: string[]): void {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
}
