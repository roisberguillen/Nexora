export interface LocalHostConnection {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly appUrl?: string;
  readonly runtimeState?: "running" | "offline" | "error";
  readonly syncState?: "idle" | "syncing" | "conflict" | "offline" | "error";
  readonly syncCursor?: number;
}

export interface LocalHostHealth {
  readonly apiVersion: number;
  readonly appUrl?: string;
  readonly runtimeState: "running";
  readonly binding: "loopback" | "lan";
  readonly address?: string;
  readonly syncState?: "idle" | "syncing" | "conflict" | "offline" | "error";
  readonly syncCursor?: number;
}

const storageKey = "nexora.local-host-connection.v1";
const defaults: LocalHostConnection = Object.freeze({
  enabled: false,
  endpoint: "http://127.0.0.1:43173",
});

export function readLocalHostConnection(
  storage: Pick<Storage, "getItem"> = localStorage,
): LocalHostConnection {
  try {
    const raw = storage.getItem(storageKey);
    if (raw === null) return defaults;
    const candidate = JSON.parse(raw) as Partial<LocalHostConnection>;
    return Object.freeze({
      enabled: candidate.enabled === true,
      endpoint: validUrl(candidate.endpoint) ? candidate.endpoint : defaults.endpoint,
      ...(validUrl(candidate.appUrl) ? { appUrl: candidate.appUrl } : {}),
      ...(candidate.runtimeState === "running" ? { runtimeState: "running" as const } : {}),
      ...(validSyncState(candidate.syncState) ? { syncState: candidate.syncState } : {}),
      ...(typeof candidate.syncCursor === "number" &&
      Number.isSafeInteger(candidate.syncCursor) &&
      candidate.syncCursor >= 0
        ? { syncCursor: candidate.syncCursor }
        : {}),
    });
  } catch {
    return defaults;
  }
}

export function writeLocalHostConnection(
  connection: LocalHostConnection,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(storageKey, JSON.stringify(connection));
}

export async function probeLocalHost(
  endpoint: string,
  request: typeof fetch = fetch,
): Promise<LocalHostHealth> {
  if (!validUrl(endpoint)) throw new Error("invalid_host_address");
  const response = await request(`${endpoint.replace(/\/$/, "")}/v1/health`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("host_unavailable");
  const body = (await response.json()) as Partial<LocalHostHealth> & { status?: string };
  if (
    body.status !== "ok" ||
    !Number.isSafeInteger(body.apiVersion) ||
    body.runtimeState !== "running" ||
    (body.binding !== "loopback" && body.binding !== "lan")
  )
    throw new Error("invalid_host_response");
  const apiVersion = body.apiVersion as number;
  return Object.freeze({
    apiVersion,
    runtimeState: "running",
    binding: body.binding,
    ...(validAddress(body.address) ? { address: body.address } : {}),
    ...(validSyncState(body.syncState) ? { syncState: body.syncState } : {}),
    ...(typeof body.syncCursor === "number" &&
    Number.isSafeInteger(body.syncCursor) &&
    body.syncCursor >= 0
      ? { syncCursor: body.syncCursor }
      : {}),
    ...(validUrl(body.appUrl) ? { appUrl: body.appUrl } : {}),
  });
}

function validUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.pathname === "/";
  } catch {
    return false;
  }
}

function validAddress(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 253 && !/[\s/]/.test(value)
  );
}

function validSyncState(value: unknown): value is NonNullable<LocalHostConnection["syncState"]> {
  return (
    value === "idle" ||
    value === "syncing" ||
    value === "conflict" ||
    value === "offline" ||
    value === "error"
  );
}
