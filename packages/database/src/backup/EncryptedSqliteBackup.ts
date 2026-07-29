import { BackupError } from "./BackupError";

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_FILE_EXTENSION = ".nexora-backup";
export const PBKDF2_ITERATIONS = 600_000;

export interface BackupManifestFile {
  readonly path: "database.sqlite3" | "ledger.json";
  readonly sha256: string;
  readonly size: number;
}

export interface BackupManifest {
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly appVersion?: string;
  readonly files: readonly [BackupManifestFile];
}

export interface CreateEncryptedSqliteBackupOptions {
  readonly databaseBytes: Uint8Array;
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly passphrase: string;
  readonly appVersion?: string;
  readonly cryptoProvider?: Crypto;
}

export interface DecryptedSqliteBackup {
  readonly manifest: BackupManifest;
  readonly databaseBytes: Uint8Array;
}
export interface CreateEncryptedPayloadBackupOptions {
  readonly payloadBytes: Uint8Array;
  readonly path: BackupManifestFile["path"];
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly passphrase: string;
  readonly appVersion?: string;
  readonly cryptoProvider?: Crypto;
}
export interface DecryptedBackupPayload {
  readonly manifest: BackupManifest;
  readonly payloadBytes: Uint8Array;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const magic = textEncoder.encode("NEXORA-BACKUP-v1\n");
const saltLength = 16;
const ivLength = 12;
const iterationLength = 4;
const headerLength = magic.byteLength + iterationLength + saltLength + ivLength;
const authenticationTagLength = 16;
const maxDatabaseBytes = 512 * 1024 * 1024;
const maxManifestBytes = 64 * 1024;
const sha256Pattern = /^[a-f0-9]{64}$/;

export async function createEncryptedSqliteBackup(
  options: CreateEncryptedSqliteBackupOptions,
): Promise<Uint8Array> {
  return createEncryptedPayloadBackup({
    ...options,
    payloadBytes: options.databaseBytes,
    path: "database.sqlite3",
  });
}

export async function createEncryptedPayloadBackup(
  options: CreateEncryptedPayloadBackupOptions,
): Promise<Uint8Array> {
  validatePassphrase(options.passphrase);
  validatePayloadBytes(options.payloadBytes, options.path);
  validateSchemaVersion(options.schemaVersion);
  validateTimestamp(options.createdAt);
  validateAppVersion(options.appVersion);

  const cryptoProvider = options.cryptoProvider ?? globalThis.crypto;
  requireWebCrypto(cryptoProvider);
  const databaseBytes = options.payloadBytes.slice();
  const databaseChecksum = await sha256Hex(databaseBytes, cryptoProvider);
  const manifest: BackupManifest = Object.freeze({
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: options.schemaVersion,
    createdAt: options.createdAt,
    ...(options.appVersion === undefined ? {} : { appVersion: options.appVersion }),
    files: Object.freeze([
      Object.freeze({
        path: options.path,
        sha256: databaseChecksum,
        size: databaseBytes.byteLength,
      }),
    ]) as readonly [BackupManifestFile],
  });
  const plaintext = encodePlaintext(manifest, databaseBytes);
  const salt = cryptoProvider.getRandomValues(new Uint8Array(saltLength));
  const iv = cryptoProvider.getRandomValues(new Uint8Array(ivLength));
  const header = createHeader(salt, iv);
  const key = await deriveEncryptionKey(options.passphrase, salt, cryptoProvider);
  const ciphertext = await cryptoProvider.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(header),
      tagLength: 128,
    },
    key,
    toArrayBuffer(plaintext),
  );

  const archive = new Uint8Array(header.byteLength + ciphertext.byteLength);
  archive.set(header, 0);
  archive.set(new Uint8Array(ciphertext), header.byteLength);
  return archive;
}

