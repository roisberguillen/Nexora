import type { LocalHostCredentials } from "./localHostConnection";

const databaseName = "nexora-local-host-vault";
const databaseVersion = 1;
const keyStore = "keys";
const credentialStore = "credentials";
const credentialKey = "primary";

interface EncryptedCredentials {
  readonly endpoint: string;
  readonly iv: ArrayBuffer;
  readonly ciphertext: ArrayBuffer;
}

export async function saveLocalHostCredentials(
  endpoint: string,
  credentials: LocalHostCredentials,
): Promise<void> {
  const database = await openVault();
  try {
    const key = await getOrCreateKey(database);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(credentials)),
    );
    await put(database, credentialStore, {
      endpoint,
      iv: iv.buffer,
      ciphertext,
    } satisfies EncryptedCredentials);
  } finally {
    database.close();
  }
}

export async function readLocalHostCredentials(): Promise<{
  readonly endpoint: string;
  readonly credentials: LocalHostCredentials;
} | null> {
  const database = await openVault();
  try {
    const record = (await get(database, credentialStore, credentialKey)) as
      EncryptedCredentials | undefined;
    if (record === undefined) return null;
    const key = await getOrCreateKey(database);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(record.iv) },
      key,
      record.ciphertext,
    );
    const credentials = JSON.parse(new TextDecoder().decode(plaintext)) as LocalHostCredentials;
    if (!validCredentials(credentials) || typeof record.endpoint !== "string") return null;
    return Object.freeze({ endpoint: record.endpoint, credentials });
  } finally {
    database.close();
  }
}

export async function clearLocalHostCredentials(): Promise<void> {
  const database = await openVault();
  try {
    await remove(database, credentialStore, credentialKey);
  } finally {
    database.close();
  }
}

function validCredentials(value: unknown): value is LocalHostCredentials {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LocalHostCredentials>;
  return (
    typeof candidate.deviceId === "string" &&
    candidate.deviceId.length > 0 &&
    typeof candidate.deviceToken === "string" &&
    candidate.deviceToken.length >= 24
  );
}

function openVault(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("secure_credential_storage_unavailable");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(keyStore);
      request.result.createObjectStore(credentialStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("secure_credential_storage_unavailable"));
  });
}

async function getOrCreateKey(database: IDBDatabase): Promise<CryptoKey> {
  const existing = (await get(database, keyStore, credentialKey)) as CryptoKey | undefined;
  if (existing !== undefined) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
  await put(database, keyStore, key);
  return key;
}

function get(database: IDBDatabase, storeName: string, key: IDBValidKey): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("secure_credential_storage_unavailable"));
  });
}

function put(database: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .put(value, credentialKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("secure_credential_storage_unavailable"));
  });
}

function remove(database: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("secure_credential_storage_unavailable"));
  });
}
