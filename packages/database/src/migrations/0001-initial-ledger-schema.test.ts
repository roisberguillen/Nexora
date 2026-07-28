// @vitest-environment node

import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initialLedgerSchemaMigration, requiredSqlitePragmas } from "./0001-initial-ledger-schema";

interface CountRow {
  readonly count: number;
}

function insertAccount(
  database: DatabaseSync,
  id: string,
  type: "checking" | "savings" = "checking",
): void {
  database
    .prepare(
      `
        INSERT INTO accounts (id, name, type, currency, opening_balance_minor)
        VALUES (?, ?, ?, 'EUR', '0')
      `,
    )
    .run(id, `Conto ${id}`, type);
}

function insertTransferLeg(
  database: DatabaseSync,
  id: string,
  accountId: string,
  amountMinor: string,
): void {
  database
    .prepare(
      `
        INSERT INTO transactions (
          id,
          kind,
          status,
          account_id,
          amount_minor,
          currency,
          booked_date
        )
        VALUES (?, 'transfer', 'booked', ?, ?, 'EUR', '2026-07-27')
      `,
    )
    .run(id, accountId, amountMinor);
}

describe("initial ledger schema migration", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    database.exec(requiredSqlitePragmas);
    database.exec(initialLedgerSchemaMigration.up);
  });

  afterEach(() => {
    database.close();
  });

  it("crea lo schema core e prepara lo storico per il runner", () => {
    const tables = database
      .prepare(
        `
          SELECT count(*) AS count
          FROM sqlite_schema
          WHERE type = 'table'
            AND name IN ('schema_migrations', 'accounts', 'categories', 'transactions', 'transfers')
        `,
      )
      .get() as unknown as CountRow;
    const migrations = database
      .prepare("SELECT count(*) AS count FROM schema_migrations")
      .get() as unknown as CountRow;

    expect(tables.count).toBe(5);
    expect(migrations.count).toBe(0);
  });

  it("conserva importi oltre il limite degli interi JavaScript senza convertirli in float", () => {
    insertAccount(database, "account-large");
    const amountMinor = "900719925474099312345678901234567890";

    database
      .prepare(
        `
          INSERT INTO transactions (
            id,
            kind,
            status,
            account_id,
            amount_minor,
            currency,
            booked_date
          )
          VALUES ('income-large', 'income', 'booked', 'account-large', ?, 'EUR', '2026-07-27')
        `,
      )
      .run(amountMinor);

    const stored = database
      .prepare("SELECT amount_minor FROM transactions WHERE id = 'income-large'")
      .get() as unknown as { readonly amount_minor: string };

    expect(stored.amount_minor).toBe(amountMinor);
  });

  it("rifiuta importi non canonici, segni errati e date non valide", () => {
    insertAccount(database, "account-validation");
    const statement = database.prepare(
      `
        INSERT INTO transactions (
          id,
          kind,
          status,
          account_id,
          amount_minor,
          currency,
          booked_date
        )
        VALUES (?, ?, 'booked', 'account-validation', ?, 'EUR', ?)
      `,
    );

    expect(() => statement.run("leading-zero", "income", "001", "2026-07-27")).toThrow();
    expect(() => statement.run("wrong-sign", "expense", "100", "2026-07-27")).toThrow();
    expect(() => statement.run("zero-value", "adjustment", "0", "2026-07-27")).toThrow();
    expect(() => statement.run("invalid-date", "income", "100", "2026-02-30")).toThrow();
  });

  it("applica riferimenti, valuta del conto e scope della categoria", () => {
    insertAccount(database, "account-eur");
    database
      .prepare(
        `
          INSERT INTO categories (id, name, kind_scope)
          VALUES ('income-category', 'Entrate demo', 'income')
        `,
      )
      .run();

    const transaction = database.prepare(
      `
        INSERT INTO transactions (
          id,
          kind,
          status,
          account_id,
          amount_minor,
          currency,
          booked_date,
          category_id
        )
        VALUES (?, ?, 'booked', ?, ?, ?, '2026-07-27', ?)
      `,
    );

    expect(() =>
      transaction.run("missing-account", "income", "account-missing", "100", "EUR", null),
    ).toThrow();
    expect(() =>
      transaction.run("wrong-currency", "income", "account-eur", "100", "USD", null),
    ).toThrow();
    expect(() =>
      transaction.run("wrong-category", "expense", "account-eur", "-100", "EUR", "income-category"),
    ).toThrow();
  });

  it("protegge la gerarchia e la valuta dei sottoconti virtuali", () => {
    insertAccount(database, "account-parent");
    const virtualAccount = database.prepare(
      `
        INSERT INTO accounts (
          id,
          name,
          type,
          currency,
          parent_account_id,
          opening_balance_minor
        )
        VALUES (?, ?, 'virtual_subaccount', ?, ?, '0')
      `,
    );

    virtualAccount.run("space-valid", "Spazio valido", "EUR", "account-parent");

    expect(() =>
      virtualAccount.run("space-wrong-currency", "Spazio valuta errata", "USD", "account-parent"),
    ).toThrow();
    expect(() =>
      virtualAccount.run("space-nested", "Spazio annidato", "EUR", "space-valid"),
    ).toThrow();
  });

  it("accetta soltanto bundle di trasferimento coerenti", () => {
    insertAccount(database, "account-debit");
    insertAccount(database, "account-credit", "savings");
    insertTransferLeg(database, "transfer-debit", "account-debit", "-10000");
    insertTransferLeg(database, "transfer-credit", "account-credit", "10000");

    database
      .prepare(
        `
          INSERT INTO transfers (id, debit_transaction_id, credit_transaction_id)
          VALUES ('transfer-valid', 'transfer-debit', 'transfer-credit')
        `,
      )
      .run();

    expect(
      (database.prepare("SELECT count(*) AS count FROM transfers").get() as unknown as CountRow)
        .count,
    ).toBe(1);

    insertTransferLeg(database, "transfer-debit-invalid", "account-debit", "-5000");
    insertTransferLeg(database, "transfer-credit-invalid", "account-credit", "4999");

    expect(() =>
      database
        .prepare(
          `
            INSERT INTO transfers (id, debit_transaction_id, credit_transaction_id)
            VALUES (
              'transfer-invalid',
              'transfer-debit-invalid',
              'transfer-credit-invalid'
            )
          `,
        )
        .run(),
    ).toThrow();
  });

  it("consente il rollback atomico di un bundle non valido", () => {
    insertAccount(database, "account-rollback-a");
    insertAccount(database, "account-rollback-b", "savings");

    database.exec("BEGIN IMMEDIATE");
    try {
      insertTransferLeg(database, "rollback-debit", "account-rollback-a", "-10000");
      insertTransferLeg(database, "rollback-credit", "account-rollback-b", "9999");
      database
        .prepare(
          `
            INSERT INTO transfers (id, debit_transaction_id, credit_transaction_id)
            VALUES ('rollback-transfer', 'rollback-debit', 'rollback-credit')
          `,
        )
        .run();
      database.exec("COMMIT");
    } catch {
      database.exec("ROLLBACK");
    }

    const remaining = database
      .prepare(
        `
          SELECT count(*) AS count
          FROM transactions
          WHERE id IN ('rollback-debit', 'rollback-credit')
        `,
      )
      .get() as unknown as CountRow;

    expect(remaining.count).toBe(0);
  });

  it("rimuove integralmente lo schema con la migrazione down", () => {
    database.exec(initialLedgerSchemaMigration.down);

    const remaining = database
      .prepare(
        `
          SELECT count(*) AS count
          FROM sqlite_schema
          WHERE type = 'table'
            AND name IN ('schema_migrations', 'accounts', 'categories', 'transactions', 'transfers')
        `,
      )
      .get() as unknown as CountRow;

    expect(remaining.count).toBe(0);
  });
});
