import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export async function downloadBackupArchive(id: string, archive: Uint8Array): Promise<void> {
  if (isTauri()) {
    const selectedPath = await save({
      defaultPath: id,
      filters: [{ name: "Nexora backup", extensions: ["nexora-backup"] }],
    });
    if (selectedPath === null) throw new Error("backup_save_cancelled");
    await writeFile(selectedPath, archive);
    return;
  }

  const anchor = document.createElement("a");
  const blobBytes = new ArrayBuffer(archive.byteLength);
  new Uint8Array(blobBytes).set(archive);
  const archiveUrl = URL.createObjectURL(
    new Blob([blobBytes], { type: "application/octet-stream" }),
  );
  anchor.href = archiveUrl;
  anchor.download = id;
  anchor.click();
  URL.revokeObjectURL(archiveUrl);
}
