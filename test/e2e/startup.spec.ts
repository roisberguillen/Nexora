import { expect, test } from "@playwright/test";

test("l'avvio iniziale e il reload mostrano la shell senza errori runtime", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Carica dati dimostrativi" })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  if ((testInfo.project.use.viewport?.width ?? 0) <= 768) {
    await expect(page.getByRole("navigation", { name: "Navigazione mobile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Panoramica" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Panoramica" })).toBeVisible();
  }

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active !== undefined;
      }),
    )
    .toBe(true);

  await page.reload();

  await expect(page.getByRole("button", { name: "Carica dati dimostrativi" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
