use rusqlite::{Connection, OptionalExtension, Transaction, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

use crate::{OperationApplyResult, ReplicableOperation, TransportError};

/// Durable phone-host operation log. The database is the same native SQLite
/// file used by Nexora, so the log survives Local Hub restarts and Android
/// WebView lifecycle changes without exposing the ledger file over HTTP.
pub struct SqliteSyncOperationStore {
    connection: Connection,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SyncBootstrapSnapshot {
    pub schema_version: u16,
    pub cursor: u64,
    pub operations: Vec<(u64, ReplicableOperation)>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
struct LedgerOperationPayload {
    schema_version: u16,
    operation: String,
    entity_type: String,
    entity_id: String,
    #[serde(default)]
    amount_minor: Option<String>,
    #[serde(default)]
    currency: Option<String>,
    #[serde(default)]
    transfer_group_id: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    account_id: Option<String>,
    #[serde(default)]
    booked_date: Option<String>,
    #[serde(default)]
    value_date: Option<String>,
    #[serde(default)]
    payee: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    category_id: Option<String>,
    #[serde(default)]
    note: Option<String>,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    debit_transaction_id: Option<String>,
    #[serde(default)]
    credit_transaction_id: Option<String>,
    #[serde(default)]
    fee_transaction_id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    #[serde(rename = "type")]
    account_type: Option<String>,
    #[serde(default)]
    institution: Option<String>,
    #[serde(default)]
    parent_account_id: Option<String>,
    #[serde(default)]
    opening_balance_minor: Option<String>,
    #[serde(default)]
    is_archived: Option<bool>,
    #[serde(default)]
    kind_scope: Option<String>,
    #[serde(default)]
    parent_id: Option<String>,
    #[serde(default)]
    series_id: Option<String>,
    #[serde(default)]
    period: Option<String>,
    #[serde(default)]
    effective_to_period: Option<String>,
    #[serde(default)]
    first_alert_percentage: Option<i64>,
    #[serde(default)]
    second_alert_percentage: Option<i64>,
    #[serde(default)]
    frequency_unit: Option<String>,
    #[serde(default)]
    interval_value: Option<i64>,
    #[serde(default)]
    nominal_day: Option<i64>,
    #[serde(default)]
    nominal_month: Option<i64>,
    #[serde(default)]
    weekend_policy: Option<String>,
    #[serde(default)]
    next_nominal_date: Option<String>,
    #[serde(default)]
    next_expected_date: Option<String>,
    #[serde(default)]
    retired_at: Option<String>,
    #[serde(default)]
    expense_variability: Option<String>,
    #[serde(default)]
    expense_exceptionality: Option<String>,
    #[serde(default)]
    trigger_kind: Option<String>,
    #[serde(default)]
    source_account_id: Option<String>,
    #[serde(default)]
    target_account_id: Option<String>,
    #[serde(default)]
    enabled: Option<bool>,
    #[serde(default)]
    lender: Option<String>,
    #[serde(default)]
    installment_minor: Option<String>,
    #[serde(default)]
    remaining_principal_minor: Option<String>,
    #[serde(default)]
    original_principal_minor: Option<String>,
    #[serde(default)]
    annual_nominal_rate_bps: Option<i64>,
    #[serde(default)]
    annual_effective_rate_bps: Option<i64>,
    #[serde(default)]
    installments_paid: Option<i64>,
    #[serde(default)]
    installments_remaining: Option<i64>,
    #[serde(default)]
    next_due_date: Option<String>,
    #[serde(default)]
    symbol: Option<String>,
    #[serde(default)]
    units: Option<String>,
    #[serde(default)]
    cost_basis_minor: Option<String>,
    #[serde(default)]
    current_value_minor: Option<String>,
    #[serde(default)]
    valuation_date: Option<String>,
    #[serde(default)]
    next_month_goals: Option<String>,
    #[serde(default)]
    perceived_control: Option<i64>,
}

impl SqliteSyncOperationStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, rusqlite::Error> {
        let connection = Connection::open(path)?;
        connection.execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS sync_operation_deliveries (
                 delivery_id TEXT PRIMARY KEY
             ) STRICT;
             CREATE TABLE IF NOT EXISTS sync_operations (
                 cursor INTEGER PRIMARY KEY AUTOINCREMENT,
                 idempotency_key TEXT NOT NULL UNIQUE,
                 device_id TEXT NOT NULL,
                 entity_type TEXT NOT NULL DEFAULT '',
                 entity_id TEXT NOT NULL,
                 base_revision INTEGER NOT NULL,
                 revision INTEGER NOT NULL,
                 payload_digest TEXT NOT NULL,
                 payload TEXT NOT NULL,
                 tombstone INTEGER NOT NULL CHECK (tombstone IN (0, 1)),
                 created_at TEXT NOT NULL
             ) STRICT;
             CREATE TABLE IF NOT EXISTS sync_revisions (
                 entity_type TEXT NOT NULL,
                 entity_id TEXT NOT NULL,
                 revision INTEGER NOT NULL,
                 PRIMARY KEY (entity_type, entity_id)
             ) STRICT;
             CREATE TABLE IF NOT EXISTS sync_runtime (
                 suppress_journal INTEGER NOT NULL CHECK (suppress_journal IN (0, 1))
             ) STRICT;
             INSERT INTO sync_runtime (suppress_journal)
                 SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM sync_runtime);",
        )?;
        if !table_has_column(&connection, "sync_operations", "entity_type")? {
            connection.execute(
                "ALTER TABLE sync_operations ADD COLUMN entity_type TEXT NOT NULL DEFAULT ''",
                [],
            )?;
        }
        if !table_has_column(&connection, "sync_revisions", "entity_type")? {
            connection.execute_batch(
                "ALTER TABLE sync_revisions RENAME TO sync_revisions_legacy;
                 CREATE TABLE sync_revisions (
                     entity_type TEXT NOT NULL,
                     entity_id TEXT NOT NULL,
                     revision INTEGER NOT NULL,
                     PRIMARY KEY (entity_type, entity_id)
                 ) STRICT;
                 INSERT INTO sync_revisions (entity_type, entity_id, revision)
                 SELECT 'legacy', entity_id, revision FROM sync_revisions_legacy;
                 DROP TABLE sync_revisions_legacy;",
            )?;
        }
        install_change_journal_triggers(&connection)?;
        Ok(Self { connection })
    }

    pub fn push(
        &mut self,
        delivery_id: &str,
        operations: impl IntoIterator<Item = ReplicableOperation>,
    ) -> Result<Vec<OperationApplyResult>, DurableSyncError> {
        let transaction = self.connection.transaction()?;
        transaction.execute("UPDATE sync_runtime SET suppress_journal = 1", [])?;
        let operations: Vec<ReplicableOperation> = operations.into_iter().collect();
        let payloads: Vec<LedgerOperationPayload> = operations
            .iter()
            .map(validate_payload)
            .collect::<Result<_, _>>()?;
        let delivered = transaction
            .query_row(
                "SELECT 1 FROM sync_operation_deliveries WHERE delivery_id = ?1",
                params![delivery_id],
                |_| Ok(()),
            )
            .optional()?;
        if delivered.is_some() {
            return Err(DurableSyncError::Transport(TransportError::ReplayDetected));
        }
        transaction.execute(
            "INSERT INTO sync_operation_deliveries (delivery_id) VALUES (?1)",
            params![delivery_id],
        )?;

        let mut results = Vec::new();
        for (operation, payload) in operations.into_iter().zip(payloads) {
            let duplicate = transaction
                .query_row(
                    "SELECT cursor, revision FROM sync_operations WHERE idempotency_key = ?1",
                    params![operation.idempotency_key],
                    |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
                )
                .optional()?;
            if let Some((cursor, revision)) = duplicate {
                results.push(OperationApplyResult::Duplicate {
                    cursor: as_u64(cursor)?,
                    revision: as_u64(revision)?,
                });
                continue;
            }

            let current = transaction
                .query_row(
                    "SELECT revision FROM sync_revisions WHERE entity_type = ?1 AND entity_id = ?2",
                    params![payload.entity_type.as_str(), operation.entity_id],
                    |row| row.get::<_, i64>(0),
                )
                .optional()?
                .unwrap_or(0);
            let current_revision = as_u64(current)?;
            if operation.base_revision != current_revision {
                results.push(OperationApplyResult::Conflict { current_revision });
                continue;
            }

            apply_ledger_operation(&transaction, &operation, &payload)?;

            let revision = current_revision
                .checked_add(1)
                .ok_or(DurableSyncError::NumericOverflow)?;
            transaction.execute(
                "INSERT INTO sync_operations
                    (idempotency_key, device_id, entity_type, entity_id, base_revision, revision,
                     payload_digest, payload, tombstone, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    operation.idempotency_key,
                    operation.device_id,
                    payload.entity_type,
                    operation.entity_id,
                    as_i64(operation.base_revision)?,
                    as_i64(revision)?,
                    operation.payload_digest,
                    operation.payload,
                    i64::from(operation.tombstone),
                    operation.created_at,
                ],
            )?;
            let cursor = as_u64(transaction.last_insert_rowid())?;
            transaction.execute(
                "INSERT INTO sync_revisions (entity_type, entity_id, revision) VALUES (?1, ?2, ?3)
                 ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision",
                params![
                    payload.entity_type.as_str(),
                    operation.entity_id,
                    as_i64(revision)?
                ],
            )?;
            results.push(OperationApplyResult::Applied { cursor, revision });
        }
        transaction.commit()?;
        Ok(results)
    }

    pub fn pull(&self, after: u64) -> Result<Vec<(u64, ReplicableOperation)>, DurableSyncError> {
        let mut statement = self.connection.prepare(
            "SELECT cursor, idempotency_key, device_id, entity_id, base_revision, revision,
                    payload_digest, payload, tombstone, created_at
             FROM sync_operations WHERE cursor > ?1 ORDER BY cursor",
        )?;
        let rows = statement.query_map(params![as_i64(after)?], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                ReplicableOperation {
                    idempotency_key: row.get(1)?,
                    device_id: row.get(2)?,
                    entity_id: row.get(3)?,
                    base_revision: as_u64(row.get::<_, i64>(4)?).map_err(to_sql_error)?,
                    revision: as_u64(row.get::<_, i64>(5)?).map_err(to_sql_error)?,
                    payload_digest: row.get(6)?,
                    payload: row.get(7)?,
                    tombstone: row.get::<_, i64>(8)? != 0,
                    created_at: row.get(9)?,
                },
            ))
        })?;
        rows.map(|row| {
            let (cursor, operation) = row?;
            Ok((as_u64(cursor)?, operation))
        })
        .collect()
    }

    pub fn bootstrap(&self) -> Result<SyncBootstrapSnapshot, DurableSyncError> {
        let mut operations = self.pull(0)?;
        let cursor = operations.last().map(|(cursor, _)| *cursor).unwrap_or(0);
        let logged_entities = operations
            .iter()
            .filter_map(|(_, operation)| {
                let payload = serde_json::from_str::<serde_json::Value>(&operation.payload).ok()?;
                Some((
                    payload.get("entity_type")?.as_str()?.to_owned(),
                    operation.entity_id.clone(),
                ))
            })
            .collect::<std::collections::HashSet<_>>();
        let mut snapshot_operations = self.current_ledger_operations()?;
        snapshot_operations.retain(|(_, operation)| {
            let payload = serde_json::from_str::<serde_json::Value>(&operation.payload).ok();
            let Some(payload) = payload else { return true };
            let Some(entity_type) = payload.get("entity_type").and_then(|value| value.as_str())
            else {
                return true;
            };
            !logged_entities.contains(&(entity_type.to_owned(), operation.entity_id.clone()))
        });
        operations.append(&mut snapshot_operations);
        Ok(SyncBootstrapSnapshot {
            schema_version: 1,
            cursor,
            operations,
        })
    }

    fn current_ledger_operations(
        &self,
    ) -> Result<Vec<(u64, ReplicableOperation)>, DurableSyncError> {
        let mut operations = Vec::new();
        if table_has_column(&self.connection, "accounts", "name")? {
            let mut accounts = self.connection.prepare(
                "SELECT id, name, type, currency, institution, parent_account_id,
                        opening_balance_minor, is_archived FROM accounts ORDER BY id",
            )?;
            for row in accounts.query_map([], |row| {
                let payload = serde_json::json!({
                    "schema_version": 1,
                    "operation": "upsert",
                    "entity_type": "account",
                    "entity_id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "type": row.get::<_, String>(2)?,
                    "currency": row.get::<_, String>(3)?,
                    "institution": row.get::<_, Option<String>>(4)?,
                    "parent_account_id": row.get::<_, Option<String>>(5)?,
                    "opening_balance_minor": row.get::<_, String>(6)?,
                    "is_archived": row.get::<_, i64>(7)? != 0,
                });
                Ok(bootstrap_operation(payload))
            })? {
                operations.push((0, row?));
            }
        }
        if table_has_column(&self.connection, "categories", "name")? {
            let mut categories = self.connection.prepare(
                "SELECT id, name, kind_scope, parent_id, is_archived
                 FROM categories ORDER BY id",
            )?;
            for row in categories.query_map([], |row| {
                let payload = serde_json::json!({
                    "schema_version": 1,
                    "operation": "upsert",
                    "entity_type": "category",
                    "entity_id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "kind_scope": row.get::<_, String>(2)?,
                    "parent_id": row.get::<_, Option<String>>(3)?,
                    "is_archived": row.get::<_, i64>(4)? != 0,
                });
                Ok(bootstrap_operation(payload))
            })? {
                operations.push((0, row?));
            }
        }
        if table_has_column(&self.connection, "tags", "name")? {
            let mut tags = self
                .connection
                .prepare("SELECT id, name, is_archived FROM tags ORDER BY id")?;
            for row in tags.query_map([], |row| {
                let payload = serde_json::json!({
                    "schema_version": 1,
                    "operation": "upsert",
                    "entity_type": "tag",
                    "entity_id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "is_archived": row.get::<_, i64>(2)? != 0,
                });
                Ok(bootstrap_operation(payload))
            })? {
                operations.push((0, row?));
            }
        }
        if table_has_column(&self.connection, "budgets", "series_id")? {
            let mut budgets = self.connection.prepare(
                "SELECT id, series_id, period, effective_to_period, category_id,
                        amount_minor, currency, first_alert_percentage, second_alert_percentage
                 FROM budgets ORDER BY id",
            )?;
            for row in budgets.query_map([], |row| {
                let payload = serde_json::json!({
                    "schema_version": 1,
                    "operation": "upsert",
                    "entity_type": "budget",
                    "entity_id": row.get::<_, String>(0)?,
                    "series_id": row.get::<_, String>(1)?,
                    "period": row.get::<_, String>(2)?,
                    "effective_to_period": row.get::<_, Option<String>>(3)?,
                    "category_id": row.get::<_, Option<String>>(4)?,
                    "amount_minor": row.get::<_, String>(5)?,
                    "currency": row.get::<_, String>(6)?,
                    "first_alert_percentage": row.get::<_, Option<i64>>(7)?,
                    "second_alert_percentage": row.get::<_, Option<i64>>(8)?,
                });
                Ok(bootstrap_operation(payload))
            })? {
                operations.push((0, row?));
            }
        }
        if table_has_column(&self.connection, "recurring_rules", "frequency_unit")? {
            let mut rules = self.connection.prepare("SELECT id, name, kind, account_id, amount_minor, currency, category_id, payee, frequency, frequency_unit, interval_value, nominal_day, nominal_month, weekend_policy_v2, next_nominal_date, next_expected_date, enabled, retired_at, expense_variability, expense_exceptionality FROM recurring_rules ORDER BY id")?;
            for row in rules.query_map([], |row| Ok(bootstrap_operation(serde_json::json!({
                "schema_version": 1, "operation": "upsert", "entity_type": "recurring_rule",
                "entity_id": row.get::<_, String>(0)?, "name": row.get::<_, String>(1)?, "kind": row.get::<_, String>(2)?,
                "account_id": row.get::<_, String>(3)?, "amount_minor": row.get::<_, String>(4)?, "currency": row.get::<_, String>(5)?,
                "category_id": row.get::<_, Option<String>>(6)?, "payee": row.get::<_, Option<String>>(7)?, "frequency": row.get::<_, String>(8)?,
                "frequency_unit": row.get::<_, String>(9)?, "interval_value": row.get::<_, i64>(10)?, "nominal_day": row.get::<_, i64>(11)?,
                "nominal_month": row.get::<_, Option<i64>>(12)?, "weekend_policy": row.get::<_, Option<String>>(13)?,
                "next_nominal_date": row.get::<_, Option<String>>(14)?, "next_expected_date": row.get::<_, String>(15)?,
                "enabled": row.get::<_, i64>(16)? != 0, "retired_at": row.get::<_, Option<String>>(17)?,
                "expense_variability": row.get::<_, Option<String>>(18)?, "expense_exceptionality": row.get::<_, Option<String>>(19)?
            }))))? { operations.push((0, row?)); }
        }
        if table_has_column(&self.connection, "allocation_plans", "trigger_kind")? {
            let mut plans = self.connection.prepare("SELECT id, name, trigger_kind, source_account_id, target_account_id, amount_minor, currency, enabled FROM allocation_plans ORDER BY id")?;
            for row in plans.query_map([], |row| Ok(bootstrap_operation(serde_json::json!({
                "schema_version": 1, "operation": "upsert", "entity_type": "allocation_plan", "entity_id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?, "trigger_kind": row.get::<_, String>(2)?, "source_account_id": row.get::<_, String>(3)?,
                "target_account_id": row.get::<_, String>(4)?, "amount_minor": row.get::<_, String>(5)?, "currency": row.get::<_, String>(6)?, "enabled": row.get::<_, i64>(7)? != 0
            }))))? { operations.push((0, row?)); }
        }
        if table_has_column(&self.connection, "loans", "installment_minor")? {
            let mut rows = self.connection.prepare("SELECT id,account_id,lender,installment_minor,remaining_principal_minor,original_principal_minor,currency,annual_nominal_rate_bps,annual_effective_rate_bps,installments_paid,installments_remaining,next_due_date FROM loans ORDER BY id")?;
            for row in rows.query_map([], |r| Ok(bootstrap_operation(serde_json::json!({"schema_version":1,"operation":"upsert","entity_type":"loan","entity_id":r.get::<_,String>(0)?,"account_id":r.get::<_,String>(1)?,"lender":r.get::<_,String>(2)?,"installment_minor":r.get::<_,String>(3)?,"remaining_principal_minor":r.get::<_,String>(4)?,"original_principal_minor":r.get::<_,Option<String>>(5)?,"currency":r.get::<_,String>(6)?,"annual_nominal_rate_bps":r.get::<_,Option<i64>>(7)?,"annual_effective_rate_bps":r.get::<_,Option<i64>>(8)?,"installments_paid":r.get::<_,Option<i64>>(9)?,"installments_remaining":r.get::<_,Option<i64>>(10)?,"next_due_date":r.get::<_,Option<String>>(11)?}))))? { operations.push((0,row?)); }
        }
        if table_has_column(&self.connection, "investment_positions", "cost_basis_minor")? {
            let mut rows = self.connection.prepare("SELECT id,account_id,name,symbol,units,cost_basis_minor,current_value_minor,currency,valuation_date FROM investment_positions ORDER BY id")?;
            for row in rows.query_map([], |r| Ok(bootstrap_operation(serde_json::json!({"schema_version":1,"operation":"upsert","entity_type":"investment","entity_id":r.get::<_,String>(0)?,"account_id":r.get::<_,String>(1)?,"name":r.get::<_,String>(2)?,"symbol":r.get::<_,Option<String>>(3)?,"units":r.get::<_,Option<String>>(4)?,"cost_basis_minor":r.get::<_,String>(5)?,"current_value_minor":r.get::<_,String>(6)?,"currency":r.get::<_,String>(7)?,"valuation_date":r.get::<_,String>(8)?}))))? { operations.push((0,row?)); }
        }
        if table_has_column(&self.connection, "monthly_journals", "period")? {
            let mut rows = self.connection.prepare("SELECT id,period,note,next_month_goals,perceived_control FROM monthly_journals ORDER BY id")?;
            for row in rows.query_map([], |r| Ok(bootstrap_operation(serde_json::json!({"schema_version":1,"operation":"upsert","entity_type":"monthly_journal","entity_id":r.get::<_,String>(0)?,"period":r.get::<_,String>(1)?,"note":r.get::<_,Option<String>>(2)?,"next_month_goals":r.get::<_,Option<String>>(3)?,"perceived_control":r.get::<_,Option<i64>>(4)?}))))? { operations.push((0,row?)); }
        }
        let mut transactions = self.connection.prepare(
            "SELECT id, kind, status, account_id, amount_minor, currency, booked_date,
                    value_date, payee, description, category_id, note, source
             FROM transactions ORDER BY id",
        )?;
        for row in transactions.query_map([], |row| {
            let payload = serde_json::json!({
                "schema_version": 1,
                "operation": "upsert",
                "entity_type": "transaction",
                "entity_id": row.get::<_, String>(0)?,
                "kind": row.get::<_, String>(1)?,
                "status": row.get::<_, String>(2)?,
                "account_id": row.get::<_, String>(3)?,
                "amount_minor": row.get::<_, String>(4)?,
                "currency": row.get::<_, String>(5)?,
                "booked_date": row.get::<_, String>(6)?,
                "value_date": row.get::<_, Option<String>>(7)?,
                "payee": row.get::<_, Option<String>>(8)?,
                "description": row.get::<_, Option<String>>(9)?,
                "category_id": row.get::<_, Option<String>>(10)?,
                "note": row.get::<_, Option<String>>(11)?,
                "source": row.get::<_, String>(12)?,
            });
            Ok(bootstrap_operation(payload))
        })? {
            operations.push((0, row?));
        }
        Ok(operations)
    }
}

