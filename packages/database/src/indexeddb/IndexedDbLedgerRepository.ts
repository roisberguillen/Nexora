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
  type ImportCommitPlan,
  RecurringRule,
  AllocationPlan,
  Budget,
  Loan,
  InvestmentPosition,
  assertInvestmentPositionAccount,
  MonthlyJournal,
  type TrashedTransaction,
  LocalDate,
  Money,
  validateImportCommit,
  type Transfer,
  type TransferBundle,
  validateAccountUpdate,
  validateCategoryMerge,
  validateCategoryHierarchy,
  validateAccountHierarchy,
  sortAccountsParentFirst,
  isSystemCategory,
  createSystemCategories,
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
  type StoredTransferRecord,
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
import type { ValidatedPortableLedgerSnapshot } from "../backup/PortableLedgerSnapshot";

type EntityStore =
  | "accounts"
  | "categories"
  | "transactions"
  | "transaction_trash"
  | "transfers"
  | "transaction_splits"
  | "tags"
  | "transaction_tags"
  | "import_batches"
  | "import_rows"
  | "recurring_rules"
  | "allocation_plans"
  | "budgets"
  | "loans"
  | "investment_positions"
  | "monthly_journals";

interface TransactionTrashRecord {
  readonly transaction_id: string;
  readonly deleted_at: string;
  readonly deletion_group_id: string;
}

export class IndexedDbLedgerRepository implements LedgerRepository {
  private operationTail: Promise<void> = Promise.resolve();
  private isClosed = false;

  public constructor(private readonly database: IDBDatabase) {}

