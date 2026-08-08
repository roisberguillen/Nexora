import { describe, expect, it } from "vitest";

import { crossOriginIsolationHeaders, googleOAuthBridgeHeaders } from "./securityHeaders";

describe("web security headers", () => {
  it("keeps the application cross-origin isolated for SQLite/OPFS", () => {
    expect(crossOriginIsolationHeaders).toMatchObject({
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
    expect(crossOriginIsolationHeaders["Content-Security-Policy"]).toContain(
      "https://accounts.google.com",
    );
  });

  it("limits popup-compatible COOP to the dedicated OAuth bridge", () => {
    expect(googleOAuthBridgeHeaders["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
    expect(googleOAuthBridgeHeaders["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
  });
});
