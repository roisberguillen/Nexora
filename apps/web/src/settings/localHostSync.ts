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

const queueKey = "nexora.local-sync-queue.v1";

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
    return readQueue(this.storage);
  }

  public enqueue(operation: LocalSyncOperation): void {
    const queue = readQueue(this.storage);
    if (queue.some((candidate) => candidate.idempotencyKey === operation.idempotencyKey)) return;
    this.storage.setItem(queueKey, JSON.stringify([...queue, operation]));
  }

  public async flush(): Promise<LocalSyncFlushResult> {
    const queue = readQueue(this.storage);
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
    const conflict = results.some((result) => result.Conflict !== undefined);
    if (conflict) return { status: "conflict", pendingCount: queue.length };
    this.storage.setItem(queueKey, "[]");
    const duplicate =
      results.length > 0 && results.every((result) => result.Duplicate !== undefined);
    return { status: duplicate ? "duplicate" : "applied", pendingCount: 0 };
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

function readQueue(storage: LocalSyncStorage): LocalSyncOperation[] {
  try {
    const raw = storage.getItem(queueKey);
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