fn table_has_column(
    connection: &Connection,
    table: &str,
    column: &str,
) -> Result<bool, rusqlite::Error> {
    let mut statement = connection.prepare("SELECT name FROM pragma_table_info(?1)")?;
    Ok(statement
        .query_map(params![table], |row| row.get::<_, String>(0))?
        .any(|name| name.map(|value| value == column).unwrap_or(false)))
}

fn install_change_journal_triggers(connection: &Connection) -> Result<(), rusqlite::Error> {
    let mut sql = String::new();
    if table_has_column(connection, "accounts", "name")? {
        sql.push_str(
            r#"
            DROP TRIGGER IF EXISTS sync_accounts_insert;
            DROP TRIGGER IF EXISTS sync_accounts_update;
            DROP TRIGGER IF EXISTS sync_accounts_delete;
            CREATE TRIGGER sync_accounts_insert AFTER INSERT ON accounts
            WHEN (SELECT suppress_journal FROM sync_runtime LIMIT 1) = 0 BEGIN
              INSERT INTO sync_operations (idempotency_key, device_id, entity_type, entity_id, base_revision, revision, payload_digest, payload, tombstone, created_at)
              SELECT 'phone-journal:' || lower(hex(randomblob(16))), 'phone-local-ledger', 'account', NEW.id,
                     COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = 'account' AND entity_id = NEW.id), 0),
                     COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = 'account' AND entity_id = NEW.id), 0) + 1,
                     'sha256:phone-local-journal', json_object('schema_version', 1, 'operation', 'upsert', 'entity_type', 'account', 'entity_id', NEW.id, 'name', NEW.name, 'type', NEW.type, 'currency', NEW.currency, 'institution', NEW.institution, 'parent_account_id', NEW.parent_account_id, 'opening_balance_minor', NEW.opening_balance_minor, 'is_archived', NEW.is_archived), 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
              INSERT INTO sync_revisions (entity_type, entity_id, revision) SELECT 'account', NEW.id, revision FROM sync_operations WHERE cursor = last_insert_rowid() ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision;
            END;
            CREATE TRIGGER sync_accounts_update AFTER UPDATE ON accounts
            WHEN (SELECT suppress_journal FROM sync_runtime LIMIT 1) = 0 BEGIN
              INSERT INTO sync_operations (idempotency_key, device_id, entity_type, entity_id, base_revision, revision, payload_digest, payload, tombstone, created_at)
              SELECT 'phone-journal:' || lower(hex(randomblob(16))), 'phone-local-ledger', 'account', NEW.id, COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = 'account' AND entity_id = NEW.id), 0), COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = 'account' AND entity_id = NEW.id), 0) + 1, 'sha256:phone-local-journal', json_object('schema_version', 1, 'operation', 'upsert', 'entity_type', 'account', 'entity_id', NEW.id, 'name', NEW.name, 'type', NEW.type, 'currency', NEW.currency, 'institution', NEW.institution, 'parent_account_id', NEW.parent_account_id, 'opening_balance_minor', NEW.opening_balance_minor, 'is_archived', NEW.is_archived), 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
              INSERT INTO sync_revisions (entity_type, entity_id, revision) SELECT 'account', NEW.id, revision FROM sync_operations WHERE cursor = last_insert_rowid() ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision;
            END;
            CREATE TRIGGER sync_accounts_delete AFTER DELETE ON accounts
            WHEN (SELECT suppress_journal FROM sync_runtime LIMIT 1) = 0 BEGIN
              INSERT INTO sync_operations (idempotency_key, device_id, entity_type, entity_id, base_revision, revision, payload_digest, payload, tombstone, created_at)
              SELECT 'phone-journal:' || lower(hex(randomblob(16))), 'phone-local-ledger', 'account', OLD.id, COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = 'account' AND entity_id = OLD.id), 0), COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = 'account' AND entity_id = OLD.id), 0) + 1, 'sha256:phone-local-journal', json_object('schema_version', 1, 'operation', 'delete', 'entity_type', 'account', 'entity_id', OLD.id), 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
              INSERT INTO sync_revisions (entity_type, entity_id, revision) SELECT 'account', OLD.id, revision FROM sync_operations WHERE cursor = last_insert_rowid() ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision;
            END;
            "#,
        );
    }
    if table_has_column(connection, "categories", "name")? {
        sql.push_str(&entity_trigger_sql(
            "categories", "category", "NEW.id", "OLD.id",
            "json_object('schema_version', 1, 'operation', 'upsert', 'entity_type', 'category', 'entity_id', NEW.id, 'name', NEW.name, 'kind_scope', NEW.kind_scope, 'parent_id', NEW.parent_id, 'is_archived', NEW.is_archived)",
            "json_object('schema_version', 1, 'operation', 'delete', 'entity_type', 'category', 'entity_id', OLD.id)",
        ));
    }
    if table_has_column(connection, "tags", "name")? {
        sql.push_str(&entity_trigger_sql(
            "tags", "tag", "NEW.id", "OLD.id",
            "json_object('schema_version', 1, 'operation', 'upsert', 'entity_type', 'tag', 'entity_id', NEW.id, 'name', NEW.name, 'is_archived', NEW.is_archived)",
            "json_object('schema_version', 1, 'operation', 'delete', 'entity_type', 'tag', 'entity_id', OLD.id)",
        ));
    }
    if table_has_column(connection, "transactions", "amount_minor")? {
        sql.push_str(&entity_trigger_sql(
            "transactions", "transaction", "NEW.id", "OLD.id",
            "json_object('schema_version', 1, 'operation', 'upsert', 'entity_type', 'transaction', 'entity_id', NEW.id, 'amount_minor', NEW.amount_minor, 'currency', NEW.currency, 'kind', NEW.kind, 'status', NEW.status, 'account_id', NEW.account_id, 'booked_date', NEW.booked_date, 'value_date', NEW.value_date, 'payee', NEW.payee, 'description', NEW.description, 'category_id', NEW.category_id, 'note', NEW.note, 'source', NEW.source)",
            "json_object('schema_version', 1, 'operation', 'delete', 'entity_type', 'transaction', 'entity_id', OLD.id)",
        ));
    }
    if table_has_column(connection, "transfers", "debit_transaction_id")? {
        sql.push_str(&entity_trigger_sql(
            "transfers", "transfer", "NEW.id", "OLD.id",
            "json_object('schema_version', 1, 'operation', 'upsert', 'entity_type', 'transfer', 'entity_id', NEW.id, 'debit_transaction_id', NEW.debit_transaction_id, 'credit_transaction_id', NEW.credit_transaction_id, 'fee_transaction_id', NEW.fee_transaction_id)",
            "json_object('schema_version', 1, 'operation', 'delete', 'entity_type', 'transfer', 'entity_id', OLD.id)",
        ));
    }
    if table_has_column(connection, "budgets", "series_id")? {
        sql.push_str(&entity_trigger_sql(
            "budgets", "budget", "NEW.id", "OLD.id",
            "json_object('schema_version', 1, 'operation', 'upsert', 'entity_type', 'budget', 'entity_id', NEW.id, 'series_id', NEW.series_id, 'period', NEW.period, 'effective_to_period', NEW.effective_to_period, 'category_id', NEW.category_id, 'amount_minor', NEW.amount_minor, 'currency', NEW.currency, 'first_alert_percentage', NEW.first_alert_percentage, 'second_alert_percentage', NEW.second_alert_percentage)",
            "json_object('schema_version', 1, 'operation', 'delete', 'entity_type', 'budget', 'entity_id', OLD.id)",
        ));
    }
    if table_has_column(connection, "recurring_rules", "frequency_unit")? {
        sql.push_str(&entity_trigger_sql(
            "recurring_rules", "recurring_rule", "NEW.id", "OLD.id",
            "json_object('schema_version',1,'operation','upsert','entity_type','recurring_rule','entity_id',NEW.id,'name',NEW.name,'kind',NEW.kind,'account_id',NEW.account_id,'amount_minor',NEW.amount_minor,'currency',NEW.currency,'category_id',NEW.category_id,'payee',NEW.payee,'frequency',NEW.frequency,'frequency_unit',NEW.frequency_unit,'interval_value',NEW.interval_value,'nominal_day',NEW.nominal_day,'nominal_month',NEW.nominal_month,'weekend_policy',NEW.weekend_policy_v2,'next_nominal_date',NEW.next_nominal_date,'next_expected_date',NEW.next_expected_date,'enabled',NEW.enabled,'retired_at',NEW.retired_at,'expense_variability',NEW.expense_variability,'expense_exceptionality',NEW.expense_exceptionality)",
            "json_object('schema_version',1,'operation','delete','entity_type','recurring_rule','entity_id',OLD.id)",
        ));
    }
    if table_has_column(connection, "allocation_plans", "trigger_kind")? {
        sql.push_str(&entity_trigger_sql(
            "allocation_plans", "allocation_plan", "NEW.id", "OLD.id",
            "json_object('schema_version',1,'operation','upsert','entity_type','allocation_plan','entity_id',NEW.id,'name',NEW.name,'trigger_kind',NEW.trigger_kind,'source_account_id',NEW.source_account_id,'target_account_id',NEW.target_account_id,'amount_minor',NEW.amount_minor,'currency',NEW.currency,'enabled',NEW.enabled)",
            "json_object('schema_version',1,'operation','delete','entity_type','allocation_plan','entity_id',OLD.id)",
        ));
    }
    if table_has_column(connection, "loans", "installment_minor")? {
        sql.push_str(&entity_trigger_sql("loans", "loan", "NEW.id", "OLD.id", "json_object('schema_version',1,'operation','upsert','entity_type','loan','entity_id',NEW.id,'account_id',NEW.account_id,'lender',NEW.lender,'installment_minor',NEW.installment_minor,'remaining_principal_minor',NEW.remaining_principal_minor,'original_principal_minor',NEW.original_principal_minor,'currency',NEW.currency,'annual_nominal_rate_bps',NEW.annual_nominal_rate_bps,'annual_effective_rate_bps',NEW.annual_effective_rate_bps,'installments_paid',NEW.installments_paid,'installments_remaining',NEW.installments_remaining,'next_due_date',NEW.next_due_date)", "json_object('schema_version',1,'operation','delete','entity_type','loan','entity_id',OLD.id)"));
    }
    if table_has_column(connection, "investment_positions", "cost_basis_minor")? {
        sql.push_str(&entity_trigger_sql("investment_positions", "investment", "NEW.id", "OLD.id", "json_object('schema_version',1,'operation','upsert','entity_type','investment','entity_id',NEW.id,'account_id',NEW.account_id,'name',NEW.name,'symbol',NEW.symbol,'units',NEW.units,'cost_basis_minor',NEW.cost_basis_minor,'current_value_minor',NEW.current_value_minor,'currency',NEW.currency,'valuation_date',NEW.valuation_date)", "json_object('schema_version',1,'operation','delete','entity_type','investment','entity_id',OLD.id)"));
    }
    if table_has_column(connection, "monthly_journals", "period")? {
        sql.push_str(&entity_trigger_sql("monthly_journals", "monthly_journal", "NEW.id", "OLD.id", "json_object('schema_version',1,'operation','upsert','entity_type','monthly_journal','entity_id',NEW.id,'period',NEW.period,'note',NEW.note,'next_month_goals',NEW.next_month_goals,'perceived_control',NEW.perceived_control)", "json_object('schema_version',1,'operation','delete','entity_type','monthly_journal','entity_id',OLD.id)"));
    }
    connection.execute_batch(&sql)
}

