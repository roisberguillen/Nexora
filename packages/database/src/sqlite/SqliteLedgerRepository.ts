import {
  Account,
  Category,
  DomainError,
  type LedgerRepository,
  Transaction,
  type TransactionSplit,
  Tag,
  ImportBatch,
  ImportRow,
  type ImportTransferBundle,
  RecurringRule,
  AllocationPlan,
  Budget,
  Loan,
  InvestmentPosition,
  MonthlyJournal,
  type TrashedTransaction,
  LocalDate,
  Money,
  validateImportCommit,
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
  tagToRecord,
} from "../records/LedgerRecords";
import { PersistenceError } from "./PersistenceError";
import type { ValidatedPortableLedgerSnapshot } from "../backup/PortableLedgerSnapshot";
import type { SqliteDatabase } from "./SqliteDatabase";

type EntityTable =
  | "accounts"
  | "categories"
  | "transactions"
  | "transfers"
  | "recurring_rules"
  | "allocation_plans"
  | "budgets"
  | "loans"
  | "investment_positions"
  | "monthly_journals";

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
  source,
  import_batch_id,
  source_fingerprint
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

  public runAtomically<Result>(operation: () => Promise<Result>): Promise<Result> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() => this.withWriteTransaction(operation)),
    );
  }

  public replacePortableSnapshot(snapshot: ValidatedPortableLedgerSnapshot): Promise<void> {
    return this.runAtomically(async () => {
      for (const table of [
        "transaction_trash",
        "transaction_tags",
        "transaction_splits",
        "transfers",
        "import_rows",
        "import_batches",
        "recurring_rules",
        "allocation_plans",
        "budgets",
        "loans",
        "investment_positions",
        "monthly_journals",
        "transactions",
        "tags",
        "accounts",
        "categories",
      ])
        await this.database.execute(`DELETE FROM ${table};`);
      for (const category of snapshot.categories) {
        const record = categoryToRecord(category);
        await this.database.run(
          "INSERT INTO categories (id, name, kind_scope, parent_id, is_archived) VALUES (?, ?, ?, ?, ?)",
          [record.id, record.name, record.kind_scope, record.parent_id, record.is_archived],
        );
      }
      for (const account of snapshot.accounts) {
        const record = accountToRecord(account);
        await this.database.run(
          "INSERT INTO accounts (id, name, type, institution, currency, parent_account_id, opening_balance_minor, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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
      }
      for (const tag of snapshot.tags) {
        const record = tagToRecord(tag);
        await this.database.run("INSERT INTO tags (id, name, is_archived) VALUES (?, ?, ?)", [
          record.id,
          record.name,
          record.is_archived,
        ]);
      }
      for (const batch of snapshot.importBatches) await this.insertPortableImportBatch(batch);
      for (const row of snapshot.importRows) await this.insertPortableImportRow(row);
      for (const transaction of snapshot.transactions) await this.insertTransaction(transaction);
      for (const split of snapshot.splits) {
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
      for (const transfer of snapshot.transfers) {
        const record = transferToRecord(transfer);
        await this.database.run(
          "INSERT INTO transfers (id, debit_transaction_id, credit_transaction_id, fee_transaction_id) VALUES (?, ?, ?, ?)",
          [
            record.id,
            record.debit_transaction_id,
            record.credit_transaction_id,
            record.fee_transaction_id,
          ],
        );
      }
      for (const [transactionId, tagIds] of snapshot.transactionTagIds)
        for (const tagId of tagIds)
          await this.database.run(
            "INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)",
            [transactionId, tagId],
          );
      for (const rule of snapshot.recurringRules) await this.insertRecurringRule(rule);
      for (const plan of snapshot.allocationPlans) await this.insertAllocationPlan(plan);
      for (const budget of snapshot.budgets) await this.insertBudget(budget);
      for (const loan of snapshot.loans) await this.insertLoan(loan);
      for (const position of snapshot.investmentPositions)
        await this.insertInvestmentPosition(position);
      for (const journal of snapshot.monthlyJournals) await this.insertMonthlyJournal(journal);
    });
  }

  public resetFinancialData(): Promise<void> {
    return this.runAtomically(async () => {
      for (const table of [
        "transaction_trash",
        "transaction_tags",
        "transaction_splits",
        "transfers",
        "import_rows",
        "import_batches",
        "recurring_rules",
        "allocation_plans",
        "budgets",
        "loans",
        "investment_positions",
        "monthly_journals",
        "transactions",
        "tags",
        "accounts",
        "categories",
      ])
        await this.database.execute(`DELETE FROM ${table};`);
    });
  }

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

  public deleteUnusedAccount(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          if ((await this.findAccountByIdInternal(id)) === undefined)
            throw new DomainError("missing_reference", "Account does not exist.");
          const references = await this.database.query<{ readonly found: number }>(
            `
              SELECT 1 AS found FROM transactions WHERE account_id = ?
              UNION ALL SELECT 1 FROM accounts WHERE parent_account_id = ?
              UNION ALL SELECT 1 FROM recurring_rules WHERE account_id = ?
              UNION ALL SELECT 1 FROM allocation_plans WHERE source_account_id = ? OR target_account_id = ?
              UNION ALL SELECT 1 FROM loans WHERE account_id = ?
              UNION ALL SELECT 1 FROM investment_positions WHERE account_id = ?
              LIMIT 1
            `,
            [id, id, id, id, id, id, id],
          );
          if (references.length > 0)
            throw new DomainError(
              "invalid_account",
              "An account with financial references must be archived instead of deleted.",
            );
          await this.database.run("DELETE FROM accounts WHERE id = ?", [id]);
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

  public saveTag(tag: Tag): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const found = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM tags WHERE id = ?",
            [tag.id],
          );
          if (found.length > 0) throw new DomainError("duplicate_entity", "Tag id already exists.");
          await this.database.run("INSERT INTO tags (id, name, is_archived) VALUES (?, ?, ?)", [
            tag.id,
            tag.name,
            tag.isArchived ? 1 : 0,
          ]);
        }),
      ),
    );
  }

  public deleteUnusedCategory(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          if ((await this.findCategoryByIdInternal(id)) === undefined)
            throw new DomainError("missing_reference", "Category does not exist.");
          const references = await this.database.query<{ readonly found: number }>(
            `
              SELECT 1 AS found FROM categories WHERE parent_id = ?
              UNION ALL SELECT 1 FROM transactions WHERE category_id = ?
              UNION ALL SELECT 1 FROM transaction_splits WHERE category_id = ?
              UNION ALL SELECT 1 FROM budgets WHERE category_id = ?
              UNION ALL SELECT 1 FROM recurring_rules WHERE category_id = ?
              LIMIT 1
            `,
            [id, id, id, id, id],
          );
          if (references.length > 0)
            throw new DomainError(
              "invalid_category",
              "A referenced category must be archived or reassigned.",
            );
          await this.database.run("DELETE FROM categories WHERE id = ?", [id]);
        }),
      ),
    );
  }

  public deleteUnusedTag(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const rows = await this.database.query<{
            readonly tag_count: number;
            readonly reference_count: number;
          }>(
            "SELECT (SELECT COUNT(*) FROM tags WHERE id = ?) AS tag_count, (SELECT COUNT(*) FROM transaction_tags WHERE tag_id = ?) AS reference_count",
            [id, id],
          );
          const counts = rows[0];
          if (counts === undefined || counts.tag_count === 0)
            throw new DomainError("missing_reference", "Tag does not exist.");
          if (counts.reference_count > 0)
            throw new DomainError(
              "invalid_transaction",
              "A referenced tag must be archived or removed globally.",
            );
          await this.database.run("DELETE FROM tags WHERE id = ?", [id]);
        }),
      ),
    );
  }
  public saveRecurringRule(rule: RecurringRule): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          await this.assertNew("recurring_rules", rule.id, "Recurring rule");
          await this.validateRecurringRuleReferences(rule);
          await this.insertRecurringRule(rule);
        }),
      ),
    );
  }
  public updateRecurringRule(rule: RecurringRule): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const existing = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM recurring_rules WHERE id = ?",
            [rule.id],
          );
          if (existing.length === 0)
            throw new DomainError("missing_reference", "Recurring rule does not exist.");
          await this.validateRecurringRuleReferences(rule);
          const record = recurringRuleToRecord(rule);
          await this.database.run(
            "UPDATE recurring_rules SET name = ?, kind = ?, account_id = ?, amount_minor = ?, currency = ?, category_id = ?, payee = ?, frequency = ?, interval_months = ?, nominal_day = ?, weekend_policy = ?, next_expected_date = ?, enabled = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
            [
              record.name,
              record.kind,
              record.account_id,
              record.amount_minor,
              record.currency,
              record.category_id,
              record.payee,
              record.frequency,
              record.interval_months,
              record.nominal_day,
              record.weekend_policy,
              record.next_expected_date,
              record.enabled,
              record.id,
            ],
          );
        }),
      ),
    );
  }
  public saveAllocationPlan(plan: AllocationPlan): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          await this.assertNew("allocation_plans", plan.id, "Allocation plan");
          await this.validateAllocationPlanReferences(plan);
          await this.insertAllocationPlan(plan);
        }),
      ),
    );
  }
  public updateAllocationPlan(plan: AllocationPlan): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const existing = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM allocation_plans WHERE id = ?",
            [plan.id],
          );
          if (existing.length === 0)
            throw new DomainError("missing_reference", "Allocation plan does not exist.");
          await this.validateAllocationPlanReferences(plan);
          const record = allocationPlanToRecord(plan);
          await this.database.run(
            "UPDATE allocation_plans SET name = ?, trigger_kind = ?, source_account_id = ?, target_account_id = ?, amount_minor = ?, currency = ?, enabled = ? WHERE id = ?",
            [
              record.name,
              record.trigger_kind,
              record.source_account_id,
              record.target_account_id,
              record.amount_minor,
              record.currency,
              record.enabled,
              record.id,
            ],
          );
        }),
      ),
    );
  }
  public saveBudget(budget: Budget): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          await this.assertNew("budgets", budget.id, "Budget");
          await this.validateBudgetReferences(budget);
          await this.insertBudget(budget);
        }),
      ),
    );
  }
  public updateBudget(budget: Budget): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const found = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM budgets WHERE id = ?",
            [budget.id],
          );
          if (found.length === 0)
            throw new DomainError("missing_reference", "Budget does not exist.");
          await this.validateBudgetReferences(budget);
          const record = budgetToRecord(budget);
          await this.database.run(
            "UPDATE budgets SET period = ?, category_id = ?, amount_minor = ?, currency = ?, alert_at_80 = ?, alert_at_100 = ? WHERE id = ?",
            [
              record.period,
              record.category_id,
              record.amount_minor,
              record.currency,
              record.alert_at_80,
              record.alert_at_100,
              record.id,
            ],
          );
        }),
      ),
    );
  }
  public saveLoan(loan: Loan): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          await this.assertNew("loans", loan.id, "Loan");
          await this.insertLoan(loan);
        }),
      ),
    );
  }
  public updateLoan(loan: Loan): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const found = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM loans WHERE id = ?",
            [loan.id],
          );
          if (found.length === 0)
            throw new DomainError("missing_reference", "Loan does not exist.");
          const record = loanToRecord(loan);
          await this.database.run(
            "UPDATE loans SET account_id = ?, lender = ?, installment_minor = ?, remaining_principal_minor = ?, original_principal_minor = ?, currency = ?, annual_nominal_rate_bps = ?, annual_effective_rate_bps = ?, installments_paid = ?, installments_remaining = ?, next_due_date = ? WHERE id = ?",
            [
              record.account_id,
              record.lender,
              record.installment_minor,
              record.remaining_principal_minor,
              record.original_principal_minor,
              record.currency,
              record.annual_nominal_rate_bps,
              record.annual_effective_rate_bps,
              record.installments_paid,
              record.installments_remaining,
              record.next_due_date,
              record.id,
            ],
          );
        }),
      ),
    );
  }
  public saveInvestmentPosition(position: InvestmentPosition): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          await this.assertNew("investment_positions", position.id, "Investment position");
          await this.insertInvestmentPosition(position);
        }),
      ),
    );
  }
  public updateInvestmentPosition(position: InvestmentPosition): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const found = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM investment_positions WHERE id = ?",
            [position.id],
          );
          if (found.length === 0)
            throw new DomainError("missing_reference", "Investment position does not exist.");
          const record = investmentPositionToRecord(position);
          await this.database.run(
            "UPDATE investment_positions SET account_id = ?, name = ?, symbol = ?, units = ?, cost_basis_minor = ?, current_value_minor = ?, currency = ?, valuation_date = ? WHERE id = ?",
            [
              record.account_id,
              record.name,
              record.symbol,
              record.units,
              record.cost_basis_minor,
              record.current_value_minor,
              record.currency,
              record.valuation_date,
              record.id,
            ],
          );
        }),
      ),
    );
  }
  public saveMonthlyJournal(journal: MonthlyJournal): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          await this.assertNew("monthly_journals", journal.id, "Monthly journal");
          await this.insertMonthlyJournal(journal);
        }),
      ),
    );
  }
  public updateMonthlyJournal(journal: MonthlyJournal): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const found = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM monthly_journals WHERE id = ?",
            [journal.id],
          );
          if (found.length === 0)
            throw new DomainError("missing_reference", "Monthly journal does not exist.");
          const record = monthlyJournalToRecord(journal);
          await this.database.run(
            "UPDATE monthly_journals SET period = ?, note = ?, next_month_goals = ?, perceived_control = ?, updated_at = ? WHERE id = ?",
            [
              record.period,
              record.note,
              record.next_month_goals,
              record.perceived_control,
              new Date().toISOString(),
              record.id,
            ],
          );
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
        this.withWriteTransaction(async () => {
          if (rows.length !== batch.rowsTotal || rows.some((row) => row.batchId !== batch.id))
            throw new DomainError("invalid_import", "Import batch rows are invalid.");
          const existing = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM import_batches WHERE id = ?",
            [batch.id],
          );
          if (existing.length > 0)
            throw new DomainError("duplicate_entity", "Import batch id already exists.");
          await this.database.run(
            "INSERT INTO import_batches (id, importer_type, importer_type_v2, source_filename, source_sha256, status, started_at, rows_total, rows_imported, rows_skipped, rows_failed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              batch.id,
              "money_manager_xlsx",
              batch.importerType,
              batch.sourceFilename,
              batch.sourceSha256,
              batch.status,
              new Date().toISOString(),
              batch.rowsTotal,
              batch.rowsImported,
              batch.rowsSkipped,
              batch.rowsFailed,
            ],
          );
          for (const row of rows)
            await this.database.run(
              "INSERT INTO import_rows (id, batch_id, row_number, raw_json, normalized_json, status, error_code, created_transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                row.id,
                row.batchId,
                row.rowNumber,
                row.rawJson,
                row.normalizedJson ?? null,
                row.status,
                row.errorCode ?? null,
                row.createdTransactionId ?? null,
              ],
            );
        }),
      ),
    );
  }
  public commitImportBatch(
    batch: ImportBatch,
    rows: readonly ImportRow[],
    transactions: readonly Transaction[],
    transferBundles: readonly ImportTransferBundle[] = [],
  ): Promise<ImportBatch> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const committed = validateImportCommit(batch, rows, transactions, transferBundles);
          const existing = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM import_batches WHERE id = ?",
            [batch.id],
          );
          if (existing.length > 0)
            throw new DomainError("duplicate_entity", "Import batch id already exists.");
          const transferTransactions = transferBundles.flatMap((bundle) => [
            bundle.debitTransaction,
            bundle.creditTransaction,
          ]);
          const allTransactions = [...transactions, ...transferTransactions];
          for (const bundle of transferBundles)
            await this.assertNew("transfers", bundle.transfer.id, "Transfer");
          for (const transaction of allTransactions) {
            await this.assertNew("transactions", transaction.id, "Transaction");
            await this.validateTransactionReferences(transaction);
            const duplicate = await this.database.query<{ readonly id: string }>(
              "SELECT id FROM transactions WHERE account_id = ? AND source_fingerprint = ? LIMIT 1",
              [transaction.accountId, transaction.sourceFingerprint!],
            );
            if (duplicate.length > 0)
              throw new DomainError("duplicate_entity", "Import fingerprint already exists.");
          }
          await this.database.run(
            "INSERT INTO import_batches (id, importer_type, importer_type_v2, source_filename, source_sha256, status, started_at, completed_at, rows_total, rows_imported, rows_skipped, rows_failed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              committed.id,
              "money_manager_xlsx",
              committed.importerType,
              committed.sourceFilename,
              committed.sourceSha256,
              committed.status,
              new Date().toISOString(),
              new Date().toISOString(),
              committed.rowsTotal,
              committed.rowsImported,
              committed.rowsSkipped,
              committed.rowsFailed,
            ],
          );
          for (const transaction of allTransactions) await this.insertTransaction(transaction);
          for (const bundle of transferBundles) {
            const record = transferToRecord(bundle.transfer);
            await this.database.run(
              "INSERT INTO transfers (id, debit_transaction_id, credit_transaction_id, fee_transaction_id) VALUES (?, ?, ?, ?)",
              [
                record.id,
                record.debit_transaction_id,
                record.credit_transaction_id,
                record.fee_transaction_id,
              ],
            );
          }
          for (const row of rows)
            await this.database.run(
              "INSERT INTO import_rows (id, batch_id, row_number, raw_json, normalized_json, status, error_code, created_transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                row.id,
                row.batchId,
                row.rowNumber,
                row.rawJson,
                row.normalizedJson ?? null,
                row.status,
                row.errorCode ?? null,
                row.createdTransactionId ?? null,
              ],
            );
          return committed;
        }),
      ),
    );
  }
  public undoImportBatch(batchId: string): Promise<ImportBatch> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const batch = await this.findImportBatchById(batchId);
          if (batch === undefined)
            throw new DomainError("missing_reference", "Import batch does not exist.");
          const rows = await this.listImportRows(batchId);
          const transactionIds = new Set(
            rows.filter((row) => row.status === "imported").map((row) => row.createdTransactionId!),
          );
          for (const id of [...transactionIds]) {
            const transfers = await this.database.query<{
              readonly debit_transaction_id: string;
              readonly credit_transaction_id: string;
              readonly fee_transaction_id: string | null;
            }>(
              "SELECT debit_transaction_id, credit_transaction_id, fee_transaction_id FROM transfers WHERE debit_transaction_id = ? OR credit_transaction_id = ? OR fee_transaction_id = ?",
              [id, id, id],
            );
            for (const transfer of transfers) {
              transactionIds.add(transfer.debit_transaction_id);
              transactionIds.add(transfer.credit_transaction_id);
              if (transfer.fee_transaction_id !== null)
                transactionIds.add(transfer.fee_transaction_id);
            }
          }
          const cancelled = await Promise.all(
            [...transactionIds].map(async (id) => {
              const transaction = await this.findTransactionByIdInternal(id);
              if (transaction === undefined)
                throw new DomainError("missing_reference", "Imported transaction does not exist.");
              return transaction.cancel();
            }),
          );
          const undone = batch.undo();
          for (const transaction of cancelled) await this.updateTransactionStatus(transaction);
          await this.database.run(
            "UPDATE import_batches SET status = ?, completed_at = ? WHERE id = ?",
            [undone.status, new Date().toISOString(), batchId],
          );
          return undone;
        }),
      ),
    );
  }
  public updateTag(tag: Tag): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const found = await this.database.query<{ readonly id: string }>(
            "SELECT id FROM tags WHERE id = ?",
            [tag.id],
          );
          if (found.length === 0) throw new DomainError("missing_reference", "Tag does not exist.");
          await this.database.run(
            "UPDATE tags SET name = ?, is_archived = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
            [tag.name, tag.isArchived ? 1 : 0, tag.id],
          );
        }),
      ),
    );
  }
  public setTransactionTags(transactionId: string, tagIds: readonly string[]): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          if (new Set(tagIds).size !== tagIds.length)
            throw new DomainError("duplicate_entity", "Duplicate tag reference.");
          if ((await this.findTransactionByIdInternal(transactionId)) === undefined)
            throw new DomainError("missing_reference", "Transaction does not exist.");
          for (const tagId of tagIds) {
            const rows = await this.database.query<{ readonly is_archived: number }>(
              "SELECT is_archived FROM tags WHERE id = ?",
              [tagId],
            );
            if (rows[0]?.is_archived !== 0)
              throw new DomainError("missing_reference", "Tag is unavailable.");
          }
          await this.database.run("DELETE FROM transaction_tags WHERE transaction_id = ?", [
            transactionId,
          ]);
          for (const tagId of tagIds)
            await this.database.run(
              "INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)",
              [transactionId, tagId],
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

  public saveTransactionWithDetails(
    transaction: Transaction,
    splits: readonly TransactionSplit[],
    tagIds: readonly string[],
  ): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const { validateTransactionSplits } = await import("@nexora/domain");
          validateTransactionSplits(transaction, splits);
          if (new Set(tagIds).size !== tagIds.length)
            throw new DomainError("duplicate_entity", "Duplicate tag reference.");
          await this.assertNew("transactions", transaction.id, "Transaction");
          await this.validateTransactionReferences(transaction);
          for (const split of splits) {
            if ((await this.findCategoryByIdInternal(split.categoryId))?.isArchived !== false)
              throw new DomainError("invalid_category", "Split category is unavailable.");
          }
          for (const tagId of tagIds) {
            const tags = await this.database.query<{ readonly is_archived: number }>(
              "SELECT is_archived FROM tags WHERE id = ?",
              [tagId],
            );
            if (tags[0]?.is_archived !== 0)
              throw new DomainError("missing_reference", "Tag is unavailable.");
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
          for (const tagId of tagIds)
            await this.database.run(
              "INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)",
              [transaction.id, tagId],
            );
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

  public trashTransaction(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          if ((await this.findTransactionByIdInternal(id)) === undefined)
            throw new DomainError("missing_reference", "Transaction does not exist.");
          const transferRows = await this.database.query<TransferRecord>(
            `SELECT ${transferColumns} FROM transfers WHERE debit_transaction_id = ? OR credit_transaction_id = ? OR fee_transaction_id = ?`,
            [id, id, id],
          );
          const transfer = transferRows[0];
          const transactionIds =
            transfer === undefined ? [id] : transferRecordTransactionIds(transfer);
          const deletedAt = new Date().toISOString();
          const deletionGroupId =
            transfer === undefined ? `transaction:${id}` : `transfer:${transfer.id}`;
          for (const transactionId of transactionIds) {
            if ((await this.findTransactionByIdInternal(transactionId)) === undefined)
              throw new DomainError("missing_reference", "Transfer leg does not exist.");
            await this.database.run(
              "INSERT OR IGNORE INTO transaction_trash (transaction_id, deleted_at, deletion_group_id) VALUES (?, ?, ?)",
              [transactionId, deletedAt, deletionGroupId],
            );
          }
        }),
      ),
    );
  }

  public restoreTransaction(id: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const rows = await this.database.query<{ readonly deletion_group_id: string }>(
            "SELECT deletion_group_id FROM transaction_trash WHERE transaction_id = ?",
            [id],
          );
          const entry = rows[0];
          if (entry === undefined)
            throw new DomainError("missing_reference", "Trashed transaction does not exist.");
          await this.database.run("DELETE FROM transaction_trash WHERE deletion_group_id = ?", [
            entry.deletion_group_id,
          ]);
        }),
      ),
    );
  }

  public listTrashedTransactions(): Promise<readonly TrashedTransaction[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(async () => {
        const rows = await this.database.query<
          TransactionRecord & { readonly deleted_at: string; readonly deletion_group_id: string }
        >(
          `SELECT ${transactionColumns}, transaction_trash.deleted_at, transaction_trash.deletion_group_id FROM transactions JOIN transaction_trash ON transaction_trash.transaction_id = transactions.id ORDER BY transaction_trash.deleted_at ASC, transactions.id ASC`,
        );
        return rows.map((row) => ({
          transaction: transactionFromRecord(row),
          deletedAt: row.deleted_at,
          deletionGroupId: row.deletion_group_id,
        }));
      }),
    );
  }

  public findCategoryById(id: string): Promise<Category | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() => this.findCategoryByIdInternal(id)),
    );
  }

  public findTransactionById(id: string): Promise<Transaction | undefined> {
    return this.enqueue(() =>
      this.performDatabaseOperation(async () =>
        (await this.isTransactionTrashed(id)) ? undefined : this.findTransactionByIdInternal(id),
      ),
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
        if (
          transactionRows.length !== transactionIds.length ||
          (
            await Promise.all(
              transactionIds.map((transactionId) => this.isTransactionTrashed(transactionId)),
            )
          ).some(Boolean)
        )
          return undefined;
        return transferFromRecord(row, transactionRecordMap(transactionRows));
      }),
    );
  }
  public async findImportBatchById(id: string): Promise<ImportBatch | undefined> {
    return this.performDatabaseOperation(async () => {
      const rows = await this.database.query<ImportBatchRecord>(
        "SELECT id, importer_type_v2 AS importer_type, source_filename, source_sha256, status, rows_total, rows_imported, rows_skipped, rows_failed FROM import_batches WHERE id = ?",
        [id],
      );
      return rows[0] === undefined ? undefined : importBatchFromRecord(rows[0]);
    });
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
  public async listTags(): Promise<readonly Tag[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<{
          readonly id: string;
          readonly name: string;
          readonly is_archived: number;
        }>("SELECT id, name, is_archived FROM tags ORDER BY name", [])
      ).map((row) => Tag.create({ id: row.id, name: row.name, isArchived: row.is_archived === 1 })),
    );
  }
  public async listTransactionTags(transactionId: string): Promise<readonly Tag[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<{
          readonly id: string;
          readonly name: string;
          readonly is_archived: number;
        }>(
          "SELECT tags.id, tags.name, tags.is_archived FROM tags JOIN transaction_tags ON transaction_tags.tag_id = tags.id WHERE transaction_tags.transaction_id = ? ORDER BY tags.name",
          [transactionId],
        )
      ).map((row) => Tag.create({ id: row.id, name: row.name, isArchived: row.is_archived === 1 })),
    );
  }

  public listTransactions(): Promise<readonly Transaction[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(async () => {
        const rows = await this.database.query<TransactionRecord>(
          `SELECT ${transactionColumns} FROM transactions WHERE NOT EXISTS (SELECT 1 FROM transaction_trash WHERE transaction_trash.transaction_id = transactions.id) ORDER BY created_at ASC, id ASC`,
        );
        return rows.map(transactionFromRecord);
      }),
    );
  }

  public listTransfers(): Promise<readonly Transfer[]> {
    return this.enqueue(() =>
      this.performDatabaseOperation(async () => {
        const transferRows = await this.database.query<TransferRecord>(
          `SELECT ${transferColumns} FROM transfers WHERE NOT EXISTS (SELECT 1 FROM transaction_trash WHERE transaction_id = transfers.debit_transaction_id OR transaction_id = transfers.credit_transaction_id OR transaction_id = transfers.fee_transaction_id) ORDER BY created_at ASC, id ASC`,
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
  public async listImportRows(batchId: string): Promise<readonly ImportRow[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<ImportRowRecord>(
          "SELECT id, batch_id, row_number, raw_json, normalized_json, status, error_code, created_transaction_id FROM import_rows WHERE batch_id = ? ORDER BY row_number",
          [batchId],
        )
      ).map(importRowFromRecord),
    );
  }
  public async listImportBatches(): Promise<readonly ImportBatch[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<ImportBatchRecord>(
          "SELECT id, importer_type_v2 AS importer_type, source_filename, source_sha256, status, rows_total, rows_imported, rows_skipped, rows_failed FROM import_batches ORDER BY started_at DESC, id DESC",
        )
      ).map(importBatchFromRecord),
    );
  }
  public async listRecurringRules(): Promise<readonly RecurringRule[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<RecurringRuleRecord>(
          "SELECT id, name, kind, account_id, amount_minor, currency, category_id, payee, frequency, interval_months, nominal_day, weekend_policy, next_expected_date, enabled FROM recurring_rules ORDER BY next_expected_date, id",
        )
      ).map(recurringRuleFromRecord),
    );
  }
  public async listAllocationPlans(): Promise<readonly AllocationPlan[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<AllocationPlanRecord>(
          "SELECT id, name, trigger_kind, source_account_id, target_account_id, amount_minor, currency, enabled FROM allocation_plans ORDER BY name, id",
        )
      ).map(allocationPlanFromRecord),
    );
  }
  public async listBudgets(): Promise<readonly Budget[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<BudgetRecord>(
          "SELECT id, period, category_id, amount_minor, currency, alert_at_80, alert_at_100 FROM budgets ORDER BY period, id",
        )
      ).map(budgetFromRecord),
    );
  }
  public async listLoans(): Promise<readonly Loan[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<LoanRecord>(
          "SELECT id, account_id, lender, installment_minor, remaining_principal_minor, original_principal_minor, currency, annual_nominal_rate_bps, annual_effective_rate_bps, installments_paid, installments_remaining, next_due_date FROM loans ORDER BY lender, id",
        )
      ).map(loanFromRecord),
    );
  }
  public async listInvestmentPositions(): Promise<readonly InvestmentPosition[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<InvestmentPositionRecord>(
          "SELECT id, account_id, name, symbol, units, cost_basis_minor, current_value_minor, currency, valuation_date FROM investment_positions ORDER BY name, id",
        )
      ).map(investmentPositionFromRecord),
    );
  }
  public async listMonthlyJournals(): Promise<readonly MonthlyJournal[]> {
    return this.performDatabaseOperation(async () =>
      (
        await this.database.query<MonthlyJournalRecord>(
          "SELECT id, period, note, next_month_goals, perceived_control FROM monthly_journals ORDER BY period, id",
        )
      ).map(monthlyJournalFromRecord),
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

  private deleteIsolatedEntity(table: EntityTable, id: string, entityName: string): Promise<void> {
    return this.enqueue(() =>
      this.performDatabaseOperation(() =>
        this.withWriteTransaction(async () => {
          const found = await this.database.query<{ readonly id: string }>(
            `SELECT id FROM ${table} WHERE id = ?`,
            [id],
          );
          if (found.length === 0)
            throw new DomainError("missing_reference", `${entityName} does not exist.`);
          await this.database.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
        }),
      ),
    );
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
  private async validateRecurringRuleReferences(rule: RecurringRule): Promise<void> {
    const account = await this.findAccountByIdInternal(rule.accountId);
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
    const category = await this.findCategoryByIdInternal(rule.categoryId);
    if (category === undefined || category.isArchived || !category.accepts(rule.kind))
      throw new DomainError(
        "missing_reference",
        "Recurring rule category does not exist or is incompatible.",
      );
  }
  private async validateAllocationPlanReferences(plan: AllocationPlan): Promise<void> {
    const [source, target] = await Promise.all([
      this.findAccountByIdInternal(plan.sourceAccountId),
      this.findAccountByIdInternal(plan.targetAccountId),
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
  private async insertAllocationPlan(plan: AllocationPlan): Promise<void> {
    const record = allocationPlanToRecord(plan);
    await this.database.run(
      "INSERT INTO allocation_plans (id, name, trigger_kind, source_account_id, target_account_id, amount_minor, currency, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.name,
        record.trigger_kind,
        record.source_account_id,
        record.target_account_id,
        record.amount_minor,
        record.currency,
        record.enabled,
      ],
    );
  }
  private async insertPortableImportBatch(batch: ImportBatch): Promise<void> {
    await this.database.run(
      "INSERT INTO import_batches (id, importer_type, importer_type_v2, source_filename, source_sha256, status, started_at, rows_total, rows_imported, rows_skipped, rows_failed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        batch.id,
        batch.importerType,
        batch.importerType,
        batch.sourceFilename,
        batch.sourceSha256,
        batch.status,
        new Date().toISOString(),
        batch.rowsTotal,
        batch.rowsImported,
        batch.rowsSkipped,
        batch.rowsFailed,
      ],
    );
  }
  private async insertPortableImportRow(row: ImportRow): Promise<void> {
    await this.database.run(
      "INSERT INTO import_rows (id, batch_id, row_number, raw_json, normalized_json, status, error_code, created_transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        row.id,
        row.batchId,
        row.rowNumber,
        row.rawJson,
        row.normalizedJson ?? null,
        row.status,
        row.errorCode ?? null,
        row.createdTransactionId ?? null,
      ],
    );
  }
  private async validateBudgetReferences(budget: Budget): Promise<void> {
    if (budget.categoryId === undefined) return;
    const rows = await this.database.query<{
      readonly kind_scope: string;
      readonly is_archived: number;
    }>("SELECT kind_scope, is_archived FROM categories WHERE id = ?", [budget.categoryId]);
    const category = rows[0];
    if (category === undefined || category.is_archived === 1)
      throw new DomainError("missing_reference", "Budget category is not available.");
    if (category.kind_scope === "income")
      throw new DomainError("invalid_category", "Budget category must accept expenses.");
  }
  private async insertBudget(budget: Budget): Promise<void> {
    const record = budgetToRecord(budget);
    await this.database.run(
      "INSERT INTO budgets (id, period, category_id, amount_minor, currency, alert_at_80, alert_at_100) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.period,
        record.category_id,
        record.amount_minor,
        record.currency,
        record.alert_at_80,
        record.alert_at_100,
      ],
    );
  }
  private async insertLoan(loan: Loan): Promise<void> {
    const record = loanToRecord(loan);
    await this.database.run(
      "INSERT INTO loans (id, account_id, lender, installment_minor, remaining_principal_minor, original_principal_minor, currency, annual_nominal_rate_bps, annual_effective_rate_bps, installments_paid, installments_remaining, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.account_id,
        record.lender,
        record.installment_minor,
        record.remaining_principal_minor,
        record.original_principal_minor,
        record.currency,
        record.annual_nominal_rate_bps,
        record.annual_effective_rate_bps,
        record.installments_paid,
        record.installments_remaining,
        record.next_due_date,
      ],
    );
  }
  private async insertInvestmentPosition(position: InvestmentPosition): Promise<void> {
    const record = investmentPositionToRecord(position);
    await this.database.run(
      "INSERT INTO investment_positions (id, account_id, name, symbol, units, cost_basis_minor, current_value_minor, currency, valuation_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.account_id,
        record.name,
        record.symbol,
        record.units,
        record.cost_basis_minor,
        record.current_value_minor,
        record.currency,
        record.valuation_date,
      ],
    );
  }
  private async insertMonthlyJournal(journal: MonthlyJournal): Promise<void> {
    const record = monthlyJournalToRecord(journal);
    const timestamp = new Date().toISOString();
    await this.database.run(
      "INSERT INTO monthly_journals (id, period, note, next_month_goals, perceived_control, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.period,
        record.note,
        record.next_month_goals,
        record.perceived_control,
        timestamp,
        timestamp,
      ],
    );
  }
  private async insertRecurringRule(rule: RecurringRule): Promise<void> {
    const record = recurringRuleToRecord(rule);
    await this.database.run(
      "INSERT INTO recurring_rules (id, name, kind, account_id, amount_minor, currency, category_id, payee, frequency, interval_months, nominal_day, weekend_policy, next_expected_date, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        record.id,
        record.name,
        record.kind,
        record.account_id,
        record.amount_minor,
        record.currency,
        record.category_id,
        record.payee,
        record.frequency,
        record.interval_months,
        record.nominal_day,
        record.weekend_policy,
        record.next_expected_date,
        record.enabled,
      ],
    );
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
          source,
          import_batch_id,
          source_fingerprint
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        record.import_batch_id,
        record.source_fingerprint,
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

  private async isTransactionTrashed(id: string): Promise<boolean> {
    const rows = await this.database.query<{ readonly found: number }>(
      "SELECT 1 AS found FROM transaction_trash WHERE transaction_id = ?",
      [id],
    );
    return rows.length > 0;
  }
}

