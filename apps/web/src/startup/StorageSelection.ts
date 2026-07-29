import type { BrowserLedgerStorageKind } from "@nexora/database";

import type { StorageArchiveInspection } from "./StorageDiscovery";

export type StorageSelection =
  | { readonly kind: "open"; readonly storageKind: BrowserLedgerStorageKind }
  | {
      readonly kind: "guided-recovery";
      readonly reason: "multiple-data-archives" | "unsafe-state";
    };

/** Applies the safe selection policy without opening or creating a ledger. */
export function selectStorage(
  archives: readonly StorageArchiveInspection[],
  preference?: BrowserLedgerStorageKind,
): StorageSelection {
  const usable = archives.filter((archive) => archive.available && archive.state !== "blocked");
  const present = usable.filter((archive) => archive.state === "present");
  if (present.length > 1) return { kind: "guided-recovery", reason: "multiple-data-archives" };
  const onlyPresent = present[0];
  if (onlyPresent !== undefined) return { kind: "open", storageKind: onlyPresent.kind };
  if (archives.some((archive) => archive.state === "blocked" || archive.state === "corrupt")) {
    return { kind: "guided-recovery", reason: "unsafe-state" };
  }
  if (preference !== undefined && usable.some((archive) => archive.kind === preference)) {
    return { kind: "open", storageKind: preference };
  }
  if (usable.some((archive) => archive.kind === "opfs"))
    return { kind: "open", storageKind: "opfs" };
  return { kind: "open", storageKind: "indexeddb" };
}

export interface RetryOptions {
  readonly maxAttempts?: number;
  readonly initialDelayMs?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

export async function retryTransient<T>(
  action: () => Promise<T>,
  isTransient: (error: unknown) => boolean,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 150;
  const deadline = Date.now() + (options.timeoutMs ?? 5_000);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw new DOMException("Startup cancelled", "AbortError");
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || attempt === maxAttempts || Date.now() >= deadline) throw error;
      await (options.sleep ?? defaultSleep)(initialDelayMs * 2 ** (attempt - 1), options.signal);
    }
  }
  throw lastError;
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Startup cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}