fn entity_trigger_sql(
    table: &str,
    entity_type: &str,
    new_id: &str,
    old_id: &str,
    upsert_payload: &str,
    delete_payload: &str,
) -> String {
    format!(
        r#"
        DROP TRIGGER IF EXISTS sync_{table}_insert;
        DROP TRIGGER IF EXISTS sync_{table}_update;
        DROP TRIGGER IF EXISTS sync_{table}_delete;
        CREATE TRIGGER sync_{table}_insert AFTER INSERT ON {table}
        WHEN (SELECT suppress_journal FROM sync_runtime LIMIT 1) = 0 BEGIN
          INSERT INTO sync_operations (idempotency_key, device_id, entity_type, entity_id, base_revision, revision, payload_digest, payload, tombstone, created_at)
          SELECT 'phone-journal:' || lower(hex(randomblob(16))), 'phone-local-ledger', '{entity_type}', {new_id}, COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = '{entity_type}' AND entity_id = {new_id}), 0), COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = '{entity_type}' AND entity_id = {new_id}), 0) + 1, 'sha256:phone-local-journal', {upsert_payload}, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
          INSERT INTO sync_revisions (entity_type, entity_id, revision) SELECT '{entity_type}', {new_id}, revision FROM sync_operations WHERE cursor = last_insert_rowid() ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision;
        END;
        CREATE TRIGGER sync_{table}_update AFTER UPDATE ON {table}
        WHEN (SELECT suppress_journal FROM sync_runtime LIMIT 1) = 0 BEGIN
          INSERT INTO sync_operations (idempotency_key, device_id, entity_type, entity_id, base_revision, revision, payload_digest, payload, tombstone, created_at)
          SELECT 'phone-journal:' || lower(hex(randomblob(16))), 'phone-local-ledger', '{entity_type}', {new_id}, COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = '{entity_type}' AND entity_id = {new_id}), 0), COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = '{entity_type}' AND entity_id = {new_id}), 0) + 1, 'sha256:phone-local-journal', {upsert_payload}, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
          INSERT INTO sync_revisions (entity_type, entity_id, revision) SELECT '{entity_type}', {new_id}, revision FROM sync_operations WHERE cursor = last_insert_rowid() ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision;
        END;
        CREATE TRIGGER sync_{table}_delete AFTER DELETE ON {table}
        WHEN (SELECT suppress_journal FROM sync_runtime LIMIT 1) = 0 BEGIN
          INSERT INTO sync_operations (idempotency_key, device_id, entity_type, entity_id, base_revision, revision, payload_digest, payload, tombstone, created_at)
          SELECT 'phone-journal:' || lower(hex(randomblob(16))), 'phone-local-ledger', '{entity_type}', {old_id}, COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = '{entity_type}' AND entity_id = {old_id}), 0), COALESCE((SELECT revision FROM sync_revisions WHERE entity_type = '{entity_type}' AND entity_id = {old_id}), 0) + 1, 'sha256:phone-local-journal', {delete_payload}, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
          INSERT INTO sync_revisions (entity_type, entity_id, revision) SELECT '{entity_type}', {old_id}, revision FROM sync_operations WHERE cursor = last_insert_rowid() ON CONFLICT(entity_type, entity_id) DO UPDATE SET revision = excluded.revision;
        END;
        "#,
    )
}

