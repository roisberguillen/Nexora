import { describe, expect, it, vi } from "vitest";
import { GoogleDriveBackupProvider } from "./GoogleDriveBackupProvider";

describe("GoogleDriveBackupProvider", () => {
  it("uses the private appData space with bearer token", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ files: [] }), { status: 200 }));
    await expect(new GoogleDriveBackupProvider(() => "token", fetcher).list()).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("appDataFolder"),
      expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
    );
  });
  it("fails without a memory token", async () => {
    await expect(new GoogleDriveBackupProvider(() => undefined).list()).rejects.toThrow(
      "cloud_session_expired",
    );
  });
  it("downloads a private archive through an encoded Drive identifier", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([7, 8, 9]), { status: 200 }));
    const provider = new GoogleDriveBackupProvider(() => "token", fetcher);

    await expect(provider.download("private/id")).resolves.toEqual(new Uint8Array([7, 8, 9]));
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("private%2Fid?alt=media"),
      expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
    );
  });
  it("fails closed for an expired Drive session", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const provider = new GoogleDriveBackupProvider(() => "expired", fetcher);

    await expect(provider.download("backup-id")).rejects.toThrow("cloud_session_expired");
  });
  it("distingue permessi negati e archivi non trovati", async () => {
    const denied = new GoogleDriveBackupProvider(
      () => "token",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );
    const missing = new GoogleDriveBackupProvider(
      () => "token",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );

    await expect(denied.list()).rejects.toThrow("cloud_permission_denied");
    await expect(missing.download("missing")).rejects.toThrow("cloud_backup_not_found");
  });
  it("ritenta soltanto i guasti temporanei", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }));
    const provider = new GoogleDriveBackupProvider(() => "token", fetcher, { maxAttempts: 2 });

    await expect(provider.list()).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("preserves the local encrypted backup identifier in Drive metadata", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const provider = new GoogleDriveBackupProvider(() => "token", fetcher);

    await provider.upload(
      {
        id: "nexora-v11-test.nexora-backup",
        backupId: "nexora-v11-test.nexora-backup",
        checksumSha256: "a".repeat(64),
        createdAt: "2026-07-29T10:00:00.000Z",
        formatVersion: 1,
        schemaVersion: 11,
        size: 3,
      },
      new Uint8Array([1, 2, 3]),
    );

    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toEqual(expect.objectContaining({ Authorization: "Bearer token" }));
    expect(await (request.body as Blob).text()).toContain(
      '"backupId":"nexora-v11-test.nexora-backup"',
    );
  });
});
