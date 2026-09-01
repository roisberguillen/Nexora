import { expect, test } from "@playwright/test";

test.describe("C3.19 Privacy/Security + App Lock", () => {
  test("protects the shell, routes and local secret across lock/unlock", async ({ page }) => {
    await page.goto("/#privacy-security");
    await expect(
      page.getByRole("heading", { level: 1, name: "Privacy e sicurezza" }),
    ).toBeVisible();

    await page.getByLabel("PIN o passphrase", { exact: true }).fill("4937");
    await page.getByLabel("Conferma PIN o passphrase").fill("4937");
    await page.getByRole("button", { name: "Attiva blocco" }).click();
    await expect(page.getByText(/Blocco attivo dopo/i)).toBeVisible();

    const storedLock = await page.evaluate(() => localStorage.getItem("nexora.app-lock.v1"));
    expect(storedLock).toBeTruthy();
    expect(storedLock).not.toContain("4937");

    await page.getByRole("button", { name: "Blocca ora" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Sblocca l’app" })).toBeVisible();
    await expect(page.getByRole("complementary")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Ricerca globale" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nuova operazione" })).toHaveCount(0);

    await page.goto("/#transactions");
    await expect(page.getByRole("heading", { level: 1, name: "Sblocca l’app" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Movimenti" })).toHaveCount(0);

    await page.getByLabel("PIN o passphrase").fill("4938");
    await page.getByRole("button", { name: "Sblocca Nexora" }).click();
    await expect(page.getByRole("alert")).toHaveText(/non corretti/i);
    await expect(page.getByRole("heading", { level: 1, name: "Sblocca l’app" })).toBeVisible();

    await page.getByLabel("PIN o passphrase", { exact: true }).fill("4937");
    await page.getByRole("button", { name: "Sblocca Nexora" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Movimenti" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Sblocca l’app" })).toBeVisible();
  }, 30_000);

  test("requires the current PIN before disabling the lock", async ({ page }) => {
    await page.goto("/#privacy-security");
    await page.getByLabel("PIN o passphrase", { exact: true }).fill("4937");
    await page.getByLabel("Conferma PIN o passphrase").fill("4937");
    await page.getByRole("button", { name: "Attiva blocco" }).click();
    await page.getByRole("button", { name: "Disattiva blocco" }).click();

    await page.getByLabel("PIN o passphrase attuali").fill("0000");
    await page.getByRole("button", { name: "Conferma disattivazione" }).click();
    await expect(page.getByRole("alert")).toHaveText(/non corretti/i);
    await expect(page.getByRole("button", { name: "Conferma disattivazione" })).toBeVisible();

    await page.getByLabel("PIN o passphrase attuali").fill("4937");
    await page.getByRole("button", { name: "Conferma disattivazione" }).click();
    await expect(page.getByRole("button", { name: "Attiva blocco" })).toBeVisible();
  }, 30_000);
});
