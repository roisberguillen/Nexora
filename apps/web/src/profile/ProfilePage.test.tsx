import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfilePage } from "./ProfilePage";

describe("ProfilePage", () => {
  it("does not render the redundant local-data badge", () => {
    render(<ProfilePage />);

    expect(screen.queryByText("Dati locali attivi")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Stato archivio")).not.toBeInTheDocument();
  });
});
