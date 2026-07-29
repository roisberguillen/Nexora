import { expect, test } from "@playwright/test";

test("la PWA riapre cinquanta volte senza restare in caricamento", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440", "Eseguito una volta sul backend reale.");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible({
    timeout: 15_000,
  });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Il tuo quadro finanziario" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", {
        name: "Nexora non riesce ad aprire i tuoi dati in questo momento.",
      }),
    ).toHaveCount(0);
  }
});
