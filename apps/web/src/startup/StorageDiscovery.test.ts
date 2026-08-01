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
      opfsSqliteSupported: () => true,
      opfsRoot: async () => ({ getDirectoryHandle }) as unknown as FileSystemDirectoryHandle,
    }).inspect();

    expect(result.archives.find((archive) => archive.kind === "opfs")).toMatchObject({
      state: "absent",
    });
    expect(getDirectoryHandle).toHaveBeenCalledWith("nexora", { create: false });
    expect(getFileHandle).toHaveBeenCalledWith("nexora.sqlite3", { create: false });
  });

  it("rileva OPFS presente senza aprire IndexedDB e mantiene la distinzione degli archivi", async () => {
    const getFileHandle = vi.fn(async () => ({ name: "nexora.sqlite3" }));
    const getDirectoryHandle = vi.fn(async () => ({ getFileHandle }));
    const databases = vi.fn(async () => []);
    const result = await new StorageDiscovery({
      now,
      opfsSqliteSupported: () => true,
      opfsRoot: async () => ({ getDirectoryHandle }) as unknown as FileSystemDirectoryHandle,
      indexedDbDatabases: databases,
    }).inspect();

    expect(result.archives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "opfs", available: true, state: "present" }),
        expect.objectContaining({ kind: "indexeddb", available: true, state: "absent" }),
      ]),
    );
  });

  it("classifica il timeout della sonda OPFS come bloccato senza creare l'archivio", async () => {
    const getDirectoryHandle = vi.fn(() => new Promise<never>(() => undefined));
    const result = await new StorageDiscovery({
      now,
      probeTimeoutMs: 1,
      opfsSqliteSupported: () => true,
      opfsRoot: async () => ({ getDirectoryHandle }) as unknown as FileSystemDirectoryHandle,
      indexedDbDatabases: async () => [],
    }).inspect();

    expect(result.archives.find((archive) => archive.kind === "opfs")).toMatchObject({
      available: true,
      state: "blocked",
    });
  });

  it("non dichiara OPFS utilizzabile se il runtime SQLite non è isolato", async () => {
    const getDirectoryHandle = vi.fn();
    const result = await new StorageDiscovery({
      now,
      opfsSqliteSupported: () => false,
      opfsRoot: async () => ({ getDirectoryHandle }) as unknown as FileSystemDirectoryHandle,
    }).inspect();

    expect(result.archives.find((archive) => archive.kind === "opfs")).toMatchObject({
      available: false,
      state: "unavailable",
    });
    expect(getDirectoryHandle).not.toHaveBeenCalled();
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

  it("trasforma una sonda IndexedDB bloccata in recovery non distruttivo", async () => {
    const result = await new StorageDiscovery({
      now,
      probeTimeoutMs: 1,
      indexedDbDatabases: () => new Promise(() => undefined),
    }).inspect();

    expect(result.archives.find((archive) => archive.kind === "indexeddb")).toMatchObject({
      available: true,
      state: "blocked",
    });
  });
});
