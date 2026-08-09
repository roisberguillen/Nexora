import {
  type Account,
  Category,
  DomainError,
  type LedgerRepository,
  Transaction,
  TransactionSplit,
  type Transfer,
  type TransferBundle,
  type Tag,
  type ImportBatch,
  ImportRow,
  type ImportTransferBundle,
  RecurringRule,
  type AllocationPlan,
  Budget,
  type Loan,
  type InvestmentPosition,
  type MonthlyJournal,
  type TrashedTransaction,
  validateImportCommit,
  validateAccountUpdate,
  createSystemCategories,
  isSystemCategory,
  validateCategoryMerge,
  validateCategoryHierarchy,
} from "@nexora/domain";

export class InMemoryLedgerRepository implements LedgerRepository {
  private readonly accounts = new Map<string, Account>();
  private readonly categories = new Map<string, Category>();
  private readonly transactions = new Map<string, Transaction>();
  private readonly transactionTrash = new Map<string, Omit<TrashedTransaction, "transaction">>();
  private readonly transfers = new Map<string, Transfer>();
  private readonly transactionSplits = new Map<string, TransactionSplit>();
  private readonly tags = new Map<string, Tag>();
  private readonly transactionTags = new Map<string, Set<string>>();
  private readonly importBatches = new Map<string, ImportBatch>();
  private readonly importRows = new Map<string, ImportRow>();
  private readonly recurringRules = new Map<string, RecurringRule>();
  private readonly allocationPlans = new Map<string, AllocationPlan>();
  private readonly budgets = new Map<string, Budget>();
  private readonly loans = new Map<string, Loan>();
  private readonly investmentPositions = new Map<string, InvestmentPosition>();
  private readonly monthlyJournals = new Map<string, MonthlyJournal>();

  public async runAtomically<Result>(operation: () => Promise<Result>): Promise<Result> {
    const snapshot = this.captureState();
    try {
      return await operation();
    } catch (cause) {
      this.restoreState(snapshot);
      throw cause;
    }
  }

  public async resetFinancialData(): Promise<void> {
    await this.runAtomically(async () => {
      this.accounts.clear();
      this.categories.clear();
      this.transactions.clear();
      this.transactionTrash.clear();
      this.transfers.clear();
      this.transactionSplits.clear();
      this.tags.clear();
      this.transactionTags.clear();
      this.importBatches.clear();
      this.importRows.clear();
      this.recurringRules.clear();
      this.allocationPlans.clear();
      this.budgets.clear();
      this.loans.clear();
      this.investmentPositions.clear();
      this.monthlyJournals.clear();
      for (const category of createSystemCategories()) this.categories.set(category.id, category);
    });
  }

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

  public async deleteUnusedAccount(id: string): Promise<void> {
    if (!this.accounts.has(id))
      throw new DomainError("missing_reference", "Account does not exist.");
    const isReferenced =
      [...this.transactions.values()].some((transaction) => transaction.accountId === id) ||
      [...this.accounts.values()].some((account) => account.parentAccountId === id) ||
      [...this.recurringRules.values()].some((rule) => rule.accountId === id) ||
      [...this.allocationPlans.values()].some(
        (plan) => plan.sourceAccountId === id || plan.targetAccountId === id,
      ) ||
      [...this.loans.values()].some((loan) => loan.accountId === id) ||
      [...this.investmentPositions.values()].some((position) => position.accountId === id);
    if (isReferenced)
      throw new DomainError(
        "invalid_account",
        "An account with financial references must be archived instead of deleted.",
      );
    this.accounts.delete(id);
  }

  public async saveCategory(category: Category): Promise<void> {
    this.assertNew(this.categories, category.id, "Category");
    validateCategoryHierarchy([...this.categories.values(), category]);
    this.categories.set(category.id, category);
  }

  public async updateCategory(category: Category): Promise<void> {
    if (!this.categories.has(category.id))
      throw new DomainError("missing_reference", "Category does not exist.");
    if (isSystemCategory(category.id))
      throw new DomainError("invalid_category", "System categories are protected.");
    validateCategoryHierarchy(
      [...this.categories.values()].map((current) =>
        current.id === category.id ? category : current,
      ),
    );
    this.categories.set(category.id, category);
  }

