export interface StorageQuotaEstimate {
  readonly usage: number;
  readonly quota: number;
}

export interface StorageQuotaStatus extends StorageQuotaEstimate {
  readonly available: boolean;
  readonly usageRatio: number | null;
  readonly atRisk: boolean;
}

const defaultRiskThreshold = 0.9;

export async function estimateStorageQuota(
  storageManager: Pick<StorageManager, "estimate"> | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.storage,
  riskThreshold = defaultRiskThreshold,
): Promise<StorageQuotaStatus> {
  if (storageManager === undefined || typeof storageManager.estimate !== "function") {
    return { available: false, usage: 0, quota: 0, usageRatio: null, atRisk: false };
  }
  const estimate = await storageManager.estimate();
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  const usageRatio = quota > 0 ? usage / quota : null;
  return {
    available: quota > 0,
    usage,
    quota,
    usageRatio,
    atRisk: usageRatio !== null && usageRatio >= riskThreshold,
  };
}
