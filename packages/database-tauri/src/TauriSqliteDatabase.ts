import { PersistenceError, type CloseableSqliteDatabase, type SqliteValue } from "@nexora/database";

export type TauriSqlBindValue = number | string | readonly number[] | null;

export interface TauriSqlClient {
  execute(sql: string, parameters?: readonly TauriSqlBindValue[]): Promise<unknown>;
  select<Row extends object>(
    sql: string,
    parameters?: readonly TauriSqlBindValue[],
  ): Promise<readonly Row[]>;
  close(): Promise<unknown>;
}

/** Adapts Tauri's native SQL plugin to Nexora's platform-neutral SQLite port. */
export class TauriSqliteDatabase implements CloseableSqliteDatabase {
  public readonly storageKind = "native-sqlite" as const;
  public readonly supportsMultiCallTransactions = false as const;
  private isClosed = false;

  public constructor(private readonly client: TauriSqlClient) {}

  public async execute(sql: string): Promise<void> {
    this.assertOpen();
    await this.client.execute(sql);
  }

  public async query<Row extends object>(
    sql: string,
    parameters: readonly SqliteValue[] = [],
  ): Promise<readonly Row[]> {
    this.assertOpen();
    return this.client.select<Row>(sql, normalizeParameters(parameters));
  }

  public async run(sql: string, parameters: readonly SqliteValue[] = []): Promise<void> {
    this.assertOpen();
    await this.client.execute(sql, normalizeParameters(parameters));
  }

  public async close(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    await this.client.close();
  }

  private assertOpen(): void {
    if (this.isClosed) {
      throw new PersistenceError("persistence_closed", "The native SQLite ledger is closed.");
    }
  }
}

function normalizeParameters(parameters: readonly SqliteValue[]): readonly TauriSqlBindValue[] {
  return parameters.map((value) => {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Uint8Array) return [...value];
    return value;
  });
}
