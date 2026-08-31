import { expect, test } from "@playwright/test";

test("analytics, journal and notifications use the persisted ledger without responsive overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await expect(page.getByRole("heading", { name: "Movimenti recenti" })).toBeVisible();

  await page.goto("/#analytics");
  await expect(page.getByRole("heading", { name: "Analisi", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Come è andato/ })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Andamento mensile di entrate, spese e risparmio" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dove hai speso" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cosa è cambiato" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mese successivo" })).toBeVisible();
  await page.locator(".analytics-period-selector button").first().click();
  await expect(page.locator(".analytics-period-selector span")).toHaveText(/2026/);
  await page.getByRole("button", { name: "3 mesi" }).click();
  await expect(page.getByRole("button", { name: "3 mesi" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goto("/#journal");
  await expect(page.getByRole("heading", { name: "Diario", exact: true })).toBeVisible();
  await page.getByLabel("Come è andato il mese?").fill("Riflessione E2E sintetica");
  await page.getByLabel("Percezione di controllo").selectOption("4");
  await page.getByRole("button", { name: "Salva diario" }).click();
  await expect(page.getByRole("status")).toContainText("Diario mensile salvato");

  await page.goto("/#notifications");
  await expect(page.getByRole("heading", { name: "Notifiche", exact: true })).toBeVisible();
  await page.getByLabel("Soglia saldo basso (EUR)").fill("25,00");
  await page.getByRole("button", { name: "Salva soglia" }).click();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
