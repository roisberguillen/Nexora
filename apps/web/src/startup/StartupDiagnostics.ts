import type { BrowserLedgerStorageKind } from "@nexora/database";

import type { StorageArchiveInspection } from "./StorageDiscovery";
import type {
  StartupErrorCode,
  StartupFailureCategory,
  StartupFailureDetail,
  StartupProgressPhase,
} from "./StartupOrchestrator";

export interface StartupDiagnosticsInput {
  readonly appVersion: string;
  readonly buildId: string;
  readonly selectedBackend?: BrowserLedgerStorageKind;
  readonly archives: readonly StorageArchiveInspection[];
  readonly errorCode?: StartupErrorCode;
  readonly failureCategory?: StartupFailureCategory;
  readonly phase?: StartupProgressPhase | StartupFailureDetail["phase"];
  readonly errorName?: string;
  readonly safeMessage?: string;
  readonly now?: () => Date;
  readonly userAgent?: string;
  readonly platform?: string;
  readonly capabilities?: {
    readonly worker: boolean;
    readonly opfs: boolean;
    readonly indexedDb: boolean;
    readonly crossOriginIsolated: boolean;
    readonly webAssembly: boolean;
  };
}

export interface StartupDiagnosticsReport {
  readonly appVersion: string;
  readonly buildId: string;
  readonly browser: string;
  readonly operatingSystem: string;
  readonly capabilities: {
    readonly worker: boolean;
    readonly opfs: boolean;
    readonly indexedDb: boolean;
    readonly crossOriginIsolated: boolean;
    readonly webAssembly: boolean;
  };
  readonly selectedBackend?: BrowserLedgerStorageKind;
  readonly archives: readonly Pick<
    StorageArchiveInspection,
    "kind" | "available" | "state" | "schemaVersion" | "lastCheckedAt"
  >[];
  readonly errorCode?: StartupErrorCode;
  readonly failureCategory?: StartupFailureCategory;
  readonly phase?: StartupProgressPhase | StartupFailureDetail["phase"];
  readonly errorName?: string;
  readonly safeMessage?: string;
  readonly timestamp: string;
}

export function createStartupDiagnostics(input: StartupDiagnosticsInput): StartupDiagnosticsReport {
  const navigatorInfo = typeof navigator === "undefined" ? undefined : navigator;
  return {
    appVersion: input.appVersion,
    buildId: input.buildId,
    browser: input.userAgent ?? navigatorInfo?.userAgent ?? "unknown",
    operatingSystem: input.platform ?? navigatorInfo?.platform ?? "unknown",
    capabilities: input.capabilities ?? {
      worker: typeof Worker !== "undefined",
      opfs: typeof navigatorInfo?.storage?.getDirectory === "function",
      indexedDb: typeof indexedDB !== "undefined",
      crossOriginIsolated: globalThis.crossOriginIsolated === true,
      webAssembly: typeof WebAssembly !== "undefined",
    },
    ...(input.selectedBackend === undefined ? {} : { selectedBackend: input.selectedBackend }),
    archives: input.archives.map(({ kind, available, state, schemaVersion, lastCheckedAt }) => ({
      kind,
      available,
      state,
      lastCheckedAt,
      ...(schemaVersion === undefined ? {} : { schemaVersion }),
    })),
    ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode }),
    ...(input.failureCategory === undefined ? {} : { failureCategory: input.failureCategory }),
    ...(input.errorName === undefined ? {} : { errorName: input.errorName }),
    ...(input.safeMessage === undefined ? {} : { safeMessage: input.safeMessage }),
    ...(input.phase === undefined ? {} : { phase: input.phase }),
    timestamp: (input.now ?? (() => new Date()))().toISOString(),
  };
}

export function serializeStartupDiagnostics(report: StartupDiagnosticsReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
