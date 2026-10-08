import type {
  Account,
  Budget,
  Category,
  LedgerRepository,
  Tag,
  Transaction,
  TransferBundle,
} from "@nexora/domain";
import {
  Account as DomainAccount,
  Budget as DomainBudget,
  Category as DomainCategory,
  Tag as DomainTag,
  LocalDate,
  Money,
  Transfer as DomainTransfer,
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
          const operations = Array.isArray(operation) ? operation : [operation];
          for (const candidate of operations) client.enqueue(candidate);
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
  "saveTag",
  "updateTag",
  "deleteUnusedTag",
  "saveTransaction",
  "updateTransaction",
  "updateTransactionWithDetails",
  "saveTransactionWithSplits",
  "saveTransactionWithDetails",
  "saveTransfer",
  "cancelTransfer",
  "saveBudget",
  "updateBudget",
  "reviseBudget",
  "deleteBudget",
  "purgeTrashedTransaction",
]);

async function operationForMutation(
  method: string,
  args: readonly unknown[],
  repository: LedgerRepository,
  deviceId: string,
  revisions: Map<string, number>,
  client: LocalHostSyncClient,
): Promise<LocalSyncOperation | readonly LocalSyncOperation[] | undefined> {
  if (method === "saveTransfer") {
    const bundle = args[0] as TransferBundle;
    return [
      await operationFromPayload(
        bundle.debitTransaction.id,
        JSON.stringify(transactionPayload(bundle.debitTransaction)),
        false,
        deviceId,
        revisions,
        client,
      ),
      await operationFromPayload(
        bundle.creditTransaction.id,
        JSON.stringify(transactionPayload(bundle.creditTransaction)),
        false,
        deviceId,
        revisions,
        client,
      ),
      ...(bundle.feeTransaction === undefined
        ? []
        : [
            await operationFromPayload(
              bundle.feeTransaction.id,
              JSON.stringify(transactionPayload(bundle.feeTransaction)),
              false,
              deviceId,
              revisions,
              client,
            ),
          ]),
      await operationFromPayload(
        bundle.transfer.id,
        transferPayload(bundle),
        false,
        deviceId,
        revisions,
        client,
      ),
    ];
  }
  if (method === "cancelTransfer") {
    const transfer = await repository.findTransferById(String(args[0]));
    if (transfer === undefined) return undefined;
    const transactions = [
      await repository.findTransactionById(transfer.debitTransactionId),
      await repository.findTransactionById(transfer.creditTransactionId),
      ...(transfer.feeTransactionId === undefined
        ? []
        : [await repository.findTransactionById(transfer.feeTransactionId)]),
    ].filter((candidate): candidate is Transaction => candidate !== undefined);
    return Promise.all(
      transactions.map((candidate) =>
        operationFromPayload(
          candidate.id,
          JSON.stringify(transactionPayload(candidate)),
          false,
          deviceId,
          revisions,
          client,
        ),
      ),
    );
  }
  if (method === "saveBudget" || method === "updateBudget") {
    const budget = args[0] as Budget;
    return operationFromPayload(
      budget.id,
      JSON.stringify(budgetPayload(budget)),
      false,
      deviceId,
      revisions,
      client,
    );
  }
  if (method === "reviseBudget") {
    const previous = args[0] as Budget;
    const next = args[1] as Budget;
    return [
      await operationFromPayload(
        previous.id,
        JSON.stringify(budgetPayload(previous)),
        false,
        deviceId,
        revisions,
        client,
      ),
      await operationFromPayload(
        next.id,
        JSON.stringify(budgetPayload(next)),
        false,
        deviceId,
        revisions,
        client,
      ),
    ];
  }
  if (method === "deleteBudget") {
    return operationFromPayload(
      String(args[0]),
      JSON.stringify({
        schema_version: 1,
        operation: "delete",
        entity_type: "budget",
        entity_id: String(args[0]),
      }),
      true,
      deviceId,
      revisions,
      client,
    );
  }
  let transaction: Transaction | undefined;
  let account: Account | undefined;
  let category: Category | undefined;
  let tag: Tag | undefined;
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
  } else if (method === "saveTag" || method === "updateTag") {
    tag = args[0] as Tag;
    entityId = tag?.id;
  } else if (method === "deleteUnusedTag") {
    entityId = typeof args[0] === "string" ? args[0] : undefined;
    tombstone = true;
  }
  if (entityId === undefined) return undefined;
  if (method === "deleteUnusedAccount") account = await repository.findAccountById(entityId);
  if (method === "deleteUnusedCategory") category = await repository.findCategoryById(entityId);
  if (method === "deleteUnusedTag")
    tag = (await repository.listTags()).find((candidate) => candidate.id === entityId);
  const current = transaction ?? (await repository.findTransactionById(entityId));
  if (
    !tombstone &&
    current === undefined &&
    account === undefined &&
    category === undefined &&
    tag === undefined
  )
    return undefined;
  const payload = tombstone
    ? JSON.stringify({
        schema_version: 1,
        operation: "delete",
        entity_type:
          account !== undefined
            ? "account"
            : category !== undefined
              ? "category"
              : tag !== undefined
                ? "tag"
                : "transaction",
        entity_id: entityId,
      })
    : JSON.stringify(
        account !== undefined
          ? accountPayload(account)
          : category !== undefined
            ? categoryPayload(category)
            : tag !== undefined
              ? tagPayload(tag)
              : transactionPayload(current!),
      );
  return operationFromPayload(entityId, payload, tombstone, deviceId, revisions, client);
}

