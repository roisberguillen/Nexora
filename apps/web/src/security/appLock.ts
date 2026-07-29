const APP_LOCK_STORAGE_KEY = "nexora.app-lock.v1";
export const APP_LOCK_PBKDF2_ITERATIONS = 600_000;

export interface AppLockConfig {
  readonly version: 1;
  readonly iterations: number;
  readonly salt: string;
  readonly verifier: string;
  readonly timeoutMinutes: 1 | 5 | 15;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readAppLock(storage: StorageLike = window.localStorage): AppLockConfig | undefined {
  const raw = storage.getItem(APP_LOCK_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    return isAppLockConfig(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function createAppLock(
  passphrase: string,
  timeoutMinutes: AppLockConfig["timeoutMinutes"],
  storage: StorageLike = window.localStorage,
): Promise<AppLockConfig> {
  if (passphrase.length < 4)
    throw new Error("Il PIN o la passphrase deve contenere almeno 4 caratteri.");
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const config: AppLockConfig = {
    version: 1,
    iterations: APP_LOCK_PBKDF2_ITERATIONS,
    salt: bytesToBase64(saltBytes),
    verifier: bytesToBase64(await deriveVerifier(passphrase, saltBytes)),
    timeoutMinutes,
  };
  storage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(config));
  return config;
}

export async function verifyAppLock(passphrase: string, config: AppLockConfig): Promise<boolean> {
  return constantTimeEqual(
    base64ToBytes(config.verifier),
    await deriveVerifier(passphrase, base64ToBytes(config.salt), config.iterations),
  );
}
export function removeAppLock(storage: StorageLike = window.localStorage): void {
  storage.removeItem(APP_LOCK_STORAGE_KEY);
}

export function getAppLockTimeoutMilliseconds(config: AppLockConfig): number {
  return config.timeoutMinutes * 60_000;
}

function isAppLockConfig(value: unknown): value is AppLockConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    candidate.iterations === APP_LOCK_PBKDF2_ITERATIONS &&
    typeof candidate.salt === "string" &&
    typeof candidate.verifier === "string" &&
    (candidate.timeoutMinutes === 1 ||
      candidate.timeoutMinutes === 5 ||
      candidate.timeoutMinutes === 15)
  );
}
async function deriveVerifier(
  passphrase: string,
  salt: Uint8Array,
  iterations = APP_LOCK_PBKDF2_ITERATIONS,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations },
      material,
      256,
    ),
  );
}
function bytesToBase64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}
function base64ToBytes(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1)
    difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}
