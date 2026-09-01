import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAppLock,
  getAppLockTimeoutMilliseconds,
  readAppLock,
  removeAppLock,
  verifyAppLock,
} from "./appLock";
const storageValues = new Map<string, string>();
const storage = {
  getItem: (key: string) => storageValues.get(key) ?? null,
  removeItem: (key: string) => storageValues.delete(key),
  setItem: (key: string, value: string) => storageValues.set(key, value),
};
describe("app lock", () => {
  beforeEach(() => {
    storageValues.clear();
  });
  it("stores a verifier and never the configured passphrase", async () => {
    const config = await createAppLock("4937", 5, storage);
    expect(config.iterations).toBe(600_000);
    expect(JSON.stringify(config)).not.toContain("4937");
    expect(await verifyAppLock("4937", config)).toBe(true);
    expect(await verifyAppLock("0000", config)).toBe(false);
  });
  it("only accepts a valid versioned configuration and can remove it", async () => {
    expect(readAppLock(storage)).toBeUndefined();
    await createAppLock("passphrase", 15, storage);
    expect(readAppLock(storage)?.timeoutMinutes).toBe(15);
    removeAppLock(storage);
    expect(readAppLock(storage)).toBeUndefined();
  });

  it("uses an explicit and bounded inactivity timeout", async () => {
    const config = await createAppLock("passphrase", 15, storage);
    expect(getAppLockTimeoutMilliseconds(config)).toBe(900_000);
  });

  it("fails closed for malformed or unreadable storage", () => {
    storageValues.set("nexora.app-lock.v1", JSON.stringify({ version: 1, salt: "broken" }));
    const malformedConfig = readAppLock(storage);
    expect(malformedConfig).toBeDefined();
    return expect(verifyAppLock("4937", malformedConfig!)).resolves.toBe(false);
  });

  it("fails closed when browser storage is unreadable", () => {
    expect(
      readAppLock({
        getItem: () => {
          throw new Error("storage blocked");
        },
        removeItem: vi.fn(),
        setItem: vi.fn(),
      }),
    ).toBeDefined();
  });
});
