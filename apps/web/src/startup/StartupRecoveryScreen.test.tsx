import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StartupRecoveryScreen } from "./StartupRecoveryScreen";

describe("StartupRecoveryScreen", () => {
  it("espone un percorso di verifica non distruttivo e accessibile", async () => {
    const user = userEvent.setup();
    render(
      <StartupRecoveryScreen
        onExportDiagnostics={vi.fn()}
        onOpenSafeCopy={vi.fn()}
        onRetry={vi.fn()}
        recoveryArchives={undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Avvia recupero guidato" }));

    expect(screen.getByLabelText("File backup `.nexora-backup`")).toBeInTheDocument();
    expect(screen.getByLabelText("Passphrase del backup")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Verifica backup senza ripristinare" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Prova ripristino temporaneo" })).toBeDisabled();
  });

  it("permette di aprire esplicitamente uno dei due archivi rilevati", async () => {
    const user = userEvent.setup();
    const onOpenSafeCopy = vi.fn();
    render(
      <StartupRecoveryScreen
        onExportDiagnostics={vi.fn()}
        onOpenSafeCopy={onOpenSafeCopy}
        onRetry={vi.fn()}
        recoveryArchives={[
          { kind: "opfs", available: true, state: "present", lastCheckedAt: "now" },
          { kind: "indexeddb", available: true, state: "present", lastCheckedAt: "now" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Apri archivio IndexedDB" }));

    expect(onOpenSafeCopy).toHaveBeenCalledWith("indexeddb");
  });
});
