import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const storagePreferenceKey = "nexora.ledger-storage.v1";
const accountName = "Conto C4.2 sintetico";
const bookedDate = "2026-09-03";

test.describe("C4.2 ciclo completo di entrate e spese", () => {
  test("riconcilia entrata, spese, modifica, annullamento e riapertura", async ({
    context,
    page,
  }) => {
    const consoleErrors: string[] = [];
    observeRuntimeErrors(page, consoleErrors);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Il ledger è pronto per i primi dati" }),
    ).toBeVisible();
    await createAccount(page);
    await navigateToSurface(page, "transactions");

    await createManualTransaction(page, {
      description: "Entrata C4.2",
      kind: "income",
      payee: "Cliente sintetico",
      amount: "1000,00",
    });
    await createManualTransaction(page, {
      description: "Spesa principale C4.2",
      kind: "expense",
      payee: "Esercente sintetico",
      amount: "250,00",
      classify: true,
    });
    await createManualTransaction(page, {
      description: "Spesa da annullare C4.2",
      kind: "expense",
      payee: "Fornitore sintetico",
      amount: "50,00",
    });

    const list = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
    await expect(list.locator(":scope .transaction-list-row")).toHaveCount(3);
    await expect(list).toContainText("Cliente sintetico");
    await expect(list).toContainText("Esercente sintetico");
    await expect(list).toContainText("Fornitore sintetico");
    await expect(page.getByLabel("Riepilogo movimenti")).toContainText("1.000,00");
    await expect(page.getByLabel("Riepilogo movimenti")).toContainText("300,00");
    await expect(page.getByLabel("Riepilogo movimenti")).toContainText("700,00");

    await inspectDetails(page, list, "Cliente sintetico", [
      "Entrata C4.2",
      "Cliente sintetico",
      "1.000,00",
      "Contabilizzato",
      "Entrata",
    ]);
    await inspectDetails(page, list, "Esercente sintetico", [
      "Spesa principale C4.2",
      "Esercente sintetico",
      "250,00",
      "Contabilizzato",
      "Spesa",
    ]);

    const search = page.getByRole("searchbox", { name: "Cerca nei movimenti" });
    await search.fill("Spesa principale C4.2");
    await expect(list.locator(":scope .transaction-list-row")).toHaveCount(1);
    await expect(transactionRow(page, "Esercente sintetico")).toBeVisible();
    await page.getByRole("button", { name: "Cancella ricerca movimenti" }).click();
    await page.getByRole("button", { name: "Entrate", exact: true }).click();
    await expect(list.locator(":scope .transaction-list-row")).toHaveCount(1);
    await expect(list).toContainText("Cliente sintetico");
    await page.getByRole("button", { name: "Uscite", exact: true }).click();
    await expect(list.locator(":scope .transaction-list-row")).toHaveCount(2);
    await page.getByRole("button", { name: "Azzera filtri" }).click();
    await expect(list.locator(":scope .transaction-list-row")).toHaveCount(3);

    await navigateToSurface(page, "accounts");
    await expect(accountRow(page)).toContainText("1.200,00");
    await navigateToSurface(page, "overview");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("1.200,00");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("1.000,00");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("300,00");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("700,00");
    await navigateToSurface(page, "analytics");
    await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText(
      "1.000,00",
    );
    await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText("300,00");
    await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText("700,00");

    await navigateToSurface(page, "transactions");
    const mainExpense = transactionRow(page, "Esercente sintetico");
    await mainExpense.getByRole("button", { name: "Azioni per Esercente sintetico" }).click();
    await page.getByRole("menuitem", { name: "Modifica" }).click();
    await expect(page.getByRole("heading", { name: "Nuovo movimento" })).toBeVisible();
    await expect(page.locator('input[name="expenseVariability"][value="fixed"]')).toBeChecked();
    await expect(
      page.locator('input[name="expenseExceptionality"][value="ordinary"]'),
    ).toBeChecked();
    await page.getByRole("textbox", { name: "Importo" }).fill("200,00");
    await page.getByRole("button", { name: "Salva movimento" }).click();
    await expect(page.getByRole("status")).toContainText("Movimento salvato");
    await expect(list.locator(":scope .transaction-list-row")).toHaveCount(3);
    await expect(transactionRow(page, "Esercente sintetico")).toContainText("200,00");

    await transactionRow(page, "Esercente sintetico")
      .getByRole("button", { name: "Azioni per Esercente sintetico" })
      .click();
    await page.getByRole("menuitem", { name: "Modifica" }).click();
    await expect(page.locator('input[name="expenseVariability"][value="fixed"]')).toBeChecked();
    await expect(
      page.locator('input[name="expenseExceptionality"][value="ordinary"]'),
    ).toBeChecked();
    await page.getByRole("button", { name: "Annulla", exact: true }).click();

    await expect(page.getByLabel("Riepilogo movimenti")).toContainText("1.000,00");
    await expect(page.getByLabel("Riepilogo movimenti")).toContainText("250,00");
    await expect(page.getByLabel("Riepilogo movimenti")).toContainText("750,00");

    const cancellableExpense = transactionRow(page, "Fornitore sintetico");
    await cancellableExpense
      .getByRole("button", { name: "Azioni per Fornitore sintetico" })
      .click();
    await page.getByRole("menuitem", { name: "Annulla" }).click();
    await expect(page.getByRole("status")).toContainText("Movimento annullato");
    await expect(cancellableExpense).toContainText("Annullato");
    await expect(cancellableExpense.getByRole("button", { name: /Azioni per/ })).toBeDisabled();

    await expect(page.getByLabel("Riepilogo movimenti")).toContainText("200,00");
    await expect(page.getByLabel("Riepilogo movimenti")).toContainText("800,00");
    await navigateToSurface(page, "accounts");
    await expect(accountRow(page)).toContainText("1.300,00");
    await navigateToSurface(page, "overview");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("1.300,00");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("200,00");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("800,00");
    await navigateToSurface(page, "analytics");
    await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText("200,00");
    await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText("800,00");

    await navigateToSurface(page, "transactions");
    await page.reload();
    await expectFinalState(page);
    await page.close();
    const reopenedPage = await context.newPage();
    observeRuntimeErrors(reopenedPage, consoleErrors);
    await reopenedPage.goto("/#transactions");
    await expectFinalState(reopenedPage);
    await expectNoOverflowAndA11y(reopenedPage);
    expect(consoleErrors).toEqual([]);
  });

  test("crea e rilegge una spesa offline su IndexedDB isolato", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-1440");
    await page.addInitScript(({ key }) => window.localStorage.setItem(key, "indexeddb"), {
      key: storagePreferenceKey,
    });
    await page.goto("/");
    await createAccount(page);
    await activateServiceWorker(page);
    await context.setOffline(true);
    try {
      await navigateToSurface(page, "transactions");
      await createManualTransaction(page, {
        description: "Spesa offline C4.2",
        kind: "expense",
        payee: "Offline sintetico",
        amount: "10,00",
      });
      await navigateToSurface(page, "accounts");
      await expect(accountRow(page)).toContainText("490,00");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(accountRow(page)).toContainText("490,00");
      await navigateToSurface(page, "transactions");
      await expectFinalState(page, "Spesa offline C4.2");
    } finally {
      await context.setOffline(false);
    }
  });

  test("rifiuta input finanziari invalidi e protegge annulla/doppio invio", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-390");
    await page.goto("/");
    await createAccount(page);
    await navigateToSurface(page, "transactions");
    await page.getByRole("button", { name: "Nuovo movimento" }).click();
    const amount = page.getByRole("textbox", { name: "Importo" });
    for (const invalid of ["0,00", "1,234", "non numerico"]) {
      await amount.fill(invalid);
      await page.getByRole("button", { name: "Salva movimento" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
    }
    await page.getByRole("button", { name: "Annulla", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nuovo movimento" })).toHaveCount(0);
    await page.getByRole("button", { name: "Nuovo movimento" }).click();
    await amount.fill("25,00");
    await page.getByLabel("Descrizione").fill("Spesa doppio invio C4.2");
    await page.getByLabel("Controparte").fill("Doppio invio sintetico");
    await page.getByRole("button", { name: "Salva movimento" }).dblclick();
    await expect(page.getByRole("status")).toContainText("Movimento salvato");
    await expect(
      page
        .getByRole("list", { name: "Movimenti registrati nel ledger" })
        .locator(".transaction-list-row"),
    ).toHaveCount(1);
    const row = transactionRow(page, "Doppio invio sintetico");
    await row.getByRole("button", { name: /Azioni per/ }).click();
    await page.getByRole("menuitem", { name: "Annulla" }).click();
    await expect(row).toContainText("Annullato");
    await expect(row.getByRole("button", { name: /Azioni per/ })).toBeDisabled();
  });
});

async function createAccount(page: Page): Promise<void> {
  await navigateToSurface(page, "accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill(accountName);
  await page.getByLabel("Tipo").selectOption("checking");
  await page.getByLabel("Valuta").fill("EUR");
  await page.getByLabel("Saldo iniziale").fill("500,00");
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
}

async function createManualTransaction(
  page: Page,
  input: {
    readonly amount: string;
    readonly description: string;
    readonly kind: "income" | "expense";
    readonly payee: string;
    readonly classify?: boolean;
  },
): Promise<void> {
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  const kindSelect = page.locator('select[name="kind"]');
  if ((await kindSelect.count()) > 0) {
    await kindSelect.selectOption(input.kind);
  } else {
    await page
      .getByRole("radio", { name: input.kind === "income" ? "Entrata" : "Uscita", exact: true })
      .check();
  }
  await page.getByRole("textbox", { name: "Importo" }).fill(input.amount);
  await page.getByLabel("Controparte").fill(input.payee);
  await page.getByLabel("Data").fill(bookedDate);
  await page.getByLabel("Descrizione").fill(input.description);
  if (input.classify) {
    await page.getByText("Altri dettagli", { exact: true }).click();
    await page.getByText("Dettagli finanziari (facoltativi)", { exact: true }).click();
    await page.locator('input[name="expenseVariability"][value="fixed"]').check();
    await page.locator('input[name="expenseExceptionality"][value="ordinary"]').check();
  }
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.locator('p.account-feedback[role="status"]')).toContainText(
    "Movimento salvato",
  );
}

async function inspectDetails(
  page: Page,
  list: Locator,
  payee: string,
  expected: readonly string[],
): Promise<void> {
  const row = transactionRow(page, payee);
  const trigger = row.locator(".transaction-list-open");
  await trigger.click();
  const details = page.locator(".transaction-details-panel");
  for (const value of expected) await expect(details).toContainText(value);
  await page.getByRole("button", { name: "Chiudi dettaglio movimento" }).click();
  await expect(trigger).toBeFocused();
  await expect(list).toBeVisible();
}

function transactionRow(page: Page, payee: string) {
  return page.locator(".transaction-list-row").filter({ hasText: payee }).first();
}

function accountRow(page: Page) {
  return page.getByRole("row", { name: new RegExp(accountName) });
}

async function expectFinalState(page: Page, extraDescription?: string): Promise<void> {
  const list = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
  if (extraDescription === "Spesa offline C4.2") {
    await expect(list).toContainText("Offline sintetico");
    await expect(list).toContainText("10,00");
    await expect(page.getByLabel("Riepilogo movimenti")).toContainText("10,00");
    return;
  }
  await expect(list).toContainText("Esercente sintetico");
  await expect(list).toContainText("200,00");
  await expect(list).toContainText("Annullato");
  await expect(page.getByLabel("Riepilogo movimenti")).toContainText("800,00");
}

async function activateServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function navigateToSurface(
  page: Page,
  surface: "accounts" | "analytics" | "overview" | "transactions",
): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  const labels = {
    accounts: "Conti",
    analytics: "Analisi",
    overview: "Panoramica",
    transactions: "Movimenti",
  } as const;
  if (width <= 768) {
    await page
      .getByRole("navigation", { name: "Navigazione mobile" })
      .getByRole("link", { name: labels[surface], exact: true })
      .click();
    return;
  }
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("link", { name: labels[surface], exact: true })
    .click();
}

async function expectNoOverflowAndA11y(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
}

function observeRuntimeErrors(page: Page, errors: string[]): void {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
}
