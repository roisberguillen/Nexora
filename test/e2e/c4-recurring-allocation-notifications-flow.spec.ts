import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const frozenNow = new Date("2026-09-05T10:00:00+02:00");

test.describe("C4.5 ricorrenza, allocazioni, budget e notifiche", () => {
  test("completa il ciclo finanziario deterministico e lo rilegge offline", async ({
    context,
    page,
  }, testInfo) => {
    await page.clock.install({ time: frozenNow });
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    if (["chromium-1024", "chromium-1440"].includes(testInfo.project.name)) {
      const physicalWidth = testInfo.project.name === "chromium-1024" ? 1024 : 1440;
      const client = await context.newCDPSession(page);
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: physicalWidth / 2,
        height: 900,
        deviceScaleFactor: 2,
        mobile: false,
      });
      await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    }

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Il ledger è pronto per i primi dati" }),
    ).toBeVisible();
    await createAccount(page, "Conto stipendio C4.5", "1000,00");
    await createAccount(page, "Risparmio C4.5", "100,00");
    await createAccount(page, "Investimenti C4.5", "50,00");
    await createExpenseCategory(page);
    await createBudget(page);
    await createExpense(page);
    await createSalaryRule(page);
    await createAllocationPlans(page);

    await page.goto("/#notifications");
    await expect(page.getByText("Entrata attesa: Stipendio C4.5")).toBeVisible();
    await expect(page.getByText("Prima soglia budget raggiunta (80%)")).toBeVisible();

    await page.goto("/#transactions");
    await page.getByRole("button", { name: "Nuovo movimento" }).click();
    await selectKind(page, "income");
    await page
      .locator('select[name="account"]')
      .selectOption({ label: "Conto stipendio C4.5 · EUR" });
    await page.getByLabel("Descrizione").fill("Stipendio C4.5");
    await page.getByLabel("Controparte").fill("Datore C4.5");
    await page.getByRole("textbox", { name: "Importo", exact: true }).fill("2500,00");
    await page.locator('input[name="bookedDate"]').last().fill("2026-03-27");
    await page.getByRole("button", { name: "Salva movimento" }).click();
    const salaryDialog = page.getByRole("dialog", { name: "Conferma allocazioni stipendio" });
    await expect(salaryDialog).toBeVisible();
    await salaryDialog.getByRole("button", { name: "Non ora" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("list", { name: "Movimenti registrati nel ledger" })).toContainText(
      "Datore C4.5",
    );

    await page.goto("/#recurring");
    await page.getByRole("button", { name: "Conferma allocazioni stipendio" }).click();
    const recurringDialog = page.getByRole("dialog", { name: "Conferma allocazioni stipendio" });
    await recurringDialog.getByRole("button", { name: "Esegui allocazioni" }).click();
    await expect(page.getByRole("status")).toContainText("2 allocazioni registrate");
    await page.reload();

    await page.goto("/#accounts");
    await expect(accountRow(page, "Conto stipendio C4.5")).toContainText("2.870,00");
    await expect(accountRow(page, "Risparmio C4.5")).toContainText("270,00");
    await expect(accountRow(page, "Investimenti C4.5")).toContainText("110,00");
    await page.goto("/#notifications");
    await expect(page.getByText("Entrata attesa: Stipendio C4.5")).toHaveCount(0);
    await expect(page.getByText("Prima soglia budget raggiunta (80%)")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Prima soglia budget raggiunta (80%)")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({ violations: [] });
    expect(consoleErrors).toEqual([]);
  });

  test("mantiene il ledger e le allocazioni dopo reload offline", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-1440",
      "Il gate offline usa il profilo desktop reale.",
    );
    await page.addInitScript(() => {
      window.localStorage.setItem("nexora.ledger-storage.v1", "indexeddb");
    });
    await page.goto("/");
    await createAccount(page, "Conto stipendio C4.5", "1000,00");
    await createAccount(page, "Risparmio C4.5", "100,00");
    await createAccount(page, "Investimenti C4.5", "50,00");
    await createExpenseCategory(page);
    await createBudget(page);
    await createExpense(page);
    await createSalaryRule(page);
    await createAllocationPlans(page);
    await page.goto("/#notifications");
    await expect(page.getByText("Entrata attesa: Stipendio C4.5")).toBeVisible();
    await expect(page.getByText("Prima soglia budget raggiunta (80%)")).toBeVisible();
    await page.goto("/#accounts");
    await expect(accountRow(page, "Conto stipendio C4.5")).toContainText("600,00");
    await expect(accountRow(page, "Risparmio C4.5")).toContainText("100,00");
    await expect(accountRow(page, "Investimenti C4.5")).toContainText("50,00");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.goto("/#transactions");
      await page.getByRole("button", { name: "Nuovo movimento" }).click();
      await selectKind(page, "income");
      await page
        .locator('select[name="account"]')
        .selectOption({ label: "Conto stipendio C4.5 · EUR" });
      await page.getByLabel("Descrizione").fill("Stipendio C4.5 offline");
      await page.getByLabel("Controparte").fill("Datore C4.5");
      await page.getByRole("textbox", { name: "Importo", exact: true }).fill("2500,00");
      await page.locator('input[name="bookedDate"]').last().fill("2026-03-27");
      await page.getByRole("button", { name: "Salva movimento" }).click();
      const dialog = page.getByRole("dialog", { name: "Conferma allocazioni stipendio" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Esegui allocazioni" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Allocazioni stipendio registrate" }),
      ).toBeVisible();
      await expectAllocationState(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectAllocationState(page);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectAllocationState(page);
    } finally {
      await context.setOffline(false);
    }
    await page.reload();
    await expectAllocationState(page);
    await page.goto("/#transactions");
    await expect(page.getByRole("list", { name: "Movimenti registrati nel ledger" })).toContainText(
      "Datore C4.5",
    );
    await expect(
      page
        .getByRole("list", { name: "Movimenti registrati nel ledger" })
        .locator(".transaction-list-row"),
    ).toHaveCount(4);
  });
});

