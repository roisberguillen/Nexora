import {
  Account,
  Category,
  DomainError,
  type LedgerRepository,
  Transaction,
  type TransactionSplit,
  Transfer,
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
} from "../records/LedgerRecords";
import { PersistenceError } from "./PersistenceError";
import type { SqliteDatabase } from "./SqliteDatabase";

type EntityTable = "accounts" | "categories" | "transactions" | "transfers";

const accountColumns = `
  id,
  name,
  type,
  institution,
  currency,
  parent_account_id,
  opening_balance_minor,
  is_archived
`;

const categoryColumns = `
  id,
  name,
  kind_scope,
  parent_id,
  is_archived
`;

const transactionColumns = `
  id,
  kind,
  status,
  account_id,
  amount_minor,
  currency,
  booked_date,
  value_date,
  payee,
  description,
  category_id,
  note,
  source
`;

const transferColumns = `
  id,
  debit_transaction_id,
  credit_transaction_id,
  fee_transaction_id
`;

export class SqliteLedgerRepository implements LedgerRepository {
  private operationTail: Promise<void> = Promise.resolve();

  public constructor(private readonly database: SqliteDatabase) {}

  public saveAccount(account: Account): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const record = accountToRecord(account);
          await this.assertNew("accounts", account.id, "Account");
          if (account.parentAccountId !== undefined) {
            const parent = await this.findAccountByIdInternal(account.parentAccountId);
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

          await this.database.run(
            `
              INSERT INTO accounts (
                id,
                name,
                type,
                institution,
                currency,
                parent_account_id,
                opening_balance_minor,
                is_archived
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              record.id,
              record.name,
              record.type,
              record.institution,
              record.currency,
              record.parent_account_id,
              record.opening_balance_minor,
              record.is_archived,
            ],
          );
        }),
      ),
    );
  }

  public updateAccount(account: Account): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const existing = await this.findAccountByIdInternal(account.id);
          if (existing === undefined) {
            throw new DomainError("missing_reference", "Account does not exist.");
          }

          const transactionRows = await this.database.query<{
            readonly found: unknown;
          }>("SELECT 1 AS found FROM transactions WHERE account_id = ? LIMIT 1", [account.id]);
          const childRows = await this.database.query<{
            readonly found: unknown;
          }>(
            `
                SELECT 1 AS found
                FROM accounts
                WHERE parent_account_id = ? AND is_archived = 0
                LIMIT 1
            `,
            [account.id],
          );
          const parent =
            account.parentAccountId === undefined
              ? undefined
              : await this.findAccountByIdInternal(account.parentAccountId);

          validateAccountUpdate(existing, account, {
            hasActiveChildren: childRows.length > 0,
            hasTransactions: transactionRows.length > 0,
            parentIsArchived: parent?.isArchived ?? false,
          });

          const record = accountToRecord(account);
          await this.database.run(
            `
              UPDATE accounts
              SET
                name = ?,
                institution = ?,
                opening_balance_minor = ?,
                is_archived = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE id = ?
            `,
            [
              record.name,
              record.institution,
              record.opening_balance_minor,
              record.is_archived,
              record.id,
            ],
          );
        }),
      ),
    );
  }

  public saveCategory(category: Category): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const record = categoryToRecord(category);
          await this.assertNew("categories", category.id, "Category");
          if (
            category.parentId !== undefined &&
            (await this.findCategoryByIdInternal(category.parentId)) === undefined
          ) {
            throw new DomainError("missing_reference", "Parent category does not exist.");
          }

          await this.database.run(
            `
              INSERT INTO categories (
                id,
                name,
                kind_scope,
                parent_id,
                is_archived
              )
              VALUES (?, ?, ?, ?, ?)
            `,
            [record.id, record.name, record.kind_scope, record.parent_id, record.is_archived],
          );
        }),
      ),
    );
  }

  public updateCategory(category: Category): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          if ((await this.findCategoryByIdInternal(category.id)) === undefined)
            throw new DomainError("missing_reference", "Category does not exist.");
          const record = categoryToRecord(category);
          await this.database.run(
            "UPDATE categories SET name = ?, is_archived = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
            [record.name, record.is_archived, record.id],
          );
        }),
      ),
    );
  }

  public saveTransaction(transaction: Transaction): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          if (transaction.kind === "transfer") {
            throw new DomainError(
              "invalid_transfer",
              "Transfer legs must be persisted through saveTransfer.",
            );
          }
          await this.assertNew("transactions", transaction.id, "Transaction");
          await this.validateTransactionReferences(transaction);
          await this.insertTransaction(transaction);
        }),
      ),
    );
  }

  public saveTransactionWithSplits(
    transaction: Transaction,
    splits: readonly TransactionSplit[],
  ): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const { validateTransactionSplits } = await import("@nexora/domain");
          validateTransactionSplits(transaction, splits);
          await this.assertNew("transactions", transaction.id, "Transaction");
          await this.validateTransactionReferences(transaction);
          for (const split of splits) {
            if ((await this.findCategoryByIdInternal(split.categoryId))?.isArchived !== false)
              throw new DomainError("invalid_category", "Split category is unavailable.");
          }
          await this.insertTransaction(transaction);
          for (const split of splits) {
            const record = transactionSplitToRecord(split);
            await this.database.run(
              "INSERT INTO transaction_splits (id, transaction_id, category_id, amount_minor, currency, note) VALUES (?, ?, ?, ?, ?, ?)",
              [
                record.id,
                record.transaction_id,
                record.category_id,
                record.amount_minor,
                record.currency,
                record.note,
              ],
            );
          }
        }),
      ),
    );
  }

  public saveTransfer(bundle: TransferBundle): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const { transfer, debitTransaction, creditTransaction, feeTransaction } = bundle;
          const transactions =
            feeTransaction === undefined
              ? [debitTransaction, creditTransaction]
              : [debitTransaction, creditTransaction, feeTransaction];

          await this.assertNew("transfers", transfer.id, "Transfer");
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
            new Set(transactions.map((transaction) => transaction.id)).size !== transactions.length
          ) {
            throw new DomainError(
              "duplicate_entity",
              "Transfer bundle contains duplicate transactions.",
            );
          }

          for (const transaction of transactions) {
            await this.assertNew("transactions", transaction.id, "Transaction");
            await this.validateTransactionReferences(transaction);
          }
          for (const transaction of transactions) {
            await this.insertTransaction(transaction);
          }

          const transferRecord = transferToRecord(transfer);
          await this.database.run(
            `
              INSERT INTO transfers (
                id,
                debit_transaction_id,
                credit_transaction_id,
                fee_transaction_id
              )
              VALUES (?, ?, ?, ?)
            `,
            [
              transferRecord.id,
              transferRecord.debit_transaction_id,
              transferRecord.credit_transaction_id,
              transferRecord.fee_transaction_id,
            ],
          );
        }),
      ),
    );
  }

  public cancelTransaction(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const transaction = await this.findTransactionByIdInternal(id);
          if (transaction === undefined) {
            throw new DomainError("missing_reference", "Transaction does not exist.");
          }
          const transferRows = await this.database.query<{ readonly found: unknown }>(
            `
              SELECT 1 AS found
              FROM transfers
              WHERE debit_transaction_id = ? OR credit_transaction_id = ? OR fee_transaction_id = ?
              LIMIT 1
            `,
            [id, id, id],
          );
          if (transferRows.length > 0) {
            throw new DomainError(
              "invalid_transfer",
              "Transfer legs must be cancelled through their transfer bundle.",
            );
          }
          await this.updateTransactionStatus(transaction.cancel());
        }),
      ),
    );
  }

  public cancelTransfer(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const transferRows = await this.database.query<TransferRecord>(
            `SELECT ${transferColumns} FROM transfers WHERE id = ?`,
            [id],
          );
          const transferRow = transferRows[0];
          if (transferRow === undefined) {
            throw new DomainError("missing_reference", "Transfer does not exist.");
          }
          const transactionIds = transferRecordTransactionIds(transferRow);
          const placeholders = transactionIds.map(() => "?").join(", ");
          const transactionRows = await this.database.query<TransactionRecord>(
            `SELECT ${transactionColumns} FROM transactions WHERE id IN (${placeholders})`,
            transactionIds,
          );
          const transfer = transferFromRecord(transferRow, transactionRecordMap(transactionRows));
          const transactions = [
            await this.findTransactionByIdInternal(transfer.debitTransactionId),
            await this.findTransactionByIdInternal(transfer.creditTransactionId),
            ...(transfer.feeTransactionId === undefined
              ? []
              : [await this.findTransactionByIdInternal(transfer.feeTransactionId)]),
          ];
          const existingTransactions = transactions.filter(
            (transaction): transaction is Transaction => transaction !== undefined,
          );
          if (existingTransactions.length !== transactions.length) {
            throw new DomainError("missing_reference", "Transfer leg does not exist.");
          }
          for (const transaction of existingTransactions) {
            await this.updateTransactionStatus(transaction.cancel());
          }
        }),
      ),
    );
  }

  public findAccountById(id: string): Promise<Account | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() => this.findAccountByIdInternal(id)),
    );
  }

  public findCategoryById(id: string): Promise<Category | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() => this.findCategoryByIdInternal(id)),
    );
  }

  public findTransactionById(id: string): Promise<Transaction | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() => this.findTransactionByIdInternal(id)),
    );
  }

  public findTransferById(id: string): Promise<Transfer | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(async () => {
        const rows = await this.database.query<TransferRecord>(
          `SELECT ${transferColumns} FROM transfers WHERE id = ?`,
          [id],
        );
        const row = rows[0];
        if (row === undefined) {
          return undefined;
        }

        const transactionIds = transferRecordTransactionIds(row);
        const placeholders = transactionIds.map(() => "?").join(", ");
        const transactionRows = await this.database.query<TransactionRecord>(
          `SELECT ${transactionColumns} FROM transactions WHERE id IN (${placeholders})`,
          transactionIds,
        );
        return transferFromRecord(row, transactionRecordMap(transactionRows));
      }),
    );
  }

  public listAccounts(): Promise<readonly Account[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(async () => {
        const rows = await this.database.query<AccountRecord>(
          `SELECT ${accountColumns} FROM accounts ORDER BY created_at ASC, id ASC`,
        );
        return rows.map(accountFromRecord);
      }),
    );
  }

  public listCategories(): Promise<readonly Category[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(async () => {
        const rows = await this.database.query<CategoryRecord>(
          `SELECT ${categoryColumns} FROM categories ORDER BY created_at ASC, id ASC`,
        );
        return rows.map(categoryFromRecord);
      }),
    );
  }

  public listTransactions(): Promise<readonly Transaction[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(async () => {
        const rows = await this.database.query<TransactionRecord>(
          `SELECT ${transactionColumns} FROM transactions ORDER BY created_at ASC, id ASC`,
        );
        return rows.map(transactionFromRecord);
      }),
    );
  }

  public listTransfers(): Promise<readonly Transfer[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(async () => {
        const transferRows = await this.database.query<TransferRecord>(
          `SELECT ${transferColumns} FROM transfers ORDER BY created_at ASC, id ASC`,
        );
        if (transferRows.length === 0) {
          return [];
        }

        const transactionRows = await this.database.query<TransactionRecord>(
          `
            SELECT ${transactionColumns}
            FROM transactions
            WHERE id IN (
              SELECT debit_transaction_id FROM transfers
              UNION
              SELECT credit_transaction_id FROM transfers
              UNION
              SELECT fee_transaction_id FROM transfers WHERE fee_transaction_id IS NOT NULL
            )
          `,
        );
        const transactions = transactionRecordMap(transactionRows);
        return transferRows.map((row) => transferFromRecord(row, transactions));
      }),
    );
  }

  public async listTransactionSplits(transactionId: string): Promise<readonly TransactionSplit[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<TransactionSplitRecord>(
          "SELECT id, transaction_id, category_id, amount_minor, currency, note FROM transaction_splits WHERE transaction_id = ? ORDER BY id",
          [transactionId],
        )
      ).map(transactionSplitFromRecord),
    );
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
    try {
      return await operation();
    } catch (cause) {
      if (cause instanceof DomainError || cause instanceof PersistenceError) {
        throw cause;
      }
      throw new PersistenceError(
        "database_operation_failed",
        "The SQLite ledger operation failed.",
        cause,
      );
    }
  }

  private async withWriteTransaction<Result>(operation: () => Promise<Result>): Promise<Result> {
    await this.database.execute("BEGIN IMMEDIATE;");
    try {
      const result = await operation();
      await this.database.execute("COMMIT;");
      return result;
    } catch (cause) {
      try {
        await this.database.execute("ROLLBACK;");
      } catch {
        // The original operation error remains the actionable failure.
      }
      throw cause;
    }
  }

  private async assertNew(table: EntityTable, id: string, label: string): Promise<void> {
    const rows = await this.database.query<{ readonly found: unknown }>(
      `SELECT 1 AS found FROM ${table} WHERE id = ? LIMIT 1`,
      [id],
    );
    if (rows.length > 0) {
      throw new DomainError("duplicate_entity", `${label} id already exists.`);
    }
  }

  private async validateTransactionReferences(transaction: Transaction): Promise<void> {
    const account = await this.findAccountByIdInternal(transaction.accountId);
    if (account === undefined) {
      throw new DomainError("missing_reference", "Transaction account does not exist.");
    }
    if (account.currency !== transaction.amount.currency) {
      throw new DomainError(
        "currency_mismatch",
        "Transaction amount must use the account currency.",
      );
    }

    if (transaction.categoryId !== undefined) {
      const category = await this.findCategoryByIdInternal(transaction.categoryId);
      if (category === undefined) {
        throw new DomainError("missing_reference", "Transaction category does not exist.");
      }
      if (!category.accepts(transaction.kind)) {
        throw new DomainError(
          "invalid_category",
          "Transaction category does not accept this transaction kind.",
        );
      }
    }
  }

  private insertTransaction(transaction: Transaction): Promise<void> {
    const record = transactionToRecord(transaction);
    return this.database.run(
      `
        INSERT INTO transactions (
          id,
          kind,
          status,
          account_id,
          amount_minor,
          currency,
          booked_date,
          value_date,
          payee,
          description,
          category_id,
          note,
          source
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        record.id,
        record.kind,
        record.status,
        record.account_id,
        record.amount_minor,
        record.currency,
        record.booked_date,
        record.value_date,
        record.payee,
        record.description,
        record.category_id,
        record.note,
        record.source,
      ],
    );
  }

  private updateTransactionStatus(transaction: Transaction): Promise<void> {
    return this.database.run(
      `
        UPDATE transactions
        SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `,
      [transaction.status, transaction.id],
    );
  }

  private async findAccountByIdInternal(id: string): Promise<Account | undefined> {
    const rows = await this.database.query<AccountRecord>(
      `SELECT ${accountColumns} FROM accounts WHERE id = ?`,
      [id],
    );
    return rows[0] === undefined ? undefined : accountFromRecord(rows[0]);
  }

  private async findCategoryByIdInternal(id: string): Promise<Category | undefined> {
    const rows = await this.database.query<CategoryRecord>(
      `SELECT ${categoryColumns} FROM categories WHERE id = ?`,
      [id],
    );
    return rows[0] === undefined ? undefined : categoryFromRecord(rows[0]);
  }

  private async findTransactionByIdInternal(id: string): Promise<Transaction | undefined> {
    const rows = await this.database.query<TransactionRecord>(
      `SELECT ${transactionColumns} FROM transactions WHERE id = ?`,
      [id],
    );
    return rows[0] === undefined ? undefined : transactionFromRecord(rows[0]);
  }
}
