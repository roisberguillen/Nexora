import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const frozenNow = new Date("2026-10-05T10:00:00+02:00");

test.describe("C4.6 prestiti, investimenti, Dashboard e Analisi", () => {
  test("riconcilia il flusso finanziario completo su ogni viewport", async ({ page }, testInfo) => {
    await page.clock.install({ time: frozenNow });
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto("/");
    await createAccount(page, "Conto operativo C4.6", "checking", "5000,00");
    await createAccount(page, "Directa C4.6", "investment", "0,00");
    await createAccount(page, "Findomestic C4.6", "loan", "0,00");
    await createCategory(page);
    await createTransaction(page, "Entrata settembre C4.6", "income", "2800,00", "2026-09-05");
    await createTransaction(page, "Spesa settembre C4.6", "expense", "600,00", "2026-09-06", true);
    await createTransaction(page, "Entrata ottobre C4.6", "income", "3000,00", "2026-10-05");
    await createTransaction(page, "Spesa ottobre C4.6", "expense", "500,00", "2026-10-05", true);
    await createLoan(page, "5000,00", "10000,00", "2026-10-10");
    await createInvestment(page, "1000,00", "1125,00");
    await expectSummary(page, "9.700,00", "1.125,00", "125,00");
    await createTransaction(page, "Rata Findomestic C4.6", "expense", "172,00", "2026-10-05");
    await updateLoan(page);
    await createTransfer(page);
    await updateInvestment(page);
    await expectSummary(page, "9.468,00", "1.200,00", "140,00");
    await expect(page.getByRole("link", { name: "Vedi prestiti" })).toHaveAttribute(
      "href",
      "#loans",
    );
    await expect(page.getByRole("link", { name: "Vedi investimenti" })).toHaveAttribute(
      "href",
      "#investments",
    );
    await page.reload();
    await expectSummary(page, "9.468,00", "1.200,00", "140,00");
    await page.goto("/#analytics");
    await expect(page.getByRole("heading", { name: /Come è andato Ottobre 2026\?/ })).toBeVisible();
    await expect(page.locator("#analytics")).toContainText("3.000,00");
    await expect(page.locator("#analytics")).toContainText("672,00");
    await expect(page.locator("#analytics")).toContainText("2.328,00");
    await expectNoOverflowAndA11y(page);
    expect(consoleErrors).toEqual([]);
    if (testInfo.project.name === "chromium-1024" || testInfo.project.name === "chromium-1440") {
      const client = await page.context().newCDPSession(page);
      await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
      await page.reload();
      await expectNoOverflowAndA11y(page);
    }
  });

  test("mantiene invarianti e validazioni dei record dedicati", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-390");
    await page.goto("/#accounts");
    await createAccount(page, "Conto loan negativo", "loan", "0,00");
    await page.goto("/#loans");
    await page.getByLabel("Conto prestito").selectOption({ label: "Conto loan negativo · EUR" });
    await page.getByLabel("Finanziaria").fill("Test");
    await page.getByLabel("Rata mensile").fill("0,00");
    await page.getByLabel("Capitale residuo").fill("100,00");
    await expect(page.getByRole("button", { name: "Salva prestito" })).toBeEnabled();
    await page.getByRole("button", { name: "Salva prestito" }).click();
    await expect(page.getByRole("alert")).toContainText("Impossibile salvare");
    await expect(page.getByText("Nessun prestito")).toBeVisible();
  });

  test("crea, modifica e riapre prestiti e investimenti offline su IndexedDB", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-1440");
    await page.addInitScript(() => {
      window.localStorage.setItem("nexora.ledger-storage.v1", "indexeddb");
    });
    await page.goto("/");
    await createAccount(page, "Conto base offline C4.6", "checking", "1000,00");
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    try {
      await createAccount(page, "Findomestic offline C4.6", "loan", "0,00");
      await createAccount(page, "Directa offline C4.6", "investment", "0,00");
      await page.goto("/#loans");
      await page.getByLabel("Conto prestito").selectOption({
        label: "Findomestic offline C4.6 · EUR",
      });
      await page.getByLabel("Finanziaria").fill("Findomestic offline C4.6");
      await page.getByLabel("Rata mensile").fill("172,00");
      await page.getByLabel("Capitale residuo").fill("5000,00");
      await page.getByLabel("Capitale originario").fill("10000,00");
      await page.getByLabel("Rate pagate").fill("29");
      await page.getByLabel("Rate rimanenti").fill("30");
      await page.getByLabel("Prossima scadenza").fill("2026-09-10");
      await page.getByRole("button", { name: "Salva prestito" }).click();
      await expect(page.getByText("Progresso 50%")).toBeVisible();
      await updateLoanOffline(page);
      await page.goto("/#investments");
      await page.getByLabel("Conto investimento").selectOption({
        label: "Directa offline C4.6 · EUR",
      });
      await page.getByLabel("Nome posizione").fill("ETF offline C4.6");
      await page.getByLabel("Capitale investito").fill("1000,00");
      await page.getByLabel("Valore corrente").fill("1125,00");
      await page.getByLabel("Data valutazione").fill("2026-09-05");
      await page.getByRole("button", { name: "Salva posizione" }).click();
      await expect(page.getByText(/ETF offline C4.6/)).toBeVisible();
      await page.getByRole("button", { name: "Modifica" }).click();
      await page.getByLabel("Capitale investito").fill("1060,00");
      await page.getByLabel("Valore corrente").fill("1200,00");
      await page.getByRole("button", { name: "Salva modifiche" }).click();
      await expect(page.getByText(/Rendimento 140,00/)).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(/Rendimento 140,00/)).toBeVisible();
      await page.goto("/#loans");
      await expect(page.getByText("Progresso 52%")).toBeVisible();
      await expectNoOverflowAndA11y(page);
    } finally {
      await context.setOffline(false);
    }
  });
});

