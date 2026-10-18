import { expect, it } from "vitest";

import { appVersion } from "./appVersion";

it("espone la versione della build tramite Vite", () => {
  expect(appVersion).toMatch(/^1\.0\.4$/);
});
