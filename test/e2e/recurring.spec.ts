import { expect, test } from "@playwright/test";

test("le ricorrenze creano e modificano una proposta senza overflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();
  await page.goto("/#recurring");
  await expect(page.getByRole("heading", { name: "Ricorrenze" })).toBeVisible();
  const category = page.locator('select[name="categoryId"]');
  const incomeCategoryIds = await category
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => option.getAttribute("value")).filter(Boolean),
    );
  expect(incomeCategoryIds.length).toBeGreaterThan(0);
  await page.getByLabel("Tipo").selectOption("expense");
  const expenseCategoryIds = await category
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => option.getAttribute("value")).filter(Boolean),
    );
  expect(expenseCategoryIds).not.toEqual(incomeCategoryIds);
  await page.getByLabel("Tipo").selectOption("income");
  await expect
    .poll(() =>
      category
        .locator("option")
        .evaluateAll((options) =>
          options.map((option) => option.getAttribute("value")).filter(Boolean),
        ),
    )
    .toEqual(incomeCategoryIds);
  await page.getByLabel("Nome", { exact: true }).fill("Stipendio sintetico");
  await page.locator('select[name="accountId"]').selectOption({ label: "Conto quotidiano demo" });
  await page.locator('input[name="amount"]').fill("2500,00");
  await page.getByLabel("Prossima data prevista").fill("2026-08-28");
  await page.getByLabel("Policy weekend").selectOption("salary_italy");
  await page.getByRole("button", { name: "Salva ricorrenza" }).click();
  await expect(page.getByText("Stipendio sintetico")).toBeVisible();
  await page.getByRole("button", { name: "Modifica" }).click();
  await expect(page.getByLabel("Policy weekend")).toHaveValue("salary_italy");
  await expect(page.getByLabel("Prossima data prevista")).toHaveValue("2026-08-28");
  await page.locator('input[name="name"]').fill("Stipendio confermabile");
  await page.getByRole("button", { name: "Salva ricorrenza" }).click();
  await expect(page.getByText("Stipendio confermabile")).toBeVisible();
  await page.getByLabel("Nome piano").fill("Risparmio sintetico");
  await page.getByLabel("Conto origine").selectOption({ label: "Conto quotidiano demo" });
  await page.getByLabel("Conto destinazione").selectOption({ label: "Riserva demo" });
  await page.getByLabel("Importo").last().fill("170,00");
  await page.getByRole("button", { name: "Salva piano" }).click();
  const allocations = page.getByRole("region", { name: "Piani di allocazione" });
  await expect(allocations.getByText("Risparmio sintetico")).toHaveCount(1);
  await allocations
    .getByRole("listitem")
    .filter({ hasText: "Risparmio sintetico" })
    .getByRole("button", { name: "Modifica" })
    .click();
  await page.getByLabel("Nome piano").fill("Risparmio aggiornato");
  await page.getByRole("button", { name: "Aggiorna piano" }).click();
  await expect(allocations.getByText("Risparmio aggiornato")).toHaveCount(1);
  await allocations.getByRole("button", { name: "Metti in pausa" }).click();
  await expect(allocations.getByRole("button", { name: "Riattiva" })).toBeVisible();
  await allocations.getByRole("button", { name: "Riattiva" }).click();
  await page.getByLabel("Nome piano").fill("Fondo attrezzatura");
  await page.getByLabel("Evento").selectOption("photo_income");
  await page.getByLabel("Conto origine").selectOption({ label: "Conto quotidiano demo" });
  await page.getByLabel("Conto destinazione").selectOption({ label: "Riserva demo" });
  await page.getByLabel("Importo").last().fill("60,00");
  await page.getByRole("button", { name: "Salva piano" }).click();
  await page.getByRole("button", { name: "Conferma allocazioni reddito fotografico" }).click();
  const photoConfirmation = page.getByRole("dialog", {
    name: "Conferma allocazioni reddito fotografico",
  });
  await expect(photoConfirmation).toContainText("Reddito fotografico ricevuto");
  await photoConfirmation.getByRole("button", { name: "Annulla" }).click();
  await allocations
    .getByRole("listitem")
    .filter({ hasText: "Fondo attrezzatura" })
    .getByRole("button", { name: "Elimina…" })
    .click();
  const deleteAllocation = page.getByRole("dialog", { name: "Eliminare questo piano?" });
  await deleteAllocation.getByRole("button", { name: "Elimina piano" }).click();
  await expect(page.getByText("Piano eliminato.")).toBeVisible();
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Nuovo movimento" }).click();
  await page.getByLabel("Tipo").selectOption("income");
  await page
    .locator('select[name="account"]')
    .selectOption({ label: "Conto quotidiano demo · EUR" });
  await page.getByLabel("Importo").fill("2500,00");
  await page.getByLabel("Data operazione").fill("2026-08-28");
  await page.getByRole("button", { name: "Salva movimento" }).click();
  const confirmation = page.getByRole("dialog", { name: "Conferma allocazioni stipendio" });
  await expect(confirmation).toContainText("Stipendio ricevuto");
  await confirmation.getByRole("button", { name: "Esegui allocazioni" }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Allocazioni stipendio registrate");
  await page.goto("/#recurring");
  await page.getByLabel("Nome", { exact: true }).fill("Affitto sintetico");
  await page.getByLabel("Tipo").selectOption("expense");
  await page.locator('select[name="accountId"]').selectOption({ label: "Conto quotidiano demo" });
  await page.locator('input[name="amount"]').fill("850,00");
  await page.getByLabel("Prossima data prevista").fill("2026-08-28");
  await page.getByRole("button", { name: "Salva ricorrenza" }).click();
  await expect(page.getByText("Affitto sintetico")).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Stipendio confermabile" })
    .getByRole("button", { name: "Modifica" })
    .click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Stipendio confermabile");
  await page
    .getByRole("row")
    .filter({ hasText: "Affitto sintetico" })
    .getByRole("button", { name: "Modifica" })
    .click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Affitto sintetico");
  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("");
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