fn bootstrap_operation(payload: serde_json::Value) -> ReplicableOperation {
    let payload_text = payload.to_string();
    let entity_id = payload
        .get("entity_id")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .to_owned();
    let idempotency_key = format!("bootstrap:{entity_id}");
    let digest = format!(
        "sha256:{}",
        Sha256::digest(payload_text.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    );
    ReplicableOperation {
        idempotency_key,
        device_id: "phone-local-ledger".to_owned(),
        entity_id,
        base_revision: 0,
        revision: 1,
        payload_digest: digest,
        payload: payload_text,
        tombstone: false,
        created_at: "1970-01-01T00:00:00.000Z".to_owned(),
    }
}

#[derive(Debug)]
pub enum DurableSyncError {
    Sqlite(rusqlite::Error),
    Transport(TransportError),
    NumericOverflow,
    InvalidPayload(String),
    LedgerRejected,
}

fn validate_payload(
    operation: &ReplicableOperation,
) -> Result<LedgerOperationPayload, DurableSyncError> {
    if operation.idempotency_key.is_empty()
        || operation.device_id.is_empty()
        || operation.entity_id.is_empty()
        || operation.created_at.is_empty()
    {
        return Err(DurableSyncError::InvalidPayload(
            "missing operation identity".to_owned(),
        ));
    }
    let payload: LedgerOperationPayload = serde_json::from_str(&operation.payload)
        .map_err(|_| DurableSyncError::InvalidPayload("payload is not valid JSON".to_owned()))?;
    if payload.schema_version != 1
        || !matches!(payload.operation.as_str(), "upsert" | "delete")
        || payload.entity_id != operation.entity_id
        || !matches!(
            payload.entity_type.as_str(),
            "account"
                | "category"
                | "tag"
                | "budget"
                | "recurring_rule"
                | "allocation_plan"
                | "loan"
                | "investment"
                | "monthly_journal"
                | "transaction"
                | "transfer"
        )
    {
        return Err(DurableSyncError::InvalidPayload(
            "unsupported ledger payload".to_owned(),
        ));
    }
    if let Some(amount_minor) = payload.amount_minor.as_deref()
        && !amount_minor.parse::<i128>().is_ok()
    {
        return Err(DurableSyncError::InvalidPayload(
            "amount_minor must be an integer string".to_owned(),
        ));
    }
    if let Some(currency) = payload.currency.as_deref()
        && (currency.len() != 3
            || !currency
                .chars()
                .all(|character| character.is_ascii_uppercase()))
    {
        return Err(DurableSyncError::InvalidPayload(
            "currency must be an ISO uppercase code".to_owned(),
        ));
    }
    if let Some(transfer_group_id) = payload.transfer_group_id.as_deref()
        && transfer_group_id.is_empty()
    {
        return Err(DurableSyncError::InvalidPayload(
            "transfer_group_id cannot be empty".to_owned(),
        ));
    }
    if payload.operation == "upsert" {
        match payload.entity_type.as_str() {
            "account" => {
                if payload.name.is_none()
                    || payload.account_type.is_none()
                    || payload.currency.is_none()
                    || payload.opening_balance_minor.is_none()
                {
                    return Err(DurableSyncError::InvalidPayload(
                        "account payload is incomplete".to_owned(),
                    ));
                }
            }
            "category" => {
                if payload.name.is_none() || payload.kind_scope.is_none() {
                    return Err(DurableSyncError::InvalidPayload(
                        "category payload is incomplete".to_owned(),
                    ));
                }
            }
            "tag" => {
                if payload.name.is_none() {
                    return Err(DurableSyncError::InvalidPayload(
                        "tag payload is incomplete".to_owned(),
                    ));
                }
            }
            "budget" => {
                if payload.period.is_none()
                    || payload.amount_minor.is_none()
                    || payload.currency.is_none()
                {
                    return Err(DurableSyncError::InvalidPayload(
                        "budget payload is incomplete".to_owned(),
                    ));
                }
            }
            "recurring_rule" => {
                if payload.name.is_none()
                    || payload.kind.is_none()
                    || payload.account_id.is_none()
                    || payload.amount_minor.is_none()
                    || payload.currency.is_none()
                    || payload.frequency_unit.is_none()
                    || payload.interval_value.is_none()
                    || payload.nominal_day.is_none()
                    || payload.next_expected_date.is_none()
                {
                    return Err(DurableSyncError::InvalidPayload(
                        "recurring rule payload is incomplete".to_owned(),
                    ));
                }
            }
            "allocation_plan" => {
                if payload.name.is_none()
                    || payload.trigger_kind.is_none()
                    || payload.source_account_id.is_none()
                    || payload.target_account_id.is_none()
                    || payload.amount_minor.is_none()
                    || payload.currency.is_none()
                {
                    return Err(DurableSyncError::InvalidPayload(
                        "allocation plan payload is incomplete".to_owned(),
                    ));
                }
            }
            "loan" => {
                if payload.account_id.is_none()
                    || payload.lender.is_none()
                    || payload.installment_minor.is_none()
                    || payload.remaining_principal_minor.is_none()
                    || payload.currency.is_none()
                {
                    return Err(DurableSyncError::InvalidPayload(
                        "loan payload is incomplete".to_owned(),
                    ));
                }
            }
            "investment" => {
                if payload.account_id.is_none()
                    || payload.name.is_none()
                    || payload.cost_basis_minor.is_none()
                    || payload.current_value_minor.is_none()
                    || payload.currency.is_none()
                    || payload.valuation_date.is_none()
                {
                    return Err(DurableSyncError::InvalidPayload(
                        "investment payload is incomplete".to_owned(),
                    ));
                }
            }
            "monthly_journal" => {
                if payload.period.is_none() {
                    return Err(DurableSyncError::InvalidPayload(
                        "monthly journal payload is incomplete".to_owned(),
                    ));
                }
            }
            "transaction" => {
                if payload.amount_minor.is_none()
                    || payload.currency.is_none()
                    || payload.kind.is_none()
                    || payload.status.is_none()
                    || payload.account_id.is_none()
                    || payload.booked_date.is_none()
                {
                    return Err(DurableSyncError::InvalidPayload(
                        "transaction payload is incomplete".to_owned(),
                    ));
                }
                if !matches!(
                    payload.kind.as_deref(),
                    Some("income" | "expense" | "transfer" | "adjustment")
                ) || !matches!(
                    payload.status.as_deref(),
                    Some("expected" | "booked" | "reconciled" | "cancelled")
                ) || !matches!(
                    payload.source.as_deref().unwrap_or("manual"),
                    "manual" | "import" | "recurring" | "system"
                ) {
                    return Err(DurableSyncError::InvalidPayload(
                        "transaction enum is invalid".to_owned(),
                    ));
                }
            }
            "transfer" => {
                if payload.debit_transaction_id.is_none() || payload.credit_transaction_id.is_none()
                {
                    return Err(DurableSyncError::InvalidPayload(
                        "transfer payload is incomplete".to_owned(),
                    ));
                }
            }
            _ => unreachable!(),
        }
    }
    Ok(payload)
}

fn apply_ledger_operation(
    transaction: &Transaction<'_>,
    operation: &ReplicableOperation,
    payload: &LedgerOperationPayload,
) -> Result<(), DurableSyncError> {
    let result = match (payload.entity_type.as_str(), payload.operation.as_str()) {
        ("account", "delete") => transaction.execute(
            "DELETE FROM accounts WHERE id = ?1",
            params![operation.entity_id],
        ),
        ("account", "upsert") => transaction.execute(
            "INSERT INTO accounts
             (id, name, type, institution, currency, parent_account_id, opening_balance_minor, is_archived)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
              name = excluded.name, institution = excluded.institution,
              parent_account_id = excluded.parent_account_id,
              opening_balance_minor = excluded.opening_balance_minor,
              is_archived = excluded.is_archived,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            params![
                operation.entity_id,
                payload.name.as_deref(),
                payload.account_type.as_deref(),
                payload.institution.as_deref(),
                payload.currency.as_deref(),
                payload.parent_account_id.as_deref(),
                payload.opening_balance_minor.as_deref(),
                i64::from(payload.is_archived.unwrap_or(false)),
            ],
        ),
        ("category", "delete") => transaction.execute(
            "DELETE FROM categories WHERE id = ?1",
            params![operation.entity_id],
        ),
        ("category", "upsert") => transaction.execute(
            "INSERT INTO categories (id, name, kind_scope, parent_id, is_archived)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
              name = excluded.name, kind_scope = excluded.kind_scope,
              parent_id = excluded.parent_id, is_archived = excluded.is_archived,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            params![
                operation.entity_id,
                payload.name.as_deref(),
                payload.kind_scope.as_deref(),
                payload.parent_id.as_deref(),
                i64::from(payload.is_archived.unwrap_or(false)),
            ],
        ),
        ("tag", "delete") => transaction.execute(
            "DELETE FROM tags WHERE id = ?1",
            params![operation.entity_id],
        ),
        ("tag", "upsert") => transaction.execute(
            "INSERT INTO tags (id, name, is_archived) VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET
              name = excluded.name, is_archived = excluded.is_archived,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            params![
                operation.entity_id,
                payload.name.as_deref(),
                i64::from(payload.is_archived.unwrap_or(false)),
            ],
        ),
        ("budget", "delete") => transaction.execute(
            "DELETE FROM budgets WHERE id = ?1",
            params![operation.entity_id],
        ),
        ("budget", "upsert") => transaction.execute(
            "INSERT INTO budgets
             (id, series_id, period, effective_to_period, category_id, amount_minor, currency,
              alert_at_80, alert_at_100, first_alert_percentage, second_alert_percentage)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, 1, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET
              series_id = excluded.series_id, period = excluded.period,
              effective_to_period = excluded.effective_to_period,
              category_id = excluded.category_id, amount_minor = excluded.amount_minor,
              currency = excluded.currency,
              first_alert_percentage = excluded.first_alert_percentage,
              second_alert_percentage = excluded.second_alert_percentage",
            params![
                operation.entity_id,
                payload.series_id.as_deref().unwrap_or(&operation.entity_id),
                payload.period.as_deref(),
                payload.effective_to_period.as_deref(),
                payload.category_id.as_deref(),
                payload.amount_minor.as_deref(),
                payload.currency.as_deref(),
                payload.first_alert_percentage,
                payload.second_alert_percentage,
            ],
        ),
        ("recurring_rule", "delete") => transaction.execute(
            "DELETE FROM recurring_rules WHERE id = ?1",
            params![operation.entity_id],
        ),
        ("recurring_rule", "upsert") => transaction.execute(
            "INSERT INTO recurring_rules (id,name,kind,account_id,amount_minor,currency,category_id,payee,frequency,interval_months,nominal_day,weekend_policy,next_expected_date,enabled,frequency_unit,interval_value,nominal_month,next_nominal_date,weekend_policy_v2,retired_at,expense_variability,expense_exceptionality) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,account_id=excluded.account_id,amount_minor=excluded.amount_minor,currency=excluded.currency,category_id=excluded.category_id,payee=excluded.payee,frequency=excluded.frequency,interval_months=excluded.interval_months,nominal_day=excluded.nominal_day,weekend_policy=excluded.weekend_policy,next_expected_date=excluded.next_expected_date,enabled=excluded.enabled,frequency_unit=excluded.frequency_unit,interval_value=excluded.interval_value,nominal_month=excluded.nominal_month,next_nominal_date=excluded.next_nominal_date,weekend_policy_v2=excluded.weekend_policy_v2,retired_at=excluded.retired_at,expense_variability=excluded.expense_variability,expense_exceptionality=excluded.expense_exceptionality",
            params![
                operation.entity_id,
                payload.name.as_deref(),
                payload.kind.as_deref(),
                payload.account_id.as_deref(),
                payload.amount_minor.as_deref(),
                payload.currency.as_deref(),
                payload.category_id.as_deref(),
                payload.payee.as_deref(),
                payload.kind.as_deref().map(|_| "monthly"),
                payload.interval_value.unwrap_or(1),
                payload.nominal_day.unwrap_or(1),
                payload.weekend_policy.as_deref().unwrap_or("none"),
                payload.next_expected_date.as_deref(),
                i64::from(payload.enabled.unwrap_or(true)),
                payload.frequency_unit.as_deref(),
                payload.interval_value,
                payload.nominal_month,
                payload.next_nominal_date.as_deref(),
                payload.weekend_policy.as_deref().unwrap_or("none"),
                payload.retired_at.as_deref(),
                payload.expense_variability.as_deref(),
                payload.expense_exceptionality.as_deref(),
            ],
        ),
        ("allocation_plan", "delete") => transaction.execute("DELETE FROM allocation_plans WHERE id = ?1", params![operation.entity_id]),
        ("allocation_plan", "upsert") => transaction.execute(
            "INSERT INTO allocation_plans (id,name,trigger_kind,source_account_id,target_account_id,amount_minor,currency,enabled) VALUES (?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(id) DO UPDATE SET name=excluded.name,trigger_kind=excluded.trigger_kind,source_account_id=excluded.source_account_id,target_account_id=excluded.target_account_id,amount_minor=excluded.amount_minor,currency=excluded.currency,enabled=excluded.enabled",
            params![operation.entity_id,payload.name.as_deref(),payload.trigger_kind.as_deref(),payload.source_account_id.as_deref(),payload.target_account_id.as_deref(),payload.amount_minor.as_deref(),payload.currency.as_deref(),i64::from(payload.enabled.unwrap_or(true))],
        ),
        ("loan", "delete") => transaction.execute("DELETE FROM loans WHERE id = ?1", params![operation.entity_id]),
        ("loan", "upsert") => transaction.execute("INSERT INTO loans (id,account_id,lender,installment_minor,remaining_principal_minor,original_principal_minor,currency,annual_nominal_rate_bps,annual_effective_rate_bps,installments_paid,installments_remaining,next_due_date) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12) ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,lender=excluded.lender,installment_minor=excluded.installment_minor,remaining_principal_minor=excluded.remaining_principal_minor,original_principal_minor=excluded.original_principal_minor,currency=excluded.currency,annual_nominal_rate_bps=excluded.annual_nominal_rate_bps,annual_effective_rate_bps=excluded.annual_effective_rate_bps,installments_paid=excluded.installments_paid,installments_remaining=excluded.installments_remaining,next_due_date=excluded.next_due_date", params![operation.entity_id,payload.account_id.as_deref(),payload.lender.as_deref(),payload.installment_minor.as_deref(),payload.remaining_principal_minor.as_deref(),payload.original_principal_minor.as_deref(),payload.currency.as_deref(),payload.annual_nominal_rate_bps,payload.annual_effective_rate_bps,payload.installments_paid,payload.installments_remaining,payload.next_due_date.as_deref()]),
        ("investment", "delete") => transaction.execute("DELETE FROM investment_positions WHERE id = ?1", params![operation.entity_id]),
        ("investment", "upsert") => transaction.execute("INSERT INTO investment_positions (id,account_id,name,symbol,units,cost_basis_minor,current_value_minor,currency,valuation_date) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,name=excluded.name,symbol=excluded.symbol,units=excluded.units,cost_basis_minor=excluded.cost_basis_minor,current_value_minor=excluded.current_value_minor,currency=excluded.currency,valuation_date=excluded.valuation_date", params![operation.entity_id,payload.account_id.as_deref(),payload.name.as_deref(),payload.symbol.as_deref(),payload.units.as_deref(),payload.cost_basis_minor.as_deref(),payload.current_value_minor.as_deref(),payload.currency.as_deref(),payload.valuation_date.as_deref()]),
        ("monthly_journal", "delete") => transaction.execute("DELETE FROM monthly_journals WHERE id = ?1", params![operation.entity_id]),
        ("monthly_journal", "upsert") => transaction.execute("INSERT INTO monthly_journals (id,period,note,next_month_goals,perceived_control,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(id) DO UPDATE SET period=excluded.period,note=excluded.note,next_month_goals=excluded.next_month_goals,perceived_control=excluded.perceived_control,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')", params![operation.entity_id,payload.period.as_deref(),payload.note.as_deref(),payload.next_month_goals.as_deref(),payload.perceived_control]),
        ("transaction", "delete") => transaction.execute(
            "DELETE FROM transactions WHERE id = ?1",
            params![operation.entity_id],
        ),
        ("transaction", "upsert") => transaction.execute(
            "INSERT INTO transactions
             (id, kind, status, account_id, amount_minor, currency, booked_date, value_date,
              payee, description, category_id, note, source)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(id) DO UPDATE SET
              kind = excluded.kind, status = excluded.status, account_id = excluded.account_id,
              amount_minor = excluded.amount_minor, currency = excluded.currency,
              booked_date = excluded.booked_date, value_date = excluded.value_date,
              payee = excluded.payee, description = excluded.description,
              category_id = excluded.category_id, note = excluded.note, source = excluded.source,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            params![
                operation.entity_id,
                payload.kind.as_deref(),
                payload.status.as_deref(),
                payload.account_id.as_deref(),
                payload.amount_minor.as_deref(),
                payload.currency.as_deref(),
                payload.booked_date.as_deref(),
                payload.value_date.as_deref(),
                payload.payee.as_deref(),
                payload.description.as_deref(),
                payload.category_id.as_deref(),
                payload.note.as_deref(),
                payload.source.as_deref().unwrap_or("manual"),
            ],
        ),
        ("transfer", "delete") => transaction.execute(
            "DELETE FROM transfers WHERE id = ?1",
            params![operation.entity_id],
        ),
        ("transfer", "upsert") => transaction.execute(
            "INSERT INTO transfers (id, debit_transaction_id, credit_transaction_id, fee_transaction_id)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET
              debit_transaction_id = excluded.debit_transaction_id,
              credit_transaction_id = excluded.credit_transaction_id,
              fee_transaction_id = excluded.fee_transaction_id",
            params![
                operation.entity_id,
                payload.debit_transaction_id.as_deref(),
                payload.credit_transaction_id.as_deref(),
                payload.fee_transaction_id.as_deref(),
            ],
        ),
        _ => unreachable!(),
    };
    result
        .map(|_| ())
        .map_err(|_| DurableSyncError::LedgerRejected)
}

impl From<rusqlite::Error> for DurableSyncError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

fn as_i64(value: u64) -> Result<i64, DurableSyncError> {
    i64::try_from(value).map_err(|_| DurableSyncError::NumericOverflow)
}

fn as_u64(value: i64) -> Result<u64, DurableSyncError> {
    u64::try_from(value).map_err(|_| DurableSyncError::NumericOverflow)
}

fn to_sql_error(error: DurableSyncError) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(
        0,
        rusqlite::types::Type::Integer,
        Box::new(std::io::Error::other(format!("{error:?}"))),
    )
}

