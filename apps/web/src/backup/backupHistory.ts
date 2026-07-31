import type { BrowserLedgerStorageKind } from "@nexora/database";

const STORAGE_KEY = "nexora.backup-history.v1";
const MAX_ENTRIES = 100;

export type BackupHistoryOperation =
  | "local_backup"
  | "manual_backup"
  | "cloud_upload"
  | "cloud_download"
  | "restore"
  | "restore_test"
  | "integrity_check";
export interface BackupHistoryEntry {
  readonly id: string;
  readonly operation: BackupHistoryOperation;
  readonly storageKind: BrowserLedgerStorageKind;
  readonly occurredAt: string;
  readonly outcome: "succeeded" | "failed";
  readonly size?: number;
  readonly checksumPrefix?: string;
}
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readBackupHistory(
  storage: StorageLike = window.localStorage,
): readonly BackupHistoryEntry[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isEntry) : [];
  } catch {
    return [];
  }
}
export function appendBackupHistory(
  entry: Omit<BackupHistoryEntry, "id" | "occurredAt">,
  storage: StorageLike = window.localStorage,
  now: () => Date = () => new Date(),
): BackupHistoryEntry {
  const occurredAt = now().toISOString();
  const record: BackupHistoryEntry = { ...entry, id: crypto.randomUUID(), occurredAt };
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify([record, ...readBackupHistory(storage)].slice(0, MAX_ENTRIES)),
  );
  return record;
}
function isEntry(value: unknown): value is BackupHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.occurredAt === "string" &&
    typeof item.operation === "string" &&
    typeof item.outcome === "string" &&
    (item.storageKind === "opfs" || item.storageKind === "indexeddb")
  );
}
