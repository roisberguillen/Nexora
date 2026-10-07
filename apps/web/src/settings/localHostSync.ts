export interface LocalSyncOperation {
  readonly idempotencyKey: string;
  readonly deviceId: string;
  readonly entityId: string;
  readonly baseRevision: number;
  readonly revision: number;
  readonly payloadDigest: string;
  readonly payload: string;
  readonly tombstone: boolean;
  readonly createdAt: string;
}

export interface LocalSyncCredentials {
  readonly deviceId: string;
  readonly token: string;
  readonly sessionToken?: string;
}

export interface LocalSyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LocalSyncRequest {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface LocalSyncClientOptions {
  readonly endpoint: string;
  readonly credentials: LocalSyncCredentials;
  readonly storage?: LocalSyncStorage;
  readonly request?: LocalSyncRequest;
  readonly deliveryId?: () => string;
}

export interface LocalLedgerSyncSink {
  recordSnapshot(payload: Uint8Array): Promise<void>;
}

export interface LocalSyncPullResult {
  readonly operations: readonly [number, LocalSyncOperation][];
}

export interface LocalSyncFlushResult {
  readonly status: "applied" | "duplicate" | "conflict";
  readonly pendingCount: number;
}

export interface LocalSyncBootstrapResult {
  readonly schemaVersion: number;
  readonly cursor: number;
  readonly operations: readonly [number, LocalSyncOperation][];
}

const queueKeyPrefix = "nexora.local-sync-queue.v1";
const cursorKeyPrefix = "nexora.local-sync-cursor.v1";

export class LocalHostSyncClient {
  private readonly storage: LocalSyncStorage;
  private readonly request: LocalSyncRequest;
  private readonly deliveryId: () => string;

  public constructor(private readonly options: LocalSyncClientOptions) {
    this.storage = options.storage ?? window.localStorage;
    this.request = options.request ?? fetch;
    this.deliveryId = options.deliveryId ?? (() => crypto.randomUUID());
  }

  public pending(): readonly LocalSyncOperation[] {
    return readQueue(this.storage, this.queueKey());
  }

  public deviceId(): string {
    return this.options.credentials.deviceId;
  }

  public cursor(): number {
    const raw = this.storage.getItem(this.cursorKey());
    if (raw === null) return 0;
    const cursor = Number(raw);
    return Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0;
  }

  public setCursor(cursor: number): void {
    if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error("invalid_sync_cursor");
    this.storage.setItem(this.cursorKey(), String(cursor));
  }

  public enqueue(operation: LocalSyncOperation): void {
    const queue = readQueue(this.storage, this.queueKey());
    if (queue.some((candidate) => candidate.idempotencyKey === operation.idempotencyKey)) return;
    this.storage.setItem(this.queueKey(), JSON.stringify([...queue, operation]));
  }

  public async flush(): Promise<LocalSyncFlushResult> {
    const queue = readQueue(this.storage, this.queueKey());
    if (queue.length === 0) return { status: "applied", pendingCount: 0 };
    const response = await this.request(`${trimEndpoint(this.options.endpoint)}/v1/operations`, {
      method: "POST",
      cache: "no-store",
      headers: headers(this.options.credentials),
      body: JSON.stringify({ delivery_id: this.deliveryId(), operations: queue }),
    });
    if (!response.ok) {
      if (response.status === 409) return { status: "conflict", pendingCount: queue.length };
      throw new Error(`sync_push_failed_${response.status}`);
    }
    const results = (await response.json()) as readonly OperationResult[];
    if (
      !Array.isArray(results) ||
      results.length !== queue.length ||
      results.some(
        (result) =>
          result === null ||
          typeof result !== "object" ||
          (result.Applied === undefined &&
            result.Duplicate === undefined &&
            result.Conflict === undefined),
      )
    ) {
      throw new Error("invalid_sync_push_response");
    }
    const conflict = results.some((result) => result.Conflict !== undefined);
    const remaining = queue.filter((_, index) => results[index]?.Conflict !== undefined);
    this.storage.setItem(this.queueKey(), JSON.stringify(remaining));
    if (conflict) return { status: "conflict", pendingCount: remaining.length };
    const duplicate =
      results.length > 0 && results.every((result) => result.Duplicate !== undefined);
    return { status: duplicate ? "duplicate" : "applied", pendingCount: 0 };
  }

