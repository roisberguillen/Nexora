import type { BrowserLedger, Ledger, VerifiedPortableBackup } from "@nexora/database";
import { render as renderUi, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GoogleDriveSessionProvider } from "../cloud/GoogleDriveSession";
import { BackupPage } from "./BackupPage";

function render(ui: ReactElement) {
  return renderUi(<GoogleDriveSessionProvider>{ui}</GoogleDriveSessionProvider>);
}

describe("BackupPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
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
    expect(screen.getByText(/Crea un file/)).toBeInTheDocument();
    expect(screen.queryByText(/cartella NAS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/My Cloud/i)).not.toBeInTheDocument();
  });

  it("rende accessibile l'errore se il popup Google viene chiuso", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "123-client.apps.googleusercontent.com");
    vi.stubEnv("VITE_GOOGLE_DRIVE_ENABLED", "true");
    vi.stubGlobal("google", {
      accounts: {
        oauth2: {
          initTokenClient: ({
            error_callback,
          }: {
            error_callback?: (error: { type?: string }) => void;
          }) => ({ requestAccessToken: () => error_callback?.({ type: "popup_closed" }) }),
          revoke: (_token: string, done: () => void) => done(),
        },
      },
    });
    render(<BackupPage ledger={createLedger()} />);

    await user.click(screen.getByRole("button", { name: "Collega Google Drive" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Il consenso Google è stato chiuso prima del collegamento",
    );
    expect(screen.getByRole("button", { name: "Collega Google Drive" })).toBeEnabled();
  });

  it("verifica il file in sola lettura e mostra una ricevuta tecnica", async () => {
    const user = userEvent.setup();
    const verifyEncryptedBackupArchive = vi.fn(async () => verifiedReceipt);
    render(<BackupPage ledger={createLedger({ verifyEncryptedBackupArchive })} />);

    await selectArchiveAndEnterPassphrase(user);
    const restoreButton = screen.getByRole("button", { name: "Ripristina archivio verificato" });
    expect(restoreButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Verifica archivio senza ripristinare" }));

    expect(verifyEncryptedBackupArchive).toHaveBeenCalledWith({
      archive: new Uint8Array([1, 2, 3]),
      passphrase: "passphrase-sicura",
    });
    expect(await screen.findByRole("heading", { name: "Archivio verificato" })).toBeInTheDocument();
    expect(screen.getByText("backup-sintetico.nexora-backup")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("abcdef123456…")).toBeInTheDocument();
    expect(restoreButton).toBeEnabled();
  });

  it("richiede una conferma distinta prima di invocare il restore", async () => {
    const user = userEvent.setup();
    const pendingRestore = new Promise<void>(() => undefined);
    const restoreEncryptedBackupArchive = vi.fn(() => pendingRestore);
    render(
      <BackupPage
        ledger={createLedger({
          restoreEncryptedBackupArchive,
          verifyEncryptedBackupArchive: vi.fn(async () => verifiedReceipt),
        })}
      />,
    );

    await selectArchiveAndEnterPassphrase(user);
    await user.click(screen.getByRole("button", { name: "Verifica archivio senza ripristinare" }));
    await user.click(await screen.findByRole("button", { name: "Ripristina archivio verificato" }));

    expect(restoreEncryptedBackupArchive).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Confermare il ripristino?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Conferma ripristino" }));
    expect(restoreEncryptedBackupArchive).toHaveBeenCalledWith({
      archive: new Uint8Array([1, 2, 3]),
      id: "backup-sintetico.nexora-backup",
      passphrase: "passphrase-sicura",
    });
  });

  it("annulla senza scrivere e invalida la verifica quando cambia la passphrase", async () => {
    const user = userEvent.setup();
    const restoreEncryptedBackupArchive = vi.fn(async () => undefined);
    render(
      <BackupPage
        ledger={createLedger({
          restoreEncryptedBackupArchive,
          verifyEncryptedBackupArchive: vi.fn(async () => verifiedReceipt),
        })}
      />,
    );

    await selectArchiveAndEnterPassphrase(user);
    await user.click(screen.getByRole("button", { name: "Verifica archivio senza ripristinare" }));
    await user.click(await screen.findByRole("button", { name: "Ripristina archivio verificato" }));
    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(restoreEncryptedBackupArchive).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Passphrase (minimo 12 caratteri)"), "x");
    expect(screen.queryByRole("heading", { name: "Archivio verificato" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ripristina archivio verificato" })).toBeDisabled();
  });

  it("espone un errore accessibile se il checksum o la passphrase non sono validi", async () => {
    const user = userEvent.setup();
    render(
      <BackupPage
        ledger={createLedger({
          verifyEncryptedBackupArchive: vi.fn(async () => {
            throw new Error("invalid_archive");
          }),
        })}
      />,
    );

    await selectArchiveAndEnterPassphrase(user);
    await user.click(screen.getByRole("button", { name: "Verifica archivio senza ripristinare" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Verifica non riuscita: il ledger attivo non è stato modificato",
    );
    expect(screen.getByRole("button", { name: "Ripristina archivio verificato" })).toBeDisabled();
  });

  it("verifica il backup Drive prima di mostrare la conferma di restore", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "123-client.apps.googleusercontent.com");
    vi.stubEnv("VITE_GOOGLE_DRIVE_ENABLED", "true");
    vi.stubGlobal("google", {
      accounts: {
        oauth2: {
          initTokenClient: ({
            callback,
          }: {
            callback: (value: { access_token: string }) => void;
          }) => ({ requestAccessToken: () => callback({ access_token: "token-sintetico" }) }),
          revoke: (_token: string, done: () => void) => done(),
        },
      },
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [
              {
                id: "drive-backup-1",
                name: "backup-drive.nexora-backup",
                size: "3",
                createdTime: "2026-08-02T10:00:00.000Z",
                appProperties: {
                  backupId: "backup-drive.nexora-backup",
                  checksumSha256: verifiedReceipt.checksumSha256,
                  formatVersion: "1",
                  schemaVersion: "14",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const verifyEncryptedBackupArchive = vi.fn(async () => verifiedReceipt);
    const pendingRestore = new Promise<void>(() => undefined);
    const restoreEncryptedBackupArchive = vi.fn(() => pendingRestore);
    render(
      <BackupPage
        ledger={createLedger({ verifyEncryptedBackupArchive, restoreEncryptedBackupArchive })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Collega Google Drive" }));
    expect(await screen.findByText("backup-drive.nexora-backup")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Passphrase (minimo 12 caratteri)"), "passphrase-sicura");
    await user.click(screen.getByRole("button", { name: "Verifica per il ripristino" }));

    expect(restoreEncryptedBackupArchive).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("heading", { name: "Backup Drive verificato" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ripristina backup Drive verificato" }));
    expect(
      screen.getByRole("dialog", { name: "Confermare il ripristino da Drive?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Conferma ripristino da Drive" }));
    expect(restoreEncryptedBackupArchive).toHaveBeenCalledWith({
      archive: new Uint8Array([1, 2, 3]),
      id: "backup-drive.nexora-backup",
      passphrase: "passphrase-sicura",
    });
  });

  it("blocca il restore Drive se il checksum remoto non coincide", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "123-client.apps.googleusercontent.com");
    vi.stubEnv("VITE_GOOGLE_DRIVE_ENABLED", "true");
    vi.stubGlobal("google", {
      accounts: {
        oauth2: {
          initTokenClient: ({
            callback,
          }: {
            callback: (value: { access_token: string }) => void;
          }) => ({ requestAccessToken: () => callback({ access_token: "token-sintetico" }) }),
          revoke: (_token: string, done: () => void) => done(),
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              files: [
                {
                  id: "drive-backup-1",
                  name: "backup-drive.nexora-backup",
                  size: "3",
                  createdTime: "2026-08-02T10:00:00.000Z",
                  appProperties: {
                    backupId: "backup-drive.nexora-backup",
                    checksumSha256: "b".repeat(64),
                    formatVersion: "1",
                    schemaVersion: "14",
                  },
                },
              ],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );
    render(<BackupPage ledger={createLedger()} />);

    await user.click(screen.getByRole("button", { name: "Collega Google Drive" }));
    await user.type(screen.getByLabelText("Passphrase (minimo 12 caratteri)"), "passphrase-sicura");
    await user.click(await screen.findByRole("button", { name: "Verifica per il ripristino" }));

    expect(await screen.findByText(/Verifica Drive non riuscita/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ripristina backup Drive verificato" }),
    ).not.toBeInTheDocument();
  });
});

const verifiedReceipt: VerifiedPortableBackup = {
  checksumSha256: "abcdef123456" + "0".repeat(52),
  size: 3,
  manifest: {
    formatVersion: 1,
    schemaVersion: 14,
    createdAt: "2026-08-02T10:00:00.000Z",
    files: [{ path: "ledger.json", sha256: "1".repeat(64), size: 3 }],
  },
};

function createLedger(overrides: Partial<Ledger> = {}): Ledger {
  return {
    repository: {} as Ledger["repository"],
    schemaVersion: 14,
    storageKind: "indexeddb",
    createEncryptedBackupArchive: vi.fn(),
    restoreEncryptedBackupArchive: vi.fn(async () => undefined),
    verifyEncryptedBackupArchive: vi.fn(async () => verifiedReceipt),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function selectArchiveAndEnterPassphrase(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Passphrase (minimo 12 caratteri)"), "passphrase-sicura");
  await user.upload(
    screen.getByLabelText("File `.nexora-backup`"),
    new File([new Uint8Array([1, 2, 3])], "backup-sintetico.nexora-backup", {
      type: "application/octet-stream",
    }),
  );
}
