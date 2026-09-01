import { InMemoryLedgerRepository, type BrowserLedger } from "@nexora/database";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacySecurityPage } from "./PrivacySecurityPage";
import { createAppLock, readAppLock } from "./appLock";

function ledger(): BrowserLedger {
  return {
    repository: new InMemoryLedgerRepository(),
    schemaVersion: 1,
    storageKind: "indexeddb",
    close: vi.fn(async () => undefined),
  };
}

describe("PrivacySecurityPage app lock", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("requires matching confirmation before storing the lock", async () => {
    const user = userEvent.setup();
    render(
      <PrivacySecurityPage
        ledger={ledger()}
        lockConfig={undefined}
        onLockConfigChanged={vi.fn()}
        onManualLock={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("PIN o passphrase"), "4937");
    await user.type(screen.getByLabelText("Conferma PIN o passphrase"), "4938");
    await user.click(screen.getByRole("button", { name: "Attiva blocco" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/non coincidono/i);
    expect(readAppLock()).toBeUndefined();
  }, 15_000);

  it("requires the current PIN before disabling the lock", async () => {
    const user = userEvent.setup();
    const config = await createAppLock("4937", 5);
    const onLockConfigChanged = vi.fn();
    render(
      <PrivacySecurityPage
        ledger={ledger()}
        lockConfig={config}
        onLockConfigChanged={onLockConfigChanged}
        onManualLock={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Disattiva blocco" }));
    await user.type(screen.getByLabelText("PIN o passphrase attuali"), "0000");
    await user.click(screen.getByRole("button", { name: "Conferma disattivazione" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/non corretti/i);
    expect(onLockConfigChanged).not.toHaveBeenCalled();
    expect(readAppLock()).toBeDefined();

    await user.clear(screen.getByLabelText("PIN o passphrase attuali"));
    await user.type(screen.getByLabelText("PIN o passphrase attuali"), "4937");
    await user.click(screen.getByRole("button", { name: "Conferma disattivazione" }));
    await waitFor(() => expect(onLockConfigChanged).toHaveBeenCalledWith(undefined));
    expect(readAppLock()).toBeUndefined();
  }, 20_000);
});
