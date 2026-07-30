export type LocalHostBinding = "loopback" | "lan";

export interface LocalHostPolicy {
  readonly binding: LocalHostBinding;
  readonly lanConsent: boolean;
  readonly allowedOrigins: readonly string[];
}

export interface PairingGrant {
  readonly deviceId: string;
  readonly hostFingerprint: string;
  readonly token: string;
  readonly expiresAt: string;
}

export class LocalSyncSecurityError extends Error {
  public constructor(public readonly code: "lan_consent_required" | "pairing_rejected" | "token_expired" | "untrusted_host" | "unauthorized_origin") {
    super(code);
    this.name = "LocalSyncSecurityError";
  }
}

/** Enforces an opt-in LAN surface. Loopback remains the only default binding. */
export function validateLocalHostPolicy(policy: LocalHostPolicy): void {
  if (policy.binding === "lan" && !policy.lanConsent) {
    throw new LocalSyncSecurityError("lan_consent_required");
  }
  if (policy.allowedOrigins.some((origin) => !isSafeLocalOrigin(origin))) {
    throw new LocalSyncSecurityError("unauthorized_origin");
  }
}

/** Issues a short-lived single-device grant after an out-of-band pairing confirmation. */
export function issuePairingGrant(input: {
  readonly deviceId: string;
  readonly hostFingerprint: string;
  readonly now: Date;
  readonly randomToken: () => string;
  readonly ttlMs?: number;
}): PairingGrant {
  if (!isIdentifier(input.deviceId) || !isFingerprint(input.hostFingerprint)) {
    throw new LocalSyncSecurityError("pairing_rejected");
  }
  const token = input.randomToken();
  if (token.length < 24) throw new LocalSyncSecurityError("pairing_rejected");
  const ttlMs = input.ttlMs ?? 10 * 60 * 1000;
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 60 * 60 * 1000) {
    throw new LocalSyncSecurityError("pairing_rejected");
  }
  return {
    deviceId: input.deviceId,
    hostFingerprint: input.hostFingerprint,
    token,
    expiresAt: new Date(input.now.getTime() + ttlMs).toISOString(),
  };
}

/** Validates every request against the paired device, host identity and allowed web origin. */
export function authorizeLocalRequest(input: {
  readonly grant: PairingGrant;
  readonly deviceId: string;
  readonly token: string;
  readonly hostFingerprint: string;
  readonly origin: string;
  readonly policy: LocalHostPolicy;
  readonly now: Date;
}): void {
  validateLocalHostPolicy(input.policy);
  if (!input.policy.allowedOrigins.includes(input.origin)) {
    throw new LocalSyncSecurityError("unauthorized_origin");
  }
  if (input.grant.deviceId !== input.deviceId || input.grant.token !== input.token) {
    throw new LocalSyncSecurityError("pairing_rejected");
  }
  if (input.grant.hostFingerprint !== input.hostFingerprint) {
    throw new LocalSyncSecurityError("untrusted_host");
  }
  if (Date.parse(input.grant.expiresAt) <= input.now.getTime()) {
    throw new LocalSyncSecurityError("token_expired");
  }
}

function isSafeLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isIdentifier(value: string): boolean {
  return /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

function isFingerprint(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}
