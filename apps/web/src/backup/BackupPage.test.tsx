import type { BrowserLedger } from "@nexora/database";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BackupPage } from "./BackupPage";

describe("BackupPage", () => {
  it("richiede configurazione esplicita prima di attivare Google Drive", () => {
    render(
      <BackupPage
        ledger={
          {
            schemaVersion: 2,
            storageKind: "indexeddb",
          } as BrowserLedger
        }
      />,
    );

    expect(screen.getByRole("heading", { name: "Backup cloud" })).toBeInTheDocument();
    expect(screen.getByText(/VITE_GOOGLE_CLIENT_ID/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /collega google drive/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Passphrase (minimo 12 caratteri)").parentElement).toHaveClass(
      "backup-passphrase",
    );
  });
});
