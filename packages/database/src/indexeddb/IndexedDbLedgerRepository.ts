import {
  type Account,
  type Category,
  DomainError,
  type LedgerRepository,
  type Transaction,
  type TransactionSplit,
  Tag,
  ImportBatch,
  ImportRow,
  type Transfer,
  type TransferBundle,
  validateAccountUpdate,
} from "@nexora/domain";

import {
  type AccountRecord,
  accountFromRecord,
  accountToRecord,
  type CategoryRecord,
  categoryFromRecord,
  categoryToRecord,
  type TransactionRecord,
  transactionFromRecord,
  transactionRecordMap,
  transactionToRecord,
  type TransferRecord,
  transferFromRecord,
  transferRecordTransactionIds,
  transferToRecord,
  transactionSplitFromRecord,
  transactionSplitToRecord,
  type TransactionSplitRecord,
  type TagRecord,
  tagFromRecord,
  tagToRecord,
} from "../records/LedgerRecords";
import { PersistenceError } from "../sqlite/PersistenceError";

type EntityStore =
  | "accounts"
  | "categories"
  | "transactions"
  | "transfers"
  | "transaction_splits"
  | "tags"
  | "transaction_tags"
  | "import_batches"
  | "import_rows";

export class IndexedDbLedgerRepository implements LedgerRepository {
  private operationTail: Promise<void> = Promise.resolve();
  private isClosed = false;

  public constructor(private readonly database: IDBDatabase) {}

