import type { DatabaseMigration } from "./DatabaseMigration";
import { transactionSplitsMigration } from "./0002-transaction-splits";
import { tagsMigration } from "./0003-tags";
import { importBatchesMigration } from "./0004-import-batches";
import { recurringRulesMigration } from "./0005-recurring-rules";
import { allocationPlansMigration } from "./0006-allocation-plans";
import { budgetsMigration } from "./0007-budgets";
import { loansMigration } from "./0008-loans";
import { investmentPositionsMigration } from "./0009-investment-positions";
import { bankImporterTypesMigration } from "./0010-bank-importer-types";
import { monthlyJournalsMigration } from "./0011-monthly-journals";
import { transactionTrashMigration } from "./0012-transaction-trash";

export const INITIAL_LEDGER_SCHEMA_VERSION = 1;
const INITIAL_LEDGER_SCHEMA_NAME = "initial-ledger-schema";

export const requiredSqlitePragmas = `
PRAGMA foreign_keys = ON;
`;

export const initialLedgerSchemaMigration: DatabaseMigration = {
  version: INITIAL_LEDGER_SCHEMA_VERSION,
  name: INITIAL_LEDGER_SCHEMA_NAME,
  requiresBackup: false,
  up: `
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY
    CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 160 AND name = trim(name)),
  type TEXT NOT NULL
    CHECK (type IN ('checking', 'savings', 'cash', 'investment', 'loan', 'virtual_subaccount')),
  institution TEXT
    CHECK (
      institution IS NULL
      OR (length(institution) BETWEEN 1 AND 160 AND institution = trim(institution))
    ),
  currency TEXT NOT NULL
    CHECK (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'),
  parent_account_id TEXT
    REFERENCES accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  opening_balance_minor TEXT NOT NULL DEFAULT '0'
    CHECK (
      opening_balance_minor = '0'
      OR (
        substr(opening_balance_minor, 1, 1) BETWEEN '1' AND '9'
        AND opening_balance_minor NOT GLOB '*[^0-9]*'
      )
      OR (
        substr(opening_balance_minor, 1, 1) = '-'
        AND substr(opening_balance_minor, 2, 1) BETWEEN '1' AND '9'
        AND substr(opening_balance_minor, 2) NOT GLOB '*[^0-9]*'
      )
    ),
  is_archived INTEGER NOT NULL DEFAULT 0
    CHECK (is_archived IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (type = 'virtual_subaccount' AND parent_account_id IS NOT NULL)
    OR (type <> 'virtual_subaccount' AND parent_account_id IS NULL)
  ),
  CHECK (parent_account_id IS NULL OR parent_account_id <> id)
) STRICT;

CREATE INDEX accounts_parent_account_id_idx
ON accounts(parent_account_id)
WHERE parent_account_id IS NOT NULL;

CREATE TRIGGER accounts_validate_parent_on_insert
BEFORE INSERT ON accounts
WHEN NEW.parent_account_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN (SELECT type FROM accounts WHERE id = NEW.parent_account_id) = 'virtual_subaccount'
    THEN RAISE(ABORT, 'virtual subaccounts cannot be nested')
  END;
  SELECT CASE
    WHEN (SELECT currency FROM accounts WHERE id = NEW.parent_account_id) <> NEW.currency
    THEN RAISE(ABORT, 'virtual subaccount currency must match parent')
  END;
END;

CREATE TABLE categories (
  id TEXT PRIMARY KEY
    CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 160 AND name = trim(name)),
  kind_scope TEXT NOT NULL
    CHECK (kind_scope IN ('income', 'expense', 'both')),
  parent_id TEXT
    REFERENCES categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  is_archived INTEGER NOT NULL DEFAULT 0
    CHECK (is_archived IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (parent_id IS NULL OR parent_id <> id)
) STRICT;

CREATE INDEX categories_parent_id_idx
ON categories(parent_id)
WHERE parent_id IS NOT NULL;

CREATE TABLE transactions (
  id TEXT PRIMARY KEY
    CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  kind TEXT NOT NULL
    CHECK (kind IN ('income', 'expense', 'transfer', 'adjustment')),
  status TEXT NOT NULL
    CHECK (status IN ('expected', 'booked', 'reconciled', 'cancelled')),
  account_id TEXT NOT NULL
    REFERENCES accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  amount_minor TEXT NOT NULL
    CHECK (
      (
        substr(amount_minor, 1, 1) BETWEEN '1' AND '9'
        AND amount_minor NOT GLOB '*[^0-9]*'
      )
      OR (
        substr(amount_minor, 1, 1) = '-'
        AND substr(amount_minor, 2, 1) BETWEEN '1' AND '9'
        AND substr(amount_minor, 2) NOT GLOB '*[^0-9]*'
      )
    ),
  currency TEXT NOT NULL
    CHECK (length(currency) = 3 AND currency NOT GLOB '*[^A-Z]*'),
  booked_date TEXT NOT NULL
    CHECK (
      booked_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
      AND date(booked_date) = booked_date
    ),
  value_date TEXT
    CHECK (
      value_date IS NULL
      OR (
        value_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
        AND date(value_date) = value_date
      )
    ),
  payee TEXT
    CHECK (payee IS NULL OR (length(payee) BETWEEN 1 AND 240 AND payee = trim(payee))),
  description TEXT
    CHECK (
      description IS NULL
      OR (length(description) BETWEEN 1 AND 500 AND description = trim(description))
    ),
  category_id TEXT
    REFERENCES categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  note TEXT
    CHECK (note IS NULL OR (length(note) BETWEEN 1 AND 2000 AND note = trim(note))),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'import', 'recurring', 'system')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (kind = 'income' AND substr(amount_minor, 1, 1) <> '-')
    OR (kind = 'expense' AND substr(amount_minor, 1, 1) = '-')
    OR kind IN ('transfer', 'adjustment')
  ),
  CHECK (kind <> 'transfer' OR category_id IS NULL)
) STRICT;

CREATE INDEX transactions_account_date_idx
ON transactions(account_id, booked_date DESC, id);

CREATE INDEX transactions_category_date_idx
ON transactions(category_id, booked_date DESC, id)
WHERE category_id IS NOT NULL;

CREATE TRIGGER transactions_validate_references_on_insert
BEFORE INSERT ON transactions
BEGIN
  SELECT CASE
    WHEN (SELECT currency FROM accounts WHERE id = NEW.account_id) <> NEW.currency
    THEN RAISE(ABORT, 'transaction currency must match account')
  END;
  SELECT CASE
    WHEN NEW.category_id IS NOT NULL
      AND NEW.kind NOT IN ('income', 'expense')
    THEN RAISE(ABORT, 'only income and expense transactions may use a category')
  END;
  SELECT CASE
    WHEN NEW.category_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM categories
        WHERE id = NEW.category_id
          AND (
            kind_scope = 'both'
            OR kind_scope = NEW.kind
          )
      )
    THEN RAISE(ABORT, 'transaction category scope is incompatible')
  END;
END;

CREATE TABLE transfers (
  id TEXT PRIMARY KEY
    CHECK (length(id) BETWEEN 1 AND 128 AND id = trim(id)),
  debit_transaction_id TEXT NOT NULL UNIQUE
    REFERENCES transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  credit_transaction_id TEXT NOT NULL UNIQUE
    REFERENCES transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  fee_transaction_id TEXT UNIQUE
    REFERENCES transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (debit_transaction_id <> credit_transaction_id),
  CHECK (fee_transaction_id IS NULL OR fee_transaction_id <> debit_transaction_id),
  CHECK (fee_transaction_id IS NULL OR fee_transaction_id <> credit_transaction_id)
) STRICT;

CREATE TRIGGER transfers_validate_bundle_on_insert
BEFORE INSERT ON transfers
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM transactions AS debit
      JOIN transactions AS credit
        ON credit.id = NEW.credit_transaction_id
      WHERE debit.id = NEW.debit_transaction_id
        AND debit.kind = 'transfer'
        AND credit.kind = 'transfer'
        AND debit.amount_minor = '-' || credit.amount_minor
        AND debit.currency = credit.currency
        AND debit.account_id <> credit.account_id
        AND debit.booked_date = credit.booked_date
        AND debit.status = credit.status
    )
    THEN RAISE(ABORT, 'invalid transfer legs')
  END;
  SELECT CASE
    WHEN NEW.fee_transaction_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM transactions AS fee
        JOIN transactions AS debit
          ON debit.id = NEW.debit_transaction_id
        WHERE fee.id = NEW.fee_transaction_id
          AND fee.kind = 'expense'
          AND fee.account_id = debit.account_id
          AND fee.currency = debit.currency
          AND fee.booked_date = debit.booked_date
          AND fee.status = debit.status
      )
    THEN RAISE(ABORT, 'invalid transfer fee')
  END;
END;
`,
  down: `
DROP TRIGGER IF EXISTS transfers_validate_bundle_on_insert;
DROP TABLE IF EXISTS transfers;
DROP TRIGGER IF EXISTS transactions_validate_references_on_insert;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS categories;
DROP TRIGGER IF EXISTS accounts_validate_parent_on_insert;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS schema_migrations;
`,
};

export const databaseMigrations: readonly DatabaseMigration[] = [
  initialLedgerSchemaMigration,
  transactionSplitsMigration,
  tagsMigration,
  importBatchesMigration,
  recurringRulesMigration,
  allocationPlansMigration,
  budgetsMigration,
  loansMigration,
  investmentPositionsMigration,
  bankImporterTypesMigration,
  monthlyJournalsMigration,
  transactionTrashMigration,
];
