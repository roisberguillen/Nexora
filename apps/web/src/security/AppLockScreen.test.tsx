import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppLockScreen } from "./AppLockScreen";

const config = {
  version: 1 as const,
  iterations: 600_000,
  salt: "synthetic-salt",
  verifier: "synthetic-verifier",
  timeoutMinutes: 5 as const,
};

describe("AppLockScreen recovery", () => {
  it("offers total recovery without requesting the forgotten PIN", async () => {
    const user = userEvent.setup();
    const recoveryReset = vi.fn(async () => undefined);
    render(<AppLockScreen config={config} onRecoveryReset={recoveryReset} onUnlock={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Hai dimenticato il PIN?" }));
    const dialog = screen.getByRole("dialog", { name: "Ripristino totale dell’app" });
    expect(within(dialog).getByText(/non può essere recuperato/i)).toBeVisible();
    expect(within(dialog).getByText(/Google Drive restano invariati/i)).toBeVisible();

    const confirm = within(dialog).getByRole("button", { name: "Ripristina app" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Digita RIPRISTINA NEXORA/i), "RIPRISTINA DATI");
    expect(confirm).toBeDisabled();
    await user.clear(screen.getByLabelText(/Digita RIPRISTINA NEXORA/i));
    await user.type(screen.getByLabelText(/Digita RIPRISTINA NEXORA/i), "RIPRISTINA NEXORA");
    await user.click(confirm);

    await waitFor(() => expect(recoveryReset).toHaveBeenCalledOnce());
  }, 15_000);

  it("keeps recovery unavailable until the local archive is ready", () => {
    render(<AppLockScreen config={config} onUnlock={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Hai dimenticato il PIN?" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/archivio locale è pronto/i);
  });
});
