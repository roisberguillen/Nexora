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
            "account" | "category" | "tag" | "transaction" | "transfer"
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
