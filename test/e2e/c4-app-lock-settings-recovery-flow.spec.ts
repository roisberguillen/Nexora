import { expect, test, type Page } from "@playwright/test";

const appLockPin = "4937";
const backupPassphrase = "Nexora-C4.10-Test-2026!";

test.describe("C4.10 App Lock, impostazioni, cestino e recovery", () => {
  test(
    "ricostruisce lo stato del ledger dopo lock, reset finanziario e restore",
    async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium-390" && testInfo.project.name !== "chromium-1440",
        "Il flusso completo viene eseguito sui viewport mobile e desktop rappresentativi.",
      );
      const runtimeErrors: string[] = [];
      observeRuntimeErrors(page, runtimeErrors);

      await page.goto("/");
      await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
      await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
      const initialFingerprint = await readLedgerFingerprint(page);
      expect(initialFingerprint).toContain("Conto quotidiano demo");
      expect(initialFingerprint).toContain("Trasferimento interno dimostrativo");

      await page.goto("/#backup");
      await page.getByLabel("Passphrase (minimo 12 caratteri)").fill(backupPassphrase);
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Scarica backup cifrato" }).click();
      const download = await downloadPromise;
      const archivePath = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(archivePath);
      await expect(page.getByRole("status")).toContainText("Backup verificato scaricato");

      await page.goto("/#settings");
      await page.getByLabel("Tema").selectOption("dark");
      await page.getByLabel("Dimensione testo").selectOption("large");
      await page.getByLabel("Riduci animazioni").check();
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.locator("html")).toHaveAttribute("data-text-scale", "large");
      await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");

      await page.goto("/#privacy-security");
      await page.getByLabel("PIN o passphrase", { exact: true }).fill(appLockPin);
      await page.getByLabel("Conferma PIN o passphrase").fill(appLockPin);
      await page.getByLabel("Blocca dopo inattività").selectOption("1");
      await page.getByRole("button", { name: "Attiva blocco" }).click();
      await expect(page.getByText(/Blocco attivo dopo 1 minuti/)).toBeVisible();
      await page.getByRole("button", { name: "Blocca ora" }).click();
      await expect(page.getByRole("heading", { name: "Sblocca l’app" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Movimenti" })).toHaveCount(0);
      await page.goto("/#settings");
      await expect(page.getByRole("heading", { name: "Sblocca l’app" })).toBeVisible();
      await page.getByLabel("PIN o passphrase").fill("4938");
      await page.getByRole("button", { name: "Sblocca Nexora" }).click();
      await expect(page.getByRole("alert")).toContainText("non corretti");
      await page.getByLabel("PIN o passphrase").fill(appLockPin);
      await page.getByRole("button", { name: "Sblocca Nexora" }).click();
      await expect(page.getByRole("heading", { name: "Impostazioni" })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Sblocca l’app" })).toBeVisible();
      await page.getByLabel("PIN o passphrase").fill(appLockPin);
      await page.getByRole("button", { name: "Sblocca Nexora" }).click();

      await page.goto("/#transactions");
      const transactionList = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
      await transactionList.getByRole("button", { name: "Azioni per Esercente campione" }).click();
      await page.getByRole("menuitem", { name: "Sposta nel cestino" }).click();
      await expect(page.getByRole("status")).toContainText("Movimento spostato nel cestino");
      await page.goto("/#settings");
      await expect(page.getByText("Esercente campione")).toBeVisible();
      await page.getByRole("button", { name: "Ripristina" }).click();
      await expect(page.getByText("Il cestino è vuoto.")).toBeVisible();
      expect(await readLedgerFingerprint(page)).toBe(initialFingerprint);

      await page.goto("/#settings");
      await page.getByRole("button", { name: "Reset dati finanziari" }).click();
      const cancelledReset = page.getByRole("dialog", { name: "Conferma reset dati finanziari" });
      await expect(cancelledReset).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(cancelledReset).toHaveCount(0);
      await page.getByRole("button", { name: "Reset dati finanziari" }).click();
      await page.getByLabel("Frase di conferma reset").fill("RESETTA DATI");
      await expect(page.getByRole("button", { name: "Conferma reset" })).toBeDisabled();
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Reset dati finanziari" }).click();
      const resetDialog = page.getByRole("dialog", { name: "Conferma reset dati finanziari" });
      await page.getByLabel("Passphrase backup reset").fill(backupPassphrase);
      await page.getByRole("button", { name: "Crea backup verificato" }).click();
      await expect(resetDialog.getByRole("status")).toContainText("Backup verificato pronto");
      await page.getByLabel("PIN reset finanziario").fill(appLockPin);
      await page.getByLabel("Frase di conferma reset").fill("RESETTA DATI FINANZIARI");
      await resetDialog.getByRole("button", { name: "Conferma reset" }).dblclick();
      await expect(page.getByRole("status")).toContainText("Dati finanziari resettati");
      await page.goto("/#accounts");
      await expect(page.getByRole("heading", { name: "Nessun conto registrato" })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Sblocca l’app" })).toBeVisible();
      await page.getByLabel("PIN o passphrase").fill(appLockPin);
      await page.getByRole("button", { name: "Sblocca Nexora" }).click();
      await expect(page.getByRole("heading", { name: "Nessun conto registrato" })).toBeVisible();

      await page.goto("/#backup");
      await page.getByLabel("File `.nexora-backup`").setInputFiles(archivePath);
      await page.getByLabel("Passphrase (minimo 12 caratteri)").fill(backupPassphrase);
      await page.getByRole("button", { name: "Verifica archivio senza ripristinare" }).click();
      await expect(page.getByRole("heading", { name: "Archivio verificato" })).toBeVisible();
      await page.getByRole("button", { name: "Ripristina archivio verificato" }).click();
      await page
        .getByRole("dialog", { name: "Confermare il ripristino?" })
        .getByRole("button", {
          name: "Conferma ripristino",
        })
        .click();
      await expect(page.getByRole("heading", { name: "Proteggi l’archivio locale" })).toBeVisible();
      await page.goto("/#accounts");
      await expect(page.getByRole("heading", { name: "Sblocca l’app" })).toBeVisible();
      await page.getByLabel("PIN o passphrase").fill(appLockPin);
      await page.getByRole("button", { name: "Sblocca Nexora" }).click();
      const accountTable = page.getByRole("table", {
        name: "Conti registrati con saldo, stato e azioni disponibili",
      });
      await expect(accountTable.getByText("Conto quotidiano demo", { exact: true })).toBeVisible();
      await expect(
        accountTable.getByRole("row", { name: /Riserva demo Banca campione/ }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Impostazioni" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Gestisci i tuoi conti" })).toBeVisible();
      await page.goto("/#transactions");
      await expect(
        page.getByRole("list", { name: "Movimenti registrati nel ledger" }),
      ).toContainText("Esercente campione");
      expect(await readLedgerFingerprint(page)).toBe(initialFingerprint);
      await page.goto("/#privacy-security");
      await expect(page.getByText(/Blocco attivo dopo/)).toBeVisible();
      await page.getByRole("button", { name: "Disattiva blocco" }).click();
      await page.getByLabel("PIN o passphrase attuali").fill(appLockPin);
      await page.getByRole("button", { name: "Conferma disattivazione" }).click();
      await expect(page.getByRole("button", { name: "Attiva blocco" })).toBeVisible();
      expect(runtimeErrors).toEqual([]);
    },
    60_000,
  );
});

async function readLedgerFingerprint(page: Page): Promise<string> {
  await page.goto("/#accounts");
  const accounts = await page
    .getByRole("table", { name: "Conti registrati con saldo, stato e azioni disponibili" })
    .innerText();
  await page.goto("/#transactions");
  const transactions = await page
    .getByRole("list", { name: "Movimenti registrati nel ledger" })
    .innerText();
  return `${accounts}\n${transactions}`;
}

function observeRuntimeErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
}
