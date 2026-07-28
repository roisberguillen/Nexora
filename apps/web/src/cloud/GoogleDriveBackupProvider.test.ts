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
});
