import { describe, expect, it } from "vitest";

import { nexoraTokens } from "./tokens";

describe("nexoraTokens", () => {
  it("exposes the official semantic palette and supported viewports", () => {
    expect(nexoraTokens.color.primary).toBe("#1648D8");
    expect(nexoraTokens.color.surface).toBe("#F6F7FB");
    expect(nexoraTokens.space[4]).toBe("16px");
    expect(nexoraTokens.viewport).toEqual({
      desktop: 1440,
      mobile: 390,
      minimum: 320,
      tablet: 768,
    });
  });
});
