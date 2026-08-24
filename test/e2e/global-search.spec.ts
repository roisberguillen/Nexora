import { expect, test } from "@playwright/test";

test("la ricerca globale trova e apre dati locali su ogni superficie", async ({ page }) => {
  await page.goto("/#overview");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();

  const isMobile = (page.viewportSize()?.width ?? 0) <= 768;
  if (isMobile) {
    await page.getByRole("button", { name: "Apri ricerca globale" }).click();
  }
  const search = page.getByRole("searchbox", { name: "Ricerca globale" });
  if (isMobile) {
    await expect(search).toBeFocused();
  }
  await search.fill("Cinema campione");
  await expect(page.getByRole("option", { name: /Cinema campione/ })).toBeVisible();
  await page.getByRole("option", { name: /Cinema campione/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Movimenti" })).toBeVisible();
});

test("la ricerca globale gestisce no-results, clear ed Escape", async ({ page }) => {
  await page.goto("/#overview");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();

  const isMobile = (page.viewportSize()?.width ?? 0) <= 768;
  if (isMobile) {
    await page.getByRole("button", { name: "Apri ricerca globale" }).click();
  }
  const search = page.getByRole("searchbox", { name: "Ricerca globale" });
  await search.fill("nessun risultato Nexora");
  await expect(page.getByText("Nessun risultato locale.", { exact: true })).toBeVisible();
  const clear = page.getByRole("button", { name: "Cancella ricerca" }).last();
  const clearBox = await clear.boundingBox();
  expect(clearBox?.width).toBeGreaterThanOrEqual(44);
  expect(clearBox?.height).toBeGreaterThanOrEqual(44);
  await clear.click();
  await expect(search).toHaveValue("");
  if (isMobile) {
    const close = page.getByRole("button", { name: "Chiudi ricerca globale" });
    const closeBox = await close.boundingBox();
    expect(closeBox?.width).toBeGreaterThanOrEqual(44);
    expect(closeBox?.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Apri ricerca globale" })).toBeFocused();
  }
});

test("la ricerca globale supporta keyboard, touch target e resize live", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) !== 768, "Eseguito sul breakpoint tablet.");
  await page.goto("/#overview");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();

  const trigger = page.getByRole("button", { name: "Apri ricerca globale" });
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox?.width).toBeGreaterThanOrEqual(44);
  expect(triggerBox?.height).toBeGreaterThanOrEqual(44);
  await trigger.click();

  const search = page.getByRole("searchbox", { name: "Ricerca globale" });
  await search.click();
  await page.keyboard.type("Cinema campione");
  await page.getByRole("option", { name: /Cinema campione/ }).press("Enter");
  await expect(page).toHaveURL(/#transactions$/);

  await page.goto("/#overview");
  await page.getByRole("button", { name: "Apri ricerca globale" }).click();
  const liveSearch = page.getByRole("dialog", { name: "Ricerca globale" }).getByRole("searchbox", {
    name: "Ricerca globale",
  });
  await liveSearch.fill("Cinema campione");
  for (const width of [390, 320, 1440]) {
    await page.setViewportSize({ height: 900, width });
    await expect(liveSearch).toHaveValue("Cinema campione");
    await expect(page.getByRole("dialog", { name: "Ricerca globale" })).toBeVisible();
  }
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("la ricerca globale resta utilizzabile al 200%", async ({ page, browserName }) => {
  const width = page.viewportSize()?.width ?? 0;
  test.skip(browserName !== "chromium" || ![1024, 1440].includes(width), "Solo desktop 200%.");
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 2,
    height: 900,
    mobile: false,
    width: Math.floor(width / 2),
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Carica dati dimostrativi" }).click();
  await page.getByRole("button", { name: "Apri ricerca globale" }).click();
  const search = page.getByRole("searchbox", { name: "Ricerca globale" });
  await expect(search).toBeFocused();
  await search.fill("Cinema campione");
  await expect(page.getByRole("option", { name: /Cinema campione/ })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
