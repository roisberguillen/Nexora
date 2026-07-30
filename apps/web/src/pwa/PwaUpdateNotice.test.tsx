import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PwaUpdateNotice, pwaUpdateEventName } from "./PwaUpdateNotice";

describe("PwaUpdateNotice", () => {
  it("mostra e applica un aggiornamento solo dopo il segnale del service worker", () => {
    const applyUpdate = vi.fn();
    render(<PwaUpdateNotice />);
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(pwaUpdateEventName, { detail: { applyUpdate } }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiorna ora" }));
    expect(applyUpdate).toHaveBeenCalledOnce();
  });
});
