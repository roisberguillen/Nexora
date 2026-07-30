import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  authorizeLocalRequest,
  type LocalHostPolicy,
  type PairingGrant,
} from "@nexora/domain";

export interface LedgerMetadata {
  readonly ledgerId: string;
  readonly schemaVersion: number;
  readonly updatedAt: string;
}

export interface LocalSyncHostOptions {
  readonly policy: LocalHostPolicy;
  readonly hostFingerprint: string;
  readonly resolveGrant: (token: string) => PairingGrant | undefined;
  readonly ledgerMetadata: () => LedgerMetadata;
  readonly now?: () => Date;
}

/** Minimal versioned read API. Writes are deliberately deferred to the idempotent operation log. */
export function createLocalSyncHost(options: LocalSyncHostOptions) {
  const now = options.now ?? (() => new Date());
  const requests = new Map<string, { count: number; windowStartedAt: number }>();

  return createServer((request, response) => {
    const origin = request.headers.origin;
    if (origin !== undefined) response.setHeader("Vary", "Origin");
    if (request.method === "OPTIONS") return respondPreflight(response, origin, options.policy);
    if (request.method !== "GET") return respond(response, 405, { error: "method_not_allowed" });
    if (request.url === "/v1/health") return respond(response, 200, { status: "ok", apiVersion: 1 });
    if (request.url !== "/v1/ledger") return respond(response, 404, { error: "not_found" });
    const token = header(request, "authorization")?.replace(/^Bearer /, "");
    const deviceId = header(request, "x-nexora-device-id");
    if (token === undefined || deviceId === undefined || origin === undefined) return respond(response, 401, { error: "unauthorized" });
    if (!allowRequest(requests, deviceId, now().getTime())) return respond(response, 429, { error: "rate_limited" });
    const grant = options.resolveGrant(token);
    if (grant === undefined) return respond(response, 401, { error: "unauthorized" });
    try {
      authorizeLocalRequest({ grant, deviceId, token, hostFingerprint: options.hostFingerprint, origin, policy: options.policy, now: now() });
      response.setHeader("Access-Control-Allow-Origin", origin);
      return respond(response, 200, options.ledgerMetadata());
    } catch {
      return respond(response, 403, { error: "forbidden" });
    }
  });
}

/** Starts only on loopback. LAN startup is deferred until TLS material is configured. */
export async function startLocalSyncHost(
  options: LocalSyncHostOptions,
  port = 43173,
): Promise<ReturnType<typeof createLocalSyncHost>> {
  if (options.policy.binding !== "loopback") {
    throw new Error("lan_tls_configuration_required");
  }
  const server = createLocalSyncHost(options);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server;
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}

function respondPreflight(response: ServerResponse, origin: string | undefined, policy: LocalHostPolicy): void {
  if (origin === undefined || !policy.allowedOrigins.includes(origin)) return respond(response, 403, { error: "forbidden" });
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "authorization, x-nexora-device-id");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.statusCode = 204;
  response.end();
}

function respond(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function allowRequest(bucket: Map<string, { count: number; windowStartedAt: number }>, deviceId: string, timestamp: number): boolean {
  const current = bucket.get(deviceId);
  if (current === undefined || timestamp - current.windowStartedAt >= 60_000) {
    bucket.set(deviceId, { count: 1, windowStartedAt: timestamp });
    return true;
  }
  current.count += 1;
  return current.count <= 60;
}