async function createAccount(page: Page, name: string, type: string, balance: string) {
  await page.goto("/#accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill(name);
  await page.getByLabel("Tipo").selectOption(type);
  await page.getByLabel("Saldo iniziale").fill(balance);
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Conto creato" })).toBeVisible();
}

async function createCategory(page: Page) {
  await page.goto("/#categories");
  await page.getByRole("button", { name: "Aggiungi tassonomia predefinita" }).click();
  await page
    .getByRole("button", { name: /Aggiungi sottocategoria/ })
    .first()
    .click();
  await page.getByLabel("Nome").fill("Spese C4.6");
  await page.getByLabel("Ambito").selectOption("expense");
  await page.getByRole("button", { name: "Salva categoria" }).click();
}

async function createTransaction(
  page: Page,
  description: string,
  kind: "income" | "expense",
  amount: string,
  date: string,
  classify = false,
) {
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  const kindSelect = page.locator('select[name="kind"]');
  if ((await kindSelect.count()) > 0) {
    await kindSelect.selectOption(kind);
  } else {
    await page.getByRole("radio", { name: kind === "income" ? "Entrata" : "Uscita" }).check();
  }
  await page
    .locator('select[name="account"]')
    .selectOption({ label: "Conto operativo C4.6 · EUR" });
  await page.getByLabel("Descrizione").fill(description);
  await page.getByRole("textbox", { name: "Controparte", exact: true }).fill("Controparte C4.6");
  await page.getByRole("textbox", { name: "Importo", exact: true }).fill(amount);
  await page.locator('input[name="bookedDate"]').last().fill(date);
  if (classify) {
    const category = page.locator('select[name="category"]');
    const categoryOption = category.locator("option").filter({ hasText: "Spese C4.6" });
    const categoryValue = await categoryOption.first().getAttribute("value");
    expect(categoryValue).not.toBeNull();
    await category.selectOption(categoryValue!);
  }
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento salvato");
}

async function createLoan(page: Page, remaining: string, original: string, dueDate: string) {
  await page.goto("/#loans");
  await page.getByLabel("Conto prestito").selectOption({ label: "Findomestic C4.6 · EUR" });
  await page.getByLabel("Finanziaria").fill("Findomestic C4.6");
  await page.getByLabel("Rata mensile").fill("172,00");
  await page.getByLabel("Capitale residuo").fill(remaining);
  await page.getByLabel("Capitale originario").fill(original);
  await page.getByLabel("Rate pagate").fill("29");
  await page.getByLabel("Rate rimanenti").fill("30");
  await page.getByLabel("Prossima scadenza").fill(dueDate);
  await page.getByLabel("TAN (%)").fill("5");
  await page.getByLabel("TAEG (%)").fill("5,5");
  await page.getByRole("button", { name: "Salva prestito" }).click();
  await expect(page.getByText("Progresso 50%")).toBeVisible();
}

async function createInvestment(page: Page, cost: string, value: string) {
  await page.goto("/#investments");
  await page.getByLabel("Conto investimento").selectOption({ label: "Directa C4.6 · EUR" });
  await page.getByLabel("Nome posizione").fill("ETF Nasdaq C4.6");
  await page.getByLabel("Ticker").fill("CSNDX");
  await page.getByLabel("Capitale investito").fill(cost);
  await page.getByLabel("Valore corrente").fill(value);
  await page.getByLabel("Data valutazione").fill("2026-09-05");
  await page.getByRole("button", { name: "Salva posizione" }).click();
  await expect(page.getByText(/ETF Nasdaq C4.6/)).toBeVisible();
}

async function updateLoan(page: Page) {
  await page.goto("/#loans");
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Capitale residuo").fill("4828,00");
  await page.getByLabel("Rate pagate").fill("30");
  await page.getByLabel("Rate rimanenti").fill("29");
  await page.getByLabel("Prossima scadenza").fill("2026-10-10");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText("Progresso 52%")).toBeVisible();
}

