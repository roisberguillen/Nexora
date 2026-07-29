import { describe, expect, it } from "vitest";
import { createStartupDiagnostics, serializeStartupDiagnostics } from "./StartupDiagnostics";

describe("startup diagnostics", () => {
  it("contiene solo metadati tecnici sicuri", () => {
    const serialized = serializeStartupDiagnostics(
      createStartupDiagnostics({
        appVersion: "0.5.0",
        buildId: "build-a",
        userAgent: "test",
        platform: "test-os",
        errorCode: "NX-STORAGE-001",
        now: () => new Date("2026-07-29T00:00:00.000Z"),
        capabilities: {
          worker: true,
          opfs: true,
          indexedDb: true,
          crossOriginIsolated: true,
          webAssembly: true,
        },
        archives: [
          {
            kind: "opfs",
            available: true,
            state: "present",
            lastCheckedAt: "2026-07-29T00:00:00.000Z",
            schemaVersion: 13,
          },
        ],
      }),
    );
    expect(serialized).toContain("NX-STORAGE-001");
    expect(serialized).not.toMatch(/amount|balance|token|passphrase|category|transaction/i);
  });
});