interface ImportBatchRecord {
  readonly id: string;
  readonly importer_type: ImportBatch["importerType"];
  readonly source_filename: string;
  readonly source_sha256: string;
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
  readonly category_id: string | null;
  readonly payee: string | null;
  readonly frequency: "monthly";
  readonly interval_months: number;
  readonly nominal_day: number;
  readonly weekend_policy: "none" | "salary_italy";
  readonly next_expected_date: string;
  readonly enabled: number;
}

interface AllocationPlanRecord {
  readonly id: string;
  readonly name: string;
  readonly trigger_kind: "salary" | "photo_income";
  readonly source_account_id: string;
  readonly target_account_id: string;
  readonly amount_minor: string;
  readonly currency: string;
  readonly enabled: number;
}
interface BudgetRecord {
  readonly id: string;
  readonly period: string;
  readonly category_id: string | null;
  readonly amount_minor: string;
  readonly currency: string;
  readonly alert_at_80: number;
  readonly alert_at_100: number;
}
interface LoanRecord {
  readonly id: string;
  readonly account_id: string;
  readonly lender: string;
  readonly installment_minor: string;
  readonly remaining_principal_minor: string;
  readonly original_principal_minor: string | null;
  readonly currency: string;
  readonly annual_nominal_rate_bps: number | null;
  readonly annual_effective_rate_bps: number | null;
  readonly installments_paid: number | null;
  readonly installments_remaining: number | null;
  readonly next_due_date: string | null;
}
interface InvestmentPositionRecord {
  readonly id: string;
  readonly account_id: string;
  readonly name: string;
  readonly symbol: string | null;
  readonly units: string | null;
  readonly cost_basis_minor: string;
  readonly current_value_minor: string;
  readonly currency: string;
  readonly valuation_date: string;
}
interface MonthlyJournalRecord {
  readonly id: string;
  readonly period: string;
  readonly note: string | null;
  readonly next_month_goals: string | null;
  readonly perceived_control: 1 | 2 | 3 | 4 | 5 | null;
}
function monthlyJournalToRecord(journal: MonthlyJournal): MonthlyJournalRecord {
  return {
    id: journal.id,
    period: journal.period,
    note: journal.note ?? null,
    next_month_goals: journal.nextMonthGoals ?? null,
    perceived_control: journal.perceivedControl ?? null,
  };
}
function monthlyJournalFromRecord(row: MonthlyJournalRecord): MonthlyJournal {
  return MonthlyJournal.create({
    id: row.id,
    period: row.period,
    ...(row.note === null ? {} : { note: row.note }),
    ...(row.next_month_goals === null ? {} : { nextMonthGoals: row.next_month_goals }),
    ...(row.perceived_control === null ? {} : { perceivedControl: row.perceived_control }),
  });
}
function investmentPositionToRecord(position: InvestmentPosition): InvestmentPositionRecord {
  return {
    id: position.id,
    account_id: position.accountId,
    name: position.name,
    symbol: position.symbol ?? null,
    units: position.units ?? null,
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
    ...(row.symbol === null ? {} : { symbol: row.symbol }),
    ...(row.units === null ? {} : { units: row.units }),
  });
}
function loanToRecord(loan: Loan): LoanRecord {
  return {
    id: loan.id,
    account_id: loan.accountId,
    lender: loan.lender,
    installment_minor: loan.installment.amountMinor.toString(),
    remaining_principal_minor: loan.remainingPrincipal.amountMinor.toString(),
    original_principal_minor: loan.originalPrincipal?.amountMinor.toString() ?? null,
    currency: loan.remainingPrincipal.currency,
    annual_nominal_rate_bps: loan.annualNominalRateBps ?? null,
    annual_effective_rate_bps: loan.annualEffectiveRateBps ?? null,
    installments_paid: loan.installmentsPaid ?? null,
    installments_remaining: loan.installmentsRemaining ?? null,
    next_due_date: loan.nextDueDate?.toString() ?? null,
  };
}
function loanFromRecord(row: LoanRecord): Loan {
  return Loan.create({
    id: row.id,
    accountId: row.account_id,
    lender: row.lender,
    installment: Money.fromMinor(BigInt(row.installment_minor), row.currency),
    remainingPrincipal: Money.fromMinor(BigInt(row.remaining_principal_minor), row.currency),
    ...(row.original_principal_minor === null
      ? {}
      : { originalPrincipal: Money.fromMinor(BigInt(row.original_principal_minor), row.currency) }),
    ...(row.annual_nominal_rate_bps === null
      ? {}
      : { annualNominalRateBps: row.annual_nominal_rate_bps }),
    ...(row.annual_effective_rate_bps === null
      ? {}
      : { annualEffectiveRateBps: row.annual_effective_rate_bps }),
    ...(row.installments_paid === null ? {} : { installmentsPaid: row.installments_paid }),
    ...(row.installments_remaining === null
      ? {}
      : { installmentsRemaining: row.installments_remaining }),
    ...(row.next_due_date === null ? {} : { nextDueDate: LocalDate.parse(row.next_due_date) }),
  });
}
function budgetToRecord(budget: Budget): BudgetRecord {
  return {
    id: budget.id,
    period: budget.period,
    category_id: budget.categoryId ?? null,
    amount_minor: budget.amount.amountMinor.toString(),
    currency: budget.amount.currency,
    alert_at_80: budget.alertAt80 ? 1 : 0,
    alert_at_100: budget.alertAt100 ? 1 : 0,
  };
}
function budgetFromRecord(row: BudgetRecord): Budget {
  return Budget.create({
    id: row.id,
    period: row.period,
    ...(row.category_id === null ? {} : { categoryId: row.category_id }),
    amount: Money.fromMinor(BigInt(row.amount_minor), row.currency),
    alertAt80: row.alert_at_80 === 1,
    alertAt100: row.alert_at_100 === 1,
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
    enabled: plan.enabled ? 1 : 0,
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
    enabled: row.enabled === 1,
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
    category_id: rule.categoryId ?? null,
    payee: rule.payee ?? null,
    frequency: rule.frequency,
    interval_months: rule.interval,
    nominal_day: rule.nominalDay,
    weekend_policy: rule.weekendPolicy,
    next_expected_date: rule.nextExpectedDate.toString(),
    enabled: rule.enabled ? 1 : 0,
  };
}
function recurringRuleFromRecord(row: RecurringRuleRecord): RecurringRule {
  return RecurringRule.create({
    id: row.id,
    name: row.name,
    kind: row.kind,
    accountId: row.account_id,
    amount: Money.fromMinor(BigInt(row.amount_minor), row.currency),
    ...(row.category_id === null ? {} : { categoryId: row.category_id }),
    ...(row.payee === null ? {} : { payee: row.payee }),
    frequency: row.frequency,
    interval: row.interval_months,
    nominalDay: row.nominal_day,
    weekendPolicy: row.weekend_policy,
    nextExpectedDate: LocalDate.parse(row.next_expected_date),
    enabled: row.enabled === 1,
  });
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