  public runAtomically<Result>(
    operation: (transaction: IDBTransaction) => Promise<Result>,
  ): Promise<Result> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          [
            "accounts",
            "categories",
            "transactions",
            "transaction_trash",
            "transfers",
            "transaction_splits",
            "tags",
            "transaction_tags",
            "import_batches",
            "import_rows",
            "recurring_rules",
            "allocation_plans",
            "budgets",
            "loans",
            "investment_positions",
            "monthly_journals",
          ],
          "readwrite",
          operation,
        ),
      ),
    );
  }

  public replacePortableSnapshot(snapshot: ValidatedPortableLedgerSnapshot): Promise<void> {
    return this.runAtomically(async (transaction) => {
      const stores: readonly EntityStore[] = [
        "accounts",
        "categories",
        "transactions",
        "transaction_trash",
        "transfers",
        "transaction_splits",
        "tags",
        "transaction_tags",
        "import_batches",
        "import_rows",
        "recurring_rules",
        "allocation_plans",
        "budgets",
        "loans",
        "investment_positions",
        "monthly_journals",
      ];
      await Promise.all(stores.map((name) => requestResult(transaction.objectStore(name).clear())));
      const putAll = async (store: EntityStore, values: readonly unknown[]) => {
        for (const value of values) await requestResult(transaction.objectStore(store).put(value));
      };
      await putAll("categories", snapshot.categories.map(categoryToRecord));
      await putAll("accounts", snapshot.accounts.map(accountToRecord));
      await putAll("tags", snapshot.tags.map(tagToRecord));
      await putAll("import_batches", snapshot.importBatches.map(importBatchToRecord));
      await putAll("import_rows", snapshot.importRows.map(importRowToRecord));
      await putAll("transactions", snapshot.transactions.map(transactionToRecord));
      await putAll("transaction_splits", snapshot.splits.map(transactionSplitToRecord));
      await putAll("transfers", snapshot.transfers.map(transferToRecord));
      await putAll("recurring_rules", snapshot.recurringRules.map(recurringRuleToRecord));
      await putAll("allocation_plans", snapshot.allocationPlans.map(allocationPlanToRecord));
      await putAll("budgets", snapshot.budgets.map(budgetToRecord));
      await putAll("loans", snapshot.loans.map(loanToRecord));
      await putAll(
        "investment_positions",
        snapshot.investmentPositions.map(investmentPositionToRecord),
      );
      await putAll("monthly_journals", snapshot.monthlyJournals.map(monthlyJournalToRecord));
      await putAll(
        "transaction_tags",
        [...snapshot.transactionTagIds].flatMap(([transactionId, tagIds]) =>
          tagIds.map((tagId) => ({ transaction_id: transactionId, tag_id: tagId })),
        ),
      );
    });
  }

  public resetFinancialData(): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          [
            "accounts",
            "categories",
            "transactions",
            "transaction_trash",
            "transfers",
            "transaction_splits",
            "tags",
            "transaction_tags",
            "import_batches",
            "import_rows",
            "recurring_rules",
            "allocation_plans",
            "budgets",
            "loans",
            "investment_positions",
            "monthly_journals",
          ],
          "readwrite",
          async (transaction) => {
            await Promise.all(
              [
                "accounts",
                "categories",
                "transactions",
                "transaction_trash",
                "transfers",
                "transaction_splits",
                "tags",
                "transaction_tags",
                "import_batches",
                "import_rows",
                "recurring_rules",
                "allocation_plans",
                "budgets",
                "loans",
                "investment_positions",
                "monthly_journals",
              ].map((store) => requestResult(transaction.objectStore(store).clear())),
            );
            for (const category of createSystemCategories()) {
              await requestResult(
                transaction.objectStore("categories").put(categoryToRecord(category)),
              );
            }
          },
        ),
      ),
    );
  }

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
        this.withTransaction(
          ["accounts", "transactions", "allocation_plans"],
          "readwrite",
          async (transaction) => {
            const accounts = transaction.objectStore("accounts");
            const transactions = transaction.objectStore("transactions");
            const existing = await this.findAccountInStore(accounts, account.id);
            if (existing === undefined) {
              throw new DomainError("missing_reference", "Account does not exist.");
            }

            const [storedAccounts, transactionCount, allocationPlans, parent] = await Promise.all([
              requestResult<unknown[]>(accounts.getAll()),
              requestResult(transactions.index("by_account_id").count(account.id)),
              requestResult<unknown[]>(transaction.objectStore("allocation_plans").getAll()),
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
              hasEnabledAllocationPlans: allocationPlans.some((row) => {
                const plan = allocationPlanFromRecord(row as AllocationPlanRecord);
                return (
                  plan.enabled &&
                  (plan.sourceAccountId === account.id || plan.targetAccountId === account.id)
                );
              }),
              hasTransactions: transactionCount > 0,
              parentIsArchived: parent?.isArchived ?? false,
            });

            await requestResult(accounts.put(accountToRecord(account)));
          },
        ),
      ),
    );
  }

  public saveCategory(category: Category): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["categories"], "readwrite", async (transaction) => {
          const categories = transaction.objectStore("categories");
          await this.assertNew(categories, category.id, "Category");
          const current = (await requestResult<unknown[]>(categories.getAll())).map((row) =>
            categoryFromRecord(row as CategoryRecord),
          );
          validateCategoryHierarchy([...current, category]);

          await requestResult(categories.add(categoryToRecord(category)));
        }),
      ),
    );
  }

  public deleteUnusedAccount(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          [
            "accounts",
            "transactions",
            "recurring_rules",
            "allocation_plans",
            "loans",
            "investment_positions",
          ],
          "readwrite",
          async (transaction) => {
            const accounts = transaction.objectStore("accounts");
            if ((await this.findAccountInStore(accounts, id)) === undefined)
              throw new DomainError("missing_reference", "Account does not exist.");
            const [accountRows, transactionCount, rules, plans, loans, positions] =
              await Promise.all([
                requestResult<unknown[]>(accounts.getAll()),
                requestResult<number>(
                  transaction.objectStore("transactions").index("by_account_id").count(id),
                ),
                requestResult<unknown[]>(transaction.objectStore("recurring_rules").getAll()),
                requestResult<unknown[]>(transaction.objectStore("allocation_plans").getAll()),
                requestResult<unknown[]>(transaction.objectStore("loans").getAll()),
                requestResult<unknown[]>(transaction.objectStore("investment_positions").getAll()),
              ]);
            const isReferenced =
              transactionCount > 0 ||
              accountRows.some((row) => (row as AccountRecord).parent_account_id === id) ||
              rules.some((row) => (row as RecurringRuleRecord).account_id === id) ||
              plans.some(
                (row) =>
                  (row as AllocationPlanRecord).source_account_id === id ||
                  (row as AllocationPlanRecord).target_account_id === id,
              ) ||
              loans.some((row) => (row as LoanRecord).account_id === id) ||
              positions.some((row) => (row as InvestmentPositionRecord).account_id === id);
            if (isReferenced)
              throw new DomainError(
                "invalid_account",
                "An account with financial references must be archived instead of deleted.",
              );
            await requestResult(accounts.delete(id));
          },
        ),
      ),
    );
  }

  public updateCategory(category: Category): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["categories"], "readwrite", async (transaction) => {
          if (isSystemCategory(category.id))
            throw new DomainError("invalid_category", "System categories are protected.");
          const categories = transaction.objectStore("categories");
          if ((await this.findCategoryInStore(categories, category.id)) === undefined)
            throw new DomainError("missing_reference", "Category does not exist.");
          const current = (await requestResult<unknown[]>(categories.getAll())).map((row) =>
            categoryFromRecord(row as CategoryRecord),
          );
          validateCategoryHierarchy(
            current.map((existing) => (existing.id === category.id ? category : existing)),
          );
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

  public deleteUnusedCategory(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["categories", "transactions", "transaction_splits", "budgets", "recurring_rules"],
          "readwrite",
          async (transaction) => {
            if (isSystemCategory(id))
              throw new DomainError("invalid_category", "System categories are protected.");
            const categories = transaction.objectStore("categories");
            if ((await this.findCategoryInStore(categories, id)) === undefined)
              throw new DomainError("missing_reference", "Category does not exist.");
            const [categoryRows, transactionCount, splitCount, budgetRows, recurringRows] =
              await Promise.all([
                requestResult<unknown[]>(categories.getAll()),
                requestResult<number>(
                  transaction.objectStore("transactions").index("by_category_id").count(id),
                ),
                requestResult<number>(
                  transaction.objectStore("transaction_splits").index("by_category_id").count(id),
                ),
                requestResult<unknown[]>(transaction.objectStore("budgets").getAll()),
                requestResult<unknown[]>(transaction.objectStore("recurring_rules").getAll()),
              ]);
            const isReferenced =
              categoryRows.some((row) => (row as CategoryRecord).parent_id === id) ||
              transactionCount > 0 ||
              splitCount > 0 ||
              budgetRows.some((row) => (row as BudgetRecord).category_id === id) ||
              recurringRows.some((row) => (row as RecurringRuleRecord).category_id === id);
            if (isReferenced)
              throw new DomainError(
                "invalid_category",
                "A referenced category must be archived or reassigned.",
              );
            await requestResult(categories.delete(id));
          },
        ),
      ),
    );
  }

  public mergeCategory(sourceId: string, targetId: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["categories", "transactions", "transaction_splits", "budgets", "recurring_rules"],
          "readwrite",
          async (transaction) => {
            const categories = transaction.objectStore("categories");
            const [sourceRaw, targetRaw, transactionRows, splitRows, budgetRows, ruleRows] =
              await Promise.all([
                requestResult<unknown>(categories.get(sourceId)),
                requestResult<unknown>(categories.get(targetId)),
                requestResult<unknown[]>(transaction.objectStore("transactions").getAll()),
                requestResult<unknown[]>(transaction.objectStore("transaction_splits").getAll()),
                requestResult<unknown[]>(transaction.objectStore("budgets").getAll()),
                requestResult<unknown[]>(transaction.objectStore("recurring_rules").getAll()),
              ]);
            if (sourceRaw === undefined || targetRaw === undefined)
              throw new DomainError("missing_reference", "Category does not exist.");
            const source = categoryFromRecord(sourceRaw as CategoryRecord);
            const target = categoryFromRecord(targetRaw as CategoryRecord);
            const allCategories = (await requestResult<unknown[]>(categories.getAll())).map((row) =>
              categoryFromRecord(row as CategoryRecord),
            );
            validateCategoryMerge(source, target, allCategories);
            const transactions = transactionRows as readonly TransactionRecord[];
            const direct = transactions.filter((row) => row.category_id === sourceId);
            const splits = (splitRows as readonly TransactionSplitRecord[]).filter(
              (row) => row.category_id === sourceId,
            );
            const transactionById = new Map(transactions.map((row) => [String(row.id), row]));
            const incompatible =
              direct.some((row) => row.kind !== "income" && row.kind !== "expense") ||
              splits.some((split) => {
                const owner = transactionById.get(String(split.transaction_id));
                return owner === undefined || (owner.kind !== "income" && owner.kind !== "expense");
              });
            if (incompatible)
              throw new DomainError(
                "invalid_category",
                "Target category is not compatible with references.",
              );
            const referencedKinds = [
              ...direct.map((row) => row.kind as "income" | "expense"),
              ...splits.map(
                (split) =>
                  transactionById.get(String(split.transaction_id))!.kind as "income" | "expense",
              ),
              ...(budgetRows as readonly BudgetRecord[])
                .filter((row) => row.category_id === sourceId)
                .map(() => "expense" as const),
              ...(ruleRows as readonly RecurringRuleRecord[])
                .filter((row) => row.category_id === sourceId)
                .map((row) => row.kind),
            ];
            if (referencedKinds.some((kind) => !target.accepts(kind)))
              throw new DomainError(
                "invalid_category",
                "Target category is not compatible with references.",
              );
            for (const row of direct)
              await requestResult(
                transaction.objectStore("transactions").put({ ...row, category_id: targetId }),
              );
            for (const row of splits)
              await requestResult(
                transaction
                  .objectStore("transaction_splits")
                  .put({ ...row, category_id: targetId }),
              );
            for (const row of budgetRows as readonly BudgetRecord[])
              if (row.category_id === sourceId)
                await requestResult(
                  transaction.objectStore("budgets").put({ ...row, category_id: targetId }),
                );
            for (const row of ruleRows as readonly RecurringRuleRecord[])
              if (row.category_id === sourceId)
                await requestResult(
                  transaction.objectStore("recurring_rules").put({ ...row, category_id: targetId }),
                );
            for (const raw of await requestResult<unknown[]>(categories.getAll())) {
              const row = raw as CategoryRecord;
              if (row.parent_id === sourceId)
                await requestResult(categories.put({ ...row, parent_id: targetId }));
            }
            await requestResult(categories.delete(sourceId));
          },
        ),
      ),
    );
  }

  public deleteUnusedTag(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["tags", "transaction_tags"], "readwrite", async (transaction) => {
          const tags = transaction.objectStore("tags");
          if ((await requestResult<unknown>(tags.get(id))) === undefined)
            throw new DomainError("missing_reference", "Tag does not exist.");
          const references = await requestResult<unknown[]>(
            transaction.objectStore("transaction_tags").getAll(),
          );
          if (references.some((row) => (row as { readonly tag_id: string }).tag_id === id))
            throw new DomainError(
              "invalid_transaction",
              "A referenced tag must be archived or removed globally.",
            );
          await requestResult(tags.delete(id));
        }),
      ),
    );
  }

  public mergeTag(sourceId: string, targetId: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["tags", "transaction_tags"], "readwrite", async (transaction) => {
          if (sourceId === targetId)
            throw new DomainError("invalid_transaction", "A tag cannot be merged into itself.");
          const tags = transaction.objectStore("tags");
          const [source, target] = await Promise.all([
            requestResult<unknown>(tags.get(sourceId)),
            requestResult<unknown>(tags.get(targetId)),
          ]);
          if (source === undefined || target === undefined)
            throw new DomainError("missing_reference", "Tag does not exist.");
          if ((target as TagRecord).is_archived === 1)
            throw new DomainError(
              "invalid_transaction",
              "A tag can only be merged into an active target.",
            );
          const links = transaction.objectStore("transaction_tags");
          for (const raw of await requestResult<unknown[]>(links.getAll())) {
            const link = raw as { readonly transaction_id: string; readonly tag_id: string };
            if (link.tag_id === sourceId) {
              await requestResult(
                links.put({ transaction_id: link.transaction_id, tag_id: targetId }),
              );
              await requestResult(links.delete([link.transaction_id, sourceId]));
            }
          }
          await requestResult(tags.delete(sourceId));
        }),
      ),
    );
  }

  public removeTagGlobally(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["tags", "transaction_tags"], "readwrite", async (transaction) => {
          const tags = transaction.objectStore("tags");
          if ((await requestResult<unknown>(tags.get(id))) === undefined)
            throw new DomainError("missing_reference", "Tag does not exist.");
          const links = transaction.objectStore("transaction_tags");
          for (const raw of await requestResult<unknown[]>(links.getAll())) {
            const link = raw as { readonly transaction_id: string; readonly tag_id: string };
            if (link.tag_id === id) await requestResult(links.delete([link.transaction_id, id]));
          }
          await requestResult(tags.delete(id));
        }),
      ),
    );
  }
  public saveRecurringRule(rule: RecurringRule): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["accounts", "categories", "recurring_rules"],
          "readwrite",
          async (transaction) => {
            const rules = transaction.objectStore("recurring_rules");
            await this.assertNew(rules, rule.id, "Recurring rule");
            await this.validateRecurringRuleReferences(transaction, rule);
            await requestResult(rules.add(recurringRuleToRecord(rule)));
          },
        ),
      ),
    );
  }
  public updateRecurringRule(rule: RecurringRule): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["accounts", "categories", "recurring_rules"],
          "readwrite",
          async (transaction) => {
            const rules = transaction.objectStore("recurring_rules");
            if ((await requestResult<unknown>(rules.get(rule.id))) === undefined)
              throw new DomainError("missing_reference", "Recurring rule does not exist.");
            await this.validateRecurringRuleReferences(transaction, rule);
            await requestResult(rules.put(recurringRuleToRecord(rule)));
          },
        ),
      ),
    );
  }
  public saveAllocationPlan(plan: AllocationPlan): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["accounts", "allocation_plans"], "readwrite", async (transaction) => {
          const plans = transaction.objectStore("allocation_plans");
          await this.assertNew(plans, plan.id, "Allocation plan");
          await this.validateAllocationPlanReferences(transaction, plan);
          await requestResult(plans.add(allocationPlanToRecord(plan)));
        }),
      ),
    );
  }
  public updateAllocationPlan(plan: AllocationPlan): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["accounts", "allocation_plans"], "readwrite", async (transaction) => {
          const plans = transaction.objectStore("allocation_plans");
          if ((await requestResult<unknown>(plans.get(plan.id))) === undefined)
            throw new DomainError("missing_reference", "Allocation plan does not exist.");
          await this.validateAllocationPlanReferences(transaction, plan);
          await requestResult(plans.put(allocationPlanToRecord(plan)));
        }),
      ),
    );
  }
  public saveBudget(budget: Budget): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["budgets", "categories"], "readwrite", async (transaction) => {
          const budgets = transaction.objectStore("budgets");
          await this.assertNew(budgets, budget.id, "Budget");
          await this.validateBudgetReferences(transaction, budget);
          await requestResult(budgets.add(budgetToRecord(budget)));
        }),
      ),
    );
  }
  public updateBudget(budget: Budget): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["budgets", "categories"], "readwrite", async (transaction) => {
          const budgets = transaction.objectStore("budgets");
          if ((await requestResult<unknown>(budgets.get(budget.id))) === undefined)
            throw new DomainError("missing_reference", "Budget does not exist.");
          await this.validateBudgetReferences(transaction, budget);
          await requestResult(budgets.put(budgetToRecord(budget)));
        }),
      ),
    );
  }
  public reviseBudget(previous: Budget, next: Budget): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["budgets", "categories"], "readwrite", async (transaction) => {
          const budgets = transaction.objectStore("budgets");
          if ((await requestResult<unknown>(budgets.get(previous.id))) === undefined)
            throw new DomainError("missing_reference", "Budget does not exist.");
          await this.validateBudgetReferences(transaction, previous);
          await requestResult(budgets.put(budgetToRecord(previous)));
          await this.validateBudgetReferences(transaction, next);
          await this.assertNew(budgets, next.id, "Budget");
          await requestResult(budgets.add(budgetToRecord(next)));
        }),
      ),
    );
  }
  public saveLoan(loan: Loan): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["accounts", "loans"], "readwrite", async (transaction) => {
          const loans = transaction.objectStore("loans");
          await this.assertNew(loans, loan.id, "Loan");
          await this.validateLoanReferences(transaction, loan);
          await requestResult(loans.add(loanToRecord(loan)));
        }),
      ),
    );
  }
  public updateLoan(loan: Loan): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["accounts", "loans"], "readwrite", async (transaction) => {
          const loans = transaction.objectStore("loans");
          if ((await requestResult<unknown>(loans.get(loan.id))) === undefined)
            throw new DomainError("missing_reference", "Loan does not exist.");
          await this.validateLoanReferences(transaction, loan);
          await requestResult(loans.put(loanToRecord(loan)));
        }),
      ),
    );
  }
  public saveInvestmentPosition(position: InvestmentPosition): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["accounts", "investment_positions"],
          "readwrite",
          async (transaction) => {
            const store = transaction.objectStore("investment_positions");
            await this.assertNew(store, position.id, "Investment position");
            await this.validateInvestmentPositionReferences(transaction, position);
            await requestResult(store.add(investmentPositionToRecord(position)));
          },
        ),
      ),
    );
  }
  public updateInvestmentPosition(position: InvestmentPosition): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["accounts", "investment_positions"],
          "readwrite",
          async (transaction) => {
            const store = transaction.objectStore("investment_positions");
            if ((await requestResult<unknown>(store.get(position.id))) === undefined)
              throw new DomainError("missing_reference", "Investment position does not exist.");
            await this.validateInvestmentPositionReferences(transaction, position);
            await requestResult(store.put(investmentPositionToRecord(position)));
          },
        ),
      ),
    );
  }
  public saveMonthlyJournal(journal: MonthlyJournal): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["monthly_journals"], "readwrite", async (transaction) => {
          const store = transaction.objectStore("monthly_journals");
          await this.assertNew(store, journal.id, "Monthly journal");
          await requestResult(store.add(monthlyJournalToRecord(journal)));
        }),
      ),
    );
  }
  public updateMonthlyJournal(journal: MonthlyJournal): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["monthly_journals"], "readwrite", async (transaction) => {
          const store = transaction.objectStore("monthly_journals");
          if ((await requestResult<unknown>(store.get(journal.id))) === undefined)
            throw new DomainError("missing_reference", "Monthly journal does not exist.");
          await requestResult(store.put(monthlyJournalToRecord(journal)));
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
  public deleteRecurringRule(id: string): Promise<void> {
    return this.deleteIsolatedEntity("recurring_rules", id, "Recurring rule");
  }
  public deleteAllocationPlan(id: string): Promise<void> {
    return this.deleteIsolatedEntity("allocation_plans", id, "Allocation plan");
  }
  public deleteBudget(id: string): Promise<void> {
    return this.deleteIsolatedEntity("budgets", id, "Budget");
  }
  public deleteLoan(id: string): Promise<void> {
    return this.deleteIsolatedEntity("loans", id, "Loan");
  }
  public deleteInvestmentPosition(id: string): Promise<void> {
    return this.deleteIsolatedEntity("investment_positions", id, "Investment position");
  }
  public deleteMonthlyJournal(id: string): Promise<void> {
    return this.deleteIsolatedEntity("monthly_journals", id, "Monthly journal");
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
  public commitImportBatch(plan: ImportCommitPlan): Promise<ImportBatch> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["accounts", "categories", "transactions", "transfers", "import_batches", "import_rows"],
          "readwrite",
          async (transaction) => {
            const { batch, rows, transactions } = plan;
            const transferBundles = plan.transferBundles ?? [];
            const committed = validateImportCommit(batch, rows, transactions, transferBundles);
            const batches = transaction.objectStore("import_batches");
            const importRows = transaction.objectStore("import_rows");
            const storedTransactions = transaction.objectStore("transactions");
            const storedAccounts = transaction.objectStore("accounts");
            const storedCategories = transaction.objectStore("categories");
            await this.assertNew(batches, batch.id, "Import batch");
            for (const account of plan.accountsToCreate ?? [])
              await this.assertNew(storedAccounts, account.id, "Account");
            for (const category of plan.categoriesToCreate ?? [])
              await this.assertNew(storedCategories, category.id, "Category");
            const existingAccounts = (await requestResult<unknown[]>(storedAccounts.getAll())).map(
              (record) => accountFromRecord(record as AccountRecord),
            );
            validateAccountHierarchy([...existingAccounts, ...(plan.accountsToCreate ?? [])]);
            const existingCategories = (
              await requestResult<unknown[]>(storedCategories.getAll())
            ).map((record) => categoryFromRecord(record as CategoryRecord));
            validateCategoryHierarchy([...existingCategories, ...(plan.categoriesToCreate ?? [])]);
            for (const account of sortAccountsParentFirst(plan.accountsToCreate ?? []))
              await requestResult(storedAccounts.add(accountToRecord(account)));
            for (const category of plan.categoriesToCreate ?? [])
              await requestResult(storedCategories.add(categoryToRecord(category)));
            for (const row of rows) await this.assertNew(importRows, row.id, "Import row");
            const existing = await requestResult<unknown[]>(storedTransactions.getAll());
            const transferTransactions = transferBundles.flatMap((bundle) => [
              bundle.debitTransaction,
              bundle.creditTransaction,
            ]);
            const allTransactions = [...transactions, ...transferTransactions];
            const transfers = transaction.objectStore("transfers");
            for (const bundle of transferBundles)
              await this.assertNew(transfers, bundle.transfer.id, "Transfer");
            for (const ledgerTransaction of allTransactions) {
              await this.assertNew(storedTransactions, ledgerTransaction.id, "Transaction");
              await this.validateTransactionReferences(transaction, ledgerTransaction);
              if (
                (existing as TransactionRecord[]).some(
                  (candidate) =>
                    candidate.account_id === ledgerTransaction.accountId &&
                    candidate.source_fingerprint === ledgerTransaction.sourceFingerprint,
                )
              )
                throw new DomainError("duplicate_entity", "Import fingerprint already exists.");
            }
            await requestResult(batches.add(importBatchToRecord(committed)));
            for (const ledgerTransaction of allTransactions)
              await requestResult(storedTransactions.add(transactionToRecord(ledgerTransaction)));
            for (const bundle of transferBundles)
              await requestResult(transfers.add(transferToRecord(bundle.transfer)));
            for (const row of rows) await requestResult(importRows.add(importRowToRecord(row)));
            return committed;
          },
        ),
      ),
    );
  }
  public undoImportBatch(batchId: string): Promise<ImportBatch> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["import_batches", "import_rows", "transactions", "transfers"],
          "readwrite",
          async (transaction) => {
            const batches = transaction.objectStore("import_batches");
            const stored = await requestResult<unknown>(batches.get(batchId));
            if (stored === undefined)
              throw new DomainError("missing_reference", "Import batch does not exist.");
            const batch = importBatchFromRecord(stored as ImportBatchRecord);
            const rows = (
              await requestResult<unknown[]>(
                transaction.objectStore("import_rows").index("by_batch_id").getAll(batchId),
              )
            ).map((row) => importRowFromRecord(row as ImportRowRecord));
            const transactions = transaction.objectStore("transactions");
            const transactionIds = new Set(
              rows
                .filter((row) => row.status === "imported")
                .map((row) => row.createdTransactionId!),
            );
            const transferRecords = await requestResult<unknown[]>(
              transaction.objectStore("transfers").getAll(),
            );
            for (const record of transferRecords as StoredTransferRecord[]) {
              if (
                transactionIds.has(record.debit_transaction_id) ||
                transactionIds.has(record.credit_transaction_id) ||
                (record.fee_transaction_id !== null &&
                  transactionIds.has(record.fee_transaction_id))
              ) {
                transactionIds.add(record.debit_transaction_id);
                transactionIds.add(record.credit_transaction_id);
                if (record.fee_transaction_id !== null)
                  transactionIds.add(record.fee_transaction_id);
              }
            }
            const cancelled = await Promise.all(
              [...transactionIds].map(async (id) => {
                const record = await requestResult<unknown>(transactions.get(id));
                if (record === undefined)
                  throw new DomainError(
                    "missing_reference",
                    "Imported transaction does not exist.",
                  );
                return transactionFromRecord(record as TransactionRecord).cancel();
              }),
            );
            const undone = batch.undo();
            for (const ledgerTransaction of cancelled)
              await requestResult(transactions.put(transactionToRecord(ledgerTransaction)));
            await requestResult(batches.put(importBatchToRecord(undone)));
            return undone;
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

  public updateTransaction(transaction: Transaction): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["accounts", "categories", "transactions"],
          "readwrite",
          async (idbTransaction) => {
            if (transaction.kind === "transfer")
              throw new DomainError(
                "invalid_transfer",
                "Transfer legs cannot be updated independently.",
              );
            const transactions = idbTransaction.objectStore("transactions");
            if ((await requestResult<unknown>(transactions.get(transaction.id))) === undefined)
              throw new DomainError("missing_reference", "Transaction does not exist.");
            await this.validateTransactionReferences(idbTransaction, transaction);
            await requestResult(transactions.put(transactionToRecord(transaction)));
          },
        ),
      ),
    );
  }

  public updateTransactionWithDetails(
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
            if (transaction.kind === "transfer")
              throw new DomainError(
                "invalid_transfer",
                "Transfer legs cannot be updated independently.",
              );
            validateTransactionSplits(transaction, splits);
            if (new Set(tagIds).size !== tagIds.length)
              throw new DomainError("duplicate_entity", "Duplicate tag reference.");
            const transactions = idbTransaction.objectStore("transactions");
            if ((await requestResult<unknown>(transactions.get(transaction.id))) === undefined)
              throw new DomainError("missing_reference", "Transaction does not exist.");
            await this.validateTransactionReferences(idbTransaction, transaction);
            const splitStore = idbTransaction.objectStore("transaction_splits");
            for (const split of splits) {
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
            await requestResult(transactions.put(transactionToRecord(transaction)));
            for (const split of await requestResult<unknown[]>(
              splitStore.index("by_transaction_id").getAll(transaction.id),
            ))
              await requestResult(splitStore.delete((split as { id: string }).id));
            for (const split of splits)
              await requestResult(splitStore.add(transactionSplitToRecord(split)));
            const links = idbTransaction.objectStore("transaction_tags");
            for (const link of await requestResult<unknown[]>(
              links.index("by_transaction_id").getAll(transaction.id),
            ))
              await requestResult(
                links.delete([transaction.id, (link as { tag_id: string }).tag_id]),
              );
            for (const tagId of tagIds)
              await requestResult(links.add({ transaction_id: transaction.id, tag_id: tagId }));
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

  public trashTransaction(id: string): Promise<void> {
    return this.trashTransactions([id]);
  }

  public trashTransactions(ids: readonly string[]): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["transactions", "transfers", "transaction_trash"],
          "readwrite",
          async (transaction) => {
            const transactions = transaction.objectStore("transactions");
            const transfers = (await requestResult<unknown[]>(
              transaction.objectStore("transfers").getAll(),
            )) as readonly TransferRecord[];
            const deleted_at = new Date().toISOString();
            const trash = transaction.objectStore("transaction_trash");
            for (const id of new Set(ids)) {
              if ((await requestResult<unknown>(transactions.get(id))) === undefined)
                throw new DomainError("missing_reference", "Transaction does not exist.");
              const transfer = transfers.find(
                (candidate) =>
                  candidate.debit_transaction_id === id ||
                  candidate.credit_transaction_id === id ||
                  candidate.fee_transaction_id === id,
              );
              const transactionIds =
                transfer === undefined ? [id] : transferRecordTransactionIds(transfer);
              const deletion_group_id =
                transfer === undefined ? `transaction:${id}` : `transfer:${transfer.id}`;
              for (const transaction_id of transactionIds) {
                if ((await requestResult<unknown>(transactions.get(transaction_id))) === undefined)
                  throw new DomainError("missing_reference", "Transfer leg does not exist.");
                await requestResult(
                  trash.put({
                    transaction_id,
                    deleted_at,
                    deletion_group_id,
                  } satisfies TransactionTrashRecord),
                );
              }
            }
          },
        ),
      ),
    );
  }

  public restoreTransaction(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["transaction_trash"], "readwrite", async (transaction) => {
          const trash = transaction.objectStore("transaction_trash");
          const entry = await requestResult<unknown>(trash.get(id));
          if (entry === undefined)
            throw new DomainError("missing_reference", "Trashed transaction does not exist.");
          const deletionGroupId = (entry as TransactionTrashRecord).deletion_group_id;
          const entries = (await requestResult<unknown[]>(
            trash.getAll(),
          )) as readonly TransactionTrashRecord[];
          for (const candidate of entries) {
            if (candidate.deletion_group_id === deletionGroupId)
              await requestResult(trash.delete(candidate.transaction_id));
          }
        }),
      ),
    );
  }

  public purgeTrashedTransaction(id: string): Promise<void> {
    return this.purgeTrashedTransactions([id]);
  }

  public purgeTrashedTransactions(ids: readonly string[]): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          [
            "transactions",
            "transfers",
            "transaction_splits",
            "transaction_tags",
            "transaction_trash",
            "import_rows",
          ],
          "readwrite",
          async (transaction) => {
            const trash = transaction.objectStore("transaction_trash");
            const groupHeads = new Map<string, string>();
            for (const id of new Set(ids)) {
              const entry = await requestResult<unknown>(trash.get(id));
              if (entry === undefined)
                throw new DomainError("missing_reference", "Trashed transaction does not exist.");
              const deletionGroupId = (entry as TransactionTrashRecord).deletion_group_id;
              if (!groupHeads.has(deletionGroupId)) groupHeads.set(deletionGroupId, id);
            }
            for (const id of groupHeads.values())
              await this.purgeTrashedTransactionInTransaction(transaction, id);
          },
        ),
      ),
    );
  }

  private async purgeTrashedTransactionInTransaction(
    transaction: IDBTransaction,
    id: string,
  ): Promise<void> {
    const trash = transaction.objectStore("transaction_trash");
    const entry = await requestResult<unknown>(trash.get(id));
    if (entry === undefined)
      throw new DomainError("missing_reference", "Trashed transaction does not exist.");
    const deletionGroupId = (entry as TransactionTrashRecord).deletion_group_id;
    const entries = (await requestResult<unknown[]>(trash.getAll())) as TransactionTrashRecord[];
    const transactionIds = entries
      .filter((item) => item.deletion_group_id === deletionGroupId)
      .map((item) => item.transaction_id);
    const importRows = transaction.objectStore("import_rows");
    for (const rawRow of await requestResult<unknown[]>(importRows.getAll())) {
      const row = rawRow as ImportRowRecord;
      if (
        row.created_transaction_id !== null &&
        transactionIds.includes(row.created_transaction_id)
      )
        await requestResult(
          importRows.put({
            ...row,
            created_transaction_id: null,
            deleted_transaction_id: row.created_transaction_id,
          }),
        );
    }
    const transfers = transaction.objectStore("transfers");
    for (const rawTransfer of await requestResult<unknown[]>(transfers.getAll())) {
      const transfer = rawTransfer as StoredTransferRecord;
      if (
        transactionIds.includes(transfer.debit_transaction_id) ||
        transactionIds.includes(transfer.credit_transaction_id) ||
        (transfer.fee_transaction_id !== null &&
          transactionIds.includes(transfer.fee_transaction_id))
      )
        await requestResult(transfers.delete(transfer.id));
    }
    for (const transactionId of transactionIds) {
      const tags = transaction.objectStore("transaction_tags").index("by_transaction_id");
      for (const tag of await requestResult<unknown[]>(tags.getAll(transactionId)))
        await requestResult(
          transaction
            .objectStore("transaction_tags")
            .delete([transactionId, (tag as { tag_id: string }).tag_id]),
        );
      for (const split of await requestResult<unknown[]>(
        transaction
          .objectStore("transaction_splits")
          .index("by_transaction_id")
          .getAll(transactionId),
      ))
        await requestResult(
          transaction.objectStore("transaction_splits").delete((split as { id: string }).id),
        );
      await requestResult(trash.delete(transactionId));
      await requestResult(transaction.objectStore("transactions").delete(transactionId));
    }
  }

  public listTrashedTransactions(): Promise<readonly TrashedTransaction[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["transactions", "transaction_trash"],
          "readonly",
          async (transaction) => {
            const [transactionRows, trashRows] = await Promise.all([
              requestResult<unknown[]>(transaction.objectStore("transactions").getAll()),
              requestResult<unknown[]>(transaction.objectStore("transaction_trash").getAll()),
            ]);
            const transactions = transactionRecordMap(
              transactionRows as readonly TransactionRecord[],
            );
            return (trashRows as readonly TransactionTrashRecord[])
              .map((entry) => {
                const stored = transactions.get(entry.transaction_id);
                return stored === undefined
                  ? undefined
                  : {
                      transaction: stored,
                      deletedAt: entry.deleted_at,
                      deletionGroupId: entry.deletion_group_id,
                    };
              })
              .filter((entry): entry is TrashedTransaction => entry !== undefined)
              .sort((left, right) => left.deletedAt.localeCompare(right.deletedAt));
          },
        ),
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
        this.withTransaction(
          ["transactions", "transaction_trash"],
          "readonly",
          async (transaction) => {
            const [value, trash] = await Promise.all([
              requestResult<unknown>(transaction.objectStore("transactions").get(id)),
              requestResult<unknown>(transaction.objectStore("transaction_trash").get(id)),
            ]);
            if (trash !== undefined) return undefined;
            return value === undefined
              ? undefined
              : transactionFromRecord(value as TransactionRecord);
          },
        ),
      ),
    );
  }

  public findTransferById(id: string): Promise<Transfer | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["transactions", "transfers", "transaction_trash"],
          "readonly",
          async (transaction) => {
            const value = await requestResult<unknown>(
              transaction.objectStore("transfers").get(id),
            );
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
            const trashEntries = await Promise.all(
              transferRecordTransactionIds(transferRecord).map((transactionId) =>
                requestResult<unknown>(
                  transaction.objectStore("transaction_trash").get(transactionId),
                ),
              ),
            );
            if (trashEntries.some((entry) => entry !== undefined)) return undefined;
            return transferFromRecord(
              transferRecord,
              transactionRecordMap(transactionRecords as readonly TransactionRecord[]),
            );
          },
        ),
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
  public listRecurringRules(): Promise<readonly RecurringRule[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["recurring_rules"], "readonly", async (transaction) => {
          const rows = await requestResult<unknown[]>(
            transaction.objectStore("recurring_rules").getAll(),
          );
          return rows
            .map((row) => recurringRuleFromRecord(row as RecurringRuleRecord))
            .sort((left, right) =>
              left.nextExpectedDate.toString().localeCompare(right.nextExpectedDate.toString()),
            );
        }),
      ),
    );
  }
  public listAllocationPlans(): Promise<readonly AllocationPlan[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["allocation_plans"], "readonly", async (transaction) =>
          (await requestResult<unknown[]>(transaction.objectStore("allocation_plans").getAll()))
            .map((row) => allocationPlanFromRecord(row as AllocationPlanRecord))
            .sort((left, right) => left.name.localeCompare(right.name)),
        ),
      ),
    );
  }
  public listBudgets(): Promise<readonly Budget[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["budgets"], "readonly", async (transaction) =>
          (await requestResult<unknown[]>(transaction.objectStore("budgets").getAll()))
            .map((row) => budgetFromRecord(row as BudgetRecord))
            .sort((left, right) => left.period.localeCompare(right.period)),
        ),
      ),
    );
  }
  public listLoans(): Promise<readonly Loan[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["loans"], "readonly", async (transaction) =>
          (await requestResult<unknown[]>(transaction.objectStore("loans").getAll()))
            .map((row) => loanFromRecord(row as LoanRecord))
            .sort((left, right) => left.lender.localeCompare(right.lender)),
        ),
      ),
    );
  }
  public listInvestmentPositions(): Promise<readonly InvestmentPosition[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["investment_positions"], "readonly", async (transaction) =>
          (
            await requestResult<unknown[]>(transaction.objectStore("investment_positions").getAll())
          ).map((row) => investmentPositionFromRecord(row as InvestmentPositionRecord)),
        ),
      ),
    );
  }
  public listMonthlyJournals(): Promise<readonly MonthlyJournal[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["monthly_journals"], "readonly", async (transaction) =>
          (await requestResult<unknown[]>(transaction.objectStore("monthly_journals").getAll()))
            .map((row) => monthlyJournalFromRecord(row as MonthlyJournalRecord))
            .sort((left, right) => left.period.localeCompare(right.period)),
        ),
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
        this.withTransaction(
          ["transactions", "transaction_trash"],
          "readonly",
          async (transaction) => {
            const [rows, trashRows] = await Promise.all([
              requestResult<unknown[]>(transaction.objectStore("transactions").getAll()),
              requestResult<unknown[]>(transaction.objectStore("transaction_trash").getAll()),
            ]);
            const trashedIds = new Set(
              (trashRows as readonly TransactionTrashRecord[]).map((row) => row.transaction_id),
            );
            return rows
              .map((row) => transactionFromRecord(row as TransactionRecord))
              .filter((candidate) => !trashedIds.has(candidate.id));
          },
        ),
      ),
    );
  }

  public listTransfers(): Promise<readonly Transfer[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(
          ["transactions", "transfers", "transaction_trash"],
          "readonly",
          async (transaction) => {
            const transferRequest = requestResult<unknown[]>(
              transaction.objectStore("transfers").getAll(),
            );
            const transactionRequest = requestResult<unknown[]>(
              transaction.objectStore("transactions").getAll(),
            );
            const [transferRows, transactionRows, trashRows] = await Promise.all([
              transferRequest,
              transactionRequest,
              requestResult<unknown[]>(transaction.objectStore("transaction_trash").getAll()),
            ]);
            const transactions = transactionRecordMap(
              transactionRows as readonly TransactionRecord[],
            );
            const trashedIds = new Set(
              (trashRows as readonly TransactionTrashRecord[]).map((row) => row.transaction_id),
            );
            return transferRows
              .map((row) => row as TransferRecord)
              .filter((transfer) =>
                transferRecordTransactionIds(transfer).every((id) => !trashedIds.has(id)),
              )
              .map((transfer) => transferFromRecord(transfer, transactions));
          },
        ),
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
  public listAllTransactionSplits(): Promise<readonly TransactionSplit[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction(["transaction_splits"], "readonly", async (transaction) =>
          (await requestResult<unknown[]>(transaction.objectStore("transaction_splits").getAll()))
            .map((row) => transactionSplitFromRecord(row as TransactionSplitRecord))
            .sort((left, right) =>
              left.transactionId === right.transactionId
                ? left.id.localeCompare(right.id)
                : left.transactionId.localeCompare(right.transactionId),
            ),
        ),
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
  public async listImportBatches(): Promise<readonly ImportBatch[]> {
    return this.performDatabaseOperation(() =>
      this.withTransaction(["import_batches"], "readonly", async (transaction) =>
        (await requestResult<unknown[]>(transaction.objectStore("import_batches").getAll())).map(
          (row) => importBatchFromRecord(row as ImportBatchRecord),
        ),
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

  private deleteIsolatedEntity(
    storeName:
      | "recurring_rules"
      | "allocation_plans"
      | "budgets"
      | "loans"
      | "investment_positions"
      | "monthly_journals",
    id: string,
    entityName: string,
  ): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withTransaction([storeName], "readwrite", async (transaction) => {
          const store = transaction.objectStore(storeName);
          if ((await requestResult<unknown>(store.get(id))) === undefined)
            throw new DomainError("missing_reference", `${entityName} does not exist.`);
          await requestResult(store.delete(id));
        }),
      ),
    );
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
  private async validateRecurringRuleReferences(
    transaction: IDBTransaction,
    rule: RecurringRule,
  ): Promise<void> {
    const account = await this.findAccountInStore(
      transaction.objectStore("accounts"),
      rule.accountId,
    );
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
    const record = await requestResult<unknown>(
      transaction.objectStore("categories").get(rule.categoryId),
    );
    if (record === undefined)
      throw new DomainError(
        "missing_reference",
        "Recurring rule category does not exist or is incompatible.",
      );
    const category = categoryFromRecord(record as CategoryRecord);
    if (category.isArchived || !category.accepts(rule.kind))
      throw new DomainError(
        "missing_reference",
        "Recurring rule category does not exist or is incompatible.",
      );
  }
  private async validateAllocationPlanReferences(
    transaction: IDBTransaction,
    plan: AllocationPlan,
  ): Promise<void> {
    const accounts = transaction.objectStore("accounts");
    const [source, target] = await Promise.all([
      this.findAccountInStore(accounts, plan.sourceAccountId),
      this.findAccountInStore(accounts, plan.targetAccountId),
    ]);
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
  private async validateLoanReferences(transaction: IDBTransaction, loan: Loan): Promise<void> {
    const account = await this.findAccountInStore(
      transaction.objectStore("accounts"),
      loan.accountId,
    );
    if (account === undefined || account.isArchived || account.type !== "loan")
      throw new DomainError("missing_reference", "Loan requires an active loan account.");
    if (account.currency !== loan.remainingPrincipal.currency)
      throw new DomainError("currency_mismatch", "Loan currency does not match the account.");
    const loans = await requestResult<unknown[]>(transaction.objectStore("loans").getAll());
    if (
      loans
        .map((record) => loanFromRecord(record as LoanRecord))
        .some((existing) => existing.id !== loan.id && existing.accountId === loan.accountId)
    )
      throw new DomainError("duplicate_entity", "A loan already exists for this account.");
  }
  private async validateBudgetReferences(
    transaction: IDBTransaction,
    budget: Budget,
  ): Promise<void> {
    if (budget.categoryId !== undefined) {
      const record = await requestResult<unknown>(
        transaction.objectStore("categories").get(budget.categoryId),
      );
      if (record === undefined)
        throw new DomainError("missing_reference", "Budget category is not available.");
      const category = categoryFromRecord(record as CategoryRecord);
      if (category.isArchived || !category.accepts("expense"))
        throw new DomainError("invalid_category", "Budget category must accept expenses.");
    }
    const budgets = await requestResult<unknown[]>(transaction.objectStore("budgets").getAll());
    if (
      budgets.some((value) => {
        const other = value as BudgetRecord;
        return (
          other.id !== budget.id &&
          other.category_id === budget.categoryId &&
          other.period < (budget.effectiveToPeriod ?? "9999-12") &&
          budget.period < (other.effective_to_period ?? "9999-12")
        );
      })
    ) {
      throw new DomainError(
        "duplicate_entity",
        "A budget revision already overlaps this category period.",
      );
    }
  }

  private async findAccountInStore(
    store: IDBObjectStore,
    id: string,
  ): Promise<Account | undefined> {
    const value = await requestResult<unknown>(store.get(id));
    return value === undefined ? undefined : accountFromRecord(value as AccountRecord);
  }
  private async validateInvestmentPositionReferences(
    transaction: IDBTransaction,
    position: InvestmentPosition,
  ): Promise<void> {
    assertInvestmentPositionAccount(
      position,
      await this.findAccountInStore(transaction.objectStore("accounts"), position.accountId),
    );
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
  readonly importer_type: ImportBatch["importerType"];
  readonly source_filename: string;
  readonly source_sha256: string;
  readonly mapping_profile_id?: string;
  readonly status: "previewed" | "committed" | "undone" | "failed";
  readonly rows_total: number;
  readonly rows_imported: number;
  readonly rows_skipped: number;
  readonly rows_failed: number;
}

interface RecurringRuleRecord {
  readonly id: string;
  readonly name: string;
  readonly kind: "income" | "expense";
  readonly account_id: string;
  readonly amount_minor: string;
  readonly currency: string;
  readonly category_id?: string;
  readonly payee?: string;
  readonly frequency: "monthly";
  readonly interval_months: number;
  readonly nominal_day: number;
  readonly weekend_policy: "none" | "salary_italy";
  readonly next_expected_date: string;
  readonly enabled: boolean;
  /** IndexedDB keys do not support booleans; this mirrors SQLite's active-rule predicate. */
  readonly active_due_state?: "active" | "inactive";
  /** v17 fields are optional so v16 records continue to open without a rewrite. */
  readonly frequency_unit?: "week" | "month" | "year";
  readonly interval_value?: number;
  readonly nominal_month?: number;
  readonly next_nominal_date?: string;
  readonly weekend_policy_v2?: import("@nexora/domain").WeekendPolicy;
  readonly retired_at?: string;
  readonly expense_variability?: import("@nexora/domain").ExpenseVariability;
  readonly expense_exceptionality?: import("@nexora/domain").ExpenseExceptionality;
}

interface AllocationPlanRecord {
  readonly id: string;
  readonly name: string;
  readonly trigger_kind: "salary" | "photo_income";
  readonly source_account_id: string;
  readonly target_account_id: string;
  readonly amount_minor: string;
  readonly currency: string;
  readonly enabled: boolean;
}
interface BudgetRecord {
  readonly id: string;
  readonly series_id?: string;
  readonly period: string;
  readonly effective_to_period?: string;
  readonly category_id?: string;
  readonly amount_minor: string;
  readonly currency: string;
  readonly alert_at_80?: boolean;
  readonly alert_at_100?: boolean;
  readonly first_alert_percentage?: number;
  readonly second_alert_percentage?: number;
}
interface LoanRecord {
  readonly id: string;
  readonly account_id: string;
  readonly lender: string;
  readonly installment_minor: string;
  readonly remaining_principal_minor: string;
  readonly original_principal_minor?: string;
  readonly currency: string;
  readonly annual_nominal_rate_bps?: number;
  readonly annual_effective_rate_bps?: number;
  readonly installments_paid?: number;
  readonly installments_remaining?: number;
  readonly next_due_date?: string;
}
interface InvestmentPositionRecord {
  readonly id: string;
  readonly account_id: string;
  readonly name: string;
  readonly symbol?: string;
  readonly units?: string;
  readonly cost_basis_minor: string;
  readonly current_value_minor: string;
  readonly currency: string;
  readonly valuation_date: string;
}
interface MonthlyJournalRecord {
  readonly id: string;
  readonly period: string;
  readonly note?: string;
  readonly next_month_goals?: string;
  readonly perceived_control?: 1 | 2 | 3 | 4 | 5;
}
function monthlyJournalToRecord(journal: MonthlyJournal): MonthlyJournalRecord {
  return {
    id: journal.id,
    period: journal.period,
    ...(journal.note === undefined ? {} : { note: journal.note }),
    ...(journal.nextMonthGoals === undefined ? {} : { next_month_goals: journal.nextMonthGoals }),
    ...(journal.perceivedControl === undefined
      ? {}
      : { perceived_control: journal.perceivedControl }),
  };
}
function monthlyJournalFromRecord(row: MonthlyJournalRecord): MonthlyJournal {
  return MonthlyJournal.create({
    id: row.id,
    period: row.period,
    ...(row.note === undefined ? {} : { note: row.note }),
    ...(row.next_month_goals === undefined ? {} : { nextMonthGoals: row.next_month_goals }),
    ...(row.perceived_control === undefined ? {} : { perceivedControl: row.perceived_control }),
  });
}
function investmentPositionToRecord(position: InvestmentPosition): InvestmentPositionRecord {
  return {
    id: position.id,
    account_id: position.accountId,
    name: position.name,
    ...(position.symbol === undefined ? {} : { symbol: position.symbol }),
    ...(position.units === undefined ? {} : { units: position.units }),
    cost_basis_minor: position.costBasis.amountMinor.toString(),
    current_value_minor: position.currentValue.amountMinor.toString(),
    currency: position.costBasis.currency,
    valuation_date: position.valuationDate.toString(),
  };
}
function investmentPositionFromRecord(row: InvestmentPositionRecord): InvestmentPosition {
  return InvestmentPosition.create({
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    costBasis: Money.fromMinor(BigInt(row.cost_basis_minor), row.currency),
    currentValue: Money.fromMinor(BigInt(row.current_value_minor), row.currency),
    valuationDate: LocalDate.parse(row.valuation_date),
    ...(row.symbol === undefined ? {} : { symbol: row.symbol }),
    ...(row.units === undefined ? {} : { units: row.units }),
  });
}
function loanToRecord(loan: Loan): LoanRecord {
  return {
    id: loan.id,
    account_id: loan.accountId,
    lender: loan.lender,
    installment_minor: loan.installment.amountMinor.toString(),
    remaining_principal_minor: loan.remainingPrincipal.amountMinor.toString(),
    ...(loan.originalPrincipal === undefined
      ? {}
      : { original_principal_minor: loan.originalPrincipal.amountMinor.toString() }),
    currency: loan.remainingPrincipal.currency,
    ...(loan.annualNominalRateBps === undefined
      ? {}
      : { annual_nominal_rate_bps: loan.annualNominalRateBps }),
    ...(loan.annualEffectiveRateBps === undefined
      ? {}
      : { annual_effective_rate_bps: loan.annualEffectiveRateBps }),
    ...(loan.installmentsPaid === undefined ? {} : { installments_paid: loan.installmentsPaid }),
    ...(loan.installmentsRemaining === undefined
      ? {}
      : { installments_remaining: loan.installmentsRemaining }),
    ...(loan.nextDueDate === undefined ? {} : { next_due_date: loan.nextDueDate.toString() }),
  };
}
function loanFromRecord(row: LoanRecord): Loan {
  return Loan.create({
    id: row.id,
    accountId: row.account_id,
    lender: row.lender,
    installment: Money.fromMinor(BigInt(row.installment_minor), row.currency),
    remainingPrincipal: Money.fromMinor(BigInt(row.remaining_principal_minor), row.currency),
    ...(row.original_principal_minor === undefined
      ? {}
      : { originalPrincipal: Money.fromMinor(BigInt(row.original_principal_minor), row.currency) }),
    ...(row.annual_nominal_rate_bps === undefined
      ? {}
      : { annualNominalRateBps: row.annual_nominal_rate_bps }),
    ...(row.annual_effective_rate_bps === undefined
      ? {}
      : { annualEffectiveRateBps: row.annual_effective_rate_bps }),
    ...(row.installments_paid === undefined ? {} : { installmentsPaid: row.installments_paid }),
    ...(row.installments_remaining === undefined
      ? {}
      : { installmentsRemaining: row.installments_remaining }),
    ...(row.next_due_date === undefined ? {} : { nextDueDate: LocalDate.parse(row.next_due_date) }),
  });
}
function budgetToRecord(budget: Budget): BudgetRecord {
  return {
    id: budget.id,
    series_id: budget.seriesId,
    period: budget.period,
    ...(budget.effectiveToPeriod === undefined
      ? {}
      : { effective_to_period: budget.effectiveToPeriod }),
    ...(budget.categoryId === undefined ? {} : { category_id: budget.categoryId }),
    amount_minor: budget.amount.amountMinor.toString(),
    currency: budget.amount.currency,
    alert_at_80: budget.firstAlertPercentage !== undefined,
    alert_at_100: budget.secondAlertPercentage !== undefined,
    ...(budget.firstAlertPercentage === undefined
      ? {}
      : { first_alert_percentage: budget.firstAlertPercentage }),
    ...(budget.secondAlertPercentage === undefined
      ? {}
      : { second_alert_percentage: budget.secondAlertPercentage }),
  };
}
function budgetFromRecord(row: BudgetRecord): Budget {
  return Budget.restore({
    id: row.id,
    ...(row.series_id === undefined ? {} : { seriesId: row.series_id }),
    period: row.period,
    ...(row.effective_to_period === undefined
      ? {}
      : { effectiveToPeriod: row.effective_to_period }),
    ...(row.category_id === undefined ? {} : { categoryId: row.category_id }),
    amount: Money.fromMinor(BigInt(row.amount_minor), row.currency),
    ...(row.first_alert_percentage === undefined
      ? row.alert_at_80 === true
        ? { firstAlertPercentage: 80 }
        : {}
      : { firstAlertPercentage: row.first_alert_percentage }),
    ...(row.second_alert_percentage === undefined
      ? row.alert_at_100 === true
        ? { secondAlertPercentage: 100 }
        : {}
      : { secondAlertPercentage: row.second_alert_percentage }),
  });
}
function allocationPlanToRecord(plan: AllocationPlan): AllocationPlanRecord {
  return {
    id: plan.id,
    name: plan.name,
    trigger_kind: plan.trigger,
    source_account_id: plan.sourceAccountId,
    target_account_id: plan.targetAccountId,
    amount_minor: plan.amount.amountMinor.toString(),
    currency: plan.amount.currency,
    enabled: plan.enabled,
  };
}
function allocationPlanFromRecord(row: AllocationPlanRecord): AllocationPlan {
  return AllocationPlan.create({
    id: row.id,
    name: row.name,
    trigger: row.trigger_kind,
    sourceAccountId: row.source_account_id,
    targetAccountId: row.target_account_id,
    amount: Money.fromMinor(BigInt(row.amount_minor), row.currency),
    enabled: row.enabled,
  });
}
function recurringRuleToRecord(rule: RecurringRule): RecurringRuleRecord {
  return {
    id: rule.id,
    name: rule.name,
    kind: rule.kind,
    account_id: rule.accountId,
    amount_minor: rule.amount.amountMinor.toString(),
    currency: rule.amount.currency,
    ...(rule.categoryId === undefined ? {} : { category_id: rule.categoryId }),
    ...(rule.payee === undefined ? {} : { payee: rule.payee }),
    frequency: rule.frequency,
    interval_months: rule.frequencyUnit === "month" ? rule.interval : 1,
    nominal_day: rule.nominalDay,
    weekend_policy: legacyWeekendPolicy(rule.weekendPolicy),
    next_expected_date: rule.nextExpectedDate.toString(),
    enabled: rule.enabled,
    active_due_state: rule.enabled && rule.retiredAt === undefined ? "active" : "inactive",
    frequency_unit: rule.frequencyUnit,
    interval_value: rule.interval,
    ...(rule.nominalMonth === undefined ? {} : { nominal_month: rule.nominalMonth }),
    next_nominal_date: rule.nextNominalDate.toString(),
    weekend_policy_v2: rule.weekendPolicy,
    ...(rule.retiredAt === undefined ? {} : { retired_at: rule.retiredAt }),
    ...(rule.expenseVariability === undefined
      ? {}
      : { expense_variability: rule.expenseVariability }),
    ...(rule.expenseExceptionality === undefined
      ? {}
      : { expense_exceptionality: rule.expenseExceptionality }),
  };
}
function recurringRuleFromRecord(row: RecurringRuleRecord): RecurringRule {
  return RecurringRule.create({
    id: row.id,
    name: row.name,
    kind: row.kind,
    accountId: row.account_id,
    amount: Money.fromMinor(BigInt(row.amount_minor), row.currency),
    ...(row.category_id === undefined ? {} : { categoryId: row.category_id }),
    ...(row.payee === undefined ? {} : { payee: row.payee }),
    frequency: row.frequency,
    frequencyUnit: row.frequency_unit ?? "month",
    interval: row.interval_value ?? row.interval_months,
    nominalDay: row.nominal_day,
    ...(row.nominal_month === undefined ? {} : { nominalMonth: row.nominal_month }),
    weekendPolicy: row.weekend_policy_v2 ?? row.weekend_policy,
    nextExpectedDate: LocalDate.parse(row.next_expected_date),
    ...(row.next_nominal_date === undefined
      ? {}
      : { nextNominalDate: LocalDate.parse(row.next_nominal_date) }),
    enabled: row.enabled,
    ...(row.retired_at === undefined ? {} : { retiredAt: row.retired_at }),
    ...(row.expense_variability === undefined
      ? {}
      : { expenseVariability: row.expense_variability }),
    ...(row.expense_exceptionality === undefined
      ? {}
      : { expenseExceptionality: row.expense_exceptionality }),
  });
}

function legacyWeekendPolicy(
  policy: import("@nexora/domain").WeekendPolicy,
): "none" | "salary_italy" {
  return policy === "salary_italy" ? "salary_italy" : "none";
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
  readonly deleted_transaction_id: string | null;
}
function importBatchToRecord(batch: ImportBatch): ImportBatchRecord {
  return {
    id: batch.id,
    importer_type: batch.importerType,
    source_filename: batch.sourceFilename,
    source_sha256: batch.sourceSha256,
    ...(batch.mappingProfileId === undefined ? {} : { mapping_profile_id: batch.mappingProfileId }),
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
    ...(row.mapping_profile_id === undefined ? {} : { mappingProfileId: row.mapping_profile_id }),
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
    deleted_transaction_id: row.deletedTransactionId ?? null,
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
    ...(row.deleted_transaction_id === null
      ? {}
      : { deletedTransactionId: row.deleted_transaction_id }),
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
