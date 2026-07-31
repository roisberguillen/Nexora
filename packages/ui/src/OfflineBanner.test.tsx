import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfflineBanner } from "./OfflineBanner";

describe("OfflineBanner", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is silent while online and announces only an offline state", () => {
    vi.stubGlobal("navigator", { onLine: true });
    const { rerender } = render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    vi.stubGlobal("navigator", { onLine: false });
    window.dispatchEvent(new Event("offline"));
    rerender(<OfflineBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Sei offline");
  });
});