  public async deleteUnusedCategory(id: string): Promise<void> {
    if (!this.categories.has(id))
      throw new DomainError("missing_reference", "Category does not exist.");
    if (isSystemCategory(id))
      throw new DomainError("invalid_category", "System categories are protected.");
    const isReferenced =
      [...this.categories.values()].some((category) => category.parentId === id) ||
      [...this.transactions.values()].some((transaction) => transaction.categoryId === id) ||
      [...this.transactionSplits.values()].some((split) => split.categoryId === id) ||
      [...this.budgets.values()].some((budget) => budget.categoryId === id) ||
      [...this.recurringRules.values()].some((rule) => rule.categoryId === id);
    if (isReferenced)
      throw new DomainError(
        "invalid_category",
        "A referenced category must be archived or reassigned.",
      );
    this.categories.delete(id);
  }

  public async mergeCategory(sourceId: string, targetId: string): Promise<void> {
    await this.runAtomically(async () => {
      const source = this.categories.get(sourceId);
      const target = this.categories.get(targetId);
      if (source === undefined || target === undefined)
        throw new DomainError("missing_reference", "Category does not exist.");
      validateCategoryMerge(source, target, [...this.categories.values()]);
      const directTransactions = [...this.transactions.values()].filter(
        (transaction) => transaction.categoryId === sourceId,
      );
      const splits = [...this.transactionSplits.values()].filter(
        (split) => split.categoryId === sourceId,
      );
      const budgets = [...this.budgets.values()].filter((budget) => budget.categoryId === sourceId);
      const rules = [...this.recurringRules.values()].filter(
        (rule) => rule.categoryId === sourceId,
      );
      if (
        directTransactions.some((transaction) => !target.accepts(transaction.kind)) ||
        splits.some((split) => !target.accepts(this.transactions.get(split.transactionId)!.kind)) ||
        (budgets.length > 0 && !target.accepts("expense")) ||
        rules.some((rule) => !target.accepts(rule.kind))
      )
        throw new DomainError(
          "invalid_category",
          "Target category is not compatible with references.",
        );
      for (const transaction of directTransactions)
        this.transactions.set(transaction.id, copyTransactionWithCategory(transaction, targetId));
      for (const split of splits)
        this.transactionSplits.set(split.id, copySplitWithCategory(split, targetId));
      for (const budget of budgets)
        this.budgets.set(budget.id, copyBudgetWithCategory(budget, targetId));
      for (const rule of rules)
        this.recurringRules.set(rule.id, copyRuleWithCategory(rule, targetId));
      this.categories.delete(sourceId);
    });
  }

