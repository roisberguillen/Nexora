import { InMemoryLedgerRepository } from "@nexora/database";
import {
  Account,
  AllocationPlan,
  Category,
  RecurringRule,
  Tag,
  LocalDate,
  Money,
  Transaction,
  Transfer,
  ImportBatch,
  ImportRow,
  createSystemCategories,
} from "@nexora/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  let previousLock = Promise.resolve();
  const locks = {
    request<T>(_name: string, callback: () => Promise<T>): Promise<T> {
      const waitForPrevious = previousLock;
      let release!: () => void;
      previousLock = new Promise<void>((resolve) => {
        release = resolve;
      });
      return (async () => {
        await waitForPrevious;
        try {
          return await callback();
        } finally {
          release();
        }
      })();
    },
  };
  vi.stubGlobal("navigator", { locks });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("orders phone bootstrap dependencies before relations and trash", async () => {
    const repository = new InMemoryLedgerRepository();
    const account = Account.create({
      id: "account-bootstrap-order",
      name: "Phone account",
      type: "checking",
      currency: "EUR",
    });
    const tag = Tag.create({ id: "tag-bootstrap-order", name: "Phone tag" });
    const accountOperation = operation(account.id, {
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
    const tagOperation = operation(tag.id, {
      schema_version: 1,
      operation: "upsert",
      entity_type: "tag",
      entity_id: tag.id,
      name: tag.name,
      is_archived: false,
    });
    const transactionOperation = operation("transaction-bootstrap-order", {
      schema_version: 1,
      operation: "upsert",
      entity_type: "transaction",
      entity_id: "transaction-bootstrap-order",
      amount_minor: "-1250",
      currency: "EUR",
      kind: "expense",
      status: "booked",
      account_id: account.id,
      booked_date: "2026-10-17",
      source: "manual",
    });
    const tagSetOperation = operation("transaction-bootstrap-order", {
      schema_version: 1,
      operation: "replace",
      entity_type: "transaction_tag_set",
      entity_id: "transaction-bootstrap-order",
      tag_ids: [tag.id],
    });
    const trashOperation = operation("transaction-bootstrap-order", {
      schema_version: 1,
      operation: "upsert",
      entity_type: "transaction_trash",
      entity_id: "transaction-bootstrap-order",
      deleted_at: "2026-10-17T12:00:00.000Z",
      deletion_group_id: "transaction:transaction-bootstrap-order",
    });
    const request = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/v1/bootstrap"))
        return response({
          schema_version: 1,
          cursor: 0,
          operations: [
            [0, tagSetOperation],
            [0, trashOperation],
            [0, transactionOperation],
            [0, tagOperation],
            [0, accountOperation],
          ],
        });
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-bootstrap-order", token: "token" },
      storage: storage(),
      request,
    });

    const connection = await connectRemoteLedgerRepository(repository, client);

    await expect(connection.repository.findAccountById(account.id)).resolves.toEqual(account);
    await expect(
      connection.repository.listTransactionTags("transaction-bootstrap-order"),
    ).resolves.toEqual([tag]);
    await expect(connection.repository.listTrashedTransactions()).resolves.toHaveLength(1);
  });

  it("orders nested phone categories after their parent during bootstrap", async () => {
    const repository = new InMemoryLedgerRepository();
    const parent = Category.create({ id: "category-parent", name: "Parent", kindScope: "both" });
    const child = Category.create({
      id: "category-child",
      name: "Child",
      kindScope: "both",
      parentId: parent.id,
    });
    const categoryOperation = (category: Category) =>
      operation(category.id, {
        schema_version: 1,
        operation: "upsert",
        entity_type: "category",
        entity_id: category.id,
        name: category.name,
        kind_scope: category.kindScope,
        parent_id: category.parentId ?? null,
        is_archived: category.isArchived,
      });
    const request = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/v1/bootstrap"))
        return response({
          schema_version: 1,
          cursor: 0,
          operations: [
            [0, categoryOperation(child)],
            [0, categoryOperation(parent)],
          ],
        });
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-category-order", token: "token" },
      storage: storage(),
      request,
    });

    const connection = await connectRemoteLedgerRepository(repository, client);

    await expect(connection.repository.findCategoryById(parent.id)).resolves.toEqual(parent);
    await expect(connection.repository.findCategoryById(child.id)).resolves.toEqual(child);
  });

  it("preserves protected local system categories during phone bootstrap", async () => {
    const repository = new InMemoryLedgerRepository();
    const systemCategory = createSystemCategories()[0]!;
    const remoteOperation = operation(systemCategory.id, {
      schema_version: 1,
      operation: "upsert",
      entity_type: "category",
      entity_id: systemCategory.id,
      name: "Phone system category",
      kind_scope: systemCategory.kindScope,
      parent_id: null,
      is_archived: false,
    });
    const request = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/v1/bootstrap")
        ? response({ schema_version: 1, cursor: 0, operations: [[0, remoteOperation]] })
        : response({ operations: [] }),
    );
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-system-category", token: "token" },
      storage: storage(),
      request,
    });

    const connection = await connectRemoteLedgerRepository(repository, client);

    await expect(connection.repository.findCategoryById(systemCategory.id)).resolves.toEqual(
      systemCategory,
    );
  });

  it("does not mark a partially applied phone snapshot as a usable bootstrap cache", async () => {
    const repository = new InMemoryLedgerRepository();
    const accountOperation = operation("account-interrupted-bootstrap", {
      schema_version: 1,
      operation: "upsert",
      entity_type: "account",
      entity_id: "account-interrupted-bootstrap",
      name: "Phone account",
      type: "checking",
      currency: "EUR",
      opening_balance_minor: "0",
      is_archived: false,
    });
    const request = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/v1/bootstrap")
        ? response({ schema_version: 1, cursor: 0, operations: [[0, accountOperation]] })
        : response({ operations: [] }),
    );
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-interrupted-bootstrap", token: "token" },
      storage: storage(),
      request,
    });
    client.markBootstrapCache();
    vi.spyOn(repository, "saveAccount").mockRejectedValueOnce(new Error("cache write failed"));

    await expect(connectRemoteLedgerRepository(repository, client)).rejects.toThrow(
      "cache write failed",
    );
    expect(client.hasBootstrapCache()).toBe(false);
  });

  it("serializes concurrent phone bootstraps across tabs until the cache is complete", async () => {
    let previousLock = Promise.resolve();
    const requestLock = vi.fn(async <T>(_name: string, callback: () => Promise<T>): Promise<T> => {
      const waitForPrevious = previousLock;
      let release!: () => void;
      previousLock = new Promise<void>((resolve) => {
        release = resolve;
      });
      await waitForPrevious;
      try {
        return await callback();
      } finally {
        release();
      }
    });
    vi.stubGlobal("navigator", { locks: { request: requestLock } });

    try {
      const repository = new InMemoryLedgerRepository();
      const accountOperation = operation("account-serialized-bootstrap", {
        schema_version: 1,
        operation: "upsert",
        entity_type: "account",
        entity_id: "account-serialized-bootstrap",
        name: "Phone account",
        type: "checking",
        currency: "EUR",
        opening_balance_minor: "0",
        is_archived: false,
      });
      const request = vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/v1/bootstrap")
          ? response({ schema_version: 1, cursor: 0, operations: [[0, accountOperation]] })
          : response({ operations: [] }),
      );
      const client = new LocalHostSyncClient({
        endpoint: "https://phone.local",
        credentials: { deviceId: "pc-serialized-bootstrap", token: "token" },
        storage: storage(),
        request,
      });
      const originalSaveAccount = repository.saveAccount.bind(repository);
      let enteredFirstSave!: () => void;
      const firstSaveEntered = new Promise<void>((resolve) => {
        enteredFirstSave = resolve;
      });
      let finishFirstSave!: () => void;
      const firstSaveGate = new Promise<void>((resolve) => {
        finishFirstSave = resolve;
      });
      let activeSaves = 0;
      let maximumActiveSaves = 0;
      const saveSpy = vi.spyOn(repository, "saveAccount").mockImplementation(async (account) => {
        activeSaves += 1;
        maximumActiveSaves = Math.max(maximumActiveSaves, activeSaves);
        if (activeSaves === 1) {
          enteredFirstSave();
          await firstSaveGate;
        }
        try {
          await originalSaveAccount(account);
        } finally {
          activeSaves -= 1;
        }
      });

      const first = connectRemoteLedgerRepository(repository, client);
      await firstSaveEntered;
      const second = connectRemoteLedgerRepository(repository, client);
      await Promise.resolve();
      expect(request).toHaveBeenCalledTimes(1);
      finishFirstSave();
      await Promise.all([first, second]);

      expect(requestLock).toHaveBeenCalledTimes(2);
      expect(requestLock).toHaveBeenCalledWith(
        "nexora-remote-ledger-cache:pc-serialized-bootstrap",
        expect.any(Function),
      );
      expect(maximumActiveSaves).toBe(1);
      expect(request).toHaveBeenCalledTimes(2);
      expect(client.hasBootstrapCache()).toBe(true);
      saveSpy.mockRestore();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("waits for a local remote-ledger mutation before resetting a shared cache", async () => {
    const repository = new InMemoryLedgerRepository();
    const remoteAccount = operation("account-shared-cache", {
      schema_version: 1,
      operation: "upsert",
      entity_type: "account",
      entity_id: "account-shared-cache",
      name: "Phone account",
      type: "checking",
      currency: "EUR",
      opening_balance_minor: "0",
      is_archived: false,
    });
    let bootstrapCount = 0;
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/bootstrap")) {
        bootstrapCount += 1;
        return response({ schema_version: 1, cursor: 0, operations: [[0, remoteAccount]] });
      }
      if (init?.method === "POST") return response([{ Applied: { revision: 1 } }]);
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-mutation-lock", token: "token" },
      storage: storage(),
      request,
    });
    const resetSpy = vi.spyOn(repository, "resetFinancialData");
    const connection = await connectRemoteLedgerRepository(repository, client);
    const originalSaveAccount = repository.saveAccount.bind(repository);
    const newAccount = Account.create({
      id: "account-concurrent-edit",
      name: "PC account",
      type: "checking",
      currency: "EUR",
    });
    let enteredMutation!: () => void;
    const mutationEntered = new Promise<void>((resolve) => {
      enteredMutation = resolve;
    });
    let releaseMutation!: () => void;
    const mutationGate = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    vi.spyOn(repository, "saveAccount").mockImplementation(async (account) => {
      if (account.id === newAccount.id) {
        enteredMutation();
        await mutationGate;
      }
      return originalSaveAccount(account);
    });

    const mutation = connection.repository.saveAccount(newAccount);
    await mutationEntered;
    const rebuild = connectRemoteLedgerRepository(repository, client);
    await Promise.resolve();
    expect(bootstrapCount).toBe(1);
    expect(resetSpy).toHaveBeenCalledTimes(1);

    releaseMutation();
    await Promise.all([mutation, rebuild]);

    expect(bootstrapCount).toBe(2);
    expect(resetSpy).toHaveBeenCalledTimes(2);
  });

  it("waits for an active pull before another tab rebuilds the remote cache", async () => {
    const repository = new InMemoryLedgerRepository();
    let bootstrapCount = 0;
    const accountOperation = operation("account-pull-lock", {
      schema_version: 1,
      operation: "upsert",
      entity_type: "account",
      entity_id: "account-pull-lock",
      name: "Phone account",
      type: "checking",
      currency: "EUR",
      opening_balance_minor: "0",
      is_archived: false,
    });
    let enteredPull!: () => void;
    const pullEntered = new Promise<void>((resolve) => {
      enteredPull = resolve;
    });
    let releasePull!: () => void;
    const pullGate = new Promise<void>((resolve) => {
      releasePull = resolve;
    });
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/bootstrap")) {
        bootstrapCount += 1;
        return response({ schema_version: 1, cursor: 0, operations: [[0, accountOperation]] });
      }
      if (url.endsWith("after=0")) {
        enteredPull();
        await pullGate;
      }
      return response({ operations: [] });
    });
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-pull-lock", token: "token" },
      storage: storage(),
      request,
    });
    const resetSpy = vi.spyOn(repository, "resetFinancialData");
    const connection = await connectRemoteLedgerRepository(repository, client);
    const pull = connection.sync();
    await pullEntered;
    const rebuild = connectRemoteLedgerRepository(repository, client);
    await Promise.resolve();
    expect(bootstrapCount).toBe(1);
    expect(resetSpy).toHaveBeenCalledTimes(1);

    releasePull();
    await Promise.all([pull, rebuild]);

    expect(bootstrapCount).toBe(2);
    expect(resetSpy).toHaveBeenCalledTimes(2);
  });

  it("fails closed when cross-tab locking is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const request = vi.fn(async () => response({ schema_version: 1, cursor: 0, operations: [] }));
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-no-lock", token: "token" },
      storage: storage(),
      request,
    });

    await expect(
      connectRemoteLedgerRepository(new InMemoryLedgerRepository(), client),
    ).rejects.toThrow("remote_sync_lock_unavailable");
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps the bootstrap cache invalid when the revision index exceeds storage quota", async () => {
    const accountOperation = operation("account-bootstrap-quota", {
      schema_version: 1,
      operation: "upsert",
      entity_type: "account",
      entity_id: "account-bootstrap-quota",
      name: "Phone account",
      type: "checking",
      currency: "EUR",
      opening_balance_minor: "0",
      is_archived: false,
    });
    const localStorage = storage();
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key.includes("local-sync-revisions"))
        throw new DOMException("Quota", "QuotaExceededError");
      setItem(key, value);
    });
    const request = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/v1/bootstrap")
        ? response({ schema_version: 1, cursor: 0, operations: [[0, accountOperation]] })
        : response({ operations: [] }),
    );
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-bootstrap-quota", token: "token" },
      storage: localStorage,
      request,
    });
    client.markBootstrapCache();

    await expect(
      connectRemoteLedgerRepository(new InMemoryLedgerRepository(), client),
    ).rejects.toThrow();
    expect(client.hasBootstrapCache()).toBe(false);
  });

  it("imports a large phone snapshot without rewriting the revision index per record", async () => {
    const snapshotSize = 10_000;
    const operations = Array.from({ length: snapshotSize }, (_, index) => {
      const id = `bulk-account-${index}`;
      return [
        0,
        operation(id, {
          schema_version: 1,
          operation: "upsert",
          entity_type: "account",
          entity_id: id,
          name: `Account ${index}`,
          type: "checking",
          currency: "EUR",
          opening_balance_minor: "0",
          is_archived: false,
        }),
      ] as const;
    });
    const values = new Map<string, string>();
    const setItem = vi.fn((key: string, value: string) => values.set(key, value));
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem,
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    } as Storage;
    const request = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/v1/bootstrap")
        ? response({ schema_version: 1, cursor: 0, operations })
        : response({ operations: [] }),
    );
    const client = new LocalHostSyncClient({
      endpoint: "https://phone.local",
      credentials: { deviceId: "pc-large-bootstrap", token: "token" },
      storage: localStorage,
      request,
    });
    const repository = new InMemoryLedgerRepository();
    await connectRemoteLedgerRepository(repository, client);

    expect(await repository.listAccounts()).toHaveLength(snapshotSize);
    expect(setItem.mock.calls.filter(([key]) => key.includes("local-sync-revisions"))).toHaveLength(
      1,
    );
    expect(client.hasBootstrapCache()).toBe(true);
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
