import { describe, expect, it } from "vitest";
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
});