  public async bootstrap(): Promise<LocalSyncBootstrapResult> {
    const response = await this.request(`${trimEndpoint(this.options.endpoint)}/v1/bootstrap`, {
      cache: "no-store",
      headers: headers(this.options.credentials),
    });
    if (!response.ok) throw new Error(`sync_bootstrap_failed_${response.status}`);
    const body = (await response.json()) as {
      schema_version?: unknown;
      cursor?: unknown;
      operations?: unknown;
    };
    const schemaVersion = typeof body.schema_version === "number" ? body.schema_version : undefined;
    const cursor = typeof body.cursor === "number" ? body.cursor : undefined;
    if (
      schemaVersion === undefined ||
      !Number.isSafeInteger(schemaVersion) ||
      schemaVersion < 1 ||
      cursor === undefined ||
      !Number.isSafeInteger(cursor) ||
      cursor < 0 ||
      !Array.isArray(body.operations)
    ) {
      throw new Error("invalid_sync_bootstrap_response");
    }
    const validSchemaVersion = schemaVersion as number;
    const validCursor = cursor as number;
    return Object.freeze({
      schemaVersion: validSchemaVersion,
      cursor: validCursor,
      operations: body.operations as readonly [number, LocalSyncOperation][],
    });
  }

  public async pull(after: number): Promise<LocalSyncPullResult> {
    if (!Number.isSafeInteger(after) || after < 0) throw new Error("invalid_sync_cursor");
    const response = await this.request(
      `${trimEndpoint(this.options.endpoint)}/v1/operations?after=${after}`,
      { cache: "no-store", headers: headers(this.options.credentials) },
    );
    if (!response.ok) throw new Error(`sync_pull_failed_${response.status}`);
    const body = (await response.json()) as { operations?: unknown };
    if (!Array.isArray(body.operations)) throw new Error("invalid_sync_pull_response");
    return Object.freeze({
      operations: body.operations as readonly [number, LocalSyncOperation][],
    });
  }

  private queueKey(): string {
    return `${queueKeyPrefix}:${trimEndpoint(this.options.endpoint)}:${this.options.credentials.deviceId}`;
  }

  private cursorKey(): string {
    return `${cursorKeyPrefix}:${trimEndpoint(this.options.endpoint)}:${this.options.credentials.deviceId}`;
  }
}

interface OperationResult {
  readonly Applied?: { readonly cursor: number; readonly revision: number };
  readonly Duplicate?: { readonly cursor: number; readonly revision: number };
  readonly Conflict?: { readonly current_revision: number };
}

function headers(credentials: LocalSyncCredentials): HeadersInit {
  return {
    authorization: `Bearer ${credentials.token}`,
    "x-nexora-device-id": credentials.deviceId,
    "content-type": "application/json",
    ...(credentials.sessionToken === undefined
      ? {}
      : { "x-nexora-session-token": credentials.sessionToken }),
  };
}

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/$/, "");
}

function readQueue(storage: LocalSyncStorage, key: string): LocalSyncOperation[] {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOperation);
  } catch {
    return [];
  }
}

function isOperation(value: unknown): value is LocalSyncOperation {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<LocalSyncOperation>;
  return (
    typeof candidate.idempotencyKey === "string" &&
    typeof candidate.deviceId === "string" &&
    typeof candidate.entityId === "string" &&
    Number.isSafeInteger(candidate.baseRevision) &&
    Number.isSafeInteger(candidate.revision) &&
    typeof candidate.payloadDigest === "string" &&
    typeof candidate.payload === "string" &&
    typeof candidate.tombstone === "boolean" &&
    typeof candidate.createdAt === "string"
  );
}