async function updateLoanOffline(page: Page) {
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Capitale residuo").fill("4828,00");
  await page.getByLabel("Rate pagate").fill("30");
  await page.getByLabel("Rate rimanenti").fill("29");
  await page.getByLabel("Prossima scadenza").fill("2026-10-10");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText("Progresso 52%")).toBeVisible();
}

async function createTransfer(page: Page) {
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  const kindSelect = page.locator('select[name="kind"]');
  if ((await kindSelect.count()) > 0) {
    await kindSelect.selectOption("transfer");
  } else {
    await page.getByRole("radio", { name: "Trasferimento", exact: true }).check();
  }
  await page.getByLabel("Conto origine").selectOption({ label: "Conto operativo C4.6 · EUR" });
  await page.getByLabel("Conto destinazione").selectOption({ label: "Directa C4.6 · EUR" });
  await page.getByRole("textbox", { name: "Importo" }).fill("60,00");
  await page.getByLabel("Descrizione").fill("Versamento Directa C4.6");
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Trasferimento salvato");
}

async function updateInvestment(page: Page) {
  await page.goto("/#investments");
  await page.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel("Capitale investito").fill("1060,00");
  await page.getByLabel("Valore corrente").fill("1200,00");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByText(/Rendimento 140,00/)).toBeVisible();
}

async function expectSummary(page: Page, available: string, value: string, gain: string) {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Riepilogo finanziario" })).toContainText(
    available,
  );
  await expect(page.getByRole("region", { name: "Debiti e investimenti" })).toContainText(value);
  await expect(page.getByRole("region", { name: "Debiti e investimenti" })).toContainText(gain);
}

async function expectNoOverflowAndA11y(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await page.locator("body").press("Tab");
  const focusState = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return { focused: false, visible: false };
    const rect = active.getBoundingClientRect();
    const style = getComputedStyle(active);
    return {
      focused: active !== document.body,
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden",
    };
  });
  expect(focusState).toEqual({ focused: true, visible: true });
  const buttonCount = await page.locator("button:visible").count();
  for (let index = 0; index < buttonCount; index += 1) {
    const box = await page.locator("button:visible").nth(index).boundingBox();
    if ((box?.width ?? 0) < 44 || (box?.height ?? 0) < 44) {
      const target = page.locator("button:visible").nth(index);
      const metrics = await target.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          width: style.width,
          minWidth: style.minWidth,
          transform: style.transform,
          className: element.className,
          parentClass: element.parentElement?.className,
        };
      });
      throw new Error(
        `Interactive target below 44px: ${await target.innerText()} (${box?.width}x${box?.height}); ${JSON.stringify(metrics)}`,
      );
    }
  }
  await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({ violations: [] });
}
