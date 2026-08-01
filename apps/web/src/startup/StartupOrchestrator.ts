import { MigrationError, PersistenceError, type BrowserLedger } from "@nexora/database";

import { StartupRecoveryRequiredError } from "./StartupRecovery";

export const startupStates = [
  "BOOTING",
  "CHECKING_ENVIRONMENT",
  "DISCOVERING_STORAGE",
  "OPENING_EXISTING_STORAGE",
  "VALIDATING_LEDGER",
  "RUNNING_MIGRATIONS",
  "VERIFYING_DATA",
  "READY",
  "RECOVERABLE_ERROR",
  "BLOCKING_ERROR",
] as const;

export type StartupState = (typeof startupStates)[number];

export type StartupProgressPhase =
  "environment" | "storage" | "validation" | "migration" | "verification" | "ready";

export interface StartupProgressEvent {
  readonly state: StartupState;
  readonly phase: StartupProgressPhase;
  readonly occurredAt: string;
}

export type StartupErrorCode =
  | "NX-START-001"
  | "NX-STORAGE-001"
  | "NX-MIGRATION-001"
  | "NX-MODEL-001"
  | "NX-TIMEOUT-001"
  | "NX-DATABASE-001"
  | "NX-RECOVERY-001";

export type StartupFailureCategory =
  | "unknown"
  | "opfs-open"
  | "indexeddb-open"
  | "migration"
  | "timeout"
  | "database-incompatible"
  | "model-loading"
  | "guided-recovery";

export interface StartupFailureDetail {
  readonly phase:
    | "environment"
    | "discovery"
    | "selection"
    | "opening"
    | "migration"
    | "verification"
    | "read-model"
    | "ui-model";
  readonly backend: "opfs" | "indexeddb" | "unknown";
  readonly errorCode: string;
  readonly errorName: string;
  readonly safeMessage: string;
  readonly occurredAt: string;
}

export interface StartupFailure {
  readonly category: StartupFailureCategory;
  readonly code: StartupErrorCode;
  readonly kind: "recoverable" | "blocking";
  readonly cause: unknown;
  readonly detail: StartupFailureDetail;
}

export class StartupModelLoadError extends Error {
  public constructor(cause: unknown) {
    super("Nexora could not build the application models from the local ledger.", { cause });
    this.name = "StartupModelLoadError";
  }
}

class StartupTimeoutError extends Error {
  public constructor(readonly phase: StartupProgressPhase) {
    super(`Startup ${phase} timed out.`);
    this.name = "StartupTimeoutError";
  }
}

export interface StartupRunResult {
  readonly ledger?: BrowserLedger;
  readonly state: StartupState;
  readonly failure?: StartupFailure;
}

export interface StartupOrchestratorDependencies {
  readonly openLedger: () => Promise<BrowserLedger>;
  readonly discoverStorage?: () => void | Promise<void>;
  readonly validateEnvironment?: () => void | Promise<void>;
  readonly validateLedger?: (ledger: BrowserLedger) => void | Promise<void>;
  readonly runMigrations?: (ledger: BrowserLedger) => void | Promise<void>;
  readonly verifyData?: (ledger: BrowserLedger) => void | Promise<void>;
  readonly timeouts?: Partial<Record<StartupProgressPhase, number>>;
  readonly now?: () => Date;
}

export class StartupOrchestrator {
  private state: StartupState = "BOOTING";
  private running: Promise<StartupRunResult> | undefined;

  public constructor(private readonly dependencies: StartupOrchestratorDependencies) {}

  public async run(onProgress?: (event: StartupProgressEvent) => void): Promise<StartupRunResult> {
    if (this.running !== undefined) {
      return this.running;
    }

    this.running = this.runOnce(onProgress);
    return this.running;
  }

  private async runOnce(
    onProgress?: (event: StartupProgressEvent) => void,
  ): Promise<StartupRunResult> {
    let ledger: BrowserLedger | undefined;
    let lastPhase: StartupProgressPhase = "environment";
    try {
      lastPhase = "environment";
      await this.transition("CHECKING_ENVIRONMENT", "environment", onProgress, () =>
        this.dependencies.validateEnvironment?.(),
      );
      lastPhase = "storage";
      await this.transition("DISCOVERING_STORAGE", "storage", onProgress, () =>
        this.dependencies.discoverStorage?.(),
      );
      lastPhase = "storage";
      ledger = await this.transition("OPENING_EXISTING_STORAGE", "storage", onProgress, () =>
        this.dependencies.openLedger(),
      );
      lastPhase = "validation";
      const openedLedger = ledger;
      await this.transition("VALIDATING_LEDGER", "validation", onProgress, () =>
        this.dependencies.validateLedger?.(openedLedger),
      );
      lastPhase = "migration";
      await this.transition("RUNNING_MIGRATIONS", "migration", onProgress, () =>
        this.dependencies.runMigrations?.(openedLedger),
      );
      lastPhase = "verification";
      await this.transition("VERIFYING_DATA", "verification", onProgress, () =>
        this.dependencies.verifyData?.(openedLedger),
      );
      this.emit("READY", "ready", onProgress);
      return { ledger: openedLedger, state: this.state };
    } catch (cause) {
      await closeOpenedLedger(ledger);
      const failure = classifyStartupError(cause, lastPhase);
      this.emit(
        failure.kind === "recoverable" ? "RECOVERABLE_ERROR" : "BLOCKING_ERROR",
        lastPhase,
        onProgress,
      );
      return { state: this.state, failure };
    }
  }

