export type SqliteValue = bigint | number | string | Uint8Array | null;

export interface SqliteDatabase {
  execute(sql: string): Promise<void>;
  query<Row extends object>(
    sql: string,
    parameters?: readonly SqliteValue[],
  ): Promise<readonly Row[]>;
  run(sql: string, parameters?: readonly SqliteValue[]): Promise<void>;
}

export interface CloseableSqliteDatabase extends SqliteDatabase {
  readonly storageKind: "opfs" | "native-sqlite";
  close(): Promise<void>;
}

export interface PhysicalSqliteDatabase extends CloseableSqliteDatabase {
  exportDatabase(): Promise<Uint8Array>;
  restoreDatabase(bytes: Uint8Array, expectedSchemaVersion: number): Promise<void>;
}