export async function decryptSqliteBackup(
  archive: Uint8Array,
  passphrase: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<DecryptedSqliteBackup> {
  const decrypted = await decryptEncryptedPayloadBackup(archive, passphrase, cryptoProvider);
  if (decrypted.manifest.files[0].path !== "database.sqlite3")
    throw new BackupError("unsupported_backup", "The backup does not contain a SQLite database.");
  return { manifest: decrypted.manifest, databaseBytes: decrypted.payloadBytes };
}

export async function decryptEncryptedPayloadBackup(
  archive: Uint8Array,
  passphrase: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<DecryptedBackupPayload> {
  validatePassphrase(passphrase);
  requireWebCrypto(cryptoProvider);

  try {
    const parsed = parseArchive(archive);
    const key = await deriveEncryptionKey(passphrase, parsed.salt, cryptoProvider);
    const plaintext = await cryptoProvider.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(parsed.iv),
        additionalData: toArrayBuffer(parsed.header),
        tagLength: 128,
      },
      key,
      toArrayBuffer(parsed.ciphertext),
    );
    const decoded = decodePlaintext(new Uint8Array(plaintext));
    const checksum = await sha256Hex(decoded.databaseBytes, cryptoProvider);
    if (checksum !== decoded.manifest.files[0].sha256) {
      throw new BackupError(
        "invalid_archive",
        "The backup database checksum does not match its manifest.",
      );
    }
    return { manifest: decoded.manifest, payloadBytes: decoded.databaseBytes };
  } catch (cause) {
    if (cause instanceof BackupError) {
      throw cause;
    }
    throw new BackupError(
      "invalid_archive",
      "The backup is corrupted, tampered with, or protected by a different passphrase.",
      cause,
    );
  }
}

