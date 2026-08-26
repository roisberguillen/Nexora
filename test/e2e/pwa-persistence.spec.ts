import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const storagePreferenceKey = "nexora.ledger-storage.v1";

test("SQLite/OPFS mantiene il seed dopo riapertura offline", async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440");

  await page.goto("/");
  await expectReadyLedger(page);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storagePreferenceKey))
    .toBe("opfs");

  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expectSeedCounts(page, "5.133,60");
  await createPersistedAccount(page);
  await activateServiceWorker(page);

  await page.reload();
  await expectReadyLedger(page);
  await expectSeedCounts(page, "5.233,60");

  await verifyOfflineReopen(context, page, "5.233,60");
});

test("IndexedDB già selezionato resta stabile e disponibile offline", async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440");

  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: storagePreferenceKey,
    value: "indexeddb",
  });
  await page.goto("/");
  await expectReadyLedger(page);
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), storagePreferenceKey))
    .toBe("indexeddb");

  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expectSeedCounts(page, "5.133,60");
  await createPersistedAccount(page);
  await activateServiceWorker(page);

  await verifyOfflineReopen(context, page, "5.233,60");
});

async function expectReadyLedger(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible();
}

async function expectSeedCounts(page: Page, netWorth: string): Promise<void> {
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await expect(page.getByLabel("Riepilogo finanziario")).toContainText(
    `Disponibilità attuale${netWorth} €`,
  );
  const accounts = page.getByRole("complementary", { name: "Conti" });
  await expect(accounts).toContainText("Conto quotidiano demo");
  await expect(accounts).toContainText("3.747,10 €");
}

async function createPersistedAccount(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Conti" }).click();
  await expect(page.getByRole("heading", { name: "Gestisci i tuoi conti" })).toBeVisible();
  await page.getByRole("button", { name: "Nuovo conto" }).click();
  await page.getByLabel("Nome conto").fill("Portafoglio offline demo");
  await page.getByLabel("Tipo").selectOption("cash");
  await page.getByLabel("Saldo iniziale").fill("100,00");
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
  await page.getByRole("link", { name: "Panoramica" }).click();
  await expectSeedCounts(page, "5.233,60");
  await expect(page.getByRole("complementary", { name: "Conti" })).toContainText(
    "Portafoglio offline demo",
  );
}

async function activateServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function verifyOfflineReopen(
  context: BrowserContext,
  page: Page,
  netWorth: string,
): Promise<void> {
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expectReadyLedger(page);
    await expectSeedCounts(page, netWorth);
    await expect(page.getByRole("complementary", { name: "Conti" })).toContainText(
      "Portafoglio offline demo",
    );
    const networkIsUnavailable = await page.evaluate(async () => {
      try {
        await fetch(`/persistence-network-probe-${Date.now()}`, { cache: "no-store" });
        return false;
      } catch {
        return true;
      }
    });
    expect(networkIsUnavailable).toBe(true);
    expect(
      await page.evaluate(() => ({
        crossOriginIsolated: globalThis.crossOriginIsolated,
        serviceWorkerControlled: navigator.serviceWorker.controller !== null,
      })),
    ).toEqual({
      crossOriginIsolated: true,
      serviceWorkerControlled: true,
    });
  } finally {
    await context.setOffline(false);
  }
}
