import { InMemoryLedgerRepository } from "@nexora/database";
import {
  Account,
  AllocationPlan,
  RecurringRule,
  Tag,
  LocalDate,
  Money,
  Transaction,
  Transfer,
  ImportBatch,
  ImportRow,
} from "@nexora/domain";
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

  it("pushes transfer legs and transfer metadata as one outbox delivery", async () => {
    const repository = new InMemoryLedgerRepository();
    const debitAccount = Account.create({
      id: "account-debit",
      name: "Debit",
      type: "checking",
      currency: "EUR",
    });
    const creditAccount = Account.create({
      id: "account-credit",
      name: "Credit",
      type: "checking",
      currency: "EUR",
    });
    const accountOperations = [debitAccount, creditAccount].map(
      (account, index) =>
        [
          index + 1,
          operation(account.id, {
            schema_version: 1,
            operation: "upsert",
            entity_type: "account",
            entity_id: account.id,
            name: account.name,
            type: account.type,
            currency: account.currency,
            opening_balance_minor: "0",
            is_archived: false,
          }),
        ] as [number, LocalSyncOperation],
    );
    let pushedBody: { operations: readonly LocalSyncOperation[] } | undefined;
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/bootstrap"))
        return response({ schema_version: 1, cursor: 2, operations: accountOperations });
      if (url.endsWith("/v1/operations")) {
        pushedBody = JSON.parse(String(init?.body)) as { operations: LocalSyncOperation[] };
        return response(
          pushedBody.operations.map((candidate, index) => ({
            Applied: { cursor: index + 3, revision: candidate.revision },
          })),
        );
      }
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-1", token: "token" },
      storage: storage(),
      request,
    });
    const connection = await connectRemoteLedgerRepository(repository, client);
    const debitTransaction = Transaction.create({
      id: "transfer-debit",
      kind: "transfer",
      status: "booked",
      accountId: debitAccount.id,
      amount: Money.fromMinor(-1000n, "EUR"),
      bookedDate: LocalDate.parse("2026-10-08"),
      source: "manual",
    });
    const creditTransaction = Transaction.create({
      id: "transfer-credit",
      kind: "transfer",
      status: "booked",
      accountId: creditAccount.id,
      amount: Money.fromMinor(1000n, "EUR"),
      bookedDate: LocalDate.parse("2026-10-08"),
      source: "manual",
    });
    const transfer = Transfer.create({
      id: "transfer-phone",
      debitTransaction,
      creditTransaction,
    });

    await connection.repository.saveTransfer({ transfer, debitTransaction, creditTransaction });

    expect(pushedBody?.operations).toHaveLength(3);
    expect(
      pushedBody?.operations.map((candidate) => JSON.parse(candidate.payload).entity_type),
    ).toEqual(["transaction", "transaction", "transfer"]);
    expect(client.pending()).toEqual([]);
  });

  it("pushes mergeTag as a replacement of the source tag", async () => {
    const repository = new InMemoryLedgerRepository();
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/bootstrap"))
        return response({ schema_version: 1, cursor: 0, operations: [] });
      if (url.endsWith("/v1/operations")) {
        const body = JSON.parse(String(init?.body)) as { operations: LocalSyncOperation[] };
        return response(
          body.operations.map((candidate, index) => ({
            Applied: { cursor: index + 1, revision: candidate.revision },
          })),
        );
      }
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-1", token: "token" },
      storage: storage(),
      request,
    });
    const connection = await connectRemoteLedgerRepository(repository, client);
    const account = Account.create({
      id: "account-tags",
      name: "Tags",
      type: "checking",
      currency: "EUR",
    });
    const source = Tag.create({ id: "tag-source", name: "Source" });
    const target = Tag.create({ id: "tag-target", name: "Target" });
    const transaction = Transaction.create({
      id: "transaction-tags",
      kind: "expense",
      status: "booked",
      accountId: account.id,
      amount: Money.fromMinor(-500n, "EUR"),
      bookedDate: LocalDate.parse("2026-10-08"),
      source: "manual",
    });
    await connection.repository.saveAccount(account);
    await connection.repository.saveTag(source);
    await connection.repository.saveTag(target);
    await connection.repository.saveTransaction(transaction);
    await connection.repository.setTransactionTags(transaction.id, [source.id]);
    await connection.repository.mergeTag(source.id, target.id);

    const pushedPayloads = request.mock.calls
      .filter(([input]) => String(input).endsWith("/v1/operations"))
      .flatMap(
        ([, init]) =>
          (JSON.parse(String(init?.body)) as { operations: LocalSyncOperation[] }).operations,
      )
      .map((candidate) => JSON.parse(candidate.payload) as Record<string, unknown>);
    const tagSets = pushedPayloads.filter(
      (payload) => payload.entity_type === "transaction_tag_set",
    );
    const tagSet = tagSets.at(-1);
    expect(tagSet?.tag_ids).toEqual([target.id]);
  });

  it("pushes trash and purge batches with independent entity revisions", async () => {
    const repository = new InMemoryLedgerRepository();
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/bootstrap"))
        return response({ schema_version: 1, cursor: 0, operations: [] });
      if (url.endsWith("/v1/operations")) {
        const body = JSON.parse(String(init?.body)) as { operations: LocalSyncOperation[] };
        return response(
          body.operations.map((candidate, index) => ({
            Applied: { cursor: index + 1, revision: candidate.revision },
          })),
        );
      }
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-1", token: "token" },
      storage: storage(),
      request,
    });
    const connection = await connectRemoteLedgerRepository(repository, client);
    const account = Account.create({
      id: "account-trash",
      name: "Trash",
      type: "checking",
      currency: "EUR",
    });
    await connection.repository.saveAccount(account);
    for (const id of ["transaction-trash-a", "transaction-trash-b"]) {
      await connection.repository.saveTransaction(
        Transaction.create({
          id,
          kind: "expense",
          status: "booked",
          accountId: account.id,
          amount: Money.fromMinor(-100n, "EUR"),
          bookedDate: LocalDate.parse("2026-10-08"),
          source: "manual",
        }),
      );
    }
    await connection.repository.trashTransactions(["transaction-trash-a", "transaction-trash-b"]);
    await connection.repository.purgeTrashedTransactions([
      "transaction-trash-a",
      "transaction-trash-b",
    ]);

    const pushed = request.mock.calls
      .filter(([input]) => String(input).endsWith("/v1/operations"))
      .flatMap(
        ([, init]) =>
          (JSON.parse(String(init?.body)) as { operations: LocalSyncOperation[] }).operations,
      )
      .map((candidate) => ({
        candidate,
        payload: JSON.parse(candidate.payload) as Record<string, unknown>,
      }));
    const purgeDeletes = pushed.filter(
      ({ payload }) =>
        payload.operation === "delete" &&
        (payload.entity_type === "transaction" || payload.entity_type === "transaction_trash"),
    );
    expect(purgeDeletes).toHaveLength(4);
    for (const { candidate, payload } of purgeDeletes) {
      expect(candidate.baseRevision).toBe(1);
      expect(["transaction-trash-a", "transaction-trash-b"]).toContain(payload.entity_id);
    }
    expect(new Set(purgeDeletes.map(({ payload }) => payload.entity_type))).toEqual(
      new Set(["transaction", "transaction_trash"]),
    );
    expect(new Set(purgeDeletes.map(({ payload }) => payload.entity_id))).toEqual(
      new Set(["transaction-trash-a", "transaction-trash-b"]),
    );
  });

  it("pushes import preview, commit and undo as durable operations", async () => {
    const repository = new InMemoryLedgerRepository();
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/bootstrap"))
        return response({ schema_version: 1, cursor: 0, operations: [] });
      if (url.endsWith("/v1/operations")) {
        const body = JSON.parse(String(init?.body)) as { operations: LocalSyncOperation[] };
        return response(
          body.operations.map((candidate) => ({
            Applied: { cursor: 1, revision: candidate.revision },
          })),
        );
      }
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-1", token: "token" },
      storage: storage(),
      request,
    });
    const connection = await connectRemoteLedgerRepository(repository, client);
    const account = Account.create({
      id: "account-import",
      name: "Import",
      type: "checking",
      currency: "EUR",
    });
    const batch = ImportBatch.create({
      id: "batch-import",
      importerType: "generic_csv",
      sourceFilename: "sample.csv",
      sourceSha256: "a".repeat(64),
      rowsTotal: 1,
    });
    const row = ImportRow.create({
      id: "row-import",
      batchId: batch.id,
      rowNumber: 1,
      rawJson: '{"amount":"-5"}',
      normalizedJson: JSON.stringify({ accountId: account.id }),
      status: "imported",
      createdTransactionId: "transaction-import",
    });
    const transaction = Transaction.create({
      id: "transaction-import",
      kind: "expense",
      status: "booked",
      accountId: account.id,
      amount: Money.fromMinor(-500n, "EUR"),
      bookedDate: LocalDate.parse("2026-10-08"),
      source: "import",
      importBatchId: batch.id,
      sourceFingerprint: "b".repeat(64),
    });

    await connection.repository.saveImportBatch(batch, [row]);
    const committed = batch.commit({ rowsImported: 1, rowsSkipped: 0, rowsFailed: 0 });
    await connection.repository.commitImportBatch({
      batch,
      rows: [row],
      accountsToCreate: [account],
      transactions: [transaction],
    });
    await connection.repository.undoImportBatch(committed.id);

    const payloads = request.mock.calls
      .filter(([input]) => String(input).endsWith("/v1/operations"))
      .flatMap(
        ([, init]) =>
          (JSON.parse(String(init?.body)) as { operations: LocalSyncOperation[] }).operations,
      )
      .map((candidate) => JSON.parse(candidate.payload) as Record<string, unknown>);
    expect(payloads.map((payload) => `${payload.entity_type}:${payload.operation}`)).toEqual([
      "import_batch:upsert",
      "import_row:upsert",
      "import_batch:upsert",
      "account:upsert",
      "transaction:upsert",
      "import_row:upsert",
      "import_batch:upsert",
      "transaction:upsert",
    ]);
    await expect(repository.findTransactionById(transaction.id)).resolves.toMatchObject({
      status: "cancelled",
    });
  });

  it("applies recurring and allocation bootstrap records and pushes updates", async () => {
    const repository = new InMemoryLedgerRepository();
    const account = Account.create({
      id: "account-rules",
      name: "Rules",
      type: "checking",
      currency: "EUR",
    });
    const other = Account.create({
      id: "account-target",
      name: "Target",
      type: "savings",
      currency: "EUR",
    });
    const rule = RecurringRule.create({
      id: "rule-phone",
      name: "Salary",
      kind: "income",
      accountId: account.id,
      amount: Money.fromMinor(100000n, "EUR"),
      frequencyUnit: "month",
      interval: 1,
      nominalDay: 1,
      weekendPolicy: "none",
      nextNominalDate: LocalDate.parse("2026-10-01"),
    });
    const plan = AllocationPlan.create({
      id: "plan-phone",
      name: "Savings",
      trigger: "salary",
      sourceAccountId: account.id,
      targetAccountId: other.id,
      amount: Money.fromMinor(10000n, "EUR"),
    });
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/bootstrap"))
        return response({
          schema_version: 1,
          cursor: 2,
          operations: [
            [
              1,
              operation(account.id, {
                schema_version: 1,
                operation: "upsert",
                entity_type: "account",
                entity_id: account.id,
                name: account.name,
                type: account.type,
                currency: "EUR",
                opening_balance_minor: "0",
                is_archived: false,
              }),
            ],
            [
              2,
              operation(other.id, {
                schema_version: 1,
                operation: "upsert",
                entity_type: "account",
                entity_id: other.id,
                name: other.name,
                type: other.type,
                currency: "EUR",
                opening_balance_minor: "0",
                is_archived: false,
              }),
            ],
          ],
        });
      if (url.endsWith("/v1/operations")) {
        const body = JSON.parse(String(init?.body)) as { operations: LocalSyncOperation[] };
        return response(
          body.operations.map((candidate, index) => ({
            Applied: { cursor: index + 3, revision: candidate.revision },
          })),
        );
      }
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-1", token: "token" },
      storage: storage(),
      request,
    });
    const connection = await connectRemoteLedgerRepository(repository, client);
    await connection.repository.saveRecurringRule(rule);
    await connection.repository.saveAllocationPlan(plan);
    const pushed = request.mock.calls.filter(([input]) => String(input).endsWith("/v1/operations"));
    expect(pushed).toHaveLength(2);
    expect(JSON.parse(String(pushed[0]![1]?.body)).operations[0].payload).toContain(
      "recurring_rule",
    );
    expect(JSON.parse(String(pushed[1]![1]?.body)).operations[0].payload).toContain(
      "allocation_plan",
    );
  });
});
