import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const transactionKindLabels = {
  income: "Entrata",
  expense: "Uscita",
  transfer: "Trasferimento",
} as const;

async function setTransactionKind(page: Page, kind: keyof typeof transactionKindLabels) {
  const kindSelect = page.locator('select[name="kind"]');
  if ((await kindSelect.count()) > 0) {
    await kindSelect.selectOption(kind);
    return;
  }
  await page.getByRole("radio", { name: transactionKindLabels[kind], exact: true }).check();
}

test("la lista bancaria dei movimenti mantiene gerarchia, menu e nessun overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#transactions");

  const list = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
  await expect(list).toBeVisible();
  await expect(list).toContainText("Esercente campione");
  await page.getByRole("button", { name: "Seleziona" }).click();
  await expect(list.getByRole("checkbox")).not.toHaveCount(0);

  const actions = list.getByRole("button", { name: "Azioni per Esercente campione" });
  await actions.focus();
  await actions.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Sposta nel cestino" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(actions).toBeFocused();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const filterDimensions = await page.locator(".transaction-filters").evaluate((form) => {
    const quickFilters = form.querySelector<HTMLElement>(".transaction-quick-filters");
    const buttons = [
      ...form.querySelectorAll<HTMLButtonElement>(".transaction-quick-filters button"),
    ];
    return {
      formOverflow: form.scrollWidth > form.clientWidth,
      quickOverflow: quickFilters === null || quickFilters.scrollWidth > quickFilters.clientWidth,
      buttonsFit: buttons.every((button) => button.scrollWidth <= button.clientWidth),
      hasHorizontalInset:
        quickFilters === null ||
        quickFilters.getBoundingClientRect().left >= form.getBoundingClientRect().left + 8,
    };
  });
  expect(filterDimensions).toEqual({
    formOverflow: false,
    quickOverflow: false,
    buttonsFit: true,
    hasHorizontalInset: true,
  });

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("la gestione movimenti registra e annulla un trasferimento senza overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await page.goto("/#transactions");
  await expect(page.getByRole("heading", { level: 1, name: "Movimenti" })).toBeVisible();

  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await setTransactionKind(page, "transfer");
  const accounts = page.getByLabel("Conto origine");
  const source = await accounts.inputValue();
  await page.getByLabel("Conto destinazione").selectOption({ index: 1 });
  await expect(page.getByLabel("Conto destinazione")).not.toHaveValue(source);
  await page.getByRole("textbox", { name: "Importo" }).fill("25,00");
  await page.getByLabel("Descrizione").fill("Riserva mensile");
  await page.getByRole("button", { name: "Salva movimento" }).click();

  await expect(page.getByRole("status")).toContainText("Trasferimento salvato");
  const list = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
  await expect(list).toContainText("Riserva mensile");
  const transferActions = list.getByRole("button", { name: "Azioni per Riserva mensile" });
  await transferActions.click();
  await page.getByRole("menuitem", { name: "Annulla" }).click();
  await expect(page.getByRole("status")).toContainText("Trasferimento annullato");
  await expect(list).toContainText("Annullato");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("i filtri movimenti sono combinabili e si possono azzerare", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#transactions");

  const list = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
  await page.getByLabel("Cerca nei movimenti").fill("Esercente campione");
  await expect(list).toContainText("Esercente campione");
  await page.getByRole("button", { name: "Uscite" }).click();
  await expect(
    list.locator(":scope > .transaction-date-group > ul > .transaction-list-row"),
  ).toHaveCount(1);

  await page.getByRole("button", { name: "Azzera filtri" }).click();
  await expect(page.getByLabel("Cerca nei movimenti")).toHaveValue("");
  await expect(list.getByRole("listitem")).not.toHaveCount(1);
});

