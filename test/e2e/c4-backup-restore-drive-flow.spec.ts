import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const passphrase = "Nexora-C4.9-Test-2026!";
const storageKey = "nexora.ledger-storage.v1";

test.describe("C4.9 backup, restore, rollback e Drive opzionale", () => {
  test("completa il percorso A → B → A con archivio cifrato e ricevuta read-only", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-1440",
      "Il round-trip cifrato UI viene eseguito una volta; la copertura responsive è separata.",
    );
    const errors: string[] = [];
    observeRuntimeErrors(page, errors);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Il ledger è pronto per i primi dati" }),
    ).toBeVisible();
    await createAccount(page, "Operativo C4.9", "checking", "1000,00");
    await createAccount(page, "Riserva C4.9", "savings", "100,00");
    await createCategory(page);
    await page.goto("/#transactions");
    await createTransaction(page, "income", "Entrata C4.9", "500,00");
    await createTransaction(page, "expense", "Spesa C4.9", "120,00", true);
    await createTransfer(page, "Trasferimento C4.9", "200,00");
    await expectAccount(page, "Operativo C4.9", "1.180,00");
    await expectAccount(page, "Riserva C4.9", "300,00");
    await page.goto("/#transactions");
    await expect(page.getByRole("list", { name: "Movimenti registrati nel ledger" })).toContainText(
      "Trasferimento C4.9",
    );
    await page.goto("/#overview");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("1.480,00");

    await page.goto("/#backup");
    const phrase = page.getByLabel("Passphrase (minimo 12 caratteri)");
    await phrase.fill("breve");
    await expect(page.getByRole("button", { name: "Scarica backup cifrato" })).toBeDisabled();
    await phrase.fill(passphrase);
    const firstDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Scarica backup cifrato" }).dblclick();
    const download = await firstDownload;
    const archivePath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(archivePath);
    await expect(page.getByRole("status")).toContainText("Backup verificato scaricato");
    expect(download.suggestedFilename()).toMatch(/^nexora-portable-[A-Za-z0-9-]+\.nexora-backup$/);
    expect(download.suggestedFilename()).not.toMatch(/Operativo|Riserva|180|300|Nexora-C4\.9/);
    const archiveBytes = readFileSync(archivePath);
    expect(archiveBytes.byteLength).toBeGreaterThan(0);
    expect(archiveBytes.toString("utf8")).not.toContain("Operativo C4.9");

    await page.goto("/#transactions");
    await createTransaction(page, "expense", "Spesa B C4.9", "80,00");
    await page.goto("/#accounts");
    await expectAccount(page, "Operativo C4.9", "1.100,00");
    await createAccount(page, "Temporaneo C4.9", "cash", "50,00");
    await expectAccount(page, "Temporaneo C4.9", "50,00");

    await page.goto("/#backup");
    await phrase.fill("passphrase-errata");
    await page.getByLabel("File `.nexora-backup`").setInputFiles(archivePath);
    await page.getByRole("button", { name: "Verifica archivio senza ripristinare" }).click();
    await expect(page.getByRole("alert")).toContainText("Verifica non riuscita");
    await expect(
      page.getByRole("button", { name: "Ripristina archivio verificato" }),
    ).toBeDisabled();
    await expectAccount(page, "Operativo C4.9", "1.100,00");

    await page.goto("/#backup");
    await page.getByLabel("File `.nexora-backup`").setInputFiles(archivePath);
    await phrase.fill(passphrase);
    await page.getByRole("button", { name: "Verifica archivio senza ripristinare" }).click();
    await expect(page.getByRole("heading", { name: "Archivio verificato" })).toBeVisible();
    await expect(page.getByText(/2 conti · 4 movimenti/)).toBeVisible();
    await expect(page.getByText(/Contenuto/)).toBeVisible();
    await expectAccount(page, "Temporaneo C4.9", "50,00");

    await page.goto("/#backup");
    await page.getByLabel("File `.nexora-backup`").setInputFiles(archivePath);
    await phrase.fill("altra-passphrase-sicura");
    await expect(page.getByRole("heading", { name: "Archivio verificato" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Ripristina archivio verificato" }),
    ).toBeDisabled();
    await phrase.fill(passphrase);
    await page.getByRole("button", { name: "Verifica archivio senza ripristinare" }).click();
    await page.getByRole("button", { name: "Ripristina archivio verificato" }).click();
    const dialog = page.getByRole("dialog", { name: "Confermare il ripristino?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("checkpoint");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Ripristina archivio verificato" }).click();
    await page
      .getByRole("dialog", { name: "Confermare il ripristino?" })
      .getByRole("button", { name: "Annulla" })
      .click();
    await expectAccount(page, "Operativo C4.9", "1.100,00");
    await page.goto("/#backup");
    await page.getByLabel("File `.nexora-backup`").setInputFiles(archivePath);
    await phrase.fill(passphrase);
    await page.getByRole("button", { name: "Verifica archivio senza ripristinare" }).click();
    await expect(page.getByRole("heading", { name: "Archivio verificato" })).toBeVisible();
    await page.getByRole("button", { name: "Ripristina archivio verificato" }).click();
    await page
      .getByRole("dialog", { name: "Confermare il ripristino?" })
      .getByRole("button", { name: "Conferma ripristino" })
      .dblclick();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: "Proteggi l’archivio locale" })).toBeVisible();
    await page.goto("/#accounts");
    await expectAccount(page, "Operativo C4.9", "1.180,00");
    await expectAccount(page, "Riserva C4.9", "300,00");
    await expect(page.getByRole("row", { name: /Temporaneo C4\.9/ })).toHaveCount(0);
    await page.goto("/#overview");
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("1.480,00");
    await page.reload();
    await expect(page.getByLabel("Riepilogo finanziario")).toContainText("1.480,00");
    await page.close();
    const reopened = await context.newPage();
    observeRuntimeErrors(reopened, errors);
    await reopened.goto("/#backup");
    await expect(reopened.getByRole("heading", { name: "Cronologia backup" })).toBeVisible();
    await expectNoOverflowAndA11y(reopened);
    expect(errors).toEqual([]);
  });

  test("mantiene il backup locale disponibile offline su IndexedDB", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-1440");
    await page.addInitScript(({ key }) => window.localStorage.setItem(key, "indexeddb"), {
      key: storageKey,
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Il ledger è pronto per i primi dati" }),
    ).toBeVisible();
    await createAccount(page, "Offline C4.9", "checking", "1000,00");
    await page.goto("/#backup");
    await expect(page.getByRole("heading", { name: "Proteggi l’archivio locale" })).toBeVisible();
    await page.getByLabel("Passphrase (minimo 12 caratteri)").fill(passphrase);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Scarica backup cifrato" }).click();
    const download = await downloadPromise;
    const archivePath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(archivePath);
    await page.goto("/#transactions");
    await createTransaction(
      page,
      "expense",
      "Modifica offline C4.9",
      "100,00",
      false,
      "Offline C4.9",
    );
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    try {
      await page.goto("/#backup");
      await expect(page.getByRole("heading", { name: "Proteggi l’archivio locale" })).toBeVisible();
      await page.getByLabel("Passphrase (minimo 12 caratteri)").fill(passphrase);
      await page.getByLabel("File `.nexora-backup`").setInputFiles(archivePath);
      await page.getByRole("button", { name: "Verifica archivio senza ripristinare" }).click();
      await expect(page.getByRole("heading", { name: "Archivio verificato" })).toBeVisible();
      await page.getByRole("button", { name: "Ripristina archivio verificato" }).click();
      await page
        .getByRole("dialog", { name: "Confermare il ripristino?" })
        .getByRole("button", { name: "Conferma ripristino" })
        .click();
      await page.waitForLoadState("domcontentloaded");
      await page.goto("/#accounts");
      await expectAccount(page, "Offline C4.9", "1.000,00");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectAccount(page, "Offline C4.9", "1.000,00");
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
  await page.getByLabel("Valuta").fill("EUR");
  await page.getByLabel("Saldo iniziale").fill(balance);
  await page.getByRole("button", { name: "Crea conto" }).click();
  await expect(page.getByRole("status")).toContainText("Conto creato e salvato");
}

async function createCategory(page: Page) {
  await page.goto("/#categories");
  await page.getByLabel("Nome").fill("Spese C4.9");
  await page.getByLabel("Ambito").selectOption("expense");
  await page.getByRole("button", { name: "Salva categoria" }).click();
}

async function createTransaction(
  page: Page,
  kind: "income" | "expense",
  description: string,
  amount: string,
  category = false,
  accountName = "Operativo C4.9",
) {
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  const kindSelect = page.locator('select[name="kind"]');
  if ((await kindSelect.count()) > 0) await kindSelect.selectOption(kind);
  else
    await page
      .getByRole("radio", { name: kind === "income" ? "Entrata" : "Uscita", exact: true })
      .check();
  await page.getByRole("textbox", { name: "Importo" }).fill(amount);
  await page.locator('select[name="account"]').selectOption({ label: `${accountName} · EUR` });
  if (category) await page.locator('select[name="category"]').selectOption({ label: "Spese C4.9" });
  await page.getByLabel("Data").fill("2026-09-02");
  await page.getByLabel("Descrizione").fill(description);
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento salvato");
}

async function createTransfer(page: Page, description: string, amount: string) {
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  const kindSelect = page.locator('select[name="kind"]');
  if ((await kindSelect.count()) > 0) await kindSelect.selectOption("transfer");
  else await page.getByRole("radio", { name: "Trasferimento", exact: true }).check();
  await page.locator('select[name="account"]').selectOption({ label: "Operativo C4.9 · EUR" });
  await page.locator('select[name="destination"]').selectOption({ label: "Riserva C4.9 · EUR" });
  await page.getByRole("textbox", { name: "Importo" }).fill(amount);
  await page.getByLabel("Data operazione").fill("2026-09-03");
  await page.getByLabel("Descrizione").fill(description);
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.locator('p.account-feedback[role="status"]')).toContainText(
    "Trasferimento salvato",
  );
}

async function expectAccount(page: Page, name: string, balance: string) {
  await page.goto("/#accounts");
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText(balance);
}

async function expectNoOverflowAndA11y(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}

function observeRuntimeErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
}
