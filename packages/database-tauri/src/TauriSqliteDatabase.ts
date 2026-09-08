import {
  PersistenceError,
  type CloseableSqliteDatabase,
  type SqliteDatabase,
  type SqliteValue,
} from "@nexora/database";

export type TauriSqlBindValue = number | string | readonly number[] | null;

export interface TauriSqlClient {
  execute(sql: string, parameters?: readonly TauriSqlBindValue[]): Promise<unknown>;
  select<Row extends object>(
    sql: string,
    parameters?: readonly TauriSqlBindValue[],
  ): Promise<readonly Row[]>;
  close(): Promise<unknown>;
  beginTransaction?: () => Promise<string>;
  transactionExecute?: (
    transactionId: string,
    sql: string,
    parameters?: readonly TauriSqlBindValue[],
  ) => Promise<unknown>;
  transactionSelect?: <Row extends object>(
    transactionId: string,
    sql: string,
    parameters?: readonly TauriSqlBindValue[],
  ) => Promise<readonly Row[]>;
  commitTransaction?: (transactionId: string) => Promise<unknown>;
  rollbackTransaction?: (transactionId: string) => Promise<unknown>;
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

  public async runInTransaction<Result>(
    operation: (database: SqliteDatabase) => Promise<Result>,
  ): Promise<Result> {
    if (
      this.client.beginTransaction === undefined ||
      this.client.transactionExecute === undefined ||
      this.client.transactionSelect === undefined ||
      this.client.commitTransaction === undefined ||
      this.client.rollbackTransaction === undefined
    ) {
      throw new PersistenceError(
        "database_operation_failed",
        "The native SQLite transaction bridge is unavailable.",
      );
    }
    const transactionId = await this.client.beginTransaction();
    const transaction = new TauriTransactionDatabase(this.client, transactionId);
    try {
      const result = await operation(transaction);
      await this.client.commitTransaction(transactionId);
      return result;
    } catch (cause) {
      await this.client.rollbackTransaction(transactionId).catch(() => undefined);
      throw cause;
    }
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

class TauriTransactionDatabase implements SqliteDatabase {
  public readonly supportsMultiCallTransactions = true as const;

  public constructor(
    private readonly client: TauriSqlClient,
    private readonly transactionId: string,
  ) {}

  public async execute(sql: string): Promise<void> {
    await this.client.transactionExecute!(this.transactionId, sql);
  }

  public async query<Row extends object>(
    sql: string,
    parameters: readonly SqliteValue[] = [],
  ): Promise<readonly Row[]> {
    return this.client.transactionSelect!(this.transactionId, sql, normalizeParameters(parameters));
  }

  public async run(sql: string, parameters: readonly SqliteValue[] = []): Promise<void> {
    await this.client.transactionExecute!(this.transactionId, sql, normalizeParameters(parameters));
  }
}

function normalizeParameters(parameters: readonly SqliteValue[]): readonly TauriSqlBindValue[] {
  return parameters.map((value) => {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Uint8Array) return [...value];
    return value;
  });
}
