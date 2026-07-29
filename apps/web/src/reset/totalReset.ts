import type { CloudBackupMetadata, CloudBackupProvider } from "../cloud/cloudTypes";

export interface TotalResetReport {
  readonly local: "succeeded" | "failed";
  readonly cloudRequested: boolean;
  readonly cloudDeleted: number;
  readonly cloudRemaining: number;
  readonly cloudErrors: readonly string[];
}
const reportKey = "nexora.total-reset-report.v1";
export function writeTotalResetReport(
  report: TotalResetReport,
  storage: Pick<Storage, "setItem"> = sessionStorage,
): void {
  storage.setItem(reportKey, JSON.stringify(report));
}
export function readTotalResetReport(
  storage: Pick<Storage, "getItem"> = sessionStorage,
): TotalResetReport | undefined {
  try {
    const value: unknown = JSON.parse(storage.getItem(reportKey) ?? "null");
    if (!value || typeof value !== "object") return undefined;
    const report = value as Partial<TotalResetReport>;
    return report.local === "succeeded" || report.local === "failed"
      ? (report as TotalResetReport)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Local cleanup is authoritative; cloud cleanup is best-effort and never changes its outcome. */
export async function runTotalReset(input: {
  readonly resetLocal: () => Promise<void>;
  readonly cloud?: Pick<CloudBackupProvider, "list" | "delete">;
  readonly deleteCloud: boolean;
}): Promise<TotalResetReport> {
  try {
    await input.resetLocal();
  } catch {
    return Object.freeze({
      local: "failed",
      cloudRequested: input.deleteCloud,
      cloudDeleted: 0,
      cloudRemaining: 0,
      cloudErrors: Object.freeze([]),
    });
  }
  if (!input.deleteCloud || input.cloud === undefined) {
    return Object.freeze({
      local: "succeeded",
      cloudRequested: input.deleteCloud,
      cloudDeleted: 0,
      cloudRemaining: 0,
      cloudErrors: Object.freeze(input.deleteCloud ? ["cloud_not_configured"] : []),
    });
  }
  let backups: readonly CloudBackupMetadata[];
  try {
    backups = await input.cloud.list();
  } catch (error) {
    return Object.freeze({
      local: "succeeded",
      cloudRequested: true,
      cloudDeleted: 0,
      cloudRemaining: 0,
      cloudErrors: Object.freeze([errorMessage(error)]),
    });
  }
  const results = await Promise.allSettled(backups.map((backup) => input.cloud!.delete(backup.id)));
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => errorMessage(result.reason));
  return Object.freeze({
    local: "succeeded",
    cloudRequested: true,
    cloudDeleted: results.length - errors.length,
    cloudRemaining: errors.length,
    cloudErrors: Object.freeze(errors),
  });
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "cloud_network_error";
}
