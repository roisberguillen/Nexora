import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StartupLoadingScreen } from "./StartupLoadingScreen";

describe("StartupLoadingScreen", () => {
  it("announces the active startup phase without exposing storage implementation details", () => {
    render(
      <StartupLoadingScreen
        progress={{
          occurredAt: "2026-07-31T10:00:00.000Z",
          phase: "migration",
          state: "RUNNING_MIGRATIONS",
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Aggiornamento archivio: in corso");
    expect(screen.getByRole("list", { name: "Fasi di avvio" })).toBeInTheDocument();
  });
});
