import { describe, expect, it } from "vitest";

import {
  authorizeLocalRequest,
  issuePairingGrant,
  LocalSyncSecurityError,
  validateLocalHostPolicy,
} from "./localSyncSecurity";

const now = new Date("2026-07-30T10:00:00.000Z");
const fingerprint = `sha256:${"a".repeat(64)}`;
const policy = {
  binding: "lan" as const,
  lanConsent: true,
  allowedOrigins: ["https://nexora.local"],
};
const grant = issuePairingGrant({
  deviceId: "phone-001",
  hostFingerprint: fingerprint,
  now,
  randomToken: () => "x".repeat(32),
});

describe("local sync security", () => {
  it("keeps LAN disabled until the owner explicitly opts in", () => {
    expect(() => validateLocalHostPolicy({ ...policy, lanConsent: false })).toThrowError(
      LocalSyncSecurityError,
    );
  });

  it("rejects a mismatched pairing, host, origin and expired token", () => {
    const base = {
      grant,
      deviceId: "phone-001",
      token: grant.token,
      hostFingerprint: fingerprint,
      origin: "https://nexora.local",
      policy,
      now,
    };
    expect(() => authorizeLocalRequest({ ...base, token: "other" })).toThrow("pairing_rejected");
    expect(() =>
      authorizeLocalRequest({ ...base, hostFingerprint: `sha256:${"b".repeat(64)}` }),
    ).toThrow("untrusted_host");
    expect(() => authorizeLocalRequest({ ...base, origin: "https://evil.example" })).toThrow(
      "unauthorized_origin",
    );
    expect(() =>
      authorizeLocalRequest({ ...base, now: new Date("2026-07-30T11:00:00.000Z") }),
    ).toThrow("token_expired");
  });

  it("authorizes only the paired device during the grant lifetime", () => {
    expect(() =>
      authorizeLocalRequest({
        grant,
        deviceId: "phone-001",
        token: grant.token,
        hostFingerprint: fingerprint,
        origin: "https://nexora.local",
        policy,
        now,
      }),
    ).not.toThrow();
  });
});
