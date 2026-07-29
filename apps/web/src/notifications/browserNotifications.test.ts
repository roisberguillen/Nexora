import { describe, expect, it } from "vitest";

import { enableBrowserNotifications } from "./browserNotifications";

describe("browser notifications", () => {
  it("non richiede mai permessi senza un'azione esplicita del chiamante", async () => {
    const requestPermission = async () => "granted" as const;
    await expect(
      enableBrowserNotifications({ permission: "default", requestPermission }),
    ).resolves.toBe("granted");
  });

  it("usa il centro interno se il browser non supporta o nega il permesso", async () => {
    await expect(enableBrowserNotifications(undefined)).resolves.toBe("unsupported");
    await expect(
      enableBrowserNotifications({ permission: "denied", requestPermission: async () => "denied" }),
    ).resolves.toBe("denied");
  });
});