async function operationFromPayload(
  entityId: string,
  payload: string,
  tombstone: boolean,
  deviceId: string,
  revisions: Map<string, number>,
  client: LocalHostSyncClient,
): Promise<LocalSyncOperation> {
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

function transferPayload(bundle: TransferBundle): string {
  return JSON.stringify({
    schema_version: 1,
    operation: "upsert",
    entity_type: "transfer",
    entity_id: bundle.transfer.id,
    debit_transaction_id: bundle.transfer.debitTransactionId,
    credit_transaction_id: bundle.transfer.creditTransactionId,
    fee_transaction_id: bundle.transfer.feeTransactionId ?? null,
  });
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

function tagPayload(tag: Tag): Record<string, unknown> {
  return {
    schema_version: 1,
    operation: "upsert",
    entity_type: "tag",
    entity_id: tag.id,
    name: tag.name,
    is_archived: tag.isArchived,
  };
}

function budgetPayload(budget: Budget): Record<string, unknown> {
  return {
    schema_version: 1,
    operation: "upsert",
    entity_type: "budget",
    entity_id: budget.id,
    series_id: budget.seriesId,
    period: budget.period,
    effective_to_period: budget.effectiveToPeriod ?? null,
    category_id: budget.categoryId ?? null,
    amount_minor: budget.amount.amountMinor.toString(),
    currency: budget.amount.currency,
    first_alert_percentage: budget.firstAlertPercentage ?? null,
    second_alert_percentage: budget.secondAlertPercentage ?? null,
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
  if (payload.entity_type === "tag") {
    if (payload.operation === "delete") {
      if ((await repository.listTags()).some((candidate) => candidate.id === operation.entityId))
        await repository.deleteUnusedTag(operation.entityId);
      return;
    }
    const tag = DomainTag.create({
      id: operation.entityId,
      name: String(payload.name),
      isArchived: payload.is_archived === true,
    });
    if ((await repository.listTags()).some((candidate) => candidate.id === tag.id))
      await repository.updateTag(tag);
    else await repository.saveTag(tag);
    return;
  }
  if (payload.entity_type === "budget") {
    if (payload.operation === "delete") {
      const existing = (await repository.listBudgets()).find(
        (candidate) => candidate.id === operation.entityId,
      );
      if (existing) await repository.deleteBudget(operation.entityId);
      return;
    }
    const budget = DomainBudget.restore({
      id: operation.entityId,
      seriesId: String(payload.series_id ?? operation.entityId),
      period: String(payload.period),
      ...(payload.effective_to_period === null || payload.effective_to_period === undefined
        ? {}
        : { effectiveToPeriod: String(payload.effective_to_period) }),
      ...(payload.category_id === null || payload.category_id === undefined
        ? {}
        : { categoryId: String(payload.category_id) }),
      amount: Money.fromMinor(BigInt(String(payload.amount_minor)), String(payload.currency)),
      ...(payload.first_alert_percentage === null || payload.first_alert_percentage === undefined
        ? {}
        : { firstAlertPercentage: Number(payload.first_alert_percentage) }),
      ...(payload.second_alert_percentage === null || payload.second_alert_percentage === undefined
        ? {}
        : { secondAlertPercentage: Number(payload.second_alert_percentage) }),
    });
    if ((await repository.listBudgets()).some((candidate) => candidate.id === budget.id))
      await repository.updateBudget(budget);
    else await repository.saveBudget(budget);
    return;
  }
  if (payload.entity_type === "transfer") {
    if (payload.operation === "delete") {
      if (await repository.findTransferById(operation.entityId))
        await repository.cancelTransfer(operation.entityId).catch(() => undefined);
      return;
    }
    const debitTransaction = await repository.findTransactionById(
      String(payload.debit_transaction_id),
    );
    const creditTransaction = await repository.findTransactionById(
      String(payload.credit_transaction_id),
    );
    const feeTransaction =
      payload.fee_transaction_id === null || payload.fee_transaction_id === undefined
        ? undefined
        : await repository.findTransactionById(String(payload.fee_transaction_id));
    if (debitTransaction === undefined || creditTransaction === undefined) return;
    if (payload.fee_transaction_id !== null && payload.fee_transaction_id !== undefined) {
      if (feeTransaction === undefined) return;
    }
    const transfer = DomainTransfer.create({
      id: operation.entityId,
      debitTransaction,
      creditTransaction,
      ...(feeTransaction === undefined ? {} : { feeTransaction }),
    });
    if (await repository.findTransferById(transfer.id))
      await repository.cancelTransfer(transfer.id);
    await repository.saveTransfer({
      transfer,
      debitTransaction,
      creditTransaction,
      ...(feeTransaction === undefined ? {} : { feeTransaction }),
    });
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
