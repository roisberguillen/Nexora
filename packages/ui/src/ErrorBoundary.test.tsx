import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

function BrokenComponent(): never {
  throw new Error("contenuto sensibile");
}

describe("ErrorBoundary", () => {
  it("mostra un fallback sicuro e inoltra l'errore al logger", () => {
    const onError = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary onError={onError}>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "Nexora non è riuscita ad avviarsi" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("contenuto sensibile")).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
  });
});
