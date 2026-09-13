import { describe, expect, it, vi } from "vitest";

import { installPhoneLocalHubForegroundGuard } from "./phoneLocalHubForeground";

function createDocumentStub() {
  let state: DocumentVisibilityState = "visible";
  let handler: (() => void) | undefined;
  return {
    get visibilityState() {
      return state;
    },
    addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
      handler = listener as () => void;
    }),
    removeEventListener: vi.fn(),
    emit() {
      handler?.();
    },
    set state(value: DocumentVisibilityState) {
      state = value;
    },
  } as unknown as Document & { emit(): void; state: DocumentVisibilityState };
}

describe("phone Local Hub foreground guard", () => {
  it("stops the phone host when Android becomes hidden", async () => {
    const documentStub = createDocumentStub();
    const stopHost = vi.fn().mockResolvedValue(undefined);
    const cleanup = installPhoneLocalHubForegroundGuard(documentStub, () => true, stopHost);

    documentStub.state = "hidden";
    documentStub.emit();
    await Promise.resolve();

    expect(stopHost).toHaveBeenCalledOnce();
    cleanup();
    expect(documentStub.removeEventListener).toHaveBeenCalledOnce();
  });

  it("does not register outside Android or while visible", () => {
    const documentStub = createDocumentStub();
    const stopHost = vi.fn().mockResolvedValue(undefined);
    installPhoneLocalHubForegroundGuard(documentStub, () => false, stopHost);
    expect(documentStub.addEventListener).not.toHaveBeenCalled();

    const cleanup = installPhoneLocalHubForegroundGuard(documentStub, () => true, stopHost);
    documentStub.emit();
    expect(stopHost).not.toHaveBeenCalled();
    cleanup();
  });
});
