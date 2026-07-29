import { isOpfsSqliteSupported, type BrowserLedgerStorageKind } from "@nexora/database";

export type StorageArchiveState =
  "unavailable" | "absent" | "present" | "unknown" | "blocked" | "corrupt";

export interface StorageArchiveInspection {
  readonly kind: BrowserLedgerStorageKind;
  readonly available: boolean;
  readonly state: StorageArchiveState;
  readonly lastCheckedAt: string;
  readonly schemaVersion?: number;
  readonly lastUsedAt?: string;
}

export interface StorageDiscoveryResult {
  readonly archives: readonly StorageArchiveInspection[];
}

export interface StorageDiscoveryDependencies {
  readonly now?: () => Date;
  readonly indexedDbDatabases?: () => Promise<readonly { name?: string; version?: number }[]>;
  /** Uses the same runtime predicate as the SQLite OPFS adapter. */
  readonly opfsSqliteSupported?: () => boolean;
  readonly opfsRoot?: () => Promise<FileSystemDirectoryHandle>;
}

const indexedDbName = "nexora-ledger";
const opfsPath = ["nexora", "nexora.sqlite3"] as const;

/** Performs capability and presence checks only; it never opens a writable database or creates files. */
export class StorageDiscovery {
  public constructor(private readonly dependencies: StorageDiscoveryDependencies = {}) {}

  public async inspect(): Promise<StorageDiscoveryResult> {
    return { archives: await Promise.all([this.inspectOpfs(), this.inspectIndexedDb()]) };
  }

  private async inspectOpfs(): Promise<StorageArchiveInspection> {
    const checkedAt = this.now();
    if (!(this.dependencies.opfsSqliteSupported ?? isOpfsSqliteSupported)()) {
      return unavailable("opfs", checkedAt);
    }
    const getRoot = this.dependencies.opfsRoot ?? defaultOpfsRoot();
    if (getRoot === undefined) return unavailable("opfs", checkedAt);
    try {
      const root = await getRoot();
      const directory = await root.getDirectoryHandle(opfsPath[0], { create: false });
      await directory.getFileHandle(opfsPath[1], { create: false });
      return present("opfs", checkedAt);
    } catch (error) {
      if (isNotFound(error)) return absent("opfs", checkedAt);
      return inspection("opfs", true, "blocked", checkedAt);
    }
  }

  private async inspectIndexedDb(): Promise<StorageArchiveInspection> {
    const checkedAt = this.now();
    const databases = this.dependencies.indexedDbDatabases ?? defaultIndexedDbDatabases();
    if (databases === undefined) return unavailable("indexeddb", checkedAt);
    try {
      const database = (await databases()).find((candidate) => candidate.name === indexedDbName);
      return database === undefined
        ? absent("indexeddb", checkedAt)
        : present("indexeddb", checkedAt, database.version);
    } catch {
      return inspection("indexeddb", true, "blocked", checkedAt);
    }
  }

  private now(): string {
    return (this.dependencies.now ?? (() => new Date()))().toISOString();
  }
}

function defaultOpfsRoot(): (() => Promise<FileSystemDirectoryHandle>) | undefined {
  if (typeof navigator === "undefined" || typeof navigator.storage?.getDirectory !== "function") {
    return undefined;
  }
  return () => navigator.storage.getDirectory();
}

function defaultIndexedDbDatabases(): (() => Promise<readonly IDBDatabaseInfo[]>) | undefined {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function")
    return undefined;
  return () => indexedDB.databases();
}

function inspection(
  kind: BrowserLedgerStorageKind,
  available: boolean,
  state: StorageArchiveState,
  lastCheckedAt: string,
  schemaVersion?: number,
): StorageArchiveInspection {
  return {
    kind,
    available,
    state,
    lastCheckedAt,
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
  };
}

function unavailable(
  kind: BrowserLedgerStorageKind,
  lastCheckedAt: string,
): StorageArchiveInspection {
  return inspection(kind, false, "unavailable", lastCheckedAt);
}

function absent(kind: BrowserLedgerStorageKind, lastCheckedAt: string): StorageArchiveInspection {
  return inspection(kind, true, "absent", lastCheckedAt);
}

function present(
  kind: BrowserLedgerStorageKind,
  lastCheckedAt: string,
  schemaVersion?: number,
): StorageArchiveInspection {
  return inspection(kind, true, "present", lastCheckedAt, schemaVersion);
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}
