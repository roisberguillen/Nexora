import type { BrowserLedger } from "@nexora/database";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfilePage } from "./ProfilePage";

describe("ProfilePage", () => {
  it("does not render the redundant local-data badge", () => {
    render(<ProfilePage ledger={{ schemaVersion: 13, storageKind: "opfs" } as BrowserLedger} />);

    expect(screen.queryByText("Dati locali attivi")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Stato archivio")).toHaveTextContent("Archivio attivo: OPFS");
  });
});
