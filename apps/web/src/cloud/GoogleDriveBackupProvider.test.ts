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
  it("ignora file Drive che non hanno metadati Nexora validi", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          files: [
            { id: "note", name: "note.txt", size: "12", createdTime: "2026-08-02T10:00:00Z" },
            {
              id: "backup",
              name: "backup.nexora-backup",
              size: "3",
              createdTime: "2026-08-02T10:00:00Z",
              appProperties: {
                backupId: "backup.nexora-backup",
                checksumSha256: "a".repeat(64),
                formatVersion: "1",
                schemaVersion: "15",
                nexoraBackup: "1",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(new GoogleDriveBackupProvider(() => "token", fetcher).list()).resolves.toEqual([
      expect.objectContaining({ id: "backup", schemaVersion: 15, size: 3 }),
    ]);
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
  it("rifiuta un download con dimensione diversa dalla ricevuta Drive", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array([7, 8, 9]), { status: 200 }));
    const provider = new GoogleDriveBackupProvider(() => "token", fetcher);

    await expect(provider.download("backup-id", 4)).rejects.toThrow(
      "cloud_invalid_backup_metadata",
    );
  });
  it("elimina esplicitamente un backup enumerato usando un id codificato", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const provider = new GoogleDriveBackupProvider(() => "token", fetcher);

    await provider.delete("backup/id");

    expect(fetcher).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/backup%2Fid",
      expect.objectContaining({ method: "DELETE" }),
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
  it("non ritenta upload POST che potrebbero creare duplicati", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const provider = new GoogleDriveBackupProvider(() => "token", fetcher, { maxAttempts: 3 });

    await expect(provider.upload(validMetadata, new Uint8Array([1, 2, 3]))).rejects.toThrow(
      "cloud_network_error",
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rifiuta metadati incoerenti prima di inviare l'archivio", async () => {
    const fetcher = vi.fn();
    const provider = new GoogleDriveBackupProvider(() => "token", fetcher);

    await expect(
      provider.upload({ ...validMetadata, size: 4 }, new Uint8Array([1, 2, 3])),
    ).rejects.toThrow("cloud_invalid_backup_metadata");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves the local encrypted backup identifier in Drive metadata", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const provider = new GoogleDriveBackupProvider(() => "token", fetcher);

    await provider.upload(validMetadata, new Uint8Array([1, 2, 3]));

    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toEqual(expect.objectContaining({ Authorization: "Bearer token" }));
    expect(await (request.body as Blob).text()).toContain(
      '"backupId":"nexora-v11-test.nexora-backup"',
    );
    expect(await (request.body as Blob).text()).toContain('"createdAt":"2026-07-29T10:00:00.000Z"');
    expect(await (request.body as Blob).text()).toContain('"size":"3"');
  });

  it("ignora metadati che non dichiarano un archivio Nexora", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          files: [
            {
              id: "foreign-backup",
              name: "foreign.nexora-backup",
              size: "3",
              createdTime: "2026-08-02T10:00:00Z",
              appProperties: {
                backupId: "foreign.nexora-backup",
                checksumSha256: "a".repeat(64),
                formatVersion: "1",
                schemaVersion: "15",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(new GoogleDriveBackupProvider(() => "token", fetcher).list()).resolves.toEqual([]);
  });
});

const validMetadata = {
  id: "nexora-v11-test.nexora-backup",
  backupId: "nexora-v11-test.nexora-backup",
  checksumSha256: "a".repeat(64),
  createdAt: "2026-07-29T10:00:00.000Z",
  formatVersion: 1,
  schemaVersion: 11,
  size: 3,
} as const;
