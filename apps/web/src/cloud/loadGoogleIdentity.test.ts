import { describe, expect, it, vi } from "vitest";

import { loadGoogleIdentity } from "./loadGoogleIdentity";

describe("loadGoogleIdentity", () => {
  it("non considera pronto un oggetto google incompleto", () => {
    vi.stubGlobal("google", {});
    const append = vi.spyOn(document.head, "append").mockImplementation((node) => {
      if (node instanceof Node)
        queueMicrotask(() => {
          node.dispatchEvent(new Event("load"));
          queueMicrotask(() => vi.stubGlobal("google", { accounts: { oauth2: {} } }));
        });
    });

    const loading = loadGoogleIdentity();

    expect(append).toHaveBeenCalledWith(expect.any(HTMLScriptElement));
    return expect(loading).resolves.toBeUndefined();
  });

  it("non carica un secondo script quando OAuth è già disponibile", async () => {
    vi.stubGlobal("google", { accounts: { oauth2: {} } });
    const append = vi.spyOn(document.head, "append");

    await expect(loadGoogleIdentity()).resolves.toBeUndefined();
    expect(append).not.toHaveBeenCalled();
  });

  it("attende la disponibilità OAuth anche dopo l'evento load", async () => {
    vi.stubGlobal("google", undefined);
    const append = vi.spyOn(document.head, "append").mockImplementation((node) => {
      if (node instanceof Node)
        queueMicrotask(() => {
          node.dispatchEvent(new Event("load"));
          queueMicrotask(() => vi.stubGlobal("google", { accounts: { oauth2: {} } }));
        });
    });

    await expect(loadGoogleIdentity()).resolves.toBeUndefined();
    expect(append).toHaveBeenCalledWith(expect.any(HTMLScriptElement));
  });
});
