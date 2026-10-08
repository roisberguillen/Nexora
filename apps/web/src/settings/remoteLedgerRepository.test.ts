import { InMemoryLedgerRepository } from "@nexora/database";
import { Account, Tag, LocalDate, Money } from "@nexora/domain";
import { describe, expect, it, vi } from "vitest";

import { LocalHostSyncClient, type LocalSyncOperation } from "./localHostSync";
import { connectRemoteLedgerRepository, remoteLedgerSyncEventName } from "./remoteLedgerRepository";

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

function operation(
  entityId: string,
  payload: Record<string, unknown>,
  revision = 1,
): LocalSyncOperation {
  return {
    idempotencyKey: `phone-${entityId}-${revision}`,
    deviceId: "phone-local-ledger",
    entityId,
    baseRevision: revision - 1,
    revision,
    payloadDigest: "sha256:phone-local-journal",
    payload: JSON.stringify(payload),
    tombstone: payload.operation === "delete",
    createdAt: "2026-10-08T12:00:00.000Z",
  };
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("remote ledger repository", () => {
  it("applies a phone transaction from the incremental pull and advances cursor", async () => {
    const repository = new InMemoryLedgerRepository();
    const account = Account.create({
      id: "account-phone",
      name: "Phone",
      type: "checking",
      currency: "EUR",
    });
    const accountOperation = operation("account-phone", {
      schema_version: 1,
      operation: "upsert",
      entity_type: "account",
      entity_id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      opening_balance_minor: "0",
      is_archived: false,
    });
    const transactionOperation = operation(
      "transaction-phone",
      {
        schema_version: 1,
        operation: "upsert",
        entity_type: "transaction",
        entity_id: "transaction-phone",
        amount_minor: "-1250",
        currency: "EUR",
        kind: "expense",
        status: "booked",
        account_id: account.id,
        booked_date: "2026-10-08",
        source: "manual",
      },
      1,
    );
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/bootstrap"))
        return response({ schema_version: 1, cursor: 1, operations: [[0, accountOperation]] });
      if (url.endsWith("after=1")) return response({ operations: [[2, transactionOperation]] });
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-1", token: "token" },
      storage: storage(),
      request,
    });
    const connection = await connectRemoteLedgerRepository(repository, client);
    const syncEvent = vi.fn();
    window.addEventListener(remoteLedgerSyncEventName, syncEvent);

    await connection.sync();
    await connection.sync();

    const transaction = await connection.repository.findTransactionById("transaction-phone");
    expect(transaction?.amount).toEqual(Money.fromMinor(-1250n, "EUR"));
    expect(transaction?.bookedDate).toEqual(LocalDate.parse("2026-10-08"));
    expect(client.cursor()).toBe(2);
    expect(client.revision("transaction-phone")).toBe(1);
    expect(syncEvent).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "https://phone.local/v1/operations?after=2",
      expect.anything(),
    );
    window.removeEventListener(remoteLedgerSyncEventName, syncEvent);
  });

  it("applies a phone tag tombstone and does not repeat an acknowledged pull", async () => {
    const repository = new InMemoryLedgerRepository();
    const tag = Tag.create({ id: "tag-phone", name: "Phone" });
    const tagOperation = operation("tag-phone", {
      schema_version: 1,
      operation: "upsert",
      entity_type: "tag",
      entity_id: tag.id,
      name: tag.name,
      is_archived: false,
    });
    const deleteOperation = operation(
      "tag-phone",
      { schema_version: 1, operation: "delete", entity_type: "tag", entity_id: tag.id },
      2,
    );
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/bootstrap"))
        return response({ schema_version: 1, cursor: 1, operations: [[1, tagOperation]] });
      if (url.endsWith("after=1")) return response({ operations: [[2, deleteOperation]] });
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-1", token: "token" },
      storage: storage(),
      request,
    });

    const connection = await connectRemoteLedgerRepository(repository, client);
    await connection.sync();
    await connection.sync();

    await expect(connection.repository.listTags()).resolves.toEqual([]);
    expect(client.revision("tag-phone")).toBe(2);
    expect(client.cursor()).toBe(2);
  });
});
