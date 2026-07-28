import type { Account } from "../entities/Account";
import type { Category } from "../entities/Category";
import type { Transaction } from "../entities/Transaction";
import type { Transfer } from "../entities/Transfer";
import type { TransactionSplit } from "../entities/TransactionSplit";

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
  saveTransaction(transaction: Transaction): Promise<void>;
  saveTransactionWithSplits(
    transaction: Transaction,
    splits: readonly TransactionSplit[],
  ): Promise<void>;
  saveTransfer(bundle: TransferBundle): Promise<void>;
  cancelTransaction(id: string): Promise<void>;
  cancelTransfer(id: string): Promise<void>;
  findAccountById(id: string): Promise<Account | undefined>;
  findCategoryById(id: string): Promise<Category | undefined>;
  findTransactionById(id: string): Promise<Transaction | undefined>;
  findTransferById(id: string): Promise<Transfer | undefined>;
  listAccounts(): Promise<readonly Account[]>;
  listCategories(): Promise<readonly Category[]>;
  listTransactions(): Promise<readonly Transaction[]>;
  listTransfers(): Promise<readonly Transfer[]>;
  listTransactionSplits(transactionId: string): Promise<readonly TransactionSplit[]>;
}