async function expectAllocationState(page: Page): Promise<void> {
  await page.goto("/#accounts");
  await expect(accountRow(page, "Conto stipendio C4.5")).toContainText("2.870,00");
  await expect(accountRow(page, "Risparmio C4.5")).toContainText("270,00");
  await expect(accountRow(page, "Investimenti C4.5")).toContainText("110,00");
  await page.goto("/#budgets");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "80");
  await page.goto("/#notifications");
  await expect(page.getByText("Entrata attesa: Stipendio C4.5")).toHaveCount(0);
  await expect(page.getByText("Prima soglia budget raggiunta (80%)")).toBeVisible();
  await page.goto("/#recurring");
  await expect(page.getByText("Piano sospeso C4.5")).toBeVisible();
}

async function createAccount(page: Page, name: string, openingBalance: string): Promise<void> {
  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill(name);
  await page.getByLabel("Tipo").selectOption("checking");
  await page.getByLabel("Valuta").fill("EUR");
  await page.getByLabel("Saldo iniziale").fill(openingBalance);
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
}

async function createExpenseCategory(page: Page): Promise<void> {
  await page.goto("/#categories");
  await page.getByRole("button", { name: "Aggiungi tassonomia predefinita" }).click();
  await expect(page.getByRole("tree", { name: "Categorie finanziarie" })).toContainText("Spese");
  await page
    .getByRole("button", { name: /Aggiungi sottocategoria/ })
    .first()
    .click();
  await page.getByLabel("Nome").fill("Spesa C4.5");
  await page.getByLabel("Ambito").selectOption("expense");
  await page.getByRole("button", { name: "Salva categoria" }).click();
}

async function createBudget(page: Page): Promise<void> {
  await page.goto("/#budgets");
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption({ label: "Casa e utenze" });
  await page
    .getByRole("combobox", { name: "Sotto-categoria", exact: true })
    .selectOption({ label: "Spesa C4.5" });
  await page.getByLabel("Importo").fill("500,00");
  await page.getByLabel("Prima soglia di notifica (%)").fill("80");
  await page.getByLabel("Seconda soglia di notifica (%)").fill("100");
  await page.getByRole("button", { name: "Salva budget" }).click();
}

async function createExpense(page: Page): Promise<void> {
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await selectKind(page, "expense");
  await page
    .locator('select[name="account"]')
    .selectOption({ label: "Conto stipendio C4.5 · EUR" });
  await page.getByLabel("Descrizione").fill("Spesa C4.5");
  await page.getByLabel("Controparte").fill("Fornitore C4.5");
  await page.getByRole("textbox", { name: "Importo", exact: true }).fill("400,00");
  const category = page.locator('select[name="category"]');
  const categoryOption = category.locator("option").filter({ hasText: "Spesa C4.5" });
  const categoryValue = await categoryOption.getAttribute("value");
  expect(categoryValue).not.toBeNull();
  await category.selectOption(categoryValue!);
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento salvato");
}

async function createSalaryRule(page: Page): Promise<void> {
  await page.goto("/#recurring");
  await page.getByLabel("Nome", { exact: true }).fill("Stipendio C4.5");
  await page.getByLabel("Tipo").selectOption("income");
  await page.locator('select[name="accountId"]').selectOption({ label: "Conto stipendio C4.5" });
  await page.locator('input[name="amount"]').fill("2500,00");
  await page.getByLabel("Prossima data prevista").fill("2026-03-28");
  await page.getByLabel("Policy weekend").selectOption("salary_italy");
  await page.getByRole("button", { name: "Salva ricorrenza" }).click();
  await expect(page.getByText("2026-03-27")).toBeVisible();
}

async function createAllocationPlans(page: Page): Promise<void> {
  for (const [name, amount, destination] of [
    ["Piano Risparmio mensile C4.5", "170,00", "Risparmio C4.5"],
    ["Piano Investimento mensile C4.5", "60,00", "Investimenti C4.5"],
    ["Piano sospeso C4.5", "40,00", "Risparmio C4.5"],
  ] as const) {
    await page.getByLabel("Nome piano").fill(name);
    await page.getByLabel("Conto origine").selectOption({ label: "Conto stipendio C4.5" });
    await page.getByLabel("Conto destinazione").selectOption({ label: destination });
    await page.getByLabel("Importo").last().fill(amount);
    await page.getByRole("button", { name: "Salva piano" }).click();
  }
  const suspended = page.getByRole("listitem").filter({ hasText: "Piano sospeso C4.5" });
  await suspended.getByRole("button", { name: "Metti in pausa" }).click();
}

function accountRow(page: Page, name: string) {
  return page.getByRole("row").filter({ hasText: name });
}

async function selectKind(page: Page, kind: "income" | "expense"): Promise<void> {
  const select = page.locator('select[name="kind"]');
  if (await select.count()) {
    await select.selectOption(kind);
  } else {
    await page
      .getByRole("radio", { name: kind === "income" ? "Entrata" : "Uscita", exact: true })
      .check();
  }
}
