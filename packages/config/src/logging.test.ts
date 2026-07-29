import { describe, expect, it, vi } from "vitest";

import { classifyErrorName, createSafeLogger, redactSensitiveText } from "./logging";

describe("safe logger", () => {
  it("records only the approved structured metadata", () => {
    const sink = vi.fn();
    const logger = createSafeLogger(sink, () => new Date("2026-07-27T10:00:00.000Z"));

    logger.error("app.error-boundary", {
      component: "error-boundary",
      status: "failed",
      errorName: classifyErrorName(new Error("sensitive transaction detail")),
    });

    expect(sink).toHaveBeenCalledWith({
      timestamp: "2026-07-27T10:00:00.000Z",
      level: "error",
      event: "app.error-boundary",
      metadata: {
        component: "error-boundary",
        status: "failed",
        errorName: "Error",
      },
    });
    expect(JSON.stringify(sink.mock.calls)).not.toContain("sensitive transaction detail");
  });

  it("maps custom error names to a non-sensitive fallback", () => {
    const customError = new Error("private value");
    customError.name = "FinancialImportError";

    expect(classifyErrorName(customError)).toBe("UnknownError");
    expect(classifyErrorName("failure")).toBe("UnknownError");
  });
});

describe("sensitive text redaction", () => {
  it("removes common OAuth, passphrase and IBAN values before diagnostic use", () => {
    const output = redactSensitiveText(
      "Bearer token-value access_token=oauth-value passphrase=hidden IT60X0542811101000000123456",
    );
    expect(output).toBe(
      "Bearer [REDACTED] access_token=[REDACTED] passphrase=[REDACTED] [REDACTED_IBAN]",
    );
  });
});
