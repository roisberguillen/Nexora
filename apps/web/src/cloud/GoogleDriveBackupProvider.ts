import type { CloudBackupMetadata, CloudBackupProvider } from "./cloudTypes";

const endpoint = "https://www.googleapis.com/drive/v3/files";

export class GoogleDriveBackupProvider implements CloudBackupProvider {
  public constructor(
    private readonly token: () => string | undefined,
    private readonly fetcher: typeof fetch = fetch,
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
    const response = await this.fetcher(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (!response.ok)
      throw new Error(response.status === 401 ? "cloud_session_expired" : "cloud_network_error");
    return response;
  }
}
