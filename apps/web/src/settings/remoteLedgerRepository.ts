import type { Account, Category, LedgerRepository, Transaction } from "@nexora/domain";
import {
  Account as DomainAccount,
  Category as DomainCategory,
  LocalDate,
  Money,
  Transaction as DomainTransaction,
} from "@nexora/domain";

import type { LocalSyncOperation } from "./localHostSync";
import { LocalHostSyncClient } from "./localHostSync";

export const remoteLedgerSyncEventName = "nexora:remote-ledger-sync";

export interface RemoteLedgerConnection {
  readonly repository: LedgerRepository;
  sync(): Promise<void>;
}

export async function connectRemoteLedgerRepository(
  repository: LedgerRepository,
  client: LocalHostSyncClient,
): Promise<RemoteLedgerConnection> {
  try {
    await client.flush();
  } catch {
    // The persistent outbox is retained for the next connection attempt.
  }
  let bootstrap;
  try {
    bootstrap = await client.bootstrap();
  } catch (error) {
    if (!client.hasBootstrapCache()) throw error;
    return {
      repository: createRemoteRepository(repository, client, new Map()),
      async sync(): Promise<void> {
        try {
          await client.flush();
          const pulled = await client.pull(client.cursor());
          let lastCursor = client.cursor();
          for (const [cursor, operation] of pulled.operations) {
            if (!Number.isSafeInteger(cursor) || cursor <= lastCursor)
              throw new Error("invalid_sync_pull_cursor");
            client.setRevision(operation.entityId, operation.revision);
            await applyRemoteOperation(repository, operation);
            lastCursor = cursor;
          }
          if (lastCursor !== client.cursor()) client.setCursor(lastCursor);
        } catch {
          // Cache and outbox remain authoritative locally until reconnect.
        }
      },
    };
  }
  // The remote cache is disposable. Rebuild it from the phone so deleted host
  // records cannot remain visible on the PC after a reconnect.
  await repository.resetFinancialData();
  const revisions = new Map<string, number>();
  for (const [, operation] of bootstrap.operations) {
    revisions.set(operation.entityId, operation.revision);
    await applyRemoteOperation(repository, operation);
  }
  client.setCursor(bootstrap.cursor);
  const remoteRepository = createRemoteRepository(repository, client, revisions);
  return {
    repository: remoteRepository,
    async sync(): Promise<void> {
      try {
        await client.flush();
      } catch {
        // The durable outbox keeps the operation for the next reconnect.
      }
      const after = client.cursor();
      const pulled = await client.pull(after);
      let lastCursor = after;
      for (const [cursor, operation] of pulled.operations) {
        if (!Number.isSafeInteger(cursor) || cursor < lastCursor) {
          throw new Error("invalid_sync_pull_cursor");
        }
        revisions.set(operation.entityId, operation.revision);
        client.setRevision(operation.entityId, operation.revision);
        await applyRemoteOperation(repository, operation);
        lastCursor = cursor;
      }
      if (lastCursor !== after) {
        client.setCursor(lastCursor);
        window.dispatchEvent(new Event(remoteLedgerSyncEventName));
      }
    },
  };
}

function createRemoteRepository(
  repository: LedgerRepository,
  client: LocalHostSyncClient,
  revisions: Map<string, number>,
): LedgerRepository {
  return new Proxy(repository, {
    get(target, property, receiver) {
      const method = Reflect.get(target, property, receiver);
      if (typeof method !== "function") return method;
      return async (...args: unknown[]) => {
        const methodName = String(property);
        if (mutatingMethods.has(methodName) && !supportedRemoteMutations.has(methodName)) {
          throw new Error(`remote_mutation_not_supported:${methodName}`);
        }
        const result = await method.apply(target, args);
        const operation = await operationForMutation(
          methodName,
          args,
          target,
          client.deviceId(),
          revisions,
          client,
        );
        if (operation !== undefined) {
          client.enqueue(operation);
          try {
            await client.flush();
          } catch {
            // The durable outbox keeps the operation for the next reconnect.
          }
        }
        return result;
      };
    },
  }) as LedgerRepository;
}

