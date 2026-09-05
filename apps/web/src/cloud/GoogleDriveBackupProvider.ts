import type { CloudBackupMetadata, CloudBackupProvider } from "./cloudTypes";

const endpoint = "https://www.googleapis.com/drive/v3/files";
const maxCloudArchiveBytes = 512 * 1024 * 1024;

export interface GoogleDriveBackupProviderOptions {
  readonly maxAttempts?: number;
  readonly timeoutMs?: number;
}

export class GoogleDriveBackupProvider implements CloudBackupProvider {
  public constructor(
    private readonly token: () => string | undefined,
    private readonly fetcher: typeof fetch = fetch,
    private readonly options: GoogleDriveBackupProviderOptions = {},
  ) {}
  public async list(): Promise<readonly CloudBackupMetadata[]> {
    const response = await this.request(
      `${endpoint}?spaces=appDataFolder&q=trashed%3Dfalse&orderBy=createdTime%20desc&pageSize=100&fields=files(id%2Cname%2Csize%2CcreatedTime%2CappProperties)`,
    );
    const body = (await response.json()) as {
      files?: readonly {
        id: string;
        name: string;
        size?: string;
        createdTime: string;
        appProperties?: Record<string, string>;
      }[];
    };
    return (body.files ?? []).flatMap((file) => {
      const metadata = parseCloudBackupMetadata(file);
      return metadata === undefined ? [] : [metadata];
    });
  }
  public async upload(metadata: CloudBackupMetadata, archive: Uint8Array): Promise<void> {
    assertUploadMetadata(metadata, archive);
    const boundary = `nexora-${crypto.randomUUID()}`;
    const meta = JSON.stringify({
      name: metadata.backupId,
      parents: ["appDataFolder"],
      appProperties: {
        checksumSha256: metadata.checksumSha256,
        backupId: metadata.backupId,
        formatVersion: String(metadata.formatVersion),
        schemaVersion: String(metadata.schemaVersion),
        createdAt: metadata.createdAt,
        size: String(metadata.size),
        nexoraBackup: "1",
      },
    });
    const archiveCopy = new Uint8Array(archive.byteLength);
    archiveCopy.set(archive);
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
      archiveCopy.buffer,
      `\r\n--${boundary}--`,
    ]);
    await this.request("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
  }
  public async download(id: string, expectedSize?: number): Promise<Uint8Array> {
    if (
      expectedSize !== undefined &&
      (!Number.isSafeInteger(expectedSize) ||
        expectedSize < 1 ||
        expectedSize > maxCloudArchiveBytes)
    ) {
      throw new Error("cloud_invalid_backup_metadata");
    }
    const response = await this.request(`${endpoint}/${encodeURIComponent(id)}?alt=media`);
    const declaredSize = response.headers.get("content-length");
    if (declaredSize !== null) {
      const parsedSize = Number(declaredSize);
      if (
        !Number.isSafeInteger(parsedSize) ||
        parsedSize < 1 ||
        parsedSize > maxCloudArchiveBytes ||
        (expectedSize !== undefined && parsedSize !== expectedSize)
      ) {
        throw new Error("cloud_invalid_backup_metadata");
      }
    }
    const archive = new Uint8Array(await response.arrayBuffer());
    if (
      archive.byteLength < 1 ||
      archive.byteLength > maxCloudArchiveBytes ||
      (expectedSize !== undefined && archive.byteLength !== expectedSize)
    ) {
      throw new Error("cloud_invalid_backup_metadata");
    }
    return archive;
  }
  public async delete(id: string): Promise<void> {
    if (id.length < 1 || id.length > 1024) throw new Error("cloud_invalid_backup_metadata");
    await this.request(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const token = this.token();
    if (token === undefined) throw new Error("cloud_session_expired");
    const method = init.method?.toUpperCase() ?? "GET";
    const maxAttempts = method === "GET" ? (this.options.maxAttempts ?? 2) : 1;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(url, {
          ...init,
          headers: { ...init.headers, Authorization: `Bearer ${token}` },
        });
        if (response.ok) return response;
        const errorCode = errorCodeForStatus(response.status);
        if (!isRetryableStatus(response.status) || attempt === maxAttempts) {
          throw new Error(errorCode);
        }
        lastError = new Error(errorCode);
      } catch (error) {
        const errorCode = error instanceof Error ? error.message : "cloud_network_error";
        if (!isRetryableError(errorCode) || attempt === maxAttempts) throw error;
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("cloud_network_error");
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10_000);
    try {
      return await this.fetcher(url, { ...init, signal: controller.signal });
    } catch {
      if (controller.signal.aborted) throw new Error("cloud_timeout");
      throw new Error("cloud_network_error");
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseCloudBackupMetadata(file: {
  readonly id: string;
  readonly name: string;
  readonly size?: string;
  readonly createdTime: string;
  readonly appProperties?: Record<string, string>;
}): CloudBackupMetadata | undefined {
  const backupId = file.appProperties?.backupId ?? file.name;
  const checksumSha256 = file.appProperties?.checksumSha256 ?? "";
  const formatVersion = Number(file.appProperties?.formatVersion);
  const schemaVersion = Number(file.appProperties?.schemaVersion);
  const size = Number(file.size);
  if (
    file.id.length === 0 ||
    file.id.length > 1024 ||
    !backupId.endsWith(".nexora-backup") ||
    !/^[a-f0-9]{64}$/.test(checksumSha256) ||
    file.appProperties?.nexoraBackup !== "1" ||
    formatVersion !== 1 ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 0 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > maxCloudArchiveBytes ||
    !Number.isFinite(Date.parse(file.createdTime))
  ) {
    return undefined;
  }
  return {
    id: file.id,
    backupId,
    checksumSha256,
    createdAt: file.createdTime,
    formatVersion,
    schemaVersion,
    size,
  };
}

function assertUploadMetadata(metadata: CloudBackupMetadata, archive: Uint8Array): void {
  if (
    !metadata.backupId.endsWith(".nexora-backup") ||
    !/^[a-f0-9]{64}$/.test(metadata.checksumSha256) ||
    metadata.formatVersion !== 1 ||
    !Number.isInteger(metadata.schemaVersion) ||
    metadata.schemaVersion < 0 ||
    metadata.size !== archive.byteLength ||
    archive.byteLength < 1 ||
    archive.byteLength > maxCloudArchiveBytes
  ) {
    throw new Error("cloud_invalid_backup_metadata");
  }
}

function errorCodeForStatus(status: number): string {
  if (status === 401) return "cloud_session_expired";
  if (status === 403) return "cloud_permission_denied";
  if (status === 404) return "cloud_backup_not_found";
  if (status === 429) return "cloud_rate_limited";
  return "cloud_network_error";
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableError(errorCode: string): boolean {
  return (
    errorCode === "cloud_network_error" ||
    errorCode === "cloud_timeout" ||
    errorCode === "cloud_rate_limited"
  );
}
