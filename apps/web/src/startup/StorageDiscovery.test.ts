import { describe, expect, it, vi } from "vitest";

import { StorageDiscovery } from "./StorageDiscovery";

const now = () => new Date("2026-07-29T12:00:00.000Z");

describe("StorageDiscovery", () => {
  it("rileva un archivio IndexedDB esistente senza aprirlo", async () => {
    const databases = vi.fn(async () => [{ name: "nexora-ledger", version: 13 }]);
    const result = await new StorageDiscovery({ now, indexedDbDatabases: databases }).inspect();

    expect(result.archives.find((archive) => archive.kind === "indexeddb")).toMatchObject({
      available: true,
      state: "present",
      schemaVersion: 13,
    });
    expect(databases).toHaveBeenCalledOnce();
  });

  it("non crea il file OPFS quando l'archivio non esiste", async () => {
    const getFileHandle = vi.fn(async () =>
      Promise.reject(new DOMException("missing", "NotFoundError")),
    );
    const getDirectoryHandle = vi.fn(async () => ({ getFileHandle }));
    const result = await new StorageDiscovery({
      now,
      opfsRoot: async () => ({ getDirectoryHandle }) as unknown as FileSystemDirectoryHandle,
    }).inspect();

    expect(result.archives.find((archive) => archive.kind === "opfs")).toMatchObject({
      state: "absent",
    });
    expect(getDirectoryHandle).toHaveBeenCalledWith("nexora", { create: false });
    expect(getFileHandle).toHaveBeenCalledWith("nexora.sqlite3", { create: false });
  });

  it("mantiene un errore di accesso come stato bloccato senza cancellare dati", async () => {
    const result = await new StorageDiscovery({
      now,
      indexedDbDatabases: async () => Promise.reject(new DOMException("denied", "SecurityError")),
    }).inspect();

    expect(result.archives.find((archive) => archive.kind === "indexeddb")).toMatchObject({
      state: "blocked",
    });
  });
});