const mutatingMethods = new Set([
  "resetFinancialData",
  "saveAccount",
  "updateAccount",
  "deleteUnusedAccount",
  "saveCategory",
  "updateCategory",
  "deleteUnusedCategory",
  "saveCategory",
  "updateCategory",
  "deleteUnusedCategory",
  "mergeCategory",
  "saveTag",
  "updateTag",
  "deleteUnusedTag",
  "mergeTag",
  "removeTagGlobally",
  "setTransactionTags",
  "saveRecurringRule",
  "updateRecurringRule",
  "deleteRecurringRule",
  "saveAllocationPlan",
  "updateAllocationPlan",
  "deleteAllocationPlan",
  "saveBudget",
  "updateBudget",
  "reviseBudget",
  "deleteBudget",
  "saveLoan",
  "updateLoan",
  "deleteLoan",
  "saveInvestmentPosition",
  "updateInvestmentPosition",
  "deleteInvestmentPosition",
  "saveMonthlyJournal",
  "updateMonthlyJournal",
  "deleteMonthlyJournal",
  "saveImportBatch",
  "commitImportBatch",
  "undoImportBatch",
  "saveTransaction",
  "updateTransaction",
  "updateTransactionWithDetails",
  "saveTransactionWithSplits",
  "saveTransactionWithDetails",
  "saveTransfer",
  "cancelTransaction",
  "cancelTransfer",
  "trashTransaction",
  "trashTransactions",
  "restoreTransaction",
  "purgeTrashedTransaction",
  "purgeTrashedTransactions",
]);

const supportedRemoteMutations = new Set([
  "saveAccount",
  "updateAccount",
  "deleteUnusedAccount",
  "saveCategory",
  "updateCategory",
  "deleteUnusedCategory",
  "saveTransaction",
  "updateTransaction",
  "updateTransactionWithDetails",
  "saveTransactionWithSplits",
  "saveTransactionWithDetails",
  "purgeTrashedTransaction",
]);

async function operationForMutation(
  method: string,
  args: readonly unknown[],
  repository: LedgerRepository,
  deviceId: string,
  revisions: Map<string, number>,
  client: LocalHostSyncClient,
): Promise<LocalSyncOperation | undefined> {
  let transaction: Transaction | undefined;
  let account: Account | undefined;
  let category: Category | undefined;
  let entityId: string | undefined;
  let tombstone = false;
  if (
    method === "saveTransaction" ||
    method === "updateTransaction" ||
    method === "saveTransactionWithSplits" ||
    method === "saveTransactionWithDetails" ||
    method === "updateTransactionWithDetails"
  ) {
    transaction = args[0] as Transaction;
    entityId = transaction?.id;
  } else if (method === "purgeTrashedTransaction") {
    entityId = typeof args[0] === "string" ? args[0] : undefined;
    tombstone = true;
  } else if (method === "saveAccount" || method === "updateAccount") {
    account = args[0] as Account;
    entityId = account?.id;
  } else if (method === "deleteUnusedAccount") {
    entityId = typeof args[0] === "string" ? args[0] : undefined;
    tombstone = true;
  } else if (method === "saveCategory" || method === "updateCategory") {
    category = args[0] as Category;
    entityId = category?.id;
  } else if (method === "deleteUnusedCategory") {
    entityId = typeof args[0] === "string" ? args[0] : undefined;
    tombstone = true;
  }
  if (entityId === undefined) return undefined;
  if (method === "deleteUnusedAccount") account = await repository.findAccountById(entityId);
  if (method === "deleteUnusedCategory") category = await repository.findCategoryById(entityId);
  const current = transaction ?? (await repository.findTransactionById(entityId));
  if (!tombstone && current === undefined) return undefined;
  const payload = tombstone
    ? JSON.stringify({
        schema_version: 1,
        operation: "delete",
        entity_type:
          account !== undefined ? "account" : category !== undefined ? "category" : "transaction",
        entity_id: entityId,
      })
    : JSON.stringify(
        account !== undefined
          ? accountPayload(account)
          : category !== undefined
            ? categoryPayload(category)
            : transactionPayload(current!),
      );
  const baseRevision = revisions.get(entityId) ?? client.revision(entityId);
  revisions.set(entityId, baseRevision + 1);
  return {
    idempotencyKey: crypto.randomUUID(),
    deviceId,
    entityId,
    baseRevision,
    revision: baseRevision + 1,
    payloadDigest: await digest(payload),
    payload,
    tombstone,
    createdAt: new Date().toISOString(),
  };
}

