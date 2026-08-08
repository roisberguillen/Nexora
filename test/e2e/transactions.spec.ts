import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("la gestione movimenti registra e annulla un trasferimento senza overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await page.goto("/#transactions");
  await expect(page.getByRole("heading", { name: "Gestisci i movimenti" })).toBeVisible();

  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByLabel("Tipo").selectOption("transfer");
  const accounts = page.getByLabel("Conto origine");
  const source = await accounts.inputValue();
  await page.getByLabel("Conto destinazione").selectOption({ index: 1 });
  await expect(page.getByLabel("Conto destinazione")).not.toHaveValue(source);
  await page.getByLabel("Importo").fill("25,00");
  await page.getByLabel("Descrizione").fill("Riserva mensile");
  await page.getByRole("button", { name: "Salva movimento" }).click();

  await expect(page.getByRole("status")).toContainText("Trasferimento salvato");
  const table = page.getByRole("table", { name: "Movimenti registrati nel ledger" });
  await expect(table).toContainText("Riserva mensile");
  await table
    .getByRole("row", { name: /Riserva mensile/ })
    .getByRole("button", { name: "Annulla" })
    .click();
  await expect(page.getByRole("status")).toContainText("Trasferimento annullato");
  await expect(table).toContainText("Annullato");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("il modulo movimenti espone righe split responsive", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByRole("button", { name: "Aggiungi ripartizione" }).click();
  await expect(page.getByLabel("Categoria split 1")).toBeVisible();
  await expect(page.getByLabel("Importo split 1")).toBeVisible();
  await page.getByRole("button", { name: "Rimuovi split 1" }).click();
  await expect(page.getByLabel("Categoria split 1")).toHaveCount(0);
});

test("una spesa può avere dettagli finanziari facoltativi senza classificare i trasferimenti", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await expect(page.getByText("Dettagli finanziari (facoltativi)")).toBeVisible();
  await page.getByText("Dettagli finanziari (facoltativi)").click();
  await page.getByLabel("Fissa").check();
  await page.getByRole("radio", { name: "Ordinario", exact: true }).check();
  await page.getByLabel("Importo").fill("12,50");
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento salvato");

  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByLabel("Tipo").selectOption("transfer");
  await expect(page.getByText("Dettagli finanziari (facoltativi)")).toHaveCount(0);
});

test("un movimento nel cestino può essere ripristinato e purgato dalla gestione dati", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#transactions");
  const table = page.getByRole("table", { name: "Movimenti registrati nel ledger" });
  const row = table.getByRole("row").filter({ hasText: "Esercente campione" });
  await row.getByRole("button", { name: "Cestina" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento spostato nel cestino");

  await page.goto("/#settings");
  await expect(page.getByText("Esercente campione")).toBeVisible();
  await page.getByRole("button", { name: "Ripristina" }).click();
  await expect(page.getByText("Il cestino è vuoto.")).toBeVisible();

  await page.goto("/#transactions");
  const restoredTable = page.getByRole("table", { name: "Movimenti registrati nel ledger" });
  const restoredRow = restoredTable.getByRole("row").filter({ hasText: "Esercente campione" });
  await restoredRow.getByRole("button", { name: "Cestina" }).click();
  await page.goto("/#settings");
  const purgeButton = page.getByRole("button", { name: "Elimina definitivamente" });
  await expect(purgeButton).toHaveCount(1);
  await purgeButton.click();
  const purgeDialog = page.getByRole("dialog", { name: "Eliminare definitivamente?" });
  await purgeDialog.getByRole("button", { name: "Elimina definitivamente" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento eliminato definitivamente.");
  await expect(page.getByText("Il cestino è vuoto.")).toBeVisible();
});

test("il reset finanziario richiede la frase esatta e svuota il ledger", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#settings");
  await page.getByRole("button", { name: "Reset dati finanziari" }).click();
  const dialog = page.getByRole("dialog", { name: "Conferma reset dati finanziari" });
  const confirm = dialog.getByRole("button", { name: "Conferma reset" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Frase di conferma reset").fill("RESETTA DATI FINANZIARI");
  await page.getByLabel("Procedi senza backup").check();
  await confirm.click();
  await page.goto("/#transactions");
  await expect(page.getByRole("heading", { name: "Nessun movimento registrato" })).toBeVisible();
});

test("il ripristino totale rimuove il profilo locale e riporta all'onboarding", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await page.goto("/#settings");
  await page.getByRole("button", { name: "Ripristino totale dell’app" }).click();
  const dialog = page.getByRole("dialog", { name: "Conferma ripristino totale" });
  const confirm = dialog.getByRole("button", { name: "Ripristina app" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Frase di conferma ripristino totale").fill("RIPRISTINA NEXORA");
  await confirm.click();
  await expect(page.getByRole("button", { name: "Carica dati dimostrativi" })).toBeVisible();
});

test("la gestione dati espone dialog accessibili con Escape e focus di ritorno", async ({
  page,
}) => {
  await page.goto("/#settings");
  const trigger = page.getByRole("button", { name: "Reset dati finanziari" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Conferma reset dati finanziari" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("region", { name: "Gestione dati" })).toBeVisible();
  await expect(page.getByText(/non sono ancora configurabili/i)).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
