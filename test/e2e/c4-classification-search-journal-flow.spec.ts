import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

const accountName = "Conto C4.4";
const rootName = "Casa C4.4";
const sourceCategory = "Utenze C4.4";
const targetCategory = "Spese domestiche C4.4";
const sourceTag = "Ricorrente C4.4";
const targetTag = "Mensile C4.4";
const extraTag = "Abitazione C4.4";
const description = "Bolletta energia C4.4";
const payee = "Fornitore energia C4.4";
const period = "2026-09";

test.describe("C4.4 classificazione, ricerca globale e diario", () => {
  test("completa il ciclo UI, merge, archiviazione, diario e riapertura", async ({
    context,
    page,
  }, testInfo) => {
    const runtimeErrors: string[] = [];
    observeRuntimeErrors(page, runtimeErrors);
    await applyDesktopZoomIfNeeded(page, context, testInfo.project.name);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Il ledger è pronto per i primi dati" }),
    ).toBeVisible();

    await createAccount(page);
    await createClassification(page);
    await createTags(page);
    await createClassifiedExpense(page);
    await assertFinancialState(page);
    await assertTransactionDetails(page, [
      rootName,
      sourceCategory,
      sourceTag,
      extraTag,
      payee,
      description,
    ]);
    await verifyGlobalSearch(page, [
      description,
      payee,
      sourceCategory,
      sourceTag,
      extraTag,
      accountName,
    ]);
    await verifyEmptySearch(page);
    await createAndEditJournal(page);
    await assertFinancialState(page);

    await mergeCategory(page);
    await assertTransactionDetails(page, [rootName, targetCategory, sourceTag, extraTag]);
    await verifyGlobalSearch(page, [targetCategory]);
    await verifySearchExcludes(page, sourceCategory);
    await archiveAndReactivateCategory(page);

    await mergeTag(page);
    await assertTransactionDetails(page, [targetCategory, targetTag, extraTag]);
    await verifySearchExcludes(page, sourceTag);
    await archiveAndReactivateTag(page);
    await assertFinancialState(page);
    await assertJournal(page);

    await page.goto("/#transactions");
    await page.reload();
    await expect(page.locator(".transaction-list-row")).toContainText(payee);
    await page.close();
    const reopened = await context.newPage();
    observeRuntimeErrors(reopened, runtimeErrors);
    await reopened.goto("/#transactions");
    await expect(reopened.locator(".transaction-list-row")).toContainText(payee);
    await assertTransactionDetails(reopened, [targetCategory, targetTag, extraTag]);
    await reopened.goto("/#journal");
    await assertJournal(reopened);
    await expectNoOverflowAndA11y(reopened);
    expect(runtimeErrors).toEqual([]);
  });

  test("conserva classificazione e diario offline su IndexedDB", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-1440");
    await page.addInitScript(() =>
      window.localStorage.setItem("nexora.ledger-storage.v1", "indexeddb"),
    );
    await page.goto("/");
    await activateServiceWorker(page);
    await context.setOffline(true);
    try {
      await createAccount(page);
      await createClassification(page);
      await createTags(page);
      await createClassifiedExpense(page);
      await createAndEditJournal(page);
      await assertTransactionDetails(page, [rootName, sourceCategory, description, payee]);
      await verifyGlobalSearch(page, [description, sourceCategory, sourceTag]);
      await page.reload({ waitUntil: "domcontentloaded" });
      await assertFinancialState(page);
      await assertTransactionDetails(page, [rootName, sourceCategory, sourceTag, extraTag]);
      await page.goto("/#categories");
      await expect(page.getByRole("tree", { name: "Categorie finanziarie" })).toContainText(
        sourceCategory,
      );
      await page.goto("/#tags");
      await expect(page.getByRole("table", { name: "Tag registrati nel ledger" })).toContainText(
        sourceTag,
      );
      await assertFinancialState(page);
      await page.goto("/#journal");
      await assertJournal(page);
      await expect(page.getByRole("list").filter({ hasText: period })).toHaveCount(1);
    } finally {
      await context.setOffline(false);
    }
    await page.goto("/#transactions");
    await expect(page.locator(".transaction-list-row").filter({ hasText: payee })).toHaveCount(1);
    await page.goto("/#journal");
    await expect(page.getByRole("list").filter({ hasText: period })).toHaveCount(1);
  });

  test("rifiuta duplicati, annullamenti e riferimenti archiviati senza scritture parziali", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-390");
    await page.goto("/");
    await createAccount(page);
    await page.goto("/#categories");
    await saveCategory(page, rootName);
    await page.getByLabel("Nome").fill(rootName);
    await page.getByRole("button", { name: "Salva categoria" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    const root = page.locator(".category-tree-group").filter({ hasText: rootName });
    await root.getByRole("button", { name: "Aggiungi sottocategoria" }).click();
    await page.getByLabel("Nome").fill(sourceCategory);
    await page.getByRole("button", { name: "Salva categoria" }).click();
    await root.getByRole("button", { name: `Apri ${rootName}` }).click();
    await expect(root.getByText(sourceCategory, { exact: true })).toBeVisible();
    await root.getByRole("button", { name: "Aggiungi sottocategoria" }).click();
    await page.getByLabel("Nome").fill(sourceCategory);
    await page.getByRole("button", { name: "Salva categoria" }).click();
    await expect(root.getByText(sourceCategory, { exact: true })).toHaveCount(1);
    await page.goto("/#tags");
    await saveTag(page, sourceTag);
    await page.getByLabel("Nome").fill(sourceTag.toLowerCase());
    await page.getByRole("button", { name: "Salva tag" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.goto("/#transactions");
    await page.getByRole("button", { name: "Nuovo movimento" }).click();
    await page.getByRole("radio", { name: "Uscita", exact: true }).check();
    await page.getByRole("button", { name: "Annulla", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nuovo movimento" })).toHaveCount(0);
    await expect(page.locator(".transaction-list-row")).toHaveCount(0);
  });
});

async function createAccount(page: Page): Promise<void> {
  await navigateToSurface(page, "accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill(accountName);
  await page.getByLabel("Tipo").selectOption("checking");
  await page.getByLabel("Valuta").fill("EUR");
  await page.getByLabel("Saldo iniziale").fill("1000,00");
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.locator(".account-feedback")).toContainText("Conto creato e salvato");
}

async function createClassification(page: Page): Promise<void> {
  await page.goto("/#categories");
  await saveCategory(page, rootName);
  const root = page.locator(".category-tree-group").filter({ hasText: rootName });
  await root.getByRole("button", { name: "Aggiungi sottocategoria" }).click();
  await page.getByLabel("Nome").fill(sourceCategory);
  await page.getByRole("button", { name: "Salva categoria" }).click();
  await root.getByRole("button", { name: `Apri ${rootName}` }).click();
  await expect(root.getByText(sourceCategory, { exact: true })).toBeVisible();
  await root.getByRole("button", { name: "Aggiungi sottocategoria" }).click();
  await page.getByLabel("Nome").fill(targetCategory);
  await page.getByRole("button", { name: "Salva categoria" }).click();
  await expect(root.getByText(targetCategory, { exact: true })).toBeVisible();
}

async function saveCategory(page: Page, name: string): Promise<void> {
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("Ambito").selectOption("expense");
  await page.getByRole("button", { name: "Salva categoria" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function createTags(page: Page): Promise<void> {
  await page.goto("/#tags");
  await saveTag(page, sourceTag);
  await saveTag(page, targetTag);
  await saveTag(page, extraTag);
}

async function saveTag(page: Page, name: string): Promise<void> {
  await page.getByLabel("Nome").fill(name);
  await page.getByRole("button", { name: "Salva tag" }).click();
  await expect(page.getByRole("table", { name: "Tag registrati nel ledger" })).toContainText(name);
}

async function createClassifiedExpense(page: Page, includeTags = true): Promise<void> {
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByRole("radio", { name: "Uscita", exact: true }).check();
  await page.getByRole("textbox", { name: "Importo" }).fill("80,00");
  await page.locator('select[name="account"]').selectOption({ label: `${accountName} · EUR` });
  await page
    .locator('select[name="category"]')
    .selectOption({ label: `${rootName} → ${sourceCategory}` });
  await page.getByLabel("Controparte").fill(payee);
  await page.getByLabel("Data").fill("2026-09-04");
  await page.getByLabel("Descrizione").fill(description);
  await page.getByText("Altri dettagli").click();
  if (includeTags) {
    await page.getByRole("checkbox", { name: sourceTag }).check();
    await page.getByRole("checkbox", { name: extraTag }).check();
  }
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("heading", { name: "Nuovo movimento" })).toHaveCount(0);
}

async function assertFinancialState(page: Page): Promise<void> {
  await page.goto("/#accounts");
  await expect(page.getByRole("row", { name: new RegExp(accountName) })).toContainText("920,00");
  await page.goto("/#analytics");
  await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText("80,00");
  await expect(page.locator('section[aria-labelledby="summary-title"]')).toContainText("-80,00");
}

async function assertTransactionDetails(page: Page, values: readonly string[]): Promise<void> {
  await page.goto("/#transactions");
  const row = page.locator(".transaction-list-row").filter({ hasText: payee }).first();
  await expect(row).toBeVisible();
  await row.locator(".transaction-list-open").click();
  const details = page.locator(".transaction-details-panel");
  for (const value of values) await expect(details).toContainText(value);
  await page.getByRole("button", { name: "Chiudi dettaglio movimento" }).click();
}

async function verifyGlobalSearch(page: Page, terms: readonly string[]): Promise<void> {
  for (const [index, term] of terms.entries()) {
    await page.goto("/#overview");
    const { input, dialog } = await openGlobalSearch(page);
    await input.fill(term);
    const options = page.getByRole("option", { name: new RegExp(term) });
    await expect(options.first()).toBeVisible();
    const optionTexts = await options.allTextContents();
    expect(new Set(optionTexts).size).toBe(optionTexts.length);
    if (index % 2 === 0) await options.first().click();
    else {
      await input.press("ArrowDown");
      await input.press("Enter");
    }
    await expect(page).toHaveURL(/#(transactions|accounts|categories|tags)$/);
    if (dialog) await expect(page.getByRole("dialog", { name: "Ricerca globale" })).toHaveCount(0);
  }
}

async function verifyEmptySearch(page: Page): Promise<void> {
  await page.goto("/#overview");
  const { input } = await openGlobalSearch(page);
  await input.fill("termine inesistente C4.4");
  await expect(page.getByText("Nessun risultato locale.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancella ricerca" }).click();
  await expect(input).toHaveValue("");
  await page.keyboard.press("Escape");
}

async function verifySearchExcludes(page: Page, term: string): Promise<void> {
  await page.goto("/#overview");
  const { input } = await openGlobalSearch(page);
  await input.fill(term);
  await expect(page.getByText("Nessun risultato locale.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
}

async function openGlobalSearch(page: Page): Promise<{ input: Locator; dialog: boolean }> {
  const trigger = page.getByRole("button", { name: "Apri ricerca globale" });
  if (await trigger.isVisible()) {
    await trigger.click();
    const input = page.getByRole("searchbox", { name: "Ricerca globale" });
    await expect(input).toBeFocused();
    return { input, dialog: true };
  }
  return { input: page.getByRole("combobox", { name: "Ricerca globale" }), dialog: false };
}

async function createAndEditJournal(page: Page): Promise<void> {
  await page.goto("/#journal");
  await expect(page.getByRole("heading", { name: period })).toBeVisible();
  await expect(page.getByLabel("Come è andato il mese?")).toBeVisible();
  await expect(page.getByText("80,00").first()).toBeVisible();
  await page
    .getByLabel("Come è andato il mese?")
    .fill("La spesa energetica è stata classificata correttamente.");
  await page
    .getByLabel("Obiettivo per il prossimo mese")
    .fill("Controllare il consumo energetico.");
  await page.getByLabel("Percezione di controllo").selectOption("4");
  await page.getByLabel("Periodo").fill("2026-13");
  await page.getByRole("button", { name: "Salva diario" }).click();
  await expect(page.getByRole("list").filter({ hasText: period })).toHaveCount(0);
  await page.getByLabel("Periodo").fill(period);
  await page.getByRole("button", { name: "Salva diario" }).dblclick();
  await expect(page.locator(".account-feedback")).toContainText("Diario mensile salvato");
  await expect(page.getByRole("list").filter({ hasText: period })).toHaveCount(1);
  await page.getByRole("button", { name: "Modifica" }).click();
  await page
    .getByLabel("Come è andato il mese?")
    .fill("La spesa energetica è stata classificata correttamente e verificata.");
  await page.getByRole("button", { name: "Salva diario" }).click();
  await expect(page.locator(".account-feedback")).toContainText("Diario mensile salvato");
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Come è andato il mese?").fill("Modifica annullata");
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(page.getByLabel("Mesi registrati")).toContainText(
    "La spesa energetica è stata classificata correttamente e verificata.",
  );
}

async function assertJournal(page: Page): Promise<void> {
  await page.goto("/#journal");
  await expect(page.getByRole("heading", { name: period })).toBeVisible();
  await expect(
    page
      .getByLabel("Mesi registrati")
      .getByText("La spesa energetica è stata classificata correttamente e verificata."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Mesi registrati").getByText("Controllare il consumo energetico."),
  ).toBeVisible();
  await expect(page.getByText("Controllo 4/5")).toBeVisible();
  await expect(page.getByText("80,00").first()).toBeVisible();
  const summary = page.locator('section[aria-labelledby="journal-summary-title"]');
  await expect(summary.locator(".metric-card").nth(0)).toContainText("0,00");
  await expect(summary.locator(".metric-card").nth(1)).toContainText("80,00");
  await expect(summary.locator(".metric-card").nth(2)).toContainText("-80,00");
  await expect(summary.locator(".metric-card").nth(3)).toContainText("0,00");
}

async function mergeCategory(page: Page): Promise<void> {
  await page.goto("/#categories");
  const source = page.getByText(sourceCategory, { exact: true });
  await source.locator("../..").getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Unisci in").selectOption({ label: `${rootName} → ${targetCategory}` });
  await page.getByRole("button", { name: "Unisci e riassegna" }).click();
  await expect(page.getByRole("tree")).not.toContainText(sourceCategory);
}

async function archiveAndReactivateCategory(page: Page): Promise<void> {
  await page.goto("/#categories");
  const target = page.getByText(targetCategory, { exact: true });
  await target.locator("../..").getByRole("button", { name: "Modifica" }).click();
  await page.locator(".account-editor-panel").getByRole("button", { name: "Archivia" }).click();
  await expect(page.getByRole("tree")).toContainText("Archiviata");
  await assertTransactionDetails(page, [
    `${rootName} → ${targetCategory}`,
    targetCategory,
    sourceTag,
    extraTag,
  ]);
  await assertCategoryUnavailableForNewMovement(page);
  await page.goto("/#categories");
  const archivedTarget = page.getByText(targetCategory, { exact: true });
  await archivedTarget.locator("../..").getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await assertFinancialState(page);
  await page.goto("/#categories");
  const targetToReactivate = page.getByText(targetCategory, { exact: true });
  await targetToReactivate.locator("../..").getByRole("button", { name: "Modifica" }).click();
  await page.locator(".account-editor-panel").getByRole("button", { name: "Riattiva" }).click();
  await expect(targetToReactivate.locator("../..")).toContainText("Attiva");

  const root = page.getByText(rootName, { exact: true }).locator("../..");
  await expect(root.getByRole("button", { name: "Modifica" })).toBeDisabled();
  await expect(root.getByRole("button", { name: "Archivia" })).toBeDisabled();
  await root.getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
}

async function mergeTag(page: Page): Promise<void> {
  await page.goto("/#tags");
  const source = page.getByRole("row").filter({ hasText: sourceTag });
  await source.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Unisci in").selectOption({ label: targetTag });
  await page.getByRole("button", { name: "Unisci e deduplica" }).click();
  await expect(page.getByRole("table", { name: "Tag registrati nel ledger" })).not.toContainText(
    sourceTag,
  );
}

async function archiveAndReactivateTag(page: Page): Promise<void> {
  await page.goto("/#tags");
  const target = page.getByRole("row").filter({ hasText: targetTag });
  await target.getByRole("button", { name: "Modifica" }).click();
  await page.locator(".account-editor-panel").getByRole("button", { name: "Archivia" }).click();
  await expect(target).toContainText("Archiviato");
  await assertTransactionDetails(page, [targetTag, extraTag]);
  await verifyGlobalSearchResult(page, targetTag, "Tag archiviato");
  await assertTagUnavailableForNewMovement(page);
  await page.goto("/#tags");
  await target.getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await assertFinancialState(page);
  await page.goto("/#tags");
  const targetToReactivate = page.getByRole("row").filter({ hasText: targetTag });
  await targetToReactivate.getByRole("button", { name: "Modifica" }).click();
  await page.locator(".account-editor-panel").getByRole("button", { name: "Riattiva" }).click();
  await expect(targetToReactivate).toContainText("Attivo");
}

async function assertCategoryUnavailableForNewMovement(page: Page): Promise<void> {
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByRole("radio", { name: "Uscita", exact: true }).check();
  await expect(
    page.locator('select[name="category"] option', { hasText: targetCategory }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
}

async function assertTagUnavailableForNewMovement(page: Page): Promise<void> {
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByRole("radio", { name: "Uscita", exact: true }).check();
  await page.getByText("Altri dettagli").click();
  await expect(page.getByRole("checkbox", { name: targetTag })).toHaveCount(0);
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
}

async function verifyGlobalSearchResult(page: Page, term: string, detail: string): Promise<void> {
  await page.goto("/#overview");
  const { input } = await openGlobalSearch(page);
  await input.fill(term);
  const option = page
    .getByRole("option")
    .filter({ hasText: term })
    .filter({ hasText: detail })
    .first();
  await expect(option).toBeVisible();
  await page.keyboard.press("Escape");
}

async function navigateToSurface(
  page: Page,
  surface: "accounts" | "categories" | "tags",
): Promise<void> {
  const mobile = page.getByRole("navigation", { name: "Navigazione mobile" });
  const desktop = page.getByRole("navigation", { name: "Navigazione principale" });
  const labels = { accounts: "Conti", categories: "Categorie", tags: "Tag" } as const;
  if (await mobile.isVisible())
    return void (await mobile.getByRole("link", { name: labels[surface], exact: true }).click());
  if (await desktop.isVisible())
    return void (await desktop.getByRole("link", { name: labels[surface], exact: true }).click());
  throw new Error("Nessuna navigazione visibile per la superficie richiesta.");
}

async function applyDesktopZoomIfNeeded(
  page: Page,
  context: BrowserContext,
  projectName: string,
): Promise<void> {
  if (!["chromium-1024", "chromium-1440"].includes(projectName)) return;
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: projectName === "chromium-1024" ? 512 : 720,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
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
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
}
