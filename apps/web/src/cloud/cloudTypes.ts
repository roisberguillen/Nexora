export type CloudBackupStatus = "idle" | "authorizing" | "connected" | "expired" | "error";

export interface CloudBackupMetadata {
  readonly id: string;
  readonly backupId: string;
  readonly checksumSha256: string;
  readonly createdAt: string;
  readonly formatVersion: number;
  readonly schemaVersion: number;
  readonly size: number;
}

export interface CloudBackupHistoryEntry {
  readonly occurredAt: string;
  readonly operation: "connect" | "disconnect" | "upload" | "download" | "delete";
  readonly status: "completed" | "failed";
  readonly backupId?: string;
  readonly errorCode?: string;
}

export interface CloudAuthProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): CloudBackupStatus;
}

export interface CloudBackupProvider {
  delete(id: string): Promise<void>;
  download(id: string, expectedSize?: number): Promise<Uint8Array>;
  list(): Promise<readonly CloudBackupMetadata[]>;
  upload(metadata: CloudBackupMetadata, archive: Uint8Array): Promise<void>;
}
