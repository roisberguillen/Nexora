import { describe, expect, it, vi } from "vitest";
import { GoogleIdentityAuth } from "./GoogleIdentityAuth";

describe("GoogleIdentityAuth", () => {
  it("keeps the token in memory after consent", async () => {
    const auth = new GoogleIdentityAuth("client", {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: ({
              callback,
            }: {
              callback: (response: { access_token?: string }) => void;
            }) => ({ requestAccessToken: () => callback({ access_token: "token" }) }),
            revoke: (_token: string, done: () => void) => done(),
          },
        },
      },
    } as unknown as Window);
    await auth.connect();
    expect(auth.getStatus()).toBe("connected");
    expect(auth.getAccessToken()).toBe("token");
    await auth.disconnect();
    expect(auth.getAccessToken()).toBeUndefined();
  });
  it("fails closed when GIS is unavailable", async () => {
    const auth = new GoogleIdentityAuth("client", {} as Window);
    await expect(auth.connect()).rejects.toThrow("google_identity_unavailable");
    expect(auth.getStatus()).toBe("error");
  });
  it("non conserva token quando l'utente nega il consenso", async () => {
    const auth = new GoogleIdentityAuth("client", {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: ({
              callback,
            }: {
              callback: (response: { error?: string }) => void;
            }) => ({ requestAccessToken: () => callback({ error: "access_denied" }) }),
            revoke: (_token: string, done: () => void) => done(),
          },
        },
      },
    } as unknown as Window);

    await expect(auth.connect()).rejects.toThrow("access_denied");
    expect(auth.getAccessToken()).toBeUndefined();
    expect(auth.getStatus()).toBe("error");
  });
  it("deduplica richieste di consenso concorrenti", async () => {
    let callback: ((response: { access_token?: string }) => void) | undefined;
    const requestAccessToken = vi.fn();
    const auth = new GoogleIdentityAuth("client", {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: (input: {
              callback: (response: { access_token?: string }) => void;
            }) => {
              callback = input.callback;
              return { requestAccessToken };
            },
            revoke: (_token: string, done: () => void) => done(),
          },
        },
      },
    } as unknown as Window);

    const first = auth.connect();
    const second = auth.connect();
    expect(requestAccessToken).toHaveBeenCalledOnce();
    callback?.({ access_token: "token" });
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  });
  it("fallisce chiuso se Google Identity non completa il consenso", async () => {
    vi.useFakeTimers();
    const auth = new GoogleIdentityAuth(
      "client",
      {
        google: {
          accounts: {
            oauth2: {
              initTokenClient: () => ({ requestAccessToken: () => undefined }),
              revoke: (_token: string, done: () => void) => done(),
            },
          },
        },
      } as unknown as Window,
      { authorizationTimeoutMs: 100 },
    );

    const connection = auth.connect();
    await vi.advanceTimersByTimeAsync(100);
    await expect(connection).rejects.toThrow("google_identity_timeout");
    expect(auth.getAccessToken()).toBeUndefined();
    expect(auth.getStatus()).toBe("error");
    vi.useRealTimers();
  });
});
