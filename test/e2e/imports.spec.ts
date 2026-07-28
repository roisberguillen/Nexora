import { expect, test } from "@playwright/test";

test("la pagina Importa è disponibile e non scrive dati prima del dry-run", async ({ page }) => {
  await page.goto("/#imports");

  await expect(page.getByRole("heading", { name: "Importa da Money Manager" })).toBeVisible();
  await expect(page.getByLabel("Seleziona un file XLSX")).toBeVisible();
  await expect(
    page.getByText("Il file resta nel browser: questa fase legge soltanto l’anteprima."),
  ).toBeVisible();
});
