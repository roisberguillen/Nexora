import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GoogleDriveOnboarding } from "./GoogleDriveOnboarding";
import { GoogleDriveSessionProvider } from "./GoogleDriveSession";
import { useGoogleDriveSession } from "./GoogleDriveSessionContext";

const enabledConfig = {
  clientId: "123-client.apps.googleusercontent.com",
  enabled: true,
} as const;

describe("GoogleDriveOnboarding", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("consente di continuare senza Drive per la sessione corrente", async () => {
    const user = userEvent.setup();
    const view = renderOnboarding();

    await user.click(screen.getByRole("button", { name: "Continua senza Drive" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    view.unmount();
    renderOnboarding();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape sceglie il percorso offline senza intrappolare il focus", async () => {
    const user = userEvent.setup();
    renderOnboarding();

    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("collega l'account soltanto dopo il gesto esplicito", async () => {
    const user = userEvent.setup();
    const requestAccessToken = vi.fn();
    vi.stubGlobal("google", {
      accounts: {
        oauth2: {
          initTokenClient: ({
            callback,
          }: {
            callback: (value: { access_token: string }) => void;
          }) => ({
            requestAccessToken: () => {
              requestAccessToken();
              callback({ access_token: "token-sintetico" });
            },
          }),
          revoke: (_token: string, done: () => void) => done(),
        },
      },
    });

    renderOnboarding(true);
    expect(requestAccessToken).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Collega Google Drive" }));

    expect(requestAccessToken).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("connected");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mantiene l'app utilizzabile quando il consenso viene negato", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("google", {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: { callback: (value: { error: string }) => void }) => ({
            requestAccessToken: () => callback({ error: "access_denied" }),
          }),
          revoke: (_token: string, done: () => void) => done(),
        },
      },
    });

    renderOnboarding();
    await user.click(screen.getByRole("button", { name: "Collega Google Drive" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nessun dato locale");
    expect(screen.getByRole("button", { name: "Continua senza Drive" })).toBeEnabled();
  });
});

function renderOnboarding(showStatus = false) {
  return render(
    <GoogleDriveSessionProvider config={enabledConfig}>
      <GoogleDriveOnboarding />
      {showStatus ? <SessionStatus /> : null}
    </GoogleDriveSessionProvider>,
  );
}

function SessionStatus() {
  const session = useGoogleDriveSession();
  return <output>{session.status}</output>;
}