  public async saveTag(tag: Tag): Promise<void> {
    this.assertNew(this.tags, tag.id, "Tag");
    this.tags.set(tag.id, tag);
  }
  public async saveRecurringRule(rule: RecurringRule): Promise<void> {
    this.assertNew(this.recurringRules, rule.id, "Recurring rule");
    this.validateRecurringRuleReferences(rule);
    this.recurringRules.set(rule.id, rule);
  }
  public async updateRecurringRule(rule: RecurringRule): Promise<void> {
    if (!this.recurringRules.has(rule.id))
      throw new DomainError("missing_reference", "Recurring rule does not exist.");
    this.validateRecurringRuleReferences(rule);
    this.recurringRules.set(rule.id, rule);
  }
  public async deleteRecurringRule(id: string): Promise<void> {
    this.deleteExisting(this.recurringRules, id, "Recurring rule");
  }
  public async saveAllocationPlan(plan: AllocationPlan): Promise<void> {
    this.assertNew(this.allocationPlans, plan.id, "Allocation plan");
    this.validateAllocationPlanReferences(plan);
    this.allocationPlans.set(plan.id, plan);
  }
  public async updateAllocationPlan(plan: AllocationPlan): Promise<void> {
    if (!this.allocationPlans.has(plan.id))
      throw new DomainError("missing_reference", "Allocation plan does not exist.");
    this.validateAllocationPlanReferences(plan);
    this.allocationPlans.set(plan.id, plan);
  }
  public async deleteAllocationPlan(id: string): Promise<void> {
    this.deleteExisting(this.allocationPlans, id, "Allocation plan");
  }
  public async saveBudget(budget: Budget): Promise<void> {
    this.assertNew(this.budgets, budget.id, "Budget");
    this.validateBudgetReferences(budget);
    this.budgets.set(budget.id, budget);
  }
  public async updateBudget(budget: Budget): Promise<void> {
    if (!this.budgets.has(budget.id))
      throw new DomainError("missing_reference", "Budget does not exist.");
    this.validateBudgetReferences(budget);
    this.budgets.set(budget.id, budget);
  }
  public async deleteBudget(id: string): Promise<void> {
    this.deleteExisting(this.budgets, id, "Budget");
  }
  public async saveLoan(loan: Loan): Promise<void> {
    this.assertNew(this.loans, loan.id, "Loan");
    this.validateLoanReferences(loan);
    this.loans.set(loan.id, loan);
  }
  public async updateLoan(loan: Loan): Promise<void> {
    if (!this.loans.has(loan.id))
      throw new DomainError("missing_reference", "Loan does not exist.");
    this.validateLoanReferences(loan);
    this.loans.set(loan.id, loan);
  }
  public async deleteLoan(id: string): Promise<void> {
    this.deleteExisting(this.loans, id, "Loan");
  }
  public async saveInvestmentPosition(position: InvestmentPosition): Promise<void> {
    this.assertNew(this.investmentPositions, position.id, "Investment position");
    this.investmentPositions.set(position.id, position);
  }
  public async updateInvestmentPosition(position: InvestmentPosition): Promise<void> {
    if (!this.investmentPositions.has(position.id))
      throw new DomainError("missing_reference", "Investment position does not exist.");
    this.investmentPositions.set(position.id, position);
  }
  public async deleteInvestmentPosition(id: string): Promise<void> {
    this.deleteExisting(this.investmentPositions, id, "Investment position");
  }
  public async saveMonthlyJournal(journal: MonthlyJournal): Promise<void> {
    this.assertNew(this.monthlyJournals, journal.id, "Monthly journal");
    this.assertJournalPeriodAvailable(journal);
    this.monthlyJournals.set(journal.id, journal);
  }
  public async updateMonthlyJournal(journal: MonthlyJournal): Promise<void> {
    if (!this.monthlyJournals.has(journal.id))
      throw new DomainError("missing_reference", "Monthly journal does not exist.");
    this.assertJournalPeriodAvailable(journal);
    this.monthlyJournals.set(journal.id, journal);
  }
  public async deleteMonthlyJournal(id: string): Promise<void> {
    this.deleteExisting(this.monthlyJournals, id, "Monthly journal");
  }
  public async saveImportBatch(batch: ImportBatch, rows: readonly ImportRow[]): Promise<void> {
    this.assertNew(this.importBatches, batch.id, "Import batch");
    if (
      rows.length !== batch.rowsTotal ||
      new Set(rows.map((row) => row.id)).size !== rows.length ||
      rows.some((row) => row.batchId !== batch.id)
    )
      throw new DomainError("invalid_import", "Import batch rows are invalid.");
    for (const row of rows) this.assertNew(this.importRows, row.id, "Import row");
    this.importBatches.set(batch.id, batch);
    for (const row of rows) this.importRows.set(row.id, row);
  }
  public async commitImportBatch(
    batch: ImportBatch,
    rows: readonly ImportRow[],
    transactions: readonly Transaction[],
    transferBundles: readonly ImportTransferBundle[] = [],
  ): Promise<ImportBatch> {
    const committed = validateImportCommit(batch, rows, transactions, transferBundles);
    this.assertNew(this.importBatches, batch.id, "Import batch");
    for (const row of rows) this.assertNew(this.importRows, row.id, "Import row");
    const transferTransactions = transferBundles.flatMap((bundle) => [
      bundle.debitTransaction,
      bundle.creditTransaction,
    ]);
    const allTransactions = [...transactions, ...transferTransactions];
    for (const bundle of transferBundles)
      this.assertNew(this.transfers, bundle.transfer.id, "Transfer");
    for (const transaction of allTransactions) {
      this.assertNew(this.transactions, transaction.id, "Transaction");
      this.validateTransactionReferences(transaction);
      if (
        [...this.transactions.values()].some(
          (candidate) =>
            candidate.accountId === transaction.accountId &&
            candidate.sourceFingerprint === transaction.sourceFingerprint,
        )
      )
        throw new DomainError("duplicate_entity", "Import fingerprint already exists.");
    }
    this.importBatches.set(committed.id, committed);
    for (const row of rows) this.importRows.set(row.id, row);
    for (const transaction of allTransactions) this.transactions.set(transaction.id, transaction);
    for (const bundle of transferBundles) this.transfers.set(bundle.transfer.id, bundle.transfer);
    return committed;
  }
  public async undoImportBatch(batchId: string): Promise<ImportBatch> {
    const batch = this.importBatches.get(batchId);
    if (batch === undefined)
      throw new DomainError("missing_reference", "Import batch does not exist.");
    const importedIds = [...this.importRows.values()]
      .filter((row) => row.batchId === batchId && row.status === "imported")
      .map((row) => row.createdTransactionId!);
    const transactionIds = new Set(importedIds);
    for (const transfer of this.transfers.values()) {
      if (
        transactionIds.has(transfer.debitTransactionId) ||
        transactionIds.has(transfer.creditTransactionId)
      ) {
        transactionIds.add(transfer.debitTransactionId);
        transactionIds.add(transfer.creditTransactionId);
        if (transfer.feeTransactionId !== undefined) transactionIds.add(transfer.feeTransactionId);
      }
    }
    const cancelled = [...transactionIds].map((id) => {
      const transaction = this.transactions.get(id);
      if (transaction === undefined)
        throw new DomainError("missing_reference", "Imported transaction does not exist.");
      return transaction.cancel();
    });
    const undone = batch.undo();
    for (const transaction of cancelled) this.transactions.set(transaction.id, transaction);
    this.importBatches.set(batchId, undone);
    return undone;
  }
  public async updateTag(tag: Tag): Promise<void> {
    if (!this.tags.has(tag.id)) throw new DomainError("missing_reference", "Tag does not exist.");
    this.tags.set(tag.id, tag);
  }