  private async transition<T>(
    state: Exclude<StartupState, "BOOTING" | "READY" | "RECOVERABLE_ERROR" | "BLOCKING_ERROR">,
    phase: StartupProgressPhase,
    onProgress: ((event: StartupProgressEvent) => void) | undefined,
    action?: () => T | Promise<T>,
  ): Promise<T> {
    this.emit(state, phase, onProgress);
    return (await withTimeout(
      Promise.resolve(action?.()) as Promise<T>,
      this.dependencies.timeouts?.[phase],
      phase,
    )) as T;
  }

  private emit(
    state: StartupState,
    phase: StartupProgressPhase,
    onProgress: ((event: StartupProgressEvent) => void) | undefined,
  ): void {
    this.state = state;
    onProgress?.({
      state,
      phase,
      occurredAt: (this.dependencies.now ?? (() => new Date()))().toISOString(),
    });
  }
}

async function closeOpenedLedger(ledger: BrowserLedger | undefined): Promise<void> {
  if (typeof ledger?.close !== "function") return;
  await ledger.close().catch(() => undefined);
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  phase: StartupProgressPhase,
): Promise<T> {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new StartupTimeoutError(phase));
    }, timeoutMs);
    void promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function classifyStartupError(
  cause: unknown,
  progressPhase: StartupProgressPhase = "verification",
): StartupFailure {
  const createFailure = (
    category: StartupFailureCategory,
    code: StartupErrorCode,
    kind: "recoverable" | "blocking",
    phase: StartupFailureDetail["phase"],
    backend: StartupFailureDetail["backend"] = "unknown",
  ): StartupFailure => ({
    category,
    code,
    kind,
    cause,
    detail: {
      phase,
      backend,
      errorCode:
        cause instanceof Error && "code" in cause && typeof cause.code === "string"
          ? cause.code
          : code,
      errorName: cause instanceof Error ? cause.name : "UnknownError",
      safeMessage: safeStartupMessage(category),
      occurredAt: new Date().toISOString(),
    },
  });
  if (cause instanceof StartupRecoveryRequiredError) {
    return createFailure("guided-recovery", "NX-RECOVERY-001", "recoverable", "selection");
  }
  if (cause instanceof StartupModelLoadError) {
    const modelCause = cause.cause;
    const isRead = modelCause instanceof Error && modelCause.name === "LedgerReadError";
    return createFailure(
      "model-loading",
      "NX-MODEL-001",
      "recoverable",
      isRead ? "read-model" : "ui-model",
    );
  }
  if (cause instanceof StartupTimeoutError) {
    return createFailure(
      "timeout",
      "NX-TIMEOUT-001",
      "recoverable",
      toStartupDetailPhase(cause.phase),
    );
  }
  if (cause instanceof MigrationError) {
    return createFailure(
      cause.code === "unknown_database_version" || cause.code === "invalid_migration_history"
        ? "database-incompatible"
        : "migration",
      cause.code === "unknown_database_version" || cause.code === "invalid_migration_history"
        ? "NX-DATABASE-001"
        : "NX-MIGRATION-001",
      "recoverable",
      "migration",
    );
  }
  if (cause instanceof PersistenceError) {
    if (cause.code === "upgrade_blocked") {
      return createFailure("migration", "NX-MIGRATION-001", "recoverable", "migration");
    }
    if (cause.code === "opfs_unavailable") {
      return createFailure("opfs-open", "NX-STORAGE-001", "recoverable", "opening", "opfs");
    }
    if (cause.code === "indexeddb_unavailable") {
      return createFailure(
        "indexeddb-open",
        "NX-STORAGE-001",
        "recoverable",
        "opening",
        "indexeddb",
      );
    }
    if (cause.code === "worker_failed")
      return createFailure(
        "timeout",
        "NX-TIMEOUT-001",
        "recoverable",
        toStartupDetailPhase(progressPhase),
      );
    if (cause.code === "corrupt_record")
      return createFailure(
        "database-incompatible",
        "NX-DATABASE-001",
        "recoverable",
        "verification",
      );
  }
  return createFailure("unknown", "NX-START-001", "blocking", toStartupDetailPhase(progressPhase));
}

function toStartupDetailPhase(phase: StartupProgressPhase): StartupFailureDetail["phase"] {
  if (phase === "environment") return "environment";
  if (phase === "storage") return "discovery";
  if (phase === "migration") return "migration";
  return "verification";
}

function safeStartupMessage(category: StartupFailureCategory): string {
  if (category === "guided-recovery") return "È necessaria una selezione esplicita dell'archivio.";
  if (category === "migration") return "La migrazione locale non è stata completata.";
  if (category === "model-loading")
    return "L'archivio è stato aperto, ma la vista dati non è disponibile.";
  return "Nexora non ha potuto completare l'avvio in sicurezza.";
}
