import { describe, expect, it } from "vitest";
import { readGoogleCloudConfig } from "./cloudConfig";

describe("readGoogleCloudConfig", () => {
  it("disabilita Drive senza client id o flag esplicito", () => {
    expect(readGoogleCloudConfig({ VITE_GOOGLE_DRIVE_ENABLED: "true" })).toEqual({
      clientId: "",
      enabled: false,
    });
  });
  it("abilita Drive solo con configurazione pubblica completa", () => {
    expect(
      readGoogleCloudConfig({
        VITE_GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
        VITE_GOOGLE_DRIVE_ENABLED: "true",
      }),
    ).toMatchObject({ enabled: true });
  });
});
