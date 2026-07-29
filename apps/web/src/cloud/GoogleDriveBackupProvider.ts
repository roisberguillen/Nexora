import type { CloudBackupMetadata, CloudBackupProvider } from "./cloudTypes";

const endpoint = "https://www.googleapis.com/drive/v3/files";

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
      `${endpoint}?spaces=appDataFolder&q=trashed%3Dfalse&fields=files(id%2Cname%2Csize%2CcreatedTime%2CappProperties)`,
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
    return (body.files ?? []).map((file) => ({
      id: file.id,
      backupId: file.appProperties?.backupId ?? file.name,
      checksumSha256: file.appProperties?.checksumSha256 ?? "",
      createdAt: file.createdTime,
      formatVersion: Number(file.appProperties?.formatVersion ?? 1),
      schemaVersion: Number(file.appProperties?.schemaVersion ?? 0),
      size: Number(file.size ?? 0),
    }));
  }
  public async upload(metadata: CloudBackupMetadata, archive: Uint8Array): Promise<void> {
    const boundary = `nexora-${crypto.randomUUID()}`;
    const meta = JSON.stringify({
      name: metadata.backupId,
      parents: ["appDataFolder"],
      appProperties: {
        checksumSha256: metadata.checksumSha256,
        backupId: metadata.backupId,
        formatVersion: String(metadata.formatVersion),
        schemaVersion: String(metadata.schemaVersion),
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
  public async download(id: string): Promise<Uint8Array> {
    return new Uint8Array(
      await (await this.request(`${endpoint}/${encodeURIComponent(id)}?alt=media`)).arrayBuffer(),
    );
  }
  public async delete(id: string): Promise<void> {
    await this.request(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const token = this.token();
    if (token === undefined) throw new Error("cloud_session_expired");
    const maxAttempts = this.options.maxAttempts ?? 2;
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
    } catch (error) {
      if (controller.signal.aborted) throw new Error("cloud_timeout");
      throw new Error("cloud_network_error");
    } finally {
      clearTimeout(timeout);
    }
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
