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

export const SUPPORTED_LOCAL_HOST_API_VERSION = 1;

export interface LocalHostCredentials {
  readonly deviceId: string;
  readonly deviceToken: string;
}

export interface LocalHostPairingRequest {
  readonly grantId: string;
  readonly code: string;
  readonly deviceId: string;
  readonly deviceToken: string;
  readonly hostFingerprint: string;
}

export interface LocalHostPairingInvite {
  readonly endpoint?: string;
  readonly grantId: string;
  readonly code: string;
  readonly hostFingerprint: string;
}

export function parseLocalHostPairingInvite(raw: string): LocalHostPairingInvite {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("invalid_pairing_invite");
  }
  if (typeof value !== "object" || value === null) throw new Error("invalid_pairing_invite");
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.grantId !== "string" ||
    candidate.grantId.length < 8 ||
    typeof candidate.code !== "string" ||
    candidate.code.length < 8 ||
    typeof candidate.hostFingerprint !== "string" ||
    candidate.hostFingerprint.length === 0
  ) {
    throw new Error("invalid_pairing_invite");
  }
  return Object.freeze({
    ...(typeof candidate.endpoint === "string" ? { endpoint: candidate.endpoint } : {}),
    grantId: candidate.grantId,
    code: candidate.code,
    hostFingerprint: candidate.hostFingerprint,
  });
}

export function createLocalHostDeviceCredentials(deviceId = `device-${crypto.randomUUID()}`): {
  readonly deviceId: string;
  readonly deviceToken: string;
} {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const deviceToken = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return Object.freeze({ deviceId, deviceToken });
}

export interface LocalHostSessionRequest {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export async function redeemLocalHostPairing(
  endpoint: string,
  pairing: LocalHostPairingRequest,
  request: LocalHostSessionRequest = fetch,
): Promise<LocalHostCredentials> {
  const response = await request(`${trimEndpoint(endpoint)}/v1/pairing/redeem`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_id: pairing.grantId,
      code: pairing.code,
      device_id: pairing.deviceId,
      device_token: pairing.deviceToken,
      host_fingerprint: pairing.hostFingerprint,
    }),
  });
  if (!response.ok) throw new Error(`host_pairing_failed_${response.status}`);
  return Object.freeze({
    deviceId: pairing.deviceId,
    deviceToken: pairing.deviceToken,
  });
}

export async function revokeLocalHostDevice(
  endpoint: string,
  credentials: LocalHostCredentials,
  targetDeviceId: string,
  request: LocalHostSessionRequest = fetch,
): Promise<void> {
  const response = await request(`${trimEndpoint(endpoint)}/v1/pairing/revoke`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requester_device_id: credentials.deviceId,
      requester_device_token: credentials.deviceToken,
      target_device_id: targetDeviceId,
    }),
  });
  if (!response.ok) throw new Error(`host_device_revoke_failed_${response.status}`);
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
  const body = (await response.json()) as Partial<LocalHostHealth> & {
    status?: string;
    api_version?: number;
    app_url?: string;
    runtime_state?: string;
    sync_state?: string;
    sync_cursor?: number;
  };
  const apiVersion = body.apiVersion ?? body.api_version;
  const runtimeState = body.runtimeState ?? body.runtime_state;
  const appUrl = body.appUrl ?? body.app_url;
  const syncState = body.syncState ?? body.sync_state;
  const syncCursor = body.syncCursor ?? body.sync_cursor;
  if (
    body.status !== "ok" ||
    !Number.isSafeInteger(apiVersion) ||
    runtimeState !== "running" ||
    (body.binding !== "loopback" && body.binding !== "lan")
  )
    throw new Error("invalid_host_response");
  if (apiVersion !== SUPPORTED_LOCAL_HOST_API_VERSION) {
    throw new Error("host_protocol_version_mismatch");
  }
  return Object.freeze({
    apiVersion,
    runtimeState: "running",
    binding: body.binding,
    ...(validAddress(body.address) ? { address: body.address } : {}),
    ...(validSyncState(syncState) ? { syncState } : {}),
    ...(typeof syncCursor === "number" && Number.isSafeInteger(syncCursor) && syncCursor >= 0
      ? { syncCursor }
      : {}),
    ...(validUrl(appUrl) ? { appUrl } : {}),
  });
}

export async function configureLocalHostPasscode(
  endpoint: string,
  credentials: LocalHostCredentials,
  passcode: string,
  salt: Uint8Array,
  request: LocalHostSessionRequest = fetch,
): Promise<void> {
  const response = await request(`${trimEndpoint(endpoint)}/v1/session/configure`, {
    method: "POST",
    cache: "no-store",
    headers: sessionHeaders(credentials),
    body: JSON.stringify({
      device_id: credentials.deviceId,
      device_token: credentials.deviceToken,
      passcode,
      salt: [...salt],
    }),
  });
  if (!response.ok) throw new Error(`host_session_configure_failed_${response.status}`);
}

export async function unlockLocalHostSession(
  endpoint: string,
  credentials: LocalHostCredentials,
  passcode: string,
  sessionToken: string,
  ttlMs = 15 * 60 * 1000,
  request: LocalHostSessionRequest = fetch,
): Promise<string> {
  const response = await request(`${trimEndpoint(endpoint)}/v1/session/unlock`, {
    method: "POST",
    cache: "no-store",
    headers: sessionHeaders(credentials),
    body: JSON.stringify({
      device_id: credentials.deviceId,
      device_token: credentials.deviceToken,
      passcode,
      session_token: sessionToken,
      now_ms: 0,
      ttl_ms: ttlMs,
    }),
  });
  if (!response.ok) throw new Error(`host_session_unlock_failed_${response.status}`);
  return sessionToken;
}

export async function logoutLocalHostSession(
  endpoint: string,
  deviceId: string,
  sessionToken: string,
  request: LocalHostSessionRequest = fetch,
): Promise<void> {
  const response = await request(`${trimEndpoint(endpoint)}/v1/session/logout`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, session_token: sessionToken, now_ms: 0 }),
  });
  if (!response.ok) throw new Error(`host_session_logout_failed_${response.status}`);
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

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/$/, "");
}

function sessionHeaders(credentials: LocalHostCredentials): HeadersInit {
  return {
    authorization: `Bearer ${credentials.deviceToken}`,
    "x-nexora-device-id": credentials.deviceId,
    "content-type": "application/json",
  };
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
