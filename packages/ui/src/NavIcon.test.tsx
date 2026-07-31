import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NavIcon } from "./NavIcon";

describe("NavIcon", () => {
  it("renders the requested icon when its key exists", () => {
    const { container } = render(<NavIcon name="transactions" />);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelectorAll("path")).toHaveLength(4);
  });

  it("uses the overview icon when an unsupported icon name is received", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { container } = render(<NavIcon name="unsupported-icon" />);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelectorAll("path")).toHaveLength(4);
    expect(warning).toHaveBeenCalledWith(
      "[Nexora UI] Unknown navigation icon; using the default icon.",
    );
  });

  it("does not throw when a map key is absent at runtime", () => {
    expect(() => render(<NavIcon name={"missing-map-key"} />)).not.toThrow();
  });
});
