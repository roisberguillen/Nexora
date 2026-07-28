export interface DatabaseMigration {
  readonly version: number;
  readonly name: string;
  readonly requiresBackup: boolean;
  readonly up: string;
  readonly down: string;
}
