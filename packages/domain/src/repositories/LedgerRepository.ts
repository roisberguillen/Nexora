import type { Account } from "../entities/Account";
import type { Category } from "../entities/Category";
import type { Transaction } from "../entities/Transaction";
import type { Transfer } from "../entities/Transfer";
import type { TransactionSplit } from "../entities/TransactionSplit";
import type { Tag } from "../entities/Tag";
import type { ImportBatch } from "../entities/ImportBatch";
import type { ImportRow } from "../entities/ImportRow";

export interface TransferBundle {
  readonly transfer: Transfer;
  readonly debitTransaction: Transaction;
  readonly creditTransaction: Transaction;
  readonly feeTransaction?: Transaction;
}

export interface LedgerRepository {
  saveAccount(account: Account): Promise<void>;
  updateAccount(account: Account): Promise<void>;
  saveCategory(category: Category): Promise<void>;
  updateCategory(category: Category): Promise<void>;
  saveTag(tag: Tag): Promise<void>;
  saveImportBatch(batch: ImportBatch, rows: readonly ImportRow[]): Promise<void>;
  commitImportBatch(
    batch: ImportBatch,
    rows: readonly ImportRow[],
    transactions: readonly Transaction[],
  ): Promise<ImportBatch>;
  undoImportBatch(batchId: string): Promise<ImportBatch>;
  updateTag(tag: Tag): Promise<void>;
  setTransactionTags(transactionId: string, tagIds: readonly string[]): Promise<void>;
  saveTransaction(transaction: Transaction): Promise<void>;
  saveTransactionWithSplits(
    transaction: Transaction,
    splits: readonly TransactionSplit[],
  ): Promise<void>;
  saveTransactionWithDetails(
    transaction: Transaction,
    splits: readonly TransactionSplit[],
    tagIds: readonly string[],
  ): Promise<void>;
  saveTransfer(bundle: TransferBundle): Promise<void>;
  cancelTransaction(id: string): Promise<void>;
  cancelTransfer(id: string): Promise<void>;
  findAccountById(id: string): Promise<Account | undefined>;
  findCategoryById(id: string): Promise<Category | undefined>;
  findTransactionById(id: string): Promise<Transaction | undefined>;
  findTransferById(id: string): Promise<Transfer | undefined>;
  findImportBatchById(id: string): Promise<ImportBatch | undefined>;
  listAccounts(): Promise<readonly Account[]>;
  listCategories(): Promise<readonly Category[]>;
  listTags(): Promise<readonly Tag[]>;
  listTransactionTags(transactionId: string): Promise<readonly Tag[]>;
  listTransactions(): Promise<readonly Transaction[]>;
  listTransfers(): Promise<readonly Transfer[]>;
  listTransactionSplits(transactionId: string): Promise<readonly TransactionSplit[]>;
  listImportRows(batchId: string): Promise<readonly ImportRow[]>;
}
