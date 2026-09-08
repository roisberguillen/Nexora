import { describe, expect, it, vi } from "vitest";

import { TauriSqliteDatabase, type TauriSqlClient } from "./TauriSqliteDatabase";

function client(): TauriSqlClient & {
  execute: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  return {
    execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
    select: vi.fn().mockResolvedValue([{ value: "ok" }]),
    close: vi.fn().mockResolvedValue(true),
  };
}

describe("TauriSqliteDatabase", () => {
  it("advertises that transactions cannot span pooled IPC calls", () => {
    const database = new TauriSqliteDatabase(client());

    expect(database.supportsMultiCallTransactions).toBe(false);
  });

  it("runs multi-call work on a transaction-bound native client", async () => {
    const native = client();
    native.beginTransaction = vi.fn().mockResolvedValue("tx-1");
    native.transactionExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    native.transactionSelect = vi.fn().mockResolvedValue([{ id: "account-1" }]);
    native.commitTransaction = vi.fn().mockResolvedValue(true);
    native.rollbackTransaction = vi.fn().mockResolvedValue(true);
    const database = new TauriSqliteDatabase(native);

    await expect(
      database.runInTransaction(async (transaction) => {
        await transaction.run("INSERT INTO accounts(id) VALUES (?)", ["account-1"]);
        return transaction.query<{ id: string }>("SELECT id FROM accounts");
      }),
    ).resolves.toEqual([{ id: "account-1" }]);

    expect(native.beginTransaction).toHaveBeenCalledOnce();
    expect(native.transactionExecute).toHaveBeenCalledWith(
      "tx-1",
      "INSERT INTO accounts(id) VALUES (?)",
      ["account-1"],
    );
    expect(native.commitTransaction).toHaveBeenCalledWith("tx-1");
    expect(native.rollbackTransaction).not.toHaveBeenCalled();
  });

  it("rolls back the native transaction when a callback fails", async () => {
    const native = client();
    native.beginTransaction = vi.fn().mockResolvedValue("tx-2");
    native.transactionExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    native.transactionSelect = vi.fn().mockResolvedValue([]);
    native.commitTransaction = vi.fn().mockResolvedValue(true);
    native.rollbackTransaction = vi.fn().mockResolvedValue(true);
    const database = new TauriSqliteDatabase(native);

    await expect(
      database.runInTransaction(async () => {
        throw new Error("forced failure");
      }),
    ).rejects.toThrow("forced failure");
    expect(native.rollbackTransaction).toHaveBeenCalledWith("tx-2");
    expect(native.commitTransaction).not.toHaveBeenCalled();
  });

  it("forwards batches, queries and normalized native parameters", async () => {
    const native = client();
    const database = new TauriSqliteDatabase(native);

    await database.execute("BEGIN IMMEDIATE; CREATE TABLE sample(id TEXT); COMMIT;");
    await expect(database.query<{ value: string }>("SELECT ? AS value", [7n])).resolves.toEqual([
      { value: "ok" },
    ]);
    await database.run("INSERT INTO sample(id) VALUES (?)", [new Uint8Array([1, 2])]);

    expect(native.execute).toHaveBeenNthCalledWith(
      1,
      "BEGIN IMMEDIATE; CREATE TABLE sample(id TEXT); COMMIT;",
    );
    expect(native.select).toHaveBeenCalledWith("SELECT ? AS value", ["7"]);
    expect(native.execute).toHaveBeenNthCalledWith(2, "INSERT INTO sample(id) VALUES (?)", [
      [1, 2],
    ]);
  });

  it("closes once and rejects later operations", async () => {
    const native = client();
    const database = new TauriSqliteDatabase(native);

    await database.close();
    await database.close();

    expect(native.close).toHaveBeenCalledTimes(1);
    await expect(database.query("SELECT 1")).rejects.toMatchObject({
      code: "persistence_closed",
    });
  });
});
