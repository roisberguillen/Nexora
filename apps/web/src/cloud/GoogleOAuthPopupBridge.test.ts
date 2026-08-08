import { describe, expect, it, vi } from "vitest";

import { BrowserGoogleOAuthPopupBridge } from "./GoogleOAuthPopupBridge";

describe("BrowserGoogleOAuthPopupBridge", () => {
  it("passes a token only through a nonce-bound ephemeral channel", async () => {
    const close = vi.fn();
    const callbacks: { messageHandler?: (event: MessageEvent<unknown>) => void } = {};
    const open = vi.fn(() => ({}) as Window);
    const bridge = new BrowserGoogleOAuthPopupBridge(
      {
        BroadcastChannel: class {
          public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
          public constructor() {
            callbacks.messageHandler = (event) => this.onmessage?.(event);
          }
          public close = close;
        },
        crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
        location: { origin: "http://127.0.0.1:5173" },
        open,
      },
      100,
    );

    const token = bridge.requestToken({
      clientId: "client.apps.googleusercontent.com",
      scope: "https://www.googleapis.com/auth/drive.appdata",
    });
    callbacks.messageHandler?.({
      data: {
        type: "nexora-google-oauth-result",
        nonce: "00000000-0000-4000-8000-000000000000",
        token: "token-sintetico",
      },
    } as MessageEvent);

    await expect(token).resolves.toBe("token-sintetico");
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("google-drive-oauth-bridge.html"),
      "nexora-google-oauth",
      expect.stringContaining("popup"),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("fails without opening a consent popup when BroadcastChannel is unavailable", async () => {
    const open = vi.fn();
    const bridge = new BrowserGoogleOAuthPopupBridge({
      crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
      location: { origin: "http://127.0.0.1:5173" },
      open,
    });

    await expect(
      bridge.requestToken({
        clientId: "client.apps.googleusercontent.com",
        scope: "https://www.googleapis.com/auth/drive.appdata",
      }),
    ).rejects.toThrow("google_identity_unavailable");
    expect(open).not.toHaveBeenCalled();
  });

  it("rejects a token received on a different nonce channel", async () => {
    const close = vi.fn();
    const callbacks: { messageHandler?: (event: MessageEvent<unknown>) => void } = {};
    const bridge = new BrowserGoogleOAuthPopupBridge(
      {
        BroadcastChannel: class {
          public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
          public constructor() {
            callbacks.messageHandler = (event) => this.onmessage?.(event);
          }
          public close = close;
        },
        crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
        location: { origin: "http://127.0.0.1:5173" },
        open: () => ({}) as Window,
      },
      10,
    );

    const token = bridge.requestToken({
      clientId: "client.apps.googleusercontent.com",
      scope: "https://www.googleapis.com/auth/drive.appdata",
    });
    callbacks.messageHandler?.({
      data: {
        type: "nexora-google-oauth-result",
        nonce: "another-nonce",
        token: "token-sintetico",
      },
    } as MessageEvent);

    await expect(token).rejects.toThrow("google_identity_timeout");
    expect(close).toHaveBeenCalledOnce();
  });
});
