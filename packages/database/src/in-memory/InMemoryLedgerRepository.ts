import {
  type Account,
  type Category,
  DomainError,
  type LedgerRepository,
  type Transaction,
  type TransactionSplit,
  type Transfer,
  type TransferBundle,
  validateAccountUpdate,
} from "@nexora/domain";

export class InMemoryLedgerRepository implements LedgerRepository {
  private readonly accounts = new Map<string, Account>();
  private readonly categories = new Map<string, Category>();
  private readonly transactions = new Map<string, Transaction>();
  private readonly transfers = new Map<string, Transfer>();
  private readonly transactionSplits = new Map<string, TransactionSplit>();

  public async saveAccount(account: Account): Promise<void> {
    this.assertNew(this.accounts, account.id, "Account");

    if (account.parentAccountId !== undefined) {
      const parent = this.accounts.get(account.parentAccountId);
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

    this.accounts.set(account.id, account);
  }

  public async updateAccount(account: Account): Promise<void> {
    const existing = this.accounts.get(account.id);
    if (existing === undefined) {
      throw new DomainError("missing_reference", "Account does not exist.");
    }
    const parent =
      account.parentAccountId === undefined
        ? undefined
        : this.accounts.get(account.parentAccountId);

    validateAccountUpdate(existing, account, {
      hasActiveChildren: [...this.accounts.values()].some(
        (candidate) => candidate.parentAccountId === account.id && !candidate.isArchived,
      ),
      hasTransactions: [...this.transactions.values()].some(
        (transaction) => transaction.accountId === account.id,
      ),
      parentIsArchived: parent?.isArchived ?? false,
    });

    this.accounts.set(account.id, account);
  }

  public async saveCategory(category: Category): Promise<void> {
    this.assertNew(this.categories, category.id, "Category");
    if (category.parentId !== undefined && !this.categories.has(category.parentId)) {
      throw new DomainError("missing_reference", "Parent category does not exist.");
    }
    this.categories.set(category.id, category);
  }

  public async updateCategory(category: Category): Promise<void> {
    if (!this.categories.has(category.id))
      throw new DomainError("missing_reference", "Category does not exist.");
    this.categories.set(category.id, category);
  }

  public async saveTransaction(transaction: Transaction): Promise<void> {
    if (transaction.kind === "transfer") {
      throw new DomainError(
        "invalid_transfer",
        "Transfer legs must be persisted through saveTransfer.",
      );
    }
    this.assertNew(this.transactions, transaction.id, "Transaction");
    this.validateTransactionReferences(transaction);
    this.transactions.set(transaction.id, transaction);
  }

  public async saveTransactionWithSplits(
    transaction: Transaction,
    splits: readonly TransactionSplit[],
  ): Promise<void> {
    const { validateTransactionSplits } = await import("@nexora/domain");
    validateTransactionSplits(transaction, splits);
    this.assertNew(this.transactions, transaction.id, "Transaction");
    this.validateTransactionReferences(transaction);
    for (const split of splits) {
      this.assertNew(this.transactionSplits, split.id, "Transaction split");
      const category = this.categories.get(split.categoryId);
      if (category === undefined)
        throw new DomainError("missing_reference", "Split category does not exist.");
      if (category.isArchived || !category.accepts(transaction.kind))
        throw new DomainError("invalid_category", "Split category is incompatible.");
    }
    this.transactions.set(transaction.id, transaction);
    for (const split of splits) this.transactionSplits.set(split.id, split);
  }

  public async saveTransfer(bundle: TransferBundle): Promise<void> {
    const { transfer, debitTransaction, creditTransaction, feeTransaction } = bundle;
    const bundleTransactions =
      feeTransaction === undefined
        ? [debitTransaction, creditTransaction]
        : [debitTransaction, creditTransaction, feeTransaction];

    this.assertNew(this.transfers, transfer.id, "Transfer");
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
      throw new DomainError("duplicate_entity", "Transfer bundle contains duplicate transactions.");
    }

    for (const transaction of bundleTransactions) {
      this.assertNew(this.transactions, transaction.id, "Transaction");
      this.validateTransactionReferences(transaction);
    }

    for (const transaction of bundleTransactions) {
      this.transactions.set(transaction.id, transaction);
    }
    this.transfers.set(transfer.id, transfer);
  }

  public async cancelTransaction(id: string): Promise<void> {
    const transaction = this.transactions.get(id);
    if (transaction === undefined) {
      throw new DomainError("missing_reference", "Transaction does not exist.");
    }
    if (this.isTransferLeg(id)) {
      throw new DomainError(
        "invalid_transfer",
        "Transfer legs must be cancelled through their transfer bundle.",
      );
    }
    this.transactions.set(id, transaction.cancel());
  }

  public async cancelTransfer(id: string): Promise<void> {
    const transfer = this.transfers.get(id);
    if (transfer === undefined) {
      throw new DomainError("missing_reference", "Transfer does not exist.");
    }
    const transactionIds = [
      transfer.debitTransactionId,
      transfer.creditTransactionId,
      ...(transfer.feeTransactionId === undefined ? [] : [transfer.feeTransactionId]),
    ];
    const updated = transactionIds.map((transactionId) => {
      const transaction = this.transactions.get(transactionId);
      if (transaction === undefined) {
        throw new DomainError("missing_reference", "Transfer leg does not exist.");
      }
      return transaction.cancel();
    });
    for (const transaction of updated) {
      this.transactions.set(transaction.id, transaction);
    }
  }

  public async findAccountById(id: string): Promise<Account | undefined> {
    return this.accounts.get(id);
  }

  public async findCategoryById(id: string): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  public async findTransactionById(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  public async findTransferById(id: string): Promise<Transfer | undefined> {
    return this.transfers.get(id);
  }

  public async listAccounts(): Promise<readonly Account[]> {
    return [...this.accounts.values()];
  }

  public async listCategories(): Promise<readonly Category[]> {
    return [...this.categories.values()];
  }

  public async listTransactions(): Promise<readonly Transaction[]> {
    return [...this.transactions.values()];
  }

  public async listTransfers(): Promise<readonly Transfer[]> {
    return [...this.transfers.values()];
  }

  public async listTransactionSplits(transactionId: string): Promise<readonly TransactionSplit[]> {
    return [...this.transactionSplits.values()].filter(
      (split) => split.transactionId === transactionId,
    );
  }

  private assertNew<T>(collection: Map<string, T>, id: string, entityName: string): void {
    if (collection.has(id)) {
      throw new DomainError("duplicate_entity", `${entityName} id already exists.`);
    }
  }

  private validateTransactionReferences(transaction: Transaction): void {
    const account = this.accounts.get(transaction.accountId);
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
      const category = this.categories.get(transaction.categoryId);
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

  private isTransferLeg(transactionId: string): boolean {
    return [...this.transfers.values()].some(
      (transfer) =>
        transfer.debitTransactionId === transactionId ||
        transfer.creditTransactionId === transactionId ||
        transfer.feeTransactionId === transactionId,
    );
  }
}
