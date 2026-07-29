import { expect, test } from "@playwright/test";

test("due schede aprono il ledger senza recovery concorrente", async ({ context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440", "Eseguito una volta sul backend reale.");

  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto("/"), second.goto("/")]);

  for (const page of [first, second]) {
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
