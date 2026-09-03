import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const storagePreferenceKey = "nexora.ledger-storage.v1";
const profileName = "Profilo C4.1 sintetico";
const accountName = "Conto C4.1 sintetico";
const openingBalance = "123,45";

test.describe("C4.1 first start, profile, first account and reopen", () => {
  test("attraversa il primo utilizzo completo sul backend predefinito", async ({
    context,
    page,
  }) => {
    const consoleErrors: string[] = [];
    observeRuntimeErrors(page, consoleErrors);

    await runFirstUseFlow(page, context);

    await page.reload();
    await expectPersistedState(page);

    await page.close();
    const reopenedPage = await context.newPage();
    observeRuntimeErrors(reopenedPage, consoleErrors);
    await reopenedPage.goto("/");
    await expectPersistedState(reopenedPage);

    await activateServiceWorker(reopenedPage);
    await context.setOffline(true);
    try {
      await reopenedPage.reload({ waitUntil: "domcontentloaded" });
      await expectPersistedState(reopenedPage);
      await navigateToSurface(reopenedPage, "overview");
      await expect(
        reopenedPage.getByRole("heading", { name: "Panoramica finanziaria" }),
      ).toBeVisible();
      await expectNoOverflowAndA11y(reopenedPage);
      expect(await reopenedPage.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(
        true,
      );
    } finally {
      await context.setOffline(false);
    }

    expect(consoleErrors).toEqual([]);
  });

  test("ripete il flusso UI sul backend IndexedDB isolato", async ({ context, page }) => {
    await page.addInitScript(
      ({ key }) => {
        window.localStorage.setItem(key, "indexeddb");
      },
      { key: storagePreferenceKey },
    );

    await runFirstUseFlow(page, context);
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), storagePreferenceKey))
      .toBe("indexeddb");
    await expectPersistedState(page);
  });

  test("mantiene il percorso utilizzabile con zoom browser reale al 200%", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(!["chromium-1024", "chromium-1440"].includes(testInfo.project.name));
    const physicalWidth = testInfo.project.name === "chromium-1024" ? 1024 : 1440;
    const client = await context.newCDPSession(page);
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: physicalWidth / 2,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await runFirstUseFlow(page, context);
    await expectNoOverflowAndA11y(page);
  });

  test("mantiene il ledger intatto nei percorsi negativi del primo utilizzo", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Il ledger è pronto per i primi dati" }),
    ).toBeVisible();

    await navigateToSurface(page, "profile");
    await page.getByRole("button", { name: "Modifica profilo" }).click();
    await page.getByLabel("Nome visualizzato").fill("");
    await page.getByRole("button", { name: "Salva profilo" }).click();
    await expect(page.getByRole("status")).toContainText("Inserisci un nome visualizzato");
    await page.getByLabel("Nome visualizzato").fill("Nome annullato");
    await page.getByRole("button", { name: "Annulla" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nexora" })).toBeVisible();

    await navigateToSurface(page, "accounts");
    await page.getByRole("button", { name: "Nuovo conto" }).click();
    await page.getByRole("button", { name: "Annulla" }).click();
    await expect(page.getByRole("heading", { name: "Nessun conto registrato" })).toBeVisible();

    await page.getByRole("button", { name: "Nuovo conto" }).click();
    await page.getByLabel("Saldo iniziale").fill("1,234");
    await page.getByRole("button", { name: "Crea conto" }).click();
    await expect(page.getByRole("heading", { name: "Crea un conto" })).toBeVisible();
    await page.getByLabel("Nome conto").fill(accountName);
    await page.getByRole("button", { name: "Crea conto" }).click();
    await expect(page.getByRole("alert")).toContainText("accetta al massimo 2 decimali");
    await page.getByLabel("Saldo iniziale").fill("non valido");
    await page.getByRole("button", { name: "Crea conto" }).click();
    await expect(page.getByRole("alert")).toContainText("solo cifre");
    await page.getByLabel("Saldo iniziale").fill(openingBalance);
    await page.getByRole("button", { name: "Crea conto" }).dblclick();
    await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
    await expect(page.getByRole("row", { name: new RegExp(accountName) })).toHaveCount(1);

    const storageUnavailable = await page.evaluate(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("blocked profile storage");
        },
      });
      return true;
    });
    expect(storageUnavailable).toBe(true);
    await navigateToSurface(page, "profile");
    await page.getByRole("button", { name: "Modifica profilo" }).click();
    await page.getByLabel("Nome visualizzato").fill("Profilo non persistibile");
    await page.getByRole("button", { name: "Salva profilo" }).click();
    await expect(page.getByRole("status")).toContainText("Inserisci un nome visualizzato");
    await expect(page.getByRole("heading", { name: "Panoramica finanziaria" })).toHaveCount(0);
  });
});

async function runFirstUseFlow(page: Page, context: BrowserContext): Promise<void> {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Il ledger è pronto per i primi dati" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Carica dati dimostrativi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toHaveCount(0);

  await navigateToSurface(page, "profile");
  await expect(page.getByRole("heading", { name: "Dati del profilo" })).toBeVisible();
  await page.getByRole("button", { name: "Modifica profilo" }).click();
  await page.getByLabel("Nome visualizzato").fill(profileName);
  await page.getByRole("button", { name: "Salva profilo" }).click();
  await expect(page.getByRole("status")).toHaveText("Profilo salvato nei dati locali.");

  await navigateToSurface(page, "accounts");
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill(accountName);
  await page.getByLabel("Tipo").selectOption("checking");
  await page.getByLabel("Valuta").fill("EUR");
  await page.getByLabel("Saldo iniziale").fill(openingBalance);
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
  await expect(page.getByRole("row", { name: new RegExp(accountName) })).toContainText("123,45");

  await navigateToSurface(page, "overview");
  await expect(page.getByRole("heading", { name: "Panoramica finanziaria" })).toBeVisible();
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText("123,45");
  await expect(page.getByRole("complementary", { name: "Conti" })).toContainText(accountName);

  await navigateToSurface(page, "transactions");
  await expect(page.getByRole("heading", { name: "Nessun movimento registrato" })).toBeVisible();
  await expectNoOverflowAndA11y(page);
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), storagePreferenceKey))
    .toMatch(/^(opfs|indexeddb)$/);
  await expect(context.pages()).toHaveLength(1);
}

async function expectPersistedState(page: Page): Promise<void> {
  await navigateToSurface(page, "profile");
  await expect(page.getByRole("heading", { name: profileName })).toBeVisible();
  await navigateToSurface(page, "accounts");
  await expect(page.getByRole("row", { name: new RegExp(accountName) })).toContainText("123,45");
  await navigateToSurface(page, "overview");
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText("123,45");
  await navigateToSurface(page, "transactions");
  await expect(page.getByRole("heading", { name: "Nessun movimento registrato" })).toBeVisible();
}

async function activateServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function navigateToSurface(
  page: Page,
  surface: "accounts" | "overview" | "profile" | "transactions",
): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  const labels = {
    accounts: "Conti",
    overview: width <= 768 ? "Home" : "Panoramica",
    profile: "Profilo",
    transactions: "Movimenti",
  } as const;
  if (width <= 768) {
    if (surface === "profile") {
      await page.getByRole("link", { name: "Apri profilo" }).click();
      return;
    }
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
  expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
}

function observeRuntimeErrors(page: Page, errors: string[]): void {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
}