  public async deleteUnusedTag(id: string): Promise<void> {
    if (!this.tags.has(id)) throw new DomainError("missing_reference", "Tag does not exist.");
    if ([...this.transactionTags.values()].some((tagIds) => tagIds.has(id)))
      throw new DomainError(
        "invalid_transaction",
        "A referenced tag must be archived or removed globally.",
      );
    this.tags.delete(id);
  }

  public async mergeTag(sourceId: string, targetId: string): Promise<void> {
    await this.runAtomically(async () => {
      if (sourceId === targetId)
        throw new DomainError("invalid_transaction", "A tag cannot be merged into itself.");
      if (!this.tags.has(sourceId) || !this.tags.has(targetId))
        throw new DomainError("missing_reference", "Tag does not exist.");
      if (this.tags.get(targetId)?.isArchived)
        throw new DomainError(
          "invalid_transaction",
          "A tag can only be merged into an active target.",
        );
      for (const tagIds of this.transactionTags.values()) {
        if (tagIds.delete(sourceId)) tagIds.add(targetId);
      }
      this.tags.delete(sourceId);
    });
  }

  public async removeTagGlobally(id: string): Promise<void> {
    await this.runAtomically(async () => {
      if (!this.tags.has(id)) throw new DomainError("missing_reference", "Tag does not exist.");
      for (const tagIds of this.transactionTags.values()) tagIds.delete(id);
      this.tags.delete(id);
    });
  }
  public async setTransactionTags(transactionId: string, tagIds: readonly string[]): Promise<void> {
    if (!this.transactions.has(transactionId))
      throw new DomainError("missing_reference", "Transaction does not exist.");
    if (new Set(tagIds).size !== tagIds.length)
      throw new DomainError("duplicate_entity", "Duplicate tag reference.");
    for (const id of tagIds) {
      const tag = this.tags.get(id);
      if (tag === undefined || tag.isArchived)
        throw new DomainError("missing_reference", "Tag is unavailable.");
    }
    this.transactionTags.set(transactionId, new Set(tagIds));
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

  public async saveTransactionWithDetails(
    transaction: Transaction,
    splits: readonly TransactionSplit[],
    tagIds: readonly string[],
  ): Promise<void> {
    const { validateTransactionSplits } = await import("@nexora/domain");
    validateTransactionSplits(transaction, splits);
    this.assertNew(this.transactions, transaction.id, "Transaction");
    this.validateTransactionReferences(transaction);
    if (new Set(tagIds).size !== tagIds.length)
      throw new DomainError("duplicate_entity", "Duplicate tag reference.");
    for (const split of splits) {
      this.assertNew(this.transactionSplits, split.id, "Transaction split");
      const category = this.categories.get(split.categoryId);
      if (category === undefined || category.isArchived || !category.accepts(transaction.kind))
        throw new DomainError("invalid_category", "Split category is incompatible.");
    }
    for (const tagId of tagIds) {
      const tag = this.tags.get(tagId);
      if (tag === undefined || tag.isArchived)
        throw new DomainError("missing_reference", "Tag is unavailable.");
    }
    this.transactions.set(transaction.id, transaction);
    for (const split of splits) this.transactionSplits.set(split.id, split);
    this.transactionTags.set(transaction.id, new Set(tagIds));
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

  public async trashTransaction(id: string): Promise<void> {
    await this.trashTransactions([id]);
  }

  public async trashTransactions(ids: readonly string[]): Promise<void> {
    await this.runAtomically(async () => {
      const deletedAt = new Date().toISOString();
      for (const id of new Set(ids)) {
        const transaction = this.transactions.get(id);
        if (transaction === undefined)
          throw new DomainError("missing_reference", "Transaction does not exist.");
        const transfer = [...this.transfers.values()].find(
          (candidate) =>
            candidate.debitTransactionId === id ||
            candidate.creditTransactionId === id ||
            candidate.feeTransactionId === id,
        );
        const group =
          transfer === undefined
            ? [id]
            : [
                transfer.debitTransactionId,
                transfer.creditTransactionId,
                ...(transfer.feeTransactionId === undefined ? [] : [transfer.feeTransactionId]),
              ];
        const deletionGroupId =
          transfer === undefined ? `transaction:${id}` : `transfer:${transfer.id}`;
        for (const transactionId of group) {
          if (!this.transactions.has(transactionId))
            throw new DomainError("missing_reference", "Transfer leg does not exist.");
          this.transactionTrash.set(transactionId, { deletedAt, deletionGroupId });
        }
      }
    });
  }

  public async restoreTransaction(id: string): Promise<void> {
    const entry = this.transactionTrash.get(id);
    if (entry === undefined)
      throw new DomainError("missing_reference", "Trashed transaction does not exist.");
    for (const [transactionId, candidate] of this.transactionTrash) {
      if (candidate.deletionGroupId === entry.deletionGroupId)
        this.transactionTrash.delete(transactionId);
    }
  }

  public async purgeTrashedTransaction(id: string): Promise<void> {
    await this.runAtomically(async () => {
      const entry = this.transactionTrash.get(id);
      if (entry === undefined)
        throw new DomainError("missing_reference", "Trashed transaction does not exist.");
      const ids = [...this.transactionTrash.entries()]
        .filter(([, candidate]) => candidate.deletionGroupId === entry.deletionGroupId)
        .map(([transactionId]) => transactionId);
      for (const [rowId, row] of this.importRows) {
        if (row.createdTransactionId !== undefined && ids.includes(row.createdTransactionId))
          this.importRows.set(
            rowId,
            ImportRow.create({
              id: row.id,
              batchId: row.batchId,
              rowNumber: row.rowNumber,
              rawJson: row.rawJson,
              status: row.status,
              ...(row.normalizedJson === undefined ? {} : { normalizedJson: row.normalizedJson }),
              ...(row.errorCode === undefined ? {} : { errorCode: row.errorCode }),
              deletedTransactionId: row.createdTransactionId,
            }),
          );
      }
      for (const [transferId, transfer] of this.transfers) {
        if (
          ids.includes(transfer.debitTransactionId) ||
          ids.includes(transfer.creditTransactionId) ||
          (transfer.feeTransactionId !== undefined && ids.includes(transfer.feeTransactionId))
        )
          this.transfers.delete(transferId);
      }
      for (const transactionId of ids) {
        this.transactionTrash.delete(transactionId);
        this.transactions.delete(transactionId);
        this.transactionTags.delete(transactionId);
        for (const [splitId, split] of this.transactionSplits)
          if (split.transactionId === transactionId) this.transactionSplits.delete(splitId);
      }
    });
  }

  public async purgeTrashedTransactions(ids: readonly string[]): Promise<void> {
    await this.runAtomically(async () => {
      const groupHeads = new Map<string, string>();
      for (const id of new Set(ids)) {
        const entry = this.transactionTrash.get(id);
        if (entry === undefined)
          throw new DomainError("missing_reference", "Trashed transaction does not exist.");
        if (!groupHeads.has(entry.deletionGroupId)) groupHeads.set(entry.deletionGroupId, id);
      }
      for (const id of groupHeads.values()) await this.purgeTrashedTransaction(id);
    });
  }

  public async listTrashedTransactions(): Promise<readonly TrashedTransaction[]> {
    return [...this.transactionTrash.entries()]
      .map(([id, entry]) => {
        const transaction = this.transactions.get(id);
        return transaction === undefined ? undefined : { transaction, ...entry };
      })
      .filter((entry): entry is TrashedTransaction => entry !== undefined)
      .sort((left, right) => left.deletedAt.localeCompare(right.deletedAt));
  }

  public async findAccountById(id: string): Promise<Account | undefined> {
    return this.accounts.get(id);
  }

  public async findCategoryById(id: string): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  public async findTransactionById(id: string): Promise<Transaction | undefined> {
    return this.transactionTrash.has(id) ? undefined : this.transactions.get(id);
  }

  public async findTransferById(id: string): Promise<Transfer | undefined> {
    const transfer = this.transfers.get(id);
    return transfer === undefined ||
      this.transactionTrash.has(transfer.debitTransactionId) ||
      this.transactionTrash.has(transfer.creditTransactionId) ||
      (transfer.feeTransactionId !== undefined &&
        this.transactionTrash.has(transfer.feeTransactionId))
      ? undefined
      : transfer;
  }
  public async findImportBatchById(id: string): Promise<ImportBatch | undefined> {
    return this.importBatches.get(id);
  }

  public async listAccounts(): Promise<readonly Account[]> {
    return [...this.accounts.values()];
  }

  public async listCategories(): Promise<readonly Category[]> {
    return [...this.categories.values()];
  }
  public async listTags(): Promise<readonly Tag[]> {
    return [...this.tags.values()];
  }
  public async listTransactionTags(transactionId: string): Promise<readonly Tag[]> {
    return [...(this.transactionTags.get(transactionId) ?? new Set())]
      .map((id) => this.tags.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  }

  public async listTransactions(): Promise<readonly Transaction[]> {
    return [...this.transactions.values()].filter(
      (transaction) => !this.transactionTrash.has(transaction.id),
    );
  }

  public async listTransfers(): Promise<readonly Transfer[]> {
    return [...this.transfers.values()].filter(
      (transfer) =>
        !this.transactionTrash.has(transfer.debitTransactionId) &&
        !this.transactionTrash.has(transfer.creditTransactionId) &&
        (transfer.feeTransactionId === undefined ||
          !this.transactionTrash.has(transfer.feeTransactionId)),
    );
  }

  public async listTransactionSplits(transactionId: string): Promise<readonly TransactionSplit[]> {
    return [...this.transactionSplits.values()].filter(
      (split) => split.transactionId === transactionId,
    );
  }
  public async listImportRows(batchId: string): Promise<readonly ImportRow[]> {
    return [...this.importRows.values()]
      .filter((row) => row.batchId === batchId)
      .sort((left, right) => left.rowNumber - right.rowNumber);
  }
  public async listImportBatches(): Promise<readonly ImportBatch[]> {
    return [...this.importBatches.values()];
  }
  public async listRecurringRules(): Promise<readonly RecurringRule[]> {
    return [...this.recurringRules.values()].sort((left, right) =>
      left.nextExpectedDate.toString().localeCompare(right.nextExpectedDate.toString()),
    );
  }
  public async listAllocationPlans(): Promise<readonly AllocationPlan[]> {
    return [...this.allocationPlans.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }
  public async listBudgets(): Promise<readonly Budget[]> {
    return [...this.budgets.values()].sort((left, right) =>
      left.period.localeCompare(right.period),
    );
  }
  public async listLoans(): Promise<readonly Loan[]> {
    return [...this.loans.values()].sort((left, right) => left.lender.localeCompare(right.lender));
  }
  public async listInvestmentPositions(): Promise<readonly InvestmentPosition[]> {
    return [...this.investmentPositions.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }
  public async listMonthlyJournals(): Promise<readonly MonthlyJournal[]> {
    return [...this.monthlyJournals.values()].sort((left, right) =>
      left.period.localeCompare(right.period),
    );
  }

  private assertNew<T>(collection: Map<string, T>, id: string, entityName: string): void {
    if (collection.has(id)) {
      throw new DomainError("duplicate_entity", `${entityName} id already exists.`);
    }
  }

  private deleteExisting<T>(collection: Map<string, T>, id: string, entityName: string): void {
    if (!collection.delete(id))
      throw new DomainError("missing_reference", `${entityName} does not exist.`);
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
  private assertJournalPeriodAvailable(journal: MonthlyJournal): void {
    if (
      [...this.monthlyJournals.values()].some(
        (candidate) => candidate.id !== journal.id && candidate.period === journal.period,
      )
    )
      throw new DomainError("duplicate_entity", "Monthly journal period already exists.");
  }
  private validateRecurringRuleReferences(rule: RecurringRule): void {
    const account = this.accounts.get(rule.accountId);
    if (account === undefined || account.isArchived)
      throw new DomainError(
        "missing_reference",
        "Recurring rule account does not exist or is archived.",
      );
    if (account.currency !== rule.amount.currency)
      throw new DomainError(
        "currency_mismatch",
        "Recurring rule currency does not match the account.",
      );
    if (rule.categoryId === undefined) return;
    const category = this.categories.get(rule.categoryId);
    if (category === undefined || category.isArchived || !category.accepts(rule.kind))
      throw new DomainError(
        "missing_reference",
        "Recurring rule category does not exist or is incompatible.",
      );
  }
  private validateAllocationPlanReferences(plan: AllocationPlan): void {
    const source = this.accounts.get(plan.sourceAccountId);
    const target = this.accounts.get(plan.targetAccountId);
    if (source === undefined || target === undefined || source.isArchived || target.isArchived)
      throw new DomainError(
        "missing_reference",
        "Allocation plan accounts do not exist or are archived.",
      );
    if (source.currency !== target.currency || source.currency !== plan.amount.currency)
      throw new DomainError(
        "currency_mismatch",
        "Allocation plan accounts and amount must share a currency.",
      );
  }
  private validateBudgetReferences(budget: Budget): void {
    if (budget.categoryId === undefined) return;
    const category = this.categories.get(budget.categoryId);
    if (category === undefined || category.isArchived)
      throw new DomainError("missing_reference", "Budget category is not available.");
    if (!category.accepts("expense"))
      throw new DomainError("invalid_category", "Budget category must accept expenses.");
  }
  private validateLoanReferences(loan: Loan): void {
    const account = this.accounts.get(loan.accountId);
    if (account === undefined || account.isArchived || account.type !== "loan")
      throw new DomainError("missing_reference", "Loan requires an active loan account.");
    if (account.currency !== loan.remainingPrincipal.currency)
      throw new DomainError("currency_mismatch", "Loan currency must match the account.");
  }

  private isTransferLeg(transactionId: string): boolean {
    return [...this.transfers.values()].some(
      (transfer) =>
        transfer.debitTransactionId === transactionId ||
        transfer.creditTransactionId === transactionId ||
        transfer.feeTransactionId === transactionId,
    );
  }

  private captureState() {
    return {
      accounts: new Map(this.accounts),
      categories: new Map(this.categories),
      transactions: new Map(this.transactions),
      transactionTrash: new Map(this.transactionTrash),
      transfers: new Map(this.transfers),
      transactionSplits: new Map(this.transactionSplits),
      tags: new Map(this.tags),
      transactionTags: new Map([...this.transactionTags].map(([id, tags]) => [id, new Set(tags)])),
      importBatches: new Map(this.importBatches),
      importRows: new Map(this.importRows),
      recurringRules: new Map(this.recurringRules),
      allocationPlans: new Map(this.allocationPlans),
      budgets: new Map(this.budgets),
      loans: new Map(this.loans),
      investmentPositions: new Map(this.investmentPositions),
      monthlyJournals: new Map(this.monthlyJournals),
    };
  }
  private restoreState(state: ReturnType<InMemoryLedgerRepository["captureState"]>): void {
    const replace = <Value>(target: Map<string, Value>, source: Map<string, Value>) => {
      target.clear();
      for (const [id, value] of source) target.set(id, value);
    };
    replace(this.accounts, state.accounts);
    replace(this.categories, state.categories);
    replace(this.transactions, state.transactions);
    replace(this.transactionTrash, state.transactionTrash);
    replace(this.transfers, state.transfers);
    replace(this.transactionSplits, state.transactionSplits);
    replace(this.tags, state.tags);
    replace(this.transactionTags, state.transactionTags);
    replace(this.importBatches, state.importBatches);
    replace(this.importRows, state.importRows);
    replace(this.recurringRules, state.recurringRules);
    replace(this.allocationPlans, state.allocationPlans);
    replace(this.budgets, state.budgets);
    replace(this.loans, state.loans);
    replace(this.investmentPositions, state.investmentPositions);
    replace(this.monthlyJournals, state.monthlyJournals);
  }
}

function copyTransactionWithCategory(transaction: Transaction, categoryId: string): Transaction {
  return Transaction.create({
    id: transaction.id,
    kind: transaction.kind,
    status: transaction.status,
    accountId: transaction.accountId,
    amount: transaction.amount,
    bookedDate: transaction.bookedDate,
    source: transaction.source,
    categoryId,
    ...(transaction.valueDate === undefined ? {} : { valueDate: transaction.valueDate }),
    ...(transaction.payee === undefined ? {} : { payee: transaction.payee }),
    ...(transaction.description === undefined ? {} : { description: transaction.description }),
    ...(transaction.note === undefined ? {} : { note: transaction.note }),
    ...(transaction.importBatchId === undefined
      ? {}
      : { importBatchId: transaction.importBatchId }),
    ...(transaction.sourceFingerprint === undefined
      ? {}
      : { sourceFingerprint: transaction.sourceFingerprint }),
    ...(transaction.expenseVariability === undefined
      ? {}
      : { expenseVariability: transaction.expenseVariability }),
    ...(transaction.expenseExceptionality === undefined
      ? {}
      : { expenseExceptionality: transaction.expenseExceptionality }),
  });
}

function copySplitWithCategory(split: TransactionSplit, categoryId: string): TransactionSplit {
  return TransactionSplit.create({
    id: split.id,
    transactionId: split.transactionId,
    categoryId,
    amount: split.amount,
    ...(split.note === undefined ? {} : { note: split.note }),
  });
}

function copyBudgetWithCategory(budget: Budget, categoryId: string): Budget {
  return Budget.create({
    id: budget.id,
    period: budget.period,
    amount: budget.amount,
    categoryId,
    alertAt80: budget.alertAt80,
    alertAt100: budget.alertAt100,
  });
}

function copyRuleWithCategory(rule: RecurringRule, categoryId: string): RecurringRule {
  return RecurringRule.create({
    ...rule.toProps(),
    categoryId,
  });
}