test("su mobile i filtri sono un foglio accessibile e la ricerca si può cancellare", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#transactions");

  const search = page.getByRole("searchbox", { name: "Cerca nei movimenti" });
  const searchSpacing = await search.evaluate((input) => {
    const styles = getComputedStyle(input);
    return { margin: styles.margin, padding: styles.padding };
  });
  expect(searchSpacing).toEqual({ margin: "0px", padding: "0px" });
  await search.fill("Esercente");
  await page.getByRole("button", { name: "Cancella ricerca movimenti" }).click();
  await expect(search).toHaveValue("");

  const quickFilterBounds = await page.locator(".transaction-quick-filters").evaluate((group) => {
    const bounds = group.getBoundingClientRect();
    const buttons = [...group.querySelectorAll("button")];
    const rows = new Map<number, number[]>();
    for (const button of buttons) {
      const buttonBounds = button.getBoundingClientRect();
      const row = Math.round(buttonBounds.top);
      const current = rows.get(row) ?? [];
      current.push(buttonBounds.right);
      rows.set(row, current);
    }
    return {
      rightEdge: bounds.right,
      rowRightEdges: [...rows.values()].map((rightEdges) => Math.max(...rightEdges)),
    };
  });
  expect(
    quickFilterBounds.rowRightEdges.every(
      (rightEdge) => rightEdge >= quickFilterBounds.rightEdge - 1,
    ),
  ).toBe(true);

  const sortBorder = await page
    .locator(".transaction-filters > label:last-of-type select")
    .evaluate((select) => getComputedStyle(select).borderTopWidth);
  expect(sortBorder).toBe("1px");

  const filterTrigger = page.getByRole("button", { name: "Filtri" });
  await filterTrigger.click();
  const sheet = page.getByRole("dialog", { name: "Filtri movimenti" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Applica filtri" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(filterTrigger).toBeFocused();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("su mobile nuovo movimento apre il form a tutta larghezza con il conto visibile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();

  await expect(page).toHaveURL(/#new-transaction$/);
  await expect(page.getByRole("heading", { level: 1, name: "Nuovo movimento" })).toBeVisible();
  await expect(page.getByLabel("Conto")).toBeVisible();
  await expect(page.locator(".account-management-panel")).toBeHidden();

  const editor = page.locator(".account-editor-panel");
  const bounds = await editor.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds?.x).toBe(0);
  expect(bounds?.width).toBe(320);
});

test("il modulo movimenti espone righe split responsive", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByText("Altri dettagli").click();
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
  await page.getByText("Altri dettagli").click();
  await expect(page.getByText("Dettagli finanziari (facoltativi)")).toBeVisible();
  await page.getByText("Dettagli finanziari (facoltativi)").click();
  await page.getByLabel("Fissa").check();
  await page.getByRole("radio", { name: "Ordinario", exact: true }).check();
  await page.getByRole("textbox", { name: "Importo" }).fill("12,50");
  await page.getByRole("button", { name: "Salva movimento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento salvato");

  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await setTransactionKind(page, "transfer");
  await expect(page.getByText("Dettagli finanziari (facoltativi)")).toHaveCount(0);
});

test("un movimento nel cestino può essere ripristinato e purgato dalla gestione dati", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.goto("/#transactions");
  const list = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
  await list.getByRole("button", { name: "Azioni per Esercente campione" }).click();
  await page.getByRole("menuitem", { name: "Sposta nel cestino" }).click();
  await expect(page.getByRole("status")).toContainText("Movimento spostato nel cestino");

  await page.goto("/#settings");
  await expect(page.getByText("Esercente campione")).toBeVisible();
  await page.getByRole("button", { name: "Ripristina" }).click();
  await expect(page.getByText("Il cestino è vuoto.")).toBeVisible();

  await page.goto("/#transactions");
  const restoredList = page.getByRole("list", { name: "Movimenti registrati nel ledger" });
  await restoredList.getByRole("button", { name: "Azioni per Esercente campione" }).click();
  await page.getByRole("menuitem", { name: "Sposta nel cestino" }).click();
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

test("le impostazioni applicano il tema chiaro e scuro anche dopo il reload", async ({ page }) => {
  await page.goto("/#settings");
  const theme = page.getByLabel("Tema");

  await theme.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(16, 24, 39)");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto("/#settings");
  await page.getByLabel("Tema").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(246, 247, 251)");
});

test("le impostazioni applicano dimensione testo e riduzione animazioni", async ({ page }) => {
  await page.goto("/#settings");
  const textScale = page.getByLabel("Dimensione testo");
  const reduceMotion = page.getByLabel("Riduci animazioni");

  await textScale.selectOption("large");
  await expect(page.locator("html")).toHaveAttribute("data-text-scale", "large");
  await expect(page.locator("html")).toHaveCSS("font-size", "18px");

  await reduceMotion.check();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-scale", "large");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
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
  await expect(dialog).toHaveCSS("padding", "20px");
  await expect(dialog).toHaveCSS("gap", "16px");
  await expect(dialog).toHaveCSS("margin-left", "20px");
  await expect(dialog).toHaveCSS("margin-right", "20px");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("region", { name: "Gestione dati" })).toBeVisible();
  await expect(page.getByText(/non sono ancora configurabili/i)).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
