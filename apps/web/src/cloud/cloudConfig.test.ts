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
        VITE_GOOGLE_CLIENT_ID: "123-client.apps.googleusercontent.com",
        VITE_GOOGLE_DRIVE_ENABLED: "true",
      }),
    ).toMatchObject({ enabled: true });
  });
  it("rifiuta client id malformati anche se il flag è attivo", () => {
    expect(
      readGoogleCloudConfig({
        VITE_GOOGLE_CLIENT_ID: "https://example.test/client",
        VITE_GOOGLE_DRIVE_ENABLED: "true",
      }),
    ).toEqual({ clientId: "https://example.test/client", enabled: false });
  });
});