function transactionPayload(transaction: Transaction): Record<string, unknown> {
  return {
    schema_version: 1,
    operation: "upsert",
    entity_type: "transaction",
    entity_id: transaction.id,
    amount_minor: transaction.amount.amountMinor.toString(),
    currency: transaction.amount.currency,
    kind: transaction.kind,
    status: transaction.status,
    account_id: transaction.accountId,
    booked_date: transaction.bookedDate.toString(),
    ...(transaction.valueDate === undefined
      ? {}
      : { value_date: transaction.valueDate.toString() }),
    ...(transaction.payee === undefined ? {} : { payee: transaction.payee }),
    ...(transaction.description === undefined ? {} : { description: transaction.description }),
    ...(transaction.categoryId === undefined ? {} : { category_id: transaction.categoryId }),
    ...(transaction.note === undefined ? {} : { note: transaction.note }),
    source: transaction.source,
  };
}

function accountPayload(account: Account): Record<string, unknown> {
  return {
    schema_version: 1,
    operation: "upsert",
    entity_type: "account",
    entity_id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    institution: account.institution ?? null,
    parent_account_id: account.parentAccountId ?? null,
    opening_balance_minor: account.openingBalance.amountMinor.toString(),
    is_archived: account.isArchived,
  };
}

function categoryPayload(category: Category): Record<string, unknown> {
  return {
    schema_version: 1,
    operation: "upsert",
    entity_type: "category",
    entity_id: category.id,
    name: category.name,
    kind_scope: category.kindScope,
    parent_id: category.parentId ?? null,
    is_archived: category.isArchived,
  };
}

async function applyRemoteOperation(
  repository: LedgerRepository,
  operation: LocalSyncOperation,
): Promise<void> {
  const payload = JSON.parse(operation.payload) as Record<string, unknown>;
  if (payload.entity_type === "account") {
    if (payload.operation === "delete") {
      if (await repository.findAccountById(operation.entityId))
        await repository.deleteUnusedAccount(operation.entityId);
      return;
    }
    const account = DomainAccount.create({
      id: operation.entityId,
      name: String(payload.name),
      type: String(payload.type) as Account["type"],
      currency: String(payload.currency),
      ...(payload.institution === null || payload.institution === undefined
        ? {}
        : { institution: String(payload.institution) }),
      ...(payload.parent_account_id === null || payload.parent_account_id === undefined
        ? {}
        : { parentAccountId: String(payload.parent_account_id) }),
      openingBalance: Money.fromMinor(
        BigInt(String(payload.opening_balance_minor ?? "0")),
        String(payload.currency),
      ),
      isArchived: payload.is_archived === true,
    });
    if (await repository.findAccountById(account.id)) await repository.updateAccount(account);
    else await repository.saveAccount(account);
    return;
  }
  if (payload.entity_type === "category") {
    if (payload.operation === "delete") {
      if (await repository.findCategoryById(operation.entityId))
        await repository.deleteUnusedCategory(operation.entityId);
      return;
    }
    const category = DomainCategory.create({
      id: operation.entityId,
      name: String(payload.name),
      kindScope: String(payload.kind_scope) as Category["kindScope"],
      ...(payload.parent_id === null || payload.parent_id === undefined
        ? {}
        : { parentId: String(payload.parent_id) }),
      isArchived: payload.is_archived === true,
    });
    if (await repository.findCategoryById(category.id)) await repository.updateCategory(category);
    else await repository.saveCategory(category);
    return;
  }
  if (payload.entity_type !== "transaction") return;
  if (payload.operation === "delete") {
    if (await repository.findTransactionById(operation.entityId)) {
      await repository.purgeTrashedTransaction(operation.entityId).catch(() => undefined);
    }
    return;
  }
  const account = await repository.findAccountById(String(payload.account_id));
  if (account === undefined) return;
  const transaction = DomainTransaction.create({
    id: operation.entityId,
    kind: String(payload.kind) as Transaction["kind"],
    status: String(payload.status) as Transaction["status"],
    accountId: account.id,
    amount: Money.fromMinor(BigInt(String(payload.amount_minor)), String(payload.currency)),
    bookedDate: LocalDate.parse(String(payload.booked_date)),
    source: String(payload.source) as Transaction["source"],
    ...(payload.value_date === undefined
      ? {}
      : { valueDate: LocalDate.parse(String(payload.value_date)) }),
    ...(payload.payee === undefined ? {} : { payee: String(payload.payee) }),
    ...(payload.description === undefined ? {} : { description: String(payload.description) }),
    ...(payload.category_id === undefined ? {} : { categoryId: String(payload.category_id) }),
    ...(payload.note === undefined ? {} : { note: String(payload.note) }),
  });
  if (await repository.findTransactionById(transaction.id))
    await repository.updateTransaction(transaction);
  else await repository.saveTransaction(transaction);
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