  public saveAccount(account: Account): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["accounts"], "readwrite", async (transaction) => {
          const accounts = transaction.objectStore("accounts");
          await this.assertNew(accounts, account.id, "Account");

          if (account.parentAccountId !== undefined) {
            const parent = await this.findAccountInStore(accounts, account.parentAccountId);
            if (parent === undefined) {
              throw new DomainError("missing_reference", "Parent account does not exist.");
            }
            if (parent.type === "virtual_subaccount") {
              throw new DomainError("invalid_account", "Virtual subaccounts cannot be nested.");
            }
            if (parent.currency !== account.currency) {
              throw new DomainError(
                "currency_mismatch",
                "Virtual subaccounts must use the parent currency.",
              );
            }
            if (parent.isArchived) {
              throw new DomainError(
                "invalid_account",
                "Virtual subaccounts require an active parent account.",
              );
            }
          }

          await requestResult(accounts.add(accountToRecord(account)));
        }),
      ),
    );
  }

  public updateAccount(account: Account): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["accounts", "transactions"], "readwrite", async (transaction) => {
          const accounts = transaction.objectStore("accounts");
          const transactions = transaction.objectStore("transactions");
          const existing = await this.findAccountInStore(accounts, account.id);
          if (existing === undefined) {
            throw new DomainError("missing_reference", "Account does not exist.");
          }

          const [storedAccounts, transactionCount, parent] = await Promise.all([
            requestResult<unknown[]>(accounts.getAll()),
            requestResult(transactions.index("by_account_id").count(account.id)),
            account.parentAccountId === undefined
              ? Promise.resolve(undefined)
              : this.findAccountInStore(accounts, account.parentAccountId),
          ]);
          const accountRecords = storedAccounts.map((row) =>
            accountFromRecord(row as AccountRecord),
          );

          validateAccountUpdate(existing, account, {
            hasActiveChildren: accountRecords.some(
              (candidate) => candidate.parentAccountId === account.id && !candidate.isArchived,
            ),
            hasTransactions: transactionCount > 0,
            parentIsArchived: parent?.isArchived ?? false,
          });

          await requestResult(accounts.put(accountToRecord(account)));
        }),
      ),
    );
  }

  public saveCategory(category: Category): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["categories"], "readwrite", async (transaction) => {
          const categories = transaction.objectStore("categories");
          await this.assertNew(categories, category.id, "Category");
          if (
            category.parentId !== undefined &&
            (await this.findCategoryInStore(categories, category.parentId)) === undefined
          ) {
            throw new DomainError("missing_reference", "Parent category does not exist.");
          }

          await requestResult(categories.add(categoryToRecord(category)));
        }),
      ),
    );
  }

  public updateCategory(category: Category): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["categories"], "readwrite", async (transaction) => {
          const categories = transaction.objectStore("categories");
          if ((await this.findCategoryInStore(categories, category.id)) === undefined)
            throw new DomainError("missing_reference", "Category does not exist.");
          await requestResult(categories.put(categoryToRecord(category)));
        }),
      ),
    );
  }

  public saveTag(tag: Tag): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["tags"], "readwrite", async (transaction) => {
          const tags = transaction.objectStore("tags");
          await this.assertNew(tags, tag.id, "Tag");
          await requestResult(tags.add(tagToRecord(tag)));
        }),
      ),
    );
  }

  public updateTag(tag: Tag): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["tags"], "readwrite", async (transaction) => {
          const tags = transaction.objectStore("tags");
          if ((await requestResult<unknown>(tags.get(tag.id))) === undefined) {
            throw new DomainError("missing_reference", "Tag does not exist.");
          }
          await requestResult(tags.put(tagToRecord(tag)));
        }),
      ),
    );
  }
  public saveImportBatch(batch: ImportBatch, rows: readonly ImportRow[]): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["import_batches", "import_rows"],
          "readwrite",
          async (transaction) => {
            if (rows.length !== batch.rowsTotal || rows.some((row) => row.batchId !== batch.id))
              throw new DomainError("invalid_import", "Import batch rows are invalid.");
            const batches = transaction.objectStore("import_batches");
            const importRows = transaction.objectStore("import_rows");
            await this.assertNew(batches, batch.id, "Import batch");
            for (const row of rows) await this.assertNew(importRows, row.id, "Import row");
            await requestResult(batches.add(importBatchToRecord(batch)));
            for (const row of rows) await requestResult(importRows.add(importRowToRecord(row)));
          },
        ),
      ),
    );
  }

  public setTransactionTags(transactionId: string, tagIds: readonly string[]): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["transactions", "tags", "transaction_tags"],
          "readwrite",
          async (transaction) => {
            if (new Set(tagIds).size !== tagIds.length) {
              throw new DomainError(
                "duplicate_entity",
                "A transaction cannot contain duplicate tags.",
              );
            }
            if (
              (await requestResult<unknown>(
                transaction.objectStore("transactions").get(transactionId),
              )) === undefined
            ) {
              throw new DomainError("missing_reference", "Transaction does not exist.");
            }

            const tags = transaction.objectStore("tags");
            for (const tagId of tagIds) {
              const row = await requestResult<unknown>(tags.get(tagId));
              if (row === undefined || tagFromRecord(row as TagRecord).isArchived) {
                throw new DomainError("missing_reference", "Tag does not exist or is archived.");
              }
            }

            const transactionTags = transaction.objectStore("transaction_tags");
            const existingKeys = await requestResult<IDBValidKey[]>(
              transactionTags.index("by_transaction_id").getAllKeys(transactionId),
            );
            for (const key of existingKeys) {
              await requestResult(transactionTags.delete(key));
            }
            for (const tagId of tagIds) {
              await requestResult(
                transactionTags.add({ transaction_id: transactionId, tag_id: tagId }),
              );
            }
          },
        ),
      ),
    );
  }

  public saveTransaction(transaction: Transaction): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["accounts", "categories", "transactions"],
          "readwrite",
          async (idbTransaction) => {
            if (transaction.kind === "transfer") {
              throw new DomainError(
                "invalid_transfer",
                "Transfer legs must be persisted through saveTransfer.",
              );
            }

            const transactions = idbTransaction.objectStore("transactions");
            await this.assertNew(transactions, transaction.id, "Transaction");
            await this.validateTransactionReferences(idbTransaction, transaction);
            await requestResult(transactions.add(transactionToRecord(transaction)));
          },
        ),
      ),
    );
  }

  public saveTransactionWithSplits(
    transaction: Transaction,
    splits: readonly TransactionSplit[],
  ): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["accounts", "categories", "transactions", "transaction_splits"],
          "readwrite",
          async (idbTransaction) => {
            const { validateTransactionSplits } = await import("@nexora/domain");
            validateTransactionSplits(transaction, splits);
            const transactions = idbTransaction.objectStore("transactions");
            const splitStore = idbTransaction.objectStore("transaction_splits");
            await this.assertNew(transactions, transaction.id, "Transaction");
            await this.validateTransactionReferences(idbTransaction, transaction);
            for (const split of splits) {
              await this.assertNew(splitStore, split.id, "Transaction split");
              const category = await this.findCategoryInStore(
                idbTransaction.objectStore("categories"),
                split.categoryId,
              );
              if (
                category === undefined ||
                category.isArchived ||
                !category.accepts(transaction.kind)
              )
                throw new DomainError("invalid_category", "Split category is unavailable.");
            }
            await requestResult(transactions.add(transactionToRecord(transaction)));
            for (const split of splits)
              await requestResult(splitStore.add(transactionSplitToRecord(split)));
          },
        ),
      ),
    );
  }

  public saveTransactionWithDetails(
    transaction: Transaction,
    splits: readonly TransactionSplit[],
    tagIds: readonly string[],
  ): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          [
            "accounts",
            "categories",
            "transactions",
            "transaction_splits",
            "tags",
            "transaction_tags",
          ],
          "readwrite",
          async (idbTransaction) => {
            const { validateTransactionSplits } = await import("@nexora/domain");
            validateTransactionSplits(transaction, splits);
            if (new Set(tagIds).size !== tagIds.length)
              throw new DomainError("duplicate_entity", "Duplicate tag reference.");
            const transactions = idbTransaction.objectStore("transactions");
            const splitStore = idbTransaction.objectStore("transaction_splits");
            await this.assertNew(transactions, transaction.id, "Transaction");
            await this.validateTransactionReferences(idbTransaction, transaction);
            for (const split of splits) {
              await this.assertNew(splitStore, split.id, "Transaction split");
              const category = await this.findCategoryInStore(
                idbTransaction.objectStore("categories"),
                split.categoryId,
              );
              if (
                category === undefined ||
                category.isArchived ||
                !category.accepts(transaction.kind)
              )
                throw new DomainError("invalid_category", "Split category is unavailable.");
            }
            const tags = idbTransaction.objectStore("tags");
            for (const tagId of tagIds) {
              const row = await requestResult<unknown>(tags.get(tagId));
              if (row === undefined || tagFromRecord(row as TagRecord).isArchived)
                throw new DomainError("missing_reference", "Tag is unavailable.");
            }
            await requestResult(transactions.add(transactionToRecord(transaction)));
            for (const split of splits)
              await requestResult(splitStore.add(transactionSplitToRecord(split)));
            const transactionTags = idbTransaction.objectStore("transaction_tags");
            for (const tagId of tagIds)
              await requestResult(
                transactionTags.add({ transaction_id: transaction.id, tag_id: tagId }),
              );
          },
        ),
      ),
    );
  }

  public saveTransfer(bundle: TransferBundle): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["accounts", "categories", "transactions", "transfers"],
          "readwrite",
          async (idbTransaction) => {
            const { transfer, debitTransaction, creditTransaction, feeTransaction } = bundle;
            const bundleTransactions =
              feeTransaction === undefined
                ? [debitTransaction, creditTransaction]
                : [debitTransaction, creditTransaction, feeTransaction];
            const transactions = idbTransaction.objectStore("transactions");
            const transfers = idbTransaction.objectStore("transfers");

            await this.assertNew(transfers, transfer.id, "Transfer");
            if (
              transfer.debitTransactionId !== debitTransaction.id ||
              transfer.creditTransactionId !== creditTransaction.id ||
              transfer.feeTransactionId !== feeTransaction?.id
            ) {
              throw new DomainError(
                "invalid_transfer",
                "Transfer bundle does not match its transaction ids.",
              );
            }
            if (
              new Set(bundleTransactions.map((transaction) => transaction.id)).size !==
              bundleTransactions.length
            ) {
              throw new DomainError(
                "duplicate_entity",
                "Transfer bundle contains duplicate transactions.",
              );
            }

            for (const transaction of bundleTransactions) {
              await this.assertNew(transactions, transaction.id, "Transaction");
              await this.validateTransactionReferences(idbTransaction, transaction);
            }
            for (const transaction of bundleTransactions) {
              await requestResult(transactions.add(transactionToRecord(transaction)));
            }
            await requestResult(transfers.add(transferToRecord(transfer)));
          },
        ),
      ),
    );
  }

  public cancelTransaction(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["transactions", "transfers"], "readwrite", async (transaction) => {
          const transactions = transaction.objectStore("transactions");
          const storedTransaction = await requestResult<unknown>(transactions.get(id));
          if (storedTransaction === undefined) {
            throw new DomainError("missing_reference", "Transaction does not exist.");
          }
          const transferRecords = await requestResult<unknown[]>(
            transaction.objectStore("transfers").getAll(),
          );
          if (
            transferRecords.some((record) => {
              const transfer = record as TransferRecord;
              return (
                transfer.debit_transaction_id === id ||
                transfer.credit_transaction_id === id ||
                transfer.fee_transaction_id === id
              );
            })
          ) {
            throw new DomainError(
              "invalid_transfer",
              "Transfer legs must be cancelled through their transfer bundle.",
            );
          }
          const cancelled = transactionFromRecord(storedTransaction as TransactionRecord).cancel();
          await requestResult(transactions.put(transactionToRecord(cancelled)));
        }),
      ),
    );
  }

  public cancelTransfer(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["transactions", "transfers"], "readwrite", async (transaction) => {
          const transfers = transaction.objectStore("transfers");
          const storedTransfer = await requestResult<unknown>(transfers.get(id));
          if (storedTransfer === undefined) {
            throw new DomainError("missing_reference", "Transfer does not exist.");
          }
          const transferRecord = storedTransfer as TransferRecord;
          const transactions = transaction.objectStore("transactions");
          const transactionRecords = await Promise.all(
            transferRecordTransactionIds(transferRecord).map((transactionId) =>
              requestResult<unknown>(transactions.get(transactionId)),
            ),
          );
          if (transactionRecords.some((record) => record === undefined)) {
            throw new DomainError("missing_reference", "Transfer leg does not exist.");
          }
          const records = transactionRecords as readonly TransactionRecord[];
          const transfer = transferFromRecord(transferRecord, transactionRecordMap(records));
          const cancelled = transferRecordTransactionIds(transferRecord).map((transactionId) => {
            const current = transactionRecordMap(records).get(transactionId);
            if (current === undefined) {
              throw new DomainError("missing_reference", "Transfer leg does not exist.");
            }
            return current.cancel();
          });
          if (transfer.id !== id) {
            throw new DomainError(
              "invalid_transfer",
              "Transfer record does not match its identifier.",
            );
          }
          for (const transactionToCancel of cancelled) {
            await requestResult(transactions.put(transactionToRecord(transactionToCancel)));
          }
        }),
      ),
    );
  }

  public findAccountById(id: string): Promise<Account | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["accounts"], "readonly", (transaction) =>
          this.findAccountInStore(transaction.objectStore("accounts"), id),
        ),
      ),
    );
  }

  public findCategoryById(id: string): Promise<Category | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["categories"], "readonly", (transaction) =>
          this.findCategoryInStore(transaction.objectStore("categories"), id),
        ),
      ),
    );
  }

  public findTransactionById(id: string): Promise<Transaction | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["transactions"], "readonly", async (transaction) => {
          const value = await requestResult<unknown>(
            transaction.objectStore("transactions").get(id),
          );
          return value === undefined
            ? undefined
            : transactionFromRecord(value as TransactionRecord);
        }),
      ),
    );
  }

  public findTransferById(id: string): Promise<Transfer | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["transactions", "transfers"], "readonly", async (transaction) => {
          const value = await requestResult<unknown>(transaction.objectStore("transfers").get(id));
          if (value === undefined) {
            return undefined;
          }

          const transferRecord = value as TransferRecord;
          const transactionStore = transaction.objectStore("transactions");
          const transactionRecords = await Promise.all(
            transferRecordTransactionIds(transferRecord).map((transactionId) =>
              requestResult<unknown>(transactionStore.get(transactionId)),
            ),
          );
          if (transactionRecords.some((record) => record === undefined)) {
            throw new PersistenceError(
              "corrupt_record",
              "The persisted transfer record has a missing leg.",
            );
          }
          return transferFromRecord(
            transferRecord,
            transactionRecordMap(transactionRecords as readonly TransactionRecord[]),
          );
        }),
      ),
    );
  }
  public findImportBatchById(id: string): Promise<ImportBatch | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["import_batches"], "readonly", async (transaction) => {
          const row = await requestResult<unknown>(
            transaction.objectStore("import_batches").get(id),
          );
          return row === undefined ? undefined : importBatchFromRecord(row as ImportBatchRecord);
        }),
      ),
    );
  }

  public listAccounts(): Promise<readonly Account[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["accounts"], "readonly", async (transaction) => {
          const rows = await requestResult<unknown[]>(transaction.objectStore("accounts").getAll());
          return rows.map((row) => accountFromRecord(row as AccountRecord));
        }),
      ),
    );
  }

  public listCategories(): Promise<readonly Category[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["categories"], "readonly", async (transaction) => {
          const rows = await requestResult<unknown[]>(
            transaction.objectStore("categories").getAll(),
          );
          return rows.map((row) => categoryFromRecord(row as CategoryRecord));
        }),
      ),
    );
  }
  public listTags(): Promise<readonly Tag[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["tags"], "readonly", async (transaction) => {
          const rows = await requestResult<unknown[]>(transaction.objectStore("tags").getAll());
          return rows.map((row) => tagFromRecord(row as TagRecord));
        }),
      ),
    );
  }

  public listTransactionTags(transactionId: string): Promise<readonly Tag[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["tags", "transaction_tags"], "readonly", async (transaction) => {
          const links = await requestResult<Array<{ readonly tag_id: string }>>(
            transaction
              .objectStore("transaction_tags")
              .index("by_transaction_id")
              .getAll(transactionId),
          );
          const tags = transaction.objectStore("tags");
          const rows = await Promise.all(
            links.map((link) => requestResult<unknown>(tags.get(link.tag_id))),
          );
          return rows
            .filter((row): row is TagRecord => row !== undefined)
            .map((row) => tagFromRecord(row));
        }),
      ),
    );
  }

  public listTransactions(): Promise<readonly Transaction[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["transactions"], "readonly", async (transaction) => {
          const rows = await requestResult<unknown[]>(
            transaction.objectStore("transactions").getAll(),
          );
          return rows.map((row) => transactionFromRecord(row as TransactionRecord));
        }),
      ),
    );
  }

  public listTransfers(): Promise<readonly Transfer[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["transactions", "transfers"], "readonly", async (transaction) => {
          const transferRequest = requestResult<unknown[]>(
            transaction.objectStore("transfers").getAll(),
          );
          const transactionRequest = requestResult<unknown[]>(
            transaction.objectStore("transactions").getAll(),
          );
          const [transferRows, transactionRows] = await Promise.all([
            transferRequest,
            transactionRequest,
          ]);
          const transactions = transactionRecordMap(
            transactionRows as readonly TransactionRecord[],
          );
          return transferRows.map((row) => transferFromRecord(row as TransferRecord, transactions));
        }),
      ),
    );
  }

  public async listTransactionSplits(transactionId: string): Promise<readonly TransactionSplit[]> {
    return this.performDatabaseOperation(() =>
      this.withTransaction(["transaction_splits"], "readonly", async (transaction) =>
        (
          await requestResult<unknown[]>(
            transaction
              .objectStore("transaction_splits")
              .index("by_transaction_id")
              .getAll(transactionId),
          )
        ).map((row) => transactionSplitFromRecord(row as TransactionSplitRecord)),
      ),
    );
  }
  public async listImportRows(batchId: string): Promise<readonly ImportRow[]> {
    return this.performDatabaseOperation(() =>
      this.withTransaction(["import_rows"], "readonly", async (transaction) =>
        (
          await requestResult<unknown[]>(
            transaction.objectStore("import_rows").index("by_batch_id").getAll(batchId),
          )
        )
          .map((row) => importRowFromRecord(row as ImportRowRecord))
          .sort((left, right) => left.rowNumber - right.rowNumber),
      ),
    );
  }

  public close(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.database.close();
  }

  private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async performDatabaseOperation<Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> {
    if (this.isClosed) {
      throw new PersistenceError(
        "persistence_closed",
        "The IndexedDB ledger connection is closed.",
      );
    }

    try {
      return await operation();
    } catch (cause) {
      if (cause instanceof DomainError || cause instanceof PersistenceError) {
        throw cause;
      }
      throw new PersistenceError(
        "database_operation_failed",
        "The IndexedDB ledger operation failed.",
        cause,
      );
    }
  }

  private async withTransaction<Result>(
    stores: readonly EntityStore[],
    mode: IDBTransactionMode,
    operation: (transaction: IDBTransaction) => Promise<Result>,
  ): Promise<Result> {
    const transaction = this.database.transaction(stores, mode);
    const completion = transactionCompletion(transaction);

    try {
      const result = await operation(transaction);
      await completion;
      return result;
    } catch (cause) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted because of the failed request.
      }
      try {
        await completion;
      } catch {
        // The original operation error remains the actionable failure.
      }
      throw cause;
    }
  }

  private async assertNew(store: IDBObjectStore, id: string, label: string): Promise<void> {
    if ((await requestResult<unknown>(store.get(id))) !== undefined) {
      throw new DomainError("duplicate_entity", `${label} id already exists.`);
    }
  }

  private async validateTransactionReferences(
    transaction: IDBTransaction,
    ledgerTransaction: Transaction,
  ): Promise<void> {
    const account = await this.findAccountInStore(
      transaction.objectStore("accounts"),
      ledgerTransaction.accountId,
    );
    if (account === undefined) {
      throw new DomainError("missing_reference", "Transaction account does not exist.");
    }
    if (account.currency !== ledgerTransaction.amount.currency) {
      throw new DomainError(
        "currency_mismatch",
        "Transaction amount must use the account currency.",
      );
    }

    if (ledgerTransaction.categoryId !== undefined) {
      const category = await this.findCategoryInStore(
        transaction.objectStore("categories"),
        ledgerTransaction.categoryId,
      );
      if (category === undefined) {
        throw new DomainError("missing_reference", "Transaction category does not exist.");
      }
      if (!category.accepts(ledgerTransaction.kind)) {
        throw new DomainError(
          "invalid_category",
          "Transaction category does not accept this transaction kind.",
        );
      }
    }
  }

  private async findAccountInStore(
    store: IDBObjectStore,
    id: string,
  ): Promise<Account | undefined> {
    const value = await requestResult<unknown>(store.get(id));
    return value === undefined ? undefined : accountFromRecord(value as AccountRecord);
  }

  private async findCategoryInStore(
    store: IDBObjectStore,
    id: string,
  ): Promise<Category | undefined> {
    const value = await requestResult<unknown>(store.get(id));
    return value === undefined ? undefined : categoryFromRecord(value as CategoryRecord);
  }
}

