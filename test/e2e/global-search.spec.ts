import { expect, test } from "@playwright/test";

test("la ricerca globale trova e apre dati locali", async ({ page }) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 900,
    "Su mobile la ricerca è contestuale alla pagina Movimenti.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();

  const search = page.getByRole("searchbox", { name: "Ricerca globale" });
  await search.fill("Cinema campione");
  await expect(page.getByRole("link", { name: /Cinema campione/ })).toBeVisible();
  await page.getByRole("link", { name: /Cinema campione/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Movimenti" })).toBeVisible();
});