export async function sha256Hex(
  bytes: Uint8Array,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<string> {
  requireWebCrypto(cryptoProvider);
  const digest = await cryptoProvider.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function createHeader(salt: Uint8Array, iv: Uint8Array): Uint8Array {
  const header = new Uint8Array(headerLength);
  header.set(magic, 0);
  new DataView(header.buffer).setUint32(magic.byteLength, PBKDF2_ITERATIONS, false);
  header.set(salt, magic.byteLength + iterationLength);
  header.set(iv, magic.byteLength + iterationLength + saltLength);
  return header;
}

function parseArchive(archive: Uint8Array): {
  readonly header: Uint8Array;
  readonly salt: Uint8Array;
  readonly iv: Uint8Array;
  readonly ciphertext: Uint8Array;
} {
  if (
    !(archive instanceof Uint8Array) ||
    archive.byteLength < headerLength + authenticationTagLength ||
    archive.byteLength > maxDatabaseBytes + maxManifestBytes + headerLength + 64
  ) {
    throw new BackupError("invalid_archive", "The backup archive size is invalid.");
  }

  for (const [index, value] of magic.entries()) {
    if (archive[index] !== value) {
      throw new BackupError("unsupported_backup", "The backup format is not supported.");
    }
  }
  const iterations = new DataView(archive.buffer, archive.byteOffset, headerLength).getUint32(
    magic.byteLength,
    false,
  );
  if (iterations !== PBKDF2_ITERATIONS) {
    throw new BackupError(
      "unsupported_backup",
      "The backup key derivation parameters are not supported.",
    );
  }

  const saltStart = magic.byteLength + iterationLength;
  const ivStart = saltStart + saltLength;
  return {
    header: archive.slice(0, headerLength),
    salt: archive.slice(saltStart, ivStart),
    iv: archive.slice(ivStart, headerLength),
    ciphertext: archive.slice(headerLength),
  };
}

function encodePlaintext(manifest: BackupManifest, databaseBytes: Uint8Array): Uint8Array {
  const manifestBytes = textEncoder.encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > maxManifestBytes) {
    throw new BackupError("backup_failed", "The backup manifest is too large.");
  }

  const plaintext = new Uint8Array(4 + manifestBytes.byteLength + databaseBytes.byteLength);
  new DataView(plaintext.buffer).setUint32(0, manifestBytes.byteLength, false);
  plaintext.set(manifestBytes, 4);
  plaintext.set(databaseBytes, 4 + manifestBytes.byteLength);
  return plaintext;
}

function decodePlaintext(plaintext: Uint8Array): DecryptedSqliteBackup {
  if (plaintext.byteLength < 5) {
    throw new BackupError("invalid_archive", "The decrypted backup payload is incomplete.");
  }
  const manifestLength = new DataView(
    plaintext.buffer,
    plaintext.byteOffset,
    plaintext.byteLength,
  ).getUint32(0, false);
  if (
    manifestLength < 2 ||
    manifestLength > maxManifestBytes ||
    4 + manifestLength >= plaintext.byteLength
  ) {
    throw new BackupError("invalid_archive", "The backup manifest length is invalid.");
  }

  const manifestJson = textDecoder.decode(plaintext.slice(4, 4 + manifestLength));
  const manifest = parseManifest(JSON.parse(manifestJson) as unknown);
  const databaseBytes = plaintext.slice(4 + manifestLength);
  validatePayloadBytes(databaseBytes, manifest.files[0].path);
  if (manifest.files[0].size !== databaseBytes.byteLength) {
    throw new BackupError(
      "invalid_archive",
      "The backup database size does not match its manifest.",
    );
  }

  return {
    manifest,
    databaseBytes,
  };
}

function parseManifest(value: unknown): BackupManifest {
  if (typeof value !== "object" || value === null) {
    throw new BackupError("invalid_archive", "The backup manifest is invalid.");
  }
  const candidate = value as Record<string, unknown>;
  validateSchemaVersion(candidate.schemaVersion);
  validateTimestamp(candidate.createdAt);
  validateAppVersion(candidate.appVersion);
  if (
    candidate.formatVersion !== BACKUP_FORMAT_VERSION ||
    !Array.isArray(candidate.files) ||
    candidate.files.length !== 1
  ) {
    throw new BackupError("unsupported_backup", "The backup manifest format is not supported.");
  }
  const file = candidate.files[0] as unknown;
  if (typeof file !== "object" || file === null) {
    throw new BackupError("invalid_archive", "The backup manifest file entry is invalid.");
  }
  const fileCandidate = file as Record<string, unknown>;
  if (
    (fileCandidate.path !== "database.sqlite3" && fileCandidate.path !== "ledger.json") ||
    typeof fileCandidate.sha256 !== "string" ||
    !sha256Pattern.test(fileCandidate.sha256) ||
    !Number.isInteger(fileCandidate.size) ||
    (fileCandidate.size as number) < 1 ||
    (fileCandidate.size as number) > maxDatabaseBytes
  ) {
    throw new BackupError("invalid_archive", "The backup database manifest entry is invalid.");
  }

  return Object.freeze({
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: candidate.schemaVersion as number,
    createdAt: candidate.createdAt as string,
    ...(candidate.appVersion === undefined ? {} : { appVersion: candidate.appVersion as string }),
    files: Object.freeze([
      Object.freeze({
        path: fileCandidate.path as BackupManifestFile["path"],
        sha256: fileCandidate.sha256,
        size: fileCandidate.size as number,
      }),
    ]) as readonly [BackupManifestFile],
  });
}

async function deriveEncryptionKey(
  passphrase: string,
  salt: Uint8Array,
  cryptoProvider: Crypto,
): Promise<CryptoKey> {
  const baseKey = await cryptoProvider.subtle.importKey(
    "raw",
    toArrayBuffer(textEncoder.encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return cryptoProvider.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function validatePassphrase(passphrase: string): void {
  if (typeof passphrase !== "string" || passphrase.length < 12 || passphrase.length > 1_024) {
    throw new BackupError(
      "backup_failed",
      "Backup passphrases must contain between 12 and 1024 characters.",
    );
  }
}

function validateDatabaseBytes(bytes: Uint8Array): void {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength < 100 ||
    bytes.byteLength > maxDatabaseBytes
  ) {
    throw new BackupError("invalid_archive", "The SQLite database payload size is invalid.");
  }
}

function validatePayloadBytes(bytes: Uint8Array, path: BackupManifestFile["path"]): void {
  if (path === "database.sqlite3") {
    validateDatabaseBytes(bytes);
    return;
  }
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > maxDatabaseBytes)
    throw new BackupError("invalid_archive", "The portable ledger payload size is invalid.");
}

function validateSchemaVersion(value: unknown): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 1_000_000) {
    throw new BackupError("invalid_archive", "The backup schema version is invalid.");
  }
}

function validateTimestamp(value: unknown): asserts value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new BackupError("invalid_archive", "The backup timestamp is invalid.");
  }
}

function validateAppVersion(value: unknown): asserts value is string | undefined {
  if (value !== undefined && (typeof value !== "string" || value.length < 1 || value.length > 64)) {
    throw new BackupError("invalid_archive", "The backup application version is invalid.");
  }
}

function requireWebCrypto(cryptoProvider: Crypto | undefined): asserts cryptoProvider is Crypto {
  if (
    cryptoProvider === undefined ||
    cryptoProvider.subtle === undefined ||
    typeof cryptoProvider.getRandomValues !== "function"
  ) {
    throw new BackupError(
      "backup_failed",
      "Web Crypto is required to create or restore encrypted backups.",
    );
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
