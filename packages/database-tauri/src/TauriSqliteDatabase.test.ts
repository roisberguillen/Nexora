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
