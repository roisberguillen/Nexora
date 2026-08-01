import type { SqliteDatabase } from "../sqlite/SqliteDatabase";

export interface DatabaseMigration {
  readonly version: number;
  readonly name: string;
  readonly requiresBackup: boolean;
  readonly up: string;
  readonly down: string;
  /** Historical names accepted when an older build wrote the same version. */
  readonly legacyNames?: readonly string[];
  /** Idempotent additive repair for a historical migration name. */
  readonly legacyRepair?: (database: SqliteDatabase) => void | Promise<void>;
}
