export type SqliteValue = bigint | number | string | Uint8Array | null;

export interface SqliteDatabase {
  /**
   * Tauri's SQL plugin dispatches each IPC call through a connection pool, so a
   * transaction cannot safely span multiple calls. Single-statement writes can
   * opt out while multi-statement workflows keep the normal transaction path.
   */
  readonly supportsMultiCallTransactions?: boolean;
  execute(sql: string): Promise<void>;
  query<Row extends object>(
    sql: string,
    parameters?: readonly SqliteValue[],
  ): Promise<readonly Row[]>;
  run(sql: string, parameters?: readonly SqliteValue[]): Promise<void>;
  /** Runs the callback on one connection-bound transaction when the adapter supports it. */
  runInTransaction?<Result>(
    operation: (database: SqliteDatabase) => Promise<Result>,
  ): Promise<Result>;
}

export interface CloseableSqliteDatabase extends SqliteDatabase {
  readonly storageKind: "opfs" | "native-sqlite";
  close(): Promise<void>;
}

export interface PhysicalSqliteDatabase extends CloseableSqliteDatabase {
  exportDatabase(): Promise<Uint8Array>;
  restoreDatabase(bytes: Uint8Array, expectedSchemaVersion: number): Promise<void>;
}
