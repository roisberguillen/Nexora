use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
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
                 entity_id TEXT NOT NULL,
                 base_revision INTEGER NOT NULL,
                 revision INTEGER NOT NULL,
                 payload_digest TEXT NOT NULL,
                 payload TEXT NOT NULL,
                 tombstone INTEGER NOT NULL CHECK (tombstone IN (0, 1)),
                 created_at TEXT NOT NULL
             ) STRICT;
             CREATE TABLE IF NOT EXISTS sync_revisions (
                 entity_id TEXT PRIMARY KEY,
                 revision INTEGER NOT NULL
             ) STRICT;",
        )?;
        Ok(Self { connection })
    }

    pub fn push(
        &mut self,
        delivery_id: &str,
        operations: impl IntoIterator<Item = ReplicableOperation>,
    ) -> Result<Vec<OperationApplyResult>, DurableSyncError> {
        let transaction = self.connection.transaction()?;
        let operations: Vec<ReplicableOperation> = operations.into_iter().collect();
        for operation in &operations {
            validate_payload(operation)?;
        }
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
        for operation in operations {
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
                    "SELECT revision FROM sync_revisions WHERE entity_id = ?1",
                    params![operation.entity_id],
                    |row| row.get::<_, i64>(0),
                )
                .optional()?
                .unwrap_or(0);
            let current_revision = as_u64(current)?;
            if operation.base_revision != current_revision {
                results.push(OperationApplyResult::Conflict { current_revision });
                continue;
            }

            let revision = current_revision
                .checked_add(1)
                .ok_or(DurableSyncError::NumericOverflow)?;
            transaction.execute(
                "INSERT INTO sync_operations
                    (idempotency_key, device_id, entity_id, base_revision, revision,
                     payload_digest, payload, tombstone, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    operation.idempotency_key,
                    operation.device_id,
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
                "INSERT INTO sync_revisions (entity_id, revision) VALUES (?1, ?2)
                 ON CONFLICT(entity_id) DO UPDATE SET revision = excluded.revision",
                params![operation.entity_id, as_i64(revision)?],
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
        let operations = self.pull(0)?;
        let cursor = operations.last().map(|(cursor, _)| *cursor).unwrap_or(0);
        Ok(SyncBootstrapSnapshot {
            schema_version: 1,
            cursor,
            operations,
        })
    }
}

#[derive(Debug)]
pub enum DurableSyncError {
    Sqlite(rusqlite::Error),
    Transport(TransportError),
    NumericOverflow,
    InvalidPayload(String),
}

fn validate_payload(operation: &ReplicableOperation) -> Result<(), DurableSyncError> {
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
                | "transaction"
                | "transaction_split"
                | "transaction_tag"
                | "transfer"
                | "recurring_rule"
                | "allocation_plan"
                | "budget"
                | "loan"
                | "investment_position"
                | "monthly_journal"
                | "import_batch"
                | "import_row"
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
    Ok(())
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
    use tempfile::tempdir;

    fn operation(key: &str, base_revision: u64) -> ReplicableOperation {
        ReplicableOperation {
            idempotency_key: key.to_owned(),
            device_id: "phone-pma-2".to_owned(),
            entity_id: "transaction-synthetic".to_owned(),
            base_revision,
            revision: 0,
            payload_digest: format!("sha256:{key}"),
            payload: format!(
                "{{\"schema_version\":1,\"operation\":\"upsert\",\"entity_type\":\"transaction\",\"entity_id\":\"transaction-synthetic\",\"amount_minor\":\"100\",\"currency\":\"EUR\"}}"
            ),
            tombstone: false,
            created_at: "2026-09-14T00:00:00.000Z".to_owned(),
        }
    }

    #[test]
    fn persists_cursor_idempotency_and_revision_after_reopen() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("nexora.db");
        let mut store = SqliteSyncOperationStore::open(&path).unwrap();
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
        let mut store = SqliteSyncOperationStore::open(directory.path().join("nexora.db")).unwrap();
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
        let mut store = SqliteSyncOperationStore::open(directory.path().join("nexora.db")).unwrap();
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
        assert_eq!(store.bootstrap().unwrap().schema_version, 1);
        assert_eq!(store.bootstrap().unwrap().cursor, 1);
        assert_eq!(store.bootstrap().unwrap().operations.len(), 1);
    }
}
