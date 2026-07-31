import { describe, expect, it } from "vitest";

import { renderPreMountError } from "./PreMountError";

describe("renderPreMountError", () => {
  it("shows a safe recovery screen when React cannot mount", () => {
    const root = document.createElement("div");

    renderPreMountError(root);

    expect(root.querySelector("[role=alert]")).toHaveTextContent(
      "Nexora non è riuscita ad avviarsi",
    );
    expect(root.querySelector("button")?.textContent).toBe("Ricarica applicazione");
  });
});
