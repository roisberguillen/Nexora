import { readLocalHostConnection, type LocalHostConnection } from "./localHostConnection";
import { readLocalHostCredentials } from "./localHostVault";

export type SavedRemoteCredentials = NonNullable<
  Awaited<ReturnType<typeof readLocalHostCredentials>>
>;

/** Never select a different ledger when a configured remote credential cannot be read. */
export async function loadRemoteLedgerCredentials(
  connection: LocalHostConnection = readLocalHostConnection(),
  readCredentials: typeof readLocalHostCredentials = readLocalHostCredentials,
  timeoutMs = 8_000,
): Promise<SavedRemoteCredentials | null> {
  if (!connection.enabled) return null;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const saved = await Promise.race([
      Promise.resolve().then(readCredentials),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("remote_credential_vault_timeout")),
          timeoutMs,
        );
      }),
    ]);
    if (saved === null || saved.endpoint !== connection.endpoint) {
      throw new Error("remote_credentials_unavailable");
    }
    return saved;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
