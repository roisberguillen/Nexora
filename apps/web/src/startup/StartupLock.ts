export interface WebLockManager {
  request<T>(
    name: string,
    options: { readonly mode: "exclusive" },
    callback: () => Promise<T>,
  ): Promise<T>;
}

/** Serializes the critical open/migration path across tabs when Web Locks are available. */
export function withStartupLock<T>(
  action: () => Promise<T>,
  lockManager: WebLockManager | undefined = getWebLockManager(),
): Promise<T> {
  if (lockManager === undefined) return action();
  return lockManager.request("nexora-ledger-startup", { mode: "exclusive" }, action);
}

function getWebLockManager(): WebLockManager | undefined {
  const candidate = typeof navigator === "undefined" ? undefined : navigator.locks;
  return candidate === undefined ? undefined : (candidate as unknown as WebLockManager);
}
