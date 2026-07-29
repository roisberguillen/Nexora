import { PersistenceError, type BrowserLedger } from "@nexora/database";

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

export type StartupErrorCode = "NX-START-001" | "NX-STORAGE-001" | "NX-MIGRATION-001";

export interface StartupFailure {
  readonly code: StartupErrorCode;
  readonly kind: "recoverable" | "blocking";
  readonly cause: unknown;
}

export interface StartupRunResult {
  readonly ledger?: BrowserLedger;
  readonly state: StartupState;
  readonly failure?: StartupFailure;
}

export interface StartupOrchestratorDependencies {
  readonly openLedger: () => Promise<BrowserLedger>;
  readonly validateEnvironment?: () => void | Promise<void>;
  readonly validateLedger?: (ledger: BrowserLedger) => void | Promise<void>;
  readonly runMigrations?: (ledger: BrowserLedger) => void | Promise<void>;
  readonly verifyData?: (ledger: BrowserLedger) => void | Promise<void>;
  readonly now?: () => Date;
}

export class StartupOrchestrator {
  private state: StartupState = "BOOTING";

  public constructor(private readonly dependencies: StartupOrchestratorDependencies) {}

  public async run(onProgress?: (event: StartupProgressEvent) => void): Promise<StartupRunResult> {
    try {
      await this.transition("CHECKING_ENVIRONMENT", "environment", onProgress, () =>
        this.dependencies.validateEnvironment?.(),
      );
      await this.transition("DISCOVERING_STORAGE", "storage", onProgress);
      const ledger = await this.transition("OPENING_EXISTING_STORAGE", "storage", onProgress, () =>
        this.dependencies.openLedger(),
      );
      await this.transition("VALIDATING_LEDGER", "validation", onProgress, () =>
        this.dependencies.validateLedger?.(ledger),
      );
      await this.transition("RUNNING_MIGRATIONS", "migration", onProgress, () =>
        this.dependencies.runMigrations?.(ledger),
      );
      await this.transition("VERIFYING_DATA", "verification", onProgress, () =>
        this.dependencies.verifyData?.(ledger),
      );
      this.emit("READY", "ready", onProgress);
      return { ledger, state: this.state };
    } catch (cause) {
      const failure = classifyStartupError(cause);
      this.emit(
        failure.kind === "recoverable" ? "RECOVERABLE_ERROR" : "BLOCKING_ERROR",
        "verification",
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
    return (await action?.()) as T;
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

export function classifyStartupError(cause: unknown): StartupFailure {
  if (cause instanceof PersistenceError) {
    if (cause.code === "upgrade_blocked") {
      return { code: "NX-MIGRATION-001", kind: "recoverable", cause };
    }
    if (
      cause.code === "opfs_unavailable" ||
      cause.code === "indexeddb_unavailable" ||
      cause.code === "worker_failed"
    ) {
      return { code: "NX-STORAGE-001", kind: "recoverable", cause };
    }
  }
  return { code: "NX-START-001", kind: "blocking", cause };
}
