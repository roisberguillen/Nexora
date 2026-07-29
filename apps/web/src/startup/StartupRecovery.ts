import type { BrowserLedgerStorageKind } from "@nexora/database";

import type { StorageArchiveInspection } from "./StorageDiscovery";

export const RECOVERY_STORAGE_KEY = "nexora.startup-recovery-storage.v1";

export class StartupRecoveryRequiredError extends Error {
  public constructor(readonly archives: readonly StorageArchiveInspection[]) {
    super("Nexora requires an explicit archive selection before startup can continue.");
    this.name = "StartupRecoveryRequiredError";
  }
}

export function selectableRecoveryArchives(
  archives: readonly StorageArchiveInspection[],
): readonly StorageArchiveInspection[] {
  return archives.filter((archive) => archive.available && archive.state === "present");
}

export function writeRecoverySelection(storageKind: BrowserLedgerStorageKind): void {
  globalThis.localStorage.setItem(RECOVERY_STORAGE_KEY, storageKind);
}

export function readRecoverySelection(
  archives: readonly StorageArchiveInspection[],
): BrowserLedgerStorageKind | undefined {
  try {
    const selected = globalThis.localStorage.getItem(RECOVERY_STORAGE_KEY);
    globalThis.localStorage.removeItem(RECOVERY_STORAGE_KEY);
    return selectableRecoveryArchives(archives).some((archive) => archive.kind === selected)
      ? (selected as BrowserLedgerStorageKind)
      : undefined;
  } catch {
    return undefined;
  }
}
