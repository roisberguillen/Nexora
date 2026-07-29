import { expect, it } from "vitest";

import { appVersion } from "./appVersion";

it("espone la versione della build tramite Vite", () => {
  expect(appVersion).toMatch(/^0\.5\.0-rc\.1$/);
});