interface ImportBatchRecord {
  readonly id: string;
  readonly importer_type: "money_manager_xlsx";
  readonly source_filename: string;
  readonly source_sha256: string;
  readonly status: "previewed" | "committed" | "undone" | "failed";
  readonly rows_total: number;
  readonly rows_imported: number;
  readonly rows_skipped: number;
  readonly rows_failed: number;
}
interface ImportRowRecord {
  readonly id: string;
  readonly batch_id: string;
  readonly row_number: number;
  readonly raw_json: string;
  readonly normalized_json: string | null;
  readonly status: "imported" | "skipped_duplicate" | "needs_review" | "failed";
  readonly error_code: string | null;
  readonly created_transaction_id: string | null;
}
function importBatchToRecord(batch: ImportBatch): ImportBatchRecord {
  return {
    id: batch.id,
    importer_type: batch.importerType,
    source_filename: batch.sourceFilename,
    source_sha256: batch.sourceSha256,
    status: batch.status,
    rows_total: batch.rowsTotal,
    rows_imported: batch.rowsImported,
    rows_skipped: batch.rowsSkipped,
    rows_failed: batch.rowsFailed,
  };
}
function importBatchFromRecord(row: ImportBatchRecord): ImportBatch {
  return ImportBatch.create({
    id: row.id,
    importerType: row.importer_type,
    sourceFilename: row.source_filename,
    sourceSha256: row.source_sha256,
    status: row.status,
    rowsTotal: row.rows_total,
    rowsImported: row.rows_imported,
    rowsSkipped: row.rows_skipped,
    rowsFailed: row.rows_failed,
  });
}
function importRowToRecord(row: ImportRow): ImportRowRecord {
  return {
    id: row.id,
    batch_id: row.batchId,
    row_number: row.rowNumber,
    raw_json: row.rawJson,
    normalized_json: row.normalizedJson ?? null,
    status: row.status,
    error_code: row.errorCode ?? null,
    created_transaction_id: row.createdTransactionId ?? null,
  };
}
function importRowFromRecord(row: ImportRowRecord): ImportRow {
  return ImportRow.create({
    id: row.id,
    batchId: row.batch_id,
    rowNumber: row.row_number,
    rawJson: row.raw_json,
    status: row.status,
    ...(row.normalized_json === null ? {} : { normalizedJson: row.normalized_json }),
    ...(row.error_code === null ? {} : { errorCode: row.error_code }),
    ...(row.created_transaction_id === null
      ? {}
      : { createdTransactionId: row.created_transaction_id }),
  });
}

function requestResult<Result>(request: IDBRequest<Result>): Promise<Result> {
  return new Promise<Result>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed."));
    };
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    };
  });
}
