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