#[cfg(test)]
mod tests {
    use super::SqliteSyncOperationStore;
    use crate::{OperationApplyResult, ReplicableOperation, TransportError};
    use rusqlite::Connection;
    use tempfile::tempdir;

    fn open_store(path: impl AsRef<std::path::Path>) -> SqliteSyncOperationStore {
        let path = path.as_ref();
        let connection = Connection::open(path).unwrap();
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 CREATE TABLE accounts (
                   id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
                   institution TEXT, currency TEXT NOT NULL, parent_account_id TEXT,
                   opening_balance_minor TEXT NOT NULL DEFAULT '0',
                   is_archived INTEGER NOT NULL DEFAULT 0,
                   updated_at TEXT NOT NULL DEFAULT ''
                 );
                 CREATE TABLE categories (
                   id TEXT PRIMARY KEY, name TEXT NOT NULL, kind_scope TEXT NOT NULL,
                   parent_id TEXT, is_archived INTEGER NOT NULL DEFAULT 0
                 );
                 CREATE TABLE tags (
                   id TEXT PRIMARY KEY, name TEXT NOT NULL, is_archived INTEGER NOT NULL DEFAULT 0
                 );
                 CREATE TABLE budgets (
                   id TEXT PRIMARY KEY, series_id TEXT NOT NULL, period TEXT NOT NULL,
                   effective_to_period TEXT, category_id TEXT, amount_minor TEXT NOT NULL,
                   currency TEXT NOT NULL, alert_at_80 INTEGER NOT NULL DEFAULT 1,
                   alert_at_100 INTEGER NOT NULL DEFAULT 1, first_alert_percentage INTEGER,
                   second_alert_percentage INTEGER
                 );
                 CREATE TABLE recurring_rules (
                   id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL,
                   account_id TEXT NOT NULL, amount_minor TEXT NOT NULL, currency TEXT NOT NULL,
                   category_id TEXT, payee TEXT, frequency TEXT NOT NULL DEFAULT 'monthly',
                   interval_months INTEGER NOT NULL DEFAULT 1, nominal_day INTEGER NOT NULL DEFAULT 1,
                   weekend_policy TEXT NOT NULL DEFAULT 'none', next_expected_date TEXT NOT NULL,
                   enabled INTEGER NOT NULL DEFAULT 1, frequency_unit TEXT NOT NULL DEFAULT 'month',
                   interval_value INTEGER NOT NULL DEFAULT 1, nominal_month INTEGER,
                   next_nominal_date TEXT, weekend_policy_v2 TEXT, retired_at TEXT,
                   expense_variability TEXT, expense_exceptionality TEXT
                 );
                 CREATE TABLE allocation_plans (
                   id TEXT PRIMARY KEY, name TEXT NOT NULL, trigger_kind TEXT NOT NULL,
                   source_account_id TEXT NOT NULL, target_account_id TEXT NOT NULL,
                   amount_minor TEXT NOT NULL, currency TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
                 );
                 CREATE TABLE loans (
                   id TEXT PRIMARY KEY, account_id TEXT NOT NULL, lender TEXT NOT NULL,
                   installment_minor TEXT NOT NULL, remaining_principal_minor TEXT NOT NULL,
                   original_principal_minor TEXT, currency TEXT NOT NULL,
                   annual_nominal_rate_bps INTEGER, annual_effective_rate_bps INTEGER,
                   installments_paid INTEGER, installments_remaining INTEGER, next_due_date TEXT
                 );
                 CREATE TABLE investment_positions (
                   id TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL,
                   symbol TEXT, units TEXT, cost_basis_minor TEXT NOT NULL,
                   current_value_minor TEXT NOT NULL, currency TEXT NOT NULL, valuation_date TEXT NOT NULL
                 );
                 CREATE TABLE monthly_journals (
                   id TEXT PRIMARY KEY, period TEXT NOT NULL, note TEXT, next_month_goals TEXT,
                   perceived_control INTEGER, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
                 );
                 CREATE TABLE transactions (
                   id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL,
                   account_id TEXT NOT NULL REFERENCES accounts(id), amount_minor TEXT NOT NULL,
                   currency TEXT NOT NULL, booked_date TEXT NOT NULL, value_date TEXT,
                   payee TEXT, description TEXT, category_id TEXT, note TEXT,
                   source TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT ''
                 );
                 CREATE TABLE transfers (
                   id TEXT PRIMARY KEY, debit_transaction_id TEXT NOT NULL UNIQUE
                     REFERENCES transactions(id), credit_transaction_id TEXT NOT NULL UNIQUE
                     REFERENCES transactions(id), fee_transaction_id TEXT
                 );
                 CREATE TRIGGER validate_transfer BEFORE INSERT ON transfers BEGIN
                   SELECT CASE WHEN NOT EXISTS (
                     SELECT 1 FROM transactions debit JOIN transactions credit
                       ON credit.id = NEW.credit_transaction_id
                     WHERE debit.id = NEW.debit_transaction_id
                       AND debit.kind = 'transfer' AND credit.kind = 'transfer'
                       AND debit.amount_minor = '-' || credit.amount_minor
                       AND debit.currency = credit.currency
                       AND debit.account_id <> credit.account_id
                       AND debit.booked_date = credit.booked_date
                       AND debit.status = credit.status
                   ) THEN RAISE(ABORT, 'invalid transfer legs') END;
                 END;
                 INSERT INTO accounts (id, name, type, currency) VALUES
                   ('account-synthetic', 'Synthetic', 'checking', 'EUR'),
                   ('account-second', 'Second', 'checking', 'EUR');
                 INSERT INTO categories (id, name, kind_scope) VALUES
                   ('category-synthetic', 'Synthetic', 'expense');
                 INSERT INTO tags (id, name) VALUES ('tag-synthetic', 'Synthetic');",
            )
            .unwrap();
        SqliteSyncOperationStore::open(path).unwrap()
    }

    fn operation(key: &str, base_revision: u64) -> ReplicableOperation {
        ReplicableOperation {
            idempotency_key: key.to_owned(),
            device_id: "phone-pma-2".to_owned(),
            entity_id: "transaction-synthetic".to_owned(),
            base_revision,
            revision: 0,
            payload_digest: format!("sha256:{key}"),
            payload: format!(
                "{{\"schema_version\":1,\"operation\":\"upsert\",\"entity_type\":\"transaction\",\"entity_id\":\"transaction-synthetic\",\"amount_minor\":\"100\",\"currency\":\"EUR\",\"kind\":\"adjustment\",\"status\":\"booked\",\"account_id\":\"account-synthetic\",\"booked_date\":\"2026-09-14\",\"source\":\"manual\"}}"
            ),
            tombstone: false,
            created_at: "2026-09-14T00:00:00.000Z".to_owned(),
        }
    }

    fn transfer_leg(
        key: &str,
        id: &str,
        account_id: &str,
        amount_minor: &str,
    ) -> ReplicableOperation {
        ReplicableOperation {
            idempotency_key: key.to_owned(),
            device_id: "phone-pma-2".to_owned(),
            entity_id: id.to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: format!("sha256:{key}"),
            payload: format!(
                "{{\"schema_version\":1,\"operation\":\"upsert\",\"entity_type\":\"transaction\",\"entity_id\":\"{id}\",\"amount_minor\":\"{amount_minor}\",\"currency\":\"EUR\",\"kind\":\"transfer\",\"status\":\"booked\",\"account_id\":\"{account_id}\",\"booked_date\":\"2026-09-14\",\"source\":\"manual\"}}"
            ),
            tombstone: false,
            created_at: "2026-09-14T00:00:00.000Z".to_owned(),
        }
    }

    #[test]
    fn persists_cursor_idempotency_and_revision_after_reopen() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("nexora.db");
        let mut store = open_store(&path);
        assert_eq!(
            store.push("delivery-1", [operation("op-1", 0)]).unwrap(),
            vec![OperationApplyResult::Applied {
                cursor: 1,
                revision: 1
            }]
        );
        drop(store);

        let mut reopened = SqliteSyncOperationStore::open(&path).unwrap();
        assert_eq!(reopened.pull(0).unwrap().len(), 1);
        assert_eq!(
            reopened.push("delivery-2", [operation("op-1", 0)]).unwrap(),
            vec![OperationApplyResult::Duplicate {
                cursor: 1,
                revision: 1
            }]
        );
    }

    #[test]
    fn rejects_replayed_delivery_and_preserves_stale_conflict_without_overwrite() {
        let directory = tempdir().unwrap();
        let mut store = open_store(directory.path().join("nexora.db"));
        assert!(store.push("delivery-1", [operation("op-1", 0)]).is_ok());
        assert!(matches!(
            store.push("delivery-1", [operation("op-2", 1)]),
            Err(super::DurableSyncError::Transport(
                TransportError::ReplayDetected
            ))
        ));
        assert_eq!(
            store.push("delivery-2", [operation("op-2", 0)]).unwrap(),
            vec![OperationApplyResult::Conflict {
                current_revision: 1
            }]
        );
        assert_eq!(store.pull(0).unwrap().len(), 1);
    }

    #[test]
    fn rejects_invalid_payload_atomically_and_bootstraps_durable_log() {
        let directory = tempdir().unwrap();
        let mut store = open_store(directory.path().join("nexora.db"));
        let mut invalid = operation("op-invalid", 0);
        invalid.payload = "not-json".to_owned();
        assert!(matches!(
            store.push("delivery-invalid", [invalid]),
            Err(super::DurableSyncError::InvalidPayload(_))
        ));
        assert_eq!(store.pull(0).unwrap(), Vec::new());
        store
            .push("delivery-valid", [operation("op-valid", 0)])
            .unwrap();
        let bootstrap = store.bootstrap().unwrap();
        assert_eq!(bootstrap.schema_version, 1);
        assert_eq!(bootstrap.cursor, 1);
        assert_eq!(bootstrap.operations.len(), 5);
        assert!(
            bootstrap
                .operations
                .iter()
                .any(|(_, operation)| operation.payload.contains("account-synthetic"))
        );
        assert!(
            bootstrap
                .operations
                .iter()
                .any(|(_, operation)| operation.payload.contains("category-synthetic"))
        );
        assert!(
            bootstrap
                .operations
                .iter()
                .any(|(_, operation)| operation.payload.contains("tag-synthetic"))
        );
    }

    #[test]
    fn normal_mobile_sqlite_writes_append_incremental_upsert_and_delete_events() {
        let directory = tempdir().unwrap();
        let store = open_store(directory.path().join("nexora.db"));
        store
            .connection
            .execute(
                "INSERT INTO transactions
                 (id, kind, status, account_id, amount_minor, currency, booked_date, source)
                 VALUES ('transaction-mobile', 'expense', 'booked', 'account-synthetic', '250', 'EUR', '2026-09-14', 'manual')",
                [],
            )
            .unwrap();
        let first_pull = store.pull(0).unwrap();
        assert_eq!(first_pull.len(), 1);
        assert_eq!(first_pull[0].0, 1);
        assert!(first_pull[0].1.payload.contains("transaction-mobile"));
        assert_eq!(first_pull[0].1.revision, 1);

        store
            .connection
            .execute(
                "DELETE FROM transactions WHERE id = 'transaction-mobile'",
                [],
            )
            .unwrap();
        let second_pull = store.pull(1).unwrap();
        assert_eq!(second_pull.len(), 1);
        assert_eq!(second_pull[0].0, 2);
        assert!(second_pull[0].1.tombstone);
        assert!(
            second_pull[0]
                .1
                .payload
                .contains("\"operation\":\"delete\"")
        );
        assert_eq!(second_pull[0].1.base_revision, 1);
        assert_eq!(second_pull[0].1.revision, 2);
    }

    #[test]
    fn normal_mobile_core_entities_and_transfer_are_pull_visible_in_order() {
        let directory = tempdir().unwrap();
        let store = open_store(directory.path().join("nexora.db"));
        store
            .connection
            .execute(
                "INSERT INTO accounts (id, name, type, currency, opening_balance_minor)
                 VALUES ('account-mobile', 'Mobile', 'checking', 'EUR', '0')",
                [],
            )
            .unwrap();
        store
            .connection
            .execute(
                "INSERT INTO categories (id, name, kind_scope) VALUES ('category-mobile', 'Mobile', 'expense')",
                [],
            )
            .unwrap();
        store
            .connection
            .execute(
                "INSERT INTO tags (id, name) VALUES ('tag-mobile', 'Mobile')",
                [],
            )
            .unwrap();
        let metadata = store.pull(0).unwrap();
        assert_eq!(metadata.len(), 3);
        assert_eq!(
            metadata
                .iter()
                .map(
                    |(_, operation)| serde_json::from_str::<serde_json::Value>(&operation.payload)
                        .unwrap()
                        .get("entity_type")
                        .unwrap()
                        .as_str()
                        .unwrap()
                        .to_owned()
                )
                .collect::<Vec<_>>(),
            vec!["account", "category", "tag"]
        );

        store
            .connection
            .execute(
                "UPDATE categories SET name = 'Mobile updated' WHERE id = 'category-mobile'",
                [],
            )
            .unwrap();
        store
            .connection
            .execute("DELETE FROM tags WHERE id = 'tag-mobile'", [])
            .unwrap();
        store
            .connection
            .execute(
                "INSERT INTO transactions
                 (id, kind, status, account_id, amount_minor, currency, booked_date, source)
                 VALUES ('transfer-mobile-debit', 'transfer', 'booked', 'account-mobile', '-100', 'EUR', '2026-09-14', 'manual'),
                        ('transfer-mobile-credit', 'transfer', 'booked', 'account-second', '100', 'EUR', '2026-09-14', 'manual')",
                [],
            )
            .unwrap();
        store
            .connection
            .execute(
                "INSERT INTO transfers (id, debit_transaction_id, credit_transaction_id)
                 VALUES ('transfer-mobile', 'transfer-mobile-debit', 'transfer-mobile-credit')",
                [],
            )
            .unwrap();
        let incremental = store.pull(3).unwrap();
        assert_eq!(incremental.len(), 5);
        assert_eq!(incremental[0].0, 4);
        assert_eq!(incremental[1].0, 5);
        assert!(incremental[1].1.tombstone);
        assert_eq!(incremental[2].0, 6);
        assert_eq!(incremental[3].0, 7);
        assert_eq!(incremental[4].0, 8);
        assert!(incremental[4].1.payload.contains("transfer-mobile"));
        assert!(store.pull(8).unwrap().is_empty());
    }

    #[test]
    fn normal_mobile_budget_writes_append_incremental_events() {
        let directory = tempdir().unwrap();
        let store = open_store(directory.path().join("nexora.db"));
        store
            .connection
            .execute(
                "INSERT INTO budgets
                 (id, series_id, period, category_id, amount_minor, currency,
                  first_alert_percentage, second_alert_percentage)
                 VALUES ('budget-mobile', 'series-mobile', '2026-10', 'category-synthetic',
                         '50000', 'EUR', 80, 100)",
                [],
            )
            .unwrap();
        let inserted = store.pull(0).unwrap();
        assert_eq!(inserted.len(), 1);
        assert!(inserted[0].1.payload.contains("budget-mobile"));
        assert!(inserted[0].1.payload.contains("series-mobile"));

        store
            .connection
            .execute(
                "UPDATE budgets SET amount_minor = '60000' WHERE id = 'budget-mobile'",
                [],
            )
            .unwrap();
        store
            .connection
            .execute("DELETE FROM budgets WHERE id = 'budget-mobile'", [])
            .unwrap();
        let changed = store.pull(1).unwrap();
        assert_eq!(changed.len(), 2);
        assert!(changed[0].1.payload.contains("60000"));
        assert!(changed[1].1.tombstone);
    }

    #[test]
    fn applies_budget_operation_directly_to_host_sqlite() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("nexora.db");
        let mut store = open_store(&path);
        let operation = ReplicableOperation {
            idempotency_key: "op-budget".to_owned(),
            device_id: "pc-pma-2".to_owned(),
            entity_id: "budget-remote".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: "sha256:op-budget".to_owned(),
            payload: "{\"schema_version\":1,\"operation\":\"upsert\",\"entity_type\":\"budget\",\"entity_id\":\"budget-remote\",\"series_id\":\"series-remote\",\"period\":\"2026-11\",\"amount_minor\":\"75000\",\"currency\":\"EUR\",\"first_alert_percentage\":80,\"second_alert_percentage\":100}".to_owned(),
            tombstone: false,
            created_at: "2026-09-14T00:00:00.000Z".to_owned(),
        };
        let results = store.push("delivery-budget", [operation]).unwrap();
        assert_eq!(results.len(), 1);
        assert!(matches!(results[0], OperationApplyResult::Applied { .. }));
        drop(store);
        let connection = Connection::open(&path).unwrap();
        let amount: String = connection
            .query_row(
                "SELECT amount_minor FROM budgets WHERE id = 'budget-remote'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(amount, "75000");
    }

    #[test]
    fn recurring_and_allocation_operations_are_journaled_and_applied_atomically() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("nexora.db");
        let store = open_store(&path);
        store
            .connection
            .execute("INSERT INTO recurring_rules (id,name,kind,account_id,amount_minor,currency,next_expected_date) VALUES ('rule-1','Salary','income','account-synthetic','100000','EUR','2026-10-01')", [])
            .unwrap();
        store
            .connection
            .execute("INSERT INTO allocation_plans (id,name,trigger_kind,source_account_id,target_account_id,amount_minor,currency) VALUES ('plan-1','Savings','salary','account-synthetic','account-second','10000','EUR')", [])
            .unwrap();
        let pulled = store.pull(0).unwrap();
        assert_eq!(pulled.len(), 2);
        assert!(pulled[0].1.payload.contains("recurring_rule"));
        assert!(pulled[1].1.payload.contains("allocation_plan"));
    }

    #[test]
    fn loan_investment_and_monthly_journal_are_journaled() {
        let directory = tempdir().unwrap();
        let store = open_store(directory.path().join("nexora.db"));
        store.connection.execute("INSERT INTO loans (id,account_id,lender,installment_minor,remaining_principal_minor,currency) VALUES ('loan-1','account-synthetic','Bank','1000','9000','EUR')", []).unwrap();
        store.connection.execute("INSERT INTO investment_positions (id,account_id,name,cost_basis_minor,current_value_minor,currency,valuation_date) VALUES ('investment-1','account-synthetic','Fund','10000','11000','EUR','2026-10-01')", []).unwrap();
        store.connection.execute("INSERT INTO monthly_journals (id,period,note) VALUES ('journal-1','2026-10','Note')", []).unwrap();
        let pulled = store.pull(0).unwrap();
        assert_eq!(pulled.len(), 3);
        assert!(pulled.iter().any(|(_, op)| op.payload.contains("loan")));
        assert!(
            pulled
                .iter()
                .any(|(_, op)| op.payload.contains("investment"))
        );
        assert!(
            pulled
                .iter()
                .any(|(_, op)| op.payload.contains("monthly_journal"))
        );
    }

    #[test]
    fn applies_transfer_legs_and_rejects_unbalanced_bundle_atomically() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("nexora.db");
        let mut store = open_store(&path);
        let debit = transfer_leg("op-debit", "transfer-debit", "account-synthetic", "-100");
        let credit = transfer_leg("op-credit", "transfer-credit", "account-second", "100");
        let transfer = ReplicableOperation {
            idempotency_key: "op-transfer".to_owned(),
            device_id: "phone-pma-2".to_owned(),
            entity_id: "transfer-1".to_owned(),
            base_revision: 0,
            revision: 0,
            payload_digest: "sha256:op-transfer".to_owned(),
            payload: "{\"schema_version\":1,\"operation\":\"upsert\",\"entity_type\":\"transfer\",\"entity_id\":\"transfer-1\",\"debit_transaction_id\":\"transfer-debit\",\"credit_transaction_id\":\"transfer-credit\"}".to_owned(),
            tombstone: false,
            created_at: "2026-09-14T00:00:00.000Z".to_owned(),
        };
        let results = store
            .push("delivery-transfer", [debit, credit, transfer])
            .unwrap();
        assert_eq!(results.len(), 3);
        drop(store);
        let connection = Connection::open(&path).unwrap();
        assert_eq!(
            connection
                .query_row("SELECT count(*) FROM transfers", [], |row| row
                    .get::<_, i64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            connection
                .query_row(
                    "SELECT sum(CAST(amount_minor AS INTEGER)) FROM transactions",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap(),
            0
        );
    }
}
