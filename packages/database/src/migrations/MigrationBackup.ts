export interface MigrationBackupRequest {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrationName: string;
  readonly requestedAt: string;
}

export interface VerifiedMigrationBackup {
  readonly id: string;
  readonly createdAt: string;
  readonly checksumSha256: string;
}

export interface MigrationBackupProvider {
  createVerifiedBackup(request: MigrationBackupRequest): Promise<VerifiedMigrationBackup>;
}
