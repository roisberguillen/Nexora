import { beforeEach, describe, expect, it, vi } from "vitest";

import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

import { downloadBackupArchive } from "./downloadBackup";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: vi.fn() }));

describe("downloadBackupArchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(save).mockResolvedValue("/storage/emulated/0/Download/test.nexora-backup");
    vi.mocked(writeFile).mockResolvedValue(undefined);
  });

  it("writes the verified archive only after a native destination is selected", async () => {
    const archive = new Uint8Array([1, 2, 3]);

    await downloadBackupArchive("test.nexora-backup", archive);

    expect(save).toHaveBeenCalledWith({
      defaultPath: "test.nexora-backup",
      filters: [{ name: "Nexora backup", extensions: ["nexora-backup"] }],
    });
    expect(writeFile).toHaveBeenCalledWith(
      "/storage/emulated/0/Download/test.nexora-backup",
      archive,
    );
  });

  it("does not write when the native save dialog is cancelled", async () => {
    vi.mocked(save).mockResolvedValueOnce(null);

    await expect(downloadBackupArchive("test.nexora-backup", new Uint8Array([1]))).rejects.toThrow(
      "backup_save_cancelled",
    );
    expect(writeFile).not.toHaveBeenCalled();
  });
});
