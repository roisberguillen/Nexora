import type { TrashedTransaction } from "@nexora/domain";

export const DEFAULT_TRASH_RETENTION_DAYS = 30;

/**
 * Retention is intentionally a review signal: the PWA never purges data while
 * closed or in the background. The user must explicitly confirm the purge.
 */
export function isTrashEntryExpired(
  entry: TrashedTransaction,
  retentionDays: number,
  now: Date = new Date(),
): boolean {
  const expiresAt = new Date(entry.deletedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + retentionDays);
  return expiresAt.getTime() <= now.getTime();
}

export function countExpiredTrashEntries(
  entries: readonly TrashedTransaction[],
  retentionDays: number,
  now: Date = new Date(),
): number {
  return entries.filter((entry) => isTrashEntryExpired(entry, retentionDays, now)).length;
}
