import { expect, test } from "@playwright/test";

test("cinque schede aprono il ledger senza recovery concorrente", async ({ context }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440", "Eseguito una volta sul backend reale.");

  const pages = await Promise.all(Array.from({ length: 5 }, () => context.newPage()));
  await Promise.all(pages.map((page) => page.goto("/")));

  for (const page of pages) {
    await expect(
      page.getByRole("heading", { level: 1, name: "Panoramica finanziaria" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", {
        name: "Nexora non riesce ad aprire i tuoi dati in questo momento.",
      }),
    ).toHaveCount(0);
  }
});
